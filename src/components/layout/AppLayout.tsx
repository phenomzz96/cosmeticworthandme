import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { Skeleton } from '@/components/ui/primitives'
import { useSitePage } from '@/features/content/useSitePage'
import { ChatWidget } from '@/features/messages/ChatWidget'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Footer } from './Footer'
import { Header } from './Header'
import { RouteErrorBoundary } from './RouteErrorBoundary'

const ANNOUNCE_KEY = 'wm-announcement'

/**
 * Thanh thông báo trên cùng: Admin soạn ở /admin/pages, để trống thì ẩn.
 * Trong lúc tải: hiện nội dung lần trước (nhớ trên trình duyệt) hoặc giữ sẵn chỗ, để trang không bị đẩy xuống khi thanh hiện ra.
 */
function AnnouncementBar() {
  const page = useSitePage('announcement')
  const [remembered] = useState(() => {
    try {
      return localStorage.getItem(ANNOUNCE_KEY)
    } catch {
      return null
    }
  })
  const loaded = isSupabaseConfigured ? page.ready : true
  const text = isSupabaseConfigured ? (loaded ? page.body : (remembered ?? '')) : 'Đang dùng dữ liệu mẫu (chưa kết nối Supabase): chưa đặt hàng được.'
  useEffect(() => {
    if (!isSupabaseConfigured || !page.ready) return
    try {
      localStorage.setItem(ANNOUNCE_KEY, page.body)
    } catch {
      /* bỏ qua */
    }
  }, [page.ready, page.body])
  // Đã tải và Admin để trống, hoặc lần trước đã biết là trống: không hiện
  if (!text && (loaded || remembered === '')) return null
  return (
    <div className="bg-ink text-on-ink">
      <p className="container-page min-h-8 py-2 text-center text-xs leading-4 tracking-wide">{text || '\u00a0'}</p>
    </div>
  )
}

const SCROLL_KEY = 'wm-scroll'
function readScroll(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/**
 * Cuộn trang khi chuyển trang:
 * - mở trang mới: về đầu trang (đổi bộ lọc trên cùng trang thì giữ nguyên chỗ đang xem);
 * - bấm Quay lại / Tiến tới: trở về đúng chỗ đang xem trước đó (đợi nội dung tải đủ, tối đa 2 giây).
 */
function useScrollMemory() {
  const { key, pathname, hash } = useLocation()
  const type = useNavigationType()
  // Trang đang được ghi vị trí và vị trí cuộn cuối cùng của nó (ghi lại trước khi đổi trang,
  // để lệnh "về đầu trang" của trang mới không ghi đè vị trí của trang cũ)
  const activeKey = useRef(key)
  const lastY = useRef(0)
  const lastPath = useRef(pathname)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    let frame = 0
    const onScroll = () => {
      lastY.current = window.scrollY
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => saveScroll(activeKey.current, lastY.current))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    if (activeKey.current === key) return
    saveScroll(activeKey.current, lastY.current)
    activeKey.current = key
    const pathChanged = lastPath.current !== pathname
    lastPath.current = pathname
    if (hash) return
    if (type !== 'POP') {
      // Mở trang mới: về đầu trang; đổi bộ lọc trên cùng trang: giữ nguyên chỗ đang xem
      if (pathChanged) window.scrollTo({ top: 0, behavior: 'instant' })
      lastY.current = window.scrollY
      return
    }
    const target = readScroll()[key] ?? 0
    // Nội dung có thể chưa tải xong: thử lại tới khi trang đủ cao (tối đa 2 giây)
    const start = performance.now()
    let frame = 0
    const tryRestore = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: Math.min(target, Math.max(0, max)), behavior: 'instant' })
      lastY.current = window.scrollY
      if (max < target && performance.now() - start < 2000) frame = requestAnimationFrame(tryRestore)
    }
    tryRestore()
    return () => cancelAnimationFrame(frame)
  }, [key, pathname, hash, type])
}

function saveScroll(key: string, y: number) {
  const map = readScroll()
  map[key] = Math.round(y)
  const keys = Object.keys(map)
  if (keys.length > 60) delete map[keys[0]]
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map))
  } catch {
    /* bỏ qua */
  }
}

export function AppLayout() {
  useScrollMemory()
  const { pathname } = useLocation()

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
      {/* Cao ít nhất bằng màn hình: trong lúc trang đang tải, chân trang nằm dưới màn hình nên không bị nhảy lên xuống */}
      <main id="main" className="min-h-[100svh] flex-1">
        <Suspense
          fallback={
            <div className="container-page py-10" aria-busy="true" aria-label="Đang tải trang">
              <Skeleton className="h-64 w-full" />
            </div>
          }
        >
          <RouteErrorBoundary resetKey={pathname}>
            <div key={pathname} className="page-in">
              <Outlet />
            </div>
          </RouteErrorBoundary>
        </Suspense>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
