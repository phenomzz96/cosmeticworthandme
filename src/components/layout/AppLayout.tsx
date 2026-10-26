import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Footer } from './Footer'
import { Header } from './Header'

export function AppLayout() {
  const { pathname } = useLocation()
  const { settings } = useBrand()

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
      <div className="bg-primary text-on-primary">
        <p className="container-page py-1.5 text-center text-xs">
          {settings.name} đang phát triển:{' '}
          {isSupabaseConfigured ? 'website học tập, chưa có đặt hàng và thanh toán thật.' : 'đang dùng dữ liệu mẫu (chưa kết nối Supabase), chưa có đặt hàng và thanh toán thật.'}
        </p>
      </div>
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
    </div>
  )
}
