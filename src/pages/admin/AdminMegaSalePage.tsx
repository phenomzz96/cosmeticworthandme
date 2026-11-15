/**
 * MEGA SALE — /admin/mega-sale. Chỉ Admin; database kiểm tra quyền, ghi nhật ký.
 * Tạo đợt sale theo dịp (thời gian, mức giảm tối thiểu), duyệt / từ chối sản phẩm người bán đăng ký.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, TextField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { itemStatusLabels, megaSaleService, saleState, type MegaSale, type MegaSaleInput, type MegaSaleItem } from '@/services/megaSale'
import type { Product } from '@/types/catalog'

const stateLabel = {
  running: { text: 'Đang diễn ra', cls: 'bg-success/10 text-success' },
  upcoming: { text: 'Sắp diễn ra', cls: 'bg-primary-soft text-primary' },
  ended: { text: 'Đã kết thúc', cls: 'bg-surface-2 text-muted' },
  off: { text: 'Đang tắt', cls: 'bg-surface-2 text-muted' },
} as const

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptySale(): MegaSaleInput {
  const start = new Date(Date.now() + 86_400_000)
  start.setHours(0, 0, 0, 0)
  return {
    id: null,
    title: '',
    tagline: '',
    starts_at: toLocalInput(start.toISOString()),
    ends_at: toLocalInput(new Date(start.getTime() + 3 * 86_400_000).toISOString()),
    min_discount_percent: 10,
    is_active: false,
  }
}

export function AdminMegaSalePage() {
  useDocumentTitle('Mega Sale')
  const [list, setList] = useState<{ status: 'loading' | 'ready' | 'error'; items: MegaSale[]; error?: string }>({ status: 'loading', items: [] })
  const [form, setForm] = useState<MegaSaleInput | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setList({ status: 'ready', items: await megaSaleService.adminSales() })
    } catch (err) {
      setList({ status: 'error', items: [], error: friendlyError(err) })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setError(null)
    if (form.title.trim().length < 3) return setError('Nhập tên đợt sale (ít nhất 3 ký tự).')
    const start = new Date(form.starts_at).getTime()
    const end = new Date(form.ends_at).getTime()
    if (end <= start) return setError('Thời gian kết thúc phải sau thời gian bắt đầu.')
    if (end - start > 31 * 86_400_000) return setError('Mỗi đợt Mega Sale kéo dài tối đa 31 ngày.')
    setBusy(true)
    try {
      const id = await megaSaleService.save({ ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() })
      setNotice(form.id ? 'Đã cập nhật đợt sale.' : 'Đã tạo đợt sale. Bật đợt sale để người bán đăng ký sản phẩm.')
      setForm(null)
      setSelected(id)
      void load()
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được đợt sale.'))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (s: MegaSale) => {
    setError(null)
    try {
      await megaSaleService.save({ ...s, is_active: !s.is_active })
      setNotice(s.is_active ? `Đã tắt "${s.title}". Giá sản phẩm đã trả về như cũ.` : `Đã bật "${s.title}".`)
      void load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const remove = async (s: MegaSale) => {
    if (!window.confirm(`Xóa đợt sale "${s.title}"? Chỉ xóa được khi chưa bắt đầu.`)) return
    setError(null)
    try {
      await megaSaleService.remove(s.id)
      setNotice(`Đã xóa "${s.title}".`)
      if (selected === s.id) setSelected(null)
      void load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const current = list.items.find((s) => s.id === selected)

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">Mega Sale</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Tạo đợt sale lớn cho dịp lễ, ngày đặc biệt. Người bán đăng ký sản phẩm với giá sale (giảm ít nhất mức bạn đặt), bạn duyệt. Giá sale tự áp dụng trong thời gian chương trình
            và tự trả về khi kết thúc hoặc khi bạn tắt đợt sale.
          </p>
        </div>
        {!form && (
          <button type="button" className={button('dark')} onClick={() => (setForm(emptySale()), setError(null), setNotice(null))}>
            Tạo đợt Mega Sale
          </button>
        )}
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && !form && (
        <div className="mt-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="mt-6 space-y-4 rounded-card border border-border bg-surface p-5" aria-label={form.id ? 'Sửa đợt sale' : 'Tạo đợt sale'}>
          <h2 className="font-display text-2xl font-semibold">{form.id ? `Sửa "${form.title}"` : 'Đợt Mega Sale mới'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Tên đợt sale" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Mega Sale 11.11" required />
            <TextField label="Khẩu hiệu ngắn" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} maxLength={160} placeholder="Giảm sâu toàn sàn, chỉ 3 ngày" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Bắt đầu" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
            <TextField label="Kết thúc" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} required />
            <TextField
              label="Giảm tối thiểu (%)"
              type="number"
              min={1}
              max={90}
              value={String(form.min_discount_percent)}
              onChange={(e) => setForm({ ...form, min_discount_percent: Math.min(90, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
              hint="Giá sale phải thấp hơn giá gốc ít nhất mức này"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[var(--primary)]" />
            Bật đợt sale (người bán đăng ký được, khách thấy trang Mega Sale)
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="flex gap-2">
            <button type="submit" className={button('dark')} disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu đợt sale'}
            </button>
            <button type="button" className={button('ghost')} onClick={() => setForm(null)}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {list.status === 'loading' && <Skeleton className="h-40 w-full" />}
        {list.status === 'error' && <Alert kind="error">{list.error}</Alert>}
        {list.status === 'ready' && list.items.length === 0 && !form && <EmptyState title="Chưa có đợt Mega Sale">Tạo đợt sale cho dịp lễ sắp tới.</EmptyState>}
        {list.items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách đợt sale">
            {list.items.map((s) => {
              const st = stateLabel[saleState(s)]
              return (
                <li key={s.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${selected === s.id ? 'bg-primary-soft/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDateTime(s.starts_at)} – {formatDateTime(s.ends_at)} · giảm từ {s.min_discount_percent}%
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" className={button(selected === s.id ? 'dark' : 'secondary', 'sm')} onClick={() => setSelected(selected === s.id ? null : s.id)} aria-expanded={selected === s.id}>
                      Duyệt sản phẩm
                    </button>
                    <button
                      type="button"
                      className={button('ghost', 'sm')}
                      onClick={() => (setForm({ ...s, starts_at: toLocalInput(s.starts_at), ends_at: toLocalInput(s.ends_at) }), setError(null), setNotice(null))}
                    >
                      Sửa
                    </button>
                    <button type="button" className={button('ghost', 'sm')} onClick={() => void toggle(s)}>
                      {s.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button type="button" className={button('ghost', 'sm')} onClick={() => void remove(s)}>
                      Xóa
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {current && <ReviewPanel key={current.id} sale={current} />}
    </div>
  )
}

function ReviewPanel({ sale }: { sale: MegaSale }) {
  const [items, setItems] = useState<MegaSaleItem[] | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [filter, setFilter] = useState<MegaSaleItem['status'] | 'all'>('pending')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await megaSaleService.adminItems(sale.id)
      const ps = await catalogService.getProductsByIds(list.map((i) => i.product_id))
      setProducts(new Map(ps.map((p) => [p.id, p])))
      setItems(list)
    } catch (err) {
      setError(friendlyError(err))
      setItems([])
    }
  }, [sale.id])
  useEffect(() => {
    void load()
  }, [load])

  const review = async (item: MegaSaleItem, approve: boolean) => {
    setError(null)
    try {
      await megaSaleService.review(item.id, approve, reasons[item.id] ?? '')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const shown = (items ?? []).filter((i) => filter === 'all' || i.status === filter)
  const count = (s: MegaSaleItem['status']) => (items ?? []).filter((i) => i.status === s).length

  return (
    <section className="mt-8 rounded-card border border-border bg-surface p-5" aria-labelledby="review-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="review-heading" className="font-display text-2xl font-semibold">
          Sản phẩm đăng ký: {sale.title}
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-sm ${filter === f ? 'border-ink bg-ink text-on-ink' : 'border-border hover:border-text'}`}
            >
              {f === 'all' ? `Tất cả (${items?.length ?? 0})` : `${itemStatusLabels[f]} (${count(f)})`}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {items == null ? (
        <Skeleton className="mt-4 h-32 w-full" />
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Không có đăng ký nào ở mục này.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border" aria-label="Danh sách đăng ký">
          {shown.map((i) => {
            const p = products.get(i.product_id)
            const orig = p?.originalPrice ?? p?.price ?? 0
            const off = orig ? Math.round(((orig - i.sale_price) / orig) * 100) : 0
            return (
              <li key={i.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p?.name ?? 'Sản phẩm không còn hiển thị công khai'}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {p && `${catalogService.getShopByIdSync(p.shopId)?.name ?? ''} · giá gốc ${formatPrice(orig)} → `}
                    <strong className="text-sale">{formatPrice(i.sale_price)}</strong>
                    {off > 0 && ` (-${off}%)`} · {i.applied ? 'Đang chạy sale' : itemStatusLabels[i.status]}
                    {i.status === 'rejected' && i.reject_reason && ` · ${i.reject_reason}`}
                  </p>
                </div>
                {!i.applied && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {i.status !== 'approved' && (
                      <button type="button" className={button('dark', 'sm')} onClick={() => void review(i, true)}>
                        Duyệt
                      </button>
                    )}
                    {i.status !== 'rejected' && (
                      <>
                        <input
                          aria-label={`Lý do từ chối ${p?.name ?? ''}`}
                          className="h-8 w-48 rounded-lg border border-border bg-surface px-2 text-xs"
                          placeholder="Lý do từ chối"
                          maxLength={300}
                          value={reasons[i.id] ?? ''}
                          onChange={(e) => setReasons({ ...reasons, [i.id]: e.target.value })}
                        />
                        <button type="button" className={button('ghost', 'sm')} onClick={() => void review(i, false)}>
                          Từ chối
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
