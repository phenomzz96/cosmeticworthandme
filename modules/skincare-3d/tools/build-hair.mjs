// Dựng tóc cho assets/head.glb (0.5.1) – lưới tóc do dự án tự tạo (không dùng tài nguyên bên ngoài).
//   node tools/build-hair.mjs <vào.glb> <ra.glb>
// Kiểu tóc: vén gọn ra sau, búi thấp sau gáy; tai, trán, má, cằm để trống (không cản vùng da tương tác).
// Cách dựng (tất định, không ngẫu nhiên):
//  1. Da đầu = lưới "skin". Tìm điểm da đầu theo hướng từ tâm đầu bằng raycast (lưới đều tăng tốc + Möller–Trumbore).
//  2. Đường chân tóc H(α): độ cao (y) bắt đầu có tóc theo góc phương vị quanh đầu (α = 0 là phía trước).
//  3. Mỗi lọn tóc chạy từ đường chân tóc tới gốc búi theo bezier trên mặt cầu (qua điểm giữa nâng lên đỉnh đầu, lệch nhẹ từng lọn)
//     → các lọn phủ kín da đầu, hội tụ về búi. Mặt cắt lọn: dải bo tròn + "váy" sát da hai mép; các lọn chồng mép → rãnh tóc
//     thật trên silhouette; lớp lọn trên lệch hướng; vệt thớ mảnh bằng màu đỉnh.
//  4. Búi: các lọn xoắn quanh tâm búi trên một khối elip + lõi elip.
//  4b. Lớp tóc tơ chân tóc (lưới "hairline", alpha theo đỉnh), lông mày (nét sợi), lông mi (trên khung bờ mi MakeHuman), khoang miệng.
//  5. Thuộc tính: POSITION, NORMAL, TANGENT (hướng sợi; optimize-glb.mjs bỏ đi vì vật liệu hiện không dùng dị hướng), COLOR_0 (biến thiên màu nhẹ theo lọn).
//     Da nhận thêm "_HAIR" (0..1): mức da đầu nằm dưới tóc → tô tối nhẹ để khe giữa các lọn không lộ màu da.
import {readFileSync,writeFileSync} from 'node:fs';

const [inp,out=inp]=process.argv.slice(2);
if(!inp){console.error('Dùng: node tools/build-hair.mjs <vào.glb> <ra.glb>');process.exit(1)}
// ---------- GLB ----------
const buf=readFileSync(inp),dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
const jl=dv.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(buf.subarray(20,20+jl)));
const bin=buf.subarray(28+jl,28+jl+dv.getUint32(20+jl,true));
if(json.meshes.some(m=>m.name==='hair')){console.error('Tệp đã có tóc.');process.exit(1)}
const acc=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],T=a.componentType===5126?Float32Array:a.componentType===5123?Uint16Array:Uint32Array,
 n=a.count*({VEC3:3,VEC4:4,SCALAR:1}[a.type]),o=(v.byteOffset||0)+(a.byteOffset||0);return new T(bin.buffer.slice(bin.byteOffset+o,bin.byteOffset+o+n*T.BYTES_PER_ELEMENT))};
const skinM=json.meshes.find(m=>m.name==='skin').primitives[0];
const SP=acc(skinM.attributes.POSITION),SN=acc(skinM.attributes.NORMAL),SI=acc(skinM.indices);
const LM=json.nodes.find(n=>n.extras?.landmarks).extras.landmarks;

// ---------- Raycast lên da ----------
const NT=SI.length/3,TV=new Float32Array(NT*9);for(let t=0;t<NT;t++)for(let k=0;k<3;k++){const j=SI[t*3+k];TV.set([SP[j*3],SP[j*3+1],SP[j*3+2]],t*9+k*3)}
let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<TV.length;i+=3)for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],TV[i+c]);hi[c]=Math.max(hi[c],TV[i+c])}
lo=lo.map(x=>x-1e-3);hi=hi.map(x=>x+1e-3);const H=0.05,G=[0,1,2].map(c=>Math.max(1,Math.ceil((hi[c]-lo[c])/H)));
const cellOf=(c,x)=>Math.min(G[c]-1,Math.max(0,Math.floor((x-lo[c])/H)));const CELLS=new Map;
for(let t=0;t<NT;t++){const o=t*9,a=[0,1,2].map(c=>Math.min(TV[o+c],TV[o+3+c],TV[o+6+c])),b=[0,1,2].map(c=>Math.max(TV[o+c],TV[o+3+c],TV[o+6+c]));
 for(let x=cellOf(0,a[0]);x<=cellOf(0,b[0]);x++)for(let y=cellOf(1,a[1]);y<=cellOf(1,b[1]);y++)for(let z=cellOf(2,a[2]);z<=cellOf(2,b[2]);z++){const k=(x*G[1]+y)*G[2]+z;let l=CELLS.get(k);if(!l)CELLS.set(k,l=[]);l.push(t)}}
