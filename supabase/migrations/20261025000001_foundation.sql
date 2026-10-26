-- =============================================================================
-- Worth & Me — Migration 001: Nền tảng tài khoản, phân quyền, cài đặt thương hiệu
-- Giai đoạn 1A
--
-- Cách chạy: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Chạy MỘT lần trên project mới. Không chứa mật khẩu hay khóa bí mật nào.
--
-- Nguyên tắc bảo mật:
--   * Mọi bảng bật Row Level Security (RLS). Không có policy = không ai truy cập.
--   * Người dùng chỉ được sửa vài cột an toàn của chính mình (họ tên, SĐT, avatar).
--     Cột role/status KHÔNG cấp quyền UPDATE cho trình duyệt.
--   * Thao tác quản trị đi qua hàm SECURITY DEFINER, kiểm tra quyền bên trong hàm,
--     và luôn ghi audit log.
-- =============================================================================

-- Schema riêng cho hàm nội bộ: không được API (PostgREST) công khai ra ngoài.
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- 1. KIỂU DỮ LIỆU
-- -----------------------------------------------------------------------------
-- customer: mặc định khi đăng ký
-- seller:   được hệ thống gán khi Admin duyệt shop (Giai đoạn 2)
-- admin:    quản trị viên
-- super_admin: quản trị cấp cao, chỉ khởi tạo bằng bootstrap_super_admin()
create type public.user_role as enum ('customer', 'seller', 'admin', 'super_admin');
create type public.account_status as enum ('active', 'suspended');

-- -----------------------------------------------------------------------------
-- 2. HỒ SƠ NGƯỜI DÙNG
-- -----------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text,
  full_name        text not null default '' check (char_length(full_name) <= 100),
  phone            text check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  avatar_url       text check (avatar_url is null or char_length(avatar_url) <= 500),
  role             public.user_role not null default 'customer',
  status           public.account_status not null default 'active',
  suspended_reason text,
  suspended_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Hồ sơ người dùng, 1-1 với auth.users. Role/status chỉ đổi qua hàm quản trị.';

create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

-- -----------------------------------------------------------------------------
-- 3. NHẬT KÝ THAO TÁC QUẢN TRỊ
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null check (char_length(action) between 1 and 80),
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

-- -----------------------------------------------------------------------------
-- 4. CÀI ĐẶT WEBSITE (một dòng duy nhất) + LỊCH SỬ ĐỂ KHÔI PHỤC
-- -----------------------------------------------------------------------------
-- Ảnh lưu trong bucket 'brand'. Bảng chỉ lưu ĐƯỜNG DẪN trong bucket, không lưu URL
-- tùy ý, để không ai chèn được ảnh từ website bên ngoài.
create table public.site_settings (
  id              smallint primary key default 1 check (id = 1),
  brand_name      text not null check (char_length(btrim(brand_name)) between 1 and 60),
  logo_light_path text check (logo_light_path is null or logo_light_path ~ '^logo-light/[A-Za-z0-9._-]{1,120}$'),
  logo_dark_path  text check (logo_dark_path  is null or logo_dark_path  ~ '^logo-dark/[A-Za-z0-9._-]{1,120}$'),
  favicon_path    text check (favicon_path    is null or favicon_path    ~ '^favicon/[A-Za-z0-9._-]{1,120}$'),
  primary_color   text not null default '#79628e' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Phí vận chuyển cố định cho mỗi đơn con (VND). 0 = miễn phí.
  shipping_fee    integer not null default 30000 check (shipping_fee between 0 and 1000000),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null
);

insert into public.site_settings (id, brand_name) values (1, 'Worth & Me');

create table public.site_settings_history (
  id         bigint generated always as identity primary key,
  snapshot   jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index site_settings_history_changed_idx on public.site_settings_history (changed_at desc);

-- -----------------------------------------------------------------------------
-- 5. HÀM KIỂM TRA QUYỀN (dùng trong policy)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER để đọc profiles mà không bị RLS của chính profiles chặn (tránh đệ quy).
create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role = 'super_admin'
  );
