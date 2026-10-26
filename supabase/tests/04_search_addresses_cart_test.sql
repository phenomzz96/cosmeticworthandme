-- =============================================================================
-- KIỂM THỬ MIGRATION 004 (tìm kiếm, sổ địa chỉ, giỏ hàng) — chạy trên database mới:
--   00_local_supabase_stub.sql → migrations 001..004 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c3', 'khoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set status = 'suspended', suspended_reason = 'Kiểm thử' where email = 'khoa@example.com';

-- Shop hoạt động (mẫu) và shop chờ duyệt của Chi
insert into public.shops (id, owner_id, slug, name, status) values
  ('30000000-0000-0000-0000-000000000001', null, 'shop-mau', 'Shop Mẫu', 'active'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'pending');

insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, sale_price, stock, status, skin_types, key_ingredients, sold_count, created_at, placeholder_visual) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'kem-chong-nang-sang', 'Kem chống nắng Sáng Mịn', 'Nắng Lab', 'skincare', 'sunscreen', 300000, 250000, 5, 'active', '{oily,combination}', '{Zinc Oxide}', 50, now() - interval '3 day', '{"shape":"tube"}'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'son-li-do-gach', 'Son lì đỏ gạch', 'Môi Xinh', 'makeup', 'lipstick', 180000, null, 20, 'active', '{}', '{}', 120, now() - interval '1 day', '{"shape":"lipstick"}'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'serum-niacinamide', 'Serum Niacinamide 10%', 'Da Khỏe', 'skincare', 'serum', 420000, null, 0, 'active', '{dry}', '{Niacinamide,Kẽm PCA}', 10, now() - interval '5 day', '{"shape":"dropper"}'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'kem-nhap-mau', 'Kem chống nắng nháp', 'Nắng Lab', 'skincare', 'sunscreen', 300000, null, 5, 'draft', '{}', '{}', 0, now(), null),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'kem-chi', 'Kem chống nắng Chi', 'Chi Lab', 'skincare', 'sunscreen', 200000, null, 9, 'active', '{}', '{}', 0, now(), '{"shape":"tube"}');

-- ---------------------------------------------------------------- Tìm kiếm
begin;
set local role anon;
select tests.check((select count(*) from public.search_products('kem chong nang')) = 1,
  'Tìm không dấu "kem chong nang" ra đúng 1 sản phẩm công khai (không lấy bản nháp, không lấy shop chờ duyệt)');
select tests.check((select slug from public.search_products('KEM CHỐNG NẮNG')) = 'kem-chong-nang-sang', 'Tìm có dấu, chữ hoa vẫn đúng');
select tests.check((select slug from public.search_products('son moi')) = 'son-li-do-gach', 'Tìm theo tên loại sản phẩm tiếng Việt ("son môi")');
select tests.check((select slug from public.search_products('kem pca')) = 'serum-niacinamide', 'Tìm theo thành phần chính');
select tests.check((select count(*) from public.search_products('kem  nắng   sáng')) = 1, 'Nhiều từ khóa: sản phẩm phải chứa tất cả các từ');
select tests.check((select count(*) from public.search_products('không có từ này')) = 0, 'Từ khóa không khớp → 0 kết quả');
select tests.check((select count(*) from public.search_products(p_max_price => 260000)) = 2, 'Lọc giá dùng giá khuyến mãi (250.000 ≤ 260.000)');
select tests.check((select count(*) from public.search_products(p_skin_type => 'oily')) = 2, 'Lọc loại da: gồm sản phẩm hợp da dầu và sản phẩm không giới hạn loại da');
select tests.check((select count(*) from public.search_products(p_types => array['serum','lipstick'])) = 2, 'Lọc nhiều loại sản phẩm');
select tests.check((select array_agg(slug) from public.search_products(p_sort => 'price-asc')) = array['son-li-do-gach','kem-chong-nang-sang','serum-niacinamide'],
  'Sắp xếp giá tăng dần theo giá thực bán');
select tests.check((select array_agg(slug) from public.search_products(p_sort => 'newest')) = array['son-li-do-gach','kem-chong-nang-sang','serum-niacinamide'],
  'Sắp xếp mới nhất');
