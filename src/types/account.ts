/** Khớp với bảng public.profiles trong supabase/migrations */
export type UserRole = 'customer' | 'seller' | 'admin' | 'super_admin'
export type AccountStatus = 'active' | 'suspended'

export interface Profile {
  id: string
  email: string | null
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  status: AccountStatus
  suspended_reason: string | null
  created_at: string
}

export const roleLabels: Record<UserRole, string> = {
  customer: 'Khách hàng',
  seller: 'Người bán',
  admin: 'Quản trị viên',
  super_admin: 'Quản trị viên cấp cao',
}

export const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin']
