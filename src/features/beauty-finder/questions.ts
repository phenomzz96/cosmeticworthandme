import { concernLabels, productTypeLabels, skinTypeLabels, typesByCategory } from '@/data/taxonomy'
import type { ProductType, SkinConcern, SkinType } from '@/types/catalog'

/**
 * BEAUTY FINDER — câu hỏi. Câu hỏi thay đổi theo nhóm sản phẩm người dùng chọn (da, trang điểm, tóc, cơ thể, nước hoa),
 * nên mỗi người chỉ trả lời 4–7 câu liên quan tới mình.
 * Loại da do người dùng TỰ CHỌN (có "Mình chưa rõ"); Beauty Finder không tự đánh giá hay chẩn đoán làn da.
 */

export type Audience = 'female' | 'male' | 'any'
export type Focus = 'skincare' | 'makeup' | 'haircare' | 'body' | 'fragrance'
export type CareNeed = 'basic' | 'targeted' | 'complete'
export type BudgetKey = 'under-200' | '200-400' | '400-700' | 'over-700' | 'any'
export type Avoid = 'fragrance' | 'alcohol' | 'strong-actives'
export type Texture = 'light' | 'rich' | 'any'
export type Finish = 'natural' | 'dewy' | 'matte' | 'any'
export type HairConcern = 'oily-scalp' | 'dandruff' | 'dry-damaged' | 'colored' | 'hair-fall' | 'styling'
export type BodyNeed = 'hydrate' | 'smooth' | 'scent' | 'deodorant'
export type ScentFamily = 'floral' | 'woody' | 'fresh' | 'sweet' | 'musky'
export type Occasion = 'daily' | 'work' | 'date' | 'party' | 'any'
export type Intensity = 'light' | 'medium' | 'strong' | 'any'

/** Câu trả lời của người dùng cho Beauty Finder */
export interface FinderAnswers {
  audience: Audience
  focus: Focus
  skinType: SkinType | 'unsure'
  concerns: SkinConcern[]
  need: CareNeed
  avoid: Avoid[]
  texture: Texture
  finish: Finish
  hair: HairConcern[]
  body: BodyNeed[]
  scents: ScentFamily[]
  occasion: Occasion
  intensity: Intensity
  budget: BudgetKey
  /** Rỗng = để hệ thống gợi ý mọi loại trong nhóm */
  types: ProductType[]
}

export const defaultAnswers: FinderAnswers = {
  audience: 'any',
  focus: 'skincare',
  skinType: 'unsure',
  concerns: [],
  need: 'basic',
  avoid: [],
  texture: 'any',
  finish: 'any',
  hair: [],
  body: [],
  scents: [],
  occasion: 'any',
  intensity: 'any',
  budget: 'any',
  types: [],
}

export const MAX_CONCERNS = 3
export const MAX_SCENTS = 2

export interface Choice<T extends string> {
  value: T
  label: string
  hint?: string
}

export const audienceOptions: Choice<Audience>[] = [
  { value: 'female', label: 'Cho nữ', hint: 'Ưu tiên sản phẩm và mùi hương dành cho nữ' },
  { value: 'male', label: 'Cho nam', hint: 'Ưu tiên đồ chăm sóc nam, nước hoa nam' },
  { value: 'any', label: 'Không phân biệt', hint: 'Gợi ý sản phẩm dùng chung cho mọi người' },
]

export const focusOptions: Choice<Focus>[] = [
  { value: 'skincare', label: 'Chăm sóc da mặt', hint: 'Làm sạch, dưỡng, chống nắng, đặc trị' },
  { value: 'makeup', label: 'Trang điểm', hint: 'Nền, che khuyết điểm, môi, mắt, má' },
  { value: 'haircare', label: 'Chăm sóc tóc', hint: 'Gội, xả, ủ, dưỡng, tạo kiểu' },
  { value: 'body', label: 'Chăm sóc cơ thể', hint: 'Sữa tắm, dưỡng thể, khử mùi' },
  { value: 'fragrance', label: 'Nước hoa', hint: 'Tìm mùi hương hợp với bạn' },
]

