import { concernLabels, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import type { ProductType, SkinConcern, SkinType } from '@/types/catalog'

/** Câu trả lời của người dùng cho Beauty Finder */
export interface FinderAnswers {
  skinType: SkinType | 'unsure'
  concerns: SkinConcern[]
  need: CareNeed
  budget: BudgetKey
  /** Rỗng = để hệ thống gợi ý mọi loại */
  types: ProductType[]
  fragranceFree: boolean
}

export type CareNeed = 'basic' | 'targeted' | 'complete'
export type BudgetKey = 'under-200' | '200-350' | 'over-350' | 'any'

export const defaultAnswers: FinderAnswers = {
  skinType: 'unsure',
  concerns: [],
  need: 'basic',
  budget: 'any',
  types: [],
  fragranceFree: false,
}

export const MAX_CONCERNS = 3

export const skinTypeOptions: { value: FinderAnswers['skinType']; label: string; hint: string }[] = [
  { value: 'oily', label: skinTypeLabels.oily, hint: 'Bóng dầu toàn mặt sau vài giờ' },
  { value: 'dry', label: skinTypeLabels.dry, hint: 'Hay căng, bong tróc nhẹ' },
  { value: 'combination', label: skinTypeLabels.combination, hint: 'Dầu vùng chữ T, khô hai má' },
  { value: 'normal', label: skinTypeLabels.normal, hint: 'Ít khi quá dầu hay quá khô' },
  { value: 'sensitive', label: skinTypeLabels.sensitive, hint: 'Dễ đỏ, châm chích khi đổi sản phẩm' },
  { value: 'unsure', label: 'Mình chưa rõ', hint: 'Gợi ý sản phẩm hợp nhiều loại da' },
]

export const concernOptions = (Object.keys(concernLabels) as SkinConcern[]).map((value) => ({
  value,
  label: concernLabels[value],
}))

export const needOptions: { value: CareNeed; label: string; hint: string }[] = [
  { value: 'basic', label: 'Chăm sóc cơ bản', hint: 'Làm sạch, dưỡng ẩm, chống nắng' },
  { value: 'targeted', label: 'Tập trung vào vấn đề da', hint: 'Serum, toner, mặt nạ theo nhu cầu' },
  { value: 'complete', label: 'Chu trình đầy đủ', hint: 'Gợi ý sản phẩm cho nhiều bước' },
]

/** Ngân sách cho MỖI sản phẩm (VND) */
export const budgetOptions: { value: BudgetKey; label: string; min?: number; max?: number }[] = [
  { value: 'under-200', label: 'Dưới 200.000đ', max: 200_000 },
  { value: '200-350', label: '200.000đ – 350.000đ', min: 200_000, max: 350_000 },
  { value: 'over-350', label: 'Trên 350.000đ', min: 350_000 },
  { value: 'any', label: 'Không giới hạn' },
]

/** Các loại sản phẩm Beauty Finder có thể gợi ý (liên quan trực tiếp tới làn da) */
export const finderProductTypes: ProductType[] = [
  'cleanser',
  'toner',
  'serum',
  'moisturizer',
  'sunscreen',
  'mask',
  'eye-care',
  'cushion',
  'foundation',
]

export const typeOptions = finderProductTypes.map((value) => ({ value, label: productTypeLabels[value] }))

// -------- Lưu câu trả lời trên URL để có thể quay lại, chia sẻ, tải lại trang --------

export function answersToParams(a: FinderAnswers): URLSearchParams {
  const p = new URLSearchParams()
  p.set('skin', a.skinType)
  if (a.concerns.length) p.set('concerns', a.concerns.join(','))
  p.set('need', a.need)
  p.set('budget', a.budget)
  if (a.types.length) p.set('types', a.types.join(','))
  if (a.fragranceFree) p.set('ff', '1')
  return p
}

export function answersFromParams(p: URLSearchParams): FinderAnswers | null {
  const skin = p.get('skin')
  if (!skin) return null
  const valid = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
    v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  const list = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
    (v ?? '').split(',').filter((x): x is T => (allowed as readonly string[]).includes(x))

  return {
    skinType: valid(skin, skinTypeOptions.map((o) => o.value), 'unsure'),
    concerns: list(p.get('concerns'), concernOptions.map((o) => o.value)).slice(0, MAX_CONCERNS),
    need: valid(p.get('need'), needOptions.map((o) => o.value), 'basic'),
    budget: valid(p.get('budget'), budgetOptions.map((o) => o.value), 'any'),
    types: list(p.get('types'), finderProductTypes),
    fragranceFree: p.get('ff') === '1',
  }
}
