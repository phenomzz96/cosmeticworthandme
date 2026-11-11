# Trạng thái tính năng

Cập nhật: 11/11/2026, sau tích hợp Skincare Architect 3D (đồng bộ dữ liệu sàn, nối Beauty Finder). Phân loại A–E chi tiết: [AUDIT.md](AUDIT.md).

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
| Mã giảm giá | Mã toàn sàn (Admin) + mã shop (người bán); mỗi đơn tối đa 1 mã sàn + 1 mã mỗi shop; database tính và chia giảm giá |
| Giao diện | Bố cục tham khảo ri98.netlify.app (thanh trên, hero vòm, tiêu đề chữ có chân), giữ màu tím lavender của Worth & Me; không lấy ảnh, tên hay nội dung của trang tham khảo |
| 4 tính năng chuyên biệt (Skin Quiz, Skin Roadmap, Skincare Architect, Beauty Quest) | Nhóm khác phụ trách. **Skincare Architect 3D** (gói v1.0.2) ở `/skincare-architect`: code của nhóm 3D giữ nguyên, website đồng bộ sản phẩm của sàn, sản phẩm đã mua, câu trả lời và bộ đề xuất của Beauty Finder; giao diện theo Worth & Me (sáng/tối). Xem [SKINCARE-3D.md](SKINCARE-3D.md). 3 tính năng còn lại chưa có. Beauty Finder để người dùng tự chọn loại da, không tự đánh giá da |
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
| Skincare Architect 3D | Nhúng module nhóm 3D (`/skincare-architect`) + lớp nhúng (màu/font Worth & Me, sáng/tối, ẩn cửa hàng mẫu); đồng bộ danh mục sàn, sản phẩm đã mua, mục tiêu từ Beauty Finder, bộ đề xuất; gợi ý mua cho bước còn thiếu / mục tiêu chưa đáp ứng; tách dữ liệu module theo tài khoản; người bán khai báo công dụng, thời điểm dùng, vùng thoa (migration 010); Beauty Finder dùng dữ liệu này để chấm điểm, bỏ chế độ "Theo các bước" (trùng chức năng), thêm bộ đề xuất cho chu trình; nút "Xếp vào chu trình" trên trang sản phẩm | DB 10 · e2e 45 · Finder 54 · toàn bộ: DB 529/529, e2e 535/535 |
| Đợt C | Chân trang gọn (bỏ "Về dự án", dòng học tập); Admin sửa Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản, thanh thông báo, mô tả chân trang (`/admin/pages`); tin nhắn khách ↔ cửa hàng, khách ↔ bộ phận hỗ trợ (`/messages`, `/seller/messages`, `/admin/messages`, khung chat nổi); danh mục Nước hoa, Nam giới + loại mới; menu danh mục thả xuống; Thương hiệu A–Z (`/brands`); thanh trượt khoảng giá; banner 3 slide hoa–bướm–mỹ phẩm tự vẽ (nàng, chàng, nước hoa); Beauty Finder cho cả nam và nữ, câu hỏi theo 5 nhóm sản phẩm | DB 75 · e2e 75 · Finder 33 · toàn bộ: DB 519/519, e2e 469/469 |
| Đợt B | Giao diện mới (trang chủ, danh sách, chi tiết, giỏ, đặt hàng, shop); gợi ý + lịch sử tìm kiếm; lọc thương hiệu, điểm, còn hàng, thẻ bộ lọc; trang sản phẩm nhiều ảnh, tab Mô tả/Thành phần/Cách dùng/Thông tin, chia sẻ, so sánh (`/compare`), mua ngay, đã xem gần đây; mã giảm giá (`/vouchers`, `/seller/vouchers`, `/admin/vouchers`); chọn món trong giỏ; chống đặt trùng; tự hủy đơn QR quá 24 giờ; thông báo (`/notifications`); nhãn "Đã mua hàng", báo cáo đánh giá | DB 76 · e2e 79 · toàn bộ: DB 444/444, e2e 377/377 |
| Đợt A | Đánh giá sản phẩm (chỉ khách đã nhận hàng; sửa/xóa; người bán trả lời ở `/seller/reviews`; Admin ẩn ở `/admin/reviews`); theo dõi shop, yêu thích (`/favorites`); số liệu thật thay số mẫu ("Chưa có đánh giá" thay "0.0"); loại "Tạo kiểu tóc"; trang Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản; nén ảnh WebP khi tải lên; ẩn shop chưa có sản phẩm khỏi trang chủ; sửa chữ cũ trên trang chủ | DB 69 · e2e 68 · toàn bộ: DB 368/368, e2e 298/298 |

