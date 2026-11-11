// Lớp trình bày Timeline (0.4.3). KHÔNG đổi logic ngày/lịch sử: mọi tính toán vẫn do timeline.js (describeDay, addDays…) và manager.js.
// Module này chỉ (1) dựng "mô hình hiển thị" cho MỘT ngày được chọn và (2) dựng HTML ngắn gọn từ mô hình đó.
// Nguyên tắc: mỗi lúc chỉ một bản routine cho ngày đang chọn; không tạo dữ liệu giả (không nội suy, không dự đoán hiệu quả);
// ngày tương lai chỉ hiển thị lịch đã ghi nhận hoặc bản tham khảo có điều kiện, luôn ghi rõ không phải dữ liệu sử dụng thực tế.
import {html} from './html.js';
import {I} from './icons.js';
import {describeDay,addDays,isDate} from './timeline.js';

// Bốn mốc nhanh, tính từ "ngày bắt đầu theo dõi" (startDate): +0, +7, +14, +28 ngày.
export const MILESTONES=[{n:0,label:'Bắt đầu'},{n:7,label:'Tuần 1'},{n:14,label:'Tuần 2'},{n:28,label:'Tuần 4'}];
const WEEKDAY=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
// Chỉ định dạng lại chuỗi YYYY-MM-DD hợp lệ (không dùng múi giờ). Giá trị lạ trả về nguyên văn để không che dữ liệu.
export const fmtDate=s=>isDate(s)?`${s.slice(8)}/${s.slice(5,7)}/${s.slice(0,4)}`:String(s??'');
export const fmtShort=s=>isDate(s)?`${s.slice(8)}/${s.slice(5,7)}`:'';
export const weekday=s=>isDate(s)?WEEKDAY[new Date(s+'T00:00:00Z').getUTCDay()]:'';
// Số ngày so với ngày bắt đầu theo dõi → câu ngắn, không có lệch một ngày: "Bắt đầu" = 0; "Tuần 1" = 7 ngày sau.
export const dayText=i=>i==null?'':i===0?'Ngày bắt đầu theo dõi':i>0?`${i} ngày sau ngày bắt đầu`:`${-i} ngày trước ngày bắt đầu`;
const REL={past:'Đã qua',today:'Hôm nay',future:'Sắp tới'};

// Ngày đang chọn: sel={date} (chọn bằng ô ngày) hoặc sel={m:n} (mốc nhanh). Không có ngày bắt đầu theo dõi → mốc nhanh không có ngày (null).
export const selectedDate=(d,sel)=>isDate(sel?.date)?sel.date:(d.startDate&&Number.isInteger(sel?.m)?addDays(d.startDate,sel.m):null);

// ---- Mô hình hiển thị cho một ngày ----
// kind: 'applied' (quá khứ, có bản được ghi nhận áp dụng) · 'current' (hôm nay) · 'scheduled' (tương lai, đã có lịch được ghi nhận)
//       'reference' (tương lai, chỉ là tham khảo: giữ nguyên routine hiện tại) · 'none' (không có dữ liệu).
export function dayView(d,date,today,{dirty=false}={}){
 const x=describeDay(d,date,today);let kind='none';
 if(x.rel==='future'){
  const scheduled=!!x.version&&x.application?.seq!==x.current.application?.seq;
  kind=scheduled?'scheduled':x.version?'reference':'none';
 }else if(x.version)kind=x.rel==='today'?'current':'applied';
 return {date,rel:x.rel,relLabel:REL[x.rel],dayIndex:x.dayIndex,dayText:dayText(x.dayIndex),kind,version:kind==='none'?null:x.version,application:kind==='none'?null:x.application,
  savedOnly:x.savedOnly,firstApplied:x.firstApplied,entry:x.entry,draft:!!dirty&&x.rel!=='past',startDate:d.startDate||null,
  differs:!!(d.startDate&&x.firstApplied&&d.startDate!==x.firstApplied)};
}

// ---- HTML ----
const TITLE={applied:'Routine đã áp dụng',current:'Routine đang áp dụng',scheduled:'Đã lên lịch áp dụng',reference:'Tham khảo (chưa phải dữ liệu thực tế)',none:'Routine'};
const BOX={applied:'past',current:'now',scheduled:'plan',reference:'plan ref',none:'past none'};
const ICON={applied:I.check,current:I.check,scheduled:I.calendar,reference:I.calendar,none:I.info};

// Bốn mốc nhanh. sel: trạng thái chọn {m}|{date}.
export function trackHtml(sd,sel){
 const on=n=>(!sel?.date&&sel?.m===n)||(!!sd&&!!sel?.date&&sel.date===addDays(sd,n));
 return html`<div class="tl-track" role="group" aria-label="Các mốc lộ trình">${MILESTONES.map(({n,label})=>{
  const dt=sd?addDays(sd,n):null,a=`${label}${dt?`, ${fmtDate(dt)}`:''}`;
  return html`<button class="tl-node ${on(n)?'sel':''}" data-act="day" data-n="${n}" aria-pressed="${on(n)?'true':'false'}" aria-label="${a}"><span class="dot" aria-hidden="true">${n===0?'●':n/7}</span><b>${label}</b>${dt&&html`<small>${fmtShort(dt)}</small>`}</button>`})}</div>`;
}

