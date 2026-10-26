/**
 * ĐẶT HÀNG — /checkout
 * Trình duyệt chỉ gửi id sản phẩm + số lượng + id địa chỉ + phương thức thanh toán.
 * Database (hàm place_order) tính lại giá, phí vận chuyển, kiểm tra tồn kho rồi mới tạo đơn.
 * Số tiền hiển thị ở đây chỉ là tạm tính để khách xem trước.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, TextAreaField } from '@/components/ui/Form'
import { ProductImage } from '@/components/ui/ProductImage'
import { Breadcrumbs, button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { AddressCard, AddressForm, useAddresses } from '@/features/address/AddressBook'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBrand } from '@/features/brand/BrandProvider'
import { useCart, type CartItem } from '@/features/cart/CartProvider'
import { friendlyError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { addressService } from '@/services/addresses'
import { catalogService } from '@/services/catalog'
import { orderService } from '@/services/orders'
import { paymentMethodLabels, type PaymentMethod } from '@/types/order'

export function CheckoutPage() {
  useDocumentTitle('Đặt hàng')
  const navigate = useNavigate()
  const { settings } = useBrand()
  const { isSuspended } = useAuth()
  const { items, subtotal, syncing, removeOrdered } = useCart()
  const addresses = useAddresses()
  const [addressId, setAddressId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cod')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)

  // Chọn sẵn địa chỉ mặc định
  useEffect(() => {
    if (addresses.status !== 'ready') return
    if (!addressId || !addresses.list.some((a) => a.id === addressId)) setAddressId(addresses.list.find((a) => a.is_default)?.id ?? addresses.list[0]?.id ?? null)
    if (addresses.list.length === 0) setAdding(true)
  }, [addresses.status, addresses.list, addressId])

  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>()
    items.forEach((i) => map.set(i.product.shopId, [...(map.get(i.product.shopId) ?? []), i]))
    return [...map.entries()]
  }, [items])
  const shipping = groups.length * settings.shippingFee

  if (syncing) {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="container-page py-12">
        <EmptyState title="Giỏ hàng đang trống" action={<Link to="/products" className={button('primary')}>Xem sản phẩm</Link>}>
          Thêm sản phẩm vào giỏ rồi quay lại để đặt hàng.
        </EmptyState>
      </div>
    )
  }

  const place = async () => {
    setError(null)
    if (!addressId) {
      setError('Hãy chọn hoặc thêm địa chỉ giao hàng.')
      return
    }
    setPlacing(true)
    try {
      const lines = items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      const result = await orderService.placeOrder({ lines, addressId, paymentMethod: method, note })
      removeOrdered(lines.map((l) => l.productId))
      void catalogService.refresh().catch(() => undefined)
      navigate(`/orders/${result.code}?new=1`, { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Đặt hàng không thành công. Vui lòng thử lại.'))
      // Tồn kho/giá có thể đã đổi: tải lại danh mục để giỏ cập nhật
      void catalogService.refresh().catch(() => undefined)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="container-page py-6 md:py-8">
      <Breadcrumbs items={[{ label: 'Giỏ hàng', to: '/cart' }, { label: 'Đặt hàng' }]} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Đặt hàng</h1>

      {isSuspended && (
        <div className="mt-4">
          <Alert kind="error">Tài khoản đang bị khóa nên không thể đặt hàng.</Alert>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* 1. Địa chỉ */}
          <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="ship-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="ship-heading" className="text-lg font-semibold">
                1. Địa chỉ giao hàng
              </h2>
              {addresses.status === 'ready' && addresses.list.length > 0 && !adding && (
                <button type="button" className={button('ghost', 'sm')} onClick={() => setAdding(true)}>
                  Thêm địa chỉ mới
                </button>
              )}
            </div>
            {addresses.status === 'loading' && <Skeleton className="mt-3 h-20 w-full" />}
            {addresses.status === 'error' && (
              <div className="mt-3">
                <Alert kind="error">{addresses.error}</Alert>
              </div>
            )}
            {addresses.status === 'ready' && addresses.list.length > 0 && (
              <fieldset className="mt-3 space-y-2">
                <legend className="sr-only">Chọn địa chỉ giao hàng</legend>
                {addresses.list.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${addressId === a.id ? 'border-primary bg-primary-soft/40' : 'border-border hover:border-primary'}`}
                  >
                    <input type="radio" name="address" className="mt-1 accent-[var(--primary)]" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <AddressCard address={a} />
                  </label>
                ))}
              </fieldset>
            )}
            {adding && (
              <div className="mt-4 rounded-xl border border-border p-4">
                <AddressForm
                  submitLabel="Lưu và dùng địa chỉ này"
                  disabled={isSuspended}
                  onCancel={addresses.list.length ? () => setAdding(false) : undefined}
                  onSubmit={async (input) => {
                    const created = await addressService.create(input)
                    await addresses.reload()
                    setAddressId(created.id)
                    setAdding(false)
                  }}
                />
              </div>
            )}
          </section>

          {/* 2. Sản phẩm theo cửa hàng */}
          <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="items-heading">
            <h2 id="items-heading" className="text-lg font-semibold">
              2. Sản phẩm ({groups.length} cửa hàng)
            </h2>
            <p className="mt-1 text-sm text-muted">Mỗi cửa hàng giao riêng một đơn, phí vận chuyển tính cho từng đơn.</p>
            <div className="mt-4 space-y-4">
              {groups.map(([shopId, lines]) => {
                const shop = catalogService.getShopByIdSync(shopId)
                const sub = lines.reduce((n, l) => n + l.lineTotal, 0)
                return (
                  <div key={shopId} className="rounded-xl border border-border">
                    <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">{shop?.name ?? 'Cửa hàng'}</p>
                    <ul className="divide-y divide-border px-4">
                      {lines.map((l) => (
                        <li key={l.productId} className="flex items-center gap-3 py-2.5">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                            <ProductImage product={l.product} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium">{l.product.name}</p>
                            <p className="text-xs text-muted">
                              {formatPrice(l.product.price)} × {l.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums">{formatPrice(l.lineTotal)}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="flex justify-between border-t border-border px-4 py-2 text-sm text-muted">
                      <span>Phí vận chuyển</span>
                      <span className="tabular-nums">{settings.shippingFee ? formatPrice(settings.shippingFee) : 'Miễn phí'}</span>
                    </p>
                    <p className="flex justify-between px-4 pb-2.5 text-sm font-semibold">
                      <span>Tổng đơn của shop</span>
                      <span className="tabular-nums">{formatPrice(sub + settings.shippingFee)}</span>
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="mt-4">
              <TextAreaField label="Ghi chú cho người bán (không bắt buộc)" value={note} onChange={setNote} rows={2} maxLength={500} placeholder="Ví dụ: giao giờ hành chính" />
            </div>
          </section>

          {/* 3. Thanh toán */}
          <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="pay-heading">
            <h2 id="pay-heading" className="text-lg font-semibold">
              3. Thanh toán
            </h2>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Phương thức thanh toán</legend>
              {(['cod', 'qr_demo'] as PaymentMethod[]).map((m) => (
                <label key={m} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${method === m ? 'border-primary bg-primary-soft/40' : 'border-border hover:border-primary'}`}>
                  <input type="radio" name="payment" className="mt-1 accent-[var(--primary)]" checked={method === m} onChange={() => setMethod(m)} />
                  <span>
                    <span className="font-medium">{paymentMethodLabels[m]}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {m === 'cod'
                        ? 'Trả tiền mặt cho người giao hàng khi nhận.'
                        : 'Chức năng trình diễn: hiện mã QR mô phỏng, không có giao dịch hay tài khoản ngân hàng thật. Bạn bấm "Tôi đã chuyển khoản", quản trị viên xác nhận, rồi người bán mới giao hàng.'}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
        </div>

        <aside className="h-fit rounded-card border border-border bg-surface p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-semibold">Tóm tắt đơn hàng</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Tạm tính ({items.reduce((n, i) => n + i.quantity, 0)} sản phẩm)</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Phí vận chuyển ({groups.length} đơn)</dt>
              <dd className="tabular-nums">{shipping ? formatPrice(shipping) : 'Miễn phí'}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Tổng thanh toán</dt>
              <dd className="tabular-nums">{formatPrice(subtotal + shipping)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">Giá, phí và tồn kho được hệ thống kiểm tra lại khi bạn bấm Đặt hàng.</p>
          {error && (
            <div className="mt-4">
              <Alert kind="error">{error}</Alert>
            </div>
          )}
          <button type="button" className={`${button('primary', 'lg')} mt-5 w-full`} disabled={placing || isSuspended || !addressId} onClick={() => void place()}>
            {placing ? 'Đang đặt hàng...' : 'Đặt hàng'}
          </button>
          {!addressId && addresses.status === 'ready' && <p className="mt-2 text-center text-xs text-muted">Thêm địa chỉ giao hàng để đặt hàng.</p>}
          <Link to="/cart" className="mt-3 block text-center text-sm text-muted hover:text-primary">
            Quay lại giỏ hàng
          </Link>
        </aside>
      </div>
    </div>
  )
}
