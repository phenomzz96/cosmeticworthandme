-- =============================================================================
-- Worth & Me — Migration 008 (Đợt B): voucher, thông báo, báo cáo đánh giá, chống đặt trùng,
-- tự hủy đơn QR quá hạn, lọc tìm kiếm mới, trường "Cách dùng"
--
-- Chạy SAU migration 001..007. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc nghiệp vụ:
--   * Voucher: của sàn (Admin tạo, shop_id = null) hoặc của shop (chủ shop tạo). Giảm theo % (có mức giảm tối đa)
--     hoặc số tiền cố định; đơn tối thiểu; thời gian hiệu lực; tổng lượt dùng; lượt dùng mỗi người.
--     Mỗi đơn dùng tối đa 1 voucher sàn + 1 voucher cho mỗi shop. Số tiền giảm do database tính trong place_order.
--     Voucher sàn giảm trên tổng tiền hàng (sau voucher shop), chia cho các đơn con theo tỷ lệ tiền hàng.
--     Đơn con bị hủy → trả lại lượt dùng voucher shop; cả đơn bị hủy → trả lại lượt dùng voucher sàn.
--   * Chống đặt trùng: trình duyệt gửi kèm mã yêu cầu (p_request_id). Cùng mã gửi lại → trả về đơn đã tạo, không tạo đơn mới.
--   * Đơn "Chuyển khoản QR (mô phỏng)" không báo đã chuyển khoản sau 24 giờ → tự hủy, trả hàng về kho.
--   * Thông báo: khách (đơn đổi trạng thái, thanh toán, hoàn tiền, đánh giá được trả lời/bị ẩn),
--     người bán (đơn mới, shop được duyệt/từ chối, sản phẩm bị ẩn). Mỗi người chỉ đọc thông báo của mình.
--   * Báo cáo đánh giá: khách đăng nhập báo cáo đánh giá vi phạm (mỗi người 1 lần / đánh giá); Admin xem số báo cáo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SẢN PHẨM: TRƯỜNG "CÁCH DÙNG"
-- -----------------------------------------------------------------------------
alter table public.products
  add column how_to_use text not null default '' check (char_length(how_to_use) <= 2000);
grant insert (how_to_use), update (how_to_use) on public.products to authenticated;

-- -----------------------------------------------------------------------------
-- 2. VOUCHER
-- -----------------------------------------------------------------------------
create table public.vouchers (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid references public.shops (id) on delete cascade,  -- null = voucher của sàn
  code           text not null check (code ~ '^[A-Z0-9]{4,20}$'),
  title          text not null check (char_length(title) between 3 and 80),
  discount_type  text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  max_discount   integer check (max_discount is null or max_discount > 0),
  min_spend      integer not null default 0 check (min_spend between 0 and 100000000),
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  usage_limit    integer check (usage_limit is null or usage_limit between 1 and 1000000),
  per_user_limit integer not null default 1 check (per_user_limit between 1 and 100),
  used_count     integer not null default 0 check (used_count >= 0),
  is_active      boolean not null default true,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value between 1 and 90),
  check (discount_type <> 'fixed' or discount_value <= 10000000)
);
create unique index vouchers_code_key on public.vouchers (code);
create index vouchers_shop_idx on public.vouchers (shop_id);

-- Ví voucher: voucher khách đã lưu
create table public.voucher_claims (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, voucher_id)
);

