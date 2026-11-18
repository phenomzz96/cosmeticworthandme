/**
 * Beauty Quest — Hộp quà may mắn (migration 012).
 * Máy chủ kiểm tra lượt chơi, chọn giải theo tỷ lệ và tạo voucher riêng; trình duyệt chỉ gửi "mở hộp".
 * Admin tạo đợt quà (theo dịp lễ, đợt sale) và tùy chỉnh giải thưởng ở /admin/rewards.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/format'

export type PrizeKind = 'voucher' | 'gift' | 'none'
export type GiftStatus = 'pending' | 'fulfilled' | 'cancelled'

export interface RewardCampaign {
  id: string
  title: string
  occasion: string
  description: string
  starts_at: string
  ends_at: string
  plays_per_day: number
  bonus_per_order: number
  is_active: boolean
  /** Beauty Points kiếm được trong đợt quà để đổi 1 lượt (0 = không đổi) */
  points_per_turn: number
}

export interface RewardPrize {
  id: string
  campaign_id: string
  kind: PrizeKind
  label: string
  description: string
  weight: number
  stock: number | null
  awarded_count: number
  discount_type: 'percent' | 'fixed' | null
  discount_value: number | null
  max_discount: number | null
  min_spend: number
  valid_days: number
  sort_order: number
}

export interface RewardTurns {
  daily_limit: number
  daily_used: number
  bonus_total: number
  bonus_used: number
  remaining: number
  /** Lượt thưởng từ Beauty Points (đã tính trong bonus_total) */
  quest_bonus: number
  quest_points: number
  points_per_turn: number
}

export interface PlayResult {
  play_id: number
  kind: PrizeKind
  label: string
  description: string
  voucher_code: string | null
  voucher_ends_at: string | null
  turns: RewardTurns
}

export interface MyPlay {
  id: number
  campaign_id: string
  campaign_title: string
  prize_kind: PrizeKind
  prize_label: string
  prize_description: string
  voucher_code: string | null
  voucher_ends_at: string | null
  voucher_used: boolean
  gift_status: GiftStatus | null
  admin_note: string
  played_at: string
}

export interface AdminPlay {
  id: number
  user_id: string
  full_name: string | null
  email: string
  prize_kind: PrizeKind
  prize_label: string
  voucher_code: string | null
  gift_status: GiftStatus | null
  admin_note: string
  is_bonus: boolean
  played_at: string
}

export type CampaignInput = Omit<RewardCampaign, 'id'> & { id: string | null }
export type PrizeInput = Omit<RewardPrize, 'id' | 'awarded_count'> & { id: string | null }

const CAMPAIGN_COLS = 'id, title, occasion, description, starts_at, ends_at, plays_per_day, bonus_per_order, is_active, points_per_turn'
const PRIZE_COLS = 'id, campaign_id, kind, label, description, weight, stock, awarded_count, discount_type, discount_value, max_discount, min_spend, valid_days, sort_order'

export const giftStatusLabels: Record<GiftStatus, string> = { pending: 'Chờ gửi quà', fulfilled: 'Đã gửi quà', cancelled: 'Đã hủy' }

/** "Giảm 20% (tối đa 50.000 ₫) · đơn từ 100.000 ₫ · dùng trong 7 ngày" */
export function describePrize(p: Pick<RewardPrize, 'kind' | 'discount_type' | 'discount_value' | 'max_discount' | 'min_spend' | 'valid_days' | 'description'>) {
  if (p.kind !== 'voucher' || !p.discount_type || !p.discount_value) return p.description
  const off = p.discount_type === 'percent' ? `Giảm ${p.discount_value}%${p.max_discount ? ` (tối đa ${formatPrice(p.max_discount)})` : ''}` : `Giảm ${formatPrice(p.discount_value)}`
  return [off, p.min_spend > 0 ? `đơn từ ${formatPrice(p.min_spend)}` : '', `dùng trong ${p.valid_days} ngày`].filter(Boolean).join(' · ')
}

/** Giải còn quà (dùng để tính tỷ lệ công khai) */
export const prizeAvailable = (p: Pick<RewardPrize, 'weight' | 'stock' | 'awarded_count'>) => p.weight > 0 && (p.stock == null || p.awarded_count < p.stock)

