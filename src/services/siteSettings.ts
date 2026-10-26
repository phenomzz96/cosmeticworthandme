/**
 * CÀI ĐẶT WEBSITE (tên thương hiệu, logo, favicon, màu, phí vận chuyển)
 * Nguồn dữ liệu chính thức: bảng public.site_settings + bucket Storage 'brand' trên Supabase.
 * Mọi người đọc được; chỉ Admin sửa được (database kiểm tra quyền, không phải trình duyệt).
 */
import { brand } from '@/config/brand'
import { requireSupabase, supabase } from '@/lib/supabase'

export interface SiteSettingsRow {
  brand_name: string
  logo_light_path: string | null
  logo_dark_path: string | null
  favicon_path: string | null
  primary_color: string
  shipping_fee: number
  updated_at?: string
}

export interface HistoryEntry {
  id: number
  snapshot: SiteSettingsRow
  changed_at: string
}

export type BrandAssetKind = 'logo-light' | 'logo-dark' | 'favicon' | 'banner'

export const DEFAULT_SETTINGS: SiteSettingsRow = {
  brand_name: brand.name,
  logo_light_path: null,
  logo_dark_path: null,
  favicon_path: null,
  primary_color: brand.primaryColor,
  shipping_fee: 30000,
}

/** Giới hạn khớp với cấu hình bucket 'brand' trong migration */
export const BRAND_UPLOAD = {
  maxBytes: 2 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  extensions: ['png', 'jpg', 'jpeg', 'webp'],
} as const

const BUCKET = 'brand'

export function isValidHexColor(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v)
}

/** Đường dẫn trong bucket → URL công khai để hiển thị */
export function brandAssetUrl(path: string | null): string | null {
  if (!path || !supabase) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function validateBrandFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!BRAND_UPLOAD.mimeTypes.includes(file.type as never) || !BRAND_UPLOAD.extensions.includes(ext as never)) {
    return 'Chỉ nhận ảnh PNG, JPG hoặc WebP.'
  }
  if (file.size > BRAND_UPLOAD.maxBytes) return 'Ảnh tối đa 2 MB.'
  if (file.size === 0) return 'Tệp ảnh rỗng.'
  return null
}

export const siteSettingsService = {
  async get(): Promise<SiteSettingsRow> {
    const { data, error } = await requireSupabase()
      .from('site_settings')
      .select('brand_name, logo_light_path, logo_dark_path, favicon_path, primary_color, shipping_fee, updated_at')
      .eq('id', 1)
      .single()
    if (error) throw error
    return data as SiteSettingsRow
  },

  /** Tải ảnh lên Storage. Tên tệp luôn mới nên trình duyệt không bị dính ảnh cũ trong cache. */
  async uploadAsset(kind: BrandAssetKind, file: File): Promise<string> {
    const invalid = validateBrandFile(file)
    if (invalid) throw new Error(invalid)
    const ext = file.name.split('.').pop()!.toLowerCase().replace('jpeg', 'jpg')
    const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await requireSupabase()
      .storage.from(BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
    if (error) throw error
    return path
  },

  async save(s: SiteSettingsRow): Promise<SiteSettingsRow> {
    const { data, error } = await requireSupabase().rpc('update_site_settings', {
      p_brand_name: s.brand_name,
      p_logo_light_path: s.logo_light_path,
      p_logo_dark_path: s.logo_dark_path,
      p_favicon_path: s.favicon_path,
      p_primary_color: s.primary_color,
      p_shipping_fee: s.shipping_fee,
    })
    if (error) throw error
    return data as SiteSettingsRow
  },

  async history(limit = 10): Promise<HistoryEntry[]> {
    const { data, error } = await requireSupabase()
      .from('site_settings_history')
      .select('id, snapshot, changed_at')
      .order('changed_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as HistoryEntry[]
  },

  async restore(historyId: number): Promise<SiteSettingsRow> {
    const { data, error } = await requireSupabase().rpc('restore_site_settings', { p_history_id: historyId })
    if (error) throw error
    return data as SiteSettingsRow
  },
}
