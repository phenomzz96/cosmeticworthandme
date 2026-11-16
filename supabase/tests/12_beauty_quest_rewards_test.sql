-- =============================================================================
-- KIỂM THỬ MIGRATION 012 (Beauty Quest – Hộp quà may mắn, voucher riêng)
--   00_local_supabase_stub.sql → migrations 001..012 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('21000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('21000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('21000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('21000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}'),
  ('21000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}'),
  ('21000000-0000-0000-0000-0000000000d3', 'bikhoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set role = 'seller' where email = 'chi@example.com';
update public.profiles set status = 'suspended' where email = 'bikhoa@example.com';

insert into public.shops (id, owner_id, slug, name, status) values
  ('31000000-0000-0000-0000-0000000000c1', '21000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active');
insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, stock, status, placeholder_visual) values
  ('41000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-0000000000c1', 'toner-chi', 'Toner Chi', 'Chi Lab', 'skincare', 'toner', 300000, 50, 'active', '{"shape":"bottle"}');
insert into public.addresses (id, user_id, recipient_name, phone, province, district, street) values
  ('51000000-0000-0000-0000-0000000000d1', '21000000-0000-0000-0000-0000000000d1', 'Khách Một', '0901111111', 'Hà Nội', 'Ba Đình', '1 Điện Biên Phủ');

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated, anon;

-- ---------------------------------------------------------------- Quyền quản trị
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.admin_save_reward_campaign(null, 'Tự tạo', '', '', now(), now() + interval '1 day', 5, 0, true)$q$, '42501', 'Khách KHÔNG tạo được đợt quà');
select tests.throws($q$insert into public.reward_campaigns (title, starts_at, ends_at, is_active) values ('Chèn thẳng', now(), now() + interval '1 day', true)$q$, '42501', 'Khách KHÔNG chèn thẳng vào bảng đợt quà');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.admin_save_reward_prize(null, gen_random_uuid(), 'gift', 'Quà', '', 1, null, null, null, null, 0, 7, 0)$q$, '42501', 'Người bán KHÔNG tạo được giải thưởng');
commit;

-- ---------------------------------------------------------------- Admin tạo đợt quà
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000a1';
insert into tests.ctx values ('c1', public.admin_save_reward_campaign(null, 'Black Friday', 'Black Friday', 'Mở hộp nhận quà', now() - interval '1 hour', now() + interval '7 days', 2, 1, true));
insert into tests.ctx values ('c_off', public.admin_save_reward_campaign(null, 'Đợt đang tắt', '', '', now() - interval '1 hour', now() + interval '7 days', 1, 0, false));
insert into tests.ctx values ('c_later', public.admin_save_reward_campaign(null, 'Tết', 'Tết', '', now() + interval '10 days', now() + interval '20 days', 1, 0, true));
select tests.throws($q$select public.admin_save_reward_campaign(null, 'Sai giờ', '', '', now(), now() - interval '1 day', 1, 0, true)$q$, '22023', 'Thời gian kết thúc trước bắt đầu bị từ chối');
select tests.throws($q$select public.admin_save_reward_campaign(null, 'Quá nhiều lượt', '', '', now(), now() + interval '1 day', 50, 0, true)$q$, '23514', 'Số lượt/ngày quá 10 bị từ chối');
insert into tests.ctx values ('p_voucher', public.admin_save_reward_prize(null, (select v::uuid from tests.ctx where k = 'c1'), 'voucher', 'Giảm 20%', 'Tối đa 50.000đ', 100, null, 'percent', 20, 50000, 100000, 5, 1));
insert into tests.ctx values ('p_gift', public.admin_save_reward_prize(null, (select v::uuid from tests.ctx where k = 'c1'), 'gift', 'Bộ mini size', 'Gửi kèm đơn tiếp theo', 0, 1, null, null, null, 0, 7, 2));
insert into tests.ctx values ('p_none', public.admin_save_reward_prize(null, (select v::uuid from tests.ctx where k = 'c1'), 'none', 'Chúc may mắn lần sau', '', 0, null, null, null, null, 0, 7, 3));
select tests.throws($q$select public.admin_save_reward_prize(null, (select v::uuid from tests.ctx where k = 'c1'), 'voucher', 'Giảm 95%', '', 1, null, 'percent', 95, null, 0, 7, 0)$q$, '23514', 'Voucher giảm quá 90% bị từ chối');
select tests.throws($q$select public.admin_save_reward_prize(null, (select v::uuid from tests.ctx where k = 'c1'), 'voucher', 'Thiếu mức giảm', '', 1, null, null, null, null, 0, 7, 0)$q$, '23514', 'Voucher thiếu mức giảm bị từ chối');
commit;
select tests.check((select count(*) from public.audit_logs where action in ('reward_campaign.create', 'reward_prize.create')) = 6, 'Tạo đợt quà / giải thưởng được ghi nhật ký');

