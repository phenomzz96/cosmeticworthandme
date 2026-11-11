import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/primitives'
import { useSitePage } from '@/features/content/useSitePage'
import { ChatWidget } from '@/features/messages/ChatWidget'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Footer } from './Footer'
import { Header } from './Header'

/** Thanh thông báo trên cùng: Admin soạn ở /admin/pages, để trống thì ẩn */
function AnnouncementBar() {
  const page = useSitePage('announcement')
  const text = isSupabaseConfigured ? (page.ready ? page.body : '') : 'Đang dùng dữ liệu mẫu (chưa kết nối Supabase): chưa đặt hàng được.'
  if (!text) return null
  return (
    <div className="bg-ink text-on-ink">
      <p className="container-page py-2 text-center text-xs tracking-wide">{text}</p>
    </div>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()

  // Về đầu trang khi chuyển trang
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Bỏ qua, đến nội dung chính
      </a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="flex-1">
        <Suspense
          fallback={
            <div className="container-page py-10" aria-busy="true" aria-label="Đang tải trang">
              <Skeleton className="h-64 w-full" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
