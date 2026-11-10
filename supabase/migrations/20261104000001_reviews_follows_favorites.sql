-- =============================================================================
-- Worth & Me — Migration 007: Đánh giá sản phẩm, theo dõi shop, yêu thích, loại "Tạo kiểu tóc"
--
-- Chạy SAU migration 001..006. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc nghiệp vụ:
--   * Chỉ người đã NHẬN HÀNG (đơn con ở trạng thái "Đã giao") mới đánh giá được sản phẩm đó.
--     Mỗi người 1 đánh giá cho 1 sản phẩm, sửa hoặc xóa được đánh giá của mình.
--   * Điểm trung bình và số lượt đánh giá của sản phẩm, điểm của shop, số người theo dõi shop
--     do database tự tính (trigger). Không ai sửa trực tiếp được.
--   * Người bán trả lời đánh giá sản phẩm của shop mình. Admin ẩn đánh giá vi phạm (bắt buộc lý do, có nhật ký).
--   * Tên người đánh giá được che bớt (ví dụ "An N."), không lộ email hay họ tên đầy đủ.
--   * Theo dõi shop / yêu thích sản phẩm: mỗi người chỉ thấy danh sách của mình.
--   * Các con số mẫu cũ (điểm, lượt đánh giá, người theo dõi, lượt bán của sản phẩm mẫu) được đưa về số thật.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. LOẠI SẢN PHẨM MỚI: TẠO KIỂU TÓC (sáp, gôm, wax)
-- -----------------------------------------------------------------------------
alter table public.products drop constraint products_product_type_check;
alter table public.products add constraint products_product_type_check check (product_type in (
  'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask', 'eye-care',
  'foundation', 'cushion', 'lipstick', 'mascara', 'blush',
  'shampoo', 'conditioner', 'hair-oil', 'hair-styling',
  'body-wash', 'body-lotion', 'hand-cream',
  'brush', 'sponge', 'facial-device'));

