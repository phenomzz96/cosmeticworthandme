-- =============================================================================
-- KIỂM THỬ MIGRATION 006 (banner trang chủ) — database mới:
--   00_local_supabase_stub.sql → migrations 001..006 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
insert into public.banners (title, subtitle, image_path, link_url, sort_order) values
  ('Sale chống nắng', 'Giảm đến 30%', 'banner/sale.png', '/products?category=skincare&types=sunscreen', 1);
insert into public.banners (title, image_path, is_active) values ('Banner tắt', 'banner/off.png', false);
insert into public.banners (title, image_path, starts_at) values ('Sắp diễn ra', 'banner/soon.png', now() + interval '2 day');
insert into public.banners (title, image_path, starts_at, ends_at) values ('Đã kết thúc', 'banner/old.png', now() - interval '5 day', now() - interval '1 day');
select tests.check((select count(*) from public.banners) = 4, 'Admin thêm banner và thấy tất cả (kể cả đang tắt / hết hạn)');
select tests.throws($q$insert into public.banners (title, image_path, link_url) values ('Lừa đảo', 'banner/x.png', 'https://evil.example.com')$q$, '23514',
  'Liên kết ra website ngoài bị từ chối');
select tests.throws($q$insert into public.banners (title, image_path, link_url) values ('Lừa đảo 2', 'banner/x.png', '//evil.example.com')$q$, '23514',
  'Liên kết dạng //tên-miền bị từ chối');
select tests.throws($q$insert into public.banners (title, image_path) values ('Ảnh lạ', 'logo-light/x.png')$q$, '23514', 'Ảnh banner phải nằm trong thư mục banner/');
select tests.throws($q$insert into public.banners (title, image_path, starts_at, ends_at) values ('Ngược', 'banner/x.png', now(), now() - interval '1 day')$q$, '23514',
  'Thời gian kết thúc phải sau thời gian bắt đầu');
insert into storage.objects (bucket_id, name) values ('brand', 'banner/moi.png');
select tests.check(true, 'Admin tải được ảnh vào brand/banner/');
update public.banners set is_active = false where title = 'Sale chống nắng';
update public.banners set is_active = true where title = 'Sale chống nắng';
delete from public.banners where title = 'Banner tắt';
commit;

select tests.check((select count(*) from public.audit_logs where action like 'banner.%') = 7, 'Nhật ký ghi thêm / sửa / xóa banner');

begin;
set local role anon;
select tests.check((select array_agg(title) from public.banners) = array['Sale chống nắng'], 'Khách chỉ thấy banner đang bật và trong thời gian hiển thị');
select tests.throws($q$insert into public.banners (title, image_path) values ('Ẩn danh', 'banner/x.png')$q$, '42501', 'Khách vãng lai KHÔNG thêm được banner');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$insert into public.banners (title, image_path) values ('Khách', 'banner/x.png')$q$, '42501', 'Khách hàng KHÔNG thêm được banner');
select tests.check(tests.affected($q$update public.banners set title = 'Bị sửa'$q$) = 0, 'Khách hàng KHÔNG sửa được banner');
select tests.check(tests.affected($q$delete from public.banners$q$) = 0, 'Khách hàng KHÔNG xóa được banner');
select tests.throws($q$insert into storage.objects (bucket_id, name) values ('brand', 'banner/khach.png')$q$, '42501', 'Khách hàng KHÔNG tải ảnh banner lên được');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
insert into public.banners (title, image_path) select 'Banner ' || g, 'banner/b' || g || '.png' from generate_series(1, 7) g;
select tests.throws($q$insert into public.banners (title, image_path) values ('Banner 11', 'banner/b11.png')$q$, '23514', 'Tối đa 10 banner');
select tests.throws($q$update public.banners set created_by = null$q$, '42501', 'Không sửa cột người tạo');
commit;

-- ---------------------------------------------------------------- Tổng kết
select * from tests.summary();
select count(*) filter (where ok) as dat, count(*) filter (where not ok) as truot, count(*) as tong from tests.results;
