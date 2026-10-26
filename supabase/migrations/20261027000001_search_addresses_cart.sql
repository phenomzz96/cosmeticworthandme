-- =============================================================================
-- Worth & Me — Migration 004: Tìm kiếm phía server, sổ địa chỉ, giỏ hàng theo tài khoản (Giai đoạn 3)
--
-- Chạy SAU migration 001, 002, 003. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc:
--   * Tìm kiếm không phân biệt dấu tiếng Việt ("kem chong nang" tìm được "Kem chống nắng").
--     Chỉ trả sản phẩm đang bán của shop đang hoạt động, kể cả khi người gọi là chủ shop/admin.
--   * Sổ địa chỉ: mỗi người chỉ xem/sửa địa chỉ của chính mình (tối đa 10), có 1 địa chỉ mặc định.
--     Không ai khác đọc được địa chỉ, số điện thoại người nhận (kể cả chủ shop) qua bảng này.
--   * Giỏ hàng: mỗi người một giỏ, mỗi sản phẩm tối đa 10, chỉ thêm sản phẩm đang bán.
--     Giỏ chỉ lưu id sản phẩm + số lượng; giá luôn lấy lại từ bảng products khi đặt hàng.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHUẨN HÓA TIẾNG VIỆT ĐỂ TÌM KIẾM (không cần extension unaccent)
-- -----------------------------------------------------------------------------
create or replace function private.vn_unaccent(p_text text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(coalesce(p_text, '')),
      'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
      'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
    ),
    '\s+', ' ', 'g')
$$;

-- Nhãn tiếng Việt của danh mục / loại sản phẩm (khớp src/data/taxonomy.ts) để tìm "son môi", "dầu gội"...
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
      when 'body-wash' then 'sữa tắm' when 'body-lotion' then 'dưỡng thể' when 'hand-cream' then 'kem tay'
      when 'brush' then 'cọ trang điểm' when 'sponge' then 'mút trang điểm' when 'facial-device' then 'máy rửa mặt' end)
$$;

-- Chuỗi tìm kiếm của sản phẩm, do trigger cập nhật (không để người dùng ghi)
alter table public.products add column search_text text not null default '';

create or replace function private.products_search_text()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.search_text := private.vn_unaccent(concat_ws(' ',
    new.name, new.brand_name, private.product_search_labels(new.category, new.product_type),
    array_to_string(new.key_ingredients, ' '), new.texture, new.size));
  return new;
end;
$$;

create trigger products_search_text before insert or update of name, brand_name, category, product_type, key_ingredients, texture, size
  on public.products for each row execute function private.products_search_text();

-- Cập nhật cho dữ liệu đã có (không đổi updated_at)
alter table public.products disable trigger products_touch_updated_at;
update public.products set search_text = private.vn_unaccent(concat_ws(' ',
  name, brand_name, private.product_search_labels(category, product_type),
  array_to_string(key_ingredients, ' '), texture, size));
alter table public.products enable trigger products_touch_updated_at;

revoke execute on function private.products_search_text() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. TÌM KIẾM, LỌC, SẮP XẾP, PHÂN TRANG
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER để dùng hàm chuẩn hóa trong schema private; điều kiện WHERE chỉ trả hàng công khai
-- (status = 'active' và shop công khai), nên không lộ bản nháp hay shop chưa duyệt.
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
      and public.is_shop_public(p.shop_id)
      and (p_category is null or p.category = p_category)
      and (p_types is null or cardinality(p_types) = 0 or p.product_type = any (p_types))
      and (p_shop_id is null or p.shop_id = p_shop_id)
      and (p_min_price is null or coalesce(p.sale_price, p.price) >= p_min_price)
      and (p_max_price is null or coalesce(p.sale_price, p.price) <= p_max_price)
      and (p_skin_type is null or cardinality(p.skin_types) = 0 or p_skin_type = any (p.skin_types))
      -- Mỗi từ khóa phải khớp phần đầu của một từ trong sản phẩm ("kem" khớp "kem", không khớp "skem")
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

revoke execute on function public.search_products(text, text, text[], uuid, integer, integer, text, text, integer, integer) from public;
grant execute on function public.search_products(text, text, text[], uuid, integer, integer, text, text, integer, integer) to anon, authenticated;
revoke execute on function private.vn_unaccent(text), private.product_search_labels(text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. SỔ ĐỊA CHỈ
-- -----------------------------------------------------------------------------
create table public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label          text not null default '' check (char_length(label) <= 30),
  recipient_name text not null check (char_length(btrim(recipient_name)) between 2 and 80),
  phone          text not null check (phone ~ '^\+?[0-9]{9,15}$'),
  province       text not null check (char_length(btrim(province)) between 2 and 60),
  district       text not null check (char_length(btrim(district)) between 2 and 60),
  ward           text not null default '' check (char_length(ward) <= 60),
  street         text not null check (char_length(btrim(street)) between 3 and 200),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

create trigger addresses_touch_updated_at before update on public.addresses
  for each row execute function private.touch_updated_at();

-- Tối đa 10 địa chỉ; địa chỉ đầu tiên tự thành mặc định; chọn mặc định mới thì bỏ mặc định cũ
create or replace function private.addresses_rules()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses a where a.user_id = new.user_id) >= 10 then
      raise exception 'Mỗi tài khoản lưu tối đa 10 địa chỉ.' using errcode = '23514';
    end if;
    if not exists (select 1 from public.addresses a where a.user_id = new.user_id) then
      new.is_default := true;
    end if;
  end if;
  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.addresses set is_default = false where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger addresses_rules before insert or update of is_default on public.addresses
  for each row execute function private.addresses_rules();

