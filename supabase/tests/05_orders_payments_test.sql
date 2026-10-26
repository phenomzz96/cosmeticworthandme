-- =============================================================================
-- KIỂM THỬ MIGRATION 005 (đặt hàng, xử lý đơn, thanh toán COD/QR mô phỏng, admin) — database mới:
--   00_local_supabase_stub.sql → migrations 001..005 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d3', 'khoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set role = 'seller' where email in ('chi@example.com', 'binh@example.com');

insert into public.shops (id, owner_id, slug, name, status) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active'),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'binh-store', 'Bình Store', 'active'),
  ('30000000-0000-0000-0000-0000000000c3', null, 'shop-cho', 'Shop Chờ', 'pending');

insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, sale_price, stock, status, placeholder_visual) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000c1', 'toner-chi', 'Toner Chi', 'Chi Lab', 'skincare', 'toner', 100000, 80000, 5, 'active', '{"shape":"bottle"}'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000c1', 'serum-chi', 'Serum Chi', 'Chi Lab', 'skincare', 'serum', 200000, null, 2, 'active', '{"shape":"dropper"}'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-0000000000c2', 'son-binh', 'Son Bình', 'Bình', 'makeup', 'lipstick', 150000, null, 10, 'active', '{"shape":"lipstick"}'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-0000000000c2', 'nhap-binh', 'Nháp Bình', 'Bình', 'makeup', 'lipstick', 150000, null, 10, 'draft', null),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-0000000000c3', 'kem-cho', 'Kem Shop Chờ', 'X', 'skincare', 'moisturizer', 150000, null, 10, 'active', '{"shape":"jar"}');

insert into public.addresses (id, user_id, recipient_name, phone, province, district, street) values
  ('50000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1', 'Khách Một', '0901111111', 'Hà Nội', 'Ba Đình', '1 Điện Biên Phủ'),
  ('50000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d2', 'Khách Hai', '0902222222', 'Hà Nội', 'Đống Đa', '2 Tây Sơn'),
  ('50000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'Chi', '0903333333', 'Huế', 'Phú Hội', '3 Lê Lợi'),
  ('50000000-0000-0000-0000-0000000000d3', '20000000-0000-0000-0000-0000000000d3', 'Bị Khóa', '0904444444', 'Huế', 'Phú Hội', '4 Lê Lợi');
update public.profiles set status = 'suspended', suspended_reason = 'Kiểm thử' where email = 'khoa@example.com';
insert into public.cart_items (user_id, product_id, quantity) values
  ('20000000-0000-0000-0000-0000000000d1', '40000000-0000-0000-0000-000000000001', 1),
  ('20000000-0000-0000-0000-0000000000d1', '40000000-0000-0000-0000-000000000002', 1);

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated;

-- ---------------------------------------------------------------- Đặt hàng: chặn trường hợp sai
begin;
set local role anon;
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1}]', '50000000-0000-0000-0000-0000000000d1')$q$, '42501',
  'Khách vãng lai KHÔNG gọi được place_order');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1}]', '50000000-0000-0000-0000-0000000000d2')$q$, 'P0002',
  'KHÔNG dùng địa chỉ của người khác để đặt hàng');
select tests.throws($q$select public.place_order('[]', '50000000-0000-0000-0000-0000000000d1')$q$, '22023', 'Giỏ trống bị từ chối');
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":11}]', '50000000-0000-0000-0000-0000000000d1')$q$, '22023',
  'Số lượng > 10 bị từ chối');
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":0}]', '50000000-0000-0000-0000-0000000000d1')$q$, '22023',
  'Số lượng 0 bị từ chối');
select tests.throws($q$select public.place_order('[{"product_id":"khong-hop-le","quantity":1}]', '50000000-0000-0000-0000-0000000000d1')$q$, '22023',
  'Id sản phẩm sai định dạng bị từ chối');
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000002","quantity":3}]', '50000000-0000-0000-0000-0000000000d1')$q$, '23514',
  'Đặt quá tồn kho bị từ chối');
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000004","quantity":1}]', '50000000-0000-0000-0000-0000000000d1')$q$, 'P0002',
  'KHÔNG đặt được sản phẩm nháp');
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000005","quantity":1}]', '50000000-0000-0000-0000-0000000000d1')$q$, 'P0002',
  'KHÔNG đặt được sản phẩm của shop chưa duyệt');
