-- =============================================================================
-- KIỂM THỬ MIGRATION 008 (voucher, chống đặt trùng, đơn QR quá hạn, thông báo, báo cáo đánh giá, lọc tìm kiếm)
--   00_local_supabase_stub.sql → migrations 001..008 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c3', 'cho@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set role = 'seller' where email in ('chi@example.com', 'binh@example.com');
update public.profiles set full_name = 'Trần Thị Mai' where email = 'khach@example.com';

insert into public.shops (id, owner_id, slug, name, status) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active'),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'binh-store', 'Bình Store', 'active'),
  ('30000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'shop-cho', 'Shop Chờ', 'pending');

insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, sale_price, stock, status, placeholder_visual) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000c1', 'toner-chi', 'Toner Chi', 'Chi Lab', 'skincare', 'toner', 200000, null, 50, 'active', '{"shape":"bottle"}'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000c1', 'serum-chi', 'Serum Chi', 'Chi Lab', 'skincare', 'serum', 300000, 250000, 50, 'active', '{"shape":"dropper"}'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-0000000000c2', 'son-binh', 'Son Bình', 'Bình Color', 'makeup', 'lipstick', 100000, null, 10, 'active', '{"shape":"lipstick"}'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-0000000000c2', 'son-het', 'Son Hết Hàng', 'Bình Color', 'makeup', 'lipstick', 120000, null, 0, 'active', '{"shape":"lipstick"}');

insert into public.addresses (id, user_id, recipient_name, phone, province, district, street) values
  ('50000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1', 'Khách Một', '0901111111', 'Hà Nội', 'Ba Đình', '1 Điện Biên Phủ'),
  ('50000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d2', 'Khách Hai', '0902222222', 'Hà Nội', 'Đống Đa', '2 Tây Sơn');

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated, anon;

-- ---------------------------------------------------------------- Cách dùng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
update public.products set how_to_use = 'Thoa sau bước làm sạch, sáng và tối.' where slug = 'toner-chi';
select tests.check((select how_to_use from public.products where slug = 'toner-chi') = 'Thoa sau bước làm sạch, sáng và tối.', 'Chủ shop cập nhật được "Cách dùng"');
select tests.check((select count(*) from public.products where slug = 'son-binh' and how_to_use = '') = 1, 'Sản phẩm shop khác giữ nguyên');
update public.products set how_to_use = 'Sửa trộm' where slug = 'son-binh';
select tests.check((select how_to_use from public.products where slug = 'son-binh') = '', 'Chủ shop KHÔNG sửa "Cách dùng" sản phẩm shop khác (RLS)');
commit;

-- ---------------------------------------------------------------- Tạo voucher
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select public.save_voucher(null, null, 'wmsale10', 'Giảm 10% toàn sàn', 'percent', 10, 30000, 200000, now() - interval '1 hour', now() + interval '7 days', 100, 1, true);
select public.save_voucher(null, null, 'HETHAN', 'Mã đã hết hạn', 'fixed', 10000, null, 0, now() - interval '3 days', now() - interval '1 day', null, 1, true);
select public.save_voucher(null, null, 'MOT1LUOT', 'Chỉ 1 lượt', 'fixed', 5000, null, 0, now() - interval '1 hour', now() + interval '1 day', 1, 1, true);
select tests.throws($q$select public.save_voucher(null, null, 'WMSALE10', 'Trùng mã', 'fixed', 1000, null, 0, now(), now() + interval '1 day', null, 1, true)$q$, '23505', 'Mã trùng bị từ chối');
select tests.throws($q$select public.save_voucher(null, null, 'co dau', 'Sai định dạng', 'fixed', 1000, null, 0, now(), now() + interval '1 day', null, 1, true)$q$, '22023', 'Mã sai định dạng bị từ chối');
select tests.throws($q$select public.save_voucher(null, null, 'GIAM95', 'Giảm 95%', 'percent', 95, null, 0, now(), now() + interval '1 day', null, 1, true)$q$, '23514', 'Giảm quá 90% bị từ chối');
select tests.throws($q$select public.save_voucher(null, null, 'NGAYSAI', 'Ngày sai', 'fixed', 1000, null, 0, now(), now() - interval '1 day', null, 1, true)$q$, '23514', 'Ngày kết thúc trước ngày bắt đầu bị từ chối');
commit;
select tests.check((select count(*) from public.vouchers where shop_id is null) = 3, 'Admin tạo được voucher của sàn (mã tự viết hoa)');
select tests.check((select count(*) from public.audit_logs where action = 'voucher.create') = 3, 'Nhật ký ghi việc tạo voucher sàn');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.save_voucher(null, null, 'SELLERSAN', 'Người bán tạo mã sàn', 'fixed', 1000, null, 0, now(), now() + interval '1 day', null, 1, true)$q$, '42501',
  'Người bán KHÔNG tạo được voucher của sàn');
