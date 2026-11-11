// Viewer3D 0.5.1 – nhân vật bán thân stylized-realistic nạp từ assets/head.glb (MakeHuman hm08 + target CC0, tóc/lông mày/mi tự dựng; tóc nén meshopt) bằng Three.js 0.160.0.
// • Three.js + GLTFLoader chỉ được tải (import động) khi mở chế độ 3D; tải lỗi/không có WebGL/thiếu file mô hình → ném lỗi để UI chuyển 2D.
// • Vùng da tô TRÊN bề mặt bằng màu đỉnh (một hiệu ứng nhẹ, mép mềm); không có viền hay gợi ý khi chưa chọn.
// • Chọn vùng = raycast vào chính lưới da → điểm chạm + pháp tuyến → vùng (head-model.js).
// • Phân biệt nhấp/chạm (chọn vùng) với kéo/vuốt/chụm (xoay, zoom) bằng GestureTracker.
// • Render THEO NHU CẦU; dừng khi tab ẩn hoặc khi chuyển 2D; tối đa một vòng rAF; dispose() giải phóng đầy đủ, init() lại được.
// Giao diện giữ tương thích 0.4: init/start/stop/resize/highlight/view/resetView/zoom/invalidate/projectZone/debugInfo/dispose.
import * as H from './head-model.js';
import {VIEW,LIGHTS,LIMITS,PRESETS,ENV,studioEnvPixels,fitDistance,distLimits,clamp,makeTween,sampleTween,tweenDuration,GestureTracker,PerfMeter} from './view3d-math.js';

let threeP=null;
function loadThree(){
 if(!threeP)threeP=Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]).catch(e=>{
  threeP=null;
  const m=String(e?.message||e);
  throw new Error(/import|fetch|module|load/i.test(m)?`không tải được thư viện 3D (Three.js) – cần kết nối Internet tới cdn.jsdelivr.net (${m})`:m);
 });
 return threeP;
}
function webglAvailable(){
 try{const c=document.createElement('canvas'),gl=c.getContext('webgl2')||c.getContext('webgl');
  if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true}catch{return false}
}

// 0.5.1 – thông số vật liệu (gom một chỗ để chỉnh/so sánh)
export const MATS={
 skin:{roughness:0.56,specularIntensity:0.42,sheen:0.4,sheenRoughness:0.5,sheenColor:0xffd2c2},
 hair:{color:0x9a908a,roughness:0.66,specularIntensity:0.12,sheen:0.5,sheenRoughness:0.5,sheenColor:0x5c3f2e},
 hairShell:{roughness:0.42,specularIntensity:0.45,anisotropy:0.75,anisotropyRotation:0,sheen:0.25,sheenRoughness:0.6,sheenColor:0x6b4a35}, // rotation 0 = dải sáng NGANG thớ (đã so A/B với π/2)
 fringe:{color:0x9a908a,roughness:0.75,specularIntensity:0.1},
 brows:{color:0xa39a92}};
// (color = hệ số nhân với màu đỉnh của lưới tóc; sRGB)
// 0.5.2: mống mắt dùng texture bake từ Blender (tools/blender/build-eyes.py, cùng công thức trước đây viết tay bằng GLSL),
// gắn sẵn trong GLB (baseColorTexture + KHR_materials_clearcoat → GLTFLoader tự dựng MeshPhysicalMaterial).
// Mã dưới đây chỉ bật vertexColors trên material đã nạp để nhân AO theo đỉnh (mép mí/góc mắt tối nhẹ), không tạo lại vật liệu.
export class Viewer3D{
 constructor(){this.ready=false;this.initCount=0;this.raf=null;this.paused=true;this.frameCount=0;this.zs=[];this.hoverZone=null;this.meter=new PerfMeter();this.slowReported=false}
 get r(){return this.ready?this.renderer:null} // tương thích main.js 0.3.1 (v3.r)

