// Lớp trình bày cảnh báo (0.4.2). KHÔNG sửa Routine Engine: nhận danh sách cảnh báo gốc do engine trả về,
// nhóm theo ý nghĩa và dựng HTML ngắn gọn dùng chung cho trang Routine và thẻ thông tin ở bước Mô hình.
//
// Nguyên tắc:
//  • Chỉ gộp hai cảnh báo khi CÙNG loại, cùng phạm vi, cùng đối tượng (sản phẩm), cùng tiêu đề (không tính buổi) và cùng lý do;
//    chỉ khác buổi sáng/tối. Mọi trường hợp còn lại giữ riêng. Nếu không chắc → KHÔNG gộp (sai theo hướng an toàn).
//  • Mỗi mục giữ danh sách `sources` (chỉ số trong mảng cảnh báo gốc) và nguyên văn `reason`/`title` của cảnh báo gốc.
//  • Mức độ (lv) của từng mục lấy đúng từ SEVERITY của loại cảnh báo gốc; mức của nhóm = mức cao nhất trong nhóm.
//  • Loại cảnh báo lạ (engine thêm sau này) KHÔNG bị ẩn: vào nhóm "Lưu ý khác", vẫn hiện ở bản tóm tắt.
import {html} from './html.js';
import {I,sev} from './icons.js';
import {RULES} from './rules.js';

const PL={am:'buổi sáng',pm:'buổi tối'};
const PL_SHORT={am:'sáng',pm:'tối'};
const LV_RANK={danger:3,warn:2,neutral:1,info:0};
// Loại cảnh báo gốc → nhóm hiển thị. A–D, O: cần xem lại (được đếm và hiện ở bản tóm tắt). R: chỉ để tham khảo (nằm trong phần chi tiết).
export const GROUP_OF={caution:'A',conflict:'B',dup:'C',missing:'D',data:'D',info:'R',skin:'R'};
export const GROUPS={
 A:{id:'A',label:'Cần thận trọng',short:'Thận trọng',lead:'Cần thận trọng khi dùng chung',icon:I.danger},
 B:{id:'B',label:'Chưa đưa vào routine',short:'Chưa vào routine',lead:'Chưa đưa vào routine',icon:I.warn},
 C:{id:'C',label:'Trùng bước hoặc chồng chéo',short:'Trùng / chồng chéo',lead:'Trùng hoặc chồng chéo',icon:I.warn},
 D:{id:'D',label:'Thiếu bước hoặc dữ liệu',short:'Thiếu bước / dữ liệu',lead:'Thiếu bước hoặc dữ liệu',icon:I.data},
 O:{id:'O',label:'Lưu ý khác',short:'Lưu ý khác',lead:'Lưu ý khác',icon:I.info},
 R:{id:'R',label:'Thông tin tham khảo',short:'Tham khảo',lead:'Tham khảo',icon:I.info}};
export const REVIEW_GROUPS=['A','B','C','D','O']; // thứ tự ưu tiên khi hiển thị
const groupOf=type=>GROUP_OF[type]||'O';

const periodLabel=per=>per.length>1?'Sáng và tối':per[0]==='am'?'Sáng':per[0]==='pm'?'Tối':'';
const stripPeriod=w=>w.per&&PL[w.per]?String(w.title??'').replace(` (${PL[w.per]})`,''):String(w.title??'');
const uniq=a=>[...new Set(a)];

// Tên bước (Làm sạch, Dưỡng ẩm…) suy ra từ nhóm của sản phẩm trong quy tắc; không có → rỗng.
function stepNameOf(p){return RULES.slots.find(s=>s.cat===p?.category)?.name||''}

function describe(w,names,catalog){
 const ids=w.ids||[],prod=catalog.find(p=>p.id===ids[0]);
 switch(w.type){
  case 'caution':return {short:names.join(' + '),item:names.join(' + ')};
  case 'conflict':return {short:`${names[0]||'Sản phẩm'} chưa được đưa vào routine`,item:names[0]||stripPeriod(w)};
  case 'dup':{
   if(w.scope==='cross')return {short:`Chồng chéo: ${names.join(' & ')}`,item:names.join(' & ')};
   const sn=stepNameOf(prod);return {short:`${sn?`Trùng bước ${sn}`:'Trùng bước'}: ${names.join(' & ')}`,item:sn?`bước ${sn}`:names.join(' & ')}}
  case 'missing':{const t=stripPeriod(w).replace(/^Thiếu bước\s+/,'');return {short:`Thiếu bước ${t}`,item:`bước ${t}`}}
  case 'data':return {short:`${names[0]||'Sản phẩm'} chưa đủ dữ liệu để phân loại`,item:`${names[0]||'Sản phẩm'} (thiếu dữ liệu)`};
  case 'info':return {short:`${names[0]||'Sản phẩm'} do bạn tự thêm, chưa có trong lịch sử mua`,item:names[0]||''};
  case 'skin':return {short:`Tham khảo về loại da: ${names[0]||''}`,item:names[0]||''};
  default:return {short:stripPeriod(w),item:stripPeriod(w)};
 }
}