select tests.throws($q$insert into public.orders (code, customer_id, recipient_name, phone, province, district, street, payment_method, items_subtotal, shipping_total, grand_total) values ('X', auth.uid(), 'a', '0900000000', 'a', 'a', 'a', 'cod', 1, 0, 1)$q$, '42501',
  'KHÔNG tự ghi đơn hàng vào bảng (bỏ qua hàm place_order)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1}]', '50000000-0000-0000-0000-0000000000c1')$q$, '42501',
  'Chủ shop KHÔNG tự mua sản phẩm của shop mình');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d3';
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]', '50000000-0000-0000-0000-0000000000d3')$q$, '42501',
  'Tài khoản bị khóa KHÔNG đặt hàng được');
commit;

-- ---------------------------------------------------------------- Đặt hàng thành công (COD, 2 shop)
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
-- Gửi kèm "price": 1 để thử gian lận giá: database phải bỏ qua
insert into tests.ctx select 'order1', (public.place_order(
  '[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":2,"price":1},{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1},{"product_id":"40000000-0000-0000-0000-000000000001","quantity":1}]',
  '50000000-0000-0000-0000-0000000000d1', 'cod', 'Giao giờ hành chính')) ->> 'id';
commit;

select tests.check((select items_subtotal = 390000 and shipping_total = 60000 and grand_total = 450000 from public.orders where id = (select v::uuid from tests.ctx where k = 'order1')),
  'Tổng tiền do database tính: 3×80.000 (giá KM) + 150.000 + phí ship 2 shop = 450.000 (bỏ qua giá gửi lên)');
select tests.check((select count(*) from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'order1')) = 2, 'Đơn 2 shop → 2 đơn con');
select tests.check((select quantity from public.order_items where product_id = '40000000-0000-0000-0000-000000000001') = 3, 'Dòng trùng sản phẩm được gộp (2 + 1 = 3)');
select tests.check((select stock from public.products where id = '40000000-0000-0000-0000-000000000001') = 2 and (select stock from public.products where id = '40000000-0000-0000-0000-000000000003') = 9,
  'Tồn kho bị trừ đúng');
select tests.check((select array_agg(product_id::text) from public.cart_items where user_id = '20000000-0000-0000-0000-0000000000d1') = array['40000000-0000-0000-0000-000000000002'],
  'Sản phẩm đã đặt được bỏ khỏi giỏ, sản phẩm khác giữ nguyên');
select tests.check((select recipient_name = 'Khách Một' and phone = '0901111111' and note = 'Giao giờ hành chính' from public.orders where id = (select v::uuid from tests.ctx where k = 'order1')),
  'Đơn lưu lại địa chỉ giao hàng và ghi chú');
select tests.check((select code ~ '^WM[0-9]{6}-[0-9A-F]{6}$' from public.orders where id = (select v::uuid from tests.ctx where k = 'order1')), 'Mã đơn dạng WMyymmdd-XXXXXX');
insert into tests.ctx select 'so_chi', id::text from public.shop_orders where shop_id = '30000000-0000-0000-0000-0000000000c1';
insert into tests.ctx select 'so_binh', id::text from public.shop_orders where shop_id = '30000000-0000-0000-0000-0000000000c2';

-- ---------------------------------------------------------------- Ai xem được đơn
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((select count(*) from public.orders) = 1 and (select count(*) from public.shop_orders) = 2 and (select count(*) from public.order_items) = 2,
  'Khách xem được đơn của mình (đơn cha, 2 đơn con, sản phẩm)');
select tests.check((select count(*) from public.order_events) = 2, 'Khách xem được lịch sử đơn của mình');
select tests.throws($q$update public.orders set grand_total = 1$q$, '42501', 'Khách KHÔNG sửa được đơn');
select tests.throws($q$update public.shop_orders set status = 'delivered'$q$, '42501', 'Khách KHÔNG tự đổi trạng thái đơn');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.check((select count(*) from public.orders) + (select count(*) from public.shop_orders) + (select count(*) from public.order_items) + (select count(*) from public.order_events) = 0,
  'Khách khác KHÔNG thấy đơn, sản phẩm, lịch sử của người khác');
