/**
 * Dịch vụ quản trị tài khoản. Mọi hàm gọi RPC trong database; database tự kiểm tra:
 * người gọi có phải Admin/Super Admin, không tự khóa mình, không đụng tới Super Admin...
 */
import { requireSupabase } from '@/lib/supabase'
import type { AccountStatus, Profile, UserRole } from '@/types/account'

export const ADMIN_PAGE_SIZE = 20

export interface AdminUserRow {
  id: string
  email: string | null
  full_name: string
  phone: string | null
  role: UserRole
  status: AccountStatus
  suspended_reason: string | null
  suspended_at: string | null
  created_at: string
  email_confirmed: boolean
  total_count: number
}

export interface UserFilters {
  search?: string
  role?: UserRole
  status?: AccountStatus
  createdFrom?: string
  createdTo?: string
  page?: number
}

export interface AuditRow {
  id: number
  created_at: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  actor_email: string | null
  total_count: number
}

export const SUSPEND_REASON_MIN = 5
export const SUSPEND_REASON_MAX = 500

export const adminUsersService = {
  async list(f: UserFilters): Promise<{ rows: AdminUserRow[]; total: number }> {
    const page = Math.max(1, f.page ?? 1)
    const { data, error } = await requireSupabase().rpc('admin_list_users', {
      p_search: f.search?.trim() || null,
      p_role: f.role ?? null,
      p_status: f.status ?? null,
      p_created_from: f.createdFrom || null,
      p_created_to: f.createdTo || null,
      p_limit: ADMIN_PAGE_SIZE,
      p_offset: (page - 1) * ADMIN_PAGE_SIZE,
    })
    if (error) throw error
    const rows = (data ?? []) as AdminUserRow[]
    return { rows, total: rows[0] ? Number(rows[0].total_count) : 0 }
  },

  async setStatus(userId: string, status: AccountStatus, reason?: string): Promise<Profile> {
    const { data, error } = await requireSupabase().rpc('admin_set_user_status', {
      p_user_id: userId,
      p_status: status,
      p_reason: reason?.trim() || null,
    })
    if (error) throw error
    return data as Profile
  },

  async setRole(userId: string, role: UserRole, reason?: string): Promise<Profile> {
    const { data, error } = await requireSupabase().rpc('admin_set_user_role', {
      p_user_id: userId,
      p_role: role,
      p_reason: reason?.trim() || null,
    })
    if (error) throw error
    return data as Profile
  },

  async auditLogs(action: string | null, page = 1, pageSize = 30): Promise<{ rows: AuditRow[]; total: number }> {
    const { data, error } = await requireSupabase().rpc('admin_audit_logs', {
      p_action: action,
      p_limit: pageSize,
      p_offset: (Math.max(1, page) - 1) * pageSize,
    })
    if (error) throw error
    const rows = (data ?? []) as AuditRow[]
    return { rows, total: rows[0] ? Number(rows[0].total_count) : 0 }
  },
}

/** Nhãn tiếng Việt cho các hành động trong nhật ký */
export const auditActionLabels: Record<string, string> = {
  bootstrap_super_admin: 'Khởi tạo Super Admin',
  'user.suspend': 'Khóa tài khoản',
  'user.unsuspend': 'Mở khóa tài khoản',
  'user.grant_admin': 'Cấp quyền Admin',
  'user.revoke_admin': 'Thu hồi quyền Admin',
  'site_settings.update': 'Cập nhật thương hiệu',
  'site_settings.restore': 'Khôi phục thương hiệu',
  'shop.approve': 'Duyệt cửa hàng',
  'shop.reject': 'Từ chối cửa hàng',
  'shop.suspend': 'Tạm ngưng cửa hàng',
  'shop.reactivate': 'Mở lại cửa hàng',
  'product.hide': 'Ẩn sản phẩm vi phạm',
  'product.unhide': 'Bỏ ẩn sản phẩm',
  'payment.confirm': 'Xác nhận thanh toán',
  'payment.reject': 'Từ chối thanh toán',
  'payment.refund': 'Đánh dấu đã hoàn tiền',
  'order.cancel': 'Admin hủy đơn',
  'banner.create': 'Thêm banner',
  'banner.update': 'Sửa banner',
  'banner.delete': 'Xóa banner',
}
