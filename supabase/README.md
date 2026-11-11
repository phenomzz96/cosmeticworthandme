# Supabase: migration và kiểm thử

## Chạy migration lên Supabase

Supabase Dashboard → **SQL Editor** → dán nội dung file trong `migrations/` → **Run**, theo thứ tự tên file.
Mỗi file chỉ chạy một lần. Đã chạy rồi thì không sửa file đó nữa; thay đổi tiếp theo viết thành file mới.

| File | Nội dung |
|---|---|
| `20261025000001_foundation.sql` | Hồ sơ người dùng, vai trò, trạng thái khóa; cài đặt website + lịch sử; audit log; bucket `brand`; hàm khởi tạo Super Admin |
| `20261026000001_admin_users.sql` | Danh sách người dùng (tìm kiếm, lọc, phân trang), khóa/mở khóa có lý do, cấp/thu hồi Admin, xem nhật ký, chặn xóa Super Admin |
| `20261026000002_shops_products.sql` | Bảng `shops`, `products`, `product_images`; quyền theo chủ shop; duyệt/từ chối/tạm ngưng shop (Admin, có nhật ký); gửi duyệt lại; bucket `shop-media` |
| `20261027000001_search_addresses_cart.sql` | Tìm kiếm không dấu + lọc + phân trang (`search_products`); sổ địa chỉ riêng tư; giỏ hàng theo tài khoản (`cart_set_item`, `cart_merge`) |
| `20261028000001_orders_payments.sql` | Đơn cha/đơn con, `place_order` (giá, phí ship, tồn kho tính ở server), hủy/xử lý đơn, COD và QR mô phỏng (báo chuyển, Admin xác nhận, hoàn tiền), danh sách đơn cho người bán/Admin, số liệu tổng quan, Admin ẩn sản phẩm vi phạm |
| `20261029000001_banners.sql` | Banner trang chủ (chỉ Admin, chỉ liên kết nội bộ, hẹn giờ, nhật ký); cho phép thư mục `banner/` trong bucket `brand` |
| `20261104000001_reviews_follows_favorites.sql` | Đánh giá sản phẩm (chỉ khách đã nhận hàng; người bán trả lời; Admin ẩn có lý do + nhật ký), theo dõi shop, yêu thích sản phẩm; điểm, lượt đánh giá, người theo dõi, lượt bán do database tự tính (số liệu mẫu cũ được đưa về số thật); loại sản phẩm "Tạo kiểu tóc" và tự chuyển sáp/gôm đang xếp nhầm vào "Dầu gội" |
| `20261112000001_pages_messages_categories.sql` | Nội dung trang do Admin sửa (`site_pages`, `admin_save_page`, `admin_reset_page`, có nhật ký); tin nhắn khách ↔ cửa hàng và khách ↔ bộ phận hỗ trợ (`conversations`, `messages`, `start_conversation`, `send_message`, `inbox`, chống spam 20 tin/phút, thông báo khi có tin mới; Admin không đọc tin giữa khách và cửa hàng); danh mục Nước hoa, Nam giới và các loại sản phẩm mới |
| `20261113000001_skincare_routine_fields.sql` | Cột `skincare_functions` (công dụng, tối đa 8, theo bộ từ vựng của Skincare Architect 3D), `use_period` (sáng/tối/cả hai), `apply_zones` (vùng thoa) của `products`; người bán ghi theo quyền cột + RLS sẵn có; dùng chung cho Beauty Finder và Skincare Architect 3D |
| `20261111000001_vouchers_notifications_reports.sql` | Mã giảm giá của sàn và của shop (tính ở server trong `place_order`, chia giảm giá sàn theo tỷ lệ cho từng đơn con, trả lượt khi hủy), ví voucher; chống đặt trùng (`client_request_id`); tự hủy đơn QR chưa thanh toán sau 24 giờ và trả hàng về kho; thông báo trong website (đơn, đánh giá, shop, sản phẩm bị ẩn); khách báo cáo đánh giá, Admin lọc đánh giá bị báo cáo; `search_products` lọc thương hiệu/điểm/còn hàng; cột "Cách dùng" |

### Dữ liệu mẫu (tùy chọn)

`seed/demo_catalog.sql`: 5 cửa hàng mẫu (không có chủ, đã duyệt) và 29 sản phẩm hư cấu dùng hình minh họa thay ảnh thật.
Chạy **sau** các migration (cần đủ các migration: dòng cuối file tính lại số liệu từ dữ liệu thật; từ migration 010 file còn điền dữ liệu chu trình cho sản phẩm mẫu). Chạy lại không bị trùng. Muốn bỏ dữ liệu mẫu: xóa các shop có `owner_id is null` (sản phẩm và ảnh tự xóa theo).

## Kiểm thử bảo mật (không bắt buộc với cả nhóm)

`tests/` chứa bộ kiểm thử chạy trên **PostgreSQL local**:

