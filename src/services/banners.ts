/**
 * Banner trang chủ (bảng banners, migration 006). Khách chỉ đọc được banner đang hiển thị;
 * chỉ Admin thêm/sửa/xóa (database kiểm tra và ghi nhật ký). Ảnh nằm trong bucket 'brand', thư mục banner/.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'
import { brandAssetUrl, siteSettingsService } from '@/services/siteSettings'

export const MAX_BANNERS = 10

export interface Banner {
  id: string
  title: string
  subtitle: string
  image_path: string
  link_url: string
  sort_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

export type BannerInput = Pick<Banner, 'title' | 'subtitle' | 'image_path' | 'link_url' | 'sort_order' | 'is_active' | 'starts_at' | 'ends_at'>

const FIELDS = 'id, title, subtitle, image_path, link_url, sort_order, is_active, starts_at, ends_at, created_at'

/** Chỉ cho liên kết nội bộ (giống ràng buộc trong database) */
export function validateBannerLink(link: string): string | null {
  if (!/^\/[A-Za-z0-9/_?=&%.,~+-]*$/.test(link) || link.startsWith('//') || link.length > 300) return 'Liên kết phải là trang trong website, bắt đầu bằng "/" (ví dụ /products?category=skincare).'
  return null
}

export const bannerUrl = (b: Pick<Banner, 'image_path'>) => brandAssetUrl(b.image_path)

export const bannerService = {
  /** Banner đang hiển thị cho khách (RLS lọc theo bật/tắt và thời gian) */
  async listActive(): Promise<Banner[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase.from('banners').select(FIELDS).eq('is_active', true).order('sort_order').order('created_at', { ascending: false })
    if (error) throw error
    const now = Date.now()
    // Admin đọc được cả banner hết hạn: lọc lại theo thời gian để trang chủ hiển thị đúng như khách thấy
    return (data as Banner[]).filter((b) => (!b.starts_at || Date.parse(b.starts_at) <= now) && (!b.ends_at || Date.parse(b.ends_at) > now))
  },
  async listAll(): Promise<Banner[]> {
    const { data, error } = await requireSupabase().from('banners').select(FIELDS).order('sort_order').order('created_at', { ascending: false })
    if (error) throw error
    return data as Banner[]
  },
  uploadImage: (file: File) => siteSettingsService.uploadAsset('banner', file),
  async create(input: BannerInput): Promise<void> {
    const { error } = await requireSupabase().from('banners').insert(input)
    if (error) throw error
  },
  async update(id: string, patch: Partial<BannerInput>): Promise<void> {
    const { error } = await requireSupabase().from('banners').update(patch).eq('id', id)
    if (error) throw error
  },
  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from('banners').delete().eq('id', id)
    if (error) throw error
  },
}
