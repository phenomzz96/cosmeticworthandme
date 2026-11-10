/**
 * Đánh giá sản phẩm (bảng product_reviews, migration 007).
 * Trình duyệt không đọc/ghi thẳng bảng: mọi thao tác qua hàm SQL, database kiểm tra
 * "đã nhận hàng mới được đánh giá", che tên người đánh giá và tự tính điểm sản phẩm/shop.
 */
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'

export const REVIEW_MAX_LENGTH = 1000
export const REVIEWS_PAGE_SIZE = 10

export interface ReviewItem {
  id: string
  rating: number
  comment: string
  reviewer_name: string
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string
  updated_at: string
  is_mine: boolean
}

export interface ProductReviews {
  summary: { average: number; count: number; distribution: Record<'1' | '2' | '3' | '4' | '5', number> }
  items: ReviewItem[]
  /** Đánh giá của người đang xem (kể cả khi bị Admin ẩn) */
  mine: { id: string; rating: number; comment: string; hidden: boolean; hidden_reason: string | null } | null
  /** Đã nhận hàng sản phẩm này và tài khoản đang hoạt động */
  can_review: boolean
}

export interface SellerReview {
  id: string
  product_id: string
  product_name: string
  product_slug: string
  rating: number
  comment: string
  reviewer_name: string
  seller_reply: string | null
  seller_replied_at: string | null
  hidden: boolean
  hidden_reason: string | null
  created_at: string
  total_count: number
}

export interface AdminReview extends Omit<SellerReview, 'seller_replied_at'> {
  shop_name: string
  reviewer_email: string | null
  report_count: number
  report_reasons: string[] | null
}

export const EMPTY_REVIEWS: ProductReviews = {
  summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
  items: [],
  mine: null,
  can_review: false,
}

export interface PublicReview {
  id: string
  rating: number
  comment: string
  reviewer_name: string
  created_at: string
  product_name: string
  product_slug: string
}

export const REPORT_REASONS = [
  { value: 'spam', label: 'Quảng cáo, spam' },
  { value: 'offensive', label: 'Ngôn từ xúc phạm' },
  { value: 'personal_info', label: 'Lộ thông tin cá nhân' },
  { value: 'irrelevant', label: 'Không liên quan đến sản phẩm' },
  { value: 'other', label: 'Lý do khác' },
] as const

export const reviewService = {
  /** Đánh giá thật gần đây (4–5 sao, có nhận xét) cho trang chủ */
  async latest(limit = 6): Promise<PublicReview[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data, error } = await supabase.rpc('latest_reviews', { p_limit: limit })
    if (error) throw error
    return (data ?? []) as PublicReview[]
  },

  async report(reviewId: string, reason: string, note = ''): Promise<void> {
    const { error } = await requireSupabase().rpc('report_review', { p_review_id: reviewId, p_reason: reason, p_note: note.trim() })
    if (error) throw error
  },

  async forProduct(productId: string, page = 1): Promise<ProductReviews> {
    // Dữ liệu mẫu khi chưa kết nối Supabase: chưa có đánh giá
    if (!isSupabaseConfigured || !supabase) return EMPTY_REVIEWS
    const { data, error } = await supabase.rpc('get_product_reviews', {
      p_product_id: productId,
      p_limit: REVIEWS_PAGE_SIZE,
      p_offset: (Math.max(1, page) - 1) * REVIEWS_PAGE_SIZE,
    })
    if (error) throw error
    const r = data as ProductReviews
    return { ...r, summary: { ...r.summary, average: Number(r.summary.average), count: Number(r.summary.count) } }
  },

  async submit(productId: string, rating: number, comment: string): Promise<void> {
    const { error } = await requireSupabase().rpc('submit_review', { p_product_id: productId, p_rating: rating, p_comment: comment.trim() })
    if (error) throw error
  },

  async removeMine(reviewId: string): Promise<void> {
    const { error } = await requireSupabase().rpc('delete_my_review', { p_review_id: reviewId })
    if (error) throw error
  },

  async sellerList(unrepliedOnly: boolean, page = 1, pageSize = 20): Promise<{ items: SellerReview[]; total: number }> {
    const { data, error } = await requireSupabase().rpc('seller_list_reviews', {
      p_unreplied_only: unrepliedOnly,
      p_limit: pageSize,
      p_offset: (Math.max(1, page) - 1) * pageSize,
    })
    if (error) throw error
    const items = (data ?? []) as SellerReview[]
    return { items, total: items[0] ? Number(items[0].total_count) : 0 }
  },

  async reply(reviewId: string, reply: string): Promise<void> {
    const { error } = await requireSupabase().rpc('seller_reply_review', { p_review_id: reviewId, p_reply: reply.trim() })
    if (error) throw error
  },

  async adminList(
    filter: { hidden?: boolean; maxRating?: number; query?: string; reported?: boolean },
    page = 1,
    pageSize = 20,
  ): Promise<{ items: AdminReview[]; total: number }> {
    const { data, error } = await requireSupabase().rpc('admin_list_reviews', {
      p_hidden: filter.hidden ?? null,
      p_max_rating: filter.maxRating ?? null,
      p_query: filter.query?.trim() || null,
      p_limit: pageSize,
      p_offset: (Math.max(1, page) - 1) * pageSize,
      p_reported: filter.reported ?? null,
    })
    if (error) throw error
    const items = (data ?? []) as AdminReview[]
    return { items, total: items[0] ? Number(items[0].total_count) : 0 }
  },

  async adminSetHidden(reviewId: string, hidden: boolean, reason?: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_set_review_hidden', { p_review_id: reviewId, p_hidden: hidden, p_reason: reason?.trim() || null })
    if (error) throw error
  },
}
