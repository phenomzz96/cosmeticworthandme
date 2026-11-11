// Chạy: node tests/v051.test.mjs — kiểm thử MỚI của 0.5.1 (không cần trình duyệt): mô hình mới (hình dáng, tóc, lông mày/mi, môi),
// tối ưu GLB, vùng da theo mốc mới, sơ đồ 2D có tóc, vật liệu/ánh sáng, công cụ dựng và phạm vi thay đổi.
// Phần chạy thật với Three.js/WebGL (giải nén meshopt, render, chọn vùng, 3D↔2D, hiệu năng) nằm ở tests/ui051.e2e.py.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import * as H from '../js/head-model.js';
import * as M from '../js/view3d-math.js';
import {SX,OX,OY,ZONE_R} from '../tools/gen-face2d.mjs';

let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const url=f=>new URL('../'+f,import.meta.url),src=f=>readFileSync(url(f),'utf8');
const sha=f=>createHash('sha256').update(readFileSync(url(f))).digest('hex').slice(0,16);
const buf=readFileSync(url(H.HEAD_ASSET)),G=H.readGLB(buf),J=G.json,SK=G.meshes.skin,NV=SK.positions.length/3,L=G.landmarks;
const HAIR=J.nodes.find(nd=>nd.extras?.hair).extras.hair,smooth=H.smooth;
const hairY=al=>{const a=Math.abs(al),P=HAIR.hairline;for(let k=1;k<P.length;k++)if(a<=P[k][0]){const [a0,y0]=P[k-1],[a1,y1]=P[k];return y0+(y1-y0)*(a-a0)/(a1-a0)}return P.at(-1)[1]};

// ---------- 0. Phạm vi: chỉ mô hình 3D và phần hiển thị/tương tác trực tiếp của nó được đổi ----------
t('0. Quiz/Routine Engine, quy tắc, dữ liệu, Manager, Storage, Timeline (+UX), Journal, Smart Warning UX, html, icons, main.js KHÔNG đổi so với 0.5',()=>{
 const pin={'engine':'4898e385ac60d015','rules':'3373648e23fb1dfe','data':'c438654eaade1e70','manager':'08a1c0a14baf72d1','storage':'740450061158e8f0',
  'timeline':'40e3994416009869','journal':'8e139b635a3f1ddc','selection':'bfb01cb14e88406f','html':'972c6d8ed245bbd6','icons':'c660d2829f0c0223',
  'warnings-view':'a13abfa035f3e718','timeline-view':'fa9cd3a78c41de42','main':'855f2a1f52bce522'};
 // v1.0.1/v1.0.2: rules.js/data.js/manager.js/storage.js sửa có chủ đích (bỏ chữ "DEMO-"/"prototype" khỏi chuỗi hiển thị; data.js thêm setCatalog/upsertUser cho tích hợp host – xem tests/v042.test.mjs);
 // main.js sửa có chủ đích (khôi phục chỉ báo tài khoản ở mọi giao diện khách hàng, bắt tay skincare:ready hai chiều với host nhúng iframe) – ghim lại hash mới của cả hai.
 for(const [f,h] of Object.entries(pin))assert.equal(sha(`js/${f}.js`),h,`js/${f}.js đã bị sửa`);
 assert.equal(sha('js/viewer2d.js'),'0289e939dfe70641','js/viewer2d.js phải là bản sinh từ mô hình 0.5.1 (npm run gen:face2d -- --write)')});

// ---------- 1. Mô hình ----------
t('1a. hình học da/mắt/nắp + mốc giải phẫu được ghim (dựng lại tất định bằng tools/build-model.mjs)',()=>{
 const h=createHash('sha256');for(const k of ['skin','eyes','cap'])for(const a of ['positions','normals','index'])h.update(Buffer.from(G.meshes[k][a].buffer));
 // v1.0.2: hình dáng tóc/mặt được Development Plan 1.0.2 (dựng lại bằng tools/blender/build-character.py + hair_shell.py) giao sửa
 // có chủ đích (đã kiểm chứng bằng ảnh trước/sau ở docs/screenshots/v052/) → ghim lại hình học mới; mốc giải phẫu (landmarks) không đổi.
 assert.equal(h.digest('hex').slice(0,16),'d0bfe908c1e4d5ca','hình học đã đổi');
 assert.equal(createHash('sha256').update(JSON.stringify(L)).digest('hex').slice(0,16),'e0f62d8fa92b7df1','mốc giải phẫu đã đổi')});
