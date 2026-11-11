// Chạy: node tests/engine.test.mjs  (hoặc npm test). Kiểm thử Routine Engine trên dữ liệu giả lập.
import assert from 'node:assert/strict';
import {PRODUCTS,USERS} from '../js/data.js';
import {buildRoutine} from '../js/engine.js';
const run=(sel,goals,skin=null,owned=sel)=>buildRoutine({quiz:goals?{goals,skin}:null,catalog:PRODUCTS,selection:sel,owned});
const A=USERS[0].purchased,B=USERS[1].purchased;
const ids=r=>[...new Set(r.steps.flatMap(s=>s.products.map(p=>p.id)))];
const sig=r=>r.steps.map(s=>s.id+'='+s.products.map(p=>p.id).join('+')).join(' | ');
const sp=(r,id)=>r.steps.find(s=>s.id===id)?.products.map(p=>p.id);
const has=(r,t)=>r.warnings.some(w=>w.type===t);
let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};

// Cùng một kệ sản phẩm, mục tiêu khác nhau
const S=['p01','p03','p04','p05','p07','p08','p10','p12','p13'];
const GS=[['hydrate'],['oil'],['acne'],['sensitive'],['basic'],['hydrate','oil'],['acne','sensitive']];
const M=GS.map(g=>run(S,g));
console.log('Kệ thử nghiệm:',S.join(', '));
console.table(GS.map((g,i)=>({'mục tiêu':g.join('+'),'trạng thái':M[i].status,'sản phẩm trong routine':ids(M[i]).join(','),'chưa xếp':M[i].excluded.map(x=>x.id).join(',')})));

t('cùng danh sách, mục tiêu khác nhau → routine khác nhau',()=>assert.equal(new Set(M.map(sig)).size,6));
t('hai mục tiêu cho routine giống nhau → phải có giải thích',()=>{
 assert.equal(sig(M[3]),sig(M[6]));const g=M[6].goals.find(x=>x.key==='acne');
 assert.equal(g.state,'unmet');assert.match(g.reason,/giữ ngoài routine/);assert.ok(has(M[6],'conflict'))});
t('thứ tự trong cùng bước phụ thuộc mục tiêu',()=>{assert.deepEqual(sp(M[5],'am:serum'),['p12','p04']);assert.deepEqual(sp(M[0],'am:serum'),['p04'])});
t('sản phẩm không khớp mục tiêu bị loại kèm lý do',()=>assert.match(M[0].excluded.find(e=>e.id==='p07').reason,/Không khớp mục tiêu/));
t('mục tiêu da dễ kích ứng giữ sản phẩm xung đột ngoài routine và chuyển trạng thái review',()=>{
 assert.deepEqual(M[3].excluded.filter(e=>['p05','p07'].includes(e.id)).length,2);assert.equal(M[3].status,'review')});
t('mục tiêu cơ bản chỉ gồm các bước nền tảng',()=>{assert.deepEqual(ids(M[4]),['p01','p08','p10']);assert.equal(M[4].status,'ready')});

// Thiếu sản phẩm / mục tiêu không đáp ứng được
t('mục tiêu không thể đáp ứng → unmet + giải thích nguyên nhân',()=>{
 const r=run(A,['oil']);assert.equal(r.status,'unmet');assert.match(r.goals[0].reason,/Không có sản phẩm nào/);assert.ok(r.steps.length>0)});
t('đáp ứng một phần → partial',()=>{const r=run(A,['hydrate','oil']);assert.equal(r.status,'partial');assert.deepEqual(r.goals.map(g=>g.state),['met','unmet'])});
t('thiếu bước cần thiết → incomplete, không tự thêm sản phẩm',()=>{
 const r=run(A.filter(x=>x!=='p10'),['hydrate'],null,A);assert.equal(r.status,'incomplete');
 assert.ok(r.warnings.some(w=>w.type==='missing'&&/Chống nắng/.test(w.title)));assert.ok(!ids(r).includes('p10'));assert.equal(run(A,['hydrate']).status,'ready')});
t('sản phẩm thiếu dữ liệu không bị suy đoán',()=>{
 const r=run(['p01','p08','p10','p11'],['hydrate']);assert.ok(has(r,'data'));assert.equal(r.status,'incomplete');assert.ok(r.excluded.some(e=>e.id==='p11'))});

// Trùng lặp
t('trùng cùng bước: chọn theo điểm mục tiêu và giải thích',()=>{
 const r=run(B,['oil']);assert.deepEqual(sp(r,'am:moist'),['p09']);
 const w=r.warnings.find(w=>w.type==='dup'&&/Dưỡng ẩm/.test(w.title));assert.match(w.reason,/Barrier=0/);assert.match(w.reason,/Matte=3/);
 const c=r.warnings.find(w=>w.type==='dup'&&/Làm sạch/.test(w.title));assert.match(c.reason,/mã sản phẩm/);assert.deepEqual(sp(r,'am:cleanse'),['p01'])});
t('trùng chức năng/hoạt chất giữa các nhóm khác nhau',()=>{
 const r=run(B,['oil']),x=r.warnings.find(w=>w.type==='dup'&&w.ids.includes('p09')&&w.ids.includes('p12'));
 assert.ok(x);assert.match(x.reason,/oil-control/);assert.match(x.reason,/niacinamide/);
 assert.ok(!run(B,['hydrate']).warnings.some(w=>w.type==='dup'&&w.ids.includes('p12')))});
t('toner + serum + kem cùng cấp ẩm không bị coi là trùng',()=>assert.ok(!has(run(A,['hydrate']),'dup')));

// Tổ hợp thận trọng
const C=['p01','p08','p10','p06','p07'];
t('tổ hợp thận trọng ảnh hưởng trạng thái và gắn vào bước',()=>{
 const r=run(C,['acne']);assert.ok(has(r,'caution'));assert.equal(r.status,'review');
 assert.ok(r.steps.find(s=>s.id==='pm:treat').warnings.length>0);assert.match(r.warnings.find(w=>w.type==='caution').reason,/không phải kết luận an toàn/)});
t('mục tiêu quyết định tổ hợp có nằm trong routine hay không',()=>{
 const r=run(C,['hydrate']);assert.ok(!has(r,'caution'));assert.equal(r.status,'ready');
 assert.equal(run(C.filter(x=>x!=='p07'),['acne']).status,'ready')});

// Loại da tự đánh giá
t('loại da tự đánh giá chỉ là tham chiếu, không chẩn đoán',()=>{
 const P=['p01','p08','p09','p10'],m=s=>sp(run(P,['hydrate'],s),'am:moist')[0];
 assert.equal(m(null),'p08');assert.equal(m('dry'),'p08');assert.equal(m('oily'),'p09');
 assert.match(run(P,['hydrate'],'oily').explain.join(' '),/không phải chẩn đoán/);
 const r=run(['p01','p08','p10','p12'],['oil'],'dry');assert.ok(has(r,'skin'));assert.equal(r.status,'ready')});

// Nền tảng
t('chưa có quiz hoặc mục tiêu → insufficient, không dựng routine',()=>{
 assert.equal(run(A,null).status,'insufficient');assert.deepEqual(run(A,[]).steps,[])});
t('xác định: cùng đầu vào (kể cả thứ tự chọn khác nhau) → cùng kết quả',()=>{
 assert.deepEqual(run(S,['hydrate','oil'],'mixed'),run([...S].reverse(),['hydrate','oil'],'mixed'))});
console.log(`\n${n} kiểm thử đạt.`);
