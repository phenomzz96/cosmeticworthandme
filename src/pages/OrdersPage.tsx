/**
 * ĐƠN HÀNG CỦA TÔI — /orders và chi tiết /orders/:code
 * Database (RLS) chỉ trả đơn của chính người đăng nhập.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { Breadcrumbs, button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { OrderItemRow, OrderProgress, OrderStatusBadge, PaymentBadge, QrCode } from '@/features/orders/OrderBits'
import { friendlyError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { formatAddress } from '@/services/addresses'
import { catalogService } from '@/services/catalog'
import { demoQrPayload, ORDERS_PAGE_SIZE, orderService } from '@/services/orders'
import { cancelledByLabels, orderStatusLabels, paymentMethodLabels, paymentStatusLabels, type Order, type OrderEvent, type ShopOrder } from '@/types/order'

export function OrdersPage() {
  useDocumentTitle('Đơn hàng của tôi')
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; orders: Order[]; total: number; error?: string }>({ status: 'loading', orders: [], total: 0 })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    orderService
      .listMine(page)
      .then((r) => !cancelled && setState({ status: 'ready', ...r }))
      .catch((err) => !cancelled && setState({ status: 'error', orders: [], total: 0, error: friendlyError(err) }))
    return () => {
      cancelled = true
    }
  }, [page])

  const pages = Math.max(1, Math.ceil(state.total / ORDERS_PAGE_SIZE))

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Tài khoản', to: '/account' }, { label: 'Đơn hàng của tôi' }]} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Đơn hàng của tôi</h1>
      <div className="mt-6">
        {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.orders.length === 0 && (
          <EmptyState title="Bạn chưa có đơn hàng nào" action={<Link to="/products" className={button('primary')}>Mua sắm ngay</Link>} />
        )}
        {state.status === 'ready' && state.orders.length > 0 && (
          <ul className="space-y-4" aria-label="Danh sách đơn hàng">
            {state.orders.map((o) => (
              <li key={o.id} className="rounded-card border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link to={`/orders/${o.code}`} className="font-mono font-semibold hover:text-primary">
                      {o.code}
                    </Link>
                    <p className="text-xs text-muted">
                      {formatDateTime(o.created_at)} · {paymentMethodLabels[o.payment_method]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentBadge status={o.payment_status} />
                    <span className="font-semibold tabular-nums">{formatPrice(o.grand_total)}</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {o.shop_orders.map((so) => (
                    <li key={so.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{so.shop_name}</span>
                        <span className="text-muted"> · {so.order_items.reduce((n, i) => n + i.quantity, 0)} sản phẩm</span>
                      </span>
                      <OrderStatusBadge status={so.status} />
                    </li>
                  ))}
                </ul>
                {o.payment_method === 'qr_demo' && o.payment_status === 'unpaid' && o.shop_orders.some((so) => so.status !== 'cancelled') && (
                  <p className="mt-3 text-sm font-medium text-on-accent dark:text-accent">Đơn chờ bạn chuyển khoản (mô phỏng).</p>
                )}
                <Link to={`/orders/${o.code}`} className={`${button('secondary', 'sm')} mt-3`}>
                  Xem chi tiết
                </Link>
              </li>
            ))}
          </ul>
        )}
        {state.status === 'ready' && pages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Phân trang đơn hàng">
            <button type="button" className={button('secondary', 'sm')} disabled={page <= 1} onClick={() => setParams(page - 1 > 1 ? { page: String(page - 1) } : {})}>
              Trang trước
            </button>
            <span>
              Trang {page}/{pages}
            </span>
            <button type="button" className={button('secondary', 'sm')} disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })}>
              Trang sau
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}

export function OrderDetailPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'
  useDocumentTitle(`Đơn ${code}`)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; order?: Order; error?: string }>({ status: 'loading' })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const order = await orderService.getMineByCode(code)
      setState(order ? { status: 'ready', order } : { status: 'missing' })
    } catch (err) {
      setState({ status: 'error', error: friendlyError(err) })
    }
  }, [code])

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'loading') {
    return (
      <div className="container-page py-8">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (state.status !== 'ready' || !state.order) {
    return (
      <div className="container-page py-12">
        <EmptyState title={state.status === 'error' ? 'Không tải được đơn hàng' : 'Không tìm thấy đơn hàng'} action={<Link to="/orders" className={button('primary')}>Về danh sách đơn</Link>}>
          {state.error}
        </EmptyState>
      </div>
    )
  }

  const o = state.order
  const active = o.shop_orders.some((so) => so.status !== 'cancelled')
  const run = async (fn: () => Promise<void>, ok: string) => {
    setNotice(null)
    try {
      await fn()
      setNotice({ kind: 'success', text: ok })
      void catalogService.refresh().catch(() => undefined)
    } catch (err) {
      setNotice({ kind: 'error', text: friendlyError(err) })
    }
    await load()
  }

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Đơn hàng của tôi', to: '/orders' }, { label: o.code }]} />
      {isNew && (
        <div className="mt-4">
          <Alert kind="success">
            Đặt hàng thành công! Mã đơn <span className="font-mono font-semibold">{o.code}</span>.{' '}
            {o.payment_method === 'qr_demo' ? 'Hãy hoàn tất bước chuyển khoản mô phỏng bên dưới.' : 'Người bán sẽ xác nhận đơn sớm.'}
          </Alert>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Đơn <span className="font-mono">{o.code}</span>
          </h1>
          <p className="text-sm text-muted">Đặt lúc {formatDateTime(o.created_at)}</p>
        </div>
        <PaymentBadge status={o.payment_status} />
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {o.payment_method === 'qr_demo' && active && o.payment_status !== 'paid' && (
            <QrPaymentPanel order={o} onReport={() => run(() => orderService.reportPayment(o.id), 'Đã gửi thông báo chuyển khoản. Quản trị viên sẽ xác nhận.')} />
          )}
          {o.shop_orders.map((so) => (
            <ShopOrderCard key={so.id} so={so} events={(o.order_events ?? []).filter((e) => e.shop_order_id === so.id)} onCancel={(reason) => run(() => orderService.cancelMine(so.id, reason), `Đã hủy đơn của ${so.shop_name}.`)} />
          ))}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-36">
          <section className="rounded-card border border-border bg-surface p-5 text-sm">
            <h2 className="font-semibold">Giao đến</h2>
            <p className="mt-2 font-medium">
              {o.recipient_name} · {o.phone}
            </p>
            <p className="text-muted">{formatAddress(o)}</p>
            {o.note && <p className="mt-2 text-muted">Ghi chú: {o.note}</p>}
          </section>
          <section className="rounded-card border border-border bg-surface p-5 text-sm">
            <h2 className="font-semibold">Thanh toán</h2>
            <p className="mt-2">{paymentMethodLabels[o.payment_method]}</p>
            <p className="text-muted">{paymentStatusLabels[o.payment_status]}</p>
            {o.payment_note && o.payment_status === 'unpaid' && <p className="mt-1 text-danger">Quản trị viên phản hồi: {o.payment_note}</p>}
            <dl className="mt-3 space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-muted">Tiền hàng</dt>
                <dd className="tabular-nums">{formatPrice(o.items_subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Phí vận chuyển</dt>
                <dd className="tabular-nums">{formatPrice(o.shipping_total)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Tổng cộng</dt>
                <dd className="tabular-nums">{formatPrice(o.grand_total)}</dd>
              </div>
            </dl>
            {o.shop_orders.some((so) => so.status === 'cancelled') && (
              <p className="mt-2 text-xs text-muted">Tổng cộng tính lúc đặt hàng, gồm cả đơn đã hủy.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function QrPaymentPanel({ order, onReport }: { order: Order; onReport: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <section className="rounded-card border-2 border-dashed border-primary/50 bg-surface p-5" aria-labelledby="qr-heading">
      <h2 id="qr-heading" className="text-lg font-semibold">
        Chuyển khoản QR <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-on-accent">Mô phỏng</span>
      </h2>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-border bg-surface p-2">
          <QrCode value={demoQrPayload(order.code, order.grand_total)} label={`Mã QR mô phỏng cho đơn ${order.code}`} size={180} />
        </div>
        <div className="space-y-2 text-sm">
          <p>
            Số tiền: <span className="font-semibold tabular-nums">{formatPrice(order.grand_total)}</span>
          </p>
          <p>
            Nội dung chuyển khoản: <span className="font-mono font-semibold">{order.code}</span>
          </p>
          <p className="text-muted">
            Đây là chức năng trình diễn cho đồ án: mã QR chỉ chứa mã đơn và số tiền, <strong>không gắn với tài khoản ngân hàng nào</strong> và không có tiền thật được
            chuyển. Bấm nút bên dưới để giả lập việc đã chuyển khoản.
          </p>
          {order.payment_status === 'unpaid' ? (
            <button
              type="button"
              className={button('primary')}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onReport()
                setBusy(false)
              }}
            >
              {busy ? 'Đang gửi...' : 'Tôi đã chuyển khoản (mô phỏng)'}
            </button>
          ) : (
            <p className="font-medium text-primary">Đã báo chuyển khoản lúc {order.payment_reported_at ? formatDateTime(order.payment_reported_at) : ''}. Đang chờ quản trị viên xác nhận.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function ShopOrderCard({ so, events, onCancel }: { so: ShopOrder; events: OrderEvent[]; onCancel: (reason: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const shop = catalogService.getShopByIdSync(so.shop_id)
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-label={`Đơn của ${so.shop_name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {shop ? (
            <Link to={`/shops/${shop.slug}`} className="hover:text-primary">
              {so.shop_name}
            </Link>
          ) : (
            so.shop_name
          )}
        </p>
        <OrderStatusBadge status={so.status} />
      </div>
      <div className="mt-3">
        <OrderProgress status={so.status} />
      </div>
      {so.status === 'cancelled' && (
        <div className="mt-3 rounded-xl bg-danger/10 p-3 text-sm">
          <p>
            Đơn đã hủy{so.cancelled_by ? ` bởi ${cancelledByLabels[so.cancelled_by]?.toLowerCase()}` : ''}
            {so.cancel_reason ? `: ${so.cancel_reason}` : '.'}
          </p>
          {so.refund_status && (
            <p className="mt-1 font-medium">{so.refund_status === 'done' ? 'Đã hoàn tiền (mô phỏng).' : 'Đang chờ hoàn tiền (mô phỏng).'}</p>
          )}
        </div>
      )}
      <ul className="mt-2 divide-y divide-border">
        {so.order_items.map((i) => (
          <OrderItemRow key={i.id ?? i.product_name} item={i} />
        ))}
      </ul>
      <dl className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Phí vận chuyển</dt>
          <dd className="tabular-nums">{formatPrice(so.shipping_fee)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Tổng đơn</dt>
          <dd className="tabular-nums">{formatPrice(so.total)}</dd>
        </div>
      </dl>
      {events.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Lịch sử đơn ({events.length})</summary>
          <ol className="mt-2 space-y-1">
            {events.map((e) => (
              <li key={e.id} className="text-muted">
                {formatDateTime(e.created_at)} ·{' '}
                {e.kind === 'status' ? orderStatusLabels[e.to_value as keyof typeof orderStatusLabels] : e.kind === 'refund' ? (e.to_value === 'done' ? 'Đã hoàn tiền' : 'Chờ hoàn tiền') : e.to_value}
                {e.note ? ` — ${e.note}` : ''}
              </li>
            ))}
          </ol>
        </details>
      )}
      {so.status === 'pending' &&
        (confirm ? (
          <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <TextAreaField label="Lý do hủy (không bắt buộc)" value={reason} onChange={setReason} rows={2} maxLength={500} />
            <div className="flex gap-2">
              <button
                type="button"
                className={button('primary', 'sm')}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await onCancel(reason)
                  setBusy(false)
                  setConfirm(false)
                }}
              >
                {busy ? 'Đang hủy...' : 'Xác nhận hủy đơn'}
              </button>
              <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirm(false)}>
                Không hủy
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${button('ghost', 'sm')} mt-3 text-danger`} onClick={() => setConfirm(true)}>
            Hủy đơn của shop này
          </button>
        ))}
    </section>
  )
}
