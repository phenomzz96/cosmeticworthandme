/**
 * Tải sẵn mã của các trang để chuyển trang không phải chờ:
 * - khi trình duyệt rảnh sau lần mở đầu: trang hay dùng (danh sách, chi tiết, giỏ, Beauty Finder, đăng nhập);
 * - khi người dùng rê chuột, chạm hoặc chuyển focus vào một liên kết: trang của liên kết đó.
 * Không tải sẵn khi người dùng bật tiết kiệm dữ liệu hoặc mạng 2G.
 */
import { useEffect } from 'react'

export const loaders = {
  products: () => import('@/pages/ProductsPage'),
  productDetail: () => import('@/pages/ProductDetailPage'),
  shops: () => import('@/pages/ShopPage'),
  cart: () => import('@/pages/CartPage'),
  account: () => import('@/pages/AccountPage'),
  login: () => import('@/pages/LoginPage'),
  register: () => import('@/pages/RegisterPage'),
  password: () => import('@/pages/PasswordPages'),
  beautyFinder: () => import('@/pages/BeautyFinderPage'),
  checkout: () => import('@/pages/CheckoutPage'),
  architect: () => import('@/pages/SkincareArchitectPage'),
  brands: () => import('@/pages/BrandsPage'),
}
type Key = keyof typeof loaders

/** Đường dẫn → trang cần tải */
function keyFor(path: string): Key | null {
  const [, a = '', b] = path.split(/[?#]/)[0].split('/')
  switch (a) {
    case 'products':
      return b ? 'productDetail' : 'products'
    case 'shops':
      return 'shops'
    case 'cart':
      return 'cart'
    case 'checkout':
      return 'checkout'
    case 'account':
      return 'account'
    case 'login':
      return 'login'
    case 'register':
      return 'register'
    case 'forgot-password':
    case 'reset-password':
      return 'password'
    case 'beauty-finder':
      return 'beautyFinder'
    case 'skincare-architect':
      return 'architect'
    case 'brands':
      return 'brands'
    default:
      return null
  }
}

const done = new Set<Key>()
export function prefetch(key: Key) {
  if (done.has(key)) return
  done.add(key)
  loaders[key]().catch(() => done.delete(key))
}

function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !!c && (c.saveData === true || /2g/.test(c.effectiveType ?? ''))
}

export function usePrefetchRoutes() {
  useEffect(() => {
    if (saveData()) return
    const onIntent = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="/"]')
      const key = a && keyFor(a.getAttribute('href') ?? '')
      if (key) prefetch(key)
    }
    document.addEventListener('pointerover', onIntent, { passive: true })
    document.addEventListener('touchstart', onIntent, { passive: true })
    document.addEventListener('focusin', onIntent)

    const hasIdle = typeof window.requestIdleCallback === 'function'
    const common: Key[] = ['products', 'productDetail', 'cart', 'beautyFinder', 'login']
    const run = () => common.forEach((k, i) => setTimeout(() => prefetch(k), i * 150))
    const id = hasIdle ? window.requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 2500)
    return () => {
      document.removeEventListener('pointerover', onIntent)
      document.removeEventListener('touchstart', onIntent)
      document.removeEventListener('focusin', onIntent)
      if (hasIdle) window.cancelIdleCallback(id as number)
      else clearTimeout(id as ReturnType<typeof setTimeout>)
    }
  }, [])
}
