# Audit Worth & Me (Phase 0)

Ngày: 10/11/2026 · Phạm vi: mã nguồn nhánh `main` (sau Đợt A), 7 migration, website https://worthandme.netlify.app.
Cách kiểm tra: đọc mã nguồn và migration, chạy kiểm thử database (PostgreSQL 16) và kiểm thử giao diện tự động, mở website thật (chỉ phần công khai).

**Ký hiệu trạng thái:** A = chạy đúng, dữ liệu lưu thật · B = làm một phần · C = chỉ có giao diện · D = chưa có · E = có nhưng lỗi.
**Chưa xác minh trên bản thật** = đã kiểm thử bằng database thật + Supabase giả lập nhưng nhóm chưa chạy vòng đầy đủ trên Supabase thật (đánh dấu *).

**Ngoài phạm vi (nhóm tự làm):** Skin Quiz, Skin Roadmap, Skincare Architect (3D), Beauty Quest. Không đánh giá, không sửa.
Beauty Finder (bảng câu hỏi gợi ý sản phẩm, đã có từ trước) được giữ nguyên thuật toán.

## 1. Kiến trúc và công nghệ

| Hạng mục | Hiện trạng |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 (design token trong `src/styles/tokens.css`), định tuyến React Router, trang quản trị/người bán tải riêng (lazy) |
| Backend | Supabase: PostgreSQL + Row Level Security, Auth (email + mật khẩu, xác minh email), Storage (bucket `brand`, `shop-media`) |
| Logic nghiệp vụ | Hàm SQL `SECURITY DEFINER` (đặt hàng, xử lý đơn, thanh toán mô phỏng, duyệt shop, đánh giá...) — trình duyệt không ghi thẳng vào bảng đơn |
| Lưu dữ liệu | Toàn bộ dữ liệu dùng chung ở PostgreSQL. Trình duyệt chỉ lưu giỏ hàng khi chưa đăng nhập (gộp vào tài khoản khi đăng nhập) và tùy chọn sáng/tối |
| Xác thực, phân quyền | Supabase Auth; vai trò `customer/seller/admin/super_admin` trong `profiles`, đổi vai trò chỉ qua hàm SQL; Super Admin khởi tạo bằng SQL cho email đã xác minh |
| Triển khai | GitHub → Netlify (tự deploy `main`, link xem thử cho mỗi Pull Request); GitHub Actions build mỗi Pull Request |
| Kiểm thử | 7 bộ kiểm thử database (368 tình huống), 9 bộ kiểm thử giao diện (298 bước) |

## 2. Bảng chức năng

### Khách hàng

| Module | Chức năng | TT | Đã có | Còn thiếu | Hành động |
|---|---|---|---|---|---|
| Khách | Đăng ký, đăng nhập, quên mật khẩu, xác minh email | A | Supabase Auth, đặt lại mật khẩu, khóa tài khoản | Email cho người ngoài team cần SMTP riêng | Giữ (cấu hình SMTP khi cần) |
| Khách | Trang chủ | B | Danh mục, sản phẩm nổi bật, shop, banner (Admin quản lý), lối vào Beauty Finder | Mục bán chạy, hàng mới, đánh giá thật của khách; thiết kế còn đơn giản | Làm lại giao diện, thêm mục |
| Khách | Tìm kiếm | B | Không dấu, theo tên/thương hiệu/loại/thành phần, chạy trong database, phân trang 24 | Gợi ý khi gõ, lịch sử tìm kiếm | Thêm |
| Khách | Bộ lọc, sắp xếp | B | Danh mục, loại, khoảng giá, loại da; 5 kiểu sắp xếp; xóa bộ lọc; lưu trên URL | Lọc thương hiệu, điểm đánh giá, còn hàng | Thêm (database + giao diện) |
| Khách | Trang sản phẩm | B | Giá/giá KM, tồn kho, shop, thông số, thành phần, loại da, đánh giá, yêu thích, sản phẩm liên quan | Xem nhiều ảnh (chỉ hiện ảnh đầu), Mua ngay, chia sẻ, so sánh, đã xem gần đây, thông tin giao hàng/đổi trả, cách dùng (chưa có trường dữ liệu) | Thêm |
| Khách | Biến thể (dung tích, màu) | D | Không | Toàn bộ | Chưa làm đợt này (ảnh hưởng giỏ, đơn, tồn kho; cần nhóm duyệt) |
| Khách | Giỏ hàng nhiều shop | B | Thêm/bớt/sửa số lượng, nhóm theo shop, phí ship theo shop, lưu theo tài khoản | Chọn món để thanh toán, voucher, báo rõ món hết hàng/ngừng bán | Thêm |
| Khách | Đặt hàng | B* | Địa chỉ, ghi chú, COD + QR mô phỏng, tách đơn theo shop, giá/phí/tồn kho tính ở server, khóa dòng chống bán vượt | Voucher; chặn đặt trùng khi bấm 2 lần (chỉ khóa nút ở giao diện) | Thêm voucher + mã chống trùng ở database |
| Khách | Đơn hàng của tôi | A* | Danh sách, chi tiết, tiến trình 5 bước, hủy khi chờ xác nhận, QR mô phỏng | — | Giữ |
| Khách | Tài khoản, sổ địa chỉ | A | Họ tên, SĐT, đổi mật khẩu, 10 địa chỉ, 1 mặc định | — | Giữ |
| Khách | Yêu thích, theo dõi shop | A* | `/favorites` (Đợt A) | — | Giữ |
| Khách | Ví voucher | D | Không | Toàn bộ | Làm |
| Khách | Thông báo | D | Không | Toàn bộ (đơn đổi trạng thái, đánh giá được trả lời) | Làm |
| Khách | Đánh giá | B* | Sao, nhận xét, thời gian, chỉ người đã nhận hàng, người bán trả lời, Admin ẩn | Nhãn "Đã mua hàng", báo cáo đánh giá vi phạm, ảnh đánh giá | Thêm nhãn + báo cáo; ảnh để sau |
| Khách | Beauty Finder | A | Bảng câu hỏi, chấm điểm theo quy tắc | — | Giữ nguyên thuật toán |
| Khách | Trang thông tin | A | Giới thiệu, Liên hệ, FAQ, Chính sách, Điều khoản (Đợt A) | Email hỗ trợ chưa có | Nhóm cung cấp email |

