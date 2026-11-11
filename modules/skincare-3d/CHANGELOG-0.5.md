# 0.5 — 3D Experience & Functional Optimization

Nền: 0.4.3 đã duyệt. Không viết lại dự án; Routine Engine, quy tắc, Manager, Storage, Timeline (logic), Journal, html.js, Smart Warning UX (0.4.2), Timeline UX (0.4.3) và viewer 2D **không đổi** (băm SHA-256 trong `tests/v05.test.mjs`). Không triển khai lên Netlify.

## 1. Đánh giá mô hình 3D (bằng ảnh render thật, Three.js r160 + WebGL)
Ảnh: `docs/screenshots/0.5/compare-goc-nhin.png`, `compare-can-canh-vung.png` (trên: 0.4.3, dưới: 0.5), `model-*.png`.

| Hạng mục | 0.4.3 | Quyết định |
|---|---|---|
| Tỷ lệ, trán, mũi, môi, cằm, đường hàm, tai | Cân đối, nhận diện tốt ở chính diện, 45°, nghiêng hai bên | **Giữ nguyên hình học** (không đổi mesh) |
| Bề mặt, pháp tuyến | Mịn, không thấy méo/gãy ở mọi góc và khi phóng to | Giữ nguyên |
| Ánh sáng | Rất phẳng (nền bán cầu 0.62): gò má, hốc mắt, sống mũi khó đọc | **Cân lại** |
| Chiều sâu chi tiết | Không có che khuất môi trường: hốc mắt, cánh mũi, khe môi, tai, dưới cằm phẳng | **Bake AO theo đỉnh** |
| Mắt | Lòng trắng sáng gắt ở khóe → trông như dán lên | Dịu màu + AO |
| Highlight vùng (trán, má, cằm) | Mềm, giữ hình mặt | Giữ nguyên |
| Highlight "toàn mặt" | Mảng xám xanh mép cứng, bị cắt dọc ở thái dương → như mặt nạ | **Làm lại** |
| Hiệu năng | 40 016 tam giác, 3 lệnh vẽ, render theo nhu cầu | Giữ nguyên |

## 2. Cải thiện mô hình 3D
- **AO đã bake vào `assets/head.glb`** (`tools/bake-ao.mjs`, mới): 64 tia/đỉnh, bán kính 0.32, tất định, 7 giây. Chỉ thêm thuộc tính `_AO` cho `skin`/`eyes`. Hình học, mốc giải phẫu, bản quyền CC0 **giống hệt** 0.4.3 (kiểm chứng bằng băm). GLB 733 KB → 814 KB (≤ 1 MB). `viewer2d.js` sinh lại từ GLB mới **giống từng byte** → 2D vẫn đồng bộ.
- **Ánh sáng studio** (`LIGHTS` trong `js/view3d-math.js`): nền bán cầu 0.62 → 0.34, đèn chính lệch bên hơn (3.4), đèn phụ nhẹ, đèn viền giữ. Không bóng đổ, không hậu xử lý.
- **Màu**: AO nhân vào màu đỉnh (`AO_K`), lòng trắng mắt dịu hơn; mống mắt/đồng tử giữ nguyên. Vật liệu vẫn mờ (roughness 0.74, không kim loại).
- **"Toàn mặt"**: màu nhạt riêng (`PALETTE.face`), tối đa 18%, mép mềm hơn nhưng ngưỡng 0.5 không đổi (khớp 2D), phủ cả thái dương/hai bên má, giữ được bóng AO.
  *Đánh giá trung thực:* đã hết cảm giác "mặt nạ xám", nhưng đây vẫn là một lớp phủ nhạt; lựa chọn được nói rõ thêm bằng dòng trạng thái dưới mô hình.

## 3. Tương tác 3D
- **Sửa lỗi có sẵn từ 0.4.x**: kéo xoay mạnh tới giới hạn rồi bấm "Đặt lại góc nhìn" → camera không về đúng chính diện (0.4.3 đo được lệch az −0.074, polar 1.584). Nguyên nhân: quán tính OrbitControls bị "giữ" khi camera đứng ở giới hạn. 0.5 xả quán tính trước mọi chuyển động có chủ đích (`flushInertia`).
- Đã kiểm chứng bằng 3D thật: kéo bắt đầu trên má **không** chọn vùng; nhấp chọn đúng trán/má trái/má phải/cằm; giới hạn zoom/xoay; đứng yên không có vòng render; 3D↔2D 10 lần vẫn 1 canvas, không tăng tài nguyên. API `Viewer3D` giữ nguyên (thêm `flushInertia`).

