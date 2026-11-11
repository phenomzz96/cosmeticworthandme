// Routine Engine DEMO-0.2: thuần hàm, xác định (không random). Mục tiêu quiz tác động tới LỰA CHỌN và THỨ TỰ sản phẩm.
import {RULES as R} from './rules.js';
const PL={am:'buổi sáng',pm:'buổi tối'},inter=(a=[],b=[])=>a.filter(x=>b.includes(x));
export function classify(p){
 const miss=[];
 if(!R.categories[p.category])miss.push('category');
 if(!p.functions?.length)miss.push('functions');
 if(!['am','pm','both'].includes(p.recommendedPeriod))miss.push('recommendedPeriod');
 return {ok:!miss.length,group:R.categories[p.category],miss};
}
export function buildRoutine({quiz,catalog,selection,owned}){
 const prods=[...new Set(selection)].sort().map(id=>catalog.find(p=>p.id===id)).filter(Boolean);
 const cls=prods.map(p=>({p,c:classify(p)})),ok=cls.filter(x=>x.c.ok).map(x=>x.p);
 const gk=(quiz?.goals||[]).filter(g=>R.goals[g]),skin=R.skin[quiz?.skin]||null;
 const W=[],E=[],steps=[],why=new Map(),drop=new Map();
 cls.filter(x=>!x.c.ok).forEach(({p,c})=>{
  why.set(p.id,`Thiếu dữ liệu (${c.miss.join(', ')}); không suy đoán từ tên sản phẩm.`);
  W.push({type:'data',title:`Chưa đủ thông tin để phân loại: ${p.name}`,reason:`Thiếu dữ liệu: ${c.miss.join(', ')}. Hệ thống không suy đoán từ tên sản phẩm nên không xếp sản phẩm này vào routine.`,ids:[p.id]});});
 prods.filter(p=>!owned.includes(p.id)).forEach(p=>W.push({type:'info',title:`Chưa có trong lịch sử mua: ${p.name}`,reason:'Sản phẩm do bạn tự thêm; hệ thống không tự thêm sản phẩm chưa mua.',ids:[p.id]}));
 if(!gk.length||!ok.length)return {status:'insufficient',statusReasons:[!gk.length?'Chưa chọn mục tiêu nào trong quiz.':'Không có sản phẩm nào đủ dữ liệu để phân loại.'],steps:[],warnings:W.filter(w=>w.type==='data'||w.type==='info'),explain:[],goals:[],excluded:[],skin:null};
 // 1) Xung đột với mục tiêu: giữ sản phẩm ngoài routine (không kết luận sản phẩm gây hại)
 const held=new Set();
 for(const g of gk){const av=R.goals[g].avoidActives;if(!av)continue;
  for(const p of ok){const hit=inter(p.actives,av);if(!hit.length||held.has(p.id))continue;
   held.add(p.id);why.set(p.id,`Mục tiêu "${R.goals[g].label}" có quy tắc giữ ngoài routine các sản phẩm khai báo hoạt chất: ${hit.join(', ')}.`);
   W.push({type:'conflict',title:`Xung đột với mục tiêu "${R.goals[g].label}": ${p.name}`,reason:`Sản phẩm khai báo hoạt chất ${hit.join(', ')}, thuộc danh sách mà bộ quy tắc minh họa giữ ngoài routine khi chọn mục tiêu này. Hệ thống không kết luận sản phẩm gây hại; nếu vẫn muốn dùng, hãy đọc nhãn hoặc hỏi chuyên gia.`,ids:[p.id]});}}
 const pool=ok.filter(p=>!held.has(p.id));
 // 2) Điểm: mục tiêu (trọng số) + tham chiếu loại da (nhỏ). Hòa điểm → theo mã sản phẩm (xác định).
 const gs=p=>gk.reduce((s,g)=>s+(inter(p.functions,R.goals[g].functions).length?R.goals[g].priority:0),0);
 const sc=p=>gs(p)+(skin&&inter(p.functions,skin.prefer).length?R.skinWeight:0);
 const rank=a=>[...a].sort((x,y)=>sc(y)-sc(x)||x.id.localeCompare(y.id));
 const gl=p=>gk.filter(g=>inter(p.functions,R.goals[g].functions).length).map(g=>R.goals[g].label);
 E.push(`Mục tiêu đã chọn: ${gk.map(g=>`${R.goals[g].label} (trọng số ${R.goals[g].priority})`).join(', ')}. Bước nền tảng luôn được xét; toner/serum/sản phẩm chuyên biệt chỉ được xếp khi khai báo chức năng khớp ít nhất một mục tiêu.`);
 if(skin)E.push(`Loại da tự đánh giá "${skin.label}" chỉ là tham chiếu: cộng ${R.skinWeight} điểm cho sản phẩm khai báo chức năng ${skin.prefer.join('/')} khi cần chọn hoặc sắp xếp giữa sản phẩm tương đương. Đây không phải chẩn đoán.`);
 const used=new Set();
 for(const per of ['am','pm']){
  const inP=pool.filter(p=>p.recommendedPeriod==='both'||p.recommendedPeriod===per),chosen=[];
  R.slots.forEach(s=>{
   if(s.only&&!s.only.includes(per))return;
   const cands=inP.filter(p=>p.category===s.cat);
   if(!cands.length){if(s.req.includes(per))W.push({type:'missing',per,title:`Thiếu bước ${s.name} (${PL[per]})`,reason:'Bộ quy tắc minh họa coi đây là bước cần thiết nhưng chưa có sản phẩm phù hợp trong danh sách đang dùng. Bạn có thể cân nhắc bổ sung; hệ thống không tự thêm.',ids:[]});return}
   let ranked=rank(cands);
   if(!s.core){
    ranked.filter(p=>gs(p)===0).forEach(p=>drop.has(p.id)||drop.set(p.id,`Không khớp mục tiêu đã chọn: chức năng khai báo (${p.functions.join(', ')}) không thuộc mục tiêu nào.`));
    ranked=ranked.filter(p=>gs(p)>0);if(!ranked.length)return;}
   if(s.max&&ranked.length>s.max){
    const extra=ranked.slice(s.max),all=ranked;ranked=ranked.slice(0,s.max);
    const tie=sc(all[0])===sc(extra[0]);
    extra.forEach(p=>drop.has(p.id)||drop.set(p.id,`Trùng bước "${s.name}" với ${all[0].name}; ${tie?'điểm bằng nhau nên chọn theo mã sản phẩm':'điểm thấp hơn'}.`));
    W.push({type:'dup',per,title:`Trùng bước ${s.name} (${PL[per]}): ${all.map(p=>p.name).join(' & ')}`,reason:`Bộ quy tắc chỉ xếp ${s.max} sản phẩm cho bước "${s.name}". Điểm phù hợp (mục tiêu + tham chiếu loại da): ${all.map(p=>`${p.name}=${sc(p)}`).join('; ')}. Xếp "${all[0].name}"${tie?' vì điểm bằng nhau nên chọn theo mã sản phẩm (quy tắc xác định)':''}. Bạn có thể bỏ hoặc thay sản phẩm để tự chọn.`,ids:all.map(p=>p.id)});}
   steps.push({id:per+':'+s.key,period:per,key:s.key,name:s.name,purpose:s.purpose,zones:[...new Set(ranked.flatMap(p=>p.zones||[]))],
    products:ranked.map(p=>({id:p.id,name:p.name,usage:p.usageInstructions,warnings:p.warnings||[],goals:gl(p),score:sc(p)}))});
   ranked.forEach(p=>{used.add(p.id);chosen.push(p)});
   E.push(`${PL[per]} · ${s.name}: ${ranked.map(p=>`${p.name} (điểm ${sc(p)}${gl(p).length?'; khớp: '+gl(p).join(', '):''})`).join(' → ')}.`);
  });
  for(const [a,b,msg] of R.cautions){
   const pa=chosen.filter(p=>p.actives?.includes(a)),pb=chosen.filter(p=>p.actives?.includes(b));
   if(pa.length&&pb.length)W.push({type:'caution',per,title:`Cần thận trọng (${PL[per]}): ${a} + ${b}`,reason:msg+' Đây là quy tắc minh họa, không phải kết luận an toàn hay nguy hiểm tuyệt đối. Hãy đọc nhãn sản phẩm hoặc hỏi chuyên gia.',ids:[...pa,...pb].map(p=>p.id)});}
  for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++){
   const x=chosen[i],y=chosen[j];if(x.id===y.id)continue;
   const fs=inter(inter(x.functions,y.functions),R.overlapFunctions),as=inter(x.actives,y.actives);
   if(fs.length||as.length)W.push({type:'dup',scope:'cross',per,title:`Chồng chéo (${PL[per]}): ${x.name} & ${y.name}`,reason:`Hai sản phẩm cùng khai báo ${[fs.length&&'chức năng '+fs.join(', '),as.length&&'hoạt chất '+as.join(', ')].filter(Boolean).join(' và ')} (nhóm: ${x.category}, ${y.category}). Có thể chồng chéo; hãy cân nhắc bỏ bớt hoặc đọc hướng dẫn trên nhãn.`,ids:[x.id,y.id]});}
 }
 if(skin?.avoidOnly)pool.filter(p=>used.has(p.id)&&p.functions.every(f=>skin.avoidOnly.includes(f))).forEach(p=>W.push({type:'skin',title:`Lưu ý tham khảo: ${p.name}`,reason:`Bạn tự đánh giá da ${skin.label}, trong khi sản phẩm chỉ khai báo chức năng ${p.functions.join(', ')}. Đây chỉ là thông tin tham khảo, không phải chẩn đoán hay khuyến cáo.`,ids:[p.id]}));
 // 3) Báo cáo đáp ứng mục tiêu
 const inc=ok.filter(p=>used.has(p.id));
 const coreOk=R.slots.every(s=>!s.core||s.req.every(per=>steps.some(x=>x.period===per&&x.key===s.key)));
 const goals=gk.map(g=>{const G=R.goals[g];
  if(G.structural)return {key:g,label:G.label,state:coreOk?'met':'unmet',matched:[],reason:coreOk?'Đủ các bước nền tảng (làm sạch, dưỡng ẩm, chống nắng buổi sáng). Mục tiêu này không đòi hỏi sản phẩm tùy chọn nên chúng không được xếp.':'Thiếu bước nền tảng (xem cảnh báo thiếu bước).'};
  const m=inc.filter(p=>inter(p.functions,G.functions).length);
  if(m.length)return {key:g,label:G.label,state:'met',matched:m.map(p=>p.name),reason:`Được đáp ứng bởi sản phẩm khai báo chức năng ${G.functions.join('/')}: ${m.map(p=>p.name).join(', ')}.`};
  const dec=ok.filter(p=>inter(p.functions,G.functions).length),hh=dec.filter(p=>held.has(p.id));
  return {key:g,label:G.label,state:'unmet',matched:[],reason:!dec.length?`Không có sản phẩm nào trong danh sách khai báo chức năng ${G.functions.join('/')}. Hệ thống không suy đoán từ tên hay thành phần. Bạn có thể cân nhắc bổ sung sản phẩm phù hợp.`:hh.length?`Có sản phẩm khai báo chức năng phù hợp (${hh.map(p=>p.name).join(', ')}) nhưng bị giữ ngoài routine do xung đột với mục tiêu khác đã chọn.`:'Có sản phẩm khai báo chức năng phù hợp nhưng không xếp được vào routine.'}});
 goals.forEach(g=>E.push(`Mục tiêu "${g.label}": ${g.state==='met'?'đã đáp ứng':'CHƯA đáp ứng'} – ${g.reason}`));
 // 4) Trạng thái routine: cảnh báo ảnh hưởng trực tiếp tới trạng thái
 const unmet=goals.filter(g=>g.state!=='met'),cnt=t=>W.filter(w=>w.type===t).length,blocks=cnt('data')+cnt('missing');
 const rv=[['caution','cảnh báo tổ hợp thận trọng'],['conflict','xung đột với mục tiêu'],['dup','trùng/chồng chéo chức năng']].filter(([t])=>cnt(t));
 const reasons=[];
 if(blocks)reasons.push(`Thiếu bước hoặc dữ liệu: ${blocks} cảnh báo.`);
 if(unmet.length)reasons.push(`Mục tiêu chưa đáp ứng: ${unmet.map(g=>g.label).join(', ')}.`);
 if(rv.length)reasons.push(`Cần xem xét: ${rv.map(([t,l])=>`${cnt(t)} ${l}`).join('; ')}.`);
 const status=blocks?'incomplete':unmet.length===goals.length?'unmet':rv.length?'review':unmet.length?'partial':'ready';
 steps.forEach(s=>s.warnings=W.filter(w=>!['info','skin'].includes(w.type)&&(!w.per||w.per===s.period)&&w.ids.some(id=>s.products.some(p=>p.id===id))));
 const excluded=prods.filter(p=>!used.has(p.id)).map(p=>({id:p.id,name:p.name,reason:why.get(p.id)||drop.get(p.id)||'Không có bước phù hợp trong routine.'}));
 return {status,statusReasons:reasons,steps,warnings:W,explain:E,goals,excluded,skin:skin&&{label:skin.label}};
}
