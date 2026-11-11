-- =============================================================================
-- Worth & Me — Migration 010: thông tin chu trình skincare cho sản phẩm (dùng cho Skincare Architect 3D)
--
-- Chạy SAU migration 001..009. Một lần, trong Supabase SQL Editor.
--
-- Skincare Architect 3D (modules/skincare-3d, của nhóm 3D) dựng chu trình từ dữ liệu sản phẩm và KHÔNG tự đoán
-- dữ liệu thiếu. Người bán khai báo 3 trường dưới đây (không bắt buộc) cho sản phẩm chăm sóc da:
--   skincare_functions : công dụng khai báo (cleanse, hydrate, oil-control, exfoliate, renewal, antioxidant, uv-protect, soothe)
--   use_period         : dùng buổi sáng (am), tối (pm) hay cả hai (both)
--   apply_zones        : vùng thoa (face = toàn mặt, forehead, cheekL, cheekR, chin)
-- Sản phẩm chưa khai báo vẫn bán bình thường; trong Skincare Architect chỉ hiện "Thiếu dữ liệu" cho sản phẩm đó.
-- Quyền: ai cũng đọc (cột công khai như các cột sản phẩm khác); chỉ chủ shop sửa sản phẩm của mình (RLS sẵn có của products).
-- =============================================================================

alter table public.products
  add column skincare_functions text[] not null default '{}'
    check (skincare_functions <@ array['cleanse', 'hydrate', 'oil-control', 'exfoliate', 'renewal', 'antioxidant', 'uv-protect', 'soothe']::text[]
           and cardinality(skincare_functions) <= 8),
  add column use_period text
    check (use_period in ('am', 'pm', 'both')),
  add column apply_zones text[] not null default '{}'
    check (apply_zones <@ array['face', 'forehead', 'cheekL', 'cheekR', 'chin']::text[] and cardinality(apply_zones) <= 5);

comment on column public.products.skincare_functions is 'Công dụng người bán khai báo, dùng cho Skincare Architect 3D. Không suy đoán từ tên.';
comment on column public.products.use_period is 'am | pm | both — thời điểm dùng người bán khai báo.';
comment on column public.products.apply_zones is 'Vùng thoa minh họa trên mô hình khuôn mặt.';

-- Đọc: products đã cấp select toàn bảng cho anon/authenticated (migration 002), cột mới tự đọc được.
grant insert (skincare_functions, use_period, apply_zones), update (skincare_functions, use_period, apply_zones)
  on public.products to authenticated;
