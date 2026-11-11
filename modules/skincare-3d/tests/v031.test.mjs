// Chạy: node tests/v031.test.mjs — kiểm thử bổ sung cho 0.3.1:
// (1) isDate theo lịch Gregorian, (2) Ngày 0 tách khỏi lịch sử áp dụng + sửa ngày áp dụng có xác nhận,
// (3) dựng HTML an toàn (html``), (4) lưu trữ khi localStorage lỗi/bị chặn/đầy/hỏng, (5) quét tĩnh mã nguồn.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRODUCTS,USERS} from '../js/data.js';
import {RULES} from '../js/rules.js';
import {buildRoutine} from '../js/engine.js';
import {RoutineManager} from '../js/manager.js';
import {createStore} from '../js/storage.js';
import {isDate,addDays,daysBetween,effectiveAt,describeDay,periods,correctionBounds,localDate} from '../js/timeline.js';
import {html,escapeHtml,setHtml,safeImageUrl,num} from '../js/html.js';
import {chart} from '../js/journal.js';

class Mem{constructor(){this.m=new Map;this.writes=0}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.writes++;this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const quota=()=>{const e=new Error('The quota has been exceeded.');e.name='QuotaExceededError';e.code=22;return e};
const user=id=>USERS.find(u=>u.id===id);
const compute=id=>(quiz,selection)=>buildRoutine({quiz,catalog:PRODUCTS,selection,owned:user(id).purchased});
// Đồng hồ giả lập: 12:00 trưa GIỜ ĐỊA PHƯƠNG của ngày cần thử (để kết quả không phụ thuộc múi giờ máy chạy test).
const noon=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12).getTime()};
let T=noon('2026-11-02');const now=()=>new Date(T),setDay=s=>{T=noon(s)};
const mk=(id,store)=>new RoutineManager(id,user(id).purchased,{store,compute:compute(id),rulesVersion:RULES.version,now});
const open=(id,mem)=>mk(id,createStore(()=>mem,now));
const json=x=>JSON.parse(JSON.stringify(x));
const Q={goals:['hydrate'],skin:'dry',at:'x'};
let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};

// ---------- 1. isDate ----------
t('1a. isDate: bảng kiểm thử bắt buộc',()=>{
 const cases={'2024-02-29':true,'2026-02-29':false,'2026-02-30':false,'2026-11-31':false,'2026-12-31':true,'2026-00-10':false,'2026-13-10':false,'2026-01-00':false,'abc':false,'':false};
 for(const [s,v] of Object.entries(cases))assert.equal(isDate(s),v,s)});
t('1b. isDate: năm nhuận thế kỷ, ngày cuối tháng',()=>{
 assert.equal(isDate('2000-02-29'),true);assert.equal(isDate('1900-02-29'),false);assert.equal(isDate('2100-02-29'),false);assert.equal(isDate('2400-02-29'),true);
 for(const m of['04','06','09','11']){assert.equal(isDate(`2026-${m}-30`),true);assert.equal(isDate(`2026-${m}-31`),false)}
 for(const m of['01','03','05','07','08','10','12'])assert.equal(isDate(`2026-${m}-31`),true);
 assert.equal(isDate('2026-02-28'),true);assert.equal(isDate('2026-01-32'),false)});
t('1c. isDate: sai kiểu, ký tự thừa, định dạng khác → false (không ném lỗi)',()=>{
 for(const v of[null,undefined,0,20260101,NaN,{},[],true,new Date(),new String('2026-01-01')])assert.equal(isDate(v),false,String(v));
 for(const s of[' 2026-01-01','2026-01-01 ','2026-01-01\n','2026-1-01','2026-01-1','26-01-01','2026/01/01','2026-01-01T00:00','2026-01-01Z',
  '+2026-01-01','02026-01-01','2026-01-01x','０２０２６-01-01'.slice(1),'2026-0１-01','0000-01-01','2026--01-01','２０２６-０１-０１'])
  assert.equal(isDate(s),false,JSON.stringify(s));
 assert.equal(isDate('0001-01-01'),true);assert.equal(isDate('9999-12-31'),true)});
