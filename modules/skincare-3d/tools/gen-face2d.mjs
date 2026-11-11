// Sinh SVG khuôn mặt 2D từ CHÍNH mô hình 3D (assets/head.glb) bằng phép chiếu thẳng từ phía trước:
// • Đường bao: rải (rasterize) hình chiếu các tam giác của lưới da + nắp đáy → biên trái/phải theo từng hàng.
// • Vùng da: CÙNG các elip trong js/head-model.js, lấy bán kính tại ngưỡng chọn 0.5 → 2D và 3D khớp theo định nghĩa.
// • Nét mặt (mắt, mũi, môi): đặt theo mốc giải phẫu ghi trong GLB.
// `node tools/gen-face2d.mjs --write` (hoặc `npm run gen:face2d -- --write`) ghi lại js/viewer2d.js; không có --write thì in JSON.
// Markup sinh ra là hằng số, không chứa dữ liệu động.
import {readFileSync,writeFileSync} from 'node:fs';
import * as H from '../js/head-model.js';
export const SX=118,OX=160,OY=150; // x_svg = OX + x*SX ; y_svg = OY - y*SX
const X=x=>+(OX+x*SX).toFixed(1),Y=y=>+(OY-y*SX).toFixed(1);
// bán kính elip nơi trọng số = 0.5: smooth(1.05,0.72,r)=0.5 → r = 0.885; siêu elip "toàn mặt": smooth(1,0.88,r)=0.5 → r = 0.94
export const ZONE_R=0.885,FACE_R=0.94;
export function silhouette(meshes,step=0.01,x0=-1.6,x1=1.6,y0=-2.3,y1=1.05){
 const W=Math.round((x1-x0)/step),Hh=Math.round((y1-y0)/step),cov=new Uint8Array(W*Hh);
 for(const m of meshes){const p=m.positions,ix=m.index;
  for(let t=0;t<ix.length;t+=3){
   const a=[p[ix[t]*3],p[ix[t]*3+1]],b=[p[ix[t+1]*3],p[ix[t+1]*3+1]],c=[p[ix[t+2]*3],p[ix[t+2]*3+1]];
   const minx=Math.max(0,Math.floor((Math.min(a[0],b[0],c[0])-x0)/step)),maxx=Math.min(W-1,Math.ceil((Math.max(a[0],b[0],c[0])-x0)/step));
   const miny=Math.max(0,Math.floor((Math.min(a[1],b[1],c[1])-y0)/step)),maxy=Math.min(Hh-1,Math.ceil((Math.max(a[1],b[1],c[1])-y0)/step));
   const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(area)<1e-12)continue;
   for(let j=miny;j<=maxy;j++)for(let i=minx;i<=maxx;i++){const x=x0+(i+0.5)*step,y=y0+(j+0.5)*step;
    const w0=((b[0]-x)*(c[1]-y)-(c[0]-x)*(b[1]-y))/area,w1=((c[0]-x)*(a[1]-y)-(a[0]-x)*(c[1]-y))/area,w2=1-w0-w1;
    if(w0>=-1e-6&&w1>=-1e-6&&w2>=-1e-6)cov[j*W+i]=1}}}
 const rows=[];for(let j=Hh-1;j>=0;j-=2){let l=-1,r=-1;for(let i=0;i<W;i++)if(cov[j*W+i]){if(l<0)l=i;r=i}if(l>=0)rows.push([x0+(l+0.5)*step,x0+(r+0.5)*step,y0+(j+0.5)*step])}
 return rows; // [xTrái, xPhải, y] từ trên xuống
}
const P=pts=>pts.map(([x,y],i)=>`${i?'L':'M'}${X(x)} ${Y(y)}`).join('')+'Z';
// 0.5.1: vùng TÓC nhìn từ phía trước = các điểm mà bề mặt da gần mắt nhìn nhất (z-buffer, chỉ mặt hướng trước) nằm dưới tóc
// (mặt nạ _HAIR ≥ 0.45). Trả về đường bao: mép ngoài (nới thêm độ dày lớp tóc) + mép chân tóc phía trong (trán, thái dương).
export function hairRegion(skin,step=0.01,x0=-1.2,x1=1.2,y0=-0.6,y1=1.1,TH=0.45,thick=0.035){
 const W=Math.round((x1-x0)/step),Hh=Math.round((y1-y0)/step),zb=new Float32Array(W*Hh).fill(-1e9),hv=new Float32Array(W*Hh);
 const p=skin.positions,ix=skin.index,h=skin.hair;
 for(let t=0;t<ix.length;t+=3){const A=ix[t],B=ix[t+1],C=ix[t+2],a=[p[A*3],p[A*3+1],p[A*3+2]],b=[p[B*3],p[B*3+1],p[B*3+2]],c=[p[C*3],p[C*3+1],p[C*3+2]];
  const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(area)<1e-12)continue;
  const minx=Math.max(0,Math.floor((Math.min(a[0],b[0],c[0])-x0)/step)),maxx=Math.min(W-1,Math.ceil((Math.max(a[0],b[0],c[0])-x0)/step));
  const miny=Math.max(0,Math.floor((Math.min(a[1],b[1],c[1])-y0)/step)),maxy=Math.min(Hh-1,Math.ceil((Math.max(a[1],b[1],c[1])-y0)/step));
  for(let j=miny;j<=maxy;j++)for(let i=minx;i<=maxx;i++){const x=x0+(i+0.5)*step,y=y0+(j+0.5)*step;
   const w0=((b[0]-x)*(c[1]-y)-(c[0]-x)*(b[1]-y))/area,w1=((c[0]-x)*(a[1]-y)-(a[0]-x)*(c[1]-y))/area,w2=1-w0-w1;
   if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;const z=w0*a[2]+w1*b[2]+w2*c[2],k=j*W+i;if(z>zb[k]){zb[k]=z;hv[k]=w0*h[A]+w1*h[B]+w2*h[C]}}}
 // theo hàng (từ trên xuống): đoạn ngoài [trái, phải] của phần đầu nhìn thấy, và khe trong (da trán/mặt) nếu có
 const rows=[];for(let j=Hh-1;j>=0;j-=2){let l=-1,r=-1,il=-1,ir=-1;
  for(let i=0;i<W;i++)if(zb[j*W+i]>-1e9){if(hv[j*W+i]>=TH){if(l<0)l=i;r=i}}
  if(l<0){if(rows.length)break;continue}
  const mid=Math.round((l+r)/2);if(hv[j*W+mid]<TH&&zb[j*W+mid]>-1e9){il=mid;while(il>l&&hv[j*W+il-1]<TH)il--;ir=mid;while(ir<r&&hv[j*W+ir+1]<TH)ir++}
  rows.push({y:y0+(j+0.5)*step,l:x0+(l+0.5)*step,r:x0+(r+0.5)*step,il:il<0?null:x0+(il-0.5)*step,ir:ir<0?null:x0+(ir+1.5)*step})}
 // đường bao: ngoài-phải (xuống) → trong-phải (lên) → trong-trái (xuống) → ngoài-trái (lên); mép ngoài nới thêm độ dày lớp tóc
 const out=[],R=rows,gap=R.filter(r=>r.il!=null);
 out.push([0,R[0].y+thick]);R.forEach(r=>out.push([r.r+thick,r.y]));
 gap.slice().reverse().forEach(r=>out.push([r.ir,r.y]));
 if(gap.length)out.push([0,gap[0].y+0.012]);
 gap.forEach(r=>out.push([r.il,r.y]));R.slice().reverse().forEach(r=>out.push([r.l-thick,r.y]));
 return out.map(([x,y])=>[+x.toFixed(4),+y.toFixed(4)]);
}
const Ps=pts=>{ // đường cong mượt (Catmull-Rom → Bézier) cho mép tóc
 let d=`M${X(pts[0][0])} ${Y(pts[0][1])}`;for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
  d+=`C${X(p1[0]+(p2[0]-p0[0])/6)} ${Y(p1[1]+(p2[1]-p0[1])/6)} ${X(p2[0]-(p3[0]-p1[0])/6)} ${Y(p2[1]-(p3[1]-p1[1])/6)} ${X(p2[0])} ${Y(p2[1])}`}return d+'Z'};
