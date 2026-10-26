/**
 * Khung kênh người bán (/seller/*). Tải cửa hàng của người đang đăng nhập:
 * - Chưa có shop → trang mở cửa hàng
 * - Có shop → thanh tab + thông báo trạng thái (chờ duyệt / bị từ chối / tạm ngưng)
 */
import { createContext, Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { button, ShopAvatar, Skeleton } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { shopMediaUrl } from '@/services/media'
import { sellerService } from '@/services/seller'
import { OpenShopPage } from '@/pages/seller/OpenShopPage'
import { shopStatusLabels, type SellerShop } from '@/types/seller'

interface SellerContextValue {
  shop: SellerShop
  setShop: (s: SellerShop) => void
  reload: () => Promise<void>
  /** Shop đang chờ duyệt hoặc hoạt động: được thêm/sửa sản phẩm */
  canManageProducts: boolean
  /** Shop không bị tạm ngưng: được sửa thông tin shop */
  canEditShop: boolean
}

const SellerContext = createContext<SellerContextValue | null>(null)

export function useSeller() {
  const ctx = useContext(SellerContext)
  if (!ctx) throw new Error('useSeller phải được dùng bên trong <SellerLayout>')
  return ctx
}

const tabs = [
  { to: '/seller', label: 'Tổng quan', end: true },
  { to: '/seller/products', label: 'Sản phẩm' },
  { to: '/seller/orders', label: 'Đơn hàng' },
  { to: '/seller/shop', label: 'Thiết lập cửa hàng' },
]

export function SellerLayout() {
  const { user, isSuspended } = useAuth()
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; shop: SellerShop | null; error?: string }>({ status: 'loading', shop: null })

  const reload = useCallback(async () => {
    if (!user) return
    try {
      setState({ status: 'ready', shop: await sellerService.getMyShop(user.id) })
    } catch (err) {
      setState({ status: 'error', shop: null, error: friendlyError(err) })
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  if (state.status === 'loading') {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="container-page py-10">
        <Alert kind="error">{state.error}</Alert>
      </div>
    )
  }
  if (!state.shop) return <OpenShopPage onCreated={(s) => setState({ status: 'ready', shop: s })} />

  const shop = state.shop
  const value: SellerContextValue = {
    shop,
    setShop: (s) => setState({ status: 'ready', shop: s }),
    reload,
    canManageProducts: !isSuspended && (shop.status === 'pending' || shop.status === 'active'),
    canEditShop: !isSuspended && shop.status !== 'suspended',
  }

  return (
    <SellerContext.Provider value={value}>
      <div className="border-b border-border bg-surface">
        <div className="container-page pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ShopAvatar name={shop.name} color={shop.theme_color} logo={shopMediaUrl(shop.logo_path)} size={48} />
              <div className="min-w-0">
                <p className="text-xs text-muted">Kênh người bán</p>
                <p className="truncate text-lg font-bold">{shop.name}</p>
              </div>
              <ShopStatusBadge status={shop.status} />
            </div>
            {shop.status === 'active' && (
              <Link to={`/shops/${shop.slug}`} className={button('secondary', 'sm')}>
                Xem trang cửa hàng
              </Link>
            )}
          </div>
          <nav aria-label="Kênh người bán" className="scrollbar-none -mb-px mt-4 flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="container-page pt-6">
        <ShopStatusNotice />
      </div>
      <Suspense
        fallback={
          <div className="container-page py-8" aria-busy="true" aria-label="Đang tải trang">
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </SellerContext.Provider>
  )
}

export function ShopStatusBadge({ status }: { status: SellerShop['status'] }) {
  const styles = {
    pending: 'bg-accent-soft text-on-accent dark:text-accent',
    active: 'bg-success/15 text-success',
    rejected: 'bg-danger/10 text-danger',
    suspended: 'bg-danger/10 text-danger',
  }
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{shopStatusLabels[status]}</span>
}

function ShopStatusNotice() {
  const { shop, setShop } = useSeller()
  const { isSuspended } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isSuspended) return <Alert kind="error">Tài khoản của bạn đang bị khóa nên không thể quản lý cửa hàng.</Alert>
  if (shop.status === 'pending')
    return (
      <Alert kind="info">
        Cửa hàng đang chờ quản trị viên duyệt. Trong lúc chờ, bạn có thể hoàn thiện thông tin và chuẩn bị sản phẩm; sản phẩm sẽ hiển thị cho khách
        sau khi cửa hàng được duyệt.
      </Alert>
    )
  if (shop.status === 'rejected')
    return (
      <Alert kind="error">
        <p>
          Cửa hàng chưa được duyệt{shop.status_reason ? `: ${shop.status_reason}` : '.'} Hãy sửa thông tin trong mục Thiết lập cửa hàng rồi gửi duyệt lại.
        </p>
        {error && <p className="mt-1 font-medium">{error}</p>}
        <button
          type="button"
          className={`${button('primary', 'sm')} mt-2`}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              setShop(await sellerService.resubmitShop())
            } catch (err) {
              setError(friendlyError(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Đang gửi...' : 'Gửi duyệt lại'}
        </button>
      </Alert>
    )
  if (shop.status === 'suspended')
    return (
      <Alert kind="error">
        Cửa hàng đang bị tạm ngưng{shop.status_reason ? `: ${shop.status_reason}` : '.'} Sản phẩm không hiển thị với khách và bạn chưa thể chỉnh sửa. Liên hệ
        quản trị viên để được hỗ trợ.
      </Alert>
    )
  return null
}
