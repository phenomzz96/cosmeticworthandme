-- =============================================================================
-- KIỂM THỬ MIGRATION 003 (cửa hàng, sản phẩm, ảnh) — chạy trên database mới:
--   00_local_supabase_stub.sql → migrations 001, 002, 003 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{"full_name":"Chi"}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{"full_name":"Bình"}'),
  ('20000000-0000-0000-0000-0000000000c3', 'khach@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';

-- Shop mẫu do hệ thống tạo (dữ liệu demo)
insert into public.shops (id, owner_id, slug, name, status) values
  ('30000000-0000-0000-0000-000000000001', null, 'shop-mau', 'Shop Mẫu', 'active');
insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, stock, status, placeholder_visual) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'serum-mau', 'Serum mẫu', 'Demo', 'skincare', 'serum', 200000, 10, 'active', '{"shape":"dropper"}');

\set chi_shop '31000000-0000-0000-0000-0000000000c1'
\set binh_shop '31000000-0000-0000-0000-0000000000c2'

-- ---------------------------------------------------------------- Khách vãng lai
begin;
set local role anon;
select tests.check((select count(*) from public.shops) = 1, 'Khách vãng lai chỉ thấy shop đang hoạt động');
select tests.check((select count(*) from public.products) = 1, 'Khách vãng lai thấy sản phẩm đang bán của shop hoạt động');
select tests.throws($q$insert into public.shops (owner_id, name, slug) values (null, 'Ẩn danh', 'an-danh')$q$, '42501',
  'Khách vãng lai KHÔNG tạo được shop');
commit;

-- ---------------------------------------------------------------- Chi mở shop
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
insert into public.shops (owner_id, name, slug, tagline) values (auth.uid(), 'Chi Beauty', 'chi-beauty', 'Mỹ phẩm thuần chay');
select tests.check((select status from public.shops where owner_id = auth.uid()) = 'pending', 'Shop mới mở ở trạng thái chờ duyệt');
select tests.throws($q$insert into public.shops (owner_id, name, slug) values (auth.uid(), 'Shop Thứ Hai', 'shop-thu-hai')$q$, '23505',
  'Mỗi tài khoản chỉ mở 1 shop');
select tests.throws($q$insert into public.shops (owner_id, name, slug) values ('20000000-0000-0000-0000-0000000000c3', 'Mạo Danh', 'mao-danh')$q$, '42501',
  'KHÔNG mở shop đứng tên người khác');
select tests.throws($q$insert into public.shops (owner_id, name, slug, status) values (auth.uid(), 'Tự Duyệt', 'tu-duyet', 'active')$q$, '42501',
  'KHÔNG tự đặt trạng thái active khi tạo shop');
select tests.throws($q$update public.shops set status = 'active' where owner_id = auth.uid()$q$, '42501', 'Chủ shop KHÔNG tự duyệt shop');
select tests.throws($q$update public.shops set verified = true, rating = 5 where owner_id = auth.uid()$q$, '42501',
  'Chủ shop KHÔNG tự gắn nhãn xác minh / điểm đánh giá');
select tests.throws($q$update public.shops set slug = 'doi-slug' where owner_id = auth.uid()$q$, '42501', 'Đường dẫn shop không đổi được sau khi tạo');
select tests.throws($q$update public.shops set theme_color = 'tim' where owner_id = auth.uid()$q$, '23514', 'Màu chủ đạo sai định dạng bị từ chối');
select tests.check(tests.affected($q$update public.shops set tagline = 'Mỹ phẩm thuần chay, không thử nghiệm trên động vật', theme_color = '#2a7f62' where owner_id = auth.uid()$q$) = 1,
  'Chủ shop sửa được thông tin và màu chủ đạo');
commit;

-- Đặt id cố định cho shop của Chi để dùng ở các bước sau
update public.shops set id = :'chi_shop' where slug = 'chi-beauty';

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.throws($q$insert into public.shops (owner_id, name, slug) values (auth.uid(), 'CHI BEAUTY', 'chi-beauty-2')$q$, '23505',
  'Tên shop trùng (khác hoa/thường) bị từ chối');