select tests.throws($q$select public.save_voucher(null, '30000000-0000-0000-0000-0000000000c2', 'SHOPKHAC', 'Mã shop khác', 'fixed', 1000, null, 0, now(), now() + interval '1 day', null, 1, true)$q$, '42501',
  'Người bán KHÔNG tạo được voucher cho shop khác');
insert into tests.ctx values ('v_chi', (public.save_voucher(null, '30000000-0000-0000-0000-0000000000c1', 'CHI50K', 'Giảm 50.000đ', 'fixed', 50000, null, 300000, now() - interval '1 hour', now() + interval '7 days', null, 2, true)).id::text);
select public.save_voucher(null, '30000000-0000-0000-0000-0000000000c1', 'CHITAT', 'Mã đang tắt', 'fixed', 1000, null, 0, now(), now() + interval '7 days', null, 1, false);
select tests.throws($q$insert into public.vouchers (code, title, discount_type, discount_value, ends_at) values ('CHENTHANG', 'Chèn thẳng', 'fixed', 1000, now() + interval '1 day')$q$, '42501',
  'KHÔNG chèn thẳng vào bảng voucher');
select tests.throws($q$update public.vouchers set used_count = 0$q$, '42501', 'KHÔNG sửa thẳng lượt dùng voucher');
select tests.check((select count(*) from public.vouchers where code = 'CHITAT') = 1, 'Chủ shop thấy voucher đang tắt của shop mình');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c3';
select tests.throws($q$select public.save_voucher(null, '30000000-0000-0000-0000-0000000000c3', 'SHOPCHO', 'Shop chưa duyệt', 'fixed', 1000, null, 0, now(), now() + interval '1 day', null, 1, true)$q$, '42501',
  'Shop chưa duyệt KHÔNG tạo được voucher');
commit;

begin;
set local role anon;
select tests.check((select count(*) from public.vouchers where code = 'CHI50K') = 1, 'Khách vãng lai thấy voucher đang chạy');
select tests.check((select count(*) from public.vouchers where code in ('CHITAT', 'HETHAN')) = 0, 'Khách vãng lai KHÔNG thấy voucher đang tắt hoặc hết hạn');
select tests.throws($q$select public.claim_voucher('CHI50K')$q$, '42501', 'Khách vãng lai KHÔNG lưu được voucher');
select tests.throws($q$select public.preview_vouchers('[]', array['CHI50K'])$q$, '42501', 'Khách vãng lai KHÔNG gọi được preview_vouchers');
commit;

-- ---------------------------------------------------------------- Xem trước voucher
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
insert into tests.ctx values ('pv1', public.preview_vouchers(
  '[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]',
  array['chi50k', 'WMSALE10', 'KHONGCO', 'HETHAN', 'CHITAT'])::text);
select tests.check((select (v::jsonb -> 'shops' -> '30000000-0000-0000-0000-0000000000c1' ->> 'discount')::int = 50000 from tests.ctx where k = 'pv1'), 'Voucher shop 50.000đ áp đúng (đơn shop 450.000đ ≥ 300.000đ)');
select tests.check((select (v::jsonb -> 'platform' ->> 'discount')::int = 30000 from tests.ctx where k = 'pv1'), 'Voucher sàn 10% bị giới hạn mức giảm tối đa 30.000đ');
select tests.check((select jsonb_array_length(v::jsonb -> 'errors') = 3 from tests.ctx where k = 'pv1'), 'Mã không tồn tại / hết hạn / đang tắt báo lỗi riêng');
select tests.check((select (v::jsonb ->> 'after_discount')::int = 470000 from tests.ctx where k = 'pv1'), 'Tiền hàng sau giảm = 550.000 − 50.000 − 30.000');
select tests.check((public.preview_vouchers('[{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]', array['CHI50K']) -> 'errors' -> 0 ->> 'message') like '%chỉ dùng cho sản phẩm của shop Chi Beauty%',
  'Voucher shop không áp cho sản phẩm shop khác');
