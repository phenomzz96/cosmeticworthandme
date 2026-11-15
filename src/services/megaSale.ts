/**
 * Mega Sale (migration 013).
 * Admin tạo đợt sale, người bán đăng ký sản phẩm với giá sale, Admin duyệt.
 * Database tự áp giá sale vào sản phẩm trong thời gian chương trình và trả giá cũ khi hết sale;
 * trình duyệt không gửi giá khi đặt hàng.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'

export interface MegaSale {
  id: string
  title: string
  tagline: string
  starts_at: string
  ends_at: string
  min_discount_percent: number
  is_active: boolean
}

export interface MegaSaleItem {
  id: string
  sale_id: string
  product_id: string
  shop_id: string
  sale_price: number
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string
  applied: boolean
  created_at: string
  decided_at: string | null
}

export type MegaSaleInput = Omit<MegaSale, 'id'> & { id: string | null }

const SALE_COLS = 'id, title, tagline, starts_at, ends_at, min_discount_percent, is_active'
const ITEM_COLS = 'id, sale_id, product_id, shop_id, sale_price, status, reject_reason, applied, created_at, decided_at'

export const itemStatusLabels: Record<MegaSaleItem['status'], string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối' }

export function saleState(s: Pick<MegaSale, 'starts_at' | 'ends_at' | 'is_active'>): 'running' | 'upcoming' | 'ended' | 'off' {
  const now = Date.now()
  if (!s.is_active) return 'off'
  if (Date.parse(s.ends_at) <= now) return 'ended'
  if (Date.parse(s.starts_at) > now) return 'upcoming'
  return 'running'
}

/** Giá sale cao nhất được phép (giảm ít nhất min_discount_percent) */
export const maxSalePrice = (price: number, minPercent: number) => Math.floor((price * (100 - minPercent)) / 100)

// Đợt sale hiện tại dùng ở thanh menu / trang chủ: tải một lần mỗi 2 phút
let cache: { at: number; promise: Promise<MegaSale[]> } | null = null

export const megaSaleService = {
  /** Nhờ database cập nhật giá sale theo giờ hiện tại (bắt đầu / kết thúc đợt sale) */
  async sync(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    await supabase.rpc('sync_mega_sales')
  },

  /** Đợt sale đang chạy hoặc sắp mở (database lọc theo quyền), đang chạy trước */
  async listOpen(force = false): Promise<MegaSale[]> {
    if (!isSupabaseConfigured || !supabase) return []
    if (!force && cache && Date.now() - cache.at < 120_000) return cache.promise
    const promise = (async () => {
      const { data, error } = await supabase!.from('mega_sales').select(SALE_COLS).eq('is_active', true).order('starts_at', { ascending: true }).limit(10)
      if (error) throw error
      const list = ((data ?? []) as MegaSale[]).filter((s) => saleState(s) === 'running' || saleState(s) === 'upcoming')
      return list.sort((a, b) => Number(saleState(a) !== 'running') - Number(saleState(b) !== 'running'))
    })()
    cache = { at: Date.now(), promise }
    promise.catch(() => (cache = null))
    return promise
  },

  /** Sản phẩm đã duyệt của một đợt (công khai) */
  async approvedItems(saleId: string): Promise<MegaSaleItem[]> {
    const { data, error } = await requireSupabase().from('mega_sale_items').select(ITEM_COLS).eq('sale_id', saleId).eq('status', 'approved').limit(500)
    if (error) throw error
    return (data ?? []) as MegaSaleItem[]
  },

  // ---------- Người bán ----------
  /** Đăng ký của shop mình (database chỉ trả đúng shop của người bán) */
  async myItems(saleId: string, shopId: string): Promise<MegaSaleItem[]> {
    const { data, error } = await requireSupabase().from('mega_sale_items').select(ITEM_COLS).eq('sale_id', saleId).eq('shop_id', shopId)
    if (error) throw error
    return (data ?? []) as MegaSaleItem[]
  },

  async enroll(saleId: string, productId: string, salePrice: number): Promise<void> {
    const { error } = await requireSupabase().rpc('seller_enroll_mega_sale', { p_sale: saleId, p_product: productId, p_sale_price: salePrice })
    if (error) throw error
  },

  async withdraw(itemId: string): Promise<void> {
    const { error } = await requireSupabase().rpc('seller_withdraw_mega_sale', { p_item: itemId })
    if (error) throw error
  },

  // ---------- Quản trị ----------
  async adminSales(): Promise<MegaSale[]> {
    const { data, error } = await requireSupabase().from('mega_sales').select(SALE_COLS).order('starts_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as MegaSale[]
  },

  async adminItems(saleId: string): Promise<MegaSaleItem[]> {
    const { data, error } = await requireSupabase().from('mega_sale_items').select(ITEM_COLS).eq('sale_id', saleId).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as MegaSaleItem[]
  },

  async save(s: MegaSaleInput): Promise<string> {
    const { data, error } = await requireSupabase().rpc('admin_save_mega_sale', {
      p_id: s.id,
      p_title: s.title.trim(),
      p_tagline: s.tagline.trim(),
      p_starts_at: s.starts_at,
      p_ends_at: s.ends_at,
      p_min_discount_percent: s.min_discount_percent,
      p_is_active: s.is_active,
    })
    if (error) throw error
    cache = null
    return data as string
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_delete_mega_sale', { p_id: id })
    if (error) throw error
    cache = null
  },

  async review(itemId: string, approve: boolean, reason = ''): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_review_mega_sale_item', { p_item: itemId, p_approve: approve, p_reason: reason })
    if (error) throw error
  },
}
