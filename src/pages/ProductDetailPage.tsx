import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Breadcrumbs, button, DemoBadge, EmptyState, Price, QuantityStepper, Rating, ShopAvatar, Skeleton } from '@/components/ui/primitives'
import { categoryById, productTypeLabels } from '@/data/taxonomy'
import { useCart } from '@/features/cart/CartProvider'
import { ProductGrid } from '@/features/catalog/ProductCard'
import { compareFields } from '@/features/compare/compareFields'
import { routineStepOf } from '@/features/routine/routine'
import { formatCompact } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import type { Product } from '@/types/catalog'

export function ProductDetailPage() {
  const { slug = '' } = useParams()
  const state = useAsync(() => catalogService.getProductBySlug(slug), [slug])
  useDocumentTitle(state.status === 'success' ? (state.data?.name ?? 'Không tìm thấy sản phẩm') : undefined)

  if (state.status === 'loading') {
    return (
      <div className="container-page grid gap-8 py-8 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    )
  }
  if (state.status === 'error' || !state.data) {
    return (
      <div className="container-page py-16">
        <EmptyState title="Không tìm thấy sản phẩm" action={<Link to="/products" className={button('primary')}>Xem sản phẩm khác</Link>}>
          Sản phẩm có thể đã ngừng bán hoặc đường dẫn không đúng.
        </EmptyState>
      </div>
    )
  }
  return <ProductDetail product={state.data} />
}

function ProductDetail({ product }: { product: Product }) {
  const { add, quantityOf } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const shop = catalogService.getShopByIdSync(product.shopId)
  const category = categoryById[product.categoryId]
  const step = routineStepOf(product.type)
  const related = useAsync(() => catalogService.getRelatedProducts(product), [product.id])

  const inCart = quantityOf(product.id)
  const canAdd = Math.max(0, product.stock - inCart)
  const rows = compareFields.map((f) => ({ ...f, text: f.value(product) })).filter((f) => !f.optional || f.text)

  const handleAdd = () => {
    add(product.id, Math.min(qty, canAdd))
    setAdded(true)
    setQty(1)
    window.setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="container-page py-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: 'Trang chủ', to: '/' },
          { label: category.name, to: `/products?category=${category.id}` },
          { label: product.name },
        ]}
      />

      <div className="mt-5 grid gap-8 md:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-[28px] border border-border bg-surface-2">
          <div className="aspect-square">
            <ProductImage product={product} eager />
          </div>
          {product.images.length === 0 && (
            <p className="border-t border-border bg-surface px-4 py-2 text-xs text-muted">Hình minh họa. Ảnh thật sẽ do cửa hàng tải lên.</p>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/products?category=${category.id}&types=${product.type}`} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {productTypeLabels[product.type]}
            </Link>
            {step && <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Bước {step.order} · {step.label}</span>}
            <DemoBadge />
          </div>
          <p className="mt-4 text-sm font-semibold text-primary">{product.brandName}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight md:text-3xl">{product.name}</h1>
          <div className="mt-3">
            <Rating value={product.rating} count={product.reviewCount} sold={formatCompact(product.soldCount)} />
          </div>

          <div className="mt-5 rounded-2xl bg-surface-2 p-4">
            <Price price={product.price} originalPrice={product.originalPrice} size="lg" />
            <p className="mt-1 text-xs text-muted">{product.size}</p>
          </div>

          <p className="mt-5 leading-relaxed text-text">{product.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {product.stock > 0 ? (
              <>
                <QuantityStepper value={qty} max={Math.max(1, Math.min(canAdd, 10))} onChange={setQty} />
                <span className="text-sm text-muted">Còn {product.stock} sản phẩm</span>
              </>
            ) : (
              <span className="font-semibold text-danger">Hết hàng</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={button('primary', 'lg')} onClick={handleAdd} disabled={canAdd <= 0}>
              <Icon name="cart" size={18} /> {canAdd <= 0 && product.stock > 0 ? 'Đã có tối đa trong giỏ' : 'Thêm vào giỏ hàng'}
            </button>
            <Link to="/cart" className={button('secondary', 'lg')}>
              Xem giỏ hàng{inCart > 0 && ` (${inCart})`}
            </Link>
          </div>
          <p className="mt-2 h-5 text-sm font-medium text-success" role="status">
            {added ? 'Đã thêm vào giỏ hàng' : ''}
          </p>

          {shop && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <ShopAvatar name={shop.name} color={shop.color} logo={shop.logo} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{shop.name}</p>
                <p className="truncate text-xs text-muted">
                  {shop.rating.toFixed(1)} ★ · {shop.location}
                </p>
              </div>
              <Link to={`/shops/${shop.slug}`} className={button('secondary', 'sm')}>
                Xem shop
              </Link>
            </div>
          )}
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr]" aria-labelledby="spec-heading">
        <div>
          <h2 id="spec-heading" className="text-xl font-bold">Thông tin sản phẩm</h2>
          <dl className="mt-4 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(120px,38%)_1fr] gap-4 px-4 py-3 text-sm">
                <dt className="text-muted">{r.label}</dt>
                <dd>{r.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="h-fit rounded-card border border-border bg-surface p-5 text-sm">
          <h2 className="font-semibold">Lưu ý khi sử dụng</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>Thử sản phẩm mới trên một vùng da nhỏ trước khi dùng toàn mặt.</li>
            <li>Thông tin trên trang là mô tả của cửa hàng, không phải lời khuyên y khoa.</li>
            <li>Nếu da kích ứng kéo dài, hãy ngừng dùng và hỏi ý kiến bác sĩ da liễu.</li>
          </ul>
        </aside>
      </section>

      {related.status === 'success' && related.data.length > 0 && (
        <section className="mt-14" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-bold">Sản phẩm tương tự</h2>
          <div className="mt-4">
            <ProductGrid products={related.data} />
          </div>
        </section>
      )}
    </div>
  )
}
