/**
 * BEAUTY QUEST (QUẢN TRỊ) — /admin/beauty-quest. Chuyển từ admin.html + admin.js của bản gốc:
 * số liệu tổng hợp, quản lý nhiệm vụ (thêm / sửa / bật / tắt), thống kê Glow Match ẩn danh.
 * Quyền kiểm tra ở database (is_admin), thao tác ghi audit_logs. Tài khoản người dùng quản lý ở /admin/users.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, TextField } from '@/components/ui/Form'
import { button, Skeleton } from '@/components/ui/primitives'
import { ROUNDS } from '@/features/beauty-quest/content'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService, type BqAdminStats, type BqQuest } from '@/services/beautyQuest'

type QuestForm = Omit<BqQuest, 'done' | 'ready'> & { active: boolean }

const KIND = { daily: 'Hằng ngày', weekly: 'Hằng tuần', once: 'Một lần' } as const
const CATEGORY = { quiz: 'Quiz', routine: 'Routine', knowledge: 'Kiến thức', reflect: 'Tự đánh giá' } as const
const REQUIRES: Record<string, string> = {
  quiz: 'Làm Skin Quiz',
  routine_saved: 'Lưu routine',
  routine_morning: 'Check-in routine sáng',
  routine_night: 'Check-in routine tối',
  article_read: 'Đọc bài học',
  reflection: 'Tự đánh giá tuần',
  diary: 'Ghi nhật ký da',
  glow_match: 'Hoàn thành Glow Match',
}
const empty: QuestForm = { id: '', title: '', description: '', icon: '🌸', points: 5, kind: 'daily', category: 'routine', requires: 'quiz', active: true }

export function AdminBeautyQuestPage() {
  useDocumentTitle('Beauty Quest')
  const [stats, setStats] = useState<BqAdminStats | null>(null)
  const [quests, setQuests] = useState<BqQuest[] | null>(null)
  const [form, setForm] = useState<QuestForm>(empty)
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([beautyQuestService.adminStats(), beautyQuestService.adminQuests()])
      setStats(s)
      setQuests(q)
    } catch (err) {
      setMsg({ text: friendlyError(err), err: true })
      setQuests([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const save = async (q: QuestForm, ok: string) => {
    setMsg(null)
    try {
      await beautyQuestService.adminSaveQuest(q)
      setMsg({ text: ok })
      await load()
      return true
    } catch (err) {
      setMsg({ text: friendlyError(err), err: true })
      return false
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[a-z0-9_]{2,40}$/.test(form.id)) return setMsg({ text: 'ID chỉ gồm chữ thường, số và dấu gạch dưới (2–40 ký tự).', err: true })
    if (await save(form, 'Đã lưu nhiệm vụ.')) {
      setForm(empty)
      setEditing(false)
    }
  }

  const tiles: [string, number | undefined][] = [
    ['Người chơi', stats?.players],
    ['Hoạt động hôm nay', stats?.active_today],
    ['Nhiệm vụ đã nhận', stats?.quests_claimed],
    ['Đã làm Skin Quiz', stats?.quiz_done],
    ['Tổng Beauty Points', stats?.points_total],
  ]

  return (
    <div className="container-page py-6">
      <h1 className="text-3xl md:text-4xl">Beauty Quest</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Số liệu tổng hợp, nhiệm vụ và thống kê Glow Match (ẩn danh). Nhật ký da, kết quả quiz và tự đánh giá của khách là dữ liệu riêng tư, trang quản trị không xem được.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Số liệu Beauty Quest">
        {tiles.map(([k, v]) => (
          <li key={k} className="rounded-card border border-border bg-surface p-4">
            <p className="font-display text-3xl font-semibold tabular-nums">{v ?? '—'}</p>
            <p className="text-sm text-muted">{k}</p>
          </li>
        ))}
      </ul>

      {msg && (
        <div className="mt-6">
          <Alert kind={msg.err ? 'error' : 'success'}>{msg.text}</Alert>
        </div>
      )}

      <section className="mt-8 rounded-card border border-border bg-surface p-5" aria-labelledby="bq-quests">
        <h2 id="bq-quests" className="font-display text-2xl font-semibold">
          Nhiệm vụ
        </h2>
        <p className="mt-1 text-sm text-muted">Điểm chỉ được cộng khi khách làm đúng hành động ở cột "Điều kiện"; database kiểm tra, trình duyệt không tự cộng được.</p>
        {quests == null ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Nhiệm vụ</th>
                  <th className="py-2 pr-3 font-medium">Loại</th>
                  <th className="py-2 pr-3 font-medium">Điều kiện</th>
                  <th className="py-2 pr-3 font-medium">Điểm</th>
                  <th className="py-2 pr-3 font-medium">Trạng thái</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quests.map((q) => (
                  <tr key={q.id} className={q.active ? '' : 'opacity-60'}>
                    <td className="py-2.5 pr-3">
                      <b>
                        {q.icon} {q.title}
                      </b>
                      <span className="block text-xs text-muted">
                        {q.id} · {q.description}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{KIND[q.kind]}</td>
                    <td className="py-2.5 pr-3">{REQUIRES[q.requires] ?? q.requires}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{q.points}</td>
                    <td className="py-2.5 pr-3">{q.active ? 'Bật' : 'Tắt'}</td>
                    <td className="py-2.5">
                      <span className="flex gap-2">
                        <button type="button" className={button('secondary', 'sm')} onClick={() => (setForm({ ...q, active: q.active !== false }), setEditing(true), setMsg(null))}>
                          Sửa
                        </button>
                        <button type="button" className={button('ghost', 'sm')} onClick={() => void save({ ...q, active: !q.active }, 'Đã cập nhật trạng thái nhiệm vụ.')}>
                          {q.active ? 'Tắt' : 'Bật'}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-bg p-4" aria-label={editing ? 'Sửa nhiệm vụ' : 'Thêm nhiệm vụ'}>
          <h3 className="font-semibold">{editing ? `Sửa nhiệm vụ: ${form.title}` : 'Thêm nhiệm vụ mới'}</h3>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr_6rem]">
            <TextField label="ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={editing} maxLength={40} placeholder="vd: weekend_glow" required />
            <TextField label="Tên nhiệm vụ" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} required />
            <TextField label="Biểu tượng" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} />
          </div>
          <TextField label="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} />
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField
              label="Điểm (0–100)"
              type="number"
              min={0}
              max={100}
              value={String(form.points)}
              onChange={(e) => setForm({ ...form, points: Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))) })}
            />
            <label className="block text-sm font-medium">
              Loại
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as QuestForm['kind'] })} className="mt-1.5 block h-11 w-full rounded-xl border border-border bg-surface px-3 font-normal">
                {Object.entries(KIND).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Nhóm
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as QuestForm['category'] })} className="mt-1.5 block h-11 w-full rounded-xl border border-border bg-surface px-3 font-normal">
                {Object.entries(CATEGORY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Điều kiện
              <select value={form.requires} onChange={(e) => setForm({ ...form, requires: e.target.value })} className="mt-1.5 block h-11 w-full rounded-xl border border-border bg-surface px-3 font-normal">
                {Object.entries(REQUIRES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[var(--primary)]" />
            Đang bật
          </label>
          <div className="flex gap-2">
            <button type="submit" className={button('dark')}>
              Lưu nhiệm vụ
            </button>
            {editing && (
              <button type="button" className={button('ghost')} onClick={() => (setForm(empty), setEditing(false))}>
                Hủy
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-card border border-border bg-surface p-5" aria-labelledby="bq-insights">
        <h2 id="bq-insights" className="font-display text-2xl font-semibold">
          Thống kê nhu cầu (Glow Match)
        </h2>
        <p className="mt-1 text-sm text-muted">{stats?.game_players ?? 0} người đã chơi · số liệu tổng hợp, ẩn danh</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {ROUNDS.map((r) => {
            const counts = r.options.map(([id]) => stats?.game[`${r.id}:${id}`] ?? 0)
            const mx = Math.max(1, ...counts)
            return (
              <div key={r.id}>
                <h3 className="font-semibold">{r.title}</h3>
                <ul className="mt-2 space-y-1.5">
                  {r.options.map(([id, icon, label], i) => (
                    <li key={id} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-2 text-sm">
                      <span className="truncate">
                        {icon} {label}
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((counts[i] / mx) * 100)}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{counts[i]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
