/**
 * BEAUTY QUEST — Skin Quiz (/beauty-quest/quiz). Chuyển từ quiz.html + quiz.js của bản gốc.
 * Database kiểm tra câu trả lời và tính kết quả (bq_submit_quiz), rồi tự nhận điểm First Glow.
 * Thêm so với bản gốc: nút tìm sản phẩm của sàn theo kết quả (Beauty Finder).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { button, Skeleton } from '@/components/ui/primitives'
import { BqLoginPanel, useBeautyQuest } from '@/features/beauty-quest/BeautyQuestLayout'
import { CONCERN_TIPS, QUIZ, QUIZ_NOTE, SKIN_TYPES, STEPS, type Period } from '@/features/beauty-quest/content'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService, type QuizResult } from '@/services/beautyQuest'

/** Mối quan tâm của Skin Quiz → mối quan tâm của Beauty Finder */
const FINDER_CONCERN: Record<string, string> = { acne: 'acne', spots: 'dark-spots', hydrate: 'dehydration', pores: 'pores', calm: 'redness', dull: 'dullness' }

export function finderLink(r: QuizResult) {
  const p = new URLSearchParams({ focus: 'skincare', skin: r.sensitive ? 'sensitive' : r.skin_type, done: '1' })
  const c = r.concerns.map((x) => FINDER_CONCERN[x]).filter(Boolean)
  if (c.length) p.set('concerns', c.join(','))
  return `/beauty-finder?${p.toString()}`
}

const stepLabel = (period: Period, id: string) => STEPS[period].find((s) => s.id === id)?.label ?? id

