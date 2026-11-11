-- =============================================================================
-- KIỂM THỬ MIGRATION 009 (nội dung trang do Admin sửa, tin nhắn, danh mục mới)
--   00_local_supabase_stub.sql → migrations 001..009 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('20000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c1', 'chi@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c2', 'binh@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000c3', 'tamngung@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}'),
  ('20000000-0000-0000-0000-0000000000d3', 'bikhoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set role = 'seller' where email in ('chi@example.com', 'binh@example.com', 'tamngung@example.com');
update public.profiles set full_name = 'Trần Thị Mai' where email = 'khach@example.com';
update public.profiles set status = 'suspended', suspended_reason = 'Kiểm thử' where email = 'bikhoa@example.com';

insert into public.shops (id, owner_id, slug, name, status) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'chi-beauty', 'Chi Beauty', 'active'),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'binh-store', 'Bình Store', 'active'),
  ('30000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'shop-ngung', 'Shop Ngưng', 'suspended');

insert into public.products (id, shop_id, slug, name, brand_name, category, product_type, price, stock, status, placeholder_visual, key_ingredients) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000c1', 'toner-chi', 'Toner Chi', 'Chi Lab', 'skincare', 'toner', 200000, 50, 'active', '{"shape":"bottle"}', '{}'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000c2', 'son-binh', 'Son Bình', 'Bình Color', 'makeup', 'lipstick', 100000, 10, 'active', '{"shape":"lipstick"}', '{}');

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated, anon;

-- ---------------------------------------------------------------- Danh mục, loại sản phẩm mới
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, stock, status)
values ('30000000-0000-0000-0000-0000000000c1', 'nuoc-hoa-go-tram', 'Nước hoa gỗ trầm', 'Chi Lab', 'fragrance', 'perfume-unisex', 650000, 5, 'draft');
insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, stock, status)
values ('30000000-0000-0000-0000-0000000000c1', 'sua-rua-mat-nam', 'Sữa rửa mặt nam than tre', 'Chi Lab', 'men', 'men-cleanser', 150000, 5, 'draft');
select tests.check((select count(*) from public.products where slug in ('nuoc-hoa-go-tram', 'sua-rua-mat-nam')) = 2, 'Người bán tạo được sản phẩm Nước hoa và Nam giới');
select tests.throws($q$insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, stock, status)
  values ('30000000-0000-0000-0000-0000000000c1', 'sai-danh-muc', 'Sai danh mục', 'Chi Lab', 'thuoc', 'serum', 100000, 1, 'draft')$q$, '23514', 'Danh mục không có trong danh sách bị từ chối');
select tests.throws($q$insert into public.products (shop_id, slug, name, brand_name, category, product_type, price, stock, status)
  values ('30000000-0000-0000-0000-0000000000c1', 'sai-loai', 'Sai loại', 'Chi Lab', 'fragrance', 'thuoc-xit', 100000, 1, 'draft')$q$, '23514', 'Loại sản phẩm không có trong danh sách bị từ chối');
commit;
select tests.check((select search_text from public.products where slug = 'nuoc-hoa-go-tram') like '%nuoc hoa unisex%', 'Tìm không dấu theo nhãn loại mới ("nuoc hoa unisex")');
select tests.check((select search_text from public.products where slug = 'sua-rua-mat-nam') like '%nam gioi%', 'Tìm không dấu theo danh mục mới ("nam gioi")');
update public.products set status = 'active', placeholder_visual = '{"shape":"bottle"}' where slug in ('nuoc-hoa-go-tram', 'sua-rua-mat-nam');
begin;
set local role anon;
select tests.check((select count(*) from public.search_products(p_category => 'fragrance')) = 1, 'Lọc danh mục Nước hoa');
select tests.check((select count(*) from public.search_products(p_query => 'nuoc hoa')) = 1, 'Tìm "nuoc hoa" ra sản phẩm nước hoa');
select tests.check((select count(*) from public.search_products(p_query => 'cham soc nam')) = 1, 'Tìm "cham soc nam" ra sản phẩm Nam giới');
commit;

