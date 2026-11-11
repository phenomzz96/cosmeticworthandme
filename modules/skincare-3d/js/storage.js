// Data Layer – lưu trữ theo userId + chuyển đổi dữ liệu prototype 0.2 sang schema 3.
// Khi tích hợp thật, thay file này bằng lớp gọi API; Routine Manager chỉ dùng open()/save()/retry()/status().
//
// 0.3.1 – xử lý lỗi lưu trữ tập trung:
// • Mọi thao tác localStorage đi qua access(): không bao giờ ném lỗi ra ngoài, trả {ok, value, error, kind}.
// • Phân biệt: không truy cập được storage (no-access), không đọc được (read-failed), không ghi được (write-failed),
//   JSON hỏng (corrupt – có sao lưu đã xác minh), dữ liệu sai cấu trúc (invalid), schema mới hơn (newer-schema).
// • Không bao giờ ghi đè khóa chính khi chưa đọc/xác minh được dữ liệu cũ; mọi bản sao lưu được đọc lại để xác minh.
// • Khi không lưu bền vững được: dữ liệu giữ trong bộ nhớ tạm của phiên, tách theo userId, kèm trạng thái để UI thông báo.
import {isDate} from './timeline.js';
export const SCHEMA=3;
const K=u=>'skc:'+u;
const isArr=Array.isArray,isObj=x=>!!x&&typeof x==='object'&&!isArr(x),isStr=x=>typeof x==='string';
export const emptyUser=()=>({schema:SCHEMA,quiz:null,selection:null,versions:[],applications:[],corrections:[],journal:{},startDate:null,basisId:null,migration:null});

// Phiên bản 0.2 chỉ có {n, at, selection, note, change}. Trường không có → đánh dấu "không có dữ liệu", không suy đoán.
function legacyVersion(v,i,problems){
 const o=isObj(v)?v:{},missing=['quiz','rulesVersion','snapshot','appliedFrom'];
 if(!isObj(v))problems.push(`Phiên bản thứ ${i+1} không đúng cấu trúc; vẫn giữ lại với dữ liệu trống.`);
 if(!isStr(o.at))missing.push('createdAt');
 if(!isArr(o.selection))missing.push('selection');
 return {id:`v02-${i+1}`,n:Number.isInteger(o.n)?o.n:i+1,createdAt:isStr(o.at)?o.at:null,quiz:null,quizKnown:false,
  selection:isArr(o.selection)?o.selection.filter(isStr):[],rulesVersion:null,snapshot:null,note:isStr(o.note)?o.note:'',
  change:isStr(o.change)?o.change:null,appliedFrom:null,basisId:null,legacy:{from:'0.2',missing}};
}

// Schema 3: kiểm tra cấu trúc các trường mà giao diện/Manager dựa vào. Chỉ chuẩn hóa BẢN TRONG BỘ NHỚ;
// dữ liệu gốc được sao lưu (có xác minh) trước khi bản chuẩn hóa được ghi lại (xem open()).
function normalize3(raw,problems){
 const d={...emptyUser(),...raw};
 if(!isArr(d.versions)){if(d.versions!=null)problems.push('Danh sách phiên bản không đúng cấu trúc.');d.versions=[]}
 d.versions=d.versions.map((v,i)=>{
  if(!isObj(v)){problems.push(`Phiên bản thứ ${i+1} không đúng cấu trúc; thay bằng mục đánh dấu "không có dữ liệu".`);
   return {id:`invalid-${i+1}`,n:i+1,createdAt:null,quiz:null,quizKnown:false,selection:[],rulesVersion:null,snapshot:null,note:'',change:null,appliedFrom:null,basisId:null,legacy:{from:'invalid',missing:['quiz','rulesVersion','snapshot','appliedFrom','createdAt','selection']}}}
  const o={...v};
  if(!isStr(o.id)){problems.push(`Phiên bản thứ ${i+1} thiếu mã; gán mã tạm.`);o.id=`invalid-${i+1}`}
  if(!Number.isInteger(o.n))o.n=i+1;
  if(!isArr(o.selection)){problems.push(`Phiên bản v${o.n}: danh sách sản phẩm không hợp lệ.`);o.selection=[]}
  else o.selection=o.selection.filter(isStr);
  if(o.quiz!=null&&!isObj(o.quiz)){problems.push(`Phiên bản v${o.n}: quiz không đúng cấu trúc.`);o.quiz=null;o.quizKnown=false}
  if(o.legacy!=null&&!(isObj(o.legacy)&&isArr(o.legacy.missing)))o.legacy={from:'invalid',missing:[]};
  for(const k of['note','change','rulesVersion','createdAt'])if(o[k]!=null&&!isStr(o[k]))o[k]=String(o[k]);
  return o;
 });
 for(const k of['applications','corrections'])if(!isArr(d[k])){if(d[k]!=null)problems.push(`Trường ${k} không đúng cấu trúc.`);d[k]=[]}
 if(!isObj(d.journal)){if(d.journal!=null)problems.push('Nhật ký không đúng cấu trúc.');d.journal={}}
 else{const j={};for(const [k,e] of Object.entries(d.journal)){
   if(isObj(e))j[k]=e;else problems.push(`Mục nhật ký "${k}" không đúng cấu trúc; bản gốc nằm trong bản sao lưu.`)}
  d.journal=j}
 if(d.quiz!=null&&!isObj(d.quiz)){problems.push('Kết quả quiz không đúng cấu trúc.');d.quiz=null}
 if(isObj(d.quiz)&&d.quiz.goals!=null&&!isArr(d.quiz.goals))d.quiz={...d.quiz,goals:[]};
 if(d.selection!=null&&!isArr(d.selection)){problems.push('Danh sách sản phẩm không hợp lệ.');d.selection=null}
 else if(isArr(d.selection))d.selection=d.selection.filter(isStr);
 if(d.startDate!=null&&!isDate(d.startDate)){problems.push(`Ngày 0 đã lưu không hợp lệ (${String(d.startDate).slice(0,40)}); bỏ qua.`);d.startDate=null}
 if(d.basisId!=null&&!isStr(d.basisId))d.basisId=null;
 return d;
}

