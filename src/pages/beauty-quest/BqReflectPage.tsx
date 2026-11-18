/**
 * BEAUTY QUEST — Tự đánh giá tuần (/beauty-quest/reflect). Chuyển từ reflect.html + reflect.js của bản gốc.
 */
import { useCallback, useEffect, useState } from 'react'
import { button, Skeleton } from '@/components/ui/primitives'
import { BqLoginPanel, useBeautyQuest } from '@/features/beauty-quest/BeautyQuestLayout'
import { REFLECT } from '@/features/beauty-quest/content'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService } from '@/services/beautyQuest'

type Row = { week: string; data: Record<string, number | string> }

export function BqReflectPage() {
  useDocumentTitle('Tự đánh giá – Beauty Quest')
  const { status, afterClaim, toast } = useBeautyQuest()
  const [week, setWeek] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [w, list] = await Promise.all([beautyQuestService.currentWeek(), beautyQuestService.reflections()])
    setWeek(w)
    setRows(list)
    const cur = list.find((r) => r.week === w)
    if (cur) {
      setRatings(Object.fromEntries(REFLECT.ratings.map((r) => [r.id, Number(cur.data[r.id])])))
      setTexts(Object.fromEntries(REFLECT.texts.map((t) => [t.id, String(cur.data[t.id] ?? '')])))
    }
  }, [])
  useEffect(() => {
    if (status === 'ready') load().catch((err) => setMsg(friendlyError(err)))
  }, [status, load])

  const head = (
    <>
      <h2 className="section-title">Tự đánh giá</h2>
      <p className="mt-1 text-muted">Mỗi tuần một lần, nhìn lại làn da và thói quen của bạn. Không có đúng hay sai.</p>
    </>
  )
  if (status === 'guest' || status === 'off')
    return (
      <div className="max-w-3xl">
        {head}
        <div className="mt-5">
          <BqLoginPanel title="Đăng nhập để tự đánh giá">Bản tự đánh giá được lưu riêng cho bạn.</BqLoginPanel>
        </div>
      </div>
    )
  if (!rows || !week)
    return (
      <div className="max-w-3xl">
        {head}
        <Skeleton className="mt-5 h-64 w-full" />
      </div>
    )

  const cur = rows.find((r) => r.week === week)
  const history = rows.filter((r) => r.week !== week)

  const send = async () => {
    setMsg(null)
    try {
      const r = await beautyQuestService.saveReflection(ratings, texts)
      toast('Đã lưu tự đánh giá tuần này 📝')
      await load()
      await afterClaim(r.claim)
    } catch (err) {
      setMsg(friendlyError(err))
    }
  }

  return (
    <div className="max-w-3xl">
      {head}
      <div className="mt-5 rounded-card border border-border bg-surface p-5">
        <p className="text-sm text-muted">
          Tuần {week}
          {cur ? ' · bạn đã tự đánh giá tuần này, có thể chỉnh lại nếu muốn' : ''}
        </p>
        {REFLECT.ratings.map((r) => (
          <fieldset key={r.id} className="mt-4">
            <legend className="font-semibold">{r.title}</legend>
            <div className="mt-2 flex gap-2" role="group" aria-label={r.title}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={ratings[r.id] === n}
                  onClick={() => setRatings({ ...ratings, [r.id]: n })}
                  className={`grid size-11 place-items-center rounded-full border text-sm font-semibold ${ratings[r.id] === n ? 'border-primary bg-primary text-on-primary' : 'border-border bg-bg hover:border-primary'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 flex max-w-[15.5rem] justify-between text-xs text-muted">
              <span>{r.low}</span>
              <span>{r.high}</span>
            </p>
          </fieldset>
        ))}
        {REFLECT.texts.map((t) => (
          <label key={t.id} className="mt-4 block text-sm font-medium">
            {t.title} (không bắt buộc)
            <textarea
              value={texts[t.id] ?? ''}
              onChange={(e) => setTexts({ ...texts, [t.id]: e.target.value })}
              maxLength={300}
              rows={2}
              className="mt-1 block w-full rounded-xl border border-border bg-bg px-3 py-2 font-normal"
            />
          </label>
        ))}
        {msg && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {msg}
          </p>
        )}
        <button type="button" className={`${button('dark')} mt-4`} onClick={() => void send()}>
          {cur ? 'Cập nhật' : 'Lưu tự đánh giá'}
        </button>
      </div>

      {history.length > 0 && (
        <section className="mt-8" aria-labelledby="rf-hist">
          <h3 id="rf-hist" className="text-xl font-semibold">
            Các tuần trước
          </h3>
          <ul className="mt-3 space-y-3">
            {history.map((h) => (
              <li key={h.week} className="rounded-card border border-border bg-surface p-4 text-sm">
                <b>Tuần {h.week}</b>
                {REFLECT.ratings.map((r) => {
                  const v = Number(h.data[r.id]) || 0
                  return (
                    <p key={r.id} className="mt-1 flex justify-between gap-3">
                      <span className="text-muted">{r.title.replace(/\?$/, '')}</span>
                      <span aria-label={`${v} trên 5`}>{'●'.repeat(v) + '○'.repeat(5 - v)}</span>
                    </p>
                  )
                })}
                {h.data.win && <p className="mt-1 text-muted">✨ {String(h.data.win)}</p>}
                {h.data.next && <p className="text-muted">🌱 {String(h.data.next)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
