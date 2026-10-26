-- =============================================================================
-- Worth & Me — Migration 003: Cửa hàng, sản phẩm, ảnh (Giai đoạn 2)
--
-- Chạy SAU migration 001, 002. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc nghiệp vụ:
--   * Mỗi tài khoản mở tối đa 1 shop. Shop mới ở trạng thái 'pending' (chờ duyệt).
--   * Admin duyệt → 'active' (chủ shop thành 'seller'), từ chối → 'rejected' (kèm lý do),
--     tạm ngưng → 'suspended' (kèm lý do). Shop bị từ chối sửa lại rồi gửi duyệt lại.
--   * Chủ shop chỉ quản lý shop và sản phẩm của chính mình. Không tự đổi trạng thái shop.
--   * Khách chỉ thấy sản phẩm 'active' của shop 'active' mà chủ shop không bị khóa.
--   * Sản phẩm chỉ được đăng (active) khi có ít nhất 1 ảnh. Tối đa 8 ảnh.
--   * Chỉ xóa hẳn được sản phẩm nháp; sản phẩm đã đăng thì ẩn hoặc ngừng kinh doanh.
--   * Giá, giá khuyến mãi, tồn kho không được âm hay vô lý (database kiểm tra).
--   * Điểm đánh giá, lượt bán, "nổi bật" do hệ thống quản lý, chủ shop không sửa được.
-- =============================================================================

create type public.shop_status as enum ('pending', 'active', 'rejected', 'suspended');
create type public.product_status as enum ('draft', 'active', 'hidden', 'discontinued');

-- -----------------------------------------------------------------------------
-- 1. CỬA HÀNG
-- -----------------------------------------------------------------------------
create table public.shops (
  id            uuid primary key default gen_random_uuid(),
  -- null = shop mẫu do hệ thống tạo (dữ liệu demo), Admin quản lý
  owner_id      uuid unique references public.profiles (id) on delete set null,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name          text not null check (char_length(btrim(name)) between 2 and 80),
  tagline       text not null default '' check (char_length(tagline) <= 120),
  description   text not null default '' check (char_length(description) <= 2000),
  logo_path     text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  cover_path    text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  theme_color   text not null default '#79628e' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email text check (contact_email is null or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9]{9,15}$'),
  location      text not null default '' check (char_length(location) <= 80),
  policy        text not null default '' check (char_length(policy) <= 3000),
  status        public.shop_status not null default 'pending',
  status_reason text,
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  -- Chỉ số hiển thị (hệ thống cập nhật, chủ shop không sửa được)
  rating        numeric(2, 1) not null default 0 check (rating between 0 and 5),
  follower_count integer not null default 0 check (follower_count >= 0),
  verified      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Tên shop không trùng (không phân biệt hoa/thường)
create unique index shops_name_unique on public.shops (lower(btrim(name)));
create index shops_status_idx on public.shops (status);

comment on table public.shops is 'Cửa hàng. Trạng thái chỉ đổi qua hàm admin_set_shop_status / resubmit_shop.';

-- -----------------------------------------------------------------------------
-- 2. SẢN PHẨM
-- -----------------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 140),
  name            text not null check (char_length(btrim(name)) between 2 and 150),
  brand_name      text not null check (char_length(btrim(brand_name)) between 1 and 80),
  category        text not null check (category in ('skincare', 'makeup', 'haircare', 'body-care', 'beauty-tools')),
  product_type    text not null check (product_type in (
                    'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask', 'eye-care',
                    'foundation', 'cushion', 'lipstick', 'mascara', 'blush',
                    'shampoo', 'conditioner', 'hair-oil',
                    'body-wash', 'body-lotion', 'hand-cream',
                    'brush', 'sponge', 'facial-device')),
  description     text not null default '' check (char_length(description) <= 5000),
  -- Giá bán gốc và giá khuyến mãi (VND). Giá khuyến mãi phải thấp hơn giá gốc.
  price           integer not null check (price between 1000 and 100000000),
  sale_price      integer check (sale_price is null or (sale_price >= 1000 and sale_price < price)),
  sku             text check (sku is null or char_length(sku) between 1 and 60),
  stock           integer not null default 0 check (stock between 0 and 100000),
  status          public.product_status not null default 'draft',
  size            text not null default '' check (char_length(size) <= 40),
  skin_types      text[] not null default '{}' check (skin_types <@ array['oily', 'dry', 'combination', 'normal', 'sensitive']),
  concerns        text[] not null default '{}' check (concerns <@ array['acne', 'dark-spots', 'aging', 'dehydration', 'pores', 'dullness', 'redness', 'sun-protection']),
  key_ingredients text[] not null default '{}' check (cardinality(key_ingredients) <= 10),
  texture         text check (texture is null or char_length(texture) <= 60),
  fragrance_free  boolean,
  -- Hình minh họa cho dữ liệu demo chưa có ảnh thật (hệ thống quản lý)
  placeholder_visual jsonb,
  rating          numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count    integer not null default 0 check (review_count >= 0),
  sold_count      integer not null default 0 check (sold_count >= 0),
  featured        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index products_shop_idx on public.products (shop_id);
