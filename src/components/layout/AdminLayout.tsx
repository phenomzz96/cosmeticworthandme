import { ScrollRow } from '@/components/ui/ScrollRow'
import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Skeleton } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { roleLabels } from '@/types/account'

const tabs = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/orders', label: 'Đơn hàng' },
  { to: '/admin/users', label: 'Người dùng' },
  { to: '/admin/shops', label: 'Cửa hàng' },
  { to: '/admin/products', label: 'Sản phẩm' },
  { to: '/admin/reviews', label: 'Đánh giá' },
  { to: '/admin/vouchers', label: 'Mã giảm giá' },
  { to: '/admin/messages', label: 'Hỗ trợ' },
  { to: '/admin/pages', label: 'Nội dung trang' },
  { to: '/admin/audit', label: 'Nhật ký' },
  { to: '/admin/banners', label: 'Banner' },
  { to: '/admin/brand', label: 'Thương hiệu' },
]

/** Khung chung cho các trang quản trị: tiêu đề + thanh tab. Đã được RequireAuth bọc ở App. */
export function AdminLayout() {
  const { profile } = useAuth()
  return (
    <div>
      <div className="border-b border-border bg-surface">
        <div className="container-page flex flex-wrap items-end justify-between gap-3 pt-6">
          <div>
            <p className="text-sm text-muted">Khu vực quản trị</p>
            <p className="text-xs text-muted">
              {profile?.email} · {profile ? roleLabels[profile.role] : ''}
            </p>
          </div>
          <ScrollRow as="nav" aria-label="Quản trị" fade="surface" wrapClassName="-mb-px w-full" className="flex gap-1 lg:flex-wrap lg:gap-x-0">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
                    isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </ScrollRow>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="container-page py-8" aria-busy="true" aria-label="Đang tải trang">
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </div>
  )
}
