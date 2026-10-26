import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ShopAvatar } from '@/components/ui/primitives'
import { formatCompact } from '@/lib/format'
import { catalogService } from '@/services/catalog'
import type { Shop } from '@/types/catalog'

export function ShopCard({ shop }: { shop: Shop }) {
  const productCount = catalogService.countProductsByShop(shop.id)
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card hover:border-primary">
      <div className="flex items-center gap-3">
        <ShopAvatar name={shop.name} color={shop.color} logo={shop.logo} />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Link to={`/shops/${shop.slug}`} className="truncate after:absolute after:inset-0 after:content-['']">
              {shop.name}
            </Link>
            {shop.verified && <Icon name="shield" size={16} className="shrink-0 text-success" label="Gian hàng đã xác minh (mẫu)" />}
          </h3>
          <p className="truncate text-xs text-muted">{shop.location}</p>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted">{shop.tagline}</p>
      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
        <div>
          <dt className="text-muted">Đánh giá</dt>
          <dd className="font-semibold">{shop.rating.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted">Sản phẩm</dt>
          <dd className="font-semibold">{productCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Theo dõi</dt>
          <dd className="font-semibold">{formatCompact(shop.followerCount)}</dd>
        </div>
      </dl>
    </article>
  )
}