function hitTri(o,O,D){const ax=TV[o],ay=TV[o+1],az=TV[o+2],e1=[TV[o+3]-ax,TV[o+4]-ay,TV[o+5]-az],e2=[TV[o+6]-ax,TV[o+7]-ay,TV[o+8]-az];
 const p=[D[1]*e2[2]-D[2]*e2[1],D[2]*e2[0]-D[0]*e2[2],D[0]*e2[1]-D[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)return null;
 const inv=1/det,tv=[O[0]-ax,O[1]-ay,O[2]-az],u=(tv[0]*p[0]+tv[1]*p[1]+tv[2]*p[2])*inv;if(u<0||u>1)return null;
 const q=[tv[1]*e1[2]-tv[2]*e1[1],tv[2]*e1[0]-tv[0]*e1[2],tv[0]*e1[1]-tv[1]*e1[0]],v=(D[0]*q[0]+D[1]*q[1]+D[2]*q[2])*inv;if(v<0||u+v>1)return null;
 const t=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;return t>1e-6?{t,u,v}:null}
const stamp=new Uint32Array(NT);let ray=0;
function cast(O,D,maxT=4){ray++;const cell=[0,1,2].map(c=>cellOf(c,O[c])),step=D.map(v=>v>0?1:-1);
 const tMax=[0,1,2].map(c=>D[c]===0?Infinity:((lo[c]+(cell[c]+(step[c]>0?1:0))*H)-O[c])/D[c]),tD=D.map(v=>v===0?Infinity:Math.abs(H/v));
 let best=null,t0=0;while(t0<=Math.min(maxT,best?best.t:Infinity)){const l=CELLS.get((cell[0]*G[1]+cell[1])*G[2]+cell[2]);
  if(l)for(const t of l){if(stamp[t]===ray)continue;stamp[t]=ray;const h=hitTri(t*9,O,D);if(h&&(!best||h.t<best.t))best={...h,tri:t}}
  const a=tMax[0]<tMax[1]?(tMax[0]<tMax[2]?0:2):(tMax[1]<tMax[2]?1:2);t0=tMax[a];cell[a]+=step[a];if(cell[a]<0||cell[a]>=G[a])break;tMax[a]+=tD[a]}
 return best}
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),nrm=a=>mul(a,1/(len(a)||1));
const C=[0,0.18,0.0]; // tâm đầu (trong hộp sọ) – xuất phát của tia tìm da đầu
// Điểm da đầu + pháp tuyến nội suy theo hướng d (tia đầu tiên từ tâm ra ngoài = mặt hộp sọ, không trúng tai)
function scalp(d){const h=cast(C,d);if(!h)return null;const t=h.tri,i=[SI[t*3],SI[t*3+1],SI[t*3+2]],w=[1-h.u-h.v,h.u,h.v];
 let n=[0,0,0];for(let k=0;k<3;k++)n=add(n,mul([SN[i[k]*3],SN[i[k]*3+1],SN[i[k]*3+2]],w[k]));return {p:add(C,mul(d,h.t)),n:nrm(n)}}