-- Lượt dùng voucher trong đơn hàng
create table public.voucher_redemptions (
  id            bigint generated always as identity primary key,
  voucher_id    uuid not null references public.vouchers (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  order_id      uuid not null references public.orders (id) on delete cascade,
  shop_order_id uuid references public.shop_orders (id) on delete cascade,  -- null = voucher sàn (cả đơn)
  amount        integer not null check (amount >= 0),
  created_at    timestamptz not null default now()
);
create index voucher_redemptions_voucher_user_idx on public.voucher_redemptions (voucher_id, user_id);
create index voucher_redemptions_order_idx on public.voucher_redemptions (order_id);

create trigger vouchers_touch_updated_at before update on public.vouchers
  for each row execute function private.touch_updated_at();

alter table public.vouchers enable row level security;
alter table public.voucher_claims enable row level security;
alter table public.voucher_redemptions enable row level security;
revoke all on public.vouchers, public.voucher_claims, public.voucher_redemptions from anon, authenticated;
grant select on public.vouchers to anon, authenticated;
grant select on public.voucher_claims to authenticated;

-- Ai cũng xem được voucher đang chạy (của sàn hoặc của shop đang bán); chủ shop xem voucher shop mình; Admin xem tất cả
create policy vouchers_select on public.vouchers for select to anon, authenticated
  using ((is_active and now() < ends_at and (shop_id is null or public.is_shop_public(shop_id)))
         or (shop_id is not null and public.owns_shop(shop_id)) or public.is_admin());
create policy voucher_claims_select_own on public.voucher_claims for select to authenticated using (user_id = auth.uid());

-- Đơn hàng: thêm cột giảm giá, sửa ràng buộc tổng tiền
alter table public.orders
  add column discount_total integer not null default 0 check (discount_total >= 0),
  add column client_request_id uuid;
-- Bỏ ràng buộc tổng tiền cũ (tên do PostgreSQL tự đặt, tìm theo nội dung để chạy đúng trên mọi bản)
do $$
declare r record;
begin
  for r in select conname, conrelid::regclass as tbl from pg_constraint
            where contype = 'c' and (
              (conrelid = 'public.orders'::regclass and pg_get_constraintdef(oid) like '%grand_total = (items_subtotal + shipping_total)%')
              or (conrelid = 'public.shop_orders'::regclass and pg_get_constraintdef(oid) like '%total = (items_subtotal + shipping_fee)%'))
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;
alter table public.orders add constraint orders_grand_total_check
  check (grand_total = items_subtotal + shipping_total - discount_total and discount_total <= items_subtotal);
create unique index orders_client_request_key on public.orders (customer_id, client_request_id) where client_request_id is not null;

alter table public.shop_orders
  add column shop_discount integer not null default 0 check (shop_discount >= 0),
  add column platform_discount integer not null default 0 check (platform_discount >= 0),
  add column shop_voucher_code text,
  add column platform_voucher_code text;
alter table public.shop_orders add constraint shop_orders_total_check
  check (total = items_subtotal + shipping_fee - shop_discount - platform_discount
         and shop_discount + platform_discount <= items_subtotal);
-- Đơn quá hạn do hệ thống hủy
alter table public.shop_orders drop constraint shop_orders_cancelled_by_check;
alter table public.shop_orders add constraint shop_orders_cancelled_by_check
  check (cancelled_by in ('customer', 'seller', 'admin', 'system'));

-- Tính voucher cho một giỏ hàng. p_subtotals: {"<shop_id>": tiền hàng, ...}.
-- Trả về {"shops": {"<shop_id>": {"voucher_id","code","title","discount"}}, "platform": {...}|null, "errors": [{"code","message"}]}
-- p_lock = true: khóa dòng voucher (dùng khi đặt hàng thật để không vượt tổng lượt dùng)
create or replace function private.evaluate_vouchers(p_uid uuid, p_subtotals jsonb, p_codes text[], p_lock boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_code     text;
  v_v        public.vouchers;
  v_shops    jsonb := '{}'::jsonb;
  v_platform jsonb := null;
  v_errors   jsonb := '[]'::jsonb;
  v_sub      integer;
  v_disc     integer;
  v_total    integer := 0;
  v_after    integer;
  v_used     integer;
  k          text;
begin
  for k in select jsonb_object_keys(p_subtotals) loop
    v_total := v_total + (p_subtotals ->> k)::integer;
  end loop;

  -- Voucher shop trước, voucher sàn sau (giảm trên số tiền còn lại)
  for v_code in
    select c from (select distinct upper(btrim(x)) as c from unnest(coalesce(p_codes, '{}')) x where btrim(x) <> '') t
     order by (select v.shop_id is null from public.vouchers v where v.code = t.c) nulls first, c
     limit 10
  loop
    if p_lock then
      select * into v_v from public.vouchers v where v.code = v_code for update;
    else
      select * into v_v from public.vouchers v where v.code = v_code;
    end if;

    if v_v.id is null then
      v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Mã ' || v_code || ' không tồn tại.');
      continue;
    end if;
    if not v_v.is_active or now() < v_v.starts_at or now() >= v_v.ends_at then
      v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Mã ' || v_code || ' chưa bắt đầu hoặc đã hết hạn.');
      continue;
    end if;
    if v_v.shop_id is not null and not public.is_shop_public(v_v.shop_id) then
      v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Mã ' || v_code || ' không còn dùng được.');
      continue;
    end if;
    if v_v.usage_limit is not null and v_v.used_count >= v_v.usage_limit then
      v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Mã ' || v_code || ' đã hết lượt sử dụng.');
      continue;
    end if;
    select count(*) into v_used from public.voucher_redemptions r where r.voucher_id = v_v.id and r.user_id = p_uid;
    if v_used >= v_v.per_user_limit then
      v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Bạn đã dùng hết lượt của mã ' || v_code || '.');
      continue;
    end if;

    if v_v.shop_id is not null then
      if not (p_subtotals ? v_v.shop_id::text) then
        v_errors := v_errors || jsonb_build_object('code', v_code, 'message',
          'Mã ' || v_code || ' chỉ dùng cho sản phẩm của shop ' || (select s.name from public.shops s where s.id = v_v.shop_id) || '.');
        continue;
      end if;
      if v_shops ? v_v.shop_id::text then
        v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Mỗi shop chỉ dùng 1 mã giảm giá.');
        continue;
      end if;
      v_sub := (p_subtotals ->> v_v.shop_id::text)::integer;
    else
      if v_platform is not null then
        v_errors := v_errors || jsonb_build_object('code', v_code, 'message', 'Mỗi đơn chỉ dùng 1 mã giảm giá của sàn.');
        continue;
      end if;
      select v_total - coalesce(sum((e.value ->> 'discount')::integer), 0) into v_sub from jsonb_each(v_shops) e;
    end if;

    if v_sub < v_v.min_spend then
      v_errors := v_errors || jsonb_build_object('code', v_code, 'message',
        'Mã ' || v_code || ' cần đơn tối thiểu ' || replace(to_char(v_v.min_spend, 'FM999,999,999'), ',', '.') || 'đ.');
      continue;
    end if;

    v_disc := case when v_v.discount_type = 'percent'
                   then least(floor(v_sub * v_v.discount_value / 100.0)::integer, coalesce(v_v.max_discount, 2147483647))
                   else v_v.discount_value end;
    v_disc := greatest(0, least(v_disc, v_sub));

    if v_v.shop_id is not null then
      v_shops := v_shops || jsonb_build_object(v_v.shop_id::text,
        jsonb_build_object('voucher_id', v_v.id, 'code', v_v.code, 'title', v_v.title, 'discount', v_disc));
    else
      v_platform := jsonb_build_object('voucher_id', v_v.id, 'code', v_v.code, 'title', v_v.title, 'discount', v_disc);
    end if;
  end loop;

  v_after := v_total - coalesce((select sum((e.value ->> 'discount')::integer) from jsonb_each(v_shops) e), 0)
                     - coalesce((v_platform ->> 'discount')::integer, 0);
  return jsonb_build_object('shops', v_shops, 'platform', v_platform, 'errors', v_errors, 'items_subtotal', v_total, 'after_discount', v_after);
end;
$$;

-- Xem trước voucher ở giỏ hàng / trang đặt hàng (không đặt hàng, không trừ lượt)
create or replace function public.preview_vouchers(p_items jsonb, p_codes text[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_subtotals jsonb;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để dùng mã giảm giá.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Dữ liệu giỏ hàng không hợp lệ.' using errcode = '22023';
  end if;
  begin
    select coalesce(jsonb_object_agg(t.shop_id, t.subtotal), '{}'::jsonb) into v_subtotals
    from (
      select p.shop_id::text as shop_id, sum(coalesce(p.sale_price, p.price) * least(greatest((e ->> 'quantity')::integer, 1), 10))::integer as subtotal
      from jsonb_array_elements(p_items) e
      join public.products p on p.id = (e ->> 'product_id')::uuid and public.is_product_public(p.id)
      group by p.shop_id
    ) t;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Dữ liệu giỏ hàng không hợp lệ.' using errcode = '22023';
  end;
  return private.evaluate_vouchers(auth.uid(), v_subtotals, p_codes, false);
end;
$$;

-- Lưu voucher vào ví
create or replace function public.claim_voucher(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_v public.vouchers;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để lưu mã giảm giá.' using errcode = '42501';
  end if;
  select * into v_v from public.vouchers v where v.code = upper(btrim(coalesce(p_code, '')));
  if v_v.id is null or not v_v.is_active or now() >= v_v.ends_at or (v_v.shop_id is not null and not public.is_shop_public(v_v.shop_id)) then
    raise exception 'Mã giảm giá không tồn tại hoặc đã hết hạn.' using errcode = 'P0002';
  end if;
  insert into public.voucher_claims (user_id, voucher_id) values (auth.uid(), v_v.id) on conflict do nothing;
  return v_v.id;
end;
$$;

-- Ví voucher của tôi (kèm số lượt mình đã dùng)
create or replace function public.my_vouchers()
returns table (
  id uuid, shop_id uuid, shop_name text, shop_slug text, code text, title text, discount_type text, discount_value integer,
  max_discount integer, min_spend integer, starts_at timestamptz, ends_at timestamptz, per_user_limit integer,
  my_used integer, exhausted boolean, claimed_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select v.id, v.shop_id, s.name, s.slug, v.code, v.title, v.discount_type, v.discount_value, v.max_discount, v.min_spend,
         v.starts_at, v.ends_at, v.per_user_limit,
         (select count(*)::integer from public.voucher_redemptions r where r.voucher_id = v.id and r.user_id = auth.uid()),
         (v.usage_limit is not null and v.used_count >= v.usage_limit) or not v.is_active,
         c.claimed_at
    from public.voucher_claims c
    join public.vouchers v on v.id = c.voucher_id
    left join public.shops s on s.id = v.shop_id
   where c.user_id = auth.uid()
   order by v.ends_at;
$$;

-- Tạo / sửa voucher. p_shop_id = null: voucher sàn (chỉ Admin). Có shop: chủ shop đó (hoặc Admin).
create or replace function public.save_voucher(
  p_id uuid, p_shop_id uuid, p_code text, p_title text, p_discount_type text, p_discount_value integer,
  p_max_discount integer, p_min_spend integer, p_starts_at timestamptz, p_ends_at timestamptz,
  p_usage_limit integer, p_per_user_limit integer, p_is_active boolean
)
returns public.vouchers
language plpgsql security definer set search_path = ''
as $$
declare
  v_old  public.vouchers;
  v_row  public.vouchers;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not public.is_active_user() then
    raise exception 'Tài khoản chưa đăng nhập hoặc đang bị khóa.' using errcode = '42501';
  end if;
  if p_id is not null then
    select * into v_old from public.vouchers where id = p_id for update;
    if v_old.id is null then
      raise exception 'Không tìm thấy mã giảm giá.' using errcode = 'P0002';
    end if;
    -- Không đổi chủ của voucher
    if v_old.shop_id is distinct from p_shop_id then
      raise exception 'Không đổi được cửa hàng của mã giảm giá.' using errcode = '42501';
    end if;
  end if;
  if p_shop_id is null then
    if not public.is_admin() then
      raise exception 'Chỉ quản trị viên tạo được mã giảm giá của sàn.' using errcode = '42501';
    end if;
  elsif not (public.owns_shop(p_shop_id) or public.is_admin()) then
    raise exception 'Bạn chỉ quản lý được mã giảm giá của cửa hàng mình.' using errcode = '42501';
  end if;
  if p_shop_id is not null and (select status from public.shops where id = p_shop_id) <> 'active' then
    raise exception 'Cửa hàng cần được duyệt trước khi tạo mã giảm giá.' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'Mã gồm 4–20 chữ cái không dấu hoặc chữ số, viết liền.' using errcode = '22023';
  end if;
  if v_old.id is not null and v_old.used_count > 0 and v_old.code <> v_code then
    raise exception 'Mã đã có người dùng nên không đổi được chữ mã.' using errcode = '22023';
  end if;
  if exists (select 1 from public.vouchers v where v.code = v_code and v.id is distinct from p_id) then
    raise exception 'Mã % đã tồn tại, hãy chọn mã khác.', v_code using errcode = '23505';
  end if;

  if v_old.id is null then
    insert into public.vouchers (shop_id, code, title, discount_type, discount_value, max_discount, min_spend, starts_at, ends_at,
                                 usage_limit, per_user_limit, is_active, created_by)
    values (p_shop_id, v_code, btrim(p_title), p_discount_type, p_discount_value, p_max_discount, coalesce(p_min_spend, 0),
            coalesce(p_starts_at, now()), p_ends_at, p_usage_limit, coalesce(p_per_user_limit, 1), coalesce(p_is_active, true), auth.uid())
    returning * into v_row;
  else
    update public.vouchers set code = v_code, title = btrim(p_title), discount_type = p_discount_type, discount_value = p_discount_value,
           max_discount = p_max_discount, min_spend = coalesce(p_min_spend, 0), starts_at = coalesce(p_starts_at, starts_at),
           ends_at = p_ends_at, usage_limit = p_usage_limit, per_user_limit = coalesce(p_per_user_limit, 1),
           is_active = coalesce(p_is_active, true)
     where id = p_id returning * into v_row;
  end if;
  if p_shop_id is null then
    perform private.log_action(case when v_old.id is null then 'voucher.create' else 'voucher.update' end, 'voucher', v_row.id::text,
      jsonb_build_object('code', v_row.code, 'active', v_row.is_active));
  end if;
  return v_row;
exception
  when check_violation then
    raise exception 'Thông tin mã giảm giá chưa hợp lệ (kiểm tra mức giảm, ngày kết thúc sau ngày bắt đầu, giảm theo %% tối đa 90).' using errcode = '23514';
end;
$$;

-- Trả lại lượt dùng voucher khi đơn con bị hủy (voucher shop) / cả đơn bị hủy (voucher sàn)
create or replace function private.release_vouchers_on_cancel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    for r in delete from public.voucher_redemptions where shop_order_id = new.id returning voucher_id loop
      update public.vouchers set used_count = greatest(used_count - 1, 0) where id = r.voucher_id;
    end loop;
    if not exists (select 1 from public.shop_orders so where so.order_id = new.order_id and so.status <> 'cancelled') then
      for r in delete from public.voucher_redemptions where order_id = new.order_id and shop_order_id is null returning voucher_id loop
        update public.vouchers set used_count = greatest(used_count - 1, 0) where id = r.voucher_id;
      end loop;
    end if;
  end if;
  return null;
end;
$$;
create trigger shop_orders_release_vouchers after update of status on public.shop_orders
  for each row execute function private.release_vouchers_on_cancel();

-- -----------------------------------------------------------------------------
-- 3. TỰ HỦY ĐƠN QR QUÁ HẠN (24 giờ chưa báo chuyển khoản)
-- -----------------------------------------------------------------------------
create or replace function private.expire_unpaid_qr_orders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_so public.shop_orders;
  n    integer := 0;
begin
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
    -- Sự kiện do hệ thống tạo: không ghi id của người đang đăng nhập (người khác) làm người thực hiện
    update public.order_events set actor_id = null where shop_order_id = v_so.id and actor_role = 'system';
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Ai đăng nhập cũng gọi được (không trả dữ liệu, chỉ dọn đơn quá hạn); website gọi khi mở trang đơn hàng
create or replace function public.expire_overdue_orders()
returns integer
language sql security definer set search_path = ''
as $$ select private.expire_unpaid_qr_orders() $$;

-- -----------------------------------------------------------------------------
-- 4. ĐẶT HÀNG: VOUCHER + CHỐNG ĐẶT TRÙNG (thay hàm cũ)
-- -----------------------------------------------------------------------------
drop function public.place_order(jsonb, uuid, public.payment_method, text);

create or replace function public.place_order(
  p_items          jsonb,
  p_address_id     uuid,
  p_payment_method public.payment_method default 'cod',
  p_note           text default '',
  p_voucher_codes  text[] default null,
  p_request_id     uuid default null
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
  v_discount  integer := 0;
  v_ids       uuid[];
  v_qtys      integer[];
  v_note      text := btrim(coalesce(p_note, ''));
  v_existing  public.orders;
  v_subtotals jsonb;
  v_vouchers  jsonb;
  v_pf_total  integer := 0;
  v_pf_left   integer := 0;
  v_base_sum  integer := 0;
  v_shop_disc integer;
  v_pf_disc   integer;
  v_n_shops   integer;
  v_i         integer := 0;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Tài khoản chưa đăng nhập hoặc đang bị khóa nên không đặt hàng được.' using errcode = '42501';
  end if;

  -- Gửi lại cùng mã yêu cầu (bấm 2 lần, mạng chập chờn) → trả về đơn đã tạo
  if p_request_id is not null then
    select * into v_existing from public.orders o where o.customer_id = v_uid and o.client_request_id = p_request_id;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'code', v_existing.code, 'grand_total', v_existing.grand_total, 'duplicate', true);
    end if;
  end if;

  -- Chống gửi đơn liên tục
  if (select count(*) from public.orders o where o.customer_id = v_uid and o.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Bạn đặt quá nhiều đơn trong thời gian ngắn. Vui lòng thử lại sau ít phút.' using errcode = '54000';
  end if;

  -- Dọn đơn QR quá hạn (trả hàng về kho trước khi kiểm tra tồn kho)
  perform private.expire_unpaid_qr_orders();

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

  -- Tiền hàng theo shop → tính voucher (khóa dòng voucher để không vượt lượt dùng)
  select jsonb_object_agg(t.shop_id, t.subtotal) into v_subtotals
  from (
    select p.shop_id::text as shop_id, sum(coalesce(p.sale_price, p.price) * i.quantity)::integer as subtotal
    from unnest(v_ids, v_qtys) as i(product_id, quantity)
    join public.products p on p.id = i.product_id
    group by p.shop_id
  ) t;
  v_vouchers := private.evaluate_vouchers(v_uid, v_subtotals, p_voucher_codes, true);
  if jsonb_array_length(v_vouchers -> 'errors') > 0 then
    raise exception '%', v_vouchers -> 'errors' -> 0 ->> 'message' using errcode = '22023';
  end if;
  v_pf_total := coalesce((v_vouchers -> 'platform' ->> 'discount')::integer, 0);
  v_pf_left := v_pf_total;
  v_n_shops := (select count(*) from jsonb_object_keys(v_subtotals));
  -- Cơ sở chia voucher sàn = tiền hàng sau voucher shop
  select sum((t.value)::integer - coalesce((v_vouchers -> 'shops' -> t.key ->> 'discount')::integer, 0))::integer
    into v_base_sum from jsonb_each_text(v_subtotals) t;

  select s.shipping_fee into v_fee from public.site_settings s where s.id = 1;
  v_fee := coalesce(v_fee, 0);

  loop
    v_code := 'WM' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
              upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.orders o where o.code = v_code);
  end loop;

  begin
    insert into public.orders (code, customer_id, recipient_name, phone, province, district, ward, street, note,
                               payment_method, items_subtotal, shipping_total, grand_total, client_request_id)
    values (v_code, v_uid, v_addr.recipient_name, v_addr.phone, v_addr.province, v_addr.district, v_addr.ward, v_addr.street,
            v_note, p_payment_method, 0, 0, 0, p_request_id)
    returning id into v_order_id;
  exception when unique_violation then
    -- Hai yêu cầu cùng mã gửi đồng thời: yêu cầu sau trả về đơn của yêu cầu trước
    select * into v_existing from public.orders o where o.customer_id = v_uid and o.client_request_id = p_request_id;
    return jsonb_build_object('id', v_existing.id, 'code', v_existing.code, 'grand_total', v_existing.grand_total, 'duplicate', true);
  end;

  for v_shop in
    select p.shop_id, s.name as shop_name, sum(coalesce(p.sale_price, p.price) * i.quantity)::integer as subtotal
    from unnest(v_ids, v_qtys) as i(product_id, quantity)
    join public.products p on p.id = i.product_id
    join public.shops s on s.id = p.shop_id
    group by p.shop_id, s.name
    order by s.name
  loop
    v_i := v_i + 1;
    v_shop_disc := coalesce((v_vouchers -> 'shops' -> v_shop.shop_id::text ->> 'discount')::integer, 0);
    -- Chia voucher sàn theo tỷ lệ; shop cuối nhận phần còn lại để tổng khớp
    if v_pf_total = 0 or v_base_sum = 0 then
      v_pf_disc := 0;
    elsif v_i = v_n_shops then
      v_pf_disc := v_pf_left;
    else
      v_pf_disc := floor(v_pf_total::numeric * (v_shop.subtotal - v_shop_disc) / v_base_sum)::integer;
    end if;
    v_pf_disc := least(v_pf_disc, v_shop.subtotal - v_shop_disc);
    v_pf_left := v_pf_left - v_pf_disc;

    insert into public.shop_orders (order_id, shop_id, shop_name, items_subtotal, shipping_fee, shop_discount, platform_discount,
                                    shop_voucher_code, platform_voucher_code, total)
    values (v_order_id, v_shop.shop_id, v_shop.shop_name, v_shop.subtotal, v_fee, v_shop_disc, v_pf_disc,
            v_vouchers -> 'shops' -> v_shop.shop_id::text ->> 'code',
            case when v_pf_disc > 0 then v_vouchers -> 'platform' ->> 'code' end,
            v_shop.subtotal + v_fee - v_shop_disc - v_pf_disc)
    returning id into v_so_id;

    if v_shop_disc > 0 or (v_vouchers -> 'shops') ? v_shop.shop_id::text then
      insert into public.voucher_redemptions (voucher_id, user_id, order_id, shop_order_id, amount)
      values ((v_vouchers -> 'shops' -> v_shop.shop_id::text ->> 'voucher_id')::uuid, v_uid, v_order_id, v_so_id, v_shop_disc);
      update public.vouchers set used_count = used_count + 1 where id = (v_vouchers -> 'shops' -> v_shop.shop_id::text ->> 'voucher_id')::uuid;
    end if;

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
    v_discount := v_discount + v_shop_disc + v_pf_disc;
  end loop;

  if v_vouchers -> 'platform' is not null and jsonb_typeof(v_vouchers -> 'platform') = 'object' then
    insert into public.voucher_redemptions (voucher_id, user_id, order_id, shop_order_id, amount)
    values ((v_vouchers -> 'platform' ->> 'voucher_id')::uuid, v_uid, v_order_id, null, v_pf_total);
    update public.vouchers set used_count = used_count + 1 where id = (v_vouchers -> 'platform' ->> 'voucher_id')::uuid;
  end if;
  -- Voucher đã dùng tự vào ví
  insert into public.voucher_claims (user_id, voucher_id)
  select v_uid, (x.value ->> 'voucher_id')::uuid
    from (select value from jsonb_each(v_vouchers -> 'shops')
          union all select v_vouchers -> 'platform' where jsonb_typeof(v_vouchers -> 'platform') = 'object') x
  on conflict do nothing;

  update public.orders set items_subtotal = v_subtotal, shipping_total = v_shipping, discount_total = v_discount,
                           grand_total = v_subtotal + v_shipping - v_discount
   where id = v_order_id;

  update public.products p set stock = p.stock - i.quantity
    from unnest(v_ids, v_qtys) as i(product_id, quantity) where p.id = i.product_id;

  delete from public.cart_items c where c.user_id = v_uid and c.product_id = any (v_ids);

  return jsonb_build_object('id', v_order_id, 'code', v_code, 'grand_total', v_subtotal + v_shipping - v_discount, 'duplicate', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. THÔNG BÁO
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('order', 'payment', 'refund', 'review', 'shop', 'product', 'system')),
  title      text not null check (char_length(title) <= 160),
  body       text not null default '' check (char_length(body) <= 600),
  link       text check (link is null or link ~ '^/[^/]'),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, left(p_title, 160), left(coalesce(p_body, ''), 600), p_link
   where p_user is not null;
$$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Đơn hàng: thông báo theo sự kiện đơn (order_events)
create or replace function private.notify_order_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_so    public.shop_orders;
  v_owner uuid;
  v_label text;
begin
  select * into v_order from public.orders where id = new.order_id;
  if new.shop_order_id is not null then
    select * into v_so from public.shop_orders where id = new.shop_order_id;
    select owner_id into v_owner from public.shops where id = v_so.shop_id;
  end if;

  if new.kind = 'status' then
    if new.from_value is null and new.to_value = 'pending' then
      perform private.notify(v_owner, 'order', 'Đơn mới ' || v_order.code,
        'Khách vừa đặt đơn ' || replace(to_char(v_so.total, 'FM999,999,999'), ',', '.') || 'đ cho ' || v_so.shop_name || '. Hãy xác nhận đơn.', '/seller/orders');
      return null;
    end if;
    v_label := case new.to_value
      when 'confirmed' then 'đã được xác nhận' when 'preparing' then 'đang được chuẩn bị'
      when 'shipping' then 'đang được giao' when 'delivered' then 'đã giao thành công'
      when 'cancelled' then 'đã bị hủy' else new.to_value end;
    if new.actor_role <> 'customer' then
      perform private.notify(v_order.customer_id, 'order', 'Đơn ' || v_order.code || ' ' || v_label,
        v_so.shop_name || coalesce(': ' || new.note, '') ||
        case when new.to_value = 'delivered' then ' Bạn có thể đánh giá sản phẩm ngay trong đơn.' else '' end,
        '/orders/' || v_order.code);
    end if;
    if new.to_value = 'cancelled' and new.actor_role in ('customer', 'admin', 'system') then
      perform private.notify(v_owner, 'order', 'Đơn ' || v_order.code || ' đã bị hủy',
        coalesce(new.note, 'Đơn con của shop đã bị hủy.'), '/seller/orders');
    end if;
  elsif new.kind = 'payment' and new.actor_role = 'admin' then
    perform private.notify(v_order.customer_id, 'payment',
      case when new.to_value = 'paid' then 'Đã xác nhận thanh toán đơn ' || v_order.code
           else 'Chưa xác nhận được thanh toán đơn ' || v_order.code end,
      coalesce(new.note, ''), '/orders/' || v_order.code);
  elsif new.kind = 'refund' then
    perform private.notify(v_order.customer_id, 'refund',
      case when new.to_value = 'done' then 'Đã hoàn tiền đơn ' || v_order.code else 'Đơn ' || v_order.code || ' đang chờ hoàn tiền' end,
      coalesce(v_so.shop_name, ''), '/orders/' || v_order.code);
  end if;
  return null;
end;
$$;
create trigger order_events_notify after insert on public.order_events
  for each row execute function private.notify_order_event();

-- Đánh giá: người bán trả lời / Admin ẩn → báo người viết
create or replace function private.notify_review_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.products;
begin
  select * into v_p from public.products where id = new.product_id;
  if new.seller_reply is not null and new.seller_reply is distinct from old.seller_reply then
    perform private.notify(new.user_id, 'review', 'Cửa hàng đã trả lời đánh giá của bạn', v_p.name, '/products/' || v_p.slug || '#reviews');
  end if;
  if new.hidden and not old.hidden then
    perform private.notify(new.user_id, 'review', 'Đánh giá của bạn đã bị ẩn', coalesce(new.hidden_reason, ''), '/products/' || v_p.slug || '#reviews');
  end if;
  return null;
end;
$$;
create trigger product_reviews_notify after update of seller_reply, hidden on public.product_reviews
  for each row execute function private.notify_review_change();

-- Shop được duyệt / từ chối / tạm ngưng → báo chủ shop
create or replace function private.notify_shop_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('active', 'rejected', 'suspended') then
    perform private.notify(new.owner_id, 'shop',
      case new.status when 'active' then 'Cửa hàng ' || new.name || ' đã được duyệt'
                      when 'rejected' then 'Cửa hàng ' || new.name || ' chưa được duyệt'
                      else 'Cửa hàng ' || new.name || ' bị tạm ngưng' end,
      coalesce(new.status_reason, ''), '/seller');
  end if;
  return null;
end;
$$;
create trigger shops_notify_status after update of status on public.shops
  for each row execute function private.notify_shop_status();

-- Admin ẩn sản phẩm → báo chủ shop
create or replace function private.notify_product_hidden()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.admin_hidden and not old.admin_hidden then
    perform private.notify((select owner_id from public.shops where id = new.shop_id), 'product',
      'Sản phẩm "' || new.name || '" bị ẩn', coalesce(new.admin_hidden_reason, ''), '/seller/products/' || new.id);
  end if;
  return null;
end;
$$;
create trigger products_notify_hidden after update of admin_hidden on public.products
  for each row execute function private.notify_product_hidden();

-- -----------------------------------------------------------------------------
-- 6. BÁO CÁO ĐÁNH GIÁ VI PHẠM
-- -----------------------------------------------------------------------------
create table public.review_reports (
  review_id   uuid not null references public.product_reviews (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'offensive', 'personal_info', 'irrelevant', 'other')),
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  primary key (review_id, reporter_id)
);
alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon, authenticated;

create or replace function public.report_review(p_review_id uuid, p_reason text, p_note text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_r public.product_reviews;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để báo cáo đánh giá.' using errcode = '42501';
  end if;
  select * into v_r from public.product_reviews where id = p_review_id and not hidden;
  if v_r.id is null or not public.is_product_public(v_r.product_id) then
    raise exception 'Không tìm thấy đánh giá.' using errcode = 'P0002';
  end if;
  if v_r.user_id = auth.uid() then
    raise exception 'Bạn không thể báo cáo đánh giá của chính mình.' using errcode = '22023';
  end if;
  if p_reason not in ('spam', 'offensive', 'personal_info', 'irrelevant', 'other') then
    raise exception 'Hãy chọn lý do báo cáo.' using errcode = '22023';
  end if;
  insert into public.review_reports (review_id, reporter_id, reason, note)
  values (p_review_id, auth.uid(), p_reason, left(btrim(coalesce(p_note, '')), 300))
  on conflict (review_id, reporter_id) do update set reason = excluded.reason, note = excluded.note, created_at = now();
end;
$$;

-- Admin: danh sách đánh giá có thêm số báo cáo và lọc "bị báo cáo"
drop function public.admin_list_reviews(boolean, integer, text, integer, integer);
create or replace function public.admin_list_reviews(
  p_hidden boolean default null, p_max_rating integer default null, p_query text default null,
  p_limit integer default 20, p_offset integer default 0, p_reported boolean default null
)
returns table (
  id uuid, product_id uuid, product_name text, product_slug text, shop_name text, rating smallint, comment text,
  reviewer_name text, reviewer_email text, seller_reply text, hidden boolean, hidden_reason text, created_at timestamptz,
  report_count integer, report_reasons text[], total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền quản lý đánh giá.' using errcode = '42501';
  end if;
  return query
  select r.id, r.product_id, p.name, p.slug, s.name, r.rating, r.comment, r.reviewer_name, u.email,
         r.seller_reply, r.hidden, r.hidden_reason, r.created_at,
         (select count(*)::integer from public.review_reports rr where rr.review_id = r.id),
         (select array_agg(distinct rr.reason) from public.review_reports rr where rr.review_id = r.id),
         count(*) over ()
    from public.product_reviews r
    join public.products p on p.id = r.product_id
    join public.shops s on s.id = p.shop_id
    left join public.profiles u on u.id = r.user_id
   where (p_hidden is null or r.hidden = p_hidden)
     and (p_max_rating is null or r.rating <= p_max_rating)
     and (p_reported is null or p_reported = exists (select 1 from public.review_reports rr where rr.review_id = r.id))
     and (coalesce(btrim(p_query), '') = ''
          or private.vn_unaccent(p.name || ' ' || r.comment || ' ' || coalesce(u.email, '')) like '%' || private.vn_unaccent(btrim(p_query)) || '%')
   order by (select count(*) from public.review_reports rr where rr.review_id = r.id) desc, r.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Đánh giá nổi bật cho trang chủ (đánh giá thật, 4–5 sao, có nhận xét, không bị ẩn)
create or replace function public.latest_reviews(p_limit integer default 6)
returns table (id uuid, rating smallint, comment text, reviewer_name text, created_at timestamptz, product_name text, product_slug text)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.rating, r.comment, r.reviewer_name, r.created_at, p.name, p.slug
    from public.product_reviews r
    join public.products p on p.id = r.product_id
   where not r.hidden and r.rating >= 4 and char_length(r.comment) >= 20 and public.is_product_public(p.id)
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

-- -----------------------------------------------------------------------------
-- 7. TÌM KIẾM: LỌC THƯƠNG HIỆU, ĐIỂM ĐÁNH GIÁ, CÒN HÀNG
-- -----------------------------------------------------------------------------
drop function public.search_products(text, text, text[], uuid, integer, integer, text, text, integer, integer);
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
  p_offset     integer default 0,
  p_brands     text[]  default null,
  p_min_rating numeric default null,
  p_in_stock   boolean default false
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
      and (p_brands is null or cardinality(p_brands) = 0 or lower(p.brand_name) = any (select lower(b) from unnest(p_brands) b))
      and (p_min_rating is null or (p.review_count > 0 and p.rating >= p_min_rating))
      and (not coalesce(p_in_stock, false) or p.stock > 0)
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

-- -----------------------------------------------------------------------------
-- 8. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.evaluate_vouchers(uuid, jsonb, text[], boolean), private.release_vouchers_on_cancel(),
  private.expire_unpaid_qr_orders(), private.notify(uuid, text, text, text, text), private.notify_order_event(),
  private.notify_review_change(), private.notify_shop_status(), private.notify_product_hidden()
  from public, anon, authenticated;

revoke execute on function public.search_products(text, text, text[], uuid, integer, integer, text, text, integer, integer, text[], numeric, boolean),
  public.latest_reviews(integer) from public;
grant execute on function public.search_products(text, text, text[], uuid, integer, integer, text, text, integer, integer, text[], numeric, boolean),
  public.latest_reviews(integer) to anon, authenticated;

revoke execute on function public.place_order(jsonb, uuid, public.payment_method, text, text[], uuid),
  public.preview_vouchers(jsonb, text[]), public.claim_voucher(text), public.my_vouchers(),
  public.save_voucher(uuid, uuid, text, text, text, integer, integer, integer, timestamptz, timestamptz, integer, integer, boolean),
  public.expire_overdue_orders(), public.mark_notifications_read(bigint[]), public.report_review(uuid, text, text),
  public.admin_list_reviews(boolean, integer, text, integer, integer, boolean)
  from public, anon;
grant execute on function public.place_order(jsonb, uuid, public.payment_method, text, text[], uuid),
  public.preview_vouchers(jsonb, text[]), public.claim_voucher(text), public.my_vouchers(),
  public.save_voucher(uuid, uuid, text, text, text, integer, integer, integer, timestamptz, timestamptz, integer, integer, boolean),
  public.expire_overdue_orders(), public.mark_notifications_read(bigint[]), public.report_review(uuid, text, text),
  public.admin_list_reviews(boolean, integer, text, integer, integer, boolean)
  to authenticated;
