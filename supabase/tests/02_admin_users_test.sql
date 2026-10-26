-- =============================================================================
-- KIỂM THỬ MIGRATION 002 (quản trị tài khoản) — chạy trên database mới:
--   00_local_supabase_stub.sql → migrations 001, 002 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('10000000-0000-0000-0000-0000000000aa', 'super@example.com',  now(), '{"full_name":"Super"}'),
  ('10000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{"full_name":"Admin Một"}'),
  ('10000000-0000-0000-0000-0000000000a2', 'admin2@example.com', now(), '{"full_name":"Admin Hai"}'),
  ('10000000-0000-0000-0000-0000000000c1', 'khach1@example.com', now(), '{"full_name":"Khách 50% Một"}'),
  ('10000000-0000-0000-0000-0000000000c2', 'khach2@example.com', now(), '{"full_name":"Khách Hai"}'),
  ('10000000-0000-0000-0000-0000000000c3', 'chua.xac.minh@example.com', null, '{"full_name":"Chưa Xác Minh"}'),
  ('10000000-0000-0000-0000-0000000000b1', 'seller1@example.com', now(), '{"full_name":"Người Bán"}');

update auth.users set email_confirmed_at = now() where email = 'super@example.com';
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email in ('admin1@example.com', 'admin2@example.com');
update public.profiles set role = 'seller' where email = 'seller1@example.com';
update public.profiles set created_at = '2026-01-15' where email = 'khach2@example.com';

-- ---------------------------------------------------------------- Customer không dùng được chức năng quản trị
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select * from public.admin_list_users()$q$, '42501', 'Customer KHÔNG xem được danh sách người dùng');
select tests.throws($q$select public.admin_set_user_status('10000000-0000-0000-0000-0000000000c2', 'suspended', 'thử khóa người khác')$q$, '42501',
  'Customer KHÔNG khóa được tài khoản khác');
select tests.throws($q$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000c1', 'admin')$q$, '42501',
  'Customer KHÔNG tự cấp quyền admin qua hàm');
select tests.throws($q$select * from public.admin_audit_logs()$q$, '42501', 'Customer KHÔNG xem được nhật ký quản trị');
select tests.throws($q$update public.profiles set suspended_by = null where id = auth.uid()$q$, '42501',
  'Customer KHÔNG sửa được cột suspended_by mới');
commit;

begin;
set local role anon;
select tests.throws($q$select * from public.admin_list_users()$q$, '42501', 'Khách chưa đăng nhập KHÔNG gọi được hàm quản trị');
commit;

-- ---------------------------------------------------------------- Admin thường
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-0000000000a1';
select tests.check((select count(*) from public.admin_list_users()) = 7, 'Admin xem được toàn bộ danh sách (7 tài khoản)');
select tests.check((select max(total_count) from public.admin_list_users(p_limit => 2)) = 7
  and (select count(*) from public.admin_list_users(p_limit => 2)) = 2, 'Phân trang: trả 2 dòng, tổng 7');
select tests.check((select count(*) from public.admin_list_users(p_search => 'khach')) = 2, 'Tìm theo email');
select tests.check((select count(*) from public.admin_list_users(p_search => '50%')) = 1, 'Tìm có ký tự % được hiểu đúng nghĩa đen');
select tests.check((select count(*) from public.admin_list_users(p_search => '_')) = 0, 'Ký tự _ không bị hiểu là ký tự đại diện');
select tests.check((select count(*) from public.admin_list_users(p_role => 'admin')) = 2, 'Lọc theo role');
select tests.check((select count(*) from public.admin_list_users(p_created_to => '2026-01-31')) = 1, 'Lọc theo ngày tạo');
select tests.check((select email_confirmed from public.admin_list_users(p_search => 'chua.xac') limit 1) = false, 'Hiện trạng thái xác minh email');
select tests.check(
  (public.admin_set_user_status('10000000-0000-0000-0000-0000000000c2', 'suspended', 'Spam đánh giá sản phẩm')).status = 'suspended',
  'Admin khóa được customer khi có lý do');
select tests.throws($q$select public.admin_set_user_status('10000000-0000-0000-0000-0000000000b1', 'suspended', 'ab')$q$, '22023',
  'Khóa với lý do quá ngắn bị từ chối');
select tests.throws($q$select public.admin_set_user_status('10000000-0000-0000-0000-0000000000b1', 'suspended')$q$, '22023',
  'Khóa không có lý do bị từ chối');
select tests.throws($q$select public.admin_set_user_status('10000000-0000-0000-0000-0000000000c2', 'suspended', 'Khóa lần hai')$q$, '22023',
  'Khóa tài khoản đã bị khóa bị từ chối');
select tests.throws($q$select public.admin_set_user_status('10000000-0000-0000-0000-0000000000a2', 'suspended', 'Admin khóa admin')$q$, '42501',
  'Admin thường KHÔNG khóa được admin khác');
