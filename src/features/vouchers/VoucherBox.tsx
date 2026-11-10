import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { describeVoucher, voucherService, type VoucherPreview } from '@/services/vouchers'

/**
 * Ô nhập mã giảm giá dùng ở giỏ hàng và trang đặt hàng.
 * Số tiền giảm lấy từ database (preview_vouchers); mã không hợp lệ hiện lý do và không được tính.
 */
export function VoucherBox({
  lines,
  codes,
  onCodesChange,
  onPreview,
}: {
  lines: { productId: string; quantity: number; shopId: string }[]
  codes: string[]
  onCodesChange: (codes: string[]) => void
  onPreview: (p: VoucherPreview | null) => void
}) {
  const { user } = useAuth()
  const location = useLocation()
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<VoucherPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)

  const shopIds = useMemo(() => [...new Set(lines.map((l) => l.shopId))].sort(), [lines])
  const key = JSON.stringify([lines.map((l) => [l.productId, l.quantity]), codes])

  // Tính lại giảm giá mỗi khi đổi sản phẩm / số lượng / mã
  useEffect(() => {
    if (!user || !isSupabaseConfigured || !lines.length || !codes.length) {
      setPreview(null)
      onPreview(null)
      return
    }
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      voucherService
        .preview(lines, codes)
        .then((p) => {
          if (!alive) return
          setPreview(p)
          onPreview(p)
          setError(null)
        })
        .catch((e) => alive && setError(friendlyError(e, 'Không kiểm tra được mã giảm giá.')))
        .finally(() => alive && setLoading(false))
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user?.id])

  const suggestions = useAsync(
    async () => {
      if (!user || !isSupabaseConfigured) return []
      const [avail, wallet] = await Promise.all([voucherService.listAvailable(shopIds), voucherService.wallet()])
      const map = new Map<string, { code: string; title: string; detail: string; shopId: string | null }>()
      for (const v of wallet) {
        if (!v.exhausted && v.my_used < v.per_user_limit && Date.parse(v.ends_at) > Date.now() && (!v.shop_id || shopIds.includes(v.shop_id)))
          map.set(v.code, { code: v.code, title: v.title, detail: describeVoucher(v), shopId: v.shop_id })
      }
      for (const v of avail) map.set(v.code, { code: v.code, title: v.title, detail: describeVoucher(v), shopId: v.shop_id })
      return [...map.values()]
    },
    [user?.id, shopIds.join(',')],
  )

  if (!isSupabaseConfigured) return null
  if (!user) {
    return (
      <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">
        <Icon name="ticket" size={16} className="mr-1.5 inline text-primary" />
        <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="font-medium text-primary hover:underline">
          Đăng nhập
        </Link>{' '}
        để dùng mã giảm giá.
      </p>
    )
  }

  const add = (code: string) => {
    const c = code.trim().toUpperCase()
    if (!c) return
    if (!codes.includes(c)) onCodesChange([...codes, c])
    setInput('')
    setShowList(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    add(input)
  }

  const applied: { code: string; title: string; discount: number }[] = [
    ...Object.values(preview?.shops ?? {}),
    ...(preview?.platform ? [preview.platform] : []),
  ]
  const errors = preview?.errors ?? []
  const sugg = (suggestions.status === 'success' ? suggestions.data : []).filter((s) => !codes.includes(s.code))

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="voucher-input" className="sr-only">
          Mã giảm giá
        </label>
        <input
          id="voucher-input"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Nhập mã giảm giá"
          maxLength={20}
          className="h-10 min-w-0 flex-1 rounded-control border border-border bg-bg px-4 text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal focus:border-text focus:outline-none"
        />
        <button type="submit" className="h-10 shrink-0 rounded-control bg-ink px-4 text-sm font-medium text-on-ink hover:bg-ink-hover">
          Áp dụng
        </button>
      </form>

      {sugg.length > 0 && (
        <div>
          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary" onClick={() => setShowList((v) => !v)} aria-expanded={showList}>
            <Icon name="ticket" size={16} /> {sugg.length} mã có thể dùng
          </button>
          {showList && (
            <ul className="mt-2 space-y-2">
              {sugg.map((s) => (
                <li key={s.code} className="flex items-center gap-3 rounded-xl border border-border p-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block text-xs text-muted">
                      {s.shopId ? 'Mã shop' : 'Mã toàn sàn'} · {s.detail}
                    </span>
                  </span>
                  <button type="button" className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-text" onClick={() => add(s.code)}>
                    Dùng
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {codes.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {codes.map((c) => {
            const ok = applied.find((a) => a.code === c)
            const err = errors.find((x) => x.code === c)
            return (
              <li key={c} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider ${err ? 'bg-danger/10 text-danger' : 'bg-primary-soft text-primary'}`}>{c}</span>
                <span className="min-w-0 flex-1 text-xs leading-5">
                  {loading && !ok && !err ? (
                    <span className="text-muted">Đang kiểm tra...</span>
                  ) : err ? (
                    <span className="text-danger">{err.message}</span>
                  ) : ok ? (
                    <span className="text-success">
                      {ok.title}: −{formatPrice(ok.discount)}
                    </span>
                  ) : null}
                </span>
                <button type="button" className="text-muted hover:text-text" onClick={() => onCodesChange(codes.filter((x) => x !== c))} aria-label={`Bỏ mã ${c}`}>
                  <Icon name="x" size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
