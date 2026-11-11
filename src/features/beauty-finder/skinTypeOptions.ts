import { skinTypeLabels } from '@/data/taxonomy'
import type { SkinType } from '@/types/catalog'

/** Lựa chọn loại da (khách tự chọn, không chẩn đoán) — dùng ở Beauty Finder và trang chủ */
export const skinTypeOptions: { value: SkinType | 'unsure'; label: string; hint?: string }[] = [
  { value: 'oily', label: skinTypeLabels.oily, hint: 'Bóng dầu toàn mặt sau vài giờ' },
  { value: 'dry', label: skinTypeLabels.dry, hint: 'Hay căng, bong tróc nhẹ' },
  { value: 'combination', label: skinTypeLabels.combination, hint: 'Dầu vùng chữ T, khô hai má' },
  { value: 'normal', label: skinTypeLabels.normal, hint: 'Ít khi quá dầu hay quá khô' },
  { value: 'sensitive', label: skinTypeLabels.sensitive, hint: 'Dễ đỏ, châm chích khi đổi sản phẩm' },
  { value: 'unsure', label: 'Mình chưa rõ', hint: 'Gợi ý sản phẩm hợp nhiều loại da' },
]
