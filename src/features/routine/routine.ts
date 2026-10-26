/**
 * CHU TRÌNH CHĂM SÓC DA — khung dữ liệu cho tính năng "gợi ý chu trình" sau này.
 * Hiện được dùng để: gắn nhãn bước chu trình cho sản phẩm, sắp xếp kết quả Beauty Finder.
 */
import type { Product, ProductType } from '@/types/catalog'

export interface RoutineStep {
  order: number
  key: string
  label: string
  /** Thời điểm dùng: sáng, tối, cả hai hoặc vài lần mỗi tuần */
  when: 'am' | 'pm' | 'both' | 'weekly'
  types: ProductType[]
}

export const routineSteps: RoutineStep[] = [
  { order: 1, key: 'cleanse', label: 'Làm sạch', when: 'both', types: ['cleanser', 'facial-device'] },
  { order: 2, key: 'tone', label: 'Cân bằng', when: 'both', types: ['toner'] },
  { order: 3, key: 'treat', label: 'Đặc trị', when: 'both', types: ['serum'] },
  { order: 4, key: 'eye', label: 'Dưỡng mắt', when: 'both', types: ['eye-care'] },
  { order: 5, key: 'moisturize', label: 'Dưỡng ẩm', when: 'both', types: ['moisturizer'] },
  { order: 6, key: 'protect', label: 'Chống nắng', when: 'am', types: ['sunscreen'] },
  { order: 7, key: 'mask', label: 'Mặt nạ', when: 'weekly', types: ['mask'] },
]

const stepByType = new Map<ProductType, RoutineStep>()
routineSteps.forEach((s) => s.types.forEach((t) => stepByType.set(t, s)))

export function routineStepOf(type: ProductType): RoutineStep | undefined {
  return stepByType.get(type)
}

/** Sắp xếp sản phẩm theo thứ tự các bước chu trình (sản phẩm không thuộc chu trình xếp cuối) */
export function sortByRoutine<T extends Pick<Product, 'type'>>(items: T[]): T[] {
  return [...items].sort((a, b) => (routineStepOf(a.type)?.order ?? 99) - (routineStepOf(b.type)?.order ?? 99))
}

/**
 * CHƯA TRIỂN KHAI GIAO DIỆN: chọn 1 sản phẩm tốt nhất cho mỗi bước để tạo chu trình gợi ý.
 * Đầu vào là danh sách đã được chấm điểm, sắp theo điểm giảm dần.
 */
export function buildRoutine<T extends Pick<Product, 'type'>>(rankedItems: T[]): { step: RoutineStep; item: T }[] {
  const picked: { step: RoutineStep; item: T }[] = []
  for (const step of routineSteps) {
    const item = rankedItems.find((p) => step.types.includes(p.type))
    if (item) picked.push({ step, item })
  }
  return picked
}
