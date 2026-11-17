/**
 * BEAUTY QUEST — Skin Roadmap (/beauty-quest/roadmap). Chuyển từ skin-roadmap.html + roadmap.js của bản gốc:
 * 4 giai đoạn theo Beauty Points và các việc nhỏ nên làm tiếp.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { button } from '@/components/ui/primitives'
import { levelInfo, useBeautyQuest } from '@/features/beauty-quest/BeautyQuestLayout'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService, type BqQuest } from '@/services/beautyQuest'
import { GO, roadmapOf } from './BqHomePage'

export function BqRoadmapPage() {
  useDocumentTitle('Skin Roadmap – Beauty Quest')
  const { state, status, loginHref } = useBeautyQuest()
  const [publicQuests, setPublicQuests] = useState<BqQuest[]>([])
  useEffect(() => {
    if (beautyQuestService.enabled && !state) beautyQuestService.publicQuests().then(setPublicQuests).catch(() => undefined)
  }, [state])

  const quests = state?.quests ?? publicQuests
  const points = state?.points ?? 0
  const road = roadmapOf(points, quests)
  const cur = road.findIndex((m) => m.percent < 100)
  const todo = quests.filter((q) => !q.done).slice(0, 5)
  const lv = levelInfo(points, state?.level ?? 0)

  return (
    <div>
      <h2 className="section-title">Skin Roadmap</h2>
      <p className="mt-1 text-muted">Lộ trình nhỏ gồm bốn giai đoạn. Bạn tiến bộ theo nhịp của riêng mình, không có hạn chót.</p>

      <div className="mt-5 flex items-center gap-3 rounded-card border border-border bg-surface p-4">
        <span className="grid size-12 place-items-center rounded-full bg-blush text-2xl" aria-hidden="true">
          🌸
        </span>
        <div>
          <p className="text-sm text-muted">{lv.name}</p>
          <p className="font-display text-2xl font-semibold">{points} Beauty Points</p>
          {status !== 'ready' && <p className="mt-1 text-sm text-muted">Đăng nhập để lộ trình cập nhật theo tiến trình của bạn.</p>}
        </div>
      </div>

      <h3 className="mt-8 text-xl font-semibold">Các giai đoạn</h3>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {road.map((m, i) => (
          <li key={m.title} className={`rounded-card border bg-surface p-4 ${i === cur ? 'border-primary' : 'border-border'}`}>
            <p className="text-xs text-muted">
              Giai đoạn {i + 1}
              {i === cur ? ' · bạn đang ở đây 📍' : m.percent >= 100 ? ' · hoàn thành ✓' : ''}
            </p>
            <p className="mt-1 font-semibold">{m.title}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={m.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.percent}>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${m.percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {m.percent}% · {m.quests.join(', ') || 'đang cập nhật'}
            </p>
          </li>
        ))}
      </ol>

      {todo.length > 0 && (
        <>
          <h3 className="mt-8 text-xl font-semibold">Việc nhỏ nên làm tiếp</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todo.map((q) => (
              <li key={q.id} className="flex flex-col rounded-card border border-border bg-surface p-4">
                <div className="flex gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-xl" aria-hidden="true">
                    {q.icon}
                  </span>
                  <div>
                    <p className="font-semibold">{q.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{q.description}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">+{q.points} điểm</span>
                  <Link to={status === 'ready' ? GO[q.requires] || '/beauty-quest' : loginHref} className={button('dark', 'sm')}>
                    Thực hiện
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-sm text-muted">Roadmap tính theo điểm Beauty Points, không phải đánh giá tình trạng da của bạn.</p>
    </div>
  )
}
