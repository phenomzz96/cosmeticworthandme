# Trạng thái tính năng

Cập nhật: 26/10/2026, sau Giai đoạn 6. Phân loại theo master prompt.

## Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Kiến trúc | Giữ React/Vite/Netlify, bổ sung Supabase (Auth, Postgres + RLS, Storage) |
| Shop mới | Ở trạng thái "chờ duyệt" cho tới khi Admin duyệt; mỗi tài khoản 1 shop |
| Đơn hàng nhiều shop | Đơn cha (`orders`) + đơn con theo shop (`shop_orders`) |
| Trạng thái đơn con | Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao → Đã giao, hoặc Đã hủy. Khách hủy khi còn "Chờ xác nhận"; người bán từ chối/hủy kèm lý do trước khi giao |
| Phí vận chuyển | Cố định mỗi đơn con, mặc định 30.000đ, Admin chỉnh trong `/admin/brand` (0 = miễn phí) |
| Thanh toán | COD + chuyển khoản QR **mô phỏng** (không cổng thanh toán, không tài khoản ngân hàng, không tiền thật) cho tới khi giảng viên đồng ý phương án khác |
| Biến thể sản phẩm | Chưa làm (để sau) |
| Email | Bộ gửi mặc định của Supabase (chỉ thành viên team). Bật SMTP riêng khi cần demo với người ngoài |

## Đã hoàn thành và đã kiểm thử (trong môi trường của Claude)

Kiểm thử database: PostgreSQL 16 với migration thật (giả lập phần có sẵn của Supabase: role, `auth.users`, `storage`).
Kiểm thử giao diện: bản build chạy trong Chromium (Playwright) với client Supabase **giả lập** mô phỏng các luật quyền chính. Chi tiết: [TESTING.md](TESTING.md).

| Giai đoạn | Tính năng | Kiểm thử |
|---|---|---|
| 1A | Hồ sơ, vai trò, trạng thái khóa; chặn tự nâng quyền; Super Admin khởi tạo an toàn; cài đặt website + lịch sử; nhật ký | DB 51 · e2e đăng nhập/đăng ký 38 |
| 1B | Quản trị người dùng: tìm, lọc, phân trang, khóa/mở khóa có lý do, cấp/thu hồi Admin, nhật ký | DB 43 · e2e admin 23 |
| 2 | Mở shop, duyệt/từ chối/tạm ngưng, gửi duyệt lại; thiết lập shop (logo, bìa, chính sách); sản phẩm nhiều ảnh, nháp/đăng bán/ẩn/ngừng bán; trang shop công khai | DB 68 · e2e người bán 54 |
| 3 | Tìm kiếm không dấu + lọc + phân trang ở database; sổ địa chỉ riêng tư; giỏ hàng theo tài khoản (gộp khi đăng nhập) | DB 47 · e2e khách hàng 29 |
| 4 | Đặt hàng nhiều shop (giá, phí ship, tồn kho tính ở server, khóa dòng chống bán vượt); đơn của tôi; khách hủy; người bán xử lý đơn; Admin xem/hủy đơn; tổng quan Admin và người bán; Admin ẩn sản phẩm vi phạm | DB 75 · e2e đơn hàng 40 · thử 2 người mua cùng lúc món cuối |
| 5 | COD tự "đã thanh toán" khi giao xong; QR mô phỏng (mã QR tự sinh, đã quét thử bằng OpenCV), Admin xác nhận/từ chối, chặn giao khi chưa thanh toán, hoàn tiền mô phỏng; banner trang chủ | DB (trong 75 ở trên) + 15 · e2e banner 12 |
| 6 | Kiểm thử tổng, tách tải trang quản trị/người bán (trang chủ nhẹ hơn), tài liệu triển khai, kịch bản demo | Toàn bộ: DB 299/299, e2e 230/230 |

## Chưa kiểm thử trên môi trường thật

| Việc | Cần gì |
|---|---|
| Chạy 6 migration trên Supabase project thật | Nhóm tạo project, làm theo [DEPLOY.md](DEPLOY.md) |
| Gửi email xác minh / đặt lại mật khẩu thật | Như trên + mời thành viên vào team (hoặc SMTP) |
| `npm run build` với thư viện thật (Vite, TypeScript, supabase-js) | Môi trường của Claude không tải được gói npm; nhóm chạy `npm.cmd run build` và gửi kết quả |
| Tải ảnh thật lên Storage, đường dẫn ảnh công khai | Supabase project thật |
| Truy vấn lồng nhau của PostgREST (đơn → đơn con → sản phẩm) | Supabase project thật (đã ghi rõ khóa ngoại để tránh nhầm quan hệ) |
| Deploy Netlify | Repo GitHub của nhóm + 2 biến môi trường |
| Gộp vào source code mới nhất của nhóm | Repo GitHub hoặc thư mục dự án |

## Giới hạn đã biết (chấp nhận cho đồ án, ghi để nhóm trả lời khi được hỏi)

| Giới hạn | Ghi chú |
|---|---|
| Tài khoản bị khóa vẫn đăng nhập được ở tầng Supabase Auth | Database chặn mọi thao tác, giao diện tự đăng xuất. Chặn tận gốc cần Edge Function giữ `service_role` |
| Đơn QR chưa thanh toán giữ tồn kho cho tới khi bị hủy | Người bán hoặc Admin hủy đơn để trả hàng về kho; chưa có tự hủy theo thời gian |
| Danh mục cho trang chủ, Beauty Finder, giỏ hàng tải tối đa 1.000 sản phẩm đang bán | Trang danh sách sản phẩm đã tìm/lọc/phân trang trong database nên không bị giới hạn này |
| Tổng tiền đơn cha giữ nguyên khi một đơn con bị hủy | Trang đơn ghi chú rõ; số tiền từng đơn con vẫn đúng |
| Chưa có đánh giá sản phẩm, theo dõi shop, mã giảm giá, biến thể | Ngoài phạm vi các giai đoạn đã duyệt |

## Đang chờ nhóm cung cấp

- Source code mới nhất (repo GitHub hoặc thư mục) để gộp.
- Project URL của Supabase (sau khi chạy migration).
- Kết quả `npm.cmd run build` trên máy nhóm.
- Logo chính thức, tên nhóm, danh sách thành viên.
