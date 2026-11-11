/**
 * Thông tin chu trình skincare của sản phẩm (migration 010) và cách chuyển sang định dạng của Skincare Architect 3D
 * (modules/skincare-3d/docs/integration.md, "Shape 1 — simple"). Chỉ đổi tên trường / ánh xạ loại sản phẩm;
 * không suy đoán công dụng hay thời điểm dùng từ tên, mô tả. Thiếu thì để trống để module báo "Thiếu dữ liệu".
 */
import type { ApplyZone, Product, ProductType, SkincareFunction, SkinConcern, SkinType } from '@/types/catalog'

export const SKINCARE_FUNCTIONS: { value: SkincareFunction; label: string }[] = [
  { value: 'cleanse', label: 'Làm sạch' },
  { value: 'hydrate', label: 'Cấp ẩm' },
  { value: 'oil-control', label: 'Kiểm soát dầu' },
  { value: 'exfoliate', label: 'Tẩy tế bào chết' },
  { value: 'renewal', label: 'Tái tạo da' },
  { value: 'antioxidant', label: 'Chống oxy hóa' },
  { value: 'uv-protect', label: 'Chống nắng' },
  { value: 'soothe', label: 'Làm dịu' },
]

export const USE_PERIODS: { value: 'am' | 'pm' | 'both'; label: string }[] = [
  { value: 'am', label: 'Buổi sáng' },
  { value: 'pm', label: 'Buổi tối' },
  { value: 'both', label: 'Sáng và tối' },
]

export const APPLY_ZONES: { value: ApplyZone; label: string }[] = [
  { value: 'face', label: 'Toàn mặt' },
  { value: 'forehead', label: 'Trán' },
  { value: 'cheekL', label: 'Má trái' },
  { value: 'cheekR', label: 'Má phải' },
  { value: 'chin', label: 'Cằm' },
]

/** Loại sản phẩm của sàn → nhóm bước trong Skincare Architect (loại không có ở đây không đưa vào module) */
export const MODULE_CATEGORY: Partial<Record<ProductType, 'cleanser' | 'toner' | 'serum' | 'treatment' | 'moisturizer' | 'sunscreen'>> = {
  cleanser: 'cleanser',
  'men-cleanser': 'cleanser',
  toner: 'toner',
  serum: 'serum',
  exfoliant: 'treatment',
  mask: 'treatment',
  'eye-care': 'treatment',
  moisturizer: 'moisturizer',
  'men-moisturizer': 'moisturizer',
  sunscreen: 'sunscreen',
}

/** Loại sản phẩm hiện ô khai báo chu trình trong form người bán */
export const routineTypes = Object.keys(MODULE_CATEGORY) as ProductType[]

/** Nhóm hoạt chất module dùng để cảnh báo tổ hợp — nhận theo TÊN thành phần chính người bán đã nhập */
const ACTIVE_PATTERNS: [string, RegExp][] = [
  ['retinoid', /retin(ol|al|oid)|tretinoin|adapalene|bakuchiol/i],
  ['bha', /\bbha\b|salicylic/i],
  ['aha', /\baha\b|glycolic|lactic|mandelic/i],
  ['vitc', /vitamin c|ascorbic/i],
  ['niacinamide', /niacinamide/i],
]

export function activesOf(ingredients: string[]): string[] {
  return ACTIVE_PATTERNS.filter(([, re]) => ingredients.some((i) => re.test(i))).map(([k]) => k)
}

/** Sản phẩm của sàn → sản phẩm cho module ("simple shape") */
export function toModuleProduct(p: Product) {
  return {
    id: p.id,
    name: `${p.name} · ${p.brandName}`,
    category: MODULE_CATEGORY[p.type] ?? null,
    functions: p.skincareFunctions ?? [],
    recommendedPeriod: p.usePeriod ?? null,
    ingredients: p.keyIngredients,
    actives: activesOf(p.keyIngredients),
    zones: p.applyZones ?? [],
    usageInstructions: p.howToUse ?? '',
    warnings: [] as string[],
  }
}

export function isRoutineReady(p: Product): boolean {
  return !!MODULE_CATEGORY[p.type] && (p.skincareFunctions?.length ?? 0) > 0 && !!p.usePeriod
}

/** Câu trả lời Beauty Finder (da mặt) → mục tiêu / loại da của module. Chỉ đổi tên, không thêm mục tiêu người dùng không chọn. */
/** Mục tiêu của module → công dụng đáp ứng; avoid: hoạt chất module giữ ngoài chu trình (giống modules/skincare-3d/js/rules.js) */
export const MODULE_GOALS: Record<string, { functions: SkincareFunction[]; avoidActives?: string[] }> = {
  sensitive: { functions: ['soothe'], avoidActives: ['retinoid', 'bha', 'aha', 'vitc'] },
  acne: { functions: ['exfoliate', 'renewal'] },
  oil: { functions: ['oil-control', 'exfoliate'] },
  hydrate: { functions: ['hydrate'] },
  basic: { functions: [] },
}
/** Bước của module bắt buộc (luôn xếp); bước còn lại chỉ nhận sản phẩm có công dụng khớp mục tiêu */
export const CORE_STEPS = ['cleanser', 'moisturizer', 'sunscreen']

export function finderToModuleQuiz(concerns: SkinConcern[], skinType: SkinType | 'unsure'): { goals: string[]; skin: string } {
  const goals = new Set<string>()
  if (concerns.includes('dehydration')) goals.add('hydrate')
  if (concerns.includes('acne')) goals.add('acne')
  if (concerns.includes('pores')) goals.add('oil')
  if (concerns.includes('redness') || skinType === 'sensitive') goals.add('sensitive')
  if (!goals.size) goals.add('basic')
  const skin = skinType === 'dry' ? 'dry' : skinType === 'oily' ? 'oily' : skinType === 'combination' ? 'mixed' : 'unsure'
  return { goals: [...goals], skin }
}

/** Các dòng "Thông tin chi tiết" cho dữ liệu chu trình do cửa hàng khai báo (chỉ hiện khi có) */
export function routineRows(p: Product): { key: string; label: string; text: string }[] {
  const label = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((x) => x.value === v)?.label ?? v
  const rows: { key: string; label: string; text: string }[] = []
  if (p.skincareFunctions?.length) rows.push({ key: 'skc-fn', label: 'Công dụng (cửa hàng khai báo)', text: p.skincareFunctions.map((f) => label(SKINCARE_FUNCTIONS, f)).join(', ') })
  if (p.usePeriod) rows.push({ key: 'skc-period', label: 'Thời điểm dùng', text: label(USE_PERIODS, p.usePeriod) })
  if (p.applyZones?.length) rows.push({ key: 'skc-zone', label: 'Vùng thoa', text: p.applyZones.map((z) => label(APPLY_ZONES, z)).join(', ') })
  return rows
}
