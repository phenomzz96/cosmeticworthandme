// UI Controller (0.5).
// 0.3.1: mọi nội dung động dựng bằng html`…` (tự escape, kiểm tra ngữ cảnh) và gán qua setHtml(); ảnh dựng bằng DOM API;
//        Ngày 0 / sửa ngày áp dụng / nhật ký đi qua Routine Manager (tx); trạng thái lưu trữ hiển thị rõ.
// 0.4:   đồng bộ bước ↔ vùng qua selection.js, Viewer3D/2D, góc nhìn, chế độ hiệu năng (dev).
// 0.4.1: luồng 3 giai đoạn (Mục tiêu → Routine → Mô hình 3D) theo nguyên tắc "chỉ hiện thứ cần lúc này";
//        nhật ký / timeline / phiên bản vào khu "Theo dõi & lịch sử"; công cụ developer ẩn sau Developer mode;
//        Three.js chỉ được tải khi vào bước Mô hình 3D. Logic dữ liệu (Engine, Manager, Storage, Timeline) không đổi.
// 0.5:   chống phản hồi bất đồng bộ cũ (3D↔2D, ảnh nhật ký), thông báo lỗi 3D ngắn gọn, trạng thái chọn hiện ngay dưới mô hình,
//        hành động tiếp theo ở bước Mô hình, lưu ý in trên nhãn sản phẩm hiện lại trong dòng bước (khôi phục hành vi 0.4.1).
// 0.4.3: Timeline tối giản qua js/timeline-view.js; công cụ sửa lịch sử áp dụng chuyển sang tab Phiên bản (chỉ lớp trình bày).
// 0.4.2: cảnh báo được nhóm và tóm tắt qua js/warnings-view.js (chỉ lớp trình bày; Engine không đổi).
import {PRODUCTS,USERS,QUIZ,ZONES,setCatalog,upsertUser} from './data.js';
import {mapCatalog,mapQuiz,mapPurchasedIds} from './adapter.js';
import {RULES} from './rules.js';
import {buildRoutine,classify} from './engine.js';
import {RoutineManager} from './manager.js';
import {store} from './storage.js';
import {Viewer3D} from './viewer3d.js';
import {failCause} from './view3d-math.js';
import {Viewer2D} from './viewer2d.js';
import {photos,SCALES,chart} from './journal.js';
import {localDate,addDays,isDate,describeDay,periods,correctionBounds} from './timeline.js';
import {html,setHtml,safeImageUrl} from './html.js';
import {resolveSelection} from './selection.js';
import {I,productArt} from './icons.js';
import {selectedDate,dayView,trackHtml,dayHtml,customHtml,differNote} from './timeline-view.js';
import {groupWarnings,summaryLines,countLine,detailHtml,stepTag,stepNoteLabels,stepIssues} from './warnings-view.js';

const $=s=>document.querySelector(s),pn=id=>PRODUCTS.find(p=>p.id===id)?.name||String(id);
const PL={am:'Buổi sáng',pm:'Buổi tối'},today=()=>localDate();
const DEV_URL=new URLSearchParams(location.search).has('dev');
// v1.0: nhúng iframe hai chiều. Host khai báo origin CHÍNH MÌNH qua query string khi tạo thẻ <iframe> (không có
// cách nào khác để trang trong iframe biết trước origin của host một cách an toàn). Không có hostOrigin → kênh
// nhận dữ liệu từ host bị TẮT HOÀN TOÀN (an toàn mặc định) và ứng dụng chạy ở chế độ demo độc lập như trước.
// Xem docs/integration.md.
const HOST_ORIGIN=new URLSearchParams(location.search).get('hostOrigin');
const S={mode:'3d',day:0,tl:{m:0},flash:[],tlMsg:[],hMsg:[],jMsg:[],modeTok:0,photoTok:0,jviewTok:0,fix:null,histOpen:false,sim:false,step:null,zone:null,touched:false,opened:false,probe:null,
 sel:null,selNote:null,hover:null,perfOn:false,perfTimer:null,slowHint:null,view:'home',stage:'goals',tab:'journal',dev:DEV_URL,goalMsg:null,started3d:false,
 viewFace:'highlight',hostMode:false},v3=new Viewer3D(),v2=new Viewer2D(); // viewFace: 'highlight' (vùng đang chọn) | 'original' (khuôn mặt nguyên bản, không tô) — v0.6
const zn=zs=>zs.map(z=>z==='face'?'toàn khuôn mặt':ZONES[z]||z).join(', ');
const arr=x=>Array.isArray(x)?x:[];
const PHOTO_MAX=5*1024*1024; // 5 MB
const CAT={cleanser:'Làm sạch',toner:'Toner',serum:'Serum',treatment:'Chăm sóc chuyên biệt',moisturizer:'Dưỡng ẩm',sunscreen:'Chống nắng'}; // nhãn hiển thị ở cửa hàng
const periodTag=p=>p==='am'?html`<span class="tag am">${I.sun} Sáng</span>`:p==='pm'?html`<span class="tag pm">${I.moon} Tối</span>`:p==='both'?html`<span class="tag">Sáng/Tối</span>`:html`<span class="tag neutral">Chưa rõ thời điểm</span>`;
// 0.4.2: cảnh báo cần xem lại (thận trọng, giữ ngoài routine, trùng/chồng chéo, thiếu bước/dữ liệu) luôn có dòng tóm tắt hiển thị ngay;
// phần mở rộng chỉ chứa lời giải thích đầy đủ. Việc nhóm nằm ở js/warnings-view.js (GROUP_OF).

function load(uid){
 if(!USERS.some(u=>u.id===uid))uid=USERS[0].id; // giá trị lạ trong storage không làm hỏng trang
 store.setPref('uid',uid);S.uid=uid;S.user=USERS.find(u=>u.id===uid);S.mgr=new RoutineManager(uid,S.user.purchased,{rulesVersion:RULES.version,
  compute:(quiz,selection)=>buildRoutine({quiz,catalog:PRODUCTS,selection,owned:S.user.purchased})});
 S.step=S.zone=null;S.selNote=null;S.touched=false;S.day=0;S.tl={m:0};S.fix=null;S.histOpen=false;S.tlMsg=[];S.hMsg=[];S.jMsg=[];S.goalMsg=null;S.flash=[...S.mgr.notices];renderUserSel();recompute();
 if(S.stage!=='track')S.stage=S.mgr.d.quiz?'routine':'goals';
 renderAll();showStage();
}
// v0.6: móc tích hợp tối thiểu, không ảnh hưởng hành vi khi KHÔNG nhúng trong iframe (window.parent===window thì no-op).
// Host site nhúng qua <iframe> lắng nghe các sự kiện này bằng postMessage — không cần sửa kiến trúc ứng dụng.
// Xem docs/integration.md và examples/host-page-integration.html.
// target '*' chỉ dùng khi KHÔNG cấu hình hostOrigin (giữ nguyên ví dụ demo v0.6 chạy không cần cấu hình gì);
// một khi hostOrigin đã khai báo, luôn gửi đích danh origin đó — không broadcast dữ liệu routine ra toàn trang.
const notifyHost=(type,detail)=>{if(window.parent!==window)try{window.parent.postMessage({source:'skincare-widget',type,detail},HOST_ORIGIN||'*')}catch{}};
const recompute=()=>{S.res=S.mgr.compute(S.mgr.quiz,S.mgr.selection);notifyHost('routine:updated',{res:S.res,quiz:S.mgr.quiz,productIds:S.mgr.selection})};
const goalName=g=>RULES.goals[g]?.label||String(g),skinName=k=>k?QUIZ[1].opts[k]||String(k):'—';
const LABEL={product:pn,goal:goalName,skin:skinName};
// Kết quả thao tác → danh sách thông báo. Ghi bền vững thất bại luôn được nói rõ, không báo "đã lưu" sai.
const report=(r,okMsg)=>!r||r.ok===false?[r?.error||'Thao tác không thành công.']
 :[...(okMsg?[okMsg]:[]),...arr(r.info),...(r.persisted===false?[`CHƯA lưu bền vững: ${r.storageError}`]:[])];
