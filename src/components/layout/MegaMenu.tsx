import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { ScrollRow } from '@/components/ui/ScrollRow'
import { specialFeatures } from '@/config/features'
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
  `relative inline-flex items-center gap-1.5 whitespace-nowrap py-3 text-sm transition-colors motion-reduce:transition-none xl:text-[15px] after:absolute after:inset-x-0 after:bottom-2 after:h-[1.5px] after:origin-left after:bg-primary after:transition-transform after:duration-200 motion-reduce:after:transition-none ${
    active ? 'text-text after:scale-x-100' : 'text-muted hover:text-text after:scale-x-0 hover:after:scale-x-100'
  }`

/**
 * Thanh menu trên máy tính, gọn theo kiểu các sàn lớn:
 * - Nút "Danh mục" mở bảng gồm 7 danh mục (cột trái), loại sản phẩm và thương hiệu của danh mục đang chọn.
 * - Giữa: các tính năng chỉ có ở sàn (Beauty Finder, Skincare 3D...) — nổi bật bằng màu chủ đạo.
 * - Phải: Thương hiệu, Cửa hàng, Ưu đãi.
 * Rê chuột hoặc bấm nút để mở; Esc / bấm ra ngoài để đóng.
 */
export function MegaMenu() {
  useCatalogVersion()
  const location = useLocation()
  const [params] = useSearchParams()
  const currentCategory = (location.pathname === '/products' ? params.get('category') : null) as CategoryId | null
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<CategoryId>(currentCategory ?? categories[0].id)
  const timer = useRef<number>(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const openedAt = useRef(0)

  useEffect(() => setOpen(false), [location.pathname, location.search])
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Mở bảng: tô sẵn danh mục đang xem (hoặc danh mục đầu)
  const openPanel = () => {
    setActive(currentCategory ?? categories[0].id)
    openedAt.current = Date.now()
    setOpen(true)
  }
  const show = () => {
    window.clearTimeout(timer.current)
    if (!open) timer.current = window.setTimeout(openPanel, 90)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), 140)
  }

  const cat = categories.find((c) => c.id === active) ?? categories[0]
  const brands = open ? catalogService.getBrandsSync(cat.id).slice(0, 8) : []

  return (
    <div ref={rootRef} className="relative hidden border-t border-border lg:block" onMouseLeave={hide}>
      <div className="container-page flex items-center gap-5 xl:gap-7">
        <button
          ref={buttonRef}
          type="button"
          onMouseEnter={show}
          onClick={() => {
            window.clearTimeout(timer.current)
            // Vừa mở bằng rê chuột thì cú bấm ngay sau đó không đóng lại
            if (!open) openPanel()
            else if (Date.now() - openedAt.current > 450) setOpen(false)
          }}
          aria-expanded={open}
          aria-controls="mega-panel"
          className={`-ml-3 inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors motion-reduce:transition-none xl:text-[15px] ${
            open || currentCategory ? 'bg-primary-soft text-primary' : 'text-text hover:bg-surface-2'
          }`}
        >
          <Icon name="menu" size={18} />
          Danh mục
          <Icon name="chevronDown" size={14} className={`opacity-60 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>

        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />

        <ScrollRow as="nav" aria-label="Tính năng nổi bật" wrapClassName="min-w-0 flex-1" className="flex items-center gap-5 xl:gap-7">
          {specialFeatures.map((f) => (
            <NavLink key={f.to} to={f.to} className={({ isActive }) => `${itemClass(isActive)} !text-primary font-medium`} onMouseEnter={hide}>
              <Icon name={f.icon} size={15} />
              {f.name}
            </NavLink>
          ))}
        </ScrollRow>

        <nav aria-label="Mua sắm" className="flex shrink-0 items-center gap-5 xl:gap-7">
          <NavLink to="/brands" className={({ isActive }) => itemClass(isActive)} onMouseEnter={hide}>
            Thương hiệu
          </NavLink>
          <NavLink to="/shops" className={({ isActive }) => itemClass(isActive)} onMouseEnter={hide}>
            Cửa hàng
          </NavLink>
          <NavLink to="/vouchers" className={({ isActive }) => itemClass(isActive)} onMouseEnter={hide}>
            <Icon name="ticket" size={15} />
            Ưu đãi
          </NavLink>
        </nav>
      </div>

      {open && (
        <div
          id="mega-panel"
          className="absolute inset-x-0 top-full z-30 border-y border-border bg-bg shadow-pop"
          onMouseEnter={() => window.clearTimeout(timer.current)}
          onBlur={(e) => {
            if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
          }}
        >
          <div className="container-page grid grid-cols-[256px_1fr_1fr] gap-8 py-6 xl:grid-cols-[268px_1fr_1fr_260px] xl:gap-10">
            <ul className="-my-1 border-r border-border pr-4" aria-label="Danh mục sản phẩm">
              <li>
                <Link to="/products" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
                  Tất cả sản phẩm
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/products?category=${c.id}`}
                    onMouseEnter={() => setActive(c.id)}
                    onFocus={() => setActive(c.id)}
                    aria-current={currentCategory === c.id ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                      active === c.id ? 'bg-primary-soft font-medium text-primary' : 'text-text hover:bg-surface-2'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {c.name}
                      {c.name !== c.label && <span className={`ml-1.5 text-xs ${active === c.id ? 'text-primary/80' : 'text-muted'}`}>{c.label}</span>}
                    </span>
                    <Icon name="chevronRight" size={14} className="shrink-0 opacity-60" />
                  </Link>
                </li>
              ))}
            </ul>

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
                    <li key={b.name} className="min-w-0">
                      <Link to={`/products?category=${cat.id}&brand=${encodeURIComponent(b.name)}`} className="block truncate text-text/80 hover:text-primary">
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

            <Link to={`/products?category=${cat.id}`} className="group hidden gap-4 self-start rounded-card bg-surface-2 p-4 hover:bg-primary-soft xl:flex">
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
