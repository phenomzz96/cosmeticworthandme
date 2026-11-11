// Bake che khuất môi trường (ambient occlusion) theo đỉnh vào assets/head.glb (0.5).
//   node tools/bake-ao.mjs                       → đọc assets/head.glb, ghi đè assets/head.glb (có _AO)
//   node tools/bake-ao.mjs <vào.glb> <ra.glb>    → tùy chọn đường dẫn
// • KHÔNG đổi hình học: vị trí, pháp tuyến, chỉ số tam giác, mốc giải phẫu (extras.landmarks), bản quyền giữ nguyên byte-đúng.
// • Chỉ THÊM thuộc tính đỉnh "_AO" (float 0..1; 1 = không bị che) cho lưới "skin" và "eyes" (glTF: thuộc tính tùy chỉnh bắt đầu bằng "_").
// • Thuật toán: với mỗi đỉnh, bắn N tia phân bố cosin trên bán cầu quanh pháp tuyến (xác định, không ngẫu nhiên), tìm giao với mọi
//   tam giác của cả 3 lưới (lưới đều tăng tốc + Möller–Trumbore), trọng số giảm dần theo khoảng cách (chỉ che khuất cục bộ: hốc mắt,
//   cánh mũi, khe môi, tai, dưới cằm), rồi làm mịn trên lân cận lưới để không nhiễu. Kết quả tất định → chạy lại cho ra cùng tệp.
import {readFileSync,writeFileSync} from 'node:fs';

const RAYS=64,RADIUS=0.32,EPS=1.5e-3,SMOOTH=2;
const [inp='assets/head.glb',out=inp]=process.argv.slice(2);

// ---- GLB đọc/ghi tối giản ----
const buf=readFileSync(inp),dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
if(dv.getUint32(0,true)!==0x46546C67)throw new Error('không phải GLB');
const jl=dv.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(buf.subarray(20,20+jl)));
const binStart=20+jl+8,binLen=dv.getUint32(20+jl,true),bin=buf.subarray(binStart,binStart+binLen);
if(json.meshes.some(m=>m.primitives[0].attributes._AO)){console.error('Tệp đã có _AO. Hãy chạy trên GLB chưa bake (vd. dựng lại bằng tools/build-head.mjs).');process.exit(1)}
const acc=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],T=a.componentType===5126?Float32Array:a.componentType===5123?Uint16Array:Uint32Array,
 n=a.count*({VEC3:3,SCALAR:1}[a.type]),o=(v.byteOffset||0)+(a.byteOffset||0);return new T(bin.buffer.slice(bin.byteOffset+o,bin.byteOffset+o+n*T.BYTES_PER_ELEMENT))};
const meshes=Object.fromEntries(json.meshes.map((m,mi)=>{const p=m.primitives[0];return [m.name,{mi,pos:acc(p.attributes.POSITION),nor:acc(p.attributes.NORMAL),idx:acc(p.indices)}]}));
for(const n of json.nodes)if(n.mesh!=null&&(n.matrix||n.rotation||n.scale||n.translation))throw new Error('nút có phép biến đổi – công cụ giả định tọa độ lưới = tọa độ thế giới');

// ---- Gom tam giác của mọi lưới + lưới đều tăng tốc ----
const tris=[];for(const m of Object.values(meshes))for(let i=0;i<m.idx.length;i+=3){const t=[];for(let k=0;k<3;k++){const j=m.idx[i+k];t.push(m.pos[j*3],m.pos[j*3+1],m.pos[j*3+2])}tris.push(t)}
const NT=tris.length,TV=new Float32Array(NT*9);tris.forEach((t,i)=>TV.set(t,i*9));
let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<TV.length;i+=3)for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],TV[i+c]);hi[c]=Math.max(hi[c],TV[i+c])}
lo=lo.map(x=>x-1e-3);hi=hi.map(x=>x+1e-3);
const H=0.04,G=[0,1,2].map(c=>Math.max(1,Math.ceil((hi[c]-lo[c])/H)));
const cellOf=(c,x)=>Math.min(G[c]-1,Math.max(0,Math.floor((x-lo[c])/H)));
const cells=new Map;
for(let t=0;t<NT;t++){const o=t*9,a=[0,1,2].map(c=>Math.min(TV[o+c],TV[o+3+c],TV[o+6+c])),b=[0,1,2].map(c=>Math.max(TV[o+c],TV[o+3+c],TV[o+6+c]));
 for(let x=cellOf(0,a[0]);x<=cellOf(0,b[0]);x++)for(let y=cellOf(1,a[1]);y<=cellOf(1,b[1]);y++)for(let z=cellOf(2,a[2]);z<=cellOf(2,b[2]);z++){
  const k=(x*G[1]+y)*G[2]+z;let l=cells.get(k);if(!l)cells.set(k,l=[]);l.push(t)}}