create index products_status_idx on public.products (status);
create index products_category_idx on public.products (category);
create unique index products_shop_sku_unique on public.products (shop_id, sku) where sku is not null;

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path       text not null check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  sort_order smallint not null default 0 check (sort_order between 0 and 50),
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- -----------------------------------------------------------------------------
-- 3. HÀM KIỂM TRA QUYỀN (dùng trong policy, phải ở schema public để policy gọi được)
-- -----------------------------------------------------------------------------
-- Shop hiển thị công khai: đang hoạt động và chủ shop (nếu có) không bị khóa
create or replace function public.is_shop_public(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    left join public.profiles o on o.id = s.owner_id
    where s.id = p_shop_id
      and s.status = 'active'
      and (s.owner_id is null or o.status = 'active')
  );
$$;

-- Người gọi là chủ shop (bất kể trạng thái) — để xem dữ liệu của mình
create or replace function public.owns_shop(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.shops s where s.id = p_shop_id and s.owner_id = auth.uid());
$$;

-- Người gọi được quản lý sản phẩm của shop: là chủ shop, tài khoản đang hoạt động,
-- shop đang chờ duyệt hoặc đang hoạt động (shop bị từ chối/tạm ngưng thì chỉ xem)
create or replace function public.can_manage_shop(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.owner_id = auth.uid() and s.status in ('pending', 'active')
  );
$$;

create or replace function public.product_shop(p_product_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select p.shop_id from public.products p where p.id = p_product_id $$;

create or replace function public.is_product_public(p_product_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id and p.status = 'active' and public.is_shop_public(p.shop_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. TRIGGER KIỂM TRA DỮ LIỆU
-- -----------------------------------------------------------------------------
create trigger shops_touch_updated_at before update on public.shops
  for each row execute function private.touch_updated_at();
create trigger products_touch_updated_at before update on public.products
  for each row execute function private.touch_updated_at();

-- Ảnh logo/bìa phải nằm trong thư mục của chính shop đó
create or replace function private.check_shop_paths()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.id::text then
    raise exception 'Ảnh logo không thuộc cửa hàng này.' using errcode = '23514';
  end if;
  if new.cover_path is not null and split_part(new.cover_path, '/', 1) <> new.id::text then
    raise exception 'Ảnh bìa không thuộc cửa hàng này.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger shops_check_paths before insert or update on public.shops
  for each row execute function private.check_shop_paths();

-- Ảnh sản phẩm: đúng thư mục của shop, tối đa 8 ảnh mỗi sản phẩm
create or replace function private.check_product_image()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select p.shop_id into v_shop from public.products p where p.id = new.product_id;
  if split_part(new.path, '/', 1) <> v_shop::text then
    raise exception 'Ảnh không thuộc cửa hàng của sản phẩm này.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.product_images i where i.product_id = new.product_id) >= 8 then
    raise exception 'Mỗi sản phẩm tối đa 8 ảnh.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger product_images_check before insert or update on public.product_images
  for each row execute function private.check_product_image();

-- Chỉ đăng bán khi có ảnh (dữ liệu demo dùng hình minh họa thay thế)
create or replace function private.check_product_publish()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active')
     and new.placeholder_visual is null
     and not exists (select 1 from public.product_images i where i.product_id = new.id) then
    raise exception 'Thêm ít nhất 1 ảnh trước khi đăng bán sản phẩm.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger products_check_publish before insert or update of status on public.products
  for each row execute function private.check_product_publish();

-- Không xóa ảnh cuối cùng của sản phẩm đang bán
create or replace function private.keep_last_image()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.products p where p.id = old.product_id and p.status = 'active' and p.placeholder_visual is null)
     and (select count(*) from public.product_images i where i.product_id = old.product_id) <= 1 then
    raise exception 'Sản phẩm đang bán phải còn ít nhất 1 ảnh. Hãy ẩn sản phẩm trước.' using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger product_images_keep_last before delete on public.product_images
  for each row execute function private.keep_last_image();

-- -----------------------------------------------------------------------------
-- 5. QUYỀN TRUY CẬP + RLS
-- -----------------------------------------------------------------------------
revoke all on public.shops, public.products, public.product_images from anon, authenticated;

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- shops
grant select on public.shops to anon, authenticated;
grant insert (owner_id, name, slug, tagline, description, contact_email, contact_phone, location, policy, theme_color)
  on public.shops to authenticated;
grant update (name, tagline, description, logo_path, cover_path, contact_email, contact_phone, location, policy, theme_color)
  on public.shops to authenticated;

create policy shops_select_public on public.shops for select to anon, authenticated
  using (public.is_shop_public(id) or owner_id = auth.uid() or public.is_admin());

create policy shops_insert_own on public.shops for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user());

create policy shops_update_own on public.shops for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user() and status in ('pending', 'active', 'rejected'))
  with check (owner_id = auth.uid());

