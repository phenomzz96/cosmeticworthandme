// Đồng bộ hai chiều bước routine ↔ vùng da (0.4) – module THUẦN, chỉ đọc kết quả Routine Engine (không tính lại routine).
// • Chọn bước → vùng cần highlight lấy từ metadata `zones` của sản phẩm trong bước (Engine đã gộp vào step.zones).
//   'face' (toàn mặt) → phủ toàn mặt + cả 4 vùng. Bước không có dữ liệu vùng → KHÔNG highlight, không suy đoán.
// • Chọn vùng → danh sách bước có khai báo vùng đó hoặc 'face'.
// • Bước đang chọn không còn trong routine (vd. vừa bỏ sản phẩm) → bỏ chọn và báo dropped=true để giao diện thông báo.
import {ZONES} from './data.js';
export const ZONE_KEYS=Object.keys(ZONES);
const zonesOf=s=>Array.isArray(s?.zones)?s.zones:[];
export const expandZones=zs=>[...new Set((zs||[]).flatMap(z=>z==='face'?ZONE_KEYS:[z]))].filter(z=>ZONE_KEYS.includes(z));
export function stepsForZone(res,zone){
 if(!ZONE_KEYS.includes(zone))return [];
 return (res?.steps||[]).filter(s=>{const zs=zonesOf(s);return zs.includes('face')||zs.includes(zone)});
}
export function resolveSelection(res,{step=null,zone=null}={}){
 const steps=res?.steps||[],st=step?steps.find(s=>s.id===step)||null:null;
 const z=!st&&ZONE_KEYS.includes(zone)?zone:null;
 let highlight=[];
 if(st){const zs=zonesOf(st);highlight=zs.includes('face')?['face',...ZONE_KEYS]:expandZones(zs)}
 else if(z)highlight=[z];
 const related=z?stepsForZone(res,z):[];
 return {step:st,zone:z,highlight,related,relatedIds:st?[st.id]:related.map(s=>s.id),
  dropped:!!step&&!st,noZoneData:!!st&&!zonesOf(st).length,fullFace:highlight.includes('face')};
}
