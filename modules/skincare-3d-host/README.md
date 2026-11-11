# Lớp tích hợp Skincare Architect 3D vào Worth & Me

Thư mục này là code **của Worth & Me**, không phải của nhóm 3D. `scripts/copy-skincare-3d.mjs` chép các file dưới đây
cạnh module (`public/skincare-3d/`) và chèn vào `index.html` bản chép (không sửa `modules/skincare-3d`):

| File | Việc |
|---|---|
| `wm-pre.js` | Chạy TRƯỚC module: mở module trực tiếp (không nhúng) mà còn nhớ hồ sơ "HOST" của website thì quay về hồ sơ mẫu, tránh lỗi trắng trang |
| `wm-embed.css` | Khi nhúng: dùng màu, font Worth & Me (sáng/tối), ẩn thanh trên và cửa hàng mẫu "Lumière Skin" của module |
| `wm-embed.js` | Khi nhúng: mở thẳng "Routine của tôi"; nhận lệnh từ trang website (đổi giao diện sáng/tối, thêm sản phẩm Beauty Finder đề xuất vào chu trình bằng chính nút "Thêm" của module) |

Tin nhắn website → module: `{ source: 'wm-host', type: 'wm:theme' | 'wm:select', ... }`, chỉ nhận khi `event.origin === hostOrigin`
và `event.source === window.parent` (giống quy tắc của module).

Tin nhắn module → website (lớp nhúng gửi, `source: 'wm-embed'`): `wm:embed-ready`; `wm:selected` `{ added, skipped, blocked }`
(`blocked`: module chưa cho thêm vì khách chưa chọn mục tiêu; `skipped`: đã có trong chu trình hoặc không thuộc danh mục).