-- products
grant select on public.products to anon, authenticated;
grant insert (shop_id, slug, name, brand_name, category, product_type, description, price, sale_price, sku, stock,
              status, size, skin_types, concerns, key_ingredients, texture, fragrance_free)
  on public.products to authenticated;
grant update (name, brand_name, category, product_type, description, price, sale_price, sku, stock,
              status, size, skin_types, concerns, key_ingredients, texture, fragrance_free)
  on public.products to authenticated;
grant delete on public.products to authenticated;

create policy products_select on public.products for select to anon, authenticated
  using ((status = 'active' and public.is_shop_public(shop_id)) or public.owns_shop(shop_id) or public.is_admin());

create policy products_insert_own on public.products for insert to authenticated
  with check (public.can_manage_shop(shop_id));

create policy products_update_own on public.products for update to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

create policy products_delete_draft on public.products for delete to authenticated
  using (public.can_manage_shop(shop_id) and status = 'draft');

-- product_images
grant select on public.product_images to anon, authenticated;
grant insert (product_id, path, sort_order) on public.product_images to authenticated;
grant update (sort_order) on public.product_images to authenticated;
grant delete on public.product_images to authenticated;

create policy product_images_select on public.product_images for select to anon, authenticated
  using (public.is_product_public(product_id) or public.owns_shop(public.product_shop(product_id)) or public.is_admin());

create policy product_images_write_own on public.product_images for insert to authenticated
  with check (public.can_manage_shop(public.product_shop(product_id)));

create policy product_images_update_own on public.product_images for update to authenticated
  using (public.can_manage_shop(public.product_shop(product_id)))
  with check (public.can_manage_shop(public.product_shop(product_id)));

create policy product_images_delete_own on public.product_images for delete to authenticated
  using (public.can_manage_shop(public.product_shop(product_id)));

-- -----------------------------------------------------------------------------
-- 6. HÀM: CHỦ SHOP GỬI DUYỆT LẠI, ADMIN DUYỆT / TỪ CHỐI / TẠM NGƯNG
-- -----------------------------------------------------------------------------
create or replace function public.resubmit_shop()
returns public.shops
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.shops;
begin
  if not public.is_active_user() then
    raise exception 'Tài khoản của bạn đang bị khóa.' using errcode = '42501';
  end if;
  update public.shops
     set status = 'pending', status_reason = null, reviewed_by = null, reviewed_at = null
   where owner_id = auth.uid() and status = 'rejected'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Chỉ gửi duyệt lại được khi cửa hàng đang ở trạng thái bị từ chối.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_set_shop_status(
  p_shop_id uuid,
  p_status  public.shop_status,
  p_reason  text default null
)
returns public.shops
language plpgsql security definer set search_path = ''
as $$
declare
  v_shop   public.shops;
  v_reason text := nullif(btrim(p_reason), '');
  v_row    public.shops;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền duyệt cửa hàng.' using errcode = '42501';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for update;
  if v_shop.id is null then
    raise exception 'Không tìm thấy cửa hàng.' using errcode = 'P0002';
  end if;
  if v_shop.owner_id = auth.uid() then
    raise exception 'Bạn không thể tự duyệt cửa hàng của chính mình.' using errcode = '42501';
  end if;

  -- Các chuyển trạng thái hợp lệ
  if not (
       (v_shop.status = 'pending'   and p_status in ('active', 'rejected'))
    or (v_shop.status = 'active'    and p_status = 'suspended')
    or (v_shop.status = 'suspended' and p_status = 'active')
  ) then
    raise exception 'Không thể chuyển cửa hàng từ trạng thái % sang %.', v_shop.status, p_status using errcode = '22023';
  end if;

  if p_status in ('rejected', 'suspended') and (v_reason is null or char_length(v_reason) < 5) then
    raise exception 'Hãy nhập lý do (ít nhất 5 ký tự).' using errcode = '22023';
  end if;
  if char_length(coalesce(v_reason, '')) > 500 then
    raise exception 'Lý do tối đa 500 ký tự.' using errcode = '22023';
  end if;

  update public.shops set
    status        = p_status,
    status_reason = case when p_status in ('rejected', 'suspended') then v_reason else null end,
    reviewed_by   = auth.uid(),
    reviewed_at   = now()
  where id = p_shop_id
  returning * into v_row;

  -- Duyệt shop: chủ shop thành người bán (không hạ quyền admin)
  if p_status = 'active' and v_shop.owner_id is not null then
    update public.profiles set role = 'seller' where id = v_shop.owner_id and role = 'customer';
  end if;

  perform private.log_action(
    case p_status when 'active' then (case when v_shop.status = 'suspended' then 'shop.reactivate' else 'shop.approve' end)
                  when 'rejected' then 'shop.reject'
                  else 'shop.suspend' end,
    'shop', p_shop_id::text,
    jsonb_build_object('name', v_shop.name, 'reason', v_reason, 'from', v_shop.status, 'to', p_status)
  );

  return v_row;
