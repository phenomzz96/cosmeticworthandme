/**
 * TRANG THÔNG TIN: Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản.
 * Nội dung do Admin soạn ở /admin/pages (lưu trên Supabase); chưa soạn thì dùng nội dung mặc định (src/content/defaultPages.ts).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs, Skeleton } from '@/components/ui/primitives'
import type { PageSlug } from '@/content/defaultPages'
import { useSitePage } from '@/features/content/useSitePage'
import { SupportBox } from '@/features/messages/SupportBox'
import { BlocksView, parseBlocks, RichText, splitSections } from '@/lib/richText'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const infoLinks = [
  { to: '/about', label: 'Giới thiệu' },
  { to: '/faq', label: 'Câu hỏi thường gặp' },
  { to: '/policies', label: 'Chính sách' },
  { to: '/terms', label: 'Điều khoản sử dụng' },
  { to: '/contact', label: 'Liên hệ' },
]

function InfoLayout({ slug, children }: { slug: PageSlug; children: (page: ReturnType<typeof useSitePage>) => ReactNode }) {
  const page = useSitePage(slug)
  useDocumentTitle(page.title)
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: page.title }]} />
      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Trang thông tin" className="order-last lg:order-first">
          <ul className="flex flex-wrap gap-2 lg:sticky lg:top-40 lg:flex-col lg:gap-1">
            {infoLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="block rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0 max-w-3xl">
          <h1 className="text-4xl leading-tight sm:text-5xl">{page.title}</h1>
          {page.intro && <p className="mt-3 text-lg text-muted">{page.intro}</p>}
          <div className="mt-8 space-y-8">{page.ready ? children(page) : <Skeleton className="h-64 w-full" />}</div>
        </article>
      </div>
    </div>
  )
}

export function AboutPage() {
  return <InfoLayout slug="about">{(p) => <RichText text={p.body} />}</InfoLayout>
}

export function TermsPage() {
  return <InfoLayout slug="terms">{(p) => <RichText text={p.body} />}</InfoLayout>
}

export function PoliciesPage() {
  return (
    <InfoLayout slug="policies">
      {(p) => {
        const sections = splitSections(p.body).filter((s) => s.title)
        return (
          <>
            {sections.length > 1 && (
              <nav aria-label="Mục lục" className="flex flex-wrap gap-2 text-sm">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border px-3 py-1 hover:border-primary hover:text-primary">
                    {s.title}
                  </a>
                ))}
              </nav>
            )}
            <RichText text={p.body} />
          </>
        )
      }}
    </InfoLayout>
  )
}

export function ContactPage() {
  return (
    <InfoLayout slug="contact">
      {(p) => (
        <>
          <RichText text={p.body} />
          <SupportBox />
        </>
      )}
    </InfoLayout>
  )
}

export function FaqPage() {
  return (
    <InfoLayout slug="faq">
      {(p) => {
        const sections = splitSections(p.body)
        return (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách câu hỏi">
              {sections.map((s, i) =>
                s.title ? (
                  <li key={s.id}>
                    <details className="group p-4" id={s.id}>
                      <summary className="cursor-pointer list-none font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                        <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
                        {s.title}
                      </summary>
                      <div className="mt-2 space-y-2 pl-5 text-sm leading-relaxed text-muted">
                        <BlocksView blocks={s.blocks} />
                      </div>
                    </details>
                  </li>
                ) : (
                  <li key={i} className="space-y-2 p-4 text-sm text-muted">
                    <BlocksView blocks={s.blocks.length ? s.blocks : parseBlocks('')} />
                  </li>
                ),
              )}
            </ul>
            <SupportBox title="Chưa thấy câu trả lời?" />
          </>
        )
      }}
    </InfoLayout>
  )
}