t('1d. addDays/daysBetween: không lệch theo DST, đầu vào sai → null',()=>{
 assert.equal(addDays('2026-03-07',2),'2026-03-09');assert.equal(addDays('2026-10-31',2),'2026-11-02');assert.equal(addDays('2024-02-28',1),'2024-02-29');
 assert.equal(daysBetween('2026-03-07','2026-03-09'),2);assert.equal(daysBetween('2026-11-02','2026-10-20'),-13);
 assert.equal(addDays('2026-02-30',1),null);assert.equal(addDays(null,1),null);assert.equal(daysBetween('x','2026-01-01'),null)});

// ---------- 2. Ngày 0 và ngày áp dụng ----------
t('2A. đổi Ngày 0: số ngày tương đối cập nhật, lịch sử áp dụng không đổi',()=>{
 setDay('2026-11-02');const mem=new Mem(),M=open('A',mem);M.setQuiz(Q);assert.ok(M.save().ok);
 assert.equal(M.d.startDate,'2026-11-02');const apps=json(M.d.applications),vers=json(M.d.versions);
 const r=M.setStartDate('2026-10-20');assert.ok(r.ok);assert.equal(r.persisted,true);
 assert.ok(r.info.some(x=>/chỉ là mốc tham chiếu/.test(x)));assert.ok(r.info.some(x=>/2026-11-02, khác Ngày 0/.test(x)));
 assert.deepEqual(json(M.d.applications),apps);assert.deepEqual(json(M.d.versions),vers);assert.deepEqual(M.d.corrections,[]);
 const x=describeDay(M.d,'2026-11-02','2026-11-02');assert.equal(x.dayIndex,13);assert.equal(x.firstApplied,'2026-11-02');assert.equal(x.version.n,1);
 assert.equal(describeDay(M.d,'2026-10-20','2026-11-02').version,null); // Ngày 0 sớm hơn ngày áp dụng: không có routine giả
 assert.equal(describeDay(M.d,'2026-10-15','2026-11-02').dayIndex,-5);
 assert.equal(JSON.parse(mem.getItem('skc:A')).startDate,'2026-10-20')});
t('2A-bis. Ngày 0 không hợp lệ bị từ chối; bỏ Ngày 0 không bị tự đặt lại',()=>{
 setDay('2026-11-02');const M=open('A',new Mem());M.setQuiz(Q);M.save();
 for(const bad of['2026-02-30','2026-11-31','abc','',undefined]){const r=M.setStartDate(bad);assert.equal(r.ok,false,String(bad));assert.equal(M.d.startDate,'2026-11-02')}
 assert.ok(M.setStartDate(null).ok);assert.equal(M.d.startDate,null);
 setDay('2026-11-03');M.setQuiz({...Q,goals:['basic']});assert.ok(M.save().ok);assert.equal(M.d.startDate,null)});
