/** Kiểu dữ liệu cho kênh người bán — khớp bảng shops, products, product_images (migration 003) */
import type { CategoryId, ProductType, ProductVisual, SkinConcern, SkinType } from './catalog'

export type ShopStatus = 'pending' | 'active' | 'rejected' | 'suspended'
export type ProductStatus = 'draft' | 'active' | 'hidden' | 'discontinued'

export interface SellerShop {
  id: string
  owner_id: string | null
  slug: string
  name: string
  tagline: string
  description: string
  logo_path: string | null
  cover_path: string | null
  theme_color: string
  contact_email: string | null
  contact_phone: string | null
  location: string
  policy: string
  status: ShopStatus
  status_reason: string | null
  created_at: string
}

export interface SellerProductImage {
  id: string
  path: string
  sort_order: number
}

export interface SellerProduct {
  id: string
  shop_id: string
  slug: string
  name: string
  brand_name: string
  category: CategoryId
  product_type: ProductType
  description: string
  price: number
  sale_price: number | null
  sku: string | null
  stock: number
  status: ProductStatus
  size: string
  skin_types: SkinType[]
  concerns: SkinConcern[]
  key_ingredients: string[]
  texture: string | null
  fragrance_free: boolean | null
  placeholder_visual: ProductVisual | null
  rating: number
  review_count: number
  sold_count: number
  /** Admin ẩn vì vi phạm: khách không thấy, chủ shop không tự bỏ ẩn được */
  admin_hidden?: boolean
  admin_hidden_reason?: string | null
  created_at: string
  updated_at: string
  product_images: SellerProductImage[]
}

/** Các trường người bán được nhập (khớp quyền cột trong database) */
export type ProductInput = Pick<
  SellerProduct,
  | 'name'
  | 'brand_name'
  | 'category'
  | 'product_type'
  | 'description'
  | 'price'
  | 'sale_price'
  | 'sku'
  | 'stock'
  | 'size'
  | 'skin_types'
  | 'concerns'
  | 'key_ingredients'
  | 'texture'
  | 'fragrance_free'
>

export type ShopInput = Pick<SellerShop, 'name' | 'tagline' | 'description' | 'location' | 'contact_email' | 'contact_phone' | 'policy' | 'theme_color'>

export const shopStatusLabels: Record<ShopStatus, string> = {
  pending: 'Chờ duyệt',
  active: 'Đang hoạt động',
  rejected: 'Bị từ chối',
  suspended: 'Tạm ngưng',
}

export const productStatusLabels: Record<ProductStatus, string> = {
  draft: 'Bản nháp',
  active: 'Đang bán',
  hidden: 'Đang ẩn',
  discontinued: 'Ngừng kinh doanh',
}

export const LOW_STOCK_THRESHOLD = 5
export const MAX_PRODUCT_IMAGES = 8
