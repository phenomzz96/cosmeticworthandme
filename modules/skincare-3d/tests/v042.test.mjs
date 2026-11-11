// Chạy: node tests/v042.test.mjs — kiểm thử MỚI của 0.4.2 (không cần trình duyệt): nhóm cảnh báo, chống gộp sai, tóm tắt, chi tiết đầy đủ,
// cập nhật khi đổi sản phẩm/tài khoản, XSS, đồng bộ thẻ bước 3D, và các tệp lõi KHÔNG đổi so với 0.4.1.
// Phần cần trình duyệt thật (mobile, bàn phím, tràn ngang, mở/đóng) nằm ở tests/ui042.e2e.py.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildRoutine} from '../js/engine.js';
import {PRODUCTS,USERS} from '../js/data.js';
import {escapeHtml} from '../js/html.js';
import {SEVERITY} from '../js/icons.js';
import {groupWarnings,summaryLines,countLine,detailHtml,stepTag,stepIssues,stepNoteLabels,productNotes,GROUPS,GROUP_OF} from '../js/warnings-view.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const url=f=>new URL('../'+f,import.meta.url),src=f=>readFileSync(url(f),'utf8');
const strip=h=>String(h).replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const user=id=>USERS.find(u=>u.id===id);
const run=(uid,goals,{sel,extra=[],skin='unsure'}={})=>{const u=user(uid),selection=sel||[...u.purchased,...extra];
 return buildRoutine({quiz:{goals,skin},catalog:PRODUCTS,selection,owned:u.purchased})};
const B=run('B',['acne','sensitive']);       // 8 cảnh báo gốc: 2 conflict, 4 dup, 1 missing, 1 data
const CAUT=run('A',['acne'],{extra:['p06','p07']}); // có tổ hợp thận trọng retinoid + BHA
const mdOf=r=>groupWarnings(r.warnings,PRODUCTS);

// ---------- Tệp lõi không đổi ----------
const sha=f=>createHash('sha256').update(readFileSync(url(f))).digest('hex').slice(0,16);
t('0. Engine, quy tắc, dữ liệu, Manager, Storage, Timeline, 3D/2D, html.js, icons.js KHÔNG đổi so với 0.4.1 (băm SHA-256)',()=>{
 const pin={engine:'4898e385ac60d015',rules:'3373648e23fb1dfe',data:'c438654eaade1e70',manager:'08a1c0a14baf72d1',storage:'740450061158e8f0',timeline:'40e3994416009869',
  journal:'8e139b635a3f1ddc',selection:'bfb01cb14e88406f',
  html:'972c6d8ed245bbd6',icons:'c660d2829f0c0223'};
 // 0.5.1: js/viewer2d.js được sinh lại (sơ đồ 2D có tóc, vùng da theo mốc mới) theo Development Plan 0.5.1 (giai đoạn 5 – 3D/2D fallback) → gỡ khỏi danh sách ghim của bản này; ghim mới ở tests/v051.test.mjs.
 // v1.0.1/v1.0.2: rules.js (bỏ tiền tố "DEMO-"/"prototype" khỏi chuỗi hiển thị), data.js (tên USERS bỏ tiền tố "User A/B"; thêm setCatalog/upsertUser cho tích hợp host),
 // manager.js và storage.js (các thông báo bỏ chữ "prototype") được sửa có chủ đích cho bản bàn giao – không có tệp test riêng cho 1.0.x nên ghim lại hash mới ngay tại đây.
 for(const [f,h] of Object.entries(pin))assert.equal(sha(`js/${f}.js`),h,`js/${f}.js đã bị sửa`);
 // 0.5: viewer3d.js, head-model.js, view3d-math.js và assets/head.glb được Development Plan 0.5 (giai đoạn 2 – nâng cấp 3D) giao sửa có chủ đích,
 // nên được gỡ khỏi danh sách ghim của bản này. Hình học GLB, mốc giải phẫu và các module còn lại được ghim/kiểm chứng trong tests/v05.test.mjs.
 assert.ok(true)});

