import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Price, Rating } from '@/components/ui/primitives'
import { useCart } from '@/features/cart/CartProvider'
import { formatCompact } from '@/lib/format'
import { catalogService } from '@/services/catalog'
import type { Product } from '@/types/catalog'

/** Nhãn trên ảnh — chỉ dựa trên dữ liệu thật: hết hàng, giảm giá, lượt bán, ngày đăng */
export function productBadge(product: Product): { label: string; tone: 'sale' | 'muted' | 'plain' } | null {
  if (product.stock <= 0) return { label: 'Hết hàng', tone: 'muted' }
  if (product.originalPrice && product.originalPrice > product.price) return { label: 'Giảm giá', tone: 'sale' }
  if (product.soldCount >= 10) return { label: 'Bán chạy', tone: 'plain' }
  if (!product.isSample && Date.now() - Date.parse(product.createdAt) < 14 * 86_400_000) return { label: 'Mới', tone: 'plain' }
  return null
}

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const { add, quantityOf } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const shop = catalogService.getShopByIdSync(product.shopId)
  const soldOut = product.stock <= 0
  const atLimit = quantityOf(product.id) >= product.stock
  const badge = productBadge(product)

  const handleAdd = () => {
    add(product.id, 1)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 1400)
  }

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-surface-2">
        <ProductImage
          product={product}
          eager={eager}
          className="transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
        />
        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              badge.tone === 'sale' ? 'bg-sale text-white' : badge.tone === 'muted' ? 'bg-ink/75 text-on-ink' : 'bg-surface/95 text-text'
            }`}
          >
            {badge.label}
          </span>
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={soldOut || atLimit}
          className="absolute bottom-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-surface/95 text-text shadow-card backdrop-blur transition hover:bg-ink hover:text-on-ink disabled:opacity-40 motion-reduce:transition-none"
          aria-label={justAdded ? `Đã thêm ${product.name} vào giỏ` : `Thêm ${product.name} vào giỏ`}
          title={soldOut ? 'Hết hàng' : atLimit ? 'Đã đạt số lượng tồn kho' : 'Thêm vào giỏ'}
        >
          <Icon name={justAdded ? 'check' : 'bag'} size={19} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-0.5 pt-3">
        <Rating value={product.rating} count={product.reviewCount} sold={product.soldCount > 0 ? formatCompact(product.soldCount) : undefined} />
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug">
          {/* Link phủ toàn thẻ để bấm vào đâu cũng mở chi tiết */}
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <p className="truncate text-xs text-muted">
          {product.brandName}
          {shop && <> · {shop.name}</>}
        </p>
        <div className="mt-auto pt-1">
          <Price price={product.price} originalPrice={product.originalPrice} />
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products, eagerCount = 0 }: { products: Product[]; eagerCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id} className="flex">
          <div className="w-full">
            <ProductCard product={p} eager={i < eagerCount} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Đang tải sản phẩm">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="aspect-[4/5] animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none" />
          <div className="space-y-2 pt-3">
            <div className="h-3 w-1/3 rounded bg-surface-2" />
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-1/2 rounded bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