let B;
t('2B. sửa ngày áp dụng: cần xác nhận; ghi thêm bản ghi sửa, không sửa bản ghi gốc',()=>{
 setDay('2026-11-02');const mem=new Mem();B=open('A',mem);B.setQuiz(Q);B.save();
 B.saveJournal('2026-11-02',{dry:2,oil:1,irr:0,note:'n1'});B.saveJournal('2026-10-30',{dry:1,oil:1,irr:1});
 setDay('2026-11-05');B.setQuiz({...Q,goals:['oil']});B.save();
 const apps=json(B.d.applications),jn=json(B.d.journal),vers=json(B.d.versions),sd=B.d.startDate;
 const no=B.correctApplication(0,'2026-10-30');assert.equal(no.ok,false);assert.match(no.error,/xác nhận/);assert.deepEqual(B.d.corrections,[]);
 assert.deepEqual(correctionBounds(B.d,0),{current:'2026-11-02',min:null,max:'2026-11-04'});
 const bad=B.correctApplication(0,'2026-11-06',{confirmed:true});assert.equal(bad.ok,false);assert.match(bad.error,/khoảng/);
 assert.equal(B.correctApplication(0,'2026-02-30',{confirmed:true}).ok,false);assert.equal(B.correctApplication(9,'2026-10-30',{confirmed:true}).ok,false);
 const r=B.correctApplication(0,'2026-10-30',{confirmed:true,reason:'thực ra bắt đầu sớm hơn'});assert.ok(r.ok);assert.equal(r.persisted,true);
 assert.deepEqual(json(B.d.applications),apps);assert.deepEqual(json(B.d.journal),jn);assert.deepEqual(json(B.d.versions),vers);assert.equal(B.d.startDate,sd);
 assert.equal(B.d.corrections.length,1);assert.equal(B.d.corrections[0].prevFrom,'2026-11-02');
 assert.equal(effectiveAt(B.d,'2026-10-30').version.n,1);assert.equal(effectiveAt(B.d,'2026-10-29').version,null);assert.equal(effectiveAt(B.d,'2026-11-05').version.n,2);
 const ps=periods(B.d);assert.deepEqual(ps.map(p=>[p.version.n,p.from,p.to,p.recordedFrom]),[[1,'2026-10-30','2026-11-04','2026-11-02'],[2,'2026-11-05',null,'2026-11-05']]);
 const x=describeDay(B.d,'2026-10-30','2026-11-05');assert.equal(x.entry.dry,1);assert.equal(x.version.n,1);
 // tải lại: bản ghi sửa còn nguyên
 const R=open('A',mem);assert.deepEqual(json(R.d.corrections),json(B.d.corrections));assert.equal(effectiveAt(R.d,'2026-10-31').version.n,1)});
t('2B-bis. sửa nhiều lần: lần sau cùng có hiệu lực; ngày áp dụng tối thiểu theo ngày đã sửa',()=>{
 assert.ok(B.correctApplication(1,'2026-11-04',{confirmed:true}).ok);
 assert.equal(effectiveAt(B.d,'2026-11-04').version.n,2);assert.equal(B.minApplyDate(),'2026-11-04');
 assert.ok(B.correctApplication(1,'2026-11-05',{confirmed:true}).ok);assert.equal(B.d.corrections.length,3);
 assert.equal(effectiveAt(B.d,'2026-11-04').version.n,1);assert.equal(B.d.applications.length,2)});
t('2C. khôi phục phiên bản cũ: chỉ thêm bản ghi "khôi phục", không đổi lịch sử/ngày đã sửa/Ngày 0',()=>{
 setDay('2026-11-07');const apps=json(B.d.applications),cor=json(B.d.corrections),sd=B.d.startDate,v1=B.d.versions[0];
 const r=B.restore(v1.id);assert.ok(r.ok);assert.equal(r.applied,true);
 assert.deepEqual(json(B.d.applications.slice(0,2)),apps);assert.equal(B.d.applications.length,3);assert.equal(B.d.applications[2].from,'2026-11-07');
 assert.deepEqual(json(B.d.corrections),cor);assert.equal(B.d.startDate,sd);
 assert.deepEqual(periods(B.d).map(p=>[p.version.n,p.from]),[[1,'2026-10-30'],[2,'2026-11-05'],[1,'2026-11-07']])});
t('2D. dữ liệu thiếu: không có Ngày 0 / applications → không tạo lịch sử giả',()=>{
 setDay('2026-11-02');const M=open('B',new Mem());
 const x=describeDay(M.d,'2026-11-02','2026-11-02');assert.equal(x.version,null);assert.equal(x.dayIndex,null);assert.equal(x.firstApplied,null);assert.deepEqual(periods(M.d),[]);
 assert.equal(correctionBounds(M.d,0),null);assert.equal(M.correctApplication(0,'2026-11-01',{confirmed:true}).ok,false);
 M.setQuiz(Q);assert.ok(M.save({apply:false}).ok);assert.deepEqual(M.d.applications,[]);assert.equal(M.d.startDate,null);
 // dữ liệu 0.2 có Ngày 0 nhưng chưa từng ghi ngày áp dụng
 const mem=new Mem();mem.setItem('skc:A',JSON.stringify({quiz:Q,selection:['p01'],versions:[{n:1,at:'2026-10-20T01:00:00Z',selection:['p01']}],journal:{},startDate:'2026-10-20'}));
 const L=open('A',mem),y=describeDay(L.d,'2026-10-25','2026-11-02');
 assert.equal(L.d.startDate,'2026-10-20');assert.equal(y.version,null);assert.equal(y.savedOnly.n,1);assert.equal(y.dayIndex,5);assert.deepEqual(L.d.applications,[])});

