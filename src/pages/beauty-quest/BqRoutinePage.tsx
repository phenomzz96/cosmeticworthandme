/**
 * BEAUTY QUEST — Routine (/beauty-quest/routine). Chuyển từ routine.html + routine.js của bản gốc:
 * check-in routine sáng / tối mỗi ngày, chọn các bước, dùng gợi ý từ Skin Quiz.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { button, Skeleton } from '@/components/ui/primitives'
import { BqLoginPanel, useBeautyQuest } from '@/features/beauty-quest/BeautyQuestLayout'
import { STEPS, type Period } from '@/features/beauty-quest/content'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService } from '@/services/beautyQuest'

const P: Record<Period, [string, string]> = { morning: ['☀️', 'Buổi sáng'], night: ['🌙', 'Buổi tối'] }
const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

export function BqRoutinePage() {
  useDocumentTitle('Routine – Beauty Quest')
  const { status, afterClaim, toast } = useBeautyQuest()
  const [params] = useSearchParams()
  const [routine, setRoutine] = useState<{ morning: string[]; night: string[] } | null>(null)
  const [suggested, setSuggested] = useState<{ morning: string[]; night: string[] } | null>(null)
  const [doneToday, setDoneToday] = useState({ morning: false, night: false })
  const [pick, setPick] = useState<Record<Period, Set<string>>>({ morning: new Set(), night: new Set() })
  const [ticks, setTicks] = useState<Record<Period, Set<string>>>({ morning: new Set(), night: new Set() })
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)

  const load = useCallback(async (applySuggested: boolean) => {
    const [r, q, ev] = await Promise.all([beautyQuestService.routine(), beautyQuestService.quizResult(), beautyQuestService.myEvents()])
    const today = vnToday()
    setRoutine(r)
    setSuggested(q?.result.suggested ?? null)
    setDoneToday({
      morning: ev.some((e) => e.type === 'routine_morning' && e.day === today),
      night: ev.some((e) => e.type === 'routine_night' && e.day === today),
    })
    const base = applySuggested && q ? q.result.suggested : r
    setPick({ morning: new Set(base.morning), night: new Set(base.night) })
    if (applySuggested && q) setMsg({ text: 'Đã điền gợi ý từ Skin Quiz. Chỉnh theo ý bạn rồi nhấn “Lưu routine”.' })
  }, [])

  useEffect(() => {
    if (status !== 'ready') return
    load(params.get('use') === 'suggested').catch((err) => setMsg({ text: friendlyError(err), err: true }))
    // chỉ tải khi vào trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const hasSaved = useMemo(() => !!routine && routine.morning.length + routine.night.length > 0, [routine])

  if (status === 'guest' || status === 'off')
    return (
      <Shell>
        <BqLoginPanel title="Đăng nhập để xây routine">Routine và check-in hằng ngày được lưu trong tài khoản của bạn.</BqLoginPanel>
      </Shell>
    )
  if (!routine) return <Shell>{status === 'error' ? null : <Skeleton className="h-64 w-full" />}</Shell>

  const toggle = (which: 'pick' | 'tick', p: Period, id: string, on: boolean) => {
    const set = (which === 'pick' ? pick : ticks)[p]
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    if (which === 'pick') setPick({ ...pick, [p]: next })
    else setTicks({ ...ticks, [p]: next })
  }

  const save = async () => {
    setMsg(null)
    try {
      const r = await beautyQuestService.saveRoutine([...pick.morning], [...pick.night])
      toast('Đã lưu routine của bạn 🧴')
      setTicks({ morning: new Set(), night: new Set() })
      await load(false)
      setPick({ morning: new Set(r.routine.morning), night: new Set(r.routine.night) })
      setMsg(null)
      await afterClaim(r.claim)
    } catch (err) {
      setMsg({ text: friendlyError(err), err: true })
    }
  }

  const checkin = async (p: Period) => {
    try {
      const r = await beautyQuestService.checkin(p)
      setDoneToday({ ...doneToday, [p]: true })
      await afterClaim(r.claim)
    } catch (err) {
      setMsg({ text: friendlyError(err), err: true })
    }
  }

  return (
    <Shell>
      <section aria-labelledby="rt-checkin">
        <h3 id="rt-checkin" className="text-xl font-semibold">
          Check-in hôm nay
        </h3>
        {!hasSaved ? (
          <p className="mt-2 rounded-card border border-border bg-surface p-4 text-sm text-muted">Lưu routine bên dưới để bắt đầu check-in mỗi ngày nhé.</p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {(['morning', 'night'] as const)
              .filter((p) => routine[p].length)
              .map((p) => (
                <div key={p} className="rounded-card border border-border bg-surface p-4">
                  <h4 className="flex flex-wrap items-center gap-2 font-semibold">
                    {P[p][0]} {P[p][1]}
                    {doneToday[p] && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Đã hoàn thành ✓</span>}
                  </h4>
                  {doneToday[p] ? (
                    <p className="mt-2 text-sm text-muted">Hôm nay bạn đã làm rất tốt rồi 🌸</p>
                  ) : (
                    <>
                      <ul className="mt-2 space-y-1.5">
                        {routine[p].map((id) => (
                          <li key={id}>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={ticks[p].has(id)} onChange={(e) => toggle('tick', p, id, e.target.checked)} className="size-4 accent-[var(--primary)]" />
                              {STEPS[p].find((s) => s.id === id)?.label}
                            </label>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className={`${button('dark', 'sm')} mt-3`} disabled={!ticks[p].size} onClick={() => void checkin(p)}>
                        Hoàn thành routine {p === 'morning' ? 'sáng' : 'tối'}
                      </button>
                    </>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>

      <section aria-labelledby="rt-edit" className="mt-8">
        <h3 id="rt-edit" className="text-xl font-semibold">
          Chọn các bước của bạn
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {(['morning', 'night'] as const).map((p) => (
            <div key={p} className="rounded-card border border-border bg-surface p-4">
              <h4 className="font-semibold">
                {P[p][0]} {P[p][1]}
              </h4>
              <ul className="mt-2 space-y-2">
                {STEPS[p].map((s) => (
                  <li key={s.id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={pick[p].has(s.id)} onChange={(e) => toggle('pick', p, s.id, e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
                      <span>
                        <b className="block">{s.label}</b>
                        <span className="text-muted">{s.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {msg && (
          <p className={`mt-3 text-sm ${msg.err ? 'text-danger' : 'text-muted'}`} role={msg.err ? 'alert' : 'status'}>
            {msg.text}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={button('dark')} onClick={() => void save()}>
            Lưu routine
          </button>
          {suggested ? (
            <button
              type="button"
              className={button('secondary')}
              onClick={() => {
                setPick({ morning: new Set(suggested.morning), night: new Set(suggested.night) })
                setMsg({ text: 'Đã điền gợi ý. Nhấn “Lưu routine” để lưu.' })
              }}
            >
              Dùng gợi ý từ Skin Quiz
            </button>
          ) : (
            <Link to="/beauty-quest/quiz" className={button('secondary')}>
              Làm Skin Quiz để nhận gợi ý
            </Link>
          )}
        </div>
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div>
      <h2 className="section-title">Routine của bạn</h2>
      <p className="mt-1 text-muted">Chọn các bước sáng / tối và check-in mỗi ngày để nhận điểm.</p>
      <div className="mt-5">{children}</div>
    </div>
  )
}
