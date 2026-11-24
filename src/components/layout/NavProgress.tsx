import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Thanh tiến trình mảnh ở đầu trang khi đang chuyển trang.
 * React giữ trang cũ trên màn hình trong lúc tải mã / dữ liệu của trang mới; thanh này cho người dùng biết cú bấm
 * đã được nhận (không có cảm giác website bị "đứng"). Chỉ hiện nếu việc chuyển trang mất hơn 120 ms.
 */
export function NavProgress() {
  const { key } = useLocation()
  const [pending, setPending] = useState(false)
  const [visible, setVisible] = useState(false)

  // Bấm một liên kết nội bộ dẫn tới trang khác: bắt đầu chờ
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setPending(true)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Trang mới đã hiện (địa chỉ đổi): xong
  useEffect(() => {
    setPending(false)
  }, [key])

  useEffect(() => {
    if (!pending) {
      setVisible(false)
      return
    }
    const show = window.setTimeout(() => setVisible(true), 120)
    // Phòng trường hợp liên kết không dẫn tới trang mới: tự tắt sau 10 giây
    const stop = window.setTimeout(() => setPending(false), 10_000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(stop)
    }
  }, [pending])

  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden" role="progressbar" aria-label="Đang chuyển trang">
      <div className="nav-progress h-full bg-primary" />
    </div>
  )
}
