// Dựng assets/head.glb (tượng bán thân trung tính) từ lưới gốc MakeHuman "hm08" (base.obj) – giấy phép CC0 1.0.
// Chạy: node tools/build-head.mjs <đường-dẫn>/makehuman/data/3dobjs/base.obj [assets/head.glb]
// Lấy base.obj: git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman
//               (cd makehuman && git sparse-checkout set --no-cone /makehuman/data/3dobjs/base.obj /LICENSE.ASSETS.md)
// Các bước (không dùng thư viện ngoài, không Blender):
//  1. Lấy nhóm "body" (phần trên ngực), làm mịn MỘT lần bằng Catmull–Clark (chuẩn cho lưới tứ giác dựng hình:
//     giữ hình dạng, chỉ làm bề mặt/đường viền trơn hơn), rồi chia tứ giác thành tam giác.
//  2. Cắt tượng bán thân bằng mặt cong y = CUT_Y0 + CUT_K·x² – cắt CHÍNH XÁC qua từng tam giác (mép trơn, không răng cưa),
//     điểm cắt dùng chung theo cạnh để bề mặt liền mạch. Bịt đáy bằng các tam giác quạt (lưới kín khi nhìn từ dưới).
//  3. Thay mắt low-poly của MakeHuman bằng nhãn cầu trơn đặt đúng tâm/bán kính cũ (phong cách tượng).
//  4. Chuẩn hóa: chiều cao đầu (đỉnh → cằm) = 2 đơn vị, tâm đầu ở gốc tọa độ, mặt hướng +z, bên trái người = +x.
//  5. Pháp tuyến đỉnh trơn (cộng theo diện tích); mốc giải phẫu (mắt, đầu mũi, miệng, cằm, đỉnh đầu) ghi vào extras.
//  6. Ghi GLB 2.0 (POSITION, NORMAL, chỉ số uint16), 3 mesh: skin, eyes, cap.
import {readFileSync,writeFileSync} from 'node:fs';
const SRC=process.argv[2],OUT=process.argv[3]||new URL('../assets/head.glb',import.meta.url).pathname;
if(!SRC){console.error('Thiếu đường dẫn base.obj');process.exit(1)}
// Các hằng số theo đơn vị gốc của MakeHuman (dm). Đã đo trên lưới: đỉnh đầu y=8.49, cằm y≈6.15, tâm mắt y=7.284.
// 0.5.1: hỗ trợ lưới đã áp morph target (tools/apply-targets.mjs). Các mốc chuẩn hóa đi theo ĐỈNH cố định của lưới MakeHuman
// (đỉnh đầu #881, cằm #991, khe môi #509) thay vì hằng số tuyệt đối → đầu luôn được chuẩn hóa đúng dù hình dáng thay đổi.
// Với base.obj gốc (không áp target) các độ dịch bằng 0 → kết quả giống hệt các bản trước.
const VI={top:881,chin:991,mouth:509},BASE={top:[0,8.4913,0.6961],chin:[0,6.1555,1.2306],mouth:[0,6.6491,1.5887]};
let TOP=8.491,CHIN=6.15,Z_CENTER=0.55,MOUTH_Y=6.6,CUT_Y0=4.85,PRE_Y=3.8;const CUT_K=0.2; // mặt cắt tượng: thấp ở ngực, cao dần qua vai
let S,CY,norm;
function setNorm(V){
 const d=k=>V[VI[k]].map((v,i)=>v-BASE[k][i]);
 const dt=d('top'),dc=d('chin'),dm=d('mouth');
 TOP=8.491+dt[1];CHIN=6.15+dc[1];MOUTH_Y=6.6+dm[1];Z_CENTER=0.55+(dt[2]+dc[2])/2;CUT_Y0=4.85+dc[1];PRE_Y=3.8+dc[1];
 S=2/(TOP-CHIN);CY=(TOP+CHIN)/2;norm=([x,y,z])=>[x*S,(y-CY)*S,(z-Z_CENTER)*S];
}

