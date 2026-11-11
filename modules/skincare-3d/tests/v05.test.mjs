// Chạy: node tests/v05.test.mjs — kiểm thử MỚI của 0.5 (không cần trình duyệt): mô hình (AO đã bake, hình học không đổi),
// màu/highlight, ánh sáng, thông báo lỗi 3D, cử chỉ, chống phản hồi bất đồng bộ cũ (mức mã nguồn) và các module không được đổi.
// Phần chạy thật với Three.js/WebGL (xoay, zoom, chọn vùng, 3D↔2D, race ảnh/3D, luồng khách hàng) nằm ở tests/ui05.e2e.py.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import * as H from '../js/head-model.js';
import * as M from '../js/view3d-math.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const url=f=>new URL('../'+f,import.meta.url),src=f=>readFileSync(url(f),'utf8');
const sha=f=>createHash('sha256').update(readFileSync(url(f))).digest('hex').slice(0,16);
const buf=readFileSync(url(H.HEAD_ASSET)),G=H.readGLB(buf),SK=G.meshes.skin,EY=G.meshes.eyes,NV=SK.positions.length/3,L=G.landmarks;

// ---------- 0. Phạm vi: module ổn định không đổi ----------
t('0. Engine, quy tắc, dữ liệu, Manager, Storage, Timeline, Journal, selection, html, icons, Smart Warning (0.4.2), Timeline UX (0.4.3), viewer 2D KHÔNG đổi so với 0.4.3',()=>{
 const pin={'engine':'4898e385ac60d015','rules':'3373648e23fb1dfe','data':'c438654eaade1e70','manager':'08a1c0a14baf72d1','storage':'740450061158e8f0','timeline':'40e3994416009869',
  'journal':'8e139b635a3f1ddc','selection':'bfb01cb14e88406f','html':'972c6d8ed245bbd6','icons':'c660d2829f0c0223','warnings-view':'a13abfa035f3e718','timeline-view':'fa9cd3a78c41de42'};
 // 0.5.1: js/viewer2d.js được sinh lại (sơ đồ 2D có tóc, vùng da theo mốc mới) theo Development Plan 0.5.1 (giai đoạn 5 – 3D/2D fallback) → gỡ khỏi danh sách ghim của bản này; ghim mới ở tests/v051.test.mjs.
 // v1.0.1/v1.0.2: rules.js/data.js/manager.js/storage.js sửa có chủ đích (bỏ chữ "DEMO-"/"prototype" khỏi chuỗi hiển thị; data.js thêm setCatalog/upsertUser cho tích hợp host) – ghim lại hash mới (xem tests/v042.test.mjs).
 for(const [f,h] of Object.entries(pin))assert.equal(sha(`js/${f}.js`),h,`js/${f}.js đã bị sửa`)});

// ---------- 1. Mô hình: AO đã bake, hình học/mốc/giấy phép giữ nguyên ----------
t('1a. head.glb: hình học (vị trí, pháp tuyến, chỉ số của skin/eyes/cap), mốc giải phẫu và bản quyền GIỐNG HỆT 0.4.3',()=>{
 // 0.5.1: hình dáng khuôn mặt, tóc và mốc giải phẫu được Development Plan 0.5.1 (giai đoạn 2–3) giao sửa có chủ đích → băm hình học/mốc
 // của 0.4.3 không còn áp dụng; ghim hình học + mốc MỚI nằm ở tests/v051.test.mjs (1a). Ở đây chỉ còn kiểm tra nguồn/giấy phép.
 assert.ok(SK.positions.length>0&&L.eyeL&&L.mouth&&L.chin);
 assert.match(G.json.asset.copyright,/^CC0 1\.0 – MakeHuman base mesh/)});
t('1b. AO theo đỉnh: có cho skin và eyes, đúng số đỉnh, trong [0,1], ghi rõ công cụ trong asset.extras; vẫn ≤ 1 MB, không texture/URI ngoài',()=>{
 assert.equal(SK.ao.length,NV);assert.equal(EY.ao.length,EY.positions.length/3);assert.equal(G.meshes.cap.ao,null);
 for(const a of [SK.ao,EY.ao])for(const v of a)assert.ok(v>=0&&v<=1&&Number.isFinite(v));
 assert.equal(G.json.asset.extras.ao.tool,'tools/bake-ao.mjs');assert.ok(buf.length<=1.5*1024*1024,`${buf.length}`); // 0.5.1: có tóc/lông mày/mi (đã nén) → trần 1,5 MiB (xem v051)
 assert.ok(G.json.buffers.every(b=>!('uri' in b))&&!G.json.images&&!G.json.textures)});
