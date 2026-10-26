import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import type { UserRole } from '@/types/account'
import { useAuth } from './AuthProvider'
import { SupabaseNotConfigured } from './SupabaseNotConfigured'

/**
 * Chặn trang khi chưa đăng nhập hoặc không đủ quyền.
 * Đây là lớp tiện lợi cho giao diện; dữ liệu nhạy cảm vẫn được RLS bảo vệ ở database.
 */
export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { status, profile, isSuspended } = useAuth()
  const location = useLocation()

  if (status === 'disabled') return <SupabaseNotConfigured />
  if (status === 'loading') {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (status === 'signed-out') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (roles && (!profile || isSuspended || !roles.includes(profile.role))) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Bạn không có quyền truy cập trang này"
          action={
            <Link to="/" className={button('primary')}>
              Về trang chủ
            </Link>
          }
        >
          {isSuspended
            ? 'Tài khoản của bạn đang bị tạm khóa.'
            : 'Trang này chỉ dành cho quản trị viên. Nếu bạn cần quyền, hãy liên hệ Super Admin.'}
        </EmptyState>
      </div>
    )
  }
  return <>{children}</>
}
