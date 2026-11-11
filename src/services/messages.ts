/**
 * TIN NHẮN khách ↔ cửa hàng, khách ↔ bộ phận hỗ trợ của sàn (migration 009).
 * Database kiểm tra quyền: chỉ khách, chủ cửa hàng (hoặc Admin, với cuộc trò chuyện hỗ trợ) đọc và gửi được.
 * Trình duyệt không ghi thẳng vào bảng; vai trò người gửi do database xác định.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'

export type InboxScope = 'customer' | 'shop' | 'support'
export type SenderRole = 'customer' | 'shop' | 'admin'

export interface ConversationSummary {
  id: string
  shop_id: string | null
  shop_name: string | null
  shop_slug: string | null
  customer_name: string
  customer_email: string | null
  last_message_at: string
  last_preview: string
  last_sender: SenderRole | null
  unread: number
}

export interface ChatMessage {
  id: number
  conversation_id: string
  sender_role: SenderRole
  body: string
  product_id: string | null
  created_at: string
}

export interface UnreadMessages {
  customer: number
  shop: number
  support: number | null
}

export const MESSAGE_MAX = 2000
export const MESSAGES_CHANGED = 'wm:messages-changed'

export const messageService = {
  async inbox(scope: InboxScope): Promise<ConversationSummary[]> {
    const { data, error } = await requireSupabase().rpc('inbox', { p_scope: scope })
    if (error) throw error
    return (data ?? []) as ConversationSummary[]
  },

  async messages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await requireSupabase()
      .from('messages')
      .select('id, conversation_id, sender_role, body, product_id, created_at')
      .eq('conversation_id', conversationId)
      .order('id', { ascending: true })
      .limit(500)
    if (error) throw error
    return (data ?? []) as ChatMessage[]
  },

  /** Bắt đầu (hoặc tiếp tục) trò chuyện với cửa hàng; shopId = null: hỏi bộ phận hỗ trợ của sàn */
  async start(shopId: string | null, body: string, productId?: string | null): Promise<string> {
    const { data, error } = await requireSupabase().rpc('start_conversation', {
      p_shop_id: shopId,
      p_body: body,
      p_product_id: productId ?? null,
    })
    if (error) throw error
    window.dispatchEvent(new Event(MESSAGES_CHANGED))
    return data as string
  },

  async send(conversationId: string, body: string): Promise<void> {
    const { error } = await requireSupabase().rpc('send_message', { p_conversation_id: conversationId, p_body: body })
    if (error) throw error
  },

  async markRead(conversationId: string): Promise<void> {
    const { error } = await requireSupabase().rpc('mark_conversation_read', { p_conversation_id: conversationId })
    if (error) throw error
    window.dispatchEvent(new Event(MESSAGES_CHANGED))
  },

  async unread(): Promise<UnreadMessages> {
    if (!isSupabaseConfigured || !supabase) return { customer: 0, shop: 0, support: null }
    const { data, error } = await supabase.rpc('unread_messages')
    if (error) throw error
    const d = (data ?? {}) as Partial<UnreadMessages>
    return { customer: Number(d.customer ?? 0), shop: Number(d.shop ?? 0), support: d.support == null ? null : Number(d.support) }
  },
}
