import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { categories } from '@/data/taxonomy'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCart } from '@/features/cart/CartProvider'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { ThemeToggle } from '@/features/theme/ThemeToggle'
import { formatPrice } from '@/lib/format'
import { pushFront, removeItem, SEARCH_HISTORY_KEY, writeList } from '@/lib/localList'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useLocalList } from '@/lib/useLocalList'
import { catalogService } from '@/services/catalog'
import { notificationService } from '@/services/notifications'
import { Logo } from './Logo'
import { MegaMenu } from './MegaMenu'

/** Ô tìm kiếm: gợi ý sản phẩm/thương hiệu khi gõ, lịch sử tìm kiếm khi ô trống (lưu trên trình duyệt này) */
function SearchForm({ id, autoFocus = false }: { id: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const [q, setQ] = useState(location.pathname === '/products' ? (params.get('q') ?? '') : '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const history = useLocalList(SEARCH_HISTORY_KEY)
  const listId = useId()
  const wrapRef = useRef<HTMLFormElement>(null)
  useCatalogVersion()

  useEffect(() => {
    if (location.pathname === '/products') setQ(params.get('q') ?? '')
    setOpen(false)
  }, [location.pathname, params])

  // Đóng gợi ý khi bấm ra ngoài
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const suggest = useMemo(() => (q.trim().length >= 2 ? catalogService.suggestSync(q, 5) : { products: [], brands: [] }), [q])
  type Opt = { key: string; label: string; sub?: string; go: () => void; kind: 'history' | 'brand' | 'product' }
  const options: Opt[] = q.trim()
    ? [
        ...suggest.brands.map((b) => ({ key: 'b' + b, label: b, sub: 'Thương hiệu', kind: 'brand' as const, go: () => goSearch('', b) })),
        ...suggest.products.map((p) => ({
          key: 'p' + p.id,
          label: p.name,
          sub: `${p.brandName} · ${formatPrice(p.price)}`,
          kind: 'product' as const,
          go: () => {
            pushFront(SEARCH_HISTORY_KEY, q.trim(), 8)
            navigate(`/products/${p.slug}`)
          },
        })),
      ]
    : history.map((h) => ({ key: 'h' + h, label: h, kind: 'history' as const, go: () => goSearch(h) }))

  function goSearch(text: string, brand?: string) {
    const next = new URLSearchParams()
    if (text.trim()) {
      next.set('q', text.trim())
      pushFront(SEARCH_HISTORY_KEY, text.trim(), 8)
    }
    if (brand) next.set('brand', brand)
    setOpen(false)
    const qs = next.toString()
    navigate(qs ? `/products?${qs}` : '/products')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (open && active >= 0 && options[active]) return options[active].go()
    goSearch(q)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && (options.length > 0 || q.trim().length >= 2)
  const product = (key: string) => suggest.products.find((p) => 'p' + p.id === key)

  return (
    <form ref={wrapRef} role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Tìm sản phẩm
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && options[active] ? `${listId}-${active}` : undefined}
        placeholder="Tìm serum, kem chống nắng, thương hiệu..."
        className="h-11 w-full rounded-control border border-border bg-surface pl-11 pr-4 text-[15px] text-text placeholder:text-muted focus:border-text focus:outline-none"
      />
      <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />

      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
          {!q.trim() && history.length > 0 && (
            <div className="flex items-center justify-between px-4 pb-1 pt-3 text-xs text-muted">
              <span>Tìm kiếm gần đây</span>
              <button type="button" className="hover:text-text" onClick={() => writeList(SEARCH_HISTORY_KEY, [])}>
                Xóa lịch sử
              </button>
            </div>
          )}
          <ul id={listId} role="listbox" aria-label="Gợi ý tìm kiếm" className="max-h-96 overflow-y-auto py-1">
            {options.map((o, i) => {
              const p = o.kind === 'product' ? product(o.key) : undefined
              return (
                <li
                  key={o.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${i === active ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={o.go}
                >
                  {p ? (
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      <ProductImage product={p} />
                    </span>
                  ) : (
                    <Icon name={o.kind === 'history' ? 'clock' : 'tag'} size={16} className="shrink-0 text-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-muted">{o.sub}</span>}
                  </span>
                  {o.kind === 'history' && (
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-text"
                      aria-label={`Xóa "${o.label}" khỏi lịch sử`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeItem(SEARCH_HISTORY_KEY, o.label)
                      }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {q.trim().length >= 2 && (
            <button
              type="submit"
              className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-sm font-medium hover:bg-surface-2"
            >
              <Icon name="search" size={16} /> Xem tất cả kết quả cho "{q.trim()}"
            </button>
          )}
        </div>
      )}
    </form>
  )
}

/** Chuông thông báo: số chưa đọc, tự cập nhật mỗi phút và khi chuyển trang */
function NotificationBell() {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    const load = () =>
      notificationService
        .unreadCount()
        .then((n) => alive && setUnread(n))
        .catch(() => undefined)
    void load()
    const t = window.setInterval(load, 60_000)
    window.addEventListener('wm:notifications-changed', load)
    return () => {
      alive = false
      window.clearInterval(t)
      window.removeEventListener('wm:notifications-changed', load)
    }
  }, [pathname])
  if (!isSupabaseConfigured) return null
  return (
    <Link
      to="/notifications"
      className="relative grid h-10 w-10 place-items-center rounded-full text-text hover:bg-surface-2"
      aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      title="Thông báo"
    >
      <Icon name="bell" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-sale px-1 text-[11px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export function Header() {
  const { count } = useCart()
  const { status, profile, user, isAdmin } = useAuth()
  const signedIn = status === 'signed-in'
  const accountLabel = signedIn ? profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Tài khoản' : 'Đăng nhập'
  const accountTo = signedIn ? '/account' : '/login'
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Đóng menu mobile khi chuyển trang
  useEffect(() => setMenuOpen(false), [location.pathname, location.search])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <div className="container-page flex h-[72px] items-center gap-3 md:gap-8">
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

        <Logo height={34} />

        <div className="hidden flex-1 md:block md:max-w-lg">
          <SearchForm id="search-desktop" />
        </div>

        <nav className="ml-auto flex items-center gap-0.5" aria-label="Tài khoản và giỏ hàng">
          <ThemeToggle />
          <Link
            to={accountTo}
            className="hidden h-10 max-w-48 items-center gap-2 rounded-full px-3 text-sm text-text/80 hover:bg-surface-2 hover:text-text sm:inline-flex"
            aria-label={signedIn ? `Tài khoản: ${accountLabel}` : 'Đăng nhập'}
          >
            <Icon name="user" className={signedIn ? 'text-primary' : undefined} />
            <span className="hidden truncate xl:inline">{accountLabel}</span>
          </Link>
          {signedIn && (
            <Link
              to="/favorites"
              className="hidden h-10 w-10 place-items-center rounded-full text-text hover:bg-surface-2 sm:grid"
              aria-label="Yêu thích và theo dõi"
              title="Yêu thích và theo dõi"
            >
              <Icon name="heart" />
            </Link>
          )}
          {signedIn && <NotificationBell />}
          <Link
            to="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full text-text hover:bg-surface-2"
            aria-label={`Giỏ hàng, ${count} sản phẩm`}
          >
            <Icon name="cart" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-on-ink">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      <div className="container-page pb-3 md:hidden">
        <SearchForm id="search-mobile" />
      </div>

      {/* Thanh danh mục trên desktop (menu thả xuống) */}
      <MegaMenu />

      {/* Menu mobile */}
      {menuOpen && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-140px)] overflow-y-auto border-t border-border bg-bg lg:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Menu">
            <Link to="/beauty-finder" className="flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-primary hover:bg-surface-2">
              <Icon name="sparkle" size={18} /> Beauty Finder
            </Link>
            <Link to="/products" className="rounded-xl px-3 py-3 hover:bg-surface-2">
              Tất cả sản phẩm
            </Link>
            {categories.map((c) => (
              <Link key={c.id} to={`/products?category=${c.id}`} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-surface-2">
                <span>
                  {c.name} {c.name !== c.label && <span className="text-sm text-muted">· {c.label}</span>}
                </span>
                <Icon name="chevronRight" size={16} className="text-muted" />
              </Link>
            ))}
            <Link to="/brands" className="rounded-xl px-3 py-3 hover:bg-surface-2">
              Thương hiệu A–Z
            </Link>
            <Link to="/shops" className="rounded-xl px-3 py-3 hover:bg-surface-2">
              Tất cả cửa hàng
            </Link>
            <div className="my-2 border-t border-border" />
            <Link to={accountTo} className="rounded-xl px-3 py-3 hover:bg-surface-2">
              {signedIn ? `Tài khoản (${accountLabel})` : 'Đăng nhập / Đăng ký'}
            </Link>
            {signedIn && (
              <>
                <Link to="/orders" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                  Đơn hàng của tôi
                </Link>
                <Link to="/notifications" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                  Thông báo
                </Link>
                <Link to="/messages" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                  Tin nhắn
                </Link>
                <Link to="/vouchers" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                  Ví voucher
                </Link>
                <Link to="/favorites" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                  Yêu thích và theo dõi
                </Link>
                <Link to="/seller" className="rounded-xl px-3 py-3 hover:bg-surface-2">
                  Kênh người bán
                </Link>
              </>
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
