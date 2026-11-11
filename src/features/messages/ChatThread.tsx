import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Price, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { catalogService } from '@/services/catalog'
import { MESSAGE_MAX, messageService, type ChatMessage, type InboxScope, type SenderRole } from '@/services/messages'
import type { Product } from '@/types/catalog'

const ownRole: Record<InboxScope, SenderRole> = { customer: 'customer', shop: 'shop', support: 'admin' }
const POLL_MS = 8000

/** Một cuộc trò chuyện: danh sách tin + khung soạn tin. Tự tải tin mới mỗi 8 giây khi đang mở. */
export function ChatThread({
  conversationId,
  scope,
  title,
  subtitle,
  onBack,
  onSent,
  compact = false,
}: {
  conversationId: string
  scope: InboxScope
  title: string
  subtitle?: string
  onBack?: () => void
  onSent?: () => void
  compact?: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Record<string, Product>>({})
  const listRef = useRef<HTMLOListElement>(null)
  const lastId = useRef(0)

  const load = useCallback(async () => {
    try {
      const list = await messageService.messages(conversationId)
      setMessages(list)
      setError(null)
      const newest = list[list.length - 1]?.id ?? 0
      if (newest !== lastId.current) {
        lastId.current = newest
        await messageService.markRead(conversationId).catch(() => undefined)
      }
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [conversationId])

  useEffect(() => {
    lastId.current = 0
    setMessages(null)
    void load()
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  // Sản phẩm được đính kèm trong tin nhắn
  useEffect(() => {
    const ids = [...new Set((messages ?? []).map((m) => m.product_id).filter((x): x is string => !!x))].filter((id) => !products[id])
    if (!ids.length) return
    void catalogService
      .getProductsByIds(ids)
      .then((list) => setProducts((p) => ({ ...p, ...Object.fromEntries(list.map((x) => [x.id, x])) })))
      .catch(() => undefined)
  }, [messages, products])

  // Cuộn xuống tin mới nhất
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages?.length])

  const mine = ownRole[scope]

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Trò chuyện với ${title}`}>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack && (
          <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Quay lại danh sách">
            <Icon name="chevronLeft" size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </header>

      <ol ref={listRef} className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 ${compact ? '' : 'md:px-6'}`} aria-live="polite" aria-label="Tin nhắn">
        {messages === null && !error && (
          <>
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </>
        )}
        {error && <li className="text-sm text-danger">{error}</li>}
        {messages?.length === 0 && <li className="text-center text-sm text-muted">Chưa có tin nhắn.</li>}
        {messages?.map((m) => {
          const own = m.sender_role === mine
          const product = m.product_id ? products[m.product_id] : undefined
          return (
            <li key={m.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
              {product && (
                <Link
                  to={`/products/${product.slug}`}
                  className="mb-1.5 flex max-w-[85%] items-center gap-3 rounded-2xl border border-border bg-surface p-2 pr-3 hover:border-primary"
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    <ProductImage product={product} />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-sm font-medium">{product.name}</span>
                    <Price price={product.price} originalPrice={product.originalPrice} />
                  </span>
                </Link>
              )}
              <p
                className={`max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  own ? 'rounded-br-md bg-ink text-on-ink' : 'rounded-bl-md bg-surface-2 text-text'
                }`}
              >
                {m.body}
              </p>
              <span className="mt-1 text-[11px] text-muted">
                {!own && m.sender_role !== 'customer' && (m.sender_role === 'admin' ? 'Hỗ trợ · ' : 'Cửa hàng · ')}
                {formatDateTime(m.created_at)}
              </span>
            </li>
          )
        })}
      </ol>

      <Composer
        onSend={async (body) => {
          await messageService.send(conversationId, body)
          await load()
          onSent?.()
        }}
      />
    </section>
  )
}

export function Composer({
  onSend,
  placeholder = 'Nhập tin nhắn…',
  initial = '',
  label = 'Tin nhắn',
}: {
  onSend: (body: string) => Promise<void>
  placeholder?: string
  initial?: string
  label?: string
}) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSend(body)
      setText('')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="border-t border-border p-3">
      {error && <p className="mb-2 text-xs text-danger" role="alert">{error}</p>}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX))}
          onKeyDown={onKey}
          rows={Math.min(5, Math.max(1, text.split('\n').length))}
          placeholder={placeholder}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-bg px-3.5 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-on-ink hover:bg-ink-hover disabled:opacity-40"
          aria-label="Gửi tin nhắn"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">Enter để gửi, Shift + Enter để xuống dòng. Không gửi mật khẩu hay thông tin thẻ ngân hàng.</p>
    </form>
  )
}
