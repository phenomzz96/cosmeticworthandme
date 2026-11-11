# Ghi chú cho tổ design (0.5)

Mục tiêu: tổ design đổi được giao diện mà không làm hỏng logic. Routine Engine (`js/engine.js`, `js/rules.js`) **không phụ thuộc** màu, thẻ hay cấu trúc HTML: nó chỉ trả dữ liệu. Toàn bộ HTML được dựng trong `js/main.js`, `js/warnings-view.js`, `js/timeline-view.js` bằng `html\`…\`` (tự escape).

## 1. Đổi thoải mái (an toàn)

| Phần | Ở đâu | Ghi chú |
|---|---|---|
| Màu, chữ, bo góc, bóng, khoảng cách | biến CSS trong `:root` ở đầu `css/style.css` (`--acc`, `--ink`, `--surface`, `--r`, `--font`…) | Đổi biến trước; các khối dùng lại biến. |
| Bố cục từng khu | `css/style.css`, chia mục: Nút · Header · Thông báo · Trang chủ · Thanh 3 bước · Khung giai đoạn · Routine · Mô hình 3D · 2D · Theo dõi & lịch sử · Responsive | Không có style inline trong JS (có kiểm thử chặn). |
| Trạng thái giao diện | lớp CSS: `.sel`, `.rel` (bước/vùng đang chọn, liên quan), `.on` (`.stage-hint.on` = đang xem bước/vùng), `[aria-pressed="true"]`, `[hidden]`, `.tag.ok/.warn/.danger/.info/.neutral`, `.alert.*`, `.wl.danger/.warn` (dòng tóm tắt cảnh báo), `.tlbox.past/.now/.plan/.ref/.none` (Timeline) | Chỉ đổi hình thức; giữ tên lớp. |
| Màu da/nhấn trên mô hình 3D | `PALETTE` trong `js/head-model.js` (`skin`, `lip`, `hl` = vùng đang chọn, `hover`, `face` = bước "toàn mặt") | Màu sRGB 0..1. Mức phủ tối đa (55% vùng, 30% toàn mặt) có kiểm thử giữ "nhẹ, không chói". |
| Ánh sáng 3D | `LIGHTS` trong `js/view3d-math.js` | Dữ liệu thuần. Muốn giữ hình khối rõ: nền bán cầu ≤ ~0.45, đèn chính lệch bên. |
| Mắt | `EYE` trong `js/head-model.js` | Lòng trắng nên < 0.9 để không gắt. |

## 2. Giữ nguyên (logic phụ thuộc)

- **`id` trong `index.html`** mà JS dùng: `userSel, storage, home, feature, stepper, trackBtn, devbar, simBtn, perfBtn, quiz, analysisBox, analysis, routine, studio, viewerCard, moreCtl, zonebar, notice, perfHint, v3d, v2d, stageHint, perf, stepPick, info, modelNext, journal, timeline, versions, devBtn`. Có thể bọc thêm thẻ, đổi vị trí; không đổi tên hay xóa.
- **Thuộc tính điều khiển**: `data-act` (add, clearsel, day, devmode, edel, fix, fixno, fixok, flashx, jsave, mode, openedit, opentl, pdel, perf, preset, pview, quiz, regen, rep, reset, restore, retry, rm, save, sim, slowx, stage, step, tab, view, zone, zoom) cùng `data-id`, `data-s`, `data-t`, `data-v`, `data-m`, `data-p`, `data-f`, `data-z`, `data-n`, `data-d`, `data-seq`. Mọi `data-act` phải có xử lý (kiểm thử D4).
- **`id` của các `<details>`** (`saveOpts, routineMore, editBox, warnMore, tlCustom, tlWhy, infoMore, analysisBox, moreCtl`): dùng để nhớ trạng thái mở/đóng khi vẽ lại.
- **Khung mô hình**: `.stage-wrap > #v3d.stage + #v2d.stage`. Canvas WebGL tự tạo trong `#v3d` và co giãn theo khung (ResizeObserver). Có thể đổi kích thước/tỉ lệ khung bằng CSS; không đặt phần tử phủ lên canvas (chặn thao tác xoay/chọn).
- **Quy tắc an toàn HTML**: chỉ chèn nội dung bằng `html\`…\`` + `setHtml()`; không dùng `innerHTML` trực tiếp, không handler inline (`onclick=…`), không chèn giá trị vào `style=`/`href=`/`src=` (html.js sẽ báo lỗi).
- **Một nút chính mỗi giai đoạn**, **một nút "Lưu routine"** (kiểm thử D6). Bước Mô hình dùng nút thường ("Quay lại routine để lưu" / "Theo dõi & lịch sử").
- **Câu chữ có kiểm thử**: một số câu (vd. "Đã chuyển sang chế độ 2D", "Đổi mốc theo dõi không thay đổi lịch sử đã lưu.", nhãn cảnh báo, câu trống trung thực của Timeline) được kiểm thử vì liên quan độ trung thực/an toàn. Đổi câu chữ → chạy `npm test` và các `tests/ui*.e2e.py`, cập nhật kiểm thử có ghi lý do.

## 3. Trợ năng tối thiểu cần giữ
Nút thật (`<button>`) cho thao tác; `aria-pressed` cho lựa chọn; `aria-live` ở `#info`; `role="alert"` ở `#notice`; vùng chạm ≥ 44 px (`--tap`); không chỉ dựa vào màu (cảnh báo luôn có icon + nhãn chữ); tôn trọng `prefers-reduced-motion` (camera và highlight chuyển tức thì).

## 4. Không làm
Không thêm font/thư viện/script ngoài, tracking hay backend. Three.js 0.160.0 hiện tải từ jsDelivr khi vào bước Mô hình; khi tích hợp thật nên đóng gói (bundle) thay vì CDN.

## 5. Bổ sung 0.5.1 – mô hình nhân vật
- **Đổi thoải mái (chỉ cần render lại để duyệt):**
  - Thông số vật liệu `MATS` trong `js/viewer3d.js`: da, tóc, lớp tóc tơ, lông mày/mi.
  - Màu mống mắt `iIn`/`iOut` trong shader mắt.
  - `LIGHTS` trong `js/view3d-math.js`.
  - Sắc da (`PALETTE`, `WARM`, `ROSY`) và màu môi trong `js/head-model.js`.
- **Đổi qua công cụ dựng, không sửa tay GLB:**
  - Màu tóc (`BASE_COL`), đường chân tóc (`HL`), số lọn, búi, lông mày, lông mi: `tools/build-hair.mjs`.
  - Hình dáng mặt: `tools/head-recipe.json`.
  - Sau khi sửa, chạy `npm run build:model -- <makehuman/data>`. Lệnh này sinh lại cả GLB lẫn sơ đồ 2D; cập nhật băm trong `tests/v051.test.mjs`.
- **Giữ nguyên:**
  - Khi đổi kiểu tóc, chân tóc phải nằm trên vùng "Trán" (kiểm thử 1e/3b).
  - Tóc không được che má, cằm, tai.
  - Phản xạ tóc giữ thấp (`specularIntensity` ≤ 0,2) để không lộ lọn nhân tạo.
  - Không thêm texture: kiểm thử ghim "0 texture" (dung lượng, tải nhanh).
