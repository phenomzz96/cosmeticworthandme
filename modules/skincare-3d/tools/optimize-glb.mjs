// Tối ưu dung lượng assets/head.glb (0.5.1) – chạy SAU bake-ao.mjs, là bước cuối của pipeline dựng mô hình (tools/build-model.mjs).
//   node tools/optimize-glb.mjs                  → đọc/ghi đè assets/head.glb
//   node tools/optimize-glb.mjs <vào.glb> <ra.glb>
// • Chỉ xử lý các lưới CHỈ DÙNG ĐỂ HIỂN THỊ: "hair", "hairline", "brows":
//     1. Lượng tử hóa (KHR_mesh_quantization): POSITION → int16 chuẩn hóa (nút của lưới mang tỉ lệ + tịnh tiến để giải lượng tử;
//        sai số ≤ ~0,02 mm ở tỉ lệ đầu thật); NORMAL/TANGENT → int8 chuẩn hóa (< 1°); COLOR_0 → uint8 chuẩn hóa VEC4.
//        Bỏ TANGENT (vật liệu tóc/lông mày không dùng tiếp tuyến – không bật dị hướng).
//     2. Sắp lại tam giác/đỉnh cho cache GPU (không đổi hình học), rồi nén meshopt (EXT_meshopt_compression, mã hóa v0 – giải được
//        bằng MeshoptDecoder đi kèm Three.js 0.160.0). Không mất dữ liệu so với bản đã lượng tử.
// • KHÔNG đụng "skin", "eyes", "cap": mã chương trình đọc trực tiếp mảng float của chúng (vùng da, raycast, AO, mặt nạ tóc/môi, 2D).
// • Kết quả tất định; bản quyền, extras (mốc giải phẫu, thông tin tóc) giữ nguyên; từ chối tệp đã tối ưu.
// • Bộ mã hóa: tools/vendor/meshopt_encoder.js (meshoptimizer, MIT) – chỉ dùng khi dựng, không tải về trình duyệt.
import {readFileSync,writeFileSync} from 'node:fs';
import {MeshoptEncoder as E} from './vendor/meshopt_encoder.js'; // meshoptimizer (MIT) – chỉ dùng khi dựng, không tải về trình duyệt
await E.ready;
const [inp='assets/head.glb',out=inp]=process.argv.slice(2);
const buf=readFileSync(inp),dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
if(dv.getUint32(0,true)!==0x46546C67)throw new Error('không phải GLB');
const jl=dv.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(buf.subarray(20,20+jl)));
const binStart=20+jl+8,binLen=dv.getUint32(20+jl,true),bin=buf.subarray(binStart,binStart+binLen);
if(json.extensionsUsed?.includes('KHR_mesh_quantization'))throw new Error('tệp đã được tối ưu');
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},CT={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5122:Int16Array,5121:Uint8Array,5120:Int8Array};
const read=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],T=CT[a.componentType],n=a.count*NC[a.type],o=bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);
 return new T(bin.buffer.slice(o,o+n*T.BYTES_PER_ELEMENT))};

// Ghi lại toàn bộ BIN: mỗi accessor một bufferView mới, căn 4 byte
const parts=[];let off=0;const views=[],accs=[];
function push(arr,target){const pad=(4-off%4)%4;if(pad){parts.push(new Uint8Array(pad));off+=pad}
 const u=new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength);parts.push(u);views.push({buffer:0,byteOffset:off,byteLength:u.byteLength,...(target?{target}:{})});off+=u.byteLength;return views.length-1}
function addAcc(arr,type,ct,{normalized=false,target=34962,min,max}={}){accs.push({bufferView:push(arr,target),componentType:ct,count:arr.length/NC[type],type,...(normalized?{normalized:true}:{}),...(min?{min,max}:{})});return accs.length-1}
// dữ liệu nén nằm trong BIN (buffer 0); bufferView trỏ tới buffer dự phòng 1 (không có dữ liệu) với kích thước đã giải nén
let fbOff=0;
function addComp(arr,count,stride,type,ct,{min,max,mode='ATTRIBUTES',target=34962,normalized=true}={}){
 const raw=new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength),enc=E.encodeGltfBuffer(raw,count,stride,mode);
 const pad=(4-off%4)%4;if(pad){parts.push(new Uint8Array(pad));off+=pad}parts.push(enc);
 fbOff+=(4-fbOff%4)%4;const v={buffer:1,byteOffset:fbOff,byteLength:count*stride,...(mode==='ATTRIBUTES'?{byteStride:stride}:{}),target,
  extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:off,byteLength:enc.length,byteStride:stride,count,mode}}};
 views.push(v);off+=enc.length;fbOff+=count*stride;after+=enc.length;
 accs.push({bufferView:views.length-1,componentType:ct,count:type==='SCALAR'&&mode!=='ATTRIBUTES'?count:count,type,...(normalized?{normalized:true}:{}),...(min?{min,max}:{})});return accs.length-1}
const copyAcc=i=>{const a=json.accessors[i];return addAcc(read(i),a.type,a.componentType,{normalized:a.normalized,target:a.bufferView!=null&&json.bufferViews[a.bufferView].target,min:a.min,max:a.max})};

