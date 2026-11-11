import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { PageSlug } from '@/content/defaultPages'
import { useBrand } from '@/features/brand/BrandProvider'
import { formatPrice } from '@/lib/format'
import { fillVars } from '@/lib/richText'
import { sitePagesService } from '@/services/sitePages'

/** Biến dùng được trong nội dung trang */
export function usePageVars(): Record<string, string> {
  const { settings } = useBrand()
  return useMemo(
    () => ({
      ten_san: settings.name,
      phi_van_chuyen: settings.shippingFee > 0 ? formatPrice(settings.shippingFee) : 'miễn phí',
    }),
    [settings.name, settings.shippingFee],
  )
}

/** Nội dung 1 trang (đã thay biến). ready = đã tải xong nội dung do Admin lưu */
export function useSitePage(slug: PageSlug) {
  const snap = useSyncExternalStore(sitePagesService.subscribe, sitePagesService.snapshot)
  useEffect(() => {
    void sitePagesService.ensure()
  }, [])
  const vars = usePageVars()
  return useMemo(() => {
    const c = sitePagesService.resolve(slug)
    return {
      ready: snap !== null,
      custom: c.custom,
      updatedAt: c.updatedAt,
      title: fillVars(c.title, vars),
      intro: fillVars(c.intro, vars),
      body: fillVars(c.body, vars),
    }
  }, [slug, snap, vars])
}
