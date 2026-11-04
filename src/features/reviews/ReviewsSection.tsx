import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { Icon } from '@/components/ui/Icon'
import { button, Skeleton } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { catalogService } from '@/services/catalog'
import { EMPTY_REVIEWS, REVIEW_MAX_LENGTH, REVIEWS_PAGE_SIZE, reviewService, type ProductReviews, type ReviewItem } from '@/services/reviews'
import type { Product } from '@/types/catalog'

const ratingWords = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt']

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} className={i <= Math.round(value) ? 'fill-star text-star' : 'text-border'} />
      ))}
    </span>
  )
}

/** Chọn số sao bằng nút radio (dùng được bằng bàn phím và trình đọc màn hình) */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Chấm điểm</legend>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className="cursor-pointer rounded-lg p-1 hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
            <input type="radio" name="review-rating" value={i} checked={value === i} onChange={() => onChange(i)} className="sr-only" />
            <Icon name="star" size={28} className={i <= value ? "fill-star text-star" : "text-muted"} />
            <span className="sr-only">{i} sao – {ratingWords[i]}</span>
          </label>
        ))}
        <span className="ml-2 text-sm text-muted" aria-hidden="true">
          {value ? ratingWords[value] : 'Chọn số sao'}
        </span>
      </div>
    </fieldset>
  )
}

