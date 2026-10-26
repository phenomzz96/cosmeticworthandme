/**
 * BANNER TRANG CHỦ — /admin/banners
 * Thêm, bật/tắt, sắp xếp, đặt thời gian hiển thị, xóa banner. Database kiểm tra quyền Admin và ghi nhật ký.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, TextField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { bannerService, bannerUrl, MAX_BANNERS, validateBannerLink, type Banner } from '@/services/banners'
import { validateBrandFile } from '@/services/siteSettings'

const linkPresets = [
  { value: '/products', label: 'Tất cả sản phẩm' },
  { value: '/products?category=skincare', label: 'Skincare' },
  { value: '/products?category=makeup', label: 'Makeup' },
  { value: '/products?category=haircare', label: 'Haircare' },
  { value: '/products?category=body-care', label: 'Body Care' },
  { value: '/beauty-finder', label: 'Beauty Finder' },
  { value: '/shops', label: 'Danh sách cửa hàng' },
]

/** Ô datetime-local ("2026-10-26T14:00", giờ máy) → ISO */
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

function bannerState(b: Banner): { label: string; tone: string } {
  const now = Date.now()
  if (!b.is_active) return { label: 'Đang tắt', tone: 'bg-surface-2 text-muted' }
  if (b.starts_at && Date.parse(b.starts_at) > now) return { label: 'Chờ đến giờ', tone: 'bg-accent-soft text-on-accent dark:text-accent' }
  if (b.ends_at && Date.parse(b.ends_at) <= now) return { label: 'Đã hết hạn', tone: 'bg-danger/10 text-danger' }
  return { label: 'Đang hiển thị', tone: 'bg-success/15 text-success' }
}