-- ---------------------------------------------------------------- Khách vãng lai
begin;
set local role anon;
select tests.check((select count(*) from public.reward_campaigns) = 2, 'Khách vãng lai thấy đợt quà đang/sắp mở, không thấy đợt đang tắt');
select tests.check((select count(*) from public.reward_prizes) = 3, 'Khách vãng lai thấy danh sách giải (công khai tỷ lệ)');
select tests.throws($q$select public.play_reward((select v::uuid from tests.ctx where k = 'c1'))$q$, '42501', 'Khách vãng lai KHÔNG mở hộp được');
select tests.throws($q$select * from public.reward_plays$q$, '42501', 'Khách vãng lai KHÔNG đọc bảng lượt chơi');
commit;

-- ---------------------------------------------------------------- Khách mở hộp: voucher riêng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d1';
select tests.check((public.reward_turns((select v::uuid from tests.ctx where k = 'c1')) ->> 'remaining')::integer = 2, 'Có 2 lượt mỗi ngày');
insert into tests.ctx values ('play1', public.play_reward((select v::uuid from tests.ctx where k = 'c1'))::text);
select tests.check((select v::jsonb ->> 'kind' from tests.ctx where k = 'play1') = 'voucher', 'Trúng voucher (giải duy nhất còn tỷ lệ)');
select tests.check((select v::jsonb ->> 'voucher_code' from tests.ctx where k = 'play1') ~ '^WM[0-9A-F]{10}$', 'Mã voucher riêng do máy chủ tạo');
select tests.check((select count(*) from public.vouchers where code = (select v::jsonb ->> 'voucher_code' from tests.ctx where k = 'play1')
                      and owner_id = '21000000-0000-0000-0000-0000000000d1' and usage_limit = 1 and discount_value = 20) = 1, 'Chủ tài khoản thấy voucher riêng, đúng mức giảm, 1 lượt');
select tests.check((select count(*) from public.my_vouchers() where code = (select v::jsonb ->> 'voucher_code' from tests.ctx where k = 'play1')) = 1, 'Voucher tự vào ví');
select tests.check((public.preview_vouchers('[{"product_id":"41000000-0000-0000-0000-000000000001","quantity":1}]', array[(select v::jsonb ->> 'voucher_code' from tests.ctx where k = 'play1')]) -> 'platform' ->> 'discount')::integer = 50000,
  'Chủ tài khoản dùng được voucher (20% tối đa 50.000đ)');
select public.play_reward((select v::uuid from tests.ctx where k = 'c1'));
select tests.throws($q$select public.play_reward((select v::uuid from tests.ctx where k = 'c1'))$q$, '54000', 'Hết 2 lượt trong ngày thì bị chặn');
select tests.throws($q$insert into public.reward_plays (campaign_id, user_id, prize_kind, prize_label) values ((select v::uuid from tests.ctx where k = 'c1'), auth.uid(), 'none', 'tự thêm')$q$, '42501', 'Khách KHÔNG tự thêm lượt chơi');
select tests.throws($q$update public.reward_prizes set weight = 0$q$, '42501', 'Khách KHÔNG sửa tỷ lệ giải');
select tests.throws($q$select public.play_reward((select v::uuid from tests.ctx where k = 'c_off'))$q$, 'P0002', 'Đợt quà đang tắt: không chơi được');
select tests.throws($q$select public.play_reward((select v::uuid from tests.ctx where k = 'c_later'))$q$, '22023', 'Đợt quà chưa bắt đầu: không chơi được');
select tests.check((select count(*) from public.my_reward_plays()) = 2, 'Lịch sử quà của tôi có 2 lượt');
commit;
select tests.check((select awarded_count from public.reward_prizes where id = (select v::uuid from tests.ctx where k = 'p_voucher')) = 2, 'Đếm số quà đã trao');
select tests.check((select count(*) from public.notifications where user_id = '21000000-0000-0000-0000-0000000000d1' and title like 'Bạn nhận được voucher%') = 2, 'Khách được báo khi nhận voucher');

