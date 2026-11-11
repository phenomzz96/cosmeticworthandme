/**
 * KIỂM DUYỆT ĐÁNH GIÁ — /admin/reviews
 * Admin ẩn đánh giá vi phạm (quảng cáo, thông tin cá nhân, ngôn từ xúc phạm...) kèm lý do, hoặc bỏ ẩn.
 * Đánh giá bị ẩn không tính vào điểm sản phẩm/shop. Mọi thao tác được ghi nhật ký.
 */
import { ScrollRow } from '@/components/ui/ScrollRow'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { Stars } from '@/features/reviews/ReviewsSection'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { REPORT_REASONS, reviewService, type AdminReview } from '@/services/reviews'

const PAGE_SIZE = 20

export function AdminReviewsPage() {
  useDocumentTitle('Kiểm duyệt đánh giá')
  const [params, setParams] = useSearchParams()
  const filter = params.get('f') ?? 'all'
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [searchInput, setSearchInput] = useState(search)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: AdminReview[]; total: number; error?: string }>({
    status: 'loading',
    items: [],
    total: 0,
  })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const f = filter === 'hidden' ? { hidden: true } : filter === 'low' ? { maxRating: 2 } : filter === 'reported' ? { reported: true } : {}
      setState({ status: 'ready', ...(await reviewService.adminList({ ...f, query: search }, page, PAGE_SIZE)) })
    } catch (err) {
      setState({ status: 'error', items: [], total: 0, error: friendlyError(err) })
    }
  }, [filter, search, page])

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

  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`
  const filters = [
    { id: 'all', label: 'Tất cả' },
    { id: 'reported', label: 'Bị khách báo cáo' },
    { id: 'low', label: 'Từ 2 sao trở xuống' },
    { id: 'hidden', label: 'Đang bị ẩn' },
  ]

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Đánh giá</h1>
      <p className="mt-1 text-sm text-muted">
        Ẩn đánh giá vi phạm (quảng cáo, lộ thông tin cá nhân, ngôn từ xúc phạm). Không ẩn đánh giá chỉ vì chê sản phẩm. Đánh giá bị ẩn không tính vào điểm.
      </p>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ScrollRow role="group" aria-label="Lọc đánh giá" className="flex gap-2">
          {filters.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} className={chip(filter === f.id)} onClick={() => update({ f: f.id === 'all' ? null : f.id })}>
              {f.label}
            </button>
          ))}
        </ScrollRow>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tên sản phẩm, nội dung, email"
          aria-label="Tìm đánh giá"
          className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm md:w-80"
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
        {state.status === 'ready' && state.items.length === 0 && <EmptyState title="Không có đánh giá phù hợp" />}
        {state.status === 'ready' && state.items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách đánh giá">
            {state.items.map((r) => (
              <AdminReviewRow
                key={r.id}
                review={r}
                onDone={(text) => {
                  setNotice({ kind: 'success', text })
                  void load()
                  void catalogService.refresh().catch(() => undefined)
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

function AdminReviewRow({ review: r, onDone }: { review: AdminReview; onDone: (text: string) => void }) {
  const [hiding, setHiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (hide: boolean) => {
    if (hide && reason.trim().length < 5) return setError('Nhập lý do (ít nhất 5 ký tự). Người viết đánh giá sẽ thấy lý do này.')
    setBusy(true)
    setError(null)
    try {
      await reviewService.adminSetHidden(r.id, hide, reason)
      setHiding(false)
      setReason('')
      onDone(hide ? `Đã ẩn đánh giá của ${r.reviewer_name}.` : `Đã bỏ ẩn đánh giá của ${r.reviewer_name}.`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars value={r.rating} size={14} />
            <Link to={`/products/${r.product_slug}#reviews`} className="font-medium hover:text-primary">
              {r.product_name}
            </Link>
            <span className="text-xs text-muted">{r.shop_name}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {r.reviewer_name} ({r.reviewer_email ?? 'tài khoản đã xóa'}) · {formatDateTime(r.created_at)}
          </p>
          {r.comment ? <p className="mt-2 whitespace-pre-line text-sm">{r.comment}</p> : <p className="mt-2 text-sm italic text-muted">Không có nhận xét</p>}
          {r.seller_reply && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">Cửa hàng trả lời: {r.seller_reply}</p>}
          {r.report_count > 0 && (
            <p className="mt-2 text-xs font-semibold text-sale">
              {r.report_count} báo cáo: {(r.report_reasons ?? []).map((x) => REPORT_REASONS.find((rr) => rr.value === x)?.label ?? x).join(', ')}
            </p>
          )}
          {r.hidden && <p className="mt-2 text-xs font-semibold text-danger">Đang bị ẩn: {r.hidden_reason}</p>}
        </div>
        {!hiding && (
          <div className="shrink-0">
            {r.hidden ? (
              <button type="button" className={button('secondary', 'sm')} disabled={busy} onClick={() => void run(false)}>
                Bỏ ẩn
              </button>
            ) : (
              <button type="button" className={button('ghost', 'sm')} onClick={() => setHiding(true)} aria-label={`Ẩn đánh giá của ${r.reviewer_name}`}>
                Ẩn đánh giá
              </button>
            )}
          </div>
        )}
      </div>
      {hiding && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <TextAreaField label="Lý do ẩn (người viết sẽ thấy)" value={reason} onChange={setReason} rows={2} maxLength={300} />
          <div className="flex gap-2">
            <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run(true)}>
              {busy ? 'Đang xử lý...' : 'Xác nhận ẩn'}
            </button>
            <button type="button" className={button('ghost', 'sm')} onClick={() => setHiding(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
    </li>
  )
}