const dirAz=(al,el)=>[Math.sin(al)*Math.cos(el),Math.sin(el),Math.cos(al)*Math.cos(el)];
const slerp=(a,b,t)=>{const c=Math.min(1,Math.max(-1,dot(a,b))),om=Math.acos(c);if(om<1e-6)return a;const s=Math.sin(om);return nrm(add(mul(a,Math.sin((1-t)*om)/s),mul(b,Math.sin(t*om)/s)))};
const hash=i=>{let x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

// ---------- Đường chân tóc ----------
// (|α|, y): trán cao vừa phải, thái dương, trên tai (tai lộ), sau tai, gáy. Nội suy tuyến tính, đối xứng hai bên.
const HL=[[0,0.60],[0.15,0.597],[0.3,0.586],[0.45,0.562],[0.6,0.522],[0.75,0.46],[0.9,0.385],[1.05,0.295],[1.14,0.21],[1.2,0.13],[1.25,0.10],[1.35,0.12],[1.55,0.10],[1.75,0.085],[1.95,-0.05],[2.2,-0.27],[2.55,-0.47],[Math.PI,-0.55]];
// + gợn nhẹ, tất định (đường chân tóc thật không thẳng như mép tóc giả); đối xứng trái/phải
const hairY0=al=>{const a=Math.abs(al);for(let k=1;k<HL.length;k++)if(a<=HL[k][0]){const [a0,y0]=HL[k-1],[a1,y1]=HL[k],t=(a-a0)/(a1-a0);return y0+(y1-y0)*t}return HL.at(-1)[1]};
const hairY=al=>{const a=Math.abs(al);return hairY0(al)+0.010*Math.sin(5.1*al+0.6)+0.007*Math.sin(13.7*al+1.9)+0.005*Math.sin(29*a+0.3)+0.003*Math.sin(67*al+2.2)}; // không đối xứng tuyệt đối
const EMERGE=0.06; // lọn đặc bắt đầu nổi lên trên chân tóc một đoạn; phần dưới là lớp tóc tơ bán trong suốt (mép mềm)
// Hướng (từ tâm) mà điểm da đầu có y = hairY(α): chia đôi theo góc nâng
function startDir(al,dy=0){let a=-1.3,b=1.45;for(let k=0;k<40;k++){const m=(a+b)/2,s=scalp(dirAz(al,m));if(!s){a=m;continue}if(s.p[1]<hairY(al)+dy)a=m;else b=m}return dirAz(al,(a+b)/2)}

// ---------- Búi thấp ----------
const bunBaseDir=nrm([0,-0.36,-1]);const bunBase=scalp(bunBaseDir);
const BUN={c:add(bunBase.p,mul(bunBase.n,0.13)),r:[0.25,0.17,0.15]}; // tâm búi nhô ra sau gáy; bán trục (ngang, dọc, sâu)

// ---------- Lưới ----------
const P=[],N=[],Tg=[],Col=[],I=[];
const BASE_COL=[0.115,0.075,0.055];
const EDGE_COL=[0.30,0.22,0.17]; // màu sát mép chân tóc (gần màu da đầu) → mép tóc mềm, không như mép tóc giả
const HN=[]; // pháp tuyến da đầu theo đỉnh (null = không trộn)
function ribbon(rows,K,colorVar,em=null,sn=null){ // rows: [{pts:[[x,y,z]]×K, tan:[x,y,z]}] → lưới dải; pháp tuyến tính sau
 const o=P.length/3;let q=0,ri=0;
 // vệt sợi mảnh: mỗi đỉnh ngang dải có độ sáng riêng, giữ nguyên dọc theo lọn → ~7 vệt/lọn (giống thớ tóc chải), không cần texture
 const streak=[...Array(K)].map((_,k)=>1+0.36*(hash(o*0.0131+k*1.73)-0.5));
 for(const r of rows){ri++;for(let k=0;k<K;k++){const m=em?em[q]:0,cv=colorVar*streak[k]*(1+0.05*Math.sin(ri*0.37+o*0.01));HN.push(sn?sn[q]:null);q++;P.push(...r.pts[k]);N.push(0,0,0);Tg.push(...r.tan,1);Col.push(...BASE_COL.map((c,ci)=>(c*cv)*(1-m)+EDGE_COL[ci]*m))}}
 for(let j=0;j+1<rows.length;j++)for(let k=0;k+1<K;k++){const a=o+j*K+k,b=a+K;I.push(a,b,a+1,a+1,b,b+1)}
}
// 1) Lọn từ đường chân tóc về búi
const NS=112,SEG=26,K=7,US=[-1.4,...Array.from({length:K},(_,k)=>k/(K-1)*2-1),1.4],paths=[];let edgeMix=[];const scalpN=[]; // pháp tuyến da đầu dưới mỗi đỉnh tóc (để làm dịu bóng rãnh)
for(let s=0;s<NS;s++){
 const al=-Math.PI+(s+0.5)/NS*2*Math.PI;if(Math.abs(al)>Math.PI-0.12)continue; // ngay gáy giữa: búi che
 // trước trán/thái dương: bắt đầu dưới đường chân tóc (phần này chìm dưới da → mép tóc mọc ra theo đúng đường cong);
 // quanh tai: bắt đầu đúng tại đường chân tóc (không chạm vành tai)
 const d0=startDir(al,Math.abs(al)<1.05||Math.abs(al)>1.95?-0.07:0.004),pts=[];
 // Đường đi: bezier trên mặt cầu qua điểm trung gian được NÂNG về phía đỉnh đầu → tóc luôn vén qua đỉnh/vòng lên rồi mới vào búi
 // (tránh cung lớn "lật" sang hai bên khi hướng đầu và hướng búi gần đối nhau).
 const mid=nrm(add(add(d0,bunBaseDir),[0,1.3*Math.max(0.2,Math.cos(al/2)),0])),lat=nrm(cross(d0,bunBaseDir)),
  m2=add(sub(mul(mid,2),mul(add(d0,bunBaseDir),0.5)),mul(lat,(hash(s*17+3)-0.5)*0.32)); // lệch nhẹ mỗi lọn → hướng chải không song song tuyệt đối
 for(let j=0;j<=SEG;j++){const t=Math.pow(j/SEG,1.35)*0.93,d=nrm(add(add(mul(d0,(1-t)*(1-t)),mul(m2,2*t*(1-t))),mul(bunBaseDir,t*t))),sc=scalp(d);if(!sc)continue;pts.push({t,...sc})}
 let acc=0;pts.forEach((q,j)=>{if(j)acc+=len(sub(q.p,pts[j-1].p));q.s=acc});
 paths.push({al,pts});
}
paths.forEach((pa,i)=>{
 const L=paths[(i+paths.length-1)%paths.length],R=paths[(i+1)%paths.length],rows=[],v=0.86+0.28*hash(i+7);
 const crown=0.03+0.022*hash(i+3);
 pa.pts.forEach((q,j)=>{
  const nx=pa.pts[Math.min(j+1,pa.pts.length-1)],pv=pa.pts[Math.max(j-1,0)],tan=nrm(sub(nx.p,pv.p)),bi=nrm(cross(q.n,tan));
  const gap=Math.min(len(sub(L.pts[Math.min(j,L.pts.length-1)].p,q.p)),len(sub(R.pts[Math.min(j,R.pts.length-1)].p,q.p)));
  const hw=Math.max(0.012,gap*(0.75+0.65*hash(i*3+1))),t=q.t/0.93,gd=0.07+0.17*hash(i*11+5); // độ rộng + độ sâu rãnh khác nhau theo lọn
  // độ dày theo KHOẢNG CÁCH thật từ chân tóc (không theo tỉ lệ chiều dài lọn): mép gọn, đầy đặn sau ~4 cm; phồng ở đỉnh, thu vào búi
  const h=0.006+0.014*smooth(0.06,0.12,q.s)+crown*smooth(0.1,0.36,q.s)*(1-0.6*smooth(0.75,1,t))*(0.7+0.5*Math.max(0,q.p[1]))+0.016*smooth(0.35,0.62,Math.abs(q.p[0]))*smooth(0.1,0.3,q.s)*(1-smooth(0.7,1,t)); // + phồng hai bên
  // + 2 đỉnh "váy" sát da ngoài hai mép (u = ±1,4): lấp khe dưới mép lọn → nhìn sượt ở đỉnh đầu không thấy nền lọt qua giữa các lọn
  const pts=[];for(const u of US){const skirt=Math.abs(u)>1,prof=Math.sqrt(Math.max(0,1-u*u));
   // mặt cắt BÁM hộp sọ: chiếu điểm lệch ngang lên da đầu rồi nâng theo pháp tuyến tại đó (không chìm vào da ở chỗ cong)
   const sc=scalp(nrm(sub(add(q.p,mul(bi,u*hw)),C)))||q;
   // độ nâng theo TỪNG ĐỈNH: khoảng cách của chính đỉnh đó trên đường chân tóc → mép tóc mọc ra từ da theo đúng đường cong chân tóc
   const e=sc.p[1]-hairY(Math.atan2(sc.p[0],sc.p[2]-C[2]))-EMERGE,grow=smooth(0,0.1,e);
   const far=len(sub(sc.p,q.p))>hw*1.6+0.02; // điểm váy rơi lệch (vd. trúng vành tai) → chìm dưới da
   pts.push(add(sc.p,mul(sc.n,e<0||(skirt&&(e<0.02||far))?-0.006:skirt?0.0015+0.12*h*grow:0.0024+h*(1-gd+gd*prof)*(0.1+0.9*grow))));edgeMix.push(0.35*(1-smooth(-0.01,0.05,e)));scalpN.push([...sc.n,0.6+0.4*(1-smooth(0.02,0.1,e))])} // sát chỗ lọn nổi lên: pháp tuyến theo da đầu → không có gờ tối
  rows.push({pts,tan});
 });
 ribbon(rows,K+2,v,edgeMix,scalpN.splice(0));edgeMix=[];
});

// 1b) Lớp lọn phía trên: ít lọn mảnh hơn, bắt đầu lùi sau chân tóc, hướng hơi lệch, nổi cao hơn → phá vẻ song song đều
for(let s2=0;s2<34;s2++){
 const al=-Math.PI*0.86+(s2+hash(s2*29))/34*2*Math.PI*0.86,t0=0.1+0.16*hash(s2*31+2),t1=0.78+0.12*hash(s2*37);
 const d0=startDir(al,0),lat=nrm(cross(d0,bunBaseDir)),mid=nrm(add(add(d0,bunBaseDir),[0,1.3*Math.max(0.2,Math.cos(al/2)),0])),
  m2=add(sub(mul(mid,2),mul(add(d0,bunBaseDir),0.5)),mul(lat,(hash(s2*41+7)-0.5)*0.45));
 const pts=[];for(let j=0;j<=22;j++){const t=t0+(t1-t0)*j/22,d=nrm(add(add(mul(d0,(1-t)*(1-t)),mul(m2,2*t*(1-t))),mul(bunBaseDir,t*t))),sc=scalp(d);if(sc)pts.push({t,...sc})}
 if(pts.length<6)continue;
 const rows=[],em=[],sn=[],v=0.9+0.3*hash(s2*43),W=0.022+0.02*hash(s2*47),H2=0.03+0.018*hash(s2*53);
 pts.forEach((q,j)=>{const f=j/(pts.length-1),nx=pts[Math.min(j+1,pts.length-1)],pv=pts[Math.max(j-1,0)],tan=nrm(sub(nx.p,pv.p)),bi=nrm(cross(q.n,tan)),
  taper=smooth(0,0.25,f)*smooth(1,0.7,f),hw=W*(0.4+0.6*taper),out=[];
  for(let k=0;k<K;k++){const u=k/(K-1)*2-1,prof=Math.sqrt(Math.max(0,1-u*u)),sc=scalp(nrm(sub(add(q.p,mul(bi,u*hw)),C)))||q;
   out.push(add(sc.p,mul(sc.n,0.004+H2*taper*(0.6+0.4*prof))));em.push(0);sn.push(sc.n)}
  rows.push({pts:out,tan})});
 ribbon(rows,K,v,em,sn);
}
// 2) Búi: lõi elip + các lọn xoắn quanh
const bunAxis=nrm(bunBase.n),bx=nrm(cross([0,1,0],bunAxis)),by=nrm(cross(bunAxis,bx));
const onBun=(th,ph,sc=1)=>{const [rx,ry,rz]=BUN.r;return add(BUN.c,add(add(mul(bx,Math.cos(th)*Math.cos(ph)*rx*sc),mul(by,Math.sin(th)*Math.cos(ph)*ry*sc)),mul(bunAxis,Math.sin(ph)*rz*sc)))};
{const rows=[],NU=28,NV=16;for(let j=0;j<=NV;j++){const ph=-Math.PI/2+j/NV*Math.PI,pts=[];for(let k=0;k<=NU;k++)pts.push(onBun(k/NU*2*Math.PI,ph,0.93));rows.push({pts,tan:bx})}ribbon(rows,NU+1,0.8)}
const NB=14;for(let b=0;b<NB;b++){
 const rows=[],th0=b/NB*2*Math.PI,v=0.85+0.3*hash(b+50);
 for(let j=0;j<=40;j++){const s=j/40,th=th0+s*2.4,ph=-1.2+s*2.2,c=onBun(th,ph,1.0),cn=nrm(sub(c,BUN.c)),
  nx=onBun(th+0.06,ph+0.055,1.0),tan=nrm(sub(nx,c)),bi=nrm(cross(cn,tan)),hw=0.07*(0.6+0.4*Math.sin(Math.PI*s)),h=0.028*Math.sin(Math.PI*Math.min(1,s*1.15));
  const pts=[];for(let k=0;k<K;k++){const u=k/(K-1)*2-1,prof=Math.sqrt(Math.max(0,1-u*u));pts.push(add(add(c,mul(bi,u*hw)),mul(cn,0.004+h*(0.35+0.65*prof))))}
  rows.push({pts,tan})}
 ribbon(rows,K,v);
}
// Pháp tuyến: cộng theo diện tích
for(let i=0;i<I.length;i+=3){const [a,b,c]=[I[i],I[i+1],I[i+2]],A=P.slice(a*3,a*3+3),B=P.slice(b*3,b*3+3),Cc=P.slice(c*3,c*3+3),n=cross(sub(B,A),sub(Cc,A));
 for(const v of[a,b,c])for(let k=0;k<3;k++)N[v*3+k]+=n[k]}
for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l}
// Làm dịu bóng rãnh: trộn 45% pháp tuyến da đầu → silhouette vẫn có lọn, nhưng ánh sáng không vẽ thành sọc gân đều
for(let i=0;i<HN.length;i++){const h=HN[i];if(!h)continue;const hw=h[3]??0.6;let x=N[i*3]*(1-hw)+h[0]*hw,y=N[i*3+1]*(1-hw)+h[1]*hw,z=N[i*3+2]*(1-hw)+h[2]*hw;const l=Math.hypot(x,y,z)||1;N[i*3]=x/l;N[i*3+1]=y/l;N[i*3+2]=z/l}
// 1d) Lớp tóc tơ mép chân tóc: dải bám da, BÁN TRONG SUỐT theo đỉnh (alpha tăng dần từ dưới chân tóc lên vùng lọn đặc),
//     alpha dao động theo từng cột ≈ từng sợi → mép tóc mờ dần, lởm chởm tự nhiên thay vì mép cắt cứng như mũ/tóc giả
const FP=[],FN=[],FT=[],FC=[],FI=[];
{const NA=900,ROWS=[-0.03,-0.018,-0.008,0.002,0.012,0.024,0.038,0.054,0.07,0.088];
 let prev=-1;
 for(let c=0;c<=NA;c++){
  const al=-2.95+5.9*c/NA,earGap=Math.abs(al)>1.12&&Math.abs(al)<1.8;
  const jit=(hash(c*13+1)-0.5)*0.016+(hash(Math.floor(c/3)*7+5)-0.5)*0.012; // điểm bắt đầu mọc của từng sợi
  const strong=hash(c*17+3),col=[];
  for(const r of ROWS){
   const tf=smooth(0.5,0.8,Math.abs(al))*smooth(1.3,1.0,Math.abs(al)),rr0=r*(1+0.45*tf),e=rr0-jit,lean=Math.max(0,r+0.022)*(1.1*Math.sin(3.3*al+0.4)+0.6*Math.sin(8.1*al+1.3)),alr=al+lean;const d=startDir(alr,earGap?Math.max(rr0,0):rr0),q=scalp(d);if(!q){col.length=0;break}
   const a0=Math.pow(smooth(-0.03,0.078,e),1.2)*0.97,mod=0.3+0.7*strong,am=a0*(mod+(1-mod)*smooth(0.03,0.088,r));
   const alpha=(earGap&&r<0?0:am);
   col.push({p:add(q.p,mul(q.n,0.0016+0.0006*smooth(0,0.04,r))),n:q.n,alpha,light:1-smooth(-0.02,0.025,e)})}
  if(col.length!==ROWS.length){prev=-1;continue}
  const o=FP.length/3;
  col.forEach((v,k)=>{const up=col[Math.min(k+1,col.length-1)].p,dn=col[Math.max(k-1,0)].p,tan=nrm(sub(up,dn));
   FP.push(...v.p);FN.push(...v.n);FT.push(...tan,1);const m=0.3*v.light,cv=0.85+0.3*hash(c*5);
   FC.push(...BASE_COL.map((x,ci)=>x*cv*(1-m)+EDGE_COL[ci]*m),v.alpha)});
  if(prev>=0)for(let k=0;k+1<ROWS.length;k++){const a=prev+k,b=o+k;FI.push(a,b,a+1,a+1,b,b+1)}
  prev=o;
 }}