const quizText=v=>!v.quizKnown?html`<b>không có dữ liệu</b> (phiên bản tạo ở 0.2)`:!v.quiz?'chưa làm quiz':`mục tiêu: ${arr(v.quiz.goals).map(goalName).join(', ')||'—'}; loại da tự đánh giá: ${skinName(v.quiz.skin)}`;
const stepsHtml=snap=>arr(snap?.steps).length?html`<ul>${snap.steps.map(s=>html`<li>${PL[s.period]||s.period} · ${s.name}: ${arr(s.products).map(p=>p.name).join(', ')}</li>`)}</ul>`:html`<p class="muted">(routine trống)</p>`;
const verRoutine=v=>v.snapshot?stepsHtml(v.snapshot):html`<p class="muted">Không có ảnh chụp routine (dữ liệu 0.2). Sản phẩm đã lưu: ${arr(v.selection).map(pn).join(', ')||'—'}</p>`;
const fmtAt=x=>x?new Date(x).toLocaleString('vi-VN'):'không có dữ liệu';
// 0.4.3: nhãn hiển thị cho khách là "Ngày bắt đầu theo dõi" (dữ liệu/logic vẫn là startDate); đổi nhãn ở lớp trình bày, kể cả thông báo do Manager/Storage tạo.
const ux=x=>String(x??'').replace(/Ngày 0/g,'Ngày bắt đầu theo dõi');
const flashBox=list=>list.length?html`<div class="flash" role="status">${list.map(x=>html`<p>${ux(x)}</p>`)}</div>`:'';


// ---- Đồng bộ lựa chọn (bước ↔ vùng) ----
// Gọi sau mọi thay đổi routine/lựa chọn: bước đã biến mất → bỏ chọn + ghi chú; tính lại vùng cần highlight.
function reconcile(){
 const r=resolveSelection(S.res,S);
 if(r.dropped){S.selNote='Bước bạn đang xem không còn trong routine sau thay đổi vừa rồi nên đã được bỏ chọn.';S.step=null}
 S.zone=r.zone??(S.step?null:S.zone&&ZONES[S.zone]?S.zone:null);
 S.sel=resolveSelection(S.res,S);
}
// Nhớ trạng thái mở/đóng của các phần mở rộng có id (Tùy chọn lưu, Chi tiết routine, Chỉnh sửa sản phẩm, Xem chi tiết) qua các lần vẽ lại.
const openState=new Set();
function keepOpen(){for(const d of document.querySelectorAll('#feature details[id]'))if(openState.has(d.id)&&!d.open)d.open=true}
function renderAll(){reconcile();renderStorage();renderHome();renderQuiz();renderAnalysis();renderRoutine();renderStudio();renderTimeline();renderJournal();renderVersions();renderStepper();keepOpen();sync()}
function refresh(){reconcile();renderStorage();renderRoutine();renderStudio();renderTimeline();renderVersions();renderStepper();keepOpen();sync()}
const edit=fn=>{const r=fn();S.flash=report(r);recompute();refresh()};
// v0.6: "Nguyên bản" chỉ ẩn lớp tô vùng khi vẽ (truyền mảng rỗng) — không đụng tới S.sel/S.zone/S.step hay bất kỳ trạng thái
// nào khác, nên khôi phục lại "Vùng đang chọn" luôn cho đúng vùng đã chọn trước đó, không mất lựa chọn/góc nhìn/mục tiêu/routine.
function sync(){const h=S.viewFace==='original'?[]:(S.sel?.highlight||[]);v3.highlight(h);v2.highlight(h)}
function selectStep(id){S.step=id;S.zone=null;S.selNote=null;S.touched=true;refresh()}
function selectZone(z){S.zone=z;S.step=null;S.selNote=null;S.touched=true;refresh()}
function clearSel(){S.step=S.zone=null;S.selNote=null;refresh()}

