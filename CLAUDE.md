# Quy tắc dự án cho Claude Code

Dự án: Worth & Me, sàn mỹ phẩm nhiều cửa hàng (dự án học tập). Backend: Supabase. Ngôn ngữ giao tiếp và giao diện: tiếng Việt.

## Bắt buộc
- Không tạo lại project, không đổi framework (React + Vite + TS + Tailwind v4) khi nhóm chưa đồng ý.
- Trước khi sửa: xác định file liên quan và tác động. Sau khi sửa: báo cáo file đã sửa, lý do, cách kiểm thử.
- Không tuyên bố đã build, chạy hay deploy thành công nếu chưa thực sự chạy và kiểm tra.
- Phân biệt rõ dữ liệu mẫu và tính năng thật. Không làm giả đăng nhập, thanh toán hay bảo mật bằng frontend.
- Không đưa secret vào frontend hoặc repo (chỉ `VITE_SUPABASE_URL` và anon key được phép ở frontend).
- Không dùng localStorage làm nguồn dữ liệu chính cho dữ liệu dùng chung (sản phẩm, đơn, tài khoản, thương hiệu).
- Beauty Finder và nội dung sản phẩm: không chẩn đoán y khoa, không cam kết điều trị.

## Bảo mật & database
- Quyền được kiểm tra ở database (RLS, hàm SECURITY DEFINER). Ẩn nút/trang ở frontend chỉ để tiện, không phải bảo mật.
- Mỗi thay đổi database = một file mới trong `supabase/migrations/`. Không sửa migration đã chạy.
- Bảng mới: bật RLS, thu hồi quyền mặc định của anon/authenticated rồi cấp lại đúng cột cần thiết.
- Thao tác quản trị đi qua hàm SQL có kiểm tra `public.is_admin()` và ghi `audit_logs`.
- Viết kiểm thử truy cập trái phép trong `supabase/tests/` cho mỗi migration.
- Không tin giá, tổng tiền, role, trạng thái thanh toán gửi từ trình duyệt.
- Đơn hàng, thanh toán, giỏ hàng: trình duyệt không ghi trực tiếp vào bảng đơn; mọi thay đổi qua hàm SQL (`place_order`, `seller_update_shop_order`...).
- Thanh toán chỉ có COD và QR **mô phỏng**. Không tích hợp cổng thanh toán thật, không lưu thông tin thẻ/tài khoản ngân hàng khi chưa có xác nhận của giảng viên.
- Địa chỉ, số điện thoại khách: chỉ chủ tài khoản, người bán của đúng đơn đó và Admin được xem.

## Thương hiệu
- Tên, logo, favicon, màu chủ đạo: đọc qua `useBrand()` (dữ liệu từ Supabase). Không hard-code tên thương hiệu trong component.
- Giá trị mặc định và tên nhóm: `src/config/brand.ts`.
- Không tự đặt tên nhóm, slogan hay vẽ logo. Giữ `null` cho tới khi nhóm cung cấp.
- Màu và font: chỉ dùng token trong `src/styles/tokens.css` (class `bg-surface`, `text-primary`...). Không dùng mã màu trực tiếp trong component (trừ màu bao bì trong dữ liệu mẫu).
- Mọi màn hình mới phải hiển thị đúng cả light và dark mode.

## Dữ liệu
- Trang và component lấy dữ liệu qua `src/services/*`, không import `src/data/mock` trực tiếp.
- Tài liệu: trạng thái `docs/STATUS.md`, triển khai `docs/DEPLOY.md`, kiểm thử `docs/TESTING.md`, demo `docs/DEMO.md`. Cập nhật khi thêm tính năng.
- Khi tích hợp Supabase: thay phần thân hàm trong service, giữ nguyên kiểu trả về (`src/types`).
