/** Admin kiểm duyệt sản phẩm: ẩn sản phẩm vi phạm (kèm lý do), bỏ ẩn. Database kiểm tra quyền và ghi nhật ký. */
import { requireSupabase } from '@/lib/supabase'
import type { ProductStatus, ShopStatus } from '@/types/seller'

export const ADMIN_PRODUCTS_PAGE_SIZE = 20
export const HIDE_REASON_MIN = 5

export interface AdminProductRow {
  id: string
  slug: string
  name: string
  brand_name: string
  status: ProductStatus
  price: number
  sale_price: number | null
  stock: number
  admin_hidden: boolean
  admin_hidden_reason: string | null
  shop_id: string
  shop_name: string
  shop_slug: string
  shop_status: ShopStatus
  image_path: string | null
  created_at: string
  total_count: number
}

export const adminProductsService = {
  async list(f: { search?: string; hidden?: boolean; page?: number }): Promise<{ rows: AdminProductRow[]; total: number }> {
    const pageNo = Math.max(1, f.page ?? 1)
    const { data, error } = await requireSupabase().rpc('admin_list_products', {
      p_search: f.search?.trim() || null,
      p_hidden: f.hidden ?? null,
      p_limit: ADMIN_PRODUCTS_PAGE_SIZE,
      p_offset: (pageNo - 1) * ADMIN_PRODUCTS_PAGE_SIZE,
    })
    if (error) throw error
    const rows = (data ?? []) as AdminProductRow[]
    return { rows, total: rows[0] ? Number(rows[0].total_count) : 0 }
  },
  async setHidden(productId: string, hidden: boolean, reason?: string) {
    const { error } = await requireSupabase().rpc('admin_set_product_hidden', { p_product_id: productId, p_hidden: hidden, p_reason: reason?.trim() || null })
    if (error) throw error
  },
}
