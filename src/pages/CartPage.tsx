import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, DemoBadge, EmptyState, QuantityStepper, ShopAvatar } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { MAX_QTY_PER_ITEM, useCart, type CartItem } from '@/features/cart/CartProvider'
import { VoucherBox } from '@/features/vouchers/VoucherBox'
import { readCheckoutSelection, writeCheckoutSelection } from '@/lib/checkoutSelection'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import type { VoucherPreview } from '@/services/vouchers'

export function CartPage() {
  useDocumentTitle('Giỏ hàng')
  const { settings } = useBrand()
  const navigate = useNavigate()
  const { items, count, setQuantity, remove, clear, isAccountCart, syncing, adjustments, dismissAdjustments } = useCart()
  const notice = adjustments.length > 0 && <CartAdjustments notes={adjustments} onClose={dismissAdjustments} />

  // Sản phẩm được chọn để thanh toán (mặc định: tất cả). Lưu trong phiên để quay lại giỏ vẫn giữ.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const saved = readCheckoutSelection().productIds
    return new Set(saved ?? items.map((i) => i.productId))
  })
  const [codes, setCodes] = useState<string[]>(() => readCheckoutSelection().voucherCodes)
  const [preview, setPreview] = useState<VoucherPreview | null>(null)

  // Sản phẩm mới thêm vào giỏ: chọn sẵn; sản phẩm đã bỏ khỏi giỏ: bỏ chọn
  const idsKey = items.map((i) => i.productId).join(',')
  const [knownIds, setKnownIds] = useState<string[]>(() => items.map((i) => i.productId))
  useEffect(() => {
    const ids = items.map((i) => i.productId)
    setSelected((cur) => new Set([...[...cur].filter((id) => ids.includes(id)), ...ids.filter((id) => !knownIds.includes(id))]))
    setKnownIds(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>()
    items.forEach((i) => map.set(i.product.shopId, [...(map.get(i.product.shopId) ?? []), i]))
    return map
  }, [items])

  const chosen = items.filter((i) => selected.has(i.productId))
  const chosenShops = new Set(chosen.map((i) => i.product.shopId))
  const subtotal = chosen.reduce((n, i) => n + i.lineTotal, 0)
  const shipping = chosenShops.size * settings.shippingFee
  const discount = preview ? preview.items_subtotal - preview.after_discount : 0
  const lines = chosen.map((i) => ({ productId: i.productId, quantity: i.quantity, shopId: i.product.shopId }))

  const toggle = (ids: string[], on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const goCheckout = () => {
    writeCheckoutSelection({ productIds: [...selected], voucherCodes: codes })
    navigate('/checkout')
  }

  if (!items.length) {
    return (
      <div className="container-page py-12">
        <h1 className="text-4xl">Giỏ hàng</h1>
        {notice}
        <div className="mt-6">
          <EmptyState
            title="Giỏ hàng đang trống"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/products" className={button('dark')}>
                  Xem sản phẩm
                </Link>
                <Link to="/beauty-finder" className={button('secondary')}>
                  Thử Beauty Finder
                </Link>
              </div>
            }
          >
            Thêm sản phẩm bạn thích, giỏ hàng sẽ được nhóm theo từng cửa hàng.
          </EmptyState>
        </div>
      </div>
    )
  }

  const allOn = items.every((i) => selected.has(i.productId))

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Giỏ hàng</p>
          <h1 className="mt-2 text-4xl md:text-5xl">
            Giỏ hàng <span className="font-sans text-lg font-normal text-muted">({count})</span>
          </h1>
        </div>
        {isAccountCart ? (
          <span className="text-sm text-muted">{syncing ? 'Đang đồng bộ giỏ hàng...' : 'Giỏ hàng được lưu theo tài khoản của bạn'}</span>
        ) : (
          <DemoBadge>Giỏ hàng lưu trên trình duyệt này. Đăng nhập để lưu theo tài khoản</DemoBadge>
        )}
      </div>

      {notice}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm">
            <input type="checkbox" checked={allOn} onChange={(e) => toggle(items.map((i) => i.productId), e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Chọn tất cả ({items.length} sản phẩm)
          </label>

          {[...groups.entries()].map(([shopId, shopLines]) => {
            const shop = catalogService.getShopByIdSync(shopId)
            const shopOn = shopLines.every((l) => selected.has(l.productId))
            return (
              <section key={shopId} className="overflow-hidden rounded-card border border-border bg-surface" aria-label={`Sản phẩm của ${shop?.name ?? 'cửa hàng'}`}>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={shopOn}
                    onChange={(e) => toggle(shopLines.map((l) => l.productId), e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                    aria-label={`Chọn tất cả sản phẩm của ${shop?.name ?? 'cửa hàng'}`}
                  />
                  {shop && (
                    <>
                      <ShopAvatar name={shop.name} color={shop.color} logo={shop.logo} size={28} />
                      <Link to={`/shops/${shop.slug}`} className="font-semibold hover:text-primary">
                        {shop.name}
                      </Link>
                    </>
                  )}
                </header>
                <ul className="divide-y divide-border">
                  {shopLines.map(({ product, quantity, lineTotal }) => (
                    <li key={product.id} className="flex gap-3 p-4 sm:gap-4">
                      <input
                        type="checkbox"
                        checked={selected.has(product.id)}
                        onChange={(e) => toggle([product.id], e.target.checked)}
                        className="mt-8 h-4 w-4 shrink-0 accent-[var(--primary)]"
                        aria-label={`Chọn ${product.name} để thanh toán`}
                      />
                      <Link to={`/products/${product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-24 sm:w-24">
                        <ProductImage product={product} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs text-muted">{product.brandName}</p>
                          <Link to={`/products/${product.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
                            {product.name}
                          </Link>
                          <p className="mt-1 text-sm text-muted">{formatPrice(product.price)}</p>
                          {product.stock <= 5 && <p className="mt-0.5 text-xs text-sale">Chỉ còn {product.stock} sản phẩm</p>}
                        </div>
                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                          <QuantityStepper
                            value={quantity}
                            max={Math.min(product.stock, MAX_QTY_PER_ITEM)}
                            onChange={(v) => setQuantity(product.id, v)}
                            label={`Số lượng ${product.name}`}
                          />
                          <p className="font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
                          <button
                            type="button"
                            onClick={() => remove(product.id)}
                            className="ml-auto inline-flex items-center gap-1 text-sm text-muted hover:text-danger sm:ml-0"
                            aria-label={`Xóa ${product.name} khỏi giỏ`}
                          >
                            <Icon name="trash" size={16} /> Xóa
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <button type="button" onClick={clear} className="text-sm text-muted hover:text-danger">
            Xóa toàn bộ giỏ hàng
          </button>
        </div>

        <aside className="h-fit space-y-5 rounded-card border border-border bg-surface p-5 lg:sticky lg:top-40">
          <div>
            <h2 className="font-display text-2xl font-semibold">Mã giảm giá</h2>
            <div className="mt-3">
              <VoucherBox lines={lines} codes={codes} onCodesChange={setCodes} onPreview={setPreview} />
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <h2 className="font-display text-2xl font-semibold">Tóm tắt</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Tạm tính ({chosen.reduce((n, i) => n + i.quantity, 0)} sản phẩm đã chọn)</dt>
                <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">
                  Phí vận chuyển ({chosenShops.size} cửa hàng × {formatPrice(settings.shippingFee)})
                </dt>
                <dd className="tabular-nums">{settings.shippingFee ? formatPrice(shipping) : 'Miễn phí'}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between gap-3 text-success">
                  <dt>Giảm giá</dt>
                  <dd className="tabular-nums">−{formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <dt>Tổng tạm tính</dt>
                <dd className="tabular-nums">{formatPrice(Math.max(0, subtotal + shipping - discount))}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">Mỗi cửa hàng giao riêng một đơn. Giá, phí và giảm giá được tính lại khi đặt hàng.</p>
            <button type="button" className={`${button('dark', 'lg')} mt-5 w-full`} onClick={goCheckout} disabled={!chosen.length}>
              {chosen.length ? `Đặt hàng (${chosen.length})` : 'Chọn sản phẩm để đặt hàng'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Báo khách những thay đổi giỏ do cửa hàng cập nhật (không âm thầm xóa) */
function CartAdjustments({ notes, onClose }: { notes: string[]; onClose: () => void }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-card border border-sale/30 bg-sale/5 px-4 py-3 text-sm" role="status">
      <Icon name="info" size={18} className="mt-0.5 shrink-0 text-sale" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Giỏ hàng vừa được cập nhật theo cửa hàng</p>
        <ul className="mt-1 space-y-0.5 text-muted">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-surface-2" aria-label="Đóng thông báo">
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
