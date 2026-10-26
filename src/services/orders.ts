/**
 * Đơn hàng. Mọi thay đổi đi qua hàm SQL (migration 005); database tính giá, phí ship, tồn kho
 * và kiểm tra quyền. Trình duyệt chỉ gửi id sản phẩm, số lượng, id địa chỉ, phương thức thanh toán.
 */
import { requireSupabase } from '@/lib/supabase'
import type { AdminOrderRow, Order, OrderStatus, PaymentMethod, PaymentStatus, SellerShopOrder } from '@/types/order'

export const ORDERS_PAGE_SIZE = 10

const ORDER_FIELDS =
  'id, code, recipient_name, phone, province, district, ward, street, note, payment_method, payment_status, payment_reported_at, payment_confirmed_at, payment_note, items_subtotal, shipping_total, grand_total, created_at, ' +
  // Ghi rõ khóa ngoại để PostgREST không nhầm quan hệ (order_events cũng trỏ tới cả orders và shop_orders)
  'shop_orders!shop_orders_order_id_fkey(id, order_id, shop_id, shop_name, status, items_subtotal, shipping_fee, total, cancel_reason, cancelled_by, refund_status, confirmed_at, shipped_at, delivered_at, cancelled_at, created_at, ' +
  'order_items(id, product_id, product_name, product_slug, brand_name, image_path, unit_price, quantity, line_total))'

function sortShopOrders(o: Order): Order {
  return { ...o, shop_orders: [...(o.shop_orders ?? [])].sort((a, b) => a.shop_name.localeCompare(b.shop_name)) }
}

const page = (n: number, size: number) => ({ limit: size, offset: (Math.max(1, n) - 1) * size })
const totalOf = (rows: { total_count?: number }[]) => (rows[0] ? Number(rows[0].total_count) : 0)

export const orderService = {
  async placeOrder(input: { lines: { productId: string; quantity: number }[]; addressId: string; paymentMethod: PaymentMethod; note: string }) {
    const { data, error } = await requireSupabase().rpc('place_order', {
      p_items: input.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      p_address_id: input.addressId,
      p_payment_method: input.paymentMethod,
      p_note: input.note.trim(),
    })
    if (error) throw error
    return data as { id: string; code: string; grand_total: number }
  },

  async listMine(pageNo = 1): Promise<{ orders: Order[]; total: number }> {
    const from = (Math.max(1, pageNo) - 1) * ORDERS_PAGE_SIZE
    const { data, error, count } = await requireSupabase()
      .from('orders')
      .select(ORDER_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + ORDERS_PAGE_SIZE - 1)
    if (error) throw error
    return { orders: (data as unknown as Order[]).map(sortShopOrders), total: count ?? 0 }
  },

  async getMineByCode(code: string): Promise<Order | null> {
    const { data, error } = await requireSupabase()
      .from('orders')
      .select(ORDER_FIELDS + ', order_events!order_events_order_id_fkey(id, shop_order_id, kind, from_value, to_value, note, actor_role, created_at)')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const o = sortShopOrders(data as unknown as Order)
    return { ...o, order_events: [...(o.order_events ?? [])].sort((a, b) => a.id - b.id) }
  },

  async cancelMine(shopOrderId: string, reason: string) {
    const { error } = await requireSupabase().rpc('cancel_my_shop_order', { p_shop_order_id: shopOrderId, p_reason: reason.trim() || null })
    if (error) throw error
  },

  async reportPayment(orderId: string) {
    const { error } = await requireSupabase().rpc('report_payment', { p_order_id: orderId })
    if (error) throw error
  },

  // ---------------------------------------------------------------- Người bán
  async sellerList(f: { status?: OrderStatus; search?: string; page?: number }): Promise<{ rows: SellerShopOrder[]; total: number }> {
    const { limit, offset } = page(f.page ?? 1, 20)
    const { data, error } = await requireSupabase().rpc('seller_list_shop_orders', {
      p_status: f.status ?? null,
      p_search: f.search?.trim() || null,
      p_limit: limit,
      p_offset: offset,
    })
    if (error) throw error
    const rows = (data ?? []) as (SellerShopOrder & { total_count: number })[]
    return { rows, total: totalOf(rows) }
  },

  async sellerUpdate(shopOrderId: string, status: OrderStatus, reason?: string) {
    const { error } = await requireSupabase().rpc('seller_update_shop_order', { p_shop_order_id: shopOrderId, p_status: status, p_reason: reason?.trim() || null })
    if (error) throw error
  },

  async sellerStats(): Promise<SellerStats> {
    const { data, error } = await requireSupabase().rpc('seller_dashboard_stats')
    if (error) throw error
    return data as SellerStats
  },

  // ---------------------------------------------------------------- Admin
  async adminList(f: { status?: OrderStatus; paymentStatus?: PaymentStatus; refundPending?: boolean; search?: string; page?: number }): Promise<{ rows: AdminOrderRow[]; total: number }> {
    const { limit, offset } = page(f.page ?? 1, 20)
    const { data, error } = await requireSupabase().rpc('admin_list_orders', {
      p_status: f.status ?? null,
      p_payment_status: f.paymentStatus ?? null,
      p_search: f.search?.trim() || null,
      p_limit: limit,
      p_offset: offset,
      p_refund_pending: f.refundPending ?? false,
    })
    if (error) throw error
    const rows = (data ?? []) as (AdminOrderRow & { total_count: number })[]
    return { rows: rows.map((r) => ({ ...r, shop_orders: r.shop_orders ?? [] })), total: totalOf(rows) }
  },

  async adminConfirmPayment(orderId: string, approve: boolean, note?: string) {
    const { error } = await requireSupabase().rpc('admin_confirm_payment', { p_order_id: orderId, p_approve: approve, p_note: note?.trim() || null })
    if (error) throw error
  },

  async adminMarkRefunded(shopOrderId: string) {
    const { error } = await requireSupabase().rpc('admin_mark_refunded', { p_shop_order_id: shopOrderId })
    if (error) throw error
  },

  async adminCancel(shopOrderId: string, reason: string) {
    const { error } = await requireSupabase().rpc('admin_cancel_shop_order', { p_shop_order_id: shopOrderId, p_reason: reason.trim() })
    if (error) throw error
  },

  async adminStats(): Promise<AdminStats> {
    const { data, error } = await requireSupabase().rpc('admin_dashboard_stats')
    if (error) throw error
    return data as AdminStats
  },
}

export interface SellerStats {
  by_status: Partial<Record<OrderStatus, number>>
  revenue_delivered: number
  revenue_30d: number
  orders_today: number
  units_sold: number
}

export interface AdminStats {
  users: number
  users_by_role: Record<string, number>
  users_suspended: number
  shops_by_status: Record<string, number>
  products_active: number
  products_hidden_by_admin: number
  orders: number
  orders_today: number
  shop_orders_by_status: Partial<Record<OrderStatus, number>>
  payments_pending: number
  refunds_pending: number
  gmv_delivered: number
}

/** Nội dung mã QR mô phỏng: chỉ mã đơn + số tiền, không chứa tài khoản ngân hàng thật */
export function demoQrPayload(code: string, amount: number) {
  return `WORTHANDME-DEMO|DON:${code}|SOTIEN:${amount}VND|KHONG-PHAI-GIAO-DICH-THAT`
}
