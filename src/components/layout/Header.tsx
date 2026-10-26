import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { categories } from '@/data/taxonomy'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCart } from '@/features/cart/CartProvider'
import { ThemeToggle } from '@/features/theme/ThemeToggle'
import { Logo } from './Logo'

function SearchForm({ id, autoFocus = false }: { id: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const [q, setQ] = useState(location.pathname === '/products' ? (params.get('q') ?? '') : '')

  useEffect(() => {
    if (location.pathname === '/products') setQ(params.get('q') ?? '')
  }, [location.pathname, params])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams()
    if (q.trim()) next.set('q', q.trim())
    const qs = next.toString()
    navigate(qs ? `/products?${qs}` : '/products')
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Tìm sản phẩm
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Tìm serum, kem chống nắng, son..."
        className="h-11 w-full rounded-control border border-border bg-surface-2 pl-11 pr-4 text-[15px] text-text placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none"
      />
      <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
    </form>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:text-text'}`

export function Header() {
  const { count } = useCart()
  const { status, profile, user, isAdmin } = useAuth()
  const signedIn = status === 'signed-in'
  const accountLabel = signedIn ? profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Tài khoản' : 'Đăng nhập'
  const accountTo = signedIn ? '/account' : '/login'
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const [params] = useSearchParams()
  const activeCategory = location.pathname === '/products' ? params.get('category') : null

  // Đóng menu mobile khi chuyển trang
  useEffect(() => setMenuOpen(false), [location.pathname, location.search])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="container-page flex h-16 items-center gap-3 md:gap-6">
        <button
          type="button"
          className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-text hover:bg-surface-2 lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} />
        </button>

        <Logo height={32} />

        <div className="hidden flex-1 md:block md:max-w-xl">
          <SearchForm id="search-desktop" />
        </div>

        <nav className="ml-auto flex items-center gap-1" aria-label="Tài khoản và giỏ hàng">
          <ThemeToggle />
          <Link
            to={accountTo}
            className="hidden h-10 max-w-48 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text sm:inline-flex"
            aria-label={signedIn ? `Tài khoản: ${accountLabel}` : 'Đăng nhập'}
          >
            <Icon name="user" className={signedIn ? 'text-primary' : undefined} />
            <span className="hidden truncate xl:inline">{accountLabel}</span>
          </Link>
          <Link
            to="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full text-text hover:bg-surface-2"
            aria-label={`Giỏ hàng, ${count} sản phẩm`}
          >
            <Icon name="cart" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      <div className="container-page pb-3 md:hidden">
        <SearchForm id="search-mobile" />
      </div>

      {/* Thanh danh mục trên desktop */}
      <div className="hidden border-t border-border lg:block">
        <nav className="container-page flex h-12 items-center gap-1" aria-label="Danh mục">
          <NavLink to="/beauty-finder" className={({ isActive }) => `${navLinkClass({ isActive })} mr-2 inline-flex items-center gap-1.5 text-primary`}>
            <Icon name="sparkle" size={16} />
            Beauty Finder
          </NavLink>
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.id}`} className={navLinkClass({ isActive: activeCategory === c.id })}>
              {c.name}
            </Link>
          ))}
          <NavLink to="/shops" className={({ isActive }) => `${navLinkClass({ isActive })} ml-auto`}>
            Cửa hàng
          </NavLink>
        </nav>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div id="mobile-menu" className="border-t border-border bg-surface lg:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Menu">
            <Link to="/beauty-finder" className="flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-primary hover:bg-surface-2">
              <Icon name="sparkle" size={18} /> Beauty Finder
            </Link>
            {categories.map((c) => (
              <Link key={c.id} to={`/products?category=${c.id}`} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-surface-2">
                <span>
                  {c.name} <span className="text-sm text-muted">· {c.label}</span>
                </span>
                <Icon name="chevronRight" size={16} className="text-muted" />
              </Link>
            ))}
            <Link to="/shops" className="rounded-xl px-3 py-3 hover:bg-surface-2">
              Tất cả cửa hàng
            </Link>
            <Link to={accountTo} className="rounded-xl px-3 py-3 hover:bg-surface-2">
              {signedIn ? `Tài khoản (${accountLabel})` : 'Đăng nhập / Đăng ký'}
            </Link>
            {signedIn && (
              <Link to="/orders" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                Đơn hàng của tôi
              </Link>
            )}
            {signedIn && (
              <Link to="/seller" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                Kênh người bán
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                Trang quản trị
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
