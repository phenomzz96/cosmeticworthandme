// Bộ quy tắc MINH HỌA (tách khỏi giao diện). Chưa được chuyên gia da liễu/skincare kiểm duyệt.
export const RULES={
 // v1.0.1: bỏ tiền tố "DEMO-" khỏi chuỗi hiển thị (có thể xuất hiện trong thông báo khi so sánh phiên bản đã lưu) —
 // vẫn giữ nguyên nội dung cảnh báo quan trọng "chưa được chuyên gia kiểm duyệt". Chuỗi này chỉ là khóa so sánh nội
 // bộ (manager.js so bằng ===) nên đổi nội dung không ảnh hưởng logic tương thích phiên bản cũ.
 version:'1.0 (quy tắc minh họa, chưa được chuyên gia da liễu kiểm duyệt)',
 categories:{cleanser:'Làm sạch',toner:'Dưỡng ẩm',serum:'Serum',treatment:'Chăm sóc chuyên biệt',moisturizer:'Dưỡng ẩm',sunscreen:'Chống nắng'},
 // core: bước nền tảng luôn được xét. max: số sản phẩm tối đa/bước/buổi (null = không giới hạn).
 // Bước không phải core chỉ nhận sản phẩm khai báo chức năng khớp ít nhất một mục tiêu.
 slots:[
  {key:'cleanse',name:'Làm sạch',cat:'cleanser',purpose:'Làm sạch da trước các bước sau.',core:true,max:1,req:['am','pm']},
  {key:'toner',name:'Toner',cat:'toner',purpose:'Bước chuẩn bị da theo dữ liệu sản phẩm.',core:false,max:1,req:[]},
  {key:'treat',name:'Chăm sóc chuyên biệt',cat:'treatment',purpose:'Chăm sóc theo chức năng mà sản phẩm khai báo.',core:false,max:null,req:[]},
  {key:'serum',name:'Serum',cat:'serum',purpose:'Bổ sung hoạt chất theo chức năng mà sản phẩm khai báo.',core:false,max:null,req:[]},
  {key:'moist',name:'Dưỡng ẩm',cat:'moisturizer',purpose:'Hoàn tất routine bằng bước dưỡng.',core:true,max:1,req:['am','pm']},
  {key:'spf',name:'Chống nắng',cat:'sunscreen',purpose:'Bước cuối của routine buổi sáng.',core:true,max:1,req:['am'],only:['am']}],
 // priority: trọng số xếp hạng; functions: chức năng khai báo được coi là đáp ứng mục tiêu;
 // structural: mục tiêu về cấu trúc routine; avoidActives: hoạt chất khai báo bị giữ ngoài routine khi chọn mục tiêu này.
 goals:{
  sensitive:{label:'Chăm sóc da dễ kích ứng',functions:['soothe'],priority:5,avoidActives:['retinoid','bha','aha','vitc']},
  acne:{label:'Chăm sóc da có mụn',functions:['exfoliate','renewal'],priority:4},
  oil:{label:'Hỗ trợ kiểm soát dầu',functions:['oil-control','exfoliate'],priority:3},
  hydrate:{label:'Cấp ẩm',functions:['hydrate'],priority:2},
  basic:{label:'Duy trì routine cơ bản',functions:[],priority:1,structural:true}},
 // Loại da TỰ ĐÁNH GIÁ: chỉ cộng skinWeight điểm khi cần chọn/sắp xếp giữa sản phẩm tương đương. Không phải chẩn đoán.
 skinWeight:.5,
 skin:{dry:{label:'thiên khô',prefer:['hydrate'],avoidOnly:['oil-control']},oily:{label:'thiên dầu',prefer:['oil-control']},mixed:{label:'hỗn hợp',prefer:['hydrate','oil-control']},unsure:null},
 // Hai sản phẩm trong cùng buổi cùng khai báo một chức năng này (hoặc cùng hoạt chất) → cảnh báo chồng chéo. 'hydrate' cố ý không có (toner+serum+kem cùng cấp ẩm là bình thường).
 overlapFunctions:['oil-control','exfoliate','renewal','antioxidant','uv-protect','soothe'],
 cautions:[
  ['retinoid','bha','Retinoid và BHA trong cùng một buổi nằm trong danh sách cần thận trọng (có thể gây khô hoặc kích ứng).'],
  ['retinoid','aha','Retinoid và AHA trong cùng một buổi nằm trong danh sách cần thận trọng.'],
  ['vitc','retinoid','Vitamin C và Retinoid trong cùng một buổi nằm trong danh sách cần thận trọng.']]};
