/**
 * Ảnh của cửa hàng và sản phẩm — bucket Supabase Storage 'shop-media'.
 * Đường dẫn luôn có dạng <shop_id>/<tên tệp>; database chỉ cho chủ shop ghi vào thư mục của mình.
 */
import { requireSupabase, supabase } from '@/lib/supabase'

export const SHOP_MEDIA_BUCKET = 'shop-media'

export const SHOP_MEDIA_UPLOAD = {
  /** Giới hạn của bucket trong database (ảnh SAU khi nén) */
  maxBytes: 3 * 1024 * 1024,
  /** Ảnh gốc người dùng chọn: tối đa 12 MB, website tự thu nhỏ và nén trước khi tải lên */
  maxInputBytes: 12 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  extensions: ['png', 'jpg', 'jpeg', 'webp'],
} as const

/** Kích thước cạnh dài tối đa theo loại ảnh (đủ nét trên màn hình, nhẹ khi tải trang) */
const MAX_EDGE: Record<string, number> = { logo: 512, cover: 1800, product: 1400 }

export function shopMediaUrl(path: string | null | undefined): string | undefined {
  if (!path || !supabase) return undefined
  return supabase.storage.from(SHOP_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

export function validateShopImage(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!SHOP_MEDIA_UPLOAD.mimeTypes.includes(file.type as never) || !SHOP_MEDIA_UPLOAD.extensions.includes(ext as never)) {
    return 'Chỉ nhận ảnh PNG, JPG hoặc WebP.'
  }
  if (file.size > SHOP_MEDIA_UPLOAD.maxInputBytes) return 'Ảnh tối đa 12 MB.'
  if (file.size === 0) return 'Tệp ảnh rỗng.'
  return null
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Thu nhỏ (giữ tỷ lệ) và nén ảnh sang WebP trong trình duyệt trước khi tải lên.
 * Ảnh sản phẩm PNG 400–500 KB thường còn khoảng 60–150 KB, trang tải nhanh hơn nhiều.
 * Trình duyệt không nén được (hoặc ảnh nén ra không nhỏ hơn) thì giữ ảnh gốc.
 */
export async function compressImage(file: File, maxEdge = 1400): Promise<{ blob: Blob; type: string; ext: string }> {
  const original = { blob: file as Blob, type: file.type, ext: file.name.split('.').pop()!.toLowerCase().replace('jpeg', 'jpg') }
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return original
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    let blob = await canvasToBlob(canvas, 'image/webp', 0.82)
    let type = 'image/webp'
    // Trình duyệt cũ không xuất được WebP (trả về PNG): dùng JPEG
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.85)
      type = 'image/jpeg'
    }
    if (!blob || (blob.size >= file.size && scale === 1)) return original
    return { blob, type, ext: type === 'image/webp' ? 'webp' : 'jpg' }
  } catch {
    return original
  }
}

/** Nén rồi tải ảnh lên thư mục của shop. Trả về đường dẫn để lưu vào database. */
export async function uploadShopImage(shopId: string, prefix: string, file: File): Promise<string> {
  const invalid = validateShopImage(file)
  if (invalid) throw new Error(invalid)
  const { blob, type, ext } = await compressImage(file, MAX_EDGE[prefix] ?? 1400)
  if (blob.size > SHOP_MEDIA_UPLOAD.maxBytes) throw new Error('Ảnh vẫn lớn hơn 3 MB sau khi nén. Hãy chọn ảnh nhỏ hơn.')
  const path = `${shopId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await requireSupabase()
    .storage.from(SHOP_MEDIA_BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

/** Xóa tệp khỏi Storage (bỏ qua lỗi: tệp mồ côi không ảnh hưởng người dùng) */
export async function removeShopImages(paths: string[]) {
  if (!paths.length || !supabase) return
  await supabase.storage.from(SHOP_MEDIA_BUCKET).remove(paths)
}
