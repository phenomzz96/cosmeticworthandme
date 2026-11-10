/**
 * Kiểu dữ liệu dùng chung cho toàn bộ frontend.
 * Khi chuyển sang Supabase, các bảng database sẽ ánh xạ về đúng các kiểu này
 * (ví dụ bảng products -> Product), nên các trang không phải viết lại.
 */

export type CategoryId = 'skincare' | 'makeup' | 'haircare' | 'body-care' | 'beauty-tools'

export interface Category {
  id: CategoryId
  name: string
  /** Tên tiếng Việt mô tả ngắn */
  label: string
  description: string
}

/** Loại sản phẩm cụ thể — dùng cho bộ lọc, Beauty Finder và chu trình chăm sóc da */
export type ProductType =
  // skincare
  | 'cleanser'
  | 'toner'
  | 'serum'
  | 'moisturizer'
  | 'sunscreen'
  | 'mask'
  | 'eye-care'
  // makeup
  | 'foundation'
  | 'cushion'
  | 'lipstick'
  | 'mascara'
  | 'blush'
  // haircare
  | 'shampoo'
  | 'conditioner'
  | 'hair-oil'
  | 'hair-styling'
  // body care
  | 'body-wash'
  | 'body-lotion'
  | 'hand-cream'
  // tools
  | 'brush'
  | 'sponge'
  | 'facial-device'

export type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive'

export type SkinConcern =
  | 'acne'
  | 'dark-spots'
  | 'aging'
  | 'dehydration'
  | 'pores'
  | 'dullness'
  | 'redness'
  | 'sun-protection'

/** Hình minh họa tạm khi chưa có ảnh thật: kiểu bao bì + màu */
export interface ProductVisual {
  shape: 'bottle' | 'pump' | 'tube' | 'jar' | 'dropper' | 'compact' | 'lipstick' | 'brush' | 'device'
  /** Màu bao bì (hex) */
  color: string
  /** Màu nắp / điểm nhấn (hex) */
  cap: string
}

export interface Product {
  id: string
  slug: string
  shopId: string
  categoryId: CategoryId
  type: ProductType
  name: string
  brandName: string
  description: string
  /** Giá bán hiện tại, đơn vị VND */
  price: number
  /** Giá gốc trước giảm (nếu có) */
  originalPrice?: number
  stock: number
  /** Điểm trung bình (0 = chưa có đánh giá) và số lượt đánh giá — database tự tính từ đánh giá thật */
  rating: number
  reviewCount: number
  soldCount: number
  /** Dung tích / khối lượng, ví dụ "50 ml" */
  size: string

  // ---- Thuộc tính làm đẹp: dùng cho Beauty Finder và so sánh sản phẩm ----
  /** Loại da phù hợp. Rỗng nghĩa là không phụ thuộc loại da (ví dụ dụng cụ, son) */
  skinTypes: SkinType[]
  concerns: SkinConcern[]
  keyIngredients: string[]
  texture?: string
  fragranceFree?: boolean

  /** Đường dẫn ảnh thật. Rỗng => dùng hình minh họa `visual` */
  images: string[]
  visual: ProductVisual

  featured?: boolean
  /** Cách dùng do cửa hàng nhập (có thể trống) */
  howToUse?: string
  /** Sản phẩm mẫu (dữ liệu demo, dùng hình minh họa) — sản phẩm thật luôn có ảnh do cửa hàng tải lên */
  isSample?: boolean
  createdAt: string
}

export interface Shop {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  /** Màu đại diện dùng khi chưa có logo shop */
  color: string
  logo?: string
  cover?: string
  rating: number
  followerCount: number
  joinedAt: string
  /** Gian hàng chính hãng / đã xác minh (dữ liệu mẫu, chưa có quy trình xác minh thật) */
  verified: boolean
  location: string
  /** Chính sách bán hàng (đổi trả, giao hàng...) do chủ shop viết */
  policy?: string
  contactEmail?: string
  contactPhone?: string
}

export type ProductSort = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'rating'

export interface ProductQuery {
  q?: string
  category?: CategoryId
  types?: ProductType[]
  shopId?: string
  minPrice?: number
  maxPrice?: number
  skinType?: SkinType
  /** Lọc theo thương hiệu (không phân biệt hoa thường) */
  brands?: string[]
  /** Chỉ sản phẩm có điểm đánh giá từ mức này trở lên */
  minRating?: number
  /** Chỉ sản phẩm còn hàng */
  inStock?: boolean
  sort?: ProductSort
}
