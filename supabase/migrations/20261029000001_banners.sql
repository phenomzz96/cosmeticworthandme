-- =============================================================================
-- Worth & Me — Migration 006: Banner trang chủ (Giai đoạn 5, Admin quản lý)
--
-- Chạy SAU migration 001..005. Một lần, trong Supabase SQL Editor.
--
-- Quy tắc:
--   * Chỉ Admin thêm/sửa/xóa banner; mọi thay đổi ghi vào nhật ký quản trị.
--   * Khách chỉ thấy banner đang bật và trong khoảng thời gian hiển thị (nếu có đặt).
--   * Ảnh banner nằm trong bucket 'brand', thư mục banner/ (PNG/JPG/WebP ≤ 2 MB).
--   * Liên kết của banner chỉ trỏ tới trang trong website (bắt đầu bằng "/"),
--     tránh dùng banner để dẫn khách sang trang lừa đảo bên ngoài.
--   * Tối đa 10 banner.
-- =============================================================================

create table public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) between 2 and 80),
  subtitle   text not null default '' check (char_length(subtitle) <= 160),
  image_path text not null check (image_path ~ '^banner/[A-Za-z0-9._-]{1,120}$'),
  link_url   text not null default '/products' check (link_url ~ '^/[A-Za-z0-9/_?=&%.,~+-]*$' and char_length(link_url) <= 300 and link_url !~ '^//'),
  sort_order smallint not null default 0 check (sort_order between 0 and 100),
  is_active  boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create trigger banners_touch_updated_at before update on public.banners
  for each row execute function private.touch_updated_at();

create or replace function private.banners_limit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.banners) >= 10 then
    raise exception 'Tối đa 10 banner. Xóa bớt banner cũ trước khi thêm.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger banners_limit before insert on public.banners
  for each row execute function private.banners_limit();

-- Ghi nhật ký mọi thay đổi banner
create or replace function private.banners_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.log_action(
    case tg_op when 'INSERT' then 'banner.create' when 'UPDATE' then 'banner.update' else 'banner.delete' end,
    'banner', coalesce(new.id, old.id)::text,
    jsonb_build_object('title', coalesce(new.title, old.title), 'is_active', coalesce(new.is_active, old.is_active)));
  return coalesce(new, old);
end;
$$;

create trigger banners_audit after insert or update or delete on public.banners
  for each row execute function private.banners_audit();

revoke execute on function private.banners_limit(), private.banners_audit() from public, anon, authenticated;

revoke all on public.banners from anon, authenticated;
alter table public.banners enable row level security;

grant select on public.banners to anon, authenticated;
grant insert (title, subtitle, image_path, link_url, sort_order, is_active, starts_at, ends_at) on public.banners to authenticated;
grant update (title, subtitle, image_path, link_url, sort_order, is_active, starts_at, ends_at) on public.banners to authenticated;
grant delete on public.banners to authenticated;

create policy banners_select on public.banners for select to anon, authenticated
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin());
create policy banners_insert_admin on public.banners for insert to authenticated with check (public.is_admin());
create policy banners_update_admin on public.banners for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy banners_delete_admin on public.banners for delete to authenticated using (public.is_admin());

-- Cho Admin tải ảnh banner vào bucket 'brand' (thư mục banner/)
drop policy brand_objects_insert_admin on storage.objects;
drop policy brand_objects_update_admin on storage.objects;

create policy brand_objects_insert_admin
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('logo-light', 'logo-dark', 'favicon', 'banner')
  );

create policy brand_objects_update_admin
  on storage.objects for update to authenticated
  using (bucket_id = 'brand' and public.is_admin())
  with check (
    bucket_id = 'brand'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('logo-light', 'logo-dark', 'favicon', 'banner')
  );