-- ---------------------------------------------------------------- Nội dung trang
begin;
set local role anon;
select tests.check((select count(*) from public.site_pages) = 0, 'Chưa có nội dung riêng: website dùng mặc định');
select tests.throws($q$select public.admin_save_page('about', 'Giới thiệu', '', 'Nội dung đủ dài để lưu trang giới thiệu.')$q$, '42501', 'Khách vãng lai KHÔNG gọi được admin_save_page');
select tests.throws($q$insert into public.site_pages (slug, body) values ('about', 'chèn thẳng')$q$, '42501', 'Khách vãng lai KHÔNG chèn thẳng vào site_pages');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.admin_save_page('about', 'Hack', '', 'Nội dung đủ dài để lưu trang giới thiệu.')$q$, '42501', 'Khách KHÔNG sửa được nội dung trang');
select tests.throws($q$select public.admin_reset_page('about')$q$, '42501', 'Khách KHÔNG khôi phục được nội dung trang');
select tests.throws($q$update public.site_pages set body = 'x'$q$, '42501', 'Khách KHÔNG update thẳng site_pages');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.admin_save_page('terms', 'Điều khoản', '', 'Người bán sửa điều khoản của sàn.')$q$, '42501', 'Người bán KHÔNG sửa được nội dung trang');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select public.admin_save_page('about', '  Về chúng tôi  ', 'Giới thiệu ngắn', E'## Chúng tôi là ai\nSàn mỹ phẩm nhiều cửa hàng.');
select public.admin_save_page('announcement', '', '', 'Miễn phí giao hàng cho đơn từ 500.000đ');
select public.admin_save_page('footer', '', '', '');
select tests.check((select title from public.site_pages where slug = 'about') = 'Về chúng tôi', 'Admin lưu được trang Giới thiệu (tự cắt khoảng trắng)');
select public.admin_save_page('about', 'Giới thiệu', '', E'## Chúng tôi là ai\nSàn mỹ phẩm nhiều cửa hàng, sửa lần 2.');
select tests.check((select count(*) from public.site_pages where slug = 'about') = 1 and (select body from public.site_pages where slug = 'about') like '%lần 2%', 'Lưu lần 2 cập nhật, không tạo dòng trùng');
select tests.throws($q$select public.admin_save_page('announcement', '', '', E'Dòng 1\nDòng 2')$q$, '22023', 'Thanh thông báo nhiều dòng bị từ chối');
select tests.throws($q$select public.admin_save_page('announcement', '', '', repeat('a', 201))$q$, '22023', 'Thanh thông báo quá 200 ký tự bị từ chối');
select tests.throws($q$select public.admin_save_page('faq', 'Hỏi đáp', '', 'ngắn')$q$, '22023', 'Nội dung trang quá ngắn bị từ chối');
select tests.throws($q$select public.admin_save_page('trang-la', 'X', '', 'Nội dung đủ dài để lưu trang lạ.')$q$, 'P0002', 'Trang không có trong danh sách bị từ chối');
select public.admin_reset_page('announcement');
select tests.check((select count(*) from public.site_pages where slug = 'announcement') = 0, 'Khôi phục mặc định xóa nội dung riêng');
commit;
select tests.check((select updated_by from public.site_pages where slug = 'about') = '20000000-0000-0000-0000-0000000000a1', 'Ghi người sửa');
select tests.check((select count(*) from public.audit_logs where action = 'page.update' and target_id = 'about') = 2, 'Nhật ký ghi mỗi lần sửa trang');
select tests.check((select count(*) from public.audit_logs where action = 'page.reset' and target_id = 'announcement') = 1, 'Nhật ký ghi khôi phục mặc định');
begin;
set local role anon;
select tests.check((select body from public.site_pages where slug = 'about') like '%lần 2%', 'Khách vãng lai đọc được nội dung trang đã lưu');
select tests.check((select title from public.site_pages where slug = 'footer') = '', 'Mô tả chân trang để trống được (ẩn ở website)');
commit;
update public.profiles set status = 'suspended' where email = 'admin1@example.com';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.throws($q$select public.admin_save_page('about', 'Giới thiệu', '', 'Admin bị khóa thử sửa trang.')$q$, '42501', 'Admin bị khóa KHÔNG sửa được nội dung trang');
commit;
update public.profiles set status = 'active' where email = 'admin1@example.com';

