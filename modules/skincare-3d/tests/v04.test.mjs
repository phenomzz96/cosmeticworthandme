// Chạy: node tests/v04.test.mjs — kiểm thử 0.4 cho phần không cần trình duyệt:
// hình học khuôn mặt, toán camera/cử chỉ/đo hiệu năng (view3d-math), đồng bộ bước ↔ vùng (selection),
// độ khớp 2D ↔ 3D, icon an toàn, quét tĩnh viewer3d. Phần 3D thật (WebGL) nằm trong tests/ui04.e2e.py.
//
// 0.4.1: mô hình procedural js/face3d.js (bị thay thế) → mô hình GLB assets/head.glb + js/head-model.js.
// Các bài 1a–1d, 2a–2e kiểm tra API của face3d.js (buildHead, surfaceAt, zoneContour, featureStrokes…) nên KHÔNG thể chạy
// nguyên văn. Chúng được viết lại với CÙNG MỤC ĐÍCH cho mô hình mới (giữ tên + số thứ tự, thêm dấu ′); ngưỡng không được nới.
// Bản gốc 0.4 vẫn có trong lịch sử (CHANGELOG-0.4.1.md ghi rõ đối chiếu từng bài). Các bài 3a–5c giữ NGUYÊN VĂN.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as F from '../js/head-model.js';
import {SX,OX,OY,ZONE_R} from '../tools/gen-face2d.mjs';
import * as M from '../js/view3d-math.js';
import {resolveSelection,stepsForZone,expandZones,ZONE_KEYS} from '../js/selection.js';
import {ZONES,PRODUCTS,USERS} from '../js/data.js';
import {buildRoutine} from '../js/engine.js';
import {isSafeHtml} from '../js/html.js';
import {productArt,I,SEVERITY} from '../js/icons.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const G=F.readGLB(readFileSync(new URL('../'+F.HEAD_ASSET,import.meta.url))),L=G.landmarks,SK=G.meshes.skin;
const H={positions:SK.positions,normals:SK.normals,index:SK.index,vertexCount:SK.positions.length/3};
H.zoneWeights=F.computeWeights(H.positions,H.normals);H.baseColors=F.baseColors(H.positions,H.normals);H.colors=H.baseColors.slice();
// z mặt trước của da tại (x,y): đỉnh xa nhất về phía trước trong bán kính r (chỉ đỉnh hướng ra trước)
const frontZ=(x,y,r=0.03)=>{let z=-9;for(let i=0;i<H.vertexCount;i++)if(H.normals[i*3+2]>0&&Math.hypot(H.positions[i*3]-x,H.positions[i*3+1]-y)<r)z=Math.max(z,H.positions[i*3+2]);return z};

// ---------- 1. Hình học (mô hình GLB) ----------
t("1a′. lưới đầu hợp lệ: không NaN, đủ đỉnh/tam giác, chỉ số trong phạm vi, pháp tuyến đơn vị",()=>{
 assert.ok(H.index.length/3>20000,'đủ chi tiết');
 for(const m of Object.values(G.meshes).filter(m=>!m.compressed)){for(const a of[m.positions,m.normals]) // 0.5.1: lưới tóc/lông mày đã nén → kiểm ở v051 (trình duyệt)
  assert.ok(a.every(Number.isFinite));
  assert.ok(m.index.every(i=>i<m.positions.length/3));
  for(let i=0;i<m.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(m.normals[i],m.normals[i+1],m.normals[i+2])-1)<1e-3)}
 for(const a of[H.zoneWeights,H.baseColors])assert.ok(a.every(Number.isFinite))});
