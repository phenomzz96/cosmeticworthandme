/**
 * Chọn sản phẩm để thanh toán (giỏ hàng → trang đặt hàng) và mã giảm giá đã nhập.
 * Lưu tạm trong phiên trình duyệt (sessionStorage): đóng tab là mất, không phải dữ liệu dùng chung.
 * Không có lựa chọn (hoặc bộ nhớ bị chặn) → trang đặt hàng dùng toàn bộ giỏ.
 */
const KEY = 'wm-checkout'

export interface CheckoutSelection {
  /** id sản phẩm được chọn; null = cả giỏ */
  productIds: string[] | null
  voucherCodes: string[]
}

export function readCheckoutSelection(): CheckoutSelection {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object') {
      return {
        productIds: Array.isArray(v.productIds) ? v.productIds.filter((x: unknown) => typeof x === 'string') : null,
        voucherCodes: Array.isArray(v.voucherCodes) ? v.voucherCodes.filter((x: unknown) => typeof x === 'string').slice(0, 10) : [],
      }
    }
  } catch {
    /* bỏ qua */
  }
  return { productIds: null, voucherCodes: [] }
}

export function writeCheckoutSelection(sel: CheckoutSelection) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(sel))
  } catch {
    /* bỏ qua */
  }
}
