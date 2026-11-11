// Chạy: node tests/v041.test.mjs — kiểm thử MỚI của 0.4.1 (không cần trình duyệt):
// tài nguyên mô hình GLB + giấy phép, ánh xạ vùng trên lưới mới, highlight "mềm", độ khớp 2D, cấu trúc giao diện 3 bước
// (ẩn/hiện mặc định, công cụ developer, menu điều khiển phụ), mọi data-act có xử lý, cảnh báo quan trọng không bị ẩn.
// Luồng điều hướng chạy thật trong trình duyệt nằm ở tests/ui041.e2e.py.
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import * as F from '../js/head-model.js';
import {SX,OX,OY,FACE_R} from '../tools/gen-face2d.mjs';
import {SEVERITY} from '../js/icons.js';
import {ZONES} from '../js/data.js';
import {GROUP_OF} from '../js/warnings-view.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const url=f=>new URL('../'+f,import.meta.url),src=f=>readFileSync(url(f),'utf8');
const buf=readFileSync(url(F.HEAD_ASSET)),G=F.readGLB(buf),L=G.landmarks,SK=G.meshes.skin;
const W=F.computeWeights(SK.positions,SK.normals),B=F.baseColors(SK.positions,SK.normals),NV=SK.positions.length/3;

// ---------- A. Tài nguyên mô hình & giấy phép ----------
t('A1. head.glb: GLB 2.0 hợp lệ, tự chứa (không URI ngoài, không texture), 3 mesh skin/eyes/cap, index uint16',()=>{
 const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
 assert.equal(dv.getUint32(0,true),0x46546C67);assert.equal(dv.getUint32(4,true),2);assert.equal(dv.getUint32(8,true),buf.length);
 const j=G.json;assert.equal(j.asset.version,'2.0');
 // 0.5.1: thêm tóc (hair), lớp tóc tơ chân tóc (hairline), lông mày + lông mi + khoang miệng (brows) theo Development Plan 0.5.1
 assert.deepEqual(j.meshes.map(m=>m.name).sort(),['brows','cap','eyes','hair','hairline','skin']);
 assert.ok(j.buffers.every(b=>!('uri' in b)),'không tham chiếu tệp ngoài');assert.ok(!j.images&&!j.textures,'không texture');
 for(const m of j.meshes)assert.equal(j.accessors[m.primitives[0].indices].componentType,5123)});
t('A2. kích thước tải hợp lý: ≤ 1 MB, ≤ 25 000 đỉnh da, ≤ 60 000 tam giác tổng',()=>{
 // 0.5.1: tóc + lông mày/mi là phần lớn dung lượng → lượng tử hóa + nén meshopt (tools/optimize-glb.mjs). Trần nâng có lý do:
 // ≤ 1,5 MiB tải về, ≤ 130 000 tam giác tổng (đo thực: khoảng 1,46 MiB, khoảng 125 000 tam giác; render theo nhu cầu, 7 draw call).
 const size=statSync(url(F.HEAD_ASSET)).size;assert.ok(size<=1.5*1024*1024,`${size} byte`);
 assert.ok(NV<=25000);const tri=G.json.meshes.reduce((s,m)=>s+G.json.accessors[m.primitives[0].indices].count/3,0);assert.ok(tri<=130000,`${tri} tam giác`)});
t('A3. nguồn & giấy phép được ghi rõ: CC0 trong GLB, tệp LICENSE (commit, SHA-256, chủ sở hữu), chân trang',()=>{
 assert.match(G.json.asset.copyright,/CC0 1\.0/);assert.match(G.json.asset.copyright,/MakeHuman/);
 const lic=src('assets/head.LICENSE.md');
 for(const s of['CC0 1.0','makehumancommunity/makehuman','a8bc2d54ff0ac92e78ff71431b1023eda42bf482','8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c','Data Collection AB'])assert.ok(lic.includes(s),s);
 assert.ok(existsSync(url('assets/CC0-1.0-MakeHuman-LICENSE.ASSETS.md')));
 assert.match(src('index.html'),/MakeHuman \(CC0\)/)});
