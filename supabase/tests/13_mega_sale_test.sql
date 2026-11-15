-- =============================================================================
-- KIỂM THỬ MIGRATION 013 (Mega Sale: đăng ký, duyệt, tự áp giá / trả giá, chặn đổi giá)
--   00_local_supabase_stub.sql → migrations 001..013 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('22000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('22000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('22000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('22000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('22000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set role = 'seller' where email in ('chi@example.com', 'binh@example.com');

insert into public.shops (id, owner_id, slug, name, status) values
  ('32000000-0000-0000-0000-0000000000c1', '22000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active'),
  ('32000000-0000-0000-0000-0000000000c2', '22000000-0000-0000-0000-0000000000c2', 'binh-store', 'Bình Store', 'active');
insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, sale_price, stock, status, placeholder_visual) values
  ('42000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-0000000000c1', 'serum-chi', 'Serum Chi', 'Chi Lab', 'skincare', 'serum', 400000, 380000, 50, 'active', '{"shape":"dropper"}'),
  ('42000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-0000000000c1', 'toner-chi', 'Toner Chi', 'Chi Lab', 'skincare', 'toner', 200000, null, 50, 'active', '{"shape":"bottle"}'),
  ('42000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-0000000000c2', 'son-binh', 'Son Bình', 'Bình Color', 'makeup', 'lipstick', 100000, null, 50, 'active', '{"shape":"lipstick"}');
insert into public.addresses (id, user_id, recipient_name, phone, province, district, street) values
  ('52000000-0000-0000-0000-0000000000d1', '22000000-0000-0000-0000-0000000000d1', 'Khách Một', '0901111111', 'Hà Nội', 'Ba Đình', '1 Điện Biên Phủ');

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated, anon;

-- ---------------------------------------------------------------- Quyền
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.admin_save_mega_sale(null, 'Tự tạo', '', now(), now() + interval '1 day', 10, true)$q$, '42501', 'Người bán KHÔNG tạo được Mega Sale');
select tests.throws($q$insert into public.mega_sales (title, starts_at, ends_at, is_active) values ('Chèn', now(), now() + interval '1 day', true)$q$, '42501', 'KHÔNG chèn thẳng vào bảng Mega Sale');
commit;
begin;
set local role anon;
select tests.throws($q$select public.seller_enroll_mega_sale(gen_random_uuid(), '42000000-0000-0000-0000-000000000001', 1000)$q$, '42501', 'Khách vãng lai KHÔNG gọi được hàm đăng ký');
commit;

-- ---------------------------------------------------------------- Admin tạo đợt sale
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000a1';
insert into tests.ctx values ('s1', public.admin_save_mega_sale(null, 'Mega Sale 11.11', 'Giảm sâu toàn sàn', now() - interval '1 hour', now() + interval '2 days', 20, true));
insert into tests.ctx values ('s_later', public.admin_save_mega_sale(null, 'Mega Sale 12.12', '', now() + interval '20 days', now() + interval '21 days', 10, true));
insert into tests.ctx values ('s_off', public.admin_save_mega_sale(null, 'Đợt đang tắt', '', now() - interval '1 hour', now() + interval '1 day', 10, false));
select tests.throws($q$select public.admin_save_mega_sale(null, 'Quá dài', '', now(), now() + interval '40 days', 10, true)$q$, '23514', 'Đợt sale dài quá 31 ngày bị từ chối');
select tests.throws($q$select public.admin_save_mega_sale(null, 'Sai giờ', '', now(), now() - interval '1 day', 10, true)$q$, '22023', 'Kết thúc trước bắt đầu bị từ chối');
commit;
select tests.check((select count(*) from public.audit_logs where action = 'mega_sale.create') = 3, 'Tạo Mega Sale được ghi nhật ký');
begin;
set local role anon;
select tests.check((select count(*) from public.mega_sales) = 2, 'Khách vãng lai thấy đợt đang/sắp mở, không thấy đợt đang tắt');
commit;

-- ---------------------------------------------------------------- Người bán đăng ký
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's1'), '42000000-0000-0000-0000-000000000001', 350000)$q$, '22023', 'Giảm chưa đủ mức tối thiểu (20%) bị từ chối');
select tests.throws($q$select public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's1'), '42000000-0000-0000-0000-000000000003', 50000)$q$, '42501', 'KHÔNG đăng ký sản phẩm shop khác');
select tests.throws($q$select public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's_off'), '42000000-0000-0000-0000-000000000001', 200000)$q$, 'P0002', 'KHÔNG đăng ký đợt đang tắt');
insert into tests.ctx values ('i1', public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's1'), '42000000-0000-0000-0000-000000000001', 300000));
insert into tests.ctx values ('i2', public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's1'), '42000000-0000-0000-0000-000000000002', 150000));
insert into tests.ctx values ('i_later', public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's_later'), '42000000-0000-0000-0000-000000000002', 160000));
select tests.check((select count(*) from public.mega_sale_items where status = 'pending') = 3, 'Người bán thấy đăng ký của shop mình (chờ duyệt)');
select tests.throws($q$update public.mega_sale_items set status = 'approved'$q$, '42501', 'Người bán KHÔNG tự duyệt');
select tests.throws($q$select prev_sale_price from public.mega_sale_items$q$, '42501', 'Cột nội bộ (giá cũ) không đọc được');
select tests.throws($q$select public.admin_review_mega_sale_item((select v::uuid from tests.ctx where k = 'i1'), true)$q$, '42501', 'Người bán KHÔNG gọi được hàm duyệt');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000c2';
select tests.check((select count(*) from public.mega_sale_items) = 0, 'Shop khác KHÔNG thấy đăng ký chờ duyệt');
commit;
begin;
set local role anon;
select tests.check((select count(*) from public.mega_sale_items) = 0, 'Khách vãng lai không thấy đăng ký chưa duyệt');
commit;

