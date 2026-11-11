import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { button } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { MESSAGES_CHANGED, messageService } from '@/services/messages'

// Hộp thư chỉ tải khi khách mở khung chat (trang đầu nhẹ hơn)
const InboxView = lazy(async () => ({ default: (await import('./InboxView')).InboxView }))

/**
 * Khung chat nổi ở góc phải dưới: xem nhanh tin nhắn với cửa hàng và bộ phận hỗ trợ.
 * Ẩn ở trang hộp thư đầy đủ, kênh người bán và trang quản trị (đã có hộp thư riêng).
 */
export function ChatWidget() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const hidden = !isSupabaseConfigured || /^\/(messages|seller|admin|checkout|login|register)/.test(pathname)

  useEffect(() => {
    if (!user || hidden) return
    let alive = true
    const load = () =>
      messageService
        .unread()
        .then((u) => alive && setUnread(u.customer))
        .catch(() => undefined)
    void load()
    const t = window.setInterval(() => document.visibilityState === 'visible' && load(), 60_000)
    window.addEventListener(MESSAGES_CHANGED, load)
    return () => {
      alive = false
      window.clearInterval(t)
      window.removeEventListener(MESSAGES_CHANGED, load)
    }
  }, [user, hidden])

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (hidden) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          id="chat-widget-panel"
          role="dialog"
          aria-label="Tin nhắn"
          className="flex h-[min(560px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] border border-border bg-surface shadow-pop sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-ink px-4 py-3 text-on-ink">
            <p className="font-semibold">Tin nhắn</p>
            <div className="flex items-center gap-1">
              {user && (
                <Link to="/messages" className="rounded-full px-3 py-1 text-xs hover:bg-white/10">
                  Mở rộng
                </Link>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" aria-label="Đóng khung tin nhắn">
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {user ? (
              <Suspense fallback={<p className="p-6 text-center text-sm text-muted">Đang tải tin nhắn…</p>}>
              <InboxView
                scope="customer"
                compact
                emptyHint={
                  <>
                    Bấm <strong>Nhắn tin cho shop</strong> ở trang sản phẩm để hỏi cửa hàng, hoặc{' '}
                    <Link to="/contact" className="font-medium text-primary underline">
                      gửi câu hỏi cho bộ phận hỗ trợ
                    </Link>
                    .
                  </>
                }
              />
              </Suspense>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <Icon name="message" size={32} className="text-primary" />
                <p className="text-sm text-muted">Đăng nhập để nhắn tin với cửa hàng hoặc bộ phận hỗ trợ. Câu hỏi phổ biến có sẵn ở trang Câu hỏi thường gặp.</p>
                <Link to={`/login?next=${encodeURIComponent(pathname)}`} className={button('dark', 'sm')}>
                  Đăng nhập
                </Link>
                <Link to="/faq" className="text-sm font-medium text-primary underline">
                  Xem câu hỏi thường gặp
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={() => user && void import('./InboxView')}
        aria-expanded={open}
        aria-controls="chat-widget-panel"
        aria-label={unread ? `Tin nhắn, ${unread} chưa đọc` : 'Tin nhắn'}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-ink text-on-ink shadow-pop transition-transform hover:scale-105 motion-reduce:transition-none"
      >
        <Icon name={open ? 'x' : 'message'} size={24} />
        {unread > 0 && !open && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-sale px-1 text-[11px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
