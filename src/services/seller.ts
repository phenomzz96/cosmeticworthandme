/**
 * Dịch vụ kênh người bán. Đọc/ghi trực tiếp bảng shops, products, product_images.
 * Database (RLS + quyền cột + trigger) bảo đảm: chỉ chủ shop sửa được dữ liệu của mình,
 * không tự duyệt shop, không sửa lượt bán/điểm đánh giá, giá/tồn kho hợp lệ, có ảnh mới đăng bán.
 */
import { requireSupabase } from '@/lib/supabase'
import { slugify } from '@/lib/text'
import { removeShopImages } from '@/services/media'
import type { ProductInput, ProductStatus, SellerProduct, SellerShop, ShopInput } from '@/types/seller'

const SHOP_FIELDS =
  'id, owner_id, slug, name, tagline, description, logo_path, cover_path, theme_color, contact_email, contact_phone, location, policy, status, status_reason, created_at'
const PRODUCT_FIELDS =
  'id, shop_id, slug, name, brand_name, category, product_type, description, price, sale_price, sku, stock, status, size, skin_types, concerns, key_ingredients, texture, fragrance_free, placeholder_visual, rating, review_count, sold_count, admin_hidden, admin_hidden_reason, created_at, updated_at, product_images(id, path, sort_order)'

function sortImages(p: SellerProduct): SellerProduct {
  return { ...p, product_images: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order) }
}

/** Đường dẫn sản phẩm: từ tên + chuỗi ngẫu nhiên ngắn để không trùng giữa các shop */
export function makeProductSlug(name: string) {
  const base = slugify(name).slice(0, 100) || 'san-pham'
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

export function makeShopSlug(name: string) {
  return slugify(name).slice(0, 60)
}

export const sellerService = {
  async getMyShop(userId: string): Promise<SellerShop | null> {
    const { data, error } = await requireSupabase().from('shops').select(SHOP_FIELDS).eq('owner_id', userId).maybeSingle()
    if (error) throw error
    return data as SellerShop | null
  },

  async createShop(userId: string, input: ShopInput & { slug: string }): Promise<SellerShop> {
    const { data, error } = await requireSupabase()
      .from('shops')
      .insert({ owner_id: userId, ...input })
      .select(SHOP_FIELDS)
      .single()
    if (error) throw error
    return data as SellerShop
  },

  async updateShop(shopId: string, patch: Partial<ShopInput & { logo_path: string | null; cover_path: string | null }>): Promise<SellerShop> {
    const { data, error } = await requireSupabase().from('shops').update(patch).eq('id', shopId).select(SHOP_FIELDS).single()
    if (error) throw error
    return data as SellerShop
  },

  async resubmitShop(): Promise<SellerShop> {
    const { data, error } = await requireSupabase().rpc('resubmit_shop')
    if (error) throw error
    return data as SellerShop
  },

  async listMyProducts(shopId: string): Promise<SellerProduct[]> {
    const { data, error } = await requireSupabase()
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('shop_id', shopId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data as SellerProduct[]).map(sortImages)
  },

  async getMyProduct(productId: string): Promise<SellerProduct | null> {
    const { data, error } = await requireSupabase().from('products').select(PRODUCT_FIELDS).eq('id', productId).maybeSingle()
    if (error) throw error
    return data ? sortImages(data as SellerProduct) : null
  },

  async createProduct(shopId: string, input: ProductInput): Promise<SellerProduct> {
    const { data, error } = await requireSupabase()
      .from('products')
      .insert({ shop_id: shopId, slug: makeProductSlug(input.name), status: 'draft', ...input })
      .select(PRODUCT_FIELDS)
      .single()
    if (error) throw error
    return sortImages(data as SellerProduct)
  },

  async updateProduct(productId: string, patch: Partial<ProductInput> & { status?: ProductStatus }): Promise<SellerProduct> {
    const { data, error } = await requireSupabase().from('products').update(patch).eq('id', productId).select(PRODUCT_FIELDS).single()
    if (error) throw error
    return sortImages(data as SellerProduct)
  },

  /** Chỉ xóa hẳn được bản nháp (database chặn các trạng thái khác) */
  async deleteDraft(product: SellerProduct): Promise<void> {
    const { data, error } = await requireSupabase().from('products').delete().eq('id', product.id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Chỉ xóa được sản phẩm ở trạng thái bản nháp. Sản phẩm đã đăng hãy ẩn hoặc ngừng kinh doanh.')
    await removeShopImages(product.product_images.map((i) => i.path))
  },

  async addImage(productId: string, path: string, sortOrder: number) {
    const { error } = await requireSupabase().from('product_images').insert({ product_id: productId, path, sort_order: sortOrder })
    if (error) {
      await removeShopImages([path])
      throw error
    }
  },

  async removeImage(imageId: string, path: string) {
    const { data, error } = await requireSupabase().from('product_images').delete().eq('id', imageId).select('id')
    if (error) throw error
    if (data?.length) await removeShopImages([path])
  },

  /** Sắp xếp lại ảnh: ảnh đầu tiên là ảnh đại diện */
  async reorderImages(ids: string[]) {
    const sb = requireSupabase()
    for (const [i, id] of ids.entries()) {
      const { error } = await sb.from('product_images').update({ sort_order: i }).eq('id', id)
      if (error) throw error
    }
  },
}
