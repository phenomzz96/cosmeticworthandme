import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Breadcrumbs, button, EmptyState, ShopAvatar, Skeleton } from '@/components/ui/primitives'
import { categories } from '@/data/taxonomy'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { ShopCard } from '@/features/shops/ShopCard'
import { formatCompact } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import type { CategoryId, Shop } from '@/types/catalog'

export function ShopPage() {
  const { slug = '' } = useParams()
  const state = useAsync(() => catalogService.getShopBySlug(slug), [slug])
  useDocumentTitle(state.status === 'success' ? (state.data?.name ?? 'Không tìm thấy cửa hàng') : undefined)

  if (state.status === 'loading') {
    return (
      <div className="container-page py-8">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (state.status === 'error' || !state.data) {
    return (
      <div className="container-page py-16">
        <EmptyState title="Không tìm thấy cửa hàng" action={<Link to="/shops" className={button('primary')}>Xem các cửa hàng</Link>} />
      </div>
    )
  }
  return <ShopView shop={state.data} />
}

function ShopView({ shop }: { shop: Shop }) {
  const [category, setCategory] = useState<CategoryId | undefined>()
  const products = useAsync(() => catalogService.getProducts({ shopId: shop.id, category }), [shop.id, category])
  const allShopProducts = useAsync(() => catalogService.getProducts({ shopId: shop.id }), [shop.id])
  const shopCategories =
    allShopProducts.status === 'success' ? categories.filter((c) => allShopProducts.data.some((p) => p.categoryId === c.id)) : []

  return (
    <div>
      <div className="border-b border-border bg-surface">
        {shop.cover ? (
          <img src={shop.cover} alt="" className="h-28 w-full object-cover md:h-40" />
        ) : (
          <div className="h-28 md:h-40" style={{ background: `linear-gradient(120deg, ${shop.color}55, ${shop.color}22 60%, transparent)` }} />
        )}
        <div className="container-page -mt-10 flex flex-col gap-4 pb-6 md:-mt-12 md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-4">
            <span className="rounded-full border-4 border-surface">
              <ShopAvatar name={shop.name} color={shop.color} logo={shop.logo} size={88} />
            </span>
            <div className="pb-1">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                {shop.name}
                {shop.verified && <Icon name="shield" size={22} className="text-success" label="Gian hàng đã xác minh (mẫu)" />}
              </h1>
              <p className="text-sm text-muted">{shop.tagline}</p>
            </div>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-muted">Đánh giá</dt>
              <dd className="font-semibold">{shop.rating > 0 ? `${shop.rating.toFixed(1)} / 5` : 'Chưa có'}</dd>
            </div>
            <div>
              <dt className="text-muted">Người theo dõi</dt>
              <dd className="font-semibold">{formatCompact(shop.followerCount)}</dd>
            </div>
            {shop.location && (
              <div>
                <dt className="text-muted">Khu vực</dt>
                <dd className="font-semibold">{shop.location}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="container-page py-6">
        <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Cửa hàng', to: '/shops' }, { label: shop.name }]} />
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
          <p className="max-w-3xl whitespace-pre-line text-muted">{shop.description}</p>
          {(shop.policy || shop.contactEmail || shop.contactPhone) && (
            <aside className="space-y-3 rounded-card border border-border bg-surface p-4 text-sm">
              {shop.policy && (
                <details>
                  <summary className="cursor-pointer font-semibold">Chính sách cửa hàng</summary>
                  <p className="mt-2 whitespace-pre-line text-muted">{shop.policy}</p>
                </details>
              )}
              {(shop.contactEmail || shop.contactPhone) && (
                <div>
                  <p className="font-semibold">Liên hệ cửa hàng</p>
                  {shop.contactEmail && (
                    <a href={`mailto:${shop.contactEmail}`} className="mt-1 block text-primary hover:underline">
                      {shop.contactEmail}
                    </a>
                  )}
                  {shop.contactPhone && (
                    <a href={`tel:${shop.contactPhone}`} className="mt-1 block text-primary hover:underline">
                      {shop.contactPhone}
                    </a>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Lọc sản phẩm của shop">
          <Chip on={!category} onClick={() => setCategory(undefined)}>
            Tất cả
          </Chip>
          {shopCategories.map((c) => (
            <Chip key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>

        <div className="mt-5">
          {products.status === 'loading' && <ProductGridSkeleton count={4} />}
          {products.status === 'success' &&
            (products.data.length ? <ProductGrid products={products.data} /> : <EmptyState title="Cửa hàng chưa có sản phẩm trong mục này" />)}
        </div>
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm ${on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`}
    >
      {children}
    </button>
  )
}

export function ShopsPage() {
  useDocumentTitle('Cửa hàng')
  const shops = useAsync(() => catalogService.getShops(), [])
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Cửa hàng' }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Cửa hàng</h1>
      <p className="mt-1 text-muted">Các cửa hàng đã được duyệt và đang bán trên sàn.{isSupabaseConfigured ? '' : ' Đang hiển thị dữ liệu mẫu (chưa kết nối Supabase).'}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shops.status === 'success' &&
          shops.data.map((s) => (
            <li key={s.id}>
              <ShopCard shop={s} />
            </li>
          ))}
      </ul>
    </div>
  )
}
