/**
 * Thông báo (bảng notifications, migration 008). Database tự tạo thông báo khi đơn đổi trạng thái,
 * thanh toán được xác nhận, đánh giá được trả lời... Mỗi người chỉ đọc được thông báo của mình.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'

export interface AppNotification {
  id: number
  kind: 'order' | 'payment' | 'refund' | 'review' | 'shop' | 'product' | 'system' | 'message'
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export const notificationService = {
  async unreadCount(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
    if (error) throw error
    return count ?? 0
  },

  async list(limit = 30): Promise<AppNotification[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as AppNotification[]
  },

  async markRead(ids?: number[]): Promise<void> {
    const { error } = await requireSupabase().rpc('mark_notifications_read', { p_ids: ids ?? null })
    if (error) throw error
  },
}