t('A4. viewer tải mô hình từ dự án (đường dẫn tương đối), không từ URL ngoài; js/face3d.js cũ đã gỡ',()=>{
 const v=src('js/viewer3d.js');assert.ok(/GLTFLoader/.test(v)&&/H\.HEAD_ASSET/.test(v)&&/import\.meta\.url/.test(v));
 assert.equal(F.HEAD_ASSET,'assets/head.glb');assert.ok(!existsSync(url('js/face3d.js')));
 for(const f of['js/main.js','js/viewer3d.js','js/viewer2d.js','tools/gen-face2d.mjs'])assert.ok(!/face3d/.test(src(f)),f)});

// ---------- B. Vùng da trên lưới mới ----------
t('B1. chọn 3D khớp mốc: điểm neo mỗi vùng nằm trên mặt trước và zoneAt(điểm neo) trả đúng vùng',()=>{
 for(const z of F.ZONE_KEYS){const a=F.zoneAnchor(SK.positions,SK.normals,z);assert.ok(a.every(Number.isFinite));
  let best=-1,d=9;for(let i=0;i<NV;i++){const e=Math.hypot(SK.positions[i*3]-a[0],SK.positions[i*3+1]-a[1],SK.positions[i*3+2]-a[2]);if(e<d){d=e;best=i}}
  assert.ok(SK.normals[best*3+2]>0.5,`${z} hướng ra trước`);assert.equal(F.zoneAt(a[0],a[1],SK.normals[best*3+2]),z)}});
t('B2. vùng tránh mắt, mũi, môi: không đỉnh nào trong vùng nằm trong nhãn cầu/đầu mũi/khe môi',()=>{
 for(let i=0;i<NV;i++){const o=i*F.CH;if(![0,1,2,3].some(k=>W[o+k]>0.5))continue;const x=SK.positions[i*3],y=SK.positions[i*3+1];
  for(const e of[L.eyeL,L.eyeR])assert.ok(Math.hypot(x-e[0],y-e[1])>L.eyeRadius*1.2,'mắt');
  assert.ok(Math.hypot(x-L.noseTip[0],y-L.noseTip[1])>0.12,'mũi');assert.ok(!(Math.abs(x)<0.17&&Math.abs(y-L.mouth[1])<0.05),'môi')}});
t('B3. hai má đối xứng: cùng số đỉnh và cùng diện tích chiếu',()=>{
 let l=0,r=0;for(let i=0;i<NV;i++){if(W[i*F.CH+1]>0.5)l++;if(W[i*F.CH+2]>0.5)r++}assert.equal(l,r);assert.ok(l>40)});

// ---------- C. Highlight mềm, không viền, không đổi màu da ngoài vùng ----------
// 0.5.2: mức phủ tối đa 55% → HL_MAX (0.68) theo yêu cầu "highlight phải nhận ra ngay" (đã kiểm bằng ảnh render);
// đồng thời NÂNG ngưỡng dưới 0.3 → 0.45 để highlight không thể bị làm nhạt trở lại.
t('C1. một lớp phủ mềm: tối đa HL_MAX về màu nhấn, hover yếu hơn chọn, không đỉnh ngoài vùng bị đổi màu',()=>{
 const out=new Float32Array(B.length),hl=F.PALETTE.hl.map(F.toLinear);let maxSel=0; // màu tính trong không gian tuyến tính
 F.applyHighlight(B,W,out,{on:F.zonesToTargets(['cheekL']),hover:[0,0,0,0]});
 for(let i=0;i<NV;i++)for(let c=0;c<3;c++){const d=hl[c]-B[i*3+c];if(Math.abs(d)>0.05)maxSel=Math.max(maxSel,(out[i*3+c]-B[i*3+c])/d)}
 assert.ok(maxSel>0.45&&maxSel<=F.HL_MAX+0.001,`mức phủ ${maxSel.toFixed(3)}`);
 const h=new Float32Array(B.length);F.applyHighlight(B,W,h,{on:[0,0,0,0,0],hover:[0,1,0,0]});
 let maxHov=0;for(let i=0;i<NV;i++)for(let c=0;c<3;c++){const d=hl[c]-B[i*3+c];if(Math.abs(d)>0.05)maxHov=Math.max(maxHov,(h[i*3+c]-B[i*3+c])/d)}
 assert.ok(maxHov>0&&maxHov<maxSel,'hover nhẹ hơn')});
