-- =============================================================================
-- Worth & Me — Migration 005: Đơn hàng, thanh toán COD / QR mô phỏng, quản trị đơn và sản phẩm
-- (Giai đoạn 4 + 5)
--
-- Chạy SAU migration 001..004. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc nghiệp vụ:
--   * Một lần đặt hàng = 1 đơn cha (orders) + mỗi cửa hàng 1 đơn con (shop_orders).
--   * Giá, phí vận chuyển, tổng tiền, tồn kho do database tính trong hàm place_order.
--     Trình duyệt chỉ gửi id sản phẩm + số lượng + id địa chỉ + phương thức thanh toán.
--   * Phí vận chuyển: cố định mỗi đơn con, lấy từ site_settings.shipping_fee lúc đặt.
--   * Trạng thái đơn con: pending (chờ xác nhận) → confirmed → preparing → shipping → delivered,
--     hoặc cancelled. Khách hủy khi còn "chờ xác nhận". Người bán từ chối/hủy (kèm lý do) trước khi giao.
--     Hủy đơn → hoàn lại tồn kho. Giao thành công → cộng lượt bán.
--   * Thanh toán:
--       - cod: thu tiền khi giao. Đơn cha chuyển "đã thanh toán" khi mọi đơn con còn lại đã giao.
--       - qr_demo: MÔ PHỎNG chuyển khoản (không có giao dịch thật). Khách bấm "đã chuyển khoản" →
--         chờ xác nhận; Admin xác nhận hoặc từ chối. Người bán chỉ giao hàng khi đơn đã được xác nhận thanh toán.
--         Đơn con bị hủy sau khi đã thanh toán → đánh dấu "chờ hoàn tiền", Admin đánh dấu đã hoàn (mô phỏng).
--   * Ai xem được gì:
--       - Khách: đơn của mình (gồm địa chỉ giao hàng đã nhập).
--       - Người bán: đơn con của shop mình + thông tin giao hàng của đơn đó (qua hàm seller_list_shop_orders).
--         Không xem được đơn con của shop khác hay tổng tiền của cả đơn cha.
--       - Admin: tất cả.
--     Trình duyệt không ghi trực tiếp vào bảng đơn hàng; mọi thay đổi đi qua hàm có kiểm tra quyền.
--   * Admin ẩn sản phẩm vi phạm (kèm lý do); người bán không tự bỏ ẩn được.
-- =============================================================================

create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled');
create type public.payment_method as enum ('cod', 'qr_demo');
create type public.payment_status as enum ('unpaid', 'pending_confirmation', 'paid');

-- -----------------------------------------------------------------------------
-- 1. ADMIN ẨN SẢN PHẨM VI PHẠM
-- -----------------------------------------------------------------------------
alter table public.products
  add column admin_hidden boolean not null default false,
  add column admin_hidden_reason text check (admin_hidden_reason is null or char_length(admin_hidden_reason) <= 500);

create or replace function public.is_product_public(p_product_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id and p.status = 'active' and not p.admin_hidden and public.is_shop_public(p.shop_id)
  );
$$;

drop policy products_select on public.products;
create policy products_select on public.products for select to anon, authenticated
  using ((status = 'active' and not admin_hidden and public.is_shop_public(shop_id)) or public.owns_shop(shop_id) or public.is_admin());

