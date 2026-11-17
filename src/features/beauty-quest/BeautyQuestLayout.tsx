/**
 * Khung chung của Beauty Quest trong Worth & Me (/beauty-quest/*):
 * tiêu đề + Beauty Points, thanh mục con, thông báo nhỏ (toast), dòng lưu ý không chẩn đoán.
 * Trạng thái (điểm, nhiệm vụ) tải từ database qua bq_state(); các trang con dùng useBeautyQuest().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { ScrollRow } from '@/components/ui/ScrollRow'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService, type BqClaim, type BqState } from '@/services/beautyQuest'
import { LEVELS } from './content'

interface BqContextValue {
  /** null khi chưa đăng nhập hoặc chưa tải xong */
  state: BqState | null
  status: 'guest' | 'loading' | 'ready' | 'error' | 'off'
  signedIn: boolean
  userId: string | null
  refresh: () => Promise<void>
  toast: (msg: string) => void
  /** Hiện thông báo điểm / lên cấp / huy hiệu sau một hành động rồi tải lại trạng thái */
  afterClaim: (c: BqClaim | undefined | null) => Promise<void>
  /** Đường dẫn đăng nhập quay lại đúng trang đang xem */
  loginHref: string
}

const BqContext = createContext<BqContextValue | null>(null)

export function useBeautyQuest() {
  const ctx = useContext(BqContext)
  if (!ctx) throw new Error('useBeautyQuest phải nằm trong BeautyQuestLayout')
  return ctx
}

export const levelInfo = (points: number, level: number) => {
  const next = level + 1 < LEVELS.length ? LEVELS[level + 1] : null
  const base = LEVELS[level][0]
  return {
    name: LEVELS[level][1],
    next,
    percent: next ? Math.max(0, Math.min(100, Math.round(((points - base) / (next[0] - base)) * 100))) : 100,
  }
}

const tabs = [
  { to: '/beauty-quest', label: 'Tổng quan', end: true },
  { to: '/beauty-quest/quiz', label: 'Skin Quiz' },
  { to: '/beauty-quest/routine', label: 'Routine' },
  { to: '/beauty-quest/learn', label: 'Học hỏi' },
  { to: '/beauty-quest/reflect', label: 'Tự đánh giá' },
  { to: '/beauty-quest/roadmap', label: 'Skin Roadmap' },
  { to: '/beauty-quest/hop-qua', label: 'Hộp quà' },
]

export function BeautyQuestLayout() {
  useDocumentTitle('Beauty Quest')
  const { status: auth, user } = useAuth()
  const location = useLocation()
  const signedIn = auth === 'signed-in'
  const [state, setState] = useState<BqState | null>(null)
  const [status, setStatus] = useState<BqContextValue['status']>(beautyQuestService.enabled ? 'loading' : 'off')
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const seq = useRef(0)

  const toast = useCallback((msg: string) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, msg }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  const refresh = useCallback(async () => {
    if (!beautyQuestService.enabled) return setStatus('off')
    if (!signedIn) {
      setState(null)
      return setStatus('guest')
    }
    try {
      setState(await beautyQuestService.state())
      setStatus('ready')
      setError(null)
    } catch (err) {
      setError(friendlyError(err))
      setStatus('error')
    }
  }, [signedIn])

  useEffect(() => {
    if (auth === 'loading') return
    void refresh()
  }, [auth, refresh])

  const afterClaim = useCallback(
    async (c: BqClaim | undefined | null) => {
      if (c?.claimed?.length) {
        const sum = c.claimed.reduce((a, x) => a + x.earned, 0)
        toast(`Tuyệt vời! +${sum} điểm từ ${c.claimed.map((x) => x.title).join(', ')} 💗`)
        const ach = c.new_achievements?.[0]
        if (c.level_up) window.setTimeout(() => toast('Chúc mừng! Bạn đã lên ' + LEVELS[c.level][1]), 1200)
        else if (ach) window.setTimeout(() => toast(`Huy hiệu mới: ${ach.title} ${ach.icon}`), 1200)
      }
      await refresh()
    },
    [refresh, toast],
  )

  const value = useMemo<BqContextValue>(
    () => ({
      state,
      status,
      signedIn,
      userId: user?.id ?? null,
      refresh,
      toast,
      afterClaim,
      loginHref: `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
    }),
    [state, status, signedIn, user, refresh, toast, afterClaim, location.pathname, location.search],
  )

  const lv = state ? levelInfo(state.points, state.level) : null

  return (
    <BqContext.Provider value={value}>
      <div className="container-page py-6 md:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Tính năng chuyên biệt</p>
            <h1 className="mt-1 text-4xl md:text-5xl">Beauty Quest</h1>
          </div>
          {state && lv && (
            <Link to="/beauty-quest" className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm hover:border-primary" title="Beauty Points">
              <span aria-hidden="true">🌸</span>
              <strong className="tabular-nums">{state.points}</strong> Beauty Points
              <span className="hidden text-muted sm:inline">· {lv.name}</span>
            </Link>
          )}
        </div>

        <ScrollRow as="nav" aria-label="Beauty Quest" wrapClassName="-mx-4 mt-5 border-b border-border sm:mx-0" className="flex gap-1 px-4 sm:px-0">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors motion-reduce:transition-none ${
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </ScrollRow>

        {status === 'off' && (
          <div className="mt-6">
            <Alert kind="info">Beauty Quest cần kết nối Supabase để lưu điểm và tiến trình. Bản đang chạy chưa kết nối nên chỉ xem được nội dung.</Alert>
          </div>
        )}
        {status === 'guest' && !location.pathname.startsWith('/beauty-quest/hop-qua') && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
            <span>Bạn đang xem với tư cách khách. Đăng nhập để làm nhiệm vụ, tích Beauty Points và đổi điểm lấy lượt mở hộp quà.</span>
            <Link to={value.loginHref} className="font-semibold text-primary hover:underline">
              Đăng nhập
            </Link>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-6">
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        <div className="mt-6">
          <Outlet />
        </div>

        <p className="mt-12 border-t border-border pt-4 text-xs leading-relaxed text-muted">
          Beauty Quest là công cụ tự theo dõi thói quen chăm da, không thay thế tư vấn của bác sĩ và không đưa ra chẩn đoán. Bạn có thể bỏ qua bất kỳ nhiệm vụ nào, không có áp lực.
        </p>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="gift-pop pointer-events-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-sm text-on-ink shadow-pop">
            {t.msg}
          </div>
        ))}
      </div>
    </BqContext.Provider>
  )
}

/** Khung "cần đăng nhập" dùng chung cho các trang con */
export function BqLoginPanel({ title, children }: { title: string; children: ReactNode }) {
  const { loginHref, status } = useBeautyQuest()
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{children}</p>
      {status !== 'off' && (
        <Link to={loginHref} className="mt-4 inline-flex h-11 items-center rounded-control bg-ink px-5 text-[15px] font-medium text-on-ink hover:opacity-90">
          Đăng nhập / Tạo tài khoản
        </Link>
      )}
    </div>
  )
}