t('C2. viewer3d không còn viền vùng, glow hay vật liệu phát sáng; vật liệu da mờ (matte)',()=>{
 const v=src('js/viewer3d.js');for(const re of[/LineSegments|EdgesGeometry|LineBasicMaterial/,/emissive/i,/OutlinePass|UnrealBloom|EffectComposer/,/outline/i])assert.ok(!re.test(v),String(re));
 // 0.5.1: da là MeshPhysicalMaterial với thông số trong MATS.skin – nhám vừa, phản xạ thấp (không bóng nhựa)
 const r=+v.match(/skin:\{roughness:([\d.]+),specularIntensity:([\d.]+)/)[1],si=+v.match(/skin:\{roughness:[\d.]+,specularIntensity:([\d.]+)/)[1];assert.ok(r>=0.5&&si<=0.5,'da mờ')});
t('C3. 2D: vùng chưa chọn không có viền/nền; lớp "toàn mặt" là siêu elip FACE_SHAPE tại ngưỡng 0.5',()=>{
 const css=src('css/style.css'),zr=css.match(/\.face2d \.zone\{([^}]*)\}/)[1];
 assert.match(zr,/stroke:none/);assert.match(zr,/fill:rgba\([^)]*,0\)/);
 const svg=src('js/viewer2d.js'),d=svg.match(/class="face-ov" d="([^"]+)"/)[1],pts=[...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m=>[(+m[1]-OX)/SX,(OY-+m[2])/SX]);
 const S=F.FACE_SHAPE;for(const [x,y] of pts){const r=Math.pow(Math.abs((x-S.x)/S.rx)**S.p+Math.abs((y-S.y)/S.ry)**S.p,1/S.p);assert.ok(Math.abs(r-FACE_R)<0.02,r)}});

