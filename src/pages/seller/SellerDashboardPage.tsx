/** TỔNG QUAN NGƯỜI BÁN — /seller */
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { button, Skeleton } from '@/components/ui/primitives'
import { useSeller } from '@/features/seller/SellerLayout'
import { formatPrice } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { orderService } from '@/services/orders'
import { sellerService } from '@/services/seller'
import type { OrderStatus } from '@/types/order'
import { LOW_STOCK_THRESHOLD, productStatusLabels, type ProductStatus } from '@/types/seller'

export function SellerDashboardPage() {
  useDocumentTitle('Kênh người bán')
  const { shop, canManageProducts } = useSeller()
  const state = useAsync(() => sellerService.listMyProducts(shop.id), [shop.id])

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
        {canManageProducts && (
          <Link to="/seller/products/new" className={button('primary', 'sm')}>
            Thêm sản phẩm
          </Link>
        )}
      </div>

      {state.status === 'loading' && <Skeleton className="mt-4 h-40 w-full" />}
      {state.status === 'error' && (
        <div className="mt-4">
          <Alert kind="error">Không tải được dữ liệu sản phẩm.</Alert>
        </div>
      )}
      {state.status === 'success' && (() => {
        const list = state.data
        const count = (s: ProductStatus) => list.filter((p) => p.status === s).length
        const low = list.filter((p) => p.status === 'active' && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD)
        const out = list.filter((p) => p.status === 'active' && p.stock === 0)
        return (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['active', 'draft', 'hidden', 'discontinued'] as ProductStatus[]).map((s) => (
                <div key={s} className="rounded-card border border-border bg-surface p-4">
                  <dt className="text-sm text-muted">{productStatusLabels[s]}</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums">{count(s)}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="stock-heading">
                <h2 id="stock-heading" className="font-semibold">
                  Tồn kho cần chú ý
                </h2>
                {out.length === 0 && low.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Không có sản phẩm đang bán nào sắp hết hàng.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border text-sm">
                    {[...out, ...low].map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <Link to={`/seller/products/${p.id}`} className="min-w-0 truncate hover:text-primary">
                          {p.name}
                        </Link>
                        <span className={`shrink-0 font-semibold ${p.stock === 0 ? 'text-danger' : 'text-on-accent dark:text-accent'}`}>
                          {p.stock === 0 ? 'Hết hàng' : `Còn ${p.stock}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-muted">Sắp hết hàng: còn {LOW_STOCK_THRESHOLD} sản phẩm trở xuống.</p>
              </section>

              <OrderStatsCard />
            </div>

            {list.length === 0 && canManageProducts && (
              <div className="mt-6 rounded-card border border-dashed border-border bg-surface p-6 text-center">
                <p className="font-semibold">Cửa hàng chưa có sản phẩm</p>
                <p className="mt-1 text-sm text-muted">Thêm sản phẩm đầu tiên: nhập thông tin, tải ảnh rồi bấm Đăng bán.</p>
                <Link to="/seller/products/new" className={`${button('primary')} mt-4`}>
                  Thêm sản phẩm
                </Link>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

function OrderStatsCard() {
  const stats = useAsync(() => orderService.sellerStats(), [])
  const s = stats.status === 'success' ? stats.data : null
  const n = (k: OrderStatus) => s?.by_status[k] ?? 0
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="orders-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="orders-heading" className="font-semibold">
          Đơn hàng và doanh thu
        </h2>
        <Link to="/seller/orders" className="text-sm font-medium text-primary hover:underline">
          Xem đơn hàng
        </Link>
      </div>
      {stats.status === 'loading' && <Skeleton className="mt-3 h-24 w-full" />}
      {stats.status === 'error' && <p className="mt-2 text-sm text-danger">Không tải được số liệu đơn hàng.</p>}
      {s && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat label="Chờ xác nhận" value={n('pending')} to="/seller/orders?status=pending" highlight={n('pending') > 0} />
            <Stat label="Đang xử lý" value={n('confirmed') + n('preparing') + n('shipping')} />
            <Stat label="Đã giao" value={n('delivered')} />
            <Stat label="Đã hủy" value={n('cancelled')} />
            <Stat label="Đơn hôm nay" value={s.orders_today} />
            <Stat label="Sản phẩm đã bán" value={s.units_sold} />
          </dl>
          <p className="mt-3 text-sm">
            Doanh thu đơn đã giao: <span className="font-semibold tabular-nums">{formatPrice(s.revenue_delivered)}</span>
            <span className="text-muted"> (30 ngày: {formatPrice(s.revenue_30d)})</span>
          </p>
          <p className="mt-1 text-xs text-muted">Doanh thu = tiền hàng của đơn đã giao, chưa gồm phí vận chuyển.</p>
        </>
      )}
    </section>
  )
}

function Stat({ label, value, to, highlight }: { label: string; value: number; to?: string; highlight?: boolean }) {
  const body = (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={`text-xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</dd>
    </>
  )
  return to ? (
    <Link to={to} className="rounded-xl bg-surface-2 p-3 hover:ring-1 hover:ring-primary">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl bg-surface-2 p-3">{body}</div>
  )
}