const nv=P.length/3;if(nv>65535)throw new Error(`tóc quá nhiều đỉnh cho uint16: ${nv}`);

// (lông mày dùng BROW_K3 – định nghĩa ngay dưới)
// ---------- Lông mày: các nét sợi mảnh bám da theo đường cong mày (lưới tự tạo) ----------
const BP=[],BN=[],BT=[],BC=[],BI=[];const BROW_COL=[0.30,0.205,0.155];
const BROW_K3=(ex,ey)=>[[ex*0.36,ey+0.118],[ex*0.75,ey+0.148],[ex+0.05,ey+0.165],[ex+0.13,ey+0.148],[ex+0.19,ey+0.112]];
function browSide(sg){
 const e=LM.eyeL,ex=Math.abs(e[0]),ey=e[1];
 // đầu mày → đỉnh cung → đuôi mày (x tính từ giữa mặt, y theo tâm mắt); độ dày dải mày giảm dần về đuôi
 const K3=BROW_K3(ex,ey);
 const curve=t=>{const n=K3.length-1,f=Math.min(n-1e-9,t*n),k=Math.floor(f),u=f-k,P0=K3[Math.max(0,k-1)],P1=K3[k],P2=K3[k+1],P3=K3[Math.min(n,k+2)];
  return [0,1].map(c=>0.5*((2*P1[c])+(-P0[c]+P2[c])*u+(2*P0[c]-5*P1[c]+4*P2[c]-P3[c])*u*u+(-P0[c]+3*P1[c]-3*P2[c]+P3[c])*u*u*u))};
 const onSkin=(x,y)=>{const d=nrm(sub([x*sg,y,0.85],[0,y*0.6,-0.2]));const h=cast([0,y*0.6,-0.2],d);if(!h)return null;const t=h.tri,i=[SI[t*3],SI[t*3+1],SI[t*3+2]],w=[1-h.u-h.v,h.u,h.v];let n=[0,0,0];for(let k=0;k<3;k++)n=add(n,mul([SN[i[k]*3],SN[i[k]*3+1],SN[i[k]*3+2]],w[k]));return {p:add([0,y*0.6,-0.2],mul(d,h.t)),n:nrm(n)}};
 const M=420;
 for(let m=0;m<M;m++){
  const t=(m+0.5)/M,c=curve(t),c2=curve(Math.min(1,t+0.01)),dir2=nrm([c2[0]-c[0],c2[1]-c[1]]),band=0.042*(1-t)+0.010*t,off=(hash(m*7+(sg>0?1:2))-0.5)*band;
  // hướng sợi: đầu mày hướng lên, giữa hướng ra ngoài-lên, đuôi xuôi theo cung
  const ang=(1-smooth(0,0.35,t))*1.25+smooth(0,0.35,t)*0.35-smooth(0.6,1,t)*0.55+(hash(m*13)-0.5)*0.25;
  const sdir=[Math.cos(ang),Math.sin(ang)],L=(0.022+0.016*Math.sin(Math.PI*Math.min(1,t*1.2)))*(0.8+0.4*hash(m*5));
  const root=[c[0]-dir2[1]*off,c[1]+dir2[0]*off-band*0.15],pts=[];
  for(let j=0;j<4;j++){const f=j/3,q=onSkin(root[0]+sdir[0]*L*f,root[1]+sdir[1]*L*f+(-0.004*f*f));if(!q)break;pts.push(q)}
  if(pts.length<4)continue;
  const o=BP.length/3,v=0.85+0.3*hash(m*3+(sg>0?5:9));
  // độ đậm từng nét: dày ở thân mày, mờ dần ra mép dải và hai đầu (đầu mày nhạt, đuôi mày thanh) → hình mày mềm, không như nét vẽ
  const aS=(0.42+0.4*hash(m*37+(sg>0?2:4)))*(1-0.65*smooth(0.22,0.5,Math.abs(off)/band))*(0.45+0.55*smooth(0,0.16,t))*(1-0.45*smooth(0.82,1,t));
  pts.forEach((q,j)=>{const nx=pts[Math.min(j+1,3)].p,pv=pts[Math.max(j-1,0)].p,tan=nrm(sub(nx,pv)),bi=nrm(cross(q.n,tan)),w=0.0024*(1-j/3*0.8);
   for(const u of[-1,1]){BP.push(...add(add(q.p,mul(bi,u*w)),mul(q.n,0.0028+0.0012*(1-j/3))));BN.push(...q.n);BT.push(...tan,1);BC.push(...BROW_COL.map(x=>x*v),aS*(1-0.6*j/3))}});
  for(let j=0;j<3;j++){const a=o+j*2;if(sg>0)BI.push(a,a+2,a+1,a+1,a+2,a+3);else BI.push(a,a+1,a+2,a+1,a+3,a+2)}
 }
}
browSide(1);browSide(-1);
// ---------- Lông mi: dựng trên khung mi MakeHuman (bờ mi đúng theo hình dạng mắt đã chỉnh), lưới tự tạo ----------
// Gốc = các đỉnh khung nằm sát nhãn cầu (bờ mi); hướng = từ gốc ra hàng đỉnh kế tiếp của khung. Mi trên dài, cong lên,
// dài dần về đuôi mắt; mi dưới ngắn, thưa, nhạt. Gộp vào lưới "brows" (cùng vật liệu sợi mảnh hai mặt) → không thêm draw call.
const LH=json.nodes.find(n=>n.extras?.landmarks).extras.lashHelper||{};const LASH_ROOTS=[];
for(const [gname,g] of Object.entries(LH)){
 const left=/-l-/.test(gname),E=left?LM.eyeL:LM.eyeR,n=g.v.length/3,V=i=>[g.v[i*3],g.v[i*3+1],g.v[i*3+2]];
 const meanY=[...Array(n).keys()].reduce((s,i)=>s+g.v[i*3+1],0)/n,upper=meanY>E[1];
 const d=i=>len(sub(V(i),E)),root=[...Array(n).keys()].filter(i=>d(i)<LM.eyeRadius+0.009);
 const nb=new Map;for(const f of g.f)for(const a of f)for(const b of f)if(a!==b){if(!nb.has(a))nb.set(a,new Set);nb.get(a).add(b)}
 const R0=root.map(i=>{const outs=[...(nb.get(i)||[])].filter(j=>!root.includes(j));const dir=outs.length?nrm(outs.reduce((s,j)=>add(s,sub(V(j),V(i))),[0,0,0])):nrm(sub(V(i),E));
  return {p:V(i),dir,ax:Math.abs(V(i)[0])}}).sort((a,b)=>a.ax-b.ax); // từ khóe trong ra đuôi mắt
 if(R0.length<3)continue;
 let acc=0;R0.forEach((r,k)=>{if(k)acc+=len(sub(r.p,R0[k-1].p));r.s=acc});const tot=acc;
 const at=u=>{const s0=u*tot;let k=1;while(k<R0.length-1&&R0[k].s<s0)k++;const a=R0[k-1],b=R0[k],t=(s0-a.s)/Math.max(1e-6,b.s-a.s);
  return {p:add(a.p,mul(sub(b.p,a.p),t)),dir:nrm(add(mul(a.dir,1-t),mul(b.dir,t))),tg:nrm(sub(b.p,a.p))}};
 LASH_ROOTS.push({upper,pts:R0.map(r=>r.p)});
 const M=upper?84:20,col=upper?[0.075,0.052,0.042]:[0.17,0.125,0.105];
 for(let m=0;m<M;m++){
  const u=Math.min(0.995,Math.max(0.005,(m+0.5)/M+(hash(m*19+(left?3:7))-0.5)*0.6/M)),q=at(u);
  // mi mọc thành chùm nhỏ (3 sợi chung hướng, ngọn hơi chụm), dài/ngắn xen kẽ, khóe trong ngắn & thưa → tự nhiên, không như mi giả
  const cl=Math.floor(m/3),cs=hash(cl*41+(left?1:2));
  const L=upper?(0.030+0.022*smooth(0.08,0.7,u)-0.01*smooth(0.88,1,u))*(0.7+0.25*cs+0.3*hash(m*23+1))*(0.6+0.4*smooth(0,0.15,u)):(0.010+0.008*smooth(0.3,0.8,u))*(0.6+0.6*hash(m*29));
  const curl=[0,upper?1:-1,0],fan=mul(q.tg,(u-0.45)*(upper?0.45:0.3)+(cs-0.5)*0.22+(hash(m*31)-0.5)*0.1),pts=[];
  for(let j=0;j<5;j++){const t=j/4;pts.push(add(add(q.p,mul(nrm(add(q.dir,fan)),L*t)),mul(curl,L*(upper?0.55:0.3)*t*t)))}
  const o=BP.length/3;pts.forEach((pp,j)=>{const tan=nrm(sub(pts[Math.min(j+1,4)],pts[Math.max(j-1,0)])),bi=q.tg,nn=nrm(cross(tan,bi)),w=(upper?0.003:0.0009)*Math.pow(1-j/4*0.9,1.5),al=(upper?1:0.5)*(1-(upper?0.55:0.85)*j/4)*(0.8+0.2*hash(m*43));
   for(const s2 of[-1,1]){BP.push(...add(pp,mul(bi,s2*w)));BN.push(...nn);BT.push(...tan,1);BC.push(...col,al)}});
  for(let j=0;j<4;j++){const a=o+j*2;BI.push(a,a+2,a+1,a+1,a+2,a+3)}
 }
}
// Khoang miệng: một khối elip tối nằm sau khe môi → không nhìn xuyên qua khe miệng ra nền/phía sau đầu
{const M0=LM.mouth,c=[0,M0[1]+0.015,M0[2]-0.19],r=[0.21,0.05,0.11],NU=16,NV=8,o=BP.length/3;
 for(let j=0;j<=NV;j++){const ph=-Math.PI/2+j/NV*Math.PI;for(let k=0;k<=NU;k++){const th=k/NU*2*Math.PI,nn=[Math.cos(ph)*Math.cos(th),Math.sin(ph),Math.cos(ph)*Math.sin(th)];
  BP.push(c[0]+r[0]*nn[0],c[1]+r[1]*nn[1],c[2]+r[2]*nn[2]);BN.push(...nn);BT.push(1,0,0,1);BC.push(0.035,0.012,0.012,1)}}
 for(let j=0;j<NV;j++)for(let k=0;k<NU;k++){const a=o+j*(NU+1)+k,b=a+NU+1;BI.push(a,b,a+1,a+1,b,b+1)}}
