# Quy trình Git cho nhóm 5 người

## Nhánh

| Nhánh | Dùng cho | Ai được đẩy |
|---|---|---|
| `main` | Bản ổn định, Netlify deploy production từ đây | Không ai đẩy trực tiếp; chỉ merge qua Pull Request |
| `feature/<giai-doan>-<mo-ta>` | Mỗi tính năng một nhánh, ví dụ `feature/2-seller-shop` | Người làm tính năng |
| `fix/<mo-ta>` | Sửa lỗi | Người sửa |

Bật **Branch protection** cho `main` trên GitHub: *Require a pull request before merging* + *Require 1 approval*.

## Quy trình một tính năng

```powershell
git checkout main
git pull
git checkout -b feature/2-seller-shop
# ... code, chạy thử ...
git add <các file đã sửa>
git commit -m "feat(seller): tạo shop và trang quản lý shop"
git push -u origin feature/2-seller-shop
```

Sau đó mở **Pull Request** vào `main`, nhờ một bạn review. Netlify tạo **deploy preview** cho PR để cả nhóm bấm thử (không tốn credit production).

Trước khi merge: `npm run build` phải chạy được, và đã thử luồng chính trên preview.

## Commit

Dạng `loại(phạm vi): mô tả ngắn bằng tiếng Việt`.

| Loại | Khi nào |
|---|---|
| `feat` | Thêm chức năng |
| `fix` | Sửa lỗi |
| `db` | Thêm migration SQL |
| `docs` | Tài liệu |
| `style` | Giao diện, không đổi logic |
| `refactor` | Sắp xếp lại code, không đổi hành vi |

## Database (migration)

- Mỗi thay đổi database là **một file mới** trong `supabase/migrations/`, tên bắt đầu bằng ngày giờ: `YYYYMMDDHHMMSS_mo-ta.sql`.
- **Không sửa** file migration đã chạy trên Supabase. Muốn đổi thì viết file mới.
- Chỉ **một người** chạy migration lên Supabase sau khi PR được merge, và báo cho cả nhóm.

## Chia module (giảm sửa trùng file)

| Mảng | Thư mục chính | Giai đoạn |
|---|---|---|
| Tài khoản & quản trị người dùng | `src/features/auth`, `src/pages/AccountPage.tsx`, `src/pages/admin/` (users) | 1B |
| Người bán (shop, sản phẩm) | `src/pages/seller/`, `src/services/shops.ts`, `src/services/products.ts` | 2 |
| Khách hàng (danh mục, tìm kiếm, giỏ) | `src/pages/ProductsPage.tsx`, `src/features/cart`, `src/services/catalog.ts` | 3 |
| Đơn hàng & thanh toán | `src/pages/checkout/`, `src/pages/orders/`, `src/services/orders.ts` | 4–5 |
| Giao diện chung & thương hiệu | `src/components/`, `src/styles/`, `src/features/brand` | Xuyên suốt |

File dùng chung, sửa cần báo nhóm trước: `src/app/App.tsx` (thêm route), `src/components/layout/Header.tsx`, `src/styles/tokens.css`, `package.json`.

## Không đưa lên GitHub

`node_modules/`, `dist/`, `.env.local` và mọi file `.env` thật, khóa `service_role`, mật khẩu. File `.gitignore` đã chặn sẵn.
Nếu lỡ commit một khóa bí mật: báo nhóm ngay và **tạo khóa mới** trong Supabase (xóa commit không đủ, vì lịch sử Git vẫn còn).
