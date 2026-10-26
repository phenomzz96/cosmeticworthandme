import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, DemoBadge, EmptyState, QuantityStepper, ShopAvatar } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { MAX_QTY_PER_ITEM, useCart, type CartItem } from '@/features/cart/CartProvider'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'

export function CartPage() {
  useDocumentTitle('Giỏ hàng')
  const { settings } = useBrand()
  const { items, count, subtotal, setQuantity, remove, clear, isAccountCart, syncing } = useCart()

  if (!items.length) {
    return (
      <div className="container-page py-12">
        <h1 className="text-3xl font-bold tracking-tight">Giỏ hàng</h1>
        <div className="mt-6">
          <EmptyState
            title="Giỏ hàng đang trống"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/products" className={button('primary')}>Xem sản phẩm</Link>
                <Link to="/beauty-finder" className={button('secondary')}>Thử Beauty Finder</Link>
              </div>
            }
          >
            Thêm sản phẩm bạn thích, giỏ hàng sẽ được nhóm theo từng cửa hàng.
          </EmptyState>
        </div>
      </div>
    )
  }

  // Nhóm theo cửa hàng: mỗi cửa hàng là một đơn con khi đặt hàng
  const groups = new Map<string, CartItem[]>()
  items.forEach((i) => groups.set(i.product.shopId, [...(groups.get(i.product.shopId) ?? []), i]))

  const shipping = groups.size * settings.shippingFee

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Giỏ hàng <span className="text-lg font-medium text-muted">({count})</span></h1>
        {isAccountCart ? (
          <span className="text-sm text-muted">{syncing ? 'Đang đồng bộ giỏ hàng...' : 'Giỏ hàng được lưu theo tài khoản của bạn'}</span>
        ) : (
          <DemoBadge>Giỏ hàng lưu trên trình duyệt này. Đăng nhập để lưu theo tài khoản</DemoBadge>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {[...groups.entries()].map(([shopId, lines]) => {
            const shop = catalogService.getShopByIdSync(shopId)
            return (
              <section key={shopId} className="overflow-hidden rounded-card border border-border bg-surface" aria-label={`Sản phẩm của ${shop?.name ?? 'cửa hàng'}`}>
                {shop && (
                  <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <ShopAvatar name={shop.name} color={shop.color} logo={shop.logo} size={30} />
                    <Link to={`/shops/${shop.slug}`} className="font-semibold hover:text-primary">{shop.name}</Link>
                  </header>
                )}
                <ul className="divide-y divide-border">
                  {lines.map(({ product, quantity, lineTotal }) => (
                    <li key={product.id} className="flex gap-4 p-4">
                      <Link to={`/products/${product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-24 sm:w-24">
                        <ProductImage product={product} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-primary">{product.brandName}</p>
                          <Link to={`/products/${product.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
                            {product.name}
                          </Link>
                          <p className="mt-1 text-sm text-muted">{formatPrice(product.price)}</p>
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

        <aside className="h-fit rounded-card border border-border bg-surface p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-semibold">Tóm tắt</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Tạm tính ({count} sản phẩm)</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">
                Phí vận chuyển ({groups.size} cửa hàng × {formatPrice(settings.shippingFee)})
              </dt>
              <dd className="tabular-nums">{settings.shippingFee ? formatPrice(shipping) : 'Miễn phí'}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Tổng tạm tính</dt>
              <dd className="tabular-nums">{formatPrice(subtotal + shipping)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">Mỗi cửa hàng giao riêng một đơn. Giá và phí được tính lại khi đặt hàng.</p>
          <Link to="/checkout" className={`${button('primary', 'lg')} mt-5 w-full`}>Tiếp tục đặt hàng</Link>
        </aside>
      </div>
    </div>
  )
}