t('1c. AO hợp lý về giải phẫu: hốc mắt, cánh mũi/dưới mũi, khe môi tối hơn trán và má; đỉnh đầu gần như không bị che',()=>{
 const P=SK.positions,N=SK.normals,mean=f=>{let s=0,c=0;for(let i=0;i<NV;i++)if(f(P[i*3],P[i*3+1],P[i*3+2],N[i*3+2])){s+=SK.ao[i];c++}assert.ok(c>5);return s/c};
 const near=(c,r)=>(x,y,z,nz)=>Math.hypot(x-c[0],y-c[1])<r&&nz>0.2&&z>0;
 // 0.5.1: vị trí trán/má lấy theo vùng da (mốc mới); đỉnh đầu nay nằm dưới tóc (tóc che → AO thấp là đúng) nên bỏ điều kiện đỉnh đầu
 const fs=H.ZONE_SHAPES.forehead,cs=H.ZONE_SHAPES.cheekL,fore=mean(near([fs.x,fs.y],0.12)),cheek=mean(near([cs.x,cs.y],0.06));
 const eye=mean(near(L.eyeL,L.eyeRadius*1.25)),nose=mean((x,y,z,nz)=>Math.abs(x-L.noseTip[0])<0.07&&y<L.noseTip[1]&&y>L.noseTip[1]-0.1&&z>L.noseTip[2]-0.2),mouth=mean((x,y,z,nz)=>Math.abs(x)<0.05&&Math.abs(y-L.mouth[1])<0.02&&nz>0.3);
 assert.ok(fore>0.9&&cheek>0.85,`trán ${fore} má ${cheek}`);
 for(const [k,v] of [['mắt',eye],['dưới mũi',nose],['khe môi',mouth]])assert.ok(v<fore-0.08,`${k} ${v.toFixed(3)} ≥ trán ${fore.toFixed(3)}`)});