select tests.throws(format($q$select public.cancel_my_shop_order(%L)$q$, (select v from tests.ctx where k = 'so_binh')), 'P0002', 'Khách khác KHÔNG hủy được đơn của người khác');
select tests.throws($q$select * from public.seller_list_shop_orders()$q$, '42501', 'Người chưa có shop KHÔNG gọi được danh sách đơn của người bán');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check((select count(*) from public.orders) = 0, 'Người bán KHÔNG đọc trực tiếp bảng đơn cha (tổng tiền cả đơn, đơn của shop khác)');
select tests.check((select count(*) from public.shop_orders) = 1 and (select count(*) from public.order_items) = 1, 'Người bán chỉ thấy đơn con và sản phẩm của shop mình');
select tests.check((select count(*) = 1 and bool_and(phone = '0901111111' and recipient_name = 'Khách Một') and max(total) = 270000 from public.seller_list_shop_orders()),
  'Người bán thấy thông tin giao hàng của đơn shop mình qua hàm (tổng đơn con 240.000 + 30.000)');
select tests.throws(format($q$select public.seller_update_shop_order(%L, 'confirmed')$q$, (select v from tests.ctx where k = 'so_binh')), 'P0002',
  'Người bán KHÔNG xử lý được đơn của shop khác');
select tests.throws($q$select * from public.admin_list_orders()$q$, '42501', 'Người bán KHÔNG xem được danh sách đơn quản trị');
commit;

-- ---------------------------------------------------------------- Khách hủy, người bán xử lý, COD
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select public.cancel_my_shop_order((select v::uuid from tests.ctx where k = 'so_binh'), 'Đổi ý');
select tests.check((select status = 'cancelled' and cancelled_by = 'customer' from public.shop_orders where id = (select v::uuid from tests.ctx where k = 'so_binh')), 'Khách hủy đơn đang chờ xác nhận');
commit;
select tests.check((select stock from public.products where id = '40000000-0000-0000-0000-000000000003') = 10, 'Hủy đơn → hoàn lại tồn kho');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws(format($q$select public.seller_update_shop_order(%L, 'shipping')$q$, (select v from tests.ctx where k = 'so_chi')), '22023', 'Không nhảy cóc từ chờ xác nhận sang đang giao');
select tests.throws(format($q$select public.seller_update_shop_order(%L, 'cancelled', 'ko')$q$, (select v from tests.ctx where k = 'so_chi')), '22023', 'Từ chối đơn bắt buộc lý do ≥ 5 ký tự');
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so_chi'), 'confirmed');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws(format($q$select public.cancel_my_shop_order(%L)$q$, (select v from tests.ctx where k = 'so_chi')), '22023', 'Khách KHÔNG hủy được đơn đã xác nhận');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so_chi'), 'preparing');
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so_chi'), 'shipping');
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so_chi'), 'delivered');
select tests.throws(format($q$select public.seller_update_shop_order(%L, 'cancelled', 'Hủy sau khi giao')$q$, (select v from tests.ctx where k = 'so_chi')), '22023', 'Không hủy được đơn đã giao');
commit;
select tests.check((select sold_count from public.products where id = '40000000-0000-0000-0000-000000000001') = 3, 'Giao thành công → cộng lượt bán');
select tests.check((select payment_status from public.orders where id = (select v::uuid from tests.ctx where k = 'order1')) = 'paid',
  'COD: mọi đơn con còn lại đã giao → đơn cha "đã thanh toán"');
select tests.check((select count(*) from public.order_events where shop_order_id = (select v::uuid from tests.ctx where k = 'so_chi')) = 5, 'Lịch sử ghi đủ 5 bước của đơn con');

-- ---------------------------------------------------------------- QR mô phỏng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
insert into tests.ctx select 'order2', (public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1}]', '50000000-0000-0000-0000-0000000000d1', 'qr_demo')) ->> 'id';
commit;
insert into tests.ctx select 'so2', id::text from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'order2');
select tests.check((select payment_method = 'qr_demo' and payment_status = 'unpaid' from public.orders where id = (select v::uuid from tests.ctx where k = 'order2')), 'Đơn QR mới: chưa thanh toán');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so2'), 'confirmed');
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so2'), 'preparing');
select tests.throws(format($q$select public.seller_update_shop_order(%L, 'shipping')$q$, (select v from tests.ctx where k = 'so2')), '22023',
  'Đơn QR chưa xác nhận thanh toán → người bán KHÔNG giao được');