t('1b. tỉ lệ khuôn mặt nữ trẻ, mềm hơn 0.5: mắt ngang giữa đầu, khoảng cách các nét theo tỉ lệ cổ điển (± dung sai)',()=>{
 const H_=L.top[1]-L.chin[1];assert.ok(Math.abs(L.eyeL[1]-(L.top[1]+L.chin[1])/2)<0.12*H_,'mắt gần giữa chiều cao đầu');
 const eyeGap=L.eyeL[0]-L.eyeR[0],eyeW=2*L.eyeRadius;assert.ok(eyeGap>1.4*eyeW&&eyeGap<2.3*eyeW,'khoảng cách hai mắt ≈ 1,5–2 lần độ rộng mắt');
 const lower=L.noseTip[1]-L.chin[1],mid=L.eyeL[1]-L.noseTip[1];assert.ok(lower>mid&&lower<2.2*mid,'tầng dưới mặt cân đối');
 assert.ok(L.mouth[1]-L.chin[1]>0.15&&L.noseTip[1]-L.mouth[1]>0.15,'khoảng mũi–miệng–cằm đủ')});
t('1c. lưới: 6 phần (skin, eyes, cap, hair, hairline, brows); da/mắt/nắp là float đọc trực tiếp được; không texture, không URI ngoài',()=>{
 assert.deepEqual(J.meshes.map(m=>m.name).sort(),['brows','cap','eyes','hair','hairline','skin']);
 for(const k of ['skin','eyes','cap'])assert.ok(!G.meshes[k].compressed&&G.meshes[k].positions instanceof Float32Array);
 for(const k of ['hair','hairline','brows'])assert.ok(G.meshes[k].compressed);
 assert.ok(J.buffers.every(b=>!('uri' in b))&&!J.images&&!J.textures,'tự chứa, không texture');
 for(const m of J.meshes)assert.equal(J.accessors[m.primitives[0].indices].componentType,5123,'index uint16')});
t('1d. mặt nạ trên da: _HAIR (da đầu dưới tóc, viền mi, nền mày) và _LIP (môi) trong [0,1]; môi nằm quanh mốc miệng, không lan ra má/cằm',()=>{
 for(const a of [SK.hair,SK.lip]){assert.equal(a.length,NV);for(const v of a)assert.ok(v>=0&&v<=1)}
 const P=SK.positions;let inLip=0,out=0;
 for(let i=0;i<NV;i++)if(SK.lip[i]>0.5){const dx=Math.abs(P[i*3]),dy=P[i*3+1]-L.mouth[1];if(dx<0.2&&dy>-0.11&&dy<0.1)inLip++;else out++}
 assert.ok(inLip>40&&out===0,`môi ${inLip}, ngoài ${out}`)});
t('1e. tóc: kiểu vén gọn ra sau + búi thấp; chân tóc giữa trán cao hơn vùng trán, tai/má/cằm không bị che',()=>{
 assert.match(HAIR.style,/búi thấp/);assert.ok(HAIR.hairline[0][1]>=0.57,'chân tóc giữa trán');
 const fs=H.ZONE_SHAPES.forehead;assert.ok(fs.y+fs.ry*ZONE_R<HAIR.hairline[0][1]-0.03,'vùng trán nằm dưới chân tóc (cả lớp tóc tơ)');
 assert.ok(HAIR.bun.c[2]<-0.5&&HAIR.bun.c[1]<0,'búi sau gáy, thấp');
 const P=SK.positions;for(let i=0;i<NV;i++){const y=P[i*3+1];if(y<L.chin[1]||P[i*3+2]<0.3)continue;
  const w=H.zoneWeights(P[i*3],y,SK.normals[i*3+2]);if(Math.max(w[1],w[2],w[3])>0.5)assert.ok(SK.hair[i]<0.05,'má/cằm không dưới tóc')}});

