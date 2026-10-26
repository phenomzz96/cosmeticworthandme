/**
 * SO SÁNH SẢN PHẨM — khung dữ liệu cho tính năng so sánh sau này.
 * Mỗi mục là một hàng trong bảng so sánh. Hiện đang dùng cho bảng "Thông tin sản phẩm"
 * trên trang chi tiết; trang so sánh nhiều sản phẩm sẽ dùng lại đúng danh sách này.
 */
import { concernLabels, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import { formatPrice } from '@/lib/format'
import type { Product } from '@/types/catalog'

export interface CompareField {
  key: string
  label: string
  value: (p: Product) => string
  /** Ẩn hàng khi sản phẩm không có dữ liệu cho mục này */
  optional?: boolean
}

const list = (items: string[]) => (items.length ? items.join(', ') : '')

export const compareFields: CompareField[] = [
  { key: 'price', label: 'Giá', value: (p) => formatPrice(p.price) },
  { key: 'brand', label: 'Thương hiệu', value: (p) => p.brandName },
  { key: 'type', label: 'Loại sản phẩm', value: (p) => productTypeLabels[p.type] },
  { key: 'size', label: 'Dung tích / quy cách', value: (p) => p.size },
  { key: 'skinTypes', label: 'Loại da phù hợp', value: (p) => list(p.skinTypes.map((s) => skinTypeLabels[s])), optional: true },
  { key: 'concerns', label: 'Phù hợp với nhu cầu', value: (p) => list(p.concerns.map((c) => concernLabels[c])), optional: true },
  { key: 'ingredients', label: 'Thành phần chính', value: (p) => list(p.keyIngredients), optional: true },
  { key: 'texture', label: 'Kết cấu', value: (p) => p.texture ?? '', optional: true },
  {
    key: 'fragrance',
    label: 'Hương liệu',
    value: (p) => (p.fragranceFree === undefined ? '' : p.fragranceFree ? 'Không hương liệu' : 'Có hương liệu'),
    optional: true,
  },
  { key: 'rating', label: 'Đánh giá', value: (p) => `${p.rating.toFixed(1)} / 5 (${p.reviewCount} lượt)` },
]

/** Danh sách sản phẩm tối đa trong một lần so sánh (dùng khi làm trang so sánh) */
export const MAX_COMPARE_ITEMS = 3
