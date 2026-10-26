/**
 * Duyệt và quản lý cửa hàng (Admin). Gọi RPC trong database; database kiểm tra quyền Admin,
 * chuyển trạng thái hợp lệ, bắt buộc lý do khi từ chối/tạm ngưng, không tự duyệt shop của mình,
 * và ghi nhật ký audit_logs.
 */
import { requireSupabase } from '@/lib/supabase'
import type { AccountStatus } from '@/types/account'
import type { SellerShop, ShopStatus } from '@/types/seller'

export const ADMIN_SHOPS_PAGE_SIZE = 20
export const SHOP_REASON_MIN = 5

export interface AdminShopRow {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  status: ShopStatus
  status_reason: string | null
  owner_email: string | null
  owner_status: AccountStatus | null
  product_count: number
  created_at: string
  reviewed_at: string | null
  total_count: number
}

/** Thao tác Admin được phép theo trạng thái hiện tại (khớp hàm admin_set_shop_status) */
export const shopTransitions: Record<ShopStatus, { to: ShopStatus; label: string; needsReason: boolean }[]> = {
  pending: [
    { to: 'active', label: 'Duyệt', needsReason: false },
    { to: 'rejected', label: 'Từ chối', needsReason: true },
  ],
  active: [{ to: 'suspended', label: 'Tạm ngưng', needsReason: true }],
  suspended: [{ to: 'active', label: 'Mở lại', needsReason: false }],
  rejected: [],
}

export const adminShopsService = {
  async list(f: { status?: ShopStatus; search?: string; page?: number }): Promise<{ rows: AdminShopRow[]; total: number }> {
    const page = Math.max(1, f.page ?? 1)
    const { data, error } = await requireSupabase().rpc('admin_list_shops', {
      p_status: f.status ?? null,
      p_search: f.search?.trim() || null,
      p_limit: ADMIN_SHOPS_PAGE_SIZE,
      p_offset: (page - 1) * ADMIN_SHOPS_PAGE_SIZE,
    })
    if (error) throw error
    const rows = ((data ?? []) as AdminShopRow[]).map((r) => ({ ...r, product_count: Number(r.product_count) }))
    return { rows, total: rows[0] ? Number(rows[0].total_count) : 0 }
  },

  async setStatus(shopId: string, status: ShopStatus, reason?: string): Promise<SellerShop> {
    const { data, error } = await requireSupabase().rpc('admin_set_shop_status', {
      p_shop_id: shopId,
      p_status: status,
      p_reason: reason?.trim() || null,
    })
    if (error) throw error
    return data as SellerShop
  },
}
