/** VÍ VOUCHER — /vouchers: mã đã lưu (kể cả mã đã dùng trong đơn) và mã của sàn đang chạy để lưu thêm. */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { Breadcrumbs, button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { AvailableVouchers, VoucherTicket } from '@/features/vouchers/VoucherCard'
import { friendlyError } from '@/lib/errors'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { describeVoucher, voucherService } from '@/services/vouchers'

export function VouchersPage() {
  useDocumentTitle('Ví voucher')
  const [reload, setReload] = useState(0)
  const wallet = useAsync(() => voucherService.wallet(), [reload])
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    try {
      await voucherService.claim(code)
      setMsg({ kind: 'success', text: `Đã lưu mã ${code.trim().toUpperCase()}.` })
      setCode('')
      setReload((n) => n + 1)
    } catch (err) {
      setMsg({ kind: 'error', text: friendlyError(err) })
    }
  }

  const now = Date.now()
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản', to: '/account' }, { label: 'Ví voucher' }]} />
      <p className="eyebrow mt-6">Ưu đãi</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Ví voucher</h1>

      <form onSubmit={save} className="mt-6 flex max-w-md gap-2">
        <label htmlFor="claim-code" className="sr-only">
          Nhập mã để lưu
        </label>
        <input
          id="claim-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Nhập mã để lưu vào ví"
          maxLength={20}
          className="h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-4 text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal focus:border-text focus:outline-none"
        />
        <button type="submit" className={button('dark')}>
          Lưu mã
        </button>
      </form>
      {msg && (
        <div className="mt-3 max-w-md">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      <section className="mt-10" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="font-display text-3xl font-semibold">
          Mã đã lưu
        </h2>
        <div className="mt-4">
          {wallet.status === 'loading' && <Skeleton className="h-24 w-full" />}
          {wallet.status === 'error' && <Alert kind="error">Không tải được ví voucher.</Alert>}
          {wallet.status === 'success' &&
            (wallet.data.length ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {wallet.data.map((v) => {
                  const expired = Date.parse(v.ends_at) <= now
                  const usedUp = v.my_used >= v.per_user_limit
                  const status = expired ? 'Hết hạn' : v.exhausted ? 'Hết lượt' : usedUp ? 'Đã dùng' : null
                  return (
                    <li key={v.id}>
                      <VoucherTicket
                        code={v.code}
                        title={v.title}
                        detail={`${describeVoucher(v)}${v.shop_name ? ` · ${v.shop_name}` : ''}`}
                        endsAt={v.ends_at}
                        scope={v.shop_id ? 'Shop' : 'Toàn sàn'}
                        muted={Boolean(status)}
                        action={
                          status ? (
                            <span className="text-xs font-medium text-muted">{status}</span>
                          ) : v.shop_slug ? (
                            <Link to={`/shops/${v.shop_slug}`} className="text-xs font-medium text-primary hover:underline">
                              Mua ngay
                            </Link>
                          ) : (
                            <Link to="/products" className="text-xs font-medium text-primary hover:underline">
                              Mua ngay
                            </Link>
                          )
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="Ví voucher đang trống">Lưu mã bên dưới hoặc ở trang cửa hàng, rồi nhập mã ở giỏ hàng khi đặt hàng.</EmptyState>
            ))}
        </div>
      </section>

      <div className="mt-10">
        <AvailableVouchers
          key={reload}
          shopIds={[]}
          title="Mã toàn sàn đang chạy"
          excludeCodes={wallet.status === 'success' ? wallet.data.map((v) => v.code) : []}
        />
      </div>
    </div>
  )
}