select tests.check((select array_agg(slug) from public.search_products()) = array['son-li-do-gach','kem-chong-nang-sang','serum-niacinamide'],
  'Mặc định sắp xếp bán chạy');
select tests.check((select count(*) = 1 and max(total_count) = 3 from public.search_products(p_limit => 1, p_offset => 1)), 'Phân trang: trả 1 dòng, total_count = 3');
select tests.check((select count(*) from public.search_products(p_limit => 100000)) = 3, 'Giới hạn số dòng không làm lỗi');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check((select count(*) from public.search_products('chi lab')) = 0, 'Chủ shop chờ duyệt cũng không thấy sản phẩm của mình trong tìm kiếm công khai');
select tests.throws($q$update public.products set search_text = 'hack' where slug = 'kem-chi'$q$, '42501', 'Chủ shop KHÔNG ghi trực tiếp search_text');
update public.products set name = 'Kem chống nắng Chi Mới', key_ingredients = '{Tinosorb}' where slug = 'kem-chi';
select tests.check((select search_text from public.products where slug = 'kem-chi') like '%kem chong nang chi moi%tinosorb%', 'Đổi tên/thành phần → search_text tự cập nhật');
commit;

-- ---------------------------------------------------------------- Sổ địa chỉ
begin;
set local role anon;
select tests.throws($q$select * from public.addresses$q$, '42501', 'Khách vãng lai KHÔNG đọc được bảng địa chỉ');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
insert into public.addresses (recipient_name, phone, province, district, ward, street, label)
values ('Chi Nguyễn', '0901234567', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', '12 Lê Lợi', 'Nhà');
select tests.check((select is_default from public.addresses where street = '12 Lê Lợi'), 'Địa chỉ đầu tiên tự là mặc định');
insert into public.addresses (recipient_name, phone, province, district, street, is_default)
values ('Chi (công ty)', '0907654321', 'TP. Hồ Chí Minh', 'Quận 3', '45 Võ Văn Tần', true);
select tests.check((select count(*) from public.addresses where is_default) = 1 and (select is_default from public.addresses where street = '45 Võ Văn Tần'),
  'Chọn mặc định mới → chỉ còn 1 địa chỉ mặc định');
update public.addresses set is_default = true where street = '12 Lê Lợi';
select tests.check((select street from public.addresses where is_default) = '12 Lê Lợi' and (select count(*) from public.addresses where is_default) = 1,
  'Đổi lại mặc định bằng UPDATE');
select tests.throws($q$insert into public.addresses (recipient_name, phone, province, district, street) values ('X', 'abc', 'Hà Nội', 'Ba Đình', '1 Phố')$q$, '23514',
  'Số điện thoại sai định dạng bị từ chối');
select tests.throws($q$insert into public.addresses (user_id, recipient_name, phone, province, district, street) values ('20000000-0000-0000-0000-0000000000c2', 'Gán', '0901111111', 'Hà Nội', 'Ba Đình', '1 Phố')$q$, '42501',
  'KHÔNG tạo địa chỉ đứng tên người khác');
select tests.throws($q$update public.addresses set user_id = '20000000-0000-0000-0000-0000000000c2'$q$, '42501', 'KHÔNG chuyển địa chỉ sang tài khoản khác');
insert into public.addresses (recipient_name, phone, province, district, street)
select 'Chi ' || g, '0900000000', 'Hà Nội', 'Cầu Giấy', 'Số ' || g || ' Xuân Thủy' from generate_series(3, 10) g;
select tests.throws($q$insert into public.addresses (recipient_name, phone, province, district, street) values ('Chi 11', '0900000000', 'Hà Nội', 'Cầu Giấy', 'Số 11')$q$, '23514',
  'Tối đa 10 địa chỉ');
delete from public.addresses where street = '12 Lê Lợi';
select tests.check((select count(*) from public.addresses where is_default) = 1, 'Xóa địa chỉ mặc định → địa chỉ khác tự thành mặc định');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.check((select count(*) from public.addresses) = 0, 'Người khác KHÔNG thấy địa chỉ, SĐT của Chi');
select tests.check(tests.affected($q$update public.addresses set phone = '0999999999'$q$) = 0, 'Người khác KHÔNG sửa được địa chỉ của Chi');
select tests.check(tests.affected($q$delete from public.addresses$q$) = 0, 'Người khác KHÔNG xóa được địa chỉ của Chi');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000aa';
select tests.check((select count(*) from public.addresses) = 0, 'Kể cả Super Admin cũng không đọc trực tiếp sổ địa chỉ của khách');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c3';
select tests.throws($q$insert into public.addresses (recipient_name, phone, province, district, street) values ('Bị khóa', '0901234567', 'Hà Nội', 'Ba Đình', '1 Phố')$q$, '42501',
  'Tài khoản bị khóa KHÔNG thêm địa chỉ');
commit;

-- ---------------------------------------------------------------- Giỏ hàng
begin;
set local role anon;
select tests.throws($q$select public.cart_set_item('40000000-0000-0000-0000-000000000002', 1)$q$, '42501', 'Khách vãng lai KHÔNG gọi được hàm giỏ hàng');
select tests.throws($q$select * from public.cart_items$q$, '42501', 'Khách vãng lai KHÔNG đọc bảng giỏ hàng');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.check(public.cart_set_item('40000000-0000-0000-0000-000000000002', 3) = 3, 'Thêm sản phẩm vào giỏ');
select tests.check(public.cart_set_item('40000000-0000-0000-0000-000000000002', 50) = 10, 'Số lượng tự giới hạn tối đa 10');
select tests.check(public.cart_set_item('40000000-0000-0000-0000-000000000001', 8) = 5, 'Số lượng tự giới hạn theo tồn kho');
select tests.throws($q$select public.cart_set_item('40000000-0000-0000-0000-000000000004', 1)$q$, 'P0002', 'KHÔNG thêm sản phẩm nháp vào giỏ');
select tests.throws($q$select public.cart_set_item('40000000-0000-0000-0000-000000000005', 1)$q$, 'P0002', 'KHÔNG thêm sản phẩm của shop chưa duyệt vào giỏ');
select tests.throws($q$insert into public.cart_items (product_id, quantity) values ('40000000-0000-0000-0000-000000000004', 1)$q$, '42501',
  'Ghi thẳng vào bảng cũng không thêm được sản phẩm nháp');
select tests.throws($q$update public.cart_items set quantity = 11$q$, '23514', 'Số lượng > 10 bị database từ chối');
select tests.throws($q$insert into public.cart_items (user_id, product_id, quantity) values ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 1)$q$, '42501',
  'KHÔNG thêm vào giỏ của người khác');