-- Người khác không thấy, không lưu, không dùng được voucher riêng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d2';
select tests.check((select count(*) from public.vouchers where owner_id is not null) = 0, 'Người khác KHÔNG thấy voucher riêng');
select tests.throws(format('select public.claim_voucher(%L)', (select v::jsonb ->> 'voucher_code' from tests.ctx where k = 'play1')), 'P0002', 'Người khác KHÔNG lưu được voucher riêng vào ví');
select tests.check((public.preview_vouchers('[{"product_id":"41000000-0000-0000-0000-000000000001","quantity":1}]', array[(select v::jsonb ->> 'voucher_code' from tests.ctx where k = 'play1')]) -> 'platform') = 'null'::jsonb,
  'Người khác KHÔNG dùng được voucher riêng khi đặt hàng');
select tests.check((select count(*) from public.my_reward_plays()) = 0, 'Người khác KHÔNG thấy lịch sử quà của khách');
commit;
begin;
set local role anon;
select tests.check((select count(*) from public.vouchers where owner_id is not null) = 0, 'Khách vãng lai KHÔNG thấy voucher riêng');
commit;

-- Tài khoản bị khóa
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d3';
select tests.throws($q$select public.play_reward((select v::uuid from tests.ctx where k = 'c1'))$q$, '42501', 'Tài khoản bị khóa KHÔNG mở hộp được');
commit;

-- ---------------------------------------------------------------- Lượt thưởng khi có đơn đã giao
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d1';
insert into tests.ctx values ('o1', (public.place_order('[{"product_id":"41000000-0000-0000-0000-000000000001","quantity":1}]', '51000000-0000-0000-0000-0000000000d1', 'cod', '') ->> 'id'));
select tests.check((public.reward_turns((select v::uuid from tests.ctx where k = 'c1')) ->> 'remaining')::integer = 0, 'Đơn chưa giao: chưa có lượt thưởng');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000c1';
select public.seller_update_shop_order(so.id, 'confirmed') from public.shop_orders so where so.order_id = (select v::uuid from tests.ctx where k = 'o1');
select public.seller_update_shop_order(so.id, 'preparing') from public.shop_orders so where so.order_id = (select v::uuid from tests.ctx where k = 'o1');
select public.seller_update_shop_order(so.id, 'shipping') from public.shop_orders so where so.order_id = (select v::uuid from tests.ctx where k = 'o1');
select public.seller_update_shop_order(so.id, 'delivered') from public.shop_orders so where so.order_id = (select v::uuid from tests.ctx where k = 'o1');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d1';
select tests.check((public.reward_turns((select v::uuid from tests.ctx where k = 'c1')) ->> 'remaining')::integer = 1, 'Đơn đã giao: thêm 1 lượt thưởng');
commit;

-- Admin đổi giải: chỉ còn quà tặng (số lượng 1) → khách trúng quà, rồi hết quà
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000a1';
select public.admin_save_reward_prize((select v::uuid from tests.ctx where k = 'p_voucher'), (select v::uuid from tests.ctx where k = 'c1'), 'voucher', 'Giảm 20%', '', 0, null, 'percent', 20, 50000, 100000, 5, 1);
select public.admin_save_reward_prize((select v::uuid from tests.ctx where k = 'p_gift'), (select v::uuid from tests.ctx where k = 'c1'), 'gift', 'Bộ mini size', '', 100, 1, null, null, null, 0, 7, 2);
select tests.throws(format('select public.admin_save_reward_prize(%L, %L, %L, %L, %L, 1, 1, %L, 20, null, 0, 5, 1)', (select v from tests.ctx where k = 'p_voucher'), (select v from tests.ctx where k = 'c1'), 'voucher', 'Giảm 20%', '', 'percent'),
  '22023', 'Không giảm số lượng xuống dưới số quà đã trao');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d1';