insert into public.shops (owner_id, name, slug) values (auth.uid(), 'Bình Store', 'binh-store');
select tests.check(tests.affected($q$update public.shops set name = 'Chiếm Shop' where slug = 'chi-beauty'$q$) = 0,
  'Người khác KHÔNG sửa được shop của Chi');
select tests.check((select count(*) from public.shops where slug = 'chi-beauty') = 0, 'Shop đang chờ duyệt của người khác không hiển thị');
commit;
update public.shops set id = :'binh_shop' where slug = 'binh-store';

-- ---------------------------------------------------------------- Chi đăng sản phẩm khi shop đang chờ duyệt
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws(format($q$insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price) values (gen_random_uuid(), %L, 'tu-dat-id', 'Tự đặt id', 'X', 'skincare', 'serum', 100000)$q$, :'chi_shop'), '42501',
  'Không tự đặt id sản phẩm (database tự sinh)');
insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, sale_price, stock, skin_types)
values (:'chi_shop', 'toner-hoa-hong-chi', 'Toner hoa hồng', 'Chi Lab', 'skincare', 'toner', 250000, 199000, 20, '{dry,normal}');
select tests.check((select status from public.products where slug = 'toner-hoa-hong-chi') = 'draft', 'Sản phẩm mới mặc định là bản nháp');
commit;

update public.products set id = '41000000-0000-0000-0000-000000000001' where slug = 'toner-hoa-hong-chi';

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws(format($q$insert into public.products (shop_id, slug, name, brand_name, category, product_type, price) values (%L, 'chen-hang', 'Chen hàng', 'X', 'skincare', 'serum', 100000)$q$, :'binh_shop'), '42501',
  'KHÔNG thêm sản phẩm vào shop người khác');
select tests.throws($q$update public.products set price = -5 where slug = 'toner-hoa-hong-chi'$q$, '23514', 'Giá âm bị từ chối');
select tests.throws($q$update public.products set sale_price = 300000 where slug = 'toner-hoa-hong-chi'$q$, '23514', 'Giá khuyến mãi cao hơn giá gốc bị từ chối');
select tests.throws($q$update public.products set stock = -1 where slug = 'toner-hoa-hong-chi'$q$, '23514', 'Tồn kho âm bị từ chối');
select tests.throws($q$update public.products set skin_types = '{da-xanh}' where slug = 'toner-hoa-hong-chi'$q$, '23514', 'Loại da không hợp lệ bị từ chối');
select tests.throws($q$update public.products set rating = 5, sold_count = 9999 where slug = 'toner-hoa-hong-chi'$q$, '42501',
  'Chủ shop KHÔNG tự sửa điểm đánh giá / lượt bán');
select tests.throws($q$update public.products set featured = true where slug = 'toner-hoa-hong-chi'$q$, '42501', 'Chủ shop KHÔNG tự gắn "nổi bật"');
select tests.throws(format($q$update public.products set shop_id = %L where slug = 'toner-hoa-hong-chi'$q$, :'binh_shop'), '42501',
  'KHÔNG chuyển sản phẩm sang shop khác');
select tests.throws($q$update public.products set status = 'active' where slug = 'toner-hoa-hong-chi'$q$, '23514', 'Chưa có ảnh thì không đăng bán được');
select tests.throws(format($q$insert into public.product_images (product_id, path) values ('41000000-0000-0000-0000-000000000001', %L)$q$, :'binh_shop' || '/anh.png'), '23514',
  'Ảnh nằm trong thư mục shop khác bị từ chối');
insert into public.product_images (product_id, path, sort_order) values ('41000000-0000-0000-0000-000000000001', :'chi_shop' || '/toner-1.webp', 0);
select tests.check(tests.affected($q$update public.products set status = 'active' where slug = 'toner-hoa-hong-chi'$q$) = 1, 'Có ảnh rồi thì đăng bán được');
insert into public.product_images (product_id, path, sort_order)
  select '41000000-0000-0000-0000-000000000001', :'chi_shop' || '/toner-' || g || '.webp', g from generate_series(2, 8) g;
select tests.throws(format($q$insert into public.product_images (product_id, path) values ('41000000-0000-0000-0000-000000000001', %L)$q$, :'chi_shop' || '/toner-9.webp'), '23514',
  'Ảnh thứ 9 bị từ chối (tối đa 8)');