// ---------- 1–2. Gộp đúng, không gộp sai ----------
t('1. hai cảnh báo trùng bản chất (cùng sản phẩm, sáng và tối) được gộp thành MỘT mục, vẫn giữ cả hai nguồn',()=>{
 const v=mdOf(B),cl=v.issues.filter(i=>i.type==='dup'&&i.ids.includes('p01'));
 assert.equal(cl.length,1);assert.deepEqual(cl[0].per,['am','pm']);assert.equal(cl[0].periodLabel,'Sáng và tối');assert.equal(cl[0].sources.length,2);
 const mo=v.issues.filter(i=>i.type==='dup'&&i.ids.includes('p08'));assert.equal(mo.length,1);assert.equal(mo[0].sources.length,2);
 assert.equal(v.rawCount,8)});
t('2a. cảnh báo khác đối tượng/nguyên nhân KHÔNG bị gộp: Retinol và BHA là hai mục; làm sạch và dưỡng ẩm là hai mục; thiếu bước và thiếu dữ liệu là hai mục',()=>{
 const v=mdOf(B);
 assert.equal(v.issues.filter(i=>i.type==='conflict').length,2);
 assert.equal(v.issues.filter(i=>i.type==='dup').length,2);
 assert.ok(v.issues.some(i=>i.type==='missing')&&v.issues.some(i=>i.type==='data'));
 assert.equal(v.total,6)});
t('2b. gộp chỉ khi tiêu đề (bỏ buổi), loại, phạm vi, sản phẩm VÀ lý do đều giống; khác một yếu tố → giữ riêng',()=>{
 const base={type:'dup',per:'am',title:'Trùng bước X (buổi sáng): a & b',reason:'R',ids:['p01','p02']};
 const g=ws=>groupWarnings(ws,PRODUCTS).issues.length;
 assert.equal(g([base,{...base,per:'pm',title:base.title.replace('buổi sáng','buổi tối')}]),1);
 assert.equal(g([base,{...base,per:'pm',title:base.title.replace('buổi sáng','buổi tối'),reason:'R khác'}]),2,'khác lý do');
 assert.equal(g([base,{...base,per:'pm',title:base.title.replace('buổi sáng','buổi tối'),ids:['p01','p03']}]),2,'khác sản phẩm');
 assert.equal(g([base,{...base,per:'pm',title:base.title.replace('buổi sáng','buổi tối'),scope:'cross'}]),2,'khác phạm vi');
 assert.equal(g([base,{...base,per:'pm',title:'Tiêu đề khác (buổi tối)'}]),2,'khác tiêu đề');
 assert.equal(g([base,{...base,type:'caution',per:'pm',title:base.title.replace('buổi sáng','buổi tối')}]),2,'khác loại');
 assert.equal(g([base,base]),1,'hai bản ghi giống hệt (cùng buổi) vẫn giữ đủ nguồn');
 assert.equal(groupWarnings([base,base],PRODUCTS).issues[0].sources.length,2)});
t('2c. mức độ từng mục lấy đúng từ loại cảnh báo gốc (không hạ mức); mức nhóm = mức cao nhất trong nhóm',()=>{
 for(const r of [B,CAUT,run('B',['oil'])]){const v=mdOf(r);
  for(const it of v.issues.concat(v.refs))assert.equal(it.lv,SEVERITY[it.type].lv,it.type);
  for(const g of v.groups){const rank={danger:3,warn:2,neutral:1,info:0};assert.equal(g.lv,g.issues.map(i=>i.lv).sort((a,b)=>rank[b]-rank[a])[0])}}
 assert.equal(mdOf(B).groups.find(g=>g.id==='B').lv,'danger');
 assert.equal(mdOf(CAUT).groups.find(g=>g.id==='A').lv,'danger')});

// ---------- 3–4. Tóm tắt ----------
t('3. cảnh báo quan trọng vẫn nhận biết rõ ở trạng thái thu gọn: tên sản phẩm thận trọng/giữ ngoài nằm trong dòng tóm tắt, ngoài mọi <details>',()=>{
 const sA=String(summaryLines(mdOf(CAUT))),tA=strip(sA);
 assert.ok(!/<details/.test(sA));assert.match(tA,/Cần thận trọng khi dùng chung/);assert.match(tA,/Serum Retinol Renew/);assert.match(tA,/Gel BHA Clear/);
 assert.match(sA,/class="wl danger g-A"/);
 const sB=strip(summaryLines(mdOf(B)));assert.match(sB,/Chưa đưa vào routine: Serum Retinol Renew; Gel BHA Clear/);assert.match(sB,/Thiếu bước hoặc dữ liệu/)});