export function BqQuizPage() {
  useDocumentTitle('Skin Quiz – Beauty Quest')
  const { status, afterClaim, toast } = useBeautyQuest()
  const [saved, setSaved] = useState<QuizResult | null | undefined>(undefined)
  const [view, setView] = useState<'intro' | 'quiz' | 'result'>('intro')
  const [idx, setIdx] = useState(0)
  const [ans, setAns] = useState<Record<string, string | string[]>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState(false)

  useEffect(() => {
    if (status !== 'ready') return
    beautyQuestService
      .quizResult()
      .then((r) => {
        setSaved(r?.result ?? null)
        setView(r ? 'result' : 'intro')
      })
      .catch(() => setSaved(null))
  }, [status])

  if (status === 'guest' || status === 'off')
    return (
      <Shell>
        <BqLoginPanel title="Đăng nhập để làm Skin Quiz">Để lưu kết quả và nhận điểm, bạn cần có tài khoản. Chỉ mất vài giây.</BqLoginPanel>
      </Shell>
    )
  if (saved === undefined) return <Shell>{status === 'error' ? null : <Skeleton className="h-64 w-full" />}</Shell>

  const start = () => {
    setIdx(0)
    setAns({})
    setMsg(null)
    setView('quiz')
  }

  const submit = async () => {
    setBusy(true)
    try {
      const r = await beautyQuestService.submitQuiz(ans)
      setSaved(r.result)
      setFresh(true)
      setView('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await afterClaim(r.claim)
    } catch (err) {
      setMsg(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!window.confirm('Xóa kết quả Skin Quiz của bạn? Điểm đã nhận vẫn được giữ.')) return
    await beautyQuestService.deleteQuiz()
    toast('Đã xóa kết quả Skin Quiz.')
    setSaved(null)
    setView('intro')
  }

  if (view === 'intro')
    return (
      <Shell>
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold">Sẵn sàng chưa? ✨</h2>
          <p className="mt-1 text-sm text-muted">Mất khoảng 1 phút. Câu trả lời của bạn chỉ dùng để gợi ý cho chính bạn.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={button('dark')} onClick={start}>
              Bắt đầu
            </button>
            {saved && (
              <button type="button" className={button('ghost')} onClick={() => setView('result')}>
                Quay lại kết quả
              </button>
            )}
          </div>
        </div>
      </Shell>
    )

  if (view === 'quiz') {
    const q = QUIZ[idx]
    const multi = q.type === 'multi'
    const cur = ans[q.id]
    const sel = multi ? ((cur as string[]) ?? []) : cur ? [cur as string] : []
    const last = idx === QUIZ.length - 1
    const choose = (id: string) => {
      setMsg(null)
      if (!multi) return setAns({ ...ans, [q.id]: id })
      const set = new Set(sel)
      if (set.has(id)) set.delete(id)
      else if (set.size >= (q.max ?? 1)) return setMsg(`Chọn tối đa ${q.max} mục nhé.`)
      else set.add(id)
      setAns({ ...ans, [q.id]: [...set] })
    }
    return (
      <Shell>
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="text-sm text-muted">
            Câu {idx + 1}/{QUIZ.length}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={QUIZ.length} aria-valuenow={idx + 1}>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${((idx + 1) / QUIZ.length) * 100}%` }} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{q.title}</h2>
          <div className="mt-3 grid gap-2">
            {q.options.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={sel.includes(id)}
                onClick={() => choose(id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm ${sel.includes(id) ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-border bg-bg hover:border-primary'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {msg && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {msg}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {idx > 0 && (
              <button type="button" className={button('ghost')} onClick={() => setIdx(idx - 1)}>
                Quay lại
              </button>
            )}
            <button type="button" className={button('dark')} disabled={!sel.length || busy} onClick={() => (last ? void submit() : setIdx(idx + 1))}>
              {last ? 'Xem kết quả' : 'Tiếp tục'}
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  const r = saved!
  const t = SKIN_TYPES[r.skin_type]
  const tips = [
    ...t.tips,
    ...(r.sensitive ? ['Da bạn có thể dễ phản ứng: thử sản phẩm mới từng cái một và ưu tiên công thức đơn giản.'] : []),
    ...(!r.sun_daily ? ['Bắt đầu bằng thói quen chống nắng buổi sáng: một bước nhỏ nhưng hữu ích.'] : []),
  ]
  return (
    <Shell>
      <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <p className="text-sm text-muted">{fresh ? 'Kết quả của bạn' : 'Kết quả đã lưu'}</p>
        <h2 className="mt-1 font-display text-3xl font-semibold">
          {t.label}
          {r.sensitive ? ' · dễ phản ứng' : ''} 🌸
        </h2>
        <p className="mt-2">{t.summary}</p>
        <h3 className="mt-5 font-semibold">Gợi ý cho bạn</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {tips.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {r.concerns.length > 0 && (
          <>
            <h3 className="mt-5 font-semibold">Điều bạn quan tâm</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {r.concerns.map((c) => (
                <li key={c}>
                  <b>{CONCERN_TIPS[c]?.[0]}:</b> {CONCERN_TIPS[c]?.[1]}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3 className="mt-5 font-semibold">Routine gợi ý để bắt đầu</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {(['morning', 'night'] as const).map((p) =>
            r.suggested[p].length ? (
              <div key={p}>
                <p className="font-medium">{p === 'morning' ? '☀️ Buổi sáng' : '🌙 Buổi tối'}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {r.suggested[p].map((id) => (
                    <li key={id}>{stepLabel(p, id)}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
        <p className="mt-2 text-sm text-muted">Bạn có thể thêm bớt thoải mái ở bước tiếp theo.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/beauty-quest/routine?use=suggested" className={button('dark')}>
            Dùng làm routine của mình
          </Link>
          <Link to={finderLink(r)} className={button('secondary')}>
            Tìm sản phẩm hợp với kết quả
          </Link>
          <Link to="/beauty-quest/learn" className={button('ghost')}>
            Đọc thêm hướng dẫn
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">{QUIZ_NOTE}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={button('ghost', 'sm')} onClick={start}>
            Làm lại quiz
          </button>
          <button type="button" className={button('ghost', 'sm')} onClick={() => void del()}>
            Xóa kết quả của tôi
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h2 className="section-title">Skin Quiz</h2>
      <p className="mt-1 text-muted">6 câu hỏi ngắn để hiểu làn da và nhận routine gợi ý.</p>
      <div className="mt-5">{children}</div>
    </div>
  )
}