t("1b′. tỷ lệ phần đầu: rộng < cao < sâu*2, đối xứng trái–phải (từng đỉnh có ảnh gương)",()=>{
 let w=0,mnz=9,mxz=-9;for(let i=0;i<H.vertexCount;i++){if(H.positions[i*3+1]<L.chin[1]-0.02)continue;w=Math.max(w,Math.abs(H.positions[i*3]));mnz=Math.min(mnz,H.positions[i*3+2]);mxz=Math.max(mxz,H.positions[i*3+2])}
 const h=L.top[1]-L.chin[1],d=mxz-mnz;w*=2;
 // 0.5.1: khuôn mặt nữ trẻ (MakeHuman) có mũi/môi nhô hơn → chiều sâu (gồm mũi) tới 1,06 × chiều cao
 assert.ok(w<h&&w<d&&d<=h*1.06&&h<d*2,`w=${w.toFixed(2)} h=${h.toFixed(2)} d=${d.toFixed(2)}`);
 const key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*500)).join(','),P=H.positions,set=new Set();
 for(let i=0;i<H.vertexCount;i++)set.add(key(P[i*3],P[i*3+1],P[i*3+2]));
 // 0.5.1: morph target MakeHuman để lại lệch trái/phải cực nhỏ (đo được tối đa ≈ 0,0003 đơn vị ≈ 0,03 mm) → so khớp cả các ô làm tròn kề bên
 const near=(x,y,z)=>{const c=[x,y,z].map(v=>Math.round(v*500));for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let d=-1;d<=1;d++)if(set.has([c[0]+a,c[1]+b,c[2]+d].join(',')))return true;return false};
 let miss=0;for(let i=0;i<H.vertexCount;i++)if(!near(-P[i*3],P[i*3+1],P[i*3+2]))miss++;assert.equal(miss,0,'đối xứng');
 assert.ok(Math.abs(L.eyeL[0]+L.eyeR[0])<1e-6&&Math.abs(L.eyeL[1]-L.eyeR[1])<1e-6)});
t("1c′. nét mặt đúng thứ tự trên → dưới; mũi nhô xa nhất; hốc mắt lõm; cằm không lẹm quá mức",()=>{
 assert.ok(L.top[1]>F.ZONE_SHAPES.forehead.y&&F.ZONE_SHAPES.forehead.y>L.eyeL[1]&&L.eyeL[1]>L.noseTip[1]&&L.noseTip[1]>L.mouth[1]&&L.mouth[1]>L.chin[1]);
 let maxz=-9,at=null;for(let i=0;i<H.vertexCount;i++)if(H.positions[i*3+2]>maxz){maxz=H.positions[i*3+2];at=[H.positions[i*3],H.positions[i*3+1]]}
 assert.ok(Math.abs(at[0])<0.02&&at[1]<-0.15&&at[1]>-0.45,'đầu mũi');
 const brow=frontZ(L.eyeL[0],L.eyeL[1]+L.eyeRadius*1.4),cheek=frontZ(F.ZONE_SHAPES.cheekL.x,F.ZONE_SHAPES.cheekL.y);
 assert.ok(L.eyeL[2]+L.eyeRadius<brow-0.02,'nhãn cầu nằm sau gò mày (hốc mắt lõm)');assert.ok(frontZ(L.eyeL[0],L.eyeL[1])<cheek,'hốc mắt');
 assert.ok(frontZ(0,L.chin[1])>frontZ(0,F.ZONE_SHAPES.forehead.y)-0.25,'cằm')});
t("1d′. bề mặt kín và đúng hướng: mỗi cạnh dùng bởi đúng 2 tam giác, không trùng cạnh có hướng, không tam giác suy biến, pháp tuyến hướng ra ngoài",()=>{
 const ids=new Map(),dir=new Set(),use=new Map();let vol=0,deg=0,flip=0;
 const id=(p,i)=>{const k=[p[i*3],p[i*3+1],p[i*3+2]].map(v=>Math.round(v*1e4)).join(',');if(!ids.has(k))ids.set(k,ids.size);return ids.get(k)};
 for(const m of[G.meshes.skin,G.meshes.cap]){const p=m.positions,nn=m.normals,ix=m.index;
  for(let k=0;k<ix.length;k+=3){const v=[ix[k],ix[k+1],ix[k+2]],w=v.map(i=>id(p,i));if(new Set(w).size<3){deg++;continue}
   for(let e=0;e<3;e++){const a=w[e],b=w[(e+1)%3],dk=a+'>'+b,uk=a<b?a+'_'+b:b+'_'+a;assert.ok(!dir.has(dk),'cạnh có hướng bị lặp (mặt ngược chiều)');dir.add(dk);use.set(uk,(use.get(uk)||0)+1)}
   const [A,B,C]=v.map(i=>[p[i*3],p[i*3+1],p[i*3+2]]),u=B.map((x,j)=>x-A[j]),q=C.map((x,j)=>x-A[j]),fn=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]];
   vol+=(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6;
   if(v.reduce((s,i)=>s+fn[0]*nn[i*3]+fn[1]*nn[i*3+1]+fn[2]*nn[i*3+2],0)<=0)flip++}}
 assert.equal(deg,0);assert.equal(flip,0,'pháp tuyến đỉnh ngược pháp tuyến mặt');assert.ok([...use.values()].every(c=>c===2),'có lỗ hở');assert.ok(vol>0,'mặt hướng vào trong')});

