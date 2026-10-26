/**
 * QUẢN LÝ NGƯỜI DÙNG — /admin/users
 * Giao diện ẩn/hiện nút theo quyền cho dễ dùng; quy tắc thật do database kiểm tra
 * (xem supabase/migrations/20261026000001_admin_users.sql).
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import {
  ADMIN_PAGE_SIZE,
  adminUsersService,
  SUSPEND_REASON_MAX,
  SUSPEND_REASON_MIN,
  type AdminUserRow,
  type UserFilters,
} from '@/services/adminUsers'
import { roleLabels, type AccountStatus, type UserRole } from '@/types/account'

const roleOptions: UserRole[] = ['customer', 'seller', 'admin', 'super_admin']
const statusLabels: Record<AccountStatus, string> = { active: 'Đang hoạt động', suspended: 'Đang bị khóa' }

function readFilters(p: URLSearchParams): UserFilters {
  const role = p.get('role')
  const status = p.get('status')
  return {
    search: p.get('q') ?? '',
    role: roleOptions.includes(role as UserRole) ? (role as UserRole) : undefined,
    status: status === 'active' || status === 'suspended' ? status : undefined,
    createdFrom: p.get('from') ?? '',
    createdTo: p.get('to') ?? '',
    page: Math.max(1, Number(p.get('page')) || 1),
  }
}

export function AdminUsersPage() {
  useDocumentTitle('Quản lý người dùng')
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const key = params.toString()

  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: AdminUserRow[]; total: number; error?: string }>({
    status: 'loading',
    rows: [],
    total: 0,
  })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const r = await adminUsersService.list(readFilters(new URLSearchParams(key)))
      setState({ status: 'ready', rows: r.rows, total: r.total })
    } catch (err) {
      setState({ status: 'error', rows: [], total: 0, error: friendlyError(err) })
    }
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  // Tìm kiếm: chờ người dùng ngừng gõ 350ms rồi mới tải
  useEffect(() => {
    if ((filters.search ?? '') === searchInput) return
    const t = window.setTimeout(() => update({ q: searchInput.trim() || null }), 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const totalPages = Math.max(1, Math.ceil(state.total / ADMIN_PAGE_SIZE))
  const hasFilters = !!(filters.search || filters.role || filters.status || filters.createdFrom || filters.createdTo)

  const replaceRow = (updated: Partial<AdminUserRow> & { id: string }) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) }))

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold tracking-tight">Người dùng</h1>
      <p className="mt-1 text-sm text-muted">Tìm kiếm, khóa hoặc mở khóa tài khoản. Mọi thao tác được ghi vào nhật ký.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-card border border-border bg-surface p-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] md:items-end">
        <label className="col-span-2 block text-sm md:col-span-1">
          <span className="font-medium">Tìm kiếm</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Email, họ tên, SĐT"
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Vai trò</span>
          <select
            value={filters.role ?? ''}
            onChange={(e) => update({ role: e.target.value || null })}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3"
          >
            <option value="">Tất cả</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Trạng thái</span>
          <select
            value={filters.status ?? ''}
            onChange={(e) => update({ status: e.target.value || null })}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3"
          >
            <option value="">Tất cả</option>
            <option value="active">{statusLabels.active}</option>
            <option value="suspended">{statusLabels.suspended}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Tạo từ ngày</span>
          <input
            type="date"
            value={filters.createdFrom}
            onChange={(e) => update({ from: e.target.value || null })}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Đến ngày</span>
          <input
            type="date"
            value={filters.createdTo}
            onChange={(e) => update({ to: e.target.value || null })}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3"
          />
        </label>
        <button
          type="button"
          className={`${button('ghost', 'sm')} col-span-2 md:col-span-1`}
          disabled={!hasFilters}
          onClick={() => {
            setSearchInput('')
            setParams({})
          }}
        >
          Xóa lọc
        </button>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{state.status === 'ready' ? `${state.total} tài khoản` : ' '}</span>
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => void load()}>
          Tải lại
        </button>
      </div>

      <div className="mt-2">
        {state.status === 'loading' && <Skeleton className="h-64 w-full" />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && state.rows.length === 0 && (
          <EmptyState title={hasFilters ? 'Không có tài khoản phù hợp bộ lọc' : 'Chưa có tài khoản nào'} />
        )}
        {state.status === 'ready' && state.rows.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách người dùng">
            <li className="hidden grid-cols-[2fr_1fr_1.2fr_1fr_1.6fr] gap-4 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-muted md:grid" aria-hidden="true">
              <span>Người dùng</span>
              <span>Vai trò</span>
              <span>Trạng thái</span>
              <span>Ngày tạo</span>
              <span className="text-right">Thao tác</span>
            </li>
            {state.rows.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onChanged={(updated, text) => {
                  replaceRow(updated)
                  setNotice({ kind: 'success', text })
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {state.status === 'ready' && totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="Phân trang">
          <button type="button" className={button('secondary', 'sm')} disabled={(filters.page ?? 1) <= 1} onClick={() => update({ page: String((filters.page ?? 1) - 1) })}>
            Trang trước
          </button>
          <span>
            Trang {filters.page} / {totalPages}
          </span>
          <button
            type="button"
            className={button('secondary', 'sm')}
            disabled={(filters.page ?? 1) >= totalPages}
            onClick={() => update({ page: String((filters.page ?? 1) + 1) })}
          >
            Trang sau
          </button>
        </nav>
      )}
    </div>
  )
}

type Panel = null | 'suspend' | 'unsuspend' | 'grant' | 'revoke'

function UserRow({ user, onChanged }: { user: AdminUserRow; onChanged: (u: Partial<AdminUserRow> & { id: string }, message: string) => void }) {
  const { profile: me, isSuperAdmin } = useAuth()
  const [panel, setPanel] = useState<Panel>(null)
  const [reason, setReason] = useState('')
  const [revokeTo, setRevokeTo] = useState<UserRole>('customer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSelf = me?.id === user.id
  const isTargetSuper = user.role === 'super_admin'
  // Giống quy tắc trong database: chỉ để ẩn nút, database vẫn kiểm tra lại
  const canChangeStatus = !isSelf && !isTargetSuper && (user.role !== 'admin' || isSuperAdmin)
  const canChangeRole = isSuperAdmin && !isSelf && !isTargetSuper
  const name = user.full_name.trim() || '(chưa có tên)'

  const open = (p: Panel) => {
    setPanel(p)
    setReason('')
    setError(null)
  }

  const run = async () => {
    setError(null)
    if (panel === 'suspend') {
      const r = reason.trim()
      if (r.length < SUSPEND_REASON_MIN) return setError(`Nhập lý do khóa (ít nhất ${SUSPEND_REASON_MIN} ký tự).`)
      if (r.length > SUSPEND_REASON_MAX) return setError(`Lý do tối đa ${SUSPEND_REASON_MAX} ký tự.`)
    }
    setBusy(true)
    try {
      if (panel === 'suspend' || panel === 'unsuspend') {
        const p = await adminUsersService.setStatus(user.id, panel === 'suspend' ? 'suspended' : 'active', reason)
        onChanged(
          { id: user.id, status: p.status, suspended_reason: p.suspended_reason },
          panel === 'suspend' ? `Đã khóa tài khoản ${user.email}.` : `Đã mở khóa tài khoản ${user.email}.`,
        )
      } else if (panel === 'grant' || panel === 'revoke') {
        const p = await adminUsersService.setRole(user.id, panel === 'grant' ? 'admin' : revokeTo, reason)
        onChanged(
          { id: user.id, role: p.role },
          panel === 'grant' ? `Đã cấp quyền Admin cho ${user.email}.` : `Đã thu hồi quyền Admin của ${user.email}.`,
        )
      }
      setPanel(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-4 py-3.5">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1.2fr_1fr_1.6fr] md:items-center md:gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {name}
            {isSelf && <span className="ml-1.5 text-xs text-muted">(bạn)</span>}
          </p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          {!user.email_confirmed && <p className="text-xs font-medium text-danger">Chưa xác minh email</p>}
        </div>
        <div>
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === 'customer' ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary'}`}>
            {roleLabels[user.role]}
          </span>
        </div>
        <div className="min-w-0 text-sm">
          <span className={`inline-flex items-center gap-1.5 font-medium ${user.status === 'active' ? 'text-success' : 'text-danger'}`}>
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {statusLabels[user.status]}
          </span>
          {user.status === 'suspended' && user.suspended_reason && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted" title={user.suspended_reason}>
              Lý do: {user.suspended_reason}
            </p>
          )}
        </div>
        <div className="text-sm text-muted">{new Date(user.created_at).toLocaleDateString('vi-VN')}</div>
        <div className="flex flex-wrap gap-1.5 md:justify-end">
          {canChangeStatus &&
            (user.status === 'active' ? (
              <button type="button" className={button('secondary', 'sm')} onClick={() => open('suspend')} aria-label={`Khóa tài khoản ${user.email}`}>
                Khóa
              </button>
            ) : (
              <button type="button" className={button('secondary', 'sm')} onClick={() => open('unsuspend')} aria-label={`Mở khóa tài khoản ${user.email}`}>
                Mở khóa
              </button>
            ))}
          {canChangeRole &&
            (user.role === 'admin' ? (
              <button type="button" className={button('ghost', 'sm')} onClick={() => open('revoke')} aria-label={`Thu hồi quyền Admin của ${user.email}`}>
                Thu hồi Admin
              </button>
            ) : (
              <button
                type="button"
                className={button('ghost', 'sm')}
                onClick={() => open('grant')}
                disabled={!user.email_confirmed || user.status !== 'active'}
                title={!user.email_confirmed ? 'Tài khoản chưa xác minh email' : user.status !== 'active' ? 'Hãy mở khóa trước' : undefined}
                aria-label={`Cấp quyền Admin cho ${user.email}`}
              >
                Cấp Admin
              </button>
            ))}
          {!canChangeStatus && !canChangeRole && <span className="text-xs text-muted">{isTargetSuper ? 'Được bảo vệ' : isSelf ? '—' : 'Chỉ Super Admin'}</span>}
        </div>
      </div>

      {panel && (
        <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3.5" role="group" aria-label="Xác nhận thao tác">
          <p className="text-sm font-medium">
            {panel === 'suspend' && `Khóa tài khoản ${user.email}? Người này sẽ không đăng nhập và không thao tác được nữa.`}
            {panel === 'unsuspend' && `Mở khóa tài khoản ${user.email}?`}
            {panel === 'grant' && `Cấp quyền Admin cho ${user.email}? Admin xem được danh sách người dùng và khóa được khách hàng, người bán.`}
            {panel === 'revoke' && `Thu hồi quyền Admin của ${user.email}?`}
          </p>
          {panel === 'revoke' && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              Chuyển về
              <select value={revokeTo} onChange={(e) => setRevokeTo(e.target.value as UserRole)} className="h-9 rounded-lg border border-border bg-surface px-2">
                <option value="customer">{roleLabels.customer}</option>
                <option value="seller">{roleLabels.seller}</option>
              </select>
            </label>
          )}
          {panel !== 'unsuspend' && (
            <label className="mt-2 block text-sm">
              <span>{panel === 'suspend' ? 'Lý do khóa (bắt buộc, người dùng sẽ thấy)' : 'Ghi chú (không bắt buộc)'}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={SUSPEND_REASON_MAX}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
              />
            </label>
          )}
          {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className={button('primary', 'sm')} disabled={busy} onClick={() => void run()}>
              {busy ? 'Đang xử lý...' : 'Xác nhận'}
            </button>
            <button type="button" className={button('ghost', 'sm')} disabled={busy} onClick={() => setPanel(null)}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
