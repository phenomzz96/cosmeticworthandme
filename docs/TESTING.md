# Kiểm thử

## 1. Kiểm thử database (tự động, trên PostgreSQL local)

Bộ kiểm thử trong `supabase/tests/` chạy migration thật trên PostgreSQL 15+ với một file giả lập phần có sẵn của Supabase
(`00_local_supabase_stub.sql`: role `anon`/`authenticated`, `auth.users`, `auth.uid()`, `storage`). Cách chạy: [supabase/README.md](../supabase/README.md).

Kết quả lần chạy gần nhất (11/11/2026, PostgreSQL 16, mỗi file một database mới, đủ 10 migration):

| File | Nội dung chính | Đạt |
|---|---|---|
| `01_foundation_test.sql` | Tự nâng quyền, sửa hồ sơ người khác, cài đặt website, Super Admin | 51/51 |
| `02_admin_users_test.sql` | Quyền Admin/Super Admin, khóa tài khoản | 43/43 |
| `03_shops_products_test.sql` | Shop, sản phẩm, ảnh, duyệt shop | 68/68 |
| `04_search_addresses_cart_test.sql` | Tìm kiếm, sổ địa chỉ, giỏ hàng | 47/47 |
| `05_orders_payments_test.sql` | Đặt hàng, xử lý đơn, thanh toán, hoàn tiền, ẩn sản phẩm | 75/75 |
| `06_banners_test.sql` | Banner | 15/15 |
| `07_reviews_follows_favorites_test.sql` | Đánh giá, theo dõi shop, yêu thích, số liệu thật, loại "Tạo kiểu tóc" | 69/69 |
| `08_vouchers_notifications_reports_test.sql` | Mã giảm giá, chống đặt trùng, tự hủy đơn QR quá hạn, thông báo, báo cáo đánh giá, bộ lọc mới | 76/76 |
| `09_pages_messages_categories_test.sql` | Nội dung trang do Admin sửa, tin nhắn khách ↔ cửa hàng / hỗ trợ, danh mục mới | 75/75 |
| `10_skincare_routine_fields_test.sql` | Công dụng, thời điểm dùng, vùng thoa (Skincare Architect 3D): giá trị sai, shop khác, khách, khách vãng lai | 10/10 |
| **Tổng** | | **529/529** |

Kiểm thử thêm (chạy tay):
- Dữ liệu mẫu `supabase/seed/demo_catalog.sql` chạy được sau cả 10 migration và chạy lại lần 2 không trùng: 7 cửa hàng, 49 sản phẩm (18 có dữ liệu chu trình); số liệu mẫu được đưa về 0.
- Nâng cấp database đang có dữ liệu (6 migration + dữ liệu mẫu + sản phẩm sáp/gôm xếp nhầm "Dầu gội") lên migration 7: số liệu mẫu về 0, 4/4 sản phẩm sáp/gôm chuyển sang "Tạo kiểu tóc" (dầu gội thật giữ nguyên), ngày cập nhật sản phẩm không đổi.
- Hai người cùng đặt món cuối cùng (tồn kho 1) ở hai phiên song song: một đơn thành công, đơn kia nhận "chỉ còn 0 trong kho"; tồn kho không âm.

## 2. Kiểm thử giao diện (tự động, trình duyệt thật)

Môi trường của Claude không tải được gói npm, nên giao diện được build bằng esbuild + Tailwind và chạy trong Chromium (Playwright),
với một **client Supabase giả lập** mô phỏng các luật quyền chính (dữ liệu nằm trong trình duyệt). Luật thật vẫn là migration ở mục 1.

