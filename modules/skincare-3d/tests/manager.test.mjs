// Chạy: node tests/manager.test.mjs — kiểm thử Routine Manager, timeline và chuyển đổi dữ liệu 0.2 (schema 3).
import assert from 'node:assert/strict';
import {PRODUCTS,USERS} from '../js/data.js';
import {RULES} from '../js/rules.js';
import {buildRoutine} from '../js/engine.js';
import {RoutineManager,snapshotOf} from '../js/manager.js';
import {createStore} from '../js/storage.js';
import {effectiveAt,describeDay,localDate,addDays,periods} from '../js/timeline.js';

class Mem{constructor(){this.m=new Map}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const user=id=>USERS.find(u=>u.id===id);
const compute=id=>(quiz,selection)=>buildRoutine({quiz,catalog:PRODUCTS,selection,owned:user(id).purchased});
let T=Date.parse('2026-11-01T05:00:00Z');const now=()=>new Date(T),day=n=>{T+=n*864e5};
const open=(id,mem)=>new RoutineManager(id,user(id).purchased,{store:createStore(()=>mem,now),compute:compute(id),rulesVersion:RULES.version,now});
const json=x=>JSON.parse(JSON.stringify(x));
let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};

// Kịch bản chính: User A
const mem=new Mem();let A=open('A',mem);
const Q1={goals:['hydrate'],skin:'dry',at:'2026-11-01T05:00:00Z'},Q2={goals:['oil','basic'],skin:'oily',at:'2026-11-04T05:00:00Z'};
const D0=localDate(now());let v1,v2,v1Before,v2Before,appsBefore;

t('1. lưu routine: phiên bản có đủ trường',()=>{
 A.setQuiz(Q1);assert.equal(A.dirty,true);
 const r=A.save({note:'bắt đầu'});assert.ok(r.ok);v1=r.version;
 for(const k of['id','createdAt','quiz','selection','rulesVersion','note','change','appliedFrom','snapshot'])assert.ok(k in v1,k);
 assert.deepEqual(v1.quiz,Q1);assert.deepEqual(v1.selection,user('A').purchased);assert.equal(v1.rulesVersion,RULES.version);
 assert.equal(v1.appliedFrom,D0);assert.equal(v1.change,'Phiên bản đầu tiên.');assert.equal(A.dirty,false);
 assert.equal(A.d.startDate,D0);assert.equal(A.d.applications.length,1)});
t('2. đổi mục tiêu quiz → "chưa lưu" và routine thay đổi',()=>{
 day(3);const before=snapshotOf(A.compute(A.quiz,A.selection));
 A.setQuiz(Q2);assert.equal(A.dirty,true);assert.notDeepEqual(snapshotOf(A.compute(A.quiz,A.selection)),before)});
t('7a. timeline TRƯỚC khi lưu thay đổi: ngày 3 vẫn hiệu lực v1',()=>{
 const D3=localDate(now());assert.equal(effectiveAt(A.d,D3).version.id,v1.id);
 const x=describeDay(A.d,D3,D3);assert.equal(x.rel,'today');assert.equal(x.current.version.id,v1.id)});
t('3. lưu phiên bản thứ hai: id riêng, mô tả thay đổi quiz',()=>{
 const r=A.save({note:'đổi mục tiêu',label:{goal:g=>RULES.goals[g].label}});assert.ok(r.ok);v2=r.version;
 assert.notEqual(v2.id,v1.id);assert.equal(v2.n,2);assert.deepEqual(v2.quiz,Q2);assert.equal(v2.basisId,v1.id);
 assert.match(v2.change,/thêm mục tiêu: Hỗ trợ kiểm soát dầu, Duy trì routine cơ bản/);assert.match(v2.change,/bỏ mục tiêu: Cấp ẩm/);assert.match(v2.change,/dry → oily/);
 v1Before=json(A.version(v1.id));v2Before=json(v2);appsBefore=json(A.d.applications)});