select tests.check(public.cart_set_item('40000000-0000-0000-0000-000000000003', 1) = 0, 'Sản phẩm hết hàng không vào giỏ (trả về 0)');
select tests.check((select count(*) from public.cart_merge('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":2},{"product_id":"40000000-0000-0000-0000-000000000004","quantity":1},{"product_id":"khong-phai-uuid","quantity":1}]'::jsonb)) = 2,
  'Gộp giỏ: bỏ qua sản phẩm nháp và dữ liệu sai, không báo lỗi');
select tests.check((select quantity from public.cart_items where product_id = '40000000-0000-0000-0000-000000000001') = 5, 'Gộp giỏ: cộng dồn nhưng không vượt tồn kho');
select public.cart_set_item('40000000-0000-0000-0000-000000000002', 0);
select tests.check((select count(*) from public.cart_items) = 1, 'Đặt số lượng 0 → xóa khỏi giỏ');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check((select count(*) from public.cart_items) = 0, 'Người khác KHÔNG thấy giỏ hàng của Bình');
select tests.check(tests.affected($q$delete from public.cart_items$q$) = 0, 'Người khác KHÔNG xóa được giỏ của Bình');
commit;

-- ---------------------------------------------------------------- Tổng kết
select * from tests.summary();
select count(*) filter (where ok) as dat, count(*) filter (where not ok) as truot, count(*) as tong from tests.results;
