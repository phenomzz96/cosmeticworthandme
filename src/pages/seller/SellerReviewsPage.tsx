/**
 * ĐÁNH GIÁ CỦA SHOP — /seller/reviews
 * Người bán xem đánh giá sản phẩm của shop mình và trả lời công khai. Không sửa hay xóa được đánh giá của khách.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { Stars } from '@/features/reviews/Stars'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { REVIEW_MAX_LENGTH, reviewService, type SellerReview } from '@/services/reviews'

const PAGE_SIZE = 20

export function SellerReviewsPage() {
  useDocumentTitle('Đánh giá của shop')
  const [unrepliedOnly, setUnrepliedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: SellerReview[]; total: number; error?: string }>({
    status: 'loading',
    items: [],
    total: 0,
  })

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', ...(await reviewService.sellerList(unrepliedOnly, page, PAGE_SIZE)) })
    } catch (err) {
      setState({ status: 'error', items: [], total: 0, error: friendlyError(err) })
    }
  }, [unrepliedOnly, page])

  useEffect(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    void load()
  }, [load])

  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Đánh giá</h1>
      <p className="mt-1 text-sm text-muted">Đánh giá của khách đã nhận hàng. Trả lời của bạn hiện công khai dưới đánh giá trên trang sản phẩm.</p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Lọc đánh giá">
        <button type="button" aria-pressed={!unrepliedOnly} className={chip(!unrepliedOnly)} onClick={() => (setUnrepliedOnly(false), setPage(1))}>
          Tất cả
        </button>
        <button type="button" aria-pressed={unrepliedOnly} className={chip(unrepliedOnly)} onClick={() => (setUnrepliedOnly(true), setPage(1))}>
          Chưa trả lời
        </button>
      </div>

      <div className="mt-4">
        {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.items.length === 0 && (
          <EmptyState title={unrepliedOnly ? 'Không còn đánh giá nào chưa trả lời' : 'Chưa có đánh giá'}>
            Khách chỉ đánh giá được sau khi đơn hàng ở trạng thái "Đã giao".
          </EmptyState>
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách đánh giá">
            {state.items.map((r) => (
              <SellerReviewRow key={r.id} review={r} onSaved={() => void load()} />
            ))}
          </ul>
        )}
      </div>

      {state.status === 'ready' && pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3 text-sm" aria-label="Phân trang">
          <button type="button" className={button('secondary', 'sm')} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trang trước
          </button>
          <span>
            Trang {page}/{pages}
          </span>
          <button type="button" className={button('secondary', 'sm')} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Trang sau
          </button>
        </nav>
      )}
    </div>
  )
}

function SellerReviewRow({ review: r, onSaved }: { review: SellerReview; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [reply, setReply] = useState(r.seller_reply ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (text: string) => {
    setBusy(true)
    setError(null)
    try {
      await reviewService.reply(r.id, text)
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được trả lời.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.rating} size={14} />
        <Link to={`/products/${r.product_slug}#reviews`} className="font-medium hover:text-primary">
          {r.product_name}
        </Link>
        <span className="text-xs text-muted">
          {r.reviewer_name} · {formatDateTime(r.created_at)}
        </span>
      </div>
      {r.comment ? <p className="mt-2 whitespace-pre-line text-sm">{r.comment}</p> : <p className="mt-2 text-sm italic text-muted">Khách không viết nhận xét</p>}
      {r.hidden && <p className="mt-2 text-xs font-semibold text-danger">Quản trị viên đã ẩn đánh giá này: {r.hidden_reason}</p>}

      {!editing && r.seller_reply && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="text-xs font-semibold text-primary">Trả lời của bạn</p>
          <p className="mt-1 whitespace-pre-line">{r.seller_reply}</p>
        </div>
      )}
      {!editing && (
        <div className="mt-3 flex gap-2">
          <button type="button" className={button('secondary', 'sm')} onClick={() => setEditing(true)}>
            {r.seller_reply ? 'Sửa trả lời' : 'Trả lời'}
          </button>
          {r.seller_reply && (
            <button type="button" className={button('ghost', 'sm')} disabled={busy} onClick={() => void save('')}>
              Xóa trả lời
            </button>
          )}
        </div>
      )}
      {editing && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <TextAreaField label="Trả lời công khai" value={reply} onChange={setReply} rows={3} maxLength={REVIEW_MAX_LENGTH} counter />
          <div className="flex gap-2">
            <button type="button" className={button('primary', 'sm')} disabled={busy || !reply.trim()} onClick={() => void save(reply)}>
              {busy ? 'Đang lưu...' : 'Lưu trả lời'}
            </button>
            <button type="button" className={button('ghost', 'sm')} onClick={() => (setEditing(false), setReply(r.seller_reply ?? ''))}>
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
