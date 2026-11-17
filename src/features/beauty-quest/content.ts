/**
 * NỘI DUNG BEAUTY QUEST — chuyển nguyên văn từ mã nguồn của nhóm Beauty Quest (netlify/lib/content.js,
 * hằng số LEVELS / ROADMAP / ROUNDS trong netlify/functions/api.js). Chỉ thêm kiểu TypeScript.
 * Chỉ là thông tin chăm sóc da cơ bản, không phải chẩn đoán hay tư vấn y khoa.
 *
 * Luật chấm điểm, nhận điểm, kiểm tra câu trả lời nằm ở database (migration 015). Nếu sửa danh sách
 * câu hỏi / bước / bài viết ở đây, sửa cùng danh sách trong migration mới để máy chủ chấp nhận.
 */

export type Period = 'morning' | 'night'
export interface Step { id: string; label: string; hint: string }
export interface SkinTypeInfo { label: string; summary: string; tips: string[] }
export interface QuizQuestion { id: string; type: 'single' | 'multi'; max?: number; title: string; options: [string, string][] }
export type ArticleBlock = { h: string } | { p: string } | { ul: string[] }
export interface Article { slug: string; title: string; kind: 'tip' | 'guide'; minutes: number; summary: string; body: ArticleBlock[] }

export const STEPS: Record<Period, Step[]> = {
  morning: [
    { id: "cleanser", label: "Rửa mặt dịu nhẹ", hint: "Dùng nước mát hoặc ấm vừa, massage 30–60 giây." },
    { id: "toner", label: "Toner / nước cân bằng (tùy chọn)", hint: "Không bắt buộc, bỏ qua nếu bạn muốn routine gọn." },
    { id: "serum", label: "Serum theo nhu cầu", hint: "Ví dụ cấp ẩm hoặc làm sáng; dùng từng loại một." },
    { id: "moisturizer", label: "Kem dưỡng ẩm", hint: "Da dầu có thể chọn kết cấu gel nhẹ." },
    { id: "sunscreen", label: "Kem chống nắng (SPF 30+)", hint: "Bước quan trọng nhất ban ngày, thoa đủ lượng." },
  ],
  night: [
    { id: "remover", label: "Tẩy trang (nếu có chống nắng/trang điểm)", hint: "Giúp bước rửa mặt sau sạch hơn." },
    { id: "cleanser", label: "Rửa mặt dịu nhẹ", hint: "Rửa nhẹ nhàng, không chà xát." },
    { id: "toner", label: "Toner / nước cân bằng (tùy chọn)", hint: "Không bắt buộc." },
    { id: "treatment", label: "Sản phẩm đặc trị (tùy nhu cầu)", hint: "Bắt đầu từ từ, vài lần mỗi tuần, theo dõi phản ứng của da." },
    { id: "serum", label: "Serum theo nhu cầu", hint: "Dùng từng loại một để dễ theo dõi." },
    { id: "moisturizer", label: "Kem dưỡng ẩm", hint: "Khóa ẩm sau các bước trước." },
  ],
};

