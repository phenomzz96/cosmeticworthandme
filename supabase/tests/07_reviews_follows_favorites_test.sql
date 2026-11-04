-- =============================================================================
-- KIỂM THỬ MIGRATION 007 (đánh giá, theo dõi shop, yêu thích, loại "Tạo kiểu tóc") — database mới:
--   00_local_supabase_stub.sql → migrations 001..007 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{"full_name":"Nguyễn Văn An"}'),
  ('20000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d3', 'khoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set role = 'seller' where email in ('chi@example.com', 'binh@example.com');
update public.profiles set full_name = 'Nguyễn Văn An' where email = 'khach@example.com';

insert into public.shops (id, owner_id, slug, name, status, rating, follower_count) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active', 4.9, 9999),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'binh-store', 'Bình Store', 'active', 0, 0),
  ('30000000-0000-0000-0000-0000000000c3', null, 'shop-cho', 'Shop Chờ', 'pending', 0, 0);

insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, stock, status, placeholder_visual, rating, review_count, sold_count) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000c1', 'toner-chi', 'Toner Chi', 'Chi Lab', 'skincare', 'toner', 100000, 50, 'active', '{"shape":"bottle"}', 4.8, 900, 5000),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000c1', 'serum-chi', 'Serum Chi', 'Chi Lab', 'skincare', 'serum', 200000, 50, 'active', '{"shape":"dropper"}', 0, 0, 0),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-0000000000c2', 'son-binh', 'Son Bình', 'Bình', 'makeup', 'lipstick', 150000, 10, 'active', '{"shape":"lipstick"}', 0, 0, 0),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-0000000000c2', 'nhap-binh', 'Nháp Bình', 'Bình', 'makeup', 'lipstick', 150000, 10, 'draft', null, 0, 0, 0),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-0000000000c3', 'kem-cho', 'Kem Shop Chờ', 'X', 'skincare', 'moisturizer', 150000, 10, 'active', '{"shape":"jar"}', 0, 0, 0),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-0000000000c2', 'sap-vuot-toc-binh', 'Sáp Vuốt Tóc Bình Clay', 'Bình', 'haircare', 'shampoo', 150000, 10, 'active', '{"shape":"jar"}', 0, 0, 0),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-0000000000c2', 'dau-goi-binh', 'Dầu Gội Bình', 'Bình', 'haircare', 'shampoo', 150000, 10, 'active', '{"shape":"pump"}', 0, 0, 0);

insert into public.addresses (id, user_id, recipient_name, phone, province, district, street) values
  ('50000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1', 'Khách Một', '0901111111', 'Hà Nội', 'Ba Đình', '1 Điện Biên Phủ'),
  ('50000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d2', 'Khách Hai', '0902222222', 'Hà Nội', 'Đống Đa', '2 Tây Sơn');

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated;

-- ---------------------------------------------------------------- Số liệu mẫu được tính lại, loại "Tạo kiểu tóc"
-- (Dữ liệu ở trên được chèn SAU migration nên vẫn còn số mẫu: chạy lại hàm tính số liệu như file seed)
select private.recompute_all_stats();
select tests.check((select rating = 0 and review_count = 0 and sold_count = 0 from public.products where slug = 'toner-chi'),
  'Số liệu mẫu (điểm, lượt đánh giá, lượt bán) được đưa về số thật');
select tests.check((select rating = 0 and follower_count = 0 from public.shops where slug = 'chi-beauty'),
  'Điểm và người theo dõi mẫu của shop được đưa về số thật');

insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, stock, status, placeholder_visual)
values ('30000000-0000-0000-0000-0000000000c2', 'gom-xit-toc', 'Gôm xịt tóc giữ nếp', 'Bình', 'haircare', 'hair-styling', 99000, 5, 'active', '{"shape":"bottle"}');
select tests.check((select search_text like '%tao kieu toc%' from public.products where slug = 'gom-xit-toc'), 'Loại "Tạo kiểu tóc" hợp lệ và tìm được bằng "tao kieu toc"');
select tests.throws($q$insert into public.products (shop_id, slug, name, brand_name, category, product_type, price) values
  ('30000000-0000-0000-0000-0000000000c2', 'loai-la', 'Loại lạ', 'X', 'haircare', 'khong-co', 1000)$q$, '23514', 'Loại sản phẩm không có trong danh sách vẫn bị từ chối');

