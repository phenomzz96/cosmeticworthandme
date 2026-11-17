-- =============================================================================
-- Migration 015 — Beauty Quest chạy ngay trong Worth & Me
--
-- Chuyển phần máy chủ của Beauty Quest (bản Netlify Functions của nhóm phụ trách) sang Supabase:
--   nhiệm vụ, điểm Beauty Points, cấp độ, chuỗi ngày, thành tích, Skin Quiz, routine + check-in,
--   bài học (đánh dấu đã đọc), tự đánh giá tuần, nhật ký da (ảnh trong bucket riêng tư), Glow Match.
-- Giữ nguyên luật, nội dung và số điểm của bản gốc. Khác bản gốc:
--   • Dùng tài khoản Worth & Me (Supabase Auth), không còn tài khoản / mật khẩu / mã khôi phục riêng.
--   • Mọi điểm được ghi bởi hàm SECURITY DEFINER từ HÀNH ĐỘNG THẬT; trình duyệt không tự ghi sự kiện, không tự cộng điểm.
--   • Quản trị dùng is_admin() của sàn và ghi audit_logs.
--   • Nối với Hộp quà: Admin đặt "bao nhiêu Beauty Points kiếm được trong đợt quà thì thêm 1 lượt mở hộp".
-- Chạy SAU migration 014.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BẢNG
-- -----------------------------------------------------------------------------
create table public.bq_quests (
  id          text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  title       text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  icon        text not null default '🌸' check (char_length(icon) <= 4),
  points      integer not null check (points between 0 and 100),
  kind        text not null check (kind in ('daily', 'weekly', 'once')),
  category    text not null check (category in ('quiz', 'routine', 'knowledge', 'reflect')),
  requires    text not null check (requires in ('quiz', 'routine_saved', 'routine_morning', 'routine_night', 'article_read', 'reflection', 'diary', 'glow_match')),
  active      boolean not null default true,
  sort        integer not null default 100
);

create table public.bq_achievements (
  id          text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  rule_type   text not null check (rule_type in ('quests_done', 'points', 'days_in_category', 'category_count', 'streak', 'diary_count')),
  rule_value  integer not null,
  rule_cat    text not null default ''
);

create table public.bq_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  points  integer not null default 0 check (points >= 0),
  level   integer not null default 0
);

create table public.bq_events (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type    text not null,
  ref     text not null default '',
  day     date not null,
  week    text not null,
  unique (user_id, type, ref, day)
);

create table public.bq_user_quests (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  quest_id     text not null references public.bq_quests (id),
  period_key   text not null,
  day          date not null,
  points       integer not null,
  completed_at timestamptz not null default now(),
  unique (user_id, quest_id, period_key)
);

create table public.bq_point_transactions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  quest_id   text,
  points     integer not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index bq_point_transactions_user_idx on public.bq_point_transactions (user_id, created_at);

create table public.bq_user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.bq_achievements (id),
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.bq_diary (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  mood       text not null check (mood in ('radiant', 'balanced', 'dry', 'oily', 'sensitive')),
  note       text not null default '' check (char_length(note) <= 500),
  photo_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table public.bq_game_answers (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  round_id   text not null,
  choice     text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, round_id)
);

