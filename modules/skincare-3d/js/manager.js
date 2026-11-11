// Routine Manager 0.3.1: bản làm việc (quiz + sản phẩm), phiên bản đầy đủ, nhật ký áp dụng append-only, khôi phục.
// 0.3.1: Ngày 0 tách khỏi lịch sử áp dụng; sửa ngày áp dụng là thao tác riêng, cần xác nhận, chỉ GHI THÊM bản ghi sửa;
// nhật ký đi qua tx(); lỗi lưu trữ không làm mất thay đổi trong phiên mà được báo rõ là "chưa lưu bền vững".
import {store as defaultStore} from './storage.js';
import {localDate,isDate,effectiveAt,lastApplication,firstApplication,correctionBounds,applicationsSorted} from './timeline.js';
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const sigSel=s=>JSON.stringify([...new Set(s||[])].sort());
const sigQuiz=q=>JSON.stringify(q?{g:[...new Set(q.goals||[])].sort(),s:q.skin??null}:null);
const diff=(a=[],b=[])=>a.filter(x=>!b.includes(x));
// Ảnh chụp gọn của routine tại thời điểm lưu, để timeline hiển thị đúng routine đã áp dụng.
export const snapshotOf=r=>r&&{status:r.status,steps:r.steps.map(s=>({id:s.id,period:s.period,name:s.name,products:s.products.map(p=>({id:p.id,name:p.name}))}))};