-- ---------------------------------------------------------------- Admin duyệt → giá sale tự áp dụng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000a1';
select tests.throws($q$select public.admin_review_mega_sale_item((select v::uuid from tests.ctx where k = 'i2'), false, '')$q$, '22023', 'Từ chối phải có lý do');
select public.admin_review_mega_sale_item((select v::uuid from tests.ctx where k = 'i1'), true);
select public.admin_review_mega_sale_item((select v::uuid from tests.ctx where k = 'i2'), false, 'Ảnh sản phẩm chưa rõ');
select public.admin_review_mega_sale_item((select v::uuid from tests.ctx where k = 'i_later'), true);
commit;
select tests.check((select sale_price from public.products where slug = 'serum-chi') = 300000, 'Đang trong giờ sale: giá sale tự áp dụng');
select tests.check((select sale_price from public.products where slug = 'toner-chi') is null, 'Đăng ký bị từ chối / đợt chưa bắt đầu: giá không đổi');
select tests.check((select count(*) from public.notifications where user_id = '22000000-0000-0000-0000-0000000000c1' and kind = 'product') = 3, 'Người bán được báo kết quả duyệt');
begin;
set local role anon;
select tests.check((select count(*) from public.mega_sale_items) = 2 and (select bool_and(status = 'approved') from public.mega_sale_items), 'Khách vãng lai thấy sản phẩm đã duyệt');
select tests.check((select sale_price from public.search_products(p_query => 'Serum Chi')) = 300000, 'Tìm kiếm hiện giá Mega Sale');
commit;

-- Không đổi giá khi đang sale
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000c1';
select tests.throws($q$update public.products set sale_price = 1000 where slug = 'serum-chi'$q$, '55006', 'Người bán KHÔNG đổi giá sale khi đang chạy Mega Sale');
select tests.throws($q$update public.products set price = 300001 where slug = 'serum-chi'$q$, '55006', 'Người bán KHÔNG đổi giá gốc khi đang chạy Mega Sale');
select tests.throws($q$select public.seller_withdraw_mega_sale((select v::uuid from tests.ctx where k = 'i1'))$q$, '55006', 'KHÔNG rút sản phẩm đang chạy sale');
select tests.throws($q$select public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's1'), '42000000-0000-0000-0000-000000000001', 200000)$q$, '55006', 'KHÔNG sửa giá đăng ký khi đang chạy');
update public.products set stock = 49 where slug = 'serum-chi';
select tests.check((select stock from public.products where slug = 'serum-chi') = 49, 'Vẫn sửa được tồn kho khi đang sale');
commit;

