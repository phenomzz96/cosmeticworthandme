/**
 * BEAUTY FINDER — thuật toán lọc và chấm điểm theo thuộc tính sản phẩm.
 * Không dùng AI. Toàn bộ là hàm thuần (pure function) nên dễ kiểm thử và dễ chuyển lên server sau này.
 *
 * Quy trình:
 *   1. Loại bỏ: hết hàng, không thuộc nhóm sản phẩm đã chọn, sai loại người dùng chọn, không hợp loại da,
 *      có hoạt chất mạnh khi người dùng muốn tránh, vượt ngân sách quá xa.
 *   2. Cộng/trừ điểm theo từng tiêu chí người dùng đã trả lời; mỗi lần cộng điểm sinh ra một "lý do gợi ý",
 *      mỗi lần trừ điểm sinh ra một "lưu ý".
 *   3. % phù hợp = điểm đạt được / điểm tối đa của CÁC TIÊU CHÍ NGƯỜI DÙNG ĐÃ TRẢ LỜI.
 *
 * Tiêu chí về tóc, cơ thể, mùi hương dựa trên chữ trong tên, mô tả và thành phần chính do cửa hàng nhập.
 *
 * LƯU Ý: kết quả chỉ là gợi ý mua sắm dựa trên mô tả sản phẩm, không phải chẩn đoán
 * hay lời khuyên điều trị da liễu.
 */