| Kịch bản | Bước đạt |
|---|---|
| Trang chủ, tìm kiếm, giỏ hàng, chế độ tối (dữ liệu mẫu) | 18/18 |
| Đăng ký, đăng nhập, quên mật khẩu, tài khoản, tài khoản bị khóa | 38/38 |
| Quản trị người dùng, nhật ký | 23/23 |
| Người bán: mở shop → từ chối → gửi lại → duyệt → đăng sản phẩm → khách thấy → ẩn → tạm ngưng | 54/54 |
| Khách hàng: tìm kiếm phân trang, giỏ hàng gộp khi đăng nhập, sổ địa chỉ | 29/29 |
| Đơn hàng: đặt 2 shop (COD), hủy, người bán xử lý, QR mô phỏng (quét mã bằng OpenCV), Admin xác nhận/từ chối, hoàn tiền, ẩn sản phẩm, hết hàng giữa chừng, mobile tối | 40/40 |
| Banner: thêm, chặn liên kết ngoài, hẹn giờ, bật/tắt, xóa | 12/12 |
| Beauty Finder (thuật toán chấm điểm: nam/nữ, 5 nhóm sản phẩm, điều cần tránh, nhóm hương, ngân sách, đường dẫn; công dụng khai báo, bộ đề xuất cho chu trình theo quy tắc module, chuyển câu trả lời → mục tiêu module) | 54/54 |
| Đợt A: số liệu thật, trang thông tin, đánh giá (chưa mua → không được; nhận hàng → viết, sửa, xóa), người bán trả lời, Admin ẩn, theo dõi shop, yêu thích, nén ảnh WebP khi tải lên, mobile + tối | 68/68 |
| Đợt B: giao diện mới, gợi ý + lịch sử tìm kiếm, lọc thương hiệu/điểm/còn hàng, trang sản phẩm (tab, so sánh, chia sẻ, mua ngay, đã xem gần đây), mã giảm giá (Admin, người bán, ví, giỏ, đặt hàng, lượt dùng), chọn món trong giỏ, thông báo, báo cáo đánh giá, "Cách dùng", mobile + tối | 79/79 |
| Đợt C: chân trang, banner nhiều slide, menu danh mục thả xuống, Nước hoa / Nam giới, Thương hiệu A–Z, thanh trượt giá, Beauty Finder mới, Câu hỏi thường gặp, Admin sửa nội dung trang, tin nhắn khách ↔ shop ↔ hỗ trợ (khung chat nổi), mobile + tối | 76/76 |
| Skincare Architect 3D: handshake, đồng bộ danh mục sàn, sản phẩm đã mua (đơn hủy không tính), Beauty Finder → module không hỏi lại + bộ đề xuất vào chu trình, gợi ý mua + giỏ hàng, sáng/tối + tương phản, tách dữ liệu khi đổi tài khoản, form người bán, trang sản phẩm, mở module độc lập, tự chuyển 2D, desktop + điện thoại tối | 45/45 |
| Đợt D: thanh tab Admin/người bán đủ chữ trên máy tính, mũi tên + tự cuộn tới tab đang chọn trên điện thoại, nhóm lọc, thanh danh mục 1024–1600px, quảng bá Skincare Architect 3D (banner, khối trang chủ, thanh danh mục, menu điện thoại), tương phản, sáng/tối | 31/31 |
| Đợt E: tải sẵn trang khi rảnh / khi rê chuột liên kết, banner không đổi chiều cao và dừng khi khuất màn hình, Quay lại về đúng chỗ đang xem, Tiến tới / mở trang mới về đầu trang, đổi sắp xếp giữ chỗ đang xem, mở thẳng 4 trang không nhảy bố cục (CLS < 0.1), nút có hiệu ứng nhấn, trang hiện dần, giỏ báo sản phẩm ngừng bán / hết hàng / giảm số lượng (điện thoại + máy tính, sáng/tối) | 33/33 |
| **Tổng** | **600/600** (gồm thuật toán Beauty Finder 54), không có lỗi JavaScript |

Kiểm tra che chữ tự động (Đợt D): 42 trang (khách, Admin, người bán) × 5 độ rộng (390, 768, 1024, 1280, 1440px) × sáng/tối: không có trang kéo ngang, không có hàng cuộn ngang thiếu mũi tên, không có chữ bị cắt mà không có dấu "…".

Kiểm tra TypeScript bằng trình biên dịch thật với kiểu thư viện rút gọn: không lỗi. **Nhóm vẫn cần chạy `npm.cmd run build`** để kiểm tra với thư viện thật.

## 3. Kiểm thử thủ công trên Supabase thật (nhóm làm)

Danh sách 20 bước ở [DEPLOY.md mục 7](DEPLOY.md#7-kiểm-tra-sau-khi-deploy-bắt-buộc-trước-buổi-demo). Ghi kết quả vào bảng dưới và gửi lại nếu có dòng không đạt.

| # | Người kiểm tra | Ngày | Đạt / Không đạt | Ghi chú (bước, kết quả thấy được) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| … | | | | |

## 4. Khi thêm tính năng mới

- Thay đổi database: thêm file migration mới (không sửa file đã chạy) và thêm tình huống truy cập trái phép vào `supabase/tests/`.
- Trước khi merge: `npm run build` chạy được, đã thử luồng chính trên deploy preview của Netlify, cả chế độ sáng và tối, cả điện thoại.

## Đo hiệu suất (Đợt E, trong môi trường của Claude)

Bản build kiểm tra (esbuild, tách file giống Vite), điện thoại giả lập (CPU chậm 4 lần, mạng 4G), so với `main` trước Đợt E:

| Chỉ số | Trước | Sau |
|---|---|---|
| Mã JavaScript cần cho lần mở đầu | 575 KB | 464 KB (−19%) |
| Dịch chuyển bố cục khi mở thẳng trang sản phẩm / chi tiết | 0,02–0,10 | 0 |
| Thời gian chặn luồng chính khi mở trang chủ (trung vị 3 lần) | ~500–580 ms | ~440 ms |

Số đo trong sandbox có dao động; bản thật (Vite + thư viện Supabase thật) sẽ khác về con số tuyệt đối. Có thể đo lại bằng Lighthouse (Chrome DevTools) trên Deploy Preview.
