// Icon và hình minh họa sản phẩm (0.4): SVG hằng số dựng bằng html`…` → không tải tài nguyên ngoài, không chèn dữ liệu động
// (ngoại trừ màu lấy từ bảng hằng số bên dưới, đặt trong thuộc tính fill có ngoặc kép).
import {html} from './html.js';
// Mỗi icon là một <svg> 20×20 dùng currentColor (đổi màu theo chữ xung quanh), aria-hidden vì luôn đi kèm nhãn chữ.
export const I={
 check:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l3.5 3.5L16 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 cross:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
 warn:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l8 14H2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 8v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14.6" r="1" fill="currentColor"/></svg>`,
 danger:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 2.5h6l4.5 4.5v6L13 17.5H7L2.5 13V7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 6.5v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.6" r="1" fill="currentColor"/></svg>`,
 info:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="6.3" r="1" fill="currentColor"/></svg>`,
 data:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3" width="13" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 8h6M7 11h6M7 14h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
 sun:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
 moon:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
 face:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5c3.8 0 6 2.8 6 6.6 0 4.2-2.7 8.4-6 8.4s-6-4.2-6-8.4c0-3.8 2.2-6.6 6-6.6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.3 9.2q1 .7 2 0M10.7 9.2q1 .7 2 0M8.4 13.2q1.6 1 3.2 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
 cube:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8l6.5 3.6v7.2L10 17.2l-6.5-3.6V6.4z M3.5 6.4L10 10l6.5-3.6M10 10v7.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
 square:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
 reset:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 9.5a5.6 5.6 0 1 1 1.7 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M3.8 5.2v4.3h4.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 plus:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
 minus:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10h11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
 arrow:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 calendar:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
 drop:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8s5 5.4 5 8.9a5 5 0 0 1-10 0c0-3.5 5-8.9 5-8.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
 gauge:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 14a6.5 6.5 0 1 1 13 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 14l3.2-4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
 bug:html`<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="6" width="8" height="10" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v7M3.5 9.5H6M14 9.5h2.5M3.5 13.5H6M14 13.5h2.5M7.5 6L6 3.8M12.5 6L14 3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
};
// Mức cảnh báo → icon + nhãn chữ (không chỉ dựa vào màu).
export const SEVERITY={
 caution:{lv:'danger',icon:I.danger,label:'Cần thận trọng'},
 conflict:{lv:'danger',icon:I.danger,label:'Xung đột với mục tiêu'},
 dup:{lv:'warn',icon:I.warn,label:'Trùng / chồng chéo'},
 missing:{lv:'warn',icon:I.warn,label:'Thiếu bước'},
 data:{lv:'neutral',icon:I.data,label:'Thiếu dữ liệu'},
 info:{lv:'info',icon:I.info,label:'Thông tin'},
 skin:{lv:'info',icon:I.info,label:'Tham khảo'}};
export const sev=t=>SEVERITY[t]||{lv:'info',icon:I.info,label:'Lưu ý'};

// Hình minh họa sản phẩm theo nhóm (minh họa chung, không phải ảnh sản phẩm thật).
const ART={
 cleanser:{c:'#cfe3df',d:'#7fb2aa'},toner:{c:'#e9dcf0',d:'#a990bb'},serum:{c:'#f3dfcf',d:'#c79a72'},
 treatment:{c:'#f2d8d4',d:'#c48a82'},moisturizer:{c:'#e3e7f3',d:'#8d98bf'},sunscreen:{c:'#f6ead0',d:'#c9a659'},none:{c:'#e9e6e2',d:'#a59f98'}};
export function productArt(cat){
 const k=ART[cat]?cat:'none',{c,d}=ART[k];
 if(k==='cleanser')return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><rect x="47" y="14" width="26" height="10" rx="3" fill="${d}"/><rect x="56" y="8" width="22" height="6" rx="3" fill="${d}"/><rect x="38" y="24" width="44" height="80" rx="16" fill="${c}"/><rect x="46" y="52" width="28" height="22" rx="4" fill="#fff" opacity=".7"/></svg>`;
 if(k==='toner')return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><rect x="50" y="10" width="20" height="16" rx="3" fill="${d}"/><path d="M42 30h36v68a8 8 0 0 1-8 8H50a8 8 0 0 1-8-8z" fill="${c}"/><rect x="48" y="56" width="24" height="26" rx="4" fill="#fff" opacity=".7"/></svg>`;
 if(k==='serum')return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="16" rx="9" ry="7" fill="${d}"/><rect x="53" y="20" width="14" height="14" rx="2" fill="${d}"/><rect x="40" y="34" width="40" height="70" rx="12" fill="${c}"/><rect x="48" y="58" width="24" height="24" rx="4" fill="#fff" opacity=".7"/></svg>`;
 if(k==='treatment')return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><path d="M44 22h32l-4 76a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6z" fill="${c}"/><rect x="48" y="104" width="24" height="8" rx="2" fill="${d}"/><rect x="51" y="48" width="18" height="26" rx="3" fill="#fff" opacity=".7"/><rect x="44" y="16" width="32" height="7" rx="2" fill="${d}"/></svg>`;
 if(k==='moisturizer')return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><rect x="30" y="44" width="60" height="16" rx="5" fill="${d}"/><rect x="26" y="58" width="68" height="44" rx="12" fill="${c}"/><rect x="42" y="70" width="36" height="18" rx="4" fill="#fff" opacity=".7"/></svg>`;
 if(k==='sunscreen')return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><path d="M40 20h40l-6 70H46z" fill="${c}"/><rect x="46" y="90" width="28" height="18" rx="4" fill="${d}"/><circle cx="60" cy="48" r="10" fill="#fff" opacity=".75"/><rect x="40" y="14" width="40" height="8" rx="3" fill="${d}"/></svg>`;
 return html`<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><rect x="36" y="30" width="48" height="70" rx="12" fill="${c}"/><text x="60" y="74" text-anchor="middle" font-size="30" fill="${d}">?</text></svg>`;
}
