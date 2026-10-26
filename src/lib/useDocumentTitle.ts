import { useEffect } from 'react'
import { brand } from '@/config/brand'
import { useBrand } from '@/features/brand/BrandProvider'

/** Đặt tiêu đề tab trình duyệt, luôn kèm tên thương hiệu (lấy từ cài đặt trên Supabase) */
export function useDocumentTitle(title?: string) {
  const { settings } = useBrand()
  useEffect(() => {
    document.title = title ? `${title} | ${settings.name}` : `${settings.name} – ${brand.description}`
  }, [title, settings.name])
}