-- Đặt hàng dùng đúng giá Mega Sale
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000d1';
insert into tests.ctx values ('o1', (public.place_order('[{"product_id":"42000000-0000-0000-0000-000000000001","quantity":2}]', '52000000-0000-0000-0000-0000000000d1', 'cod', '') ->> 'id'));
commit;
select tests.check((select items_subtotal from public.orders where id = (select v::uuid from tests.ctx where k = 'o1')) = 600000, 'Đặt hàng tính theo giá Mega Sale (2 × 300.000đ)');

-- Admin trùng thời gian
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000a1';
insert into tests.ctx values ('s_overlap', public.admin_save_mega_sale(null, 'Flash trùng giờ', '', now(), now() + interval '1 day', 10, true));
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000c1';
insert into tests.ctx values ('i_ov', public.seller_enroll_mega_sale((select v::uuid from tests.ctx where k = 's_overlap'), '42000000-0000-0000-0000-000000000001', 250000));
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000a1';
select tests.throws($q$select public.admin_review_mega_sale_item((select v::uuid from tests.ctx where k = 'i_ov'), true)$q$, '23P01', 'KHÔNG duyệt một sản phẩm vào 2 đợt sale trùng giờ');
select tests.throws($q$select public.admin_delete_mega_sale((select v::uuid from tests.ctx where k = 's1'))$q$, '23503', 'KHÔNG xóa đợt sale đã bắt đầu');
select public.admin_delete_mega_sale((select v::uuid from tests.ctx where k = 's_later'));
commit;
select tests.check((select count(*) from public.mega_sales where id = (select v::uuid from tests.ctx where k = 's_later')) = 0, 'Xóa được đợt sale chưa bắt đầu');

-- ---------------------------------------------------------------- Hết sale → trả giá cũ
-- Admin tắt đợt sale: giá trả về giá sale riêng trước đó của người bán (380.000đ)
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000a1';
select public.admin_save_mega_sale(id, title, tagline, starts_at, ends_at, min_discount_percent, false) from public.mega_sales where id = (select v::uuid from tests.ctx where k = 's1');
commit;
select tests.check((select sale_price from public.products where slug = 'serum-chi') = 380000, 'Tắt đợt sale: trả về giá sale cũ của người bán');
select tests.check((select not applied from public.mega_sale_items where id = (select v::uuid from tests.ctx where k = 'i1')), 'Đăng ký không còn ở trạng thái đang áp dụng');
-- Bật lại rồi để hết giờ: lần đặt hàng / đồng bộ tiếp theo tự trả giá
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000a1';
select public.admin_save_mega_sale(id, title, tagline, starts_at, ends_at, min_discount_percent, true) from public.mega_sales where id = (select v::uuid from tests.ctx where k = 's1');
commit;
select tests.check((select sale_price from public.products where slug = 'serum-chi') = 300000, 'Bật lại: giá sale áp dụng lại');
update public.mega_sales set starts_at = now() - interval '3 days', ends_at = now() - interval '1 minute' where id = (select v::uuid from tests.ctx where k = 's1');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000d1';
insert into tests.ctx values ('o2', (public.place_order('[{"product_id":"42000000-0000-0000-0000-000000000001","quantity":1}]', '52000000-0000-0000-0000-0000000000d1', 'cod', '') ->> 'id'));
commit;
select tests.check((select items_subtotal from public.orders where id = (select v::uuid from tests.ctx where k = 'o2')) = 380000, 'Hết giờ sale: đặt hàng tự dùng lại giá cũ (380.000đ)');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-0000000000c1';
update public.products set price = 420000 where slug = 'serum-chi';
select tests.check((select price from public.products where slug = 'serum-chi') = 420000, 'Hết sale: người bán đổi giá bình thường');
commit;
begin;
set local role anon;
select tests.check(public.sync_mega_sales() = 0, 'Khách vãng lai gọi được hàm đồng bộ (không có gì thay đổi)');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
