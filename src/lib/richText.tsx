/**
 * Hiển thị nội dung trang do Admin soạn (Markdown rút gọn) thành phần tử React.
 * Không dùng dangerouslySetInnerHTML: mọi chữ đều được React tự thoát ký tự, nên Admin không chèn được mã HTML/JS.
 * Hỗ trợ: "## tiêu đề", "- gạch đầu dòng", đoạn văn, **đậm**, [chữ](liên kết).
 */
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { slugify } from '@/lib/text'

export type Block =
  | { kind: 'heading'; text: string; id: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string }

/** Thay {{bien}} bằng giá trị */
export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let para: string[] = []
  let list: string[] | null = null
  const used = new Map<string, number>()
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: para.join(' ') })
    para = []
  }
  const flushList = () => {
    if (list?.length) blocks.push({ kind: 'list', items: list })
    list = null
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      continue
    }
    const h = /^#{2,3}\s+(.+)$/.exec(line)
    if (h) {
      flushPara()
      flushList()
      const base = slugify(h[1]) || 'muc'
      const n = used.get(base) ?? 0
      used.set(base, n + 1)
      blocks.push({ kind: 'heading', text: h[1].trim(), id: n ? `${base}-${n + 1}` : base })
      continue
    }
    const li = /^[-*•]\s+(.+)$/.exec(line)
    if (li) {
      flushPara()
      ;(list ??= []).push(li[1])
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return blocks
}

/** Chia nội dung theo từng "## tiêu đề" (dùng cho trang Câu hỏi thường gặp, mục lục) */
export function splitSections(text: string): { title: string; id: string; blocks: Block[] }[] {
  const out: { title: string; id: string; blocks: Block[] }[] = []
  for (const b of parseBlocks(text)) {
    if (b.kind === 'heading') out.push({ title: b.text, id: b.id, blocks: [] })
    else if (out.length) out[out.length - 1].blocks.push(b)
    else out.push({ title: '', id: 'mo-dau', blocks: [b] })
  }
  return out
}

const linkClass = 'font-medium text-primary underline-offset-2 hover:underline'

/** Chữ đậm và liên kết trong một dòng */
export function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] != null) {
      parts.push(<strong key={key++}>{m[1]}</strong>)
    } else {
      const [label, href] = [m[2], m[3]]
      if (/^\/(?!\/)/.test(href)) {
        parts.push(
          <Link key={key++} to={href} className={linkClass}>
            {label}
          </Link>,
        )
      } else if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
        parts.push(
          <a key={key++} href={href} className={linkClass} {...(/^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {label}
          </a>,
        )
      } else {
        parts.push(label)
      }
    }
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export function BlocksView({ blocks, headingClass = 'text-xl font-bold' }: { blocks: Block[]; headingClass?: string }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.kind === 'heading' && (
            <h2 id={b.id} className={`scroll-mt-40 pt-2 ${headingClass}`}>
              {b.text}
            </h2>
          )}
          {b.kind === 'paragraph' && (
            <p>
              <Inline text={b.text} />
            </p>
          )}
          {b.kind === 'list' && (
            <ul className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="ml-5 list-disc pl-1">
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </>
  )
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      <BlocksView blocks={parseBlocks(text)} />
    </div>
  )
}