-- Tìm kiếm: bỏ sản phẩm bị Admin ẩn (giữ nguyên tham số so với migration 004)
create or replace function public.search_products(
  p_query      text    default null,
  p_category   text    default null,
  p_types      text[]  default null,
  p_shop_id    uuid    default null,
  p_min_price  integer default null,
  p_max_price  integer default null,
  p_skin_type  text    default null,
  p_sort       text    default 'popular',
  p_limit      integer default 24,
  p_offset     integer default 0
)
returns table (
  id uuid, slug text, shop_id uuid, category text, product_type text, name text, brand_name text,
  description text, price integer, sale_price integer, stock integer, size text,
  skin_types text[], concerns text[], key_ingredients text[], texture text, fragrance_free boolean,
  placeholder_visual jsonb, rating numeric, review_count integer, sold_count integer, featured boolean,
  created_at timestamptz, product_images jsonb, total_count bigint
)
language sql stable security definer set search_path = ''
as $$
  with terms as (
    select array_remove(string_to_array(btrim(private.vn_unaccent(left(p_query, 100))), ' '), '') as t
  ),
  hits as (
    select p.*, coalesce(p.sale_price, p.price) as effective_price
    from public.products p, terms
    where p.status = 'active'
      and not p.admin_hidden
      and public.is_shop_public(p.shop_id)
      and (p_category is null or p.category = p_category)
      and (p_types is null or cardinality(p_types) = 0 or p.product_type = any (p_types))
      and (p_shop_id is null or p.shop_id = p_shop_id)
      and (p_min_price is null or coalesce(p.sale_price, p.price) >= p_min_price)
      and (p_max_price is null or coalesce(p.sale_price, p.price) <= p_max_price)
      and (p_skin_type is null or cardinality(p.skin_types) = 0 or p_skin_type = any (p.skin_types))
      and (terms.t is null or not exists (select 1 from unnest(terms.t) w where strpos(' ' || p.search_text, ' ' || w) = 0))
  )
  select h.id, h.slug, h.shop_id, h.category, h.product_type, h.name, h.brand_name,
         h.description, h.price, h.sale_price, h.stock, h.size,
         h.skin_types, h.concerns, h.key_ingredients, h.texture, h.fragrance_free,
         h.placeholder_visual, h.rating, h.review_count, h.sold_count, h.featured,
         h.created_at,
         coalesce((select jsonb_agg(jsonb_build_object('path', i.path, 'sort_order', i.sort_order) order by i.sort_order)
                   from public.product_images i where i.product_id = h.id), '[]'::jsonb),
         count(*) over ()
  from hits h
  order by
    case when p_sort = 'price-asc' then h.effective_price end asc,
    case when p_sort = 'price-desc' then h.effective_price end desc,
    case when p_sort = 'newest' then h.created_at end desc,
    case when p_sort = 'rating' then h.rating end desc,
    case when p_sort = 'rating' then h.review_count end desc,
    h.sold_count desc,
    h.id
  limit greatest(1, least(coalesce(p_limit, 24), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- Giỏ hàng: không thêm sản phẩm bị Admin ẩn
create or replace function public.cart_set_item(p_product_id uuid, p_quantity integer)
returns integer
language plpgsql set search_path = ''
as $$
declare
  v_stock integer;
  v_qty   integer;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    delete from public.cart_items where user_id = auth.uid() and product_id = p_product_id;
    return 0;
  end if;
  select p.stock into v_stock from public.products p
   where p.id = p_product_id and public.is_product_public(p.id);
  if v_stock is null then
    raise exception 'Sản phẩm không còn được bán.' using errcode = 'P0002';
  end if;
  v_qty := least(p_quantity, 10, v_stock);
  if v_qty <= 0 then
    delete from public.cart_items where user_id = auth.uid() and product_id = p_product_id;
    return 0;
  end if;
  insert into public.cart_items (product_id, quantity) values (p_product_id, v_qty)
  on conflict (user_id, product_id) do update set quantity = excluded.quantity;
  return v_qty;
end;
$$;

create or replace function public.admin_set_product_hidden(p_product_id uuid, p_hidden boolean, p_reason text default null)
returns public.products
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_row    public.products;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền ẩn sản phẩm.' using errcode = '42501';
  end if;
  if p_hidden and (v_reason is null or char_length(v_reason) < 5) then
    raise exception 'Hãy nhập lý do ẩn sản phẩm (ít nhất 5 ký tự).' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Lý do tối đa 500 ký tự.' using errcode = '22023';
  end if;
  update public.products
     set admin_hidden = p_hidden, admin_hidden_reason = case when p_hidden then v_reason end
   where id = p_product_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Không tìm thấy sản phẩm.' using errcode = 'P0002';
  end if;
  perform private.log_action(case when p_hidden then 'product.hide' else 'product.unhide' end, 'product', p_product_id::text,
    jsonb_build_object('name', v_row.name, 'reason', v_reason));
  return v_row;
end;
$$;

create or replace function public.admin_list_products(
  p_search text default null,
  p_hidden boolean default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, brand_name text, status public.product_status, price integer, sale_price integer,
  stock integer, admin_hidden boolean, admin_hidden_reason text, shop_id uuid, shop_name text, shop_slug text,
  shop_status public.shop_status, image_path text, created_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pattern text;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xem danh sách sản phẩm quản trị.' using errcode = '42501';
  end if;
  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || private.vn_unaccent(replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_')) || '%';
  end if;
  return query
  select p.id, p.slug, p.name, p.brand_name, p.status, p.price, p.sale_price, p.stock, p.admin_hidden, p.admin_hidden_reason,
         s.id, s.name, s.slug, s.status,
         (select i.path from public.product_images i where i.product_id = p.id order by i.sort_order limit 1),
         p.created_at, count(*) over ()
  from public.products p
  join public.shops s on s.id = p.shop_id
  where p.status <> 'draft'
    and (p_hidden is null or p.admin_hidden = p_hidden)
    and (v_pattern is null or p.search_text like v_pattern or private.vn_unaccent(s.name) like v_pattern)
  order by p.admin_hidden desc, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. BẢNG ĐƠN HÀNG
-- -----------------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  customer_id          uuid references public.profiles (id) on delete set null,
  -- Thông tin giao hàng chụp lại lúc đặt (sửa sổ địa chỉ sau này không đổi đơn cũ)
  recipient_name       text not null,
  phone                text not null,
  province             text not null,
  district             text not null,
  ward                 text not null default '',
  street               text not null,
  note                 text not null default '' check (char_length(note) <= 500),
  payment_method       public.payment_method not null,
  payment_status       public.payment_status not null default 'unpaid',
  payment_reported_at  timestamptz,
  payment_confirmed_at timestamptz,
  payment_note         text,
  items_subtotal       integer not null check (items_subtotal >= 0),
  shipping_total       integer not null check (shipping_total >= 0),
  grand_total          integer not null check (grand_total = items_subtotal + shipping_total),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_payment_idx on public.orders (payment_status) where payment_status = 'pending_confirmation';

create table public.shop_orders (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  shop_id        uuid not null references public.shops (id) on delete restrict,
  shop_name      text not null,
  status         public.order_status not null default 'pending',
  items_subtotal integer not null check (items_subtotal >= 0),
  shipping_fee   integer not null check (shipping_fee >= 0),
  total          integer not null check (total = items_subtotal + shipping_fee),
  cancel_reason  text,
  cancelled_by   text check (cancelled_by in ('customer', 'seller', 'admin')),
  refund_status  text check (refund_status in ('pending', 'done')),
  confirmed_at   timestamptz,
  shipped_at     timestamptz,
  delivered_at   timestamptz,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (order_id, shop_id)
);

create index shop_orders_shop_idx on public.shop_orders (shop_id, created_at desc);
create index shop_orders_status_idx on public.shop_orders (status);

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  shop_order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  product_slug  text not null,
  brand_name    text not null,
  image_path    text,
  unit_price    integer not null check (unit_price >= 0),
  quantity      integer not null check (quantity between 1 and 10),
  line_total    integer not null check (line_total = unit_price * quantity)
);

create index order_items_shop_order_idx on public.order_items (shop_order_id);
create index order_items_product_idx on public.order_items (product_id);

-- Lịch sử: đổi trạng thái đơn con, thanh toán, hoàn tiền
create table public.order_events (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id) on delete cascade,
  shop_order_id uuid references public.shop_orders (id) on delete cascade,
  kind          text not null check (kind in ('status', 'payment', 'refund')),
  from_value    text,
  to_value      text not null,
  note          text,
  actor_id      uuid references public.profiles (id) on delete set null,
  actor_role    text not null check (actor_role in ('customer', 'seller', 'admin', 'system')),
  created_at    timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create trigger orders_touch_updated_at before update on public.orders
  for each row execute function private.touch_updated_at();
create trigger shop_orders_touch_updated_at before update on public.shop_orders
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. QUYỀN XEM (chỉ đọc; không cấp insert/update/delete cho trình duyệt)
-- -----------------------------------------------------------------------------
create or replace function public.is_order_customer(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.orders o where o.id = p_order_id and o.customer_id = auth.uid()) $$;

create or replace function public.can_view_shop_order(p_shop_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.shop_orders so
    join public.orders o on o.id = so.order_id
    left join public.shops s on s.id = so.shop_id
    where so.id = p_shop_order_id and (o.customer_id = auth.uid() or s.owner_id = auth.uid())
  );
$$;

revoke all on public.orders, public.shop_orders, public.order_items, public.order_events from anon, authenticated;
alter table public.orders enable row level security;
alter table public.shop_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

grant select on public.orders, public.shop_orders, public.order_items, public.order_events to authenticated;

create policy orders_select on public.orders for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());
create policy shop_orders_select on public.shop_orders for select to authenticated
  using (public.is_order_customer(order_id) or public.owns_shop(shop_id) or public.is_admin());
create policy order_items_select on public.order_items for select to authenticated
  using (public.can_view_shop_order(shop_order_id));
create policy order_events_select on public.order_events for select to authenticated
  using ((shop_order_id is not null and public.can_view_shop_order(shop_order_id)) or public.is_order_customer(order_id) or public.is_admin());

grant execute on function public.is_order_customer(uuid), public.can_view_shop_order(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. ĐẶT HÀNG
-- -----------------------------------------------------------------------------
-- p_items: [{"product_id": "...", "quantity": 2}, ...] — chỉ id và số lượng; giá lấy từ database.
create or replace function public.place_order(
  p_items          jsonb,
  p_address_id     uuid,
  p_payment_method public.payment_method default 'cod',
  p_note           text default ''
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_addr      public.addresses;
  v_fee       integer;
  v_order_id  uuid;
  v_code      text;
  v_item      record;
  v_shop      record;
  v_so_id     uuid;
  v_subtotal  integer := 0;
  v_shipping  integer := 0;
  v_ids       uuid[];
  v_qtys      integer[];
  v_note      text := btrim(coalesce(p_note, ''));
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Tài khoản chưa đăng nhập hoặc đang bị khóa nên không đặt hàng được.' using errcode = '42501';
  end if;

  -- Chống gửi đơn liên tục
  if (select count(*) from public.orders o where o.customer_id = v_uid and o.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Bạn đặt quá nhiều đơn trong thời gian ngắn. Vui lòng thử lại sau ít phút.' using errcode = '54000';
  end if;

  if char_length(v_note) > 500 then
    raise exception 'Ghi chú tối đa 500 ký tự.' using errcode = '22023';
  end if;

  select * into v_addr from public.addresses a where a.id = p_address_id and a.user_id = v_uid;
  if v_addr.id is null then
    raise exception 'Không tìm thấy địa chỉ giao hàng. Hãy chọn hoặc thêm địa chỉ.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng trống.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Mỗi đơn tối đa 50 sản phẩm khác nhau.' using errcode = '22023';
  end if;

  -- Gộp dòng trùng sản phẩm, kiểm tra số lượng
  begin
    select array_agg(t.pid order by t.pid), array_agg(t.qty order by t.pid) into v_ids, v_qtys
    from (
      select (e ->> 'product_id')::uuid as pid, sum((e ->> 'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_items) e
      group by 1
    ) t;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Dữ liệu giỏ hàng không hợp lệ.' using errcode = '22023';
  end;
  if exists (select 1 from unnest(v_ids, v_qtys) as i(pid, qty) where pid is null or qty is null or qty < 1 or qty > 10) then
    raise exception 'Số lượng mỗi sản phẩm từ 1 đến 10.' using errcode = '22023';
  end if;

  -- Khóa các dòng sản phẩm (theo thứ tự id để tránh deadlock) rồi kiểm tra còn bán, đủ hàng
  perform 1 from public.products p where p.id = any (v_ids) order by p.id for update;

  for v_item in
    select i.pid as product_id, i.qty as quantity, p.name, p.stock, p.shop_id, p.status, p.admin_hidden, s.owner_id,
           public.is_shop_public(p.shop_id) as shop_public
    from unnest(v_ids, v_qtys) as i(pid, qty)
    left join public.products p on p.id = i.pid
    left join public.shops s on s.id = p.shop_id
  loop
    if v_item.name is null or v_item.status <> 'active' or v_item.admin_hidden or not v_item.shop_public then
      raise exception 'Có sản phẩm trong giỏ không còn được bán%. Hãy cập nhật giỏ hàng.',
        coalesce(' ("' || v_item.name || '")', '') using errcode = 'P0002';
    end if;
    if v_item.owner_id = v_uid then
      raise exception 'Bạn không thể mua sản phẩm của chính cửa hàng mình ("%").', v_item.name using errcode = '42501';
    end if;
    if v_item.stock < v_item.quantity then
      raise exception 'Sản phẩm "%" chỉ còn % trong kho.', v_item.name, v_item.stock using errcode = '23514';
    end if;
  end loop;

  select s.shipping_fee into v_fee from public.site_settings s where s.id = 1;
  v_fee := coalesce(v_fee, 0);

  -- Mã đơn dễ đọc: WM + ngày + 6 ký tự ngẫu nhiên
  loop
    v_code := 'WM' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
              upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.orders o where o.code = v_code);
  end loop;

  insert into public.orders (code, customer_id, recipient_name, phone, province, district, ward, street, note,
                             payment_method, items_subtotal, shipping_total, grand_total)
  values (v_code, v_uid, v_addr.recipient_name, v_addr.phone, v_addr.province, v_addr.district, v_addr.ward, v_addr.street,
          v_note, p_payment_method, 0, 0, 0)
  returning id into v_order_id;

  for v_shop in
    select p.shop_id, s.name as shop_name, sum(coalesce(p.sale_price, p.price) * i.quantity)::integer as subtotal
    from unnest(v_ids, v_qtys) as i(product_id, quantity)
    join public.products p on p.id = i.product_id
    join public.shops s on s.id = p.shop_id
    group by p.shop_id, s.name
    order by s.name
  loop
    insert into public.shop_orders (order_id, shop_id, shop_name, items_subtotal, shipping_fee, total)
    values (v_order_id, v_shop.shop_id, v_shop.shop_name, v_shop.subtotal, v_fee, v_shop.subtotal + v_fee)
    returning id into v_so_id;

    insert into public.order_items (shop_order_id, product_id, product_name, product_slug, brand_name, image_path, unit_price, quantity, line_total)
    select v_so_id, p.id, p.name, p.slug, p.brand_name,
           (select pi.path from public.product_images pi where pi.product_id = p.id order by pi.sort_order limit 1),
           coalesce(p.sale_price, p.price), i.quantity, coalesce(p.sale_price, p.price) * i.quantity
    from unnest(v_ids, v_qtys) as i(product_id, quantity)
    join public.products p on p.id = i.product_id
    where p.shop_id = v_shop.shop_id;

    insert into public.order_events (order_id, shop_order_id, kind, to_value, actor_id, actor_role)
    values (v_order_id, v_so_id, 'status', 'pending', v_uid, 'customer');

    v_subtotal := v_subtotal + v_shop.subtotal;
    v_shipping := v_shipping + v_fee;
  end loop;

  update public.orders set items_subtotal = v_subtotal, shipping_total = v_shipping, grand_total = v_subtotal + v_shipping
   where id = v_order_id;

  -- Trừ tồn kho
  update public.products p set stock = p.stock - i.quantity
    from unnest(v_ids, v_qtys) as i(product_id, quantity) where p.id = i.product_id;

  -- Bỏ các sản phẩm đã đặt khỏi giỏ hàng của tài khoản
  delete from public.cart_items c where c.user_id = v_uid and c.product_id = any (v_ids);

  return jsonb_build_object('id', v_order_id, 'code', v_code, 'grand_total', v_subtotal + v_shipping);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. CHUYỂN TRẠNG THÁI ĐƠN CON (dùng chung cho khách, người bán, admin)
-- -----------------------------------------------------------------------------
create or replace function private.apply_shop_order_status(
  p_so        public.shop_orders,
  p_to        public.order_status,
  p_role      text,
  p_reason    text
)
returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_row   public.shop_orders;
begin
  select * into v_order from public.orders where id = p_so.order_id for update;

  update public.shop_orders set
    status        = p_to,
    confirmed_at  = case when p_to = 'confirmed' then now() else confirmed_at end,
    shipped_at    = case when p_to = 'shipping' then now() else shipped_at end,
    delivered_at  = case when p_to = 'delivered' then now() else delivered_at end,
    cancelled_at  = case when p_to = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_to = 'cancelled' then p_reason else cancel_reason end,
    cancelled_by  = case when p_to = 'cancelled' then p_role else cancelled_by end,
    refund_status = case when p_to = 'cancelled' and v_order.payment_status = 'paid' then 'pending' else refund_status end
  where id = p_so.id
  returning * into v_row;

  insert into public.order_events (order_id, shop_order_id, kind, from_value, to_value, note, actor_id, actor_role)
  values (p_so.order_id, p_so.id, 'status', p_so.status::text, p_to::text, p_reason, auth.uid(), p_role);

  if p_to = 'cancelled' then
    -- Hoàn tồn kho (sản phẩm còn tồn tại)
    update public.products p set stock = least(p.stock + oi.quantity, 100000)
      from public.order_items oi where oi.shop_order_id = p_so.id and p.id = oi.product_id;
    if v_row.refund_status = 'pending' then
      insert into public.order_events (order_id, shop_order_id, kind, to_value, actor_role)
      values (p_so.order_id, p_so.id, 'refund', 'pending', 'system');
    end if;
  elsif p_to = 'delivered' then
    update public.products p set sold_count = p.sold_count + oi.quantity
      from public.order_items oi where oi.shop_order_id = p_so.id and p.id = oi.product_id;
    -- COD: mọi đơn con còn lại đã giao → đơn cha đã thanh toán
    if v_order.payment_method = 'cod' and v_order.payment_status <> 'paid' and not exists (
      select 1 from public.shop_orders so where so.order_id = v_order.id and so.status not in ('delivered', 'cancelled')
    ) then
      update public.orders set payment_status = 'paid', payment_confirmed_at = now() where id = v_order.id;
      insert into public.order_events (order_id, kind, from_value, to_value, note, actor_role)
      values (v_order.id, 'payment', v_order.payment_status::text, 'paid', 'Đã thu tiền khi giao hàng (COD)', 'system');
    end if;
  end if;

  return v_row;
end;
$$;

-- Khách hủy đơn con khi còn "chờ xác nhận"
create or replace function public.cancel_my_shop_order(p_shop_order_id uuid, p_reason text default null)
returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_so     public.shop_orders;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not public.is_active_user() then
    raise exception 'Tài khoản chưa đăng nhập hoặc đang bị khóa.' using errcode = '42501';
  end if;
  select so.* into v_so from public.shop_orders so join public.orders o on o.id = so.order_id
   where so.id = p_shop_order_id and o.customer_id = auth.uid() for update of so;
  if v_so.id is null then
    raise exception 'Không tìm thấy đơn hàng.' using errcode = 'P0002';
  end if;
  if v_so.status <> 'pending' then
    raise exception 'Chỉ hủy được đơn đang chờ xác nhận. Đơn đã được người bán xác nhận, hãy liên hệ cửa hàng.' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Lý do tối đa 500 ký tự.' using errcode = '22023';
  end if;
  return private.apply_shop_order_status(v_so, 'cancelled', 'customer', coalesce(v_reason, 'Khách hủy đơn'));
end;
$$;

-- Người bán xử lý đơn con của shop mình
create or replace function public.seller_update_shop_order(p_shop_order_id uuid, p_status public.order_status, p_reason text default null)
returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_so      public.shop_orders;
  v_payment public.payment_status;
  v_method  public.payment_method;
  v_reason  text := nullif(btrim(p_reason), '');
begin
  if not public.is_active_user() then
    raise exception 'Tài khoản của bạn đang bị khóa.' using errcode = '42501';
  end if;
  select so.* into v_so from public.shop_orders so join public.shops s on s.id = so.shop_id
   where so.id = p_shop_order_id and s.owner_id = auth.uid() for update of so;
  if v_so.id is null then
    raise exception 'Không tìm thấy đơn hàng của cửa hàng bạn.' using errcode = 'P0002';
  end if;
  if not (
    (v_so.status = 'pending'   and p_status in ('confirmed', 'cancelled')) or
    (v_so.status = 'confirmed' and p_status in ('preparing', 'cancelled')) or
    (v_so.status = 'preparing' and p_status in ('shipping', 'cancelled')) or
    (v_so.status = 'shipping'  and p_status = 'delivered')
  ) then
    raise exception 'Không thể chuyển đơn từ "%" sang "%".', v_so.status, p_status using errcode = '22023';
  end if;
  if p_status = 'cancelled' and (v_reason is null or char_length(v_reason) < 5) then
    raise exception 'Hãy nhập lý do từ chối/hủy đơn (ít nhất 5 ký tự). Khách hàng sẽ thấy lý do này.' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Lý do tối đa 500 ký tự.' using errcode = '22023';
  end if;
  select o.payment_status, o.payment_method into v_payment, v_method from public.orders o where o.id = v_so.order_id;
  if p_status = 'shipping' and v_method = 'qr_demo' and v_payment <> 'paid' then
    raise exception 'Đơn chuyển khoản chưa được xác nhận thanh toán. Chỉ giao hàng sau khi quản trị viên xác nhận đã nhận tiền.' using errcode = '22023';
  end if;
  return private.apply_shop_order_status(v_so, p_status, 'seller', v_reason);
end;
$$;

-- Admin hủy đơn con (xử lý khiếu nại) — bắt buộc lý do, ghi nhật ký
create or replace function public.admin_cancel_shop_order(p_shop_order_id uuid, p_reason text)
returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_so     public.shop_orders;
  v_reason text := nullif(btrim(p_reason), '');
  v_row    public.shop_orders;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền hủy đơn hàng.' using errcode = '42501';
  end if;
  select * into v_so from public.shop_orders where id = p_shop_order_id for update;
  if v_so.id is null then
    raise exception 'Không tìm thấy đơn hàng.' using errcode = 'P0002';
  end if;
  if v_so.status in ('delivered', 'cancelled') then
    raise exception 'Đơn đã giao hoặc đã hủy, không hủy được nữa.' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'Hãy nhập lý do hủy (5–500 ký tự).' using errcode = '22023';
  end if;
  v_row := private.apply_shop_order_status(v_so, 'cancelled', 'admin', v_reason);
  perform private.log_action('order.cancel', 'shop_order', p_shop_order_id::text,
    jsonb_build_object('code', (select code from public.orders where id = v_so.order_id), 'shop', v_so.shop_name, 'reason', v_reason));
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. THANH TOÁN QR MÔ PHỎNG
-- -----------------------------------------------------------------------------
-- Khách báo đã chuyển khoản (mô phỏng). Không có tiền thật nào được chuyển.
create or replace function public.report_payment(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_active_user() then
    raise exception 'Tài khoản chưa đăng nhập hoặc đang bị khóa.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id and customer_id = auth.uid() for update;
  if v_order.id is null then
    raise exception 'Không tìm thấy đơn hàng.' using errcode = 'P0002';
  end if;
  if v_order.payment_method <> 'qr_demo' or v_order.payment_status <> 'unpaid' then
    raise exception 'Đơn này không chờ thanh toán chuyển khoản.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.shop_orders so where so.order_id = v_order.id and so.status <> 'cancelled') then
    raise exception 'Đơn đã hủy, không cần thanh toán.' using errcode = '22023';
  end if;
  update public.orders set payment_status = 'pending_confirmation', payment_reported_at = now(), payment_note = null
   where id = v_order.id returning * into v_order;
  insert into public.order_events (order_id, kind, from_value, to_value, actor_id, actor_role)
  values (v_order.id, 'payment', 'unpaid', 'pending_confirmation', auth.uid(), 'customer');
  return v_order;
end;
$$;

-- Admin xác nhận đã nhận tiền (hoặc từ chối: chưa thấy tiền → trở lại "chưa thanh toán")
create or replace function public.admin_confirm_payment(p_order_id uuid, p_approve boolean, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_note  text := nullif(btrim(p_note), '');
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xác nhận thanh toán.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Không tìm thấy đơn hàng.' using errcode = 'P0002';
  end if;
  if v_order.payment_method <> 'qr_demo' or v_order.payment_status <> 'pending_confirmation' then
    raise exception 'Đơn này không ở trạng thái chờ xác nhận thanh toán.' using errcode = '22023';
  end if;
  if not p_approve and (v_note is null or char_length(v_note) < 5) then
    raise exception 'Hãy nhập lý do từ chối (ít nhất 5 ký tự). Khách hàng sẽ thấy lý do này.' using errcode = '22023';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Ghi chú tối đa 500 ký tự.' using errcode = '22023';
  end if;
  update public.orders set
    payment_status       = case when p_approve then 'paid'::public.payment_status else 'unpaid'::public.payment_status end,
    payment_confirmed_at = case when p_approve then now() end,
    payment_note         = v_note
  where id = v_order.id returning * into v_order;
  insert into public.order_events (order_id, kind, from_value, to_value, note, actor_id, actor_role)
  values (v_order.id, 'payment', 'pending_confirmation', v_order.payment_status::text, v_note, auth.uid(), 'admin');
  -- Đơn con đã bị hủy trong lúc chờ xác nhận → cần hoàn tiền
  if p_approve then
    update public.shop_orders set refund_status = 'pending' where order_id = v_order.id and status = 'cancelled' and refund_status is null;
  end if;
  perform private.log_action(case when p_approve then 'payment.confirm' else 'payment.reject' end, 'order', p_order_id::text,
    jsonb_build_object('code', v_order.code, 'amount', v_order.grand_total, 'reason', v_note));
  return v_order;
end;
$$;

-- Admin đánh dấu đã hoàn tiền cho đơn con bị hủy sau khi thanh toán (mô phỏng)
create or replace function public.admin_mark_refunded(p_shop_order_id uuid)
returns public.shop_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.shop_orders;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xử lý hoàn tiền.' using errcode = '42501';
  end if;
  update public.shop_orders set refund_status = 'done'
   where id = p_shop_order_id and refund_status = 'pending'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Đơn này không chờ hoàn tiền.' using errcode = '22023';
  end if;
  insert into public.order_events (order_id, shop_order_id, kind, from_value, to_value, actor_id, actor_role)
  values (v_row.order_id, v_row.id, 'refund', 'pending', 'done', auth.uid(), 'admin');
  perform private.log_action('payment.refund', 'shop_order', p_shop_order_id::text,
    jsonb_build_object('code', (select code from public.orders where id = v_row.order_id), 'shop', v_row.shop_name, 'amount', v_row.total));
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. DANH SÁCH ĐƠN CHO NGƯỜI BÁN VÀ ADMIN, SỐ LIỆU TỔNG QUAN
-- -----------------------------------------------------------------------------
-- Người bán: đơn con của shop mình + thông tin giao hàng của đúng đơn đó
create or replace function public.seller_list_shop_orders(
  p_status public.order_status default null,
  p_search text default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, order_id uuid, code text, status public.order_status, items_subtotal integer, shipping_fee integer, total integer,
  cancel_reason text, cancelled_by text, refund_status text, created_at timestamptz, confirmed_at timestamptz,
  shipped_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
  payment_method public.payment_method, payment_status public.payment_status,
  recipient_name text, phone text, province text, district text, ward text, street text, note text,
  items jsonb, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_shop_id uuid;
  v_pattern text;
begin
  select s.id into v_shop_id from public.shops s where s.owner_id = auth.uid();
  if v_shop_id is null then
    raise exception 'Bạn chưa có cửa hàng.' using errcode = '42501';
  end if;
  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || private.vn_unaccent(replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_')) || '%';
  end if;
  return query
  select so.id, so.order_id, o.code, so.status, so.items_subtotal, so.shipping_fee, so.total,
         so.cancel_reason, so.cancelled_by, so.refund_status, so.created_at, so.confirmed_at,
         so.shipped_at, so.delivered_at, so.cancelled_at,
         o.payment_method, o.payment_status,
         o.recipient_name, o.phone, o.province, o.district, o.ward, o.street, o.note,
         coalesce((select jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'product_name', oi.product_name, 'product_slug', oi.product_slug,
                                    'image_path', oi.image_path, 'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total)
                                    order by oi.product_name)
                   from public.order_items oi where oi.shop_order_id = so.id), '[]'::jsonb),
         count(*) over ()
  from public.shop_orders so
  join public.orders o on o.id = so.order_id
  where so.shop_id = v_shop_id
    and (p_status is null or so.status = p_status)
    and (v_pattern is null or private.vn_unaccent(o.code) like v_pattern or private.vn_unaccent(o.recipient_name) like v_pattern)
  order by (so.status = 'pending') desc, so.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.admin_list_orders(
  p_status         public.order_status default null,
  p_payment_status public.payment_status default null,
  p_search         text default null,
  p_limit          integer default 20,
  p_offset         integer default 0,
  p_refund_pending boolean default false
)
returns table (
  id uuid, code text, customer_email text, recipient_name text, phone text, address text, note text,
  payment_method public.payment_method, payment_status public.payment_status, payment_reported_at timestamptz, payment_note text,
  items_subtotal integer, shipping_total integer, grand_total integer, created_at timestamptz,
  shop_orders jsonb, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pattern text;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xem danh sách đơn hàng.' using errcode = '42501';
  end if;
  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || private.vn_unaccent(replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_')) || '%';
  end if;
  return query
  select o.id, o.code, pr.email, o.recipient_name, o.phone,
         concat_ws(', ', o.street, nullif(o.ward, ''), o.district, o.province), o.note,
         o.payment_method, o.payment_status, o.payment_reported_at, o.payment_note,
         o.items_subtotal, o.shipping_total, o.grand_total, o.created_at,
         (select jsonb_agg(jsonb_build_object('id', so.id, 'shop_id', so.shop_id, 'shop_name', so.shop_name, 'status', so.status,
                                              'total', so.total, 'cancel_reason', so.cancel_reason, 'cancelled_by', so.cancelled_by,
                                              'refund_status', so.refund_status,
                                              'items', (select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity,
                                                                                            'unit_price', oi.unit_price, 'line_total', oi.line_total))
                                                        from public.order_items oi where oi.shop_order_id = so.id))
                            order by so.shop_name)
          from public.shop_orders so where so.order_id = o.id),
         count(*) over ()
  from public.orders o
  left join public.profiles pr on pr.id = o.customer_id
  where (p_payment_status is null or o.payment_status = p_payment_status)
    and (p_status is null or exists (select 1 from public.shop_orders so where so.order_id = o.id and so.status = p_status))
    and (not coalesce(p_refund_pending, false) or exists (select 1 from public.shop_orders so where so.order_id = o.id and so.refund_status = 'pending'))
    and (v_pattern is null or private.vn_unaccent(o.code) like v_pattern or private.vn_unaccent(coalesce(pr.email, '')) like v_pattern
         or private.vn_unaccent(o.recipient_name) like v_pattern)
  order by (o.payment_status = 'pending_confirmation') desc, o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.seller_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_shop_id uuid;
begin
  select s.id into v_shop_id from public.shops s where s.owner_id = auth.uid();
  if v_shop_id is null then
    raise exception 'Bạn chưa có cửa hàng.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.shop_orders where shop_id = v_shop_id group by status) t), '{}'::jsonb),
    'revenue_delivered', coalesce((select sum(items_subtotal) from public.shop_orders where shop_id = v_shop_id and status = 'delivered'), 0),
    'revenue_30d', coalesce((select sum(items_subtotal) from public.shop_orders where shop_id = v_shop_id and status = 'delivered' and delivered_at > now() - interval '30 days'), 0),
    'orders_today', (select count(*) from public.shop_orders where shop_id = v_shop_id and created_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'),
    'units_sold', coalesce((select sum(oi.quantity) from public.order_items oi join public.shop_orders so on so.id = oi.shop_order_id where so.shop_id = v_shop_id and so.status = 'delivered'), 0)
  );
end;
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xem số liệu quản trị.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_by_role', (select jsonb_object_agg(role, n) from (select role, count(*) n from public.profiles group by role) t),
    'users_suspended', (select count(*) from public.profiles where status = 'suspended'),
    'shops_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.shops group by status) t), '{}'::jsonb),
    'products_active', (select count(*) from public.products where status = 'active' and not admin_hidden),
    'products_hidden_by_admin', (select count(*) from public.products where admin_hidden),
    'orders', (select count(*) from public.orders),
    'orders_today', (select count(*) from public.orders where created_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'),
    'shop_orders_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.shop_orders group by status) t), '{}'::jsonb),
    'payments_pending', (select count(*) from public.orders where payment_status = 'pending_confirmation'),
    'refunds_pending', (select count(*) from public.shop_orders where refund_status = 'pending'),
    'gmv_delivered', coalesce((select sum(total) from public.shop_orders where status = 'delivered'), 0)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.apply_shop_order_status(public.shop_orders, public.order_status, text, text) from public, anon, authenticated;

revoke execute on function
  public.place_order(jsonb, uuid, public.payment_method, text),
  public.cancel_my_shop_order(uuid, text),
  public.seller_update_shop_order(uuid, public.order_status, text),
  public.admin_cancel_shop_order(uuid, text),
  public.report_payment(uuid),
  public.admin_confirm_payment(uuid, boolean, text),
  public.admin_mark_refunded(uuid),
  public.seller_list_shop_orders(public.order_status, text, integer, integer),
  public.admin_list_orders(public.order_status, public.payment_status, text, integer, integer, boolean),
  public.seller_dashboard_stats(),
  public.admin_dashboard_stats(),
  public.admin_set_product_hidden(uuid, boolean, text),
  public.admin_list_products(text, boolean, integer, integer)
from public, anon;

grant execute on function
  public.place_order(jsonb, uuid, public.payment_method, text),
  public.cancel_my_shop_order(uuid, text),
  public.seller_update_shop_order(uuid, public.order_status, text),
  public.admin_cancel_shop_order(uuid, text),
  public.report_payment(uuid),
  public.admin_confirm_payment(uuid, boolean, text),
  public.admin_mark_refunded(uuid),
  public.seller_list_shop_orders(public.order_status, text, integer, integer),
  public.admin_list_orders(public.order_status, public.payment_status, text, integer, integer, boolean),
  public.seller_dashboard_stats(),
  public.admin_dashboard_stats(),
  public.admin_set_product_hidden(uuid, boolean, text),
  public.admin_list_products(text, boolean, integer, integer)
to authenticated;
