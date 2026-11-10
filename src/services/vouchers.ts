/**
 * Mã giảm giá (bảng vouchers, migration 008).
 * Số tiền giảm luôn do database tính (preview_vouchers khi xem trước, place_order khi đặt hàng).
 * Trình duyệt chỉ gửi mã; không gửi số tiền giảm.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/format'

export interface Voucher {
  id: string
  shop_id: string | null
  code: string
  title: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_discount: number | null
  min_spend: number
  starts_at: string
  ends_at: string
  usage_limit: number | null
  per_user_limit: number
  used_count: number
  is_active: boolean
  created_at: string
}

export interface WalletVoucher {
  id: string
  shop_id: string | null
  shop_name: string | null
  shop_slug: string | null
  code: string
  title: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_discount: number | null
  min_spend: number
  starts_at: string
  ends_at: string
  per_user_limit: number
  my_used: number
  exhausted: boolean
  claimed_at: string
}

export interface VoucherPreview {
  shops: Record<string, { voucher_id: string; code: string; title: string; discount: number }>
  platform: { voucher_id: string; code: string; title: string; discount: number } | null
  errors: { code: string; message: string }[]
  items_subtotal: number
  after_discount: number
}

export type VoucherInput = {
  id?: string | null
  shopId: string | null
  code: string
  title: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  maxDiscount: number | null
  minSpend: number
  startsAt: string
  endsAt: string
  usageLimit: number | null
  perUserLimit: number
  isActive: boolean
}

const COLUMNS = 'id, shop_id, code, title, discount_type, discount_value, max_discount, min_spend, starts_at, ends_at, usage_limit, per_user_limit, used_count, is_active, created_at'

/** "Giảm 10% (tối đa 30.000 ₫) · đơn từ 200.000 ₫" */
export function describeVoucher(v: Pick<Voucher, 'discount_type' | 'discount_value' | 'max_discount' | 'min_spend'>): string {
  const off = v.discount_type === 'percent' ? `Giảm ${v.discount_value}%${v.max_discount ? ` (tối đa ${formatPrice(v.max_discount)})` : ''}` : `Giảm ${formatPrice(v.discount_value)}`
  return v.min_spend > 0 ? `${off} · đơn từ ${formatPrice(v.min_spend)}` : off
}

export function voucherState(v: Pick<Voucher, 'starts_at' | 'ends_at' | 'is_active'> & { usage_limit?: number | null; used_count?: number }) {
  const now = Date.now()
  if (!v.is_active) return 'off'
  if (Date.parse(v.ends_at) <= now) return 'expired'
  if (Date.parse(v.starts_at) > now) return 'upcoming'
  if (v.usage_limit != null && (v.used_count ?? 0) >= v.usage_limit) return 'used-up'
  return 'running'
}

export const voucherService = {
  /** Voucher đang chạy: của sàn (shopIds rỗng) và của các shop truyền vào */
  async listAvailable(shopIds: string[] = []): Promise<Voucher[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const now = new Date().toISOString()
    let q = supabase.from('vouchers').select(COLUMNS).eq('is_active', true).lte('starts_at', now).gt('ends_at', now)
    q = shopIds.length ? q.or(`shop_id.is.null,shop_id.in.(${shopIds.join(',')})`) : q.is('shop_id', null)
    const { data, error } = await q.order('ends_at', { ascending: true }).limit(50)
    if (error) throw error
    return ((data ?? []) as Voucher[]).filter((v) => v.usage_limit == null || v.used_count < v.usage_limit)
  },

  async listForShop(shopId: string): Promise<Voucher[]> {
    const { data, error } = await requireSupabase().from('vouchers').select(COLUMNS).eq('shop_id', shopId).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Voucher[]
  },

  async listPlatform(): Promise<Voucher[]> {
    const { data, error } = await requireSupabase().from('vouchers').select(COLUMNS).is('shop_id', null).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Voucher[]
  },

  async save(v: VoucherInput): Promise<Voucher> {
    const { data, error } = await requireSupabase().rpc('save_voucher', {
      p_id: v.id ?? null,
      p_shop_id: v.shopId,
      p_code: v.code.trim().toUpperCase(),
      p_title: v.title.trim(),
      p_discount_type: v.discountType,
      p_discount_value: v.discountValue,
      p_max_discount: v.discountType === 'percent' ? v.maxDiscount : null,
      p_min_spend: v.minSpend,
      p_starts_at: v.startsAt,
      p_ends_at: v.endsAt,
      p_usage_limit: v.usageLimit,
      p_per_user_limit: v.perUserLimit,
      p_is_active: v.isActive,
    })
    if (error) throw error
    return data as Voucher
  },

  async claim(code: string): Promise<void> {
    const { error } = await requireSupabase().rpc('claim_voucher', { p_code: code.trim() })
    if (error) throw error
  },

  async wallet(): Promise<WalletVoucher[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase.rpc('my_vouchers')
    if (error) throw error
    return (data ?? []) as WalletVoucher[]
  },

  async preview(lines: { productId: string; quantity: number }[], codes: string[]): Promise<VoucherPreview> {
    const { data, error } = await requireSupabase().rpc('preview_vouchers', {
      p_items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      p_codes: codes,
    })
    if (error) throw error
    const r = data as VoucherPreview
    return { ...r, platform: r.platform && typeof r.platform === 'object' ? r.platform : null, shops: r.shops ?? {}, errors: r.errors ?? [] }
  },
}
