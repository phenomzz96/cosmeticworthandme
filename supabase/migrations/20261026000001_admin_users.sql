-- =============================================================================
-- Worth & Me — Migration 002: Quản trị tài khoản (Giai đoạn 1B)
--
-- Chạy SAU migration 001, một lần, trong Supabase SQL Editor.
--
-- Quy tắc nghiệp vụ:
--   * Admin và Super Admin xem được danh sách người dùng, khóa/mở khóa customer và seller.
--   * Chỉ Super Admin khóa/mở khóa Admin khác và cấp/thu hồi quyền Admin.
--   * Không ai tự khóa hoặc tự đổi quyền của chính mình.
--   * Không ai khóa, hạ quyền hay xóa Super Admin qua website.
--   * Khóa tài khoản bắt buộc nhập lý do. Mọi thao tác đều ghi audit log.
--   * Chỉ cấp quyền Admin cho tài khoản đã xác minh email và đang hoạt động.
-- =============================================================================

alter table public.profiles add column if not exists suspended_by uuid references auth.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 1. DANH SÁCH NGƯỜI DÙNG (tìm kiếm, lọc, phân trang)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search       text default null,
  p_role         public.user_role default null,
  p_status       public.account_status default null,
  p_created_from date default null,
  p_created_to   date default null,
  p_limit        integer default 20,
  p_offset       integer default 0
)
returns table (
  id               uuid,
  email            text,
  full_name        text,
  phone            text,
  role             public.user_role,
  status           public.account_status,
  suspended_reason text,
  suspended_at     timestamptz,
  created_at       timestamptz,
  email_confirmed  boolean,
  total_count      bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pattern text;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xem danh sách người dùng.' using errcode = '42501';
  end if;

  -- Thoát ký tự đặc biệt của LIKE để từ khóa như "50%" được tìm đúng nghĩa đen
  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select p.id, p.email, p.full_name, p.phone, p.role, p.status, p.suspended_reason, p.suspended_at, p.created_at,
         (u.email_confirmed_at is not null) as email_confirmed,
         count(*) over () as total_count
  from public.profiles p
  join auth.users u on u.id = p.id
  where (v_pattern is null or p.email ilike v_pattern or p.full_name ilike v_pattern or p.phone ilike v_pattern)
    and (p_role is null or p.role = p_role)
    and (p_status is null or p.status = p_status)
    and (p_created_from is null or p.created_at >= p_created_from)
    and (p_created_to is null or p.created_at < p_created_to + 1)
  order by p.created_at desc, p.id
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. KHÓA / MỞ KHÓA TÀI KHOẢN
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status  public.account_status,
  p_reason  text default null
)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.profiles;
  v_reason text := nullif(btrim(p_reason), '');
  v_row    public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền khóa hoặc mở khóa tài khoản.' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = p_user_id for update;
  if v_target.id is null then
    raise exception 'Không tìm thấy tài khoản.' using errcode = 'P0002';
  end if;
  if v_target.id = auth.uid() then
    raise exception 'Bạn không thể tự khóa hoặc mở khóa tài khoản của chính mình.' using errcode = '42501';
  end if;
  if v_target.role = 'super_admin' then
    raise exception 'Không thể khóa Super Admin.' using errcode = '42501';
  end if;
  if v_target.role = 'admin' and not public.is_super_admin() then
    raise exception 'Chỉ Super Admin được khóa hoặc mở khóa quản trị viên.' using errcode = '42501';
  end if;
  if p_status = 'suspended' and (v_reason is null or char_length(v_reason) < 5) then
    raise exception 'Hãy nhập lý do khóa (ít nhất 5 ký tự).' using errcode = '22023';
  end if;
  if char_length(coalesce(v_reason, '')) > 500 then
    raise exception 'Lý do tối đa 500 ký tự.' using errcode = '22023';
  end if;
  if v_target.status = p_status then
    raise exception 'Tài khoản đã ở trạng thái này.' using errcode = '22023';
  end if;

  update public.profiles set
    status           = p_status,
    suspended_reason = case when p_status = 'suspended' then v_reason else null end,
    suspended_at     = case when p_status = 'suspended' then now() else null end,
    suspended_by     = case when p_status = 'suspended' then auth.uid() else null end
  where id = p_user_id
  returning * into v_row;

  perform private.log_action(
    case when p_status = 'suspended' then 'user.suspend' else 'user.unsuspend' end,
    'profile', p_user_id::text,
    jsonb_build_object('email', v_target.email, 'role', v_target.role, 'reason', v_reason)
  );

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. CẤP / THU HỒI QUYỀN ADMIN (chỉ Super Admin)
-- -----------------------------------------------------------------------------
-- Được đặt role: 'admin' (cấp) hoặc 'customer' / 'seller' (thu hồi về quyền thường).
-- 'super_admin' không bao giờ được cấp qua hàm này.
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.user_role,
  p_reason  text default null
)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_target    public.profiles;
  v_confirmed timestamptz;
  v_row       public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Chỉ Super Admin được thay đổi quyền quản trị.' using errcode = '42501';
  end if;
  if p_role = 'super_admin' then
    raise exception 'Không thể cấp quyền Super Admin qua website.' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = p_user_id for update;
  if v_target.id is null then
    raise exception 'Không tìm thấy tài khoản.' using errcode = 'P0002';
  end if;
  if v_target.id = auth.uid() then
    raise exception 'Bạn không thể tự thay đổi quyền của chính mình.' using errcode = '42501';
  end if;
  if v_target.role = 'super_admin' then
    raise exception 'Không thể thay đổi quyền của Super Admin.' using errcode = '42501';
  end if;
  if v_target.role = p_role then
    raise exception 'Tài khoản đã có quyền này.' using errcode = '22023';
  end if;

  if p_role = 'admin' then
    select u.email_confirmed_at into v_confirmed from auth.users u where u.id = p_user_id;
    if v_confirmed is null then
      raise exception 'Chỉ cấp quyền Admin cho tài khoản đã xác minh email.' using errcode = '22023';
    end if;
    if v_target.status <> 'active' then
      raise exception 'Hãy mở khóa tài khoản trước khi cấp quyền Admin.' using errcode = '22023';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id returning * into v_row;

  perform private.log_action(
    case when p_role = 'admin' then 'user.grant_admin' else 'user.revoke_admin' end,
    'profile', p_user_id::text,
    jsonb_build_object('email', v_target.email, 'from', v_target.role, 'to', p_role,
                       'reason', nullif(btrim(p_reason), ''))
  );

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. NHẬT KÝ QUẢN TRỊ (kèm email người thực hiện)
-- -----------------------------------------------------------------------------
create or replace function public.admin_audit_logs(
  p_action text default null,
  p_limit  integer default 30,
  p_offset integer default 0
)
returns table (
  id          bigint,
  created_at  timestamptz,
  action      text,
  target_type text,
  target_id   text,
  details     jsonb,
  actor_email text,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền xem nhật ký quản trị.' using errcode = '42501';
  end if;

  return query
  select l.id, l.created_at, l.action, l.target_type, l.target_id, l.details,
         p.email as actor_email,
         count(*) over () as total_count
  from public.audit_logs l
  left join public.profiles p on p.id = l.actor_id
  where nullif(btrim(p_action), '') is null or l.action like btrim(p_action) || '%'
  order by l.created_at desc, l.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. BẢO VỆ SUPER ADMIN KHỎI BỊ XÓA NGOÀI QUY TRÌNH
-- -----------------------------------------------------------------------------
-- Chặn xóa hồ sơ Super Admin (kể cả khi xóa user trong Dashboard, vì profiles xóa theo).
-- Muốn chuyển giao Super Admin: liên hệ người quản lý project để làm thủ công bằng SQL
-- (tắt trigger này trong cùng một giao dịch), và ghi lại lý do.
create or replace function private.protect_super_admin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.role = 'super_admin' then
    raise exception 'Không thể xóa tài khoản Super Admin. Hãy chuyển giao quyền trước.' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_protect_super_admin on public.profiles;
create trigger profiles_protect_super_admin
  before delete on public.profiles
  for each row execute function private.protect_super_admin();

-- -----------------------------------------------------------------------------
-- 6. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.protect_super_admin() from public, anon, authenticated;

revoke execute on function public.admin_list_users(text, public.user_role, public.account_status, date, date, integer, integer) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, public.account_status, text) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, public.user_role, text) from public, anon;
revoke execute on function public.admin_audit_logs(text, integer, integer) from public, anon;

grant execute on function public.admin_list_users(text, public.user_role, public.account_status, date, date, integer, integer) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role, text) to authenticated;
grant execute on function public.admin_audit_logs(text, integer, integer) to authenticated;