create or replace function private.product_search_labels(p_category text, p_type text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select concat_ws(' ',
    case p_category
      when 'skincare' then 'skincare chăm sóc da' when 'makeup' then 'makeup trang điểm'
      when 'haircare' then 'haircare chăm sóc tóc' when 'body-care' then 'body care chăm sóc cơ thể'
      when 'beauty-tools' then 'beauty tools dụng cụ làm đẹp' end,
    case p_type
      when 'cleanser' then 'sữa rửa mặt' when 'toner' then 'toner' when 'serum' then 'serum'
      when 'moisturizer' then 'kem dưỡng' when 'sunscreen' then 'kem chống nắng' when 'mask' then 'mặt nạ'
      when 'eye-care' then 'dưỡng mắt' when 'foundation' then 'kem nền' when 'cushion' then 'cushion'
      when 'lipstick' then 'son môi' when 'mascara' then 'mascara' when 'blush' then 'má hồng'
      when 'shampoo' then 'dầu gội' when 'conditioner' then 'dầu xả' when 'hair-oil' then 'dầu dưỡng tóc'
      when 'hair-styling' then 'tạo kiểu tóc sáp vuốt tóc gôm xịt tóc wax'
      when 'body-wash' then 'sữa tắm' when 'body-lotion' then 'dưỡng thể' when 'hand-cream' then 'kem tay'
      when 'brush' then 'cọ trang điểm' when 'sponge' then 'mút trang điểm' when 'facial-device' then 'máy rửa mặt' end)
$$;

-- Sửa dữ liệu đã nhập: sáp / gôm / wax đang bị xếp vào "Dầu gội" (trigger tự cập nhật chuỗi tìm kiếm)
alter table public.products disable trigger products_touch_updated_at;
update public.products
   set product_type = 'hair-styling'
 where category = 'haircare' and product_type = 'shampoo'
   and (name ~* '(^|\s)(sáp|gôm|wax|pomade|clay|keo vuốt)(\s|$)' or name ~* 'xịt tóc|vuốt tóc');
alter table public.products enable trigger products_touch_updated_at;

-- -----------------------------------------------------------------------------
-- 2. BẢNG
-- -----------------------------------------------------------------------------
create table public.product_reviews (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  -- Đơn con đã giao làm căn cứ được đánh giá
  shop_order_id     uuid references public.shop_orders (id) on delete set null,
  rating            smallint not null check (rating between 1 and 5),
  comment           text not null default '' check (char_length(comment) <= 1000),
  -- Tên hiển thị đã che bớt, chụp lại lúc đánh giá
  reviewer_name     text not null check (char_length(reviewer_name) between 1 and 40),
  seller_reply      text check (seller_reply is null or char_length(seller_reply) between 1 and 1000),
  seller_replied_at timestamptz,
  hidden            boolean not null default false,
  hidden_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (product_id, user_id),
  check (not hidden or hidden_reason is not null)
);
create index product_reviews_product_idx on public.product_reviews (product_id, created_at desc);
create index product_reviews_user_idx on public.product_reviews (user_id);

create table public.shop_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index shop_follows_shop_idx on public.shop_follows (shop_id);

create table public.product_favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index product_favorites_product_idx on public.product_favorites (product_id);

comment on table public.product_reviews is 'Đánh giá sản phẩm. Ghi qua hàm submit_review / delete_my_review / seller_reply_review / admin_set_review_hidden.';

-- Trình duyệt KHÔNG đọc/ghi thẳng bảng đánh giá (đọc qua get_product_reviews để che tên người đánh giá).
-- Theo dõi / yêu thích: chỉ đọc danh sách của mình; thêm / bỏ qua hàm toggle_*.
alter table public.product_reviews enable row level security;
alter table public.shop_follows enable row level security;
alter table public.product_favorites enable row level security;
revoke all on public.product_reviews, public.shop_follows, public.product_favorites from anon, authenticated;
grant select on public.shop_follows, public.product_favorites to authenticated;

create policy shop_follows_select_own on public.shop_follows for select to authenticated using (user_id = auth.uid());
create policy product_favorites_select_own on public.product_favorites for select to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. TỰ TÍNH ĐIỂM, LƯỢT ĐÁNH GIÁ, NGƯỜI THEO DÕI
-- -----------------------------------------------------------------------------
create or replace function private.refresh_review_stats(p_product_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from public.products where id = p_product_id;
  if v_shop is null then return; end if;

  update public.products p
     set rating = coalesce((select round(avg(r.rating), 1) from public.product_reviews r where r.product_id = p.id and not r.hidden), 0),
         review_count = (select count(*) from public.product_reviews r where r.product_id = p.id and not r.hidden)
   where p.id = p_product_id;

  update public.shops s
     set rating = coalesce((
           select round(avg(r.rating), 1)
             from public.product_reviews r join public.products p on p.id = r.product_id
            where p.shop_id = s.id and not r.hidden), 0)
   where s.id = v_shop;
end;
$$;

create or replace function private.product_reviews_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform private.refresh_review_stats(old.product_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform private.refresh_review_stats(new.product_id); end if;
  return null;
end;
$$;
create trigger product_reviews_stats after insert or update of rating, hidden, product_id or delete
  on public.product_reviews for each row execute function private.product_reviews_after_change();

create or replace function private.shop_follows_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_shop uuid := coalesce(new.shop_id, old.shop_id);
begin
  update public.shops set follower_count = (select count(*) from public.shop_follows f where f.shop_id = v_shop) where id = v_shop;
  return null;
end;
$$;
create trigger shop_follows_count after insert or delete on public.shop_follows
  for each row execute function private.shop_follows_after_change();

-- Không đổi updated_at của shop/sản phẩm chỉ vì số liệu thay đổi
create or replace function private.touch_updated_at_unless_stats()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'products'
     and (to_jsonb(new) - array['rating', 'review_count', 'sold_count', 'updated_at'])
       = (to_jsonb(old) - array['rating', 'review_count', 'sold_count', 'updated_at']) then
    return new;
  end if;
  if tg_table_name = 'shops'
     and (to_jsonb(new) - array['rating', 'follower_count', 'updated_at'])
       = (to_jsonb(old) - array['rating', 'follower_count', 'updated_at']) then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger shops_touch_updated_at on public.shops;
drop trigger products_touch_updated_at on public.products;
create trigger shops_touch_updated_at before update on public.shops for each row execute function private.touch_updated_at_unless_stats();
create trigger products_touch_updated_at before update on public.products for each row execute function private.touch_updated_at_unless_stats();

-- Tính lại toàn bộ số liệu từ dữ liệu thật: điểm, lượt đánh giá, người theo dõi,
-- lượt bán (= tổng số lượng trong các đơn con đã giao). Dùng ngay dưới đây và cuối file dữ liệu mẫu (seed).
create or replace function private.recompute_all_stats()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  update public.products p
     set rating = 0, review_count = 0,
         sold_count = coalesce((
           select sum(oi.quantity) from public.order_items oi
             join public.shop_orders so on so.id = oi.shop_order_id
            where oi.product_id = p.id and so.status = 'delivered'), 0);
  update public.shops s
     set rating = 0,
         follower_count = (select count(*) from public.shop_follows f where f.shop_id = s.id);
  for r in select distinct product_id from public.product_reviews loop
    perform private.refresh_review_stats(r.product_id);
  end loop;
end;
$$;

-- Đưa các con số mẫu cũ (điểm 4.7, "976 lượt", "12,8 N người theo dõi", lượt bán mẫu) về số thật
select private.recompute_all_stats();

-- -----------------------------------------------------------------------------
-- 4. HÀM ĐÁNH GIÁ
-- -----------------------------------------------------------------------------
-- Che tên: "Nguyễn Văn An" → "An N."; một từ → giữ nguyên (tối đa 20 ký tự)
create or replace function private.mask_name(p_full_name text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  w text[] := regexp_split_to_array(btrim(coalesce(p_full_name, '')), '\s+');
begin
  if coalesce(btrim(p_full_name), '') = '' then return 'Khách hàng'; end if;
  if cardinality(w) = 1 then return left(w[1], 20); end if;
  return left(w[cardinality(w)], 20) || ' ' || upper(left(w[1], 1)) || '.';
end;
$$;

-- Đơn con đã giao gần nhất của người gọi có chứa sản phẩm (null = chưa đủ điều kiện đánh giá)
create or replace function private.delivered_shop_order_for(p_product_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select so.id
    from public.shop_orders so
    join public.orders o on o.id = so.order_id
    join public.order_items oi on oi.shop_order_id = so.id
   where o.customer_id = auth.uid() and so.status = 'delivered' and oi.product_id = p_product_id
   order by so.delivered_at desc nulls last
   limit 1;
$$;

-- Xem đánh giá của một sản phẩm: tóm tắt, phân bố sao, danh sách (đánh giá bị ẩn không hiện),
-- và đánh giá của chính người xem + họ có được đánh giá không.
create or replace function public.get_product_reviews(p_product_id uuid, p_limit integer default 10, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_lim  integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_off  integer := greatest(coalesce(p_offset, 0), 0);
  v_mine public.product_reviews;
begin
  if not (public.is_product_public(p_product_id) or public.can_manage_shop(public.product_shop(p_product_id)) or public.is_admin()) then
    raise exception 'Không tìm thấy sản phẩm.' using errcode = 'P0002';
  end if;
  if v_uid is not null then
    select * into v_mine from public.product_reviews where product_id = p_product_id and user_id = v_uid;
  end if;

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'average', coalesce(round(avg(rating), 1), 0),
        'count', count(*),
        'distribution', jsonb_build_object(
          '5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
          '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2),
          '1', count(*) filter (where rating = 1)))
      from public.product_reviews where product_id = p_product_id and not hidden),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'rating', r.rating, 'comment', r.comment, 'reviewer_name', r.reviewer_name,
               'seller_reply', r.seller_reply, 'seller_replied_at', r.seller_replied_at,
               'created_at', r.created_at, 'updated_at', r.updated_at, 'is_mine', r.user_id = v_uid)
             order by r.created_at desc)
      from (select * from public.product_reviews
             where product_id = p_product_id and not hidden
             order by created_at desc limit v_lim offset v_off) r), '[]'::jsonb),
    'mine', case when v_mine.id is null then null else jsonb_build_object(
               'id', v_mine.id, 'rating', v_mine.rating, 'comment', v_mine.comment,
               'hidden', v_mine.hidden, 'hidden_reason', v_mine.hidden_reason) end,
    'can_review', v_uid is not null and public.is_active_user() and private.delivered_shop_order_for(p_product_id) is not null
  );