export function AdminBannersPage() {
  useDocumentTitle('Banner trang chủ')
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; list: Banner[]; error?: string }>({ status: 'loading', list: [] })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', list: await bannerService.listAll() })
    } catch (err) {
      setState({ status: 'error', list: [], error: friendlyError(err) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<void>, ok: string) => {
    setNotice(null)
    try {
      await fn()
      setNotice({ kind: 'success', text: ok })
    } catch (err) {
      setNotice({ kind: 'error', text: friendlyError(err) })
    }
    await load()
  }

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banner trang chủ</h1>
          <p className="mt-1 text-sm text-muted">Tối đa {MAX_BANNERS} banner. Banner chỉ dẫn tới trang trong website. Ảnh ngang khoảng 3:1, PNG/JPG/WebP ≤ 2 MB.</p>
        </div>
        {!adding && state.status === 'ready' && state.list.length < MAX_BANNERS && (
          <button type="button" className={button('primary', 'sm')} onClick={() => setAdding(true)}>
            Thêm banner
          </button>
        )}
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}

      {adding && (
        <div className="mt-4">
          <BannerForm
            onCancel={() => setAdding(false)}
            onSaved={async () => {
              setAdding(false)
              setNotice({ kind: 'success', text: 'Đã thêm banner.' })
              await load()
            }}
          />
        </div>
      )}

      <div className="mt-4">
        {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.list.length === 0 && !adding && (
          <EmptyState title="Chưa có banner">Trang chủ đang hiển thị phần giới thiệu mặc định. Thêm banner để quảng bá chương trình ưu đãi.</EmptyState>
        )}
        {state.status === 'ready' && state.list.length > 0 && (
          <ul className="space-y-3" aria-label="Danh sách banner">
            {state.list.map((b) => {
              const st = bannerState(b)
              return (
                <li key={b.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:flex-row sm:items-center">
                  <img src={bannerUrl(b) ?? ''} alt="" className="aspect-[3/1] w-full rounded-xl bg-surface-2 object-cover sm:w-56" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {b.title} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${st.tone}`}>{st.label}</span>
                    </p>
                    {b.subtitle && <p className="text-sm text-muted">{b.subtitle}</p>}
                    <p className="mt-1 text-xs text-muted">
                      Dẫn tới <span className="font-mono">{b.link_url}</span> · Thứ tự {b.sort_order}
                      {b.starts_at && ` · Từ ${formatDateTime(b.starts_at)}`}
                      {b.ends_at && ` · Đến ${formatDateTime(b.ends_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" className={button('secondary', 'sm')} onClick={() => void run(() => bannerService.update(b.id, { is_active: !b.is_active }), b.is_active ? 'Đã tắt banner.' : 'Đã bật banner.')}>
                      {b.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button type="button" className={button('ghost', 'sm')} aria-label={`Đưa banner ${b.title} lên trước`} onClick={() => void run(() => bannerService.update(b.id, { sort_order: Math.max(0, b.sort_order - 1) }), 'Đã đổi thứ tự.')}>
                      ↑
                    </button>
                    <button type="button" className={button('ghost', 'sm')} aria-label={`Đưa banner ${b.title} ra sau`} onClick={() => void run(() => bannerService.update(b.id, { sort_order: Math.min(100, b.sort_order + 1) }), 'Đã đổi thứ tự.')}>
                      ↓
                    </button>
                    <DeleteButton title={b.title} onConfirm={() => run(() => bannerService.remove(b.id), 'Đã xóa banner.')} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function DeleteButton({ title, onConfirm }: { title: string; onConfirm: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  return confirm ? (
    <>
      <button type="button" className={button('primary', 'sm')} onClick={() => void onConfirm().then(() => setConfirm(false))}>
        Xác nhận xóa
      </button>
      <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirm(false)}>
        Thôi
      </button>
    </>
  ) : (
    <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirm(true)} aria-label={`Xóa banner ${title}`}>
      Xóa
    </button>
  )
}

function BannerForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [link, setLink] = useState('/products')
  const [order, setOrder] = useState('0')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(order)
    const v = {
      title: title.trim().length < 2 || title.length > 80 ? 'Tiêu đề 2–80 ký tự.' : null,
      subtitle: subtitle.length > 160 ? 'Tối đa 160 ký tự.' : null,
      link: validateBannerLink(link),
      order: !Number.isInteger(n) || n < 0 || n > 100 ? 'Từ 0 đến 100.' : null,
      file: !file ? 'Chọn ảnh banner.' : validateBrandFile(file),
      endsAt: startsAt && endsAt && new Date(endsAt) <= new Date(startsAt) ? 'Thời gian kết thúc phải sau thời gian bắt đầu.' : null,
    }
    setErrors(v)
    setError(null)
    if (Object.values(v).some(Boolean)) return
    setSaving(true)
    try {
      const image_path = await bannerService.uploadImage(file!)
      await bannerService.create({ title: title.trim(), subtitle: subtitle.trim(), image_path, link_url: link, sort_order: n, is_active: true, starts_at: fromLocalInput(startsAt), ends_at: fromLocalInput(endsAt) })
      await onSaved()
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được banner.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-border bg-surface p-5" aria-label="Thêm banner">
      <fieldset disabled={saving} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Tiêu đề" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
          <TextField label="Mô tả ngắn (không bắt buộc)" value={subtitle} maxLength={160} onChange={(e) => setSubtitle(e.target.value)} error={errors.subtitle} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
          <label className="block">
            <span className="text-sm font-medium">Trang có sẵn</span>
            <select value={linkPresets.some((p) => p.value === link) ? link : ''} onChange={(e) => e.target.value && setLink(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3">
              <option value="">Tự nhập liên kết</option>
              {linkPresets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Liên kết khi bấm banner" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} error={errors.link} />
          <TextField label="Thứ tự" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} error={errors.order} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Bắt đầu hiển thị (không bắt buộc)" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <TextField label="Ngừng hiển thị (không bắt buộc)" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} error={errors.endsAt} />
        </div>
        <div>
          <label className={`${button('secondary', 'sm')} cursor-pointer`}>
            {file ? 'Đổi ảnh' : 'Chọn ảnh banner'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Chọn ảnh banner từ máy" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {errors.file && <p className="mt-1 text-xs font-medium text-danger">{errors.file}</p>}
          {preview && <img src={preview} alt="Xem trước banner" className="mt-3 aspect-[3/1] w-full max-w-xl rounded-xl object-cover" />}
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2">
          <button type="submit" className={button('primary')}>
            {saving ? 'Đang lưu...' : 'Lưu banner'}
          </button>
          <button type="button" className={button('ghost')} onClick={onCancel}>
            Hủy
          </button>
        </div>
      </fieldset>
    </form>
  )
}