-- ---------------------------------------------------------------- Chưa mua thì không đánh giá được
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 5, 'Tốt')$q$, '42501', 'Chưa mua sản phẩm thì KHÔNG đánh giá được');
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') ->> 'can_review')::boolean = false, 'Chưa mua: can_review = false');
-- Đặt hàng 2 sản phẩm của Chi Beauty
insert into tests.ctx values ('order', (public.place_order(
  '[{"product_id":"40000000-0000-0000-0000-000000000001","quantity":2},{"product_id":"40000000-0000-0000-0000-000000000002","quantity":1}]',
  '50000000-0000-0000-0000-0000000000d1') ->> 'id'));
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 5, 'Tốt')$q$, '42501', 'Đặt hàng nhưng chưa nhận hàng thì KHÔNG đánh giá được');
commit;

-- Người bán giao đơn tới "Đã giao"
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select public.seller_update_shop_order(so.id, s::public.order_status)
  from public.shop_orders so, unnest(array['confirmed', 'preparing', 'shipping', 'delivered']) s
 where so.order_id = (select v::uuid from tests.ctx where k = 'order');
commit;
select tests.check((select sold_count from public.products where slug = 'toner-chi') = 2, 'Lượt bán tăng đúng theo đơn đã giao');

-- ---------------------------------------------------------------- Đánh giá sau khi nhận hàng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') ->> 'can_review')::boolean, 'Đã nhận hàng: can_review = true');
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 6, 'x')$q$, '22023', 'Điểm ngoài 1–5 bị từ chối');
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 0, 'x')$q$, '22023', 'Điểm 0 bị từ chối');
select tests.throws(format($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 5, %L)$q$, repeat('a', 1001)), '22023', 'Nhận xét quá 1.000 ký tự bị từ chối');
select public.submit_review('40000000-0000-0000-0000-000000000001', 4, '  Dịu nhẹ, dùng ổn  ');
select public.submit_review('40000000-0000-0000-0000-000000000002', 2, '');
-- Gửi lại = sửa, không tạo đánh giá thứ hai
select public.submit_review('40000000-0000-0000-0000-000000000001', 5, 'Dùng hết chai, rất thích');
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'summary' ->> 'count')::int = 1, 'Gửi lại đánh giá là sửa, mỗi người 1 đánh giá / sản phẩm');
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'mine' ->> 'rating')::int = 5, 'Người đánh giá thấy đánh giá của mình (mine)');
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'items' -> 0 ->> 'is_mine')::boolean, 'Đánh giá của mình được đánh dấu is_mine');
select tests.throws($q$select * from public.product_reviews$q$, '42501', 'Khách hàng KHÔNG đọc thẳng bảng đánh giá (tránh lộ user_id)');
select tests.throws($q$update public.product_reviews set rating = 1$q$, '42501', 'Khách hàng KHÔNG sửa thẳng bảng đánh giá');
select tests.throws($q$insert into public.product_reviews (product_id, user_id, rating, reviewer_name) values ('40000000-0000-0000-0000-000000000003', auth.uid(), 5, 'x')$q$, '42501',
  'Khách hàng KHÔNG chèn thẳng đánh giá (lách điều kiện đã mua)');
select tests.throws($q$select public.seller_reply_review((select (public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'mine' ->> 'id')::uuid), 'Tự trả lời')$q$, '42501',
  'Khách hàng KHÔNG trả lời đánh giá thay người bán');
select tests.throws($q$select public.admin_set_review_hidden((select (public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'mine' ->> 'id')::uuid), true, 'x')$q$, '42501',
  'Khách hàng KHÔNG ẩn được đánh giá');
select tests.throws($q$select * from public.admin_list_reviews()$q$, '42501', 'Khách hàng KHÔNG xem được danh sách kiểm duyệt');
commit;

