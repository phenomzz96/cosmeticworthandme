/**
 * Sổ địa chỉ giao hàng của người đang đăng nhập (bảng addresses, migration 004).
 * Database chỉ cho mỗi người đọc/sửa địa chỉ của chính mình; tối đa 10 địa chỉ, 1 địa chỉ mặc định.
 */
import { requireSupabase } from '@/lib/supabase'
import { normalizePhone } from '@/services/account'

export const MAX_ADDRESSES = 10

export interface Address {
  id: string
  label: string
  recipient_name: string
  phone: string
  province: string
  district: string
  ward: string
  street: string
  is_default: boolean
  created_at: string
}

export type AddressInput = Pick<Address, 'label' | 'recipient_name' | 'phone' | 'province' | 'district' | 'ward' | 'street' | 'is_default'>

const FIELDS = 'id, label, recipient_name, phone, province, district, ward, street, is_default, created_at'

export const emptyAddress: AddressInput = { label: '', recipient_name: '', phone: '', province: '', district: '', ward: '', street: '', is_default: false }

/** Kiểm tra giống ràng buộc trong database */
export function validateAddress(a: AddressInput): Record<string, string> {
  const e: Record<string, string> = {}
  const phone = normalizePhone(a.phone) ?? ''
  if (a.recipient_name.trim().length < 2 || a.recipient_name.length > 80) e.recipient_name = 'Nhập họ tên người nhận (2–80 ký tự).'
  if (!/^\+?[0-9]{9,15}$/.test(phone)) e.phone = 'Số điện thoại gồm 9–15 chữ số.'
  if (a.province.trim().length < 2 || a.province.length > 60) e.province = 'Nhập tỉnh / thành phố.'
  if (a.district.trim().length < 2 || a.district.length > 60) e.district = 'Nhập quận / huyện.'
  if (a.ward.length > 60) e.ward = 'Tối đa 60 ký tự.'
  if (a.street.trim().length < 3 || a.street.length > 200) e.street = 'Nhập số nhà, tên đường (3–200 ký tự).'
  if (a.label.length > 30) e.label = 'Tối đa 30 ký tự.'
  return e
}

function clean(a: AddressInput): AddressInput {
  return {
    label: a.label.trim(),
    recipient_name: a.recipient_name.trim(),
    phone: normalizePhone(a.phone) ?? '',
    province: a.province.trim(),
    district: a.district.trim(),
    ward: a.ward.trim(),
    street: a.street.trim(),
    is_default: a.is_default,
  }
}

export function formatAddress(a: Pick<Address, 'street' | 'ward' | 'district' | 'province'>) {
  return [a.street, a.ward, a.district, a.province].filter(Boolean).join(', ')
}

export const addressService = {
  async list(): Promise<Address[]> {
    const { data, error } = await requireSupabase().from('addresses').select(FIELDS).order('is_default', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return data as Address[]
  },
  async create(input: AddressInput): Promise<Address> {
    const { data, error } = await requireSupabase().from('addresses').insert(clean(input)).select(FIELDS).single()
    if (error) throw error
    return data as Address
  },
  async update(id: string, input: AddressInput): Promise<Address> {
    const { data, error } = await requireSupabase().from('addresses').update(clean(input)).eq('id', id).select(FIELDS).single()
    if (error) throw error
    return data as Address
  },
  async setDefault(id: string): Promise<void> {
    const { error } = await requireSupabase().from('addresses').update({ is_default: true }).eq('id', id)
    if (error) throw error
  },
  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from('addresses').delete().eq('id', id)
    if (error) throw error
  },
}
