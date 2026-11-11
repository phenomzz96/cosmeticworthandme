# Skincare Architect 3D (tính năng chuyên biệt)

Module do nhóm Skincare Architect phát triển (gói bàn giao v1.0.2). Website **không sửa code bên trong module**; mọi phần
nối với dữ liệu và giao diện Worth & Me nằm ở lớp tích hợp riêng của website.

## Phân vai với Beauty Finder (không trùng chức năng)

| | Beauty Finder (`/beauty-finder`) | Skincare Architect 3D (`/skincare-architect`) |
|---|---|---|
| Việc | **Chọn** sản phẩm trên sàn theo nhu cầu (mọi nhóm: da, trang điểm, tóc, cơ thể, nước hoa) | **Sắp xếp** sản phẩm da mặt thành chu trình sáng/tối, kiểm tra trùng lặp và tổ hợp cần thận trọng, minh họa vị trí thoa trên mô hình 3D/2D, nhật ký |
| Dữ liệu | Câu trả lời của khách + thông tin sản phẩm | Câu trả lời Beauty Finder (không hỏi lại) + sản phẩm đã mua + bộ đề xuất của Beauty Finder |

- Đã bỏ chế độ "Theo các bước" trong kết quả Beauty Finder (trùng việc sắp chu trình của module). Kết quả da mặt có khối
  **"Xếp thành chu trình sáng – tối, xem trên mô hình 3D"**: bộ sản phẩm đề xuất (một sản phẩm/bước) + nút mở Skincare Architect.
- Cả hai dùng **cùng một nguồn dữ liệu**: công dụng, thời điểm dùng, vùng thoa do người bán khai báo (migration 010).
  Beauty Finder cộng điểm cho sản phẩm có công dụng khớp vấn đề da ("Công dụng khai báo: …") và sản phẩm xếp được vào
  chu trình; sản phẩm chưa khai báo có lưu ý "chưa xếp được vào chu trình 3D".
- Bộ đề xuất theo đúng quy tắc của module: bước tùy chọn (toner, serum, đặc trị) chỉ chọn sản phẩm có công dụng khớp mục
  tiêu; khách chọn từ 4 bước thì bổ sung sản phẩm cho mục tiêu còn thiếu; mục tiêu "da dễ kích ứng" hoặc khách chọn tránh
  hoạt chất mạnh thì không chọn retinoid/AHA/BHA/vitamin C (cùng cách nhận diện với module).

| Câu trả lời Beauty Finder | Mục tiêu trong module |
|---|---|
| Mụn | Chăm sóc da có mụn (`acne`) |
| Thiếu nước | Cấp ẩm (`hydrate`) |
| Lỗ chân lông | Hỗ trợ kiểm soát dầu (`oil`) |
| Đỏ / kích ứng, hoặc loại da nhạy cảm | Chăm sóc da dễ kích ứng (`sensitive`) |
| Không chọn vấn đề nào ở trên | Duy trì routine cơ bản (`basic`) |
| Da khô / dầu / hỗn hợp; còn lại | `dry` / `oily` / `mixed`; `unsure` |

## Dữ liệu website gửi sang module (`skincare:sync`)

| Trường | Nguồn |
|---|---|
| `catalog` | Sản phẩm đang bán thuộc nhóm làm sạch, toner, serum, tẩy tế bào chết / mặt nạ / mắt (→ chăm sóc chuyên biệt), kem dưỡng, chống nắng (cả đồ nam). `functions`, `recommendedPeriod`, `zones` lấy từ cột người bán khai báo; `actives` nhận từ thành phần chính (retinol, BHA, AHA, vitamin C, niacinamide). Sản phẩm chưa khai báo vẫn gửi, module tự báo "thiếu dữ liệu" (không đoán) |
| `purchasedProductIds` | Sản phẩm trong đơn của khách (đơn con chưa hủy), chỉ khi đã đăng nhập |
| `goals`, `skin` | Câu trả lời Beauty Finder: từ đường dẫn (bấm từ trang kết quả) hoặc lần làm gần nhất trên trình duyệt. Chỉ gửi khi câu trả lời đổi, để không ghi đè mục tiêu khách tự sửa trong module |

Sau khi module áp dụng (`host:applied`), website gửi thêm bộ sản phẩm Beauty Finder đề xuất (`?pick=`, tối đa 8) vào chu trình.
Trang sản phẩm có nút **"Xếp vào chu trình Skincare Architect 3D"** (khi sản phẩm đủ dữ liệu). Khách chưa chọn mục tiêu thì
module chưa cho thêm; trang báo cần chọn mục tiêu và có nút "Thêm lại".

Dưới khung module, trang hiện:
- **Trong chu trình, bạn chưa mua**: sản phẩm trong chu trình chưa có trong lịch sử mua, có nút thêm vào giỏ.
- **Gợi ý từ sàn để hoàn thiện chu trình**: bước còn thiếu (làm sạch, dưỡng ẩm, chống nắng) và mục tiêu chưa có sản phẩm
  đáp ứng → tối đa 3 sản phẩm đủ dữ liệu, còn hàng, không chứa hoạt chất module sẽ loại theo mục tiêu; nút "Vào chu trình" và "Giỏ hàng".