select tests.check((public.preview_vouchers('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1}]', array['CHI50K']) -> 'errors' -> 0 ->> 'message') like '%cần đơn tối thiểu 300.000%',
  'Chưa đủ đơn tối thiểu thì báo lỗi');
select public.claim_voucher('chi50k');
select tests.check((select count(*) from public.my_vouchers()) = 1, 'Lưu voucher vào ví');
select tests.throws($q$select public.claim_voucher('CHITAT')$q$, 'P0002', 'KHÔNG lưu được voucher đang tắt');

-- ---------------------------------------------------------------- Đặt hàng có voucher
insert into tests.ctx values ('o1', (public.place_order(
  '[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]',
  '50000000-0000-0000-0000-0000000000d1', 'cod', '', array['CHI50K', 'WMSALE10'], '60000000-0000-0000-0000-000000000001') ->> 'id'));
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]', '50000000-0000-0000-0000-0000000000d1', 'cod', '', array['KHONGCO'])$q$, '22023',
  'Đặt hàng với mã không hợp lệ bị từ chối (không tạo đơn)');
select tests.throws($q$insert into public.voucher_redemptions (voucher_id, user_id, order_id, amount) select id, auth.uid(), (select v::uuid from tests.ctx where k = 'o1'), 0 from public.vouchers limit 1$q$, '42501',
  'KHÔNG ghi thẳng lượt dùng voucher');
commit;

select tests.check((select items_subtotal = 550000 and discount_total = 80000 and shipping_total = 60000 and grand_total = 530000 from public.orders where id = (select v::uuid from tests.ctx where k = 'o1')),
  'Đơn cha: tiền hàng 550.000, giảm 80.000, ship 60.000, tổng 530.000 (database tính)');
select tests.check((select shop_discount = 50000 and platform_discount + (select platform_discount from public.shop_orders where shop_id = '30000000-0000-0000-0000-0000000000c2' and order_id = so.order_id) = 30000
                      and shop_voucher_code = 'CHI50K' and total = items_subtotal + shipping_fee - shop_discount - platform_discount
                    from public.shop_orders so where shop_id = '30000000-0000-0000-0000-0000000000c1' and order_id = (select v::uuid from tests.ctx where k = 'o1')),
  'Đơn con: voucher shop đúng shop, voucher sàn chia đủ 30.000 cho 2 shop');
select tests.check((select platform_discount from public.shop_orders where shop_id = '30000000-0000-0000-0000-0000000000c2' and order_id = (select v::uuid from tests.ctx where k = 'o1')) = 6000
                  and (select platform_discount from public.shop_orders where shop_id = '30000000-0000-0000-0000-0000000000c1' and order_id = (select v::uuid from tests.ctx where k = 'o1')) = 24000,
  'Voucher sàn chia theo tỷ lệ tiền hàng sau voucher shop (100k : 400k → 6.000 : 24.000)');
select tests.check((select used_count from public.vouchers where code = 'CHI50K') = 1 and (select used_count from public.vouchers where code = 'WMSALE10') = 1, 'Lượt dùng voucher tăng');
select tests.check((select count(*) from public.voucher_claims where user_id = '20000000-0000-0000-0000-0000000000d1') = 2, 'Voucher đã dùng tự vào ví');

-- Chống đặt trùng: cùng mã yêu cầu
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((public.place_order(
  '[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]',
  '50000000-0000-0000-0000-0000000000d1', 'cod', '', array['CHI50K', 'WMSALE10'], '60000000-0000-0000-0000-000000000001') ->> 'duplicate')::boolean,
  'Gửi lại cùng mã yêu cầu → trả về đơn cũ (duplicate = true)');
commit;
select tests.check((select count(*) from public.orders where customer_id = '20000000-0000-0000-0000-0000000000d1') = 1, 'Bấm đặt hàng 2 lần chỉ tạo 1 đơn');
select tests.check((select stock from public.products where slug = 'son-binh') = 9, 'Tồn kho chỉ trừ 1 lần');

