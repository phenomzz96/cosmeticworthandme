import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { button } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBrand } from '@/features/brand/BrandProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { messageService } from '@/services/messages'
import { Composer } from './ChatThread'

/** Khung gửi câu hỏi cho bộ phận hỗ trợ của sàn (trang Liên hệ, Câu hỏi thường gặp) */
export function SupportBox({ title = 'Gửi tin nhắn cho bộ phận hỗ trợ' }: { title?: string }) {
  const { user } = useAuth()
  const { settings } = useBrand()
  const { pathname } = useLocation()
  const [sent, setSent] = useState<string | null>(null)

  return (
    <section className="rounded-card border border-border bg-surface p-5 sm:p-6" aria-labelledby="support-heading">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon name="message" size={20} />
        </span>
        <div className="min-w-0">
          <h2 id="support-heading" className="text-lg font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Câu hỏi, khiếu nại hoặc góp ý gửi tới quản trị viên {settings.name}. Câu hỏi về một sản phẩm cụ thể, hãy nhắn trực tiếp cho cửa hàng ở trang sản phẩm.
          </p>
        </div>
      </div>
      <div className="mt-4">
        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted">Tính năng nhắn tin cần kết nối máy chủ.</p>
        ) : !user ? (
          <Link to={`/login?next=${encodeURIComponent(pathname)}`} className={button('dark')}>
            Đăng nhập để gửi tin nhắn
          </Link>
        ) : sent ? (
          <p className="rounded-xl bg-primary-soft p-3 text-sm" role="status">
            Đã gửi. Bạn sẽ nhận thông báo khi bộ phận hỗ trợ trả lời.{' '}
            <Link to={`/messages?c=${sent}`} className="font-semibold text-primary underline">
              Xem cuộc trò chuyện
            </Link>
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-bg">
            <Composer
              label="Nội dung gửi bộ phận hỗ trợ"
              placeholder="Ví dụ: Đơn WM… của tôi đã giao nhưng thiếu 1 sản phẩm…"
              onSend={async (body) => setSent(await messageService.start(null, body))}
            />
          </div>
        )}
      </div>
    </section>
  )
}
