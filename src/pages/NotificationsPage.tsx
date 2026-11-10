/** THÔNG BÁO — /notifications. Database tự tạo thông báo; mỗi người chỉ thấy thông báo của mình. */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Breadcrumbs, button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { notificationService, type AppNotification } from '@/services/notifications'

const kindIcon: Record<AppNotification['kind'], IconName> = {
  order: 'truck',
  payment: 'ticket',
  refund: 'return',
  review: 'star',
  shop: 'store',
  product: 'tag',
  system: 'info',
}

export function NotificationsPage() {
  useDocumentTitle('Thông báo')
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: AppNotification[]; error?: string }>({ status: 'loading', items: [] })

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', items: await notificationService.list(50) })
    } catch (err) {
      setState({ status: 'error', items: [], error: friendlyError(err) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markAll = async () => {
    await notificationService.markRead().catch(() => undefined)
    window.dispatchEvent(new Event('wm:notifications-changed'))
    void load()
  }
  const open = (n: AppNotification) => {
    if (!n.read_at) {
      void notificationService
        .markRead([n.id])
        .then(() => window.dispatchEvent(new Event('wm:notifications-changed')))
        .catch(() => undefined)
    }
  }

  const unread = state.items.filter((n) => !n.read_at).length

  return (
    <div className="container-page max-w-3xl py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Thông báo' }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Cập nhật</p>
          <h1 className="mt-2 text-4xl md:text-5xl">Thông báo</h1>
        </div>
        {unread > 0 && (
          <button type="button" className={button('secondary', 'sm')} onClick={() => void markAll()}>
            Đánh dấu đã đọc tất cả ({unread})
          </button>
        )}
      </div>

      <div className="mt-6">
        {state.status === 'loading' && <Skeleton className="h-48 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.items.length === 0 && (
          <EmptyState title="Chưa có thông báo">Bạn sẽ nhận thông báo khi đơn hàng đổi trạng thái, thanh toán được xác nhận hoặc cửa hàng trả lời đánh giá.</EmptyState>
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách thông báo">
            {state.items.map((n) => {
              const body = (
                <>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${n.read_at ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary'}`}>
                    <Icon name={kindIcon[n.kind] ?? 'info'} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read_at ? '' : 'font-semibold'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                    <span className="mt-1 block text-xs text-muted">{formatDateTime(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />}
                </>
              )
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link to={n.link} onClick={() => open(n)} className="flex gap-3 p-4 hover:bg-surface-2">
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => open(n)} className="flex w-full gap-3 p-4 text-left hover:bg-surface-2">
                      {body}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