-- Giới hạn lượt dùng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000002","quantity":2}]', '50000000-0000-0000-0000-0000000000d1', 'cod', '', array['WMSALE10'])$q$, '22023',
  'Dùng quá lượt mỗi người (1 lần) bị từ chối');
select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]', '50000000-0000-0000-0000-0000000000d1', 'cod', '', array['MOT1LUOT']);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]', '50000000-0000-0000-0000-0000000000d2', 'cod', '', array['MOT1LUOT'])$q$, '22023',
  'Voucher hết tổng lượt dùng bị từ chối với người khác');
select tests.check((select count(*) from public.voucher_claims) = 0, 'KHÔNG xem được ví voucher của người khác');
select tests.check((select count(*) from public.my_vouchers()) = 0, 'my_vouchers chỉ trả ví của mình');
commit;

-- Hủy đơn → trả lại lượt dùng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select public.cancel_my_shop_order(id, 'Đổi ý') from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'o1') and shop_id = '30000000-0000-0000-0000-0000000000c1';
commit;
select tests.check((select used_count from public.vouchers where code = 'CHI50K') = 0, 'Hủy đơn con → trả lại lượt voucher shop');
select tests.check((select used_count from public.vouchers where code = 'WMSALE10') = 1, 'Còn đơn con chưa hủy → giữ lượt voucher sàn');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select public.cancel_my_shop_order(id, 'Đổi ý') from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'o1') and shop_id = '30000000-0000-0000-0000-0000000000c2';
commit;
select tests.check((select used_count from public.vouchers where code = 'WMSALE10') = 0, 'Hủy cả đơn → trả lại lượt voucher sàn');

-- ---------------------------------------------------------------- Thông báo
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000c1' and title like 'Đơn mới%') >= 1, 'Người bán nhận thông báo "Đơn mới"');
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000c1' and title like '%đã bị hủy') >= 1, 'Người bán nhận thông báo khi khách hủy');
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000d1' and title like '%đã bị hủy') = 0, 'Khách tự hủy thì không tự báo cho chính mình');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select public.seller_update_shop_order(so.id, 'confirmed') from public.shop_orders so
 where so.shop_id = '30000000-0000-0000-0000-0000000000c2' and so.status = 'pending' limit 1;
