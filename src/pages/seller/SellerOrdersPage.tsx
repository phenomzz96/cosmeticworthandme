/**
 * ĐƠN HÀNG CỦA SHOP — /seller/orders
 * Người bán xác nhận → chuẩn bị → giao → đã giao, hoặc từ chối/hủy kèm lý do.
 * Database (seller_update_shop_order) kiểm tra quyền, thứ tự bước, lý do, và chặn giao đơn QR chưa thanh toán.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { OrderItemRow, OrderProgress, OrderStatusBadge, PaymentBadge } from '@/features/orders/OrderBits'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { formatAddress } from '@/services/addresses'
import { catalogService } from '@/services/catalog'
import { orderService, type SellerStats } from '@/services/orders'
import { CANCEL_REASON_MIN, cancelledByLabels, orderStatusLabels, paymentMethodLabels, type OrderStatus, type SellerShopOrder } from '@/types/order'

const tabs: (OrderStatus | '')[] = ['', 'pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled']

/** Bước tiếp theo người bán được bấm */
const nextStep: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: 'confirmed', label: 'Xác nhận đơn' },
  confirmed: { to: 'preparing', label: 'Bắt đầu chuẩn bị hàng' },
  preparing: { to: 'shipping', label: 'Đã giao cho vận chuyển' },
  shipping: { to: 'delivered', label: 'Xác nhận đã giao' },
}