export const SKIN_TYPES: Record<string, SkinTypeInfo> = {
  dry: { label: "Da khô", summary: "Da của bạn có xu hướng thiếu dầu và nước, hay căng sau khi rửa mặt.",
    tips: ["Chọn sữa rửa mặt dịu nhẹ, ít tạo bọt mạnh.", "Thoa kem dưỡng ẩm khi da còn hơi ẩm để giữ nước tốt hơn.", "Hạn chế rửa mặt bằng nước quá nóng."] },
  normal: { label: "Da thường", summary: "Da của bạn khá cân bằng: không quá khô cũng không quá dầu.",
    tips: ["Giữ routine đơn giản: rửa mặt, dưỡng ẩm, chống nắng.", "Thêm sản phẩm mới từng cái một để dễ theo dõi phản ứng.", "Chống nắng đều đặn là cách bảo vệ da lâu dài."] },
  combination: { label: "Da hỗn hợp", summary: "Vùng chữ T có xu hướng dầu hơn, hai bên má bình thường hoặc khô hơn.",
    tips: ["Có thể dùng kem dưỡng kết cấu nhẹ cho cả mặt, thêm một lớp ẩm hơn cho vùng khô.", "Tránh làm sạch quá mạnh vùng chữ T vì có thể làm da mất cân bằng.", "Chống nắng dạng gel hoặc fluid thường dễ chịu hơn."] },
  oily: { label: "Da dầu", summary: "Da của bạn tiết nhiều dầu, dễ bóng nhất là ở vùng chữ T.",
    tips: ["Da dầu vẫn cần dưỡng ẩm; chọn kết cấu gel hoặc lotion nhẹ.", "Rửa mặt sáng và tối là đủ, rửa quá nhiều có thể làm da kích ứng.", "Chọn chống nắng ghi nhãn không gây bít tắc hoặc kết cấu mỏng nhẹ."] },
};

export const CONCERN_TIPS: Record<string, [string, string]> = {
  acne: ["Mụn", "Đừng nặn mụn bằng tay. Nếu mụn sưng đau, lan rộng hoặc để lại sẹo, hãy gặp bác sĩ da liễu."],
  spots: ["Thâm, không đều màu", "Chống nắng đều đặn là nền tảng; vết thâm thường mờ dần theo thời gian."],
  hydrate: ["Thiếu ẩm", "Ưu tiên dưỡng ẩm đều đặn và giữ routine đơn giản."],
  pores: ["Lỗ chân lông", "Làm sạch dịu nhẹ và đều đặn quan trọng hơn là cố 'thu nhỏ' lỗ chân lông."],
  calm: ["Da nhạy cảm, dễ đỏ", "Thử từng sản phẩm một và tránh thay đổi nhiều thứ cùng lúc."],
  dull: ["Da xỉn màu", "Ngủ đủ, chống nắng và tẩy tế bào chết nhẹ nhàng, không quá thường xuyên."],
};

export const QUIZ: QuizQuestion[] = [
  { id: "after_wash", type: "single", title: "Khoảng 30 phút sau khi rửa mặt (chưa thoa gì), da bạn thường thế nào?",
    options: [["tight", "Căng, khô, có khi hơi bong"], ["comfy", "Thoải mái, không khô cũng không bóng"], ["tzone", "Vùng chữ T hơi bóng, hai má bình thường hoặc khô"], ["shiny", "Bóng dầu khắp mặt"]] },
  { id: "midday", type: "single", title: "Đến giữa trưa, da bạn thường?",
    options: [["matte", "Vẫn ổn, không bóng"], ["tz", "Trán và mũi hơi bóng"], ["all", "Bóng dầu toàn mặt"], ["flaky", "Khô, kém mịn"]] },
  { id: "reactive", type: "single", title: "Khi thử sản phẩm mới, da bạn?",
    options: [["often", "Hay đỏ, châm chích hoặc ngứa"], ["some", "Thỉnh thoảng có phản ứng"], ["rare", "Hiếm khi có phản ứng"]] },
  { id: "concerns", type: "multi", max: 3, title: "Bạn quan tâm nhất điều gì? (chọn tối đa 3)",
    options: [["acne", "Mụn"], ["spots", "Thâm, không đều màu"], ["hydrate", "Thiếu ẩm"], ["pores", "Lỗ chân lông"], ["calm", "Da dễ đỏ, nhạy cảm"], ["dull", "Da xỉn màu"]] },
  { id: "time", type: "single", title: "Mỗi ngày bạn muốn dành bao nhiêu thời gian cho da?",
    options: [["quick", "Dưới 5 phút"], ["normal", "5–10 phút"], ["long", "Trên 10 phút"]] },
  { id: "sun", type: "single", title: "Bạn có dùng kem chống nắng hằng ngày không?",
    options: [["daily", "Gần như mỗi ngày"], ["sometimes", "Thỉnh thoảng"], ["rarely", "Hiếm khi"]] },
];