// ---------- 3. Nhật ký qua Manager ----------
t('3a. nhật ký: kiểm tra ngày/điểm; xóa đúng mục; khóa đặc biệt không bị nhầm',()=>{
 const M=open('A',new Mem());
 assert.equal(M.saveJournal('2026-02-30',{dry:1,oil:1,irr:1}).ok,false);assert.equal(M.saveJournal('2026-11-01',{dry:6,oil:1,irr:1}).ok,false);
 assert.equal(M.saveJournal('2026-11-01',{dry:'2',oil:1,irr:1}).ok,false);
 const r=M.saveJournal('2026-11-01',{dry:2,oil:1,irr:0,note:'<b>x</b>'},{photo:true});assert.ok(r.ok);assert.equal(M.d.journal['2026-11-01'].photo,true);
 assert.ok(M.saveJournal('2026-11-01',{dry:3,oil:1,irr:0}).ok);assert.equal(M.d.journal['2026-11-01'].photo,true); // sửa điểm không mất ảnh
 assert.equal(M.deleteJournal('constructor').ok,false);assert.equal(M.setJournalPhoto('__proto__',false).ok,false);
 assert.ok(M.setJournalPhoto('2026-11-01',false).ok);assert.ok(M.deleteJournal('2026-11-01').ok);assert.deepEqual(M.d.journal,{})});