export function migrate(raw){
 const problems=[];
 if(!isObj(raw))return {data:emptyUser(),changed:false,problems:['Dữ liệu đã lưu không phải đối tượng hợp lệ.'],invalid:true};
 if(Number.isInteger(raw.schema)&&raw.schema>=SCHEMA){
  // Schema 3: chỉ điền mặc định / chuẩn hóa trong bộ nhớ, không ghi lại ở bước mở.
  const d=normalize3(raw,problems);
  if(raw.schema>SCHEMA)problems.push(`Dữ liệu thuộc schema ${raw.schema}, mới hơn phiên bản ứng dụng hiện tại (schema ${SCHEMA}).`);
  return {data:d,changed:false,problems,invalid:problems.length>0,newer:raw.schema>SCHEMA};
 }
 // 0.1/0.2: không có trường schema.
 const d=emptyUser();
 d.quiz=isObj(raw.quiz)?raw.quiz:null;
 if(raw.quiz!=null&&!isObj(raw.quiz))problems.push('Kết quả quiz cũ không đúng cấu trúc; đánh dấu là không có dữ liệu.');
 d.selection=isArr(raw.selection)?raw.selection.filter(isStr):null;
 if(raw.selection!=null&&!isArr(raw.selection))problems.push('Danh sách sản phẩm cũ không hợp lệ.');
 d.journal=isObj(raw.journal)?raw.journal:{};
 if(raw.journal!=null&&!isObj(raw.journal))problems.push('Nhật ký cũ không đúng cấu trúc; bản gốc vẫn còn trong bản sao lưu.');
 d.startDate=isStr(raw.startDate)?raw.startDate:null;
 if(raw.versions!=null&&!isArr(raw.versions))problems.push('Danh sách phiên bản cũ không hợp lệ.');
 d.versions=(isArr(raw.versions)?raw.versions:[]).map((v,i)=>legacyVersion(v,i,problems));
 d.basisId=d.versions.at(-1)?.id??null; // 0.2 so sánh "chưa lưu" với phiên bản cuối → giữ hành vi đó
 d.migration={from:'0.2',at:null,problems:[...problems]};
 // Chuẩn hóa thêm phần nhật ký/ngày theo kiểm tra schema 3 (dữ liệu gốc đã nằm trong bản sao lưu 0.2).
 const extra=[],n=normalize3(d,extra);problems.push(...extra);
 return {data:n,changed:true,problems};
}

