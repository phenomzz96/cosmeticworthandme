/**
 * Giỏ hàng theo tài khoản (bảng cart_items, migration 004). Chỉ lưu id sản phẩm + số lượng.
 * Giá luôn lấy lại từ database khi đặt hàng, không tin giá trong trình duyệt.
 */
import { requireSupabase } from '@/lib/supabase'

export interface CartLine {
  productId: string
  quantity: number
}

type Row = { product_id: string; quantity: number }
const toLines = (rows: Row[] | null) => (rows ?? []).map((r) => ({ productId: r.product_id, quantity: r.quantity }))

export const cartService = {
  async load(): Promise<CartLine[]> {
    const { data, error } = await requireSupabase().from('cart_items').select('product_id, quantity').order('updated_at')
    if (error) throw error
    return toLines(data as Row[])
  },
  /** Gộp giỏ trên trình duyệt vào giỏ của tài khoản, trả về giỏ sau khi gộp */
  async merge(lines: CartLine[]): Promise<CartLine[]> {
    const { data, error } = await requireSupabase().rpc('cart_merge', {
      p_items: lines.slice(0, 50).map((l) => ({ product_id: l.productId, quantity: l.quantity })),
    })
    if (error) throw error
    return toLines(data as Row[])
  },
  /** Đặt số lượng (0 = xóa). Trả về số lượng thực tế database chấp nhận (đã giới hạn theo tồn kho, tối đa 10). */
  async setItem(productId: string, quantity: number): Promise<number> {
    const { data, error } = await requireSupabase().rpc('cart_set_item', { p_product_id: productId, p_quantity: quantity })
    if (error) throw error
    return Number(data)
  },
  async clear(userId: string): Promise<void> {
    const { error } = await requireSupabase().from('cart_items').delete().eq('user_id', userId)
    if (error) throw error
  },
}