// ---------- 4. HTML an toàn ----------
const P=['<img src=x onerror="window.__x=1">','"><svg onload=alert(1)>',"' onmouseover='a()","</textarea><script>1</script>",'&lt;b&gt;','javascript:alert(1)'];
t('4a. html``: giá trị trong văn bản và thuộc tính được escape',()=>{
 for(const p of P){const o=String(html`<p title="${p}" data-x='${p}'>${p}</p>`);
  assert.ok(!/<img|<svg|<script/i.test(o.replace(/^<p /,'').replace(/<\/p>$/,'').replace(/^[^>]*>/,'')));
  assert.equal(o,`<p title="${escapeHtml(p)}" data-x='${escapeHtml(p)}'>${escapeHtml(p)}</p>`)}
 assert.equal(escapeHtml(`&<>"'`),'&amp;&lt;&gt;&quot;&#39;');assert.equal(escapeHtml(null),'');
 assert.equal(String(html`<ul>${[1,2].map(i=>html`<li>${i}</li>`)}</ul>`),'<ul><li>1</li><li>2</li></ul>');
 assert.equal(String(html`<b>${0}${false}${null}${undefined}${NaN}</b>`),'<b>0</b>');
 assert.equal(String(html`<p class="${html`a"><i>`}">${html`<i>ok</i>`}</p>`),'<p class="a&quot;&gt;&lt;i&gt;"><i>ok</i></p>')});
t('4b. html``: chặn chèn ở ngữ cảnh nguy hiểm',()=>{
 const bad=[()=>html`<p ${'a'}>`,()=>html`<p class=${'a'}>`,()=>html`<a href="${'x'}">`,()=>html`<img src="${'x'}">`,()=>html`<b onclick="${'x'}">`,
  ()=>html`<b style="${'x'}">`,()=>html`<script>${'x'}</script>`,()=>html`<style>${'x'}</style>`,()=>html`<!-- ${'x'} -->`,()=>html`<${'b'}>`,()=>html`<b ONCLICK="${'x'}">`];
 for(const f of bad)assert.throws(f,/không được chèn/);
 assert.equal(String(html`<title>${html`<b>`}</title>`),'<title>&lt;b&gt;</title>'); // RCDATA: luôn escape
 assert.throws(()=>setHtml({},'<b>x</b>'),TypeError);
 const el={};setHtml(el,html`<b>${'<i>'}</b>`);assert.equal(el.innerHTML,'<b>&lt;i&gt;</b>')});
t('4c. URL ảnh chỉ cho phép blob:, số SVG chỉ nhận số hữu hạn',()=>{
 assert.equal(safeImageUrl('blob:http://localhost:8000/abc'),'blob:http://localhost:8000/abc');
 for(const u of['javascript:alert(1)','data:image/svg+xml,<svg onload=a()>','http://evil.example/x.png','//x','',null,'  blob:x'])assert.equal(safeImageUrl(u),null,String(u));
 assert.equal(String(num(3.5)),'3.5');assert.equal(String(num('1" onload="x')),'0');assert.equal(String(num(Infinity)),'0')});
t('4d. biểu đồ: khóa/giá trị lạ trong nhật ký không chèn được mã, không làm lỗi',()=>{
 const o=String(chart({'2026-11-01':{dry:2,oil:'<img src=x onerror=a()>',irr:9},'<svg onload=a()>':{dry:1},'2026-02-30':{dry:1}}));
 assert.ok(!/onerror|onload|<img/.test(o));assert.equal((o.match(/<circle/g)||[]).length,1);
 assert.match(String(chart({})),/Chưa có dữ liệu/)});

// ---------- 5. Lưu trữ khi localStorage lỗi ----------
t('5a. localStorage bình thường: probe ghi được, lưu bền vững',()=>{
 const mem=new Mem(),s=createStore(()=>mem,now);assert.deepEqual(s.probe(),{readable:true,writable:true});assert.equal(mem.getItem('skc:__probe__'),null);
 const M=mk('A',s);const r=M.setQuiz(Q);assert.equal(r.persisted,true);assert.equal(M.storage.persistent,true)});
t('5b. truy cập localStorage bị chặn: không crash, dùng tạm, A và B vẫn tách riêng',()=>{
 const s=createStore(()=>{const e=new Error('The operation is insecure.');e.name='SecurityError';throw e},now);
 const pr=s.probe();assert.equal(pr.readable,false);assert.match(pr.error,/SecurityError/);
 const A=mk('A',s);assert.equal(A.storage.persistent,false);assert.equal(A.storage.reason,'no-access');assert.match(A.notices[0],/không cho phép truy cập/);
 A.setQuiz(Q);const r=A.save({note:'tạm'});assert.equal(r.ok,true);assert.equal(r.persisted,false);assert.match(r.storageError,/mất khi tải lại/);
 const Bm=mk('B',s);assert.equal(Bm.d.versions.length,0);assert.equal(Bm.quiz,null);Bm.setQuiz({goals:['acne'],skin:null});Bm.save();
 const A2=mk('A',s);assert.equal(A2.d.versions.length,1);assert.equal(A2.d.versions[0].note,'tạm');assert.deepEqual(A2.quiz,Q);
 assert.equal(mk('B',s).d.versions[0].quiz.goals[0],'acne');
 assert.equal(s.setPref('uid','A'),false);assert.equal(s.getPref('uid'),null)});
t('5c. getItem() ném lỗi: không bao giờ ghi đè dữ liệu chưa đọc được',()=>{
 const mem=new Mem();mem.setItem('skc:A','{"schema":3,"quiz":{"goals":["oil"]},"versions":[{"id":"v1","n":1,"selection":[]}]}');mem.writes=0;
 const orig=mem.getItem('skc:A');mem.getItem=()=>{throw new Error('read denied')};
 const s=createStore(()=>mem,now),M=mk('A',s);assert.equal(M.storage.reason,'read-failed');assert.match(M.notices[0],/Không đọc được/);
 M.setQuiz(Q);const r=M.save();assert.ok(r.ok);assert.equal(r.persisted,false);assert.equal(M.storage.retryable,false);
 assert.equal(M.retryPersist().ok,false);assert.equal(mem.writes,0);assert.equal(mem.m.get('skc:A'),orig)});
t('5d. setItem() ném lỗi / vượt dung lượng: giữ trong phiên, báo rõ, thử lại được',()=>{
 const mem=new Mem(),s=createStore(()=>mem,now),M=mk('A',s);M.setQuiz(Q);assert.ok(M.save().ok);const saved=mem.getItem('skc:A');
 const real=mem.setItem.bind(mem);mem.setItem=()=>{throw quota()};
 assert.equal(s.probe().writable,false);
 const r=M.save({apply:false,note:'v2'});assert.ok(r.ok);assert.equal(r.persisted,false);assert.match(r.storageError,/đầy/);
 assert.equal(M.storage.reason,'quota');assert.equal(M.storage.retryable,true);assert.equal(M.d.versions.length,2);assert.equal(mem.getItem('skc:A'),saved);
 // tải lại trang khi lỗi: chỉ còn dữ liệu đã lưu bền vững trước đó
 const R=open('A',mem);assert.equal(R.d.versions.length,1);assert.equal(R.storage.persistent,true);
 assert.equal(M.retryPersist().ok,false);mem.setItem=real;
 const ok=M.retryPersist();assert.equal(ok.ok,true);assert.equal(M.storage.persistent,true);assert.equal(JSON.parse(mem.getItem('skc:A')).versions.length,2)});
t('5e. JSON hỏng: không xóa/ghi đè lúc mở; sao lưu đã xác minh; lần hỏng thứ hai không đè bản sao lưu đầu',()=>{
 const mem=new Mem();mem.setItem('skc:A','{hỏng 1');let M=open('A',mem);
 assert.equal(mem.getItem('skc:A'),'{hỏng 1');assert.equal(mem.getItem('skc:A:unreadable'),'{hỏng 1');assert.equal(M.storage.persistent,true);assert.match(M.notices[0],/JSON bị hỏng/);
 M=open('A',mem);assert.equal(mem.getItem('skc:A:unreadable'),'{hỏng 1'); // mở lại: không tạo bản trùng
 mem.setItem('skc:A','{hỏng 2');T+=1000;open('A',mem);
 assert.equal(mem.getItem('skc:A:unreadable'),'{hỏng 1');const k=[...mem.m.keys()].find(x=>x.startsWith('skc:A:unreadable-'));assert.ok(k);assert.equal(mem.getItem(k),'{hỏng 2')});
t('5f. JSON hỏng + không sao lưu được: không bao giờ ghi đè khóa chính',()=>{
 const mem=new Mem();mem.setItem('skc:A','{hỏng');mem.setItem=()=>{throw quota()};
 const M=open('A',mem);assert.equal(M.storage.reason,'backup-failed');assert.equal(M.storage.retryable,false);
 M.setQuiz(Q);const r=M.save();assert.equal(r.persisted,false);assert.equal(mem.getItem('skc:A'),'{hỏng')});
t('5g. chuyển đổi 0.2 khi không sao lưu được: dữ liệu 0.2 gốc giữ nguyên, dùng bản chuyển đổi trong bộ nhớ',()=>{
 const mem=new Mem(),raw=JSON.stringify({quiz:Q,selection:['p01'],versions:[{n:1,at:'2026-10-20T01:00:00Z',selection:['p01']}],journal:{'2026-10-21':{dry:1,oil:1,irr:1}}});
 mem.setItem('skc:A',raw);mem.setItem=()=>{throw quota()};
 const M=open('A',mem);assert.equal(M.d.schema,3);assert.equal(M.d.versions.length,1);assert.equal(M.storage.persistent,false);
 assert.ok(M.notices.some(x=>/không tạo được bản sao lưu/.test(x)));assert.equal(mem.getItem('skc:A'),raw);assert.equal(mem.getItem('skc:A:backup-0.2'),null)});
t('5h. dữ liệu schema 3 sai cấu trúc: không crash, có sao lưu, Manager vẫn chạy',()=>{
 const mem=new Mem(),raw=JSON.stringify({schema:3,quiz:'x',selection:'p01',versions:[null,{n:2,selection:'p01'},{id:'ok',n:3,selection:['p01'],quizKnown:true,quiz:Q}],
  applications:{},journal:{'2026-11-01':null,'2026-11-02':{dry:1,oil:1,irr:1}},startDate:'2026-02-30'});
 mem.setItem('skc:A',raw);const M=open('A',mem);
 assert.equal(M.d.versions.length,3);assert.ok(M.d.versions.every(v=>Array.isArray(v.selection)&&typeof v.id==='string'));
 assert.deepEqual(M.d.applications,[]);assert.deepEqual(Object.keys(M.d.journal),['2026-11-02']);assert.equal(M.d.startDate,null);assert.equal(M.quiz,null);
 assert.equal(mem.getItem('skc:A:backup-invalid'),raw);assert.equal(mem.getItem('skc:A'),raw);assert.ok(M.notices.some(x=>/không đúng cấu trúc/.test(x)));
 assert.ok(M.restore('ok').ok);assert.ok(M.save().ok)});
t('5i. dữ liệu schema mới hơn: chỉ đọc, không ghi lại',()=>{
 const mem=new Mem(),raw=JSON.stringify({schema:9,quiz:Q,versions:[],applications:[],journal:{},future:1});mem.setItem('skc:A',raw);mem.writes=0;
 const M=open('A',mem);assert.equal(M.storage.reason,'newer-schema');M.setQuiz({...Q,goals:['oil']});assert.equal(M.save().persisted,false);
 assert.equal(mem.getItem('skc:A'),raw);assert.equal(mem.writes,0)});
t('5j. lỗi trong lớp lưu trữ không thoát ra ngoài (store.save ném lỗi vẫn được bắt)',()=>{
 const s={open:()=>({data:{schema:3,quiz:null,selection:null,versions:[],applications:[],corrections:[],journal:{},startDate:null,basisId:null},notices:[]}),save:()=>{throw new Error('boom')}};
 const M=mk('A',s);const r=M.setQuiz(Q);assert.equal(r.ok,true);assert.equal(r.persisted,false);assert.match(r.storageError,/boom/)});

// ---------- 6. Quét tĩnh ----------
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const JS=['js/main.js','js/warnings-view.js','js/timeline-view.js','js/manager.js','js/storage.js','js/timeline.js','js/journal.js','js/html.js','js/engine.js','js/rules.js','js/data.js','js/viewer2d.js','js/viewer3d.js',
 'js/head-model.js','js/view3d-math.js','js/selection.js','js/icons.js']; // 0.4: thêm các module mới vào phạm vi quét; 0.4.1: face3d.js (đã xóa) → head-model.js
t('6a. không có eval/new Function/setTimeout chuỗi/document.write/insertAdjacentHTML/outerHTML',()=>{
 for(const f of JS){const s=src(f);for(const re of[/\beval\s*\(/,/new\s+Function\b/,/set(Timeout|Interval)\s*\(\s*['"`]/,/document\.write/,/insertAdjacentHTML/,/outerHTML/])assert.ok(!re.test(s),`${f}: ${re}`)}});