-- ---------------------------------------------------------------- Tin nhắn: bắt đầu trò chuyện
begin;
set local role anon;
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c1', 'Xin chào')$q$, '42501', 'Khách vãng lai KHÔNG gửi được tin nhắn');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
insert into tests.ctx values ('conv_chi', public.start_conversation('30000000-0000-0000-0000-0000000000c1', '  Toner này dùng cho da dầu được không shop?  ', '40000000-0000-0000-0000-000000000001')::text);
select tests.check((select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where c.customer_id = auth.uid()) = 1, 'Khách gửi tin nhắn đầu tiên cho cửa hàng');
select tests.check((select body from public.messages order by id desc limit 1) = 'Toner này dùng cho da dầu được không shop?', 'Nội dung được cắt khoảng trắng hai đầu');
select tests.check((select product_id from public.messages order by id desc limit 1) = '40000000-0000-0000-0000-000000000001', 'Tin nhắn đính kèm sản phẩm đang hỏi');
select public.start_conversation('30000000-0000-0000-0000-0000000000c1', 'Shop ơi?');
select tests.check((select count(*) from public.conversations where customer_id = auth.uid()) = 1, 'Nhắn lại cùng cửa hàng: dùng chung 1 cuộc trò chuyện');
select tests.check((select staff_unread from public.conversations where id = (select v::uuid from tests.ctx where k = 'conv_chi')) = 2, 'Đếm 2 tin chưa đọc phía cửa hàng');
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c3', 'Còn hàng không?')$q$, 'P0002', 'KHÔNG nhắn được cửa hàng đang tạm ngưng');
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c1', 'Hỏi son', '40000000-0000-0000-0000-000000000002')$q$, '22023', 'KHÔNG đính kèm sản phẩm của cửa hàng khác');
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c1', '   ')$q$, '22023', 'Tin nhắn trống bị từ chối');
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c1', repeat('a', 2001))$q$, '22023', 'Tin nhắn quá 2.000 ký tự bị từ chối');
select tests.throws($q$insert into public.messages (conversation_id, sender_role, body) values ((select v::uuid from tests.ctx where k = 'conv_chi'), 'shop', 'Giả làm shop')$q$, '42501', 'KHÔNG chèn thẳng tin nhắn (giả làm cửa hàng)');
select tests.throws($q$insert into public.conversations (customer_id, shop_id) values ('20000000-0000-0000-0000-0000000000d2', '30000000-0000-0000-0000-0000000000c1')$q$, '42501', 'KHÔNG tạo thẳng cuộc trò chuyện cho người khác');
select tests.throws($q$update public.conversations set staff_unread = 0$q$, '42501', 'KHÔNG sửa thẳng số tin chưa đọc');
-- Hỏi bộ phận hỗ trợ của sàn
insert into tests.ctx values ('conv_support', public.start_conversation(null, 'Tôi muốn khiếu nại đơn WM261110-ABC123')::text);
select tests.check((select shop_id from public.conversations where id = (select v::uuid from tests.ctx where k = 'conv_support')) is null, 'Khách gửi câu hỏi cho bộ phận hỗ trợ của sàn');
select tests.check((select count(*) from public.inbox('customer')) = 2, 'Hộp thư của khách có 2 cuộc trò chuyện');
select tests.throws($q$select * from public.inbox('support')$q$, '42501', 'Khách KHÔNG xem được hộp thư hỗ trợ');
commit;
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000c1' and kind = 'message') = 1, 'Chủ shop nhận 1 thông báo (không lặp khi khách gửi nhiều tin)');

-- Chủ shop chính mình
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c1';
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c1', 'Tự nhắn shop mình')$q$, '22023', 'Chủ shop KHÔNG tự nhắn cửa hàng của mình');
select tests.check((select count(*) from public.inbox('shop')) = 1, 'Chủ shop thấy cuộc trò chuyện của shop mình');
select tests.check((select customer_name from public.inbox('shop')) = 'Trần Thị Mai' and (select customer_email from public.inbox('shop')) is null, 'Chủ shop thấy tên khách, KHÔNG thấy email');
select tests.check((select count(*) from public.messages) = 2, 'Chủ shop đọc được tin trong shop mình, KHÔNG thấy tin gửi hỗ trợ');
select public.send_message((select v::uuid from tests.ctx where k = 'conv_chi'), 'Dạ được bạn nhé, toner không cồn.');
select public.mark_conversation_read((select v::uuid from tests.ctx where k = 'conv_chi'));
select tests.check((select staff_unread from public.conversations where shop_id is not null) = 0 and (select customer_unread from public.conversations where shop_id is not null) = 1, 'Cửa hàng trả lời và đánh dấu đã đọc');
select tests.check((select sender_role from public.messages order by id desc limit 1) = 'shop', 'Tin trả lời ghi vai trò "shop" (do database xác định)');
select tests.throws($q$select public.send_message((select v::uuid from tests.ctx where k = 'conv_support'), 'Chen vào hỗ trợ')$q$, '42501', 'Chủ shop KHÔNG gửi tin vào cuộc trò chuyện hỗ trợ của khách');
commit;
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000d1' and kind = 'message' and title = 'Tin nhắn mới từ Chi Beauty' and link like '/messages?c=%') = 1, 'Khách nhận thông báo khi cửa hàng trả lời');