// ---- Truy cập localStorage an toàn ----
const errMsg=e=>e?.name&&e.name!=='Error'?`${e.name}: ${e.message||''}`.trim():String(e?.message||e);
const isQuota=e=>e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014||/quota/i.test(e.message||''));
function access(getStorage){
 const get=()=>{try{const s=getStorage();if(!s||typeof s.getItem!=='function')return {error:'Trình duyệt không cung cấp localStorage.'};return {s}}
  catch(e){return {error:errMsg(e)}}};
 return {
  read(key){const g=get();if(g.error)return {ok:false,kind:'no-access',error:g.error};
   try{return {ok:true,value:g.s.getItem(key)}}catch(e){return {ok:false,kind:'read-failed',error:errMsg(e)}}},
  write(key,val){const g=get();if(g.error)return {ok:false,kind:'no-access',error:g.error};
   try{g.s.setItem(key,val);return {ok:true}}catch(e){return {ok:false,kind:isQuota(e)?'quota':'write-failed',error:errMsg(e)}}},
  remove(key){const g=get();if(g.error)return {ok:false,kind:'no-access',error:g.error};
   try{g.s.removeItem(key);return {ok:true}}catch(e){return {ok:false,kind:'write-failed',error:errMsg(e)}}},
  // Ghi rồi đọc lại để xác minh (dùng cho bản sao lưu: chỉ coi là đã sao lưu khi đọc lại đúng nội dung).
  writeVerified(key,val){const w=this.write(key,val);if(!w.ok)return w;const r=this.read(key);
   return r.ok&&r.value===val?{ok:true}:{ok:false,kind:'write-failed',error:r.error||'Đọc lại bản sao lưu không khớp.'}}
 };
}

// Thông điệp trạng thái theo từng lý do (UI hiển thị nguyên văn).
const REASON={
 'no-access':'Trình duyệt không cho phép truy cập bộ nhớ (localStorage).',
 'read-failed':'Không đọc được dữ liệu đã lưu của tài khoản này. Để tránh ghi đè dữ liệu chưa xác minh, hệ thống sẽ không ghi vào bộ nhớ trình duyệt trong phiên này.',
 'quota':'Bộ nhớ trình duyệt đã đầy, không ghi thêm được.',
 'write-failed':'Không ghi được vào bộ nhớ trình duyệt.',
 'backup-failed':'Không tạo được bản sao lưu cho dữ liệu cũ. Để không làm mất dữ liệu gốc, hệ thống sẽ không ghi đè trong phiên này.',
 'newer-schema':'Dữ liệu được tạo bởi phiên bản ứng dụng mới hơn. Để tránh làm hỏng dữ liệu đó, phiên bản này chỉ đọc và không ghi lại.'};
const RETRYABLE=new Set(['quota','write-failed']);

