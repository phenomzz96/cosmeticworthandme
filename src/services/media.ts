/**
 * Ảnh của cửa hàng và sản phẩm — bucket Supabase Storage 'shop-media'.
 * Đường dẫn luôn có dạng <shop_id>/<tên tệp>; database chỉ cho chủ shop ghi vào thư mục của mình.
 */
import { requireSupabase, supabase } from '@/lib/supabase'

export const SHOP_MEDIA_BUCKET = 'shop-media'

export const SHOP_MEDIA_UPLOAD = {
  maxBytes: 3 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  extensions: ['png', 'jpg', 'jpeg', 'webp'],
} as const

export function shopMediaUrl(path: string | null | undefined): string | undefined {
  if (!path || !supabase) return undefined
  return supabase.storage.from(SHOP_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

export function validateShopImage(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!SHOP_MEDIA_UPLOAD.mimeTypes.includes(file.type as never) || !SHOP_MEDIA_UPLOAD.extensions.includes(ext as never)) {
    return 'Chỉ nhận ảnh PNG, JPG hoặc WebP.'
  }
  if (file.size > SHOP_MEDIA_UPLOAD.maxBytes) return 'Ảnh tối đa 3 MB.'
  if (file.size === 0) return 'Tệp ảnh rỗng.'
  return null
}

/** Tải ảnh lên thư mục của shop. Trả về đường dẫn để lưu vào database. */
export async function uploadShopImage(shopId: string, prefix: string, file: File): Promise<string> {
  const invalid = validateShopImage(file)
  if (invalid) throw new Error(invalid)
  const ext = file.name.split('.').pop()!.toLowerCase().replace('jpeg', 'jpg')
  const path = `${shopId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await requireSupabase()
    .storage.from(SHOP_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

/** Xóa tệp khỏi Storage (bỏ qua lỗi: tệp mồ côi không ảnh hưởng người dùng) */
export async function removeShopImages(paths: string[]) {
  if (!paths.length || !supabase) return
  await supabase.storage.from(SHOP_MEDIA_BUCKET).remove(paths)
}