import { concernLabels, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import { routineStepOf } from '@/features/routine/routine'
import { activesOf, CORE_STEPS, finderToModuleQuiz, isRoutineReady, MODULE_CATEGORY, MODULE_GOALS, SKINCARE_FUNCTIONS } from '@/features/skincare-3d/routineFields'
import { normalizeVi } from '@/lib/text'
import type { Product, ProductType, SkincareFunction, SkinConcern } from '@/types/catalog'
import {
  bodyOptions,
  budgetOptions,
  focusTypes,
  hairOptions,
  occasionOptions,
  scentOptions,
  type BodyNeed,
  type CareNeed,
  type FinderAnswers,
  type HairConcern,
  type Occasion,
  type ScentFamily,
} from './questions'

export interface FinderResult {
  product: Product
  score: number
  /** 0–100, mức độ khớp tương đối để hiển thị */
  match: number
  reasons: string[]
  cautions: string[]
}

export const WEIGHTS = {
  skinType: 30,
  concernEach: 22,
  concernMax: 50,
  need: 14,
  budget: 14,
  slightlyOverBudget: -8,
  fragranceFree: 10,
  fragranceUnknown: -5,
  alcoholFree: 6,
  alcohol: -15,
  texture: 8,
  finish: 14,
  hairEach: 18,
  hairMax: 36,
  bodyEach: 18,
  bodyMax: 30,
  scentEach: 20,
  scentMax: 32,
  occasion: 10,
  intensity: 10,
  audience: 20,
  audienceMismatch: -14,
  strongActiveForSensitive: -15,
  ratingFactor: 8,
  declaredFunction: 14,
  routineReady: 6,
} as const

/** Vượt ngân sách tối đa bao nhiêu % vẫn được giữ lại (kèm lưu ý) */
const BUDGET_TOLERANCE = 0.1

const needTypes: Record<CareNeed, ProductType[]> = {
  basic: ['cleanser', 'men-cleanser', 'moisturizer', 'men-moisturizer', 'sunscreen'],
  targeted: ['serum', 'toner', 'mask', 'eye-care', 'exfoliant'],
  complete: ['cleanser', 'men-cleanser', 'toner', 'serum', 'moisturizer', 'men-moisturizer', 'sunscreen', 'mask', 'eye-care', 'exfoliant', 'lip-care'],
}

/** Hoạt chất mạnh: nhận diện theo tên thành phần chính */
/**
 * Hoạt chất mạnh: dùng CHUNG nhóm hoạt chất với Skincare Architect 3D (retinoid, BHA, AHA, Vitamin C — các hoạt chất
 * module giữ ngoài chu trình khi chọn mục tiêu "da dễ kích ứng"), để hai tính năng không cho kết quả ngược nhau.
 */
const STRONG = ['retinoid', 'bha', 'aha', 'vitc']

/**
 * Mối quan tâm → công dụng người bán khai báo (skincare_functions, migration 010).
 * Bốn dòng đầu khớp bộ quy tắc mục tiêu của Skincare Architect (acne, oil, hydrate, sensitive).
 */
export const concernFunctions: Record<SkinConcern, SkincareFunction[]> = {
  acne: ['exfoliate', 'renewal', 'oil-control'],
  pores: ['oil-control', 'exfoliate'],
  dehydration: ['hydrate'],
  redness: ['soothe'],
  dullness: ['antioxidant', 'exfoliate'],
  'dark-spots': ['antioxidant'],
  aging: ['renewal', 'antioxidant'],
  'sun-protection': ['uv-protect'],
}
const fnLabel = (f: SkincareFunction) => SKINCARE_FUNCTIONS.find((x) => x.value === f)?.label.toLowerCase() ?? f

/** Từ khóa (đã bỏ dấu) cho tiêu chí dựa trên mô tả */
const hairKeywords: Record<HairConcern, RegExp> = {
  'oily-scalp': /\b(dau thua|bet|lam sach|da dau|kiem dau)\b/,
  dandruff: /\b(gau|ngua|da dau)\b/,
  'dry-damaged': /\b(kho|xo|che ngon|phuc hoi|mem|muot|roi)\b/,
  colored: /\b(nhuom|uon|giu mau)\b/,
  'hair-fall': /\b(gay rung|rung|chac khoe|ha thu o|bo ket)\b/,
  styling: /\b(tao kieu|vuot|wax|gom|giu nep|sap)\b/,
}
const hairTypes: Record<HairConcern, ProductType[]> = {
  'oily-scalp': ['shampoo'],
  dandruff: ['shampoo'],
  'dry-damaged': ['conditioner', 'hair-mask', 'hair-oil'],
  colored: ['conditioner', 'hair-mask'],
  'hair-fall': ['shampoo', 'hair-oil'],
  styling: ['hair-styling'],
}
const bodyTypes: Record<BodyNeed, ProductType[]> = {
  hydrate: ['body-lotion', 'hand-cream'],
  smooth: ['body-scrub'],
  scent: ['body-mist', 'body-wash', 'body-lotion'],
  deodorant: ['deodorant'],
}
const bodyKeywords: Record<BodyNeed, RegExp> = {
  hydrate: /\b(duong am|kho|mem|duong the)\b/,
  smooth: /\b(san|min|tay te bao chet)\b/,
  scent: /\b(huong|thom)\b/,
  deodorant: /\b(khu mui)\b/,
}
const scentKeywords: Record<ScentFamily, RegExp> = {
  floral: /\b(hoa|nhai|hong|floral|hoa co)\b/,
  fresh: /\b(cam|chanh|bergamot|bien|tra xanh|gung|tuoi mat|bac ha)\b/,
  woody: /\b(go|tuyet tung|tram|dan huong|ho phach|hoac huong|tieu den)\b/,
  sweet: /\b(vani|ngot|dao|le|hanh nhan|trai cay)\b/,
  musky: /\b(xa huong|musk)\b/,
}
const occasionKeywords: Record<Exclude<Occasion, 'any'>, RegExp> = {
  daily: /\b(hang ngay|di hoc|de dung)\b/,
  work: /\b(di lam|van phong|hang ngay)\b/,
  date: /\b(hen ho|buoi toi)\b/,
  party: /\b(tiec|su kien|buoi toi)\b/,
}
const intensityKeywords = {
  light: /\b(nhe|thoang|tuoi mat|toilette|dang xit)\b/,
  medium: /\b(vua|eau de parfum)\b/,
  strong: /\b(dam|luu huong lau|extrait|am)\b/,
}

function bodyHit(b: BodyNeed, p: Product, text: string): boolean {
  switch (b) {
    case 'deodorant':
      return p.type === 'deodorant'
    case 'scent':
      return p.type === 'body-mist' || (bodyTypes.scent.includes(p.type) && bodyKeywords.scent.test(text))
    default:
      return bodyTypes[b].includes(p.type) || bodyKeywords[b].test(text)
  }
}

const label = <T extends string>(opts: { value: T; label: string }[], v: T) => opts.find((o) => o.value === v)?.label.toLowerCase() ?? v

function textOf(p: Product): string {
  return normalizeVi([p.name, p.description, p.texture ?? '', ...p.keyIngredients].join(' ')).replace(/[^a-z0-9%]+/g, ' ')
}

export function scoreProducts(products: Product[], answers: FinderAnswers): FinderResult[] {
  const budget = budgetOptions.find((b) => b.value === answers.budget)
  const allowed = focusTypes[answers.focus]
  const skin = answers.skinType === 'unsure' ? null : answers.skinType
  const results: FinderResult[] = []

  for (const p of products) {
    // ---------- 1. Bộ lọc bắt buộc ----------
    if (p.stock <= 0) continue
    if (!allowed.includes(p.type)) continue
    if (answers.types.length && !answers.types.includes(p.type)) continue
    // Cạo râu, chăm sóc râu chỉ gợi ý khi tìm cho nam
    if ((p.type === 'shaving' || p.type === 'beard-care') && answers.audience !== 'male') continue

    const usesSkin = answers.focus === 'skincare' || answers.focus === 'makeup' || answers.focus === 'body'
    const skinSpecific = p.skinTypes.length > 0
    if (usesSkin && skin && skinSpecific && !p.skinTypes.includes(skin)) continue

    const hasStrongActive = activesOf(p.keyIngredients).some((a) => STRONG.includes(a))
    if (hasStrongActive && answers.avoid.includes('strong-actives')) continue

    let overBudget = false
    if (budget?.max != null && p.price > budget.max) {
      if (p.price > budget.max * (1 + BUDGET_TOLERANCE)) continue
      overBudget = true
    }
    if (budget?.min != null && p.price < budget.min * (1 - BUDGET_TOLERANCE)) continue

    // ---------- 2. Chấm điểm ----------
    let score = 0
    let possible = WEIGHTS.ratingFactor
    const reasons: string[] = []
    const cautions: string[] = []
    const text = textOf(p)

    // Dành cho ai
    if (answers.audience !== 'any') {
      possible += WEIGHTS.audience
      const forMen = p.categoryId === 'men' || p.type === 'perfume-men'
      const forWomen = p.type === 'perfume-women'
      const unisex = p.type === 'perfume-unisex' || /\b(ca nam va nu|nam va nu|unisex)\b/.test(text)
      if (answers.audience === 'male') {
        if (forMen) {
          score += WEIGHTS.audience
          reasons.push('Dành cho nam')
        } else if (unisex) {
          score += WEIGHTS.audience / 2
          reasons.push('Dùng được cho cả nam và nữ')
        } else if (forWomen) {
          score += WEIGHTS.audienceMismatch
          cautions.push('Mùi hương thiết kế hướng tới nữ')
        }
      } else {
        if (forWomen) {
          score += WEIGHTS.audience
          reasons.push('Dành cho nữ')
        } else if (unisex) {
          score += WEIGHTS.audience / 2
          reasons.push('Dùng được cho cả nam và nữ')
        } else if (forMen) {
          score += WEIGHTS.audienceMismatch
          cautions.push(p.type === 'perfume-men' ? 'Mùi hương thiết kế hướng tới nam' : 'Sản phẩm thiết kế cho nam giới')
        }
      }
    }

    // Loại da (da mặt, trang điểm, cơ thể)
    if (usesSkin) {
      possible += WEIGHTS.skinType
      if (skin && skinSpecific) {
        score += WEIGHTS.skinType
        reasons.push(`Phù hợp ${skinTypeLabels[skin].toLowerCase()}`)
      } else if (!skin && p.skinTypes.length >= 4) {
        score += WEIGHTS.skinType / 2
        reasons.push('Dùng được cho nhiều loại da')
      } else if (!skin && skinSpecific) {
        score += WEIGHTS.skinType / 4
      } else if (!skinSpecific) {
        score += WEIGHTS.skinType / 3
      }
    }

    // Mối quan tâm về da
    if (answers.focus === 'skincare' && answers.concerns.length) {
      possible += WEIGHTS.concernMax
      const matched = answers.concerns.filter((c) => p.concerns.includes(c))
      if (matched.length) {
        score += Math.min(WEIGHTS.concernMax, matched.length * WEIGHTS.concernEach)
        reasons.push(`Hướng tới: ${matched.map((c) => concernLabels[c].toLowerCase()).join(', ')}`)
      }
      // Công dụng người bán khai báo (cùng dữ liệu Skincare Architect dùng để xếp chu trình)
      possible += WEIGHTS.declaredFunction
      const wanted = new Set(answers.concerns.flatMap((c) => concernFunctions[c]))
      const fns = (p.skincareFunctions ?? []).filter((f) => wanted.has(f))
      if (fns.length) {
        score += WEIGHTS.declaredFunction
        reasons.push(`Công dụng khai báo: ${fns.map(fnLabel).join(', ')}`)
      }
    }

    // Đủ thông tin để Skincare Architect 3D xếp vào chu trình
    if (answers.focus === 'skincare' && MODULE_CATEGORY[p.type]) {
      possible += WEIGHTS.routineReady
      if (isRoutineReady(p)) {
        score += WEIGHTS.routineReady
        reasons.push(`Xếp được vào chu trình 3D (dùng ${p.usePeriod === 'am' ? 'buổi sáng' : p.usePeriod === 'pm' ? 'buổi tối' : 'cả sáng và tối'})`)
      } else cautions.push('Cửa hàng chưa khai báo công dụng/thời điểm dùng: chưa xếp được vào chu trình 3D')
    }

    // Số bước chăm sóc
    if (answers.focus === 'skincare') {
      possible += WEIGHTS.need
      if (needTypes[answers.need].includes(p.type)) {
        score += WEIGHTS.need
        const step = routineStepOf(p.type)
        if (step) reasons.push(`Thuộc bước "${step.label.toLowerCase()}"`)
      }
    }

    // Điều cần tránh
    if (answers.avoid.includes('fragrance') || (answers.skinType === 'sensitive' && answers.focus !== 'fragrance')) {
      possible += WEIGHTS.fragranceFree
      if (p.fragranceFree) {
        score += WEIGHTS.fragranceFree
        reasons.push('Không hương liệu')
      } else if (answers.avoid.includes('fragrance')) {
        score += WEIGHTS.fragranceUnknown
        cautions.push('Cửa hàng chưa ghi sản phẩm không hương liệu')
      }
    }
    if (answers.avoid.includes('alcohol')) {
      possible += WEIGHTS.alcoholFree
      if (/\bkhong con\b/.test(text)) {
        score += WEIGHTS.alcoholFree
        reasons.push('Không cồn')
      } else if (/\b(con|alcohol denat|ethanol)\b/.test(text)) {
        score += WEIGHTS.alcohol
        cautions.push('Thành phần có nhắc tới cồn')
      }
    }

    // Kết cấu
    if (answers.focus === 'skincare' && answers.texture !== 'any' && p.texture) {
      possible += WEIGHTS.texture
      const t = normalizeVi(p.texture)
      const light = /gel|long|nuoc|mong|serum|xit/.test(t)
      const rich = /dac|dau|sap|balm|kem mem/.test(t)
      if ((answers.texture === 'light' && light) || (answers.texture === 'rich' && rich)) {
        score += WEIGHTS.texture
        reasons.push(`Kết cấu ${p.texture.toLowerCase()}`)
      }
    }

    // Lớp nền trang điểm
    if (answers.focus === 'makeup' && answers.finish !== 'any') {
      possible += WEIGHTS.finish
      const re = { natural: /\b(tu nhien|mong)\b/, dewy: /\b(cang bong|bong|tint|mong nuoc)\b/, matte: /\b(li|rao|kiem dau|matte)\b/ }[answers.finish]
      if (re.test(text)) {
        score += WEIGHTS.finish
        reasons.push(`Hiệu ứng ${answers.finish === 'natural' ? 'tự nhiên' : answers.finish === 'dewy' ? 'căng bóng' : 'lì, ráo mịn'}`)
      }
    }

    // Tóc
    if (answers.focus === 'haircare' && answers.hair.length) {
      possible += WEIGHTS.hairMax
      const hit = answers.hair.filter((h) => hairKeywords[h].test(text) || hairTypes[h].includes(p.type))
      if (hit.length) {
        score += Math.min(WEIGHTS.hairMax, hit.length * WEIGHTS.hairEach)
        reasons.push(`Hợp với: ${hit.map((h) => label(hairOptions, h)).join(', ')}`)
      }
    }

    // Cơ thể
    if (answers.focus === 'body' && answers.body.length) {
      possible += WEIGHTS.bodyMax
      const hit = answers.body.filter((b) => bodyHit(b, p, text))
      if (hit.length) {
        score += Math.min(WEIGHTS.bodyMax, hit.length * WEIGHTS.bodyEach)
        reasons.push(`Đáp ứng: ${hit.map((b) => label(bodyOptions, b)).join(', ')}`)
      }
    }

    // Nước hoa
    if (answers.focus === 'fragrance') {
      if (answers.scents.length) {
        possible += WEIGHTS.scentMax
        // Bỏ chữ "nước hoa" để không nhầm mọi chai nước hoa là nhóm hương hoa cỏ
        // Chỉ xét mô tả và nốt hương (tên như "Đào Hồng" là màu sắc, không phải hương hoa hồng)
        const notes = normalizeVi([p.description, ...p.keyIngredients].join(' ')).replace(/[^a-z0-9%]+/g, ' ').replace(/\bnuoc hoa\b/g, ' ')
        const hit = answers.scents.filter((s) => scentKeywords[s].test(notes))
        if (hit.length) {
          score += Math.min(WEIGHTS.scentMax, hit.length * WEIGHTS.scentEach)
          reasons.push(`Nhóm hương ${hit.map((s) => label(scentOptions, s)).join(', ')}${p.keyIngredients.length ? ` (${p.keyIngredients.slice(0, 3).join(', ').toLowerCase()})` : ''}`)
        }
      }
      if (answers.occasion !== 'any') {
        possible += WEIGHTS.occasion
        if (occasionKeywords[answers.occasion].test(text)) {
          score += WEIGHTS.occasion
          reasons.push(`Hợp dịp ${label(occasionOptions, answers.occasion)}`)
        }
      }
      if (answers.intensity !== 'any') {
        possible += WEIGHTS.intensity
        if (intensityKeywords[answers.intensity].test(text) || (answers.intensity === 'light' && p.type === 'body-mist')) {
          score += WEIGHTS.intensity
          reasons.push(answers.intensity === 'light' ? 'Mùi nhẹ nhàng' : answers.intensity === 'strong' ? 'Mùi đậm, ấn tượng' : 'Độ đậm vừa phải')
        }
      }
    }

    // Ngân sách
    if (budget && budget.value !== 'any') {
      possible += WEIGHTS.budget
      if (overBudget) {
        score += WEIGHTS.slightlyOverBudget
        cautions.push('Giá cao hơn ngân sách một chút')
      } else {
        score += WEIGHTS.budget
        reasons.push('Nằm trong ngân sách bạn chọn')
      }
    }

    if (hasStrongActive) {
      if (answers.skinType === 'sensitive') score += WEIGHTS.strongActiveForSensitive
      cautions.push('Có hoạt chất mạnh: nên thử trên vùng da nhỏ và tăng tần suất từ từ')
    }

    score += Math.max(0, p.rating - 4) * WEIGHTS.ratingFactor

    if (!reasons.length) reasons.push(p.rating > 0 ? `${productTypeLabels[p.type]} được đánh giá ${p.rating.toFixed(1)}/5` : `Thuộc nhóm ${productTypeLabels[p.type].toLowerCase()}`)

    results.push({
      product: p,
      score,
      match: Math.max(5, Math.min(100, Math.round((score / possible) * 100))),
      reasons,
      cautions,
    })
  }

  return results.sort((a, b) => b.score - a.score || b.product.rating - a.product.rating || b.product.soldCount - a.product.soldCount)
}

/** Gợi ý nới điều kiện khi không có kết quả */
export function relaxSuggestions(answers: FinderAnswers): { label: string; answers: FinderAnswers }[] {
  const out: { label: string; answers: FinderAnswers }[] = []
  if (answers.types.length) out.push({ label: 'Bỏ giới hạn loại sản phẩm', answers: { ...answers, types: [] } })
  if (answers.budget !== 'any') out.push({ label: 'Không giới hạn ngân sách', answers: { ...answers, budget: 'any' } })
  if (answers.avoid.length) out.push({ label: 'Bỏ bớt điều cần tránh', answers: { ...answers, avoid: [] } })
  if (answers.skinType !== 'unsure' && answers.focus !== 'fragrance' && answers.focus !== 'haircare')
    out.push({ label: 'Gợi ý cho mọi loại da', answers: { ...answers, skinType: 'unsure' } })
  return out
}

/** Thành phần thường gặp trong sản phẩm hướng tới từng mối quan tâm (thông tin tham khảo, không phải chỉ định điều trị) */
export const ingredientHints: Record<SkinConcern, string> = {
  acne: 'Salicylic Acid (BHA), Niacinamide, Kẽm PCA',
  'dark-spots': 'Niacinamide, Vitamin C',
  aging: 'Retinol, Peptide',
  dehydration: 'Hyaluronic Acid, Ceramide, Panthenol',
  pores: 'Niacinamide, BHA, đất sét Kaolin',
  dullness: 'Vitamin C, AHA/PHA',
  redness: 'Rau má, Panthenol',
  'sun-protection': 'Kem chống nắng phổ rộng SPF30 trở lên',
}

// ------------------------------------------------------------------ BỘ SẢN PHẨM CHO SKINCARE ARCHITECT 3D

/** Nhóm bước cần có theo số bước người dùng chọn (khớp các bước của Skincare Architect) */
const starterSteps: Record<CareNeed, ('cleanser' | 'toner' | 'serum' | 'treatment' | 'moisturizer' | 'sunscreen')[]> = {
  basic: ['cleanser', 'moisturizer', 'sunscreen'],
  targeted: ['cleanser', 'serum', 'treatment', 'moisturizer', 'sunscreen'],
  complete: ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'sunscreen'],
}