// ---- Điều hướng: 3 giai đoạn + khu Theo dõi & lịch sử ----
const STAGES=[['goals','Mục tiêu'],['routine','Routine'],['model','Mô hình 3D']];
function showStage(){
 document.querySelectorAll('#feature [data-stage]').forEach(p=>p.hidden=p.dataset.stage!==S.stage);
 const tb=$('#trackBtn');tb.classList.toggle('sel',S.stage==='track');tb.setAttribute('aria-pressed',String(S.stage==='track'));
 document.querySelectorAll('#stage-track [data-tab]').forEach(p=>p.hidden=p.dataset.tab!==S.tab);
 document.querySelectorAll('#stage-track [data-act=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.t===S.tab));b.classList.toggle('sel',b.dataset.t===S.tab)});
 renderStepper();
 // Chỉ tải/khởi tạo 3D khi người dùng thực sự mở bước Mô hình; rời bước này thì dừng render.
 if(S.view==='feature'&&S.stage==='model'){if(!S.started3d){S.started3d=true;setMode('3d')}else if(S.mode==='3d'&&v3.ready)v3.start()}
 else v3.stop();
}
function setStage(s,{scroll=true}={}){S.stage=s;showStage();if(scroll)window.scrollTo({top:0})}
// Trạng thái lưu trữ: chỉ hiện khi dữ liệu KHÔNG được lưu bền vững (hoặc kiểm tra ban đầu cho thấy không ghi được).
function renderStorage(){
 const st=S.mgr.storage||{persistent:true},pr=S.probe,msgs=[];
 if(!st.persistent)msgs.push(st.message+(st.detail?` (Chi tiết: ${st.detail})`:''));
 else if(pr&&!pr.writable)msgs.push(`Kiểm tra bộ nhớ trình duyệt: ${pr.readable?'không ghi được':'không truy cập được'} (${pr.error}). Các thay đổi có thể chỉ được lưu tạm trong phiên này.`);
 setHtml($('#storage'),msgs.length?html`<div class="storagebar" role="alert">${I.danger}<div><b>Lưu trữ: chỉ tạm thời trong phiên này</b>${msgs.map(x=>html`<p>${x}</p>`)}${st.retryable&&html`<button data-act="retry">Thử lưu lại vào trình duyệt</button>`}</div></div>`:html``);
}

function renderHome(){
 const own=S.user.purchased;
 setHtml($('#home'),html`<section class="hero">
 <div class="hero-main"><p class="eyebrow">Cửa hàng mẫu · Lumière Skin</p><h1>Routine của bạn, dựng từ chính những sản phẩm bạn đã có.</h1>
 <p class="lead">Chọn mục tiêu, nhận routine sáng – tối và xem vị trí thoa từng sản phẩm trên mô hình 3D.</p>
 <div class="actions"><button class="primary" data-act="view" data-v="feature">Bắt đầu ${I.arrow}</button></div></div>
 <aside class="account-card"><p class="eyebrow">Hồ sơ của bạn</p><h2>${S.user.name}</h2><p class="muted">${own.length} sản phẩm đã mua</p>
 <ul class="owned-list">${own.map(i=>html`<li>${pn(i)}</li>`)}</ul></aside></section>
 <div class="section-head"><h2>Sản phẩm</h2><p class="muted">Trang mẫu, không có giỏ hàng hay thanh toán.</p></div>
 <div class="products">${PRODUCTS.map(p=>html`<article class="product"><div class="pic">${productArt(p.category)}</div>
 <div class="body"><h3>${p.name}</h3><p class="meta">${CAT[p.category]||'Chưa rõ nhóm'}${own.includes(p.id)&&html` · <b class="owned-mark">Đã mua</b>`}</p></div></article>`)}</div>`);
}
function renderStepper(){
 const d=S.mgr.d,done={goals:!!d.quiz&&arr(d.quiz.goals).length>0,routine:S.res.steps.length>0,model:S.touched};
 setHtml($('#stepper'),html`${STAGES.map(([id,t],i)=>html`<li class="${done[id]?'done':''} ${S.stage===id?'cur':''}"><button data-act="stage" data-s="${id}" aria-current="${S.stage===id?'step':'false'}"><span class="n">${done[id]?I.check:i+1}</span><span>${t}</span></button></li>`)}`);
}
function renderQuiz(){
 const q=S.mgr.d.quiz||{},own=S.user.purchased;
 setHtml($('#quiz'),html`<div class="panel-head"><p class="eyebrow">Bước 1/3</p><h1 id="goalsTitle">Bạn muốn chăm sóc da theo hướng nào?</h1>
 <p class="lead">Chọn mục tiêu. Hệ thống sắp xếp các sản phẩm bạn đã mua thành routine sáng và tối.</p></div>
 <div class="quiz">${QUIZ.map(Q=>html`<fieldset><legend>${Q.q}</legend><div class="opts">${Object.entries(Q.opts).map(([k,t])=>html`<label class="opt"><input type="${Q.type==='multi'?'checkbox':'radio'}" name="${Q.id}" value="${k}"><span>${t}</span></label>`)}</div></fieldset>`)}</div>
 <div class="owned-box"><h2>Sản phẩm bạn đã mua <small>(${own.length})</small></h2><ul class="owned-list">${own.map(i=>html`<li>${pn(i)}</li>`)}</ul></div>
 ${S.goalMsg&&html`<p class="alert warn" role="alert">${I.warn}<span>${S.goalMsg}</span></p>`}
 <div class="actions"><button class="primary" data-act="quiz">Tạo routine của tôi ${I.arrow}</button></div>`);
 // Trạng thái chọn được đặt bằng DOM (không chèn thuộc tính vào chuỗi HTML).
 for(const Q of QUIZ)for(const i of document.querySelectorAll(`#quiz input[name="${Q.id}"]`))
  i.checked=Q.type==='multi'?arr(q[Q.id]).includes(i.value):q[Q.id]===i.value;
}
function renderAnalysis(){
 const rows=S.user.purchased.map(id=>{const p=PRODUCTS.find(x=>x.id===id);return {p,c:classify(p)}}),ok=rows.filter(r=>r.c.ok).length;
 setHtml($('#analysis'),html`<p class="muted">${ok}/${rows.length} sản phẩm có đủ dữ liệu để phân loại. Phân loại dựa trên thông tin khai báo của sản phẩm, không dựa vào tên.</p>
 <div class="tablewrap"><table><tr><th>Sản phẩm</th><th>Nhóm</th><th>Chức năng (khai báo)</th><th>Dùng</th></tr>${rows.map(({p,c})=>html`<tr><td>${p.name}</td><td>${c.ok?c.group:html`<span class="tag danger">${I.data} Chưa đủ thông tin để phân loại</span>`}</td><td>${p.functions.join(', ')||'—'}</td><td>${{am:'Sáng',pm:'Tối',both:'Sáng/Tối'}[p.recommendedPeriod]||'—'}</td></tr>`)}</table></div>`);
}
const STATUS={insufficient:{icon:I.cross,t:'Chưa đủ cơ sở',m:'Cần chọn ít nhất một mục tiêu và có ít nhất một sản phẩm phân loại được.'},
 incomplete:{icon:I.warn,t:'Routine chưa hoàn chỉnh',m:'Còn thiếu bước hoặc dữ liệu sản phẩm.'},
 unmet:{icon:I.cross,t:'Chưa đáp ứng mục tiêu',m:'Sản phẩm hiện có chưa đáp ứng mục tiêu đã chọn. Đây chỉ là khung các bước cơ bản.'},
 review:{icon:I.warn,t:'Cần xem xét',m:'Chưa nên coi đây là routine hoàn chỉnh.'},
 partial:{icon:I.info,t:'Đáp ứng một phần',m:'Mới đáp ứng một phần mục tiêu (xem Chi tiết routine).'},
 ready:{icon:I.check,t:'Sẵn sàng',m:'Đủ các bước theo bộ quy tắc minh họa. Không có cảnh báo không có nghĩa là đã được xác nhận an toàn.'}};
// 0.5: lưu ý IN TRÊN NHÃN sản phẩm (vd. "Có thể gây khô hoặc châm chích") hiện nguyên văn trong dòng bước như 0.4.1 – đây là lưu ý
// dùng an toàn ngắn gọn, không nên chỉ nằm sau phần thu gọn (0.4.2 đã ẩn nhầm; tests/ui04.e2e.py Test 4 phát hiện khi chạy 3D thật).
const stepNotes=s=>[...new Set(s.products.flatMap(p=>p.warnings||[]))];
function stepRow(s,i){
 const sel=S.step===s.id,rel=!sel&&!!S.sel?.relatedIds.includes(s.id);
 return html`<li class="step ${sel?'sel':''} ${rel?'rel':''}" data-act="step" data-id="${s.id}" tabindex="0" role="button" aria-pressed="${sel?'true':'false'}" aria-label="${s.name}: ${s.products.map(p=>p.name).join(', ')} – xem trên mô hình${stepNoteLabels(s,PRODUCTS).length>0&&`. Lưu ý: ${stepNoteLabels(s,PRODUCTS).join('; ')}`}${stepNotes(s).length>0&&`. ${stepNotes(s).join(' ')}`}">
 <span class="step-num">${i+1}</span><div class="step-body"><b class="step-name">${s.name}</b><span class="step-prod">${s.products.map(p=>p.name).join(' + ')}</span>
 <small class="step-purpose">${s.purpose}</small>${stepNotes(s).map(x=>html`<small class="pw">${I.warn} ${x}</small>`)}${stepTag(s,PRODUCTS)}</div>
 <span class="go" aria-hidden="true">${I.arrow}</span></li>`;
}
function renderRoutine(){
 const r=S.res,m=S.mgr,sel=m.selection,st=STATUS[r.status],fo=PRODUCTS.filter(p=>!sel.includes(p.id)).map(p=>html`<option value="${p.id}">${p.name}</option>`);
 const wv=groupWarnings(r.warnings,PRODUCTS);
 const periods=['am','pm'].map(per=>{const list=r.steps.filter(s=>s.period===per);if(!list.length)return '';
  return html`<section class="period ${per}"><h2>${per==='am'?I.sun:I.moon} ${PL[per]}</h2><ol class="steps">${list.map(stepRow)}</ol></section>`});
 setHtml($('#routine'),html`<div class="panel-head"><p class="eyebrow">Bước 2/3</p><h1>Routine của bạn ${m.dirty?html`<span class="tag warn">chưa lưu</span>`:html`<span class="tag ok">đã lưu</span>`}${!m.storage?.persistent&&html`<span class="tag danger">lưu tạm trong phiên</span>`}</h1></div>
 ${S.flash.length>0&&html`<div class="flash" role="status">${S.flash.map(x=>html`<p>${ux(x)}</p>`)}<button class="ghost" data-act="flashx">Đóng</button></div>`}
 ${!m.d.quiz?html`<p class="alert info">${I.info}<span>Bạn chưa chọn mục tiêu.</span></p><div class="actions"><button class="primary" data-act="stage" data-s="goals">Chọn mục tiêu</button></div>`:html`
 <div class="status ${r.status} wsum"><div class="wsum-head">${st.icon}<div><b>${st.t}</b> ${st.m}${wv.total>0&&html` <span class="wsum-n">${countLine(wv)}.</span>`}</div></div>
  ${wv.groups.length>0&&html`<ul class="wsum-list" aria-label="Những điểm cần chú ý">${summaryLines(wv)}</ul>`}
  <div class="wsum-act">${r.warnings.length>0&&html`<button class="chip" data-act="openedit">Chỉnh sửa sản phẩm</button>`}<details class="wmore" id="warnMore"><summary>Xem giải thích chi tiết</summary>${detailHtml(wv,r.steps)}</details></div></div>
 <div class="periods">${periods}</div>
 <div class="actions">${r.steps.length>0&&html`<button class="primary" data-act="stage" data-s="model">Xem trên mô hình 3D ${I.arrow}</button>`}<button data-act="save">Lưu routine</button></div>
 <details class="more" id="saveOpts"><summary>Tùy chọn lưu</summary>${saveHtml(m)}</details>
 <details class="more" id="routineMore"><summary>Chi tiết routine</summary>
  ${r.goals.length>0&&html`<h3>Mục tiêu${r.skin&&html` <small>(tự đánh giá da: ${r.skin.label} – chỉ để tham khảo)</small>`}</h3><ul class="goals">${r.goals.map(g=>html`<li class="${g.state}">${g.state==='met'?I.check:I.cross}<div><b>${g.state==='met'?'Đã đáp ứng':'Chưa đáp ứng'}: ${g.label}</b><small>${g.reason}</small></div></li>`)}</ul>`}
  ${r.statusReasons.length>0&&html`<h3>Vì sao có trạng thái này</h3><ul>${r.statusReasons.map(x=>html`<li>${x}</li>`)}</ul>`}
  ${r.excluded.length>0&&html`<h3>Sản phẩm chưa xếp vào routine (${r.excluded.length})</h3><ul class="excl">${r.excluded.map(x=>html`<li><b>${x.name}</b>: ${x.reason}</li>`)}</ul>`}
  <h3>Giải thích quyết định</h3><ul>${r.explain.map(e=>html`<li>${e}</li>`)}</ul>
  <p class="muted"><small>Bộ quy tắc: ${RULES.version}. Chỉ minh họa, không phải lời khuyên da liễu.</small></p></details>
 <details class="more" id="editBox"><summary>Chỉnh sửa sản phẩm</summary><ul class="sel-list">${sel.length?sel.map(id=>html`<li><span class="nm">${pn(id)} ${!S.user.purchased.includes(id)&&html`<span class="tag warn">chưa mua</span>`}</span><button class="chip danger-ghost" data-act="rm" data-id="${id}">Bỏ</button><select data-act="rep" data-id="${id}" aria-label="Thay ${pn(id)} bằng sản phẩm khác"><option value="">Thay bằng…</option>${fo}</select></li>`):html`<li class="muted">Danh sách trống.</li>`}</ul>
 <div class="row"><select id="addSel" aria-label="Chọn sản phẩm để thêm"><option value="">Thêm sản phẩm…</option>${fo}</select><button data-act="add">Thêm</button><button class="ghost" data-act="regen">Tạo lại từ sản phẩm đã mua</button></div></details>`}`);
 keepOpen();
}
// 0.4.1: chỉ còn một nút "Lưu routine" (hiển thị sẵn); khối này chỉ chứa tùy chọn, nằm trong phần mở rộng "Tùy chọn lưu".
function saveHtml(m){
 const t=today(),min=m.minApplyDate(),def=min&&min>t?min:t;
 return html`<div class="savebox"><input id="vnote" placeholder="Ghi chú phiên bản (không bắt buộc)" maxlength="500" aria-label="Ghi chú phiên bản">
 <div class="row"><label>Áp dụng từ <input type="date" id="vfrom" value="${def}" min="${min||''}"></label><label class="check"><input type="checkbox" id="vdraft"> Chỉ lưu, chưa áp dụng</label></div>
 <small>Các tùy chọn này áp dụng cho nút “Lưu routine” ở trên. Mỗi phiên bản lưu quiz, sản phẩm, bộ quy tắc (${RULES.version}) và ảnh chụp routine. Khôi phục một phiên bản đầy đủ sẽ ghi thêm "áp dụng lại từ hôm nay"; lịch sử cũ không bị sửa.</small></div>`;
}
function versionHtml(m,v){
 const apps=periods(m.d).filter(a=>a.versionId===v.id).sort((a,b)=>a.seq-b.seq),cur=m.applied?.id===v.id;
 const badge=[v.id===m.d.basisId&&html`<span class="tag info">đang nạp</span>`,cur&&html`<span class="tag ok">đang áp dụng</span>`,v.legacy&&html`<span class="tag warn">dữ liệu 0.2</span>`].filter(Boolean).map(b=>html`${b} `);
 return html`<details class="ver"><summary><b>v${v.n}</b> · ${fmtAt(v.createdAt)} ${badge}<br><small>${v.change||'không có thông tin thay đổi'}</small></summary>
 <p><b>Quiz:</b> ${quizText(v)}</p><p><b>Sản phẩm:</b> ${arr(v.selection).map(pn).join(', ')||'(trống)'}</p>
 <p><b>Bộ quy tắc:</b> ${v.rulesVersion||'không có dữ liệu'}${v.rulesVersion&&v.rulesVersion!==RULES.version&&html` <span class="tag warn">khác bộ quy tắc hiện tại</span>`}</p>
 <p><b>Áp dụng:</b> ${apps.length?apps.map((a,i)=>html`${i>0&&'; '}từ ${a.from} (${a.kind==='restore'?'khôi phục':'khi lưu'}${a.correction&&html`, đã sửa từ ${a.recordedFrom}`})`):v.legacy?'không có dữ liệu (0.2 không ghi nhận)':'chưa áp dụng'}</p>
 ${v.legacy&&html`<p class="muted">Trường không có dữ liệu: ${arr(v.legacy.missing).join(', ')}</p>`}${v.note&&html`<p><b>Ghi chú:</b> ${v.note}</p>`}
 <details><summary>Routine lúc lưu</summary>${verRoutine(v)}</details>
 <button data-act="restore" data-id="${v.id}">${I.reset} Khôi phục phiên bản này</button></details>`;
}


function renderVersions(){
 const m=S.mgr;
 setHtml($('#versions'),html`${flashBox(S.hMsg)}${historyHtml(m)}<p class="muted">Mỗi lần "Lưu routine" tạo một phiên bản. Khôi phục một phiên bản sẽ ghi thêm "áp dụng lại từ hôm nay"; lịch sử cũ không bị sửa.</p>
 ${m.d.versions.length?m.d.versions.slice().reverse().map(v=>versionHtml(m,v)):html`<p class="muted">Chưa có phiên bản nào.</p>`}`);
}
// ---- Bước Mô hình 3D: danh sách bước (duy nhất) + thẻ giải thích ----
function renderStudio(){renderZonebar();renderStepPick();renderInfo();renderHint();renderPerf();renderModelNext()}
// Hành động tiếp theo ở bước cuối của luồng (không thêm nút "Lưu" thứ hai: chưa lưu → quay lại Routine để lưu; đã lưu → Theo dõi).
function renderModelNext(){
 const el=$('#modelNext');if(!el)return;const m=S.mgr;
 setHtml(el,!m?.d.quiz||!S.res?.steps.length?html``:m.dirty||!m.d.versions.length
  ?html`<p class="muted">Routine chưa được lưu. Lưu để bắt đầu theo dõi.</p><button data-act="stage" data-s="routine">Quay lại routine để lưu</button>`
  :html`<p class="muted">Routine đã lưu.</p><button data-act="stage" data-s="track">Theo dõi &amp; lịch sử ${I.arrow}</button>`);
}
function renderZonebar(){
 setHtml($('#zonebar'),html`${Object.entries(ZONES).map(([k,t])=>html`<button class="chip" data-act="zone" data-z="${k}" aria-pressed="${S.zone===k?'true':'false'}">${t}</button>`)}`);
}
function renderStepPick(){
 const r=S.res;
 setHtml($('#stepPick'),r.steps.length?html`<div class="panel-head compact"><p class="eyebrow">Bước 3/3</p><h1>Xem từng bước trên mô hình</h1></div>${['am','pm'].map(per=>{const l=r.steps.filter(s=>s.period===per);return l.length?html`<div class="pick"><span class="lbl">${per==='am'?I.sun:I.moon} ${PL[per]}</span><div class="pick-list">${l.map((s,i)=>{const rel=!!S.sel?.zone&&S.sel.relatedIds.includes(s.id);return html`<button class="pickbtn ${rel?'rel':''}" data-act="step" data-id="${s.id}" aria-pressed="${S.step===s.id?'true':'false'}">${i+1}. ${s.name}${rel&&html`<span class="sr"> (áp dụng ở vùng đang chọn)</span>`}</button>`})}</div></div>`:''})}`
  :html`<div class="panel-head compact"><p class="eyebrow">Bước 3/3</p><h1>Mô hình 3D</h1></div><p class="muted">Chưa có routine. <button class="link" data-act="stage" data-s="goals">Chọn mục tiêu</button></p>`);
}
function renderInfo(){
 const r=S.res,sel=S.sel,st=sel?.step;let h;
 const note=S.selNote?html`<p class="alert warn">${I.info}<span>${S.selNote}</span></p>`:'';
 if(st){
  const idx=r.steps.filter(s=>s.period===st.period).indexOf(st)+1;
  h=html`${note}<div class="info-card"><p class="kicker">${periodTag(st.period)} Bước ${idx}</p><h2>${st.name}</h2>
  <p class="info-prod">${st.products.map(p=>p.name).join(' + ')}</p><p>${st.purpose}</p>
  <p class="info-zone">Vùng thoa: <b>${st.zones.length?zn(st.zones):'chưa khai báo'}</b></p>
  ${st.products.flatMap(p=>p.warnings).map(x=>html`<p class="alert warn">${I.warn}<span>${x}</span></p>`)}
  ${stepIssues(st,PRODUCTS)}
  <details class="more" id="infoMore"><summary>Xem chi tiết</summary>
   ${st.products.map(p=>html`<div class="prodline"><b>${p.name}</b><small>Cách dùng: ${p.usage}</small></div>`)}
   <p><small>Vùng thoa lấy từ dữ liệu khai báo của sản phẩm${!st.zones.length&&' – hệ thống không tự suy đoán khi thiếu'}. Mô hình chỉ minh họa vị trí, không thể hiện hiệu quả.</small></p></details>
  <button class="ghost" data-act="clearsel">Bỏ chọn</button></div>`;
 }else if(sel?.zone){
  const n=sel.related.length;
  h=html`${note}<div class="info-card"><p class="kicker">Vùng da</p><h2>${ZONES[sel.zone]}</h2>
  <p>${n?`${n} bước có khai báo áp dụng ở vùng này – được đánh dấu trong danh sách ở trên.`:'Chưa có bước nào khai báo áp dụng cho vùng này.'}</p>
  ${n>0&&html`<ul class="rel-list">${sel.related.map(s=>html`<li>${PL[s.period]} · ${s.name}: ${s.products.map(p=>p.name).join(', ')}</li>`)}</ul>`}
  <button class="ghost" data-act="clearsel">Bỏ chọn</button></div>`;
 }else h=html`${note}<p class="info-empty">Chọn một bước ở trên để xem vị trí thoa trên mô hình, hoặc chạm vào trán, má, cằm.</p>`;
 setHtml($('#info'),h);keepOpen();
}
// Dòng ngay dưới mô hình: rê chuột → tên vùng; đang chọn → nói rõ đang xem gì (phản hồi thấy ngay, kể cả trên điện thoại khi thẻ
// thông tin nằm phía dưới); chưa chọn → hướng dẫn thao tác.
function renderHint(){
 const el=$('#stageHint');if(!el)return;
 const st=S.sel?.step,gest=S.mode==='3d'?'Kéo để xoay · Cuộn hoặc chụm để phóng to · Chạm vào một vùng để chọn':'Chạm vào một vùng để chọn';
 const hv=S.hover&&S.hover!==S.sel?.zone?S.hover:null; // rê chuột trên CHÍNH vùng đang chọn → hiện trạng thái, không mời "nhấp để chọn" lần nữa
 el.classList.toggle('on',!hv&&!!(st||S.sel?.zone));
 el.textContent=hv?`${ZONES[hv]} – nhấp để chọn`:st?`Đang xem: ${PL[st.period]} · ${st.name} – ${st.zones.length?zn(st.zones):'chưa khai báo vùng thoa'}`
  :S.sel?.zone?`Đang xem vùng: ${ZONES[S.sel.zone]} – ${S.sel.related.length} bước áp dụng`:gest;
}
function onHover(z){S.hover=z;renderHint()}
// Chế độ hiệu năng (dev, tắt mặc định): số liệu đọc trực tiếp từ renderer, không phải con số "đạt chuẩn".
function renderPerf(){
 const el=$('#perf');if(!el)return;el.hidden=!S.perfOn;$('#perfBtn').textContent='Hiệu năng (dev): '+(S.perfOn?'BẬT':'TẮT');$('#perfBtn').classList.toggle('sel',S.perfOn);
 if(!S.perfOn)return;
 const d=v3.debugInfo(),g=d.gpu;
 setHtml(el,html`<div><b>Chế độ:</b> ${S.mode.toUpperCase()} · <b>3D sẵn sàng:</b> ${d.ready?'có':'không'} · <b>Khởi tạo:</b> ${d.initCount} lần · <b>Canvas:</b> ${d.canvases}</div>
 <div><b>Vòng render:</b> ${d.rafPending?'đang vẽ':'đang nghỉ (không vẽ khi không có thay đổi)'} · <b>Khung đã vẽ:</b> ${d.frames}</div>
 <div><b>FPS ước lượng</b> (khi render liên tục ≥ 1 giây): ${d.fps==null?'chưa đủ dữ liệu':d.fps.toFixed(1)}</div>
 <div><b>Đối tượng hiển thị:</b> ${d.objects} · <b>Draw calls:</b> ${g?g.calls:'—'} · <b>Tam giác:</b> ${g?g.triangles:'—'}</div>
 <div><b>Geometry (quản lý / GPU):</b> ${d.geometries} / ${g?g.geometries:'—'} · <b>Material:</b> ${d.materials} · <b>Texture:</b> ${g?g.textures:'—'}</div>
 <div><b>Kích thước:</b> ${d.size?d.size.join('×'):'—'} px · <b>Pixel ratio:</b> ${d.pixelRatio??'—'} · <b>Giảm chuyển động:</b> ${d.reduced?'bật':'tắt'}</div>`);
}
function onSlow(fps){
 S.slowHint=`Mô hình 3D có vẻ chạy chậm trên thiết bị này (ước lượng ~${Math.round(fps)} khung hình/giây trong nhiều lần tương tác liên tiếp). Bạn có thể chuyển sang 2D; mọi chức năng khác không đổi.`;
 renderSlowHint();
}
function renderSlowHint(){setHtml($('#perfHint'),S.slowHint?html`<div class="hintbox" role="status">${I.gauge}<span>${S.slowHint}</span><button data-act="mode" data-m="2d">Chuyển sang 2D</button><button class="ghost" data-act="slowx">Ẩn</button></div>`:html``)}


// ---- Timeline ----
function renderTimeline(){
 const m=S.mgr,d=m.d,sd=d.startDate,t=today(),date=selectedDate(d,S.tl),first=periods(d)[0]?.from??null;
 // Vẽ lại làm mất tiêu điểm của phần tử cũ → ghi nhớ rồi trả tiêu điểm (thao tác bằng bàn phím không bị "nhảy" ra ngoài).
 const ae=document.activeElement,box=$('#timeline'),fsel=ae&&box?.contains(ae)?(ae.id?'#'+ae.id:ae.dataset?.act==='day'?`[data-act=day][data-n="${ae.dataset.n}"]`:''):'';
 // Đọc trạng thái mở trực tiếp từ DOM trước khi vẽ lại (không chỉ dựa vào sự kiện toggle) để khu "Tùy chỉnh" không tự đóng.
 const wasOpen=['tlCustom','tlWhy'].filter(id=>$('#'+id)?.open);
 const v=date?dayView(d,date,t,{dirty:m.dirty}):null;
 setHtml(box,html`<h2>Lộ trình chăm sóc da</h2><p class="sub">Các mốc chỉ giúp bạn theo dõi quá trình dùng routine, không dự đoán hiệu quả.</p>
 ${flashBox(S.tlMsg)}${trackHtml(sd,S.tl)}
 <div class="tl-pick">${I.calendar}<label>Chọn ngày khác <input type="date" id="tlDate" value="${S.tl.date||''}"></label></div>
 ${differNote(sd,first)}
 ${v?dayHtml(v,{verRoutine,fmtAt,rulesVersion:RULES.version}):html`<p class="muted tl-empty">Chưa có ngày bắt đầu theo dõi. Hãy đặt trong “Tùy chỉnh mốc theo dõi” bên dưới hoặc chọn một ngày bất kỳ.</p>`}
 ${customHtml(sd,first)}`);
 const e=v?.entry;
 if(e?.photo){const u=S.uid,tok=++S.photoTok,cur=()=>tok===S.photoTok&&S.uid===u&&selectedDate(S.mgr.d,S.tl)===date; // chỉ hiển thị nếu vẫn đúng tài khoản + ngày + lần tải mới nhất
  photos.get(u,date).then(b=>{if(cur())showPhoto($('#tlPhoto'),b,'Ảnh do bạn tự tải lên')}).catch(err=>{const el=$('#tlPhoto');if(el&&cur())el.textContent='Không đọc được ảnh: '+(err?.message||err)})}
 else S.photoTok++; // ngày mới không có ảnh → hủy kết quả tải của ngày trước
 keepOpen();wasOpen.forEach(id=>{const x=$('#'+id);if(x)x.open=true});
 if(fsel)box.querySelector(fsel)?.focus({preventScroll:true});
}
function fixForm(m,p){
 const b=correctionBounds(m.d,p.seq);
 return html`<div class="fixbox" role="group" aria-label="Sửa ngày áp dụng">
 <p><b>Bạn đang sửa lịch sử áp dụng thực tế</b> (không phải ngày bắt đầu theo dõi): v${p.version?.n??'?'} hiện được ghi là bắt đầu áp dụng từ <b>${p.from}</b>. Bản ghi gốc vẫn được giữ; hệ thống ghi thêm một bản ghi chỉnh sửa rồi tính lại lộ trình. Phiên bản, nhật ký và ngày bắt đầu theo dõi không thay đổi.</p>
 <label>Ngày áp dụng mới <input type="date" id="fixDate" value="${p.from}" min="${b?.min||''}" max="${b?.max||''}"></label>
 <label>Lý do (không bắt buộc) <input id="fixReason" maxlength="500"></label>
 <small>Khoảng cho phép: ${b?.min||'không giới hạn'} → ${b?.max||'không giới hạn'} (không được đảo thứ tự với các lần áp dụng khác).</small>
 <div class="row"><button class="primary" data-act="fixok" data-seq="${p.seq}">Xác nhận sửa ngày áp dụng</button><button data-act="fixno">Hủy</button></div></div>`;
}
function historyHtml(m){
 const ps=periods(m.d);
 const item=p=>html`<li>${p.superseded&&html`<s>`}<b>v${p.version?.n??'?'}</b>: ${p.from} → ${p.to||'nay'} <small>(${p.kind==='restore'?'khôi phục':'khi lưu'}, ghi lúc ${fmtAt(p.recordedAt)})</small>${p.superseded&&html`</s> <small>bị thay trong cùng ngày</small>`}${p.correction&&html`<br><small class="fixnote">${I.warn} đã sửa ngày áp dụng (ngày ghi ban đầu ${p.recordedFrom}; lần sửa gần nhất ${p.correction.prevFrom} → ${p.from} lúc ${fmtAt(p.correction.recordedAt)}${p.correction.reason&&html`; lý do: ${p.correction.reason}`})</small>`} <button data-act="fix" data-seq="${p.seq}">Sửa ngày áp dụng</button>${S.fix?.seq===p.seq&&fixForm(m,p)}</li>`;
 return html`${ps.length&&!S.fix&&!S.histOpen?html`<details class="hist">`:html`<details class="hist" open>`}<summary>Lịch sử áp dụng (${ps.length})</summary>${ps.length?html`<ul>${ps.slice().reverse().map(item)}</ul>`:html`<p class="muted">Chưa có dữ liệu áp dụng.</p>`}</details>`;
}
// ---- Nhật ký ----
function renderJournal(){
 const d=S.mgr.d,ds=Object.keys(d.journal).sort().reverse();
 setHtml($('#journal'),html`<h2>Nhật ký chăm sóc da</h2><p class="notice">${I.info}<span>Dữ liệu và ảnh chỉ được lưu trong trình duyệt này (localStorage/IndexedDB) và có thể mất khi bạn xóa dữ liệu trình duyệt.</span></p>
 ${flashBox(S.jMsg)}
 <div class="jgrid"><div class="jform"><label>Ngày <input type="date" id="jd" value="${today()}"></label>
 ${Object.entries(SCALES).map(([k,[n,t]])=>html`<div class="scale"><div class="top"><label for="j${k}">${n}</label><output id="o${k}" for="j${k}">0</output></div><input type="range" id="j${k}" min="0" max="5" step="1" value="0"><small><span>${t.split(' · ')[0]}</span><span>${t.split(' · ')[1]||''}</span></small></div>`)}
 <label class="check"><input type="checkbox" id="jskip"> Hôm nay tôi không dùng đủ các bước</label>
 <label>Ghi chú<textarea id="jnote" placeholder="Ví dụ: hôm nay da hơi khô vùng má" maxlength="2000"></textarea></label>
 <label>Ảnh (không bắt buộc, tối đa 5 MB) <input type="file" id="jphoto" accept="image/*"></label><div class="row"><button class="primary" data-act="jsave">Lưu nhật ký</button></div></div>
 <div><h3>Biểu đồ tự đánh giá</h3><div class="chartbox">${chart(d.journal)}</div><p class="legend">${Object.values(SCALES).map(([n,t,c])=>html`<span class="lg"><svg class="dot" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="${c}"/></svg> ${n}</span>`)}</p>
 <p class="muted"><small>Trục ngang: ngày thực tế. Trục dọc: điểm tự đánh giá 0–5. Đường chỉ nối các ngày liên tiếp đều có dữ liệu; ngày trống không được nội suy. Xu hướng không đồng nghĩa với việc sản phẩm là nguyên nhân.</small></p></div></div>
 ${ds.length>0&&html`<h3>Các ngày đã ghi (${ds.length})</h3><div class="tablewrap"><table><tr><th>Ngày</th><th>Khô/Dầu/Kích ứng</th><th>Bước</th><th>Ghi chú</th><th></th></tr>${ds.map(s=>{const e=d.journal[s];return html`<tr><td>${s}${!isDate(s)&&html` <span class="tag warn">ngày không hợp lệ</span>`}</td><td>${e.dry}/${e.oil}/${e.irr}</td><td>${e.skipped?'Không đủ bước':'—'}</td><td>${e.note}</td><td><div class="row">${e.photo&&html`<button class="chip" data-act="pview" data-d="${s}">Xem ảnh</button><button class="chip" data-act="pdel" data-d="${s}">Xóa ảnh</button>`}<button class="chip danger-ghost" data-act="edel" data-d="${s}">Xóa ngày</button></div></td></tr>`})}</table></div>`}<div id="jview"></div>`);
}
// Ảnh: dựng bằng DOM API; chỉ hiển thị Blob ảnh, URL chỉ được là blob: do trình duyệt tạo; thu hồi URL sau khi tải.
function showPhoto(el,b,alt,caption){
 if(!el)return;
 if(!(b instanceof Blob)||!/^image\//.test(b.type)){el.textContent='Không tìm thấy ảnh.';return}
 const u=safeImageUrl(URL.createObjectURL(b));if(!u){el.textContent='Không hiển thị được ảnh.';return}
 const img=document.createElement('img');img.className='ph';img.alt=alt;img.onload=img.onerror=()=>URL.revokeObjectURL(u);img.src=u;
 const parts=[];if(caption){const p=document.createElement('p');p.textContent=caption;parts.push(p)}
 el.replaceChildren(...parts,img);
}


// ---- 3D / 2D ----
function modeUI(){
 document.querySelectorAll('[data-m]').forEach(b=>{b.classList.toggle('sel',b.dataset.m===S.mode);b.setAttribute('aria-pressed',String(b.dataset.m===S.mode))});
 document.querySelectorAll('[data-act=viewface]').forEach(b=>{b.classList.toggle('sel',b.dataset.f===S.viewFace);b.setAttribute('aria-pressed',String(b.dataset.f===S.viewFace))});
 document.querySelectorAll('.only3d').forEach(b=>b.hidden=S.mode!=='3d');
 $('#devBtn').hidden=!DEV_URL; // v0.6: nút developer mode chỉ hiện khi vào bằng ?dev — không còn lộ ra với khách hàng
 $('#devbar').hidden=!S.dev;$('#devBtn').setAttribute('aria-pressed',String(S.dev));$('#devBtn').textContent=S.dev?'Tắt developer mode':'Developer mode';
 renderUserSel(); // v1.0.2: bật/tắt Developer mode đổi ngay #acctChip ↔ #acctPicker trong header (không đợi lần load() kế tiếp)
 $('#simBtn').textContent='Giả lập lỗi 3D: '+(S.sim?'BẬT':'TẮT');$('#simBtn').classList.toggle('sel',S.sim);
 renderHint();renderPerf();
}
// 3D lỗi (không có WebGL, tải thư viện/mô hình lỗi, lỗi khởi tạo/khi chạy): Viewer3D đã tự dispose; chuyển 2D, GIỮ bước/vùng đang chọn.
function fall(e){
 S.modeTok++; // mọi lần khởi tạo 3D đang chờ trở thành "cũ"
 v3.stop();$('#v3d').hidden=true;$('#v2d').hidden=false;S.mode='2d';S.hover=null;
 const m=String(e?.message||e);
 setHtml($('#notice'),html`<p>Không dùng được 3D: ${failCause(m)}. Đã chuyển sang chế độ 2D; các chức năng khác vẫn hoạt động. Bấm “3D” để thử lại.</p><details><summary>Chi tiết kỹ thuật</summary><p>${m}</p></details>`);
 modeUI();sync();
}
// Mỗi yêu cầu đổi chế độ có một mã (S.modeTok). Khởi tạo 3D xong muộn sau khi người dùng đã bấm "2D" (hoặc đã có yêu cầu mới hơn)
// thì KHÔNG được ghi đè trạng thái hiện tại: dừng 3D, giữ 2D.
async function setMode(m){
 const tok=++S.modeTok;
 if(m==='2d'){v3.stop();$('#v3d').hidden=true;$('#v2d').hidden=false;S.mode='2d';S.hover=null;S.slowHint=null;renderSlowHint();modeUI();sync();return}
 $('#v3d').hidden=false;$('#v2d').hidden=true;
 try{await v3.init($('#v3d'),{onPick:selectZone,onError:fall,failFlag:()=>S.sim,onHover,onSlow});
  if(tok!==S.modeTok){v3.stop();return} // phản hồi cũ: đã có yêu cầu mới hơn
  S.mode='3d';setHtml($('#notice'),html``);modeUI();sync();
  if(S.stage!=='model'||S.view!=='feature')v3.stop()}
 catch(e){if(tok===S.modeTok)fall(e)}
}
function setView(v){
 S.view=v;for(const k of['home','feature'])$('#'+k).hidden=k!==v;
 document.querySelectorAll('.tabs [data-v]').forEach(b=>{b.classList.toggle('sel',b.dataset.v===v);b.setAttribute('aria-current',b.dataset.v===v?'page':'false')});
 showStage();
}

// ---- Sự kiện ----
const act={
 view:a=>{setView(a.dataset.v);window.scrollTo({top:0})},
 stage:a=>setStage(a.dataset.s),
 tab:a=>{S.tab=a.dataset.t;showStage()},
 devmode:()=>{S.dev=!S.dev;if(!S.dev&&S.perfOn)act.perf();modeUI()},
 mode:a=>setMode(a.dataset.m),reset:()=>v3.r&&v3.resetView(),zoom:a=>v3.r&&v3.zoom(+a.dataset.f),preset:a=>v3.r&&v3.view(a.dataset.p),
 viewface:a=>{S.viewFace=a.dataset.f;modeUI();sync()}, // v0.6: chuyển Nguyên bản/Vùng đang chọn — không đổi góc nhìn, không đổi lựa chọn
 sim:()=>{S.sim=!S.sim;modeUI();if(S.sim&&S.mode==='3d'&&v3.ready)v3.invalidate()}, // vẽ ngay một khung để lỗi giả lập xảy ra
 perf:()=>{S.perfOn=!S.perfOn;clearInterval(S.perfTimer);S.perfTimer=S.perfOn?setInterval(renderPerf,500):null;renderPerf()},
 slowx:()=>{S.slowHint=null;renderSlowHint()},
 // Chọn bước từ trang Routine → chuyển sang bước Mô hình với bước đó được chọn.
 step:a=>{selectStep(a.dataset.id);if(S.stage!=='model')setStage('model')},
 zone:a=>S.zone===a.dataset.z?clearSel():selectZone(a.dataset.z),
 clearsel:()=>clearSel(),
 // Từ bản tóm tắt cảnh báo → mở khu "Chỉnh sửa sản phẩm" và đưa tiêu điểm tới đó (không đổi routine).
 openedit:()=>{openState.add('editBox');const d=$('#editBox');if(!d)return;d.open=true;const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;d.scrollIntoView({block:'center',behavior:rm?'auto':'smooth'});d.querySelector('summary')?.focus({preventScroll:true})},
 quiz:()=>{const q={at:new Date().toISOString()};
  for(const Q of QUIZ){const c=[...document.querySelectorAll(`#quiz input[name="${Q.id}"]:checked`)].map(i=>i.value);q[Q.id]=Q.type==='multi'?c:c[0]||null}
  const r=S.mgr.setQuiz(q);S.flash=report(r);recompute();
  S.goalMsg=r.ok&&!q.goals.length?'Hãy chọn ít nhất một mục tiêu để tạo routine.':null;
  renderAll();if(r.ok&&q.goals.length)setStage('routine');},
 rm:a=>edit(()=>S.mgr.remove(a.dataset.id)),
 rep:s=>edit(()=>S.mgr.replace(s.dataset.id,s.value)),
 add:()=>{const id=$('#addSel').value;if(id)edit(()=>S.mgr.add(id))},
 regen:()=>edit(()=>S.mgr.reset()),
 save:()=>{const r=S.mgr.save({note:$('#vnote').value.trim(),apply:!$('#vdraft').checked,applyFrom:$('#vfrom').value,label:LABEL});
  const when=r.version?.appliedFrom?`, áp dụng từ ${r.version.appliedFrom}`:' (chưa áp dụng)';
  S.flash=report(r,r.ok&&(r.persisted===false?`Đã tạo v${r.version.n}${when} – chỉ lưu tạm trong phiên này.`:`Đã lưu v${r.version.n}${when}.`));if(r.ok)notifyHost('version:saved',{version:r.version});recompute();renderAll()},
 restore:a=>{const r=S.mgr.restore(a.dataset.id);
  S.flash=r.ok?[`Đã khôi phục v${r.version.n}: quiz và danh sách sản phẩm được nạp lại, routine được tính lại${r.applied?', ghi nhận áp dụng lại từ hôm nay':''}.`,...r.notices,...(r.persisted===false?[`CHƯA lưu bền vững: ${r.storageError}`]:[])]:[r.error];
  S.step=S.zone=null;S.selNote=null;recompute();renderAll();if(r.ok)setStage('routine')},

 flashx:()=>{S.flash=[];renderRoutine()},
 retry:()=>{const r=S.mgr.retryPersist();S.probe=store.probe();S.flash=r.ok?['Đã lưu dữ liệu vào bộ nhớ trình duyệt.']:[`Vẫn chưa lưu được: ${r.error}`];renderAll()},
 day:a=>{S.tl={m:+a.dataset.n};S.tlMsg=[];renderTimeline();renderStepper()},
 // Từ ghi chú "hai ngày khác nhau" → mở khu Tùy chỉnh mốc theo dõi (và phần giải thích) rồi đưa tiêu điểm tới đó.
 opentl:()=>{openState.add('tlCustom');openState.add('tlWhy');renderTimeline();const d=$('#tlCustom');d?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});d?.querySelector('summary')?.focus({preventScroll:true})},
 // Sửa lịch sử áp dụng (nằm ở tab Phiên bản): bước 1 mở biểu mẫu, bước 2 chỉ ghi khi bấm "Xác nhận" (confirmed:true).
 fix:a=>{S.fix={seq:+a.dataset.seq};S.hMsg=[];renderVersions()},
 fixno:()=>{S.fix=null;S.hMsg=['Đã hủy, lịch sử áp dụng không thay đổi.'];renderVersions()},
 fixok:a=>{const r=S.mgr.correctApplication(+a.dataset.seq,$('#fixDate')?.value,{confirmed:true,reason:$('#fixReason')?.value||''});
  S.hMsg=report(r,r.ok&&`Đã sửa ngày áp dụng: ${r.prevFrom} → ${r.from}. Bản ghi gốc vẫn được giữ; lộ trình đã được tính lại. Nhật ký và ngày bắt đầu theo dõi không thay đổi.`);
  if(r.ok)S.fix=null;renderAll()},
 jsave:async()=>{
  const m=S.mgr,date=$('#jd').value,f=$('#jphoto').files[0];
  if(!isDate(date)){S.jMsg=['Ngày nhật ký không hợp lệ.'];renderJournal();return}
  const e={dry:+$('#jdry').value,oil:+$('#joil').value,irr:+$('#jirr').value,skipped:$('#jskip').checked,note:$('#jnote').value.trim()},msgs=[];
  let photo;
  if(f){
   if(!/^image\//.test(f.type))msgs.push('Tệp đã chọn không phải ảnh nên không được lưu.');
   else if(f.size>PHOTO_MAX)msgs.push('Ảnh lớn hơn 5 MB nên không được lưu.');
   else try{await photos.put(m.uid,date,f);photo=true}catch(err){msgs.push('Không lưu được ảnh (IndexedDB): '+(err?.message||err)+'. Nhật ký vẫn được lưu, không kèm ảnh.')}
  }
  const r=m.saveJournal(date,e,{photo});
  if(S.mgr!==m)return; // đã đổi tài khoản trong lúc chờ: dữ liệu đã ghi đúng tài khoản cũ, không vẽ lại nhầm
  S.jMsg=[...report(r,r.ok&&`Đã ghi nhật ký ngày ${date}${r.persisted===false?' (chỉ lưu tạm trong phiên này)':''}.`),...msgs];renderAll()},
 pview:async a=>{const u=S.uid,dt=a.dataset.d,tok=++S.jviewTok;try{const b=await photos.get(u,dt);if(S.uid===u&&tok===S.jviewTok)showPhoto($('#jview'),b,'Ảnh nhật ký',`Ảnh ngày ${dt} (do bạn tự tải lên, không dùng để chẩn đoán da)`)}
  catch(err){const el=$('#jview');if(el)el.textContent='Không đọc được ảnh: '+(err?.message||err)}},
 pdel:async a=>{const m=S.mgr,dt=a.dataset.d;
  try{await photos.del(m.uid,dt)}catch(err){if(S.mgr===m){S.jMsg=['Không xóa được ảnh: '+(err?.message||err)+'. Mục nhật ký giữ nguyên.'];renderJournal()}return}
  const r=m.setJournalPhoto(dt,false);if(S.mgr!==m)return;S.jMsg=report(r,r.ok&&`Đã xóa ảnh ngày ${dt}.`);renderAll()},
 edel:async a=>{const m=S.mgr,dt=a.dataset.d,hadPhoto=!!m.d.journal[dt]?.photo;
  try{await photos.del(m.uid,dt)}catch(err){
   // Không xóa mục nhật ký khi ảnh của nó chưa xóa được (tránh ảnh "mồ côi" mà người dùng tưởng đã xóa).
   if(hadPhoto){if(S.mgr===m){S.jMsg=['Không xóa được ảnh của ngày này: '+(err?.message||err)+'. Mục nhật ký chưa bị xóa.'];renderJournal()}return}}
  const r=m.deleteJournal(dt);if(S.mgr!==m)return;S.jMsg=report(r,r.ok&&`Đã xóa nhật ký ngày ${dt}.`);renderAll()}
};

const run=(name,a)=>{if(Object.hasOwn(act,name))act[name](a)};
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a||a.tagName==='SELECT')return;if(a.tagName==='A')e.preventDefault();run(a.dataset.act,a)});
// Thẻ bước (li) chọn được bằng Enter/Space khi chính thẻ đang được focus (nút bên trong thẻ giữ hành vi riêng).
document.addEventListener('keydown',e=>{const a=e.target;if(a?.matches?.('li[data-act=step]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();run('step',a)}});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.act==='rep'&&t.value)run('rep',t);
 if(t.id==='startDate'){
  // Ô ngày đang nhập dở/không hợp lệ: không coi là "bỏ ngày bắt đầu theo dõi". Chỉ đổi startDate (Manager.setStartDate); lịch sử áp dụng không bị đụng tới.
  const r=t.validity?.badInput?null:S.mgr.setStartDate(t.value||null);
  S.tlMsg=!r?['Ngày chưa hợp lệ; giữ nguyên ngày bắt đầu theo dõi hiện tại.']:r.ok===false?[ux(r.error)]
   :[t.value?'Đã đổi ngày bắt đầu theo dõi. Lịch sử đã lưu không thay đổi.':'Đã bỏ ngày bắt đầu theo dõi. Lịch sử đã lưu không thay đổi; hệ thống sẽ không tự đặt lại.',...(r.persisted===false?[`CHƯA lưu bền vững: ${r.storageError}`]:[])];
  renderStorage();renderTimeline();renderStepper()}
 if(t.id==='tlDate'){S.tl=isDate(t.value)?{date:t.value}:{m:0};S.tlMsg=[];renderTimeline();renderStepper()}});
// Nhớ trạng thái mở/đóng của "Lịch sử áp dụng" qua các lần vẽ lại (sự kiện toggle không nổi bọt → dùng capture).
document.addEventListener('toggle',e=>{const d=e.target;if(d.matches?.('details.hist'))S.histOpen=d.open;if(d.matches?.('#feature details[id]'))openState[d.open?'add':'delete'](d.id)},true);
document.addEventListener('input',e=>{if(e.target.type==='range'){const o=$('#o'+e.target.id.slice(1));if(o)o.textContent=e.target.value}});

// v1.0.2: khu tài khoản ở header dùng chung (hiện trên MỌI màn hình, không riêng trang Cửa hàng) — gồm 2 phần
// loại trừ nhau:
//  - #acctChip: nhãn TĨNH, LUÔN HIỆN trong chế độ bình thường (độc lập lẫn host) — không phải nút bấm, không
//    bịa định danh. Độc lập: "<tên> · Hồ sơ mẫu" (rõ ràng đây là dữ liệu mẫu, không phải đăng nhập thật).
//    Host: "Đang dùng dữ liệu từ website của bạn" (giữ nguyên từ v1.0.1).
//  - #acctPicker: bộ CHUYỂN hồ sơ demo (A/B) — chỉ hiện khi bật Developer mode (?dev), dùng để kiểm thử cô lập
//    dữ liệu theo uid; ẩn trong giao diện khách hàng bình thường như v1.0.1 đã làm.
// renderUserSel() gọi lại mỗi khi USERS đổi (vd. sau khi thêm user 'HOST') để option-list/nhãn luôn khớp hiện trạng.
function renderUserSel(){
 setHtml($('#userSel'),html`${USERS.map(u=>html`<option value="${u.id}">${u.name}</option>`)}`);
 $('#userSel').value=S.uid;
 const dev=S.dev;$('#acctPicker').hidden=!dev;
 $('#acctChip').hidden=dev; // chế độ dev dùng bộ chọn thay cho nhãn tĩnh, tránh hiện trùng lặp hai nơi
 setHtml($('#acctChip'),S.hostMode?html`Đang dùng dữ liệu từ website của bạn`:html`${S.user.name} <span class="acct-tag">Hồ sơ mẫu</span>`);
}
// KHÔNG gọi renderUserSel() ở đây: S.user chỉ được gán trong load() (gọi ở cuối file) — gọi sớm hơn sẽ ném lỗi
// (S.user.name khi S.user còn undefined) và làm HỎNG TOÀN BỘ phần còn lại của module (kể cả đăng ký listener
// nhận dữ liệu host). load() bên dưới đã tự gọi renderUserSel() sau khi gán S.user xong.
$('#userSel').onchange=e=>load(e.target.value);
// v1.0: nhận dữ liệu từ host (catalogue/quiz/sản phẩm đã mua) qua postMessage. Giao thức đầy đủ + lược đồ
// dữ liệu: docs/integration.md. CHỈ bật khi iframe được tạo với ?hostOrigin=<origin host>; nếu không có,
// handler này không được đăng ký — ứng dụng chạy demo độc lập y như trước, không có hành vi khác.
// Kiểm tra tin cậy theo 2 lớp: (1) event.origin PHẢI khớp hostOrigin đã khai báo (chặn origin giả mạo),
// (2) event.source PHẢI là window.parent (chặn message từ iframe/script khác không liên quan trên cùng trang),
// cộng với việc chỉ xử lý message có đúng nhãn source — bỏ qua mọi message khác (kể cả message của chính mình).
if(HOST_ORIGIN)window.addEventListener('message',e=>{
 if(e.origin!==HOST_ORIGIN||e.source!==window.parent)return;
 const m=e.data;if(!m||typeof m!=='object'||m.source!=='skincare-widget-host'||m.type!=='skincare:sync')return;
 try{applyHostData(m.payload||{})}
 catch(err){notifyHost('host:error',{message:'Lỗi xử lý dữ liệu từ host: '+(err?.message||err)})}
});
// v1.0.2: bắt tay sẵn sàng rõ ràng — thay vì host PHẢI ĐOÁN thời điểm app đã đăng ký xong listener (vd. dựa vào
// sự kiện 'load' của iframe, vốn không đảm bảo listener đã gắn xong ở mọi trình duyệt/điều kiện tải), app CHỦ
// ĐỘNG báo 'skincare:ready' đúng ngay sau khi listener đã đăng ký (dòng lệnh NGAY PHÍA TRÊN, đồng bộ). Host nên
// đợi message này rồi mới gửi 'skincare:sync' đầu tiên — xem docs/integration.md. Chỉ gửi một lần/lượt tải trang
// (mỗi lần tải lại iframe là một thực thi module mới, listener cũ không tồn tại nữa → không có nguy cơ đăng ký
// trùng hay echo lặp lại 'ready' nhiều lần trong cùng một phiên).
if(HOST_ORIGIN)notifyHost('skincare:ready',{protocolVersion:1});
// payload: {catalog?, purchasedProductIds?, goals?, skin?} — mọi field đều tùy chọn, có thể gửi dần (cập nhật từng phần).
// Lần sync HỢP LỆ ĐẦU TIÊN chuyển ứng dụng sang "khách hàng host" (uid cố định 'HOST'), KHÔNG đụng tới 2 tài khoản
// demo A/B hay dữ liệu đã lưu của họ. report[] (vấn đề mapping, nếu có) được gửi lại cho host qua 'host:applied'.
function applyHostData(payload){
 const report=[];
 if(!S.hostMode){S.hostMode=true;upsertUser({id:'HOST',name:'Khách (từ website)',purchased:[]})}
 if(Array.isArray(payload.catalog)){const {products,report:r}=mapCatalog(payload.catalog);setCatalog(products);report.push(...r)}
 if(Array.isArray(payload.purchasedProductIds)){
  const {ids,issues}=mapPurchasedIds(payload.purchasedProductIds,PRODUCTS);
  upsertUser({id:'HOST',name:'Khách (từ website)',purchased:ids});
  if(issues.length)report.push({id:null,source:null,issues});
  load('HOST'); // dựng lại S.mgr từ danh sách đã mua mới (giữ quiz/lựa chọn đã lưu trước đó cho uid 'HOST' nếu có, như mọi lần đổi user khác)
 } else if(S.uid!=='HOST')load('HOST');
 if(payload.goals!==undefined||payload.skin!==undefined){
  const {quiz,issues}=mapQuiz({goals:payload.goals,skin:payload.skin});
  if(issues.length)report.push({id:null,source:null,issues});
  if(quiz){S.mgr.setQuiz({...quiz,at:new Date().toISOString()});S.stage==='goals'&&(S.stage='routine')}
 }
 recompute();renderAll();
 notifyHost('host:applied',{report});
}
v2.init($('#v2d'),selectZone,{onHover});
S.probe=store.probe();
load(store.getPref('uid')||USERS[0].id);setView('home');modeUI();
// Móc kiểm thử: chỉ khi URL có ?dev (không dùng trong sử dụng bình thường).
if(DEV_URL)window.__skc={v3,v2,S,get sel(){return S.sel},setStage,get PRODUCTS(){return PRODUCTS},get USERS(){return USERS}};
