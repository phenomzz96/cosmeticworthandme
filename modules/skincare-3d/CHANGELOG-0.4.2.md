# 0.4.2 — Smart Warning UX

Chỉ đổi **lớp trình bày** của cảnh báo. Routine Engine, bộ quy tắc, trạng thái routine, danh sách cảnh báo gốc, 3D/2D, timeline, nhật ký, phiên bản, storage và cơ chế chống XSS **không đổi** (có bài kiểm thử băm SHA-256 các tệp lõi so với 0.4.1).

## Vì sao giao diện 0.4.1 bị rối
Với User B + mục tiêu "mụn" và "dễ kích ứng", Engine tạo 8 bản ghi cảnh báo và giao diện vẽ cả 8 thành 8 thẻ đỏ/vàng liên tiếp, mỗi thẻ lặp lại tên sản phẩm; trạng thái ("Có cảnh báo bên dưới…") lại nhắc lại điều đó. Cùng một vấn đề (trùng bước làm sạch, trùng bước dưỡng ẩm) xuất hiện hai lần vì được phát hiện ở cả buổi sáng và buổi tối. Mỗi bước còn in thêm nguyên văn từng cảnh báo.

8 bản ghi đó **không** phải 8 vấn đề độc lập: thực chất là 6 mục (2 sản phẩm bị giữ ngoài routine, 2 cặp trùng bước, 1 thiếu bước, 1 thiếu dữ liệu).

## Thiết kế mới
- Một khối tổng hợp duy nhất ở đầu trang Routine (thay cho khối trạng thái + danh sách thẻ): trạng thái, "N mục cần xem lại, thuộc M nhóm", mỗi nhóm một dòng, nút **Chỉnh sửa sản phẩm** và **Xem giải thích chi tiết** (`<details>` gốc, mở/đóng bằng Enter/Space).
- Nhóm (bộ điều hợp `js/warnings-view.js`): **A** Cần thận trọng (mỗi tổ hợp một dòng riêng, luôn có tên sản phẩm) · **B** Chưa đưa vào routine · **C** Trùng bước / chồng chéo · **D** Thiếu bước hoặc dữ liệu · **O** Lưu ý khác (loại cảnh báo lạ, không bao giờ bị ẩn) · **R** Tham khảo (chỉ trong phần chi tiết).
- Gộp chỉ khi cùng loại, phạm vi, sản phẩm, tiêu đề (bỏ buổi) **và** lý do; chỉ khác sáng/tối → một mục nhãn "Sáng và tối". Không chắc thì không gộp. Mỗi mục giữ `sources` (chỉ số cảnh báo gốc), tiêu đề và lý do nguyên văn; mức độ lấy đúng từ loại gốc (conflict/caution vẫn là mức cao nhất).
- Phần chi tiết liệt kê theo nhóm: lý do đầy đủ, sản phẩm liên quan, cảnh báo gốc; thêm "Lưu ý trên nhãn sản phẩm".
- Mỗi bước routine chỉ có **một** nhãn ngắn (kèm "+n"); nội dung đầy đủ cho trình đọc màn hình.
- Bước Mô hình: thẻ bước chỉ hiện cảnh báo của bước đang chọn, cùng tên nhóm; lý do mở bằng "Vì sao?".
- Lời lẽ giữ trung lập: "chưa được đưa vào routine", "theo bộ quy tắc minh họa", không khẳng định sản phẩm gây hại hay an toàn.

## Tệp thay đổi
`js/warnings-view.js` (mới) · `js/main.js` · `css/style.css` · `index.html` (nhãn phiên bản) · `package.json` · `tests/v042.test.mjs` (mới) · `tests/ui042.e2e.py` (mới) · `tests/v041.test.mjs` (chỉ bài D5) · `tests/ui041.e2e.py` (chỉ mục 4) · `tests/v031.test.mjs` (thêm module mới vào danh sách quét tĩnh).

## Thay đổi bài kiểm thử cũ (có chủ đích)
- `v041` **D5** ("mọi cảnh báo nằm ngoài phần mở rộng") bị thay: nay yêu cầu mọi loại cảnh báo mức danger/warn/neutral thuộc nhóm cần xem lại, nêu trong dòng tóm tắt luôn hiển thị (trước mọi phần thu gọn), còn lý do đầy đủ truy cập được qua chi tiết. Các phép kiểm tra "một nút chính" trong D6 giữ nguyên.
- `ui041.e2e.py` mục 4 cập nhật theo giao diện mới. Không bài nào khác bị xóa hay vô hiệu hóa.

## Kết quả kiểm thử
- Node: 103 bài cũ (18+18+29+20+18) **đạt** + 19 bài mới = **122/122** (`docs/test-logs/final-node-042.txt`).
- Trình duyệt (Chromium headless, 2D): `ui042` 66 bước đạt; `ui031` 43 đạt; `ui` 17 đạt; `ui041` mục 4 (đã cập nhật) 6 đạt.
- Đo thật (User B, 1440px, cùng phạm vi chữ hiển thị ngay): 0.4.1 = 848 ký tự, 8 thẻ cảnh báo → 0.4.2 = 539 ký tự, 3 dòng. Ảnh trước/sau: `docs/screenshots/warn-0.4.*`.

## Giới hạn còn lại
- **`ui041` (phần ngoài mục 4) và `ui04` chưa chạy lại ở 0.4.2**: chúng cần tải Three.js từ CDN, bị chặn trong môi trường kiểm thử (bản 0.4.1 gốc cũng hỏng y hệt ở đây). Hãy chạy `python tests/ui041.e2e.py http://localhost:8000` và `ui04.e2e.py` với Internet.
- 3D thật, Live Server thật, Netlify, Safari/Firefox và trình đọc màn hình thật **chưa được kiểm chứng**; chưa đo tương phản màu bằng công cụ.
- Mức giảm chữ khoảng 36% trên ca đo; phần lớn lợi ích đến từ giảm số khối (8 → 3 dòng) và độ dài trang, không phải xóa nội dung.
- Lưu ý in trên nhãn sản phẩm (ví dụ "có thể gây châm chích") nay hiện ở dạng nhãn "Lưu ý khi dùng" ở bước và đầy đủ trong chi tiết/thẻ bước, không còn in nguyên văn dưới từng bước. Nếu cần để lộ nguyên văn ở routine, đây là điểm cần quyết định.
- Bộ quy tắc vẫn chỉ minh họa, chưa được chuyên gia kiểm duyệt.

## Hướng dẫn kiểm tra bằng Live Server
1. Mở thư mục `skincare-prototype` trong VS Code → *Open with Live Server* trên `index.html` (hoặc `python -m http.server 8000`).
2. Ctrl+F5. Chọn **User B**, mục tiêu *Chăm sóc da có mụn* + *Chăm sóc da dễ kích ứng* → Tạo routine: thấy một khối "Routine chưa hoàn chỉnh · 6 mục cần xem lại, thuộc 3 nhóm".
3. Bấm **Xem giải thích chi tiết** (hoặc Tab + Enter): lý do đầy đủ, sản phẩm liên quan, cảnh báo gốc. Bấm **Chỉnh sửa sản phẩm** để nhảy tới khu chỉnh sửa.
4. **User A** + *Có mụn*, thêm Retinol (p06) và BHA (p07): dòng "Cần thận trọng khi dùng chung" đỏ, đứng đầu, có tên hai sản phẩm.
5. Bấm một bước → Mô hình 3D: thẻ bên cạnh chỉ có cảnh báo của bước đó.
