-- =============================================================================
-- KIỂM THỬ MIGRATION 014 (Hồ sơ làm đẹp)
--   00_local_supabase_stub.sql → migrations 001..014 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('23000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('23000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}'),
  ('23000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}'),
  ('23000000-0000-0000-0000-0000000000d3', 'bikhoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set status = 'suspended' where email = 'bikhoa@example.com';

begin;
set local role anon;
select tests.throws($q$select public.save_beauty_profile('{"focus":"skincare"}')$q$, '42501', 'Khách vãng lai KHÔNG lưu được hồ sơ');
select tests.throws($q$select * from public.beauty_profiles$q$, '42501', 'Khách vãng lai KHÔNG đọc bảng hồ sơ');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '23000000-0000-0000-0000-0000000000d1';
select tests.check(public.save_beauty_profile('{"focus":"skincare","skinType":"oily","concerns":["acne"]}') is not null, 'Khách lưu được hồ sơ của mình');
select public.save_beauty_profile('{"focus":"skincare","skinType":"combination","concerns":["acne"]}');
select tests.check((select answers ->> 'skinType' from public.beauty_profiles) = 'combination' and (select count(*) from public.beauty_profiles) = 1, 'Lưu lần nữa: cập nhật, không tạo dòng mới');
select tests.throws($q$select public.save_beauty_profile('[1,2]')$q$, '22023', 'Dữ liệu không phải object bị từ chối');
select tests.throws(format('select public.save_beauty_profile(%L::jsonb)', jsonb_build_object('x', repeat('a', 6000))::text), '22023', 'Hồ sơ quá lớn bị từ chối');
select tests.throws($q$insert into public.beauty_profiles (user_id, answers) values ('23000000-0000-0000-0000-0000000000d2', '{}')$q$, '42501', 'KHÔNG chèn thẳng hồ sơ (kể cả cho người khác)');
select tests.throws($q$update public.beauty_profiles set answers = '{}'$q$, '42501', 'KHÔNG sửa thẳng bảng hồ sơ');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '23000000-0000-0000-0000-0000000000d2';
select tests.check((select count(*) from public.beauty_profiles) = 0, 'Người khác KHÔNG đọc được hồ sơ của khách');
select tests.check(tests.affected($q$delete from public.beauty_profiles$q$) = 0, 'Người khác KHÔNG xóa được hồ sơ của khách');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '23000000-0000-0000-0000-0000000000aa';
select tests.check((select count(*) from public.beauty_profiles) = 0, 'Admin cũng KHÔNG đọc hồ sơ làm đẹp của khách');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '23000000-0000-0000-0000-0000000000d3';
select tests.throws($q$select public.save_beauty_profile('{"focus":"skincare"}')$q$, '42501', 'Tài khoản bị khóa KHÔNG lưu được hồ sơ');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '23000000-0000-0000-0000-0000000000d1';
select tests.check(tests.affected($q$delete from public.beauty_profiles$q$) = 1, 'Khách xóa được hồ sơ của mình');
commit;
delete from public.profiles where email = 'khach2@example.com';
select tests.check(true, 'Xóa tài khoản không lỗi (hồ sơ tự xóa theo)');

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
