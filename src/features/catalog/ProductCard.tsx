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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-pop motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[5/6] overflow-hidden bg-surface-2">
        <ProductImage
          product={product}
          eager={eager}
          className="transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
        />
        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
              badge.tone === 'sale' ? 'bg-sale text-white' : badge.tone === 'muted' ? 'bg-ink/80 text-on-ink' : 'bg-surface/95 text-text'
            }`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-4 pt-3 sm:px-4">
        <p className="truncate text-xs text-muted">
          {product.brandName}
          {shop && <> · {shop.name}</>}
        </p>
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug">
          {/* Link phủ toàn thẻ để bấm vào đâu cũng mở chi tiết */}
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <Rating value={product.rating} count={product.reviewCount} sold={product.soldCount > 0 ? formatCompact(product.soldCount) : undefined} />
        <div className="pt-0.5">
          <Price price={product.price} originalPrice={product.originalPrice} />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={soldOut || atLimit}
          className="relative z-10 mt-auto inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-control bg-ink text-[13px] font-semibold text-on-ink transition-[background-color,transform] duration-150 hover:bg-ink-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none sm:text-sm"
          aria-label={justAdded ? `Đã thêm ${product.name} vào giỏ` : `Thêm ${product.name} vào giỏ`}
          title={soldOut ? 'Hết hàng' : atLimit ? 'Đã đạt số lượng tồn kho' : 'Thêm vào giỏ'}
        >
          <Icon name={justAdded ? 'check' : 'bag'} size={16} />
          {soldOut ? 'Hết hàng' : justAdded ? 'Đã thêm' : atLimit ? 'Đã đủ số lượng' : 'Thêm vào giỏ'}
        </button>
      </div>
    </article>
  )
}

export function ProductGrid({ products, eagerCount = 0 }: { products: Product[]; eagerCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
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
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Đang tải sản phẩm">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="aspect-[5/6] animate-pulse bg-surface-2 motion-reduce:animate-none" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 rounded bg-surface-2" />
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-1/2 rounded bg-surface-2" />
            <div className="mt-3 h-10 w-full rounded-control bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
