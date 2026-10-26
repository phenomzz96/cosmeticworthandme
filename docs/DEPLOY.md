# Triển khai Worth & Me (Supabase + Netlify)

Làm lần lượt từ trên xuống. Mất khoảng 30–45 phút cho lần đầu.
Tất cả thao tác trên Supabase làm bằng tài khoản của nhóm; không gửi mật khẩu hay khóa bí mật cho ai qua chat.

## 0. Trước khi bắt đầu

Trên máy một thành viên (Windows, VS Code):

```powershell
npm.cmd install
npm.cmd run build      # phải chạy xong không lỗi, tạo thư mục dist/
```

Nếu `npm run build` báo lỗi TypeScript, gửi nguyên văn lỗi cho người phụ trách code trước khi deploy.

## 1. Tạo project Supabase

1. [supabase.com](https://supabase.com) → **New project**, region **Southeast Asia (Singapore)**, đặt mật khẩu database mạnh và lưu ở nơi an toàn của nhóm.
2. **Organization → Team**: mời 5 thành viên (bộ gửi email mặc định chỉ gửi tới thành viên team).

## 2. Chạy migration (tạo bảng, quyền, hàm)

**SQL Editor → New query**, dán toàn bộ nội dung từng file rồi bấm **Run**, đúng thứ tự:

| # | File | Nội dung |
|---|---|---|
| 1 | `supabase/migrations/20261025000001_foundation.sql` | Hồ sơ, vai trò, cài đặt website, nhật ký, bucket `brand` |
| 2 | `supabase/migrations/20261026000001_admin_users.sql` | Quản trị tài khoản |
| 3 | `supabase/migrations/20261026000002_shops_products.sql` | Cửa hàng, sản phẩm, ảnh, bucket `shop-media` |
| 4 | `supabase/migrations/20261027000001_search_addresses_cart.sql` | Tìm kiếm, sổ địa chỉ, giỏ hàng |
| 5 | `supabase/migrations/20261028000001_orders_payments.sql` | Đơn hàng, thanh toán COD/QR mô phỏng, quản trị đơn và sản phẩm |
| 6 | `supabase/migrations/20261029000001_banners.sql` | Banner trang chủ |

Mỗi file chạy **một lần**. Báo "Success. No rows returned" là đúng.
Nếu một file báo lỗi giữa chừng: chụp màn hình lỗi, **không** chạy tiếp file sau, không sửa file migration; báo người phụ trách database.

Tùy chọn cho buổi demo: chạy `supabase/seed/demo_catalog.sql` để có 5 cửa hàng mẫu và 29 sản phẩm mẫu (dùng hình minh họa). Chạy lại không bị trùng.

Kiểm tra nhanh trong SQL Editor:

```sql
select max(total_count) from public.search_products();   -- 29 nếu đã chạy dữ liệu mẫu
select shipping_fee from public.site_settings;    -- 30000
```

## 3. Cấu hình đăng nhập

**Authentication → URL Configuration**
- Site URL: `https://worthandme.netlify.app` (đổi theo tên site Netlify thật của nhóm)
- Redirect URLs: `http://localhost:5173/**` và `https://worthandme.netlify.app/**`

**Authentication → Sign In / Providers → Email**: bật *Confirm email*; *Password* tối thiểu 8 ký tự.

Muốn người ngoài nhóm (giảng viên) đăng ký được: cấu hình SMTP riêng ở **Authentication → Emails → SMTP Settings** (ví dụ Brevo gói miễn phí).

## 4. Lấy khóa công khai

**Project Settings → API**: chép **Project URL** và **anon public** key.

- Máy cá nhân: tạo file `.env.local` (đã có trong `.gitignore`):
  ```
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJ...
  ```
- ⚠️ Chỉ dùng **anon** key. Không bao giờ đưa `service_role` key vào frontend, `.env.local` lên GitHub, hay gửi qua chat.

## 5. Deploy Netlify

1. Netlify → **Add new site → Import from Git** → chọn repo GitHub của nhóm, nhánh `main`.
2. Build command `npm run build`, publish directory `dist` (đã khai báo trong `netlify.toml`).
3. **Site configuration → Environment variables**: thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
4. **Deploys → Trigger deploy**. Biến môi trường chỉ có hiệu lực sau khi deploy lại.

`netlify.toml` đã chuyển mọi đường dẫn về `index.html`, nên tải lại trang `/products` hay `/orders/...` không bị 404.

## 6. Khởi tạo Super Admin (một lần)

1. Chủ email `realmanutd1234@gmail.com` đăng ký trên website đã deploy, bấm link xác minh.
2. Trong SQL Editor:
   ```sql
   select public.bootstrap_super_admin('realmanutd1234@gmail.com');
   ```
3. Đăng xuất, đăng nhập lại → có nút **Trang quản trị**.
4. **Trang quản trị → Người dùng**: cấp quyền Admin cho thành viên (tài khoản đã xác minh email).

## 7. Kiểm tra sau khi deploy (bắt buộc trước buổi demo)

Đánh dấu từng dòng. Dòng nào không đạt: ghi lại bước, kết quả thấy được, ảnh chụp màn hình.

| # | Kiểm tra | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang chủ ở cửa sổ ẩn danh | Logo, tên thương hiệu, sản phẩm mẫu hiển thị |
| 2 | Tìm "kem chong nang" (không dấu) | Ra kem chống nắng |
| 3 | Đăng ký tài khoản mới, xác minh email, đăng nhập | Vào được trang Tài khoản |
| 4 | Thêm địa chỉ trong Tài khoản | Địa chỉ lưu, tải lại trang vẫn còn |
| 5 | Thêm 2 sản phẩm của 2 shop vào giỏ, đăng xuất, đăng nhập ở trình duyệt khác | Giỏ vẫn còn 2 sản phẩm |
| 6 | Đặt hàng COD | Có mã đơn WM..., giỏ trống, đơn hiện trong "Đơn hàng của tôi" với 2 đơn con |
| 7 | Mở cửa hàng bằng tài khoản thứ hai | Shop ở trạng thái Chờ duyệt |
| 8 | Admin duyệt shop ở `/admin/shops` | Shop Đang hoạt động, chủ shop thành Người bán |
| 9 | Chủ shop thêm sản phẩm + ảnh, đăng bán | Sản phẩm hiện cho khách (chờ tối đa 1 phút) |
| 10 | Khách đặt sản phẩm đó, chủ shop xử lý tới "Đã giao" | Đơn COD tự chuyển "Đã thanh toán" |
| 11 | Đặt đơn "Chuyển khoản QR (mô phỏng)", bấm "Tôi đã chuyển khoản" | Đơn "Chờ xác nhận thanh toán" |
| 12 | Admin xác nhận ở `/admin/orders` | Đơn "Đã thanh toán", người bán giao được |
| 13 | Tài khoản thường mở `/admin` | Báo không có quyền |
| 14 | Bật/tắt chế độ tối ở các trang trên | Chữ đọc rõ, không vỡ bố cục |
| 15 | Mở trên điện thoại | Không bị kéo ngang, nút bấm được |

Kiểm tra bảo mật nhanh (DevTools → Console, khi đang đăng nhập tài khoản thường, chạy ở `npm run dev`):

```js
const { supabase } = await import('/src/lib/supabase.ts')
await supabase.from('profiles').update({ role: 'admin' }).eq('email', '<email của bạn>')   // phải lỗi 42501
await supabase.from('orders').update({ grand_total: 1 }).eq('code', 'WM000000-000000')     // phải lỗi 42501
await supabase.rpc('admin_dashboard_stats')                                                  // phải lỗi 42501
```

## 8. Lưu ý gói miễn phí

- Supabase Free tạm dừng project sau 1 tuần không dùng: mở dashboard trước buổi demo vài giờ.
- Netlify Free ~20 lần deploy production/tháng: thử trên deploy preview của Pull Request, chỉ merge vào `main` khi đã kiểm tra.
- Storage Free 1 GB: ảnh sản phẩm tối đa 3 MB/ảnh, nên dùng ảnh nén (WebP/JPG).

## 9. Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Website báo "chưa kết nối Supabase" | Thiếu biến môi trường hoặc chưa deploy lại | Kiểm tra 2 biến trên Netlify, Trigger deploy |
| Đăng ký không nhận được email | Email không thuộc team Supabase, hoặc vượt 2 email/giờ | Mời vào team hoặc cấu hình SMTP |
| Link xác minh mở ra localhost | Site URL / Redirect URLs sai | Sửa mục 3 |
| Lỗi "function ... does not exist" | Thiếu migration | Chạy migration còn thiếu theo thứ tự |
| Trang sản phẩm trống dù đã thêm sản phẩm | Shop chưa được duyệt, sản phẩm chưa đăng bán, hoặc chưa có ảnh | Kiểm tra trạng thái ở `/seller/products` và `/admin/shops` |
| `npm` báo lỗi trên Windows PowerShell | Chính sách chạy script | Dùng `npm.cmd` thay cho `npm`; đường dẫn thư mục không chứa ký tự `&` |