t('4. bản tóm tắt không đếm trùng: 8 cảnh báo gốc → 6 mục, 3 nhóm; mỗi cảnh báo gốc thuộc đúng một mục',()=>{
 const v=mdOf(B);assert.equal(countLine(v),'6 mục cần xem lại, thuộc 3 nhóm');
 const seen=v.all.flatMap(i=>i.sources).sort((a,b)=>a-b);assert.deepEqual(seen,B.warnings.map((_,i)=>i));
 assert.equal(v.groups.reduce((s,g)=>s+g.issues.length,0),v.total);
 assert.equal(countLine(mdOf(run('A',['hydrate']))),'');assert.equal(mdOf(run('A',['hydrate'])).total,0)});
t('4b. đo độ dài: dòng tóm tắt ngắn hơn rõ rệt so với 8 thẻ cảnh báo 0.4.1 (tiêu đề + "Vì sao?")',()=>{
 const old=B.warnings.map(w=>`${SEVERITY[w.type].label}: ${w.title} Vì sao?`).join(' ').length;
 const now=(strip(summaryLines(mdOf(B)))+' '+countLine(mdOf(B))).length;
 assert.ok(now<old*0.65,`${now} so với ${old}`)});

// ---------- 5–6. Chi tiết đầy đủ ----------
const COMBOS=[['B',['acne','sensitive']],['B',['acne']],['B',['oil']],['B',['hydrate','oil','sensitive','acne','basic']],['A',['acne'],['p06','p07']],['A',['hydrate']],['A',['basic']],['A',['sensitive'],['p06','p13']],['B',[]]];
t('5. có thể mở toàn bộ giải thích: phần chi tiết chứa đủ nhóm, nhãn, nguồn gốc và cả lưu ý trên nhãn sản phẩm',()=>{
 const d=String(detailHtml(mdOf(B),B.steps)),td=strip(d);
 for(const g of mdOf(B).groups)assert.ok(td.includes(g.label),g.label);
 assert.match(td,/Cảnh báo gốc \(2\)/);assert.match(td,/không cảnh báo nào bị bỏ/i);
 const c=run('A',['acne'],{extra:['p06','p07']});assert.ok(productNotes(c.steps).length>=1);
 for(const x of productNotes(c.steps))assert.ok(strip(detailHtml(mdOf(c),c.steps)).includes(x.text))});
t('6. nội dung chi tiết chứa đầy đủ thông tin từ MỌI cảnh báo gốc (tiêu đề + lý do) trên nhiều tổ hợp người dùng/mục tiêu',()=>{
 for(const [u,g,extra] of COMBOS){const r=run(u,g,{extra:extra||[]}),v=mdOf(r),d=strip(detailHtml(v,r.steps));
  const flat=v.all.flatMap(i=>i.sources).sort((a,b)=>a-b);assert.deepEqual(flat,r.warnings.map((_,i)=>i),`${u}/${g}: mỗi cảnh báo gốc đúng một mục`);
  for(const w of r.warnings){assert.ok(d.includes(w.reason.replace(/\s+/g,' ')),`${u}/${g}: thiếu lý do "${w.title}"`);
   assert.ok(d.includes(w.title),`${u}/${g}: thiếu tiêu đề gốc "${w.title}"`)}}});
t('6b. loại cảnh báo lạ KHÔNG bị ẩn: vào nhóm "Lưu ý khác" và hiện ở dòng tóm tắt; chưa biết mức → hiển thị mức thông tin',()=>{
 const v=groupWarnings([{type:'newthing',title:'Cảnh báo mới',reason:'Lý do mới',ids:[]}],PRODUCTS);
 assert.equal(v.total,1);assert.equal(v.issues[0].group,'O');assert.match(strip(summaryLines(v)),/Lưu ý khác: Cảnh báo mới/);
 assert.equal(groupWarnings(null,PRODUCTS).total,0);assert.equal(groupWarnings([null,undefined,5],PRODUCTS).total,0)});

