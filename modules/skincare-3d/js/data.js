// Data Layer: dữ liệu giả lập + lưu trữ theo userId. Thay file này bằng API thật khi tích hợp.
export const ZONES={forehead:'Trán',cheekL:'Má trái',cheekR:'Má phải',chin:'Cằm'};
const P=(id,name,category,functions,ingredients,actives,recommendedPeriod,zones,usageInstructions,warnings=[])=>({id,name,category,functions,ingredients,actives,recommendedPeriod,zones,usageInstructions,warnings});
export const PRODUCTS=[
P('p01','Gel rửa mặt dịu nhẹ Lumi','cleanser',['cleanse'],['Glycerin','Betaine'],[],'both',['face'],'Massage lên da ướt 30 giây rồi rửa sạch.'),
P('p02','Sữa rửa mặt tạo bọt Aqua','cleanser',['cleanse'],['Glycerin','Sodium Cocoyl Isethionate'],[],'both',['face'],'Tạo bọt, massage nhẹ rồi rửa sạch.'),
P('p03','Toner cấp ẩm Dew','toner',['hydrate'],['Glycerin','Panthenol'],[],'both',['face'],'Thấm lên da bằng tay sau khi rửa mặt.'),
P('p04','Serum HA Plump','serum',['hydrate'],['Hyaluronic Acid'],['hyaluronic'],'both',['face'],'Dùng 2–3 giọt lên da còn hơi ẩm.'),
P('p05','Serum Vitamin C Bright','serum',['antioxidant'],['Ascorbic Acid'],['vitc'],'am',['face'],'Dùng 2–3 giọt vào buổi sáng.',['Có thể gây châm chích; nên thử trên vùng nhỏ trước.']),
P('p06','Serum Retinol Renew','treatment',['renewal'],['Retinol'],['retinoid'],'pm',['forehead','cheekL','cheekR'],'Dùng lượng nhỏ vào buổi tối.',['Nên bắt đầu với tần suất thấp và dùng chống nắng ban ngày.']),
P('p07','Gel BHA Clear','treatment',['exfoliate'],['Salicylic Acid'],['bha'],'pm',['forehead','chin'],'Chấm lên vùng cần chăm sóc vào buổi tối.',['Có thể gây khô hoặc châm chích.']),
P('p08','Kem dưỡng ẩm Barrier','moisturizer',['hydrate'],['Ceramide','Glycerin'],[],'both',['face'],'Thoa một lớp mỏng lên toàn mặt.'),
P('p09','Gel dưỡng kiềm dầu Matte','moisturizer',['oil-control','hydrate'],['Niacinamide','Glycerin'],['niacinamide'],'both',['face'],'Thoa một lớp mỏng lên toàn mặt.'),
P('p10','Kem chống nắng Shield SPF50','sunscreen',['uv-protect'],['Zinc Oxide'],[],'am',['face'],'Thoa ở bước cuối buổi sáng, thoa lại theo nhãn.'),
P('p11','Kem Glow Mystery',null,[],[],[],null,[],''), // cố ý thiếu metadata (Test 4)
P('p12','Serum Niacinamide Balance','serum',['oil-control'],['Niacinamide'],['niacinamide'],'both',['face'],'Dùng 2–3 giọt trước bước dưỡng ẩm.'),
P('p13','Serum Centella Calm','serum',['soothe'],['Centella Asiatica Extract'],['centella'],'both',['face'],'Dùng 2–3 giọt sau toner.')];
// v1.0.1: tên hiển thị không còn tiền tố "User A/B" (đọc như nhãn debug) — id nội bộ (A/B) vẫn giữ nguyên,
// chỉ đổi phần name hiển thị cho khách hàng. Bộ chọn hồ sơ này giờ chỉ hiện trong Developer mode.
export const USERS=[
{id:'A',name:'Linh',purchased:['p01','p03','p04','p05','p08','p10']},
{id:'B',name:'Minh',purchased:['p01','p02','p06','p07','p08','p09','p11','p12']}];
// v1.0: cho phép host website (qua js/adapter.js + móc postMessage trong main.js) nạp catalogue/khách hàng của họ
// thay cho dữ liệu mẫu — SỬA TRỰC TIẾP nội dung mảng (không gán lại biến) để mọi module đã `import {PRODUCTS}`/
// `import {USERS}` nhìn thấy cùng một mảng đã cập nhật (ES module import là tham chiếu sống tới CHÍNH mảng này).
// Không gọi gì ở đây khi chạy độc lập (demo) → PRODUCTS/USERS giữ nguyên dữ liệu mẫu phía trên.
export function setCatalog(products){PRODUCTS.length=0;PRODUCTS.push(...products)}
export function upsertUser(user){const i=USERS.findIndex(u=>u.id===user.id);if(i<0)USERS.push(user);else USERS[i]=user}
export const QUIZ=[
{id:'goals',type:'multi',q:'Mục tiêu của bạn là gì? (chọn nhiều)',opts:{hydrate:'Cấp ẩm',oil:'Hỗ trợ kiểm soát dầu',sensitive:'Chăm sóc da dễ kích ứng',acne:'Chăm sóc da có mụn',basic:'Duy trì routine cơ bản'}},
{id:'skin',type:'single',q:'Bạn tự đánh giá da mình thế nào? (chỉ để tham khảo, không phải chẩn đoán)',opts:{dry:'Thiên khô',oily:'Thiên dầu',mixed:'Hỗn hợp',unsure:'Chưa chắc'}}];
// Lưu trữ và chuyển đổi dữ liệu nằm ở storage.js (giữ export cũ để tương thích).
export {store} from './storage.js';
