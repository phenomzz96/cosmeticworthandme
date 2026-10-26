const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })

export const formatPrice = (value: number) => vnd.format(value)
export const formatCompact = (value: number) => compact.format(value)

export function discountPercent(price: number, original?: number) {
  if (!original || original <= price) return 0
  return Math.round(((original - price) / original) * 100)
}

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const dateOnly = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' })

/** Ngày giờ theo giờ Việt Nam, ví dụ "26/10/2026, 14:05" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))