export const REFLECT = {
  ratings: [
    { id: "skin", title: "Tuần này da bạn cảm thấy thế nào?", low: "Chưa ổn", high: "Rất ổn" },
    { id: "routine", title: "Bạn duy trì thói quen chăm da ở mức nào?", low: "Ít", high: "Đều đặn" },
    { id: "rest", title: "Giấc ngủ và mức căng thẳng tuần này?", low: "Mệt mỏi", high: "Thoải mái" },
  ],
  texts: [
    { id: "win", title: "Một điều bạn làm tốt tuần này" },
    { id: "next", title: "Một việc nhỏ bạn muốn thử tuần sau" },
  ],
};

// Mỗi bài: slug, title, kind ("tip" | "guide"), minutes, summary, body = [{h}|{p}|{ul:[...]}]
export const ARTICLES: Article[] = [
  { slug: "rua-mat-dung-cach", title: "Rửa mặt đúng cách trong 4 bước", kind: "guide", minutes: 4,
    summary: "Làm sạch dịu nhẹ là nền tảng của mọi routine.",
    body: [
      { p: "Rửa mặt giúp loại bỏ bụi bẩn, dầu thừa và kem chống nắng. Mục tiêu là sạch vừa đủ, không phải làm da căng rát." },
      { h: "Các bước" },
      { ul: ["Làm ướt mặt bằng nước mát hoặc ấm vừa, tránh nước quá nóng.", "Lấy một lượng sữa rửa mặt nhỏ, massage nhẹ khoảng 30–60 giây.", "Xả sạch, không để sản phẩm sót lại ở chân tóc và viền hàm.", "Thấm khô bằng khăn sạch, không chà xát, rồi thoa dưỡng ẩm khi da còn hơi ẩm."] },
      { h: "Bao nhiêu lần là đủ?" },
      { p: "Hầu hết mọi người chỉ cần rửa mặt sáng và tối, thêm một lần sau khi ra nhiều mồ hôi. Rửa quá nhiều có thể làm da khô và dễ kích ứng, kể cả với da dầu." },
      { h: "Tối nay hãy thử" },
      { p: "Nếu bạn dùng kem chống nắng hoặc trang điểm, hãy tẩy trang trước rồi mới rửa mặt để làn da được làm sạch nhẹ nhàng hơn." },
    ] },
  { slug: "chong-nang-moi-ngay", title: "Chống nắng mỗi ngày: những điều cần nhớ", kind: "guide", minutes: 5,
    summary: "Kem chống nắng là bước ít tốn công nhưng bảo vệ da nhiều nhất.",
    body: [
      { p: "Tia UV là nguyên nhân chính gây sạm, thâm và lão hóa sớm của da. Dùng kem chống nắng đều đặn là thói quen có lợi lâu dài." },
      { h: "Chọn thế nào?" },
      { ul: ["Chọn sản phẩm phổ rộng (broad spectrum) với SPF từ 30 trở lên.", "Chọn kết cấu bạn thấy dễ chịu, vì bạn sẽ dùng đều hơn nếu thích nó.", "Da nhạy cảm có thể thử loại ghi nhãn dành cho da nhạy cảm và theo dõi phản ứng."] },
      { h: "Dùng thế nào?" },
      { ul: ["Thoa là bước cuối của routine ban ngày, khoảng 15 phút trước khi ra nắng.", "Thoa đủ lượng: cho mặt và cổ thường cần khoảng 1/4 thìa cà phê.", "Thoa lại sau mỗi 2 giờ khi ở ngoài trời, hoặc sau khi bơi và ra nhiều mồ hôi."] },
      { p: "Ngày nhiều mây hoặc ở trong nhà gần cửa sổ, tia UV vẫn có thể tới da. Bạn không cần hoàn hảo, chỉ cần đều đặn." },
    ] },
  { slug: "duong-am-co-ban", title: "Dưỡng ẩm cơ bản: da nào cũng cần", kind: "guide", minutes: 4,
    summary: "Hiểu ba nhóm thành phần giúp bạn chọn kem dưỡng dễ hơn.",
    body: [
      { p: "Kem dưỡng ẩm giúp giữ nước cho da và hỗ trợ hàng rào bảo vệ da. Da dầu cũng cần dưỡng ẩm, chỉ là chọn kết cấu nhẹ hơn." },
      { h: "Ba nhóm thành phần thường gặp" },
      { ul: ["Chất hút ẩm (humectant), ví dụ glycerin, hyaluronic acid: kéo nước vào lớp ngoài của da.", "Chất làm mềm (emollient), ví dụ ceramide, squalane: làm da mềm mịn.", "Chất khóa ẩm (occlusive), ví dụ petrolatum, dầu thực vật: tạo lớp màng giúp nước khó bay hơi."] },
      { h: "Gợi ý chọn" },
      { ul: ["Da khô: kem đậm hơn, có thành phần làm mềm và khóa ẩm.", "Da dầu/hỗn hợp: gel hoặc lotion nhẹ, thoa lượng vừa đủ.", "Da dễ kích ứng: ưu tiên công thức đơn giản, ít thành phần."] },
      { p: "Thoa dưỡng ẩm sau khi rửa mặt, khi da còn hơi ẩm sẽ giữ nước tốt hơn." },
    ] },
  { slug: "tay-te-bao-chet", title: "Tẩy tế bào chết: bao nhiêu là đủ?", kind: "guide", minutes: 4,
    summary: "Ít và nhẹ nhàng thường tốt hơn là nhiều và mạnh tay.",
    body: [
      { p: "Tẩy tế bào chết giúp bề mặt da mịn hơn, nhưng làm quá thường xuyên có thể gây đỏ, rát và làm hàng rào da yếu đi." },
      { h: "Hai nhóm chính" },
      { ul: ["Vật lý (hạt, miếng chà): ma sát lên da, nên chọn hạt mịn và chà rất nhẹ hoặc tránh với da nhạy cảm.", "Hóa học (AHA, BHA, PHA): dùng acid nồng độ thấp để làm bong lớp tế bào chết; dịu nhẹ hơn nếu dùng đúng cách."] },
      { h: "Tần suất tham khảo" },
      { p: "Nhiều người bắt đầu với 1 lần mỗi tuần, rồi tăng dần lên 2–3 lần nếu da thoải mái. Nếu da đỏ, châm chích hoặc bong tróc, hãy dừng và cho da nghỉ." },
      { p: "Khi tẩy tế bào chết, hãy nhớ dùng kem chống nắng ban ngày vì da sẽ nhạy cảm với nắng hơn." },
    ] },
  { slug: "doc-bang-thanh-phan", title: "Cách đọc bảng thành phần mỹ phẩm", kind: "guide", minutes: 5,
    summary: "Vài mẹo nhỏ để đọc nhãn mà không bị rối.",
    body: [
      { p: "Bảng thành phần (INCI) liệt kê theo thứ tự nồng độ giảm dần, với các thành phần dưới khoảng 1% có thể xếp thứ tự bất kỳ." },
      { h: "Mẹo đọc nhanh" },
      { ul: ["Nhìn vài thành phần đầu tiên để biết sản phẩm chủ yếu là gì.", "Thành phần hoạt tính thường chỉ chiếm tỉ lệ nhỏ, nồng độ quan trọng hơn vị trí trong danh sách.", "Hương liệu và tinh dầu có thể gây kích ứng với một số người; nếu da bạn nhạy cảm, có thể ưu tiên sản phẩm không mùi.", "Từ 'tự nhiên' không đồng nghĩa với an toàn hơn, và từ 'hóa học' không đồng nghĩa với xấu."] },
      { p: "Nếu bạn từng bị phản ứng với một thành phần, hãy ghi lại để tránh trong lần mua sau. Beauty Quest không yêu cầu bạn mua bất kỳ sản phẩm nào." },
    ] },
  { slug: "retinol-cho-nguoi-moi", title: "Retinol cho người mới bắt đầu", kind: "guide", minutes: 5,
    summary: "Bắt đầu chậm, dùng ban đêm và luôn chống nắng.",
    body: [
      { p: "Retinol (dẫn xuất vitamin A) thường được dùng để hỗ trợ cải thiện kết cấu da, mụn và dấu hiệu lão hóa. Nó cũng có thể gây khô, đỏ và bong tróc trong thời gian đầu." },
      { h: "Cách bắt đầu nhẹ nhàng" },
      { ul: ["Chọn nồng độ thấp và dùng vào buổi tối.", "Bắt đầu 1–2 đêm mỗi tuần, tăng dần nếu da thoải mái.", "Dùng lượng nhỏ cỡ hạt đậu cho cả mặt, tránh vùng quanh mắt và khóe mũi.", "Thoa kem dưỡng ẩm đầy đủ, và dùng chống nắng mỗi sáng."] },
      { h: "Lưu ý" },
      { p: "Nếu bạn đang mang thai, dự định mang thai hoặc cho con bú, hãy hỏi bác sĩ trước khi dùng sản phẩm chứa retinoid. Nếu da kích ứng nhiều, hãy dừng lại và hỏi ý kiến chuyên gia." },
    ] },
  { slug: "thu-san-pham-moi", title: "Mẹo: thử sản phẩm mới an toàn hơn", kind: "tip", minutes: 2,
    summary: "Thử nhỏ, thử từng cái một.",
    body: [
      { p: "Trước khi dùng cả mặt, hãy thử một lượng nhỏ ở vùng da kín như mặt trong cẳng tay hoặc sau tai, rồi chờ 24–48 giờ." },
      { ul: ["Chỉ thêm một sản phẩm mới mỗi lần, cách nhau ít nhất 1–2 tuần.", "Nếu thấy đỏ, ngứa hoặc châm chích kéo dài, hãy dừng sử dụng.", "Ghi nhật ký da để thấy rõ da thay đổi thế nào."] },
    ] },
  { slug: "da-dau-va-mun", title: "Mẹo: da dầu và mụn, đừng làm da khô thêm", kind: "tip", minutes: 3,
    summary: "Làm sạch quá mạnh thường không giúp mụn hết nhanh hơn.",
    body: [
      { p: "Khi da bóng dầu và có mụn, nhiều người muốn rửa thật mạnh. Tuy nhiên, làm khô da quá mức có thể khiến da kích ứng và khó chịu hơn." },
      { ul: ["Rửa mặt dịu nhẹ sáng và tối, rồi dưỡng ẩm bằng kết cấu nhẹ.", "Tránh nặn mụn bằng tay vì có thể gây viêm và để lại thâm, sẹo.", "Thay vỏ gối và khăn mặt đều đặn.", "Nếu mụn sưng đau, nhiều hoặc để lại sẹo, hãy gặp bác sĩ da liễu để được tư vấn phù hợp."] },
    ] },
  { slug: "giu-ve-sinh-vat-dung", title: "Mẹo: giữ vệ sinh vật dụng tiếp xúc với da", kind: "tip", minutes: 2,
    summary: "Những thứ nhỏ nhưng ảnh hưởng đến da mỗi ngày.",
    body: [
      { ul: ["Khăn mặt: dùng riêng và thay thường xuyên.", "Vỏ gối: nên giặt khoảng mỗi 1–2 tuần.", "Điện thoại: lau mặt màn hình trước khi áp lên mặt.", "Cọ trang điểm: rửa định kỳ, khoảng mỗi tuần nếu dùng thường xuyên.", "Mỹ phẩm: để ý hạn sử dụng và biểu tượng thời hạn sau khi mở nắp (PAO)."] },
      { p: "Bạn không cần làm tất cả cùng lúc. Chọn một việc để bắt đầu từ hôm nay là đủ." },
    ] },
  { slug: "ngu-va-lan-da", title: "Mẹo: giấc ngủ và làn da", kind: "tip", minutes: 2,
    summary: "Nghỉ ngơi cũng là một phần của chăm sóc da.",
    body: [
      { p: "Khi ngủ, cơ thể có thời gian phục hồi. Thiếu ngủ kéo dài thường đi kèm da xỉn, quầng thâm và dễ căng thẳng hơn." },
      { ul: ["Người trưởng thành thường được khuyến nghị ngủ ít nhất 7 giờ mỗi đêm.", "Đặt giờ đi ngủ tương đối đều đặn.", "Tối giản routine buổi tối để bạn dễ duy trì ngay cả khi mệt."] },
    ] },
];

