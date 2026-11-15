# Tài sản thương hiệu

Logo, biểu tượng và favicon chính thức do nhóm cung cấp (11/2026). Đường dẫn khai báo trong `src/config/brand.ts` (mục `brand.logo`, `brand.favicon`).

| File | Dùng ở đâu |
|---|---|
| `logo-mark.webp` | Biểu tượng W&M (đỏ rượu vang, nền trong suốt): đầu trang, trang đăng nhập — chế độ sáng |
| `logo-mark-white.webp` | Biểu tượng bản trắng — chế độ tối |
| `logo-full.webp` | Logo đầy đủ chữ WORTH + slogan: chân trang — chế độ sáng |
| `logo-full-white.webp` | Logo đầy đủ bản trắng — chế độ tối |
| `favicon-32.png`, `favicon-48.png` | Biểu tượng trên tab trình duyệt (bản nền hồng) |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Biểu tượng khi thêm website ra màn hình chính điện thoại |

Các file đã được cắt bớt khoảng trống quanh logo và thu nhỏ (WebP) để tải nhanh; giữ nguyên hình vẽ và màu của nhóm.

- Admin tải logo khác ở `/admin/brand` → chân trang dùng logo của Admin. Đầu trang luôn dùng biểu tượng W&M + tên thương hiệu
  (logo đầy đủ ở cỡ nhỏ sẽ không đọc được slogan).
- Đổi biểu tượng: thay 2 file `logo-mark*.webp` (giữ tên), hoặc sửa đường dẫn trong `brand.logo.mark`.
- Màu chủ đạo `#7d2232` lấy từ logo; Admin đổi được ở `/admin/brand`.
