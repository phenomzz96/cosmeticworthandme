/**
 * NỘI DUNG TRANG (Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản, thanh thông báo, mô tả chân trang)
 * Nguồn: bảng public.site_pages (ai cũng đọc; chỉ Admin sửa qua hàm admin_save_page — database kiểm tra quyền).
 * Trang chưa có dòng trong bảng → dùng nội dung mặc định ở src/content/defaultPages.ts.
 */
import { DEFAULT_PAGES, type PageContent, type PageSlug } from '@/content/defaultPages'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'

export interface SitePageRow extends PageContent {
  slug: PageSlug
  updated_at: string
}

type Listener = () => void

let cache: Partial<Record<PageSlug, SitePageRow>> | null = null
let pending: Promise<void> | null = null
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((l) => l())

async function load(): Promise<void> {
  if (!isSupabaseConfigured) {
    cache = {}
    return
  }
  const { data, error } = await requireSupabase().from('site_pages').select('slug, title, intro, body, updated_at')
  if (error) throw error
  cache = Object.fromEntries(((data ?? []) as SitePageRow[]).map((r) => [r.slug, r]))
}

export const sitePagesService = {
  /** Nội dung đã lưu (null = chưa tải xong) */
  snapshot(): Partial<Record<PageSlug, SitePageRow>> | null {
    return cache
  },

  /** Tải một lần cho cả website; gọi lại sau khi Admin lưu */
  async ensure(force = false): Promise<void> {
    if (cache && !force) return
    if (!pending || force) {
      pending = load()
        .catch(() => {
          // Lỗi mạng: dùng nội dung mặc định, không chặn trang
          cache ??= {}
        })
        .finally(() => {
          pending = null
          emit()
        })
    }
    return pending
  },

  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  /** Nội dung đang hiển thị: bản Admin đã lưu, hoặc mặc định */
  resolve(slug: PageSlug): PageContent & { custom: boolean; updatedAt?: string } {
    const row = cache?.[slug]
    if (row) return { title: row.title || DEFAULT_PAGES[slug].title, intro: row.intro, body: row.body, custom: true, updatedAt: row.updated_at }
    return { ...DEFAULT_PAGES[slug], custom: false }
  },

  async save(slug: PageSlug, content: PageContent): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_save_page', {
      p_slug: slug,
      p_title: content.title,
      p_intro: content.intro,
      p_body: content.body,
    })
    if (error) throw error
    await sitePagesService.ensure(true)
  },

  async reset(slug: PageSlug): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_reset_page', { p_slug: slug })
    if (error) throw error
    await sitePagesService.ensure(true)
  },
}
