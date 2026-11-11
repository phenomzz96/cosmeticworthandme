/**
 * Hàng cuộn ngang (thanh tab, nhóm nút lọc) khi không đủ chỗ:
 * - mờ dần ở mép + nút mũi tên để người dùng biết còn mục bị che và bấm để xem;
 * - tự cuộn tới mục đang chọn (aria-current / aria-selected / aria-pressed, hoặc class "active");
 * - đủ chỗ thì không hiện gì thêm.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

type Fade = 'bg' | 'surface'

const fadeFrom: Record<Fade, string> = { bg: 'from-bg', surface: 'from-surface' }
const ACTIVE = '[aria-current="page"],[aria-current="true"],[aria-selected="true"],[aria-pressed="true"],.active'

export function ScrollRow({
  as: Tag = 'div',
  className = '',
  wrapClassName = '',
  fade = 'bg',
  children,
  ...rest
}: {
  as?: ElementType
  className?: string
  wrapClassName?: string
  fade?: Fade
  children: ReactNode
  role?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const left = el.scrollLeft > 2
    const right = max - el.scrollLeft > 2
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
  }, [])

  // Đưa mục đang chọn vào giữa (không làm trang cuộn dọc). Chỉ khi mục đang chọn đổi, để không giật khi người dùng tự cuộn.
  const lastActive = useRef<Element | null>(null)
  const revealActive = useCallback(() => {
    const el = ref.current
    const active = el?.querySelector<HTMLElement>(ACTIVE) ?? null
    if (active === lastActive.current) return
    lastActive.current = active
    if (!el || !active || el.scrollWidth <= el.clientWidth) return
    const box = el.getBoundingClientRect()
    const a = active.getBoundingClientRect()
    if (a.left < box.left + 24 || a.right > box.right - 24) {
      el.scrollLeft += a.left - box.left - (box.width - a.width) / 2
    }
  }, [])

  useLayoutEffect(() => {
    revealActive()
    measure()
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', measure, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return (
    <div className={`relative min-w-0 ${wrapClassName}`}>
      <Tag ref={ref} className={`scrollbar-none overflow-x-auto ${className}`} {...rest}>
        {children}
      </Tag>
      {edges.left && (
        <div className={`pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center bg-gradient-to-r ${fadeFrom[fade]} to-transparent`}>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => scrollBy(-1)}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-text shadow-sm hover:border-text"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
        </div>
      )}
      {edges.right && (
        <div className={`pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l ${fadeFrom[fade]} to-transparent`}>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => scrollBy(1)}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-text shadow-sm hover:border-text"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