// Nhóm cảnh báo gốc. Trả về {issues, groups, total, groupCount, rawCount, refs, all}.
//  issues: các mục (A–D, O) cần xem lại; refs: các mục tham khảo (R); all = issues + refs theo thứ tự nhóm.
export function groupWarnings(warnings,catalog=[]){
 const list=Array.isArray(warnings)?warnings:[];
 const nameOf=id=>catalog.find(p=>p.id===id)?.name||String(id);
 const map=new Map(),order=[];
 list.forEach((w,i)=>{
  if(!w||typeof w!=='object')return;
  const ids=uniq(Array.isArray(w.ids)?w.ids:[]),idKey=[...ids].sort().join(','),
   key=[w.type,w.scope||'',stripPeriod(w),idKey,w.reason].join('\u0001'); // khác bất kỳ yếu tố nào → không gộp
  let it=map.get(key);
  if(!it){
   const names=ids.map(nameOf),d=describe(w,names,catalog),v=sev(w.type);
   it={key,type:w.type,group:groupOf(w.type),lv:v.lv,typeLabel:v.label,scope:w.scope||'',ids,names,per:[],short:d.short,item:d.item,
    reason:String(w.reason??''),titles:[],sources:[]};
   map.set(key,it);order.push(it);}
  if(w.per&&!it.per.includes(w.per))it.per.push(w.per);
  it.titles.push(String(w.title??''));it.sources.push(i);
 });
 order.forEach(it=>{it.per.sort();it.periodLabel=periodLabel(it.per)});
 const rank=g=>[...REVIEW_GROUPS,'R'].indexOf(g);
 const all=order.map((it,i)=>[it,i]).sort((a,b)=>rank(a[0].group)-rank(b[0].group)||a[1]-b[1]).map(x=>x[0]);
 const issues=all.filter(x=>x.group!=='R'),refs=all.filter(x=>x.group==='R');
 const groups=REVIEW_GROUPS.map(id=>{const its=issues.filter(x=>x.group===id);
  return {id,...GROUPS[id],issues:its,lv:its.reduce((m,x)=>LV_RANK[x.lv]>LV_RANK[m]?x.lv:m,'info')}}).filter(g=>g.issues.length);
 return {issues,refs,all,groups,total:issues.length,groupCount:groups.length,rawCount:list.length,
  rawReview:issues.reduce((s,x)=>s+x.sources.length,0)};
}

const lvCls=lv=>lv==='danger'||lv==='warn'||lv==='neutral'||lv==='info'?lv:'info';
const when=it=>it.periodLabel?` (${it.periodLabel.toLowerCase()})`:'';

// ---- Bản tóm tắt: luôn hiển thị (không nằm trong phần mở rộng) ----
// Nhóm A: mỗi tổ hợp một dòng (tên sản phẩm luôn thấy ngay). Nhóm khác: một dòng/nhóm, liệt kê tên ngắn.
export function summaryLines(view){
 const rows=[];
 for(const g of view.groups){
  if(g.id==='A'){g.issues.forEach(it=>rows.push({g,lv:it.lv,text:`${it.short}${when(it)}`}));continue}
  rows.push({g,lv:g.lv,text:g.issues.map(it=>`${it.item}${when(it)}`).join('; ')});
 }
 return html`${rows.map(r=>html`<li class="wl ${lvCls(r.lv)} g-${r.g.id}">${r.g.icon}<span><b>${r.g.lead}:</b> ${r.text}</span></li>`)}`;
}
export function countLine(view){
 if(!view.total)return '';
 return `${view.total} mục cần xem lại`+(view.groupCount>1?`, thuộc ${view.groupCount} nhóm`:'');
}

// ---- Nội dung chi tiết (mở rộng) ----
const issueDetail=(it,withPeriod=true)=>html`<li class="wi ${lvCls(it.lv)}"><b>${it.short}</b>${withPeriod&&it.periodLabel&&html` <span class="tag">${it.periodLabel}</span>`}
 <p>${it.reason}</p>
 ${it.names.length>0&&html`<small>Sản phẩm liên quan: ${it.names.join(', ')}</small>`}
 <small class="src">Cảnh báo gốc (${it.sources.length}): ${it.titles.join(' · ')}</small></li>`;
