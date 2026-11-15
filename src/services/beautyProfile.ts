/**
 * Hồ sơ làm đẹp (migration 014): câu trả lời Beauty Finder lưu vào tài khoản, dùng lại trên mọi thiết bị.
 * Chỉ chủ tài khoản đọc / sửa / xóa được (database kiểm tra).
 */
import { answersFromParams, answersToParams, defaultAnswers, type FinderAnswers } from '@/features/beauty-finder/questions'
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase'

export interface SavedBeautyProfile {
  answers: FinderAnswers
  updatedAt: string
}

/** Kiểm tra lại dữ liệu đã lưu (bỏ giá trị lạ / phiên bản cũ) bằng cùng bộ đọc của đường dẫn */
const clean = (raw: unknown): FinderAnswers | null => {
  if (!raw || typeof raw !== 'object') return null
  return answersFromParams(answersToParams({ ...defaultAnswers, ...(raw as Partial<FinderAnswers>) }))
}

export const beautyProfileService = {
  async get(): Promise<SavedBeautyProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data, error } = await supabase.from('beauty_profiles').select('answers, updated_at').maybeSingle()
    if (error) throw error
    const answers = data ? clean(data.answers) : null
    return data && answers ? { answers, updatedAt: data.updated_at as string } : null
  },

  async save(answers: FinderAnswers): Promise<string> {
    const { data, error } = await requireSupabase().rpc('save_beauty_profile', { p_answers: answers })
    if (error) throw error
    return data as string
  },

  async remove(userId: string): Promise<void> {
    const { error } = await requireSupabase().from('beauty_profiles').delete().eq('user_id', userId)
    if (error) throw error
  },
}
