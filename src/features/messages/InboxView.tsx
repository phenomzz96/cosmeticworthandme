import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { Icon } from '@/components/ui/Icon'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { MESSAGES_CHANGED, messageService, type ConversationSummary, type InboxScope, type SenderRole } from '@/services/messages'

const ownRole: Record<InboxScope, SenderRole> = { customer: 'customer', shop: 'shop', support: 'admin' }
import { ChatThread } from './ChatThread'

export function conversationTitle(c: ConversationSummary, scope: InboxScope) {
  if (scope === 'customer') return c.shop_name ?? 'Bộ phận hỗ trợ'
  return c.customer_name
}

function conversationSubtitle(c: ConversationSummary, scope: InboxScope) {
  if (scope === 'customer') return c.shop_id ? 'Cửa hàng' : 'Hỗ trợ của sàn: khiếu nại, góp ý, tài khoản'
  if (scope === 'support') return c.customer_email ?? 'Khách hàng'
  return `Khách hàng${c.shop_name ? ' · ' + c.shop_name : ''}`
}

/**
 * Hộp thư 2 cột: danh sách cuộc trò chuyện + nội dung. Cuộc trò chuyện đang mở lưu trên đường dẫn (?c=...).
 * compact: dùng trong khung chat nổi (chỉ hiện 1 cột).
 */
export function InboxView({ scope, compact = false, emptyHint }: { scope: InboxScope; compact?: boolean; emptyHint?: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const [localSelected, setLocalSelected] = useState<string | null>(null)
  const selected = compact ? localSelected : params.get('c')
  const select = (id: string | null) => {
    if (compact) return setLocalSelected(id)
    const next = new URLSearchParams(params)
    if (id) next.set('c', id)
    else next.delete('c')
    setParams(next, { replace: !!selected })
  }

  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: ConversationSummary[]; error?: string }>({ status: 'loading', items: [] })
  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', items: await messageService.inbox(scope) })
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: friendlyError(e) }))
    }
  }, [scope])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => document.visibilityState === 'visible' && void load(), 20_000)
    window.addEventListener(MESSAGES_CHANGED, load)
    return () => {
      window.clearInterval(t)
      window.removeEventListener(MESSAGES_CHANGED, load)
    }
  }, [load])

  const current = state.items.find((c) => c.id === selected)

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      {state.status === 'loading' && (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {state.status === 'error' && (
        <div className="p-3">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <div className="p-4">
          <EmptyState title="Chưa có tin nhắn">{emptyHint}</EmptyState>
        </div>
      )}
      {state.items.length > 0 && (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto" aria-label="Cuộc trò chuyện">
          {state.items.map((c) => {
            const name = conversationTitle(c, scope)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select(c.id)}
                  aria-current={c.id === selected ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 ${c.id === selected ? 'bg-primary-soft' : ''}`}
                >
                  {scope === 'customer' && !c.shop_id ? (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-on-ink">
                      <Icon name="message" size={18} />
                    </span>
                  ) : (
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-base font-bold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread ? 'font-bold' : 'font-medium'}`}>{name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{formatDateTime(c.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${c.unread ? 'text-text' : 'text-muted'}`}>
                        {c.last_sender === ownRole[scope] ? 'Bạn: ' : ''}
                        {c.last_preview}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-sale px-1 text-[11px] font-bold text-white" aria-label={`${c.unread} tin chưa đọc`}>
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const thread =
    current || selected ? (
      <ChatThread
        key={selected!}
        conversationId={selected!}
        scope={scope}
        title={current ? conversationTitle(current, scope) : 'Cuộc trò chuyện'}
        subtitle={current ? conversationSubtitle(current, scope) : undefined}
        onBack={() => select(null)}
        onSent={() => void load()}
        compact={compact}
      />
    ) : (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">Chọn một cuộc trò chuyện để xem tin nhắn.</div>
    )

  if (compact) return <div className="h-full min-h-0">{selected ? thread : list}</div>

  return (
    <div className="grid h-[min(70vh,680px)] min-h-[420px] grid-cols-1 overflow-hidden rounded-card border border-border bg-surface md:grid-cols-[320px_minmax(0,1fr)]">
      <div className={`min-h-0 border-border md:border-r ${selected ? 'hidden md:block' : ''}`}>{list}</div>
      <div className={`min-h-0 ${selected ? '' : 'hidden md:block'}`}>{thread}</div>
    </div>
  )
}