// ---- 1. Đọc OBJ ----
const V=[],quads=[],eyeV={l:[],r:[]},lashF={};let g='';
for(const line of readFileSync(SRC,'utf8').split('\n')){
 if(line.startsWith('v '))V.push(line.split(/\s+/).slice(1,4).map(Number));
 else if(line.startsWith('g '))g=line.slice(2).trim();
 else if(line.startsWith('f ')){
  const f=line.trim().split(/\s+/).slice(1).map(t=>parseInt(t)-1);
  if(g==='body')quads.push(f);else if(g==='helper-l-eye')eyeV.l.push(...f);else if(g==='helper-r-eye')eyeV.r.push(...f);
  else if(/^helper-[lr]-eyelashes-[12]$/.test(g))(lashF[g]??=[]).push(f); // 0.5.1: khung mi (vị trí bờ mi theo hình dạng mắt đã chỉnh) → build-hair dựng lông mi
 }
}
// ---- 1b. Catmull–Clark một mức trên vùng cần dùng ----
function catmullClark(Vin,Q){
 const Vo=Vin.map(p=>p.slice()),fp=Q.map(q=>q.reduce((s,i)=>s.map((v,k)=>v+Vin[i][k]/q.length),[0,0,0]));
 const E=new Map,ek=(a,b)=>a<b?a+'_'+b:b+'_'+a;
 Q.forEach((q,fi)=>q.forEach((a,k)=>{const b=q[(k+1)%q.length],key=ek(a,b);if(!E.has(key))E.set(key,{a,b,f:[]});E.get(key).f.push(fi)}));
 const out=[],vF=new Map,vE=new Map;const add=p=>{out.push(p);return out.length-1};
 const fIdx=fp.map(add);
 const eIdx=new Map;for(const [key,e] of E){const m=Vin[e.a].map((v,k)=>(v+Vin[e.b][k])/2);
  eIdx.set(key,add(e.f.length===2?m.map((v,k)=>(Vin[e.a][k]+Vin[e.b][k]+fp[e.f[0]][k]+fp[e.f[1]][k])/4):m))}
 for(const e of E.values()){for(const v of[e.a,e.b]){if(!vE.has(v))vE.set(v,[]);vE.get(v).push(e)}for(const fi of e.f)for(const v of[e.a,e.b]){if(!vF.has(v))vF.set(v,new Set);vF.get(v).add(fi)}}
 const vIdx=new Map;
 for(const [v,es] of vE){
  const bd=es.filter(e=>e.f.length<2);let p;
  if(bd.length){p=Vin[v].map((x,k)=>(6*x+bd.reduce((s,e)=>s+Vin[e.a===v?e.b:e.a][k],0))/(6+bd.length))} // biên: giữ gần vị trí cũ
  else{const n=es.length,F=[...vF.get(v)].map(fi=>fp[fi]),Fa=[0,1,2].map(k=>F.reduce((s,f)=>s+f[k],0)/F.length),
   R=[0,1,2].map(k=>es.reduce((s,e)=>s+(Vin[e.a][k]+Vin[e.b][k])/2,0)/n);p=[0,1,2].map(k=>(Fa[k]+2*R[k]+(n-3)*Vin[v][k])/n)}
  vIdx.set(v,add(p));
 }
 const Qo=[];
 Q.forEach((q,fi)=>q.forEach((a,k)=>{const b=q[(k+1)%q.length],z=q[(k+q.length-1)%q.length];
  Qo.push([vIdx.get(a),eIdx.get(ek(a,b)),fIdx[fi],eIdx.get(ek(z,a))])}));
 return {V:out,Q:Qo};
}
setNorm(V);
// Khung mi MakeHuman (đã chuẩn hóa) – dữ liệu tạm cho build-hair (lông mi); build-hair xóa sau khi dùng
const lashHelper=Object.fromEntries(Object.entries(lashF).map(([k,F])=>{const ids=[...new Set(F.flat())],ix=new Map(ids.map((v,i)=>[v,i]));
 return [k,{v:ids.flatMap(i=>norm(V[i]).map(x=>+x.toFixed(5))),f:F.map(q=>q.map(i=>ix.get(i)))}]}));
// Lấy vị trí đỉnh mắt TRƯỚC khi thay mảng V bằng kết quả chia nhỏ (chỉ số đỉnh sẽ thay đổi).
const eyePts={l:[...new Set(eyeV.l)].map(i=>V[i].slice()),r:[...new Set(eyeV.r)].map(i=>V[i].slice())};
{const sub=quads.filter(q=>!q.every(i=>V[i][1]<PRE_Y)),cc=catmullClark(V,sub);V.length=0;V.push(...cc.V);quads.length=0;quads.push(...cc.Q)}
// ---- 2. Cắt tượng bán thân ----
const cutF=p=>p[1]-(CUT_Y0+CUT_K*p[0]*p[0]);
const P=[],map=new Map,edgeCut=new Map;
const vid=i=>{if(!map.has(i)){map.set(i,P.length);P.push(V[i])}return map.get(i)};
const cutVid=(a,b)=>{const k=a<b?a+'_'+b:b+'_'+a;if(edgeCut.has(k))return edgeCut.get(k);
 const fa=cutF(V[a]),fb=cutF(V[b]),t=fa/(fa-fb),p=V[a].map((v,i)=>v+(V[b][i]-v)*t);
 edgeCut.set(k,P.length);P.push(p);return P.length-1};