export function createStore(getStorage=()=>globalThis.localStorage,now=()=>new Date()){
 const io=access(getStorage);
 // Bộ nhớ tạm của phiên: khóa skc:<userId> → chuỗi JSON. Tách theo userId như localStorage.
 const memory=new Map(),modes=new Map();
 const status=uid=>{const m=modes.get(uid);
  return m?{persistent:false,mode:'memory',reason:m.reason,retryable:RETRYABLE.has(m.reason),
   message:`${REASON[m.reason]||REASON['write-failed']} Dữ liệu hiện chỉ lưu tạm trong phiên này và sẽ mất khi tải lại trang.`,detail:m.error||null}
   :{persistent:true,mode:'local',reason:null,retryable:false,message:null,detail:null}};
 const toMemory=(uid,data,reason,error)=>{memory.set(K(uid),JSON.stringify(data));modes.set(uid,{reason,error})};
 const fromMemory=uid=>JSON.parse(memory.get(K(uid)));
 // Sao lưu nguyên văn. Nếu khóa sao lưu đã có NỘI DUNG KHÁC, dùng khóa mới để không mất bản sao lưu trước.
 const backup=(base,txt)=>{
  const r=io.read(base);if(!r.ok)return r;
  if(r.value===txt)return {ok:true,key:base};
  const key=r.value==null?base:`${base}-${now().getTime().toString(36)}`;
  const w=io.writeVerified(key,txt);return w.ok?{ok:true,key}:w;
 };
 return {
  key:K,
  // Kiểm tra khả năng dùng localStorage (đọc + ghi + xóa một khóa thử).
  probe(){const k='skc:__probe__',r=io.read(k);if(!r.ok)return {readable:false,writable:false,kind:r.kind,error:r.error};
   const w=io.write(k,'1');if(!w.ok)return {readable:true,writable:false,kind:w.kind,error:w.error};
   io.remove(k);return {readable:true,writable:true}},
  status,
  open(uid){
   const key=K(uid),notices=[];
   // Đã ở chế độ tạm trong phiên này (vd. chuyển A → B → A): dùng lại bản trong bộ nhớ, không đọc/ghi localStorage.
   if(modes.has(uid))return {data:fromMemory(uid),notices,status:status(uid)};
   const r=io.read(key);
   if(!r.ok){const reason=r.kind==='no-access'?'no-access':'read-failed';toMemory(uid,emptyUser(),reason,r.error);
    return {data:emptyUser(),notices:[`${REASON[reason]} (${r.error})`],status:status(uid)}}
   const txt=r.value;
   if(txt==null)return {data:emptyUser(),notices,status:status(uid)};
   let raw;
   try{raw=JSON.parse(txt)}catch{
    // JSON hỏng: KHÔNG xóa/ghi đè khóa chính lúc mở. Chỉ cho phép ghi về sau nếu đã sao lưu và xác minh bản gốc.
    const b=backup(key+':unreadable',txt);
    if(!b.ok){toMemory(uid,emptyUser(),'backup-failed',b.error);
     return {data:emptyUser(),notices:[`Dữ liệu đã lưu của tài khoản này bị hỏng (không phải JSON hợp lệ). ${REASON['backup-failed']}`],status:status(uid)}}
    return {data:emptyUser(),notices:[`Không đọc được dữ liệu đã lưu (JSON bị hỏng). Bản gốc được giữ nguyên văn ở khóa "${b.key}"; hệ thống bắt đầu với dữ liệu trống. Dữ liệu cũ chỉ bị thay khi bạn lưu thay đổi mới.`],status:status(uid)};
   }
   const m=migrate(raw);
   if(m.newer){toMemory(uid,m.data,'newer-schema');notices.push(...m.problems.map(p=>'Dữ liệu: '+p));return {data:m.data,notices,status:status(uid)}}
   if(m.changed||m.invalid){
    // Chuyển đổi 0.2 hoặc dữ liệu sai cấu trúc: sao lưu (có xác minh) trước khi ghi bản đã chuyển đổi/chuẩn hóa.
    const b=backup(key+(m.changed?':backup-0.2':':backup-invalid'),txt);
    if(!b.ok){toMemory(uid,m.data,'backup-failed',b.error);
     notices.push(`Cần chuyển đổi/sửa cấu trúc dữ liệu cũ nhưng không tạo được bản sao lưu (${b.error}). Dữ liệu gốc được giữ nguyên trong trình duyệt.`);
     notices.push(...m.problems.map(p=>'Dữ liệu cũ: '+p));return {data:m.data,notices,status:status(uid)}}
    if(m.changed){
     m.data.migration.at=now().toISOString();
     const w=io.write(key,JSON.stringify(m.data));
     if(!w.ok)toMemory(uid,m.data,RETRYABLE.has(w.kind)?w.kind:'write-failed',w.error);
     notices.push(`Đã chuyển đổi dữ liệu từ phiên bản cũ (0.2) (${m.data.versions.length} phiên bản, ${Object.keys(m.data.journal).length} ngày nhật ký). Phiên bản cũ không lưu quiz, bộ quy tắc và thời điểm áp dụng nên được đánh dấu "không có dữ liệu". Bản gốc được giữ ở khóa "${b.key}".${w.ok?'':' Chưa ghi được dữ liệu đã chuyển đổi: '+w.error}`);
    }else notices.push(`Một số dữ liệu đã lưu không đúng cấu trúc và đã được chuẩn hóa khi hiển thị. Bản gốc được giữ nguyên văn ở khóa "${b.key}".`);
   }
   notices.push(...m.problems.map(p=>'Dữ liệu cũ: '+p));
   return {data:m.data,notices,status:status(uid)};
  },
  load(uid){return this.open(uid).data},
  // Lưu bền vững. Không ném lỗi. Trả {ok: đã ghi vào localStorage hay chưa, status, error}.
  // Chế độ không cho ghi (no-access, read-failed, backup-failed, newer-schema): chỉ cập nhật bộ nhớ tạm.
  save(uid,d){
   const json=JSON.stringify(d),m=modes.get(uid);
   if(m&&!RETRYABLE.has(m.reason)){memory.set(K(uid),json);return {ok:false,status:status(uid),error:status(uid).message}}
   const w=io.write(K(uid),json);
   if(w.ok){modes.delete(uid);memory.delete(K(uid));return {ok:true,status:status(uid)}}
   toMemory(uid,d,w.kind==='no-access'?'no-access':RETRYABLE.has(w.kind)?w.kind:'write-failed',w.error);
   return {ok:false,status:status(uid),error:`${status(uid).message} (${w.error})`};
  },
  // Thử ghi lại dữ liệu đang lưu tạm (chỉ với lỗi ghi có thể thử lại).
  retry(uid,d){const m=modes.get(uid);if(!m)return {ok:true,status:status(uid)};
   if(!RETRYABLE.has(m.reason))return {ok:false,status:status(uid),error:'Không thể thử lại trong trường hợp này.'};
   return this.save(uid,d)},
  // Tùy chọn giao diện (tài khoản đang chọn). Lỗi chỉ bị bỏ qua vì đây không phải dữ liệu người dùng.
  getPref(name){const r=io.read('skc:'+name);return r.ok?r.value:null},
  setPref(name,val){return io.write('skc:'+name,String(val)).ok}
 };
}
export const store=createStore();
