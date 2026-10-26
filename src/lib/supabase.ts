/**
 * Kết nối Supabase dùng chung cho toàn bộ website.
 *
 * Chỉ dùng 2 biến công khai (khai báo trong .env.local và trên Netlify):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * anon key được phép nằm ở frontend: mọi quyền truy cập đều do RLS trong database kiểm soát.
 * TUYỆT ĐỐI không đưa service_role key vào frontend hoặc repository.
 *
 * Khi chưa cấu hình, website vẫn chạy với dữ liệu mẫu; các chức năng tài khoản báo "chưa kết nối".
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** Dùng trong service: báo lỗi rõ ràng thay vì lỗi null khó hiểu */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Website chưa được kết nối Supabase. Xem hướng dẫn trong README (mục Cấu hình Supabase).')
  }
  return supabase
}

/** URL tuyệt đối của trang hiện tại, dùng cho link trong email xác minh / đặt lại mật khẩu */
export function siteUrl(path = '/') {
  return new URL(path, window.location.origin).toString()
}
