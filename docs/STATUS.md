# Trạng thái tính năng

Cập nhật: 16/11/2026, sau Đợt G–J (điều hướng gọn, Beauty Quest + hộp quà, Mega Sale, Beauty Finder nâng cao). Phân loại A–E chi tiết: [AUDIT.md](AUDIT.md).

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
| 4 tính năng chuyên biệt (Skin Quiz, Skin Roadmap, Skincare Architect, Beauty Quest) | Nhóm khác phụ trách. **Skincare Architect 3D** (gói v1.0.2) ở `/skincare-architect`: code của nhóm 3D giữ nguyên, website đồng bộ sản phẩm của sàn, sản phẩm đã mua, câu trả lời và bộ đề xuất của Beauty Finder; giao diện theo Worth & Me (sáng/tối). Xem [SKINCARE-3D.md](SKINCARE-3D.md). **Beauty Quest** (gồm Skin Quiz, Skin Roadmap, nhiệm vụ, Glow Match) là website riêng của nhóm phụ trách (beautyquest.netlify.app, tài khoản riêng); trang đó chặn nhúng (`X-Frame-Options: DENY`) nên `/beauty-quest` giới thiệu và mở ở tab mới. Phần thưởng (hộp quà may mắn) chạy trên tài khoản Worth & Me. Khi nhóm Beauty Quest gửi mã nguồn, có thể ghép thẳng như Skincare 3D và nối Beauty Points với hộp quà. Beauty Finder để người dùng tự chọn loại da, không tự đánh giá da |
| Hộp quà Beauty Quest | Admin tạo đợt quà theo dịp (`/admin/rewards`): voucher / quà tặng / chúc may mắn, tỷ lệ, số lượng. Máy chủ chọn quà và tạo voucher riêng (chỉ chủ tài khoản dùng được). Quà tặng hiện vật: Admin liên hệ / gửi kèm đơn tiếp theo, đánh dấu "Đã gửi" |
| Mega Sale | Admin tạo đợt sale (tối đa 31 ngày, mức giảm tối thiểu); người bán đăng ký giá sale, Admin duyệt; database tự áp giá trong giờ sale và trả giá cũ khi hết |
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
| Đợt J | Beauty Finder nâng cao: 4 cách tìm (Tiêu chuẩn giữ nguyên; Nhanh 3 câu; Chuyên sâu thêm thành phần muốn có, thói quen hằng ngày, ngân sách cả bộ; Mua quà tặng không cần loại da người nhận, chọn kiểu quà an toàn / sang trọng); "Vì sao …% phù hợp?" chấm từng tiêu chí; bộ chu trình trong ngân sách (mỗi bước một sản phẩm, vượt ngân sách thì đổi sang lựa chọn rẻ hơn cùng bước), thêm cả bộ vào giỏ; hồ sơ làm đẹp lưu vào tài khoản, dùng lại trên mọi thiết bị, xóa được (migration 014) | DB 14 · e2e 34 · Finder 70 |
| Đợt I | Mega Sale: Admin tạo đợt sale (`/admin/mega-sale`), người bán đăng ký giá sale (`/seller/mega-sale`), Admin duyệt / từ chối có lý do; trang `/mega-sale` có đồng hồ đếm ngược, deal đang giảm / sắp lên sàn; thanh menu, menu điện thoại, trang chủ tự hiện lối vào khi có đợt sale; database tự áp giá sale trong giờ sale, trả giá cũ khi hết giờ hoặc Admin tắt, luôn đồng bộ trước khi tính tiền đơn hàng, khóa đổi giá sản phẩm đang chạy sale (migration 013) | DB 37 · e2e 33 |
| Đợt H | Beauty Quest: trang `/beauty-quest` giới thiệu trò chơi (mở ở tab mới) + hộp quà may mắn; Admin tạo đợt quà theo dịp, giải thưởng voucher / quà tặng / chúc may mắn, tỷ lệ, số lượng, bộ giải mẫu, xem người trúng, đánh dấu đã gửi quà (`/admin/rewards`); máy chủ kiểm tra lượt (N lượt/ngày + lượt thưởng mỗi đơn đã giao), chọn giải theo tỷ lệ công bố, tạo voucher riêng chỉ chủ tài khoản thấy và dùng được (migration 012) | DB 48 · e2e 43 |
| Đợt G | Điều hướng gọn: 7 danh mục gom vào nút "Danh mục" (bảng thả xuống: danh mục, loại sản phẩm, thương hiệu); tính năng riêng nổi bật trên thanh menu; Thương hiệu, Cửa hàng, Ưu đãi bên phải; menu điện thoại có ô tính năng riêng, danh mục thu gọn; trang sản phẩm bỏ hàng nút danh mục lặp (danh mục nằm trong cột lọc, điện thoại có lối tắt loại sản phẩm); chân trang 4 cột ngắn với cột "Chỉ có ở Worth & Me"; trang chủ có dải "Chỉ có ở Worth & Me" | e2e 75 · toàn bộ: DB 635/635, e2e 860/860 |
| Đợt F | Giao diện "Haute Care" theo logo của nhóm + bố cục bản thiết kế "Hoa mộc": logo chính thức (biểu tượng W&M ở đầu trang và trang đăng nhập, logo đầy đủ có slogan ở chân trang, bản trắng cho chế độ tối), favicon và biểu tượng điện thoại, slogan "Haute Care, Tailored for The One."; bộ màu đỏ rượu vang – hồng phấn – vàng hồng lấy từ logo (sáng/tối, đủ tương phản); banner trang 1 dùng ảnh tràn mép phải, khối câu chuyện có ảnh trên nền hồng phấn, thẻ sản phẩm có nút "Thêm vào giỏ", dải cam kết dạng hộp, menu gạch chân, chân trang có dải thương hiệu; Skincare Architect 3D đổi màu theo; migration 011 đổi màu chủ đạo mặc định (chỉ khi Admin chưa tự chọn màu) | DB 11 · e2e 58 · toàn bộ: DB 536/536, e2e 658/658 |
| Đợt E | Hiệu suất: mọi trang trừ trang chủ tải mã theo nhu cầu, tải sẵn khi trình duyệt rảnh hoặc khi rê chuột/chạm liên kết (không tải sẵn khi bật tiết kiệm dữ liệu); dữ liệu mẫu, hộp thư, khối đánh giá không còn nằm trong lần tải đầu (mã tải ban đầu giảm khoảng 19% trong bản đo của Claude); thư viện React/Supabase tách file riêng, trình duyệt giữ lâu file có mã băm (`netlify.toml`); font tải song song, bỏ độ đậm không dùng; khối dưới màn hình đầu chỉ vẽ khi sắp cuộn tới; banner trang chủ không làm phần dưới nhảy khi đổi trang, dừng tự chuyển khi khuất màn hình hoặc thẻ bị ẩn; chuông thông báo, tin nhắn chỉ hỏi máy chủ khi thẻ đang mở. Mượt: bấm Quay lại về đúng chỗ đang xem, đổi bộ lọc không bị đưa lên đầu trang, nội dung trang hiện dần, ảnh sản phẩm hiện dần, nút có phản hồi khi nhấn, chân trang không nhảy khi trang đang tải, thanh thông báo giữ chỗ trước. Ổn định: website vừa cập nhật thì tự tải lại khi không mở được trang mới; trang lỗi chỉ báo trong vùng nội dung, có nút tải lại. Giỏ hàng báo rõ sản phẩm ngừng bán, hết hàng, số lượng giảm theo tồn kho (trước đây tự bỏ không báo); sau "Mua ngay", quay lại giỏ vẫn chọn sẵn tất cả, sản phẩm mới thêm luôn được chọn sẵn | e2e 33 · toàn bộ e2e 600/600 · kiểm tra che chữ 42 trang: 0 lỗi |
| Đợt D | Thanh tab và nhóm lọc không còn bị che chữ: máy tính thấy đủ tab (xuống dòng khi cần), màn hình nhỏ có mũi tên + mờ mép và tự cuộn tới mục đang chọn (Admin, người bán, lọc đơn/sản phẩm/đánh giá/shop, tab trang sản phẩm, danh mục, cửa hàng nổi bật); thanh danh mục không làm trang kéo ngang ở 1024–1600px (màn hình 1024–1279px ẩn mục "Cửa hàng" trên thanh này, vẫn có ở chân trang và trang chủ); quảng bá Skincare Architect 3D: trang 2 của banner trang chủ (tranh khuôn mặt + vùng thoa tự vẽ), khối giới thiệu 3 bước trên trang chủ, mục "Skincare 3D" trên thanh danh mục | e2e 31 · toàn bộ e2e 567/567 · kiểm tra che chữ 42 trang × 5 độ rộng × sáng/tối: 0 lỗi |
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
| Migration 010 (Skincare Architect 3D) | Nhóm đã chạy, dữ liệu mẫu đã chạy lại (18 sản phẩm có dữ liệu chu trình) |
| Migration 011 (màu theo logo) | Chạy trong SQL Editor nếu chưa chạy (Pull Request giao diện mới đã merge) |
| Migration 012, 013, 014 (hộp quà, Mega Sale, hồ sơ làm đẹp) | **Chưa chạy**: chạy theo thứ tự, mỗi file trước khi merge Pull Request tương ứng ([DEPLOY.md](DEPLOY.md)) |
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
| Mega Sale không có tác vụ chạy nền: giá sale được áp / trả khi có người đặt hàng, mở trang Mega Sale, trang đơn hàng hoặc Admin thao tác | Đặt hàng luôn đồng bộ trước khi tính tiền nên số tiền phải trả luôn đúng; thẻ sản phẩm có thể hiện giá cũ thêm tối đa khoảng 1 phút |
| Beauty Quest là website riêng (tài khoản, Beauty Points riêng), chưa nối điểm với hộp quà | Cần mã nguồn / API của nhóm Beauty Quest; hộp quà dùng lượt theo ngày + đơn đã giao |
| Quà tặng hiện vật của hộp quà chưa tự gắn vào đơn hàng | Admin liên hệ hoặc ghi chú gửi kèm đơn tiếp theo, đánh dấu "Đã gửi" để khách thấy |
| Sản phẩm do người bán tạo trước migration 010 chưa có công dụng/thời điểm dùng | Người bán bổ sung ở form sản phẩm (mục "Chu trình skincare"); chưa khai báo thì module báo "thiếu dữ liệu", không đoán |

## Đang chờ nhóm cung cấp

- Logo chính thức, tên nhóm, danh sách thành viên, email hỗ trợ của sàn (`src/config/brand.ts`).
- Kết quả kiểm tra 20 bước trên bản thật.
