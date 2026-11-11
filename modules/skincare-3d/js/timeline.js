// Timeline Controller (logic thuần, không đụng DOM): ngày địa phương, phiên bản có hiệu lực theo ngày, giai đoạn đã áp dụng.
// 0.3.1: isDate xác thực chính xác theo lịch Gregorian; hỗ trợ bản ghi sửa ngày áp dụng (corrections, chỉ thêm).
const pad=n=>String(n).padStart(2,'0');
export const localDate=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

// Năm nhuận Gregorian: chia hết cho 4, trừ năm chia hết cho 100 nhưng không chia hết cho 400.
export const isLeap=y=>y%4===0&&(y%100!==0||y%400===0);
export const daysInMonth=(y,m)=>m===2?(isLeap(y)?29:28):[4,6,9,11].includes(m)?30:31;
// Chỉ nhận chuỗi đúng "YYYY-MM-DD" (chữ số ASCII, không ký tự thừa), năm 0001–9999, tháng 1–12, ngày có thật.
// Không dùng Date/Date.parse → không bị chuẩn hóa ngày sai, không phụ thuộc múi giờ/DST.
// null, undefined, chuỗi rỗng, số, đối tượng… → false (không ném lỗi).
const DATE_RE=/^(\d{4})-(\d{2})-(\d{2})$/;
export function isDate(s){
 if(typeof s!=='string')return false;
 const m=DATE_RE.exec(s);if(!m)return false;
 const y=+m[1],mo=+m[2],d=+m[3];
 return y>=1&&mo>=1&&mo<=12&&d>=1&&d<=daysInMonth(y,mo);
}
// Phép tính ngày trên mốc UTC 00:00 → không bị DST ảnh hưởng. Đầu vào không hợp lệ → null.
const utc=s=>Date.parse(s+'T00:00:00Z');
export const addDays=(s,n)=>isDate(s)&&Number.isInteger(n)?new Date(utc(s)+n*864e5).toISOString().slice(0,10):null;
export const daysBetween=(a,b)=>isDate(a)&&isDate(b)?Math.round((utc(b)-utc(a))/864e5):null;

const ver=(d,id)=>d.versions.find(v=>v.id===id)||null;
// Bản ghi sửa ngày áp dụng (append-only): {target: chỉ số bản ghi trong applications, from, prevFrom, recordedAt, reason}.
// Bản ghi gốc không bị sửa; nếu một bản ghi có nhiều lần sửa thì lần sửa sau cùng có hiệu lực.
function fixes(d){
 const m=new Map;
 for(const c of(Array.isArray(d.corrections)?d.corrections:[]))
  if(c&&Number.isInteger(c.target)&&isDate(c.from))m.set(c.target,c);
 return m;
}
// Nhật ký áp dụng là append-only; cùng ngày thì bản ghi sau thắng.
// Mỗi phần tử: {...bản ghi gốc, seq, from (ngày có hiệu lực sau khi sửa), recordedFrom (ngày ghi lúc đầu), correction}.
const sorted=d=>{
 const f=fixes(d);
 return (Array.isArray(d.applications)?d.applications:[]).map((a,seq)=>{
  const c=f.get(seq),o=a&&typeof a==='object'?a:{};
  return {...o,seq,recordedFrom:o.from,from:c?c.from:o.from,correction:c||null};
 }).filter(a=>isDate(a.from)).sort((a,b)=>a.from<b.from?-1:a.from>b.from?1:a.seq-b.seq);
};
export const applicationsSorted=sorted;
export const lastApplication=d=>sorted(d).at(-1)||null;
export const firstApplication=d=>sorted(d)[0]||null;
export function effectiveAt(d,date){
 const a=sorted(d).filter(x=>x.from<=date).at(-1)||null;
 return {application:a,version:a?ver(d,a.versionId):null};
}
export function periods(d){
 const s=sorted(d);
 return s.map(a=>{const nx=s.find(b=>b.from>a.from);
  return {...a,version:ver(d,a.versionId),to:nx?addDays(nx.from,-1):null,superseded:s.some(b=>b.from===a.from&&b.seq>a.seq)}});
}
// Khoảng ngày được phép khi sửa ngày áp dụng của bản ghi seq: phải nằm giữa (không trùng) bản ghi trước và sau
// theo thứ tự thời gian, để việc sửa không đảo thứ tự lịch sử. null = không giới hạn phía đó.
export function correctionBounds(d,seq){
 const s=sorted(d),i=s.findIndex(a=>a.seq===seq);
 if(i<0)return null;
 return {current:s[i].from,min:i>0?addDays(s[i-1].from,1):null,max:i<s.length-1?addDays(s[i+1].from,-1):null};
}
// Phiên bản đã lưu trước ngày này nhưng chưa từng được ghi nhận áp dụng (vd. dữ liệu 0.2).
export function savedOnlyBefore(d,date){
 const used=new Set((Array.isArray(d.applications)?d.applications:[]).map(a=>a?.versionId));
 return d.versions.filter(v=>v.createdAt&&!used.has(v.id)&&localDate(new Date(v.createdAt))<=date).at(-1)||null;
}
// dayIndex: số ngày kể từ Ngày 0 (mốc tham chiếu, có thể âm); firstApplied: ngày bắt đầu áp dụng thực tế đầu tiên.
export function describeDay(d,date,today){
 const rel=date<today?'past':date===today?'today':'future',eff=effectiveAt(d,date);
 return {date,rel,...eff,current:effectiveAt(d,today),savedOnly:eff.version?null:savedOnlyBefore(d,date),entry:d.journal?.[date]??null,
  dayIndex:d.startDate?daysBetween(d.startDate,date):null,firstApplied:firstApplication(d)?.from??null};
}
