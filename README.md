# Worth & Me – Sàn mỹ phẩm nhiều cửa hàng

Dự án học tập môn Nhập môn Công nghệ thông tin.
Stack: React 19 + Vite + TypeScript + Tailwind CSS v4, backend Supabase (Auth, PostgreSQL + RLS, Storage), deploy Netlify.

> **Trạng thái:** đủ các giai đoạn 0–6 theo kế hoạch: tài khoản và phân quyền, kênh người bán, mua sắm (tìm kiếm, giỏ hàng, sổ địa chỉ),
> đặt hàng nhiều cửa hàng, thanh toán COD và QR **mô phỏng**, trang quản trị. Đã kiểm thử database trên PostgreSQL và giao diện với Supabase giả lập;
> **chưa** chạy trên Supabase thật. Chi tiết: [docs/STATUS.md](docs/STATUS.md) · Triển khai: [docs/DEPLOY.md](docs/DEPLOY.md) · Kịch bản demo: [docs/DEMO.md](docs/DEMO.md) · Kiểm thử: [docs/TESTING.md](docs/TESTING.md).

## 1. Chạy trên Windows (VS Code)

Cần cài: [Node.js LTS](https://nodejs.org) (≥ 20.19), Git, VS Code.

```powershell
git clone <url-repo-cua-nhom>
cd <thu-muc-repo>
npm install                    # lần đầu
copy .env.example .env.local   # rồi điền 2 giá trị Supabase (mục 2)
npm run dev                    # mở http://localhost:5173
```

Chưa điền `.env.local` thì website vẫn chạy với dữ liệu mẫu, các trang tài khoản báo "chưa kết nối".

| Lệnh | Việc |
|---|---|
| `npm run build` | Kiểm tra TypeScript và build bản production vào `dist/` |
| `npm run preview` | Chạy thử bản build |
| `npm run typecheck` | Chỉ kiểm tra lỗi TypeScript |

Extension VS Code nên cài: ESLint, Prettier, Tailwind CSS IntelliSense.

## 2. Cấu hình Supabase (làm một lần cho cả nhóm)

1. Tạo project tại [supabase.com](https://supabase.com) (gói Free). Chọn region gần Việt Nam (Singapore).
2. **Organization → Team**: mời đủ 5 thành viên. Bộ gửi email mặc định của Supabase **chỉ gửi tới thành viên team**, tối đa 2 email/giờ.
3. **SQL Editor**: lần lượt dán và **Run** 6 file trong [`supabase/migrations/`](supabase/migrations/) theo thứ tự tên file (bảng thứ tự ở [docs/DEPLOY.md](docs/DEPLOY.md#2-chạy-migration-tạo-bảng-quyền-hàm)). Mỗi file chỉ chạy một lần.
   Tùy chọn: chạy thêm [`supabase/seed/demo_catalog.sql`](supabase/seed/demo_catalog.sql) để có sẵn 5 cửa hàng mẫu và 29 sản phẩm mẫu khi trình diễn (chạy lại nhiều lần không bị trùng).
4. **Authentication → URL Configuration**:
   - Site URL: `https://worthandme.netlify.app`
   - Redirect URLs: thêm `http://localhost:5173/**` và `https://worthandme.netlify.app/**`
5. **Authentication → Sign In / Providers → Email**: bật *Confirm email*. Mục *Password*: độ dài tối thiểu 8.
6. **Project Settings → API**: chép **Project URL** và **anon public key** vào `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   ⚠️ Không bao giờ dùng `service_role` key ở frontend, không commit file `.env.local`.
7. **Netlify → Site configuration → Environment variables**: thêm 2 biến trên, rồi deploy lại.

### Khởi tạo Super Admin (một lần)

1. Chủ tài khoản `realmanutd1234@gmail.com` đăng ký trên website và bấm link xác minh trong email.
2. Một thành viên có quyền vào Supabase mở **SQL Editor** và chạy:
   ```sql
   select public.bootstrap_super_admin('realmanutd1234@gmail.com');
   ```
3. Đăng xuất rồi đăng nhập lại: nút **Trang quản trị** xuất hiện ở trang Tài khoản.
4. Từ **Trang quản trị → Người dùng**, Super Admin cấp quyền Admin cho các thành viên (tài khoản đã xác minh email).

Hàm này từ chối email chưa xác minh, và từ chối cấp thêm khi hệ thống đã có Super Admin. Trình duyệt không gọi được hàm này.

### Gửi email cho người ngoài nhóm (khi demo)

Cấu hình SMTP riêng ở **Authentication → Emails → SMTP Settings**, ví dụ dùng Brevo (có gói miễn phí). Xem [hướng dẫn của Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

### Lưu ý gói miễn phí

- Project Supabase tự tạm dừng sau 1 tuần không dùng. Trước buổi demo, mở dashboard để khởi động lại.
- Netlify Free đủ khoảng 20 lần deploy production/tháng. Kiểm tra bằng deploy preview của nhánh, chỉ merge vào `main` khi xong tính năng.

## 3. Trang quản trị (`/admin`)

| Tab | Admin | Super Admin |
|---|---|---|
| Tổng quan | Số liệu người dùng, cửa hàng, sản phẩm, đơn hàng; danh sách việc cần xử lý | Như Admin |
| Đơn hàng | Xem mọi đơn; xác nhận / từ chối thanh toán QR mô phỏng; đánh dấu đã hoàn tiền; hủy đơn khi có khiếu nại (bắt buộc lý do) | Như Admin |
| Người dùng | Xem, tìm kiếm, lọc; khóa/mở khóa khách hàng và người bán (bắt buộc lý do) | Thêm: khóa/mở khóa Admin, cấp/thu hồi quyền Admin |
| Cửa hàng | Duyệt / từ chối shop mới (từ chối cần lý do); tạm ngưng / mở lại shop đang bán. Duyệt shop thì chủ shop thành Người bán | Như Admin |
| Sản phẩm | Ẩn sản phẩm vi phạm (kèm lý do, chủ shop thấy lý do và không tự bỏ ẩn được), bỏ ẩn | Như Admin |
| Banner | Thêm banner trang chủ (chỉ liên kết trong website), bật/tắt, hẹn giờ, sắp xếp, xóa; tối đa 10 | Như Admin |
| Nhật ký | Xem mọi thao tác quản trị: ai, lúc nào, lý do | Như Admin |
| Thương hiệu | Đổi tên, logo, favicon, màu, phí vận chuyển; khôi phục phiên bản trước | Như Admin |

Không ai tự khóa hoặc tự đổi quyền của chính mình; Super Admin không bị khóa, hạ quyền hay xóa qua website.
Admin không tự duyệt cửa hàng của chính mình. Các quy tắc này nằm trong database, không chỉ ở giao diện.

## 3b. Kênh người bán (`/seller`)

Tài khoản nào đã đăng nhập cũng mở được **1 cửa hàng**. Luồng:

1. `/seller` → điền tên, đường dẫn, giới thiệu, liên hệ → shop ở trạng thái **Chờ duyệt**.
2. Trong lúc chờ: hoàn thiện thông tin, logo, ảnh bìa (`/seller/shop`), thêm sản phẩm (`/seller/products`). Khách **chưa** thấy gì.
3. Admin duyệt ở `/admin/shops` → shop **Đang hoạt động**, sản phẩm "Đang bán" hiện cho khách. Bị từ chối: sửa theo lý do rồi bấm **Gửi duyệt lại**.
4. Sản phẩm: lưu **bản nháp** → tải ảnh (tối đa 8, ảnh đầu là ảnh đại diện, PNG/JPG/WebP ≤ 3 MB) → **Lưu và đăng bán**. Có thể ẩn, hiện lại, ngừng kinh doanh; chỉ xóa hẳn được bản nháp.
5. Shop bị **tạm ngưng**: sản phẩm biến mất khỏi website, chủ shop chỉ xem, không sửa được.

6. **Đơn hàng** (`/seller/orders`): Xác nhận → Đang chuẩn bị → Đang giao → Đã giao, hoặc từ chối/hủy kèm lý do (khách thấy lý do).
   Người bán thấy tên, SĐT, địa chỉ người nhận của đơn thuộc shop mình để giao hàng. Đơn chuyển khoản chỉ giao được khi Admin đã xác nhận thanh toán.

Database kiểm tra toàn bộ: chỉ chủ shop sửa shop/sản phẩm/ảnh/đơn của mình, không tự duyệt, không tự sửa điểm đánh giá hay lượt bán, giá và tồn kho hợp lệ, phải có ảnh mới đăng bán.

## 3c. Mua sắm và đặt hàng (khách hàng)

- **Tìm kiếm** không phân biệt dấu ("kem chong nang"), lọc danh mục/loại/giá/loại da, sắp xếp, phân trang 24 sản phẩm — chạy trong database.
- **Giỏ hàng**: chưa đăng nhập thì lưu trên trình duyệt; đăng nhập thì gộp và lưu theo tài khoản (mở trên máy khác vẫn còn). Mỗi sản phẩm tối đa 10, không vượt tồn kho.
- **Sổ địa chỉ** (trang Tài khoản): tối đa 10 địa chỉ, 1 mặc định. Chỉ chủ tài khoản đọc được.
- **Đặt hàng** (`/checkout`): mỗi cửa hàng thành một đơn con, phí vận chuyển cố định mỗi đơn con (Admin chỉnh ở `/admin/brand`).
  Database tính lại giá, phí, tổng tiền, kiểm tra và trừ tồn kho; giá gửi từ trình duyệt bị bỏ qua.
- **Thanh toán**:
  - COD: trả tiền khi nhận hàng; đơn tự chuyển "Đã thanh toán" khi mọi đơn con còn lại đã giao.
  - Chuyển khoản QR **mô phỏng**: hiện mã QR chỉ chứa mã đơn + số tiền, **không gắn tài khoản ngân hàng, không có tiền thật**.
    Khách bấm "Tôi đã chuyển khoản" → Admin xác nhận hoặc từ chối → người bán mới giao. Hủy sau khi đã thanh toán → "chờ hoàn tiền" → Admin đánh dấu đã hoàn (mô phỏng).
- **Đơn hàng của tôi** (`/orders`): tiến trình từng đơn con, lịch sử, hủy khi còn "Chờ xác nhận".

## 4. Thương hiệu

| Muốn đổi | Làm ở |
|---|---|
| Tên thương hiệu, logo, favicon, màu chủ đạo, phí vận chuyển | Trang **/admin/brand** trên website (Admin). Lưu trên Supabase, mọi thiết bị thấy giống nhau, có lịch sử để khôi phục |
| Giá trị mặc định khi chưa kết nối Supabase, tên nhóm, thành viên | `src/config/brand.ts` |
| Bảng màu nền, font chữ, bo góc (cả sáng và tối) | `src/styles/tokens.css` |

Ảnh logo nhận PNG/JPG/WebP tối đa 2 MB (không nhận SVG vì có thể chứa mã script).
Chưa có logo thì website dùng **logo chữ dự phòng** sinh từ tên thương hiệu.

## 5. Cấu trúc thư mục

```
supabase/
├── migrations/               ★ SQL tạo bảng, RLS, hàm phía server (chạy theo thứ tự)
├── seed/demo_catalog.sql     Dữ liệu mẫu tùy chọn (5 shop, 29 sản phẩm)
└── tests/                    Kiểm thử bảo mật trên Postgres local (xem supabase/README.md)
src/
├── app/App.tsx               Định tuyến các trang, chặn trang theo quyền
├── config/brand.ts           Giá trị thương hiệu mặc định & thông tin nhóm
├── styles/tokens.css         Màu, font, design tokens (sáng/tối)
├── lib/supabase.ts           Kết nối Supabase (chỉ dùng anon key)
├── lib/qr.ts                 Tạo mã QR (tự viết, không cần thư viện) cho thanh toán mô phỏng
├── services/                 ★ Mọi lệnh gọi dữ liệu: account, siteSettings, catalog, seller, media, cart, addresses,
│                               orders, banners, adminUsers, adminShops, adminProducts
├── features/
│   ├── auth/                 AuthProvider, RequireAuth (chặn trang theo đăng nhập/quyền)
│   ├── brand/                BrandProvider: tên, logo, màu lấy từ Supabase
│   ├── beauty-finder/        Câu hỏi + thuật toán chấm điểm gợi ý
│   ├── cart/                 Giỏ hàng: trình duyệt khi chưa đăng nhập, bảng cart_items khi đã đăng nhập
│   ├── address/              Form và sổ địa chỉ (dùng ở Tài khoản và Đặt hàng)
│   ├── orders/               Nhãn trạng thái, tiến trình đơn, mã QR mô phỏng
│   ├── home/                 Băng chuyền banner trang chủ
│   ├── seller/               SellerLayout: tải shop của người đăng nhập, tab, thông báo trạng thái
│   └── ...                   catalog, shops, routine, compare, theme
├── components/               layout (Header, Footer, Logo), ui (Form, nút, icon...)
├── types/                    Kiểu dữ liệu dùng chung
└── pages/                    Các trang; pages/admin/ (tổng quan, đơn, người dùng, cửa hàng, sản phẩm, banner,
                                nhật ký, thương hiệu); pages/seller/ (tổng quan, sản phẩm, đơn, thiết lập shop)
docs/                         STATUS (trạng thái), DEPLOY (triển khai), DEMO (kịch bản), TESTING (kiểm thử), GIT-WORKFLOW
```

## 6. Làm việc nhóm

Quy ước nhánh, commit, Pull Request và cách chia module: [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).
