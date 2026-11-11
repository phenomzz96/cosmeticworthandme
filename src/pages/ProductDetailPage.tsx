import { ScrollRow } from '@/components/ui/ScrollRow'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { AskShopButton } from '@/features/messages/AskShopButton'
import { Breadcrumbs, button, DemoBadge, EmptyState, Price, QuantityStepper, Rating, ShopAvatar, Skeleton } from '@/components/ui/primitives'
import { categoryById, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import { useBrand } from '@/features/brand/BrandProvider'
import { useCart } from '@/features/cart/CartProvider'
import { productBadge, ProductGrid } from '@/features/catalog/ProductCard'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { compareFields } from '@/features/compare/compareFields'
import { ReviewsSection } from '@/features/reviews/ReviewsSection'
import { routineStepOf } from '@/features/routine/routine'
import { FavoriteButton } from '@/features/social/SocialButtons'
import { isRoutineReady, routineRows } from '@/features/skincare-3d/routineFields'
import { writeCheckoutSelection } from '@/lib/checkoutSelection'
import { formatCompact, formatPrice } from '@/lib/format'
import { COMPARE_KEY, COMPARE_MAX, pushFront, RECENTLY_VIEWED_KEY, removeItem, writeList } from '@/lib/localList'
import { useAsync } from '@/lib/useAsync'
import { useLocalList } from '@/lib/useLocalList'
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

function ProductDetail({ product: initial }: { product: Product }) {
  // Dùng bản mới nhất trong danh mục (điểm đánh giá, lượt bán thay đổi sau khi tải lại danh mục)
  useCatalogVersion()
  const product = catalogService.getProductByIdSync(initial.id) ?? initial
  const { add, quantityOf } = useCart()
  const { settings } = useBrand()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [tab, setTab] = useState<'desc' | 'ingredients' | 'usage' | 'spec'>('desc')
  const shop = catalogService.getShopByIdSync(product.shopId)
  const category = categoryById[product.categoryId]
  const step = routineStepOf(product.type)
  const related = useAsync(() => catalogService.getRelatedProducts(product), [product.id])
  const badge = productBadge(product)

  // Lưu "đã xem gần đây" (trên trình duyệt này)
  useEffect(() => {
    pushFront(RECENTLY_VIEWED_KEY, product.id, 12)
    setImageIndex(0)
  }, [product.id])

  const inCart = quantityOf(product.id)
  const canAdd = Math.max(0, product.stock - inCart)
  const rows = [
    ...compareFields.map((f) => ({ ...f, text: f.value(product) })).filter((f) => !f.optional || f.text),
    ...routineRows(product),
  ]
  const routineReady = isRoutineReady(product)

  const handleAdd = () => {
    add(product.id, Math.min(qty, canAdd))
    setAdded(true)
    setQty(1)
    window.setTimeout(() => setAdded(false), 2000)
  }

  // Mua ngay: thêm vào giỏ rồi chuyển thẳng tới trang đặt hàng, chỉ thanh toán sản phẩm này
  const buyNow = () => {
    if (canAdd > 0) add(product.id, Math.min(qty, canAdd))
    writeCheckoutSelection({ productIds: [product.id], voucherCodes: [] })
    navigate('/checkout')
  }

  const tabs = [
    { id: 'desc' as const, label: 'Mô tả' },
    ...(product.keyIngredients.length ? [{ id: 'ingredients' as const, label: 'Thành phần chính' }] : []),
    ...(product.howToUse ? [{ id: 'usage' as const, label: 'Cách dùng' }] : []),
    { id: 'spec' as const, label: 'Thông tin chi tiết' },
  ]

  return (
    <div className="container-page py-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: 'Trang chủ', to: '/' },
          { label: category.name, to: `/products?category=${category.id}` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-8 md:grid-cols-2 lg:gap-14">
        {/* Ảnh sản phẩm */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[28px] bg-surface-2">
            <div className="aspect-[4/5]">
              <ProductImage product={product} index={imageIndex} eager />
            </div>
          </div>
          {product.images.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Ảnh sản phẩm">
              {product.images.map((_, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    aria-pressed={i === imageIndex}
                    className={`block aspect-square w-full overflow-hidden rounded-xl border-2 bg-surface-2 ${i === imageIndex ? 'border-ink' : 'border-transparent opacity-80 hover:opacity-100'}`}
                  >
                    <ProductImage product={product} index={i} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {product.images.length === 0 && <p className="mt-2 text-xs text-muted">Hình minh họa. Ảnh thật sẽ do cửa hàng tải lên.</p>}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {badge && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badge.tone === 'sale' ? 'bg-sale/10 text-sale' : 'bg-primary-soft text-primary'}`}>
                {badge.label}
              </span>
            )}
            <Link to={`/products?category=${category.id}&types=${product.type}`} className="rounded-full border border-border px-3 py-1 text-xs hover:border-text">
              {productTypeLabels[product.type]}
            </Link>
            {step && <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Bước {step.order} · {step.label}</span>}
            {product.isSample && <DemoBadge />}
          </div>
          <p className="eyebrow mt-5">{product.brandName}</p>
          <h1 className="mt-2 text-4xl md:text-5xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href="#reviews" className="inline-block hover:underline">
              <Rating value={product.rating} count={product.reviewCount} sold={product.soldCount > 0 ? formatCompact(product.soldCount) : undefined} />
            </a>
            {product.size && <span className="text-xs text-muted">Dung tích: {product.size}</span>}
          </div>

          <p className="mt-5 text-lg leading-relaxed text-muted">{product.description}</p>

          <div className="mt-6">
            <Price price={product.price} originalPrice={product.originalPrice} size="lg" />
          </div>

          {product.skinTypes.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Loại da phù hợp">
              {product.skinTypes.map((t) => (
                <li key={t} className="rounded-full border border-border bg-surface px-3 py-1 text-xs">
                  {skinTypeLabels[t]}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {product.stock > 0 ? (
              <>
                <QuantityStepper value={qty} max={Math.max(1, Math.min(canAdd, 10))} onChange={setQty} />
                <button type="button" className={`${button('dark', 'lg')} min-w-52 flex-1`} onClick={handleAdd} disabled={canAdd <= 0}>
                  {canAdd <= 0 ? 'Đã có tối đa trong giỏ' : 'Thêm vào giỏ hàng'}
                </button>
              </>
            ) : (
              <span className="font-semibold text-danger">Hết hàng</span>
            )}
          </div>
          {product.stock > 0 && (
            <button type="button" className={`${button('secondary', 'lg')} mt-3 w-full`} onClick={buyNow}>
              Mua ngay
            </button>
          )}
          <p className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 text-sm" role="status">
            {product.stock > 0 && product.stock <= 10 && <span className="text-muted">Chỉ còn {product.stock} sản phẩm</span>}
            {added && (
              <span className="font-medium text-success">
                Đã thêm vào giỏ hàng ·{' '}
                <Link to="/cart" className="underline">
                  Xem giỏ ({inCart})
                </Link>
              </span>
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <FavoriteButton productId={product.id} size="sm" />
            <CompareButton productId={product.id} />
            <ShareButton name={product.name} />
          </div>

          {/* Giao hàng, đổi trả — lấy từ cài đặt sàn và chính sách của shop */}
          <ul className="mt-6 space-y-3 rounded-card bg-surface p-5 text-sm shadow-card">
            <li className="flex items-start gap-3">
              <Icon name="truck" size={18} className="mt-0.5 shrink-0 text-primary" />
              <span>
                {settings.shippingFee > 0 ? `Phí giao hàng ${formatPrice(settings.shippingFee)} cho mỗi cửa hàng trong đơn` : 'Miễn phí giao hàng'} · thanh toán khi nhận hàng
                (COD)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Icon name="return" size={18} className="mt-0.5 shrink-0 text-primary" />
              <span>
                Đổi trả theo chính sách của cửa hàng
                {shop && (
                  <>
                    {' '}
                    ·{' '}
                    <Link to={`/shops/${shop.slug}#policy`} className="underline hover:text-primary">
                      xem chính sách
                    </Link>
                  </>
                )}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-primary" />
              <span>Cửa hàng đã được sàn duyệt · giá và tồn kho được kiểm tra lại khi đặt hàng</span>
            </li>
          </ul>

          {shop && (
            <div className="mt-4 rounded-card border border-border p-4">
              <div className="flex items-center gap-3">
                <ShopAvatar name={shop.name} color={shop.color} logo={shop.logo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{shop.name}</p>
                  <p className="truncate text-xs text-muted">
                    {shop.rating > 0 ? `${shop.rating.toFixed(1)} ★` : 'Chưa có đánh giá'}
                    {shop.location && ` · ${shop.location}`}
                  </p>
                </div>
                <Link to={`/shops/${shop.slug}`} className={button('secondary', 'sm')}>
                  Xem shop
                </Link>
              </div>
              <AskShopButton shopId={shop.id} shopName={shop.name} productId={product.id} productName={product.name} variant="ghost" className="mt-2" />
            </div>
          )}
        </div>
      </div>

      {/* Mô tả / Thành phần / Cách dùng / Thông tin */}
      <section className="mt-16" aria-label="Chi tiết sản phẩm">
        <ScrollRow role="tablist" aria-label="Chi tiết sản phẩm" className="flex gap-7 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px shrink-0 border-b-2 pb-3 text-[15px] ${tab === t.id ? 'border-ink font-medium text-text' : 'border-transparent text-muted hover:text-text'}`}
            >
              {t.label}
            </button>
          ))}
        </ScrollRow>
        <div className="grid gap-8 pt-6 lg:grid-cols-[1.4fr_1fr]">
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-w-0 leading-relaxed">
            {tab === 'desc' && <p className="whitespace-pre-line">{product.description}</p>}
            {tab === 'ingredients' && (
              <ul className="flex flex-wrap gap-2">
                {product.keyIngredients.map((i) => (
                  <li key={i} className="rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary">
                    {i}
                  </li>
                ))}
              </ul>
            )}
            {tab === 'usage' && <p className="whitespace-pre-line">{product.howToUse}</p>}
            {tab === 'spec' && (
              <dl className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                {rows.map((r) => (
                  <div key={r.key} className="grid grid-cols-[minmax(120px,38%)_1fr] gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted">{r.label}</dt>
                    <dd>{r.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <aside className="h-fit min-w-0 rounded-card border border-border bg-surface p-5 text-sm">
            <h2 className="font-semibold">Lưu ý khi sử dụng</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
              <li>Thử sản phẩm mới trên một vùng da nhỏ trước khi dùng toàn mặt.</li>
              <li>Thông tin trên trang là mô tả của cửa hàng, không phải lời khuyên y khoa.</li>
              <li>Nếu da kích ứng kéo dài, hãy ngừng dùng và hỏi ý kiến bác sĩ da liễu.</li>
            </ul>
            {routineReady && (
              <Link to={`/skincare-architect?pick=${product.id}`} className={`${button('secondary', 'sm')} mt-4 w-full whitespace-normal text-center`}>
                <Icon name="sparkle" size={14} /> Xếp vào chu trình Skincare Architect 3D
              </Link>
            )}
          </aside>
        </div>
      </section>

      <ReviewsSection product={product} />

      {related.status === 'success' && related.data.length > 0 && (
        <section className="mt-20" aria-labelledby="related-heading">
          <h2 id="related-heading" className="section-title">
            Có thể bạn cũng thích
          </h2>
          <div className="mt-8">
            <ProductGrid products={related.data} />
          </div>
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </div>
  )
}

function ShareButton({ name }: { name: string }) {
  const [done, setDone] = useState(false)
  const share = async () => {
    const url = window.location.href.split('#')[0]
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setDone(true)
      window.setTimeout(() => setDone(false), 2000)
    } catch {
      /* người dùng hủy chia sẻ */
    }
  }
  return (
    <button type="button" className={button('ghost', 'sm')} onClick={() => void share()}>
      <Icon name={done ? 'check' : 'share'} size={16} /> {done ? 'Đã sao chép liên kết' : 'Chia sẻ'}
    </button>
  )
}

function CompareButton({ productId }: { productId: string }) {
  const list = useLocalList(COMPARE_KEY)
  const on = list.includes(productId)
  const full = !on && list.length >= COMPARE_MAX
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={button('ghost', 'sm')}
        aria-pressed={on}
        disabled={full}
        title={full ? `So sánh tối đa ${COMPARE_MAX} sản phẩm` : undefined}
        onClick={() => (on ? removeItem(COMPARE_KEY, productId) : writeList(COMPARE_KEY, [...list, productId]))}
      >
        <Icon name={on ? 'check' : 'compare'} size={16} /> {on ? 'Đã thêm so sánh' : 'So sánh'}
      </button>
      {list.length > 0 && (
        <Link to="/compare" className="text-sm font-medium text-primary hover:underline">
          Xem so sánh ({list.length})
        </Link>
      )}
    </span>
  )
}

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const ids = useLocalList(RECENTLY_VIEWED_KEY)
  useCatalogVersion()
  const items = ids
    .filter((id) => id !== excludeId)
    .map((id) => catalogService.getProductByIdSync(id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 4)
  if (!items.length) return null
  return (
    <section className="mt-20" aria-labelledby="recent-heading">
      <div className="flex items-end justify-between gap-4">
        <h2 id="recent-heading" className="section-title">
          Đã xem gần đây
        </h2>
        <button type="button" className="text-sm text-muted hover:text-text" onClick={() => writeList(RECENTLY_VIEWED_KEY, excludeId ? [excludeId] : [])}>
          Xóa lịch sử xem
        </button>
      </div>
      <div className="mt-8">
        <ProductGrid products={items} />
      </div>
    </section>
  )
}