// ---------- Từ netlify/functions/api.js ----------
export const LEVELS: [number, string][] = [[0, "Cấp 1 · Mầm non"], [50, "Cấp 2 · Nụ hoa"], [120, "Cấp 3 · Hé nở"], [220, "Cấp 4 · Rạng rỡ"], [350, "Cấp 5 · Tỏa sáng"]];
export const ROADMAP: [string, number, number, string[]][] = [["Làm quen với làn da", 0, 40, ["quiz", "knowledge"]], ["Xây dựng routine", 40, 100, ["routine"]],
  ["Duy trì thói quen", 100, 200, ["routine", "reflect"]], ["Thấu hiểu làn da", 200, 350, ["knowledge", "reflect"]]];
export const ROUNDS: { id: string; title: string; options: [string, string, string][] }[] = [
  { id: "texture", title: "Kết cấu bạn thích hơn?", options: [["gel", "💧", "Gel mát, nhẹ"], ["cream", "🧈", "Kem dưỡng đậm"]] },
  { id: "steps", title: "Routine lý tưởng của bạn?", options: [["short", "⏱️", "Gọn 2–3 bước"], ["full", "🧴", "Đầy đủ 5 bước trở lên"]] },
  { id: "focus", title: "Bạn quan tâm nhất điều gì?", options: [["acne", "🌿", "Mụn"], ["spots", "🌸", "Thâm, đều màu da"], ["hydrate", "💦", "Cấp ẩm"], ["calm", "🍃", "Làm dịu da nhạy cảm"]] },
  { id: "time", title: "Bạn hay chăm da lúc nào?", options: [["morning", "☀️", "Buổi sáng"], ["night", "🌙", "Buổi tối"], ["both", "✨", "Cả hai"]] },
  { id: "learn", title: "Bạn thích học về da theo cách nào?", options: [["tips", "💡", "Mẹo ngắn"], ["guide", "📖", "Hướng dẫn chi tiết"], ["ingredients", "🔬", "So sánh thành phần"]] },
  { id: "scent", title: "Về mùi hương?", options: [["none", "🚫", "Không mùi"], ["light", "🌼", "Hương nhẹ"]] }];
// Tình trạng da trong nhật ký (từ public/assets/home.js)
export const MOODS: Record<string, [string, string]> = { radiant: ["✨", "Rạng rỡ"], balanced: ["🌿", "Cân bằng"], dry: ["🏜️", "Hơi khô"], oily: ["💧", "Hơi dầu"], sensitive: ["🌸", "Dễ kích ứng"] };
export const QUIZ_NOTE = "Kết quả chỉ mang tính tham khảo, không phải chẩn đoán. Nếu da có vấn đề kéo dài hoặc nặng, hãy gặp bác sĩ da liễu.";