export class RoutineManager{
 // compute(quiz, selection) → kết quả Routine Engine; rulesVersion: phiên bản bộ quy tắc đang dùng.
 constructor(uid,owned,{store=defaultStore,compute=null,rulesVersion=null,now=()=>new Date()}={}){
  Object.assign(this,{uid,owned,store,compute,rulesVersion,now});
  const r=store.open(uid);this.d=r.data;this.notices=r.notices;this.error=null;
  this.storage=r.status||{persistent:true,mode:'local'};
  if(!this.d.selection)this.d.selection=[...owned];
 }
 // Ghi bền vững qua lớp lưu trữ (không ném lỗi). Trả true nếu đã ghi vào localStorage.
 persist(){
  let r;try{r=this.store.save(this.uid,this.d)}catch(e){r={ok:false,error:'Không lưu được vào trình duyệt: '+(e?.message||e)}}
  if(r.status)this.storage=r.status;else if(!r.ok)this.storage={persistent:false,mode:'memory',reason:'write-failed',retryable:true,message:r.error};
  this.error=r.ok?null:r.error;return !!r.ok;
 }
 // Giao dịch: fn trả {ok:false} → hoàn tác trong bộ nhớ. Ghi bền vững thất bại → GIỮ thay đổi trong phiên
 // (để vẫn dùng được) và trả persisted:false + storageError để giao diện báo rõ, không báo "đã lưu" sai.
 tx(fn){
  const prev=clone(this.d);let r;
  try{r=fn()}catch(e){this.d=prev;return {ok:false,error:'Lỗi xử lý: '+(e?.message||e)}}
  if(r&&r.ok===false){this.d=prev;return r}
  const persisted=this.persist();
  return persisted?{...r,persisted}:{...r,persisted,storageError:this.error};
 }
 retryPersist(){
  let r;try{r=this.store.retry?this.store.retry(this.uid,this.d):this.store.save(this.uid,this.d)}catch(e){r={ok:false,error:String(e?.message||e)}}
  if(r.status)this.storage=r.status;this.error=r.ok?null:r.error;return {ok:!!r.ok,error:this.error};
 }
 get today(){return localDate(this.now())}
 get selection(){return this.d.selection}
 get quiz(){return this.d.quiz}
 setQuiz(q){return this.tx(()=>{this.d.quiz=clone(q);return {ok:true}})}
 add(id){return this.tx(()=>{if(!this.d.selection.includes(id))this.d.selection.push(id);return {ok:true}})}
 remove(id){return this.tx(()=>{this.d.selection=this.d.selection.filter(x=>x!==id);return {ok:true}})}
 replace(o,n){return this.tx(()=>{this.d.selection=[...new Set(this.d.selection.map(x=>x===o?n:x))];return {ok:true}})}
 reset(){return this.tx(()=>{this.d.selection=[...this.owned];return {ok:true}})}
 version(id){return this.d.versions.find(v=>v.id===id)||null}
 get basis(){return this.version(this.d.basisId)}
 get applied(){return effectiveAt(this.d,this.today).version}
 // "Chưa lưu" = bản làm việc khác phiên bản đang nạp. Phiên bản 0.2 không có quiz → chỉ so sánh sản phẩm.
 get dirty(){const b=this.basis;if(!b)return true;return sigSel(b.selection)!==sigSel(this.d.selection)||(b.quizKnown&&sigQuiz(b.quiz)!==sigQuiz(this.d.quiz))}
 minApplyDate(){return lastApplication(this.d)?.from??null}
 newId(){const b=`v-${this.uid}-${this.now().getTime().toString(36)}`;let id=b,k=1;while(this.version(id))id=`${b}-${k++}`;return id}
 describeChange(b,{product=x=>x,goal=x=>x,skin=x=>x??'—'}={}){
  if(!b)return 'Phiên bản đầu tiên.';
  const c=this.d,p=[],ad=diff(c.selection,b.selection),rm=diff(b.selection,c.selection);
  if(ad.length)p.push('thêm sản phẩm: '+ad.map(product).join(', '));
  if(rm.length)p.push('bỏ sản phẩm: '+rm.map(product).join(', '));
  if(!b.quizKnown)p.push(`quiz: không có dữ liệu để so sánh (v${b.n} tạo ở 0.2)`);
  else{const g1=b.quiz?.goals||[],g2=c.quiz?.goals||[],ga=diff(g2,g1),gr=diff(g1,g2);
   if(ga.length)p.push('thêm mục tiêu: '+ga.map(goal).join(', '));
   if(gr.length)p.push('bỏ mục tiêu: '+gr.map(goal).join(', '));
   if((b.quiz?.skin??null)!==(c.quiz?.skin??null))p.push(`loại da tự đánh giá: ${skin(b.quiz?.skin)} → ${skin(c.quiz?.skin)}`);}
  if(b.rulesVersion!==this.rulesVersion)p.push(`bộ quy tắc: ${b.rulesVersion??'không có dữ liệu'} → ${this.rulesVersion}`);
  return `So với v${b.n}: `+(p.join('; ')||'không có thay đổi');
 }
 save({note='',apply=true,applyFrom=this.today,label}={}){
  if(apply){
   if(!isDate(applyFrom))return {ok:false,error:'Ngày áp dụng không hợp lệ.'};
   const min=this.minApplyDate();
   if(min&&applyFrom<min)return {ok:false,error:`Ngày áp dụng không được sớm hơn lần áp dụng gần nhất (${min}), để không viết lại lịch sử đã ghi.`};
  }
  return this.tx(()=>{
   const at=this.now().toISOString(),b=this.basis;
   const v={id:this.newId(),n:Math.max(0,...this.d.versions.map(x=>x.n||0))+1,createdAt:at,
    quiz:clone(this.d.quiz),quizKnown:true,selection:[...this.d.selection],rulesVersion:this.rulesVersion,
    snapshot:this.compute?snapshotOf(this.compute(this.d.quiz,this.d.selection)):null,
    note,change:this.describeChange(b,label),appliedFrom:apply?applyFrom:null,basisId:b?.id??null,legacy:null};
   this.d.versions.push(v);
   if(apply)this.d.applications.push({versionId:v.id,from:applyFrom,recordedAt:at,kind:'save'});
   this.d.basisId=v.id;
   // Ngày 0 chỉ được tự đặt ở lần áp dụng ĐẦU TIÊN (chưa có lịch sử áp dụng nào); nếu người dùng đã xóa Ngày 0
   // sau đó, hệ thống không tự đặt lại.
   if(apply&&!this.d.startDate&&this.d.applications.length===1)this.d.startDate=applyFrom;
   return {ok:true,version:v};
  });
 }
 rulesNotice(v){
  if(v.rulesVersion==null)return `v${v.n} không ghi nhận phiên bản bộ quy tắc (dữ liệu 0.2). Routine được tính lại bằng bộ quy tắc hiện tại "${this.rulesVersion}" và có thể khác routine đã hiển thị lúc lưu.`;
  if(v.rulesVersion!==this.rulesVersion)return `v${v.n} được tạo bằng bộ quy tắc "${v.rulesVersion}", hiện không còn được dùng. Routine được tính lại bằng "${this.rulesVersion}"; không bảo đảm giống kết quả gốc.`;
  return null;
 }
 // Khôi phục: nạp quiz + sản phẩm của phiên bản vào bản làm việc. Không sửa/xóa phiên bản hay bản ghi áp dụng cũ;
 // nếu phiên bản đầy đủ dữ liệu thì thêm một bản ghi "áp dụng lại từ hôm nay".
 restore(id){
  const v=this.version(id);if(!v)return {ok:false,error:'Không tìm thấy phiên bản.'};
  return this.tx(()=>{
   const notices=[],t=this.today;let applied=false,consistent=null;
   if(v.quizKnown)this.d.quiz=clone(v.quiz);
   else notices.push(`v${v.n} được tạo ở phiên bản dữ liệu cũ (0.2) và không lưu kết quả quiz. Quiz hiện tại được giữ nguyên; routine được tính bằng quiz hiện tại.`);
   if(v.legacy?.missing.includes('selection'))notices.push(`v${v.n} không có dữ liệu danh sách sản phẩm hợp lệ.`);
   this.d.selection=[...v.selection];this.d.basisId=v.id;
   const min=this.minApplyDate(),cur=effectiveAt(this.d,t).application;
   if(v.legacy)notices.push(`Phiên bản 0.2 thiếu dữ liệu nên không được ghi là "đang áp dụng". Bấm "Lưu routine" để tạo phiên bản đầy đủ từ dữ liệu vừa khôi phục.`);
   else if(min&&min>t)notices.push(`Đã có phiên bản lên lịch áp dụng từ ${min}. Khôi phục chỉ nạp v${v.n} vào bản làm việc, không thay đổi lịch áp dụng.`);
   else if(cur?.versionId!==v.id){this.d.applications.push({versionId:v.id,from:t,recordedAt:this.now().toISOString(),kind:'restore'});applied=true}
   const rn=this.rulesNotice(v);if(rn)notices.push(rn);
   else if(this.compute&&v.snapshot&&v.quizKnown){
    consistent=JSON.stringify(snapshotOf(this.compute(this.d.quiz,this.d.selection)))===JSON.stringify(v.snapshot);
    if(!consistent)notices.push(`Routine tính lại khác ảnh chụp lúc lưu v${v.n} (dữ liệu sản phẩm có thể đã thay đổi). Timeline vẫn hiển thị ảnh chụp gốc cho giai đoạn đã áp dụng.`);
   }
   return {ok:true,version:v,notices,applied,consistent};
  });
 }