// ---------- 2. Vùng da ----------
t("2a′. quy ước: má trái của người = +x (phải màn hình), khớp ZONES và 3 nơi dùng",()=>{
 assert.deepEqual(F.ZONE_KEYS,Object.keys(ZONES));assert.deepEqual(ZONE_KEYS,Object.keys(ZONES));
 const c=z=>F.zoneAnchor(H.positions,H.normals,z);
 assert.ok(c('cheekL')[0]>0.2&&c('cheekR')[0]<-0.2);
 assert.ok(c('forehead')[1]>L.eyeL[1]+L.eyeRadius*1.5,'trán trên lông mày');assert.ok(c('chin')[1]<L.mouth[1],'cằm dưới môi')});
t("2b′. các vùng không chồng nhau, chỉ ở mặt trước; vùng nằm trong phạm vi \"toàn mặt\"",()=>{
 let over=0,back=0,outFace=0;const cnt=[0,0,0,0];
 for(let i=0;i<H.vertexCount;i++){const o=i*F.CH,ws=[0,1,2,3].map(k=>H.zoneWeights[o+k]);ws.forEach((w,k)=>{if(w>0.5)cnt[k]++});
  if(ws.filter(w=>w>0.5).length>1)over++;if(H.positions[i*3+2]<0&&ws.some(w=>w>0))back++;if(ws.some(w=>w>0.5)&&H.zoneWeights[o+4]<0.5)outFace++}
 assert.equal(over,0);assert.equal(back,0);assert.equal(outFace,0);assert.ok(cnt.every(c=>c>=40),'mỗi vùng đủ lớn: '+cnt)});
t("2c′. chọn vùng: ngưỡng 0.5, mũi/mắt không thuộc vùng nào",()=>{
 const w=new Float32Array(F.CH);
 for(const z of F.ZONE_KEYS){const s=F.ZONE_SHAPES[z];F.zoneWeights(s.x,s.y,0.9,w);assert.equal(F.zoneFromWeights(w),z);assert.equal(F.zoneAt(s.x,s.y,0.9),z)}
 assert.equal(F.zoneAt(L.noseTip[0],L.noseTip[1],0.95),null,'mũi');assert.equal(F.zoneAt(L.eyeL[0],L.eyeL[1],0.92),null,'mắt');
 assert.equal(F.zoneAt(0,L.mouth[1],0.95),null,'môi');assert.equal(F.zoneAt(0,0.41,-1),null,'sau đầu')});
