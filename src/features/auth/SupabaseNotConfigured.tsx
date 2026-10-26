import { Link } from 'react-router-dom'
import { button, EmptyState } from '@/components/ui/primitives'

/** Hiển thị khi website chưa có VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY */
export function SupabaseNotConfigured() {
  return (
    <div className="container-page py-16">
      <EmptyState
        title="Chức năng tài khoản chưa được kết nối"
        action={
          <Link to="/" className={button('secondary')}>
            Về trang chủ
          </Link>
        }
      >
        Website chưa được cấu hình Supabase. Nhóm phát triển cần khai báo <code>VITE_SUPABASE_URL</code> và{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> (xem README, mục Cấu hình Supabase).
      </EmptyState>
    </div>
  )
}