t('7b. timeline SAU khi thay đổi: lịch sử trước đó không bị viết lại',()=>{
 const D3=localDate(now());assert.equal(effectiveAt(A.d,D3).version.id,v2.id);
 assert.equal(effectiveAt(A.d,addDays(D3,-1)).version.id,v1.id);assert.equal(effectiveAt(A.d,D0).version.id,v1.id);
 assert.equal(effectiveAt(A.d,addDays(D0,-1)).version,null);
 const past=describeDay(A.d,addDays(D0,-1),D3);assert.equal(past.rel,'past');assert.equal(past.version,null);assert.equal(past.entry,null)});
let rr;
t('4–5. khôi phục v1: cả quiz và sản phẩm được khôi phục, không "chưa lưu"',()=>{
 day(2);A.add('p07');assert.equal(A.dirty,true);
 rr=A.restore(v1.id);assert.ok(rr.ok);assert.deepEqual(A.quiz,Q1);assert.deepEqual(A.selection,user('A').purchased);
 assert.equal(A.dirty,false);assert.equal(A.d.basisId,v1.id);assert.equal(rr.applied,true);assert.deepEqual(rr.notices,[])});
t('4b. khôi phục không sửa/xóa lịch sử cũ',()=>{
 assert.equal(A.d.versions.length,2);assert.deepEqual(json(A.version(v1.id)),v1Before);assert.deepEqual(json(A.version(v2.id)),v2Before);
 assert.deepEqual(json(A.d.applications.slice(0,2)),appsBefore);assert.equal(A.d.applications.at(-1).kind,'restore')});
t('6. routine tính lại nhất quán với ảnh chụp lúc lưu và với Engine',()=>{
 assert.equal(rr.consistent,true);
 const direct=buildRoutine({quiz:Q1,catalog:PRODUCTS,selection:user('A').purchased,owned:user('A').purchased});
 assert.deepEqual(snapshotOf(A.compute(A.quiz,A.selection)),v1.snapshot);assert.deepEqual(snapshotOf(direct),v1.snapshot)});
t('7c. timeline sau khôi phục: từng giai đoạn đúng phiên bản',()=>{
 const D5=localDate(now()),D3=addDays(D5,-2);
 assert.deepEqual([D0,addDays(D0,2),D3,addDays(D3,1),D5].map(d=>effectiveAt(A.d,d).version.n),[1,1,2,2,1]);
 const f=describeDay(A.d,addDays(D5,10),D5);assert.equal(f.rel,'future');assert.equal(f.version.id,v1.id);
 assert.deepEqual(periods(A.d).map(p=>[p.version.n,p.from,p.to]),[[1,D0,addDays(D3,-1)],[2,D3,addDays(D5,-1)],[1,D5,null]])});
t('7d. khôi phục lại phiên bản đang áp dụng không tạo bản ghi trùng',()=>{
 const k=A.d.applications.length;assert.equal(A.restore(v1.id).applied,false);assert.equal(A.d.applications.length,k)});
t('7e. ngày áp dụng không được sớm hơn lần áp dụng gần nhất; "chỉ lưu" không đổi lịch sử',()=>{
 const D5=localDate(now());A.setQuiz(Q2);
 const bad=A.save({applyFrom:addDays(D5,-1)});assert.equal(bad.ok,false);assert.equal(A.d.versions.length,2);
 const k=A.d.applications.length,dr=A.save({apply:false,note:'nháp'});assert.ok(dr.ok);assert.equal(dr.version.appliedFrom,null);
 assert.equal(A.d.applications.length,k);assert.equal(effectiveAt(A.d,D5).version.id,v1.id);assert.equal(A.dirty,false);
 A.restore(v1.id)});
t('10. dữ liệu còn sau khi tải lại (instance mới, cùng storage)',()=>{
 const snap=json(A.d),B2=open('A',mem);assert.deepEqual(json(B2.d),snap);assert.equal(B2.dirty,false);
 assert.deepEqual(B2.quiz,Q1);assert.equal(B2.applied.id,v1.id);assert.deepEqual(B2.notices,[]);A=B2});

