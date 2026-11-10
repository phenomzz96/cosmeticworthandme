-- =============================================================================
-- Worth & Me — Migration 009 (Đợt C): nội dung trang do Admin sửa, tin nhắn khách ↔ cửa hàng / sàn,
-- danh mục Nước hoa và Nam giới, thêm loại sản phẩm
--
-- Chạy SAU migration 001..008. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc nghiệp vụ:
--   * Nội dung trang (Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản, thanh thông báo, mô tả chân trang):
--     ai cũng đọc được; chỉ Admin sửa qua hàm admin_save_page / admin_reset_page (có nhật ký).
--     Chưa có dòng trong bảng = website dùng nội dung mặc định có sẵn trong mã nguồn.
--   * Tin nhắn: mỗi khách có 1 cuộc trò chuyện với mỗi cửa hàng và 1 cuộc trò chuyện với bộ phận hỗ trợ của sàn (shop_id = null).
--     Chỉ khách đó, chủ cửa hàng đó (hoặc Admin, với cuộc trò chuyện hỗ trợ) đọc và gửi được.
--     Admin KHÔNG đọc tin nhắn giữa khách và cửa hàng. Trình duyệt không ghi thẳng vào bảng, mọi thao tác qua hàm.
--     Giới hạn 20 tin / phút / người để chống spam. Người nhận được thông báo khi có tin mới (1 thông báo cho tới khi đọc).
--   * Danh mục mới: Nước hoa (fragrance), Nam giới (men); thêm loại sản phẩm cho các danh mục cũ.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DANH MỤC VÀ LOẠI SẢN PHẨM
-- -----------------------------------------------------------------------------
alter table public.products drop constraint products_category_check;
alter table public.products add constraint products_category_check check (category in (
  'skincare', 'makeup', 'haircare', 'body-care', 'fragrance', 'men', 'beauty-tools'));

alter table public.products drop constraint products_product_type_check;
alter table public.products add constraint products_product_type_check check (product_type in (
  'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask', 'eye-care', 'exfoliant', 'lip-care',
  'foundation', 'cushion', 'concealer', 'lipstick', 'mascara', 'eyeliner', 'eyeshadow', 'blush',
  'shampoo', 'conditioner', 'hair-mask', 'hair-oil', 'hair-styling',
  'body-wash', 'body-scrub', 'body-lotion', 'hand-cream', 'deodorant',
  'perfume-women', 'perfume-men', 'perfume-unisex', 'body-mist',
  'men-cleanser', 'men-moisturizer', 'shaving', 'beard-care',
  'brush', 'sponge', 'facial-device'));