export const skinTypeOptions: Choice<FinderAnswers['skinType']>[] = [
  { value: 'oily', label: skinTypeLabels.oily, hint: 'Bóng dầu toàn mặt sau vài giờ' },
  { value: 'dry', label: skinTypeLabels.dry, hint: 'Hay căng, bong tróc nhẹ' },
  { value: 'combination', label: skinTypeLabels.combination, hint: 'Dầu vùng chữ T, khô hai má' },
  { value: 'normal', label: skinTypeLabels.normal, hint: 'Ít khi quá dầu hay quá khô' },
  { value: 'sensitive', label: skinTypeLabels.sensitive, hint: 'Dễ đỏ, châm chích khi đổi sản phẩm' },
  { value: 'unsure', label: 'Mình chưa rõ', hint: 'Gợi ý sản phẩm hợp nhiều loại da' },
]

export const concernOptions: Choice<SkinConcern>[] = (Object.keys(concernLabels) as SkinConcern[]).map((value) => ({
  value,
  label: concernLabels[value],
}))

export const needOptions: Choice<CareNeed>[] = [
  { value: 'basic', label: 'Cơ bản, ít bước', hint: 'Làm sạch, dưỡng ẩm, chống nắng' },
  { value: 'targeted', label: 'Tập trung vào vấn đề da', hint: 'Serum, toner, mặt nạ, tẩy tế bào chết' },
  { value: 'complete', label: 'Đầy đủ nhiều bước', hint: 'Gợi ý sản phẩm cho nhiều bước khác nhau' },
]

export const avoidOptions: Choice<Avoid>[] = [
  { value: 'fragrance', label: 'Hương liệu', hint: 'Ưu tiên sản phẩm ghi rõ không hương liệu' },
  { value: 'alcohol', label: 'Cồn khô', hint: 'Tránh sản phẩm có cồn trong thành phần chính' },
  { value: 'strong-actives', label: 'Hoạt chất mạnh', hint: 'Bỏ qua Retinol, AHA, BHA, Vitamin C nồng độ cao' },
]

export const textureOptions: Choice<Texture>[] = [
  { value: 'light', label: 'Mỏng nhẹ', hint: 'Gel, dạng lỏng, thấm nhanh' },
  { value: 'rich', label: 'Đặc, giàu dưỡng', hint: 'Kem đặc, dầu, sáp' },
  { value: 'any', label: 'Sao cũng được' },
]

export const finishOptions: Choice<Finish>[] = [
  { value: 'natural', label: 'Tự nhiên', hint: 'Lớp mỏng, như không trang điểm' },
  { value: 'dewy', label: 'Căng bóng', hint: 'Bóng khỏe, mọng nước' },
  { value: 'matte', label: 'Lì, ráo mịn', hint: 'Kiềm dầu, ít bóng' },
  { value: 'any', label: 'Sao cũng được' },
]

export const hairOptions: Choice<HairConcern>[] = [
  { value: 'oily-scalp', label: 'Da đầu dầu, tóc nhanh bết' },
  { value: 'dandruff', label: 'Gàu, ngứa da đầu' },
  { value: 'dry-damaged', label: 'Tóc khô xơ, chẻ ngọn' },
  { value: 'colored', label: 'Tóc nhuộm, uốn' },
  { value: 'hair-fall', label: 'Tóc dễ gãy rụng' },
  { value: 'styling', label: 'Cần tạo kiểu, giữ nếp' },
]

export const bodyOptions: Choice<BodyNeed>[] = [
  { value: 'hydrate', label: 'Da khô, cần dưỡng ẩm' },
  { value: 'smooth', label: 'Da sần, muốn mịn hơn' },
  { value: 'scent', label: 'Muốn thơm lâu' },
  { value: 'deodorant', label: 'Khử mùi cơ thể' },
]