select tests.throws($q$select public.admin_set_user_status('10000000-0000-0000-0000-0000000000aa', 'suspended', 'Khóa super admin')$q$, '42501',
  'Admin KHÔNG khóa được Super Admin');
select tests.throws($q$select public.admin_set_user_status(auth.uid(), 'suspended', 'Tự khóa mình')$q$, '42501',
  'Admin KHÔNG tự khóa chính mình');
select tests.throws($q$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000c1', 'admin')$q$, '42501',
  'Admin thường KHÔNG cấp được quyền admin');
select tests.check((select count(*) from public.admin_audit_logs(p_action => 'user.suspend')) = 1, 'Admin xem được nhật ký, có lần khóa vừa rồi');
select tests.check((select actor_email from public.admin_audit_logs(p_action => 'user.suspend') limit 1) = 'admin1@example.com',
  'Nhật ký ghi đúng người thực hiện');
select tests.check((select details ->> 'reason' from public.admin_audit_logs(p_action => 'user.suspend') limit 1) = 'Spam đánh giá sản phẩm',
  'Nhật ký ghi lý do khóa');
commit;

select tests.check(suspended_by = '10000000-0000-0000-0000-0000000000a1' and suspended_reason = 'Spam đánh giá sản phẩm',
  'Hồ sơ lưu người khóa và lý do') from public.profiles where email = 'khach2@example.com';

-- ---------------------------------------------------------------- Tài khoản vừa bị khóa
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-0000000000c2';
select tests.check(tests.affected($q$update public.profiles set full_name = 'x' where id = auth.uid()$q$) = 0,
  'Tài khoản vừa bị khóa KHÔNG sửa được hồ sơ');
select tests.check(suspended_reason = 'Spam đánh giá sản phẩm', 'Người bị khóa xem được lý do của mình')
  from public.profiles where id = auth.uid();
commit;

-- ---------------------------------------------------------------- Super Admin
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-0000000000aa';
select tests.check(
  (public.admin_set_user_role('10000000-0000-0000-0000-0000000000c1', 'admin', 'Thành viên nhóm phụ trách duyệt shop')).role = 'admin',
  'Super Admin cấp quyền admin cho tài khoản đã xác minh');
select tests.throws($q$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000c3', 'admin')$q$, '22023',
  'Không cấp admin cho email chưa xác minh');
select tests.throws($q$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000c2', 'admin')$q$, '22023',
  'Không cấp admin cho tài khoản đang bị khóa');
select tests.throws($q$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000a2', 'super_admin')$q$, '42501',
  'Không cấp quyền Super Admin qua website');
select tests.throws($q$select public.admin_set_user_role(auth.uid(), 'customer')$q$, '42501',
  'Super Admin KHÔNG tự hạ quyền của mình');
select tests.throws($q$select public.admin_set_user_status(auth.uid(), 'suspended', 'Tự khóa mình')$q$, '42501',
  'Super Admin KHÔNG tự khóa mình');
select tests.check(
  (public.admin_set_user_role('10000000-0000-0000-0000-0000000000a2', 'customer', 'Rời nhóm')).role = 'customer',
  'Super Admin thu hồi quyền admin');
select tests.check(
  (public.admin_set_user_status('10000000-0000-0000-0000-0000000000a1', 'suspended', 'Kiểm thử khóa admin')).status = 'suspended',
  'Super Admin khóa được admin');
select tests.check(
  (public.admin_set_user_status('10000000-0000-0000-0000-0000000000c2', 'active')).suspended_reason is null,
  'Mở khóa xóa lý do khóa cũ');
select tests.check((select count(*) from public.admin_audit_logs(p_action => 'user.')) = 5, 'Mọi thao tác quản trị tài khoản đều có trong nhật ký',
  (select count(*) from public.admin_audit_logs(p_action => 'user.'))::text);
commit;

-- Admin vừa bị khóa mất quyền ngay
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-0000000000a1';
select tests.throws($q$select * from public.admin_list_users()$q$, '42501', 'Admin bị khóa mất quyền xem danh sách ngay lập tức');
select tests.throws($q$select public.update_site_settings('X', null, null, null, '#000000', 0)$q$, '42501',
  'Admin bị khóa mất quyền sửa cài đặt');
commit;

-- Admin bị thu hồi quyền
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-0000000000a2';
select tests.throws($q$select * from public.admin_audit_logs()$q$, '42501', 'Người bị thu hồi quyền admin không còn xem được nhật ký');
commit;

-- ---------------------------------------------------------------- Bảo vệ Super Admin khỏi bị xóa
select tests.throws($q$delete from auth.users where email = 'super@example.com'$q$, '42501',
  'Xóa tài khoản Super Admin (kể cả từ Dashboard) bị chặn');
select tests.check(tests.affected($q$delete from auth.users where email = 'chua.xac.minh@example.com'$q$) = 1,
  'Xóa tài khoản thường vẫn hoạt động');

-- ---------------------------------------------------------------- Tổng kết
select * from tests.summary();
select count(*) filter (where ok) as dat, count(*) filter (where not ok) as truot, count(*) as tong from tests.results;