 async init(el,{onPick,onError,failFlag=()=>false,onHover,onSlow}={}){
  if(failFlag())throw new Error('lỗi 3D giả lập ở bước khởi tạo');
  Object.assign(this,{onPick,onError,failFlag,onHover,onSlow});
  if(this.ready){this.start();return}
  if(!this.initP)this.initP=this._init(el).finally(()=>{this.initP=null}); // bấm "3D" nhiều lần → dùng chung một lần khởi tạo
  return this.initP;
 }
 async _init(el){
  try{
   const [T,{OrbitControls},{GLTFLoader},{MeshoptDecoder}]=await loadThree(); // 0.5.1: tóc/lông mày/mi trong GLB được nén meshopt
   if(this.ready)return;
   if(this.failFlag())throw new Error('lỗi 3D giả lập ở bước khởi tạo');
   if(!webglAvailable())throw new Error('trình duyệt hoặc thiết bị không hỗ trợ WebGL');
   this.T=T;this.el=el;this.geos=new Set;this.mats=new Set;this.off=[];
   let renderer;
   try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'})}
   catch(e){throw new Error('không khởi tạo được WebGL renderer: '+(e?.message||e))}
   this.renderer=renderer;
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
   renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=LIGHTS.exposure;
   const cv=renderer.domElement;cv.className='gl';cv.setAttribute('aria-label','Mô hình khuôn mặt 3D: kéo để xoay, cuộn hoặc chụm để phóng to, nhấp hoặc chạm để chọn vùng');cv.setAttribute('role','img');
   el.appendChild(cv);
   const scene=this.scene=new T.Scene();
   const cam=this.cam=new T.PerspectiveCamera(VIEW.fov,1,0.05,60);scene.add(cam);
   this.target=new T.Vector3(...VIEW.target);
   // Ánh sáng studio nhẹ: bán cầu dịu làm nền, đèn chính mềm phía trên-trái + đèn phụ (đi theo camera → mặt luôn rõ ở mọi góc),
   // đèn viền phía sau tách khối khỏi nền. Không bóng đổ, không hậu xử lý.
   const L=LIGHTS,hemi=new T.HemisphereLight(L.hemi.sky,L.hemi.ground,L.hemi.intensity);scene.add(hemi);
   const key=new T.DirectionalLight(L.key.color,L.key.intensity);key.position.set(...L.key.pos);cam.add(key);
   const fill=new T.DirectionalLight(L.fill.color,L.fill.intensity);fill.position.set(...L.fill.pos);cam.add(fill);
   const rim=new T.DirectionalLight(L.rim.color,L.rim.intensity);rim.position.set(...L.rim.pos);scene.add(rim);
   // 0.5.2 – môi trường studio (IBL): equirect sinh bằng công thức → PMREM. Nền trang vẫn trong suốt (không đặt scene.background).
   {const tex=new T.DataTexture(studioEnvPixels(ENV.w,ENV.h),ENV.w,ENV.h,T.RGBAFormat,T.FloatType);
    tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.LinearSRGBColorSpace;tex.needsUpdate=true;
    const pm=new T.PMREMGenerator(renderer);
    this.envRT=pm.fromEquirectangular(tex);scene.environment=this.envRT.texture;
    tex.dispose();pm.dispose()}
   // Mô hình: nạp GLB (cùng thư mục với trang). Lỗi tải/giải mã → ném lỗi rõ ràng → UI chuyển 2D.
   let gltf;
   try{gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('../'+H.HEAD_ASSET,import.meta.url).href)}
   catch(e){throw new Error(`không tải được mô hình 3D (${H.HEAD_ASSET}): ${e?.message||e}`)}
   if(!this.renderer)return; // đã dispose trong lúc chờ
   const root=this.root=gltf.scene;scene.add(root);
   const byName=n=>root.getObjectByName(n);
   const skinMesh=byName('skin'),eyes=byName('eyes'),cap=byName('cap');
   if(!skinMesh?.isMesh)throw new Error('mô hình 3D thiếu phần "skin"');
   root.traverse(o=>{if(o.isMesh){this.geo(o.geometry);if(o.material)this.mat(o.material)}});
   const g=skinMesh.geometry,pos=g.attributes.position.array,nor=g.attributes.normal.array;
   const lipA=g.getAttribute('_lip')?.array??null,lipSoft=lipA&&g.index?H.smoothAttr(lipA,g.index.array,2):lipA; // 0.5.2: mép môi mềm (chỉ cho màu)
   const base=H.baseColors(pos,nor,g.getAttribute('_ao')?.array??null,g.getAttribute('_hair')?.array??null,lipSoft); // 0.5: AO đã bake; 0.5.1: da đầu dưới tóc, mặt nạ môi
   this.headData={positions:pos,normals:nor,baseColors:base,zoneWeights:H.computeWeights(pos,nor),colors:new Float32Array(base),
    exclude:H.highlightExclusion(g.getAttribute('_lip')?.array??null,g.getAttribute('_hair')?.array??null,pos.length/3)}; // môi + da dưới tóc: không tô
   this.colorAttr=new T.BufferAttribute(this.headData.colors,3);this.colorAttr.setUsage(T.DynamicDrawUsage);g.setAttribute('color',this.colorAttr);
   // 0.5.2 – da = Physical + sheen ấm, nay thêm map/roughnessMap bake từ Blender (biến thiên sắc độ và độ bóng theo vùng
   // mặt). QUAN TRỌNG: màu đỉnh VẪN là kênh tô vùng tương tác (applyHighlight);
   // texture chỉ NHÂN thêm nên việc chọn vùng không đổi hành vi.
   const M=MATS,col=c=>new T.Color(c),gm=skinMesh.material;
   const skin=this.mat(new T.MeshPhysicalMaterial({vertexColors:true,metalness:0,envMapIntensity:ENV.intensity.skin,
    map:gm?.map??null,roughnessMap:gm?.roughnessMap??null,...M.skin,sheenColor:new T.Color(M.skin.sheenColor)}));
   // Dưới tóc: tắt sheen + giảm phản xạ của da (da đầu nhìn qua khe giữa các lọn ở góc sượt không lóe sáng thành vệt)
   {const hm=g.getAttribute('_hair')?.array,k=new Float32Array(pos.length/3).fill(1);if(hm)for(let i=0;i<k.length;i++)k[i]=1-Math.min(1,Math.max(0,hm[i]*1.6-0.6));
    g.setAttribute('sheenK',new T.BufferAttribute(k,1));
    // (0.5.2: đã bỏ "hạt da" tính bằng sóng sin trong shader — tần số cao hơn điểm ảnh ở khoảng nhìn thường nên
    // bị răng cưa thành vệt sọc chéo ở má/hàm/cổ; tắt riêng nó thì vệt biến mất hoàn toàn.)
    skin.onBeforeCompile=sh=>{
     sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float sheenK;varying float vSheenK;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSheenK=sheenK;');
     sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSheenK;')
      .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor*=mix(0.15,1.0,vSheenK);material.specularF90*=mix(0.15,1.0,vSheenK);\n#ifdef USE_SHEEN\nmaterial.sheenColor*=vSheenK;\n#endif')};
    skin.customProgramCacheKey=()=>'skin-0.5.2b'}
   skinMesh.material=skin;this.head=skinMesh;
   // Nắp đáy tượng: màu phẳng gần màu vai đã chiếu sáng. Chỉ thấy khi nhìn từ dưới; màu phẳng cũng tránh các chấm tối
   // khi trình rasterize (đã thấy với SwiftShader + MSAA) để lọt một mẫu ở mép tam giác của da phía trước nắp.
   if(cap?.isMesh)cap.material=this.mat(new T.MeshBasicMaterial({color:new T.Color().setRGB(0.80,0.72,0.66,T.SRGBColorSpace),toneMapped:false}));
   if(eyes?.isMesh){ // 0.5.2: giữ material do GLTFLoader dựng từ texture mống mắt; chỉ bật vertexColors để nhân AO
    eyes.geometry.setAttribute('color',new T.BufferAttribute(H.eyeShade(eyes.geometry.attributes.position.count,eyes.geometry.getAttribute('_ao')?.array??null),3));
    const em=eyes.material;em.vertexColors=true;em.envMapIntensity=ENV.intensity.eye;em.needsUpdate=true;this.mat(em)}
   // 0.5.2 tóc: "hair" = vỏ tóc chính (lưới liền, UV theo hướng chải, texture sợi WebP từ Blender).
   // Dải sáng dị hướng chạy NGANG thớ tóc thay cho việc tăng ánh sáng môi trường; màu đỉnh chỉ mang AO.
   const hair=byName('hair'),fringe=byName('hairline'),brows=byName('brows'),bun=byName('hairbun');
   let shellMat=null;
   if(hair?.isMesh){const S=M.hairShell,map=hair.material?.map??null;
    if(map)map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); // lọc dị hướng: sợi tóc rõ ở góc sượt
    shellMat=hair.material=this.mat(new T.MeshPhysicalMaterial({map,vertexColors:true,metalness:0,envMapIntensity:ENV.intensity.hair,
     roughness:S.roughness,specularIntensity:S.specularIntensity,anisotropy:S.anisotropy,anisotropyRotation:S.anisotropyRotation,
     sheen:S.sheen,sheenRoughness:S.sheenRoughness,sheenColor:col(S.sheenColor)}));
    // Chân tóc mềm: alpha đỉnh = dải mép (0 ở chân tóc → 1 trong tóc), alpha texture = ngưỡng riêng từng sợi.
    // Cắt bỏ (discard) theo từng sợi → mép thành các ngọn tóc dài ngắn khác nhau trên nền da đầu sẫm thay cho
    // đường cắt cứng. Vẫn là vật liệu ĐỤC: alpha xuất luôn = 1 (canvas trong suốt, không trộn/sắp xếp).
    {const g=hair.geometry,e=g.getAttribute('_edge');
     g.setAttribute('hairEdge',e??new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1),1))}
    shellMat.onBeforeCompile=sh=>{
     sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float hairEdge;varying float vHairEdge;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHairEdge=hairEdge;');
     sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vHairEdge;').replace('#include <color_fragment>',`#include <color_fragment>
     {
     #ifdef USE_MAP
      float hs=sampledDiffuseColor.a;
     #else
      float hs=0.5;
     #endif
      if(smoothstep(hs*0.6,hs*0.6+0.3,vHairEdge)<0.5)discard;}
     diffuseColor.a=1.0;`)};
    shellMat.customProgramCacheKey=()=>'hair-0.5.2-edge'}
   // Búi thấp (checkpoint 2): một lưới cuộn liền dựng trong Blender, UV theo chiều cuộn; dùng CHUNG vật liệu
   // và texture với vỏ tóc → cùng màu, cùng dải sáng, không thêm vật liệu.
   if(bun?.isMesh&&shellMat){bun.material=shellMat; // búi không có dải mép: hairEdge = 1 (không bao giờ bị cắt)
    bun.geometry.setAttribute('hairEdge',new T.BufferAttribute(new Float32Array(bun.geometry.attributes.position.count).fill(1),1))}
   if(fringe?.isMesh)fringe.material=this.mat(new T.MeshPhysicalMaterial({vertexColors:true,metalness:0,transparent:true,depthWrite:false,envMapIntensity:ENV.intensity.hair,...M.fringe,color:col(M.fringe.color)}));
   // Lông mày + lông mi: Lambert (không phản xạ gương) – sợi mảnh nhìn ở góc sượt sẽ không bị viền sáng trắng do Fresnel
   if(brows?.isMesh)brows.material=this.mat(new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,depthWrite:false,color:col(M.brows.color)}));
   // Điều khiển camera
   const ctl=this.ctl=new OrbitControls(cam,cv);
   Object.assign(ctl,{enableDamping:true,dampingFactor:0.085,enablePan:false,rotateSpeed:0.7,zoomSpeed:0.7,
    minAzimuthAngle:LIMITS.minAz,maxAzimuthAngle:LIMITS.maxAz,minPolarAngle:LIMITS.minPolar,maxPolarAngle:LIMITS.maxPolar});
   ctl.target.copy(this.target);
   const onChange=()=>this.invalidate(),onStart=()=>{this.tween=null};
   ctl.addEventListener('change',onChange);ctl.addEventListener('start',onStart);
   this.off.push(()=>{ctl.removeEventListener('change',onChange);ctl.removeEventListener('start',onStart)});
   // Cử chỉ: nhấp/chạm = chọn vùng; kéo/vuốt/chụm = điều khiển camera (OrbitControls tự xử lý).
   this.gest=new GestureTracker();this.ray=new T.Raycaster();this.ndc=new T.Vector2();
   const on=(t,ev,fn,opt)=>{t.addEventListener(ev,fn,opt);this.off.push(()=>t.removeEventListener(ev,fn,opt))};
   on(cv,'pointerdown',e=>this.gest.down(e.pointerId,e.clientX,e.clientY,e.pointerType,e.timeStamp));
   on(cv,'pointermove',e=>{this.gest.move(e.pointerId,e.clientX,e.clientY);if(e.pointerType==='mouse'&&!e.buttons)this.queueHover(e.clientX,e.clientY)});
   on(cv,'pointerup',e=>{if(this.gest.up(e.pointerId,e.clientX,e.clientY,e.timeStamp)==='tap'){const z=this.zoneAt(e.clientX,e.clientY);if(z)this.onPick?.(z)}});
   on(cv,'pointercancel',e=>this.gest.cancel(e.pointerId));
   on(cv,'pointerleave',e=>{if(e.pointerType==='mouse')this.setHover(null)});
   on(cv,'webglcontextlost',e=>{e.preventDefault();this.fail(new Error('mất ngữ cảnh WebGL (GPU bị đặt lại hoặc quá tải)'))});
   on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'){if(this.raf!=null){cancelAnimationFrame(this.raf);this.raf=null}this.meter.idle()}else this.invalidate()});
   const mq=window.matchMedia?.('(prefers-reduced-motion: reduce)');this.reduced=!!mq?.matches;
   if(mq?.addEventListener)on(mq,'change',e=>{this.reduced=e.matches});
   this.ro=new ResizeObserver(()=>this.resize());this.ro.observe(el);
   // Trạng thái highlight (nội suy mượt tới mục tiêu)
   this.hl={on:[0,0,0,0,0],hover:[0,0,0,0]};this.hlT={on:[0,0,0,0,0],hover:[0,0,0,0]};this.hlDirty=true;
   this.ready=true;this.initCount++;this.paused=false;this.fit=null;
   this.resize();this.setCam({az:PRESETS.front.az,polar:PRESETS.front.polar,dist:this.fit});
   this.highlight(this.zs);this.invalidate();
  }catch(e){this.dispose();throw e}
 }
 geo(g){this.geos.add(g);return g}
 mat(m){this.mats.add(m);return m}

 // ---- Vòng render theo nhu cầu ----
 invalidate(){if(!this.ready||this.paused||document.visibilityState==='hidden')return;if(this.raf==null)this.raf=requestAnimationFrame(this.frame)}
 frame=t=>{
  this.raf=null;if(!this.ready||this.paused)return;
  try{
   if(this.failFlag())throw new Error('lỗi 3D giả lập khi đang chạy');
   let more=false;
   if(this.tween){const s=sampleTween(this.tween,t);this.setCam(s);if(s.done)this.tween=null;else more=true}
   // 0.5.1: quán tính theo THỜI GIAN thật (không theo số khung): máy chậm vẫn dừng xoay sau cùng khoảng thời gian như máy nhanh;
   // tổng góc xoay không đổi (chuỗi cấp số nhân của OrbitControls), chỉ đổi số bước.
   const dt=this.lastT!=null?Math.min(250,Math.max(1,t-this.lastT)):1000/60;this.lastT=t;
   this.ctl.dampingFactor=1-Math.pow(1-0.085,dt*60/1000);
   if(this.ctl.update())more=true;
   if(this.stepHighlight())more=true;
   this.renderer.render(this.scene,this.cam);this.frameCount++;
   if(this.meter.frame(t)&&!this.slowReported){this.slowReported=true;this.lite();this.onSlow?.(this.meter.fps)}
   if(more)this.invalidate();else{this.meter.idle();this.lastT=null}
  }catch(e){this.fail(e)}
 };
 // 0.5.1: thiết bị chậm (PerfMeter) → giảm chi phí vẽ mà không đổi hình dáng: mật độ điểm ảnh về 1 (màn hình mật độ cao), trước khi gợi ý 2D
 lite(){if(!this.ready||this.isLite)return;this.isLite=true;
  if(this.renderer.getPixelRatio()>1){this.renderer.setPixelRatio(1);this.w=this.h=0;this.resize()}this.invalidate()}
 fail(e){const cb=this.onError;this.dispose();cb?.(e)}
 start(){if(!this.ready)return;this.paused=false;this.resize();this.invalidate()}
 stop(){this.paused=true;if(this.raf!=null){cancelAnimationFrame(this.raf);this.raf=null}this.meter.idle();this.setHover(null)}
 resize(){
  if(!this.ready)return;const w=this.el.clientWidth,h=this.el.clientHeight;if(!w||!h)return;
  if(w===this.w&&h===this.h&&this.fit)return;
  this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();
  const fit=fitDistance(w/h),old=this.fit,lim=distLimits(fit);
  this.ctl.minDistance=lim.min;this.ctl.maxDistance=lim.max;this.fit=fit;
  if(old){const c=this.camState();this.setCam({...c,dist:clamp(c.dist*fit/old,lim.min,lim.max)})} // giữ khung hình tương đối khi đổi kích thước
  this.invalidate();
 }
 // ---- Camera ----
 camState(){const o=this.cam.position.clone().sub(this.target),s=new this.T.Spherical().setFromVector3(o);return {az:s.theta,polar:s.phi,dist:s.radius}}
 setCam({az,polar,dist}){
  const s=new this.T.Spherical(clamp(dist,this.ctl.minDistance||0.1,this.ctl.maxDistance||99),clamp(polar,LIMITS.minPolar,LIMITS.maxPolar),clamp(az,LIMITS.minAz,LIMITS.maxAz));
  this.cam.position.setFromSpherical(s).add(this.target);this.cam.lookAt(this.target);
 }
 // 0.5: xả quán tính của OrbitControls trước một chuyển động camera có chủ đích (đặt lại/preset/zoom). Khi người dùng kéo mạnh tới
 // giới hạn góc, camera đứng yên nên vòng render dừng nhưng quán tính vẫn được giữ trong OrbitControls; nếu không xả, nó bị nhả ra
 // trong lúc tween và làm camera lệch khỏi đích (vd. "Đặt lại góc nhìn" không về đúng chính diện).
 flushInertia(){const d=this.ctl.enableDamping;this.ctl.enableDamping=false;this.ctl.update();this.ctl.enableDamping=d}
 animateTo(to){
  if(!this.ready)return;this.flushInertia();const from=this.camState();
  const lim={min:this.ctl.minDistance,max:this.ctl.maxDistance};
  const dest={az:clamp(to.az??from.az,LIMITS.minAz,LIMITS.maxAz),polar:clamp(to.polar??from.polar,LIMITS.minPolar,LIMITS.maxPolar),dist:clamp(to.dist??from.dist,lim.min,lim.max)};
  const dur=tweenDuration(this.reduced);
  if(!dur){this.tween=null;this.setCam(dest);this.ctl.update();this.invalidate();return}
  this.tween=makeTween(from,dest,dur,performance.now());this.invalidate();
 }
 view(name){const p=PRESETS[name];if(p)this.animateTo({az:p.az,polar:p.polar,dist:this.fit})}
 resetView(){this.view('front')}
 zoom(f){if(!this.ready)return;const c=this.tween?this.tween.to:this.camState();this.animateTo({...c,dist:c.dist*f})}
 // ---- Vùng da ----
 highlight(zs){
  this.zs=[...(zs||[])];if(!this.ready)return;
  this.hlT.on=H.zonesToTargets(this.zs);this.invalidate();
 }
 setHover(z){
  if(z===this.hoverZone)return;this.hoverZone=z;if(!this.ready)return;
  this.hlT.hover=H.ZONE_KEYS.map(k=>k===z?1:0);this.renderer.domElement.style.cursor=z?'pointer':'';this.onHover?.(z);this.invalidate();
 }
 queueHover(x,y){this.hoverXY=[x,y];if(this.hoverQ)return;this.hoverQ=requestAnimationFrame(()=>{this.hoverQ=null;if(this.ready&&!this.paused)this.setHover(this.zoneAt(...this.hoverXY))})}
 stepHighlight(){
  // Nội suy theo THỜI GIAN (≈ 90 ms hằng số): máy chậm cần ít khung hình hơn; giảm chuyển động → nhảy ngay.
  const now=performance.now(),dt=Math.min(250,now-(this.hlLast??now));this.hlLast=now;
  const c=this.hl,t=this.hlT,k=this.reduced?1:Math.max(0.12,1-Math.exp(-dt/90));let moving=false;
  const ap=(a,b)=>{const d=b-a;if(Math.abs(d)<0.004)return b;moving=true;return a+d*k};
  c.on=c.on.map((v,i)=>ap(v,t.on[i]));c.hover=c.hover.map((v,i)=>ap(v,t.hover[i]));
  if(!moving)this.hlLast=null;
  if(moving||this.hlDirty){this.hlDirty=false;H.applyHighlight(this.headData.baseColors,this.headData.zoneWeights,this.headData.colors,c,this.headData.exclude);this.colorAttr.needsUpdate=true}
  return moving;
 }
 // Raycast vào lưới ẩn → tam giác → trọng số vùng trung bình → vùng (hoặc null nếu trúng mũi, mắt, tai…)
 zoneAt(x,y){
  if(!this.ready)return null;const b=this.renderer.domElement.getBoundingClientRect();if(!b.width||!b.height)return null;
  this.ndc.set((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1);this.ray.setFromCamera(this.ndc,this.cam);
  const hit=this.ray.intersectObject(this.head,false)[0];if(!hit?.face)return null;
  return H.zoneAt(hit.point.x,hit.point.y,hit.face.normal.z); // mô hình không xoay/tỉ lệ → tọa độ thế giới = tọa độ mô hình
 }
 // Tọa độ màn hình (px, tương đối khung canvas) của tâm một vùng – phục vụ kiểm thử tự động.
 projectZone(z){
  if(!this.ready)return null;const p=H.zoneAnchor(this.headData.positions,this.headData.normals,z);if(!p)return null;
  const v=new this.T.Vector3(...p).project(this.cam),b=this.renderer.domElement.getBoundingClientRect();
  return {x:b.left+(v.x+1)/2*b.width,y:b.top+(1-v.y)/2*b.height,visible:v.z<1};
 }
 debugInfo(){
  const i=this.renderer?.info;
  return {ready:this.ready,lite:!!this.isLite,initCount:this.initCount,paused:this.paused,rafPending:this.raf!=null,frames:this.frameCount,
   canvases:this.el?this.el.querySelectorAll('canvas').length:0,
   geometries:this.geos?.size||0,materials:this.mats?.size||0,
   gpu:i?{geometries:i.memory.geometries,textures:i.memory.textures,calls:i.render.calls,triangles:i.render.triangles}:null,
   objects:this.scene?(()=>{let n=0;this.scene.traverse(o=>{if(o.isMesh&&o.visible)n++});return n})():0,
   size:this.ready?[this.w,this.h]:null,pixelRatio:this.renderer?.getPixelRatio()??null,
   cam:this.ready?this.camState():null,limits:this.ready?{min:this.ctl.minDistance,max:this.ctl.maxDistance}:null,
   fps:this.meter.fps,reduced:!!this.reduced,zones:[...this.zs],hover:this.hoverZone};
 }
 dispose(){
  if(this.raf!=null)cancelAnimationFrame(this.raf);if(this.hoverQ)cancelAnimationFrame(this.hoverQ);
  this.raf=this.hoverQ=null;this.tween=null;
  for(const f of this.off||[])try{f()}catch{}
  this.ro?.disconnect();this.ctl?.dispose();this.envRT?.dispose();this.envRT=null;
  for(const g of this.geos||[])g.dispose();for(const m of this.mats||[])m.dispose();
  if(this.renderer){this.renderer.dispose();try{this.renderer.forceContextLoss()}catch{}this.renderer.domElement.remove()}
  this.geos=this.mats=null;this.off=[];this.isLite=false;this.ro=this.ctl=this.renderer=this.scene=this.cam=this.root=this.head=this.headData=null;
  this.ready=false;this.paused=true;this.hoverZone=null;this.fit=null;this.w=this.h=0;this.meter.reset();this.slowReported=false;
 }
}
