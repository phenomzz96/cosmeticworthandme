/** DANH SÁCH SẢN PHẨM CỦA SHOP — /seller/products */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { productTypeLabels } from '@/data/taxonomy'
import { useSeller } from '@/features/seller/SellerLayout'
import { friendlyError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { normalizeVi } from '@/lib/text'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService, DEFAULT_VISUAL } from '@/services/catalog'
import { shopMediaUrl } from '@/services/media'
import { sellerService } from '@/services/seller'
import { LOW_STOCK_THRESHOLD, productStatusLabels, type ProductStatus, type SellerProduct } from '@/types/seller'

const filters: { value: ProductStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang bán' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'hidden', label: 'Đang ẩn' },
  { value: 'discontinued', label: 'Ngừng kinh doanh' },
]

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const styles: Record<ProductStatus, string> = {
    active: 'bg-success/15 text-success',
    draft: 'bg-surface-2 text-muted',
    hidden: 'bg-accent-soft text-on-accent dark:text-accent',
    discontinued: 'bg-danger/10 text-danger',
  }
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{productStatusLabels[status]}</span>
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-xs font-semibold text-danger">Hết hàng</span>
  if (stock <= LOW_STOCK_THRESHOLD) return <span className="text-xs font-semibold text-on-accent dark:text-accent">Sắp hết · {stock}</span>
  return <span className="text-sm tabular-nums">{stock}</span>
}

export function SellerProductsPage() {
  useDocumentTitle('Sản phẩm của shop')
  const { shop, canManageProducts } = useSeller()
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; list: SellerProduct[]; error?: string }>({ status: 'loading', list: [] })
  const [filter, setFilter] = useState<ProductStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', list: await sellerService.listMyProducts(shop.id) })
    } catch (err) {
      setState({ status: 'error', list: [], error: friendlyError(err) })
    }
  }, [shop.id])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const terms = normalizeVi(q).split(/\s+/).filter(Boolean)
    return state.list.filter(
      (p) => (filter === 'all' || p.status === filter) && terms.every((t) => normalizeVi(`${p.name} ${p.brand_name} ${p.sku ?? ''}`).includes(t)),
    )
  }, [state.list, filter, q])

  const act = async (p: SellerProduct, action: 'hide' | 'show' | 'discontinue' | 'delete') => {
    setNotice(null)
    try {
      if (action === 'delete') {
        await sellerService.deleteDraft(p)
        setState((s) => ({ ...s, list: s.list.filter((x) => x.id !== p.id) }))
        setNotice({ kind: 'success', text: `Đã xóa bản nháp "${p.name}".` })
      } else {
        const status: ProductStatus = action === 'hide' ? 'hidden' : action === 'show' ? 'active' : 'discontinued'
        const updated = await sellerService.updateProduct(p.id, { status })
        setState((s) => ({ ...s, list: s.list.map((x) => (x.id === p.id ? updated : x)) }))
        setNotice({ kind: 'success', text: `"${p.name}": ${productStatusLabels[status].toLowerCase()}.` })
      }
      void catalogService.refresh().catch(() => undefined)
    } catch (err) {
      setNotice({ kind: 'error', text: friendlyError(err) })
    }
  }

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sản phẩm</h1>
          <p className="text-sm text-muted">{state.status === 'ready' ? `${state.list.length} sản phẩm` : ' '}</p>
        </div>
        {canManageProducts && (
          <Link to="/seller/products/new" className={button('primary', 'sm')}>
            Thêm sản phẩm
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto" role="group" aria-label="Lọc theo trạng thái">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${filter === f.value ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`}
            >
              {f.label}
              {state.status === 'ready' && f.value !== 'all' && ` (${state.list.filter((p) => p.status === f.value).length})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, thương hiệu, SKU"
          aria-label="Tìm sản phẩm của shop"
          className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm md:w-72"
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
        {state.status === 'ready' && shown.length === 0 && (
          <EmptyState
            title={state.list.length ? 'Không có sản phẩm phù hợp' : 'Chưa có sản phẩm nào'}
            action={
              canManageProducts && !state.list.length ? (
                <Link to="/seller/products/new" className={button('primary')}>
                  Thêm sản phẩm đầu tiên
                </Link>
              ) : undefined
            }
          />
        )}
        {state.status === 'ready' && shown.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Sản phẩm của shop">
            {shown.map((p) => (
              <ProductRow key={p.id} product={p} canManage={canManageProducts} onAction={(a) => act(p, a)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ProductRow({ product: p, canManage, onAction }: { product: SellerProduct; canManage: boolean; onAction: (a: 'hide' | 'show' | 'discontinue' | 'delete') => Promise<void> }) {
  const [confirm, setConfirm] = useState<null | 'delete' | 'discontinue'>(null)
  const [busy, setBusy] = useState(false)
  const run = async (a: 'hide' | 'show' | 'discontinue' | 'delete') => {
    setBusy(true)
    await onAction(a)
    setBusy(false)
    setConfirm(null)
  }
  const images = p.product_images.map((i) => shopMediaUrl(i.path)!).filter(Boolean)
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          <ProductImage product={{ name: p.name, images, visual: p.placeholder_visual ?? DEFAULT_VISUAL }} />
        </div>
        <div className="min-w-0">
          <Link to={`/seller/products/${p.id}`} className="line-clamp-1 font-medium hover:text-primary">
            {p.name}
          </Link>
          <p className="truncate text-xs text-muted">
            {p.brand_name} · {productTypeLabels[p.product_type]}
            {p.sku && ` · SKU ${p.sku}`}
          </p>
          {p.admin_hidden && (
            <p className="text-xs font-semibold text-danger">
              Bị quản trị viên ẩn{p.admin_hidden_reason ? `: ${p.admin_hidden_reason}` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 items-center gap-3 text-sm sm:w-[380px]">
        <div>
          <p className="font-semibold tabular-nums">{formatPrice(p.sale_price ?? p.price)}</p>
          {p.sale_price != null && <p className="text-xs text-muted line-through">{formatPrice(p.price)}</p>}
        </div>
        <div>
          <StockBadge stock={p.stock} />
        </div>
        <div>
          <ProductStatusBadge status={p.status} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:w-[260px] sm:justify-end">
        {confirm ? (
          <>
            <span className="self-center text-xs text-muted">{confirm === 'delete' ? 'Xóa hẳn bản nháp?' : 'Ngừng kinh doanh?'}</span>
            <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run(confirm)}>
              Xác nhận
            </button>
            <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirm(null)}>
              Thôi
            </button>
          </>
        ) : (
          <>
            <Link to={`/seller/products/${p.id}`} className={button('secondary', 'sm')}>
              {canManage ? 'Sửa' : 'Xem'}
            </Link>
            {canManage && p.status === 'active' && (
              <button type="button" className={button('ghost', 'sm')} disabled={busy} onClick={() => void run('hide')} aria-label={`Ẩn ${p.name}`}>
                Ẩn
              </button>
            )}
            {canManage && p.status === 'hidden' && (
              <button type="button" className={button('ghost', 'sm')} disabled={busy} onClick={() => void run('show')} aria-label={`Hiện lại ${p.name}`}>
                Hiện lại
              </button>
            )}
            {canManage && (p.status === 'active' || p.status === 'hidden') && (
              <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirm('discontinue')} aria-label={`Ngừng kinh doanh ${p.name}`}>
                Ngừng bán
              </button>
            )}
            {canManage && p.status === 'draft' && (
              <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirm('delete')} aria-label={`Xóa bản nháp ${p.name}`}>
                Xóa
              </button>
            )}
          </>
        )}
      </div>
    </li>
  )
}