$$;

-- Ghi audit log. Nằm trong schema private: trình duyệt không gọi trực tiếp được.
create or replace function private.log_action(
  p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;

-- -----------------------------------------------------------------------------
-- 6. TRIGGER
-- -----------------------------------------------------------------------------
-- Tạo hồ sơ khi có người đăng ký. Role luôn là customer, bất kể dữ liệu gửi lên.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Đồng bộ email khi người dùng đổi email.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 7. QUYỀN TRUY CẬP BẢNG (GRANT) + ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
-- Supabase mặc định cấp mọi quyền cho anon/authenticated trên bảng mới.
-- Thu hồi hết rồi cấp lại đúng những gì cần.
revoke all on public.profiles, public.audit_logs, public.site_settings, public.site_settings_history
  from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_settings_history enable row level security;

-- profiles: xem của mình, Admin xem tất cả. Chỉ sửa 3 cột an toàn của chính mình.
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

create policy profiles_select_own_or_admin
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_when_active
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());

-- audit_logs: chỉ Admin đọc. Không ai ghi trực tiếp (chỉ qua hàm).
grant select on public.audit_logs to authenticated;

create policy audit_logs_select_admin
  on public.audit_logs for select to authenticated
  using (public.is_admin());

-- site_settings: ai cũng đọc (kể cả khách chưa đăng nhập). Sửa chỉ qua hàm.
grant select on public.site_settings to anon, authenticated;

create policy site_settings_select_all
  on public.site_settings for select to anon, authenticated
  using (true);

-- site_settings_history: chỉ Admin đọc.
grant select on public.site_settings_history to authenticated;

create policy site_settings_history_select_admin
  on public.site_settings_history for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 8. HÀM QUẢN TRỊ: CÀI ĐẶT THƯƠNG HIỆU
-- -----------------------------------------------------------------------------
create or replace function private.settings_snapshot()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'brand_name', s.brand_name,
    'logo_light_path', s.logo_light_path,
    'logo_dark_path', s.logo_dark_path,
    'favicon_path', s.favicon_path,
    'primary_color', s.primary_color,
    'shipping_fee', s.shipping_fee
  )
  from public.site_settings s where s.id = 1;
$$;

create or replace function public.update_site_settings(
  p_brand_name text,
  p_logo_light_path text,
  p_logo_dark_path text,
  p_favicon_path text,
  p_primary_color text,
  p_shipping_fee integer
)
returns public.site_settings
language plpgsql security definer set search_path = ''
as $$
declare
  v_before jsonb;
  v_row public.site_settings;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền thay đổi cài đặt website.' using errcode = '42501';
  end if;

  v_before := private.settings_snapshot();
  insert into public.site_settings_history (snapshot, changed_by) values (v_before, auth.uid());

  update public.site_settings set
    brand_name      = btrim(p_brand_name),
    logo_light_path = nullif(btrim(p_logo_light_path), ''),
    logo_dark_path  = nullif(btrim(p_logo_dark_path), ''),
    favicon_path    = nullif(btrim(p_favicon_path), ''),
    primary_color   = lower(p_primary_color),
    shipping_fee    = p_shipping_fee,
    updated_at      = now(),
    updated_by      = auth.uid()
  where id = 1
  returning * into v_row;

  perform private.log_action('site_settings.update', 'site_settings', '1',
    jsonb_build_object('before', v_before, 'after', private.settings_snapshot()));

  return v_row;
end;
$$;