export const scentOptions: Choice<ScentFamily>[] = [
  { value: 'floral', label: 'Hoa cỏ', hint: 'Nhài, hồng, hoa trắng' },
  { value: 'fresh', label: 'Tươi mát', hint: 'Cam chanh, biển, trà xanh' },
  { value: 'woody', label: 'Gỗ ấm', hint: 'Tuyết tùng, trầm hương, hổ phách' },
  { value: 'sweet', label: 'Ngọt ngào', hint: 'Vani, trái cây, hạnh nhân' },
  { value: 'musky', label: 'Xạ hương', hint: 'Sạch, mềm, ấm' },
]

export const occasionOptions: Choice<Occasion>[] = [
  { value: 'daily', label: 'Hằng ngày, đi học' },
  { value: 'work', label: 'Đi làm, văn phòng' },
  { value: 'date', label: 'Hẹn hò, buổi tối' },
  { value: 'party', label: 'Tiệc, sự kiện' },
  { value: 'any', label: 'Nhiều dịp khác nhau' },
]

export const intensityOptions: Choice<Intensity>[] = [
  { value: 'light', label: 'Nhẹ nhàng', hint: 'Thoảng, gần mới ngửi thấy' },
  { value: 'medium', label: 'Vừa phải', hint: 'Đủ để người bên cạnh nhận ra' },
  { value: 'strong', label: 'Đậm, lưu lâu', hint: 'Ấn tượng, hợp buổi tối' },
  { value: 'any', label: 'Sao cũng được' },
]

/** Ngân sách cho MỖI sản phẩm (VND) */
export const budgetOptions: (Choice<BudgetKey> & { min?: number; max?: number })[] = [
  { value: 'under-200', label: 'Dưới 200.000đ', max: 200_000 },
  { value: '200-400', label: '200.000đ – 400.000đ', min: 200_000, max: 400_000 },
  { value: '400-700', label: '400.000đ – 700.000đ', min: 400_000, max: 700_000 },
  { value: 'over-700', label: 'Trên 700.000đ', min: 700_000 },
  { value: 'any', label: 'Không giới hạn' },
]

/** Loại sản phẩm thuộc từng nhóm */
export const focusTypes: Record<Focus, ProductType[]> = {
  skincare: [...typesByCategory.skincare, 'men-cleanser', 'men-moisturizer', 'shaving', 'beard-care'],
  makeup: typesByCategory.makeup,
  haircare: typesByCategory.haircare,
  body: [...typesByCategory['body-care'], 'body-mist'],
  fragrance: typesByCategory.fragrance,
}

/** Loại người dùng chọn được ở câu "Bạn tìm loại nào" (chỉ hỏi với trang điểm) */
export const makeupTypeOptions = typesByCategory.makeup.map((value) => ({ value, label: productTypeLabels[value] }))

// ------------------------------------------------------------------ CÁC BƯỚC (thay đổi theo nhóm sản phẩm)

export type StepKey =
  | 'audience'
  | 'focus'
  | 'skin'
  | 'concerns'
  | 'prefs'
  | 'need'
  | 'finish'
  | 'makeupTypes'
  | 'hair'
  | 'body'
  | 'avoid'
  | 'scents'
  | 'occasion'
  | 'intensity'
  | 'budget'

export function stepsFor(focus: Focus): StepKey[] {
  switch (focus) {
    case 'skincare':
      return ['audience', 'focus', 'skin', 'concerns', 'prefs', 'need', 'budget']
    case 'makeup':
      return ['audience', 'focus', 'skin', 'finish', 'makeupTypes', 'budget']
    case 'haircare':
      return ['audience', 'focus', 'hair', 'budget']
    case 'body':
      return ['audience', 'focus', 'body', 'avoid', 'budget']
    case 'fragrance':
      return ['audience', 'focus', 'scents', 'occasion', 'intensity', 'budget']
  }
}

export const stepLabels: Record<StepKey, string> = {
  audience: 'Dành cho ai',
  focus: 'Nhóm sản phẩm',
  skin: 'Loại da',
  concerns: 'Mối quan tâm',
  prefs: 'Điều cần tránh',
  need: 'Số bước',
  finish: 'Lớp nền',
  makeupTypes: 'Loại sản phẩm',
  hair: 'Tình trạng tóc',
  body: 'Nhu cầu',
  avoid: 'Điều cần tránh',
  scents: 'Nhóm hương',
  occasion: 'Dịp dùng',
  intensity: 'Độ đậm',
  budget: 'Ngân sách',
}