select tests.throws(format($q$select public.report_payment(%L)$q$, (select v from tests.ctx where k = 'order2')), 'P0002', 'Người bán KHÔNG báo thanh toán thay khách');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select public.report_payment((select v::uuid from tests.ctx where k = 'order2'));
select tests.check((select payment_status from public.orders where id = (select v::uuid from tests.ctx where k = 'order2')) = 'pending_confirmation', 'Khách báo đã chuyển khoản → chờ xác nhận');
select tests.throws(format($q$select public.report_payment(%L)$q$, (select v from tests.ctx where k = 'order2')), '22023', 'Không báo thanh toán 2 lần');
select tests.throws(format($q$select public.admin_confirm_payment(%L, true)$q$, (select v from tests.ctx where k = 'order2')), '42501', 'Khách KHÔNG tự xác nhận thanh toán');
select tests.throws(format($q$select public.report_payment(%L)$q$, (select v from tests.ctx where k = 'order1')), '22023', 'Đơn COD không có bước báo chuyển khoản');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.check((select count(*) from public.admin_list_orders(p_payment_status => 'pending_confirmation')) = 1, 'Admin lọc đơn chờ xác nhận thanh toán');
select tests.throws(format($q$select public.admin_confirm_payment(%L, false)$q$, (select v from tests.ctx where k = 'order2')), '22023', 'Từ chối thanh toán bắt buộc lý do');
select public.admin_confirm_payment((select v::uuid from tests.ctx where k = 'order2'), false, 'Chưa thấy tiền về tài khoản');
select tests.check((select payment_status = 'unpaid' and payment_note = 'Chưa thấy tiền về tài khoản' from public.orders where id = (select v::uuid from tests.ctx where k = 'order2')),
  'Admin từ chối → quay lại chưa thanh toán, khách thấy lý do');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select public.report_payment((select v::uuid from tests.ctx where k = 'order2'));
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select public.admin_confirm_payment((select v::uuid from tests.ctx where k = 'order2'), true);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so2'), 'shipping');
select tests.check((select status from public.shop_orders where id = (select v::uuid from tests.ctx where k = 'so2')) = 'shipping', 'Đã xác nhận thanh toán → người bán giao được');
commit;

-- Hủy sau khi đã thanh toán → chờ hoàn tiền
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
insert into tests.ctx select 'order3', (public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1}]', '50000000-0000-0000-0000-0000000000d1', 'qr_demo')) ->> 'id';
select public.report_payment((select v::uuid from tests.ctx where k = 'order3'));
commit;
insert into tests.ctx select 'so3', id::text from public.shop_orders where order_id = (select v::uuid from tests.ctx where k = 'order3');
select tests.check((select stock from public.products where id = '40000000-0000-0000-0000-000000000002') = 0, 'Bán hết hàng → tồn kho 0');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select public.admin_confirm_payment((select v::uuid from tests.ctx where k = 'order3'), true);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select public.seller_update_shop_order((select v::uuid from tests.ctx where k = 'so3'), 'cancelled', 'Hàng bị lỗi bao bì');
commit;
select tests.check((select refund_status = 'pending' and cancel_reason = 'Hàng bị lỗi bao bì' from public.shop_orders where id = (select v::uuid from tests.ctx where k = 'so3')),
  'Người bán hủy đơn đã thanh toán → chờ hoàn tiền, khách thấy lý do');
select tests.check((select stock from public.products where id = '40000000-0000-0000-0000-000000000002') = 1, 'Hủy → hoàn tồn kho');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws(format($q$select public.admin_mark_refunded(%L)$q$, (select v from tests.ctx where k = 'so3')), '42501', 'Người bán KHÔNG tự đánh dấu đã hoàn tiền');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select public.admin_mark_refunded((select v::uuid from tests.ctx where k = 'so3'));
select tests.check((select refund_status from public.shop_orders where id = (select v::uuid from tests.ctx where k = 'so3')) = 'done', 'Admin đánh dấu đã hoàn tiền');
select tests.throws(format($q$select public.admin_mark_refunded(%L)$q$, (select v from tests.ctx where k = 'so3')), '22023', 'Không hoàn tiền 2 lần');
select tests.throws(format($q$select public.admin_cancel_shop_order(%L, 'Khiếu nại')$q$, (select v from tests.ctx where k = 'so_chi')), '22023', 'Admin không hủy đơn đã giao');
select tests.throws(format($q$select public.admin_cancel_shop_order(%L, 'x')$q$, (select v from tests.ctx where k = 'so2')), '22023', 'Admin hủy đơn bắt buộc lý do');
select public.admin_cancel_shop_order((select v::uuid from tests.ctx where k = 'so2'), 'Khách khiếu nại, hai bên đồng ý hủy');
select tests.check((select status = 'cancelled' and cancelled_by = 'admin' and refund_status = 'pending' from public.shop_orders where id = (select v::uuid from tests.ctx where k = 'so2')),
  'Admin hủy đơn đang giao (đã thanh toán) → chờ hoàn tiền');