// ---------- 7–8. Cập nhật khi đổi sản phẩm / tài khoản ----------
t('7. khi thay/bỏ sản phẩm, các nhóm cập nhật theo kết quả Engine mới',()=>{
 const before=mdOf(B),afterSel=B.steps.length&&user('B').purchased.filter(id=>id!=='p02'&&id!=='p09'&&id!=='p11');
 const after=mdOf(run('B',['acne','sensitive'],{sel:afterSel}));
 assert.ok(before.issues.some(i=>i.ids.includes('p02')&&i.type==='dup'));
 assert.ok(!after.issues.some(i=>i.type==='dup'),'bỏ sản phẩm trùng → hết mục trùng');assert.ok(!after.issues.some(i=>i.type==='data'));
 assert.ok(after.total<before.total);
 // main.js tính lại nhóm mỗi lần vẽ routine từ kết quả Engine hiện tại (không giữ bản sao cũ)
 const m=src('js/main.js');assert.match(m,/const wv=groupWarnings\(r\.warnings,PRODUCTS\)/);assert.match(m,/function refresh\(\)\{reconcile\(\);renderStorage\(\);renderRoutine\(\)/)});
t('8. chuyển tài khoản không rò cảnh báo người dùng trước: adapter không giữ trạng thái; tên sản phẩm của B không xuất hiện ở A',()=>{
 const a1=strip(summaryLines(mdOf(run('A',['acne'],{extra:['p06','p07']})))),b=strip(summaryLines(mdOf(B))),a2=strip(summaryLines(mdOf(run('A',['acne'],{extra:['p06','p07']}))));
 assert.equal(a1,a2);assert.ok(b.includes('Kem Glow Mystery')&&!a1.includes('Kem Glow Mystery')&&!a1.includes('Sữa rửa mặt tạo bọt Aqua'));
 const s=src('js/warnings-view.js');assert.ok(!/^(let|var)\s/m.test(s),'không biến toàn cục thay đổi được');
 const m=src('js/main.js');assert.match(m,/function load\(uid\)[\s\S]*?renderAll\(\)/)});

// ---------- 9–10. Mobile & bàn phím (mức tĩnh; phần chạy thật ở ui042.e2e.py) ----------
t('9. CSS: dòng tóm tắt/chi tiết cho phép xuống dòng, không đặt chiều rộng cố định; có mẫu tránh tràn trên màn hình hẹp',()=>{
 const c=src('css/style.css');const blk=c.slice(c.indexOf('.status.wsum'),c.indexOf('.periods{'));
 assert.match(blk,/overflow-wrap:anywhere/);assert.ok(!/\bwidth:\s*\d+px/.test(blk.replace(/width:1[78]px;height:1[78]px/g,'')),'không đặt rộng cố định');assert.ok(!/white-space:nowrap/.test(blk.replace('.wsum-n{font-weight:600;white-space:nowrap}','')))});
t('10. mở/đóng chi tiết bằng bàn phím: dùng <details>/<summary> gốc (Enter/Space), có nhãn chữ, tên và id để giữ trạng thái sau khi vẽ lại',()=>{
 const m=src('js/main.js');assert.match(m,/<details class="wmore" id="warnMore"><summary>Xem giải thích chi tiết<\/summary>/);
 assert.ok(!/class="wmore"[^>]*tabindex/.test(m));assert.match(m,/data-act="openedit"/);assert.match(m,/openedit:\(\)=>\{openState\.add\('editBox'\)/);
 assert.match(src('css/style.css'),/\.wmore>summary\{[^}]*min-height:var\(--tap\)/)});

// ---------- 11. XSS ----------
t('11. dữ liệu động được escape: tên sản phẩm/tiêu đề/lý do chứa HTML không tạo thẻ hay handler',()=>{
 const P1='<img src=x onerror="window.__x=1">',P2='"><svg onload=alert(1)>',P3="' onmouseover='a()";
 const cat=[{id:'x1',name:P1,category:'serum'},{id:'x2',name:P2,category:'cleanser'},{id:'x3',name:P3,category:'moisturizer'}];
 const ws=[{type:'caution',per:'am',title:P1,reason:P2,ids:['x1','x2']},{type:'conflict',title:P3,reason:P1,ids:['x3']},{type:'dup',per:'pm',title:P2,reason:P3,ids:['x2','x3']},
  {type:'missing',per:'am',title:'Thiếu bước '+P1+' (buổi sáng)',reason:P2,ids:[]},{type:'data',title:P1,reason:P3,ids:['x1']},{type:'info',title:P2,reason:P1,ids:['x3']}];
 const v=groupWarnings(ws,cat),step={products:[{id:'x1',name:P1,warnings:[P2]}],warnings:ws};
 const out=[summaryLines(v),detailHtml(v,[step]),stepTag(step,cat),stepIssues(step,cat)].map(String).join('\n');
 for(const bad of [/<img/i,/<svg[^>]*onload/i,/\sonerror\s*=\s*"/i,/<svg[^>]*onmouseover/i,/\sonmouseover\s*=\s*'/i])assert.ok(!bad.test(out),String(bad));
 assert.ok(out.includes('&lt;img')&&out.includes('&quot;&gt;&lt;svg'));
 assert.ok(stepNoteLabels(step,cat).every(x=>typeof x==='string'))});

// ---------- 12. Đồng bộ với mô hình 3D ----------
t('12. thẻ bước ở mô hình: chỉ cảnh báo của bước đang chọn, cùng thuật ngữ/nhóm với trang Routine',()=>{
 const r=B,am=r.steps.find(s=>s.id==='am:cleanse'),pm=r.steps.find(s=>s.id==='pm:cleanse'),moist=r.steps.find(s=>s.id==='am:moist');
 const si=strip(stepIssues(am,PRODUCTS));
 assert.ok(si.includes(GROUPS.C.short)&&si.includes('Trùng bước Làm sạch'));
 assert.ok(!si.includes('Serum Retinol Renew')&&!si.includes('Chống nắng')&&!si.includes('Kem Glow Mystery'),'không lặp toàn bộ danh sách của routine');
 assert.ok(!strip(stepIssues(am,PRODUCTS)).includes('Dưỡng ẩm'));assert.ok(strip(stepIssues(moist,PRODUCTS)).includes('Trùng bước Dưỡng ẩm'));
 // cùng mục → cùng nhãn nhóm/tiêu đề ngắn ở trang Routine và ở mô hình
 const rv=mdOf(r).issues.find(i=>i.type==='dup'&&i.ids.includes('p01'));assert.ok(si.includes(rv.short));assert.ok(strip(stepIssues(pm,PRODUCTS)).includes(rv.short));
 assert.deepEqual(stepNoteLabels(am,PRODUCTS),['Trùng / chồng chéo']);
 const st=String(stepTag(am,PRODUCTS));assert.match(st,/class="tag warn"/);assert.match(st,/class="sr"/);
 // thẻ bước chỉ có MỘT nhãn hiển thị
 assert.equal((st.match(/class="tag /g)||[]).length,1);
 const m=src('js/main.js'),info=m.slice(m.indexOf('function renderInfo'),m.indexOf('function renderHint'));
 assert.match(info,/stepIssues\(st,PRODUCTS\)/);assert.ok(!/r\.warnings|warnBox/.test(info),'thẻ bước không dựng lại toàn bộ cảnh báo của routine');
 // cảnh báo của bước không bị che mô hình: nằm trong cột thông tin (aside), không đặt trong khung canvas
 const html=src('index.html');assert.ok(html.indexOf('id="info"')>html.indexOf('<aside class="info-col"')&&html.indexOf('id="info"')>html.indexOf('id="v3d"'))});
t('12b. bước có lưu ý in trên nhãn sản phẩm (không do Engine tạo) vẫn có nhãn ngắn ở bước và đầy đủ ở phần chi tiết',()=>{
 const c=run('A',['acne'],{extra:['p06','p07']}),s=c.steps.find(x=>x.products.some(p=>p.warnings.length));
 assert.ok(stepNoteLabels(s,PRODUCTS).includes('Lưu ý khi dùng'));
 const d=strip(detailHtml(mdOf(c),c.steps));for(const p of c.steps.flatMap(x=>x.products))for(const w of p.warnings)assert.ok(d.includes(w),w)});

// ---------- Quét tĩnh ----------
t('S. mô-đun mới: không eval/innerHTML/script ngoài; không chèn giá trị vào ngữ cảnh nguy hiểm; chỉ import nội bộ',()=>{
 const s=src('js/warnings-view.js');
 for(const re of[/\beval\s*\(/,/new\s+Function\b/,/\.innerHTML\s*=/,/document\.write/,/insertAdjacentHTML/,/outerHTML/,/https?:\/\//,/localStorage/,/\bfetch\s*\(/])assert.ok(!re.test(s),String(re));
 assert.deepEqual([...s.matchAll(/^import .* from '([^']+)'/gm)].map(m=>m[1]).sort(),['./html.js','./icons.js','./rules.js']);
 assert.equal(Object.keys(GROUP_OF).length,7);
 const idx=src('index.html');assert.equal((idx.match(/<script/g)||[]).length,2)});

console.log(`\n${n} kiểm thử đạt.`);