select tests.check(tests.affected($q$delete from public.products where slug = 'toner-hoa-hong-chi'$q$) = 0, 'Sản phẩm đã đăng không xóa hẳn được');
insert into public.products (shop_id, slug, name, brand_name, category, product_type, price) values (:'chi_shop', 'nhap-chi', 'Bản nháp', 'Chi Lab', 'makeup', 'lipstick', 150000);
select tests.check(tests.affected($q$delete from public.products where slug = 'nhap-chi'$q$) = 1, 'Bản nháp xóa được');
insert into storage.objects (bucket_id, name) values ('shop-media', :'chi_shop' || '/logo.png');
select tests.check(true, 'Chủ shop tải ảnh vào thư mục shop của mình');
select tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('shop-media', %L)$q$, :'binh_shop' || '/hack.png'), '42501',
  'KHÔNG tải ảnh vào thư mục shop người khác');
select tests.check(tests.affected(format($q$update public.shops set logo_path = %L where owner_id = auth.uid()$q$, :'chi_shop' || '/logo.png')) = 1,
  'Gắn logo từ thư mục của shop');
select tests.throws(format($q$update public.shops set cover_path = %L where owner_id = auth.uid()$q$, :'binh_shop' || '/bia.png'), '23514',
  'Ảnh bìa trỏ sang thư mục shop khác bị từ chối');
select tests.throws($q$select public.admin_set_shop_status(public.product_shop('41000000-0000-0000-0000-000000000001'), 'active')$q$, '42501',
  'Chủ shop KHÔNG gọi được hàm duyệt shop');
commit;

begin;
set local role anon;
select tests.check((select count(*) from public.products where slug = 'toner-hoa-hong-chi') = 0, 'Sản phẩm của shop chưa duyệt không hiển thị công khai');
select tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('shop-media', %L)$q$, :'chi_shop' || '/anon.png'), '42501',
  'Khách vãng lai KHÔNG tải ảnh lên được');
commit;

-- ---------------------------------------------------------------- Admin duyệt
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.check((select name from public.admin_list_shops() limit 1) in ('Chi Beauty', 'Bình Store'), 'Danh sách shop: shop chờ duyệt lên đầu');
select tests.check((select product_count from public.admin_list_shops(p_search => 'chi')) = 1, 'Danh sách shop kèm số sản phẩm');
select tests.check((public.admin_set_shop_status(:'chi_shop', 'active')).status = 'active', 'Admin duyệt shop của Chi');
select tests.throws(format($q$select public.admin_set_shop_status(%L, 'rejected', 'đổi ý muộn')$q$, :'chi_shop'), '22023',
  'Chuyển trạng thái không hợp lệ (đang hoạt động → từ chối) bị chặn');
select tests.throws(format($q$select public.admin_set_shop_status(%L, 'rejected')$q$, :'binh_shop'), '22023', 'Từ chối shop phải có lý do');
select tests.check((public.admin_set_shop_status(:'binh_shop', 'rejected', 'Tên shop chưa phù hợp, thiếu mô tả')).status = 'rejected', 'Admin từ chối shop có lý do');
commit;

select tests.check(role = 'seller', 'Duyệt shop thì chủ shop thành người bán') from public.profiles where email = 'chi@example.com';
select tests.check((select count(*) from public.audit_logs where action in ('shop.approve', 'shop.reject')) = 2, 'Duyệt và từ chối shop được ghi nhật ký');

begin;
set local role anon;
select tests.check((select count(*) from public.products where slug = 'toner-hoa-hong-chi') = 1, 'Shop được duyệt: khách thấy sản phẩm');
select tests.check((select count(*) from public.product_images i join public.products p on p.id = i.product_id where p.slug = 'toner-hoa-hong-chi') = 8,
  'Khách thấy đủ ảnh sản phẩm');
commit;

-- Ảnh cuối cùng của sản phẩm đang bán
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
delete from public.product_images where product_id = '41000000-0000-0000-0000-000000000001' and sort_order > 0;
select tests.throws($q$delete from public.product_images where product_id = '41000000-0000-0000-0000-000000000001'$q$, '23514',
  'Không xóa được ảnh cuối của sản phẩm đang bán');
commit;