-- Chữ dùng cho tìm kiếm không dấu (trigger products_search_text gọi hàm này)
create or replace function private.product_search_labels(p_category text, p_type text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select concat_ws(' ',
    case p_category
      when 'skincare' then 'skincare chăm sóc da' when 'makeup' then 'makeup trang điểm'
      when 'haircare' then 'haircare chăm sóc tóc' when 'body-care' then 'body care chăm sóc cơ thể'
      when 'fragrance' then 'fragrance nước hoa hương thơm perfume'
      when 'men' then 'men nam giới đàn ông chăm sóc nam'
      when 'beauty-tools' then 'beauty tools dụng cụ làm đẹp' end,
    case p_type
      when 'cleanser' then 'sữa rửa mặt' when 'toner' then 'toner' when 'serum' then 'serum'
      when 'moisturizer' then 'kem dưỡng' when 'sunscreen' then 'kem chống nắng' when 'mask' then 'mặt nạ'
      when 'eye-care' then 'dưỡng mắt' when 'exfoliant' then 'tẩy tế bào chết tẩy da chết'
      when 'lip-care' then 'dưỡng môi son dưỡng'
      when 'foundation' then 'kem nền' when 'cushion' then 'cushion' when 'concealer' then 'che khuyết điểm kem che'
      when 'lipstick' then 'son môi' when 'mascara' then 'mascara' when 'eyeliner' then 'kẻ mắt eyeliner'
      when 'eyeshadow' then 'phấn mắt màu mắt' when 'blush' then 'má hồng'
      when 'shampoo' then 'dầu gội' when 'conditioner' then 'dầu xả' when 'hair-mask' then 'ủ tóc kem ủ'
      when 'hair-oil' then 'dầu dưỡng tóc' when 'hair-styling' then 'tạo kiểu tóc sáp vuốt tóc gôm xịt tóc wax'
      when 'body-wash' then 'sữa tắm' when 'body-scrub' then 'tẩy tế bào chết cơ thể muối tắm'
      when 'body-lotion' then 'dưỡng thể' when 'hand-cream' then 'kem tay' when 'deodorant' then 'khử mùi lăn nách'
      when 'perfume-women' then 'nước hoa nữ' when 'perfume-men' then 'nước hoa nam'
      when 'perfume-unisex' then 'nước hoa unisex nam nữ' when 'body-mist' then 'xịt thơm toàn thân body mist'
      when 'men-cleanser' then 'sữa rửa mặt nam' when 'men-moisturizer' then 'kem dưỡng nam dưỡng da nam'
      when 'shaving' then 'cạo râu bọt cạo râu sau cạo' when 'beard-care' then 'dưỡng râu dầu râu'
      when 'brush' then 'cọ trang điểm' when 'sponge' then 'mút trang điểm' when 'facial-device' then 'máy rửa mặt' end)
$$;

-- -----------------------------------------------------------------------------
-- 2. NỘI DUNG TRANG DO ADMIN SỬA
-- -----------------------------------------------------------------------------
create table public.site_pages (
  slug       text primary key check (slug in ('about', 'contact', 'faq', 'policies', 'terms', 'announcement', 'footer')),
  title      text not null default '' check (char_length(title) <= 120),
  intro      text not null default '' check (char_length(intro) <= 500),
  body       text not null default '' check (char_length(body) <= 30000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
comment on table public.site_pages is 'Nội dung trang thông tin. Không có dòng = website dùng nội dung mặc định trong mã nguồn.';

alter table public.site_pages enable row level security;
revoke all on public.site_pages from anon, authenticated;
grant select (slug, title, intro, body, updated_at) on public.site_pages to anon, authenticated;
create policy site_pages_select on public.site_pages for select to anon, authenticated using (true);

create or replace function public.admin_save_page(p_slug text, p_title text, p_intro text, p_body text)
returns public.site_pages
language plpgsql security definer set search_path = ''
as $$
declare
  v_row   public.site_pages;
  v_title text := btrim(coalesce(p_title, ''));
  v_intro text := btrim(coalesce(p_intro, ''));
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền sửa nội dung trang.' using errcode = '42501';
  end if;
  if p_slug is null or p_slug not in ('about', 'contact', 'faq', 'policies', 'terms', 'announcement', 'footer') then
    raise exception 'Trang không tồn tại.' using errcode = 'P0002';
  end if;
  if p_slug = 'announcement' and (char_length(v_body) > 200 or v_body ~ '[\r\n]') then
    raise exception 'Thanh thông báo tối đa 200 ký tự, viết trên một dòng.' using errcode = '22023';
  end if;
  if p_slug = 'footer' and char_length(v_body) > 300 then
    raise exception 'Mô tả chân trang tối đa 300 ký tự.' using errcode = '22023';
  end if;
  if p_slug in ('about', 'contact', 'faq', 'policies', 'terms') and char_length(v_body) < 20 then
    raise exception 'Nội dung trang quá ngắn (ít nhất 20 ký tự). Muốn dùng lại nội dung mặc định, hãy bấm "Khôi phục mặc định".' using errcode = '22023';
  end if;

  insert into public.site_pages (slug, title, intro, body, updated_at, updated_by)
  values (p_slug, v_title, v_intro, v_body, now(), auth.uid())
  on conflict (slug) do update
     set title = excluded.title, intro = excluded.intro, body = excluded.body,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into v_row;

  perform private.log_action('page.update', 'site_page', p_slug,
    jsonb_build_object('title', v_title, 'length', char_length(v_body)));
  return v_row;
end;
$$;

create or replace function public.admin_reset_page(p_slug text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền sửa nội dung trang.' using errcode = '42501';
  end if;
  delete from public.site_pages where slug = p_slug;
  if found then
    perform private.log_action('page.reset', 'site_page', p_slug, '{}'::jsonb);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. TIN NHẮN
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order', 'payment', 'refund', 'review', 'shop', 'product', 'system', 'message'));

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id) on delete cascade,
  shop_id         uuid references public.shops (id) on delete cascade,   -- null = hỗ trợ của sàn
  last_message_at timestamptz not null default now(),
  last_preview    text not null default '' check (char_length(last_preview) <= 140),
  last_sender     text check (last_sender in ('customer', 'shop', 'admin')),
  customer_unread integer not null default 0 check (customer_unread >= 0),
  staff_unread    integer not null default 0 check (staff_unread >= 0),
  created_at      timestamptz not null default now()
);
create unique index conversations_pair_uq
  on public.conversations (customer_id, coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index conversations_shop_idx on public.conversations (shop_id, last_message_at desc);
create index conversations_customer_idx on public.conversations (customer_id, last_message_at desc);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  sender_role     text not null check (sender_role in ('customer', 'shop', 'admin')),
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  product_id      uuid references public.products (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, id);
create index messages_sender_time_idx on public.messages (sender_id, created_at desc);

-- Người gọi được xem cuộc trò chuyện: là khách, là chủ cửa hàng, hoặc Admin (chỉ cuộc trò chuyện hỗ trợ)
create or replace function public.can_view_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id
       and public.is_active_user()
       and (c.customer_id = auth.uid()
            or (c.shop_id is not null and public.owns_shop(c.shop_id))
            or (c.shop_id is null and public.is_admin()))
  );
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;
create policy conversations_select on public.conversations for select to authenticated
  using (public.can_view_conversation(id));
create policy messages_select on public.messages for select to authenticated
  using (public.can_view_conversation(conversation_id));

-- Ghi 1 tin nhắn (nội bộ, đã kiểm tra quyền ở hàm gọi)
create or replace function private.post_message(p_conversation_id uuid, p_role text, p_body text, p_product_id uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_body  text := btrim(coalesce(p_body, ''));
  v_conv  public.conversations;
  v_id    bigint;
  v_shop  public.shops;
  v_recent integer;
begin
  if char_length(v_body) = 0 then
    raise exception 'Hãy nhập nội dung tin nhắn.' using errcode = '22023';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Tin nhắn tối đa 2.000 ký tự.' using errcode = '22023';
  end if;
  select count(*) into v_recent from public.messages
   where sender_id = auth.uid() and created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception 'Bạn gửi tin quá nhanh. Chờ một chút rồi gửi tiếp.' using errcode = '54000';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id for update;

  insert into public.messages (conversation_id, sender_id, sender_role, body, product_id)
  values (p_conversation_id, auth.uid(), p_role, v_body, p_product_id)
  returning id into v_id;

  update public.conversations
     set last_message_at = now(),
         last_preview    = left(regexp_replace(v_body, '\s+', ' ', 'g'), 140),
         last_sender     = p_role,
         customer_unread = case when p_role = 'customer' then 0 else customer_unread + 1 end,
         staff_unread    = case when p_role = 'customer' then staff_unread + 1 else 0 end
   where id = p_conversation_id;

  -- Báo người nhận (chỉ 1 thông báo cho tới khi họ đọc)
  if v_conv.shop_id is not null then
    select * into v_shop from public.shops where id = v_conv.shop_id;
  end if;
  if p_role = 'customer' and v_conv.shop_id is not null and v_conv.staff_unread = 0 then
    perform private.notify(v_shop.owner_id, 'message', 'Tin nhắn mới từ khách hàng',
      left(v_body, 200), '/seller/messages?c=' || p_conversation_id);
  elsif p_role <> 'customer' and v_conv.customer_unread = 0 then
    perform private.notify(v_conv.customer_id, 'message',
      case when v_conv.shop_id is null then 'Bộ phận hỗ trợ đã trả lời bạn' else 'Tin nhắn mới từ ' || v_shop.name end,
      left(v_body, 200), '/messages?c=' || p_conversation_id);
  end if;
  return v_id;
end;
$$;

-- Khách bắt đầu (hoặc tiếp tục) trò chuyện với 1 cửa hàng, hoặc với bộ phận hỗ trợ (p_shop_id = null)
create or replace function public.start_conversation(p_shop_id uuid, p_body text, p_product_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để gửi tin nhắn.' using errcode = '42501';
  end if;
  if p_shop_id is not null then
    if not public.is_shop_public(p_shop_id) then
      raise exception 'Cửa hàng không tồn tại hoặc đang tạm ngưng.' using errcode = 'P0002';
    end if;
    if public.owns_shop(p_shop_id) then
      raise exception 'Bạn không thể nhắn tin cho cửa hàng của chính mình.' using errcode = '22023';
    end if;
  end if;
  if p_product_id is not null and not exists (
      select 1 from public.products p
       where p.id = p_product_id and public.is_product_public(p.id)
         and (p_shop_id is null or p.shop_id = p_shop_id)) then
    raise exception 'Sản phẩm không thuộc cửa hàng này.' using errcode = '22023';
  end if;

  insert into public.conversations (customer_id, shop_id)
  values (auth.uid(), p_shop_id)
  on conflict (customer_id, (coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid))) do nothing;

  select id into v_id from public.conversations
   where customer_id = auth.uid() and shop_id is not distinct from p_shop_id;

  perform private.post_message(v_id, 'customer', p_body, p_product_id);
  return v_id;
end;
$$;

-- Vai trò của người gọi trong cuộc trò chuyện (null = không có quyền)
create or replace function private.conversation_role(p_conversation_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when not public.is_active_user() then null
    when c.customer_id = auth.uid() then 'customer'
    when c.shop_id is not null and public.owns_shop(c.shop_id) then 'shop'
    when c.shop_id is null and public.is_admin() then 'admin'
  end
  from public.conversations c where c.id = p_conversation_id;
$$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := private.conversation_role(p_conversation_id);
  v_shop uuid;
begin
  if v_role is null then
    raise exception 'Bạn không có quyền gửi tin trong cuộc trò chuyện này.' using errcode = '42501';
  end if;
  select shop_id into v_shop from public.conversations where id = p_conversation_id;
  if v_role = 'customer' and v_shop is not null and not public.is_shop_public(v_shop) then
    raise exception 'Cửa hàng đang tạm ngưng, chưa nhận tin nhắn.' using errcode = '22023';
  end if;
  return private.post_message(p_conversation_id, v_role, p_body, null);
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := private.conversation_role(p_conversation_id);
begin
  if v_role is null then
    raise exception 'Bạn không có quyền xem cuộc trò chuyện này.' using errcode = '42501';
  end if;
  if v_role = 'customer' then
    update public.conversations set customer_unread = 0 where id = p_conversation_id and customer_unread > 0;
  else
    update public.conversations set staff_unread = 0 where id = p_conversation_id and staff_unread > 0;
  end if;
end;
$$;

-- Hộp thư: 'customer' (của tôi), 'shop' (các cửa hàng tôi sở hữu), 'support' (Admin: hỗ trợ của sàn)
create or replace function public.inbox(p_scope text)
returns table (
  id uuid, shop_id uuid, shop_name text, shop_slug text, customer_name text, customer_email text,
  last_message_at timestamptz, last_preview text, last_sender text, unread integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  if p_scope = 'support' and not public.is_admin() then
    raise exception 'Bạn không có quyền xem hộp thư hỗ trợ.' using errcode = '42501';
  end if;
  if p_scope not in ('customer', 'shop', 'support') then
    raise exception 'Hộp thư không hợp lệ.' using errcode = '22023';
  end if;

  return query
  select c.id, c.shop_id, s.name, s.slug,
         coalesce(nullif(btrim(pr.full_name), ''), 'Khách hàng'),
         case when p_scope = 'support' then pr.email end,
         c.last_message_at, c.last_preview, c.last_sender,
         case when p_scope = 'customer' then c.customer_unread else c.staff_unread end
    from public.conversations c
    left join public.shops s on s.id = c.shop_id
    join public.profiles pr on pr.id = c.customer_id
   where (p_scope = 'customer' and c.customer_id = auth.uid())
      or (p_scope = 'shop' and c.shop_id is not null and s.owner_id = auth.uid())
      or (p_scope = 'support' and c.shop_id is null)
   order by c.last_message_at desc
   limit 200;
end;
$$;

-- Số tin chưa đọc của người gọi theo từng hộp thư
create or replace function public.unread_messages()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'customer', coalesce((select sum(customer_unread) from public.conversations where customer_id = auth.uid()), 0),
    'shop', coalesce((select sum(c.staff_unread) from public.conversations c join public.shops s on s.id = c.shop_id
                       where s.owner_id = auth.uid()), 0),
    'support', case when public.is_admin()
                    then coalesce((select sum(staff_unread) from public.conversations where shop_id is null), 0) end)
  where public.is_active_user();
$$;

-- -----------------------------------------------------------------------------
-- 4. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.post_message(uuid, text, text, uuid), private.conversation_role(uuid)
  from public, anon, authenticated;

revoke execute on function public.admin_save_page(text, text, text, text), public.admin_reset_page(text),
  public.can_view_conversation(uuid), public.start_conversation(uuid, text, uuid), public.send_message(uuid, text),
  public.mark_conversation_read(uuid), public.inbox(text), public.unread_messages()
  from public, anon;
grant execute on function public.admin_save_page(text, text, text, text), public.admin_reset_page(text),
  public.can_view_conversation(uuid), public.start_conversation(uuid, text, uuid), public.send_message(uuid, text),
  public.mark_conversation_read(uuid), public.inbox(text), public.unread_messages()
  to authenticated;