create or replace function public.restore_site_settings(p_history_id bigint)
returns public.site_settings
language plpgsql security definer set search_path = ''
as $$
declare
  v_snap jsonb;
  v_row public.site_settings;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền khôi phục cài đặt website.' using errcode = '42501';
  end if;

  select h.snapshot into v_snap from public.site_settings_history h where h.id = p_history_id;
  if v_snap is null then
    raise exception 'Không tìm thấy phiên bản cài đặt %.', p_history_id using errcode = 'P0002';
  end if;

  insert into public.site_settings_history (snapshot, changed_by)
  values (private.settings_snapshot(), auth.uid());

  update public.site_settings set
    brand_name      = v_snap ->> 'brand_name',
    logo_light_path = v_snap ->> 'logo_light_path',
    logo_dark_path  = v_snap ->> 'logo_dark_path',
    favicon_path    = v_snap ->> 'favicon_path',
    primary_color   = v_snap ->> 'primary_color',
    shipping_fee    = (v_snap ->> 'shipping_fee')::integer,
    updated_at      = now(),
    updated_by      = auth.uid()
  where id = 1
  returning * into v_row;

  perform private.log_action('site_settings.restore', 'site_settings', '1',
    jsonb_build_object('history_id', p_history_id, 'restored', v_snap));

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. KHỞI TẠO SUPER ADMIN (chạy tay MỘT lần trong SQL Editor)
-- -----------------------------------------------------------------------------
-- Điều kiện: tài khoản đã đăng ký VÀ đã xác minh email.
-- Chỉ được dùng khi hệ thống chưa có Super Admin nào (hoặc gọi lại cho chính người đó).
-- Trình duyệt KHÔNG gọi được hàm này (đã thu hồi quyền EXECUTE bên dưới).
create or replace function public.bootstrap_super_admin(p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid;
  v_confirmed timestamptz;
  v_existing uuid;
begin
  select u.id, u.email_confirmed_at into v_user_id, v_confirmed
  from auth.users u where lower(u.email) = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'Chưa có tài khoản đăng ký với email %. Hãy đăng ký trên website trước.', p_email;
  end if;
  if v_confirmed is null then
    raise exception 'Email % chưa được xác minh. Hãy xác minh email trước.', p_email;
  end if;

  select p.id into v_existing from public.profiles p
  where p.role = 'super_admin' and p.id <> v_user_id limit 1;
  if v_existing is not null then
    raise exception 'Hệ thống đã có Super Admin. Việc cấp quyền tiếp theo phải do Super Admin thực hiện.';
  end if;

  update public.profiles
     set role = 'super_admin', status = 'active', suspended_reason = null, suspended_at = null
   where id = v_user_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (null, 'bootstrap_super_admin', 'profile', v_user_id::text, jsonb_build_object('email', p_email));

  return 'Đã cấp quyền Super Admin cho ' || p_email;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
-- Postgres mặc định cho PUBLIC gọi mọi hàm: thu hồi rồi cấp lại có chủ đích.
revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function public.bootstrap_super_admin(text) from public, anon, authenticated;

revoke execute on function public.update_site_settings(text, text, text, text, text, integer) from public, anon;
revoke execute on function public.restore_site_settings(bigint) from public, anon;
grant execute on function public.update_site_settings(text, text, text, text, text, integer) to authenticated;
grant execute on function public.restore_site_settings(bigint) to authenticated;

grant execute on function public.is_admin(), public.is_super_admin(), public.is_active_user()
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 11. STORAGE: BUCKET 'brand' (logo, favicon)
-- -----------------------------------------------------------------------------
-- Công khai để mọi người xem được logo. Tối đa 2 MB, chỉ PNG/JPEG/WebP
-- (không nhận SVG vì SVG có thể chứa mã script).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy brand_objects_select_all
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'brand');

create policy brand_objects_insert_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('logo-light', 'logo-dark', 'favicon')
  );

create policy brand_objects_update_admin
  on storage.objects for update to authenticated
  using (bucket_id = 'brand' and public.is_admin())
  with check (
    bucket_id = 'brand'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('logo-light', 'logo-dark', 'favicon')
  );

create policy brand_objects_delete_admin
  on storage.objects for delete to authenticated
  using (bucket_id = 'brand' and public.is_admin());
