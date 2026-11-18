/**
 * Beauty Quest trong Worth & Me (migration 015).
 * Mọi điểm, nhiệm vụ, kết quả Skin Quiz do database tính từ hành động thật; trình duyệt chỉ gửi hành động.
 * Ảnh nhật ký da nằm trong bucket riêng tư `bq-diary/<user_id>/...` (chỉ chủ tài khoản xem được).
 */
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'

export interface BqQuest {
  id: string
  title: string
  description: string
  icon: string
  points: number
  kind: 'daily' | 'weekly' | 'once'
  category: 'quiz' | 'routine' | 'knowledge' | 'reflect'
  requires: string
  done: boolean
  ready: boolean
  active?: boolean
}

export interface BqAchievement {
  id: string
  title: string
  description: string
  icon: string
  rule_value: number
}

export interface BqState {
  points: number
  level: number
  streak: { current: number; best: number; active_today: boolean }
  total_done: number
  quests: BqQuest[]
  achievements: string[]
}

/** Kết quả nhận điểm tự động sau một hành động */
export interface BqClaim {
  claimed: { id: string; title: string; earned: number }[]
  level_up: boolean
  new_achievements: { id: string; title: string; icon: string }[]
  points: number
  level: number
}

export interface QuizResult {
  skin_type: string
  sensitive: boolean
  sun_daily: boolean
  concerns: string[]
  suggested: { morning: string[]; night: string[] }
}

export interface DiaryEntry {
  day: string
  mood: string
  note: string
  photo_path: string | null
}

export interface BqAdminStats {
  players: number
  active_today: number
  quests_claimed: number
  quiz_done: number
  points_total: number
  game_players: number
  game: Record<string, number>
}

const db = () => requireSupabase()
const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await db().rpc(fn, args)
  if (error) throw error
  return data as T
}
const one = async <T>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> => {
  const { data, error } = await q
  if (error) throw error
  return data as T
}

export const BQ_BUCKET = 'bq-diary'