select tests.check((select count(*) from public.audit_logs where action in ('payment.confirm', 'payment.reject', 'payment.refund', 'order.cancel')) = 5,
  'Nhật ký ghi xác nhận / từ chối thanh toán, hoàn tiền, hủy đơn của admin');
select tests.check((select count(*) from public.admin_list_orders(p_refund_pending => true)) = 1, 'Admin lọc đơn đang chờ hoàn tiền');
select tests.check((select (s ->> 'orders')::int = 3 and (s ->> 'refunds_pending')::int = 1 and (s ->> 'gmv_delivered')::int = 270000 from public.admin_dashboard_stats() s),
  'Số liệu tổng quan admin');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check((select (s ->> 'revenue_delivered')::int = 240000 and (s ->> 'units_sold')::int = 3 and (s -> 'by_status' ->> 'cancelled')::int = 2 from public.seller_dashboard_stats() s),
  'Số liệu của người bán (doanh thu chỉ tính đơn đã giao, chưa gồm phí ship)');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.admin_dashboard_stats()$q$, '42501', 'Khách KHÔNG xem số liệu quản trị');
commit;

-- ---------------------------------------------------------------- Admin ẩn sản phẩm vi phạm
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.admin_set_product_hidden('40000000-0000-0000-0000-000000000003', true, 'Hàng giả mạo')$q$, '42501', 'Khách KHÔNG ẩn được sản phẩm');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.throws($q$select public.admin_set_product_hidden('40000000-0000-0000-0000-000000000003', true)$q$, '22023', 'Ẩn sản phẩm bắt buộc lý do');
select public.admin_set_product_hidden('40000000-0000-0000-0000-000000000003', true, 'Nghi hàng giả, chờ bổ sung giấy tờ');
select tests.check((select count(*) = 1 and bool_and(admin_hidden) from public.admin_list_products(p_hidden => true)), 'Admin lọc sản phẩm đang bị ẩn');
commit;
begin;
set local role anon;
select tests.check((select count(*) from public.products where id = '40000000-0000-0000-0000-000000000003') = 0, 'Sản phẩm bị Admin ẩn: khách không thấy');
select tests.check((select count(*) from public.search_products('son binh')) = 0, 'Sản phẩm bị Admin ẩn: không có trong tìm kiếm');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.throws($q$select public.cart_set_item('40000000-0000-0000-0000-000000000003', 1)$q$, 'P0002', 'Sản phẩm bị Admin ẩn: không thêm vào giỏ');
select tests.throws($q$select public.place_order('[{"product_id":"40000000-0000-0000-0000-000000000003","quantity":1}]', '50000000-0000-0000-0000-0000000000d2')$q$, 'P0002',
  'Sản phẩm bị Admin ẩn: không đặt hàng được');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.check((select admin_hidden and admin_hidden_reason like 'Nghi hàng giả%' from public.products where id = '40000000-0000-0000-0000-000000000003'),
  'Chủ shop vẫn thấy sản phẩm và lý do bị ẩn');
select tests.throws($q$update public.products set admin_hidden = false where id = '40000000-0000-0000-0000-000000000003'$q$, '42501', 'Chủ shop KHÔNG tự bỏ ẩn');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select public.admin_set_product_hidden('40000000-0000-0000-0000-000000000003', false);
commit;
begin;
set local role anon;
select tests.check((select count(*) from public.search_products('son binh')) = 1, 'Admin bỏ ẩn → sản phẩm hiện lại');
commit;

-- ---------------------------------------------------------------- Tổng kết
select * from tests.summary();
select count(*) filter (where ok) as dat, count(*) filter (where not ok) as truot, count(*) as tong from tests.results;
