-- =============================================================================
-- Migration 012 — Beauty Quest: Hộp quà may mắn (đợt quà do Admin tùy chỉnh)
--
-- Admin tạo "đợt quà" theo dịp (Black Friday, Tết, sinh nhật sàn...) và danh sách giải:
--   voucher (giảm % hoặc số tiền, hạn dùng N ngày), quà tặng (Admin gửi kèm/liên hệ) hoặc "chúc may mắn".
-- Mỗi giải có tỷ lệ (trọng số) và số lượng (để trống = không giới hạn).
-- Khách mở hộp quà: MÁY CHỦ kiểm tra lượt, chọn giải ngẫu nhiên theo tỷ lệ, tạo voucher riêng cho đúng
-- tài khoản đó. Trình duyệt không gửi giải thưởng, không tự cộng lượt.
-- Lượt chơi: N lượt mỗi ngày (giờ Việt Nam) + lượt thưởng cho mỗi đơn đã giao trong thời gian chương trình.
--
-- Voucher riêng: thêm cột vouchers.owner_id. Voucher có owner_id chỉ chủ tài khoản thấy và dùng được.
-- Chạy SAU migration 011.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VOUCHER RIÊNG CHO TỪNG TÀI KHOẢN
-- -----------------------------------------------------------------------------
alter table public.vouchers
  add column owner_id uuid references public.profiles (id) on delete cascade,
  add constraint vouchers_owner_platform_check check (owner_id is null or shop_id is null);
create index vouchers_owner_idx on public.vouchers (owner_id) where owner_id is not null;

-- Voucher riêng: chỉ chủ tài khoản (và Admin) thấy
drop policy vouchers_select on public.vouchers;
create policy vouchers_select on public.vouchers for select to anon, authenticated
  using ((owner_id is null and is_active and now() < ends_at and (shop_id is null or public.is_shop_public(shop_id)))
         or (owner_id is not null and owner_id = auth.uid())
         or (shop_id is not null and public.owns_shop(shop_id))
         or public.is_admin());

-- Lưu voucher vào ví: không lưu được voucher riêng của người khác
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
  if v_v.id is null or not v_v.is_active or now() >= v_v.ends_at or (v_v.shop_id is not null and not public.is_shop_public(v_v.shop_id))
     or (v_v.owner_id is not null and v_v.owner_id <> auth.uid()) then
    raise exception 'Mã giảm giá không tồn tại hoặc đã hết hạn.' using errcode = 'P0002';
  end if;
  insert into public.voucher_claims (user_id, voucher_id) values (auth.uid(), v_v.id) on conflict do nothing;
  return v_v.id;
end;
$$;

-- Tính voucher (giữ nguyên migration 008, thêm: voucher riêng chỉ chủ tài khoản dùng được)
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

    if v_v.id is null or (v_v.owner_id is not null and v_v.owner_id is distinct from p_uid) then
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

-- -----------------------------------------------------------------------------
-- 2. BẢNG
-- -----------------------------------------------------------------------------
create table public.reward_campaigns (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(btrim(title)) between 3 and 80),
  occasion        text not null default '' check (char_length(occasion) <= 40),
  description     text not null default '' check (char_length(description) <= 400),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  plays_per_day   integer not null default 1 check (plays_per_day between 1 and 10),
  bonus_per_order integer not null default 0 check (bonus_per_order between 0 and 5),
  is_active       boolean not null default false,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.reward_prizes (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.reward_campaigns (id) on delete cascade,
  kind           text not null check (kind in ('voucher', 'gift', 'none')),
  label          text not null check (char_length(btrim(label)) between 2 and 60),
  description    text not null default '' check (char_length(description) <= 200),
  weight         integer not null check (weight between 0 and 10000),
  stock          integer check (stock is null or stock between 0 and 1000000),
  awarded_count  integer not null default 0 check (awarded_count >= 0),
  discount_type  text check (discount_type in ('percent', 'fixed')),
  discount_value integer,
  max_discount   integer check (max_discount is null or max_discount > 0),
  min_spend      integer not null default 0 check (min_spend between 0 and 100000000),
  valid_days     integer not null default 7 check (valid_days between 1 and 90),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  check (kind <> 'voucher' or (discount_type is not null and discount_value is not null)),
  check (kind <> 'voucher' or discount_type <> 'percent' or discount_value between 1 and 90),
  check (kind <> 'voucher' or discount_type <> 'fixed' or discount_value between 1000 and 10000000)
);
create index reward_prizes_campaign_idx on public.reward_prizes (campaign_id, sort_order);