-- Người khác
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000c2';
select tests.check((select count(*) from public.conversations) = 0 and (select count(*) from public.messages) = 0, 'Chủ shop khác KHÔNG đọc được tin nhắn');
select tests.throws($q$select public.send_message((select v::uuid from tests.ctx where k = 'conv_chi'), 'Chen ngang')$q$, '42501', 'Chủ shop khác KHÔNG gửi tin vào cuộc trò chuyện');
select tests.throws($q$select public.mark_conversation_read((select v::uuid from tests.ctx where k = 'conv_chi'))$q$, '42501', 'Chủ shop khác KHÔNG đánh dấu đã đọc');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.check((select count(*) from public.conversations) = 0 and (select count(*) from public.messages) = 0, 'Khách khác KHÔNG đọc được tin nhắn');
select tests.check((select count(*) from public.inbox('shop')) = 0, 'Khách khác: hộp thư cửa hàng trống');
commit;

-- Admin
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000a1';
select tests.check((select count(*) from public.inbox('support')) = 1, 'Admin thấy cuộc trò chuyện hỗ trợ');
select tests.check((select customer_email from public.inbox('support')) = 'khach@example.com', 'Admin thấy email khách trong hộp thư hỗ trợ');
select tests.check((select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where c.shop_id is not null) = 0, 'Admin KHÔNG đọc tin nhắn riêng giữa khách và cửa hàng');
select tests.check((public.unread_messages() ->> 'support')::int = 1, 'Admin thấy 1 tin hỗ trợ chưa đọc');
select public.send_message((select v::uuid from tests.ctx where k = 'conv_support'), 'Chào bạn, sàn đã nhận khiếu nại và sẽ liên hệ cửa hàng.');
select tests.check((select sender_role from public.messages order by id desc limit 1) = 'admin', 'Admin trả lời trong cuộc trò chuyện hỗ trợ');
select tests.throws($q$select public.send_message((select v::uuid from tests.ctx where k = 'conv_chi'), 'Admin chen vào shop')$q$, '42501', 'Admin KHÔNG gửi tin vào cuộc trò chuyện của cửa hàng');
commit;
select tests.check((select count(*) from public.notifications where user_id = '20000000-0000-0000-0000-0000000000d1' and title = 'Bộ phận hỗ trợ đã trả lời bạn') = 1, 'Khách nhận thông báo khi bộ phận hỗ trợ trả lời');

-- Khách đọc tin
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((public.unread_messages() ->> 'customer')::int = 2, 'Khách có 2 tin chưa đọc (shop + hỗ trợ)');
select public.mark_conversation_read((select v::uuid from tests.ctx where k = 'conv_chi'));
select tests.check((public.unread_messages() ->> 'customer')::int = 1, 'Đánh dấu đã đọc 1 cuộc trò chuyện');
select tests.check((public.unread_messages() ->> 'support') is null, 'Khách không có số liệu hộp thư hỗ trợ');
commit;

-- Chống spam: 20 tin / phút
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select public.start_conversation('30000000-0000-0000-0000-0000000000c2', 'Tin số ' || g) from generate_series(1, 20) g;
select tests.throws($q$select public.start_conversation('30000000-0000-0000-0000-0000000000c2', 'Tin thứ 21')$q$, '54000', 'Gửi quá 20 tin trong 1 phút bị chặn');
commit;

-- Cửa hàng bị tạm ngưng sau khi đã trò chuyện
update public.shops set status = 'suspended' where id = '30000000-0000-0000-0000-0000000000c2';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.throws($q$select public.send_message((select id from public.conversations limit 1), 'Còn bán không?')$q$, '22023', 'Cửa hàng bị tạm ngưng: khách chưa gửi tiếp được');
select tests.check((select count(*) from public.messages) = 20, 'Khách vẫn đọc được tin cũ');
commit;

-- Tài khoản bị khóa
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d3';
select tests.throws($q$select public.start_conversation(null, 'Mở khóa giúp tôi')$q$, '42501', 'Tài khoản bị khóa KHÔNG gửi được tin nhắn');
commit;
update public.profiles set status = 'suspended' where email = 'khach@example.com';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d1';
select tests.check((select count(*) from public.conversations) = 0, 'Tài khoản bị khóa KHÔNG đọc được tin nhắn cũ');
select tests.throws($q$select * from public.inbox('customer')$q$, '42501', 'Tài khoản bị khóa KHÔNG mở được hộp thư');
commit;

-- Quyền gọi hàm nội bộ
begin;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-0000000000d2';
select tests.throws($q$select private.post_message((select id from public.conversations limit 1), 'shop', 'Giả làm shop', null)$q$, '42501', 'KHÔNG gọi được hàm nội bộ post_message');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
