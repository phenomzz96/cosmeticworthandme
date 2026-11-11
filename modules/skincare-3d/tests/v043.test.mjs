// Chạy: node tests/v043.test.mjs — kiểm thử MỚI của 0.4.3 (Timeline tối giản), không cần trình duyệt:
// bốn mốc, chọn ngày bất kỳ, routine đúng theo ngày (quá khứ/hôm nay/tương lai/trống), đổi mốc theo dõi KHÔNG sửa lịch sử,
// sửa ngày áp dụng chỉ khi xác nhận, không mất nhật ký/phiên bản, XSS, bàn phím/mobile (mức tĩnh) và các tệp lõi không đổi.
// Phần chạy thật trong trình duyệt (mobile không tràn ngang, bàn phím, luồng xác nhận) nằm ở tests/ui043.e2e.py.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PRODUCTS,USERS} from '../js/data.js';
import {RULES} from '../js/rules.js';
import {buildRoutine} from '../js/engine.js';
import {RoutineManager} from '../js/manager.js';
import {createStore} from '../js/storage.js';
import {describeDay,addDays,periods} from '../js/timeline.js';
import {html,escapeHtml} from '../js/html.js';
import {MILESTONES,selectedDate,dayView,dayText,fmtDate,fmtShort,weekday,trackHtml,dayHtml,customHtml,differNote} from '../js/timeline-view.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const url=f=>new URL('../'+f,import.meta.url),src=f=>readFileSync(url(f),'utf8');
const strip=h=>String(h).replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
class Mem{constructor(){this.m=new Map}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const user=id=>USERS.find(u=>u.id===id);
const compute=id=>(quiz,selection)=>buildRoutine({quiz,catalog:PRODUCTS,selection,owned:user(id).purchased});
const noon=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12).getTime()};
let T=noon('2026-11-02');const now=()=>new Date(T),setDay=s=>{T=noon(s)};
const open=(id,mem=new Mem())=>new RoutineManager(id,user(id).purchased,{store:createStore(()=>mem,now),compute:compute(id),rulesVersion:RULES.version,now});
const json=x=>JSON.parse(JSON.stringify(x));
const Q={goals:['hydrate'],skin:'dry',at:'x'};
// Nhật ký 3 ngày + 2 phiên bản: v1 áp dụng 2026-11-02, v2 (lịch tương lai) áp dụng từ 2026-11-20.
function fixture(){
 setDay('2026-11-02');const mem=new Mem(),M=open('A',mem);M.setQuiz(Q);assert.ok(M.save().ok);
 M.d.journal={'2026-11-03':{dry:2,oil:1,irr:0,skipped:true,note:'da ổn'}};
 M.setQuiz({...Q,goals:['hydrate','oil']});assert.ok(M.save({applyFrom:'2026-11-20'}).ok);
 return {M,mem};
}
const ctx={verRoutine:v=>html`<ul>${(v.snapshot?.steps||[]).map(s=>html`<li>${s.name}</li>`)}</ul>`,fmtAt:x=>String(x),rulesVersion:RULES.version};
const TODAY='2026-11-02';

// ---------- 0. Tệp lõi không đổi ----------
const sha=f=>createHash('sha256').update(readFileSync(url(f))).digest('hex').slice(0,16);
t('0. Engine, quy tắc, Manager, Storage, Timeline (logic ngày), Journal, 3D/2D, html.js, icons.js và Smart Warning UX (warnings-view.js) KHÔNG đổi so với 0.4.2 (băm SHA-256)',()=>{
 const pin={engine:'4898e385ac60d015',rules:'3373648e23fb1dfe',data:'c438654eaade1e70',manager:'08a1c0a14baf72d1',storage:'740450061158e8f0',timeline:'40e3994416009869',journal:'8e139b635a3f1ddc',
  selection:'bfb01cb14e88406f',html:'972c6d8ed245bbd6',icons:'c660d2829f0c0223','warnings-view':'a13abfa035f3e718'};
 // 0.5.1: js/viewer2d.js được sinh lại (sơ đồ 2D có tóc, vùng da theo mốc mới) theo Development Plan 0.5.1 (giai đoạn 5 – 3D/2D fallback) → gỡ khỏi danh sách ghim của bản này; ghim mới ở tests/v051.test.mjs.
 // v1.0.1/v1.0.2: rules.js/data.js/manager.js/storage.js sửa có chủ đích (bỏ chữ "DEMO-"/"prototype" khỏi chuỗi hiển thị; data.js thêm setCatalog/upsertUser) – ghim lại hash mới (xem tests/v042.test.mjs).
 for(const [f,h] of Object.entries(pin))assert.equal(sha(`js/${f}.js`),h,`js/${f}.js đã bị sửa`);
 // 0.5: viewer3d.js, head-model.js, view3d-math.js và assets/head.glb được Development Plan 0.5 (giai đoạn 2 – nâng cấp 3D) giao sửa có chủ đích,
 // nên được gỡ khỏi danh sách ghim của bản này. Hình học GLB, mốc giải phẫu và các module còn lại được ghim/kiểm chứng trong tests/v05.test.mjs.
 assert.ok(true)});

