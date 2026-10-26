/**
 * BEAUTY FINDER — thuật toán lọc và chấm điểm theo thuộc tính sản phẩm.
 * Không dùng AI. Toàn bộ là hàm thuần (pure function) nên dễ kiểm thử và dễ chuyển
 * lên server (Supabase SQL function / Edge Function) sau này.
 *
 * Quy trình:
 *   1. Loại bỏ: hết hàng, không phải sản phẩm cho da, sai loại người dùng chọn,
 *      không hợp loại da, vượt ngân sách quá xa.
 *   2. Cộng/trừ điểm theo mức độ khớp; mỗi lần cộng điểm sinh ra một "lý do gợi ý".
 *   3. Sắp xếp theo điểm, trả về kèm lý do và lưu ý.
 *
 * LƯU Ý: kết quả chỉ là gợi ý mua sắm dựa trên mô tả sản phẩm, không phải chẩn đoán
 * hay lời khuyên điều trị da liễu.
 */
import { concernLabels, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import { routineStepOf } from '@/features/routine/routine'
import type { Product, ProductType } from '@/types/catalog'
import { budgetOptions, finderProductTypes, type CareNeed, type FinderAnswers } from './questions'

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
  concernMax: 55,
  need: 15,
  inBudget: 15,
  slightlyOverBudget: -8,
  fragranceFreeMatch: 10,
  fragranceMismatch: -12,
  strongActiveForSensitive: -15,
  ratingFactor: 8,
} as const

/** Vượt ngân sách tối đa bao nhiêu % vẫn được giữ lại (kèm lưu ý) */
const BUDGET_TOLERANCE = 0.1

const needTypes: Record<CareNeed, ProductType[]> = {
  basic: ['cleanser', 'moisturizer', 'sunscreen'],
  targeted: ['serum', 'toner', 'mask', 'eye-care'],
  complete: ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask', 'eye-care'],
}

/** Hoạt chất mạnh: nhận diện theo tên thành phần chính */
const STRONG_ACTIVES = [/retinol/i, /\bbha\b/i, /salicylic/i, /vitamin c 1[5-9]|vitamin c 2/i, /\baha\b/i]

const maxScore =
  WEIGHTS.skinType + WEIGHTS.concernMax + WEIGHTS.need + WEIGHTS.inBudget + WEIGHTS.fragranceFreeMatch + WEIGHTS.ratingFactor

export function scoreProducts(products: Product[], answers: FinderAnswers): FinderResult[] {
  const budget = budgetOptions.find((b) => b.value === answers.budget)
  const results: FinderResult[] = []

  for (const p of products) {
    // ---------- 1. Bộ lọc bắt buộc ----------
    if (p.stock <= 0) continue
    if (!finderProductTypes.includes(p.type)) continue
    if (answers.types.length && !answers.types.includes(p.type)) continue

    const skinSpecific = p.skinTypes.length > 0
    const skin = answers.skinType === 'unsure' ? null : answers.skinType
    if (skin && skinSpecific && !p.skinTypes.includes(skin)) continue

    let overBudget = false
    if (budget?.max != null && p.price > budget.max) {
      if (p.price > budget.max * (1 + BUDGET_TOLERANCE)) continue
      overBudget = true
    }
    if (budget?.min != null && p.price < budget.min * (1 - BUDGET_TOLERANCE)) continue

    // ---------- 2. Chấm điểm ----------
    let score = 0
    const reasons: string[] = []
    const cautions: string[] = []

    if (skin && skinSpecific) {
      score += WEIGHTS.skinType
      reasons.push(`Phù hợp ${skinTypeLabels[skin].toLowerCase()}`)
    } else if (!skin && p.skinTypes.length >= 4) {
      score += WEIGHTS.skinType / 2
      reasons.push('Dùng được cho nhiều loại da')
    }

    const matched = answers.concerns.filter((c) => p.concerns.includes(c))
    if (matched.length) {
      score += Math.min(WEIGHTS.concernMax, matched.length * WEIGHTS.concernEach)
      reasons.push(`Hướng tới: ${matched.map((c) => concernLabels[c].toLowerCase()).join(', ')}`)
    }

    if (needTypes[answers.need].includes(p.type)) {
      score += WEIGHTS.need
      const step = routineStepOf(p.type)
      if (step) reasons.push(`Thuộc bước "${step.label.toLowerCase()}" trong chu trình`)
    }

    if (budget && budget.value !== 'any') {
      if (overBudget) {
        score += WEIGHTS.slightlyOverBudget
        cautions.push('Giá cao hơn ngân sách một chút')
      } else {
        score += WEIGHTS.inBudget
        reasons.push('Nằm trong ngân sách bạn chọn')
      }
    }

    const wantsGentle = answers.fragranceFree || answers.skinType === 'sensitive'
    if (wantsGentle) {
      if (p.fragranceFree) {
        score += WEIGHTS.fragranceFreeMatch
        reasons.push('Không hương liệu')
      } else if (answers.fragranceFree) {
        score += WEIGHTS.fragranceMismatch
        cautions.push('Sản phẩm có hương liệu')
      }
    }

    const hasStrongActive = p.keyIngredients.some((i) => STRONG_ACTIVES.some((re) => re.test(i)))
    if (hasStrongActive) {
      if (answers.skinType === 'sensitive') score += WEIGHTS.strongActiveForSensitive
      cautions.push('Có hoạt chất mạnh: nên thử trên vùng da nhỏ và tăng tần suất từ từ')
    }

    score += Math.max(0, p.rating - 4) * WEIGHTS.ratingFactor

    if (!reasons.length) reasons.push(`${productTypeLabels[p.type]} được đánh giá ${p.rating.toFixed(1)}/5`)

    results.push({
      product: p,
      score,
      match: Math.max(5, Math.min(100, Math.round((score / maxScore) * 100))),
      reasons,
      cautions,
    })
  }

  return results.sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
}

/** Gợi ý nới điều kiện khi không có kết quả */
export function relaxSuggestions(answers: FinderAnswers): { label: string; answers: FinderAnswers }[] {
  const out: { label: string; answers: FinderAnswers }[] = []
  if (answers.types.length) out.push({ label: 'Bỏ giới hạn loại sản phẩm', answers: { ...answers, types: [] } })
  if (answers.budget !== 'any') out.push({ label: 'Không giới hạn ngân sách', answers: { ...answers, budget: 'any' } })
  if (answers.fragranceFree) out.push({ label: 'Chấp nhận sản phẩm có hương liệu', answers: { ...answers, fragranceFree: false } })
  return out
}