/**
 * Beauty Finder CHỌN sản phẩm, Skincare Architect 3D SẮP XẾP chu trình: lấy sản phẩm phù hợp nhất cho mỗi nhóm bước
 * (chỉ sản phẩm đã khai báo đủ công dụng + thời điểm dùng) để chuyển sang module. Không tự sắp sáng/tối, không kiểm tra
 * xung đột — việc đó do module làm.
 * Theo cùng quy tắc với module: bước tùy chọn (toner, serum, đặc trị) chỉ nhận sản phẩm có công dụng khớp mục tiêu, nên
 * chọn sản phẩm khớp mục tiêu cho các bước đó, và (khi khách chọn từ 4 bước) bổ sung sản phẩm cho mục tiêu còn thiếu.
 * Mục tiêu "da dễ kích ứng" hoặc khách chọn tránh hoạt chất mạnh: không chọn sản phẩm có retinoid/AHA/BHA/vitamin C.
 */
export function starterSet(results: FinderResult[], answers: FinderAnswers): FinderResult[] {
  const quiz = finderToModuleQuiz(answers.concerns, answers.skinType)
  const goalFns = new Set(quiz.goals.flatMap((g) => MODULE_GOALS[g]?.functions ?? []))
  const avoid = new Set([
    ...quiz.goals.flatMap((g) => MODULE_GOALS[g]?.avoidActives ?? []),
    ...(answers.avoid.includes('strong-actives') ? STRONG : []),
  ])
  const usable = results.filter((r) => isRoutineReady(r.product) && !activesOf(r.product.keyIngredients).some((a) => avoid.has(a)))
  const fnsOf = (r: FinderResult) => r.product.skincareFunctions ?? []
  const picked: FinderResult[] = []
  for (const cat of starterSteps[answers.need]) {
    const core = CORE_STEPS.includes(cat)
    const best = usable.find((r) => MODULE_CATEGORY[r.product.type] === cat && !picked.includes(r) && (core || fnsOf(r).some((f) => goalFns.has(f))))
    if (best) picked.push(best)
  }
  if (answers.need !== 'basic')
    for (const g of quiz.goals) {
      const fns = MODULE_GOALS[g]?.functions ?? []
      if (!fns.length || picked.some((r) => fnsOf(r).some((f) => fns.includes(f)))) continue
      const extra = usable.find((r) => !picked.includes(r) && ['serum', 'treatment'].includes(MODULE_CATEGORY[r.product.type] ?? '') && fnsOf(r).some((f) => fns.includes(f)))
      if (extra) picked.push(extra)
    }
  return picked
}