end;
$$;

create or replace function public.admin_list_shops(
  p_status public.shop_status default null,
  p_search text default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id            uuid,
  slug          text,
  name          text,
  tagline       text,
  description   text,
  status        public.shop_status,
  status_reason text,
  owner_email   text,
  owner_status  public.account_status,
  product_count bigint,
  created_at    timestamptz,
  reviewed_at   timestamptz,
  total_count   bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pattern text;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xem danh sách cửa hàng.' using errcode = '42501';
  end if;
  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select s.id, s.slug, s.name, s.tagline, s.description, s.status, s.status_reason,
         o.email, o.status,
         (select count(*) from public.products p where p.shop_id = s.id),
         s.created_at, s.reviewed_at,
         count(*) over ()
  from public.shops s
  left join public.profiles o on o.id = s.owner_id
  where (p_status is null or s.status = p_status)
    and (v_pattern is null or s.name ilike v_pattern or s.slug ilike v_pattern or o.email ilike v_pattern)
  order by (s.status = 'pending') desc, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.check_shop_paths(), private.check_product_image(),
  private.check_product_publish(), private.keep_last_image() from public, anon, authenticated;

grant execute on function public.is_shop_public(uuid), public.is_product_public(uuid) to anon, authenticated;
grant execute on function public.owns_shop(uuid), public.can_manage_shop(uuid), public.product_shop(uuid) to anon, authenticated;

revoke execute on function public.resubmit_shop() from public, anon;
revoke execute on function public.admin_set_shop_status(uuid, public.shop_status, text) from public, anon;
revoke execute on function public.admin_list_shops(public.shop_status, text, integer, integer) from public, anon;
grant execute on function public.resubmit_shop() to authenticated;
grant execute on function public.admin_set_shop_status(uuid, public.shop_status, text) to authenticated;
grant execute on function public.admin_list_shops(public.shop_status, text, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. STORAGE: BUCKET 'shop-media' (logo, ảnh bìa shop, ảnh sản phẩm)
-- -----------------------------------------------------------------------------
-- Đường dẫn: <shop_id>/<tên tệp>. Chủ shop chỉ ghi vào thư mục shop của mình.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_write_shop_folder(p_object_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (
    public.is_active_user() and exists (
      select 1 from public.shops s
      where s.id::text = split_part(p_object_name, '/', 1)
        and s.owner_id = auth.uid()
        and s.status in ('pending', 'active', 'rejected')
    )
  );
$$;
grant execute on function public.can_write_shop_folder(text) to authenticated;

create policy shop_media_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'shop-media');

create policy shop_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-media' and public.can_write_shop_folder(name));

create policy shop_media_update on storage.objects for update to authenticated
  using (bucket_id = 'shop-media' and public.can_write_shop_folder(name))
  with check (bucket_id = 'shop-media' and public.can_write_shop_folder(name));

create policy shop_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'shop-media' and public.can_write_shop_folder(name));
