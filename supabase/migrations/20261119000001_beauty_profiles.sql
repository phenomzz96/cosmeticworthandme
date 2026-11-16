-- =============================================================================
-- Migration 014 — Hồ sơ làm đẹp (Beauty Finder)
--
-- Khách đã đăng nhập lưu câu trả lời Beauty Finder vào tài khoản để dùng lại trên mọi thiết bị.
-- Chỉ chủ tài khoản đọc / sửa / xóa được hồ sơ của mình (Admin cũng không đọc — không cần cho vận hành).
-- Hồ sơ chỉ là lựa chọn mua sắm do khách tự chọn (loại da, mối quan tâm, ngân sách...), không phải dữ liệu y tế.
-- Chạy SAU migration 013.
-- =============================================================================

create table public.beauty_profiles (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  answers    jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 4096),
  updated_at timestamptz not null default now()
);

alter table public.beauty_profiles enable row level security;
revoke all on public.beauty_profiles from anon, authenticated;
grant select, delete on public.beauty_profiles to authenticated;

create policy beauty_profiles_select_own on public.beauty_profiles for select to authenticated using (user_id = auth.uid());
create policy beauty_profiles_delete_own on public.beauty_profiles for delete to authenticated using (user_id = auth.uid());

-- Lưu / cập nhật hồ sơ của chính mình (user_id lấy từ phiên đăng nhập, không nhận từ trình duyệt)
create or replace function public.save_beauty_profile(p_answers jsonb)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để lưu hồ sơ làm đẹp.' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 4096 then
    raise exception 'Hồ sơ không hợp lệ.' using errcode = '22023';
  end if;
  insert into public.beauty_profiles (user_id, answers, updated_at) values (auth.uid(), p_answers, now())
  on conflict (user_id) do update set answers = excluded.answers, updated_at = now()
  returning updated_at into v_at;
  return v_at;
end;
$$;

revoke execute on function public.save_beauty_profile(jsonb) from public, anon;
grant execute on function public.save_beauty_profile(jsonb) to authenticated;