insert into tests.ctx values ('play_gift', public.play_reward((select v::uuid from tests.ctx where k = 'c1'))::text);
select tests.check((select v::jsonb ->> 'kind' from tests.ctx where k = 'play_gift') = 'gift', 'Trúng quà tặng');
select tests.check((select gift_status from public.my_reward_plays() where prize_kind = 'gift') = 'pending', 'Quà tặng ở trạng thái chờ gửi');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d2';
select tests.throws($q$select public.play_reward((select v::uuid from tests.ctx where k = 'c1'))$q$, 'P0002', 'Quà hết số lượng: không ai trúng thêm');
select tests.throws($q$select * from public.admin_reward_plays((select v::uuid from tests.ctx where k = 'c1'))$q$, '42501', 'Khách KHÔNG xem danh sách trúng thưởng');
commit;

-- ---------------------------------------------------------------- Admin xử lý quà tặng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000a1';
select tests.check((select count(*) from public.admin_reward_plays((select v::uuid from tests.ctx where k = 'c1'))) = 3, 'Admin thấy mọi lượt chơi');
select tests.check((select email from public.admin_reward_plays((select v::uuid from tests.ctx where k = 'c1'), true)) = 'khach@example.com', 'Admin lọc lượt trúng quà tặng, có email người trúng');
select public.admin_update_reward_gift((select id from public.admin_reward_plays((select v::uuid from tests.ctx where k = 'c1'), true)), 'fulfilled', 'Đã gửi kèm đơn WM123');
select tests.throws($q$select public.admin_update_reward_gift((select id from public.admin_reward_plays((select v::uuid from tests.ctx where k = 'c1')) where prize_kind = 'voucher' limit 1), 'fulfilled', '')$q$, 'P0002', 'Chỉ cập nhật được lượt trúng quà tặng');
select tests.throws($q$select public.admin_delete_reward_campaign((select v::uuid from tests.ctx where k = 'c1'))$q$, '23503', 'Đợt quà đã có người chơi: không xóa được');
select public.admin_delete_reward_campaign((select v::uuid from tests.ctx where k = 'c_off'));
select public.admin_delete_reward_prize((select v::uuid from tests.ctx where k = 'p_none'));
commit;
select tests.check((select count(*) from public.notifications where user_id = '21000000-0000-0000-0000-0000000000d1' and title like 'Quà "Bộ mini size" đã được gửi') = 1, 'Khách được báo khi quà đã gửi');
select tests.check((select count(*) from public.reward_campaigns where id = (select v::uuid from tests.ctx where k = 'c_off')) = 0, 'Xóa được đợt quà chưa có người chơi');
select tests.check((select count(*) from public.audit_logs where action in ('reward_gift.fulfilled', 'reward_campaign.delete', 'reward_prize.delete')) = 3, 'Xử lý quà / xóa được ghi nhật ký');

-- ---------------------------------------------------------------- Voucher thường vẫn hoạt động như cũ
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000a1';
select public.save_voucher(null, null, 'CHUNG10', 'Giảm 10.000đ', 'fixed', 10000, null, 0, now() - interval '1 hour', now() + interval '7 days', null, 1, true);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-0000000000d2';
select public.claim_voucher('CHUNG10');
select tests.check((public.preview_vouchers('[{"product_id":"41000000-0000-0000-0000-000000000001","quantity":1}]', array['CHUNG10']) -> 'platform' ->> 'discount')::integer = 10000, 'Voucher chung của sàn vẫn dùng được');
commit;
begin;
set local role anon;
select tests.check((select count(*) from public.vouchers where code = 'CHUNG10') = 1, 'Voucher chung vẫn hiện cho mọi người');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