const CELLS=new Map([...cells].map(([k,l])=>[k,Int32Array.from(l)]));

// Möller–Trumbore: khoảng cách t>0 tới tam giác hoặc Infinity
function hitTri(o,ox,oy,oz,dx,dy,dz){
 const ax=TV[o],ay=TV[o+1],az=TV[o+2],e1x=TV[o+3]-ax,e1y=TV[o+4]-ay,e1z=TV[o+5]-az,e2x=TV[o+6]-ax,e2y=TV[o+7]-ay,e2z=TV[o+8]-az;
 const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)return Infinity;
 const inv=1/det,tx=ox-ax,ty=oy-ay,tz=oz-az,u=(tx*px+ty*py+tz*pz)*inv;if(u<0||u>1)return Infinity;
 const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(dx*qx+dy*qy+dz*qz)*inv;if(v<0||u+v>1)return Infinity;
 const t=(e2x*qx+e2y*qy+e2z*qz)*inv;return t>1e-6?t:Infinity;
}
// Duyệt lưới theo tia (Amanatides–Woo) tới RADIUS; trả khoảng cách giao gần nhất hoặc Infinity.
const stamp=new Uint32Array(NT);let ray=0;
function cast(ox,oy,oz,dx,dy,dz){
 ray++;const o=[ox,oy,oz],d=[dx,dy,dz],cell=[0,1,2].map(c=>cellOf(c,o[c])),step=d.map(v=>v>0?1:-1);
 const tMax=[0,1,2].map(c=>d[c]===0?Infinity:((lo[c]+(cell[c]+(step[c]>0?1:0))*H)-o[c])/d[c]),tD=d.map(v=>v===0?Infinity:Math.abs(H/v));
 let best=Infinity,t0=0;
 while(t0<=Math.min(RADIUS,best)){
  const l=CELLS.get((cell[0]*G[1]+cell[1])*G[2]+cell[2]);
  if(l)for(const t of l){if(stamp[t]===ray)continue;stamp[t]=ray;const h=hitTri(t*9,ox,oy,oz,dx,dy,dz);if(h<best)best=h}
  const a=tMax[0]<tMax[1]?(tMax[0]<tMax[2]?0:2):(tMax[1]<tMax[2]?1:2);t0=tMax[a];cell[a]+=step[a];
  if(cell[a]<0||cell[a]>=G[a])break;tMax[a]+=tD[a];
 }
 return best<=RADIUS?best:Infinity;
}
// Hướng phân bố cosin (xoắn Fibonacci) trong hệ tọa độ cục bộ; xoay theo góc tất định mỗi đỉnh để tránh vân.
const DIRS=[];for(let i=0;i<RAYS;i++){const u=(i+0.5)/RAYS,r=Math.sqrt(u),ph=i*2.399963229728653;DIRS.push([r*Math.cos(ph),r*Math.sin(ph),Math.sqrt(1-u)])}
function aoAt(px,py,pz,nx,ny,nz,seed){
 const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
 const ux=Math.abs(nx)<0.9?1:0,uy=Math.abs(nx)<0.9?0:1;let tx=uy*nz-0*ny,ty=0*nx-ux*nz,tz=ux*ny-uy*nx;const tl=Math.hypot(tx,ty,tz);tx/=tl;ty/=tl;tz/=tl;
 const bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx,rot=(seed*0.6180339887)%1*Math.PI*2,cr=Math.cos(rot),sr=Math.sin(rot);
 const ox=px+nx*EPS,oy=py+ny*EPS,oz=pz+nz*EPS;let occ=0;
 for(const [a0,b0,c] of DIRS){const a=a0*cr-b0*sr,b=a0*sr+b0*cr,dx=tx*a+bx*b+nx*c,dy=ty*a+by*b+ny*c,dz=tz*a+bz*b+nz*c;
  const h=cast(ox,oy,oz,dx,dy,dz);if(h!==Infinity){const f=h/RADIUS;occ+=1-f*f}}
 return 1-occ/RAYS;
}
function bake(m){
 const n=m.pos.length/3,ao=new Float32Array(n);
 for(let i=0;i<n;i++)ao[i]=aoAt(m.pos[i*3],m.pos[i*3+1],m.pos[i*3+2],m.nor[i*3],m.nor[i*3+1],m.nor[i*3+2],i);
 // làm mịn theo lân cận lưới (trung bình có trọng số với chính đỉnh) – bỏ nhiễu, giữ hình dạng vùng tối
 const nb=Array.from({length:n},()=>new Set);for(let i=0;i<m.idx.length;i+=3)for(let k=0;k<3;k++)for(let q=0;q<3;q++)if(k!==q)nb[m.idx[i+k]].add(m.idx[i+q]);
 for(let s=0;s<SMOOTH;s++){const nx=new Float32Array(n);for(let i=0;i<n;i++){let sum=ao[i]*2,c=2;for(const j of nb[i]){sum+=ao[j];c++}nx[i]=sum/c}ao.set(nx)}
 return ao;
}
const t0=Date.now(),res={};for(const name of ['skin','eyes'])if(meshes[name]){res[name]=bake(meshes[name]);console.log(`${name}: ${res[name].length} đỉnh, AO trung bình ${(res[name].reduce((a,b)=>a+b,0)/res[name].length).toFixed(3)}, nhỏ nhất ${Math.min(...res[name]).toFixed(3)}`)}
console.log(`bake xong trong ${((Date.now()-t0)/1000).toFixed(1)} s (${NT} tam giác, ${RAYS} tia/đỉnh, bán kính ${RADIUS})`);