### Người bán

| Module | Chức năng | TT | Đã có | Còn thiếu | Hành động |
|---|---|---|---|---|---|
| Người bán | Mở shop, duyệt | A | Chờ duyệt, gửi lại khi bị từ chối | — | Giữ |
| Người bán | Sản phẩm | A | Nháp/đăng bán/ẩn/ngừng bán, 8 ảnh, xem trước, ảnh tự nén | Trường "Cách dùng" | Thêm trường |
| Người bán | Đơn hàng | A* | Xác nhận → giao, từ chối có lý do, chặn giao đơn QR chưa trả | — | Giữ |
| Người bán | Tổng quan | A | Sản phẩm theo trạng thái, sắp hết hàng, đơn chờ, doanh thu | — | Giữ |
| Người bán | Đánh giá | A* | Xem, trả lời | — | Giữ |
| Người bán | Voucher của shop | D | Không | Toàn bộ | Làm |

### Quản trị

| Module | Chức năng | TT | Đã có | Còn thiếu | Hành động |
|---|---|---|---|---|---|
| Admin | Người dùng | A | Tìm, lọc, khóa có lý do, cấp/thu hồi Admin | — | Giữ |
| Admin | Shop, sản phẩm | A | Duyệt/từ chối/tạm ngưng shop, ẩn sản phẩm có lý do | — | Giữ |
| Admin | Đơn hàng, thanh toán | A* | Xem mọi đơn, xác nhận QR, hủy, hoàn tiền mô phỏng | — | Giữ |
| Admin | Đánh giá | B* | Ẩn/bỏ ẩn có lý do | Danh sách đánh giá bị khách báo cáo | Thêm |
| Admin | Voucher toàn sàn | D | Không | Toàn bộ | Làm |
| Admin | Banner, thương hiệu, nhật ký | A | Có lịch sử, nhật ký | — | Giữ |

### Hệ thống

| Module | Chức năng | TT | Đã có | Còn thiếu | Hành động |
|---|---|---|---|---|---|
| Hệ thống | Database, RLS | A | 14 bảng có RLS, quyền cột, hàm kiểm tra quyền | Bảng voucher, thông báo, báo cáo đánh giá | Thêm migration 008 |
| Hệ thống | Giao diện sáng/tối, mobile | A | Token màu 2 chế độ, kiểm thử không kéo ngang | Thiết kế chưa đủ "cao cấp" | Làm lại giao diện |
| Hệ thống | Hiệu năng | B | Tải trang quản trị riêng, ảnh nén WebP khi tải lên (Đợt A) | Ảnh cũ đã tải lên vẫn là PNG nặng | Chủ shop tải lại ảnh (không cần code) |
| Hệ thống | Đơn QR quá hạn | D | Không | Tự hủy và trả hàng về kho | Làm (hủy khi có người xem/đặt hàng, không cần máy chủ chạy nền) |

## 3. Lỗi và rủi ro đã biết

| Vấn đề | Mức | Ghi chú |
|---|---|---|
| Bấm "Đặt hàng" 2 lần khi mạng chậm có thể tạo 2 đơn | Trung bình | Hiện chỉ khóa nút. Sửa: mã yêu cầu duy nhất kiểm tra trong database |
| Trang sản phẩm chỉ hiện ảnh đầu tiên | Thấp | Người bán tải tới 8 ảnh nhưng khách không xem được |
| Món trong giỏ bị ngừng bán/hết hàng | Đã xử lý (Đợt E) | Database chặn khi đặt; giỏ tự bỏ/giảm số lượng và báo rõ cho khách |
| Tài khoản bị khóa vẫn đăng nhập được ở tầng Auth | Thấp | Database chặn mọi thao tác. Cần Edge Function để chặn tận gốc |
| Danh mục trên trình duyệt tải tối đa 1.000 sản phẩm | Thấp | Trang danh sách tìm/lọc trong database nên không bị ảnh hưởng |
| Dữ liệu thử công khai (shop "Lemontri") | Thấp | Chủ shop/Admin sửa, không cần code |

## 4. Thứ tự làm (Đợt B)

1. Migration 008: voucher (sàn + shop, ví voucher), áp voucher và chống đặt trùng trong `place_order`, thông báo, báo cáo đánh giá, lọc thương hiệu/điểm/còn hàng, trường "Cách dùng", tự hủy đơn QR quá hạn. Kèm kiểm thử truy cập trái phép.
2. Giao diện mới (giữ tím lavender của Worth & Me, phong cách biên tập: nền kem, tiêu đề chữ có chân, ảnh bo lớn).
3. Khách hàng: gợi ý + lịch sử tìm kiếm, bộ lọc mới, xem nhiều ảnh, Mua ngay, chia sẻ, so sánh, đã xem gần đây, chọn món trong giỏ, voucher, thông báo, nhãn "Đã mua hàng", báo cáo đánh giá.
4. Người bán và Admin: quản lý voucher, danh sách đánh giá bị báo cáo, trường "Cách dùng".
5. Để sau (cần nhóm duyệt): biến thể sản phẩm, ảnh trong đánh giá, thanh toán thật.