create table public.reward_plays (
  id                bigint generated always as identity primary key,
  campaign_id       uuid not null references public.reward_campaigns (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  prize_id          uuid references public.reward_prizes (id) on delete set null,
  -- Bản chụp giải lúc trúng (Admin sửa/xóa giải sau đó không làm đổi lịch sử)
  prize_kind        text not null check (prize_kind in ('voucher', 'gift', 'none')),
  prize_label       text not null,
  prize_description text not null default '',
  voucher_id        uuid references public.vouchers (id) on delete set null,
  gift_status       text check (gift_status in ('pending', 'fulfilled', 'cancelled')),
  admin_note        text not null default '' check (char_length(admin_note) <= 300),
  is_bonus          boolean not null default false,
  play_day          date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  played_at         timestamptz not null default now(),
  check ((prize_kind = 'gift') = (gift_status is not null))
);
create index reward_plays_user_idx on public.reward_plays (campaign_id, user_id, play_day);
create index reward_plays_gift_idx on public.reward_plays (campaign_id) where gift_status = 'pending';

create trigger reward_campaigns_touch_updated_at before update on public.reward_campaigns
  for each row execute function private.touch_updated_at();

alter table public.reward_campaigns enable row level security;
alter table public.reward_prizes enable row level security;
alter table public.reward_plays enable row level security;
revoke all on public.reward_campaigns, public.reward_prizes, public.reward_plays from anon, authenticated;
grant select on public.reward_campaigns, public.reward_prizes to anon, authenticated;
-- Lượt chơi: chỉ đọc qua hàm my_reward_plays / admin_reward_plays

-- Ai cũng xem được đợt quà đang mở hoặc sắp mở; Admin xem tất cả
create policy reward_campaigns_select on public.reward_campaigns for select to anon, authenticated
  using ((is_active and now() < ends_at) or public.is_admin());
create policy reward_prizes_select on public.reward_prizes for select to anon, authenticated
  using (exists (select 1 from public.reward_campaigns c where c.id = campaign_id and ((c.is_active and now() < c.ends_at) or public.is_admin())));

-- -----------------------------------------------------------------------------
-- 3. LƯỢT CHƠI VÀ MỞ HỘP QUÀ
-- -----------------------------------------------------------------------------
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
    -- Đơn đặt trong thời gian chương trình, đã giao ít nhất một phần
    select count(*)::integer as n from public.orders o
     where o.customer_id = p_uid and o.created_at >= p_campaign.starts_at and o.created_at < p_campaign.ends_at
       and exists (select 1 from public.shop_orders so where so.order_id = o.id and so.status = 'delivered')
  )
  select jsonb_build_object(
    'daily_limit', p_campaign.plays_per_day,
    'daily_used', u.daily_used,
    'bonus_total', least(p_campaign.bonus_per_order * o.n, 50),
    'bonus_used', u.bonus_used,
    'remaining', greatest(p_campaign.plays_per_day - u.daily_used, 0) + greatest(least(p_campaign.bonus_per_order * o.n, 50) - u.bonus_used, 0)
  )
  from used u, orders o;
$$;

