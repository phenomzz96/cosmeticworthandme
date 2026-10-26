/**
 * KIỂM DUYỆT SẢN PHẨM — /admin/products
 * Admin ẩn sản phẩm vi phạm (kèm lý do, chủ shop thấy lý do) hoặc bỏ ẩn. Không sửa nội dung của người bán.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ADMIN_PRODUCTS_PAGE_SIZE, adminProductsService, HIDE_REASON_MIN, type AdminProductRow } from '@/services/adminProducts'
import { catalogService, DEFAULT_VISUAL } from '@/services/catalog'
import { shopMediaUrl } from '@/services/media'
import { productStatusLabels, shopStatusLabels } from '@/types/seller'

export function AdminProductsPage() {
  useDocumentTitle('Kiểm duyệt sản phẩm')
  const [params, setParams] = useSearchParams()
  const hidden = params.get('hidden') === '1' ? true : undefined
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [searchInput, setSearchInput] = useState(search)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: AdminProductRow[]; total: number; error?: string }>({ status: 'loading', rows: [], total: 0 })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', ...(await adminProductsService.list({ search, hidden, page })) })
    } catch (err) {
      setState({ status: 'error', rows: [], total: 0, error: friendlyError(err) })
    }
  }, [search, hidden, page])

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

  const pages = Math.max(1, Math.ceil(state.total / ADMIN_PRODUCTS_PAGE_SIZE))
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Sản phẩm</h1>
      <p className="mt-1 text-sm text-muted">Ẩn sản phẩm vi phạm (hàng giả, thông tin sai, cam kết chữa bệnh...). Sản phẩm bị ẩn biến mất khỏi website; chủ shop thấy lý do và không tự bỏ ẩn được.</p>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2" role="group" aria-label="Lọc sản phẩm">
          <button type="button" aria-pressed={!hidden} className={chip(!hidden)} onClick={() => update({ hidden: null })}>
            Tất cả
          </button>
          <button type="button" aria-pressed={!!hidden} className={chip(!!hidden)} onClick={() => update({ hidden: '1' })}>
            Đang bị ẩn
          </button>
        </div>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tên sản phẩm, thương hiệu, cửa hàng"
          aria-label="Tìm sản phẩm"
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
        {state.status === 'ready' && state.rows.length === 0 && <EmptyState title="Không có sản phẩm phù hợp" />}
        {state.status === 'ready' && state.rows.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách sản phẩm">
            {state.rows.map((r) => (
              <ProductRow
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

function ProductRow({ row, onDone }: { row: AdminProductRow; onDone: (text: string, kind?: 'success' | 'error') => void }) {
  const [hiding, setHiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const img = shopMediaUrl(row.image_path)

  const run = async (hide: boolean) => {
    if (hide && reason.trim().length < HIDE_REASON_MIN) {
      setError(`Nhập lý do (ít nhất ${HIDE_REASON_MIN} ký tự). Chủ shop sẽ thấy lý do này.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminProductsService.setHidden(row.id, hide, reason)
      setHiding(false)
      setReason('')
      onDone(hide ? `Đã ẩn "${row.name}".` : `Đã bỏ ẩn "${row.name}".`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
            <ProductImage product={{ name: row.name, images: img ? [img] : [], visual: DEFAULT_VISUAL }} />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 font-medium">
              {row.status === 'active' && !row.admin_hidden && row.shop_status === 'active' ? (
                <Link to={`/products/${row.slug}`} className="hover:text-primary">
                  {row.name}
                </Link>
              ) : (
                row.name
              )}
            </p>
            <p className="truncate text-xs text-muted">
              {row.brand_name} · {row.shop_name} ({shopStatusLabels[row.shop_status].toLowerCase()}) · {productStatusLabels[row.status]} · {formatPrice(row.sale_price ?? row.price)} · Kho {row.stock}
            </p>
            {row.admin_hidden && <p className="text-xs font-semibold text-danger">Đang bị ẩn: {row.admin_hidden_reason}</p>}
          </div>
        </div>
        {!hiding && (
          <div className="flex shrink-0 gap-2">
            {row.admin_hidden ? (
              <button type="button" className={button('secondary', 'sm')} disabled={busy} onClick={() => void run(false)}>
                Bỏ ẩn
              </button>
            ) : (
              <button type="button" className={button('ghost', 'sm')} onClick={() => setHiding(true)} aria-label={`Ẩn sản phẩm ${row.name}`}>
                Ẩn sản phẩm
              </button>
            )}
          </div>
        )}
      </div>
      {hiding && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <TextAreaField label="Lý do ẩn (chủ shop sẽ thấy)" value={reason} onChange={setReason} rows={2} maxLength={500} />
          <div className="flex gap-2">
            <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run(true)}>
              {busy ? 'Đang xử lý...' : 'Xác nhận ẩn'}
            </button>
            <button type="button" className={button('ghost', 'sm')} onClick={() => setHiding(false)}>
              Thôi
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </li>
  )
}
