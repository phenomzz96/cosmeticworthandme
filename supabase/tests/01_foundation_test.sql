-- =============================================================================
-- KIỂM THỬ MIGRATION 001 — chạy trên Postgres local SAU khi đã chạy:
--   00_local_supabase_stub.sql  →  migrations/20261025000001_foundation.sql
-- Mỗi kiểm tra ghi kết quả vào tests.results; cuối file in tổng kết.
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

-- Người dùng mẫu (giả lập đăng ký qua Supabase Auth)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', now(), '{"full_name":"Alice","role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com',   now(), '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'realmanutd1234@gmail.com', null, '{"full_name":"Super Admin"}'),
  ('00000000-0000-0000-0000-0000000000cc', 'carol@example.com', now(), '{"full_name":"Carol"}');

-- ---------------------------------------------------------------- Đăng ký
select tests.check(count(*) = 4, 'Đăng ký tạo hồ sơ tự động cho mỗi tài khoản') from public.profiles;
select tests.check(role = 'customer', 'Gửi role=admin lúc đăng ký vẫn chỉ là customer', role::text)
  from public.profiles where email = 'alice@example.com';
select tests.check(full_name = 'Alice', 'Họ tên lấy từ form đăng ký') from public.profiles where email = 'alice@example.com';

-- ---------------------------------------------------------------- Khách vãng lai (anon)
begin;
set local role anon;
select tests.check(count(*) = 1, 'Khách chưa đăng nhập đọc được cài đặt website') from public.site_settings;
select tests.throws('select * from public.profiles', '42501', 'Khách chưa đăng nhập không đọc được bảng hồ sơ');
select tests.throws($q$select public.update_site_settings('X', null, null, null, '#000000', 0)$q$, '42501',
  'Khách chưa đăng nhập không gọi được hàm sửa cài đặt');
commit;

-- ---------------------------------------------------------------- Customer: Alice
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

select tests.check(count(*) = 1, 'Customer chỉ thấy đúng hồ sơ của mình', count(*)::text) from public.profiles;
select tests.check(
  tests.affected($q$update public.profiles set full_name = 'Alice Nguyễn', phone = '0901234567' where id = auth.uid()$q$) = 1,
  'Customer sửa được họ tên, SĐT của mình');
select tests.throws($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, '42501',
  'Customer KHÔNG tự đổi role thành admin được');
select tests.throws($q$update public.profiles set status = 'active', suspended_reason = null where id = auth.uid()$q$, '42501',
  'Customer KHÔNG tự sửa trạng thái tài khoản được');
select tests.check(
  tests.affected($q$update public.profiles set full_name = 'hack' where id = '00000000-0000-0000-0000-00000000000b'$q$) = 0,
  'Customer KHÔNG sửa được hồ sơ người khác (đổi ID trong request)');
select tests.throws($q$update public.profiles set phone = 'abc' where id = auth.uid()$q$, '23514',
  'SĐT sai định dạng bị database từ chối');
select tests.throws($q$insert into public.profiles (id, role) values (gen_random_uuid(), 'super_admin')$q$, '42501',
  'Customer KHÔNG tự tạo hồ sơ admin được');
select tests.throws($q$select public.update_site_settings('Hack', null, null, null, '#000000', 0)$q$, '42501',
  'Customer KHÔNG sửa được cài đặt website qua hàm');
select tests.throws($q$update public.site_settings set brand_name = 'Hack'$q$, '42501',
  'Customer KHÔNG sửa trực tiếp bảng cài đặt được');
select tests.throws($q$select public.restore_site_settings(1)$q$, '42501', 'Customer KHÔNG khôi phục cài đặt được');
select tests.check(count(*) = 0, 'Customer KHÔNG đọc được audit log (0 dòng)', count(*)::text) from public.audit_logs;
select tests.throws($q$insert into public.audit_logs (action) values ('fake')$q$, '42501', 'Customer KHÔNG ghi giả audit log được');
select tests.throws($q$select public.bootstrap_super_admin('alice@example.com')$q$, '42501',
  'Customer KHÔNG gọi được hàm khởi tạo Super Admin');
select tests.throws($q$select private.log_action('x', null, null)$q$, '42501', 'Trình duyệt KHÔNG gọi được hàm nội bộ');
select tests.throws($q$insert into storage.objects (bucket_id, name) values ('brand', 'logo-light/x.png')$q$, '42501',
  'Customer KHÔNG tải ảnh lên bucket thương hiệu được');
select tests.check(public.is_admin() = false, 'is_admin() trả về false cho customer');
commit;

select tests.check(phone = '0901234567' and role = 'customer', 'Sau các thử nghiệm, role của Alice vẫn là customer')
  from public.profiles where id = '00000000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------- Khởi tạo Super Admin
select tests.throws($q$select public.bootstrap_super_admin('nobody@example.com')$q$, 'P0001',
  'Bootstrap từ chối email chưa đăng ký');
select tests.throws($q$select public.bootstrap_super_admin('realmanutd1234@gmail.com')$q$, 'P0001',
  'Bootstrap từ chối email CHƯA xác minh');
update auth.users set email_confirmed_at = now() where email = 'realmanutd1234@gmail.com';
select tests.check(public.bootstrap_super_admin('REALMANUTD1234@gmail.com') like 'Đã cấp%',
  'Bootstrap thành công sau khi email đã xác minh');
select tests.check(public.bootstrap_super_admin('realmanutd1234@gmail.com') like 'Đã cấp%',
  'Chạy lại bootstrap cho cùng người không lỗi');
select tests.throws($q$select public.bootstrap_super_admin('bob@example.com')$q$, 'P0001',
  'Đã có Super Admin thì bootstrap không cấp thêm cho người khác');
select tests.check(count(*) = 1, 'Hệ thống chỉ có đúng 1 Super Admin') from public.profiles where role = 'super_admin';
select tests.check(count(*) = 2, 'Mỗi lần chạy bootstrap đều được ghi audit log', count(*)::text) from public.audit_logs where action = 'bootstrap_super_admin';

-- ---------------------------------------------------------------- Super Admin dùng chức năng quản trị
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select tests.check(public.is_admin() and public.is_super_admin(), 'Super Admin được nhận diện đúng');
select tests.check(count(*) = 4, 'Admin xem được danh sách hồ sơ người dùng') from public.profiles;
select tests.check(
  (public.update_site_settings('Worth & Me', 'logo-light/logo-1.png', 'logo-dark/logo-1.png', 'favicon/fav-1.png', '#AA3366', 25000)).brand_name = 'Worth & Me',
  'Admin lưu cài đặt thương hiệu thành công');
select tests.throws($q$select public.update_site_settings('W', 'https://evil.example/x.png', null, null, '#000000', 0)$q$, '23514',
  'Đường dẫn logo là URL bên ngoài bị từ chối');
select tests.throws($q$select public.update_site_settings('W', null, null, null, 'red', 0)$q$, '23514',
  'Mã màu không hợp lệ bị từ chối');
select tests.throws($q$select public.update_site_settings('W', null, null, null, '#000000', -1)$q$, '23514',
  'Phí vận chuyển âm bị từ chối');
select tests.throws($q$select public.update_site_settings('   ', null, null, null, '#000000', 0)$q$, '23514',
  'Tên thương hiệu rỗng bị từ chối');
insert into storage.objects (bucket_id, name) values ('brand', 'logo-light/logo-1.png');
select tests.check(true, 'Admin tải logo lên bucket brand thành công');
select tests.throws($q$insert into storage.objects (bucket_id, name) values ('brand', 'khac/x.png')$q$, '42501',
  'Admin cũng không tải được vào thư mục ngoài danh sách cho phép');
commit;

select tests.check(primary_color = '#aa3366' and shipping_fee = 25000 and logo_light_path = 'logo-light/logo-1.png',
  'Cài đặt được lưu trong database (mọi thiết bị đọc cùng một nơi)') from public.site_settings;
select tests.check(count(*) = 1, 'Mỗi lần lưu tạo một bản lịch sử để khôi phục') from public.site_settings_history;
select tests.check(count(*) = 1, 'Lưu cài đặt được ghi audit log kèm người thực hiện')
  from public.audit_logs where action = 'site_settings.update' and actor_id = '00000000-0000-0000-0000-0000000000ad';

-- Khách vãng lai thấy ngay bản mới
begin;
set local role anon;
select tests.check(primary_color = '#aa3366', 'Khách vãng lai thấy cài đặt mới ngay sau khi Admin lưu') from public.site_settings;
commit;

-- ---------------------------------------------------------------- Khôi phục phiên bản trước
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select tests.check(
  (public.restore_site_settings((select min(id) from public.site_settings_history))).primary_color = '#79628e',
  'Khôi phục về phiên bản trước thành công');
select tests.check(count(*) = 2, 'Khôi phục cũng lưu bản hiện tại vào lịch sử') from public.site_settings_history;
select tests.throws($q$select public.restore_site_settings(99999)$q$, 'P0002', 'Khôi phục phiên bản không tồn tại bị từ chối');
commit;

-- ---------------------------------------------------------------- Tài khoản bị khóa
update public.profiles set role = 'admin' where email = 'carol@example.com';
update public.profiles set status = 'suspended', suspended_reason = 'Kiểm thử' where email = 'carol@example.com';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000cc';
select tests.check(public.is_admin() = false, 'Admin bị khóa không còn được nhận là admin');
select tests.throws($q$select public.update_site_settings('X', null, null, null, '#000000', 0)$q$, '42501',
  'Admin bị khóa KHÔNG sửa được cài đặt');
select tests.check(
  tests.affected($q$update public.profiles set full_name = 'x' where id = auth.uid()$q$) = 0,
  'Tài khoản bị khóa KHÔNG sửa được hồ sơ');
select tests.throws($q$insert into storage.objects (bucket_id, name) values ('brand', 'logo-light/y.png')$q$, '42501',
  'Admin bị khóa KHÔNG tải ảnh lên được');
commit;

-- ---------------------------------------------------------------- Đổi email đồng bộ hồ sơ
update auth.users set email = 'bob.new@example.com' where id = '00000000-0000-0000-0000-00000000000b';
select tests.check(email = 'bob.new@example.com', 'Đổi email được đồng bộ sang hồ sơ')
  from public.profiles where id = '00000000-0000-0000-0000-00000000000b';

-- ---------------------------------------------------------------- Tổng kết
\echo
select n, case when ok then 'PASS' else 'FAIL' end as kq, label, coalesce(info, '') as chi_tiet
from tests.results order by n;
select count(*) filter (where ok) as dat, count(*) filter (where not ok) as truot, count(*) as tong from tests.results;