const T=[];
for(const q of quads){
 if(q.every(i=>V[i][1]<PRE_Y))continue;
 for(const tri of(q.length===4?[[q[0],q[1],q[2]],[q[0],q[2],q[3]]]:[q])){
  const f=tri.map(i=>cutF(V[i])),inside=f.map(v=>v>0);
  if(inside.every(Boolean)){T.push(tri.map(vid));continue}
  if(!inside.some(Boolean))continue;
  // Sutherland–Hodgman với một mặt cắt: giữ phần f>0
  const poly=[];
  for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],ia=inside[k],ib=inside[(k+1)%3];
   if(ia)poly.push(vid(a));if(ia!==ib)poly.push(cutVid(a,b))}
  for(let k=1;k+1<poly.length;k++)T.push([poly[0],poly[k],poly[k+1]]);
 }
}
// Bịt đáy: tìm các vòng biên (cạnh chỉ thuộc 1 tam giác), quạt từ tâm vòng.
const ecount=new Map;for(const t of T)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=a<b?a+'_'+b:b+'_'+a;ecount.set(key,(ecount.get(key)||0)+1)}
const next=new Map;for(const t of T)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=a<b?a+'_'+b:b+'_'+a;if(ecount.get(key)===1)next.set(b,a)} // biên đi ngược chiều tam giác
const loops=[],seen=new Set;
for(const s of next.keys()){if(seen.has(s))continue;const loop=[];let v=s;while(!seen.has(v)&&next.has(v)){seen.add(v);loop.push(v);v=next.get(v)}if(loop.length>2)loops.push(loop)}
// ---- 3+4. Chuẩn hóa, mắt, mốc ----
const pos=P.map(norm);
const center=a=>a.reduce((s,p)=>s.map((v,i)=>v+p[i]),[0,0,0]).map(v=>v/a.length);
const eyes=['l','r'].map(k=>{const pts=eyePts[k].map(norm),c=center(pts),r=pts.reduce((s,p)=>s+Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]),0)/pts.length;return {c,r}});
// Cực của cầu hướng +z (nhìn thẳng) → mống mắt/đồng tử là các vòng tròn đồng tâm quanh cực, mép tròn trơn.
function sphere(c,r,ws=32,hs=24){const p=[],n=[],idx=[];
 for(let j=0;j<=hs;j++){const th=j/hs*Math.PI;for(let i=0;i<=ws;i++){const ph=i/ws*2*Math.PI,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];n.push(...d);p.push(c[0]+d[0]*r,c[1]+d[1]*r,c[2]+d[2]*r)}}
 for(let j=0;j<hs;j++)for(let i=0;i<ws;i++){const a=j*(ws+1)+i,b=a+ws+1;if(j)idx.push(a,b,a+1);if(j<hs-1)idx.push(a+1,b,b+1)}
 return {p,n,idx}}
// Mốc: đầu mũi = điểm xa nhất phía trước gần đường giữa; miệng/cằm theo profile mặt ngoài.
const mid=pos.filter(p=>Math.abs(p[0])<0.035);
const front=(y0,y1)=>mid.filter(p=>p[1]<=y0&&p[1]>y1).reduce((m,p)=>p[2]>m[2]?p:m,[0,0,-9]);
const noseTip=front(-0.1,-0.5),chin=front(-0.78,-0.95);
const lm={eyeL:eyes[0].c,eyeR:eyes[1].c,eyeRadius:(eyes[0].r+eyes[1].r)/2,noseTip,chin,top:[0,1,0],
 mouth:[0,(MOUTH_Y-CY)*S,front((MOUTH_Y+0.06-CY)*S,(MOUTH_Y-0.05-CY)*S)[2]],cut:{y0:(CUT_Y0-CY)*S,k:CUT_K/S}}; // khe môi đo trên profile: y≈6.6 (đơn vị gốc)
// ---- 5. Pháp tuyến ----
function normals(p,tris){const n=new Float32Array(p.length*3);
 for(const [a,b,c] of tris){const A=p[a],B=p[b],C=p[c],u=B.map((v,i)=>v-A[i]),w=C.map((v,i)=>v-A[i]);
  const x=u[1]*w[2]-u[2]*w[1],y=u[2]*w[0]-u[0]*w[2],z=u[0]*w[1]-u[1]*w[0];for(const v of[a,b,c]){n[v*3]+=x;n[v*3+1]+=y;n[v*3+2]+=z}}
 for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l}return n}
