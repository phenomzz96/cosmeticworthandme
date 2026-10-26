/**
 * Dịch vụ tài khoản: đăng ký, đăng nhập, hồ sơ.
 * Mọi kiểm tra quyền thật sự nằm trong database (RLS). Các hàm ở đây chỉ gọi API.
 */
import { requireSupabase, siteUrl } from '@/lib/supabase'
import type { Profile } from '@/types/account'

const PROFILE_COLUMNS = 'id, email, full_name, phone, avatar_url, role, status, suspended_reason, created_at'

export const PASSWORD_MIN_LENGTH = 8

/** Kiểm tra mật khẩu phía trình duyệt (Supabase cũng kiểm tra lại theo cấu hình của project) */
export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Mật khẩu cần có cả chữ và số.'
  return null
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? null : 'Email không hợp lệ.'
}

/** Chuẩn hóa SĐT Việt Nam: bỏ khoảng trắng, dấu chấm, gạch nối. Rỗng = không có. */
export function normalizePhone(phone: string): string | null {
  const v = phone.replace(/[\s.-]/g, '')
  return v === '' ? null : v
}

export function validatePhone(phone: string): string | null {
  const v = normalizePhone(phone)
  if (v === null) return null
  return /^\+?[0-9]{9,15}$/.test(v) ? null : 'Số điện thoại chỉ gồm 9–15 chữ số, có thể bắt đầu bằng +.'
}

export const accountService = {
  async signUp(input: { email: string; password: string; fullName: string }) {
    const { data, error } = await requireSupabase().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        // Chỉ gửi họ tên. Role luôn do database gán (customer), không lấy từ đây.
        data: { full_name: input.fullName.trim() },
        emailRedirectTo: siteUrl('/login?verified=1'),
      },
    })
    if (error) throw error
    // Supabase trả "thành công giả" khi email đã tồn tại (để không lộ thông tin): identities rỗng
    const alreadyExists = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    return { needsEmailConfirmation: !data.session, alreadyExists }
  },

  async signIn(email: string, password: string) {
    const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  },

  async signOut() {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
  },

  async sendPasswordReset(email: string) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: siteUrl('/reset-password'),
    })
    if (error) throw error
  },

  async updatePassword(newPassword: string) {
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  async resendConfirmation(email: string) {
    const { error } = await requireSupabase().auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: siteUrl('/login?verified=1') },
    })
    if (error) throw error
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await requireSupabase().from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
    if (error) throw error
    return data as Profile | null
  },

  /** Chỉ gửi các cột người dùng được phép sửa. Database chặn mọi cột khác. */
  async updateMyProfile(userId: string, input: { fullName: string; phone: string }): Promise<Profile> {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .update({ full_name: input.fullName.trim(), phone: normalizePhone(input.phone) })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single()
    if (error) throw error
    return data as Profile
  },
}