if(import.meta.url===`file://${process.argv[1]}`){
 const g=H.readGLB(readFileSync(new URL('../'+H.HEAD_ASSET,import.meta.url))),L=g.landmarks;
 const rows=silhouette([g.meshes.skin,g.meshes.cap]);
 const hairPts=hairRegion(g.meshes.skin),hair=Ps(hairPts.filter((_,i)=>i%2===0||i===hairPts.length-1));
 const outline=P([[0,rows[0][2]],...rows.map(r=>[r[1],r[2]]),...rows.slice().reverse().map(r=>[r[0],r[2]])]);
 const er=L.eyeRadius,eye=([x,y])=>`M${X(x-er*1.05)} ${Y(y)}Q${X(x)} ${Y(y+er*0.62)} ${X(x+er*1.05)} ${Y(y)}Q${X(x)} ${Y(y-er*0.5)} ${X(x-er*1.05)} ${Y(y)}Z`;
 const brow=([x,y],s)=>`M${X(x-s*er*1.3)} ${Y(y+er*1.25)}Q${X(x+s*er*0.1)} ${Y(y+er*1.75)} ${X(x+s*er*1.45)} ${Y(y+er*1.2)}`;
 const n=L.noseTip,m=L.mouth;
 const nose=`M${X(-0.03)} ${Y(0.02)}Q${X(-0.05)} ${Y(-0.18)} ${X(-0.075)} ${Y(n[1]-0.01)}M${X(-0.125)} ${Y(n[1]-0.03)}Q${X(-0.1)} ${Y(n[1]-0.085)} ${X(-0.035)} ${Y(n[1]-0.07)}Q${X(0)} ${Y(n[1]-0.09)} ${X(0.035)} ${Y(n[1]-0.07)}Q${X(0.1)} ${Y(n[1]-0.085)} ${X(0.125)} ${Y(n[1]-0.03)}`;
 const lips=`M${X(-0.17)} ${Y(m[1])}Q${X(-0.08)} ${Y(m[1]+0.06)} ${X(0)} ${Y(m[1]+0.035)}Q${X(0.08)} ${Y(m[1]+0.06)} ${X(0.17)} ${Y(m[1])}Q${X(0.06)} ${Y(m[1]-0.085)} ${X(0)} ${Y(m[1]-0.08)}Q${X(-0.06)} ${Y(m[1]-0.085)} ${X(-0.17)} ${Y(m[1])}Z`;
 const mouth=`M${X(-0.165)} ${Y(m[1])}Q${X(0)} ${Y(m[1]-0.012)} ${X(0.165)} ${Y(m[1])}`;
 const F=H.FACE_SHAPE,face=P(Array.from({length:72},(_,i)=>{const a=i/72*2*Math.PI,c=Math.cos(a),s=Math.sin(a),k=FACE_R/Math.pow(Math.abs(c)**F.p+Math.abs(s)**F.p,1/F.p);return [F.x+F.rx*k*c,F.y+F.ry*k*s]}));
 const zones=Object.fromEntries(H.ZONE_KEYS.map(z=>{const s=H.ZONE_SHAPES[z];return [z,{cx:X(s.x),cy:Y(s.y),rx:+(s.rx*ZONE_R*SX).toFixed(1),ry:+(s.ry*ZONE_R*SX).toFixed(1)}]}));
 const out={outline,hair,face,eyes:[eye(L.eyeL),eye(L.eyeR)],brows:[brow(L.eyeL,1),brow(L.eyeR,-1)],nose,lips,mouth,zones};
 if(!process.argv.includes('--write')){console.log(JSON.stringify(out,null,1));process.exit(0)}
 const title={forehead:'Trán',cheekR:'Má phải',cheekL:'Má trái',chin:'Cằm'};
 const svg='<svg viewBox="0 0 320 420" class="face2d" role="group" aria-label="Sơ đồ khuôn mặt 2D: chọn một vùng da">'
  +'<defs><radialGradient id="f2dSkin" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#f4e5d9"/><stop offset=".55" stop-color="#ead5c6"/><stop offset="1" stop-color="#d9bba7"/></radialGradient><linearGradient id="f2dHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a29"/><stop offset=".6" stop-color="#432a1d"/><stop offset="1" stop-color="#3a2418"/></linearGradient></defs>'
  +`<path class="head" d="${out.outline}" fill="url(#f2dSkin)"/><path class="hair" d="${out.hair}" fill="url(#f2dHair)" stroke="#3a2418" stroke-opacity=".25" stroke-width="1.2" stroke-linejoin="round"/><path class="face-ov" d="${out.face}"/>`
  +out.brows.map(d=>`<path class="brow" d="${d}"/>`).join('')+out.eyes.map(d=>`<path class="eye" d="${d}"/>`).join('')
  +`<path class="nose" d="${out.nose}"/><path class="lips" d="${out.lips}"/><path class="mouth" d="${out.mouth}"/>`
  +'<g class="zones">'+['forehead','cheekR','cheekL','chin'].map(z=>{const e=out.zones[z];return `<ellipse class="zone" data-z="${z}" cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"><title>${title[z]}</title></ellipse>`}).join('')+'</g></svg>';
 if(/[`$]/.test(svg))throw new Error('SVG không được chứa ` hoặc $');
 const js=`// Viewer2D 0.4.1 (SVG; 0.5.1: thêm tóc vén gọn theo mô hình mới): cùng giao diện highlight/onPick với Viewer3D; dùng khi 3D lỗi, không có WebGL hoặc người dùng chọn 2D.
// Hình vẽ được SINH TỪ CHÍNH mô hình 3D (assets/head.glb, phép chiếu thẳng từ phía trước) bằng tools/gen-face2d.mjs; vùng da là
// CÙNG các elip với js/head-model.js → vị trí vùng khớp 3D; má trái của người = bên phải màn hình. Markup là hằng số.
// File này được sinh tự động: sửa head-model.js/head.glb rồi chạy \`npm run gen:face2d -- --write\`, không sửa tay phần SVG.
import {ZONES} from './data.js';
const SVG=\``+svg+`\`;
export class Viewer2D{
 init(el,onPick,{onHover}={}){
  el.innerHTML=SVG;this.el=el;this.svg=el.querySelector('svg');this.onHover=onHover;
  el.querySelectorAll('[data-z]').forEach(n=>{
   const z=n.dataset.z;n.classList.add('zone');n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-pressed','false');
   n.setAttribute('aria-label',ZONES[z]);
   n.addEventListener('click',()=>onPick(z));
   n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(z)}});
   n.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){n.classList.add('hover');this.onHover?.(z)}});
   n.addEventListener('pointerleave',()=>{n.classList.remove('hover');this.onHover?.(null)});
  });
 }
 // zs: danh sách vùng (có thể kèm 'face' = toàn mặt → phủ toàn mặt + cả 4 vùng)
 highlight(zs){
  if(!this.el)return;const s=new Set(zs||[]),face=s.has('face');let any=false;
  this.el.querySelectorAll('[data-z]').forEach(n=>{const on=face||s.has(n.dataset.z);any||=on;n.classList.toggle('on',on);n.setAttribute('aria-pressed',String(on))});
  this.svg?.classList.toggle('has-sel',any);this.svg?.classList.toggle('full',face);this.el.querySelector('.face-ov')?.classList.toggle('on',face);
 }
}
`;
 writeFileSync(new URL('../js/viewer2d.js',import.meta.url),js);console.error('Đã ghi js/viewer2d.js');
}