// ---- Ghi GLB: nối thêm bufferView/accessor _AO vào cuối BIN ----
let blen=bin.length,parts=[bin];const pad4=x=>(4-x%4)%4;
for(const [name,ao] of Object.entries(res)){
 const p=pad4(blen);if(p){parts.push(new Uint8Array(p));blen+=p}
 const bv=json.bufferViews.push({buffer:0,byteOffset:blen,byteLength:ao.byteLength,target:34962})-1;
 let mn=1,mx=0;for(const v of ao){if(v<mn)mn=v;if(v>mx)mx=v}
 const ac=json.accessors.push({bufferView:bv,componentType:5126,count:ao.length,type:'SCALAR',min:[mn],max:[mx]})-1;
 json.meshes[meshes[name].mi].primitives[0].attributes._AO=ac;
 parts.push(new Uint8Array(ao.buffer));blen+=ao.byteLength;
}
const bp=pad4(blen);if(bp){parts.push(new Uint8Array(bp));blen+=bp}
json.buffers[0].byteLength=blen;
json.asset.extras={...(json.asset.extras||{}),ao:{tool:'tools/bake-ao.mjs',rays:RAYS,radius:RADIUS,smooth:SMOOTH,note:'Che khuất môi trường theo đỉnh; hình học không đổi.'}};
let js=new TextEncoder().encode(JSON.stringify(json));const jp=pad4(js.length);if(jp){const t=new Uint8Array(js.length+jp);t.set(js);t.fill(0x20,js.length);js=t}
const total=12+8+js.length+8+blen,o=new Uint8Array(total),w=new DataView(o.buffer);
w.setUint32(0,0x46546C67,true);w.setUint32(4,2,true);w.setUint32(8,total,true);
w.setUint32(12,js.length,true);w.setUint32(16,0x4E4F534A,true);o.set(js,20);
w.setUint32(20+js.length,blen,true);w.setUint32(24+js.length,0x004E4942,true);let off=28+js.length;for(const p of parts){o.set(p,off);off+=p.length}
writeFileSync(out,o);console.log(`đã ghi ${out}: ${total} byte`);
