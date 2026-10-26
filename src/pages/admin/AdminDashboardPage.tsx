/** TỔNG QUAN QUẢN TRỊ — /admin. Số liệu do hàm admin_dashboard_stats trong database tính (chỉ Admin gọi được). */
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { Skeleton } from '@/components/ui/primitives'
import { formatPrice } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { orderService } from '@/services/orders'
import { roleLabels, type UserRole } from '@/types/account'
import { orderStatusLabels, type OrderStatus } from '@/types/order'
import { shopStatusLabels, type ShopStatus } from '@/types/seller'

export function AdminDashboardPage() {
  useDocumentTitle('Tổng quan quản trị')
  const stats = useAsync(() => orderService.adminStats(), [])

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
      {stats.status === 'loading' && <Skeleton className="mt-4 h-64 w-full" />}
      {stats.status === 'error' && (
        <div className="mt-4">
          <Alert kind="error">Không tải được số liệu.</Alert>
        </div>
      )}
      {stats.status === 'success' && (() => {
        const s = stats.data
        const todo = [
          { n: s.shops_by_status.pending ?? 0, label: 'cửa hàng chờ duyệt', to: '/admin/shops?status=pending' },
          { n: s.payments_pending, label: 'thanh toán chờ xác nhận', to: '/admin/orders?payment=pending_confirmation' },
          { n: s.refunds_pending, label: 'đơn chờ hoàn tiền', to: '/admin/orders?refund=1' },
        ].filter((t) => t.n > 0)
        return (
          <>
            {todo.length > 0 ? (
              <section className="mt-4 rounded-card border border-primary/40 bg-primary-soft/40 p-4" aria-label="Việc cần xử lý">
                <p className="font-semibold">Việc cần xử lý</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {todo.map((t) => (
                    <li key={t.label}>
                      <Link to={t.to} className="inline-flex rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-primary hover:underline">
                        {t.n} {t.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="mt-4 text-sm text-muted">Không có việc nào đang chờ xử lý.</p>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card label="Người dùng" value={s.users} hint={`${s.users_suspended} đang bị khóa`} />
              <Card label="Sản phẩm đang bán" value={s.products_active} hint={`${s.products_hidden_by_admin} bị Admin ẩn`} />
              <Card label="Đơn hàng" value={s.orders} hint={`${s.orders_today} đơn hôm nay`} />
              <Card label="Giá trị đơn đã giao" value={formatPrice(s.gmv_delivered)} hint="Gồm phí vận chuyển" />
            </dl>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Breakdown
                title="Người dùng theo vai trò"
                rows={(Object.keys(roleLabels) as UserRole[]).map((r) => ({ label: roleLabels[r], value: s.users_by_role?.[r] ?? 0 }))}
                link={{ to: '/admin/users', label: 'Quản lý người dùng' }}
              />
              <Breakdown
                title="Cửa hàng theo trạng thái"
                rows={(Object.keys(shopStatusLabels) as ShopStatus[]).map((k) => ({ label: shopStatusLabels[k], value: s.shops_by_status[k] ?? 0 }))}
                link={{ to: '/admin/shops', label: 'Duyệt cửa hàng' }}
              />
              <Breakdown
                title="Đơn con theo trạng thái"
                rows={(Object.keys(orderStatusLabels) as OrderStatus[]).map((k) => ({ label: orderStatusLabels[k], value: s.shop_orders_by_status[k] ?? 0 }))}
                link={{ to: '/admin/orders', label: 'Xem đơn hàng' }}
              />
            </div>
          </>
        )
      })()}
    </div>
  )
}

function Card({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  )
}

function Breakdown({ title, rows, link }: { title: string; rows: { label: string; value: number }[]; link: { to: string; label: string } }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between">
              <span className="text-muted">{r.label}</span>
              <span className="font-semibold tabular-nums">{r.value}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2" aria-hidden>
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <Link to={link.to} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        {link.label}
      </Link>
    </section>
  )
}