t("2d′. highlight trên bề mặt: chỉ đổi màu vùng được chọn; toàn mặt phủ nhẹ; giá trị trong [0,1]",()=>{
 const out=new Float32Array(H.baseColors.length),k=F.ZONE_KEYS.indexOf('forehead'),Z=[0,0,0,0,0];
 F.applyHighlight(H.baseColors,H.zoneWeights,out,{on:Z,hover:[0,0,0,0]});
 assert.ok(out.every((v,i)=>Math.abs(v-H.baseColors[i])<1e-6),'không chọn → giữ màu da');
 F.applyHighlight(H.baseColors,H.zoneWeights,out,{on:F.zonesToTargets(['forehead']),hover:[0,0,0,0]});
 let inZ=0,other=0;for(let i=0;i<H.vertexCount;i++){const d=Math.abs(out[i*3+1]-H.baseColors[i*3+1]);const w=H.zoneWeights[i*F.CH+k];if(w>0.9&&d>0.02)inZ++;if(w===0&&d>1e-6)other++}
 assert.ok(inZ>50);assert.equal(other,0);assert.ok(out.every(v=>v>=0&&v<=1));
 F.applyHighlight(H.baseColors,H.zoneWeights,out,{on:F.zonesToTargets(['face']),hover:[0,0,0,0]});
 let fc=0;for(let i=0;i<H.vertexCount;i++){if(H.zoneWeights[i*F.CH+4]>0.9&&Math.abs(out[i*3+1]-H.baseColors[i*3+1])>0.005)fc++}assert.ok(fc>500,'toàn mặt phủ nhẹ');
 assert.deepEqual(F.zonesToTargets(['face']),[1,1,1,1,1]);assert.deepEqual(F.zonesToTargets(['cheekL','x']),[0,1,0,0,0])});