// ---------- 2. Tối ưu GLB ----------
t('2a. dung lượng ≤ 1,5 MiB; tóc/lông mày/mi lượng tử hóa + nén meshopt; mọi phần mở rộng là loại Three.js r160 hỗ trợ',()=>{
 const size=statSync(url(H.HEAD_ASSET)).size;assert.ok(size<=1.5*1024*1024,`${size} byte`);
 assert.deepEqual([...J.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_mesh_quantization']);
 assert.deepEqual([...J.extensionsUsed].sort(),['EXT_meshopt_compression','KHR_mesh_quantization']);
 assert.equal(J.asset.extras.optimize.tool,'tools/optimize-glb.mjs');
 const fb=J.buffers[1];assert.ok(fb.extensions.EXT_meshopt_compression.fallback===true&&!('uri' in fb));
 for(const name of ['hair','hairline','brows']){const p=J.meshes.find(m=>m.name===name).primitives[0];
  for(const [k,i] of Object.entries(p.attributes)){const a=J.accessors[i];assert.ok(a.componentType!==5126,`${name}.${k} đã lượng tử`);assert.ok(J.bufferViews[a.bufferView].extensions.EXT_meshopt_compression)}}
 const tri=J.meshes.reduce((s,m)=>s+J.accessors[m.primitives[0].indices].count/3,0);assert.ok(tri<=130000,`${tri}`)});
t('2b. công cụ tối ưu: tất định, không mạng, từ chối tệp đã tối ưu (không ghi đè); bộ mã hóa meshopt kèm giấy phép MIT',()=>{
 const out='/tmp/skc-opt-test.glb';if(existsSync(out))rmSync(out);
 const r=spawnSync(process.execPath,[new URL('../tools/optimize-glb.mjs',import.meta.url).pathname,new URL('../assets/head.glb',import.meta.url).pathname,out],{encoding:'utf8'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/đã được tối ưu/);assert.ok(!existsSync(out));
 for(const f of ['tools/optimize-glb.mjs','tools/build-hair.mjs','tools/build-model.mjs','tools/apply-targets.mjs']){const s=src(f);assert.ok(!/Math\.random/.test(s),f);assert.ok(!/https?:\/\/(?!github\.com)/.test(s),f)}
 assert.match(src('tools/vendor/meshoptimizer-LICENSE.md'),/MIT License/);assert.match(src('tools/vendor/meshopt_encoder.js'),/meshoptimizer/)});
t('2c. trình duyệt giải nén bằng MeshoptDecoder của CHÍNH Three.js 0.160.0 (cùng CDN, cùng importmap) – không thêm máy chủ/thư viện mới',()=>{
 const v=src('js/viewer3d.js');assert.match(v,/import\('three\/addons\/libs\/meshopt_decoder\.module\.js'\)/);assert.match(v,/setMeshoptDecoder\(MeshoptDecoder\)/);
 assert.match(src('index.html'),/"three\/addons\/":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/examples\/jsm\/"/)});

// ---------- 3. Vùng da theo mốc mới ----------
t('3a. vùng da khớp giải phẫu mới: trán giữa chân mày và chân tóc; má ngang đầu mũi, ngoài cánh mũi, dưới mắt; cằm dưới môi',()=>{
 const Z=H.ZONE_SHAPES,r=ZONE_R,browTop=L.eyeL[1]+0.165;
 assert.ok(Z.forehead.y-Z.forehead.ry*r>browTop,'trán không đè lông mày');
 for(const k of ['cheekL','cheekR']){const c=Z[k];assert.ok(Math.abs(c.x)-c.rx*r>0.12,'má ngoài cánh mũi');assert.ok(c.y+c.ry*r<L.eyeL[1]-L.eyeRadius,'má dưới mắt');
  assert.ok(Math.abs(c.y-L.noseTip[1])<0.08,'má ngang đầu mũi')}
 assert.ok(Z.chin.y+Z.chin.ry*r<L.mouth[1]-0.09,'cằm dưới môi dưới');assert.ok(Math.abs(Z.chin.y-L.chin[1])<0.03)});
t('3b. mỗi vùng: các đỉnh da quanh tâm vùng (mặt trước) chọn ĐÚNG vùng đó; không đỉnh nào thuộc hai vùng; không vùng nào nằm trên môi/dưới tóc',()=>{
 const P=SK.positions,N=SK.normals,W=H.computeWeights(P,N),cnt={forehead:0,cheekL:0,cheekR:0,chin:0};
 for(let i=0;i<NV;i++){const w=W.subarray(i*H.CH,i*H.CH+H.CH),z=H.zoneFromWeights(w);if(!z)continue;cnt[z]++;
  assert.ok([0,1,2,3].filter(k=>w[k]>=0.5).length===1,'chồng vùng');assert.ok(SK.lip[i]<0.3,`${z} lấn môi`);assert.ok(SK.hair[i]<0.3,`${z} dưới tóc/viền mi`)}
 for(const [k,v] of Object.entries(cnt))assert.ok(v>40,`${k}: ${v} đỉnh`);
 for(const k of H.ZONE_KEYS){const s=H.ZONE_SHAPES[k];let best=-1,bd=9;for(let i=0;i<NV;i++)if(N[i*3+2]>0.4){const d=Math.hypot(P[i*3]-s.x,P[i*3+1]-s.y);if(d<bd){bd=d;best=i}}
  assert.equal(H.zoneFromWeights(W.subarray(best*H.CH,best*H.CH+H.CH)),k)}});

// ---------- 4. Sơ đồ 2D có tóc ----------
t('4a. 2D sinh từ mô hình 0.5.1: có lớp tóc (mép chân tóc theo mặt nạ _HAIR), vùng 2D = cùng elip với 3D, tóc nằm DƯỚI các vùng chọn',()=>{
 const v=src('js/viewer2d.js');assert.match(v,/<path class="hair" d="M[^"]+Z" fill="url\(#f2dHair\)"/);
 assert.ok(v.indexOf('class="hair"')<v.indexOf('<g class="zones">'),'tóc vẽ trước vùng chọn → không chặn nhấp');
 for(const z of H.ZONE_KEYS){const s=H.ZONE_SHAPES[z],m=v.match(new RegExp(`data-z="${z}" cx="([\\d.]+)" cy="([\\d.]+)" rx="([\\d.]+)" ry="([\\d.]+)"`));
  assert.ok(m,z);assert.ok(Math.abs(+m[1]-(OX+s.x*SX))<0.2&&Math.abs(+m[2]-(OY-s.y*SX))<0.2&&Math.abs(+m[3]-s.rx*ZONE_R*SX)<0.2&&Math.abs(+m[4]-s.ry*ZONE_R*SX)<0.2,z)}
 const d=v.match(/class="hair" d="([^"]+)"/)[1],ys=[...d.matchAll(/ ([\d.]+)(?=[CZ ]|$)/g)].map(m=>+m[1]);
 const fs=H.ZONE_SHAPES.forehead;assert.ok(Math.min(...ys)<OY-0.9*SX,'tóc phủ đỉnh đầu');
 assert.ok(!/[`$]/.test(v.match(/const SVG=`([^`]*)`/)[1]),'markup hằng số')});

// ---------- 5. Vật liệu & ánh sáng ----------
const V=src('js/viewer3d.js');
t('5a. vật liệu: da nhám vừa + sheen ấm (không bóng nhựa); tóc phản xạ thấp (không lộ lọn); lông mày/mi không phản xạ gương; 0 texture',()=>{
 const mats=V.match(/export const MATS=\{([\s\S]*?)\};/)[1],num=(k,p)=>+mats.match(new RegExp(`${k}:\\{[^}]*?${p}:([\\d.]+)`))[1];
 assert.ok(num('skin','roughness')>=0.5&&num('skin','specularIntensity')<=0.5&&num('skin','sheen')<=0.5);
 assert.ok(num('hair','specularIntensity')<=0.2&&num('hair','roughness')>=0.55&&!/anisotropy/.test(mats),'tóc không bóng gắt, không dải bóng dị hướng');
 assert.match(V,/brows\.material=this\.mat\(new T\.MeshLambertMaterial\(\{vertexColors:true,side:T\.DoubleSide,transparent:true,depthWrite:false/);
 assert.ok(!/TextureLoader|new T\.(Data|Canvas)?Texture|\.map=/.test(V),'không texture');
 assert.ok(!/emissive|EffectComposer|Bloom|castShadow|shadowMap/i.test(V));
 assert.match(V,/this\.slowReported=true;this\.lite\(\);this\.onSlow/,'thiết bị chậm → chế độ nhẹ trước khi gợi ý 2D')});
t('5b. mắt: mống mắt vẽ theo điểm ảnh (sợi tỏa tia, viền limbal MỀM, đồng tử mép mềm), clearcoat = phản chiếu; tương phản dịu',()=>{
 assert.match(V,/clearcoat:1,clearcoatRoughness:0\.0\d/);assert.match(V,/const float IR=0\.\d+,PR=0\.\d+;/);
 const pupil=V.match(/iris=mix\(iris,vec3\(([\d.]+),([\d.]+),([\d.]+)\)/).slice(1).map(Number);assert.ok(Math.min(...pupil)>0.005,'đồng tử không đen tuyệt đối');
 const limb=+V.match(/iris\*=1\.0-([\d.]+)\*smoothstep\(0\.7/)[1];assert.ok(limb<=0.5,'viền limbal không gắt');
 assert.equal(V.match(/customProgramCacheKey=\(\)=>'eye-0\.5\.1'/)?.length,1)});
t('5c. ánh sáng studio dịu hơn 0.5: đèn chính thấp hơn, đèn phụ và nền mạnh hơn (bóng mềm), viền sáng tách tóc khỏi nền',()=>{
 const Lt=M.LIGHTS;assert.ok(Lt.key.intensity<3.4&&Lt.key.intensity>=2.5);assert.ok(Lt.fill.intensity>0.32&&Lt.fill.intensity<Lt.key.intensity/4);
 assert.ok(Lt.hemi.intensity>0.34&&Lt.hemi.intensity<0.62);assert.ok(Lt.rim.intensity>=1.2&&Lt.rim.intensity<Lt.key.intensity)});
t('5d. camera: khung nhìn theo mô hình mới (tâm nhìn dời ra trước, bán kính đủ cho tóc); giới hạn zoom vẫn không xuyên vào đầu; quán tính theo thời gian; chế độ nhẹ khi máy chậm',()=>{
 assert.deepEqual(M.VIEW.target,[0,-0.28,0.35]);assert.ok(M.VIEW.radius>=1.35);
 for(const a of [0.6,1,1.6,3]){const f=M.fitDistance(a),l=M.distLimits(f);assert.ok(l.min>=M.VIEW.radius*1.9&&l.min<f&&l.max>f)}
 assert.match(V,/this\.ctl\.dampingFactor=1-Math\.pow\(1-0\.085,dt\*60\/1000\)/,'quán tính theo thời gian thật (máy chậm không xoay trôi lâu)');
 assert.match(V,/this\.slowReported=true;this\.lite\(\);this\.onSlow/)});

// ---------- 6. Nguồn & giấy phép ----------
t('6. giấy phép: target MakeHuman CC0 (apply-targets từ chối target không ghi CC0), tóc/lông mày/mi tự dựng, meshopt MIT – ghi trong head.LICENSE.md',()=>{
 assert.match(src('tools/apply-targets.mjs'),/CC0/);const lic=src('assets/head.LICENSE.md');
 for(const s of ['0.5.1','head-recipe.json','build-hair.mjs','optimize-glb.mjs','meshoptimizer','MIT','CC0'])assert.ok(lic.includes(s),s);
 assert.match(J.asset.copyright,/^CC0 1\.0 – MakeHuman base mesh \+ morph targets/)});

console.log(`\n${n} kiểm thử đạt.`);
