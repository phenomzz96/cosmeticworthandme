import { ScrollRow } from '@/components/ui/ScrollRow'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { categories, productTypeLabels, typesByCategory } from '@/data/taxonomy'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { catalogService } from '@/services/catalog'
import type { CategoryId, ProductVisual } from '@/types/catalog'

/** Hình minh họa nhỏ cho từng danh mục (màu bao bì minh họa, cùng loại dữ liệu mẫu) */
const panelVisual: Record<CategoryId, ProductVisual> = {
  skincare: { shape: 'dropper', color: '#E7DDEE', cap: '#6E5585' },
  makeup: { shape: 'lipstick', color: '#B4555A', cap: '#2B2126' },
  haircare: { shape: 'pump', color: '#E4E9D6', cap: '#7D8A55' },
  'body-care': { shape: 'jar', color: '#F3E3D3', cap: '#C08A5B' },
  fragrance: { shape: 'perfume', color: '#F0D3DE', cap: '#B8924A' },
  men: { shape: 'tube', color: '#3A3F44', cap: '#9DB4C0' },
  'beauty-tools': { shape: 'brush', color: '#E9DED3', cap: '#3E3846' },
}

const itemClass = (active: boolean) =>
  `relative inline-flex items-center gap-1 whitespace-nowrap py-3 text-sm transition-colors motion-reduce:transition-none xl:text-[15px] ${
    active ? 'text-primary' : 'text-text/80 hover:text-text'
  }`

/**
 * Thanh danh mục trên máy tính: rê chuột (hoặc Tab tới) một danh mục để mở bảng loại sản phẩm và thương hiệu.
 * Mỗi mục vẫn là liên kết bình thường, bấm là tới danh mục.
 */
export function MegaMenu() {
  useCatalogVersion()
  const location = useLocation()
  const [params] = useSearchParams()
  const activeCategory = location.pathname === '/products' ? params.get('category') : null
  const [open, setOpen] = useState<CategoryId | null>(null)
  const timer = useRef<number>(0)

  useEffect(() => setOpen(null), [location.pathname, location.search])
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const show = (id: CategoryId) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(id), 90)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(null), 120)
  }

  const cat = open ? categories.find((c) => c.id === open) : undefined
  const brands = open ? catalogService.getBrandsSync(open).slice(0, 8) : []

  return (
    <div className="relative hidden border-t border-border lg:block" onMouseLeave={hide}>
      <ScrollRow as="nav" aria-label="Danh mục" wrapClassName="container-page" className="mx-auto flex w-fit max-w-full items-center gap-3.5 xl:gap-5">
        {categories.map((c) => (
          <div
            key={c.id}
            onMouseEnter={() => show(c.id)}
            onFocus={() => {
              window.clearTimeout(timer.current)
              setOpen(c.id)
            }}
          >
            <Link
              to={`/products?category=${c.id}`}
              className={itemClass(activeCategory === c.id || open === c.id)}
              aria-haspopup="true"
              aria-expanded={open === c.id}
            >
              {c.name}
              <Icon name="chevronDown" size={14} className="opacity-50" />
            </Link>
          </div>
        ))}
        <NavLink to="/brands" className={({ isActive }) => itemClass(isActive)} onMouseEnter={hide}>
          Thương hiệu
        </NavLink>
        {/* Màn hình 1024–1279px không đủ chỗ: "Cửa hàng" vẫn có ở chân trang và trang chủ */}
        <NavLink to="/shops" className={({ isActive }) => `${itemClass(isActive)} max-xl:!hidden`} onMouseEnter={hide}>
          Cửa hàng
        </NavLink>
        <NavLink to="/beauty-finder" className={({ isActive }) => `${itemClass(isActive)} !text-primary`} onMouseEnter={hide}>
          <Icon name="sparkle" size={15} />
          Beauty Finder
        </NavLink>
        <NavLink to="/skincare-architect" className={({ isActive }) => `${itemClass(isActive)} !text-primary`} onMouseEnter={hide}>
          Skincare 3D
        </NavLink>
      </ScrollRow>

      {cat && (
        <div
          className="absolute inset-x-0 top-full z-30 border-y border-border bg-bg shadow-pop"
          onMouseEnter={() => window.clearTimeout(timer.current)}
          onFocus={() => window.clearTimeout(timer.current)}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(null)
          }}
        >
          <div className="container-page grid grid-cols-[1fr_1fr_280px] gap-10 py-8">
            <div>
              <p className="eyebrow">Loại sản phẩm</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {typesByCategory[cat.id].map((t) => (
                  <li key={t}>
                    <Link to={`/products?category=${cat.id}&types=${t}`} className="text-text/80 hover:text-primary">
                      {productTypeLabels[t]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow">Thương hiệu</p>
              {brands.length ? (
                <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                  {brands.map((b) => (
                    <li key={b.name}>
                      <Link to={`/products?category=${cat.id}&brand=${encodeURIComponent(b.name)}`} className="text-text/80 hover:text-primary">
                        {b.name} <span className="text-xs text-muted">({b.count})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">Chưa có thương hiệu nào trong danh mục này.</p>
              )}
              <Link to="/brands" className="mt-5 inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
                Tất cả thương hiệu <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <Link to={`/products?category=${cat.id}`} className="group flex gap-4 rounded-card bg-surface-2 p-4 hover:bg-primary-soft">
              <span className="h-24 w-20 shrink-0 overflow-hidden rounded-t-full rounded-b-2xl bg-surface">
                <ProductImage product={{ name: cat.name, images: [], visual: panelVisual[cat.id] }} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-2xl font-semibold leading-tight">{cat.label}</span>
                <span className="mt-1 block text-xs leading-snug text-muted">{cat.description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium group-hover:text-primary">
                  Xem tất cả <Icon name="arrowRight" size={14} />
                </span>
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