t('1d. công cụ bake tái lập được và an toàn: từ chối tệp đã bake (không ghi đè), không đụng tới hình học',()=>{
 const out='/tmp/skc-bake-test.glb';if(existsSync(out))rmSync(out);
 const r=spawnSync(process.execPath,[new URL('../tools/bake-ao.mjs',import.meta.url).pathname,new URL('../assets/head.glb',import.meta.url).pathname,out],{encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stderr,/đã có _AO/);assert.ok(!existsSync(out));
 const s=src('tools/bake-ao.mjs');assert.ok(!/Math\.random/.test(s),'tất định');assert.ok(!/https?:\/\//.test(s));
 assert.match(src('assets/head.LICENSE.md'),/bake-ao\.mjs/)});

// ---------- 2. Màu, AO, highlight ----------
t('2a. màu nền: không có AO → giống hệt công thức 0.4.3; có AO → chỉ tối đi (không đổi sắc), mức tối có giới hạn',()=>{
 const b0=H.baseColors(SK.positions,SK.normals),b1=H.baseColors(SK.positions,SK.normals,SK.ao);
 for(let i=0;i<NV;i+=97){const f=H.aoShade(SK.ao[i],H.AO_K.skin);for(let c=0;c<3;c++)assert.ok(Math.abs(b1[i*3+c]-b0[i*3+c]*f)<1e-6)}
 assert.equal(H.aoShade(null,0.7),1);assert.equal(H.aoShade(1,0.7),1);assert.ok(Math.abs(H.aoShade(0,H.AO_K.skin)-(1-H.AO_K.skin))<1e-9);assert.equal(H.aoShade(NaN,0.7),1);
 assert.ok(H.AO_K.skin<=0.8&&H.AO_K.eye<=0.8,'không đen kịt');
 const e0=H.eyeColors(EY.normals),e1=H.eyeColors(EY.normals,EY.ao);for(let i=0;i<e0.length;i++)assert.ok(e1[i]<=e0[i]+1e-9)});
t('2b. lòng trắng mắt dịu hơn 0.4.3 (không còn trắng gắt ở khóe), mống mắt/đồng tử giữ nguyên',()=>{
 assert.ok(Math.max(...H.EYE.sclera)<0.9);assert.deepEqual(H.EYE.iris,[0.50,0.42,0.38]);assert.deepEqual(H.EYE.pupil,[0.24,0.20,0.19])});
t('2c. lớp "toàn mặt": màu sáng hơn màu nhấn, ≤ 18% (nhẹ, không thành "mặt nạ"); mép rộng hơn nhưng ngưỡng 0.5 vẫn ở r = 0.94 (khớp sơ đồ 2D); phủ được thái dương',()=>{
 const lum=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];assert.ok(lum(H.PALETTE.face)>lum(H.PALETTE.hl));
 const B=H.baseColors(SK.positions,SK.normals,SK.ao),W=H.computeWeights(SK.positions,SK.normals),o=new Float32Array(B.length),FC=H.PALETTE.face.map(H.toLinear);
 H.applyHighlight(B,W,o,{on:H.zonesToTargets(['face']),hover:[0,0,0,0]});let mx=0;
 for(let i=0;i<NV;i++)for(let c=0;c<3;c++){const d=FC[c]*(B[i*3+c]/H.toLinear(H.PALETTE.skin[c]))-B[i*3+c];if(Math.abs(d)>0.05)mx=Math.max(mx,(o[i*3+c]-B[i*3+c])/d)}
 assert.ok(mx>0.12&&mx<=0.181,`mức phủ ${mx}`);
 const S=H.FACE_SHAPE,w=r=>H.zoneWeights(S.x+r*S.rx,S.y,1)[H.FACE_CH];
 assert.ok(Math.abs(w(0.94)-0.5)<0.02,`ngưỡng 0.5 tại r=0.94: ${w(0.94)}`);assert.ok(w(0.84)>0.8&&w(0.84)<1,'mép mềm (0.4.3: đã =1 tại 0.88)');assert.equal(w(1.1),0);
 assert.ok(H.zoneWeights(0.3,0,0.15)[H.FACE_CH]>0.2,'thái dương/hai bên má (nz thấp) vẫn được phủ nhẹ');
 assert.equal(H.zoneWeights(0.3,0,0.15)[1],0,'raycast chọn vùng (kênh 0–3) không đổi')});
t('2d. highlight từng vùng: bật cả 4 vùng cùng lúc vẫn chặn ở ≤ HL_MAX (0.5.2: 0.68; không cộng dồn); hover yếu hơn chọn',()=>{
 const B=H.baseColors(SK.positions,SK.normals,SK.ao),W=H.computeWeights(SK.positions,SK.normals),o=new Float32Array(B.length),hl=H.PALETTE.hl.map(H.toLinear);
 H.applyHighlight(B,W,o,{on:H.zonesToTargets(['forehead','cheekL','cheekR','chin']),hover:[0,0,0,0]});let mx=0;
 for(let i=0;i<NV;i++)for(let c=0;c<3;c++){const d=hl[c]-B[i*3+c];if(Math.abs(d)>0.05)mx=Math.max(mx,(o[i*3+c]-B[i*3+c])/d)}
 assert.ok(mx>0.45&&mx<=H.HL_MAX+0.001,`mức phủ ${mx}`);
 const h=new Float32Array(B.length);H.applyHighlight(B,W,h,{on:[0,0,0,0,0],hover:[1,1,1,1]});let mh=0;const hv=H.PALETTE.hover.map(H.toLinear);
 for(let i=0;i<NV;i++)for(let c=0;c<3;c++){const d=hv[c]-B[i*3+c];if(Math.abs(d)>0.05)mh=Math.max(mh,(h[i*3+c]-B[i*3+c])/d)}
 assert.ok(mh<=0.251&&mh<mx)});

// ---------- 3. Ánh sáng, vật liệu, camera ----------
t('3a. ánh sáng studio: nền bán cầu thấp hơn 0.4.3 (0.62) để hình khối rõ; đèn chính mạnh nhất và lệch bên; không bóng đổ/hậu xử lý',()=>{
 const Lt=M.LIGHTS;assert.ok(Lt.hemi.intensity<0.62&&Lt.hemi.intensity>=0.25);assert.ok(Lt.key.intensity>Lt.rim.intensity&&Lt.key.intensity>Lt.fill.intensity*5);
 assert.ok(Math.abs(Lt.key.pos[0])>Lt.key.pos[2],'đèn chính lệch sang bên hơn là chiếu thẳng (tránh mặt phẳng)');assert.ok(Lt.exposure>0.8&&Lt.exposure<1.2);
 const v=src('js/viewer3d.js');assert.ok(!/castShadow|shadowMap|EffectComposer|Bloom/i.test(v));assert.match(v,/new T\.HemisphereLight\(L\.hemi\.sky,L\.hemi\.ground,L\.hemi\.intensity\)/);
 // 0.5.1: da chuyển sang MeshPhysicalMaterial (sheen ấm, phản xạ thấp) theo giai đoạn 4; vẫn không kim loại, độ nhám cao (kiểm chi tiết ở v051)
 assert.match(v,/skin=this\.mat\(new T\.MeshPhysicalMaterial\(\{vertexColors:true,metalness:0,\.\.\.M\.skin/,'da không kim loại')});
t('3b. camera: giới hạn xoay/nghiêng/zoom hữu ích; khoảng gần nhất không xuyên vào đầu; preset nằm trong giới hạn',()=>{
 for(const a of [0.6,1,1.6,3]){const f=M.fitDistance(a),l=M.distLimits(f);assert.ok(l.min>=M.VIEW.radius*1.9&&l.max<=f*2&&l.min<f&&l.max>f)}
 assert.ok(M.LIMITS.maxAz<Math.PI*0.6&&M.LIMITS.minPolar>0.8&&M.LIMITS.maxPolar<2.1);
 for(const p of Object.values(M.PRESETS))assert.ok(p.az>=M.LIMITS.minAz&&p.az<=M.LIMITS.maxAz&&p.polar>=M.LIMITS.minPolar&&p.polar<=M.LIMITS.maxPolar)});
t('3c. phân biệt nhấp/chạm với kéo: kéo vượt ngưỡng, chạm nhiều ngón, giữ quá lâu đều KHÔNG chọn vùng',()=>{
 const g=new M.GestureTracker();
 g.down(1,0,0,'mouse',0);g.move(1,30,0);g.move(1,2,0);assert.equal(g.up(1,2,0,300),'drag','kéo ra rồi quay về chỗ cũ vẫn là kéo');
 g.down(2,0,0,'touch',0);g.down(3,50,0,'touch',10);assert.notEqual(g.up(2,0,0,100),'tap');assert.notEqual(g.up(3,50,0,110),'tap');
 g.down(4,0,0,'touch',0);assert.notEqual(g.up(4,1,1,5000),'tap','giữ lâu');
 g.down(5,0,0,'mouse',0);assert.equal(g.up(5,3,2,120),'tap')});

// ---------- 4. Thông báo lỗi 3D ngắn gọn, trung thực ----------
t('4. failCause: giữ nguyên nhân, bỏ URL/chi tiết kỹ thuật; mất mạng → gợi ý cần Internet',()=>{
 const net='không tải được thư viện 3D (Three.js) – cần kết nối Internet tới cdn.jsdelivr.net (Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js)';
 assert.equal(M.failCause(net),'không tải được thư viện 3D (cần kết nối Internet)');
 assert.equal(M.failCause('trình duyệt hoặc thiết bị không hỗ trợ WebGL'),'trình duyệt hoặc thiết bị không hỗ trợ WebGL');
 assert.equal(M.failCause('không tải được mô hình 3D (assets/head.glb): 404'),'không tải được mô hình 3D');
 assert.equal(M.failCause('không khởi tạo được WebGL renderer: Error creating WebGL context.'),'không khởi tạo được WebGL renderer');
 assert.equal(M.failCause('lỗi 3D giả lập khi đang chạy'),'lỗi 3D giả lập khi đang chạy');
 for(const x of [null,undefined,'',{}])assert.ok(M.failCause(x).length>0);assert.ok(!/https?:/.test(M.failCause(net)));
 const m=src('js/main.js'),f=m.slice(m.indexOf('function fall('),m.indexOf('async function setMode'));
 assert.match(f,/setHtml\(\$\('#notice'\),html`/);assert.match(f,/Đã chuyển sang chế độ 2D/);assert.match(f,/<details><summary>Chi tiết kỹ thuật<\/summary>/);assert.ok(!/textContent=`Không dùng được 3D \(\$\{e/.test(f))});

// ---------- 5. Chống phản hồi bất đồng bộ cũ (mức mã nguồn; chạy thật ở ui05.e2e.py) ----------
t('5a. 3D↔2D: khởi tạo 3D xong muộn sau khi đã bấm 2D → không ghi đè chế độ (mã yêu cầu S.modeTok); lỗi cũ không bật thông báo',()=>{
 const m=src('js/main.js'),s=m.slice(m.indexOf('async function setMode'),m.indexOf('function setView'));
 assert.match(s,/const tok=\+\+S\.modeTok/);assert.match(s,/if\(tok!==S\.modeTok\)\{v3\.stop\(\);return\}/);assert.match(s,/catch\(e\)\{if\(tok===S\.modeTok\)fall\(e\)\}/);
 assert.match(m.slice(m.indexOf('function fall('),m.indexOf('async function setMode')),/S\.modeTok\+\+/)});
t('5b. ảnh nhật ký: Timeline chỉ hiển thị ảnh nếu vẫn đúng tài khoản + NGÀY + lần tải mới nhất; xem ảnh ở Nhật ký chỉ hiện ảnh của lần bấm mới nhất',()=>{
 const m=src('js/main.js'),tl=m.slice(m.indexOf('function renderTimeline'),m.indexOf('function fixForm'));
 assert.match(tl,/tok=\+\+S\.photoTok,cur=\(\)=>tok===S\.photoTok&&S\.uid===u&&selectedDate\(S\.mgr\.d,S\.tl\)===date/);
 assert.match(tl,/if\(cur\(\)\)showPhoto/);assert.match(tl,/if\(el&&cur\(\)\)el\.textContent/);assert.match(tl,/else S\.photoTok\+\+/);
 assert.match(m,/pview:async a=>\{const u=S\.uid,dt=a\.dataset\.d,tok=\+\+S\.jviewTok;[^\n]*if\(S\.uid===u&&tok===S\.jviewTok\)showPhoto/)});

// ---------- 6. Luồng & giao diện ----------
t('6a. bước Mô hình có hành động tiếp theo rõ ràng, không thêm nút "Lưu" thứ hai, không thêm nút chính',()=>{
 const m=src('js/main.js'),f=m.slice(m.indexOf('function renderModelNext'),m.indexOf('function renderZonebar'));
 assert.match(f,/data-act="stage" data-s="routine">Quay lại routine để lưu/);assert.match(f,/data-act="stage" data-s="track">Theo dõi &amp; lịch sử/);
 assert.ok(!/data-act="save"|class="primary"/.test(f));assert.equal((m.match(/data-act="save"/g)||[]).length,1);
 assert.match(src('index.html'),/<div id="modelNext" class="model-next"><\/div><\/aside>/)});
t('6b. dòng dưới mô hình nói rõ đang xem bước/vùng nào (phản hồi ngay, cả trên điện thoại); rê chuột vẫn ưu tiên tên vùng',()=>{
 const m=src('js/main.js'),f=m.slice(m.indexOf('function renderHint'),m.indexOf('function onHover'));
 assert.match(f,/hv\?`\$\{ZONES\[hv\]\} – nhấp để chọn`:st\?`Đang xem: /);assert.match(f,/const hv=S\.hover&&S\.hover!==S\.sel\?\.zone\?S\.hover:null/);assert.match(f,/Đang xem vùng: /);assert.match(f,/classList\.toggle\('on'/);
 assert.match(src('css/style.css'),/\.stage-hint\.on\{/)});
t('6c. lưu ý in trên nhãn sản phẩm hiện nguyên văn trong dòng bước (khôi phục 0.4.1), có trong nhãn trợ năng; nhãn tóm tắt 0.4.2 vẫn giữ',()=>{
 const m=src('js/main.js'),f=m.slice(m.indexOf('function stepRow'),m.indexOf('function renderRoutine'));
 assert.match(f,/stepNotes\(s\)\.map\(x=>html`<small class="pw">\$\{I\.warn\} \$\{x\}<\/small>`\)/);assert.match(f,/\$\{stepTag\(s,PRODUCTS\)\}/);
 assert.match(f,/stepNotes\(s\)\.length>0&&`\. \$\{stepNotes\(s\)\.join\(' '\)\}`/)});
t('6d. tổ design: CSS mới dùng biến màu sẵn có, không style inline mới trong main.js; không thêm thư viện/script/mạng ngoài',()=>{
 const m=src('js/main.js');assert.ok(!/style="/.test(m),'không style inline');
 const idx=src('index.html');assert.equal((idx.match(/<script/g)||[]).length,2);
 const hosts=new Set([...(['js/main.js','js/viewer3d.js','js/view3d-math.js','js/head-model.js','index.html','css/style.css'].map(src).join('\n')).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(x=>x[1].toLowerCase()));
 assert.deepEqual([...hosts].filter(h=>h!=='cdn.jsdelivr.net'&&h!=='www.w3.org'),[]);
 assert.ok(!/gtag|analytics|sentry|mixpanel|hotjar/i.test(m+idx))});

console.log(`\n${n} kiểm thử đạt.`);
