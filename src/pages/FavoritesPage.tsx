import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs, button, EmptyState, ErrorState } from '@/components/ui/primitives'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { ShopCard } from '@/features/shops/ShopCard'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { socialService } from '@/services/social'

type Tab = 'products' | 'shops'

/** Sản phẩm yêu thích và cửa hàng đang theo dõi của người dùng (mỗi người chỉ thấy danh sách của mình) */
export function FavoritesPage() {
  useDocumentTitle('Yêu thích và theo dõi')
  const [tab, setTab] = useState<Tab>('products')

  const products = useAsync(async () => {
    const ids = await socialService.favoriteProductIds()
    const list = await catalogService.getProductsByIds(ids)
    // Giữ thứ tự "mới thêm trước"; sản phẩm đã ngừng bán không còn trong danh mục thì bỏ qua
    return ids.map((id) => list.find((p) => p.id === id)).filter((p) => p != null)
  }, [])
  const shops = useAsync(async () => {
    const ids = await socialService.followedShopIds()
    const all = await catalogService.getShops()
    return ids.map((id) => all.find((s) => s.id === id)).filter((s) => s != null)
  }, [])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'products', label: 'Sản phẩm yêu thích', count: products.status === 'success' ? products.data.length : undefined },
    { id: 'shops', label: 'Cửa hàng đang theo dõi', count: shops.status === 'success' ? shops.data.length : undefined },
  ]

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản', to: '/account' }, { label: 'Yêu thích và theo dõi' }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Yêu thích và theo dõi</h1>

      <div className="mt-6 flex gap-2 border-b border-border" role="tablist" aria-label="Danh sách của tôi">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === 'products' && (
          <>
            {products.status === 'loading' && <ProductGridSkeleton count={4} />}
            {products.status === 'error' && <ErrorState />}
            {products.status === 'success' &&
              (products.data.length ? (
                <ProductGrid products={products.data} />
              ) : (
                <EmptyState title="Chưa có sản phẩm yêu thích" action={<Link to="/products" className={button('primary')}>Xem sản phẩm</Link>}>
                  Bấm "Yêu thích" trên trang sản phẩm để lưu lại và xem sau.
                </EmptyState>
              ))}
          </>
        )}
        {tab === 'shops' && (
          <>
            {shops.status === 'loading' && <div className="h-40 animate-pulse rounded-card bg-surface-2" />}
            {shops.status === 'error' && <ErrorState />}
            {shops.status === 'success' &&
              (shops.data.length ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shops.data.map((s) => (
                    <li key={s.id}>
                      <ShopCard shop={s} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Chưa theo dõi cửa hàng nào" action={<Link to="/shops" className={button('primary')}>Xem các cửa hàng</Link>}>
                  Bấm "Theo dõi" trên trang cửa hàng để tìm lại nhanh.
                </EmptyState>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