export function SellerOrdersPage() {
  useDocumentTitle('Đơn hàng của shop')
  const { isSuspended: isSuspendedAccount } = useAuth()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') as OrderStatus | null
  const status = statusParam && tabs.includes(statusParam) ? statusParam : undefined
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [searchInput, setSearchInput] = useState(search)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: SellerShopOrder[]; total: number; error?: string }>({ status: 'loading', rows: [], total: 0 })
  const [stats, setStats] = useState<SellerStats | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([orderService.sellerList({ status, search, page }), orderService.sellerStats()])
      setState({ status: 'ready', ...r })
      setStats(s)
    } catch (err) {
      setState({ status: 'error', rows: [], total: 0, error: friendlyError(err) })
    }
  }, [status, search, page])

  useEffect(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    void load()
  }, [load])

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  useEffect(() => {
    if (searchInput === search) return
    const t = window.setTimeout(() => update({ q: searchInput.trim() || null }), 350)
    return () => window.clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(state.total / 20))
  const countOf = (s: OrderStatus | '') => (stats ? (s ? (stats.by_status[s] ?? 0) : Object.values(stats.by_status).reduce((n, x) => n + (x ?? 0), 0)) : null)

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Đơn hàng</h1>
      <p className="mt-1 text-sm text-muted">Đơn chờ xác nhận nằm đầu danh sách. Thông tin người nhận chỉ dùng để giao hàng, không chia sẻ cho bên khác.</p>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto" role="group" aria-label="Lọc theo trạng thái đơn">
          {tabs.map((t) => {
            const n = countOf(t)
            return (
              <button
                key={t || 'all'}
                type="button"
                aria-pressed={(status ?? '') === t}
                onClick={() => update({ status: t || null })}
                className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${(status ?? '') === t ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`}
              >
                {t ? orderStatusLabels[t] : 'Tất cả'}
                {n !== null && ` (${n})`}
              </button>
            )
          })}
        </div>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Mã đơn hoặc tên người nhận"
          aria-label="Tìm đơn hàng"
          className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm md:w-72"
        />
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-4">
        {state.status === 'loading' && <Skeleton className="h-64 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.rows.length === 0 && <EmptyState title={status || search ? 'Không có đơn phù hợp' : 'Cửa hàng chưa có đơn hàng'} />}
        {state.status === 'ready' && state.rows.length > 0 && (
          <ul className="space-y-4" aria-label="Đơn hàng của shop">
            {state.rows.map((r) => (
              <SellerOrderCard
                key={r.id}
                row={r}
                readOnly={isSuspendedAccount}
                onDone={(text, kind = 'success') => {
                  setNotice({ kind, text })
                  if (kind === 'success') {
                    void load()
                    void catalogService.refresh().catch(() => undefined)
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {state.status === 'ready' && pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3 text-sm" aria-label="Phân trang">
          <button type="button" className={button('secondary', 'sm')} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
            Trang trước
          </button>
          <span>
            Trang {page}/{pages}
          </span>
          <button type="button" className={button('secondary', 'sm')} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
            Trang sau
          </button>
        </nav>
      )}
    </div>
  )
}

function SellerOrderCard({ row, readOnly, onDone }: { row: SellerShopOrder; readOnly: boolean; onDone: (text: string, kind?: 'success' | 'error') => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const step = nextStep[row.status]
  const qrBlocked = row.status === 'preparing' && row.payment_method === 'qr_demo' && row.payment_status !== 'paid'
  const canCancel = ['pending', 'confirmed', 'preparing'].includes(row.status)

  const run = async (to: OrderStatus, why?: string) => {
    if (to === 'cancelled' && (why ?? '').trim().length < CANCEL_REASON_MIN) {
      setError(`Nhập lý do (ít nhất ${CANCEL_REASON_MIN} ký tự). Khách hàng sẽ thấy lý do này.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await orderService.sellerUpdate(row.id, to, why)
      setRejecting(false)
      setReason('')
      onDone(`Đơn ${row.code}: ${orderStatusLabels[to].toLowerCase()}.`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono font-semibold">{row.code}</p>
          <p className="text-xs text-muted">Đặt lúc {formatDateTime(row.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentBadge status={row.payment_status} />
          <OrderStatusBadge status={row.status} />
        </div>
      </div>
      <div className="mt-3">
        <OrderProgress status={row.status} />
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_280px]">
        <ul className="divide-y divide-border">
          {row.items.map((i) => (
            <OrderItemRow key={i.product_name + i.unit_price} item={i} linkProduct={false} />
          ))}
        </ul>
        <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-medium">
            {row.recipient_name} · {row.phone}
          </p>
          <p className="text-muted">{formatAddress(row)}</p>
          {row.note && <p className="text-muted">Ghi chú: {row.note}</p>}
          <p className="text-muted">{paymentMethodLabels[row.payment_method]}</p>
          <dl className="space-y-1 border-t border-border pt-2">
            <div className="flex justify-between">
              <dt className="text-muted">Tiền hàng</dt>
              <dd className="tabular-nums">{formatPrice(row.items_subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Phí vận chuyển</dt>
              <dd className="tabular-nums">{formatPrice(row.shipping_fee)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>{row.payment_method === 'cod' ? 'Thu khi giao' : 'Tổng đơn'}</dt>
              <dd className="tabular-nums">{formatPrice(row.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {row.status === 'cancelled' && (
        <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm">
          Đã hủy{row.cancelled_by ? ` bởi ${cancelledByLabels[row.cancelled_by]?.toLowerCase()}` : ''}
          {row.cancel_reason ? `: ${row.cancel_reason}` : '.'}
          {row.refund_status && ` ${row.refund_status === 'done' ? 'Đã hoàn tiền cho khách (mô phỏng).' : 'Quản trị viên sẽ hoàn tiền cho khách (mô phỏng).'}`}
        </p>
      )}

      {!readOnly && (step || canCancel) && (
        <div className="mt-4 space-y-2">
          {qrBlocked && <p className="text-sm font-medium text-on-accent dark:text-accent">Đơn chuyển khoản chưa được xác nhận thanh toán: chỉ giao hàng sau khi quản trị viên xác nhận đã nhận tiền.</p>}
          {rejecting ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <TextAreaField label={row.status === 'pending' ? 'Lý do từ chối đơn' : 'Lý do hủy đơn'} value={reason} onChange={setReason} rows={2} maxLength={500} />
              <div className="flex gap-2">
                <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run('cancelled', reason)}>
                  {busy ? 'Đang xử lý...' : row.status === 'pending' ? 'Xác nhận từ chối' : 'Xác nhận hủy'}
                </button>
                <button type="button" className={button('ghost', 'sm')} onClick={() => setRejecting(false)}>
                  Thôi
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {step && (
                <button type="button" className={button('primary', 'sm')} disabled={busy || qrBlocked} onClick={() => void run(step.to)}>
                  {busy ? 'Đang xử lý...' : step.label}
                </button>
              )}
              {canCancel && (
                <button type="button" className={button('ghost', 'sm')} onClick={() => setRejecting(true)}>
                  {row.status === 'pending' ? 'Từ chối đơn' : 'Hủy đơn'}
                </button>
              )}
            </div>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </li>
  )
}
