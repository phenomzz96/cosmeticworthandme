-- =============================================================================
-- Migration 013 — Mega Sale (đợt sale lớn theo dịp lễ / ngày đặc biệt)
--
-- Admin tạo đợt Mega Sale (tên, khẩu hiệu, thời gian, mức giảm tối thiểu).
-- Người bán đăng ký sản phẩm với giá sale; Admin duyệt hoặc từ chối.
-- Trong thời gian sale, MÁY CHỦ tự đặt giá sale vào products.sale_price (mọi chỗ tính tiền — giỏ hàng,
-- voucher, đặt hàng — vốn đã dùng coalesce(sale_price, price)); hết giờ tự trả về giá cũ.
--   • Đồng bộ chạy khi đặt hàng (trước khi tính tiền), khi mở trang đơn hàng / Mega Sale, khi Admin duyệt/bật/tắt.
--   • Trong lúc sản phẩm đang chạy sale, người bán không đổi được giá (tránh lệch giá).
-- Trình duyệt không gửi giá: giá do database lấy từ đăng ký đã được Admin duyệt.
-- Chạy SAU migration 012.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BẢNG
-- -----------------------------------------------------------------------------
create table public.mega_sales (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null check (char_length(btrim(title)) between 3 and 80),
  tagline              text not null default '' check (char_length(tagline) <= 160),
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  min_discount_percent integer not null default 10 check (min_discount_percent between 1 and 90),
  is_active            boolean not null default false,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '31 days')
);

create table public.mega_sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.mega_sales (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  shop_id         uuid not null references public.shops (id) on delete cascade,
  sale_price      integer not null check (sale_price >= 1000),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason   text not null default '' check (char_length(reject_reason) <= 300),
  -- Giá sale riêng của người bán trước khi Mega Sale áp dụng (để trả lại khi hết sale)
  prev_sale_price integer,
  applied         boolean not null default false,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  unique (sale_id, product_id)
);
create index mega_sale_items_sale_idx on public.mega_sale_items (sale_id, status);
create index mega_sale_items_applied_idx on public.mega_sale_items (product_id) where applied;

create trigger mega_sales_touch_updated_at before update on public.mega_sales
  for each row execute function private.touch_updated_at();

alter table public.mega_sales enable row level security;
alter table public.mega_sale_items enable row level security;
revoke all on public.mega_sales, public.mega_sale_items from anon, authenticated;
grant select on public.mega_sales to anon, authenticated;
grant select (id, sale_id, product_id, shop_id, sale_price, status, reject_reason, applied, created_at, decided_at) on public.mega_sale_items to anon, authenticated;

create policy mega_sales_select on public.mega_sales for select to anon, authenticated
  using ((is_active and now() < ends_at) or public.is_admin());
-- Sản phẩm đã duyệt của đợt đang mở: ai cũng thấy. Người bán thấy đăng ký của shop mình. Admin thấy tất cả.
create policy mega_sale_items_select on public.mega_sale_items for select to anon, authenticated
  using ((status = 'approved' and exists (select 1 from public.mega_sales s where s.id = sale_id and s.is_active and now() < s.ends_at))
         or public.owns_shop(shop_id) or public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. ĐỒNG BỘ GIÁ SALE
-- -----------------------------------------------------------------------------
create or replace function private.sync_mega_sales()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  perform set_config('wm.mega_sync', 'on', true);

  -- Hết sale (hết giờ, Admin tắt, đăng ký không còn được duyệt): trả giá cũ
  for r in
    select i.id, i.product_id, i.prev_sale_price from public.mega_sale_items i
      join public.mega_sales s on s.id = i.sale_id
     where i.applied and (not s.is_active or now() < s.starts_at or now() >= s.ends_at or i.status <> 'approved')
     for update of i skip locked
  loop
    update public.products p
       set sale_price = case when r.prev_sale_price is not null and r.prev_sale_price < p.price then r.prev_sale_price end
     where p.id = r.product_id;
    update public.mega_sale_items set applied = false, prev_sale_price = null where id = r.id;
    n := n + 1;
  end loop;

  -- Đang trong giờ sale: áp giá sale (chỉ khi giá sale vẫn thấp hơn giá gốc hiện tại)
  for r in
    select i.id, i.product_id, i.sale_price from public.mega_sale_items i
      join public.mega_sales s on s.id = i.sale_id
     where not i.applied and i.status = 'approved' and s.is_active and now() >= s.starts_at and now() < s.ends_at
       and not exists (select 1 from public.mega_sale_items o where o.product_id = i.product_id and o.applied)
     for update of i skip locked
  loop
    update public.mega_sale_items i
       set applied = true, prev_sale_price = (select p.sale_price from public.products p where p.id = r.product_id)
     where i.id = r.id and r.sale_price < (select p.price from public.products p where p.id = r.product_id);
    if found then
      update public.products set sale_price = r.sale_price where id = r.product_id;
      n := n + 1;
    end if;
  end loop;

  perform set_config('wm.mega_sync', 'off', true);
  return n;
end;
$$;

-- Ai cũng gọi được (không nhận tham số, không trả dữ liệu nhạy cảm): website gọi khi mở trang Mega Sale
create or replace function public.sync_mega_sales()
returns integer
language sql security definer set search_path = ''
as $$ select private.sync_mega_sales() $$;

-- Đặt hàng / mở trang đơn hàng: đồng bộ giá sale trước (place_order gọi hàm này TRƯỚC khi tính tiền)
create or replace function private.expire_unpaid_qr_orders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_so public.shop_orders;
  n    integer := 0;
begin
  perform private.sync_mega_sales();

  for v_so in
    select so.* from public.shop_orders so
      join public.orders o on o.id = so.order_id
     where o.payment_method = 'qr_demo' and o.payment_status = 'unpaid' and so.status = 'pending'
       and o.created_at < now() - interval '24 hours'
     order by so.id
     limit 200
     for update of so skip locked
  loop
    perform private.apply_shop_order_status(v_so, 'cancelled', 'system', 'Quá 24 giờ chưa thanh toán chuyển khoản, hệ thống tự hủy.');
    update public.order_events set actor_id = null where shop_order_id = v_so.id and actor_role = 'system';
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Đang chạy Mega Sale: không đổi giá / giá sale bằng tay (kể cả Admin) — đổi sau khi đợt sale kết thúc
create or replace function private.guard_mega_sale_price()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('wm.mega_sync', true), 'off') <> 'on'
     and (new.price is distinct from old.price or new.sale_price is distinct from old.sale_price)
     and exists (select 1 from public.mega_sale_items i where i.product_id = old.id and i.applied) then
    raise exception 'Sản phẩm đang chạy Mega Sale nên chưa đổi được giá. Hãy đổi sau khi đợt sale kết thúc.' using errcode = '55006';
  end if;
  return new;