const skinN=normals(pos,T);
// nắp đáy: đỉnh riêng (không làm trơn với da), pháp tuyến hướng xuống
const cap={p:[],n:[],idx:[]};
for(const loop of loops){const c=center(loop.map(i=>pos[i])),base=cap.p.length/3;cap.p.push(...c);cap.n.push(0,-1,0);
 loop.forEach(i=>{cap.p.push(...pos[i]);cap.n.push(0,-1,0)});
 for(let k=0;k<loop.length;k++)cap.idx.push(base,base+1+k,base+1+((k+1)%loop.length))} // cùng chiều với da (mặt ngoài hướng xuống)
// ---- 6. GLB ----
const meshes=[
 {name:'skin',p:pos.flat(),n:[...skinN],idx:T.flat(),color:[0.86,0.72,0.64,1],rough:0.72},
 {name:'eyes',...(()=>{const a=sphere(eyes[0].c,eyes[0].r),b=sphere(eyes[1].c,eyes[1].r),o=a.p.length/3;return {p:[...a.p,...b.p],n:[...a.n,...b.n],idx:[...a.idx,...b.idx.map(i=>i+o)]}})(),color:[0.93,0.9,0.86,1],rough:0.55},
 {name:'cap',...cap,color:[0.86,0.72,0.64,1],rough:0.8}];
const bin=[],bufferViews=[],accessors=[],gltfMeshes=[],nodes=[],materials=[];let off=0;
const push=(arr,target)=>{const b=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength);const pad=(4-b.length%4)%4;bufferViews.push({buffer:0,byteOffset:off,byteLength:b.length,target});bin.push(b,Buffer.alloc(pad));off+=b.length+pad;return bufferViews.length-1};
for(const m of meshes){
 const n=m.p.length/3;if(n>65535)throw new Error('quá nhiều đỉnh cho uint16');
 const P32=Float32Array.from(m.p),N32=Float32Array.from(m.n),I16=Uint16Array.from(m.idx);
 const mn=[0,1,2].map(k=>Math.min(...P32.filter((_,i)=>i%3===k))),mx=[0,1,2].map(k=>Math.max(...P32.filter((_,i)=>i%3===k)));
 accessors.push({bufferView:push(P32,34962),componentType:5126,count:n,type:'VEC3',min:mn,max:mx});
 accessors.push({bufferView:push(N32,34962),componentType:5126,count:n,type:'VEC3'});
 accessors.push({bufferView:push(I16,34963),componentType:5123,count:I16.length,type:'SCALAR'});
 materials.push({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.color,metallicFactor:0,roughnessFactor:m.rough}});
 gltfMeshes.push({name:m.name,primitives:[{attributes:{POSITION:accessors.length-3,NORMAL:accessors.length-2},indices:accessors.length-1,material:materials.length-1}]});
 nodes.push({name:m.name,mesh:gltfMeshes.length-1});
}
nodes.push({name:'head',children:[0,1,2],extras:{landmarks:lm,lashHelper,source:'MakeHuman hm08 base mesh (CC0 1.0), makehumancommunity/makehuman',units:'chiều cao đầu = 2'}});
const json={asset:{version:'2.0',generator:'skincare-prototype tools/build-head.mjs',copyright:'CC0 1.0 – MakeHuman base mesh + morph targets (Data Collection AB, Joel Palmius, Jonas Hauquier); chỉnh sửa: hình dáng bằng target CC0, cắt tượng bán thân, nhãn cầu, chuẩn hóa; tóc, lông mày, lông mi do dự án tự dựng (tools/build-hair.mjs)'},
 scene:0,scenes:[{nodes:[3]}],nodes,meshes:gltfMeshes,materials,accessors,bufferViews,buffers:[{byteLength:off}]};
let js=Buffer.from(JSON.stringify(json));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const B=Buffer.concat(bin),head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+js.length+8+B.length,8);
jh.writeUInt32LE(js.length,0);jh.writeUInt32LE(0x4E4F534A,4);bh.writeUInt32LE(B.length,0);bh.writeUInt32LE(0x004E4942,4);
writeFileSync(OUT,Buffer.concat([head,jh,js,bh,B]));
console.error(`Đã ghi ${OUT}: da ${pos.length} đỉnh/${T.length} tam giác, mắt ${meshes[1].p.length/3} đỉnh, nắp ${loops.length} vòng; ${(12+16+js.length+B.length)/1024|0} KB`);
console.error('Mốc:',JSON.stringify(lm));
