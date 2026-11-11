# 0.4.3 — Timeline Refinement

Chỉ đổi **lớp trình bày** của Timeline. Routine Engine, bộ quy tắc, Smart Warning UX (0.4.2), 3D/2D, `manager.js`, `storage.js`, `timeline.js` (logic ngày/lịch sử), nhật ký, ảnh, phiên bản và cơ chế khôi phục **không đổi**: `tests/v043.test.mjs` băm SHA-256 các tệp này so với 0.4.2.

## Vì sao Timeline 0.4.2 khó dùng
- Đoạn "Ngày 0 chỉ dùng để đếm ngày thứ N…" luôn hiện, cùng ô chỉnh ngày, dòng "ngày bắt đầu áp dụng thực tế", thẻ "khác Ngày 0" và dòng nhắc sửa lịch sử.
- Một ngày tương lai hiện ba khối routine cùng lúc ("đang áp dụng hôm nay", "dự kiến", "bản nháp"), cộng thêm nhật ký.
- Danh sách "Lịch sử áp dụng" kèm `ghi lúc …`, ngày ghi gốc, nút "Sửa ngày áp dụng" nằm ngay trên màn hình theo dõi.
- Tiêu đề kỹ thuật ("Ngày 0", "ngày thứ N kể từ Ngày 0").

## Giao diện mới (tab Lộ trình)
1. Tiêu đề **Lộ trình chăm sóc da** + một câu: các mốc chỉ để theo dõi, không dự đoán hiệu quả.
2. **Bốn mốc**: Bắt đầu · Tuần 1 · Tuần 2 · Tuần 4 (= +0/+7/+14/+28 ngày kể từ *ngày bắt đầu theo dõi*), mỗi mốc kèm ngày `dd/mm`; nút `<button>` có `aria-pressed` và nhãn chữ.
3. Ô **Chọn ngày khác** (một dòng gọn).
4. **Ngày đang xem** nêu rõ: thứ, `dd/mm/yyyy`, nhãn *Đã qua / Hôm nay / Sắp tới*, và "N ngày sau/trước ngày bắt đầu".
5. **Một** khối routine tương ứng với ngày đó + khối **Nhật ký ngày này**:
   - Quá khứ: *Routine đã áp dụng* (phiên bản có hiệu lực tại ngày đó). Hôm nay: *Routine đang áp dụng*.
   - Tương lai: *Đã lên lịch áp dụng* (chỉ khi có lịch đã ghi nhận) hoặc *Tham khảo (chưa phải dữ liệu thực tế)* (nếu giữ nguyên routine hiện tại); luôn ghi rõ không phải dữ liệu sử dụng thực tế.
   - Không có lịch sử: câu trống trung thực theo từng loại ngày; không có nhật ký: "Chưa có nhật ký cho ngày này" (không số liệu, không xu hướng).
6. **Bản nháp chưa lưu**: một dòng ngắn khi liên quan (hôm nay/tương lai) kèm liên kết "Mở routine"; không có thẻ routine thứ hai.
7. **Tùy chỉnh mốc theo dõi** (thu gọn): nhãn **Ngày bắt đầu theo dõi**, câu "Đổi mốc theo dõi không thay đổi lịch sử đã lưu.", ngày bắt đầu áp dụng thực tế và, khi khác nhau, thẻ + phần "Vì sao hai ngày này khác nhau?".
8. Khi hai ngày khác nhau, một **lưu ý ngắn luôn hiện** ngoài khu thu gọn, kèm "Xem giải thích" (mở khu Tùy chỉnh và đưa tiêu điểm tới đó). Hệ thống **không** đồng bộ hay ghi đè lịch sử.
9. **Lịch sử áp dụng + "Sửa ngày áp dụng"** chuyển sang tab **Phiên bản** (thu gọn). Vẫn hai bước: mở biểu mẫu (nêu rõ hậu quả) rồi **Xác nhận**; chỉ ghi thêm bản ghi sửa (append-only), thông báo kết quả ngay tại tab đó. Không hiển thị `seq`, `recordedAt`… ở màn hình chính (Timeline chỉ ghi ngắn "ngày áp dụng đã được chỉnh").

Thông báo của Manager/Storage chứa "Ngày 0" được đổi nhãn khi hiển thị thành "Ngày bắt đầu theo dõi" (lớp trình bày; dữ liệu vẫn là `startDate`).

## Đo thực tế (cùng dữ liệu, 1440px, `innerText` toàn khu Timeline)
| Ngày xem | 0.4.2 | 0.4.3 |
|---|---|---|
| Bắt đầu (quá khứ) | 755 ký tự, 546 px | **392 ký tự, 416 px** |
| Tuần 2 (tương lai) | 853 ký tự, 3 khối, 564 px | **533 ký tự, 2 khối, 471 px** |