end;
$$;
create trigger products_guard_mega_sale before update of price, sale_price on public.products
  for each row execute function private.guard_mega_sale_price();

-- -----------------------------------------------------------------------------
-- 3. NGƯỜI BÁN ĐĂNG KÝ SẢN PHẨM
-- -----------------------------------------------------------------------------
create or replace function public.seller_enroll_mega_sale(p_sale uuid, p_product uuid, p_sale_price integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_s    public.mega_sales;
  v_p    public.products;
  v_item public.mega_sale_items;
  v_max  integer;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để đăng ký Mega Sale.' using errcode = '42501';
  end if;
  select * into v_p from public.products p where p.id = p_product;
  if v_p.id is null or not public.owns_shop(v_p.shop_id) then
    raise exception 'Bạn chỉ đăng ký được sản phẩm của cửa hàng mình.' using errcode = '42501';
  end if;
  if v_p.status <> 'active' or v_p.admin_hidden or not public.is_shop_public(v_p.shop_id) then
    raise exception 'Chỉ sản phẩm đang bán mới đăng ký được Mega Sale.' using errcode = '22023';
  end if;
  select * into v_s from public.mega_sales s where s.id = p_sale;
  if v_s.id is null or not v_s.is_active or now() >= v_s.ends_at then
    raise exception 'Đợt Mega Sale không tồn tại hoặc đã kết thúc.' using errcode = 'P0002';
  end if;
  v_max := floor(v_p.price * (100 - v_s.min_discount_percent) / 100.0)::integer;
  if p_sale_price is null or p_sale_price < 1000 or p_sale_price > v_max then
    raise exception 'Giá sale phải từ 1.000đ đến % (giảm ít nhất % so với giá gốc).',
      replace(to_char(v_max, 'FM999,999,999'), ',', '.') || 'đ', v_s.min_discount_percent || '%' using errcode = '22023';
  end if;
  select * into v_item from public.mega_sale_items i where i.sale_id = p_sale and i.product_id = p_product for update;
  if v_item.applied then
    raise exception 'Sản phẩm đang chạy sale, không đổi giá được nữa.' using errcode = '55006';
  end if;
  insert into public.mega_sale_items (sale_id, product_id, shop_id, sale_price)
  values (p_sale, p_product, v_p.shop_id, p_sale_price)
  on conflict (sale_id, product_id) do update set sale_price = excluded.sale_price, status = 'pending', reject_reason = '', decided_at = null
  returning id into v_item.id;
  return v_item.id;
end;
$$;

create or replace function public.seller_withdraw_mega_sale(p_item uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.mega_sale_items;
begin
  select * into v_item from public.mega_sale_items i where i.id = p_item for update;
  if v_item.id is null or not public.owns_shop(v_item.shop_id) then
    raise exception 'Không tìm thấy đăng ký.' using errcode = 'P0002';
  end if;
  if v_item.applied then
    raise exception 'Sản phẩm đang chạy sale, không rút được. Liên hệ Admin nếu cần.' using errcode = '55006';
  end if;
  delete from public.mega_sale_items where id = p_item;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. QUẢN TRỊ (chỉ Admin, ghi nhật ký)
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_mega_sale(
  p_id uuid, p_title text, p_tagline text, p_starts_at timestamptz, p_ends_at timestamptz, p_min_discount_percent integer, p_is_active boolean
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý Mega Sale.' using errcode = '42501';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Thời gian kết thúc phải sau thời gian bắt đầu.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.mega_sales (title, tagline, starts_at, ends_at, min_discount_percent, is_active, created_by)
    values (btrim(p_title), btrim(coalesce(p_tagline, '')), p_starts_at, p_ends_at, p_min_discount_percent, coalesce(p_is_active, false), auth.uid())
    returning id into v_id;
  else
    update public.mega_sales set title = btrim(p_title), tagline = btrim(coalesce(p_tagline, '')), starts_at = p_starts_at, ends_at = p_ends_at,
           min_discount_percent = p_min_discount_percent, is_active = coalesce(p_is_active, false)
     where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Không tìm thấy đợt Mega Sale.' using errcode = 'P0002';
    end if;
  end if;
  perform private.log_action(case when p_id is null then 'mega_sale.create' else 'mega_sale.update' end, 'mega_sale', v_id::text,
    jsonb_build_object('title', btrim(p_title), 'is_active', coalesce(p_is_active, false), 'starts_at', p_starts_at, 'ends_at', p_ends_at));
  perform private.sync_mega_sales();
  return v_id;
end;
$$;

create or replace function public.admin_delete_mega_sale(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý Mega Sale.' using errcode = '42501';
  end if;
  if exists (select 1 from public.mega_sales s where s.id = p_id and s.starts_at <= now()) then
    raise exception 'Đợt sale đã bắt đầu nên không xóa được (giữ lịch sử giá). Hãy tắt đợt sale.' using errcode = '23503';
  end if;
  delete from public.mega_sales where id = p_id;
  if not found then
    raise exception 'Không tìm thấy đợt Mega Sale.' using errcode = 'P0002';
  end if;
  perform private.log_action('mega_sale.delete', 'mega_sale', p_id::text, '{}'::jsonb);
end;
$$;

-- Duyệt / từ chối đăng ký của người bán
create or replace function public.admin_review_mega_sale_item(p_item uuid, p_approve boolean, p_reason text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.mega_sale_items;
  v_s    public.mega_sales;
  v_name text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được duyệt sản phẩm Mega Sale.' using errcode = '42501';
  end if;
  select * into v_item from public.mega_sale_items i where i.id = p_item for update;
  if v_item.id is null then
    raise exception 'Không tìm thấy đăng ký.' using errcode = 'P0002';
  end if;
  select * into v_s from public.mega_sales s where s.id = v_item.sale_id;
  if p_approve and exists (
    select 1 from public.mega_sale_items o join public.mega_sales s2 on s2.id = o.sale_id
     where o.product_id = v_item.product_id and o.id <> v_item.id and o.status = 'approved'
       and s2.starts_at < v_s.ends_at and v_s.starts_at < s2.ends_at) then
    raise exception 'Sản phẩm đã được duyệt trong một đợt sale khác trùng thời gian.' using errcode = '23P01';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Nhập lý do từ chối (ít nhất 3 ký tự) để người bán biết cần sửa gì.' using errcode = '22023';
  end if;
  update public.mega_sale_items
     set status = case when p_approve then 'approved' else 'rejected' end,
         reject_reason = case when p_approve then '' else left(btrim(p_reason), 300) end,
         decided_at = now()
   where id = p_item;

  select p.name, s.owner_id into v_name, v_owner from public.products p join public.shops s on s.id = p.shop_id where p.id = v_item.product_id;
  perform private.notify(v_owner, 'product',
    case when p_approve then '"' || v_name || '" được duyệt vào ' || v_s.title else '"' || v_name || '" chưa được duyệt vào ' || v_s.title end,
    case when p_approve then 'Giá sale sẽ tự áp dụng trong thời gian chương trình.' else btrim(p_reason) end, '/seller/mega-sale');
  perform private.log_action(case when p_approve then 'mega_sale_item.approve' else 'mega_sale_item.reject' end, 'mega_sale_item', p_item::text,
    jsonb_build_object('sale_id', v_item.sale_id, 'product_id', v_item.product_id, 'sale_price', v_item.sale_price, 'reason', btrim(coalesce(p_reason, ''))));
  perform private.sync_mega_sales();
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.sync_mega_sales(), private.guard_mega_sale_price() from public, anon, authenticated;

revoke execute on function public.sync_mega_sales() from public;
grant execute on function public.sync_mega_sales() to anon, authenticated;

revoke execute on function public.seller_enroll_mega_sale(uuid, uuid, integer), public.seller_withdraw_mega_sale(uuid),
  public.admin_save_mega_sale(uuid, text, text, timestamptz, timestamptz, integer, boolean), public.admin_delete_mega_sale(uuid),
  public.admin_review_mega_sale_item(uuid, boolean, text)
  from public, anon;
grant execute on function public.seller_enroll_mega_sale(uuid, uuid, integer), public.seller_withdraw_mega_sale(uuid),
  public.admin_save_mega_sale(uuid, text, text, timestamptz, timestamptz, integer, boolean), public.admin_delete_mega_sale(uuid),
  public.admin_review_mega_sale_item(uuid, boolean, text)
  to authenticated;