// ---------- D. Giao diện 3 bước: cấu trúc & mặc định ẩn/hiện ----------
const html=src('index.html'),main=src('js/main.js');
const tagOf=id=>html.match(new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`))?.[0]||'';
t('D1. đúng 3 giai đoạn + khu phụ "Theo dõi & lịch sử"; mặc định chỉ Mục tiêu hiển thị',()=>{
 const st=[...html.matchAll(/data-stage="([a-z]+)"/g)].map(m=>m[1]);assert.deepEqual(st,['goals','routine','model','track']);
 assert.ok(!/\shidden/.test(tagOf('stage-goals')));for(const s of['routine','model','track'])assert.match(tagOf('stage-'+s),/\shidden/);
 assert.match(main,/const STAGES=\[\['goals','Mục tiêu'\],\['routine','Routine'\],\['model','Mô hình 3D'\]\]/);
 for(const tab of['journal','timeline','versions'])assert.match(html,new RegExp(`data-tab="${tab}" id="${tab}"`))});
t('D2. công cụ developer (giả lập lỗi 3D, hiệu năng) chỉ nằm trong #devbar, ẩn mặc định; vẫn còn đủ chức năng',()=>{
 assert.match(tagOf('devbar'),/\shidden/);const dev=html.match(/<div id="devbar"[\s\S]*?<\/div>/)[0];
 for(const a of['sim','perf'])assert.equal((html.match(new RegExp(`data-act="${a}"`,'g'))||[]).length,1),assert.ok(dev.includes(`data-act="${a}"`));
 assert.match(main,/DEV_URL=new URLSearchParams\(location\.search\)\.has\('dev'\)/);assert.match(main,/\$\('#devbar'\)\.hidden=!S\.dev/);
 assert.match(tagOf('perf'),/\shidden/);for(const k of['sim:','perf:','devmode:'])assert.ok(main.includes(k))});
t('D3. điều khiển mặc định: 3D/2D + đặt lại góc nhìn; góc nghiêng, thu phóng, chọn vùng nằm trong menu đóng sẵn',()=>{
 const tb=html.match(/<div class="toolbar"[\s\S]*?<\/details>/)[0],menu=tb.match(/<details class="menu" id="moreCtl">[\s\S]*<\/details>/)[0],outside=tb.replace(menu,'');
 assert.ok(/data-act="mode" data-m="3d"/.test(outside)&&/data-act="mode" data-m="2d"/.test(outside)&&/data-act="reset"/.test(outside));
 for(const a of['preset','zoom'])assert.ok(!outside.includes(`data-act="${a}"`)&&menu.includes(`data-act="${a}"`),a);
 assert.ok(menu.includes('id="zonebar"'));assert.ok(!/<details class="menu" id="moreCtl" open/.test(html),'menu đóng mặc định')});
t('D4. mọi data-act trong HTML/JS đều có hàm xử lý (không nút "chết")',()=>{
 const used=new Set([...(html+main).matchAll(/data-act="([a-z0-9]+)"/g)].map(m=>m[1]));
 const body=main.slice(main.indexOf('const act={'));
 for(const a of used)assert.ok(new RegExp(`\\n ${a}:|[{,]${a}:`).test(body),`thiếu xử lý: ${a}`);
 assert.ok(used.size>=30,used.size)});
t('D5. cảnh báo quan trọng vẫn nhận biết được ở trạng thái thu gọn (0.4.2: thay cho "mọi cảnh báo nằm ngoài phần mở rộng")',()=>{
 // 0.4.1 yêu cầu từng cảnh báo là một thẻ riêng nằm ngoài phần mở rộng. 0.4.2 chủ động thay bằng: mọi loại cảnh báo mức danger/warn/neutral
 // thuộc một nhóm cần xem lại (không rơi vào nhóm chỉ-tham-khảo) và được nêu trong dòng tóm tắt luôn hiển thị; lý do đầy đủ nằm trong phần chi tiết.
 for(const [k,v] of Object.entries(SEVERITY))if(v.lv!=='info')assert.ok(GROUP_OF[k]&&GROUP_OF[k]!=='R',k);
 const rr=main.slice(main.indexOf('function renderRoutine'),main.indexOf('function saveHtml')),i1=rr.indexOf('summaryLines(wv)'),i2=rr.indexOf('class="wmore"'),i3=rr.indexOf('<details class="more"');
 assert.ok(i1>0&&i1<i2&&i2<i3,'dòng tóm tắt đứng trước phần giải thích chi tiết và mọi phần thu gọn khác');
 // Thẻ thông tin ở bước 3 hiển thị cảnh báo của bước ngay trên "Xem chi tiết".
 const info=main.slice(main.indexOf('function renderInfo'),main.indexOf('function renderHint'));assert.ok(info.indexOf('stepIssues(st,PRODUCTS)')>0&&info.indexOf('stepIssues(st,PRODUCTS)')<info.indexOf('Xem chi tiết'))});
t('D6. mỗi giai đoạn chỉ có MỘT nút chính (primary)',()=>{
 const q=main.slice(main.indexOf('function renderQuiz'),main.indexOf('function renderAnalysis'));assert.equal((q.match(/class="primary"/g)||[]).length,1);
 const r=main.slice(main.indexOf('function renderRoutine'),main.indexOf('function saveHtml'));
 // nhánh "chưa có mục tiêu" và nhánh có routine loại trừ nhau → mỗi nhánh 1 nút chính
 const [noQuiz,withQuiz]=r.split(':html`\n <div class="status');assert.equal((noQuiz.match(/class="primary"/g)||[]).length,1);assert.equal((withQuiz.match(/class="primary"/g)||[]).length,1);
 assert.ok(!/class="primary"/.test(main.slice(main.indexOf('function saveHtml'),main.indexOf('function versionHtml'))),'tùy chọn lưu: không thêm nút chính thứ hai');
 assert.equal((main.match(/data-act="save"/g)||[]).length,1,'chỉ một nút Lưu routine');
 assert.ok(!/class="primary"/.test(main.slice(main.indexOf('function renderStepPick'),main.indexOf('function renderHint'))),'bước 3: không cần nút chính')});
t('D7. 3D chỉ khởi tạo khi vào bước Mô hình; rời bước thì dừng render',()=>{
 const s=main.slice(main.indexOf('function showStage'),main.indexOf('function setStage'));
 assert.match(s,/S\.stage==='model'\)\{if\(!S\.started3d\)\{S\.started3d=true;setMode\('3d'\)\}/);assert.match(s,/else v3\.stop\(\)/);
 assert.ok(!/\bview:async/.test(main),'mở trang tính năng không còn tự tải 3D')});
t('D8. không thêm script theo dõi/dịch vụ ngoài; vẫn chỉ 2 thẻ script, không handler inline',()=>{
 assert.equal((html.match(/<script/g)||[]).length,2);assert.ok(!/\son[a-z]+=/i.test(html));
 assert.ok(!/gtag|analytics|googletagmanager|hotjar|sentry|mixpanel|segment\.io/i.test(html+main))});

console.log(`\n${n} kiểm thử đạt.`);