// Mặt nạ da đầu trên lưới da: 1 = dưới tóc; mép mềm quanh đường chân tóc
const SH=new Float32Array(SP.length/3),SL=new Float32Array(SP.length/3);
// mép mí trên theo từng cột x: điểm da cắt nhãn cầu nằm trước nhất (z lớn nhất) ở nửa trên mắt
const LIDM=[LM.eyeL,LM.eyeR].map(E=>{const x0=E[0]-LM.eyeRadius,nb=Math.ceil(2*LM.eyeRadius/0.008),y=Array(nb).fill(null),zb=Array(nb).fill(-9);
 for(let i=0;i<SP.length/3;i++){const x=SP[i*3],yy=SP[i*3+1],z=SP[i*3+2],dE=Math.hypot(x-E[0],yy-E[1],z-E[2])-LM.eyeRadius;if(Math.abs(dE)<0.01&&yy>E[1]-0.01&&yy<E[1]+0.07&&Math.abs(x-E[0])<0.85*LM.eyeRadius&&z>E[2]+0.03){const b=Math.floor((x-x0)/0.008);if(b>=0&&b<nb&&z>zb[b]){zb[b]=z;y[b]=yy}}}
 // làm trơn theo cột (trung vị 3) để bỏ điểm lạc
 const ys=y.map((v,b)=>{const w=[y[b-1],v,y[b+1]].filter(t=>t!=null).sort((a,c)=>a-c);return w.length?w[Math.floor(w.length/2)]:null});
 const med=[...ys].filter(t=>t!=null).sort((a,c)=>a-c),mid=med[Math.floor(med.length/2)];
 return {x0,y:ys.map(t=>t!=null&&Math.abs(t-mid)<0.035?t:null),z:E[2],ex:E[0]}});
