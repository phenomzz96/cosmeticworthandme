import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Price, Rating } from '@/components/ui/primitives'
import { useCart } from '@/features/cart/CartProvider'
import { productTypeLabels } from '@/data/taxonomy'
import { formatCompact } from '@/lib/format'
import { catalogService } from '@/services/catalog'
import type { Product } from '@/types/catalog'

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const { add, quantityOf } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const shop = catalogService.getShopByIdSync(product.shopId)
  const soldOut = product.stock <= 0
  const atLimit = quantityOf(product.id) >= product.stock

  const handleAdd = () => {
    add(product.id, 1)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 1400)
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="relative aspect-square overflow-hidden bg-surface-2">
        <ProductImage product={product} eager={eager} className="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur">
          {productTypeLabels[product.type]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-xs font-medium text-primary">{product.brandName}</p>
        <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-medium leading-snug">
          {/* Link phủ toàn thẻ để bấm vào đâu cũng mở chi tiết */}
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <Rating value={product.rating} sold={formatCompact(product.soldCount)} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price price={product.price} originalPrice={product.originalPrice} />
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut || atLimit}
            className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary hover:bg-primary hover:text-on-primary disabled:opacity-40"
            aria-label={justAdded ? `Đã thêm ${product.name} vào giỏ` : `Thêm ${product.name} vào giỏ`}
            title={soldOut ? 'Hết hàng' : atLimit ? 'Đã đạt số lượng tồn kho' : 'Thêm vào giỏ'}
          >
            <Icon name={justAdded ? 'sparkle' : 'cart'} size={18} />
          </button>
        </div>
        {shop && <p className="truncate text-xs text-muted">{shop.name}</p>}
      </div>
    </article>
  )
}

export function ProductGrid({ products, eagerCount = 0 }: { products: Product[]; eagerCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Đang tải sản phẩm">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="aspect-square animate-pulse bg-surface-2 motion-reduce:animate-none" />
          <div className="space-y-2 p-3.5">
            <div className="h-3 w-1/3 rounded bg-surface-2" />
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-1/2 rounded bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