-- ---------------------------------------------------------------- Shop bị từ chối: sửa rồi gửi duyệt lại
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.check((select status_reason from public.shops where owner_id = auth.uid()) = 'Tên shop chưa phù hợp, thiếu mô tả', 'Chủ shop thấy lý do bị từ chối');
select tests.check(tests.affected($q$update public.shops set description = 'Chuyên dưỡng thể chính hãng' where owner_id = auth.uid()$q$) = 1,
  'Shop bị từ chối vẫn sửa được thông tin');
select tests.throws(format($q$insert into public.products (shop_id, slug, name, brand_name, category, product_type, price) values (%L, 'binh-sp', 'SP', 'B', 'body-care', 'body-wash', 100000)$q$, :'binh_shop'), '42501',
  'Shop bị từ chối KHÔNG thêm được sản phẩm');
select tests.check((public.resubmit_shop()).status = 'pending', 'Gửi duyệt lại → chờ duyệt');
select tests.throws($q$select public.resubmit_shop()$q$, '22023', 'Không gửi duyệt lại khi không bị từ chối');
commit;

-- ---------------------------------------------------------------- Tạm ngưng shop
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000aa';
select tests.throws(format($q$select public.admin_set_shop_status(%L, 'suspended', 'ab')$q$, :'chi_shop'), '22023', 'Tạm ngưng phải có lý do đủ dài');
select tests.check((public.admin_set_shop_status(:'chi_shop', 'suspended', 'Bán hàng không rõ nguồn gốc')).status = 'suspended', 'Admin tạm ngưng shop');
commit;

begin;
set local role anon;
select tests.check((select count(*) from public.products where slug = 'toner-hoa-hong-chi') = 0, 'Shop tạm ngưng: sản phẩm ẩn khỏi khách');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check((select count(*) from public.products where shop_id = :'chi_shop') = 1, 'Chủ shop bị tạm ngưng vẫn xem được sản phẩm của mình');
select tests.check(tests.affected($q$update public.products set stock = 99 where slug = 'toner-hoa-hong-chi'$q$) = 0, 'Shop tạm ngưng: không sửa được sản phẩm');
select tests.check(tests.affected($q$update public.shops set tagline = 'x' where owner_id = auth.uid()$q$) = 0, 'Shop tạm ngưng: không sửa được thông tin shop');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.check((public.admin_set_shop_status(:'chi_shop', 'active')).status = 'active', 'Admin mở lại shop');
commit;
select tests.check((select count(*) from public.audit_logs where action in ('shop.suspend', 'shop.reactivate')) = 2, 'Tạm ngưng và mở lại được ghi nhật ký');

-- ---------------------------------------------------------------- Chủ shop bị khóa tài khoản
update public.profiles set status = 'suspended', suspended_reason = 'Kiểm thử' where email = 'chi@example.com';
begin;
set local role anon;
select tests.check((select count(*) from public.products where slug = 'toner-hoa-hong-chi') = 0, 'Chủ shop bị khóa: sản phẩm ẩn khỏi khách');
select tests.check((select count(*) from public.shops where slug = 'chi-beauty') = 0, 'Chủ shop bị khóa: shop ẩn khỏi khách');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check(tests.affected($q$update public.products set stock = 5 where slug = 'toner-hoa-hong-chi'$q$) = 0, 'Chủ shop bị khóa không sửa được sản phẩm');
select tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('shop-media', %L)$q$, :'chi_shop' || '/khoa.png'), '42501',
  'Chủ shop bị khóa không tải ảnh lên được');
commit;
update public.profiles set status = 'active', suspended_reason = null where email = 'chi@example.com';

-- ---------------------------------------------------------------- Admin không tự duyệt shop của mình
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
insert into public.shops (owner_id, name, slug) values (auth.uid(), 'Shop Của Admin', 'shop-cua-admin');
select tests.throws($q$select public.admin_set_shop_status((select id from public.shops where slug = 'shop-cua-admin'), 'active')$q$, '42501',
  'Admin KHÔNG tự duyệt shop của chính mình');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c3';
select tests.throws($q$select * from public.admin_list_shops()$q$, '42501', 'Khách hàng KHÔNG xem được danh sách quản trị shop');
commit;

-- ---------------------------------------------------------------- Tổng kết
select * from tests.summary();
select count(*) filter (where ok) as dat, count(*) filter (where not ok) as truot, count(*) as tong from tests.results;
