import type { IconName } from '@/components/ui/Icon'

/**
 * Các tính năng chuyên biệt của sàn — dùng chung cho thanh menu, menu điện thoại, chân trang và trang chủ.
 * Thêm tính năng mới: thêm một mục ở đây, mọi chỗ hiển thị tự cập nhật.
 */
export interface SpecialFeature {
  to: string
  /** Tên ngắn trên thanh menu */
  name: string
  /** Tên đầy đủ (chân trang, menu điện thoại) */
  fullName: string
  /** Một câu giới thiệu (thẻ trên trang chủ) */
  blurb: string
  icon: IconName
}

/** Trò chơi Beauty Quest của nhóm phụ trách (website riêng, tài khoản riêng; trang đó chặn nhúng nên mở ở tab mới) */
export const BEAUTY_QUEST_URL = 'https://beautyquest.netlify.app'

export const specialFeatures: SpecialFeature[] = [
  {
    to: '/beauty-finder',
    name: 'Beauty Finder',
    fullName: 'Beauty Finder',
    blurb: 'Trả lời vài câu hỏi, nhận gợi ý sản phẩm hợp với bạn.',
    icon: 'sparkle',
  },
  {
    to: '/skincare-architect',
    name: 'Skincare 3D',
    fullName: 'Skincare Architect 3D',
    blurb: 'Xếp chu trình chăm da theo từng bước, xem trực quan.',
    icon: 'cube',
  },
  {
    to: '/beauty-quest',
    name: 'Beauty Quest',
    fullName: 'Beauty Quest – Hộp quà',
    blurb: 'Chăm da mỗi ngày, mở hộp quà nhận voucher và quà tặng.',
    icon: 'gift',
  },
]
