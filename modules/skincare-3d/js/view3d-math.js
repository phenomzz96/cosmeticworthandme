// Toán camera, phân biệt cử chỉ chạm/kéo và đo hiệu năng cho Viewer3D (0.4) – module THUẦN (không Three.js, không DOM).

// ---- Thông báo lỗi 3D (0.5) ----
// Nguyên nhân ngắn gọn cho khách: câu đầu của thông điệp lỗi, bỏ phần URL/chi tiết trình duyệt (phần đầy đủ để ở "Chi tiết kỹ thuật").
export function failCause(m){
 const s=String(m||'lỗi không xác định').split(/\s+[–(]|:\s/)[0].trim().slice(0,90)||'lỗi không xác định';
 return /thư viện 3D/.test(s)?s+' (cần kết nối Internet)':s;
}

// ---- Camera ----
// Góc theo quy ước OrbitControls: az (azimuth) đo từ +z sang +x; polar đo từ trục +y (π/2 = ngang tầm mắt).
// "Nghiêng má trái" = camera đi về phía +x (bên trái của người trong mô hình) để thấy má trái.
export const VIEW={target:[0,-0.28,0.35],fov:30,radius:1.38}; // radius: bán kính khối cần nhìn trọn (đầu + tóc + một phần cổ); 0.5.1: mô hình mới nhô ra trước ~0,25 (z) → dời tâm nhìn
// 0.5: ánh sáng studio nhẹ (dữ liệu thuần để chỉnh và kiểm thử dễ). Đèn chính/phụ gắn theo camera → mặt luôn được chiếu
// từ phía trên-trước ở mọi góc xoay; nền bán cầu thấp hơn 0.4.x để hình khối (mũi, gò má, hốc mắt) đọc rõ; đèn viền tách khối khỏi nền.
// 0.5.2: thêm môi trường studio (IBL) → da/tóc/mắt có phản xạ mềm thay vì chỉ đèn thẳng. Đèn bán cầu hạ xuống vì
// môi trường đã lo phần sáng nền; đèn viền mạnh hơn để tách tóc khỏi nền sáng.
export const LIGHTS={exposure:0.97,
 hemi:{sky:0xfff6ee,ground:0x8a7a72,intensity:0.06},
 key:{color:0xfff1e6,intensity:1.95,pos:[-2.6,2.1,1.9]},
 fill:{color:0xe9eeff,intensity:0.50,pos:[3.2,-0.3,1.8]},
 rim:{color:0xfff6ec,intensity:1.65,pos:[0.8,2.4,-3.2]}};
// Môi trường studio sinh bằng công thức (không tải HDRI): vòm sáng ấm phía trên, chân trời trung tính, sàn trầm ấm,
// cộng một "softbox" lớn chếch trên-trước-trái và một tấm hắt lạnh yếu bên phải. PMREM sẽ làm mờ nên độ phân giải nhỏ là đủ.
// Cường độ riêng từng vật liệu: da chỉ cần chút phản xạ mềm (nhiều hơn là bệt trắng). Tóc thấp: môi trường mạnh làm
// tóc nâu sẫm thành nâu cam (đo được +78% độ sáng ở 1.5); điểm sáng của tóc đến từ phản xạ dị hướng, không từ môi trường.
// eye thấp: lớp clearcoat phản chiếu TOÀN BỘ môi trường sẽ phủ một màng trắng đục làm đồng tử xám.
// Đốm sáng catchlight nên đến từ đèn chính (nguồn nhỏ, nét), không từ vòm môi trường.
export const ENV={w:128,h:64,intensity:{skin:0.30,hair:0.5,eye:0.30,default:0.5}};
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const ENV_TOP=[0.46,0.445,0.425],ENV_HORIZON=[0.26,0.255,0.262],ENV_FLOOR=[0.075,0.065,0.060];
const ENV_LIGHTS=[
 {dir:[-0.46,0.78,0.43],inner:0.80,outer:0.28,color:[1.0,0.95,0.88],power:3.2},  // softbox chính
 {dir:[0.72,-0.02,0.50],inner:0.90,outer:0.55,color:[0.82,0.88,1.0],power:0.50}, // tấm hắt lạnh
 {dir:[0.10,0.46,-0.88],inner:0.88,outer:0.52,color:[1.0,0.93,0.86],power:0.70}]; // hắt sau (viền)
// RGBA float, bố cục equirect đúng quy ước equirectUv của Three.js: u = atan2(z,x), v = asin(y)/π + 0.5, hàng 0 = v nhỏ nhất.
export function studioEnvPixels(w=ENV.w,h=ENV.h){
 const out=new Float32Array(w*h*4);
 for(let r=0;r<h;r++){
  const v=(r+0.5)/h,y=Math.sin((v-0.5)*Math.PI),ce=Math.sqrt(Math.max(0,1-y*y));
  const up=smooth(0,1,y),down=smooth(0,-1,y);
  for(let c=0;c<w;c++){
   const phi=((c+0.5)/w-0.5)*2*Math.PI,x=Math.cos(phi)*ce,z=Math.sin(phi)*ce;
   const px=[0,0,0];
   for(let k=0;k<3;k++)px[k]=ENV_HORIZON[k]+(ENV_TOP[k]-ENV_HORIZON[k])*up+(ENV_FLOOR[k]-ENV_HORIZON[k])*down;
   for(const L of ENV_LIGHTS){
    const d=L.dir,n=Math.hypot(d[0],d[1],d[2]),dot=(x*d[0]+y*d[1]+z*d[2])/n,g=smooth(L.outer,L.inner,dot);
    if(g>0)for(let k=0;k<3;k++)px[k]+=L.color[k]*L.power*g;
   }
   const o=(r*w+c)*4;out[o]=px[0];out[o+1]=px[1];out[o+2]=px[2];out[o+3]=1;
  }
 }
 return out;
}
export const LIMITS={minAz:-1.75,maxAz:1.75,minPolar:Math.PI*0.3,maxPolar:Math.PI*0.64,minDistFactor:0.62,maxDistFactor:1.9};
export const PRESETS={
 front:{az:0,polar:Math.PI/2-0.05,label:'Chính diện'},
 left:{az:1.12,polar:Math.PI/2-0.05,label:'Nghiêng: má trái'},
 right:{az:-1.12,polar:Math.PI/2-0.05,label:'Nghiêng: má phải'}};
// Khoảng cách để khối cầu bán kính r lọt trọn khung hình (xét cả chiều ngang khi màn hình hẹp, vd. điện thoại dọc).
export function fitDistance(aspect,fovDeg=VIEW.fov,r=VIEW.radius,margin=1.08){
 const v=fovDeg*Math.PI/180,a=Number.isFinite(aspect)&&aspect>0?aspect:1,h=2*Math.atan(Math.tan(v/2)*a);
 return r*margin/Math.sin(Math.min(v,h)/2);
}
// Giới hạn zoom tính từ khoảng cách vừa khung: không vào sâu trong mô hình (min > bán kính đầu), không xa đến mức mất mô hình.
export function distLimits(fit){return {min:Math.max(VIEW.radius*1.9,fit*LIMITS.minDistFactor),max:fit*LIMITS.maxDistFactor}}
export const clamp=(x,a,b)=>x<a?a:x>b?b:x;
export const easeInOutCubic=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
// Tween camera giữa hai trạng thái {az,polar,dist}. duration=0 → tức thì (dùng khi prefers-reduced-motion).
export function makeTween(from,to,duration,now){return {from:{...from},to:{...to},t0:now,duration:Math.max(0,duration)}}
export function sampleTween(tw,now){
 const k=tw.duration?clamp((now-tw.t0)/tw.duration,0,1):1,e=easeInOutCubic(k),f=tw.from,t=tw.to;
 return {az:f.az+(t.az-f.az)*e,polar:f.polar+(t.polar-f.polar)*e,dist:f.dist+(t.dist-f.dist)*e,done:k>=1};
}
export const tweenDuration=(reduced,ms=650)=>reduced?0:ms;

// ---- Phân biệt chạm/nhấp (chọn vùng) với kéo/vuốt/chụm (xoay, zoom) ----
// Chỉ coi là "chọn" khi: đúng MỘT con trỏ từ đầu đến cuối, dịch chuyển nhỏ hơn ngưỡng, thời gian ngắn.
export const SLOP={mouse:5,touch:10,pen:8};
export class GestureTracker{
 constructor({maxTapMs={mouse:1500,touch:700,pen:900}}={}){this.p=new Map;this.multi=false;this.maxTapMs=maxTapMs}
 down(id,x,y,type='mouse',t=0){this.p.set(id,{x0:x,y0:y,max:0,type,t0:t});if(this.p.size>1)this.multi=true}
 move(id,x,y){const s=this.p.get(id);if(s)s.max=Math.max(s.max,Math.hypot(x-s.x0,y-s.y0))}
 // Trả 'tap' (nên chọn vùng) hoặc 'drag'/'multi'/null.
 up(id,x,y,t=0){
  const s=this.p.get(id);if(!s)return null;this.move(id,x,y);this.p.delete(id);
  const multi=this.multi;if(!this.p.size)this.multi=false;
  if(multi)return 'multi';
  const slop=SLOP[s.type]??SLOP.mouse,lim=this.maxTapMs[s.type]??this.maxTapMs.mouse;
  return s.max<=slop&&(t-s.t0)<=lim?'tap':'drag';
 }
 cancel(id){this.p.delete(id);if(!this.p.size)this.multi=false}
 get active(){return this.p.size}
}

// ---- Đo hiệu năng (chỉ trong lúc render liên tục; không kết luận từ một lần đo) ----
// Viewer gọi frame(t) cho mỗi khung hình được render nối tiếp, và idle() khi vòng render dừng (hết một "đợt" tương tác).
// Một "cửa sổ" = ≥ 1 giây render liên tục. Chỉ báo "chậm" khi ≥ 3 cửa sổ chậm LIÊN TIẾP và chúng thuộc ≥ 2 đợt khác nhau
// (tránh kết luận từ một lần đo / một animation dài duy nhất).
export class PerfMeter{
 constructor({slowFps=24,needWindows=3,needBursts=2,windowMs=1000}={}){Object.assign(this,{slowFps,needWindows,needBursts,windowMs});this.reset()}
 reset(){this.ws=null;this.n=0;this.slowRun=0;this.slowBursts=new Set;this.burst=0;this.fps=null;this.windows=0;this.slow=false;this.frames=0}
 idle(){if(this.ws!=null||this.n)this.burst++;this.ws=null;this.n=0} // cửa sổ dở dang (< 1 giây) bị bỏ, không tính
 frame(t){
  this.frames++;
  if(this.ws==null){this.ws=t;this.n=0}
  this.n++;const dur=t-this.ws;
  if(dur>=this.windowMs){
   const fps=(this.n-1)*1000/dur;this.fps=fps;this.windows++;
   if(fps<this.slowFps){this.slowRun++;this.slowBursts.add(this.burst)}else{this.slowRun=0;this.slowBursts.clear()}
   if(this.slowRun>=this.needWindows&&this.slowBursts.size>=this.needBursts)this.slow=true;
   this.ws=t;this.n=1;
  }
  return this.slow;
 }
}
