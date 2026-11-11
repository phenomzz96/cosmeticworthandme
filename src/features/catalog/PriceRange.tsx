import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '@/lib/format'

const STEP = 10_000

/**
 * Thanh trượt khoảng giá 2 đầu + 2 ô nhập số. Kéo xong (hoặc dừng gõ) mới áp dụng, để không tải lại liên tục.
 * value: [từ, đến] (đến = null nghĩa là không giới hạn trên).
 */
export function PriceRange({
  bound,
  value,
  onChange,
  idPrefix,
}: {
  bound: number
  value: [number, number | null]
  onChange: (lo: number, hi: number | null) => void
  idPrefix: string
}) {
  const [lo, setLo] = useState(value[0])
  const [hi, setHi] = useState(value[1] ?? bound)
  const timer = useRef(0)

  // Đồng bộ khi URL đổi (bấm "Xóa bộ lọc", quay lại...)
  useEffect(() => {
    setLo(value[0])
    setHi(Math.min(value[1] ?? bound, bound))
  }, [value[0], value[1], bound]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (a: number, b: number, delay = 450) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onChange(Math.max(0, a), b >= bound ? null : b), delay)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const setA = (v: number, delay?: number) => {
    const a = Math.min(Math.max(0, v), hi - STEP)
    setLo(a)
    commit(a, hi, delay)
  }
  const setB = (v: number, delay?: number) => {
    const b = Math.max(Math.min(bound, v), lo + STEP)
    setHi(b)
    commit(lo, b, delay)
  }

  const pct = (v: number) => `${(v / bound) * 100}%`

  return (
    <div>
      <div className="flex items-center justify-between text-sm font-medium tabular-nums" aria-live="polite">
        <span>{formatPrice(lo)}</span>
        <span>{hi >= bound ? `${formatPrice(bound)}+` : formatPrice(hi)}</span>
      </div>
      <div className="range-dual relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink" style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }} />
        <input
          type="range"
          min={0}
          max={bound}
          step={STEP}
          value={lo}
          onChange={(e) => setA(Number(e.target.value))}
          aria-label="Giá thấp nhất"
          aria-valuetext={formatPrice(lo)}
        />
        <input
          type="range"
          min={0}
          max={bound}
          step={STEP}
          value={hi}
          onChange={(e) => setB(Number(e.target.value))}
          aria-label="Giá cao nhất"
          aria-valuetext={hi >= bound ? 'Không giới hạn' : formatPrice(hi)}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted" htmlFor={`${idPrefix}-price-from`}>
          Từ (đ)
          <input
            id={`${idPrefix}-price-from`}
            type="number"
            inputMode="numeric"
            min={0}
            step={STEP}
            value={lo}
            onChange={(e) => setA(Number(e.target.value) || 0, 900)}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"
          />
        </label>
        <label className="text-xs text-muted" htmlFor={`${idPrefix}-price-to`}>
          Đến (đ)
          <input
            id={`${idPrefix}-price-to`}
            type="number"
            inputMode="numeric"
            min={0}
            step={STEP}
            value={hi}
            onChange={(e) => setB(Number(e.target.value) || bound, 900)}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"
          />
        </label>
      </div>
    </div>
  )
}