## Một lỗi tìm thấy khi kiểm thử
Khu "Tùy chỉnh mốc theo dõi" có thể tự đóng sau khi vẽ lại nếu thao tác rất nhanh: sự kiện `toggle` đến sau khi phần tử cũ đã bị thay. Đã sửa bằng cách đọc trạng thái mở trực tiếp từ DOM trước khi vẽ lại; có bài kiểm tra hồi quy ở `ui043`.

## Tệp thay đổi (so với 0.4.2)
`js/timeline-view.js` (mới) · `js/main.js` · `css/style.css` · `index.html` (nhãn phiên bản, tab "Lộ trình") · `package.json` · `README.md` · `tests/v043.test.mjs` (mới) · `tests/ui043.e2e.py` (mới) · `tests/v031.test.mjs` (thêm module mới vào danh sách quét tĩnh) · `tests/ui.e2e.py`, `tests/ui031.e2e.py`, `tests/ui04.e2e.py` (chỉ câu chữ/vị trí Timeline cũ).

## Bài kiểm thử cũ được cập nhật có chủ đích (không xóa/vô hiệu hóa bài nào)
Các bài e2e cũ kiểm tra câu chữ "Ngày 0", "Không đủ dữ liệu", "ngày thứ N kể từ Ngày 0", ngày ISO, và việc "Lịch sử áp dụng"/"Sửa ngày áp dụng" nằm trong Timeline. Giữ nguyên **điều kiện hành vi** (đổi mốc không sửa lịch sử, hủy không ghi, xác nhận mới ghi, trước ngày áp dụng không có routine giả…), chỉ đổi câu chữ/vị trí theo giao diện mới.

## Kết quả kiểm thử
- Node: 103 bài cũ + 19 (0.4.2) đạt, **122/122 không bị sửa logic**, + 23 bài mới = **145/145** (`docs/test-logs/final-node-043.txt`).
- Trình duyệt (Chromium headless, 2D): `ui043` mới **68** đạt · `ui042` 66 · `ui031` 44 · `ui` 17 · `ui041` mục 4 (6) đạt.
- Ảnh kiểm tra mobile/desktop: `docs/screenshots/tl-0.4.3-*`.

## Giới hạn còn lại
- **`ui041` (ngoài mục 4) và `ui04` chưa chạy được ở 0.4.3**: cần tải Three.js từ CDN, bị chặn trong môi trường kiểm thử (bản cũ cũng hỏng y hệt ở đây). `ui04.e2e.py` được sửa một dòng (Test 8) **mà chưa chạy**. Hãy chạy với Internet: `python tests/ui041.e2e.py http://localhost:8000` và `ui04.e2e.py`.
- 3D thật, Live Server thật, Netlify, Safari/Firefox, trình đọc màn hình thật **chưa được kiểm chứng**; chưa đo tương phản màu bằng công cụ. Bố cục Timeline đã xem bằng ảnh chụp Chromium 390/768/1440 px.
- Mốc "Tuần 1/2/4" tính theo ngày bắt đầu theo dõi, không phải theo ngày áp dụng thực tế; khi hai ngày khác nhau, giao diện báo rõ (không tự đồng bộ).
- Ngày tương lai hiển thị "Tham khảo" nếu chưa có lịch: đây là giả định "giữ nguyên routine hiện tại", đã ghi rõ trên giao diện.
- Lưu ý: tab "Phiên bản" nay chứa Lịch sử áp dụng nên dài hơn; thông báo lưu trữ cũ có chứa "Ngày 0" chỉ được đổi nhãn khi hiển thị.
- Bộ quy tắc vẫn chỉ minh họa, chưa được chuyên gia kiểm duyệt.

## Hướng dẫn kiểm tra bằng Live Server
1. Mở thư mục `skincare-prototype` trong VS Code → *Open with Live Server* trên `index.html` (hoặc `python -m http.server 8000`). Ctrl+F5.
2. User A → chọn mục tiêu → **Tạo routine** → **Lưu routine** → **Theo dõi & lịch sử** → tab **Lộ trình**.
3. Bấm lần lượt Bắt đầu / Tuần 1 / Tuần 2 / Tuần 4; thử "Chọn ngày khác" (quá khứ, hôm nay, tương lai).
4. Mở **Tùy chỉnh mốc theo dõi** → đổi ngày bắt đầu theo dõi: thấy lưu ý "khác ngày bắt đầu áp dụng routine" + "Xem giải thích"; lịch sử trong tab Phiên bản không đổi.
5. Tab **Phiên bản** → **Lịch sử áp dụng** → **Sửa ngày áp dụng** → đọc hậu quả → *Hủy* (không đổi) hoặc *Xác nhận*.
6. Dùng Tab/Enter/Space để thao tác các mốc, ô ngày và các khu mở rộng.
