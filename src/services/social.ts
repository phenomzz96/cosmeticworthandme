/**
 * Theo dõi cửa hàng và sản phẩm yêu thích (bảng shop_follows, product_favorites — migration 007).
 * Mỗi người chỉ đọc được danh sách của mình (RLS). Thêm / bỏ qua hàm toggle_* trong database,
 * database tự đếm số người theo dõi của shop.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'

export const socialService = {
  /** Danh sách id cửa hàng người dùng đang theo dõi (mới nhất trước) */
  async followedShopIds(): Promise<string[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase.from('shop_follows').select('shop_id, created_at').order('created_at', { ascending: false })
    if (error) throw error
    return (data as { shop_id: string }[]).map((r) => r.shop_id)
  },

  async isFollowing(shopId: string): Promise<boolean> {
    if (!supabase) return false
    const { data, error } = await supabase.from('shop_follows').select('shop_id').eq('shop_id', shopId).maybeSingle()
    if (error) throw error
    return Boolean(data)
  },

  /** Trả về trạng thái mới (true = đang theo dõi) */
  async toggleFollow(shopId: string): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('toggle_follow_shop', { p_shop_id: shopId })
    if (error) throw error
    return Boolean(data)
  },

  async favoriteProductIds(): Promise<string[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase.from('product_favorites').select('product_id, created_at').order('created_at', { ascending: false })
    if (error) throw error
    return (data as { product_id: string }[]).map((r) => r.product_id)
  },

  async isFavorite(productId: string): Promise<boolean> {
    if (!supabase) return false
    const { data, error } = await supabase.from('product_favorites').select('product_id').eq('product_id', productId).maybeSingle()
    if (error) throw error
    return Boolean(data)
  },

  /** Trả về trạng thái mới (true = đã thêm vào yêu thích) */
  async toggleFavorite(productId: string): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('toggle_favorite', { p_product_id: productId })
    if (error) throw error
    return Boolean(data)
  },
}