t("2e′. 2D sinh từ 3D: tâm/bán kính vùng trên SVG khớp phép chiếu 3D (sai số ≤ 4 px), má trái ở bên phải",()=>{
 const svg=src('js/viewer2d.js');
 for(const z of F.ZONE_KEYS){
  const m=svg.match(new RegExp(`data-z="${z}" cx="([\\d.]+)" cy="([\\d.]+)" rx="([\\d.]+)" ry="([\\d.]+)"`)),[cx,cy,rx,ry]=m.slice(1).map(Number),s=F.ZONE_SHAPES[z];
  const a=F.zoneAnchor(H.positions,H.normals,z),ex=OX+SX*a[0],ey=OY-SX*a[1];
  assert.ok(Math.hypot(cx-ex,cy-ey)<=4,`${z}: svg(${cx},${cy}) vs 3D(${ex.toFixed(1)},${ey.toFixed(1)})`);
  assert.ok(Math.abs(rx-s.rx*ZONE_R*SX)<0.1&&Math.abs(ry-s.ry*ZONE_R*SX)<0.1,'bán kính = biên trọng số 0.5');
  if(z==='cheekL')assert.ok(cx>OX);if(z==='cheekR')assert.ok(cx<OX)}
 assert.ok(!/\$\{/.test(svg.match(/const SVG=`([\s\S]*?)`/)[1])&&!/\son\w+=/i.test(svg.match(/const SVG=`([\s\S]*?)`/)[1]))});

// ---------- 3. Camera, cử chỉ, hiệu năng ----------
t('3a. camera: vừa khung theo tỷ lệ màn hình, giới hạn zoom không vào trong mô hình, góc sẵn trong giới hạn',()=>{
 const wide=M.fitDistance(1.6),sq=M.fitDistance(1),tall=M.fitDistance(0.6);assert.ok(wide<=sq+1e-9&&sq<tall);
 for(const f of[wide,tall]){const l=M.distLimits(f);assert.ok(l.min>M.VIEW.radius*1.8&&l.min<f&&l.max>f)}
 for(const p of Object.values(M.PRESETS)){assert.ok(p.az>=M.LIMITS.minAz&&p.az<=M.LIMITS.maxAz&&p.polar>=M.LIMITS.minPolar&&p.polar<=M.LIMITS.maxPolar)}
 assert.ok(M.PRESETS.left.az>0&&M.PRESETS.right.az<0,'má trái = camera về phía +x');
 assert.ok(Number.isFinite(M.fitDistance(NaN))&&Number.isFinite(M.fitDistance(0)))});
t('3b. tween camera: đầu/cuối đúng, mượt, thời lượng 0 = tức thì (giảm chuyển động)',()=>{
 const tw=M.makeTween({az:0,polar:1.5,dist:5},{az:1,polar:1.4,dist:4},600,1000);
 assert.deepEqual(M.sampleTween(tw,1000),{az:0,polar:1.5,dist:5,done:false});
 const mid=M.sampleTween(tw,1300);assert.ok(mid.az>0.4&&mid.az<0.6);
 assert.deepEqual(M.sampleTween(tw,1600),{az:1,polar:1.4,dist:4,done:true});
 assert.equal(M.tweenDuration(true),0);assert.equal(M.sampleTween(M.makeTween({az:0,polar:1,dist:5},{az:1,polar:1,dist:5},0,0),0).done,true);
 for(let i=0;i<=10;i++){const e=M.easeInOutCubic(i/10);assert.ok(e>=0&&e<=1)}});
t('3c. phân biệt nhấp/chạm với kéo/vuốt/chụm',()=>{
 const g=new M.GestureTracker();
 g.down(1,100,100,'mouse',0);g.move(1,103,101);assert.equal(g.up(1,103,101,200),'tap');
 g.down(1,100,100,'mouse',0);g.move(1,160,100);assert.equal(g.up(1,100,100,300),'drag','kéo rồi quay về chỗ cũ vẫn là kéo');
 g.down(2,50,50,'touch',0);g.move(2,58,52);assert.equal(g.up(2,58,52,150),'tap','chạm (rung nhẹ ≤ 10px)');
 g.down(2,50,50,'touch',0);g.move(2,90,50);assert.equal(g.up(2,90,50,150),'drag','vuốt');
 g.down(2,50,50,'touch',0);assert.equal(g.up(2,50,50,1500),'drag','giữ lâu không phải chạm chọn');
 g.down(3,10,10,'touch',0);g.down(4,200,10,'touch',10);assert.equal(g.up(3,10,10,100),'multi');assert.equal(g.up(4,200,10,120),'multi','chụm hai ngón không chọn vùng');
 g.down(5,0,0,'touch',0);g.cancel(5);assert.equal(g.up(5,0,0,10),null);assert.equal(g.active,0)});
t('3d. đo hiệu năng: không kết luận từ một đợt đo; ≥ 3 cửa sổ chậm trong ≥ 2 đợt mới gợi ý',()=>{
 const run=(m,ms,fps,from=0)=>{let t=from;for(;t<=from+ms;t+=1000/fps)m.frame(t);return t};
 const a=new M.PerfMeter();run(a,5200,8);assert.equal(a.slow,false,'một animation dài chậm: chưa kết luận');assert.ok(a.fps<10);
 a.idle();run(a,1100,8,20000);assert.equal(a.slow,true,'đợt thứ hai cũng chậm → gợi ý');
 const b=new M.PerfMeter();run(b,3200,60);b.idle();run(b,3200,60,9000);assert.equal(b.slow,false);assert.ok(b.fps>55);
 const c=new M.PerfMeter();run(c,2100,8);c.idle();run(c,1100,60,9000);c.idle();run(c,1100,8,20000);assert.equal(c.slow,false,'cửa sổ nhanh xen giữa → đặt lại')});

// ---------- 4. Đồng bộ bước ↔ vùng ----------
const user=id=>USERS.find(u=>u.id===id);
const res=(sel,goals)=>buildRoutine({quiz:{goals,skin:null},catalog:PRODUCTS,selection:sel,owned:user('A').purchased});
t('4a. chọn bước toàn mặt → phủ toàn mặt + 4 vùng; bước có vùng riêng → đúng các vùng khai báo',()=>{
 const r=res([...user('A').purchased,'p07'],['acne','hydrate']),treat=r.steps.find(s=>s.id==='pm:treat');
 assert.deepEqual(treat.zones.slice().sort(),['chin','forehead']);
 const s1=resolveSelection(r,{step:'pm:treat'});assert.deepEqual(s1.highlight.slice().sort(),['chin','forehead']);assert.equal(s1.fullFace,false);assert.equal(s1.step.id,'pm:treat');
 const s2=resolveSelection(r,{step:'am:cleanse'});assert.deepEqual(s2.highlight,['face',...ZONE_KEYS]);assert.equal(s2.fullFace,true);assert.equal(s2.zone,null)});
t('4b. chọn vùng → các bước có khai báo vùng đó hoặc toàn mặt; vùng lạ bị bỏ qua',()=>{
 const r=res([...user('A').purchased,'p07'],['acne','hydrate']);
 const s=resolveSelection(r,{zone:'chin'});assert.equal(s.zone,'chin');assert.deepEqual(s.highlight,['chin']);
 assert.ok(s.related.some(x=>x.id==='pm:treat')&&s.related.some(x=>x.id==='am:cleanse'));
 const ch=resolveSelection(r,{zone:'cheekL'});assert.ok(!ch.related.some(x=>x.id==='pm:treat'),'BHA không khai báo má');
 assert.deepEqual(resolveSelection(r,{zone:'<img>'}).highlight,[]);assert.deepEqual(stepsForZone(r,'x'),[])});
t('4c. thay sản phẩm → vùng của bước cập nhật; bỏ sản phẩm → bước đang chọn bị bỏ chọn (dropped)',()=>{
 const A=user('A').purchased,r1=res([...A,'p07'],['acne']);assert.deepEqual(resolveSelection(r1,{step:'pm:treat'}).highlight.slice().sort(),['chin','forehead']);
 const r2=res([...A,'p06'],['acne']);const s2=resolveSelection(r2,{step:'pm:treat'});assert.deepEqual(s2.highlight.slice().sort(),['cheekL','cheekR','forehead']);assert.equal(s2.step.products[0].id,'p06');
 const r3=res(A,['acne']),s3=resolveSelection(r3,{step:'pm:treat'});assert.equal(s3.dropped,true);assert.equal(s3.step,null);assert.deepEqual(s3.highlight,[])});
t('4d. bước không có dữ liệu vùng → không highlight, không suy đoán',()=>{
 const fake={steps:[{id:'am:x',period:'am',zones:[],products:[]},{id:'pm:y',period:'pm',zones:['face'],products:[]}]};
 const s=resolveSelection(fake,{step:'am:x'});assert.equal(s.noZoneData,true);assert.deepEqual(s.highlight,[]);
 assert.deepEqual(resolveSelection(fake,{zone:'forehead'}).relatedIds,['pm:y']);
 assert.deepEqual(expandZones(['face','x']),ZONE_KEYS);assert.deepEqual(resolveSelection(null,{}).highlight,[])});

// ---------- 5. An toàn & tài nguyên (tĩnh) ----------
t('5a. icon/hình minh họa là SafeHtml hằng số, không có thuộc tính on*',()=>{
 for(const c of[...Object.keys({cleanser:1,toner:1,serum:1,treatment:1,moisturizer:1,sunscreen:1}),null,'<x>']){const a=productArt(c);assert.ok(isSafeHtml(a));assert.ok(!/\son\w+=/i.test(String(a)))}
 for(const v of Object.values(I))assert.ok(isSafeHtml(v)&&!/\son\w+=/i.test(String(v)));
 for(const s of Object.values(SEVERITY))assert.ok(s.label&&s.icon,'cảnh báo luôn có nhãn chữ + icon')});
t('5b. viewer3d: dispose giải phóng đủ loại tài nguyên; tải Three.js động; không vòng lặp liên tục',()=>{
 const s=src('js/viewer3d.js');
 for(const k of['g.dispose()','m.dispose()','renderer.dispose()','forceContextLoss()','ro?.disconnect()','ctl?.dispose()','cancelAnimationFrame(this.raf)','domElement.remove()'])assert.ok(s.includes(k),k);
 assert.ok(/import\('three'\)/.test(s)&&!/^import .* from 'three'/m.test(s),'Three.js chỉ import động');
 assert.ok(/visibilitychange/.test(s)&&/prefers-reduced-motion/.test(s)&&/webglcontextlost/.test(s));
 assert.ok(/if\(this\.raf==null\)this\.raf=requestAnimationFrame/.test(s),'tối đa một rAF đang chờ');
 assert.ok(/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,2\)\)/.test(s),'giới hạn pixel ratio')});
t('5c. index.html: Three.js vẫn 0.160.0 từ jsDelivr; không script ngoài khác',()=>{
 const h=src('index.html');assert.equal((h.match(/three@0\.160\.0/g)||[]).length,2);
 assert.equal((h.match(/<script/g)||[]).length,2);assert.ok(/<script type="module" src="js\/main.js">/.test(h))});
console.log(`\n${n} kiểm thử đạt.`);