// -------- Lưu câu trả lời trên URL để quay lại, chia sẻ, tải lại trang --------

const list = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  [...new Set((v ?? '').split(',').filter((x): x is T => (allowed as readonly string[]).includes(x)))]
const one = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
const values = <T extends string>(opts: Choice<T>[]) => opts.map((o) => o.value)

export function answersToParams(a: FinderAnswers): URLSearchParams {
  const p = new URLSearchParams()
  p.set('focus', a.focus)
  if (a.audience !== 'any') p.set('for', a.audience)
  if (a.skinType !== 'unsure') p.set('skin', a.skinType)
  const put = (k: string, v: string[] | string, skip: string) => {
    const s = Array.isArray(v) ? v.join(',') : v
    if (s && s !== skip) p.set(k, s)
  }
  put('concerns', a.concerns, '')
  if (a.focus === 'skincare') put('need', a.need, 'basic')
  put('avoid', a.avoid, '')
  put('tex', a.texture, 'any')
  put('finish', a.finish, 'any')
  put('hair', a.hair, '')
  put('body', a.body, '')
  put('scents', a.scents, '')
  put('occ', a.occasion, 'any')
  put('int', a.intensity, 'any')
  put('budget', a.budget, 'any')
  put('types', a.types, '')
  p.set('done', '1')
  return p
}

/** Đọc câu trả lời đã gửi (có ?done=1, hoặc dạng cũ có ?skin=...&need=...) */
export function answersFromParams(p: URLSearchParams): FinderAnswers | null {
  const legacy = p.has('skin') && p.has('need') && !p.has('focus')
  if (p.get('done') !== '1' && !legacy) return null
  const focus = one(p.get('focus'), values(focusOptions), 'skincare')
  const avoid = list(p.get('avoid'), values(avoidOptions))
  if (p.get('ff') === '1' && !avoid.includes('fragrance')) avoid.push('fragrance')
  return {
    audience: one(p.get('for'), values(audienceOptions), 'any'),
    focus,
    skinType: one(p.get('skin'), values(skinTypeOptions), 'unsure'),
    concerns: list(p.get('concerns'), values(concernOptions)).slice(0, MAX_CONCERNS),
    need: one(p.get('need'), values(needOptions), 'basic'),
    avoid,
    texture: one(p.get('tex'), values(textureOptions), 'any'),
    finish: one(p.get('finish'), values(finishOptions), 'any'),
    hair: list(p.get('hair'), values(hairOptions)),
    body: list(p.get('body'), values(bodyOptions)),
    scents: list(p.get('scents'), values(scentOptions)).slice(0, MAX_SCENTS),
    occasion: one(p.get('occ'), values(occasionOptions), 'any'),
    intensity: one(p.get('int'), values(intensityOptions), 'any'),
    budget: one(p.get('budget'), values(budgetOptions), 'any'),
    types: list(p.get('types'), focusTypes[focus]),
  }
}

/** Câu trả lời chọn sẵn từ đường dẫn (?for=male, ?focus=fragrance, ?start=oily) và bước bắt đầu */
export function presetFromParams(p: URLSearchParams): { answers: FinderAnswers; step: number } {
  const a: FinderAnswers = { ...defaultAnswers }
  const audience = p.get('for')
  const focus = p.get('focus')
  const start = p.get('start')
  let step = 0
  if (audience && values(audienceOptions).includes(audience as Audience)) {
    a.audience = audience as Audience
    step = 1
  }
  if (focus && values(focusOptions).includes(focus as Focus)) {
    a.focus = focus as Focus
    step = 2
  }
  if (start && values(skinTypeOptions).includes(start as SkinType)) {
    a.focus = 'skincare'
    a.skinType = start as SkinType
    step = stepsFor('skincare').indexOf('concerns')
  }
  return { answers: a, step }
}
