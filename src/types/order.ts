/** Kiểu dữ liệu đơn hàng — khớp bảng orders, shop_orders, order_items, order_events (migration 005) */
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled'
export type PaymentMethod = 'cod' | 'qr_demo'
export type PaymentStatus = 'unpaid' | 'pending_confirmation' | 'paid'
export type RefundStatus = 'pending' | 'done' | null

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

/** Thứ tự các bước (không gồm "đã hủy") để vẽ tiến trình */
export const ORDER_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered']

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  qr_demo: 'Chuyển khoản QR (mô phỏng)',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  pending_confirmation: 'Chờ xác nhận thanh toán',
  paid: 'Đã thanh toán',
}

export const cancelledByLabels: Record<string, string> = {
  customer: 'Khách hàng',
  seller: 'Người bán',
  admin: 'Quản trị viên',
}

export interface OrderItem {
  id?: string
  product_id: string | null
  product_name: string
  product_slug: string
  brand_name?: string
  image_path: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export interface ShopOrder {
  id: string
  order_id: string
  shop_id: string
  shop_name: string
  status: OrderStatus
  items_subtotal: number
  shipping_fee: number
  total: number
  cancel_reason: string | null
  cancelled_by: string | null
  refund_status: RefundStatus
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  created_at: string
  order_items: OrderItem[]
}

export interface OrderEvent {
  id: number
  shop_order_id: string | null
  kind: 'status' | 'payment' | 'refund'
  from_value: string | null
  to_value: string
  note: string | null
  actor_role: string
  created_at: string
}

export interface Order {
  id: string
  code: string
  recipient_name: string
  phone: string
  province: string
  district: string
  ward: string
  street: string
  note: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  payment_reported_at: string | null
  payment_confirmed_at: string | null
  payment_note: string | null
  items_subtotal: number
  shipping_total: number
  grand_total: number
  created_at: string
  shop_orders: ShopOrder[]
  order_events?: OrderEvent[]
}

/** Đơn con kèm thông tin giao hàng — dành cho người bán (hàm seller_list_shop_orders) */
export interface SellerShopOrder {
  id: string
  order_id: string
  code: string
  status: OrderStatus
  items_subtotal: number
  shipping_fee: number
  total: number
  cancel_reason: string | null
  cancelled_by: string | null
  refund_status: RefundStatus
  created_at: string
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  recipient_name: string
  phone: string
  province: string
  district: string
  ward: string
  street: string
  note: string
  items: OrderItem[]
}

export interface AdminOrderRow {
  id: string
  code: string
  customer_email: string | null
  recipient_name: string
  phone: string
  address: string
  note: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  payment_reported_at: string | null
  payment_note: string | null
  items_subtotal: number
  shipping_total: number
  grand_total: number
  created_at: string
  shop_orders: {
    id: string
    shop_id: string
    shop_name: string
    status: OrderStatus
    total: number
    cancel_reason: string | null
    cancelled_by: string | null
    refund_status: RefundStatus
    items: { product_name: string; quantity: number; unit_price: number; line_total: number }[]
  }[]
}

export const CANCEL_REASON_MIN = 5