select tests.check((select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'Người bán KHÔNG đọc được thông báo của người khác');
select tests.throws($q$insert into public.notifications (user_id, kind, title) values (auth.uid(), 'system', 'Giả')$q$, '42501', 'KHÔNG tự chèn thông báo');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((select count(*) from public.notifications where title like '%đã được xác nhận' and link like '/orders/WM%') = 1, 'Khách nhận thông báo "Đơn ... đã được xác nhận" kèm link đơn');
select tests.check(public.mark_notifications_read() >= 1, 'Đánh dấu đã đọc tất cả');
select tests.check((select count(*) from public.notifications where read_at is null) = 0, 'Không còn thông báo chưa đọc');
commit;
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000c2' and read_at is not null) = 0, 'Đánh dấu đã đọc không ảnh hưởng người khác');

update public.shops set status = 'active' where slug = 'shop-cho';
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000c3' and title like '%đã được duyệt') = 1, 'Chủ shop nhận thông báo khi shop được duyệt');

-- ---------------------------------------------------------------- Đơn QR quá hạn
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
insert into tests.ctx values ('qr_old', (public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":3}]', '50000000-0000-0000-0000-0000000000d2', 'qr_demo') ->> 'id'));
insert into tests.ctx values ('qr_reported', (public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":2}]', '50000000-0000-0000-0000-0000000000d2', 'qr_demo') ->> 'id'));
select public.report_payment((select v::uuid from tests.ctx where k = 'qr_reported'));
commit;
update public.orders set created_at = now() - interval '25 hours' where id in (select v::uuid from tests.ctx where k in ('qr_old', 'qr_reported'));
select tests.check((select stock from public.products where slug = 'toner-chi') = 45, 'Trước khi hết hạn: tồn kho 50 − 3 − 2 (đơn đầu đã hủy, hàng đã trả)');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check(public.expire_overdue_orders() = 1, 'Dọn đơn quá hạn: hủy đúng 1 đơn con');
commit;
select tests.check((select status = 'cancelled' and cancelled_by = 'system' from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'qr_old')), 'Đơn QR quá 24 giờ chưa báo chuyển khoản → hệ thống hủy');
select tests.check((select status = 'pending' from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'qr_reported')), 'Đơn đã báo chuyển khoản KHÔNG bị hủy');
select tests.check((select stock from public.products where slug = 'toner-chi') = 48, 'Hủy đơn quá hạn → trả hàng về kho');
select tests.check((select count(*) from public.order_events where actor_role = 'system' and kind = 'status' and actor_id is not null) = 0, 'Sự kiện hệ thống không ghi id người đang đăng nhập');
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000d2' and title like '%đã bị hủy') = 1, 'Khách được báo đơn bị hủy do quá hạn');
begin;
set local role anon;
select tests.throws($q$select public.expire_overdue_orders()$q$, '42501', 'Khách vãng lai KHÔNG gọi được expire_overdue_orders');
commit;

-- ---------------------------------------------------------------- Báo cáo đánh giá, đánh giá nổi bật
insert into public.product_reviews (id, product_id, user_id, rating, comment, reviewer_name) values
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000d1', 5, 'Thấm nhanh, không bết, dùng hết chai thấy da mịn hơn.', 'Mai T.'),
  ('70000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000d1', 2, 'Màu không giống ảnh lắm.', 'Mai T.');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select public.report_review('70000000-0000-0000-0000-000000000001', 'spam', 'Quảng cáo');
select public.report_review('70000000-0000-0000-0000-000000000001', 'offensive');
select tests.throws($q$select public.report_review('70000000-0000-0000-0000-000000000001', 'khong-co')$q$, '22023', 'Lý do báo cáo không hợp lệ bị từ chối');
select tests.throws($q$select * from public.review_reports$q$, '42501', 'KHÔNG đọc thẳng bảng báo cáo (không lộ ai báo cáo)');
commit;
select tests.check((select count(*) from public.review_reports) = 1, 'Mỗi người 1 báo cáo / đánh giá (báo lại = cập nhật lý do)');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.report_review('70000000-0000-0000-0000-000000000001', 'spam')$q$, '22023', 'KHÔNG báo cáo đánh giá của chính mình');
commit;
begin;
set local role anon;
select tests.throws($q$select public.report_review('70000000-0000-0000-0000-000000000001', 'spam')$q$, '42501', 'Khách vãng lai KHÔNG báo cáo được');
select tests.check((select count(*) from public.latest_reviews()) = 1, 'Đánh giá nổi bật: chỉ đánh giá 4–5 sao có nhận xét');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.check((select report_count = 1 and 'offensive' = any (report_reasons) from public.admin_list_reviews(p_reported => true)), 'Admin thấy đánh giá bị báo cáo, số báo cáo và lý do');
select tests.check((select count(*) from public.admin_list_reviews(p_reported => false)) = 1, 'Lọc "chưa bị báo cáo" đúng');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select * from public.admin_list_reviews()$q$, '42501', 'Người bán KHÔNG xem danh sách kiểm duyệt');
select public.seller_reply_review('70000000-0000-0000-0000-000000000001', 'Cảm ơn bạn!');
commit;
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000d1' and title = 'Cửa hàng đã trả lời đánh giá của bạn') = 1, 'Khách được báo khi cửa hàng trả lời đánh giá');

-- ---------------------------------------------------------------- Tìm kiếm: thương hiệu, điểm, còn hàng
begin;
set local role anon;
select tests.check((select count(*) from public.search_products(p_brands => array['bình color'])) = 2, 'Lọc thương hiệu (không phân biệt hoa thường)');
select tests.check((select count(*) from public.search_products(p_brands => array['Bình Color'], p_in_stock => true)) = 1, 'Lọc "còn hàng" bỏ sản phẩm hết hàng');
select tests.check((select count(*) from public.search_products(p_min_rating => 4)) = 1 and (select slug from public.search_products(p_min_rating => 4)) = 'toner-chi', 'Lọc từ 4 sao chỉ lấy sản phẩm có đánh giá ≥ 4');
select tests.check((select count(*) from public.search_products()) = 4, 'Không lọc: đủ 4 sản phẩm đang bán');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