t('6b. innerHTML chỉ được gán trong html.js (setHtml) và viewer2d.js (SVG hằng số)',()=>{
 for(const f of JS){const c=(src(f).match(/\.innerHTML\s*=/g)||[]).length;if(f==='js/html.js'||f==='js/viewer2d.js')assert.equal(c,1,f);else assert.equal(c,0,f)}
 // 0.4: viewer2d.js dùng hằng SVG (sinh từ hình học 3D) → kiểm tra CẢ FILE không có chèn giá trị \${…} (chặt hơn 0.3.1).
 assert.ok(!/\$\{/.test(src('js/viewer2d.js')))});
t('6c. main.js không truy cập localStorage trực tiếp; không còn hàm esc cũ',()=>{
 const s=src('js/main.js');assert.ok(!/localStorage\./.test(s));assert.ok(!/\besc\(/.test(s))});
t('6d. không có bí mật/token, chỉ một nguồn mạng ngoài (jsDelivr cho Three.js)',()=>{
 const all=[...JS,'index.html','css/style.css'].map(src).join('\n');
 assert.ok(!/(api[_-]?key|secret|token|password|bearer)\s*[:=]/i.test(all));
 const hosts=new Set([...all.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m=>m[1].toLowerCase()));
 assert.deepEqual([...hosts],['cdn.jsdelivr.net']);assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(all))});
console.log(`\n${n} kiểm thử đạt.`);
