# Prototype Skincare 3D – "Kiến trúc sư chu trình Skincare"

## Chạy bằng VS Code
1. Mở thư mục `skincare-prototype` trong VS Code.
2. Cài extension **Live Server**, chuột phải `index.html` → *Open with Live Server*. (Hoặc: `python -m http.server 8000` rồi mở http://localhost:8000). Không mở bằng `file://` vì ES modules cần HTTP.
3. **Phụ thuộc Internet:** chỉ Three.js 0.160.0 (jsDelivr) cho chế độ 3D (kèm bộ giải nén meshopt của chính gói Three.js – 0.5.1), chỉ tải khi vào bước **Mô hình 3D**. Mô hình đầu (`assets/head.glb`, ≈ 1,5 MB, CC0 + tóc tự dựng) nằm sẵn trong dự án. Mất mạng → báo rõ và tự chuyển 2D; mọi chức năng khác vẫn chạy.
4. Công cụ kiểm thử (giả lập lỗi 3D, số liệu hiệu năng) nằm sau nút **Developer mode** ở chân trang (tắt mặc định). Thêm `?dev` vào cuối địa chỉ (vd. `http://127.0.0.1:5500/?dev`) để bật sẵn chế độ này và móc `window.__skc` cho kiểm thử tự động.

## Cấu trúc
- `js/data.js` dữ liệu giả lập (sản phẩm, 2 user, quiz); `js/storage.js` lưu trữ localStorage theo `userId`, chuyển đổi dữ liệu, xử lý lỗi lưu trữ
- `js/rules.js` bộ quy tắc minh họa (tách riêng, thay được bằng bộ đã kiểm duyệt)
- `js/engine.js` Routine Engine (phân loại, sắp bước, trùng chức năng, tổ hợp thận trọng, thiếu dữ liệu)
- `js/manager.js` Routine Manager (thêm/bỏ/thay, phiên bản, khôi phục)
- `js/viewer3d.js` (Three.js, render theo nhu cầu, dispose/khởi tạo lại), `js/viewer2d.js` (SVG sinh từ hình học 3D) – cùng giao diện `highlight/onPick`
- `assets/head.glb` mô hình tượng bán thân (MakeHuman, CC0 – xem `assets/head.LICENSE.md`); `js/head-model.js` vùng da, highlight, màu mắt, đọc GLB (thuần, test bằng Node); `js/view3d-math.js` camera/cử chỉ/đo hiệu năng; `js/selection.js` đồng bộ bước ↔ vùng; `js/icons.js` icon và hình minh họa SVG
- `tools/build-head.mjs` dựng lại `assets/head.glb` từ `base.obj` của MakeHuman (`npm run build:head -- <base.obj>`); `tools/gen-face2d.mjs` sinh lại `js/viewer2d.js` từ chính GLB (`npm run gen:face2d -- --write`)
- `js/timeline.js` logic timeline thuần (ngày, routine có hiệu lực, sửa ngày áp dụng)
- `js/warnings-view.js` (0.4.2) lớp trình bày cảnh báo: nhóm cảnh báo gốc của Engine (A–D, O, R), dựng khối tóm tắt, chi tiết và nhãn bước; không sửa Engine. Xem `CHANGELOG-0.4.2.md`
- `tools/bake-ao.mjs` (0.5) bake che khuất môi trường theo đỉnh vào `assets/head.glb` (không đổi hình học); `LIGHTS` (ánh sáng) trong `js/view3d-math.js`, `PALETTE`/`AO_K` trong `js/head-model.js`. Xem `CHANGELOG-0.5.md`; ghi chú cho tổ design: `DESIGN-NOTES.md`
- (0.5.1) Mô hình mới: hình dáng bằng morph target MakeHuman CC0 (`tools/apply-targets.mjs` + `tools/head-recipe.json`), tóc/lông mày/mi tự dựng (`tools/build-hair.mjs`), tối ưu GLB (`tools/optimize-glb.mjs`, bộ mã hóa meshoptimizer MIT trong `tools/vendor/`). Dựng lại tất cả: `npm run build:model -- <makehuman/data>`. Vật liệu `MATS` + shader mắt trong `js/viewer3d.js`. Xem `CHANGELOG-0.5.1.md`, ảnh `docs/screenshots/0.5.1/`
- `js/timeline-view.js` (0.4.3) lớp trình bày Timeline: 4 mốc, mô hình hiển thị cho MỘT ngày được chọn, khu "Tùy chỉnh mốc theo dõi"; không sửa logic ngày/lịch sử. Xem `CHANGELOG-0.4.3.md`
- `js/html.js` dựng HTML an toàn (`html\`…\``, `setHtml`)
- `js/journal.js` ảnh IndexedDB + biểu đồ SVG; `js/main.js` UI, quiz, timeline

## Kiểm thử thủ công (0.4.1: bước 1 chọn ít nhất 1 mục tiêu → "Tạo routine của tôi")
1. **Bình thường:** User A + mục tiêu *Cấp ẩm* → trạng thái `ready`, không cảnh báo.
2. **Trùng lặp:** User B → 2 sữa rửa mặt và 2 kem dưỡng cùng bước (hệ thống chọn theo điểm và giải thích). Thêm mục tiêu *Kiểm soát dầu* để thấy cảnh báo chồng chéo giữa serum và kem dưỡng (cùng niacinamide).
3. **Thận trọng:** User A, bấm "Thêm sản phẩm" Retinol (p06) và BHA (p07), chọn mục tiêu *Chăm sóc da có mụn* → trạng thái `review`. Với mục tiêu chỉ *Cấp ẩm*, hai sản phẩm này không vào routine nên không có cảnh báo.
4. **Thiếu dữ liệu:** User B → "Kem Glow Mystery" không được phân loại.
5. **Chỉnh sửa:** Bỏ/Thay sản phẩm → cảnh báo tính lại → "Lưu routine" → xem/khôi phục phiên bản.
6. **3D:** ở bước "Mô hình 3D": kéo để xoay, cuộn/chụm để zoom, bấm Trán/Má/Cằm trên mô hình, bấm từng bước routine (góc nghiêng, nút zoom, chọn vùng bằng nút nằm trong "Thêm điều khiển").
7. **Lỗi 3D:** bật "Developer mode" (chân trang) → "Giả lập lỗi 3D" khi đang ở 3D (chuyển 2D sau 1 khung hình) hoặc khi đang ở 2D rồi bấm 3D.
8. **Tách tài khoản:** tạo routine cho A, đổi sang B.
9. **Nhật ký:** "Theo dõi & lịch sử" → tab Nhật ký: nhập vài ngày (đổi ô Ngày), bỏ trống ngày khác; tab Timeline: chọn mốc.
10. **Lưu trữ:** F5 – quiz, routine, phiên bản, nhật ký, ảnh vẫn còn.

## Giới hạn
Đã kiểm thử tự động trên Chromium headless với WebGL phần mềm (SwiftShader, Three.js r160 cục bộ); GPU thật, Live Server thật, Netlify, Safari/iOS và Firefox chưa được kiểm chứng (giới hạn mô hình 0.5.1: xem `CHANGELOG-0.5.1.md`); chưa có giám sát FPS; mốc timeline hiển thị phiên bản có hiệu lực theo ngày (chưa có cấu hình bước theo giai đoạn); `zones` trong dữ liệu là metadata minh họa; quy tắc chưa được chuyên gia kiểm duyệt; tài khoản chỉ mô phỏng, không phải bảo mật.

## Khi tích hợp thật
Thay `PRODUCTS/USERS/store` trong `data.js` bằng API; thay `rules.js` bằng bộ quy tắc đã duyệt; lưu nhật ký/ảnh lên backend có xác thực và đồng ý của người dùng; bundle Three.js thay vì CDN; kiểm thử trên nhiều thiết bị.

## Cập nhật giai đoạn 1 (DEMO-0.2): cá nhân hóa theo quiz
- Mục tiêu ảnh hưởng tới **lựa chọn** (toner/serum/sản phẩm chuyên biệt chỉ vào routine khi khai báo chức năng khớp mục tiêu; bước nền tảng luôn được xét) và **thứ tự** (điểm = trọng số mục tiêu + 0,5 nếu khớp tham chiếu loại da; hòa điểm → theo mã sản phẩm).
- Loại da tự đánh giá chỉ là tham chiếu xếp hạng, không phải chẩn đoán.
- Báo cáo từng mục tiêu (đáp ứng / chưa đáp ứng + nguyên nhân) và danh sách "Sản phẩm chưa xếp vào routine" kèm lý do.
- Trạng thái: `insufficient` > `incomplete` > `unmet` > `review` > `partial` > `ready`. Cảnh báo thận trọng, xung đột với mục tiêu và trùng/chồng chéo đều đưa trạng thái về `review`.
- Quy tắc nằm riêng trong `js/rules.js`; chỉ minh họa, chưa được chuyên gia kiểm duyệt.

## Kiểm thử (0.5.1)
`npm test` (Node 18+): 181 bài (gồm `tests/v051.test.mjs`); giao diện 3D thật (8 bộ, 403 bài): `python tests/ui051.e2e.py http://localhost:8000 [--three-dir=…]` (đặt `SHOTS=<thư mục>` để xuất ảnh mô hình) và `ui05.e2e.py`. Trước đây (0.5): 164 bài. Trước đây (0.4.3): 145 bài (`tests/v042.test.mjs` nhóm cảnh báo, `tests/v043.test.mjs` Timeline). Giao diện: `python tests/ui043.e2e.py http://localhost:8000` và `ui042.e2e.py` (Playwright; thêm `--three-dir=…` cho các bộ cần Three.js).

## Kiểm thử Engine
`node tests/engine.test.mjs` (Node 18+, không cần cài gói).

## Nâng cấp từ bản cũ
Chép đè các file đã đổi và thêm `package.json`, `tests/`. Nhấn Ctrl+F5. Dữ liệu cũ trong trình duyệt vẫn dùng được; nếu User B chưa thấy sản phẩm mới (p12), bấm "Tạo lại từ sản phẩm đã mua".

## Phiên bản 0.3: quản lý phiên bản routine và timeline
**Nguyên nhân lỗi ở 0.2:** phiên bản chỉ lưu `selection`; khôi phục giữ quiz hiện tại nên routine tính lại sai; "chưa lưu" chỉ so sánh sản phẩm; timeline luôn dùng routine mới nhất; `today()` dùng ngày UTC.

**Cấu trúc dữ liệu (schema 3, khóa `skc:<userId>`):**
- `versions[]`: `id` (gồm userId), `n`, `createdAt`, `quiz` (mục tiêu + loại da), `quizKnown`, `selection`, `rulesVersion`, `snapshot` (ảnh chụp routine lúc lưu), `note`, `change`, `appliedFrom`, `basisId`, `legacy` (chỉ có ở dữ liệu chuyển từ 0.2, liệt kê trường không có dữ liệu).
- `applications[]` (chỉ thêm, không sửa): `{versionId, from, recordedAt, kind: 'save'|'restore'}`. Routine có hiệu lực tại ngày D = bản ghi cuối có `from ≤ D`.
- `basisId`: phiên bản đang nạp, dùng để xác định "chưa lưu".

**File mới/đổi:** `js/storage.js` (mới), `js/timeline.js` (mới), `js/manager.js` (viết lại), `js/main.js`, `js/data.js`, `css/style.css`, `tests/manager.test.mjs`, `tests/ui.e2e.py`, `package.json`. Không đổi: Engine, bộ quy tắc, 3D/2D, nhật ký, biểu đồ, HTML.

**Cập nhật dự án 0.2:** chép đè/thêm các file trên (hoặc giải nén zip đè lên). Lần mở đầu tiên, dữ liệu 0.2 của từng tài khoản được chuyển đổi tự động; bản gốc giữ nguyên văn ở khóa `skc:<userId>:backup-0.2`.

**Kiểm thử:** `npm test` (= 18 test Engine + 18 test Manager/timeline/chuyển đổi, Node 18+). Tùy chọn: `python tests/ui.e2e.py http://localhost:8000` (cần Playwright).

**Giới hạn 0.3:** prototype chỉ có một bộ quy tắc nên phiên bản tạo bằng bộ quy tắc khác được tính lại bằng bộ hiện tại (có thông báo); timeline hiển thị ảnh chụp routine lúc lưu, không tính lại; nhật ký không được gắn với phiên bản (chỉ hiển thị cạnh nhau theo ngày); lịch sử áp dụng không cho ghi ngày sớm hơn lần áp dụng gần nhất.

## Phiên bản 0.3.1: ổn định, toàn vẹn dữ liệu, bảo mật
Chi tiết đầy đủ: `CHANGELOG-0.3.1.md`.
- **Ngày:** `isDate` xác thực đúng lịch Gregorian (năm nhuận, ngày không tồn tại, ký tự thừa, sai kiểu); không phụ thuộc múi giờ.
- **Ngày 0 ≠ ngày áp dụng:** Ngày 0 chỉ là mốc đếm ngày; đổi Ngày 0 không đổi lịch sử, phiên bản, nhật ký. "Sửa ngày áp dụng" là thao tác riêng, có bước xác nhận, chỉ GHI THÊM bản ghi vào `corrections[]` (bản ghi gốc giữ nguyên).
- **XSS:** mọi nội dung động dựng bằng `html\`…\`` (tự escape, chặn chèn vào ngữ cảnh nguy hiểm) và gán qua `setHtml()`; ảnh dựng bằng DOM, URL chỉ cho phép `blob:`.
- **Lưu trữ:** lỗi localStorage (bị chặn, không đọc/ghi được, đầy, JSON hỏng, sai cấu trúc, schema mới hơn) không làm sập trang; dữ liệu cũ không bị ghi đè khi chưa đọc/sao lưu được; khi không lưu bền vững được, dữ liệu giữ tạm trong phiên (tách theo tài khoản) và có banner + nút "Thử lưu lại".
- **Dữ liệu:** vẫn schema 3; thêm trường tùy chọn `corrections` (mặc định `[]`), dữ liệu 0.3 mở được ngay, không cần chuyển đổi.

**Cập nhật từ 0.3:** giải nén zip 0.3.1 đè lên thư mục cũ (hoặc dùng thư mục mới), mở lại bằng Live Server, nhấn Ctrl+F5. Dữ liệu trong trình duyệt được giữ nguyên.

**Kiểm thử:** `npm test` (18 Engine + 18 Manager + 29 bài 0.3.1). Tùy chọn (cần Playwright): `python tests/ui.e2e.py <url>` (17) và `python tests/ui031.e2e.py <url>` (43; thêm `--live` khi chạy với `tests/serve_like_live_server.py`).

## Phiên bản 0.4: mô hình 3D nâng cấp và giao diện mới
Chi tiết đầy đủ: `CHANGELOG-0.4.md`.
- **Mô hình 3D stylized** dựng procedural trong `js/face3d.js` (không tải mô hình ngoài, không có vấn đề giấy phép): hộp sọ, trán, hốc mắt, gò mày, sống/đầu/cánh mũi, gò má, môi, cằm, đường hàm, tai, cổ–vai; mắt nhắm, lông mày, đường môi là dải mỏng trên bề mặt. Đây vẫn là mô hình minh họa, KHÔNG phải mô hình chân thực.
- **Vùng da trên bề mặt** (màu đỉnh + viền mảnh), không còn khối lơ lửng; chọn vùng = raycast vào tam giác thật; nhấp/chạm ≠ kéo/vuốt/chụm.
- **Camera**: góc nhìn sẵn (chính diện, má trái, má phải), chuyển động mượt (tắt khi hệ điều hành bật giảm chuyển động), giới hạn zoom/góc, tự khớp khung khi đổi kích thước.
- **Hiệu năng**: chỉ render khi có thay đổi; dừng khi tab ẩn, khi ở 2D hoặc ở trang Cửa hàng; dispose giải phóng đủ tài nguyên; chế độ "Hiệu năng (dev)" tắt mặc định.
- **Giao diện mới**: cửa hàng mẫu, thanh tiến trình theo vị trí cuộn, routine dạng thẻ, studio mô hình 2 cột, cảnh báo có icon + nhãn chữ, timeline dạng trục, nhật ký dễ nhập; responsive 1440/1024/768/390 px.
- **Không đổi**: Routine Engine, bộ quy tắc, Storage, Timeline, Manager, dữ liệu mẫu; dữ liệu 0.3.1 dùng được ngay (không chuyển đổi).

**Kiểm thử:** `npm test` (18 Engine + 18 Manager + 29 bài 0.3.1 + 20 bài 0.4). Giao diện (cần Playwright): `python tests/ui.e2e.py <url>` (17), `python tests/ui031.e2e.py <url>` (43), `python tests/ui04.e2e.py <url>` (72, 3D thật; thêm `--three-dir=…` nếu môi trường chặn CDN).

**Cập nhật website Netlify:** Netlify → Sites → chọn site → Deploys → kéo thả thư mục `skincare-prototype` đã giải nén (không có bước build). Sau khi deploy, mở trang và nhấn Ctrl+F5. Nếu site nối với Git: commit toàn bộ thư mục và push. Thư mục `tests/`, `tools/` có thể giữ nguyên (không ảnh hưởng trang).


## Phiên bản 0.4.1: mô hình đầu mới + giao diện 3 bước
Chi tiết đầy đủ (nguyên nhân, phương pháp, đánh đổi, danh sách file, kết quả kiểm thử, giới hạn): `CHANGELOG-0.4.1.md`.
- **Mô hình 3D mới:** thay khối cầu bị biến dạng (procedural, `face3d.js` – đã gỡ) bằng tượng bán thân dựng từ lưới gốc MakeHuman
  (CC0 1.0, đóng gói trong `assets/head.glb`, 716 KB). Mắt tô nhẹ kiểu tượng, vật liệu mờ, ánh sáng studio dịu.
- **Vùng da mới:** vùng trán/má/cằm được thiết kế lại cho lưới mới (elip trên mặt phẳng nhìn thẳng × mặt nạ hướng ra trước);
  không viền khi chưa chọn; chọn vùng → một lớp phủ mềm duy nhất; bước "toàn mặt" → một lớp phủ đều, nhẹ.
- **Luồng 3 bước:** Mục tiêu → Routine → Mô hình 3D, mỗi màn hình một nút chính. Nhật ký, timeline, phiên bản nằm trong
  "Theo dõi & lịch sử" (3 tab). Phân tích sản phẩm, lý do loại sản phẩm, giải thích quy tắc, chỉnh sửa, tùy chọn lưu nằm trong
  phần mở rộng. Cảnh báo quan trọng và lưu ý in trên sản phẩm luôn hiện.
- **Điều khiển mô hình:** mặc định chỉ 3D/2D, Đặt lại góc nhìn, danh sách bước; góc nghiêng, zoom, chọn vùng bằng nút nằm trong
  "Thêm điều khiển". Công cụ developer nằm sau "Developer mode" (tắt mặc định).
- **Không đổi:** Engine, bộ quy tắc, Manager, Storage, Timeline, Journal, định dạng dữ liệu (schema 3), cơ chế dự phòng 2D, bảo mật 0.3.1.

**Cập nhật từ 0.4:** giải nén zip 0.4.1 vào thư mục mới (khuyến nghị) hoặc chép đè rồi **xóa `js/face3d.js`**; mở bằng Live Server,
nhấn Ctrl+F5. Dữ liệu trong trình duyệt giữ nguyên.

**Kiểm thử:** `npm test` (18 Engine + 18 Manager + 29 bài 0.3.1 + 20 bài 0.4 + 18 bài 0.4.1 = 103). Giao diện (cần Playwright):
`python tests/ui.e2e.py <url>` (17), `python tests/ui031.e2e.py <url>` (43, +1 với `--live`), `python tests/ui04.e2e.py <url>` (72),
`python tests/ui041.e2e.py <url>` (63). Hai bài cuối cần 3D thật: thêm `--three-dir=…` nếu môi trường chặn CDN.
