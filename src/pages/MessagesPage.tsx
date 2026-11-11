/** HỘP THƯ — /messages (khách), /seller/messages (chủ cửa hàng), /admin/messages (hỗ trợ của sàn) */
import { Link } from 'react-router-dom'
import { Breadcrumbs } from '@/components/ui/primitives'
import { InboxView } from '@/features/messages/InboxView'
import { SupportBox } from '@/features/messages/SupportBox'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function MessagesPage() {
  useDocumentTitle('Tin nhắn')
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản', to: '/account' }, { label: 'Tin nhắn' }]} />
      <p className="eyebrow mt-6">Hộp thư</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Tin nhắn</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Trò chuyện với cửa hàng về sản phẩm, đơn hàng; hoặc hỏi bộ phận hỗ trợ của sàn. Tin nhắn với cửa hàng chỉ bạn và cửa hàng đó đọc được.
      </p>
      <div className="mt-6">
        <InboxView
          scope="customer"
          emptyHint={
            <>
              Bấm <strong>Nhắn tin cho shop</strong> ở trang sản phẩm hoặc trang cửa hàng để bắt đầu.{' '}
              <Link to="/products" className="font-medium text-primary underline">
                Xem sản phẩm
              </Link>
            </>
          }
        />
      </div>
      <div className="mt-8 max-w-3xl">
        <SupportBox title="Cần hỗ trợ từ sàn?" />
      </div>
    </div>
  )
}

export function SellerMessagesPage() {
  useDocumentTitle('Tin nhắn của shop')
  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Tin nhắn</h1>
      <p className="mt-1 text-sm text-muted">Khách hỏi về sản phẩm, đơn hàng. Bạn thấy tên khách, không thấy email. Trả lời lịch sự, không xin thông tin thanh toán.</p>
      <div className="mt-4">
        <InboxView scope="shop" emptyHint="Khi khách bấm “Nhắn tin cho shop”, cuộc trò chuyện sẽ hiện ở đây." />
      </div>
    </div>
  )
}

export function AdminMessagesPage() {
  useDocumentTitle('Hỗ trợ khách hàng')
  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Hỗ trợ khách hàng</h1>
      <p className="mt-1 text-sm text-muted">
        Tin nhắn khách gửi bộ phận hỗ trợ (trang Liên hệ, Câu hỏi thường gặp, hộp thư). Tin nhắn riêng giữa khách và cửa hàng không hiện ở đây.
      </p>
      <div className="mt-4">
        <InboxView scope="support" emptyHint="Chưa có khách nào gửi câu hỏi." />
      </div>
    </div>
  )
}
