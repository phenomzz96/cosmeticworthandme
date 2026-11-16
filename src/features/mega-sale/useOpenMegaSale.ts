import { useEffect, useState } from 'react'
import { megaSaleService, type MegaSale } from '@/services/megaSale'

/** Đợt Mega Sale đang chạy (hoặc sắp mở) gần nhất — dùng cho thanh menu, trang chủ. Không có thì null. */
export function useOpenMegaSale() {
  const [sale, setSale] = useState<MegaSale | null>(null)
  useEffect(() => {
    let alive = true
    megaSaleService
      .listOpen()
      .then((list) => alive && setSale(list[0] ?? null))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return sale
}