// ---------- 1. Bốn mốc & chọn ngày ----------
t('1a. đúng bốn mốc: Bắt đầu, Tuần 1, Tuần 2, Tuần 4 = +0, +7, +14, +28 ngày kể từ ngày bắt đầu theo dõi',()=>{
 assert.deepEqual(MILESTONES.map(m=>[m.label,m.n]),[['Bắt đầu',0],['Tuần 1',7],['Tuần 2',14],['Tuần 4',28]]);
 const d={startDate:'2026-11-02'};
 assert.deepEqual(MILESTONES.map(m=>selectedDate(d,{m:m.n})),['2026-11-02','2026-11-09','2026-11-16','2026-11-30']);
 assert.equal(selectedDate({startDate:'2026-02-01'},{m:28}),'2026-03-01','qua tháng 2 không nhuận');
 assert.equal(selectedDate({startDate:'2024-02-01'},{m:28}),'2024-02-29','năm nhuận')});
t('1b. chọn từng mốc → nút đúng được đánh dấu (aria-pressed), có nhãn chữ và ngày; không có ngày bắt đầu thì không bịa ngày',()=>{
 for(const {n:k,label} of MILESTONES){const h=String(trackHtml('2026-11-02',{m:k}));
  assert.equal((h.match(/aria-pressed="true"/g)||[]).length,1,label);
  const sel=h.match(/<button class="tl-node sel"[^>]*>/)[0];assert.ok(sel.includes(`data-n="${k}"`),label);assert.ok(sel.includes(`aria-label="${label}, ${fmtDate(addDays('2026-11-02',k))}"`),sel)}
 const none=String(trackHtml(null,{m:7}));assert.ok(!/<small>/.test(none),'không ngày bắt đầu → không hiện ngày nào');assert.equal((none.match(/<button/g)||[]).length,4);
 assert.equal(selectedDate({startDate:null},{m:7}),null);assert.equal(selectedDate({},{m:0}),null)});
t('1c. chọn ngày bất kỳ: ngày hợp lệ ưu tiên hơn mốc; ngày sai/rỗng bị bỏ qua; mốc trùng ngày đã chọn cũng được đánh dấu',()=>{
 const d={startDate:'2026-11-02'};
 assert.equal(selectedDate(d,{date:'2026-12-25'}),'2026-12-25');assert.equal(selectedDate(d,{date:'2026-02-30',m:7}),'2026-11-09','ngày không có thật → rơi về mốc');
 assert.equal(selectedDate(d,{date:''}),null);assert.equal(selectedDate(d,undefined),null);
 const h=String(trackHtml('2026-11-02',{date:'2026-11-16'}));assert.match(h.match(/<button class="tl-node sel"[^>]*>/)[0],/data-n="14"/);
 assert.ok(!/class="tl-node sel"/.test(String(trackHtml('2026-11-02',{date:'2026-11-17'}))))});
t('1d. định dạng ngày: dd/mm/yyyy, thứ đúng (không phụ thuộc múi giờ), giá trị lạ giữ nguyên; số ngày so với mốc không lệch một ngày',()=>{
 assert.equal(fmtDate('2026-11-03'),'03/11/2026');assert.equal(fmtShort('2026-11-03'),'03/11');assert.equal(weekday('2026-11-03'),'Thứ ba');assert.equal(weekday('2024-02-29'),'Thứ năm');assert.equal(weekday('2026-11-08'),'Chủ nhật');
 assert.equal(fmtDate('abc'),'abc');assert.equal(fmtDate(null),'');assert.equal(weekday('2026-02-30'),'');
 assert.equal(dayText(0),'Ngày bắt đầu theo dõi');assert.equal(dayText(7),'7 ngày sau ngày bắt đầu');assert.equal(dayText(-3),'3 ngày trước ngày bắt đầu');assert.equal(dayText(null),'')});