select tests.check((select rating = 5.0 and review_count = 1 from public.products where slug = 'toner-chi'), 'Điểm và lượt đánh giá sản phẩm do database tự tính');
select tests.check((select rating from public.shops where slug = 'chi-beauty') = 3.5, 'Điểm shop = trung bình các đánh giá sản phẩm của shop (5 và 2 → 3.5)');
select tests.check((select reviewer_name from public.product_reviews where product_id = '40000000-0000-0000-0000-000000000001') = 'An N.', 'Tên người đánh giá được che bớt ("An N.")');
select tests.check((select comment from public.product_reviews where product_id = '40000000-0000-0000-0000-000000000001') = 'Dùng hết chai, rất thích', 'Nhận xét được lưu (đã bỏ khoảng trắng thừa)');
select tests.check(position('khach@example.com' in public.get_product_reviews('40000000-0000-0000-0000-000000000001')::text) = 0
  and position('20000000-0000-0000-0000-0000000000d1' in public.get_product_reviews('40000000-0000-0000-0000-000000000001')::text) = 0,
  'Kết quả xem đánh giá KHÔNG chứa email hay id người đánh giá');

-- ---------------------------------------------------------------- Khách vãng lai và người khác
begin;
set local role anon;
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'summary' ->> 'average')::numeric = 5.0, 'Khách vãng lai xem được đánh giá');
select tests.check(public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'mine' = 'null'::jsonb
  and (public.get_product_reviews('40000000-0000-0000-0000-000000000001') ->> 'can_review')::boolean = false, 'Khách vãng lai: không có mine, không được đánh giá');
select tests.throws($q$select public.get_product_reviews('40000000-0000-0000-0000-000000000004')$q$, 'P0002', 'Khách vãng lai KHÔNG xem đánh giá của sản phẩm nháp');
select tests.throws($q$select public.get_product_reviews('40000000-0000-0000-0000-000000000005')$q$, 'P0002', 'Khách vãng lai KHÔNG xem đánh giá sản phẩm của shop chưa duyệt');
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 5, 'x')$q$, '42501', 'Khách vãng lai KHÔNG gọi được submit_review');
select tests.throws($q$select public.toggle_favorite('40000000-0000-0000-0000-000000000001')$q$, '42501', 'Khách vãng lai KHÔNG gọi được toggle_favorite');
select tests.throws($q$select public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c1')$q$, '42501', 'Khách vãng lai KHÔNG gọi được toggle_follow_shop');
select tests.throws($q$select * from public.shop_follows$q$, '42501', 'Khách vãng lai KHÔNG đọc được danh sách theo dõi');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 1, 'Chê')$q$, '42501', 'Người chưa mua (khách khác) KHÔNG đánh giá được');
select tests.throws($q$select public.delete_my_review((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'items' -> 0 ->> 'id')::uuid)$q$, 'P0002',
  'KHÔNG xóa được đánh giá của người khác');
commit;

-- ---------------------------------------------------------------- Người bán trả lời
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.throws($q$select public.seller_reply_review((select (public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'items' -> 0 ->> 'id')::uuid), 'Shop khác trả lời')$q$, '42501',
  'Người bán shop khác KHÔNG trả lời được đánh giá');
select tests.check((select count(*) from public.seller_list_reviews()) = 0, 'Người bán shop khác không thấy đánh giá của shop Chi');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.check((select count(*) from public.seller_list_reviews()) = 2, 'Người bán thấy đánh giá sản phẩm của shop mình');
select public.seller_reply_review(id, 'Cảm ơn bạn đã tin dùng!') from public.seller_list_reviews() where product_slug = 'toner-chi';
select tests.check((select count(*) from public.seller_list_reviews(true)) = 1, 'Lọc "chưa trả lời" đúng');
select tests.throws($q$select public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c1')$q$, '22023', 'Chủ shop KHÔNG tự theo dõi shop mình');
commit;
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'items' -> 0 ->> 'seller_reply') = 'Cảm ơn bạn đã tin dùng!', 'Trả lời của người bán hiện cho mọi người');

-- ---------------------------------------------------------------- Admin ẩn đánh giá vi phạm
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.check((select count(*) from public.admin_list_reviews()) = 2, 'Admin xem được mọi đánh giá');
select tests.check((select count(*) from public.admin_list_reviews(p_max_rating => 2)) = 1, 'Admin lọc đánh giá thấp (≤ 2 sao)');
select tests.throws($q$select public.admin_set_review_hidden((select id from public.admin_list_reviews() where product_slug = 'toner-chi'), true, '  ')$q$, '22023',
  'Ẩn đánh giá bắt buộc có lý do');