const distPoly=(p,pts)=>{let b=9;for(let k=0;k+1<pts.length;k++){const a=pts[k],d=sub(pts[k+1],a),t=Math.max(0,Math.min(1,dot(sub(p,a),d)/Math.max(1e-9,dot(d,d))));b=Math.min(b,len(sub(p,add(a,mul(d,t)))))}return b};
for(let i=0;i<SH.length;i++){const x=SP[i*3],y=SP[i*3+1],z=SP[i*3+2],al=Math.atan2(x,z-C[2]);
 SH[i]=smooth(-0.03,0.08,y-hairY(al))*(Math.hypot(x,z)<1.2?1:0);
 // nền lông mày: dải mờ dưới các nét (≈30% màu tóc), mép mềm, chỉ ở mặt trước
 if(SN[i*3+2]>0.25){const e=LM.eyeL,ex=Math.abs(e[0]),ey=e[1],K=BROW_K3(ex,ey),ax=Math.abs(x);let best=9,bt=0;
  for(let k=0;k<=40;k++){const t=k/40,f=t*(K.length-1),j=Math.min(K.length-2,Math.floor(f)),u=f-j,px=K[j][0]+(K[j+1][0]-K[j][0])*u,py=K[j][1]+(K[j+1][1]-K[j][1])*u,d=Math.hypot(ax-px,y-py);if(d<best){best=d;bt=t}}
  const half=0.021*(1-bt)+0.006*bt;SH[i]=Math.max(SH[i],0.36*smooth(half*1.9,half*0.5,best)*smooth(0,0.08,bt+0.02)*smooth(1,0.85,bt))}
 // Đường chân mi: bờ mi trên sẫm (như hàng chân mi dày), bờ mi dưới nhạt hơn
 // bờ mi trên: dải da ngay trên mép mí (chỗ mí trên phủ lên nhãn cầu) sẫm như hàng chân mi dày → mắt có viền tự nhiên khi nhìn từ xa
 for(const M2 of LIDM){const b=Math.floor((x-M2.x0)/0.008);if(b>=0&&b<M2.y.length&&M2.y[b]!=null&&SN[i*3+2]>0.1&&z>M2.z){const dy=y-M2.y[b];SH[i]=Math.max(SH[i],0.8*smooth(-0.006,0.0,dy)*smooth(0.022,0.004,dy)*smooth(0.85*LM.eyeRadius,0.55*LM.eyeRadius,Math.abs(x-M2.ex)))}}
 for(const lr of LASH_ROOTS){const dd=distPoly([x,y,z],lr.pts);if(dd<0.02)SH[i]=Math.max(SH[i],(lr.upper?0.85:0.25)*smooth(lr.upper?0.028:0.012,0.003,dd))}
 // Môi: vùng son môi theo mốc miệng (khe môi ≈ mốc miệng + 0.023); môi trên mỏng hơn môi dưới, cung Cupid nhẹ, mép mềm
 {const M0=LM.mouth,ys=M0[1]+0.023,xc=0.165,u=Math.abs(x)/xc;if(u<1.15&&SN[i*3+2]>0.15&&z>M0[2]-0.2){
  const w=Math.max(0,1-u*u),top=ys+0.064*Math.pow(w,0.75)-0.009*Math.exp(-((x/0.022)**2))+0.004*Math.exp(-(((Math.abs(x)-0.04)/0.025)**2)),bot=ys-0.092*Math.pow(Math.max(0,1-(Math.abs(x)/(xc*0.94))**2),0.6);
  SL[i]=smooth(top+0.01,top-0.008,y)*smooth(bot-0.012,bot+0.01,y)*smooth(1.12,0.88,u)}
  // mặt trong môi (khuất sau khe miệng) → sẫm như bóng khoang miệng, không lộ mép sáng ở khóe
  if(Math.abs(x)<0.2&&Math.abs(y-ys)<0.022&&SN[i*3+2]<0.35&&z<M0[2]-0.02&&z>M0[2]-0.3)SH[i]=Math.max(SH[i],0.8*smooth(0.35,0.1,SN[i*3+2]))}
}

