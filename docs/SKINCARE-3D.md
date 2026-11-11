# Skincare Architect 3D (tính năng chuyên biệt)

Module do nhóm Skincare Architect phát triển (gói bàn giao v1.0.2). Website **chỉ nhúng**, không sửa code bên trong module.

## Nằm ở đâu

| Đường dẫn | Nội dung |
|---|---|
| `modules/skincare-3d/` | Toàn bộ gói bàn giao, giữ nguyên: mã nguồn, mô hình `assets/head.glb`, tài liệu (`README.md`, `HANDOFF-README.md`, `docs/integration.md`), kiểm thử, công cụ dựng mô hình (Blender) |
| `scripts/copy-skincare-3d.mjs` | Tự chạy trước `npm run dev` / `npm run build`: chép `index.html`, `css/`, `js/`, `assets/` sang `public/skincare-3d/` (thư mục tự sinh, không đưa lên GitHub) |
| `src/pages/SkincareArchitectPage.tsx` | Trang `/skincare-architect` của website: nhúng module bằng iframe |

Module chạy tại `/skincare-3d/index.html`; trang website mở ở `/skincare-architect` (liên kết ở chân trang, menu điện thoại, khối Beauty Finder trên trang chủ).

## Cách nhúng

Theo đúng `modules/skincare-3d/docs/integration.md`:
- iframe cùng tên miền với website, có `?hostOrigin=<tên miền website>`.
- Trang website chờ sự kiện `skincare:ready` rồi mới ẩn khung chờ; chỉ nhận tin từ đúng iframe và đúng tên miền.
- **Chưa đồng bộ dữ liệu** (`skincare:sync`): sản phẩm của sàn chưa có các trường module cần (`functions`, `recommendedPeriod`, `zones`...). Module được thiết kế không tự đoán dữ liệu thiếu, nên chưa bật. Khi hai nhóm thống nhất cách người bán nhập các trường này, chỉ cần gửi `skincare:sync` sau `skincare:ready` (ví dụ: `modules/skincare-3d/examples/host-page-integration.html`).

## Cập nhật phiên bản mới của module

Xóa thư mục `modules/skincare-3d/`, giải nén gói mới vào đúng chỗ đó, chạy `npm.cmd run dev` để kiểm tra, rồi tạo Pull Request như bình thường.

## Lưu ý cho nhóm 3D (phát hiện khi tích hợp, chưa sửa vì là code của nhóm 3D)

- Module vẫn hiện thương hiệu giả lập **"Lumière Skin"** và sản phẩm, tài khoản mẫu riêng; chưa dùng tên, màu của Worth & Me.
- Three.js 0.160.0 tải từ jsDelivr khi mở bước "Mô hình 3D". Không tải được (mất mạng, mạng chặn CDN) thì module tự chuyển sang sơ đồ 2D. Đã kiểm tra trường hợp chuyển 2D; mô hình 3D thật chưa kiểm tra được trong môi trường của Claude (CDN bị chặn).
- Chu trình, nhật ký, ảnh lưu trong trình duyệt (localStorage/IndexedDB), không lên Supabase.
- `npm test` trong `modules/skincare-3d` (chạy bằng Node 22, 11/11/2026): `engine` 18/18 và `v031` 29/29 đạt; còn lại dừng sớm:
  - `tests/manager.test.mjs`: lỗi cú pháp "Unexpected end of input" (dòng 132, thiếu dấu đóng).
  - `tests/v04.test.mjs`, `tests/v041.test.mjs`: kiểm tra mô hình cũ (ví dụ tên lớp `hairline`, mô hình mới là `hairbun`).
  - `tests/v042`–`v051.test.mjs`: dừng ở kiểm tra mã băm "js/rules.js đã bị sửa" (rules.js đã đổi ở v1.0.1/1.0.2 nhưng mã băm trong test chưa cập nhật).
  Đây là kiểm thử cũ chưa cập nhật theo bản 1.0.2, không phải lỗi do tích hợp; nhờ nhóm 3D cập nhật.