t('8. hai tài khoản không dùng chung lịch sử',()=>{
 const B=open('B',mem);assert.equal(B.d.versions.length,0);assert.equal(B.d.applications.length,0);assert.equal(B.quiz,null);
 assert.deepEqual(B.selection,user('B').purchased);
 B.setQuiz({goals:['acne'],skin:null,at:'x'});assert.ok(B.save().ok);
 const A2=open('A',mem);assert.equal(A2.d.versions.length,3);assert.deepEqual(A2.quiz,Q1);
 assert.ok(!A2.d.versions.some(v=>v.quiz?.goals?.includes('acne')));
 const ids=[...A2.d.versions,...B.d.versions].map(v=>v.id);assert.equal(new Set(ids).size,ids.length);
 assert.ok(mem.getItem('skc:A')!==mem.getItem('skc:B'));assert.equal(open('B',mem).d.versions.length,1)});

// Chuyển đổi dữ liệu 0.2
const OLD={quiz:{at:'2026-10-20T01:00:00.000Z',goals:['hydrate'],skin:'dry'},selection:['p01','p03','p08','p10'],
 versions:[{n:1,at:'2026-10-20T01:05:00.000Z',selection:['p01','p03','p04','p08','p10'],note:'đầu',change:'thêm: … | bỏ: —'},
           {n:2,at:'2026-10-22T01:05:00.000Z',selection:['p01','p03','p08','p10'],note:'',change:'thêm: — | bỏ: Serum HA Plump'}],
 journal:{'2026-10-21':{dry:2,oil:1,irr:0,skipped:false,note:'ok'},'2026-10-25':{dry:3,oil:1,irr:1,skipped:true,note:'',photo:true}},startDate:'2026-10-20'};
t('9. dữ liệu 0.2 được chuyển đổi đúng, không suy đoán trường thiếu',()=>{
 const m=new Mem(),raw=JSON.stringify(OLD);m.setItem('skc:A',raw);m.setItem('skc:B',JSON.stringify({quiz:null,versions:[],journal:{}}));m.setItem('skc:uid','A');
 const M=open('A',m),d=M.d;
 assert.equal(d.schema,3);assert.deepEqual(d.quiz,OLD.quiz);assert.deepEqual(d.selection,OLD.selection);assert.deepEqual(d.journal,OLD.journal);assert.equal(d.startDate,OLD.startDate);
 assert.equal(d.versions.length,2);assert.deepEqual(d.applications,[]);
 const [a,b]=d.versions;assert.deepEqual(a.selection,OLD.versions[0].selection);assert.equal(a.createdAt,OLD.versions[0].at);assert.equal(b.note,'');
 for(const v of d.versions){assert.equal(v.quizKnown,false);assert.equal(v.quiz,null);assert.equal(v.rulesVersion,null);assert.equal(v.appliedFrom,null);assert.equal(v.snapshot,null);
  assert.deepEqual(v.legacy.missing,['quiz','rulesVersion','snapshot','appliedFrom'])}
 assert.notEqual(a.id,b.id);assert.equal(d.basisId,b.id);assert.equal(M.dirty,false);
 assert.equal(m.getItem('skc:A:backup-0.2'),raw);assert.equal(m.getItem('skc:uid'),'A');assert.match(M.notices[0],/Đã chuyển đổi dữ liệu từ phiên bản cũ \(0.2\)/); // v1.0.1: storage.js bỏ chữ "prototype" khỏi thông báo này
 // timeline: không có dữ liệu áp dụng → "không đủ dữ liệu", kèm gợi ý phiên bản đã lưu; nhật ký 0.2 vẫn hiển thị
 const x=describeDay(d,'2026-10-25',localDate(now()));assert.equal(x.version,null);assert.equal(x.savedOnly.n,2);assert.equal(x.entry.skipped,true);
 assert.equal(describeDay(d,'2026-10-23',localDate(now())).entry,null);
 // mở lại: không chuyển đổi lần hai, bản sao lưu không bị ghi đè
 const again=open('A',m);assert.deepEqual(json(again.d),json(d));assert.deepEqual(again.notices,[]);assert.equal(m.getItem('skc:A:backup-0.2'),raw);
 // User B cũng là dữ liệu 0.2 → chuyển đổi riêng
 const MB=open('B',m);assert.equal(MB.d.schema,3);assert.equal(MB.d.versions.length,0);assert.ok(m.getItem('skc:B:backup-0.2'))});
