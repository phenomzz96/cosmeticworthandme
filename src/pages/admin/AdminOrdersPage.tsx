/**
 * ĐƠN HÀNG (ADMIN) — /admin/orders
 * Xem mọi đơn; xác nhận / từ chối thanh toán QR mô phỏng; đánh dấu đã hoàn tiền; hủy đơn con khi có khiếu nại.
 * Mọi thao tác qua hàm trong database (kiểm tra quyền Admin, ghi nhật ký).
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { OrderStatusBadge, PaymentBadge } from '@/features/orders/OrderBits'
import { friendlyError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { orderService } from '@/services/orders'
import { CANCEL_REASON_MIN, cancelledByLabels, orderStatusLabels, paymentMethodLabels, type AdminOrderRow, type OrderStatus, type PaymentStatus } from '@/types/order'

const statusOptions: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled']

export function AdminOrdersPage() {
  useDocumentTitle('Đơn hàng')
  const [params, setParams] = useSearchParams()
  const payment = params.get('payment') === 'pending_confirmation' ? ('pending_confirmation' as PaymentStatus) : undefined
  const refund = params.get('refund') === '1'
  const statusParam = params.get('status') as OrderStatus | null
  const status = statusParam && statusOptions.includes(statusParam) ? statusParam : undefined
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [searchInput, setSearchInput] = useState(search)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: AdminOrderRow[]; total: number; error?: string }>({ status: 'loading', rows: [], total: 0 })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', ...(await orderService.adminList({ status, paymentStatus: payment, refundPending: refund, search, page })) })
    } catch (err) {
      setState({ status: 'error', rows: [], total: 0, error: friendlyError(err) })
    }
  }, [status, payment, refund, search, page])

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
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`

  const done = (text: string, kind: 'success' | 'error' = 'success') => {
    setNotice({ kind, text })
    if (kind === 'success') {
      void load()
      void catalogService.refresh().catch(() => undefined)
    }
  }

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Đơn hàng</h1>
      <p className="mt-1 text-sm text-muted">Đơn chờ xác nhận thanh toán nằm đầu danh sách. Thanh toán QR là mô phỏng: xác nhận nghĩa là giả lập đã nhận tiền.</p>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto" role="group" aria-label="Lọc đơn">
          <button type="button" aria-pressed={!payment && !refund} className={chip(!payment && !refund)} onClick={() => update({ payment: null, refund: null })}>
            Tất cả
          </button>
          <button type="button" aria-pressed={!!payment} className={chip(!!payment)} onClick={() => update({ payment: 'pending_confirmation', refund: null })}>
            Chờ xác nhận thanh toán
          </button>
          <button type="button" aria-pressed={refund} className={chip(refund)} onClick={() => update({ refund: '1', payment: null })}>
            Chờ hoàn tiền
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={status ?? ''} onChange={(e) => update({ status: e.target.value || null })} className="h-10 rounded-full border border-border bg-surface px-3 text-sm" aria-label="Trạng thái đơn con">
            <option value="">Mọi trạng thái đơn</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabels[s]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Mã đơn, email khách, người nhận"
            aria-label="Tìm đơn hàng"
            className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm sm:w-72"
          />
        </div>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-4">
        {state.status === 'loading' && <Skeleton className="h-64 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.rows.length === 0 && <EmptyState title="Không có đơn phù hợp" />}
        {state.status === 'ready' && state.rows.length > 0 && (
          <ul className="space-y-4" aria-label="Danh sách đơn hàng">
            {state.rows.map((r) => (
              <AdminOrderCard key={r.id} row={r} onDone={done} />
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
            Trang {page}/{pages} · {state.total} đơn
          </span>
          <button type="button" className={button('secondary', 'sm')} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
            Trang sau
          </button>
        </nav>
      )}
    </div>
  )
}

function AdminOrderCard({ row, onDone }: { row: AdminOrderRow; onDone: (text: string, kind?: 'success' | 'error') => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setRejecting(false)
      setCancelling(null)
      setNote('')
      setCancelReason('')
      onDone(ok)
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
          <p className="text-xs text-muted">
            {formatDateTime(row.created_at)} · {row.customer_email ?? 'Tài khoản đã xóa'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentBadge status={row.payment_status} />
          <span className="font-semibold tabular-nums">{formatPrice(row.grand_total)}</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {paymentMethodLabels[row.payment_method]} · Giao: {row.recipient_name}, {row.phone}, {row.address}
      </p>

      {row.payment_status === 'pending_confirmation' && (
        <div className="mt-3 rounded-xl border border-primary/40 bg-primary-soft/40 p-3 text-sm">
          <p className="font-medium">
            Khách báo đã chuyển khoản {row.payment_reported_at ? `lúc ${formatDateTime(row.payment_reported_at)}` : ''}. Số tiền: {formatPrice(row.grand_total)}, nội dung: {row.code}.
          </p>
          {rejecting ? (
            <div className="mt-2 space-y-2">
              <TextAreaField label="Lý do từ chối (khách sẽ thấy)" value={note} onChange={setNote} rows={2} maxLength={500} />
              <div className="flex gap-2">
                <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run(() => orderService.adminConfirmPayment(row.id, false, note), `Đã từ chối thanh toán đơn ${row.code}.`)}>
                  Xác nhận từ chối
                </button>
                <button type="button" className={button('ghost', 'sm')} onClick={() => setRejecting(false)}>
                  Thôi
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run(() => orderService.adminConfirmPayment(row.id, true), `Đã xác nhận thanh toán đơn ${row.code}.`)}>
                Xác nhận đã nhận tiền
              </button>
              <button type="button" className={button('ghost', 'sm')} onClick={() => setRejecting(true)}>
                Chưa nhận được tiền
              </button>
            </div>
          )}
        </div>
      )}

      <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
        {row.shop_orders.map((so) => (
          <li key={so.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{so.shop_name}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatPrice(so.total)}</span>
                <OrderStatusBadge status={so.status} />
              </span>
            </div>
            <p className="mt-1 text-muted">{(so.items ?? []).map((i) => `${i.product_name} × ${i.quantity}`).join(', ')}</p>
            {so.status === 'cancelled' && (
              <p className="mt-1 text-danger">
                Hủy bởi {so.cancelled_by ? cancelledByLabels[so.cancelled_by]?.toLowerCase() : '—'}
                {so.cancel_reason ? `: ${so.cancel_reason}` : ''}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {so.refund_status === 'pending' && (
                <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run(() => orderService.adminMarkRefunded(so.id), `Đã đánh dấu hoàn tiền cho đơn ${row.code} – ${so.shop_name}.`)}>
                  Đánh dấu đã hoàn tiền {formatPrice(so.total)}
                </button>
              )}
              {so.refund_status === 'done' && <span className="text-xs font-semibold text-success">Đã hoàn tiền (mô phỏng)</span>}
              {!['delivered', 'cancelled'].includes(so.status) &&
                (cancelling === so.id ? (
                  <div className="w-full space-y-2">
                    <TextAreaField label="Lý do hủy (khách và người bán sẽ thấy)" value={cancelReason} onChange={setCancelReason} rows={2} maxLength={500} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={button('primary', 'sm')}
                        disabled={busy}
                        onClick={() =>
                          cancelReason.trim().length < CANCEL_REASON_MIN
                            ? setError(`Nhập lý do (ít nhất ${CANCEL_REASON_MIN} ký tự).`)
                            : void run(() => orderService.adminCancel(so.id, cancelReason), `Đã hủy đơn ${row.code} – ${so.shop_name}.`)
                        }
                      >
                        Xác nhận hủy
                      </button>
                      <button type="button" className={button('ghost', 'sm')} onClick={() => setCancelling(null)}>
                        Thôi
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={button('ghost', 'sm')} onClick={() => setCancelling(so.id)} aria-label={`Hủy đơn ${row.code} của ${so.shop_name}`}>
                    Hủy đơn này
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
      {row.note && <p className="mt-2 text-xs text-muted">Ghi chú của khách: {row.note}</p>}
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </li>
  )
}