/** Tỷ lệ trúng (%) của từng giải, tính trên các giải còn quà */
export function prizeOdds(prizes: RewardPrize[]): Record<string, number> {
  const total = prizes.filter(prizeAvailable).reduce((s, p) => s + p.weight, 0)
  return Object.fromEntries(prizes.map((p) => [p.id, total && prizeAvailable(p) ? (p.weight / total) * 100 : 0]))
}

export function campaignState(c: Pick<RewardCampaign, 'starts_at' | 'ends_at' | 'is_active'>): 'running' | 'upcoming' | 'ended' | 'off' {
  const now = Date.now()
  if (!c.is_active) return 'off'
  if (Date.parse(c.ends_at) <= now) return 'ended'
  if (Date.parse(c.starts_at) > now) return 'upcoming'
  return 'running'
}

export const rewardService = {
  /** Đợt quà đang mở hoặc sắp mở (database lọc theo quyền), sớm kết thúc trước */
  async listCampaigns(): Promise<RewardCampaign[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase.from('reward_campaigns').select(CAMPAIGN_COLS).order('ends_at', { ascending: true }).limit(20)
    if (error) throw error
    return (data ?? []) as RewardCampaign[]
  },

  async listPrizes(campaignId: string): Promise<RewardPrize[]> {
    const { data, error } = await requireSupabase().from('reward_prizes').select(PRIZE_COLS).eq('campaign_id', campaignId).order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as RewardPrize[]
  },

  async turns(campaignId: string): Promise<RewardTurns> {
    const { data, error } = await requireSupabase().rpc('reward_turns', { p_campaign: campaignId })
    if (error) throw error
    return data as RewardTurns
  },

  async play(campaignId: string): Promise<PlayResult> {
    const { data, error } = await requireSupabase().rpc('play_reward', { p_campaign: campaignId })
    if (error) throw error
    return data as PlayResult
  },

  async myPlays(campaignId?: string): Promise<MyPlay[]> {
    const { data, error } = await requireSupabase().rpc('my_reward_plays', { p_campaign: campaignId ?? null })
    if (error) throw error
    return (data ?? []) as MyPlay[]
  },

  // ---------- Quản trị ----------
  async adminCampaigns(): Promise<RewardCampaign[]> {
    const { data, error } = await requireSupabase().from('reward_campaigns').select(CAMPAIGN_COLS).order('starts_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as RewardCampaign[]
  },

  async saveCampaign(c: CampaignInput): Promise<string> {
    const { data, error } = await requireSupabase().rpc('admin_save_reward_campaign', {
      p_id: c.id,
      p_title: c.title.trim(),
      p_occasion: c.occasion.trim(),
      p_description: c.description.trim(),
      p_starts_at: c.starts_at,
      p_ends_at: c.ends_at,
      p_plays_per_day: c.plays_per_day,
      p_bonus_per_order: c.bonus_per_order,
      p_is_active: c.is_active,
      p_points_per_turn: c.points_per_turn,
    })
    if (error) throw error
    return data as string
  },

  async deleteCampaign(id: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_delete_reward_campaign', { p_id: id })
    if (error) throw error
  },

  async savePrize(p: PrizeInput): Promise<string> {
    const voucher = p.kind === 'voucher'
    const { data, error } = await requireSupabase().rpc('admin_save_reward_prize', {
      p_id: p.id,
      p_campaign_id: p.campaign_id,
      p_kind: p.kind,
      p_label: p.label.trim(),
      p_description: p.description.trim(),
      p_weight: p.weight,
      p_stock: p.stock,
      p_discount_type: voucher ? p.discount_type : null,
      p_discount_value: voucher ? p.discount_value : null,
      p_max_discount: voucher && p.discount_type === 'percent' ? p.max_discount : null,
      p_min_spend: voucher ? p.min_spend : 0,
      p_valid_days: p.valid_days,
      p_sort_order: p.sort_order,
    })
    if (error) throw error
    return data as string
  },

  async deletePrize(id: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_delete_reward_prize', { p_id: id })
    if (error) throw error
  },

  async adminPlays(campaignId: string, onlyGifts = false): Promise<AdminPlay[]> {
    const { data, error } = await requireSupabase().rpc('admin_reward_plays', { p_campaign: campaignId, p_only_gifts: onlyGifts })
    if (error) throw error
    return (data ?? []) as AdminPlay[]
  },

  async updateGift(playId: number, status: GiftStatus, note: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_update_reward_gift', { p_play_id: playId, p_status: status, p_note: note })
    if (error) throw error
  },
}
