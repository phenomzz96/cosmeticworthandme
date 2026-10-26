import { Link } from 'react-router-dom'
import { button, EmptyState } from '@/components/ui/primitives'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/** Trang báo chức năng CHƯA có — dùng thay vì làm giả chức năng */
export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  useDocumentTitle(title)
  return (
    <div className="container-page py-16">
      <EmptyState
        title={`${title}: chưa hoạt động`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/cart" className={button('secondary')}>Về giỏ hàng</Link>
            <Link to="/" className={button('primary')}>Về trang chủ</Link>
          </div>
        }
      >
        {description}
      </EmptyState>
    </div>
  )
}

export function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang')
  return (
    <div className="container-page py-16">
      <EmptyState title="Không tìm thấy trang" action={<Link to="/" className={button('primary')}>Về trang chủ</Link>}>
        Đường dẫn có thể đã thay đổi hoặc không tồn tại.
      </EmptyState>
    </div>
  )
}