end;
$$;

-- Viết hoặc sửa đánh giá của mình (chỉ khi đã nhận hàng). Sửa một đánh giá bị ẩn thì nó vẫn bị ẩn.
create or replace function public.submit_review(p_product_id uuid, p_rating integer, p_comment text default '')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_so      uuid;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_name    text;
  v_id      uuid;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản đang hoạt động để đánh giá.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Hãy chọn từ 1 đến 5 sao.' using errcode = '22023';
  end if;
  if char_length(v_comment) > 1000 then
    raise exception 'Nhận xét tối đa 1.000 ký tự.' using errcode = '22023';
  end if;
  v_so := private.delivered_shop_order_for(p_product_id);
  if v_so is null then
    raise exception 'Bạn chỉ đánh giá được sản phẩm đã mua và đã nhận hàng.' using errcode = '42501';
  end if;
  -- Giới hạn chống spam: tối đa 20 lần gửi đánh giá mỗi giờ
  if (select count(*) from public.product_reviews where user_id = v_uid and updated_at > now() - interval '1 hour') >= 20 then
    raise exception 'Bạn gửi đánh giá quá nhanh, hãy thử lại sau.' using errcode = '54000';
  end if;

  select private.mask_name(full_name) into v_name from public.profiles where id = v_uid;

  insert into public.product_reviews (product_id, user_id, shop_order_id, rating, comment, reviewer_name)
  values (p_product_id, v_uid, v_so, p_rating, v_comment, v_name)
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, comment = excluded.comment, reviewer_name = excluded.reviewer_name,
        shop_order_id = excluded.shop_order_id, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_my_review(p_review_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  delete from public.product_reviews where id = p_review_id and user_id = auth.uid();
  if not found then
    raise exception 'Không tìm thấy đánh giá của bạn.' using errcode = 'P0002';
  end if;
end;
$$;

-- Người bán trả lời (hoặc xóa trả lời khi để trống) đánh giá sản phẩm của shop mình
create or replace function public.seller_reply_review(p_review_id uuid, p_reply text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_product uuid;
  v_reply   text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  select product_id into v_product from public.product_reviews where id = p_review_id;
  if v_product is null or not public.can_manage_shop(public.product_shop(v_product)) then
    raise exception 'Bạn không có quyền trả lời đánh giá này.' using errcode = '42501';
  end if;
  if char_length(v_reply) > 1000 then
    raise exception 'Trả lời tối đa 1.000 ký tự.' using errcode = '22023';
  end if;
  update public.product_reviews
     set seller_reply = v_reply, seller_replied_at = case when v_reply is null then null else now() end
   where id = p_review_id;
end;
$$;

-- Người bán xem đánh giá sản phẩm của shop mình (kể cả đánh giá bị Admin ẩn, kèm lý do)
create or replace function public.seller_list_reviews(p_unreplied_only boolean default false, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid, product_id uuid, product_name text, product_slug text, rating smallint, comment text, reviewer_name text,
  seller_reply text, seller_replied_at timestamptz, hidden boolean, hidden_reason text, created_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.product_id, p.name, p.slug, r.rating, r.comment, r.reviewer_name, r.seller_reply, r.seller_replied_at,
         r.hidden, r.hidden_reason, r.created_at, count(*) over ()
    from public.product_reviews r
    join public.products p on p.id = r.product_id
    join public.shops s on s.id = p.shop_id
   where s.owner_id = auth.uid()
     and (not coalesce(p_unreplied_only, false) or r.seller_reply is null)
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Admin: danh sách đánh giá để kiểm duyệt
create or replace function public.admin_list_reviews(
  p_hidden boolean default null, p_max_rating integer default null, p_query text default null,
  p_limit integer default 20, p_offset integer default 0
)
returns table (
  id uuid, product_id uuid, product_name text, product_slug text, shop_name text, rating smallint, comment text,
  reviewer_name text, reviewer_email text, seller_reply text, hidden boolean, hidden_reason text, created_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền quản lý đánh giá.' using errcode = '42501';
  end if;
  return query
  select r.id, r.product_id, p.name, p.slug, s.name, r.rating, r.comment, r.reviewer_name, u.email,
         r.seller_reply, r.hidden, r.hidden_reason, r.created_at, count(*) over ()
    from public.product_reviews r
    join public.products p on p.id = r.product_id
    join public.shops s on s.id = p.shop_id
    left join public.profiles u on u.id = r.user_id
   where (p_hidden is null or r.hidden = p_hidden)
     and (p_max_rating is null or r.rating <= p_max_rating)
     and (coalesce(btrim(p_query), '') = ''
          or private.vn_unaccent(p.name || ' ' || r.comment || ' ' || coalesce(u.email, '')) like '%' || private.vn_unaccent(btrim(p_query)) || '%')
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền quản lý đánh giá.' using errcode = '42501';
  end if;
  if p_hidden and v_reason is null then
    raise exception 'Hãy nhập lý do ẩn đánh giá.' using errcode = '22023';
  end if;
  update public.product_reviews
     set hidden = p_hidden, hidden_reason = case when p_hidden then v_reason else null end
   where id = p_review_id;
  if not found then
    raise exception 'Không tìm thấy đánh giá.' using errcode = 'P0002';
  end if;
  perform private.log_action(case when p_hidden then 'review.hide' else 'review.unhide' end, 'review', p_review_id::text,
    jsonb_build_object('reason', v_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. THEO DÕI SHOP, YÊU THÍCH SẢN PHẨM
-- -----------------------------------------------------------------------------
-- Trả về trạng thái mới: true = đang theo dõi
create or replace function public.toggle_follow_shop(p_shop_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để theo dõi cửa hàng.' using errcode = '42501';
  end if;
  delete from public.shop_follows where user_id = v_uid and shop_id = p_shop_id;
  if found then return false; end if;
  if not public.is_shop_public(p_shop_id) then
    raise exception 'Không tìm thấy cửa hàng.' using errcode = 'P0002';
  end if;
  if public.owns_shop(p_shop_id) then
    raise exception 'Bạn không thể tự theo dõi cửa hàng của mình.' using errcode = '22023';
  end if;
  if (select count(*) from public.shop_follows where user_id = v_uid) >= 200 then
    raise exception 'Bạn chỉ theo dõi tối đa 200 cửa hàng.' using errcode = '23514';
  end if;
  insert into public.shop_follows (user_id, shop_id) values (v_uid, p_shop_id);
  return true;
end;
$$;

-- Trả về trạng thái mới: true = đã thêm vào yêu thích
create or replace function public.toggle_favorite(p_product_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để lưu sản phẩm yêu thích.' using errcode = '42501';
  end if;
  delete from public.product_favorites where user_id = v_uid and product_id = p_product_id;
  if found then return false; end if;
  if not public.is_product_public(p_product_id) then
    raise exception 'Không tìm thấy sản phẩm.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.product_favorites where user_id = v_uid) >= 200 then
    raise exception 'Danh sách yêu thích tối đa 200 sản phẩm.' using errcode = '23514';
  end if;
  insert into public.product_favorites (user_id, product_id) values (v_uid, p_product_id);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.refresh_review_stats(uuid), private.product_reviews_after_change(),
  private.shop_follows_after_change(), private.touch_updated_at_unless_stats(), private.recompute_all_stats(),
  private.mask_name(text), private.delivered_shop_order_for(uuid) from public, anon, authenticated;

revoke execute on function public.get_product_reviews(uuid, integer, integer) from public;
grant execute on function public.get_product_reviews(uuid, integer, integer) to anon, authenticated;

revoke execute on function public.submit_review(uuid, integer, text), public.delete_my_review(uuid),
  public.seller_reply_review(uuid, text), public.seller_list_reviews(boolean, integer, integer),
  public.admin_list_reviews(boolean, integer, text, integer, integer), public.admin_set_review_hidden(uuid, boolean, text),
  public.toggle_follow_shop(uuid), public.toggle_favorite(uuid) from public, anon;
grant execute on function public.submit_review(uuid, integer, text), public.delete_my_review(uuid),
  public.seller_reply_review(uuid, text), public.seller_list_reviews(boolean, integer, integer),
  public.admin_list_reviews(boolean, integer, text, integer, integer), public.admin_set_review_hidden(uuid, boolean, text),
  public.toggle_follow_shop(uuid), public.toggle_favorite(uuid) to authenticated;
