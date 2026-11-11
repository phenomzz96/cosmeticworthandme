// Dựng HTML an toàn (0.3.1). Nguyên tắc: MỌI giá trị chèn vào template html`…` đều được escape, trừ khi nó là
// kết quả của chính html`…` (đã an toàn). Vì vậy quên escape sẽ làm nội dung hiện thành chữ (lỗi an toàn),
// không thể vô tình chèn thẻ/thuộc tính/event handler.
//
// Ngữ cảnh được hỗ trợ:
//  • Nội dung văn bản giữa các thẻ, và giá trị thuộc tính ĐẶT TRONG DẤU NGOẶC KÉP: escape & < > " ' (chuẩn OWASP).
//    Không được chèn giá trị vào thuộc tính không có ngoặc, vào tên thẻ/thuộc tính, vào on*=, style= hay <script>
//    (tests/static.test.mjs quét main.js/journal.js để chặn các mẫu này).
//  • URL: không chèn qua template. Dùng safeImageUrl() + setAttribute/thuộc tính DOM (chỉ cho phép blob:).
//  • Số trong thuộc tính SVG: num() chỉ nhận số hữu hạn.
const MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>MAP[c]);

class SafeHtml{constructor(s){this.s=s}toString(){return this.s}}
export const isSafeHtml=x=>x instanceof SafeHtml;

// Phân tích phần tĩnh của template (một lần cho mỗi template, có cache) để biết từng vị trí chèn nằm ở ngữ cảnh nào.
// Cho phép: 'text' (giữa các thẻ) và 'attr' (giá trị thuộc tính trong ngoặc trừ thuộc tính nguy hiểm, hoặc trong <title>/<textarea>).
// Mọi vị trí khác (trong thẻ không có ngoặc, tên thẻ/thuộc tính, comment, <script>/<style>, on*, style, href, src…) → lỗi.
const BAD_ATTR=/^(on|style$|href$|src$|srcset$|srcdoc$|action$|formaction$|xlink:href$|data$|poster$|background$)/i;
// Raw text (không escape được): cấm chèn. RCDATA (<title>, <textarea>): chèn được nhưng luôn escape, kể cả SafeHtml.
const RAW=new Set(['script','style','xmp','iframe','noembed','noframes','noscript','plaintext']),RC=new Set(['title','textarea']);
const cache=new WeakMap();
function contexts(strings){
 let c=cache.get(strings);if(c)return c;c=[];
 let st='text',q='',attr='',tag='',raw=null,rc=null;
 const endTag=()=>{const t=tag.toLowerCase();st='text';if(RAW.has(t))raw=t;else if(RC.has(t))rc=t;else if(t==='/'+rc)rc=null};
 for(let i=0;i<strings.length;i++){
  const s=strings[i];
  for(let j=0;j<s.length;j++){
   const ch=s[j];
   if(raw){if(ch==='<'&&s.slice(j,j+2+raw.length).toLowerCase()==='</'+raw){raw=null;st='tagname';tag='/';j+=1}continue}
   switch(st){
    case 'text':if(ch==='<'){if(s.startsWith('<!--',j)){st='comment';j+=3}else{st='tagname';tag=''}}break;
    case 'comment':if(s.startsWith('-->',j)){st='text';j+=2}break;
    case 'tagname':if(ch==='>')endTag();else if(/\s/.test(ch))st='tag';else tag+=ch;break;
    case 'tag':if(ch==='>')endTag();else if(ch==='/'||/\s/.test(ch)){}else{st='attrname';attr=ch}break;
    case 'attrname':if(ch==='=')st='beforeval';else if(ch==='>')endTag();else if(/\s/.test(ch))st='tag';else attr+=ch;break;
    case 'beforeval':if(ch==='"'||ch==="'"){st='val';q=ch}else if(ch==='>')endTag();else if(!/\s/.test(ch))st='uval';break;
    case 'val':if(ch===q)st='tag';break;
    case 'uval':if(ch==='>')endTag();else if(/\s/.test(ch))st='tag';break;
   }
  }
  if(i<strings.length-1){
   let ok=false,kind='text';
   if(st==='text'&&!raw){ok=true;if(rc)kind='attr'}
   else if(st==='val'&&!BAD_ATTR.test(attr)){ok=true;kind='attr'}
   if(!ok)throw new Error(`html\`…\`: không được chèn giá trị ở ngữ cảnh "${raw?'<'+raw+'>':st}${attr&&st==='val'?' '+attr:''}" (gần: …${s.slice(-40)}). Chỉ chèn vào nội dung văn bản hoặc giá trị thuộc tính an toàn trong dấu ngoặc.`);
   c.push(kind);
  }
 }
 cache.set(strings,c);return c;
}
function part(v,kind){
 if(v==null||v===false)return '';
 if(Array.isArray(v))return v.map(x=>part(x,kind)).join('');
 if(typeof v==='number')return Number.isFinite(v)?String(v):'';
 if(v instanceof SafeHtml)return kind==='text'?v.s:escapeHtml(v.s); // trong thuộc tính: luôn escape, kể cả SafeHtml
 return escapeHtml(v);
}
// Template tag: html`<p>${giaTri}</p>` → SafeHtml. Mảng được nối; null/undefined/false → rỗng.
export function html(strings,...vals){
 const k=contexts(strings);let o=strings[0];
 for(let i=0;i<vals.length;i++)o+=part(vals[i],k[i])+strings[i+1];
 return new SafeHtml(o);
}
// Số cho thuộc tính SVG/HTML (tọa độ, kích thước). Không phải số hữu hạn → 0.
export const num=v=>{const n=Number(v);return new SafeHtml(Number.isFinite(n)?String(n):'0')};
// Gán nội dung cho phần tử. Chỉ nhận SafeHtml để mọi đường vào innerHTML đều đi qua html`…`.
export function setHtml(el,h){
 if(!el)return;
 if(!(h instanceof SafeHtml))throw new TypeError('setHtml chỉ nhận nội dung tạo bởi html`…`.');
 el.innerHTML=h.s;
}
// URL ảnh do ứng dụng tự tạo (URL.createObjectURL) – chỉ cho phép giao thức blob: cùng nguồn trang.
export function safeImageUrl(u){
 if(typeof u!=='string')return null;
 if(!u.startsWith('blob:'))return null;
 try{return new URL(u).protocol==='blob:'?u:null}catch{return null}
}