 // ---- Ngày 0 (mốc tham chiếu) ----
 // Chỉ đổi startDate. KHÔNG sửa applications/corrections, phiên bản hay nhật ký.
 setStartDate(date){
  if(date!==null&&!isDate(date))return {ok:false,error:'Ngày 0 không hợp lệ. Hãy chọn một ngày có thật theo định dạng YYYY-MM-DD.'};
  const first=firstApplication(this.d)?.from??null;
  return this.tx(()=>{this.d.startDate=date;
   const info=[date?`Đã đặt Ngày 0 là ${date}. Đây chỉ là mốc tham chiếu để đếm ngày trên timeline; lịch sử áp dụng routine, phiên bản và nhật ký không thay đổi.`
    :'Đã bỏ Ngày 0. Lịch sử áp dụng routine, phiên bản và nhật ký không thay đổi; hệ thống sẽ không tự đặt lại Ngày 0.'];
   if(date&&first&&first!==date)info.push(`Lưu ý: routine thực tế bắt đầu áp dụng từ ${first}, khác Ngày 0. Muốn sửa ngày áp dụng thực tế, dùng "Sửa ngày áp dụng" trong Lịch sử áp dụng.`);
   return {ok:true,info};});
 }
 // ---- Sửa ngày áp dụng (lịch sử thực tế) ----
 // Yêu cầu confirmed===true. Không sửa bản ghi gốc: GHI THÊM {target, from, prevFrom, recordedAt, reason} vào corrections.
 // Ngày mới phải nằm giữa bản ghi áp dụng trước và sau để không đảo thứ tự lịch sử.
 correctApplication(seq,newFrom,{confirmed=false,reason=''}={}){
  if(confirmed!==true)return {ok:false,error:'Sửa ngày áp dụng là thay đổi lịch sử thực tế và cần được xác nhận.'};
  if(!isDate(newFrom))return {ok:false,error:'Ngày áp dụng mới không hợp lệ.'};
  const b=correctionBounds(this.d,seq);
  if(!b)return {ok:false,error:'Không tìm thấy bản ghi áp dụng cần sửa.'};
  if(newFrom===b.current)return {ok:false,error:'Ngày mới trùng ngày hiện tại; không có gì để sửa.'};
  if(b.min&&newFrom<b.min||b.max&&newFrom>b.max)
   return {ok:false,error:`Ngày áp dụng mới phải trong khoảng ${b.min||'…'} → ${b.max||'…'} để không đảo thứ tự với các lần áp dụng trước/sau.`};
  return this.tx(()=>{
   if(!Array.isArray(this.d.corrections))this.d.corrections=[];
   this.d.corrections.push({target:seq,from:newFrom,prevFrom:b.current,recordedAt:this.now().toISOString(),reason:String(reason||'').slice(0,500)});
   return {ok:true,from:newFrom,prevFrom:b.current};
  });
 }
 applicationHistory(){return applicationsSorted(this.d)}
 // ---- Nhật ký (qua tx: lỗi ghi được báo, không âm thầm) ----
 saveJournal(date,{dry,oil,irr,skipped=false,note=''},{photo}={}){
  if(!isDate(date))return {ok:false,error:'Ngày nhật ký không hợp lệ.'};
  const sc=v=>Number.isInteger(v)&&v>=0&&v<=5;
  if(![dry,oil,irr].every(sc))return {ok:false,error:'Điểm tự đánh giá phải là số nguyên từ 0 đến 5.'};
  return this.tx(()=>{
   const e={...(this.d.journal[date]||{}),dry,oil,irr,skipped:!!skipped,note:String(note??'').slice(0,2000)};
   if(photo!==undefined)e.photo=!!photo;
   this.d.journal[date]=e;return {ok:true,entry:e};
  });
 }
 setJournalPhoto(date,has){
  if(!Object.hasOwn(this.d.journal,date))return {ok:false,error:'Không tìm thấy mục nhật ký.'};
  return this.tx(()=>{this.d.journal[date]={...this.d.journal[date],photo:!!has};return {ok:true}});
 }
 deleteJournal(date){
  if(!Object.hasOwn(this.d.journal,date))return {ok:false,error:'Không tìm thấy mục nhật ký.'};
  return this.tx(()=>{delete this.d.journal[date];return {ok:true}});
 }
}
