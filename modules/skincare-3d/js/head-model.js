// Mô hình đầu 0.4.1 – module THUẦN (không Three.js, không DOM) → kiểm thử được bằng Node.
// Hình học nằm trong assets/head.glb, dựng từ lưới gốc MakeHuman hm08 (CC0 1.0) bằng tools/build-head.mjs.
// Tọa độ đã chuẩn hóa: chiều cao đầu (đỉnh → cằm) = 2, đỉnh đầu y = +1, cằm y ≈ −1, mặt hướng +z,
// x dương = bên TRÁI của người trong mô hình (bên phải màn hình) → khớp ZONES, Viewer2D và quy ước 0.4.
// Mốc đo trên lưới (xem extras trong GLB): mắt y ≈ −0.03 (x = ±0.263), đầu mũi y ≈ −0.35, khe môi y ≈ −0.62, cằm y ≈ −0.85.
//
// Vùng da: mỗi vùng là một elip trong mặt phẳng nhìn thẳng (x, y) × điều kiện "bề mặt hướng ra trước" (pháp tuyến z).
// Viewer2D dùng CÙNG các elip này (tools/gen-face2d.mjs) nên vị trí vùng ở 2D và 3D khớp nhau theo định nghĩa.
export const HEAD_ASSET='assets/head.glb';
export const ZONE_KEYS=['forehead','cheekL','cheekR','chin']; // kênh 0..3
export const FACE_CH=4,CH=5;                                   // kênh 4 = "toàn mặt"
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export const ZONE_SHAPES={
 forehead:{x:0,y:0.40,rx:0.32,ry:0.14},   // 0.5.1: theo mốc mới – giữa chân mày (≈0.19) và chân tóc (≈0.57–0.60)
 cheekL:{x:0.35,y:-0.33,rx:0.14,ry:0.15},  // gò má: ngang đầu mũi, dưới-ngoài mắt (mắt x≈±0.29, y≈0.02)
 cheekR:{x:-0.35,y:-0.33,rx:0.14,ry:0.15},
 chin:{x:0,y:-0.87,rx:0.16,ry:0.08}};      // mốc cằm y≈-0.865