t('9b. khôi phục phiên bản 0.2: giữ quiz hiện tại, báo rõ thiếu dữ liệu, không ghi là "đang áp dụng"',()=>{
 const m=new Mem();m.setItem('skc:A',JSON.stringify(OLD));const M=open('A',m);
 const r=M.restore(M.d.versions[0].id);assert.ok(r.ok);assert.deepEqual(M.quiz,OLD.quiz);assert.deepEqual(M.selection,OLD.versions[0].selection);
 assert.equal(r.applied,false);assert.deepEqual(M.d.applications,[]);assert.equal(M.dirty,false);
 assert.ok(r.notices.some(x=>/không lưu kết quả quiz/.test(x)));assert.ok(r.notices.some(x=>/không ghi nhận phiên bản bộ quy tắc/.test(x)));
 const s=M.save({note:'bổ sung dữ liệu'});assert.ok(s.ok);assert.match(s.version.change,/không có dữ liệu để so sánh/);assert.equal(s.version.quizKnown,true)});
t('9c. dữ liệu 0.2 thiếu/sai trường không làm hỏng ứng dụng; dữ liệu hỏng được sao lưu',()=>{
 const m=new Mem(),bad={quiz:'x',selection:'p01',versions:[{n:1},null,{at:'2026-10-01T00:00:00Z',selection:['p01']}],journal:'abc'};
 m.setItem('skc:A',JSON.stringify(bad));const M=open('A',m);
 assert.equal(M.d.quiz,null);assert.deepEqual(M.selection,user('A').purchased);assert.deepEqual(M.d.journal,{});assert.equal(M.d.versions.length,3);
 assert.deepEqual(M.d.versions[0].legacy.missing.slice(-2),['createdAt','selection']);assert.equal(M.d.versions[1].createdAt,null);
 assert.ok(M.notices.length>=4);assert.equal(JSON.parse(m.getItem('skc:A:backup-0.2')).journal,'abc');
 const m2=new Mem();m2.setItem('skc:A','{hỏng');const M2=open('A',m2);
 assert.equal(M2.d.versions.length,0);assert.equal(m2.getItem('skc:A:unreadable'),'{hỏng');assert.equal(m2.getItem('skc:A'),'{hỏng');assert.match(M2.notices[0],/Không đọc được/)});
t('A-bis. phiên bản tạo bằng bộ quy tắc khác → thông báo rõ khi khôi phục',()=>{
 const m=new Mem(),M=open('A',m);M.setQuiz(Q1);M.save();
 const d=JSON.parse(m.getItem('skc:A'));d.versions[0].rulesVersion='DEMO-0.1 (cũ)';m.setItem('skc:A',JSON.stringify(d));
 const r=open('A',m).restore(d.versions[0].id);assert.ok(r.notices.some(x=>/DEMO-0.1 \(cũ\)".*hiện không còn được dùng/.test(x)));// v1.0.1: manager.js đổi chữ "không còn khả dụng trong prototype" → "hiện không còn được dùng"assert.equal(r.consistent,null)});
// ĐIỀU CHỈNH Ở 0.3.1 (yêu cầu VI.9–10): trước đây lỗi ghi → hoàn tác thay đổi trong bộ nhớ (ok:false).
// Nay: thay đổi được GIỮ trong phiên (vẫn dùng tạm được) nhưng kết quả báo rõ persisted:false + storageError,
// trạng thái lưu trữ chuyển sang "memory"; localStorage không bị ghi. Vẫn kiểm tra: báo lỗi, không báo lưu bền vững sai.
t('A-ter. lỗi ghi localStorage → giữ thay đổi trong phiên, báo rõ chưa lưu bền vững',()=>{
 const m=new Mem(),M=open('A',m);M.setQuiz(Q1);const before=m.getItem('skc:A');m.setItem=()=>{throw new Error('QuotaExceededError')};
 const r=M.save();assert.equal(r.ok,true);assert.equal(r.persisted,false);assert.match(r.storageError,/Quota/);
 assert.equal(M.d.versions.length,1);assert.equal(M.storage.persistent,false);assert.equal(m.getItem('skc:A'),before)});
console.log(`\n${n} kiểm thử đạt.`);
