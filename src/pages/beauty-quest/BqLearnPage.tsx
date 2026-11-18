/**
 * BEAUTY QUEST — Học hỏi (/beauty-quest/learn, /beauty-quest/learn/:slug). Chuyển từ learn.html + learn.js của bản gốc:
 * 10 bài mẹo / hướng dẫn; kéo tới cuối bài mới đánh dấu đã đọc được (nhận điểm nhiệm vụ kiến thức).
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { button, EmptyState } from '@/components/ui/primitives'
import { useBeautyQuest } from '@/features/beauty-quest/BeautyQuestLayout'
import { ARTICLES, type Article } from '@/features/beauty-quest/content'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyQuestService } from '@/services/beautyQuest'

const KIND = { tip: 'Mẹo ngắn', guide: 'Hướng dẫn' } as const

/** Bài tôi đã đọc (từ sự kiện của chính tài khoản) */
function useReadSlugs() {
  const { status } = useBeautyQuest()
  const [read, setRead] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (status !== 'ready') return
    beautyQuestService
      .myEvents()
      .then((ev) => setRead(new Set(ev.filter((e) => e.type === 'article_read').map((e) => e.ref))))
      .catch(() => undefined)
  }, [status])
  return [read, setRead] as const
}

export function BqLearnPage() {
  const { slug } = useParams()
  const article = slug ? ARTICLES.find((a) => a.slug === slug) : null
  if (slug && !article)
    return (
      <EmptyState title="Không tìm thấy bài viết." action={<Link to="/beauty-quest/learn" className="font-semibold text-primary hover:underline">Về danh sách bài viết</Link>} />
    )
  return article ? <ArticleView a={article} /> : <ArticleList />
}

function ArticleList() {
  useDocumentTitle('Học hỏi – Beauty Quest')
  const [filter, setFilter] = useState<'all' | 'tip' | 'guide'>('all')
  const [read] = useReadSlugs()
  const shown = ARTICLES.filter((a) => filter === 'all' || a.kind === filter)
  return (
    <div>
      <h2 className="section-title">Học hỏi</h2>
      <p className="mt-1 text-muted">Mẹo ngắn và hướng dẫn chăm da cơ bản. Đọc xong một bài và đánh dấu để nhận điểm nhiệm vụ kiến thức.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Lọc bài viết">
        {(
          [
            ['all', 'Tất cả'],
            ['tip', 'Mẹo ngắn'],
            ['guide', 'Hướng dẫn'],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-4 py-1.5 text-sm ${filter === k ? 'border-ink bg-ink text-on-ink' : 'border-border bg-surface hover:border-text'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a) => (
          <li key={a.slug}>
            <Link to={`/beauty-quest/learn/${a.slug}`} className="flex h-full flex-col rounded-card border border-border bg-surface p-4 hover:border-primary">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-muted">{a.summary}</p>
              <span className="mt-auto flex flex-wrap gap-1.5 pt-3 text-xs">
                <span className="rounded-full bg-surface-2 px-2.5 py-1">{KIND[a.kind]}</span>
                <span className="rounded-full bg-surface-2 px-2.5 py-1">{a.minutes} phút</span>
                {read.has(a.slug) && <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">Đã đọc ✓</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ArticleView({ a }: { a: Article }) {
  useDocumentTitle(`${a.title} – Beauty Quest`)
  const { status, loginHref, afterClaim, toast } = useBeautyQuest()
  const [read, setRead] = useReadSlugs()
  const [reachedEnd, setReachedEnd] = useState(false)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setReachedEnd(false)
    const el = endRef.current
    if (!el || !('IntersectionObserver' in window)) return setReachedEnd(true)
    const io = new IntersectionObserver((en) => {
      if (en.some((x) => x.isIntersecting)) {
        setReachedEnd(true)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [a.slug])

  const mark = async () => {
    setBusy(true)
    try {
      const r = await beautyQuestService.markRead(a.slug)
      setRead(new Set([...read, a.slug]))
      await afterClaim(r.claim)
    } catch (err) {
      toast(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link to="/beauty-quest/learn" className="text-sm text-muted hover:text-primary">
        ← Tất cả bài viết
      </Link>
      <article className="mt-4">
        <p className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-surface-2 px-2.5 py-1">{KIND[a.kind]}</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1">{a.minutes} phút đọc</span>
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">{a.title}</h2>
        <div className="mt-4 space-y-3 leading-relaxed">
          {a.body.map((b, i) =>
            'h' in b ? (
              <h3 key={i} className="pt-2 text-xl font-semibold">
                {b.h}
              </h3>
            ) : 'p' in b ? (
              <p key={i}>{b.p}</p>
            ) : (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.ul.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ),
          )}
        </div>
        <div ref={endRef} className="mt-8 border-t border-border pt-4" />
        <p className="text-sm text-muted">Nội dung mang tính tham khảo chung, không thay thế tư vấn của bác sĩ da liễu.</p>
        <div className="mt-3">
          {read.has(a.slug) ? (
            <span className="inline-block rounded-full bg-success/10 px-3 py-1.5 text-sm text-success">Bạn đã đọc bài này ✓</span>
          ) : status !== 'ready' ? (
            <Link to={loginHref} className={button('secondary')}>
              Đăng nhập để lưu bài đã đọc và nhận điểm
            </Link>
          ) : (
            <button type="button" className={button('dark')} disabled={!reachedEnd || busy} onClick={() => void mark()}>
              {reachedEnd ? 'Đánh dấu đã đọc' : 'Kéo xuống cuối bài để đánh dấu đã đọc'}
            </button>
          )}
        </div>
      </article>
    </div>
  )
}
