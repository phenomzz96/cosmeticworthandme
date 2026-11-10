/**
 * Quản lý mã giảm giá — dùng chung cho người bán (voucher của shop) và Admin (voucher toàn sàn).
 * Database kiểm tra quyền (chủ shop / Admin), định dạng mã, mức giảm, ngày hiệu lực.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, TextField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { describeVoucher, voucherService, voucherState, type Voucher, type VoucherInput } from '@/services/vouchers'

const stateLabel: Record<ReturnType<typeof voucherState>, { text: string; cls: string }> = {
  running: { text: 'Đang chạy', cls: 'bg-success/10 text-success' },
  upcoming: { text: 'Sắp bắt đầu', cls: 'bg-primary-soft text-primary' },
  expired: { text: 'Hết hạn', cls: 'bg-surface-2 text-muted' },
  off: { text: 'Đang tắt', cls: 'bg-surface-2 text-muted' },
  'used-up': { text: 'Hết lượt', cls: 'bg-surface-2 text-muted' },
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyForm(shopId: string | null): VoucherInput {
  const start = new Date()
  const end = new Date(Date.now() + 30 * 86_400_000)
  return {
    id: null,
    shopId,
    code: '',
    title: '',
    discountType: 'fixed',
    discountValue: 20000,
    maxDiscount: null,
    minSpend: 0,
    startsAt: toLocalInput(start.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    usageLimit: 100,
    perUserLimit: 1,
    isActive: true,
  }
}

export function VoucherManager({ shopId, title, intro }: { shopId: string | null; title: string; intro: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; list: Voucher[]; error?: string }>({ status: 'loading', list: [] })
  const [form, setForm] = useState<VoucherInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const list = shopId ? await voucherService.listForShop(shopId) : await voucherService.listPlatform()
      setState({ status: 'ready', list })
    } catch (err) {
      setState({ status: 'error', list: [], error: friendlyError(err) })
    }
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const edit = (v: Voucher) =>
    setForm({
      id: v.id,
      shopId,
      code: v.code,
      title: v.title,
      discountType: v.discount_type,
      discountValue: v.discount_value,
      maxDiscount: v.max_discount,
      minSpend: v.min_spend,
      startsAt: toLocalInput(v.starts_at),
      endsAt: toLocalInput(v.ends_at),
      usageLimit: v.usage_limit,
      perUserLimit: v.per_user_limit,
      isActive: v.is_active,
    })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setError(null)
    if (!/^[A-Z0-9]{4,20}$/.test(form.code.trim().toUpperCase())) return setError('Mã gồm 4–20 chữ cái không dấu hoặc chữ số, viết liền (ví dụ GIAM20K).')
    if (form.title.trim().length < 3) return setError('Nhập tên chương trình (ít nhất 3 ký tự).')
    setBusy(true)
    try {
      await voucherService.save({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() })
      setNotice(form.id ? `Đã cập nhật mã ${form.code.toUpperCase()}.` : `Đã tạo mã ${form.code.toUpperCase()}.`)
      setForm(null)
      void load()
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được mã giảm giá.'))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (v: Voucher) => {
    try {
      await voucherService.save({
        id: v.id,
        shopId,
        code: v.code,
        title: v.title,
        discountType: v.discount_type,
        discountValue: v.discount_value,
        maxDiscount: v.max_discount,
        minSpend: v.min_spend,
        startsAt: v.starts_at,
        endsAt: v.ends_at,
        usageLimit: v.usage_limit,
        perUserLimit: v.per_user_limit,
        isActive: !v.is_active,
      })
      setNotice(v.is_active ? `Đã tắt mã ${v.code}.` : `Đã bật mã ${v.code}.`)
      void load()
    } catch (err) {
      setNotice(null)
      setError(friendlyError(err))
    }
  }

  const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.floor(Number(v) || 0)))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{intro}</p>
        </div>
        {!form && (
          <button type="button" className={button('dark')} onClick={() => (setForm(emptyForm(shopId)), setError(null), setNotice(null))}>
            Tạo mã giảm giá
          </button>
        )}
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="mt-6 space-y-4 rounded-card border border-border bg-surface p-5" aria-label={form.id ? 'Sửa mã giảm giá' : 'Tạo mã giảm giá'}>
          <h2 className="font-display text-2xl font-semibold">{form.id ? `Sửa mã ${form.code}` : 'Mã giảm giá mới'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Mã (khách nhập khi đặt hàng)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} placeholder="GIAM20K" required />
            <TextField label="Tên chương trình" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Giảm 20.000đ cho đơn từ 200.000đ" required />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Kiểu giảm</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['fixed', 'percent'] as const).map((t) => (
                <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${form.discountType === t ? 'border-ink bg-ink text-on-ink' : 'border-border'}`}>
                  <input type="radio" name="discount-type" className="sr-only" checked={form.discountType === t} onChange={() => setForm({ ...form, discountType: t, discountValue: t === 'percent' ? 10 : 20000 })} />
                  {t === 'fixed' ? 'Số tiền cố định' : 'Theo phần trăm'}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={form.discountType === 'percent' ? 'Giảm (%) — tối đa 90' : 'Số tiền giảm (đ)'}
              type="number"
              min={1}
              max={form.discountType === 'percent' ? 90 : 10000000}
              value={String(form.discountValue)}
              onChange={(e) => setForm({ ...form, discountValue: num(e.target.value) })}
              required
            />
            {form.discountType === 'percent' && (
              <TextField
                label="Giảm tối đa (đ, để trống = không giới hạn)"
                type="number"
                min={1}
                value={form.maxDiscount == null ? '' : String(form.maxDiscount)}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value === '' ? null : num(e.target.value) })}
              />
            )}
            <TextField label="Đơn tối thiểu (đ)" type="number" min={0} value={String(form.minSpend)} onChange={(e) => setForm({ ...form, minSpend: num(e.target.value) })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Bắt đầu" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required />
            <TextField label="Kết thúc" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Tổng lượt dùng (để trống = không giới hạn)"
              type="number"
              min={1}
              value={form.usageLimit == null ? '' : String(form.usageLimit)}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value === '' ? null : Math.max(1, num(e.target.value)) })}
            />
            <TextField label="Lượt dùng mỗi khách" type="number" min={1} max={100} value={String(form.perUserLimit)} onChange={(e) => setForm({ ...form, perUserLimit: Math.max(1, num(e.target.value)) })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-[var(--primary)]" />
            Bật mã ngay (khách thấy và dùng được trong thời gian hiệu lực)
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="flex gap-2">
            <button type="submit" className={button('dark')} disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu mã'}
            </button>
            <button type="button" className={button('ghost')} onClick={() => setForm(null)}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {state.status === 'loading' && <Skeleton className="h-40 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.list.length === 0 && !form && <EmptyState title="Chưa có mã giảm giá">Tạo mã để khách nhập khi đặt hàng.</EmptyState>}
        {state.status === 'ready' && state.list.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách mã giảm giá">
            {state.list.map((v) => {
              const st = stateLabel[voucherState(v)]
              return (
                <li key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider">{v.code}</span>
                      <span className="font-medium">{v.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {describeVoucher(v)} · {formatDate(v.starts_at)} – {formatDate(v.ends_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Đã dùng {v.used_count}
                      {v.usage_limit != null && `/${v.usage_limit}`} lượt · mỗi khách {v.per_user_limit} lượt
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className={button('secondary', 'sm')} onClick={() => edit(v)}>
                      Sửa
                    </button>
                    <button type="button" className={button('ghost', 'sm')} onClick={() => void toggleActive(v)}>
                      {v.is_active ? 'Tắt' : 'Bật'}
                    </button>
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