## 4. Luồng khách hàng & bất đồng bộ
- **Race 3D↔2D** (lỗi có sẵn): bấm "2D" khi 3D đang tải → tải xong ghi đè thành 3D. Nay mỗi yêu cầu có mã (`S.modeTok`); phản hồi cũ bị bỏ.
- **Race ảnh nhật ký** (lỗi có sẵn): Timeline có thể hiện ảnh của ngày chọn trước đó (0.4.3: hiện ảnh 30×20 thay vì 64×48 trong kiểm thử). Nay chỉ hiển thị nếu đúng tài khoản + **ngày** + lần tải mới nhất; nút "xem ảnh" ở Nhật ký cũng vậy.
- **Phản hồi chọn bước/vùng**: dòng ngay dưới mô hình nói "Đang xem: Buổi sáng · Serum – toàn khuôn mặt" / "Đang xem vùng: Má trái – N bước" (thấy ngay trên điện thoại khi thẻ thông tin ở dưới).
- **Hành động tiếp theo ở bước Mô hình**: chưa lưu → "Quay lại routine để lưu"; đã lưu → "Theo dõi & lịch sử". Không thêm nút "Lưu" thứ hai.
- **Lỗi 3D**: câu ngắn nêu nguyên nhân ("không tải được thư viện 3D (cần kết nối Internet)", "không hỗ trợ WebGL"…) + "Đã chuyển sang chế độ 2D"; thông điệp gốc (URL…) trong "Chi tiết kỹ thuật".
- **Lưu ý in trên nhãn sản phẩm** (vd. "Có thể gây khô hoặc châm chích") hiện lại nguyên văn trong dòng bước Routine như 0.4.1. 0.4.2 đã chuyển chúng vào phần thu gọn; `tests/ui04.e2e.py` Test 4 (chưa từng chạy được từ 0.4.2 vì thiếu Three.js) phát hiện điều này. Sửa ở sản phẩm, **không** sửa bài kiểm thử.

## 5. Tệp thay đổi (so với 0.4.3)
`assets/head.glb` (thêm `_AO`) · `assets/head.LICENSE.md` (mục 7) · `tools/bake-ao.mjs` (mới) · `js/head-model.js` · `js/view3d-math.js` · `js/viewer3d.js` · `js/main.js` · `css/style.css` · `index.html` (`#modelNext`, nhãn phiên bản) · `package.json` · `DESIGN-NOTES.md` (mới) · `tests/v05.test.mjs`, `tests/ui05.e2e.py` (mới) · `tests/v042.test.mjs`, `tests/v043.test.mjs` (xem mục 6).

## 6. Bài kiểm thử cũ được chỉnh
Chỉ một loại: bài 0 của `v042`/`v043` ghim băm các tệp "bản đó không được sửa". 0.5 được giao sửa 3D nên **gỡ đúng** `viewer3d.js`, `head-model.js`, `view3d-math.js`, `assets/head.glb` khỏi hai danh sách (có ghi chú); các tệp còn lại vẫn ghim; hình học GLB được ghim lại ở `v05`. Không bài chức năng nào bị sửa hay vô hiệu hóa.

## 7. Kết quả kiểm thử (đã chạy thực tế, Chromium headless + SwiftShader WebGL, Three.js r160 cục bộ)
- Node: **164/164** = 145 bài của 0.4.3 + 19 bài mới (`docs/test-logs/final-node-05.txt`).
- Trình duyệt (3D thật): `ui05` 44 (mới) · `ui04` **72** · `ui041` **63** · `ui042` 66 · `ui043` 68 · `ui031` 44 · `ui` 17 → 374 bước, đều đạt (`docs/test-logs/final-*-05.txt`).
- Lần đầu từ 0.4.2, `ui04` và `ui041` chạy được với 3D thật (trước đây CDN bị chặn).
- Hai bài race của `ui05` đã được chạy trên 0.4.3 và **thất bại** ở đó → kiểm thử thực sự phát hiện lỗi.

## 8. Giới hạn còn lại
- WebGL trong kiểm thử là SwiftShader (phần mềm); **chưa thử trên GPU thật, Safari/Firefox, thiết bị di động thật, Live Server thật hay Netlify**. Chưa đo FPS trên thiết bị yếu.
- Three.js vẫn tải từ jsDelivr khi vào bước Mô hình (môi trường thật cần Internet); kiểm thử dùng bản r160 lấy từ kho GitHub chính thức, không đóng gói vào dự án.
- Mô hình vẫn là tượng bán thân trung tính, không tóc, phong cách tượng; không có texture da. Đây là chủ đích (không mô phỏng da thật/hiệu quả).
- Lớp "toàn mặt" vẫn là lớp phủ nhạt (xem mục 2).
- Bộ quy tắc skincare vẫn chỉ minh họa, chưa được chuyên gia kiểm duyệt.

## 9. Chạy bằng Live Server
1. VS Code → mở thư mục `skincare-prototype` → *Open with Live Server* trên `index.html` (hoặc `python -m http.server 8000`). Không mở bằng `file://`. Ctrl+F5.
2. Cần Internet cho bước Mô hình 3D (Three.js); mất mạng → tự chuyển 2D.
3. Kiểm thử: `npm test`; giao diện: `python tests/ui05.e2e.py http://localhost:8000` (thêm `--three-dir=<three.js r160>` nếu không có Internet; `SHOTS=<thư mục>` để lưu ảnh mô hình).
4. Dựng lại AO (chỉ khi dựng lại mô hình từ `base.obj`): `node tools/build-head.mjs …` → `node tools/bake-ao.mjs` → `npm run gen:face2d -- --write`.
