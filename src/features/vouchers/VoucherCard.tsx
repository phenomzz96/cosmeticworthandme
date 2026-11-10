import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { describeVoucher, voucherService, type Voucher } from '@/services/vouchers'

/** Một thẻ voucher dạng "vé" */
export function VoucherTicket({
  code,
  title,
  detail,
  endsAt,
  scope,
  action,
  muted = false,
}: {
  code: string
  title: string
  detail: string
  endsAt: string
  scope: string
  action?: ReactNode
  muted?: boolean
}) {
  return (
    <div className={`flex overflow-hidden rounded-2xl border border-border bg-surface ${muted ? 'opacity-60' : ''}`}>
      <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-border bg-primary-soft px-2 py-3 text-center text-primary">
        <Icon name="ticket" size={22} />
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide">{scope}</span>
      </div>
      <div className="min-w-0 flex-1 p-3">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-text">{code}</span>
          <span>HSD {formatDate(endsAt)}</span>
        </p>
      </div>
      {action && <div className="flex shrink-0 items-center pr-3">{action}</div>}
    </div>
  )
}

/** Nút "Lưu" voucher vào ví; chưa đăng nhập thì chuyển tới trang đăng nhập */
export function ClaimButton({ code, onClaimed }: { code: string; onClaimed?: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle')
  const click = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
    setState('busy')
    try {
      await voucherService.claim(code)
      setState('done')
      onClaimed?.()
    } catch (e) {
      setState(friendlyError(e))
    }
  }
  if (state === 'done') return <span className="text-xs font-semibold text-success">Đã lưu</span>
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        onClick={() => void click()}
        disabled={state === 'busy'}
        className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-on-ink hover:bg-ink-hover disabled:opacity-50"
        aria-label={`Lưu mã ${code}`}
      >
        Lưu
      </button>
      {state !== 'idle' && state !== 'busy' && <span className="mt-1 max-w-32 text-right text-[11px] text-danger">{state}</span>}
    </span>
  )
}

/** Danh sách voucher đang chạy (của sàn và/hoặc của các shop) kèm nút Lưu */
export function AvailableVouchers({
  shopIds,
  title,
  includePlatform = true,
  excludeCodes = [],
}: {
  shopIds: string[]
  title: string
  includePlatform?: boolean
  /** Mã đã có trong ví thì không hiện lại ở danh sách "đang chạy" */
  excludeCodes?: string[]
}) {
  const state = useAsync(() => voucherService.listAvailable(shopIds).catch(() => [] as Voucher[]), [shopIds.join(',')])
  const list = state.status === 'success' ? state.data.filter((v) => (includePlatform || v.shop_id) && !excludeCodes.includes(v.code)) : []
  if (!list.length) return null
  return (
    <section aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list.map((v) => (
          <li key={v.id}>
            <VoucherTicket
              code={v.code}
              title={v.title}
              detail={describeVoucher(v)}
              endsAt={v.ends_at}
              scope={v.shop_id ? 'Shop' : 'Toàn sàn'}
              action={<ClaimButton code={v.code} />}
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Mã đã lưu nằm trong{' '}
        <Link to="/vouchers" className="underline hover:text-primary">
          Ví voucher
        </Link>
        . Nhập mã ở giỏ hàng để dùng.
      </p>
    </section>
  )
}