-- Số lượt còn lại của tôi trong một đợt quà
create or replace function public.reward_turns(p_campaign uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_c public.reward_campaigns;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để chơi.' using errcode = '42501';
  end if;
  select * into v_c from public.reward_campaigns c where c.id = p_campaign and c.is_active;
  if v_c.id is null then
    raise exception 'Đợt quà không tồn tại hoặc đã đóng.' using errcode = 'P0002';
  end if;
  return private.reward_turns(auth.uid(), v_c);
end;
$$;

-- Mở hộp quà: máy chủ chọn giải theo tỷ lệ. Trả về giải đã trúng (và mã voucher nếu có).
create or replace function public.play_reward(p_campaign uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_c      public.reward_campaigns;
  v_turns  jsonb;
  v_bonus  boolean;
  v_total  integer;
  v_pick   integer;
  v_prize  public.reward_prizes;
  v_pid    uuid;
  v_try    integer := 0;
  v_vid    uuid;
  v_code   text;
  v_ends   timestamptz;
  v_play   bigint;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Bạn cần đăng nhập (tài khoản đang hoạt động) để mở hộp quà.' using errcode = '42501';
  end if;
  -- Mỗi tài khoản mở lần lượt từng hộp (chống bấm liên tục để vượt lượt)
  perform pg_advisory_xact_lock(hashtextextended('reward:' || v_uid::text || ':' || coalesce(p_campaign::text, ''), 0));

  select * into v_c from public.reward_campaigns c where c.id = p_campaign;
  if v_c.id is null or not v_c.is_active then
    raise exception 'Đợt quà không tồn tại hoặc đã đóng.' using errcode = 'P0002';
  end if;
  if now() < v_c.starts_at then
    raise exception 'Đợt quà chưa bắt đầu.' using errcode = '22023';
  end if;
  if now() >= v_c.ends_at then
    raise exception 'Đợt quà đã kết thúc.' using errcode = '22023';
  end if;

  v_turns := private.reward_turns(v_uid, v_c);
  if (v_turns ->> 'remaining')::integer <= 0 then
    raise exception 'Bạn đã hết lượt hôm nay. Quay lại vào ngày mai nhé!' using errcode = '54000';
  end if;
  v_bonus := (v_turns ->> 'daily_used')::integer >= (v_turns ->> 'daily_limit')::integer;

  -- Chọn giải theo trọng số trong các giải còn quà (thử lại nếu giải vừa hết do người khác trúng cùng lúc)
  loop
    v_try := v_try + 1;
    select coalesce(sum(p.weight), 0) into v_total from public.reward_prizes p
     where p.campaign_id = v_c.id and p.weight > 0 and (p.stock is null or p.awarded_count < p.stock);
    if v_total = 0 then
      raise exception 'Quà của đợt này đã được trao hết.' using errcode = 'P0002';
    end if;
    v_pick := floor(random() * v_total)::integer;
    select t.id into v_pid from (
      select p.id, sum(p.weight) over (order by p.sort_order, p.created_at, p.id) as cum
        from public.reward_prizes p
       where p.campaign_id = v_c.id and p.weight > 0 and (p.stock is null or p.awarded_count < p.stock)
    ) t where t.cum > v_pick order by t.cum limit 1;
    select * into v_prize from public.reward_prizes p where p.id = v_pid for update;
    exit when v_prize.stock is null or v_prize.awarded_count < v_prize.stock;
    if v_try >= 5 then
      raise exception 'Hệ thống đang bận, vui lòng thử lại.' using errcode = '40001';
    end if;
  end loop;

  update public.reward_prizes set awarded_count = awarded_count + 1 where id = v_prize.id;

  if v_prize.kind = 'voucher' then
    v_ends := now() + make_interval(days => v_prize.valid_days);
    if v_ends > v_c.ends_at + interval '90 days' then v_ends := v_c.ends_at + interval '90 days'; end if;
    loop
      v_code := 'WM' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
      exit when not exists (select 1 from public.vouchers v where v.code = v_code);
    end loop;
    insert into public.vouchers (shop_id, owner_id, code, title, discount_type, discount_value, max_discount, min_spend,
                                 starts_at, ends_at, usage_limit, per_user_limit, is_active, created_by)
    values (null, v_uid, v_code, left(v_prize.label, 80), v_prize.discount_type, v_prize.discount_value,
            case when v_prize.discount_type = 'percent' then v_prize.max_discount end, v_prize.min_spend,
            now(), v_ends, 1, 1, true, null)
    returning id into v_vid;
    insert into public.voucher_claims (user_id, voucher_id) values (v_uid, v_vid);
    perform private.notify(v_uid, 'system', 'Bạn nhận được voucher ' || v_prize.label,
      'Mã ' || v_code || ' đã nằm trong ví voucher, dùng trước ' || to_char(v_ends at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') || '.', '/vouchers');
  elsif v_prize.kind = 'gift' then
    perform private.notify(v_uid, 'system', 'Bạn trúng quà: ' || v_prize.label,
      'Đội ngũ sàn sẽ liên hệ hoặc gửi quà kèm đơn hàng tiếp theo của bạn.', '/beauty-quest');
  end if;

  insert into public.reward_plays (campaign_id, user_id, prize_id, prize_kind, prize_label, prize_description, voucher_id, gift_status, is_bonus)
  values (v_c.id, v_uid, v_prize.id, v_prize.kind, v_prize.label, v_prize.description, v_vid,
          case when v_prize.kind = 'gift' then 'pending' end, v_bonus)
  returning id into v_play;

  return jsonb_build_object(
    'play_id', v_play, 'kind', v_prize.kind, 'label', v_prize.label, 'description', v_prize.description,
    'voucher_code', v_code, 'voucher_ends_at', v_ends,
    'turns', private.reward_turns(v_uid, v_c));
end;
$$;

-- Quà tôi đã nhận
create or replace function public.my_reward_plays(p_campaign uuid default null)
returns table (
  id bigint, campaign_id uuid, campaign_title text, prize_kind text, prize_label text, prize_description text,
  voucher_code text, voucher_ends_at timestamptz, voucher_used boolean, gift_status text, admin_note text, played_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.campaign_id, c.title, p.prize_kind, p.prize_label, p.prize_description,
         v.code, v.ends_at, coalesce(v.used_count >= coalesce(v.usage_limit, 2147483647), false),
         p.gift_status, p.admin_note, p.played_at
    from public.reward_plays p
    join public.reward_campaigns c on c.id = p.campaign_id
    left join public.vouchers v on v.id = p.voucher_id
   where p.user_id = auth.uid() and (p_campaign is null or p.campaign_id = p_campaign)
   order by p.played_at desc
   limit 100;
$$;

-- -----------------------------------------------------------------------------
-- 4. QUẢN TRỊ (chỉ Admin, ghi nhật ký)
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_reward_campaign(
  p_id uuid, p_title text, p_occasion text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_plays_per_day integer, p_bonus_per_order integer, p_is_active boolean
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
    insert into public.reward_campaigns (title, occasion, description, starts_at, ends_at, plays_per_day, bonus_per_order, is_active, created_by)
    values (btrim(p_title), btrim(coalesce(p_occasion, '')), btrim(coalesce(p_description, '')), p_starts_at, p_ends_at,
            p_plays_per_day, p_bonus_per_order, coalesce(p_is_active, false), auth.uid())
    returning id into v_id;
  else
    update public.reward_campaigns set
      title = btrim(p_title), occasion = btrim(coalesce(p_occasion, '')), description = btrim(coalesce(p_description, '')),
      starts_at = p_starts_at, ends_at = p_ends_at, plays_per_day = p_plays_per_day, bonus_per_order = p_bonus_per_order,
      is_active = coalesce(p_is_active, false)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Không tìm thấy đợt quà.' using errcode = 'P0002';
    end if;
  end if;
  perform private.log_action(case when p_id is null then 'reward_campaign.create' else 'reward_campaign.update' end, 'reward_campaign', v_id::text,
    jsonb_build_object('title', btrim(p_title), 'is_active', coalesce(p_is_active, false), 'starts_at', p_starts_at, 'ends_at', p_ends_at));
  return v_id;
end;
$$;

create or replace function public.admin_delete_reward_campaign(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý đợt quà.' using errcode = '42501';
  end if;
  if exists (select 1 from public.reward_plays p where p.campaign_id = p_id) then
    raise exception 'Đợt quà đã có người chơi nên không xóa được (giữ lịch sử trao quà). Hãy tắt đợt quà.' using errcode = '23503';
  end if;
  delete from public.reward_campaigns where id = p_id;
  if not found then
    raise exception 'Không tìm thấy đợt quà.' using errcode = 'P0002';
  end if;
  perform private.log_action('reward_campaign.delete', 'reward_campaign', p_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_save_reward_prize(
  p_id uuid, p_campaign_id uuid, p_kind text, p_label text, p_description text, p_weight integer, p_stock integer,
  p_discount_type text, p_discount_value integer, p_max_discount integer, p_min_spend integer, p_valid_days integer, p_sort_order integer
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_voucher boolean := p_kind = 'voucher';
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý giải thưởng.' using errcode = '42501';
  end if;
  if p_stock is not null and p_id is not null and p_stock < (select awarded_count from public.reward_prizes where id = p_id) then
    raise exception 'Số lượng không được nhỏ hơn số quà đã trao.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.reward_prizes (campaign_id, kind, label, description, weight, stock, discount_type, discount_value,
                                      max_discount, min_spend, valid_days, sort_order)
    values (p_campaign_id, p_kind, btrim(p_label), btrim(coalesce(p_description, '')), p_weight, p_stock,
            case when v_voucher then p_discount_type end, case when v_voucher then p_discount_value end,
            case when v_voucher and p_discount_type = 'percent' then p_max_discount end,
            case when v_voucher then coalesce(p_min_spend, 0) else 0 end, coalesce(p_valid_days, 7), coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update public.reward_prizes set
      kind = p_kind, label = btrim(p_label), description = btrim(coalesce(p_description, '')), weight = p_weight, stock = p_stock,
      discount_type = case when v_voucher then p_discount_type end, discount_value = case when v_voucher then p_discount_value end,
      max_discount = case when v_voucher and p_discount_type = 'percent' then p_max_discount end,
      min_spend = case when v_voucher then coalesce(p_min_spend, 0) else 0 end,
      valid_days = coalesce(p_valid_days, 7), sort_order = coalesce(p_sort_order, 0)
    where id = p_id and campaign_id = p_campaign_id returning id into v_id;
    if v_id is null then
      raise exception 'Không tìm thấy giải thưởng.' using errcode = 'P0002';
    end if;
  end if;
  perform private.log_action(case when p_id is null then 'reward_prize.create' else 'reward_prize.update' end, 'reward_prize', v_id::text,
    jsonb_build_object('campaign_id', p_campaign_id, 'kind', p_kind, 'label', btrim(p_label), 'weight', p_weight, 'stock', p_stock));
  return v_id;
end;
$$;

create or replace function public.admin_delete_reward_prize(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được quản lý giải thưởng.' using errcode = '42501';
  end if;
  delete from public.reward_prizes where id = p_id;
  if not found then
    raise exception 'Không tìm thấy giải thưởng.' using errcode = 'P0002';
  end if;
  perform private.log_action('reward_prize.delete', 'reward_prize', p_id::text, '{}'::jsonb);
end;
$$;

-- Danh sách lượt chơi (Admin): tên, email người trúng để gửi quà
create or replace function public.admin_reward_plays(p_campaign uuid, p_only_gifts boolean default false)
returns table (
  id bigint, user_id uuid, full_name text, email text, prize_kind text, prize_label text, voucher_code text,
  gift_status text, admin_note text, is_bonus boolean, played_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được xem danh sách trúng thưởng.' using errcode = '42501';
  end if;
  return query
    select p.id, p.user_id, pr.full_name, pr.email, p.prize_kind, p.prize_label, v.code, p.gift_status, p.admin_note, p.is_bonus, p.played_at
      from public.reward_plays p
      join public.profiles pr on pr.id = p.user_id
      left join public.vouchers v on v.id = p.voucher_id
     where p.campaign_id = p_campaign and (not coalesce(p_only_gifts, false) or p.prize_kind = 'gift')
     order by p.played_at desc
     limit 500;
end;
$$;

-- Cập nhật trạng thái quà tặng (đã gửi / hủy) và báo cho khách
create or replace function public.admin_update_reward_gift(p_play_id bigint, p_status text, p_note text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.reward_plays;
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên được cập nhật quà tặng.' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'fulfilled', 'cancelled') then
    raise exception 'Trạng thái không hợp lệ.' using errcode = '22023';
  end if;
  update public.reward_plays set gift_status = p_status, admin_note = left(btrim(coalesce(p_note, '')), 300)
   where id = p_play_id and prize_kind = 'gift' returning * into v_p;
  if v_p.id is null then
    raise exception 'Không tìm thấy quà tặng.' using errcode = 'P0002';
  end if;
  if p_status = 'fulfilled' then
    perform private.notify(v_p.user_id, 'system', 'Quà "' || v_p.prize_label || '" đã được gửi', coalesce(nullif(v_p.admin_note, ''), 'Cảm ơn bạn đã tham gia Beauty Quest.'), '/beauty-quest');
  elsif p_status = 'cancelled' then
    perform private.notify(v_p.user_id, 'system', 'Quà "' || v_p.prize_label || '" đã bị hủy', coalesce(nullif(v_p.admin_note, ''), 'Liên hệ hỗ trợ nếu bạn cần thêm thông tin.'), '/beauty-quest');
  end if;
  perform private.log_action('reward_gift.' || p_status, 'reward_play', p_play_id::text, jsonb_build_object('note', v_p.admin_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. QUYỀN GỌI HÀM
-- -----------------------------------------------------------------------------
revoke execute on function private.reward_turns(uuid, public.reward_campaigns) from public, anon, authenticated;

revoke execute on function public.reward_turns(uuid), public.play_reward(uuid), public.my_reward_plays(uuid),
  public.admin_save_reward_campaign(uuid, text, text, text, timestamptz, timestamptz, integer, integer, boolean),
  public.admin_delete_reward_campaign(uuid),
  public.admin_save_reward_prize(uuid, uuid, text, text, text, integer, integer, text, integer, integer, integer, integer, integer),
  public.admin_delete_reward_prize(uuid), public.admin_reward_plays(uuid, boolean), public.admin_update_reward_gift(bigint, text, text)
  from public, anon;
grant execute on function public.reward_turns(uuid), public.play_reward(uuid), public.my_reward_plays(uuid),
  public.admin_save_reward_campaign(uuid, text, text, text, timestamptz, timestamptz, integer, integer, boolean),
  public.admin_delete_reward_campaign(uuid),
  public.admin_save_reward_prize(uuid, uuid, text, text, text, integer, integer, text, integer, integer, integer, integer, integer),
  public.admin_delete_reward_prize(uuid), public.admin_reward_plays(uuid, boolean), public.admin_update_reward_gift(bigint, text, text)
  to authenticated;
