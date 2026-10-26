/**
 * DUYỆT CỬA HÀNG — /admin/shops
 * Danh sách shop (chờ duyệt lên đầu), lọc theo trạng thái, tìm theo tên/email chủ shop.
 * Duyệt / từ chối / tạm ngưng / mở lại đều qua hàm admin_set_shop_status trong database.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { ShopStatusBadge } from '@/features/seller/SellerLayout'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ADMIN_SHOPS_PAGE_SIZE, adminShopsService, SHOP_REASON_MIN, shopTransitions, type AdminShopRow } from '@/services/adminShops'
import { catalogService } from '@/services/catalog'
import { shopStatusLabels, type ShopStatus } from '@/types/seller'

const statusFilters: (ShopStatus | '')[] = ['', 'pending', 'active', 'rejected', 'suspended']

export function AdminShopsPage() {
  useDocumentTitle('Duyệt cửa hàng')
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') as ShopStatus | null
  const status = statusParam && statusFilters.includes(statusParam) ? statusParam : undefined
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: AdminShopRow[]; total: number; error?: string }>({ status: 'loading', rows: [], total: 0 })
  const [searchInput, setSearchInput] = useState(search)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const r = await adminShopsService.list({ status, search, page })
      setState({ status: 'ready', ...r })
    } catch (err) {
      setState({ status: 'error', rows: [], total: 0, error: friendlyError(err) })
    }
  }, [status, search, page])

  useEffect(() => {
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

  const pages = Math.max(1, Math.ceil(state.total / ADMIN_SHOPS_PAGE_SIZE))

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Cửa hàng</h1>
      <p className="mt-1 text-sm text-muted">Shop mới ở trạng thái chờ duyệt. Sản phẩm chỉ hiển thị với khách khi shop đang hoạt động. Duyệt shop sẽ chuyển chủ shop thành Người bán.</p>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto" role="group" aria-label="Lọc theo trạng thái">
          {statusFilters.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={(status ?? '') === s}
              onClick={() => update({ status: s || null })}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${(status ?? '') === s ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`}
            >
              {s ? shopStatusLabels[s] : 'Tất cả'}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tên shop, đường dẫn, email chủ shop"
          aria-label="Tìm cửa hàng"
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
        {state.status === 'ready' && state.rows.length === 0 && <EmptyState title="Không có cửa hàng phù hợp" />}
        {state.status === 'ready' && state.rows.length > 0 && (
          <ul className="space-y-3" aria-label="Danh sách cửa hàng">
            {state.rows.map((r) => (
              <ShopRow
                key={r.id}
                row={r}
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
            Trang {page}/{pages} · {state.total} cửa hàng
          </span>
          <button type="button" className={button('secondary', 'sm')} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
            Trang sau
          </button>
        </nav>
      )}
    </div>
  )
}

function ShopRow({ row, onDone }: { row: AdminShopRow; onDone: (text: string, kind?: 'success' | 'error') => void }) {
  const [pending, setPending] = useState<{ to: ShopStatus; label: string; needsReason: boolean } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const run = async () => {
    if (!pending) return
    if (pending.needsReason && reason.trim().length < SHOP_REASON_MIN) {
      setError(`Nhập lý do (ít nhất ${SHOP_REASON_MIN} ký tự). Chủ shop sẽ thấy lý do này.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminShopsService.setStatus(row.id, pending.to, reason)
      onDone(`"${row.name}": ${shopStatusLabels[pending.to].toLowerCase()}.`)
      setPending(null)
      setReason('')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{row.name}</p>
            <ShopStatusBadge status={row.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted">
            <span className="font-mono">/shops/{row.slug}</span> · Chủ shop: {row.owner_email ?? 'Cửa hàng mẫu (không có chủ)'}
            {row.owner_status === 'suspended' && <span className="font-semibold text-danger"> (tài khoản đang bị khóa)</span>} · {row.product_count} sản phẩm · Tạo ngày{' '}
            {new Date(row.created_at).toLocaleDateString('vi-VN')}
          </p>
          {row.tagline && <p className="mt-1 text-sm">{row.tagline}</p>}
          {row.description && (
            <p className={`mt-1 whitespace-pre-line text-sm text-muted ${expanded ? '' : 'line-clamp-2'}`}>
              {row.description}
            </p>
          )}
          {row.description.length > 140 && (
            <button type="button" className="mt-1 text-xs font-medium text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Thu gọn' : 'Xem đầy đủ'}
            </button>
          )}
          {row.status_reason && (row.status === 'rejected' || row.status === 'suspended') && <p className="mt-1 text-sm text-danger">Lý do: {row.status_reason}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {row.status === 'active' && (
            <Link to={`/shops/${row.slug}`} className={button('ghost', 'sm')}>
              Xem trang
            </Link>
          )}
          {!pending &&
            shopTransitions[row.status].map((t) => (
              <button
                key={t.to}
                type="button"
                className={button(t.to === 'active' ? 'primary' : 'secondary', 'sm')}
                onClick={() => {
                  setPending(t)
                  setError(null)
                  if (!t.needsReason) setReason('')
                }}
              >
                {t.label}
              </button>
            ))}
          {row.status === 'rejected' && <span className="self-center text-xs text-muted">Chờ chủ shop sửa và gửi duyệt lại</span>}
        </div>
      </div>

      {pending && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-sm font-medium">
            {pending.label} cửa hàng "{row.name}"?
          </p>
          {pending.needsReason && (
            <label className="block text-sm">
              <span>Lý do (chủ shop sẽ thấy)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
                aria-label={`Lý do ${pending.label.toLowerCase()} cửa hàng`}
              />
            </label>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run()}>
              {busy ? 'Đang xử lý...' : `Xác nhận ${pending.label.toLowerCase()}`}
            </button>
            <button type="button" className={button('ghost', 'sm')} disabled={busy} onClick={() => setPending(null)}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