// ---------- Ghi GLB ----------
const pad4=x=>(4-x%4)%4;let blen=bin.length;const parts=[bin];
const view=(arr,target)=>{const p=pad4(blen);if(p){parts.push(new Uint8Array(p));blen+=p}
 const bv=json.bufferViews.push({buffer:0,byteOffset:blen,byteLength:arr.byteLength,...(target?{target}:{})})-1;parts.push(new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength));blen+=arr.byteLength;return bv};
const accP=(arr,type,ct,target,mm)=>json.accessors.push({bufferView:view(arr,target),componentType:ct,count:arr.length/({VEC3:3,VEC4:4,SCALAR:1}[type]),type,...(mm||{})})-1;
function addMesh(name,P,N,Tg,Col,I,col,rough,opt={}){
 const P32=Float32Array.from(P),mn=[0,1,2].map(k=>Math.min(...P32.filter((_,i)=>i%3===k))),mx=[0,1,2].map(k=>Math.max(...P32.filter((_,i)=>i%3===k)));
 const attrs={POSITION:accP(P32,'VEC3',5126,34962,{min:mn,max:mx}),NORMAL:accP(Float32Array.from(N),'VEC3',5126,34962),TANGENT:accP(Float32Array.from(Tg),'VEC4',5126,34962),COLOR_0:accP(Float32Array.from(Col),opt.rgba?'VEC4':'VEC3',5126,34962)};
 const idx=accP(Uint16Array.from(I),'SCALAR',5123,34963);
 const mat=json.materials.push({name,pbrMetallicRoughness:{baseColorFactor:[...col,1],metallicFactor:0,roughnessFactor:rough}})-1;
 const mi=json.meshes.push({name,primitives:[{attributes:attrs,indices:idx,material:mat}]})-1;
 if(name==='brows')json.materials[mat].doubleSided=true;
 if(opt.rgba)json.materials[mat].alphaMode='BLEND'; // nét mảnh hai mặt (đối xứng trái/phải không bị loại mặt sau)
 const ni=json.nodes.push({name,mesh:mi})-1;json.nodes.find(n=>n.name==='head').children.push(ni);
}
addMesh('hair',P,N,Tg,Col,I,BASE_COL,0.5);
addMesh('brows',BP,BN,BT,BC,BI,BROW_COL,0.7,{rgba:true}); // lông mày + mi bán trong suốt theo đỉnh (ngọn sợi mờ dần) + khoang miệng (đục)
addMesh('hairline',FP,FN,FT,FC,FI,BASE_COL,0.75,{rgba:true});
skinM.attributes._HAIR=accP(SH,'SCALAR',5126,34962);
skinM.attributes._LIP=accP(SL,'SCALAR',5126,34962);
delete json.nodes.find(n=>n.extras?.landmarks).extras.lashHelper; // dữ liệu tạm, không đưa vào GLB
json.nodes.find(n=>n.extras?.landmarks).extras.hair={style:'vén gọn ra sau, búi thấp',hairline:HL,bun:{c:BUN.c,r:BUN.r},tool:'tools/build-hair.mjs'};
json.buffers[0].byteLength=blen+pad4(blen);if(pad4(blen))parts.push(new Uint8Array(pad4(blen)));blen=json.buffers[0].byteLength;
let js=new TextEncoder().encode(JSON.stringify(json));if(pad4(js.length)){const t=new Uint8Array(js.length+pad4(js.length));t.set(js);t.fill(0x20,js.length);js=t}
const total=28+js.length+blen,o8=new Uint8Array(total),w=new DataView(o8.buffer);
w.setUint32(0,0x46546C67,true);w.setUint32(4,2,true);w.setUint32(8,total,true);w.setUint32(12,js.length,true);w.setUint32(16,0x4E4F534A,true);o8.set(js,20);
w.setUint32(20+js.length,blen,true);w.setUint32(24+js.length,0x004E4942,true);let off=28+js.length;for(const p of parts){o8.set(p,off);off+=p.length}
writeFileSync(out,o8);console.error(`Đã ghi ${out}: tóc ${nv} đỉnh, ${I.length/3} tam giác, ${paths.length} lọn + búi ${NB} lọn; lông mày ${BP.length/3} đỉnh; ${(total/1024)|0} KB`);
