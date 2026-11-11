-- =============================================================================
-- KIỂM THỬ MIGRATION 010 (thông tin chu trình skincare của sản phẩm)
--   00_local_supabase_stub.sql → migrations 001..010 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}');
update public.profiles set role = 'seller' where email in ('chi@example.com', 'binh@example.com');
insert into public.shops (id, owner_id, slug, name, status) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active'),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'binh-store', 'Bình Store', 'active');
insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, stock, status) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000c1', 'serum-chi', 'Serum Chi', 'Chi Lab', 'skincare', 'serum', 200000, 5, 'draft'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000c2', 'kem-binh', 'Kem Bình', 'Bình Lab', 'skincare', 'moisturizer', 150000, 5, 'draft');

-- Đăng bán cần ảnh: thêm ảnh rồi mới chuyển sang đang bán
insert into public.product_images (product_id, path, sort_order) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000c1/a.webp', 0),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000c2/b.webp', 0);
update public.products set status = 'active' where slug in ('serum-chi', 'kem-binh');
select tests.check((select skincare_functions = '{}' and use_period is null and apply_zones = '{}' from public.products where slug = 'serum-chi'), 'Sản phẩm cũ: chưa khai báo (rỗng), không tự điền');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
update public.products set skincare_functions = '{hydrate,soothe}', use_period = 'both', apply_zones = '{face}' where slug = 'serum-chi';
select tests.check((select use_period from public.products where slug = 'serum-chi') = 'both', 'Chủ shop khai báo công dụng, thời điểm, vùng thoa cho sản phẩm của mình');
insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, stock, status, skincare_functions, use_period, apply_zones)
values ('30000000-0000-0000-0000-0000000000c1', 'bha-chi', 'BHA Chi', 'Chi Lab', 'skincare', 'exfoliant', 250000, 5, 'draft', '{exfoliate,oil-control}', 'pm', '{forehead,chin}');
select tests.check((select count(*) from public.products where slug = 'bha-chi' and use_period = 'pm') = 1, 'Tạo sản phẩm mới kèm thông tin chu trình');
select tests.throws($q$update public.products set skincare_functions = '{chua-mun}' where slug = 'serum-chi'$q$, '23514', 'Công dụng ngoài danh sách bị từ chối');
select tests.throws($q$update public.products set use_period = 'trua' where slug = 'serum-chi'$q$, '23514', 'Thời điểm dùng sai bị từ chối');
select tests.throws($q$update public.products set apply_zones = '{mui}' where slug = 'serum-chi'$q$, '23514', 'Vùng thoa ngoài danh sách bị từ chối');
update public.products set use_period = 'am' where slug = 'kem-binh';
select tests.check((select use_period from public.products where slug = 'kem-binh') is null, 'Chủ shop KHÔNG sửa được sản phẩm của shop khác (RLS)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
update public.products set skincare_functions = '{renewal}' where slug = 'serum-chi';
select tests.check((select skincare_functions from public.products where slug = 'serum-chi') = '{hydrate,soothe}', 'Khách KHÔNG sửa được thông tin chu trình');
commit;

begin;
set local role anon;
select tests.check((select skincare_functions from public.products where slug = 'serum-chi') = '{hydrate,soothe}' and (select apply_zones from public.products where slug = 'serum-chi') = '{face}', 'Khách vãng lai đọc được thông tin chu trình (dữ liệu công khai của sản phẩm)');
select tests.throws($q$update public.products set use_period = 'pm' where slug = 'serum-chi'$q$, '42501', 'Khách vãng lai KHÔNG sửa được');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