- `00_local_supabase_stub.sql`: giả lập tối thiểu các phần có sẵn của Supabase (role `anon`/`authenticated`, `auth.users`, `auth.uid()`, `storage`). **Không chạy file này trên Supabase thật.**
- `helpers.sql`: hàm hỗ trợ kiểm thử dùng chung.
- `01_foundation_test.sql`: 51 tình huống, gồm các truy cập trái phép: customer tự nâng quyền, sửa hồ sơ người khác, sửa cài đặt website, đọc audit log, tải ảnh lên bucket thương hiệu; tài khoản bị khóa; bootstrap Super Admin với email chưa xác minh.
- `02_admin_users_test.sql`: 43 tình huống: customer gọi hàm quản trị, admin thường khóa admin khác hoặc Super Admin, tự khóa mình, cấp quyền cho email chưa xác minh, admin bị khóa mất quyền ngay, xóa Super Admin.
- `03_shops_products_test.sql`: 68 tình huống: mở 2 shop, tự duyệt shop, sửa shop/sản phẩm người khác, sửa lượt bán/điểm đánh giá, giá khuyến mãi sai, đăng bán khi chưa có ảnh, ảnh của shop khác, tải ảnh vào thư mục shop khác, khách thấy sản phẩm nháp hoặc của shop chưa duyệt/tạm ngưng/chủ bị khóa.
- `04_search_addresses_cart_test.sql`: 47 tình huống: tìm kiếm không lộ hàng nháp/shop chưa duyệt, đọc/sửa/xóa địa chỉ và giỏ của người khác, tài khoản bị khóa, giới hạn số lượng.
- `05_orders_payments_test.sql`: 75 tình huống: gian lận giá, đặt quá tồn kho, mua hàng của shop mình, dùng địa chỉ người khác, ghi thẳng vào bảng đơn, xem đơn của người khác, người bán xử lý đơn shop khác, nhảy cóc trạng thái, tự xác nhận thanh toán, giao đơn QR chưa trả tiền, hoàn tiền 2 lần, Admin ẩn sản phẩm.
- `06_banners_test.sql`: 15 tình huống: liên kết ra ngoài website, khách thêm/sửa/xóa banner, tải ảnh banner trái phép, hẹn giờ.
- `09_pages_messages_categories_test.sql`: 75 tình huống: danh mục/loại không hợp lệ, tìm không dấu theo danh mục mới; khách, người bán, Admin bị khóa sửa nội dung trang; chèn/sửa thẳng bảng nội dung; thanh thông báo nhiều dòng/quá dài; khách vãng lai nhắn tin; nhắn cửa hàng tạm ngưng hoặc cửa hàng của chính mình; đính kèm sản phẩm của shop khác; chèn thẳng tin nhắn giả làm cửa hàng; chủ shop khác, khách khác đọc trộm; chủ shop chen vào cuộc trò chuyện hỗ trợ; Admin đọc hoặc gửi tin vào cuộc trò chuyện của cửa hàng; gửi quá 20 tin/phút; tài khoản bị khóa đọc tin cũ; gọi hàm nội bộ.
- `10_skincare_routine_fields_test.sql`: 10 tình huống: sản phẩm cũ không bị tự điền; chủ shop khai báo dữ liệu chu trình; công dụng, thời điểm, vùng thoa ngoài bộ từ vựng bị từ chối; người bán shop khác, khách hàng sửa bị chặn; khách vãng lai đọc được nhưng không sửa được.
- `08_vouchers_notifications_reports_test.sql`: 76 tình huống: người bán tạo mã toàn sàn hoặc mã cho shop khác, shop chưa duyệt tạo mã, chèn/sửa thẳng bảng voucher và lượt dùng, mã không tồn tại/hết hạn/đang tắt, chưa đủ đơn tối thiểu, mã shop áp cho sản phẩm shop khác, dùng quá lượt mỗi người hoặc hết tổng lượt, xem ví của người khác, đặt hàng 2 lần cùng mã yêu cầu (chỉ 1 đơn, trừ kho 1 lần), trả lượt khi hủy, tự hủy đơn QR quá 24 giờ và trả kho, đọc/tự chèn thông báo của người khác, báo cáo đánh giá của chính mình, đọc thẳng bảng báo cáo, người bán xem danh sách kiểm duyệt, lọc thương hiệu/điểm/còn hàng.
- `07_reviews_follows_favorites_test.sql`: 69 tình huống: đánh giá khi chưa mua / chưa nhận hàng, chèn thẳng vào bảng đánh giá, đọc user_id/email người đánh giá, sửa điểm hay số người theo dõi, người bán shop khác trả lời, khách ẩn đánh giá, đánh giá bị ẩn vẫn tính điểm, theo dõi shop chưa duyệt, tự theo dõi shop mình, đọc danh sách yêu thích của người khác, tài khoản bị khóa.

Cách chạy (cần PostgreSQL 15+ và `psql`):

```bash
# Mỗi file kiểm thử chạy trên một database mới
createdb wm_test
psql -d wm_test -v ON_ERROR_STOP=1 -f supabase/tests/00_local_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -d wm_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d wm_test -f supabase/tests/01_foundation_test.sql   # hoặc 02_ … 10_
```

Kết quả cuối phải là `truot = 0`.

## Kiểm tra nhanh trên Supabase thật (sau khi chạy migration)

1. Đăng ký 1 tài khoản thường trên website, đăng nhập.
2. Mở DevTools → Console, chạy:
   ```js
   // phải báo lỗi permission denied: trình duyệt không tự đổi role được
   await (await import('/src/lib/supabase.ts')).supabase.from('profiles').update({ role: 'admin' }).eq('id', '<id của bạn>')
   ```
   (chỉ chạy được khi `npm run dev`). Kết quả mong đợi: lỗi `42501`.
3. Vào `/admin/brand` bằng tài khoản thường: phải thấy "Bạn không có quyền truy cập trang này".
4. Mở shop bằng tài khoản thường, thêm sản phẩm có ảnh và đăng bán; mở website ở cửa sổ ẩn danh: chưa thấy sản phẩm. Admin duyệt shop ở `/admin/shops`; tải lại cửa sổ ẩn danh (chờ tối đa 1 phút do bộ nhớ đệm): sản phẩm xuất hiện.
