import type { Category, CategoryId, ProductType, SkinConcern, SkinType } from '@/types/catalog'

/** Nhãn tiếng Việt cho các giá trị dữ liệu. Dùng chung cho bộ lọc, Beauty Finder, trang chi tiết. */

export const categories: Category[] = [
  { id: 'skincare', name: 'Skincare', label: 'Chăm sóc da', description: 'Làm sạch, dưỡng ẩm, chống nắng và chăm sóc chuyên sâu.' },
  { id: 'makeup', name: 'Makeup', label: 'Trang điểm', description: 'Nền, môi, má, mắt cho mọi phong cách.' },
  { id: 'haircare', name: 'Haircare', label: 'Chăm sóc tóc', description: 'Gội, xả, dưỡng cho tóc mềm và khỏe.' },
  { id: 'body-care', name: 'Body Care', label: 'Chăm sóc cơ thể', description: 'Sữa tắm, dưỡng thể, kem tay.' },
  { id: 'beauty-tools', name: 'Beauty Tools', label: 'Dụng cụ làm đẹp', description: 'Cọ, mút, máy rửa mặt và phụ kiện.' },
]

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<CategoryId, Category>

export const productTypeLabels: Record<ProductType, string> = {
  cleanser: 'Sữa rửa mặt',
  toner: 'Toner',
  serum: 'Serum',
  moisturizer: 'Kem dưỡng',
  sunscreen: 'Kem chống nắng',
  mask: 'Mặt nạ',
  'eye-care': 'Dưỡng mắt',
  foundation: 'Kem nền',
  cushion: 'Cushion',
  lipstick: 'Son môi',
  mascara: 'Mascara',
  blush: 'Má hồng',
  shampoo: 'Dầu gội',
  conditioner: 'Dầu xả',
  'hair-oil': 'Dầu dưỡng tóc',
  'body-wash': 'Sữa tắm',
  'body-lotion': 'Dưỡng thể',
  'hand-cream': 'Kem tay',
  brush: 'Cọ trang điểm',
  sponge: 'Mút trang điểm',
  'facial-device': 'Máy rửa mặt',
}

/** Loại sản phẩm thuộc từng danh mục (thứ tự hiển thị trong bộ lọc) */
export const typesByCategory: Record<CategoryId, ProductType[]> = {
  skincare: ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask', 'eye-care'],
  makeup: ['foundation', 'cushion', 'lipstick', 'mascara', 'blush'],
  haircare: ['shampoo', 'conditioner', 'hair-oil'],
  'body-care': ['body-wash', 'body-lotion', 'hand-cream'],
  'beauty-tools': ['brush', 'sponge', 'facial-device'],
}

export const skinTypeLabels: Record<SkinType, string> = {
  oily: 'Da dầu',
  dry: 'Da khô',
  combination: 'Da hỗn hợp',
  normal: 'Da thường',
  sensitive: 'Da nhạy cảm',
}

export const concernLabels: Record<SkinConcern, string> = {
  acne: 'Da dễ nổi mụn',
  'dark-spots': 'Thâm, không đều màu',
  aging: 'Nếp nhăn, lão hóa',
  dehydration: 'Thiếu ẩm, khô căng',
  pores: 'Lỗ chân lông, bóng dầu',
  dullness: 'Da xỉn màu',
  redness: 'Dễ đỏ, kích ứng',
  'sun-protection': 'Bảo vệ khỏi nắng',
}