export function ReviewsSection({ product }: { product: Product }) {
  const { user, isSuspended } = useAuth()
  const location = useLocation()
  const [data, setData] = useState<ProductReviews | null>(null)
  const [more, setMore] = useState<ReviewItem[]>([])
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoadError(null)
    reviewService
      .forProduct(product.id)
      .then((r) => {
        if (!alive) return
        setData(r)
        setMore([])
        setPage(1)
      })
      .catch((e) => alive && setLoadError(friendlyError(e, 'Không tải được đánh giá.')))
    return () => {
      alive = false
    }
  }, [product.id, user?.id, reloadKey])

  // Mở từ link "Đánh giá sản phẩm" (…#reviews): cuộn tới mục đánh giá sau khi tải xong
  const loaded = data !== null
  useEffect(() => {
    if (loaded && location.hash === '#reviews') document.getElementById('reviews')?.scrollIntoView({ block: 'start' })
  }, [loaded, location.hash])

  const loadMore = async () => {
    const next = page + 1
    try {
      const r = await reviewService.forProduct(product.id, next)
      setMore((m) => [...m, ...r.items])
      setPage(next)
    } catch (e) {
      setLoadError(friendlyError(e, 'Không tải được đánh giá.'))
    }
  }

  const afterChange = () => {
    setReloadKey((k) => k + 1)
    // Điểm trên thẻ sản phẩm / trang shop do database tính lại: tải lại danh mục
    void catalogService.refresh().catch(() => undefined)
  }

  const r = data ?? EMPTY_REVIEWS
  const items = [...r.items, ...more]
  const hasMore = items.length < r.summary.count && r.items.length === REVIEWS_PAGE_SIZE

  return (
    <section id="reviews" className="mt-14 scroll-mt-40" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-xl font-bold">
        Đánh giá sản phẩm
      </h2>

      {!data && !loadError && <Skeleton className="mt-4 h-32 w-full" />}
      {loadError && (
        <div className="mt-4">
          <Alert kind="error">{loadError}</Alert>
        </div>
      )}

      {data && (
        <div className="mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="h-fit rounded-card border border-border bg-surface p-5">
            {r.summary.count > 0 ? (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tabular-nums">{r.summary.average.toFixed(1)}</span>
                  <span className="text-muted">/ 5</span>
                </p>
                <Stars value={r.summary.average} size={18} />
                <p className="mt-1 text-sm text-muted">{r.summary.count} đánh giá từ khách đã mua</p>
                <ul className="mt-4 space-y-1.5" aria-label="Phân bố số sao">
                  {(['5', '4', '3', '2', '1'] as const).map((s) => {
                    const n = r.summary.distribution[s] ?? 0
                    const pct = r.summary.count ? Math.round((n / r.summary.count) * 100) : 0
                    return (
                      <li key={s} className="flex items-center gap-2 text-xs">
                        <span className="w-8 shrink-0 tabular-nums text-muted">{s} ★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-star" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right tabular-nums text-muted">{n}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <>
                <p className="font-semibold">Chưa có đánh giá</p>
                <p className="mt-1 text-sm text-muted">Khách đã mua và nhận hàng sẽ là người đánh giá đầu tiên.</p>
              </>
            )}
          </div>

          <div className="space-y-5">
            <ReviewFormArea product={product} data={r} signedIn={Boolean(user)} suspended={isSuspended} loginNext={location.pathname} onChanged={afterChange} />

            {items.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                {items.map((it) => (
                  <li key={it.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={it.rating} size={14} />
                      <span className="text-sm font-semibold">{it.reviewer_name}</span>
                      {it.is_mine && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">Của bạn</span>}
                      <span className="text-xs text-muted">
                        {formatDate(it.created_at)}
                        {it.updated_at !== it.created_at && ' · đã sửa'}
                      </span>
                    </div>
                    {it.comment && <p className="mt-2 whitespace-pre-line text-sm">{it.comment}</p>}
                    {it.seller_reply && (
                      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Icon name="store" size={14} /> Phản hồi của cửa hàng
                        </p>
                        <p className="mt-1 whitespace-pre-line">{it.seller_reply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {hasMore && (
              <button type="button" className={button('secondary', 'sm')} onClick={() => void loadMore()}>
                Xem thêm đánh giá
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ReviewFormArea({
  product,
  data,
  signedIn,
  suspended,
  loginNext,
  onChanged,
}: {
  product: Product
  data: ProductReviews
  signedIn: boolean
  suspended: boolean
  loginNext: string
  onChanged: () => void
}) {
  const mine = data.mine
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    setRating(mine?.rating ?? 0)
    setComment(mine?.comment ?? '')
  }, [mine?.id, mine?.rating, mine?.comment])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-muted">Đánh giá hoạt động khi website kết nối Supabase.</p>
  }
  if (!signedIn) {
    return (
      <p className="rounded-card border border-dashed border-border p-4 text-sm text-muted">
        Đã mua sản phẩm này?{' '}
        <Link to={`/login?next=${encodeURIComponent(loginNext)}`} className="font-semibold text-primary hover:underline">
          Đăng nhập
        </Link>{' '}
        để viết đánh giá.
      </p>
    )
  }
  if (!mine && !data.can_review) {
    return (
      <p className="rounded-card border border-dashed border-border p-4 text-sm text-muted">
        {suspended ? 'Tài khoản đang bị tạm khóa nên chưa đánh giá được.' : 'Chỉ khách đã mua và đã nhận sản phẩm này mới viết được đánh giá.'}
      </p>
    )
  }

  const showForm = !mine || editing

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(null)
    if (!rating) return setError('Hãy chọn số sao.')
    setBusy(true)
    try {
      await reviewService.submit(product.id, rating, comment)
      setEditing(false)
      setDone(mine ? 'Đã cập nhật đánh giá.' : 'Cảm ơn bạn đã đánh giá!')
      onChanged()
    } catch (err) {
      setError(friendlyError(err, 'Không gửi được đánh giá.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!mine) return
    setBusy(true)
    setError(null)
    try {
      await reviewService.removeMine(mine.id)
      setDone('Đã xóa đánh giá của bạn.')
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(friendlyError(err, 'Không xóa được đánh giá.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      {mine?.hidden && (
        <div className="mb-3">
          <Alert kind="error">Đánh giá của bạn đã bị quản trị viên ẩn{mine.hidden_reason ? `: ${mine.hidden_reason}` : '.'}</Alert>
        </div>
      )}
      {done && (
        <div className="mb-3" role="status">
          <Alert kind="success">{done}</Alert>
        </div>
      )}
      {showForm ? (
        <form onSubmit={submit} className="space-y-3" aria-label="Viết đánh giá">
          <h3 className="font-semibold">{mine ? 'Sửa đánh giá của bạn' : 'Viết đánh giá'}</h3>
          <StarInput value={rating} onChange={setRating} />
          <TextAreaField
            label="Nhận xét (không bắt buộc)"
            value={comment}
            onChange={setComment}
            maxLength={REVIEW_MAX_LENGTH}
            counter
            rows={3}
            placeholder="Kết cấu, mùi, cảm nhận sau khi dùng…"
            hint="Không ghi số điện thoại, địa chỉ hay thông tin cá nhân. Tên bạn được hiển thị dạng rút gọn."
          />
          {error && <Alert kind="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={button('primary', 'sm')} disabled={busy}>
              {busy ? 'Đang gửi…' : mine ? 'Lưu thay đổi' : 'Gửi đánh giá'}
            </button>
            {mine && (
              <button type="button" className={button('ghost', 'sm')} onClick={() => setEditing(false)} disabled={busy}>
                Hủy
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Bạn đã đánh giá <span className="font-semibold">{mine!.rating} sao</span> cho sản phẩm này.
          </p>
          <div className="flex gap-2">
            <button type="button" className={button('secondary', 'sm')} onClick={() => setEditing(true)} disabled={busy}>
              Sửa
            </button>
            <button type="button" className={button('ghost', 'sm')} onClick={() => void remove()} disabled={busy}>
              <Icon name="trash" size={16} /> Xóa
            </button>
          </div>
          {error && (
            <div className="w-full">
              <Alert kind="error">{error}</Alert>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
