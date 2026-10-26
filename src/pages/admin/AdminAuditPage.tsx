/** NHẬT KÝ QUẢN TRỊ — /admin/audit. Chỉ đọc; không ai sửa hay xóa được nhật ký từ website. */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminUsersService, auditActionLabels, type AuditRow } from '@/services/adminUsers'

const PAGE_SIZE = 30
const groups = [
  { value: '', label: 'Tất cả' },
  { value: 'user.', label: 'Tài khoản' },
  { value: 'shop.', label: 'Cửa hàng' },
  { value: 'product.', label: 'Sản phẩm' },
  { value: 'payment.', label: 'Thanh toán' },
  { value: 'order.', label: 'Đơn hàng' },
  { value: 'banner.', label: 'Banner' },
  { value: 'site_settings.', label: 'Thương hiệu' },
  { value: 'bootstrap', label: 'Khởi tạo hệ thống' },
]

function describe(row: AuditRow): string {
  const d = row.details ?? {}
  const parts: string[] = []
  if (typeof d.email === 'string') parts.push(d.email)
  if (row.action.startsWith('shop.') && typeof d.name === 'string') parts.push(`Cửa hàng: ${d.name}`)
  if (row.action.startsWith('product.') && typeof d.name === 'string') parts.push(`Sản phẩm: ${d.name}`)
  if ((row.action.startsWith('payment.') || row.action.startsWith('order.')) && typeof d.code === 'string') parts.push(`Đơn ${d.code}${typeof d.shop === 'string' ? ` – ${d.shop}` : ''}`)
  if (typeof d.amount === 'number') parts.push(`Số tiền: ${d.amount.toLocaleString('vi-VN')}đ`)
  if (row.action.startsWith('banner.') && typeof d.title === 'string') parts.push(`Banner: ${d.title}`)
  if (typeof d.reason === 'string' && d.reason) parts.push(`Lý do: ${d.reason}`)
  if (row.action === 'site_settings.update') {
    const before = d.before as Record<string, unknown> | undefined
    const after = d.after as Record<string, unknown> | undefined
    if (before && after) {
      const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]))
      const names: Record<string, string> = {
        brand_name: 'tên',
        logo_light_path: 'logo sáng',
        logo_dark_path: 'logo tối',
        favicon_path: 'favicon',
        primary_color: 'màu',
        shipping_fee: 'phí vận chuyển',
      }
      parts.push(changed.length ? `Thay đổi: ${changed.map((k) => names[k] ?? k).join(', ')}` : 'Không có thay đổi')
    }
  }
  return parts.join(' · ')
}

export function AdminAuditPage() {
  useDocumentTitle('Nhật ký quản trị')
  const [params, setParams] = useSearchParams()
  const action = params.get('action') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: AuditRow[]; total: number; error?: string }>({
    status: 'loading',
    rows: [],
    total: 0,
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const r = await adminUsersService.auditLogs(action || null, page, PAGE_SIZE)
      setState({ status: 'ready', ...r })
    } catch (err) {
      setState({ status: 'error', rows: [], total: 0, error: friendlyError(err) })
    }
  }, [action, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE))

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold tracking-tight">Nhật ký quản trị</h1>
      <p className="mt-1 text-sm text-muted">Ghi lại ai đã làm gì, lúc nào. Nhật ký không thể sửa hoặc xóa từ website.</p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Lọc theo loại thao tác">
        {groups.map((g) => (
          <button
            key={g.value}
            type="button"
            aria-pressed={action === g.value}
            onClick={() => setParams(g.value ? { action: g.value } : {})}
            className={`rounded-full border px-4 py-1.5 text-sm ${action === g.value ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {state.status === 'loading' && <Skeleton className="h-64 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.rows.length === 0 && <EmptyState title="Chưa có thao tác nào" />}
        {state.status === 'ready' && state.rows.length > 0 && (
          <ol className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {state.rows.map((r) => (
              <li key={r.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[170px_1fr_1.2fr] md:gap-4">
                <time className="text-muted" dateTime={r.created_at}>
                  {new Date(r.created_at).toLocaleString('vi-VN')}
                </time>
                <div>
                  <p className="font-semibold">{auditActionLabels[r.action] ?? r.action}</p>
                  <p className="text-xs text-muted">{r.actor_email ? `bởi ${r.actor_email}` : 'bởi hệ thống (SQL Editor)'}</p>
                </div>
                <p className="min-w-0 break-words text-muted">{describe(r)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {state.status === 'ready' && totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="Phân trang">
          <button type="button" className={button('secondary', 'sm')} disabled={page <= 1} onClick={() => setParams({ ...(action ? { action } : {}), page: String(page - 1) })}>
            Trang trước
          </button>
          <span>
            Trang {page} / {totalPages}
          </span>
          <button type="button" className={button('secondary', 'sm')} disabled={page >= totalPages} onClick={() => setParams({ ...(action ? { action } : {}), page: String(page + 1) })}>
            Trang sau
          </button>
        </nav>
      )}
    </div>
  )
}