export const FACE_SHAPE={x:0,y:-0.2,rx:0.55,ry:0.8,p:4}; // siêu elip bao trán → cằm
const LIPS={x:0,y:-0.615,rx:0.17,ry:0.06};
const ell=(x,y,s)=>Math.hypot((x-s.x)/s.rx,(y-s.y)/s.ry);
const frontOf=nz=>smooth(0.2,0.45,nz);
// Trọng số vùng tại một điểm bề mặt (x,y) có pháp tuyến z = nz. out: Float32Array(CH).
export function zoneWeights(x,y,nz,out=new Float32Array(CH)){
 out.fill(0);const F=frontOf(nz);
 // 0.5: mép "toàn mặt" mềm hơn (0.80→1.08, vẫn đối xứng quanh ngưỡng 0.94 → sơ đồ 2D không đổi) và dùng hệ số "hướng trước"
 // rộng hơn (tính TRƯỚC khi thoát sớm) để lớp phủ không bị cắt thành đường dọc ở thái dương/hai bên má. Kênh 0–3 (chọn vùng) không đổi.
 const s=FACE_SHAPE,r=Math.pow(Math.pow(Math.abs(x-s.x)/s.rx,s.p)+Math.pow(Math.abs(y-s.y)/s.ry,s.p),1/s.p);
 out[FACE_CH]=smooth(-0.05,0.4,nz)*smooth(1.08,0.80,r);
 if(!F)return out;
 ZONE_KEYS.forEach((k,i)=>{out[i]=F*smooth(1.05,0.72,ell(x,y,ZONE_SHAPES[k]))});
 return out;
}
// Vùng tại một điểm (dùng khi raycast): kênh 0..3 lớn nhất và ≥ ngưỡng, ngược lại null.
export function zoneFromWeights(w,th=0.5){let best=-1,bw=th;for(let k=0;k<4;k++)if(w[k]>=bw){bw=w[k];best=k}return best<0?null:ZONE_KEYS[best]}
export const zoneAt=(x,y,nz)=>zoneFromWeights(zoneWeights(x,y,nz));
// Trọng số cho mọi đỉnh của lưới da (positions, normals: Float32Array xyz).
export function computeWeights(pos,nor){
 const n=pos.length/3,out=new Float32Array(n*CH),tmp=new Float32Array(CH);
 for(let i=0;i<n;i++){zoneWeights(pos[i*3],pos[i*3+1],nor[i*3+2],tmp);out.set(tmp,i*CH)}
 return out;
}
// Màu (sRGB 0..1): da trung tính, môi hơi hồng. KHÔNG thay đổi theo thời gian hay theo "kết quả" dùng sản phẩm.
// 0.5.2: hl = xanh ngọc sáng, BỔ TÚC với sắc da ấm. Màu sẫm hơn trộn với da thành xám xanh đục; màu cũ (0.42,0.76,0.72)
// quá nhạt. Cùng mức phủ tối đa mới (HL_MAX) → vùng chọn nhận ra ngay ở khoảng nhìn thường, hình khối da vẫn đọc được.
export const PALETTE={skin:[0.886,0.772,0.690],lip:[0.760,0.505,0.475],hl:[0.18,0.78,0.80],hover:[0.45,0.80,0.82],face:[0.66,0.86,0.88],scalp:[0.24,0.17,0.13]}; // face (0.5): sáng hơn hl → lớp "toàn mặt" không làm da xám đục
// Mức phủ tối đa về màu nhấn của vùng ĐƯỢC CHỌN. 0.4.1–0.5.1: 0.55 (cố ý nhẹ); 0.5.2: 0.68 vì highlight vùng là tính năng
// chính và 0.55 bị đánh giá là khó nhận ra (đã kiểm bằng ảnh render trước/sau). Hover giữ ≤ 0.25, "toàn mặt" ≤ 0.18.
export const HL_MAX=0.68;
export const toLinear=c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
// 0.5: ao (tùy chọn) = che khuất môi trường đã bake vào GLB (thuộc tính _AO, 1 = không bị che). Nhân vào màu nền để hốc mắt,
// cánh mũi, khe môi, tai, dưới cằm có chiều sâu dưới ánh sáng studio. Không có ao → như 0.4.x.
export const AO_K={skin:0.72,eye:0.75};
export const aoShade=(a,k)=>a==null||!Number.isFinite(a)?1:1-k*(1-clamp(a,0,1));
// 0.5.1: hair (tùy chọn) = mặt nạ da đầu dưới tóc (thuộc tính _HAIR của GLB) → da đầu tối màu tóc, khe giữa lọn không lộ da.
// 0.5.1: lip (tùy chọn) = mặt nạ môi đã bake theo mốc miệng (thuộc tính _LIP) – thay hình elip cố định của 0.5.
// Sắc da có biến thiên rất nhẹ (má/mũi/tai ấm hơn, quanh mắt hơi trầm) để da không phẳng như nhựa; không phải "trạng thái da".
const WARM=[{x:0.40,y:-0.22,rx:0.20,ry:0.15,k:0.55},{x:-0.40,y:-0.22,rx:0.20,ry:0.15,k:0.55},{x:0,y:-0.30,rx:0.09,ry:0.08,k:0.5},{x:0,y:-0.86,rx:0.16,ry:0.09,k:0.25}];
const SCALP_DEEP=[0.10,0.068,0.052],ROSY=[0.86,0.66,0.60],COOL=[0.80,0.72,0.68];
function tint(x,y,z,nz){
 let w=0;for(const e of WARM)w=Math.max(w,e.k*smooth(1,0.35,ell(x,y,e)));
 const ear=smooth(0.62,0.72,Math.abs(x))*smooth(0.3,0.05,nz)*smooth(-0.35,-0.1,y)*smooth(0.25,0.05,y)*0.45; // vành tai hơi hồng
 const eye=smooth(0.12,0.04,Math.min(Math.hypot(x-0.29,(y-0.0)*1.4),Math.hypot(x+0.29,(y-0.0)*1.4))-0.12)*0.35*smooth(0.4,0.7,nz); // quầng quanh mắt rất nhẹ
 return {warm:Math.min(0.6,w+ear)*smooth(0.1,0.5,nz+ear),cool:eye};
}
export function baseColors(pos,nor,ao=null,hair=null,lipM=null){
 const n=pos.length/3,out=new Float32Array(n*3);
 for(let i=0;i<n;i++){
  const tn=tint(pos[i*3],pos[i*3+1],pos[i*3+2],nor[i*3+2]);
  // 0.5.2 môi: pha nhẹ hơn (0.66, mép môi hòa vào da thay vì như tô son), môi trên trầm hơn môi dưới chút ít (tự nhiên),
  // và AO giảm trong vùng môi → khe môi/khóe miệng là một nếp bóng sẫm thay cho đường đen đặc.
  const lm=lipM?clamp(lipM[i],0,1):smooth(1.0,0.6,ell(pos[i*3],pos[i*3+1],LIPS))*smooth(0.35,0.6,nor[i*3+2])*0.76;
  const lip=lm*0.66,up=lipM?smooth(-0.625,-0.600,pos[i*3+1]):0,f=aoShade(ao?.[i],AO_K.skin*(1-0.45*lm)),hm=hair?clamp(hair[i],0,1)*0.92:0;
  const deep=hair?smooth(0.75,1,hair[i]):0;
  for(let c=0;c<3;c++){const sk=PALETTE.skin[c]*(1-tn.warm*0.35-tn.cool*0.3)+ROSY[c]*tn.warm*0.35+COOL[c]*tn.cool*0.3;
   const sc=PALETTE.scalp[c]*(1-deep)+SCALP_DEEP[c]*deep; // sâu trong vùng tóc: da đầu gần màu tóc → khe giữa lọn không lộ vệt sáng
   out[i*3+c]=toLinear((sk*(1-lip)+PALETTE.lip[c]*(1-0.09*up)*lip)*(1-hm)+sc*hm)*f}
 }
 return out;
}
// 0.5.1: màu mắt vẽ theo điểm ảnh trong shader (viewer3d) → thuộc tính màu đỉnh chỉ mang AO (xám).
export function eyeShade(n,ao=null){const out=new Float32Array(n*3);for(let i=0;i<n;i++){const f=aoShade(ao?.[i],AO_K.eye);out[i*3]=out[i*3+1]=out[i*3+2]=f}return out}
// Mắt kiểu tượng được tô màu nhẹ: lòng trắng ngà, mống mắt nâu xám mép mềm, đồng tử sẫm vừa phải (không bóng, không phát sáng).
// Màu theo pháp tuyến của nhãn cầu (cầu có cực hướng +z = nhìn thẳng) → hai mắt luôn nhìn cùng hướng, đối xứng.
export const EYE={sclera:[0.86,0.83,0.79],iris:[0.50,0.42,0.38],pupil:[0.24,0.20,0.19],iris0:0.86,iris1:0.90,pupil0:0.965,pupil1:0.975};
export function eyeColors(nor,ao=null){
 const n=nor.length/3,out=new Float32Array(n*3);
 for(let i=0;i<n;i++){const z=nor[i*3+2],a=smooth(EYE.iris0,EYE.iris1,z),b=smooth(EYE.pupil0,EYE.pupil1,z),f=aoShade(ao?.[i],AO_K.eye);
  for(let c=0;c<3;c++)out[i*3+c]=toLinear(EYE.sclera[c]*(1-a)+(EYE.iris[c]*(1-b)+EYE.pupil[c]*b)*a)*f}
 return out;
}
// Highlight trên bề mặt (một hiệu ứng duy nhất: phủ màu nhạt, mép mềm). st: {on:[5] 0..1, hover:[4] 0..1}.
// Khi không chọn gì → màu da nguyên vẹn (không viền, không gợi ý vùng).
// Độ sáng tương đối của màu nền so với màu da chuẩn (≈ hệ số AO): giữ hốc mắt/khe môi tối dưới lớp "toàn mặt".
const SKIN_LIN=PALETTE.skin.map(toLinear);
const shadeOf=(base,i,c)=>clamp(base[i*3+c]/SKIN_LIN[c],0,1.2);
// 0.5.2: làm mềm một thuộc tính theo đỉnh lân cận (trung bình theo tam giác), dùng cho MÀU môi: mặt nạ _LIP lưu theo đỉnh
// nên mép môi trên thành răng cưa. Trả về bản sao — mặt nạ gốc (dùng cho kiểm thử, loại trừ highlight) không đổi.
export function smoothAttr(v,index,iterations=2,k=0.5){
 let a=Float32Array.from(v);const n=a.length,sum=new Float32Array(n),cnt=new Float32Array(n);
 for(let it=0;it<iterations;it++){sum.fill(0);cnt.fill(0);
  for(let t=0;t<index.length;t+=3){const i0=index[t],i1=index[t+1],i2=index[t+2];
   sum[i0]+=a[i1]+a[i2];sum[i1]+=a[i0]+a[i2];sum[i2]+=a[i0]+a[i1];cnt[i0]+=2;cnt[i1]+=2;cnt[i2]+=2}
  const b=new Float32Array(n);for(let i=0;i<n;i++)b[i]=cnt[i]?a[i]*(1-k)+k*sum[i]/cnt[i]:a[i];a=b}
 return a;
}
// 0.5.2: mặt nạ loại trừ (tùy chọn) cho highlight: môi và da nằm dưới tóc không bao giờ bị tô. 0 = tô bình thường, 1 = không tô.
export function highlightExclusion(lip,hair,n){
 const ex=new Float32Array(n);
 for(let i=0;i<n;i++)ex[i]=Math.max(lip?clamp(lip[i]*1.4,0,1):0,hair?clamp(hair[i]*1.5-0.3,0,1):0);
 return ex;
}
export function applyHighlight(base,zw,out,st,ex=null){
 const HL=PALETTE.hl.map(toLinear),HV=PALETTE.hover.map(toLinear),FC=PALETTE.face.map(toLinear),on=st.on,hv=st.hover||[0,0,0,0],n=base.length/3;
 for(let i=0;i<n;i++){
  const o=i*CH;let fill=0,hov=0;
  // 0.5.2: "cao nguyên" rộng hơn (đủ mức phủ từ trọng số vùng 0.8) nhưng mép vẫn mềm — mép hẹp hơn nữa lộ độ phân giải
  // đỉnh thành viền răng cưa. Lấy MAX giữa các vùng: không cộng dồn khi chọn nhiều vùng.
  for(let k=0;k<4;k++){const w=zw[o+k];if(w>0){const wp=smooth(0,0.8,w);if(!on[4])fill=Math.max(fill,on[k]*HL_MAX*wp);hov=Math.max(hov,hv[k]*0.22*wp)}}
  // "Toàn mặt": MỘT lớp phủ đều, màu sáng (PALETTE.face), mép mềm; không cộng thêm 4 mảng vùng → không loang lổ.
  let ff=on[4]?Math.min(0.18,0.18*zw[o+4]*on[4]):0; // nhẹ: lựa chọn đã được nói rõ ở dòng trạng thái dưới mô hình
  fill=Math.min(fill,HL_MAX);hov=Math.min(hov,0.25);
  if(ex){const keep=1-ex[i];fill*=keep;hov*=keep;ff*=keep}
  for(let c=0;c<3;c++){let v=base[i*3+c];v+=(HL[c]-v)*fill;v+=(FC[c]*shadeOf(base,i,c)-v)*ff;v+=(HV[c]-v)*hov;out[i*3+c]=v}
 }
 return out;
}
export const zonesToTargets=(zs=[])=>{const s=new Set(zs),face=s.has('face');return [...ZONE_KEYS.map(k=>s.has(k)||face?1:0),face?1:0]};
// Điểm neo của vùng trên bề mặt: đỉnh hướng ra trước gần tâm elip nhất (theo mặt phẳng nhìn thẳng).
export function zoneAnchor(pos,nor,z){
 const s=ZONE_SHAPES[z];if(!s)return null;let best=-1,bd=1e9;
 for(let i=0;i<pos.length/3;i++){if(nor[i*3+2]<0.5)continue;const d=Math.hypot(pos[i*3]-s.x,pos[i*3+1]-s.y)-pos[i*3+2]*1e-3;if(d<bd){bd=d;best=i}}
 return best<0?null:[pos[best*3],pos[best*3+1],pos[best*3+2]];
}
// Đọc GLB (glTF 2.0 nhị phân) tối giản – dùng cho kiểm thử Node và công cụ sinh 2D (trình duyệt dùng GLTFLoader).
export function readGLB(buf){
 const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
 if(dv.getUint32(0,true)!==0x46546C67)throw new Error('không phải GLB');
 const jl=dv.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(buf.subarray(20,20+jl))),bo=20+jl+8;
 const acc=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],T=a.componentType===5126?Float32Array:a.componentType===5123?Uint16Array:Uint32Array;
  const n=a.count*({VEC3:3,SCALAR:1}[a.type]);return new T(buf.buffer.slice(buf.byteOffset+bo+v.byteOffset,buf.byteOffset+bo+v.byteOffset+n*T.BYTES_PER_ELEMENT))};
 // 0.5.1: lưới chỉ để hiển thị (tóc, lông mày/mi) được lượng tử + nén meshopt → không đọc ở đây (chỉ trình duyệt giải nén), đánh dấu compressed
 const plain=i=>{const a=json.accessors[i];return a.componentType===5126||a.componentType===5123||a.componentType===5125?!json.bufferViews[a.bufferView].extensions:false};
 const opt=(p,k)=>p.attributes[k]!=null?acc(p.attributes[k]):null;
 const meshes={};json.meshes.forEach(m=>{const p=m.primitives[0];
  meshes[m.name]=plain(p.attributes.POSITION)&&plain(p.indices)?{positions:acc(p.attributes.POSITION),normals:acc(p.attributes.NORMAL),index:acc(p.indices),ao:opt(p,'_AO'),hair:opt(p,'_HAIR'),lip:opt(p,'_LIP')}:{compressed:true}});
 return {json,meshes,landmarks:json.nodes.find(n=>n.extras?.landmarks)?.extras.landmarks};
}