// Lưu ý in trên nhãn sản phẩm (dữ liệu sản phẩm, không do engine tạo): gom theo sản phẩm, bỏ trùng.
export function productNotes(steps=[]){
 const seen=new Set(),out=[];
 for(const s of steps)for(const p of s.products||[])for(const x of p.warnings||[]){const k=p.id+'\u0001'+x;if(!seen.has(k)){seen.add(k);out.push({id:p.id,name:p.name,text:x})}}
 return out;
}
export function detailHtml(view,steps=[]){
 const notes=productNotes(steps);
 return html`<div class="wdet">
 ${view.total>0&&html`<p class="muted"><small>Hệ thống tạo ${view.rawReview} cảnh báo gốc cho các mục trên; ở đây được nhóm lại thành ${view.total} mục để dễ đọc. Không cảnh báo nào bị bỏ, mỗi mục ghi rõ cảnh báo gốc của nó. Các quy tắc chỉ mang tính minh họa, chưa được chuyên gia kiểm duyệt.</small></p>`}
 ${view.groups.map(g=>html`<h4>${g.icon} ${g.label} (${g.issues.length})</h4><ul class="wlist">${g.issues.map(it=>issueDetail(it))}</ul>`)}
 ${view.refs.length>0&&html`<h4>${GROUPS.R.icon} ${GROUPS.R.label} (${view.refs.length})</h4><ul class="wlist">${view.refs.map(it=>issueDetail(it))}</ul>`}
 ${notes.length>0&&html`<h4>${I.warn} Lưu ý trên nhãn sản phẩm (${notes.length})</h4><ul class="wlist">${notes.map(n=>html`<li class="wi warn"><b>${n.name}</b><p>${n.text}</p></li>`)}</ul>`}
 ${view.total===0&&view.refs.length===0&&notes.length===0&&html`<p class="muted">Không có cảnh báo nào. Điều này không có nghĩa là routine đã được xác nhận an toàn.</p>`}
 </div>`;
}

// ---- Nhãn ngắn ở từng bước routine ----
// Một nhãn duy nhất: lưu ý mức cao nhất của bước, kèm “+n” nếu còn lưu ý khác; đầy đủ nội dung cho trình đọc màn hình.
// Nhãn (đã nhóm) của bước: các nhóm cảnh báo của bước + “Lưu ý khi dùng” nếu sản phẩm có lưu ý in trên nhãn.
function stepLabels(step,catalog){
 const v=groupWarnings(step?.warnings||[],catalog),hasNote=(step?.products||[]).some(p=>(p.warnings||[]).length>0);
 return [...v.groups.map(g=>({text:g.short,lv:g.lv,icon:g.icon})),...v.refs.length?[{text:GROUPS.R.short,lv:'info',icon:I.info}]:[],...(hasNote?[{text:'Lưu ý khi dùng',lv:'warn',icon:I.warn}]:[])];
}
export const stepNoteLabels=(step,catalog=[])=>stepLabels(step,catalog).map(l=>l.text);
export function stepTag(step,catalog=[]){
 const labels=stepLabels(step,catalog);
 if(!labels.length)return '';
 const top=labels.reduce((m,x)=>LV_RANK[x.lv]>LV_RANK[m.lv]?x:m,labels[0]),rest=labels.length-1;
 return html`<span class="step-warn"><span class="tag ${lvCls(top.lv)}">${top.icon} ${top.text}${rest>0&&html` <span aria-hidden="true">+${rest}</span>`}</span><span class="sr"> Lưu ý ở bước này: ${labels.map(l=>l.text).join('; ')}.</span></span>`;
}

// ---- Thẻ thông tin ở bước Mô hình: chỉ cảnh báo của bước đang chọn, cùng thuật ngữ/nhóm với trang Routine ----
export function stepIssues(step,catalog=[]){
 const v=groupWarnings(step?.warnings||[],catalog);
 const items=[...v.issues,...v.refs];
 if(!items.length)return '';
 return html`<div class="warns" aria-label="Lưu ý của bước này">${items.map(it=>html`<details class="alert ${lvCls(it.lv)} w g-${it.group}"><summary>${GROUPS[it.group].icon}<span><b>${GROUPS[it.group].short}:</b> ${it.short}</span></summary><p>${it.reason}</p></details>`)}</div>`;
}