export const beautyQuestService = {
  enabled: isSupabaseConfigured,

  /** Danh sách nhiệm vụ / thành tích công khai (khách chưa đăng nhập cũng xem được) */
  async publicQuests(): Promise<BqQuest[]> {
    const rows = await one<Omit<BqQuest, 'done' | 'ready'>[]>(db().from('bq_quests').select('id, title, description, icon, points, kind, category, requires, active').eq('active', true).order('sort', { ascending: true }))
    return rows.map((q) => ({ ...q, done: false, ready: false }))
  },
  achievements: () => one<BqAchievement[]>(db().from('bq_achievements').select('id, title, description, icon, rule_value').order('rule_value', { ascending: true })),

  state: () => rpc<BqState>('bq_state'),
  claim: (questId: string) => rpc<BqClaim & { earned: number; title: string }>('bq_claim', { p_quest: questId }),
  history: (kind: string | null, day: string | null) =>
    rpc<{ completed_at: string; points: number; day: string; title: string; kind: string }[]>('bq_history', { p_kind: kind || null, p_day: day || null }),

  // Skin Quiz
  async quizResult(): Promise<{ result: QuizResult; updated_at: string } | null> {
    const rows = await one<{ result: QuizResult; updated_at: string }[]>(db().from('bq_quiz_results').select('result, updated_at').limit(1))
    return rows[0] ?? null
  },
  submitQuiz: (answers: Record<string, string | string[]>) => rpc<{ result: QuizResult; claim: BqClaim }>('bq_submit_quiz', { p_answers: answers }),
  deleteQuiz: () => rpc<void>('bq_delete_quiz'),

  // Routine
  async routine(): Promise<{ morning: string[]; night: string[] }> {
    const rows = await one<{ period: 'morning' | 'night'; steps: string[] }[]>(db().from('bq_routines').select('period, steps'))
    return { morning: rows.find((r) => r.period === 'morning')?.steps ?? [], night: rows.find((r) => r.period === 'night')?.steps ?? [] }
  },
  saveRoutine: (morning: string[], night: string[]) => rpc<{ routine: { morning: string[]; night: string[] }; claim: BqClaim }>('bq_save_routine', { p_morning: morning, p_night: night }),
  checkin: (period: 'morning' | 'night') => rpc<{ claim: BqClaim }>('bq_checkin', { p_period: period }),

  /** Sự kiện của tôi (bài đã đọc, đã check-in hôm nay...) */
  myEvents: () => one<{ type: string; ref: string; day: string; week: string }[]>(db().from('bq_events').select('type, ref, day, week').order('day', { ascending: false }).limit(500)),

  markRead: (slug: string) => rpc<{ claim: BqClaim }>('bq_mark_read', { p_slug: slug }),

  // Tự đánh giá
  currentWeek: () => rpc<string>('bq_current_week'),
  reflections: () => one<{ week: string; data: Record<string, number | string> }[]>(db().from('bq_reflections').select('week, data').order('week', { ascending: false }).limit(12)),
  saveReflection: (ratings: Record<string, number>, texts: Record<string, string>) => rpc<{ week: string; claim: BqClaim }>('bq_save_reflection', { p_ratings: ratings, p_texts: texts }),

  // Glow Match
  async gameAnswers(): Promise<Record<string, string>> {
    const rows = await one<{ round_id: string; choice: string }[]>(db().from('bq_game_answers').select('round_id, choice'))
    return Object.fromEntries(rows.map((r) => [r.round_id, r.choice]))
  },
  answerGame: (round: string, choice: string) => rpc<{ complete: boolean; claim?: BqClaim }>('bq_answer_game', { p_round: round, p_choice: choice }),
  resetGame: () => rpc<void>('bq_reset_game'),

  // Nhật ký da
  diary: () => one<DiaryEntry[]>(db().from('bq_diary').select('day, mood, note, photo_path').order('day', { ascending: false }).limit(60)),
  /** Tải ảnh đã nén lên thư mục riêng của tài khoản; trả về đường dẫn trong bucket */
  async uploadDiaryPhoto(userId: string, blob: Blob): Promise<string> {
    const path = `${userId}/${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 10)}.jpg`
    const { error } = await db().storage.from(BQ_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    return path
  },
  async removePhotos(paths: (string | null | undefined)[]) {
    const list = paths.filter((p): p is string => !!p)
    if (list.length) await db().storage.from(BQ_BUCKET).remove(list)
  },
  /** Đường dẫn xem ảnh có hạn 5 phút (bucket riêng tư) */
  async photoUrl(path: string): Promise<string | null> {
    const { data, error } = await db().storage.from(BQ_BUCKET).createSignedUrl(path, 300)
    if (error) return null
    return data?.signedUrl ?? null
  },
  saveDiary: (mood: string, note: string, photoPath: string | null, removePhoto: boolean) =>
    rpc<{ removed_photo: string | null; claim: BqClaim }>('bq_save_diary', { p_mood: mood, p_note: note, p_photo_path: photoPath, p_remove_photo: removePhoto }),
  deleteDiary: (day: string) => rpc<string | null>('bq_delete_diary', { p_day: day }),

  /** Tải toàn bộ dữ liệu Beauty Quest của tôi (JSON) */
  async exportMine(): Promise<Record<string, unknown>> {
    const t = (name: string, cols = '*') => one<unknown[]>(db().from(name).select(cols))
    const [progress, quests, points, achievements, diary, game, quiz, routines, reflections, events] = await Promise.all([
      t('bq_progress', 'points, level'),
      t('bq_user_quests', 'quest_id, period_key, day, points, completed_at'),
      t('bq_point_transactions', 'quest_id, points, reason, created_at'),
      t('bq_user_achievements', 'achievement_id, unlocked_at'),
      t('bq_diary', 'day, mood, note, photo_path, updated_at'),
      t('bq_game_answers', 'round_id, choice'),
      t('bq_quiz_results', 'answers, result, updated_at'),
      t('bq_routines', 'period, steps, updated_at'),
      t('bq_reflections', 'week, data, updated_at'),
      t('bq_events', 'type, ref, day'),
    ])
    return { exported_at: new Date().toISOString(), progress: progress[0] ?? null, completed_quests: quests, point_transactions: points, achievements, diary, glow_match: game, skin_quiz: quiz[0] ?? null, routines, reflections, activity: events }
  },
  async deleteMine(): Promise<void> {
    const paths = await rpc<string[]>('bq_delete_my_data')
    await beautyQuestService.removePhotos(paths ?? []).catch(() => undefined)
  },

  // Quản trị
  adminQuests: () => one<BqQuest[]>(db().from('bq_quests').select('id, title, description, icon, points, kind, category, requires, active').order('sort', { ascending: true })),
  adminSaveQuest: (q: Omit<BqQuest, 'done' | 'ready'> & { active: boolean }) =>
    rpc<void>('bq_admin_save_quest', {
      p_id: q.id,
      p_title: q.title,
      p_description: q.description,
      p_icon: q.icon,
      p_points: q.points,
      p_kind: q.kind,
      p_category: q.category,
      p_requires: q.requires,
      p_active: q.active,
    }),
  adminStats: () => rpc<BqAdminStats>('bq_admin_stats'),
}