select public.admin_set_review_hidden(id, true, 'Nội dung quảng cáo') from public.admin_list_reviews() where product_slug = 'toner-chi';
commit;
select tests.check((select rating = 0 and review_count = 0 from public.products where slug = 'toner-chi'), 'Đánh giá bị ẩn không tính vào điểm sản phẩm');
select tests.check((select rating from public.shops where slug = 'chi-beauty') = 2.0, 'Đánh giá bị ẩn không tính vào điểm shop');
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'items') = '[]'::jsonb, 'Đánh giá bị ẩn không hiện công khai');
select tests.check((select count(*) from public.audit_logs where action = 'review.hide') = 1, 'Nhật ký ghi lại thao tác ẩn đánh giá');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((public.get_product_reviews('40000000-0000-0000-0000-000000000001') -> 'mine' ->> 'hidden')::boolean, 'Người viết thấy đánh giá của mình bị ẩn kèm lý do');
select public.submit_review('40000000-0000-0000-0000-000000000001', 5, 'Sửa lại');
commit;
select tests.check((select hidden from public.product_reviews where product_id = '40000000-0000-0000-0000-000000000001'), 'Sửa đánh giá bị ẩn KHÔNG tự bỏ ẩn');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select public.delete_my_review((public.get_product_reviews('40000000-0000-0000-0000-000000000002') -> 'mine' ->> 'id')::uuid);
commit;
select tests.check((select rating = 0 and review_count = 0 from public.products where slug = 'serum-chi')
  and (select rating from public.shops where slug = 'chi-beauty') = 0, 'Xóa đánh giá thì điểm sản phẩm và shop tính lại');

-- ---------------------------------------------------------------- Theo dõi shop, yêu thích
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check(public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c1'), 'Theo dõi shop: trả về true');
select tests.check(public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c2'), 'Theo dõi shop thứ hai');
select tests.throws($q$select public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c3')$q$, 'P0002', 'KHÔNG theo dõi được shop chưa duyệt');
select tests.check(public.toggle_favorite('40000000-0000-0000-0000-000000000003'), 'Thêm yêu thích: trả về true');
select tests.throws($q$select public.toggle_favorite('40000000-0000-0000-0000-000000000004')$q$, 'P0002', 'KHÔNG yêu thích được sản phẩm nháp');
select tests.throws($q$insert into public.shop_follows (user_id, shop_id) values (auth.uid(), '30000000-0000-0000-0000-0000000000c3')$q$, '42501',
  'KHÔNG chèn thẳng vào bảng theo dõi');
select tests.throws($q$update public.shops set follower_count = 99999 where slug = 'chi-beauty'$q$, '42501', 'KHÔNG tự sửa số người theo dõi');
select tests.throws($q$update public.products set rating = 5 where slug = 'son-binh'$q$, '42501', 'KHÔNG tự sửa điểm sản phẩm');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c1');
select tests.check((select count(*) from public.shop_follows) = 1, 'Mỗi người chỉ thấy danh sách theo dõi của mình');
select tests.check((select count(*) from public.product_favorites) = 0, 'Mỗi người chỉ thấy danh sách yêu thích của mình');
commit;

select tests.check((select follower_count from public.shops where slug = 'chi-beauty') = 2, 'Số người theo dõi shop do database tự đếm');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check(not public.toggle_follow_shop('30000000-0000-0000-0000-0000000000c1'), 'Bấm lần nữa = bỏ theo dõi (trả về false)');
select tests.check(not public.toggle_favorite('40000000-0000-0000-0000-000000000003'), 'Bấm lần nữa = bỏ yêu thích');
commit;
select tests.check((select follower_count from public.shops where slug = 'chi-beauty') = 1, 'Bỏ theo dõi thì số người theo dõi giảm');

-- Tài khoản bị khóa
update public.profiles set status = 'suspended', suspended_reason = 'Kiểm thử' where email = 'khach@example.com';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.submit_review('40000000-0000-0000-0000-000000000001', 5, 'x')$q$, '42501', 'Tài khoản bị khóa KHÔNG đánh giá được');
select tests.throws($q$select public.toggle_favorite('40000000-0000-0000-0000-000000000003')$q$, '42501', 'Tài khoản bị khóa KHÔNG thêm yêu thích');
commit;

-- updated_at của sản phẩm không đổi chỉ vì số liệu thay đổi
select tests.check((select updated_at = created_at from public.products where slug = 'son-binh'), 'Số liệu thay đổi không làm đổi "ngày cập nhật" của sản phẩm');

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