// Khối tóm tắt ngày + routine + nhật ký + (nếu liên quan) ghi chú bản nháp. ctx: {verRoutine, fmtAt, rulesVersion}.
export function dayHtml(v,ctx){
 const {verRoutine,fmtAt,rulesVersion}=ctx,ver=v.version,app=v.application;
 const verLine=ver&&html`<p class="tl-ver"><b>v${ver.n}</b> · áp dụng từ ${fmtDate(app?.from)}${app?.correction&&html` <span class="tag neutral">ngày áp dụng đã được chỉnh</span>`}${ver.rulesVersion&&ver.rulesVersion!==rulesVersion&&html` <span class="tag warn">bộ quy tắc khác hiện tại</span>`}</p>`;
 let body;
 if(v.kind==='none'){
  body=html`<p class="muted">${v.rel==='past'?'Chưa có routine nào được ghi nhận áp dụng vào ngày này.':v.rel==='today'?'Chưa có routine nào đang được áp dụng.':'Chưa có lịch áp dụng nào được ghi nhận cho ngày này.'}${v.rel==='past'&&v.firstApplied&&v.date<v.firstApplied&&html` Ngày này trước khi bạn bắt đầu áp dụng (${fmtDate(v.firstApplied)}).`}</p>
  ${v.savedOnly&&html`<p class="muted">Có phiên bản v${v.savedOnly.n} được lưu lúc ${fmtAt(v.savedOnly.createdAt)}, nhưng ${v.savedOnly.legacy?'dữ liệu 0.2 không ghi nhận thời điểm áp dụng':'chưa được áp dụng'}.</p>`}`;
 }else body=html`${v.kind==='reference'&&html`<p class="muted">Chưa có thay đổi nào được lên lịch; nếu giữ nguyên routine đang áp dụng thì sẽ như sau. Đây không phải dữ liệu sử dụng thực tế.</p>`}${v.kind==='scheduled'&&html`<p class="muted">Lịch đã được ghi nhận, chưa phải dữ liệu sử dụng thực tế.</p>`}${verLine}${verRoutine(ver)}`;
 const e=v.entry,n=k=>e?.[k]??'—';
 return html`<div class="tl-day"><h3>${weekday(v.date)}${weekday(v.date)&&', '}${fmtDate(v.date)}</h3><span class="tag ${v.rel==='today'?'ok':v.rel==='future'?'info':'neutral'}">${v.relLabel}</span>${v.dayText&&html`<small>${v.dayText}</small>`}</div>
 <div class="tl-boxes"><section class="tlbox ${BOX[v.kind]}"><h4>${ICON[v.kind]} ${TITLE[v.kind]}</h4>${body}</section>
 <section class="tlbox log"><h4>${I.drop} Nhật ký ngày này</h4>${e?html`<p>Khô ${n('dry')}/5 · Dầu ${n('oil')}/5 · Kích ứng ${n('irr')}/5${e.skipped&&' · không dùng đủ bước'}</p>${e.note&&html`<p>${e.note}</p>`}<div id="tlPhoto"></div>`:html`<p class="muted">${v.rel==='future'?'Ngày này chưa tới.':'Chưa có nhật ký cho ngày này.'}</p>`}</section></div>
 ${v.draft&&html`<p class="notice tl-draft">${I.warn}<span>Bạn có thay đổi chưa lưu nên chưa được tính vào lộ trình. <button class="link" data-act="stage" data-s="routine">Mở routine</button></span></p>`}`;
}

// Khu "Tùy chỉnh mốc theo dõi" (thu gọn mặc định). Giữ nguyên id #startDate (trình xử lý change hiện có) và độc lập với lịch sử áp dụng.
export function customHtml(sd,first){
 const differs=!!(sd&&first&&sd!==first);
 return html`<details class="more" id="tlCustom"><summary>Tùy chỉnh mốc theo dõi</summary><div class="tl-ref">
 <label>Ngày bắt đầu theo dõi <input type="date" id="startDate" value="${sd||''}"></label>
 <p class="muted"><small>Đổi mốc theo dõi không thay đổi lịch sử đã lưu.</small></p>
 ${!sd&&html`<p><small>Chưa đặt. Sẽ tự đặt khi bạn lưu và áp dụng routine lần đầu.</small></p>`}
 ${first&&html`<p>Routine thực tế bắt đầu áp dụng từ <b>${fmtDate(first)}</b>.${differs&&html` <span class="tag warn">khác ngày bắt đầu theo dõi</span>`}</p>`}
 ${differs&&html`<details class="inline" id="tlWhy"><summary>Vì sao hai ngày này khác nhau?</summary><p>Ngày bắt đầu theo dõi chỉ dùng để tính các mốc Tuần 1, 2, 4. Ngày áp dụng thực tế là lúc bạn lưu và áp dụng routine. Hai ngày độc lập, hệ thống không tự đồng bộ hay ghi đè lịch sử. Muốn sửa ngày áp dụng thực tế, mở <button class="link" data-act="tab" data-t="versions">Phiên bản › Lịch sử áp dụng</button>.</p></details>`}</div></details>`;
}
// Lưu ý ngắn ngoài khu thu gọn khi hai mốc khác nhau (không che sự khác biệt).
export const differNote=(sd,first)=>sd&&first&&sd!==first?html`<p class="notice tl-differ">${I.info}<span>Ngày bắt đầu theo dõi (${fmtDate(sd)}) khác ngày bắt đầu áp dụng routine (${fmtDate(first)}). <button class="link" data-act="opentl">Xem giải thích</button></span></p>`:'';