// ---------- 2. Routine đúng theo ngày ----------
t('2a. ngày quá khứ: hiển thị phiên bản có hiệu lực tại ngày đó; trước lần áp dụng đầu tiên → trống trung thực, không bịa routine',()=>{
 const {M}=fixture(),d=M.d;
 assert.equal(dayView(d,'2026-11-02','2026-11-10').kind,'applied');
 const mid=dayView(d,'2026-11-15','2026-11-25');assert.equal(mid.kind,'applied');assert.equal(mid.version.n,1,'v2 chưa có hiệu lực ở 15/11');
 const after=dayView(d,'2026-11-22','2026-11-25');assert.equal(after.version.n,2);
 const before=dayView(d,'2026-10-20',TODAY);assert.equal(before.kind,'none');assert.equal(before.version,null);assert.equal(before.application,null);
 const h=strip(dayHtml(before,ctx));assert.match(h,/Chưa có routine nào được ghi nhận áp dụng vào ngày này/);assert.match(h,/trước khi bạn bắt đầu áp dụng \(02\/11\/2026\)/);assert.ok(!/<li>/.test(String(dayHtml(before,ctx))),'không có danh sách routine giả')});
t('2b. hôm nay: routine đang áp dụng (một bản duy nhất)',()=>{
 const {M}=fixture(),v=dayView(M.d,TODAY,TODAY);assert.equal(v.kind,'current');assert.equal(v.rel,'today');assert.equal(v.version.n,1);
 const h=String(dayHtml(v,ctx));assert.match(strip(h),/Routine đang áp dụng/);assert.equal((h.match(/class="tlbox /g)||[]).length,2,'chỉ một khối routine + một khối nhật ký');
 assert.equal((h.match(/<ul>/g)||[]).length,1,'chỉ một danh sách routine')});
t('2c. ngày tương lai: chỉ lịch ĐÃ ghi nhận (scheduled) hoặc bản tham khảo có điều kiện (reference); luôn ghi rõ không phải dữ liệu thực tế',()=>{
 const {M}=fixture(),d=M.d;
 const sch=dayView(d,'2026-11-25',TODAY);assert.equal(sch.kind,'scheduled');assert.equal(sch.version.n,2);
 assert.match(strip(dayHtml(sch,ctx)),/Đã lên lịch áp dụng[\s\S]*chưa phải dữ liệu sử dụng thực tế/);
 const ref=dayView(d,'2026-11-10',TODAY);assert.equal(ref.kind,'reference');assert.equal(ref.version.n,1);
 const hr=strip(dayHtml(ref,ctx));assert.match(hr,/Tham khảo \(chưa phải dữ liệu thực tế\)/);assert.match(hr,/nếu giữ nguyên routine đang áp dụng/);assert.match(hr,/Không phải dữ liệu sử dụng thực tế|không phải dữ liệu sử dụng thực tế/);
 // một bản routine duy nhất được hiển thị, không lặp "đang áp dụng" + "dự kiến" như 0.4.2
 for(const v of [sch,ref])assert.equal((String(dayHtml(v,ctx)).match(/<ul>/g)||[]).length,1)});
t('2d. không có lịch sử: trạng thái trống trung thực ở mọi loại ngày; không tạo số liệu',()=>{
 const M=open('A'),d=M.d;
 for(const [date,re] of [['2026-10-01',/Chưa có routine nào được ghi nhận áp dụng vào ngày này/],[TODAY,/Chưa có routine nào đang được áp dụng/],['2026-12-01',/Chưa có lịch áp dụng nào được ghi nhận cho ngày này/]]){
  const v=dayView(d,date,TODAY);assert.equal(v.kind,'none');const h=strip(dayHtml(v,ctx));assert.match(h,re);assert.ok(!/\d+\/5/.test(h),'không tự tạo điểm số')}});
t('2e. không có nhật ký: không bịa dữ liệu hay xu hướng; ngày tương lai ghi "chưa tới"; có nhật ký → hiển thị đúng số liệu người dùng ghi',()=>{
 const {M}=fixture(),d=M.d;
 const empty=strip(dayHtml(dayView(d,'2026-11-01',TODAY),ctx));assert.match(empty,/Chưa có nhật ký cho ngày này/);assert.ok(!/Khô|Dầu|Kích ứng|cải thiện|tiến triển/.test(empty));
 assert.match(strip(dayHtml(dayView(d,'2026-12-01',TODAY),ctx)),/Ngày này chưa tới/);
 const has=strip(dayHtml(dayView(d,'2026-11-03',TODAY),ctx));assert.match(has,/Khô 2\/5 · Dầu 1\/5 · Kích ứng 0\/5 · không dùng đủ bước/);assert.match(has,/da ổn/);
 assert.equal(String(dayHtml(dayView(d,'2026-11-03',TODAY),ctx)).includes('id="tlPhoto"'),true)});
t('2f. bản nháp chưa lưu: chỉ một dòng ngắn khi liên quan (hôm nay/tương lai), không có thẻ routine thứ hai, không hiện ở ngày quá khứ',()=>{
 const {M}=fixture(),d=M.d;
 for(const [date,show] of [['2026-11-02',true],['2026-11-25',true],['2026-11-15',true],['2026-10-30',false]]){
  const v=dayView(d,date,date==='2026-10-30'?'2026-11-02':TODAY,{dirty:true}),h=String(dayHtml(v,ctx));
  assert.equal(h.includes('tl-draft'),date==='2026-10-30'?false:show,date);if(show)assert.match(strip(h),/Bạn có thay đổi chưa lưu nên chưa được tính vào lộ trình/)}
 const clean=String(dayHtml(dayView(d,TODAY,TODAY,{dirty:false}),ctx));assert.ok(!clean.includes('tl-draft'));
 assert.equal((String(dayHtml(dayView(d,TODAY,TODAY,{dirty:true}),ctx)).match(/<ul>/g)||[]).length,1)});

// ---------- 3. Ngày bắt đầu theo dõi: đổi mốc không sửa lịch sử ----------
const snap=M=>json({applications:M.d.applications,corrections:M.d.corrections,versions:M.d.versions,journal:M.d.journal,basisId:M.d.basisId,quiz:M.d.quiz,selection:M.d.selection});
t('3a. đổi/bỏ ngày bắt đầu theo dõi KHÔNG đổi applications, corrections, phiên bản, nhật ký; các mốc dịch theo; routine theo ngày không đổi',()=>{
 const {M,mem}=fixture(),before=snap(M),viewBefore=dayView(M.d,'2026-11-15',TODAY);
 const m0=MILESTONES.map(m=>selectedDate(M.d,{m:m.n}));
 assert.ok(M.setStartDate('2026-10-01').ok);assert.deepEqual(snap(M),before);
 assert.notDeepEqual(MILESTONES.map(m=>selectedDate(M.d,{m:m.n})),m0);assert.deepEqual(MILESTONES.map(m=>selectedDate(M.d,{m:m.n})),['2026-10-01','2026-10-08','2026-10-15','2026-10-29']);
 assert.equal(dayView(M.d,'2026-11-15',TODAY).version.n,viewBefore.version.n);assert.equal(dayView(M.d,'2026-11-15',TODAY).application.from,viewBefore.application.from);
 assert.ok(M.setStartDate(null).ok);assert.deepEqual(snap(M),before);assert.equal(M.d.startDate,null);
 assert.deepEqual(MILESTONES.map(m=>selectedDate(M.d,{m:m.n})),[null,null,null,null]);
 assert.deepEqual(json(JSON.parse(mem.getItem('skc:A')).applications),before.applications)});
t('3b. mốc theo dõi khác ngày áp dụng thực tế: lưu ý ngắn luôn hiện (không che), giải thích trong phần mở rộng; hai ngày không bị đồng bộ',()=>{
 const {M}=fixture(),first=periods(M.d)[0].from;
 assert.equal(String(differNote(M.d.startDate,first)),'','trùng nhau → không có lưu ý');
 M.setStartDate('2026-10-20');const dn=strip(differNote(M.d.startDate,first));
 assert.match(dn,/Ngày bắt đầu theo dõi \(20\/10\/2026\) khác ngày bắt đầu áp dụng routine \(02\/11\/2026\)/);assert.match(String(differNote(M.d.startDate,first)),/data-act="opentl"/);
 const c=strip(customHtml(M.d.startDate,first));assert.match(c,/Vì sao hai ngày này khác nhau/);assert.match(c,/không tự đồng bộ hay ghi đè lịch sử/);assert.match(c,/khác ngày bắt đầu theo dõi/);
 assert.equal(periods(M.d)[0].from,'2026-11-02','ngày áp dụng thực tế vẫn nguyên');assert.equal(M.d.startDate,'2026-10-20','không tự đồng bộ')});
t('3c. "Tùy chỉnh mốc theo dõi": nhãn "Ngày bắt đầu theo dõi", câu giải thích ngắn, đoạn "Ngày 0…" dài đã bỏ; thu gọn mặc định; giữ id #startDate',()=>{
 const c=String(customHtml('2026-11-02','2026-11-02')),s=strip(c);
 assert.match(c,/<details class="more" id="tlCustom"><summary>Tùy chỉnh mốc theo dõi<\/summary>/);assert.ok(!/<details[^>]*\sopen/.test(c));
 assert.match(s,/Ngày bắt đầu theo dõi/);assert.match(s,/Đổi mốc theo dõi không thay đổi lịch sử đã lưu\./);assert.match(c,/id="startDate"/);
 assert.ok(!/Ngày 0|chỉ dùng để đếm|ngày thứ N/.test(s));assert.ok(!/khác ngày bắt đầu theo dõi/.test(s),'trùng nhau → không có thẻ khác biệt');
 assert.match(strip(customHtml(null,null)),/Chưa đặt\. Sẽ tự đặt khi bạn lưu và áp dụng routine lần đầu/)});
t('3d. màn hình chính không lộ trường kỹ thuật (seq, recordedAt, recordedFrom, correction, Ngày 0…) và không có đoạn hướng dẫn dài',()=>{
 const {M}=fixture();M.correctApplication(0,'2026-11-01',{confirmed:true,reason:'lý do thử'});
 for(const date of ['2026-11-01','2026-11-02','2026-11-25','2026-10-01']){const h=String(dayHtml(dayView(M.d,date,TODAY),ctx))+String(trackHtml(M.d.startDate,{m:0}))+String(differNote(M.d.startDate,'2026-11-01'));
  assert.ok(!/seq|recordedAt|recordedFrom|prevFrom|Ngày 0|ghi lúc/.test(h),date);assert.ok(strip(h).length<900,`${date}: ${strip(h).length} ký tự`)}
 assert.match(strip(dayHtml(dayView(M.d,'2026-11-01',TODAY),ctx)),/ngày áp dụng đã được chỉnh/,'vẫn báo (ngắn) rằng ngày áp dụng đã được chỉnh, không giấu')});

// ---------- 4. Sửa ngày áp dụng ----------
t('4a. sửa ngày áp dụng KHÔNG xảy ra nếu chưa xác nhận; xác nhận → chỉ GHI THÊM bản ghi sửa (append-only), không mất nhật ký/ảnh/phiên bản',()=>{
 const {M}=fixture(),before=snap(M);
 for(const opt of [undefined,{},{confirmed:false},{confirmed:'true'},{confirmed:1}]){const r=M.correctApplication(0,'2026-11-01',opt);assert.equal(r.ok,false);assert.deepEqual(snap(M),before)}
 const r=M.correctApplication(0,'2026-11-01',{confirmed:true,reason:'bắt đầu sớm hơn'});assert.ok(r.ok);
 const after=snap(M);assert.deepEqual(after.applications,before.applications,'bản ghi gốc giữ nguyên');assert.deepEqual(after.versions,before.versions);assert.deepEqual(after.journal,before.journal);
 assert.equal(after.corrections.length,1);assert.equal(after.corrections[0].from,'2026-11-01');assert.equal(after.corrections[0].prevFrom,'2026-11-02');
 assert.equal(dayView(M.d,'2026-11-01',TODAY).kind,'applied','timeline tính lại theo ngày đã sửa');assert.equal(M.d.startDate,'2026-11-02','ngày bắt đầu theo dõi không đổi theo')});
t('4b. giao diện: biểu mẫu sửa cần hai bước (mở rồi bấm "Xác nhận"); đúng MỘT nơi gọi correctApplication, kèm confirmed:true; hậu quả được nêu rõ',()=>{
 const m=src('js/main.js');
 assert.equal((m.match(/correctApplication\(/g)||[]).length,1);assert.match(m,/correctApplication\(\+a\.dataset\.seq,\$\('#fixDate'\)\?\.value,\{confirmed:true,/);
 const fix=m.match(/\n fix:a=>\{[^\n]*\n/)[0];assert.ok(!/correctApplication/.test(fix),'bước 1 chỉ mở biểu mẫu');
 const form=m.slice(m.indexOf('function fixForm'),m.indexOf('function historyHtml'));
 assert.match(form,/Bạn đang sửa lịch sử áp dụng thực tế/);assert.match(form,/Bản ghi gốc vẫn được giữ/);assert.match(form,/Phiên bản, nhật ký và ngày bắt đầu theo dõi không thay đổi/);
 assert.match(form,/data-act="fixok"[^>]*>Xác nhận sửa ngày áp dụng/);assert.match(form,/data-act="fixno">Hủy/);
 const ok=m.slice(m.indexOf(' fixok:'),m.indexOf(' jsave:'));assert.match(ok,/Bản ghi gốc vẫn được giữ/);assert.match(ok,/ngày bắt đầu theo dõi không thay đổi/)});
t('4c. công cụ sửa lịch sử nằm ở tab Phiên bản (không còn trong Timeline); Timeline có đường dẫn tới đó; vẫn xem được toàn bộ lịch sử',()=>{
 const m=src('js/main.js'),tl=m.slice(m.indexOf('function renderTimeline'),m.indexOf('function fixForm')),ver=m.slice(m.indexOf('function renderVersions'),m.indexOf('// ---- Bước Mô hình 3D'));
 assert.ok(!/historyHtml|data-act="fix"/.test(tl));assert.match(ver,/historyHtml\(m\)/);assert.match(ver,/flashBox\(S\.hMsg\)/);
 const hist=m.slice(m.indexOf('function historyHtml'),m.indexOf('// ---- Nhật ký ----'));assert.match(hist,/data-act="fix"/);assert.match(hist,/Lịch sử áp dụng \(/);
 assert.match(String(customHtml('2026-10-20','2026-11-02')),/data-act="tab" data-t="versions"/);
 assert.match(m,/ fixno:\(\)=>\{S\.fix=null;S\.hMsg=\['Đã hủy, lịch sử áp dụng không thay đổi\.'\];renderVersions\(\)\}/)});

// ---------- 5. Dữ liệu cũ / dữ liệu lạ ----------
t('5. dữ liệu 0.2 (chưa có thời điểm áp dụng) / dữ liệu rỗng / ngày lạ: không lỗi, không routine giả',()=>{
 const legacy={startDate:'2026-10-20',versions:[{id:'v-old',n:1,createdAt:'2026-10-21T05:00:00Z',legacy:{missing:['x']},snapshot:null,selection:['p01']}],applications:[],corrections:[],journal:{'2026-10-21':{dry:2,oil:1,irr:0}}};
 const v=dayView(legacy,'2026-10-25','2026-11-02');assert.equal(v.kind,'none');assert.equal(v.savedOnly.n,1);
 const h=strip(dayHtml(v,ctx));assert.match(h,/Có phiên bản v1 được lưu lúc .*nhưng dữ liệu 0\.2 không ghi nhận thời điểm áp dụng/);
 assert.match(strip(dayHtml(dayView(legacy,'2026-10-21','2026-11-02'),ctx)),/Khô 2\/5 · Dầu 1\/5 · Kích ứng 0\/5/);
 const empty={versions:[],applications:[],corrections:[],journal:{}};for(const date of ['2026-01-01',TODAY,'2030-01-01'])assert.equal(dayView(empty,date,TODAY).kind,'none');
 for(const bad of [{versions:[],applications:[{versionId:'zz',from:'2026-13-45'}],corrections:[{target:'x'}],journal:{}},{versions:[],applications:null,corrections:null,journal:null}])assert.doesNotThrow(()=>strip(dayHtml(dayView(bad,TODAY,TODAY),ctx)))});

// ---------- 6. XSS ----------
t('6. dữ liệu độc hại (ghi chú nhật ký, bộ quy tắc, ngày bắt đầu, ngày áp dụng) được escape: không tạo thẻ/handler',()=>{
 const X='<img src=x onerror="window.__x=1">',X2='"><svg onload=alert(1)>',X3="' onmouseover='a()";
 const d={startDate:X2,versions:[{id:'v1',n:1,createdAt:'2026-11-01T00:00:00Z',rulesVersion:X,snapshot:{steps:[{name:X}]}}],applications:[{versionId:'v1',from:'2026-11-02',kind:'save'}],corrections:[],
  journal:{'2026-11-03':{dry:X,oil:X2,irr:X3,skipped:true,note:X+X2}}};
 const out=[dayHtml(dayView(d,'2026-11-03',TODAY),{...ctx,verRoutine:v=>html`<ul>${v.snapshot.steps.map(s=>html`<li>${s.name}</li>`)}</ul>`}),customHtml(X2,X),trackHtml(X2,{m:0}),differNote(X2,X3),dayHtml({...dayView(d,TODAY,TODAY),startDate:X},ctx)].map(String).join('\n');
 for(const bad of [/<img/i,/<svg[^>]*onload/i,/\sonerror\s*=\s*"/i,/\sonmouseover\s*=\s*'/i])assert.ok(!bad.test(out),String(bad));
 assert.ok(out.includes('&lt;img')&&out.includes('&quot;&gt;&lt;svg'));
 const idx=src('index.html');assert.equal((idx.match(/<script/g)||[]).length,2)});

// ---------- 7. Bàn phím, mobile (mức tĩnh) ----------
t('7a. bàn phím: mốc là <button> có aria-pressed + aria-label; ô ngày/summary là điều khiển gốc; vẽ lại trả tiêu điểm; không có handler inline',()=>{
 const tv=src('js/timeline-view.js'),m=src('js/main.js');
 assert.match(tv,/<button class="tl-node [^"]*"[^>]*data-act="day"[^>]*aria-pressed=[^>]*aria-label=/);assert.ok(!/\son[a-z]+=/i.test(tv));assert.ok(!/tabindex="[1-9]/.test(tv+m));
 assert.match(m,/box\.querySelector\(fsel\)\?\.focus\(\{preventScroll:true\}\)/);assert.match(m,/opentl:\(\)=>\{openState\.add\('tlCustom'\)/);
 assert.match(m,/document\.activeElement/);assert.match(src('index.html'),/data-act="tab" data-t="timeline">Lộ trình</)});
t('7b. mobile (CSS): 4 mốc chia đều cột minmax(0,1fr) không tràn; khối ngày xếp cột tự động; khu tùy chỉnh không đặt chiều rộng cố định lớn',()=>{
 const c=src('css/style.css');assert.match(c,/\.tl-track\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);assert.match(c,/\.tl-boxes\{[^}]*repeat\(auto-fit,minmax\(min\(260px,100%\),1fr\)\)/);
 assert.match(c,/\.tl-ref\{display:grid;gap:6px;max-width:560px\}/);assert.ok(!/\.tl-ref\{[^}]*grid-template-columns:auto/.test(c))});

// ---------- Quét tĩnh ----------
t('S. mô-đun mới: không eval/innerHTML/fetch/localStorage; chỉ import nội bộ; không script ngoài; không từ ngữ dự đoán hiệu quả',()=>{
 const s=src('js/timeline-view.js');
 for(const re of[/\beval\s*\(/,/new\s+Function\b/,/\.innerHTML\s*=/,/document\.write/,/insertAdjacentHTML/,/outerHTML/,/https?:\/\//,/localStorage/,/\bfetch\s*\(/,/Math\.random/,/new Date\(\)/])assert.ok(!re.test(s),String(re));
 assert.deepEqual([...s.matchAll(/^import .* from '([^']+)'/gm)].map(m=>m[1]).sort(),['./html.js','./icons.js','./timeline.js']);
 const all=strip(dayHtml(dayView(fixture().M.d,'2026-11-10',TODAY),ctx))+strip(customHtml('2026-11-02','2026-11-03'));
 assert.ok(!/cải thiện|hiệu quả sau|chắc chắn|sẽ sáng|giảm mụn/.test(all),'không dự đoán kết quả skincare')});

console.log(`\n${n} kiểm thử đạt.`);