-- Xóa địa chỉ mặc định: địa chỉ mới nhất còn lại thành mặc định
create or replace function private.addresses_after_delete()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.is_default then
    update public.addresses set is_default = true
     where id = (select a.id from public.addresses a where a.user_id = old.user_id order by a.created_at desc limit 1);
  end if;
  return old;
end;
$$;

create trigger addresses_after_delete after delete on public.addresses
  for each row execute function private.addresses_after_delete();

revoke execute on function private.addresses_rules(), private.addresses_after_delete() from public, anon, authenticated;

revoke all on public.addresses from anon, authenticated;
alter table public.addresses enable row level security;

grant select, delete on public.addresses to authenticated;
grant insert (label, recipient_name, phone, province, district, ward, street, is_default) on public.addresses to authenticated;
grant update (label, recipient_name, phone, province, district, ward, street, is_default) on public.addresses to authenticated;

create policy addresses_select_own on public.addresses for select to authenticated
  using (user_id = auth.uid());
create policy addresses_insert_own on public.addresses for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy addresses_update_own on public.addresses for update to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid());
create policy addresses_delete_own on public.addresses for delete to authenticated
  using (user_id = auth.uid() and public.is_active_user());

-- -----------------------------------------------------------------------------
-- 4. GIỎ HÀNG THEO TÀI KHOẢN
-- -----------------------------------------------------------------------------
create table public.cart_items (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity   smallint not null check (quantity between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create trigger cart_items_touch_updated_at before update on public.cart_items
  for each row execute function private.touch_updated_at();

-- Tối đa 50 dòng mỗi giỏ (chống ghi rác)
create or replace function private.cart_items_limit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.cart_items c where c.user_id = new.user_id) >= 50 then
    raise exception 'Giỏ hàng tối đa 50 sản phẩm khác nhau.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger cart_items_limit before insert on public.cart_items
  for each row execute function private.cart_items_limit();
revoke execute on function private.cart_items_limit() from public, anon, authenticated;

revoke all on public.cart_items from anon, authenticated;
alter table public.cart_items enable row level security;

grant select, delete on public.cart_items to authenticated;
grant insert (product_id, quantity) on public.cart_items to authenticated;
grant update (quantity) on public.cart_items to authenticated;

create policy cart_items_select_own on public.cart_items for select to authenticated
  using (user_id = auth.uid());
create policy cart_items_insert_own on public.cart_items for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user() and public.is_product_public(product_id));
create policy cart_items_update_own on public.cart_items for update to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid());
create policy cart_items_delete_own on public.cart_items for delete to authenticated
  using (user_id = auth.uid());

-- Đặt số lượng 1 sản phẩm trong giỏ (0 = xóa). Số lượng tự giới hạn theo tồn kho và tối đa 10.
-- SECURITY INVOKER: quyền và RLS của người gọi vẫn áp dụng.
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
   where p.id = p_product_id and p.status = 'active' and public.is_shop_public(p.shop_id);
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

-- Gộp giỏ trên trình duyệt (khi chưa đăng nhập) vào giỏ của tài khoản. p_items: [{"product_id": "...", "quantity": 2}]
-- Sản phẩm đã có trong giỏ: cộng dồn (tối đa 10 và tồn kho). Sản phẩm không còn bán: bỏ qua.
create or replace function public.cart_merge(p_items jsonb)
returns setof public.cart_items
language plpgsql set search_path = ''
as $$
declare
  v_item jsonb;
  v_pid  uuid;
  v_qty  integer;
  v_cur  integer;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) <= 50 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      begin
        v_pid := (v_item ->> 'product_id')::uuid;
        v_qty := (v_item ->> 'quantity')::integer;
      exception when others then
        continue;
      end;
      continue when v_pid is null or v_qty is null or v_qty <= 0;
      select c.quantity into v_cur from public.cart_items c where c.user_id = auth.uid() and c.product_id = v_pid;
      begin
        perform public.cart_set_item(v_pid, coalesce(v_cur, 0) + v_qty);
      exception when sqlstate 'P0002' or sqlstate '23514' then
        null; -- sản phẩm không còn bán hoặc giỏ đã đầy: bỏ qua
      end;
    end loop;
  end if;
  return query select * from public.cart_items c where c.user_id = auth.uid() order by c.updated_at;
end;
$$;

revoke execute on function public.cart_set_item(uuid, integer), public.cart_merge(jsonb) from public, anon;
grant execute on function public.cart_set_item(uuid, integer), public.cart_merge(jsonb) to authenticated;