## Môi trường thật

| Việc | Trạng thái |
|---|---|
| 6 migration đầu, dữ liệu mẫu, Super Admin trên Supabase thật | Nhóm đã chạy, kết quả đúng (10/2026) |
| Deploy Netlify từ GitHub (worthandme.netlify.app) | Đã chạy |
| Migration 007 (Đợt A) | Nhóm đã chạy |
| Migration 008 (Đợt B) | Nhóm đã chạy |
| Migration 009 (Đợt C) | Cần chạy trước khi merge Đợt C (Pull Request đã merge; nếu chưa chạy, chạy ngay) |
| Migration 010 (Skincare Architect 3D) | **Chưa chạy**: chạy trong SQL Editor trước khi merge Pull Request Skincare Architect 3D, sau đó chạy lại `supabase/seed/demo_catalog.sql` |
| `npm run build` với thư viện thật | GitHub Actions tự chạy trên mỗi Pull Request (file `.github/workflows/build.yml`) |
| Vòng mua bán đầy đủ trên bản thật (20 bước trong [DEPLOY.md](DEPLOY.md) mục 7) | Nhóm đang kiểm tra |

## Giới hạn đã biết (chấp nhận cho đồ án, ghi để nhóm trả lời khi được hỏi)

| Giới hạn | Ghi chú |
|---|---|
| Tài khoản bị khóa vẫn đăng nhập được ở tầng Supabase Auth | Database chặn mọi thao tác, giao diện tự đăng xuất. Chặn tận gốc cần Edge Function giữ `service_role` |
| Đơn QR chưa thanh toán giữ tồn kho tối đa 24 giờ | Tự hủy khi có người đặt hàng hoặc mở trang đơn sau hạn (không có tác vụ chạy nền) |
| Danh mục cho trang chủ, Beauty Finder, giỏ hàng tải tối đa 1.000 sản phẩm đang bán | Trang danh sách sản phẩm đã tìm/lọc/phân trang trong database nên không bị giới hạn này |
| Tổng tiền đơn cha giữ nguyên khi một đơn con bị hủy | Trang đơn ghi chú rõ; số tiền từng đơn con vẫn đúng |
| Chưa có biến thể (dung tích/màu) | Mỗi biến thể tạm đăng thành 1 sản phẩm |
| Thông báo chỉ trong website | Chưa gửi email/đẩy về điện thoại; chuông tự cập nhật mỗi phút |
| Tin nhắn tự tải lại mỗi 8 giây khi đang mở (không dùng kết nối thời gian thực) | Đủ cho đồ án; chỉ gửi chữ, chưa gửi ảnh |
| Beauty Finder đọc nhóm hương, tình trạng tóc từ chữ trong mô tả sản phẩm | Cửa hàng ghi rõ nốt hương, công dụng trong mô tả thì gợi ý chính xác hơn |
| Lịch sử tìm kiếm, đã xem gần đây, danh sách so sánh lưu trên trình duyệt | Chỉ là tiện ích riêng từng máy, không phải dữ liệu dùng chung |
| Đánh giá chưa có ảnh đính kèm | Chỉ chấm sao + nhận xét chữ |
| Skincare Architect 3D: chu trình, nhật ký, ảnh lưu trên trình duyệt (module của nhóm 3D), chưa lên Supabase; mô hình 3D thật chưa kiểm tra được trong môi trường của Claude (chỉ kiểm tra chế độ 2D) | Xem [SKINCARE-3D.md](SKINCARE-3D.md); thử bước "Mô hình 3D" trên Deploy Preview |
| Sản phẩm do người bán tạo trước migration 010 chưa có công dụng/thời điểm dùng | Người bán bổ sung ở form sản phẩm (mục "Chu trình skincare"); chưa khai báo thì module báo "thiếu dữ liệu", không đoán |

## Đang chờ nhóm cung cấp

- Logo chính thức, tên nhóm, danh sách thành viên, email hỗ trợ của sàn (`src/config/brand.ts`).
- Kết quả kiểm tra 20 bước trên bản thật.
