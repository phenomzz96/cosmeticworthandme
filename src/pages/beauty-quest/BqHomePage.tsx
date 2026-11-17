/**
 * BEAUTY QUEST — Tổng quan (/beauty-quest). Chuyển từ trang chính của bản Beauty Quest gốc (index.html + home.js):
 * cấp độ, chuỗi ngày, nhiệm vụ hằng ngày / đặc biệt, thành tích, Skin Roadmap, Glow Match, nhật ký da, lịch sử.
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { button, Skeleton } from '@/components/ui/primitives'
import { useBeautyQuest, levelInfo, BqLoginPanel } from '@/features/beauty-quest/BeautyQuestLayout'
import { MOODS, ROADMAP, ROUNDS } from '@/features/beauty-quest/content'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService, type BqAchievement, type BqQuest, type DiaryEntry } from '@/services/beautyQuest'

export const GO: Record<string, string> = {
  quiz: '/beauty-quest/quiz',
  routine_saved: '/beauty-quest/routine',
  routine_morning: '/beauty-quest/routine',
  routine_night: '/beauty-quest/routine',
  article_read: '/beauty-quest/learn',
  reflection: '/beauty-quest/reflect',
  diary: '/beauty-quest#nhat-ky',
  glow_match: '/beauty-quest#glow-match',
}

const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const skipped = (id: string) => {
  try {
    return localStorage.getItem('bq-skip-' + id) === vnToday()
  } catch {
    return false
  }
}
const setSkip = (id: string, on: boolean) => {
  try {
    if (on) localStorage.setItem('bq-skip-' + id, vnToday())
    else localStorage.removeItem('bq-skip-' + id)
  } catch {
    /* bỏ qua */
  }
}

/** Phần trăm hoàn thành từng giai đoạn của Skin Roadmap (theo điểm, giống bản gốc) */
export function roadmapOf(points: number, quests: BqQuest[]) {
  return ROADMAP.map(([title, lo, hi, cats]) => ({
    title,
    percent: Math.max(0, Math.min(100, Math.round(((points - lo) / (hi - lo)) * 100))),
    quests: quests.filter((q) => cats.includes(q.category)).map((q) => q.title),
  }))
}

