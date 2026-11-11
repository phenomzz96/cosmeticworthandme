// Journal Manager: ảnh lưu IndexedDB (key = userId|ngày); biểu đồ SVG không nội suy.
// 0.3.1: lỗi IndexedDB (không khả dụng, bị chặn, hết dung lượng, giao dịch bị hủy) luôn được trả về dạng Promise bị từ chối
// để giao diện báo lỗi; biểu đồ dựng bằng html`…` (escape) và bỏ qua khóa ngày không hợp lệ.
import {html,num} from './html.js';
import {isDate} from './timeline.js';
const DB=()=>new Promise((res,rej)=>{
 let r;try{if(!globalThis.indexedDB)throw new Error('Trình duyệt không hỗ trợ IndexedDB.');r=indexedDB.open('skc-photos',1)}catch(e){rej(e);return}
 r.onupgradeneeded=()=>r.result.createObjectStore('p');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('IndexedDB đang bị chặn.'))});
const tx=async(mode,f)=>{const db=await DB();return new Promise((res,rej)=>{
 let t,r;try{t=db.transaction('p',mode);r=f(t.objectStore('p'))}catch(e){db.close();rej(e);return}
 t.oncomplete=()=>{db.close();res(r.result)};t.onerror=()=>{db.close();rej(t.error)};t.onabort=()=>{db.close();rej(t.error||new Error('Giao dịch IndexedDB bị hủy.'))}})};
export const photos={put:(u,d,b)=>tx('readwrite',s=>s.put(b,u+'|'+d)),get:(u,d)=>tx('readonly',s=>s.get(u+'|'+d)),del:(u,d)=>tx('readwrite',s=>s.delete(u+'|'+d))};
export const SCALES={
 dry:['Mức độ khô','0 = không khô · 5 = rất khô','#b8791c'],
 oil:['Mức độ dầu','0 = không bóng dầu · 5 = rất nhiều dầu','#2a7f9e'],
 irr:['Cảm giác kích ứng','0 = không kích ứng · 5 = kích ứng rõ rệt','#b4435f']};
export function chart(j){
 const ds=Object.keys(j).filter(isDate).sort(); // khóa không phải ngày hợp lệ không được vẽ (vẫn hiển thị ở bảng)
 if(!ds.length)return html`<p class="muted">Chưa có dữ liệu thực tế.</p>`;
 const day=s=>Math.round(Date.parse(s+'T00:00:00Z')/864e5),d0=day(ds[0]),span=Math.max(day(ds.at(-1))-d0,1),W=560,H=240,L=40,B=40,T=18;
 const X=s=>num(L+(day(s)-d0)/span*(W-L-14)),Yn=v=>T+(5-v)/5*(H-T-B),Y=v=>num(Yn(v));
 const val=(s,k)=>{const v=j[s][k];return Number.isFinite(v)&&v>=0&&v<=5?v:null};
 const grid=[0,1,2,3,4,5].map(v=>html`<line x1="${L}" x2="${W-8}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5ecea"/><text x="${L-8}" y="${num(Yn(v)+4)}" text-anchor="end" font-size="12" fill="#55605e">${v}</text>`);
 const labels=[];
 if(span<=366)for(let i=0;i<=span;i++){const s=new Date((d0+i)*864e5).toISOString().slice(0,10),has=!!j[s];
  if(span<=31||has)labels.push(html`<text x="${X(s)}" y="${H-20}" font-size="11" text-anchor="middle" fill="${has?'#23302e':'#b5c0bd'}">${s.slice(5)}</text>`)}
 else for(const s of ds)labels.push(html`<text x="${X(s)}" y="${H-20}" font-size="11" text-anchor="middle" fill="#23302e">${s.slice(2)}</text>`);
 const series=Object.keys(SCALES).map(k=>{
  const pts=ds.filter(s=>val(s,k)!=null),c=SCALES[k][2];
  return pts.map((s,i)=>html`${i>0&&day(s)-day(pts[i-1])===1&&html`<line x1="${X(pts[i-1])}" y1="${Y(val(pts[i-1],k))}" x2="${X(s)}" y2="${Y(val(s,k))}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`}<circle cx="${X(s)}" cy="${Y(val(s,k))}" r="4.5" fill="${c}" stroke="#fff" stroke-width="1.5"><title>${s} · ${SCALES[k][0]}: ${val(s,k)}/5</title></circle>`);
 });
 return html`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Biểu đồ nhật ký tự đánh giá, thang 0–5">${grid}${labels}${series}<text x="4" y="11" font-size="11" fill="#6a7572">điểm (0–5)</text><text x="${W-8}" y="${H-3}" font-size="11" text-anchor="end" fill="#6a7572">ngày (tháng-ngày)</text></svg>`;
}
