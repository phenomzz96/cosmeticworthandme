import { useEffect, useState } from 'react'

/** Đếm ngược tới một thời điểm. everyMs: chu kỳ cập nhật (mặc định 1 giây). */
export function useCountdown(target: string | null | undefined, everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const t = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(t)
  }, [target, everyMs])
  const ms = target ? Math.max(0, Date.parse(target) - now) : 0
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const label = days > 0 ? `${days} ngày ${hours} giờ` : hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`
  return { ms, days, hours, minutes, seconds, label, done: ms === 0 }
}
