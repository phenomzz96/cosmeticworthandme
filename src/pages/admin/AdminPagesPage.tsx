/**
 * NỘI DUNG TRANG — /admin/pages
 * Admin sửa Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản, thanh thông báo và mô tả chân trang.
 * Lưu trên Supabase (hàm admin_save_page kiểm tra quyền Admin và ghi nhật ký). Có xem trước trực tiếp.
 */
import { ScrollRow } from '@/components/ui/ScrollRow'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, TextAreaField, TextField } from '@/components/ui/Form'
import { button } from '@/components/ui/primitives'
import { DEFAULT_PAGES, PAGE_META, type PageContent, type PageSlug } from '@/content/defaultPages'
import { usePageVars, useSitePage } from '@/features/content/useSitePage'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { fillVars, RichText, splitSections } from '@/lib/richText'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { sitePagesService } from '@/services/sitePages'

const ORDER: PageSlug[] = ['about', 'faq', 'policies', 'terms', 'contact', 'announcement', 'footer']
const SHORT: PageSlug[] = ['announcement', 'footer']

export function AdminPagesPage() {
  useDocumentTitle('Nội dung trang')
  const [params, setParams] = useSearchParams()
  const slug = (ORDER.includes(params.get('p') as PageSlug) ? params.get('p') : 'about') as PageSlug

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Nội dung trang</h1>
      <p className="mt-1 text-sm text-muted">Sửa chữ trên các trang thông tin mà không cần sửa mã nguồn. Thay đổi hiện ngay cho mọi người sau khi lưu.</p>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ScrollRow as="nav" aria-label="Chọn trang" className="flex gap-2 lg:flex-col lg:gap-1">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === slug}
              onClick={() => setParams({ p: s })}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm ${s === slug ? 'bg-primary text-on-primary' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
            >
              {PAGE_META[s].label}
            </button>
          ))}
        </ScrollRow>
        <PageEditor key={slug} slug={slug} />
      </div>
    </div>
  )
}

function PageEditor({ slug }: { slug: PageSlug }) {
  const page = useSitePage(slug)
  const vars = usePageVars()
  const meta = PAGE_META[slug]
  const short = SHORT.includes(slug)
  const [form, setForm] = useState<PageContent | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Nạp nội dung đang hiển thị (chưa thay biến, để Admin thấy {{ten_san}}…)
  useEffect(() => {
    if (!page.ready || form) return
    setForm({ ...sitePagesService.resolve(slug) })
  }, [page.ready, form, slug])

  if (!form) return <div className="h-64 animate-pulse rounded-card bg-surface-2" />
  const dirty = (() => {
    const cur = sitePagesService.resolve(slug)
    return cur.title !== form.title || cur.intro !== form.intro || cur.body !== form.body
  })()

  const save = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await sitePagesService.save(slug, form)
      setNotice({ kind: 'success', text: `Đã lưu "${meta.label}".` })
    } catch (e) {
      setNotice({ kind: 'error', text: friendlyError(e) })
    } finally {
      setBusy(false)
    }
  }
  const reset = async () => {
    if (!window.confirm(`Dùng lại nội dung mặc định cho "${meta.label}"? Nội dung bạn đã sửa sẽ bị thay.`)) return
    setBusy(true)
    setNotice(null)
    try {
      await sitePagesService.reset(slug)
      setForm({ ...DEFAULT_PAGES[slug] })
      setNotice({ kind: 'success', text: `Đã khôi phục nội dung mặc định cho "${meta.label}".` })
    } catch (e) {
      setNotice({ kind: 'error', text: friendlyError(e) })
    } finally {
      setBusy(false)
    }
  }

  const preview = { title: fillVars(form.title, vars), intro: fillVars(form.intro, vars), body: fillVars(form.body, vars) }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <p className="text-xs text-muted">
            {page.custom ? `Đã chỉnh sửa · cập nhật ${page.updatedAt ? formatDateTime(page.updatedAt) : ''}` : 'Đang dùng nội dung mặc định'}
            {meta.path && (
              <>
                {' · '}
                <Link to={meta.path} className="text-primary underline" target="_blank">
                  Xem trang
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {page.custom && (
            <button type="button" className={button('ghost', 'sm')} onClick={() => void reset()} disabled={busy}>
              Khôi phục mặc định
            </button>
          )}
          <button type="button" className={button('primary', 'sm')} onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <form
          className="space-y-4 rounded-card border border-border bg-surface p-4"
          aria-label={`Sửa ${meta.label}`}
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {!short && (
            <>
              <TextField label="Tiêu đề trang" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <TextAreaField label="Đoạn giới thiệu ngắn (không bắt buộc)" value={form.intro} rows={2} maxLength={500} onChange={(v) => setForm({ ...form, intro: v })} />
            </>
          )}
          <TextAreaField
            label={short ? 'Nội dung' : 'Nội dung trang'}
            value={form.body}
            rows={short ? 3 : 18}
            maxLength={slug === 'announcement' ? 200 : slug === 'footer' ? 300 : 30000}
            counter
            onChange={(v) => setForm({ ...form, body: slug === 'announcement' ? v.replace(/\n/g, ' ') : v })}
            hint={meta.hint}
          />
          <details className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-text">Cách định dạng</summary>
            <ul className="mt-2 space-y-1">
              <li><code>## Tiêu đề mục</code>: tiêu đề (trang Câu hỏi thường gặp: mỗi mục là một câu hỏi)</li>
              <li><code>- Nội dung</code>: gạch đầu dòng</li>
              <li><code>**chữ đậm**</code>, <code>[chữ](/products)</code>: chữ đậm, liên kết</li>
              <li><code>{'{{ten_san}}'}</code>: tên thương hiệu · <code>{'{{phi_van_chuyen}}'}</code>: phí vận chuyển hiện tại</li>
              <li>Để trống một dòng giữa hai đoạn văn.</li>
            </ul>
          </details>
        </form>

        <section className="min-w-0 rounded-card border border-dashed border-border bg-bg p-5" aria-label="Xem trước">
          <p className="eyebrow">Xem trước</p>
          {slug === 'announcement' ? (
            <p className="mt-3 rounded-xl bg-ink px-4 py-2 text-center text-xs text-on-ink">{preview.body || '(Đang ẩn thanh thông báo)'}</p>
          ) : slug === 'footer' ? (
            <p className="mt-3 text-sm text-muted">{preview.body || '(Không hiện mô tả dưới logo)'}</p>
          ) : (
            <div className="mt-3">
              <h3 className="text-3xl">{preview.title}</h3>
              {preview.intro && <p className="mt-2 text-muted">{preview.intro}</p>}
              {slug === 'faq' ? (
                <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
                  {splitSections(preview.body)
                    .filter((s) => s.title)
                    .map((s) => (
                      <li key={s.id}>{s.title}</li>
                    ))}
                </ol>
              ) : (
                <RichText text={preview.body} className="mt-4 text-sm" />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