const QUANT=new Set(['hair','hairline','brows']),DROP_TAN=new Set(['hair','hairline','brows']);
const q8=v=>Math.max(-127,Math.min(127,Math.round(v*127)));
let before=0,after=0;
for(const m of json.meshes){
 const p=m.primitives[0],na={};
 if(!QUANT.has(m.name)){for(const [k,i] of Object.entries(p.attributes))na[k]=copyAcc(i);p.attributes=na;p.indices=copyAcc(p.indices);continue}
 const P=read(p.attributes.POSITION),n=P.length/3,lo=[0,1,2].map(c=>{let v=1e9;for(let i=c;i<P.length;i+=3)v=Math.min(v,P[i]);return v}),
  hi=[0,1,2].map(c=>{let v=-1e9;for(let i=c;i<P.length;i+=3)v=Math.max(v,P[i]);return v});
 const ctr=lo.map((v,c)=>(v+hi[c])/2),S=Math.max(...hi.map((v,c)=>(v-lo[c])/2))*1.0001; // tỉ lệ đều → pháp tuyến không méo
 // 1) lượng tử hóa (mỗi phần tử căn 4 byte: VEC3 int16 + 1 ô đệm; VEC3/VEC4 int8; màu VEC4 uint8)
 const QP=new Int16Array(n*4);for(let i=0;i<n;i++)for(let c=0;c<3;c++)QP[i*4+c]=Math.round((P[i*3+c]-ctr[c])/S*32767);
 const N=read(p.attributes.NORMAL),QN=new Int8Array(n*4);for(let i=0;i<n;i++){const l=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1;for(let c=0;c<3;c++)QN[i*4+c]=q8(N[i*3+c]/l)}
 const keepTan=p.attributes.TANGENT!=null&&!DROP_TAN.has(m.name),QT=keepTan?Int8Array.from(read(p.attributes.TANGENT),q8):null;
 let QC=null;if(p.attributes.COLOR_0!=null){const a=json.accessors[p.attributes.COLOR_0],C=read(p.attributes.COLOR_0),k=NC[a.type];QC=new Uint8Array(n*4);
  for(let i=0;i<n;i++)for(let c=0;c<4;c++)QC[i*4+c]=c<k?Math.max(0,Math.min(255,Math.round(C[i*k+c]*255))):255}
 for(const i of Object.values(p.attributes))before+=json.accessors[i].count*NC[json.accessors[i].type]*CT[json.accessors[i].componentType].BYTES_PER_ELEMENT;
 before+=json.accessors[p.indices].count*2;
 // 2) sắp lại thứ tự tam giác/đỉnh cho cache GPU + nén tốt hơn (không đổi hình học)
 const idx=Uint32Array.from(read(p.indices)),[remap]=E.reorderMesh(idx,true,false),re=(src,k)=>{const o=new src.constructor(src.length);for(let i=0;i<n;i++)if(remap[i]!==0xffffffff)o.set(src.subarray(i*k,i*k+k),remap[i]*k);return o};
 const mn=[0,1,2].map(c=>{let v=32767;for(let i=0;i<n;i++)v=Math.min(v,QP[i*4+c]);return v}),mx=[0,1,2].map(c=>{let v=-32767;for(let i=0;i<n;i++)v=Math.max(v,QP[i*4+c]);return v});
 // 3) nén meshopt (EXT_meshopt_compression – GLTFLoader + MeshoptDecoder của Three.js giải nén, không mất dữ liệu so với bản lượng tử)
 na.POSITION=addComp(re(QP,4),n,8,'VEC3',5122,{min:mn,max:mx});
 na.NORMAL=addComp(re(QN,4),n,4,'VEC3',5120);
 if(QT)na.TANGENT=addComp(re(QT,4),n,4,'VEC4',5120);
 if(QC)na.COLOR_0=addComp(re(QC,4),n,4,'VEC4',5121);
 p.attributes=na;p.indices=addComp(Uint16Array.from(idx),idx.length,2,'SCALAR',5123,{mode:'TRIANGLES',target:34963,normalized:false});
 const node=json.nodes.find(x=>x.mesh===json.meshes.indexOf(m));node.translation=ctr;node.scale=[S,S,S];
}
json.accessors=accs;json.bufferViews=views;json.buffers=[{byteLength:off+(4-off%4)%4},{byteLength:fbOff,extensions:{EXT_meshopt_compression:{fallback:true}}}];
json.asset.extras={...(json.asset.extras||{}),optimize:{tool:'tools/optimize-glb.mjs',meshes:[...QUANT],note:'KHR_mesh_quantization (int16 vị trí, int8 pháp tuyến/tiếp tuyến, uint8 màu) + EXT_meshopt_compression; skin/eyes/cap giữ float để mã đọc trực tiếp.'}};
for(const k of['extensionsUsed','extensionsRequired'])json[k]=[...new Set([...(json[k]||[]),'KHR_mesh_quantization','EXT_meshopt_compression'])];
const padE=(4-off%4)%4;if(padE)parts.push(new Uint8Array(padE));
let js=new TextEncoder().encode(JSON.stringify(json));if(js.length%4){const t=new Uint8Array(js.length+(4-js.length%4)).fill(0x20);t.set(js);js=t}
const binL=json.buffers[0].byteLength,total=28+js.length+binL,o8=new Uint8Array(total),w=new DataView(o8.buffer);
w.setUint32(0,0x46546C67,true);w.setUint32(4,2,true);w.setUint32(8,total,true);w.setUint32(12,js.length,true);w.setUint32(16,0x4E4F534A,true);o8.set(js,20);
w.setUint32(20+js.length,binL,true);w.setUint32(24+js.length,0x004E4942,true);let q=28+js.length;for(const p of parts){o8.set(p,q);q+=p.length}
writeFileSync(out,o8);
console.log(`đã ghi ${out}: ${buf.length} → ${total} byte (lưới tóc/lông mày/mi: ${before} → ${after} byte sau lượng tử + nén)`);