create table public.bq_quiz_results (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  answers    jsonb not null,
  result     jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.bq_routines (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  period     text not null check (period in ('morning', 'night')),
  steps      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create table public.bq_reflections (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  week       text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);

-- Dữ liệu gốc của bản Beauty Quest (giữ nguyên tên, điểm, luật)
insert into public.bq_quests (id, title, description, icon, points, kind, category, requires, sort) values
  ('first_glow', 'First Glow', 'Hoàn thành Skin Quiz để hiểu nhu cầu của da.', '✨', 20, 'once', 'quiz', 'quiz', 0),
  ('routine_ready', 'Routine Ready', 'Lưu routine đầu tiên của bạn.', '🧴', 30, 'once', 'routine', 'routine_saved', 1),
  ('morning_ritual', 'Morning Ritual', 'Đánh dấu routine buổi sáng đã hoàn thành.', '☀️', 5, 'daily', 'routine', 'routine_morning', 2),
  ('evening_ritual', 'Evening Ritual', 'Đánh dấu routine buổi tối đã hoàn thành.', '🌙', 5, 'daily', 'routine', 'routine_night', 3),
  ('daily_tip', 'Mẹo da mỗi ngày', 'Đọc một mẹo chăm da ngắn.', '💡', 5, 'daily', 'knowledge', 'article_read', 4),
  ('knowledge_quest', 'Knowledge Quest', 'Đọc xong hướng dẫn chăm sóc da.', '📖', 10, 'once', 'knowledge', 'article_read', 5),
  ('weekly_reflection', 'Weekly Reflection', 'Hoàn thành bản tự đánh giá tuần này.', '📝', 20, 'weekly', 'reflect', 'reflection', 6),
  ('skin_diary', 'Nhật ký da', 'Ghi lại làn da của bạn hôm nay (chỉ để bạn tự theo dõi).', '📔', 5, 'daily', 'reflect', 'diary', 7),
  ('glow_match', 'Glow Match', 'Chơi mini game chọn điều bạn thích để Worth & Me hiểu bạn hơn.', '🎯', 15, 'once', 'quiz', 'glow_match', 8);

insert into public.bq_achievements values
  ('first_step', 'First Step', 'Hoàn thành nhiệm vụ đầu tiên.', '🌱', 'quests_done', 1, ''),
  ('glow_starter', 'Glow Starter', 'Đạt 50 điểm.', '⭐', 'points', 50, ''),
  ('routine_lover', 'Routine Lover', 'Hoàn thành routine trong 7 ngày.', '💗', 'days_in_category', 7, 'routine'),
  ('knowledge_seeker', 'Knowledge Seeker', 'Hoàn thành 5 nhiệm vụ kiến thức.', '🎓', 'category_count', 5, 'knowledge'),
  ('steady_glow', 'Steady Glow', 'Giữ nhịp chăm da 7 ngày (được nghỉ 1 ngày giữa chừng).', '🌿', 'streak', 7, ''),
  ('skin_diarist', 'Skin Diarist', 'Ghi nhật ký da trong 5 ngày.', '📔', 'diary_count', 5, '');

-- -----------------------------------------------------------------------------
-- 2. QUYỀN TRUY CẬP: chỉ đọc dữ liệu của chính mình; mọi thay đổi đi qua hàm
-- -----------------------------------------------------------------------------
alter table public.bq_quests enable row level security;
alter table public.bq_achievements enable row level security;
alter table public.bq_progress enable row level security;
alter table public.bq_events enable row level security;
alter table public.bq_user_quests enable row level security;
alter table public.bq_point_transactions enable row level security;
alter table public.bq_user_achievements enable row level security;
alter table public.bq_diary enable row level security;
alter table public.bq_game_answers enable row level security;
alter table public.bq_quiz_results enable row level security;
alter table public.bq_routines enable row level security;
alter table public.bq_reflections enable row level security;

revoke all on public.bq_quests, public.bq_achievements, public.bq_progress, public.bq_events, public.bq_user_quests,
  public.bq_point_transactions, public.bq_user_achievements, public.bq_diary, public.bq_game_answers,
  public.bq_quiz_results, public.bq_routines, public.bq_reflections from anon, authenticated;

grant select on public.bq_quests, public.bq_achievements to anon, authenticated;
grant select on public.bq_progress, public.bq_events, public.bq_user_quests, public.bq_point_transactions, public.bq_user_achievements,
  public.bq_diary, public.bq_game_answers, public.bq_quiz_results, public.bq_routines, public.bq_reflections to authenticated;

create policy bq_quests_select on public.bq_quests for select to anon, authenticated using (active or public.is_admin());
create policy bq_achievements_select on public.bq_achievements for select to anon, authenticated using (true);
create policy bq_progress_own on public.bq_progress for select to authenticated using (user_id = auth.uid());
create policy bq_events_own on public.bq_events for select to authenticated using (user_id = auth.uid());
create policy bq_user_quests_own on public.bq_user_quests for select to authenticated using (user_id = auth.uid());
create policy bq_point_transactions_own on public.bq_point_transactions for select to authenticated using (user_id = auth.uid());
create policy bq_user_achievements_own on public.bq_user_achievements for select to authenticated using (user_id = auth.uid());
-- Nhật ký da, câu trả lời, tự đánh giá: chỉ chủ tài khoản (Admin cũng không đọc)
create policy bq_diary_own on public.bq_diary for select to authenticated using (user_id = auth.uid());
create policy bq_game_answers_own on public.bq_game_answers for select to authenticated using (user_id = auth.uid());
create policy bq_quiz_results_own on public.bq_quiz_results for select to authenticated using (user_id = auth.uid());
create policy bq_routines_own on public.bq_routines for select to authenticated using (user_id = auth.uid());
create policy bq_reflections_own on public.bq_reflections for select to authenticated using (user_id = auth.uid());

-- Ảnh nhật ký da: bucket riêng tư, mỗi người chỉ đọc / ghi / xóa thư mục <user_id>/ của mình
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bq-diary', 'bq-diary', false, 409600, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy bq_diary_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'bq-diary' and (storage.foldername(name))[1] = auth.uid()::text);
create policy bq_diary_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'bq-diary' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy bq_diary_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'bq-diary' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 3. HÀM NỘI BỘ: thời gian (giờ Việt Nam), sự kiện, chuỗi ngày, thành tích, nhận điểm
-- -----------------------------------------------------------------------------
create or replace function private.bq_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

create or replace function private.bq_week(p_day date) returns text
language sql immutable set search_path = '' as $$ select to_char(p_day, 'IYYY-"W"IW') $$;

create or replace function private.bq_period_key(p_kind text, p_day date) returns text
language sql immutable set search_path = '' as $$
  select case p_kind when 'daily' then p_day::text when 'weekly' then private.bq_week(p_day) else 'once' end
$$;

-- Cấp độ theo điểm (giống bản gốc)
create or replace function private.bq_level_of(p_points integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_points >= 350 then 4 when p_points >= 220 then 3 when p_points >= 120 then 2 when p_points >= 50 then 1 else 0 end
$$;

create or replace function private.bq_record(p_uid uuid, p_type text, p_ref text default '')
returns void language sql security definer set search_path = '' as $$
  insert into public.bq_events (user_id, type, ref, day, week)
  values (p_uid, p_type, coalesce(p_ref, ''), private.bq_today(), private.bq_week(private.bq_today()))
  on conflict do nothing;
$$;

-- Người dùng đang hoạt động; tạo dòng tiến trình nếu chưa có
create or replace function private.bq_user() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập để dùng Beauty Quest.' using errcode = '42501';
  end if;
  insert into public.bq_progress (user_id) values (v_uid) on conflict do nothing;
  return v_uid;
end;
$$;

-- Chuỗi ngày nhẹ nhàng: mỗi ngày có hoạt động được tính, được nghỉ 1 ngày giữa chừng mà chuỗi vẫn giữ
create or replace function private.bq_streak(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day  date;
  v_prev date;
  v_cur  integer := 0;
  v_best integer := 0;
  v_today date := private.bq_today();
begin
  for v_day in
    select d from (select day as d from public.bq_user_quests where user_id = p_uid
                   union select day from public.bq_diary where user_id = p_uid) t order by d
  loop
    v_cur := case when v_prev is not null and v_day - v_prev <= 2 then v_cur + 1 else 1 end;
    v_best := greatest(v_best, v_cur);
    v_prev := v_day;
  end loop;
  return jsonb_build_object(
    'current', case when v_prev is not null and v_today - v_prev <= 2 then v_cur else 0 end,
    'best', v_best,
    'active_today', v_prev = v_today);
end;
$$;

create or replace function private.bq_ready(p_uid uuid, p_q public.bq_quests) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bq_events e
     where e.user_id = p_uid and e.type = p_q.requires
       and (p_q.kind = 'once' or (p_q.kind = 'daily' and e.day = private.bq_today())
            or (p_q.kind = 'weekly' and e.week = private.bq_week(private.bq_today()))))
$$;

create or replace function private.bq_unlock(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a     public.bq_achievements;
  v_cur integer;
  v_out jsonb := '[]'::jsonb;
begin
  for a in select * from public.bq_achievements x
            where not exists (select 1 from public.bq_user_achievements u where u.user_id = p_uid and u.achievement_id = x.id)
  loop
    v_cur := case a.rule_type
      when 'quests_done' then (select count(*) from public.bq_user_quests where user_id = p_uid)
      when 'points' then (select points from public.bq_progress where user_id = p_uid)
      when 'category_count' then (select count(*) from public.bq_user_quests u join public.bq_quests q on q.id = u.quest_id where u.user_id = p_uid and q.category = a.rule_cat)
      when 'days_in_category' then (select count(distinct u.day) from public.bq_user_quests u join public.bq_quests q on q.id = u.quest_id
                                     where u.user_id = p_uid and q.category = a.rule_cat and q.kind = 'daily')
      when 'streak' then (private.bq_streak(p_uid) ->> 'best')::integer
      when 'diary_count' then (select count(*) from public.bq_diary where user_id = p_uid)
      else 0 end;
    if coalesce(v_cur, 0) >= a.rule_value then
      insert into public.bq_user_achievements (user_id, achievement_id) values (p_uid, a.id) on conflict do nothing;
      v_out := v_out || jsonb_build_object('id', a.id, 'title', a.title, 'icon', a.icon);
    end if;
  end loop;
  return v_out;
end;
$$;

-- Nhận điểm một nhiệm vụ (đã đủ điều kiện, chưa nhận trong kỳ này)
create or replace function private.bq_claim(p_uid uuid, p_quest text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q       public.bq_quests;
  v_prev  integer;
  v_pts   integer;
  v_lv    integer;
  v_today date := private.bq_today();
  v_id    bigint;
begin
  select * into q from public.bq_quests where id = p_quest and active;
  if q.id is null then
    raise exception 'Nhiệm vụ không tồn tại.' using errcode = 'P0002';
  end if;
  select level into v_prev from public.bq_progress where user_id = p_uid for update; -- khóa theo người dùng
  if not private.bq_ready(p_uid, q) then
    raise exception 'Bạn chưa hoàn thành điều kiện của nhiệm vụ này.' using errcode = '22023';
  end if;
  insert into public.bq_user_quests (user_id, quest_id, period_key, day, points)
  values (p_uid, q.id, private.bq_period_key(q.kind, v_today), v_today, q.points)
  on conflict do nothing returning id into v_id;
  if v_id is null then
    raise exception 'Bạn đã nhận thưởng nhiệm vụ này rồi.' using errcode = '23505';
  end if;
  insert into public.bq_point_transactions (user_id, quest_id, points, reason) values (p_uid, q.id, q.points, 'Hoàn thành: ' || q.title);
  update public.bq_progress set points = points + q.points where user_id = p_uid returning points into v_pts;
  v_lv := private.bq_level_of(v_pts);
  update public.bq_progress set level = v_lv where user_id = p_uid;
  return jsonb_build_object('quest_id', q.id, 'title', q.title, 'earned', q.points, 'points', v_pts, 'level', v_lv,
                            'level_up', v_lv > v_prev, 'new_achievements', private.bq_unlock(p_uid));
end;
$$;

-- Sau một hành động thật: tự nhận điểm mọi nhiệm vụ đã đủ điều kiện (giống autoClaim của bản gốc, chạy ở máy chủ)
create or replace function private.bq_claim_ready(p_uid uuid, p_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q     public.bq_quests;
  v_r   jsonb;
  v_got jsonb := '[]'::jsonb;
  v_lvl boolean := false;
  v_ach jsonb := '[]'::jsonb;
begin
  for q in select * from public.bq_quests where active and requires = p_type order by sort, id loop
    continue when exists (select 1 from public.bq_user_quests u where u.user_id = p_uid and u.quest_id = q.id
                                                                and u.period_key = private.bq_period_key(q.kind, private.bq_today()));
    continue when not private.bq_ready(p_uid, q);
    v_r := private.bq_claim(p_uid, q.id);
    v_got := v_got || jsonb_build_object('id', q.id, 'title', q.title, 'earned', q.points);
    v_lvl := v_lvl or (v_r ->> 'level_up')::boolean;
    v_ach := v_ach || (v_r -> 'new_achievements');
  end loop;
  return jsonb_build_object('claimed', v_got, 'level_up', v_lvl, 'new_achievements', v_ach,
    'points', (select points from public.bq_progress where user_id = p_uid), 'level', (select level from public.bq_progress where user_id = p_uid));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. HÀM CHO KHÁCH (đã đăng nhập)
-- -----------------------------------------------------------------------------
-- Trạng thái: điểm, cấp, chuỗi ngày, nhiệm vụ (đã xong / đủ điều kiện), thành tích
create or replace function public.bq_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.bq_user();
  v_today date := private.bq_today();
begin
  return jsonb_build_object(
    'points', (select points from public.bq_progress where user_id = v_uid),
    'level', (select level from public.bq_progress where user_id = v_uid),
    'streak', private.bq_streak(v_uid),
    'total_done', (select count(*) from public.bq_user_quests where user_id = v_uid),
    'quests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'title', q.title, 'description', q.description, 'icon', q.icon, 'points', q.points, 'kind', q.kind,
        'category', q.category, 'requires', q.requires,
        'done', exists (select 1 from public.bq_user_quests u where u.user_id = v_uid and u.quest_id = q.id and u.period_key = private.bq_period_key(q.kind, v_today)),
        'ready', private.bq_ready(v_uid, q)) order by (q.kind = 'once'), q.sort, q.id)
      from public.bq_quests q where q.active), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(a.achievement_id) from public.bq_user_achievements a where a.user_id = v_uid), '[]'::jsonb));
end;
$$;

-- Nút "Nhận điểm" (dự phòng) và tự nhận sau hành động
create or replace function public.bq_claim(p_quest text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return private.bq_claim(private.bq_user(), p_quest);
end;
$$;

-- Lịch sử nhiệm vụ đã hoàn thành (lọc theo loại / ngày)
create or replace function public.bq_history(p_kind text default null, p_day date default null)
returns table (completed_at timestamptz, points integer, day date, title text, kind text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  return query
    select u.completed_at, u.points, u.day, q.title, q.kind
      from public.bq_user_quests u join public.bq_quests q on q.id = u.quest_id
     where u.user_id = auth.uid() and (p_kind is null or q.kind = p_kind) and (p_day is null or u.day = p_day)
     order by u.completed_at desc limit 200;
end;
$$;

-- Skin Quiz 6 câu: kiểm tra câu trả lời, tính kết quả ở máy chủ (luật như hàm scoreQuiz bản gốc)
create or replace function public.bq_submit_quiz(p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := private.bq_user();
  a      jsonb := coalesce(p_answers, '{}'::jsonb);
  v_c    text[];
  s_dry  integer := 0; s_normal integer := 0; s_comb integer := 0; s_oily integer := 0;
  v_type text;
  v_long boolean; v_quick boolean;
  v_m    text[]; v_n text[];
  v_res  jsonb;
begin
  if jsonb_typeof(a) <> 'object'
     or coalesce(a ->> 'after_wash', '') not in ('tight', 'comfy', 'tzone', 'shiny')
     or coalesce(a ->> 'midday', '') not in ('matte', 'tz', 'all', 'flaky')
     or coalesce(a ->> 'reactive', '') not in ('often', 'some', 'rare')
     or coalesce(a ->> 'time', '') not in ('quick', 'normal', 'long')
     or coalesce(a ->> 'sun', '') not in ('daily', 'sometimes', 'rarely') then
    raise exception 'Vui lòng trả lời tất cả các câu hỏi.' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'concerns') <> 'array' then
    raise exception 'Hãy chọn từ 1 đến 3 mục bạn quan tâm.' using errcode = '22023';
  end if;
  select array_agg(x) into v_c from jsonb_array_elements_text(a -> 'concerns') x;
  if v_c is null or cardinality(v_c) > 3 or cardinality(v_c) <> (select count(distinct x) from unnest(v_c) x)
     or not (v_c <@ array['acne', 'spots', 'hydrate', 'pores', 'calm', 'dull']) then
    raise exception 'Hãy chọn từ 1 đến 3 mục bạn quan tâm.' using errcode = '22023';
  end if;

  case a ->> 'after_wash' when 'tight' then s_dry := s_dry + 2; when 'comfy' then s_normal := s_normal + 2;
                          when 'tzone' then s_comb := s_comb + 2; else s_oily := s_oily + 2; end case;
  case a ->> 'midday' when 'matte' then s_normal := s_normal + 1; when 'tz' then s_comb := s_comb + 1;
                      when 'all' then s_oily := s_oily + 1; else s_dry := s_dry + 1; end case;
  -- Bằng điểm: ưu tiên theo thứ tự khô → thường → hỗn hợp → dầu (giống bản gốc)
  v_type := case greatest(s_dry, s_normal, s_comb, s_oily) when s_dry then 'dry' when s_normal then 'normal' when s_comb then 'combination' else 'oily' end;
  v_long := a ->> 'time' = 'long';
  v_quick := a ->> 'time' = 'quick';

  select array_agg(x order by o) into v_m from unnest(array['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen']) with ordinality t(x, o)
   where x in ('cleanser', 'moisturizer', 'sunscreen') or (x = 'toner' and v_long)
      or (x = 'serum' and not v_quick and v_c && array['hydrate', 'spots', 'dull']);
  select array_agg(x order by o) into v_n from unnest(array['remover', 'cleanser', 'toner', 'treatment', 'serum', 'moisturizer']) with ordinality t(x, o)
   where x in ('cleanser', 'moisturizer') or (x = 'remover' and a ->> 'sun' <> 'rarely') or (x in ('toner', 'serum') and v_long)
      or (x = 'treatment' and not v_quick and v_c && array['acne', 'spots']);

  v_res := jsonb_build_object('skin_type', v_type, 'sensitive', a ->> 'reactive' = 'often', 'sun_daily', a ->> 'sun' = 'daily',
    'concerns', to_jsonb(v_c), 'suggested', jsonb_build_object('morning', to_jsonb(v_m), 'night', to_jsonb(v_n)));
  insert into public.bq_quiz_results (user_id, answers, result) values (v_uid, a, v_res)
  on conflict (user_id) do update set answers = excluded.answers, result = excluded.result, updated_at = now();
  perform private.bq_record(v_uid, 'quiz');
  return jsonb_build_object('result', v_res, 'claim', private.bq_claim_ready(v_uid, 'quiz'));
end;
$$;

create or replace function public.bq_delete_quiz() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.bq_quiz_results where user_id = private.bq_user();
end;
$$;

-- Routine sáng / tối: chỉ nhận bước có trong danh mục, giữ đúng thứ tự
create or replace function public.bq_save_routine(p_morning text[], p_night text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.bq_user();
  v_m   text[];
  v_n   text[];
begin
  select coalesce(array_agg(x order by o), '{}') into v_m from unnest(array['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen']) with ordinality t(x, o)
   where x = any (coalesce(p_morning, '{}'));
  select coalesce(array_agg(x order by o), '{}') into v_n from unnest(array['remover', 'cleanser', 'toner', 'treatment', 'serum', 'moisturizer']) with ordinality t(x, o)
   where x = any (coalesce(p_night, '{}'));
  if cardinality(v_m) + cardinality(v_n) = 0 then
    raise exception 'Hãy chọn ít nhất một bước cho routine của bạn.' using errcode = '22023';
  end if;
  if cardinality(v_m) > 0 then
    insert into public.bq_routines (user_id, period, steps) values (v_uid, 'morning', to_jsonb(v_m))
    on conflict (user_id, period) do update set steps = excluded.steps, updated_at = now();
  else
    delete from public.bq_routines where user_id = v_uid and period = 'morning';
  end if;
  if cardinality(v_n) > 0 then
    insert into public.bq_routines (user_id, period, steps) values (v_uid, 'night', to_jsonb(v_n))
    on conflict (user_id, period) do update set steps = excluded.steps, updated_at = now();
  else
    delete from public.bq_routines where user_id = v_uid and period = 'night';
  end if;
  perform private.bq_record(v_uid, 'routine_saved');
  return jsonb_build_object('routine', jsonb_build_object('morning', to_jsonb(v_m), 'night', to_jsonb(v_n)),
                            'claim', private.bq_claim_ready(v_uid, 'routine_saved'));
end;
$$;

create or replace function public.bq_checkin(p_period text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.bq_user();
  v_type text;
begin
  if p_period not in ('morning', 'night') then
    raise exception 'Buổi không hợp lệ.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.bq_routines where user_id = v_uid and period = p_period) then
    raise exception 'Hãy lưu routine cho buổi này trước nhé.' using errcode = '22023';
  end if;
  v_type := case p_period when 'morning' then 'routine_morning' else 'routine_night' end;
  perform private.bq_record(v_uid, v_type);
  return jsonb_build_object('claim', private.bq_claim_ready(v_uid, v_type));
end;
$$;

-- Đánh dấu đã đọc một bài (chỉ bài có trong thư viện)
create or replace function public.bq_mark_read(p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.bq_user();
begin
  if p_slug is null or p_slug not in ('rua-mat-dung-cach', 'chong-nang-moi-ngay', 'duong-am-co-ban', 'tay-te-bao-chet', 'doc-bang-thanh-phan',
                                      'retinol-cho-nguoi-moi', 'thu-san-pham-moi', 'da-dau-va-mun', 'giu-ve-sinh-vat-dung', 'ngu-va-lan-da') then
    raise exception 'Không tìm thấy bài viết.' using errcode = 'P0002';
  end if;
  perform private.bq_record(v_uid, 'article_read', p_slug);
  return jsonb_build_object('claim', private.bq_claim_ready(v_uid, 'article_read'));
end;
$$;

-- Tự đánh giá tuần: 3 câu chấm 1–5, 2 câu chữ (không bắt buộc)
create or replace function public.bq_save_reflection(p_ratings jsonb, p_texts jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := private.bq_user();
  v_data jsonb := '{}'::jsonb;
  k      text;
  v      integer;
begin
  foreach k in array array['skin', 'routine', 'rest'] loop
    begin
      v := (p_ratings ->> k)::integer;
    exception when others then
      v := null;
    end;
    if v is null or v < 1 or v > 5 or (p_ratings ->> k) !~ '^[1-5]$' then
      raise exception 'Vui lòng chọn mức từ 1 đến 5 cho mỗi câu.' using errcode = '22023';
    end if;
    v_data := v_data || jsonb_build_object(k, v);
  end loop;
  foreach k in array array['win', 'next'] loop
    v_data := v_data || jsonb_build_object(k, left(btrim(coalesce(p_texts ->> k, '')), 300));
  end loop;
  insert into public.bq_reflections (user_id, week, data) values (v_uid, private.bq_week(private.bq_today()), v_data)
  on conflict (user_id, week) do update set data = excluded.data, updated_at = now();
  perform private.bq_record(v_uid, 'reflection');
  return jsonb_build_object('week', private.bq_week(private.bq_today()), 'claim', private.bq_claim_ready(v_uid, 'reflection'));
end;
$$;

-- Tuần hiện tại (để trang Tự đánh giá biết đang ở tuần nào theo giờ Việt Nam)
create or replace function public.bq_current_week() returns text
language sql stable security definer set search_path = '' as $$ select private.bq_week(private.bq_today()) $$;

-- Nhật ký da hôm nay. Ảnh (tùy chọn) đã được tải lên bucket riêng tư bq-diary/<user_id>/...
-- Trả về đường dẫn ảnh cũ (nếu bị thay / gỡ) để trình duyệt xóa khỏi bucket.
create or replace function public.bq_save_diary(p_mood text, p_note text, p_photo_path text default null, p_remove_photo boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := private.bq_user();
  v_old  text;
  v_new  text;
begin
  if p_mood is null or p_mood not in ('radiant', 'balanced', 'dry', 'oily', 'sensitive') then
    raise exception 'Vui lòng chọn tình trạng da hôm nay.' using errcode = '22023';
  end if;
  if p_photo_path is not null and (
       p_photo_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,80}$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'bq-diary' and o.name = p_photo_path)) then
    raise exception 'Ảnh không hợp lệ.' using errcode = '22023';
  end if;
  select photo_path into v_old from public.bq_diary where user_id = v_uid and day = private.bq_today();
  v_new := case when coalesce(p_remove_photo, false) then null else coalesce(p_photo_path, v_old) end;
  insert into public.bq_diary (user_id, day, mood, note, photo_path)
  values (v_uid, private.bq_today(), p_mood, left(coalesce(p_note, ''), 500), v_new)
  on conflict (user_id, day) do update set mood = excluded.mood, note = excluded.note, photo_path = excluded.photo_path, updated_at = now();
  perform private.bq_record(v_uid, 'diary');
  return jsonb_build_object('removed_photo', case when v_old is distinct from v_new then v_old end,
                            'claim', private.bq_claim_ready(v_uid, 'diary'));
end;
$$;

create or replace function public.bq_delete_diary(p_day date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_path text;
begin
  delete from public.bq_diary where user_id = private.bq_user() and day = p_day returning photo_path into v_path;
  return v_path;
end;
$$;

-- Glow Match: 6 câu chọn điều bạn thích (không có đúng/sai)
create or replace function public.bq_answer_game(p_round text, p_choice text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.bq_user();
  v_ok  boolean;
  v_n   integer;
begin
  v_ok := case p_round
    when 'texture' then p_choice in ('gel', 'cream')
    when 'steps' then p_choice in ('short', 'full')
    when 'focus' then p_choice in ('acne', 'spots', 'hydrate', 'calm')
    when 'time' then p_choice in ('morning', 'night', 'both')
    when 'learn' then p_choice in ('tips', 'guide', 'ingredients')
    when 'scent' then p_choice in ('none', 'light')
    else false end;
  if not coalesce(v_ok, false) then
    raise exception 'Lựa chọn không hợp lệ.' using errcode = '22023';
  end if;
  insert into public.bq_game_answers (user_id, round_id, choice) values (v_uid, p_round, p_choice)
  on conflict (user_id, round_id) do update set choice = excluded.choice, updated_at = now();
  select count(*) into v_n from public.bq_game_answers where user_id = v_uid;
  if v_n >= 6 then
    perform private.bq_record(v_uid, 'glow_match');
    return jsonb_build_object('complete', true, 'claim', private.bq_claim_ready(v_uid, 'glow_match'));
  end if;
  return jsonb_build_object('complete', false);
end;
$$;

create or replace function public.bq_reset_game() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.bq_game_answers where user_id = private.bq_user();
end;
$$;

-- Xóa toàn bộ dữ liệu Beauty Quest của tôi (điểm, nhiệm vụ, nhật ký...). Trả về đường dẫn ảnh để trình duyệt xóa khỏi bucket.
create or replace function public.bq_delete_my_data() returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_paths text[];
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '42501';
  end if;
  select coalesce(array_agg(photo_path) filter (where photo_path is not null), '{}') into v_paths from public.bq_diary where user_id = v_uid;
  delete from public.bq_diary where user_id = v_uid;
  delete from public.bq_game_answers where user_id = v_uid;
  delete from public.bq_quiz_results where user_id = v_uid;
  delete from public.bq_routines where user_id = v_uid;
  delete from public.bq_reflections where user_id = v_uid;
  delete from public.bq_user_achievements where user_id = v_uid;
  delete from public.bq_user_quests where user_id = v_uid;
  delete from public.bq_point_transactions where user_id = v_uid;
  delete from public.bq_events where user_id = v_uid;
  delete from public.bq_progress where user_id = v_uid;
  return v_paths;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. QUẢN TRỊ (chỉ Admin, ghi nhật ký)
-- -----------------------------------------------------------------------------
create or replace function public.bq_admin_save_quest(
  p_id text, p_title text, p_description text, p_icon text, p_points integer, p_kind text, p_category text, p_requires text, p_active boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý nhiệm vụ.' using errcode = '42501';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9_]{2,40}$' then
    raise exception 'ID chỉ gồm chữ thường, số và dấu gạch dưới.' using errcode = '22023';
  end if;
  insert into public.bq_quests (id, title, description, icon, points, kind, category, requires, active, sort)
  values (p_id, left(coalesce(nullif(btrim(p_title), ''), p_id), 60), left(coalesce(p_description, ''), 200), left(coalesce(nullif(p_icon, ''), '🌸'), 4),
          p_points, p_kind, p_category, p_requires, coalesce(p_active, true), 100)
  on conflict (id) do update set title = excluded.title, description = excluded.description, icon = excluded.icon, points = excluded.points,
    kind = excluded.kind, category = excluded.category, requires = excluded.requires, active = excluded.active;
  perform private.log_action('bq_quest.save', 'bq_quest', p_id,
    jsonb_build_object('title', p_title, 'points', p_points, 'kind', p_kind, 'requires', p_requires, 'active', coalesce(p_active, true)));
end;
$$;

-- Số liệu tổng hợp (không có dữ liệu cá nhân)
create or replace function public.bq_admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được xem thống kê.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'players', (select count(*) from public.bq_progress),
    'active_today', (select count(distinct user_id) from public.bq_events where day = private.bq_today()),
    'quests_claimed', (select count(*) from public.bq_user_quests),
    'quiz_done', (select count(*) from public.bq_quiz_results),
    'points_total', (select coalesce(sum(points), 0) from public.bq_progress),
    'game_players', (select count(distinct user_id) from public.bq_game_answers),
    'game', coalesce((select jsonb_object_agg(round_id || ':' || choice, n) from
        (select round_id, choice, count(*) as n from public.bq_game_answers group by round_id, choice) t), '{}'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. NỐI VỚI HỘP QUÀ: Beauty Points kiếm được trong đợt quà đổi thành lượt mở hộp
-- -----------------------------------------------------------------------------
alter table public.reward_campaigns
  add column points_per_turn integer not null default 50 check (points_per_turn between 0 and 1000);

create or replace function private.reward_turns(p_uid uuid, p_campaign public.reward_campaigns)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with today as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as d),
  used as (
    select count(*) filter (where not p.is_bonus and p.play_day = (select d from today))::integer as daily_used,
           count(*) filter (where p.is_bonus)::integer as bonus_used
      from public.reward_plays p
     where p.campaign_id = p_campaign.id and p.user_id = p_uid
  ),
  orders as (
    select count(*)::integer as n from public.orders o
     where o.customer_id = p_uid and o.created_at >= p_campaign.starts_at and o.created_at < p_campaign.ends_at
       and exists (select 1 from public.shop_orders so where so.order_id = o.id and so.status = 'delivered')
  ),
  quest as (
    -- Mỗi `points_per_turn` Beauty Points kiếm được trong thời gian đợt quà = 1 lượt (tối đa 10)
    select case when p_campaign.points_per_turn > 0
                then least(floor(coalesce(sum(t.points), 0) / p_campaign.points_per_turn)::integer, 10) else 0 end as n,
           coalesce(sum(t.points), 0)::integer as pts
      from public.bq_point_transactions t
     where t.user_id = p_uid and t.created_at >= p_campaign.starts_at and t.created_at < p_campaign.ends_at
  ),
  b as (select least(p_campaign.bonus_per_order * o.n + q.n, 50) as total from orders o, quest q)
  select jsonb_build_object(
    'daily_limit', p_campaign.plays_per_day,
    'daily_used', u.daily_used,
    'bonus_total', b.total,
    'bonus_used', u.bonus_used,
    'quest_bonus', q.n,
    'quest_points', q.pts,
    'points_per_turn', p_campaign.points_per_turn,
    'remaining', greatest(p_campaign.plays_per_day - u.daily_used, 0) + greatest(b.total - u.bonus_used, 0)
  )
  from used u, quest q, b;
$$;

drop function public.admin_save_reward_campaign(uuid, text, text, text, timestamptz, timestamptz, integer, integer, boolean);
create or replace function public.admin_save_reward_campaign(
  p_id uuid, p_title text, p_occasion text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_plays_per_day integer, p_bonus_per_order integer, p_is_active boolean, p_points_per_turn integer default 50
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý đợt quà.' using errcode = '42501';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Thời gian kết thúc phải sau thời gian bắt đầu.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.reward_campaigns (title, occasion, description, starts_at, ends_at, plays_per_day, bonus_per_order, is_active, points_per_turn, created_by)
    values (btrim(p_title), btrim(coalesce(p_occasion, '')), btrim(coalesce(p_description, '')), p_starts_at, p_ends_at,
            p_plays_per_day, p_bonus_per_order, coalesce(p_is_active, false), coalesce(p_points_per_turn, 50), auth.uid())
    returning id into v_id;
  else
    update public.reward_campaigns set
      title = btrim(p_title), occasion = btrim(coalesce(p_occasion, '')), description = btrim(coalesce(p_description, '')),
      starts_at = p_starts_at, ends_at = p_ends_at, plays_per_day = p_plays_per_day, bonus_per_order = p_bonus_per_order,
      is_active = coalesce(p_is_active, false), points_per_turn = coalesce(p_points_per_turn, 50)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Không tìm thấy đợt quà.' using errcode = 'P0002';
    end if;
  end if;
  perform private.log_action(case when p_id is null then 'reward_campaign.create' else 'reward_campaign.update' end, 'reward_campaign', v_id::text,
    jsonb_build_object('title', btrim(p_title), 'is_active', coalesce(p_is_active, false), 'starts_at', p_starts_at, 'ends_at', p_ends_at,
                       'points_per_turn', coalesce(p_points_per_turn, 50)));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.bq_today(), private.bq_week(date), private.bq_period_key(text, date), private.bq_level_of(integer),
  private.bq_record(uuid, text, text), private.bq_user(), private.bq_streak(uuid), private.bq_ready(uuid, public.bq_quests),
  private.bq_unlock(uuid), private.bq_claim(uuid, text), private.bq_claim_ready(uuid, text)
  from public, anon, authenticated;

revoke execute on function public.bq_state(), public.bq_claim(text), public.bq_history(text, date), public.bq_submit_quiz(jsonb), public.bq_delete_quiz(),
  public.bq_save_routine(text[], text[]), public.bq_checkin(text), public.bq_mark_read(text), public.bq_save_reflection(jsonb, jsonb),
  public.bq_save_diary(text, text, text, boolean), public.bq_delete_diary(date), public.bq_answer_game(text, text), public.bq_reset_game(),
  public.bq_delete_my_data(), public.bq_admin_save_quest(text, text, text, text, integer, text, text, text, boolean), public.bq_admin_stats(),
  public.admin_save_reward_campaign(uuid, text, text, text, timestamptz, timestamptz, integer, integer, boolean, integer)
  from public, anon;
grant execute on function public.bq_state(), public.bq_claim(text), public.bq_history(text, date), public.bq_submit_quiz(jsonb), public.bq_delete_quiz(),
  public.bq_save_routine(text[], text[]), public.bq_checkin(text), public.bq_mark_read(text), public.bq_save_reflection(jsonb, jsonb),
  public.bq_save_diary(text, text, text, boolean), public.bq_delete_diary(date), public.bq_answer_game(text, text), public.bq_reset_game(),
  public.bq_delete_my_data(), public.bq_admin_save_quest(text, text, text, text, integer, text, text, text, boolean), public.bq_admin_stats(),
  public.admin_save_reward_campaign(uuid, text, text, text, timestamptz, timestamptz, integer, integer, boolean, integer)
  to authenticated;
revoke execute on function public.bq_current_week() from public;
grant execute on function public.bq_current_week() to anon, authenticated;