export function BqHomePage() {
  useDocumentTitle('Beauty Quest')
  const { state, status } = useBeautyQuest()
  const [publicQuests, setPublicQuests] = useState<BqQuest[] | null>(null)
  const [achievements, setAchievements] = useState<BqAchievement[]>([])
  const [ver, setVer] = useState(0)
  const { hash } = useLocation()

  // Nút "Thực hiện" của nhiệm vụ nhật ký / Glow Match dẫn tới #nhat-ky, #glow-match: cuộn tới phần đó khi đã vẽ xong
  useEffect(() => {
    if (!hash || status === 'loading') return
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 50)
    return () => window.clearTimeout(t)
  }, [hash, status])

  useEffect(() => {
    if (!beautyQuestService.enabled) return setPublicQuests([])
    beautyQuestService.achievements().then(setAchievements).catch(() => undefined)
    beautyQuestService
      .publicQuests()
      .then(setPublicQuests)
      .catch(() => setPublicQuests([]))
  }, [])

  const quests = state?.quests ?? publicQuests
  const points = state?.points ?? 0
  const lv = levelInfo(points, state?.level ?? 0)
  const quizDone = !!state?.quests.some((q) => q.id === 'first_glow' && q.done)

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]" aria-labelledby="bq-welcome">
        <div>
          <h2 id="bq-welcome" className="font-display text-3xl font-semibold leading-tight md:text-4xl">
            Welcome to Beauty Quest
          </h2>
          <p className="mt-2 max-w-xl text-muted">Mỗi bước chăm da là một bước tiến gần hơn đến phiên bản tốt nhất của bạn.</p>
          <Link to="/beauty-quest/quiz" className={`${button('dark', 'lg')} mt-5`}>
            {quizDone ? 'Xem lại Skin Quiz của bạn' : 'Bắt đầu với Skin Quiz'}
          </Link>
        </div>
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-blush text-2xl" aria-hidden="true">
              🌸
            </span>
            <div>
              <p className="text-sm text-muted">{status === 'guest' || status === 'off' ? 'Đăng nhập để bắt đầu' : lv.name}</p>
              <p className="font-display text-2xl font-semibold">
                <span className="tabular-nums">{points}</span> Beauty Points
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Tiến độ lên cấp" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lv.percent}>
            <span className="block h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${lv.percent}%` }} />
          </div>
          {state && (
            <>
              <p className="mt-2 text-sm text-muted">{lv.next ? `Còn ${lv.next[0] - points} điểm để lên ${lv.next[1]}` : 'Bạn đã đạt cấp cao nhất. Cảm ơn bạn đã đồng hành!'}</p>
              <p className="mt-2 text-sm">
                {state.streak.current > 0
                  ? `🌱 Chuỗi ${state.streak.current} ngày · dài nhất ${state.streak.best} ngày. Nghỉ một ngày cũng không sao, chuỗi của bạn vẫn được giữ.`
                  : state.streak.best > 0
                    ? `Hôm nay là một khởi đầu nhẹ nhàng mới 🌷 (chuỗi dài nhất của bạn: ${state.streak.best} ngày)`
                    : 'Hoàn thành một việc nhỏ để bắt đầu chuỗi ngày nhé 🌱'}
              </p>
            </>
          )}
        </div>
      </section>

      <QuestSection title="Nhiệm vụ hằng ngày" quests={quests?.filter((q) => q.kind !== 'once')} />
      <QuestSection title="Nhiệm vụ đặc biệt" quests={quests?.filter((q) => q.kind === 'once')} />

      <section aria-labelledby="bq-ach">
        <h2 id="bq-ach" className="section-title">
          Thành tích
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {achievements.map((a) => {
            const on = !!state?.achievements.includes(a.id)
            return (
              <li key={a.id} className={`rounded-card border border-border bg-surface p-4 text-center ${on ? '' : 'opacity-60'}`}>
                <span className={`text-3xl ${on ? '' : 'grayscale'}`} aria-hidden="true">
                  {a.icon}
                </span>
                <p className="mt-1 font-semibold">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted">{a.description}</p>
                <p className="mt-2 text-xs font-semibold">{on ? 'Đã mở khóa' : 'Chưa mở khóa'}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="bq-road">
        <h2 id="bq-road" className="section-title">
          Skin Roadmap
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roadmapOf(points, quests ?? []).map((m) => (
            <li key={m.title} className="rounded-card border border-border bg-surface p-4">
              <p className="font-semibold">{m.title}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={m.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.percent}>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${m.percent}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {m.percent}% · Nhiệm vụ: {m.quests.join(', ') || 'đang cập nhật'}
              </p>
            </li>
          ))}
        </ul>
        <Link to="/beauty-quest/roadmap" className={`${button('secondary', 'sm')} mt-4`}>
          Mở Skin Roadmap
        </Link>
      </section>

      {/* Đổi key sau khi xóa dữ liệu để các phần bên dưới tải lại từ đầu */}
      <Fragment key={ver}>
        <GlowMatch />
        <SkinDiary />
        <History />
      </Fragment>
      <MyData onWiped={() => setVer((v) => v + 1)} />
    </div>
  )
}

function QuestSection({ title, quests }: { title: string; quests: BqQuest[] | null | undefined }) {
  const { status, loginHref, afterClaim, toast, refresh } = useBeautyQuest()
  const [, force] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const claim = async (q: BqQuest) => {
    setBusy(q.id)
    try {
      const r = await beautyQuestService.claim(q.id)
      await afterClaim({ claimed: [{ id: q.id, title: q.title, earned: r.earned }], level_up: r.level_up, new_achievements: r.new_achievements, points: r.points, level: r.level })
    } catch (err) {
      toast((err as { code?: string }).code === '23505' ? 'Bạn đã nhận nhiệm vụ này rồi, hẹn bạn lần sau nhé 🌷' : friendlyError(err))
      void refresh()
    } finally {
      setBusy(null)
    }
  }

  const id = title === 'Nhiệm vụ hằng ngày' ? 'bq-daily' : 'bq-special'
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {quests == null ? (
        <Skeleton className="mt-4 h-36 w-full" />
      ) : quests.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Chưa có nhiệm vụ nào.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quests.map((q) => {
            const sk = !q.done && q.kind !== 'once' && skipped(q.id)
            const tag = `+${q.points} điểm${q.kind === 'daily' ? ' / ngày' : q.kind === 'weekly' ? ' / tuần' : ''}`
            return (
              <li key={q.id} className={`flex flex-col rounded-card border border-border bg-surface p-4 ${q.done ? 'opacity-70' : ''}`}>
                <div className="flex gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-xl" aria-hidden="true">
                    {q.icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{q.title}</h3>
                    <p className="mt-0.5 text-sm text-muted">{q.description}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">{tag}</span>
                  <span className="flex flex-wrap gap-2">
                    {q.done ? (
                      <button type="button" className={button('secondary', 'sm')} disabled>
                        Đã hoàn thành ✓
                      </button>
                    ) : sk ? (
                      <button type="button" className={button('ghost', 'sm')} onClick={() => (setSkip(q.id, false), force((n) => n + 1))}>
                        Hiện lại
                      </button>
                    ) : (
                      <>
                        {q.kind !== 'once' && status === 'ready' && (
                          <button type="button" className={button('ghost', 'sm')} onClick={() => (setSkip(q.id, true), force((n) => n + 1))}>
                            Để sau
                          </button>
                        )}
                        {q.ready ? (
                          <button type="button" className={button('dark', 'sm')} disabled={busy === q.id} onClick={() => void claim(q)}>
                            Nhận điểm
                          </button>
                        ) : (
                          <Link to={status === 'guest' ? loginHref : GO[q.requires] || '/beauty-quest'} className={button('dark', 'sm')}>
                            Thực hiện
                          </Link>
                        )}
                      </>
                    )}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------- Glow Match ----------
function GlowMatch() {
  const { status, afterClaim, toast } = useBeautyQuest()
  const [answers, setAnswers] = useState<Record<string, string> | null>(null)
  const load = useCallback(() => beautyQuestService.gameAnswers().then(setAnswers).catch(() => setAnswers({})), [])
  useEffect(() => {
    if (status === 'ready') void load()
  }, [status, load])

  const pick = async (round: string, choice: string) => {
    try {
      const r = await beautyQuestService.answerGame(round, choice)
      await load()
      if (r.complete) await afterClaim(r.claim)
    } catch (err) {
      toast(friendlyError(err))
    }
  }
  const reset = async () => {
    await beautyQuestService.resetGame()
    await load()
  }

  const done = answers ? ROUNDS.filter((r) => answers[r.id]).length : 0
  const next = answers ? ROUNDS.find((r) => !answers[r.id]) : undefined

  return (
    <section id="glow-match" className="scroll-mt-40" aria-labelledby="bq-game">
      <h2 id="bq-game" className="section-title">
        Glow Match 🎯
      </h2>
      <div className="mt-4">
        {status !== 'ready' ? (
          <BqLoginPanel title="Đăng nhập để chơi mini game nhé.">6 câu chọn điều bạn thích, không có đáp án đúng hay sai. Hoàn thành được +15 điểm.</BqLoginPanel>
        ) : !answers ? (
          <Skeleton className="h-40 w-full" />
        ) : next ? (
          <div className="rounded-card border border-border bg-surface p-5">
            <p className="text-sm text-muted">
              Câu {done + 1}/{ROUNDS.length} · không có đáp án đúng hay sai, chọn điều bạn thích nhé
            </p>
            <h3 className="mt-1.5 text-lg font-semibold">{next.title}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {next.options.map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void pick(next.id, id)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-bg px-3 py-4 text-sm font-medium hover:border-primary hover:bg-primary-soft"
                >
                  <span className="text-3xl" aria-hidden="true">
                    {icon}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface p-5">
            <h3 className="text-lg font-semibold">Hồ sơ yêu thích của bạn 💗</h3>
            <p className="mt-1 text-sm text-muted">Câu trả lời giúp Worth & Me gợi ý nội dung phù hợp hơn. Bạn có thể xóa bất cứ lúc nào.</p>
            <ul className="mt-3 divide-y divide-border text-sm">
              {ROUNDS.map((r) => {
                const o = r.options.find((x) => x[0] === answers[r.id])
                return (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-muted">{r.title}</span>
                    <b>{o ? `${o[1]} ${o[2]}` : ''}</b>
                  </li>
                )
              })}
            </ul>
            <button type="button" className={`${button('ghost', 'sm')} mt-3`} onClick={() => void reset()}>
              Chơi lại và xóa câu trả lời
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- Nhật ký da ----------
/** Nén ảnh còn tối đa 640px, JPEG chất lượng 0.7 (giống bản gốc) */
function compress(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const k = Math.min(1, 640 / Math.max(im.width, im.height))
      const c = document.createElement('canvas')
      c.width = Math.round(im.width * k)
      c.height = Math.round(im.height * k)
      c.getContext('2d')?.drawImage(im, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => resolve(b), 'image/jpeg', 0.7)
    }
    im.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    im.src = url
  })
}

function SkinDiary() {
  const { status, userId, afterClaim, toast, refresh } = useBeautyQuest()
  const [items, setItems] = useState<DiaryEntry[] | null>(null)
  const [mood, setMood] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState<Record<string, string>>({})

  const load = useCallback(() => beautyQuestService.diary().then(setItems).catch(() => setItems([])), [])
  useEffect(() => {
    if (status === 'ready') void load()
  }, [status, load])

  const save = async () => {
    if (!mood) return setMsg({ text: 'Hãy chọn tình trạng da hôm nay nhé.', err: true })
    setBusy(true)
    setMsg(null)
    let path: string | null = null
    try {
      if (file && userId) {
        setMsg({ text: 'Đang xử lý ảnh…' })
        const blob = await compress(file)
        if (!blob) {
          setBusy(false)
          return setMsg({ text: 'Không đọc được ảnh này.', err: true })
        }
        path = await beautyQuestService.uploadDiaryPhoto(userId, blob)
      }
      const r = await beautyQuestService.saveDiary(mood, note, path, false)
      await beautyQuestService.removePhotos([r.removed_photo]).catch(() => undefined)
      toast('Đã lưu nhật ký da của bạn 🌸')
      setMood('')
      setNote('')
      setFile(null)
      setMsg(null)
      await load()
      await afterClaim(r.claim)
    } catch (err) {
      if (path) await beautyQuestService.removePhotos([path]).catch(() => undefined)
      setMsg({ text: friendlyError(err), err: true })
    } finally {
      setBusy(false)
    }
  }

  const showPhoto = async (e: DiaryEntry) => {
    if (photos[e.day]) return setPhotos(({ [e.day]: _drop, ...rest }) => rest)
    if (!e.photo_path) return
    const url = await beautyQuestService.photoUrl(e.photo_path)
    if (url) setPhotos((p) => ({ ...p, [e.day]: url }))
  }

  const remove = async (e: DiaryEntry) => {
    if (!window.confirm('Xóa mục nhật ký này?')) return
    try {
      const path = await beautyQuestService.deleteDiary(e.day)
      await beautyQuestService.removePhotos([path]).catch(() => undefined)
      toast('Đã xóa mục nhật ký.')
      await load()
      await refresh()
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  return (
    <section id="nhat-ky" className="scroll-mt-40" aria-labelledby="bq-diary">
      <h2 id="bq-diary" className="section-title">
        Nhật ký da 📔
      </h2>
      <div className="mt-4">
        {status !== 'ready' ? (
          <BqLoginPanel title="Đăng nhập để ghi nhật ký da của bạn.">Ghi chú và ảnh chỉ mình bạn xem được.</BqLoginPanel>
        ) : (
          <div className="rounded-card border border-border bg-surface p-5">
            <p className="text-sm text-muted">Hôm nay làn da bạn thế nào? Đây là ghi chú tự theo dõi, không phải chẩn đoán.</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tình trạng da hôm nay">
              {Object.entries(MOODS).map(([k, [icon, label]]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={mood === k}
                  onClick={() => setMood(k)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm ${mood === k ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-bg hover:border-primary'}`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ghi chú ngắn (không bắt buộc)"
              aria-label="Ghi chú"
              className="mt-3 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted">
                Ảnh (tùy chọn, chỉ bạn xem được):{' '}
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-full text-sm" />
              </label>
              <button type="button" className={button('dark', 'sm')} onClick={() => void save()} disabled={busy}>
                Lưu nhật ký
              </button>
            </div>
            {msg && (
              <p className={`mt-2 text-sm ${msg.err ? 'text-danger' : 'text-muted'}`} role={msg.err ? 'alert' : 'status'}>
                {msg.text}
              </p>
            )}
            <ul className="mt-4 divide-y divide-border" aria-label="Các mục nhật ký">
              {items == null ? (
                <li>
                  <Skeleton className="h-16 w-full" />
                </li>
              ) : items.length === 0 ? (
                <li className="py-3 text-sm text-muted">Chưa có mục nào. Ghi một dòng nhỏ hôm nay nhé 🌷</li>
              ) : (
                items.map((e) => {
                  const m = MOODS[e.mood] ?? ['', '']
                  return (
                    <li key={e.day} className="py-3 text-sm">
                      <p>
                        <b>{e.day.split('-').reverse().join('/')}</b> · {m[0]} {m[1]}
                      </p>
                      {e.note && <p className="mt-0.5">{e.note}</p>}
                      <p className="mt-1 flex flex-wrap gap-2">
                        {e.photo_path && (
                          <button type="button" className={button('ghost', 'sm')} onClick={() => void showPhoto(e)}>
                            {photos[e.day] ? 'Ẩn ảnh' : 'Xem ảnh'}
                          </button>
                        )}
                        <button type="button" className={button('ghost', 'sm')} onClick={() => void remove(e)}>
                          Xóa
                        </button>
                      </p>
                      {photos[e.day] && <img src={photos[e.day]} alt="Ảnh nhật ký da" className="mt-2 max-h-72 rounded-xl" />}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- Lịch sử nhiệm vụ ----------
function History() {
  const { status, state } = useBeautyQuest()
  const [kind, setKind] = useState('')
  const [day, setDay] = useState('')
  const [items, setItems] = useState<{ completed_at: string; points: number; title: string }[] | null>(null)

  useEffect(() => {
    if (status !== 'ready') return
    beautyQuestService
      .history(kind || null, day || null)
      .then(setItems)
      .catch(() => setItems([]))
  }, [status, kind, day, state?.total_done])

  return (
    <section aria-labelledby="bq-hist">
      <h2 id="bq-hist" className="section-title">
        Lịch sử nhiệm vụ
      </h2>
      {status !== 'ready' ? (
        <p className="mt-3 text-sm text-muted">Đăng nhập để xem lịch sử nhiệm vụ của bạn.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Lọc theo loại" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="">Tất cả loại</option>
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Hằng tuần</option>
              <option value="once">Một lần</option>
            </select>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Lọc theo ngày" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm" />
            <button type="button" className={button('ghost', 'sm')} onClick={() => (setKind(''), setDay(''))}>
              Xóa bộ lọc
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">Tổng số nhiệm vụ đã hoàn thành: {state?.total_done ?? 0}</p>
          <ul className="mt-2 divide-y divide-border rounded-card border border-border bg-surface" aria-label="Lịch sử nhiệm vụ">
            {items == null ? (
              <li className="p-4">
                <Skeleton className="h-10 w-full" />
              </li>
            ) : items.length === 0 ? (
              <li className="p-4 text-sm text-muted">{kind || day ? 'Không có nhiệm vụ nào khớp bộ lọc.' : 'Chưa có nhiệm vụ nào. Bắt đầu với một việc nhỏ hôm nay nhé.'}</li>
            ) : (
              items.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <b className="block">{x.title}</b>
                    <span className="text-xs text-muted">{new Date(x.completed_at).toLocaleString('vi-VN')}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">+{x.points}</span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </section>
  )
}

// ---------- Dữ liệu của tôi (tải về / xóa) ----------
function MyData({ onWiped }: { onWiped: () => void }) {
  const { status, refresh, toast } = useBeautyQuest()
  const [busy, setBusy] = useState(false)
  if (status !== 'ready') return null
  const download = async () => {
    setBusy(true)
    try {
      const data = await beautyQuestService.exportMine()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      a.download = 'beauty-quest-data.json'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      toast(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  const wipe = async () => {
    if (!window.confirm('Xóa toàn bộ dữ liệu Beauty Quest của bạn (điểm, nhiệm vụ, nhật ký, kết quả quiz...)? Không thể hoàn tác.')) return
    setBusy(true)
    try {
      await beautyQuestService.deleteMine()
      toast('Đã xóa dữ liệu Beauty Quest của bạn.')
      await refresh()
      onWiped()
    } catch (err) {
      toast(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="bq-data" className="rounded-card border border-border bg-surface p-5">
      <h2 id="bq-data" className="font-semibold">
        Dữ liệu Beauty Quest của tôi
      </h2>
      <p className="mt-1 text-sm text-muted">Nhật ký da, kết quả quiz và tự đánh giá chỉ mình bạn xem được (quản trị viên cũng không xem). Bạn có thể tải về hoặc xóa bất cứ lúc nào.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={button('secondary', 'sm')} onClick={() => void download()} disabled={busy}>
          Tải dữ liệu (JSON)
        </button>
        <button type="button" className={button('ghost', 'sm')} onClick={() => void wipe()} disabled={busy}>
          Xóa dữ liệu Beauty Quest
        </button>
      </div>
    </section>
  )
}
