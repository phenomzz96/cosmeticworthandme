# Kiểm thử

## 1. Kiểm thử database (tự động, trên PostgreSQL local)

Bộ kiểm thử trong `supabase/tests/` chạy migration thật trên PostgreSQL 15+ với một file giả lập phần có sẵn của Supabase
(`00_local_supabase_stub.sql`: role `anon`/`authenticated`, `auth.users`, `auth.uid()`, `storage`). Cách chạy: [supabase/README.md](../supabase/README.md).

Kết quả lần chạy gần nhất (26/10/2026, PostgreSQL 16, mỗi file một database mới):

| File | Nội dung chính | Đạt |
|---|---|---|
| `01_foundation_test.sql` | Tự nâng quyền, sửa hồ sơ người khác, cài đặt website, Super Admin | 51/51 |
| `02_admin_users_test.sql` | Quyền Admin/Super Admin, khóa tài khoản | 43/43 |
| `03_shops_products_test.sql` | Shop, sản phẩm, ảnh, duyệt shop | 68/68 |
| `04_search_addresses_cart_test.sql` | Tìm kiếm, sổ địa chỉ, giỏ hàng | 47/47 |
| `05_orders_payments_test.sql` | Đặt hàng, xử lý đơn, thanh toán, hoàn tiền, ẩn sản phẩm | 75/75 |
| `06_banners_test.sql` | Banner | 15/15 |
| **Tổng** | | **299/299** |

Kiểm thử thêm (chạy tay):
- Dữ liệu mẫu `supabase/seed/demo_catalog.sql` chạy được sau cả 6 migration; tìm kiếm trả 29 sản phẩm.
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
| Beauty Finder (thuật toán chấm điểm) | 16/16 |
| **Tổng** | **230/230**, không có lỗi JavaScript |

Kiểm tra TypeScript bằng trình biên dịch thật với kiểu thư viện rút gọn: không lỗi. **Nhóm vẫn cần chạy `npm.cmd run build`** để kiểm tra với thư viện thật.

## 3. Kiểm thử thủ công trên Supabase thật (nhóm làm)

Danh sách 15 bước ở [DEPLOY.md mục 7](DEPLOY.md#7-kiểm-tra-sau-khi-deploy-bắt-buộc-trước-buổi-demo). Ghi kết quả vào bảng dưới và gửi lại nếu có dòng không đạt.

| # | Người kiểm tra | Ngày | Đạt / Không đạt | Ghi chú (bước, kết quả thấy được) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| … | | | | |

## 4. Khi thêm tính năng mới

- Thay đổi database: thêm file migration mới (không sửa file đã chạy) và thêm tình huống truy cập trái phép vào `supabase/tests/`.
- Trước khi merge: `npm run build` chạy được, đã thử luồng chính trên deploy preview của Netlify, cả chế độ sáng và tối, cả điện thoại.
