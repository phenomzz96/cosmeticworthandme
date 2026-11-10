# Kịch bản trình diễn (khoảng 12–15 phút)

Chuẩn bị trước buổi demo (sau khi làm xong [DEPLOY.md](DEPLOY.md)):

| Vai | Tài khoản | Chuẩn bị |
|---|---|---|
| Super Admin | `realmanutd1234@gmail.com` | Đã chạy `bootstrap_super_admin` |
| Người bán | 1 tài khoản thành viên | Đã mở shop, Admin đã duyệt, có 2–3 sản phẩm có ảnh thật |
| Khách hàng | 1 tài khoản thành viên khác | Đã có 1 địa chỉ |

Mở sẵn 3 cửa sổ trình duyệt (hoặc 3 trình duyệt khác nhau) cho 3 vai. Chạy `supabase/seed/demo_catalog.sql` để trang chủ có sẵn hàng.
Mở dashboard Supabase vài giờ trước để project không bị tạm dừng.

## 1. Khách hàng (4 phút)

1. Trang chủ: giới thiệu thương hiệu, banner (nếu đã thêm), danh mục, chế độ sáng/tối.
2. **Beauty Finder**: trả lời 5 câu → gợi ý sản phẩm. Nhấn mạnh: gợi ý dựa trên thông tin sản phẩm, không chẩn đoán y khoa.
3. Gõ "nia" ở ô tìm kiếm → gợi ý hiện ngay. Tìm "kem chong nang" (không dấu) → lọc theo thương hiệu, giá, "chỉ còn hàng" → bộ lọc hiện thành thẻ, "Xóa tất cả".
4. Mở chi tiết sản phẩm: nhiều ảnh, tab Thành phần / Cách dùng, **So sánh** 2 sản phẩm (`/compare`), **Chia sẻ**.
5. Trang shop → **Lưu** mã giảm giá của shop vào Ví voucher.
6. Thêm 3 sản phẩm của 2 shop vào giỏ → bỏ chọn 1 món → nhập mã shop + mã toàn sàn → giảm giá hiện ngay.
7. **Đặt hàng** → chọn địa chỉ, COD → có mã đơn, giảm giá ghi trên đơn; món không chọn vẫn trong giỏ. Nhấn mạnh: giảm giá do database tính lại, bấm đặt 2 lần chỉ ra 1 đơn.

## 2. Người bán (4 phút)

0. Chuông **Thông báo** có "Đơn mới …" (khách cũng nhận thông báo khi người bán xác nhận).
1. `/seller` → tổng quan: đơn chờ xác nhận, doanh thu, cảnh báo sắp hết hàng.
2. **Đơn hàng** → đơn vừa đặt: chỉ thấy phần của shop mình, có địa chỉ giao → Xác nhận → Chuẩn bị → Giao → Đã giao.
3. **Sản phẩm** → thêm sản phẩm mới: lưu nháp, tải ảnh, đăng bán.
4. Quay lại cửa sổ khách: đơn COD đã "Đã thanh toán", tồn kho và lượt bán cập nhật.
5. Khách mở đơn đã giao → **Đánh giá sản phẩm** → chấm sao, viết nhận xét. Người bán vào **Đánh giá** trả lời. Nhấn mạnh: chỉ người đã nhận hàng mới đánh giá được, điểm do database tính.

## 3. Thanh toán QR mô phỏng (2 phút)

1. Khách đặt đơn chọn "Chuyển khoản QR (mô phỏng)" → hiện mã QR. Nói rõ: mã chỉ chứa mã đơn và số tiền, không có tài khoản ngân hàng, không có tiền thật.
2. Bấm "Tôi đã chuyển khoản" → chờ xác nhận. Người bán thử giao → bị chặn vì chưa xác nhận tiền.
3. Admin `/admin/orders` → "Xác nhận đã nhận tiền" → người bán giao được.

## 4. Quản trị viên (3 phút)

1. `/admin` tổng quan: số liệu và "Việc cần xử lý".
2. `/admin/shops`: duyệt / từ chối shop có lý do.
3. `/admin/products`: ẩn một sản phẩm vi phạm → sản phẩm biến mất khỏi website, người bán thấy lý do.
4. `/admin/brand`: đổi màu chủ đạo → mọi thiết bị đổi theo.
5. `/admin/reviews`: lọc "Bị khách báo cáo" → ẩn một đánh giá vi phạm (nhập lý do) → điểm sản phẩm tính lại.
6. `/admin/vouchers`: tạo mã toàn sàn (giảm %, có mức tối đa và đơn tối thiểu); người bán tạo mã của shop ở `/seller/vouchers`.
7. `/admin/audit`: nhật ký ghi lại mọi thao tác trên.

## 5. Bảo mật (1 phút, nếu được hỏi)

- Quyền được kiểm tra trong database (Row Level Security), không chỉ ẩn nút ở giao diện.
- Giá, phí ship, tổng tiền, tồn kho do database tính khi đặt hàng; sửa giá trên trình duyệt không có tác dụng.
- Người bán chỉ thấy thông tin giao hàng của đơn thuộc shop mình; không ai đọc được sổ địa chỉ của người khác.
- Có thể minh họa bằng lệnh trong DevTools ở mục 7 của [DEPLOY.md](DEPLOY.md).

## Câu hỏi có thể gặp

| Câu hỏi | Trả lời ngắn |
|---|---|
| Thanh toán có thật không? | Không. COD là thu tiền khi giao; QR là mô phỏng, chờ giảng viên đồng ý mới tích hợp cổng thật |
| Hai người cùng mua món cuối cùng? | Database khóa dòng sản phẩm khi đặt; người thứ hai nhận thông báo hết hàng |
| Người bán tự sửa lượt bán / điểm đánh giá được không? | Không, database không cấp quyền sửa các cột đó; điểm tính từ đánh giá thật, lượt bán tính từ đơn đã giao |
| Có tự viết đánh giá ảo được không? | Không: database chỉ nhận đánh giá của người có đơn đã giao chứa sản phẩm đó, mỗi người 1 đánh giá / sản phẩm |
| Mã giảm giá có bị sửa ở trình duyệt được không? | Không: trình duyệt chỉ gửi mã, database kiểm tra hạn, lượt, đơn tối thiểu và tự tính số tiền giảm |
| Đơn QR không trả tiền thì sao? | Sau 24 giờ hệ thống tự hủy và trả hàng về kho |
| Dữ liệu lưu ở đâu? | PostgreSQL trên Supabase; ảnh ở Supabase Storage; không dùng localStorage làm cơ sở dữ liệu |