## Nằm ở đâu

| Đường dẫn | Nội dung |
|---|---|
| `modules/skincare-3d/` | Gói bàn giao của nhóm 3D, giữ nguyên |
| `modules/skincare-3d-host/` | Lớp nhúng **của Worth & Me** (xem README trong thư mục): `wm-pre.js`, `wm-embed.css`, `wm-embed.js` |
| `scripts/copy-skincare-3d.mjs` | Tự chạy trước `npm run dev` / `npm run build`: chép module + lớp nhúng sang `public/skincare-3d/` (tự sinh, không lên GitHub) và chèn lớp nhúng vào `index.html` bản chép |
| `src/pages/SkincareArchitectPage.tsx` | Trang `/skincare-architect`: nhúng, đồng bộ dữ liệu, gợi ý mua sắm |
| `src/features/skincare-3d/routineFields.ts` | Bộ từ vựng chung (công dụng, thời điểm, vùng thoa, mục tiêu), chuyển sản phẩm sàn → dữ liệu module, câu trả lời Beauty Finder → mục tiêu |
| `src/features/skincare-3d/finderBridge.ts` | Lưu câu trả lời Beauty Finder gần nhất; tách dữ liệu module theo tài khoản |
| `supabase/migrations/20261113000001_skincare_routine_fields.sql` | Cột `skincare_functions`, `use_period`, `apply_zones` của `products` |

## Lớp nhúng (`modules/skincare-3d-host`)

- Khi nhúng (`?embed=1`): dùng màu, font Worth & Me cho cả **sáng và tối** (đổi trên website thì module đổi theo, không tải
  lại), ẩn thanh trên và cửa hàng mẫu "Lumière Skin" của module, mở thẳng "Routine của tôi".
- Mở module trực tiếp (`/skincare-3d/index.html`): giữ nguyên giao diện gốc; nếu trình duyệt còn nhớ hồ sơ "HOST" của chế độ
  nhúng thì quay về hồ sơ mẫu (tránh trắng trang).
- Tin nhắn chỉ nhận từ đúng `hostOrigin` và đúng cửa sổ cha, giống quy tắc của module.

## Dữ liệu cá nhân trên trình duyệt

Module lưu chu trình, nhật ký, ảnh trong trình duyệt (localStorage/IndexedDB) dưới một mã chung "HOST", không lên Supabase.
Khi tài khoản đăng nhập trên trình duyệt đổi (đăng xuất, tài khoản khác), website xóa dữ liệu đó và câu trả lời Beauty Finder
đã lưu, để người sau không thấy của người trước. Khách chưa đăng nhập rồi đăng nhập thì giữ lại.

## Người bán khai báo

Form sản phẩm (nhóm da mặt) có mục **"Chu trình skincare (không bắt buộc)"**: công dụng (tối đa 8), thời điểm dùng, vùng thoa.
Kiểm tra ở database (giá trị ngoài bộ từ vựng bị từ chối), quyền ghi theo RLS sẵn có của `products` (chỉ chủ shop).
Trang sản phẩm hiện các thông tin này trong tab "Thông tin chi tiết". 18 sản phẩm mẫu đã có dữ liệu (chạy lại `supabase/seed/demo_catalog.sql`).

## Cập nhật phiên bản mới của module

Xóa thư mục `modules/skincare-3d/`, giải nén gói mới vào đúng chỗ đó, chạy `npm.cmd run dev`. Nếu `index.html` của module đổi
cấu trúc, script chép sẽ báo lỗi rõ ràng (cần sửa chỗ chèn lớp nhúng). Nếu nhóm 3D đổi tên bước/mục tiêu trong `js/rules.js`,
cập nhật `MODULE_GOALS` trong `routineFields.ts` và `STEP_CATEGORY` trong trang.

## Lưu ý cho nhóm 3D (phát hiện khi tích hợp, chưa sửa vì là code của nhóm 3D)

- Three.js 0.160.0 tải từ jsDelivr khi mở bước "Mô hình 3D". Không tải được thì module tự chuyển sang sơ đồ 2D. Đã kiểm tra
  trường hợp chuyển 2D; mô hình 3D thật chưa kiểm tra được trong môi trường của Claude (CDN bị chặn).
- Danh mục sản phẩm từ website chỉ giữ trong bộ nhớ của module (không lưu), nên mỗi lần mở trang website gửi lại.
- `npm test` trong `modules/skincare-3d` (Node 22, 11/11/2026): `engine` 18/18 và `v031` 29/29 đạt; còn lại dừng sớm:
  - `tests/manager.test.mjs`: lỗi cú pháp "Unexpected end of input" (dòng 132, thiếu dấu đóng).
  - `tests/v04.test.mjs`, `tests/v041.test.mjs`: kiểm tra mô hình cũ (ví dụ tên lớp `hairline`, mô hình mới là `hairbun`).
  - `tests/v042`–`v051.test.mjs`: dừng ở kiểm tra mã băm "js/rules.js đã bị sửa" (mã băm trong test chưa cập nhật theo 1.0.1/1.0.2).
  Đây là kiểm thử cũ chưa cập nhật theo bản 1.0.2, không phải lỗi do tích hợp; nhờ nhóm 3D cập nhật.
