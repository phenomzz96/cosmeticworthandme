/**
 * BrandProvider — cung cấp tên, logo, favicon, màu chủ đạo cho toàn website.
 *
 * Nguồn chính thức: Supabase (bảng site_settings). Vì vậy mọi thiết bị thấy giống nhau.
 * localStorage chỉ giữ BẢN SAO TẠM để lần tải sau hiện đúng logo ngay, tránh nháy logo mặc định;
 * bản sao này luôn bị ghi đè bởi dữ liệu mới nhất từ server.
 *
 * API useBrand().settings giữ các trường giống bản trước (name, logoLight, logoDark, favicon,
 * primaryColor) để các component cũ không phải sửa.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { brand } from '@/config/brand'
import { isSupabaseConfigured } from '@/lib/supabase'
import { brandAssetUrl, DEFAULT_SETTINGS, isValidHexColor, siteSettingsService, type SiteSettingsRow } from '@/services/siteSettings'

const CACHE_KEY = 'worth-and-me-site-settings-cache-v1'

export interface BrandSettings {
  name: string
  /** URL logo nền sáng; rỗng = dùng logo chữ dự phòng */
  logoLight: string
  /** URL logo nền tối; rỗng = dùng logoLight */
  logoDark: string
  favicon: string
  primaryColor: string
  shippingFee: number
}

interface BrandContextValue {
  settings: BrandSettings
  /** Dữ liệu gốc từ database (đường dẫn trong bucket) — dùng cho trang quản trị */
  raw: SiteSettingsRow
  status: 'default' | 'loading' | 'ready' | 'error'
  refresh: () => Promise<void>
  /** Cập nhật ngay sau khi Admin lưu, không cần tải lại */
  apply: (row: SiteSettingsRow) => void
}

const BrandContext = createContext<BrandContextValue | null>(null)

function readCache(): SiteSettingsRow | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as SiteSettingsRow
    return typeof v?.brand_name === 'string' && isValidHexColor(v.primary_color) ? v : null
  } catch {
    return null
  }
}

function writeCache(row: SiteSettingsRow) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(row))
  } catch {
    /* không lưu được bản sao tạm cũng không sao */
  }
}

export function toBrandSettings(row: SiteSettingsRow): BrandSettings {
  return {
    name: row.brand_name || brand.name,
    logoLight: brandAssetUrl(row.logo_light_path) ?? '',
    logoDark: brandAssetUrl(row.logo_dark_path) ?? '',
    favicon: brandAssetUrl(row.favicon_path) ?? brand.favicon,
    primaryColor: isValidHexColor(row.primary_color) ? row.primary_color : brand.primaryColor,
    shippingFee: row.shipping_fee,
  }
}

/** Độ sáng tương đối (WCAG) để chọn màu chữ trên nút chính cho đủ tương phản */
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** Ghi đè token màu chủ đạo cho cả 2 theme. Dark mode dùng bản sáng hơn để đọc rõ trên nền tối. */
export function primaryColorCss(color: string) {
  const onLight = luminance(color) > 0.4 ? '#1d1420' : '#ffffff'
  return `html[data-theme='light'],html:not([data-theme]){--primary:${color};--primary-hover:color-mix(in oklab,${color} 82%,black);--primary-soft:color-mix(in oklab,${color} 12%,white);--on-primary:${onLight};--ring:${color};}
html[data-theme='dark']{--primary:color-mix(in oklab,${color} 55%,white);--primary-hover:color-mix(in oklab,${color} 40%,white);--primary-soft:color-mix(in oklab,${color} 32%,#170f16);--on-primary:#1d1420;--ring:color-mix(in oklab,${color} 45%,white);}`
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [row, setRow] = useState<SiteSettingsRow>(() => readCache() ?? DEFAULT_SETTINGS)
  const [status, setStatus] = useState<BrandContextValue['status']>(isSupabaseConfigured ? 'loading' : 'default')

  const apply = useCallback((next: SiteSettingsRow) => {
    setRow(next)
    writeCache(next)
    setStatus('ready')
  }, [])

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      apply(await siteSettingsService.get())
    } catch {
      setStatus('error')
    }
  }, [apply])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const settings = useMemo(() => toBrandSettings(row), [row])

  // Áp dụng màu chủ đạo và favicon lên trang
  useEffect(() => {
    let el = document.getElementById('brand-color-overrides') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'brand-color-overrides'
      document.head.appendChild(el)
    }
    el.textContent = primaryColorCss(settings.primaryColor)
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) {
      icon.href = settings.favicon
      icon.type = settings.favicon.endsWith('.svg') ? 'image/svg+xml' : ''
    }
  }, [settings.primaryColor, settings.favicon])

  const value = useMemo(() => ({ settings, raw: row, status, refresh, apply }), [settings, row, status, refresh, apply])
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand phải được dùng bên trong <BrandProvider>')
  return ctx
}
