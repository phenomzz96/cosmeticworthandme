/**
 * MEGA SALE — /mega-sale
 * Đợt sale lớn do Admin tạo theo dịp lễ; sản phẩm do người bán đăng ký và Admin duyệt.
 * Giá sale do database tự áp dụng trong thời gian chương trình (trình duyệt không gửi giá khi đặt hàng).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { friendlyError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useCountdown } from '@/lib/useCountdown'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { megaSaleService, saleState, type MegaSale, type MegaSaleItem } from '@/services/megaSale'
import type { Product } from '@/types/catalog'

type Sort = 'discount' | 'price' | 'popular'

export function MegaSalePage() {
  useDocumentTitle('Mega Sale')
  const [sales, setSales] = useState<{ status: 'loading' | 'ready' | 'error'; list: MegaSale[]; error?: string }>({ status: 'loading', list: [] })
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return setSales({ status: 'ready', list: [] })
    // Nhờ database cập nhật giá theo giờ hiện tại rồi mới đọc
    megaSaleService
      .sync()
      .catch(() => undefined)
      .then(() => megaSaleService.listOpen(true))
      .then((list) => {
        setSales({ status: 'ready', list })
        setActiveId(list[0]?.id ?? null)
      })
      .catch((err) => setSales({ status: 'error', list: [], error: friendlyError(err) }))
  }, [])

  const sale = sales.list.find((s) => s.id === activeId)

  if (sales.status === 'loading') {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-64 w-full" />
        <div className="mt-8">
          <ProductGridSkeleton count={4} />
        </div>
      </div>
    )
  }

  return (
    <div>
      {sale ? (
        <SaleHero sale={sale} />
      ) : (
        <div className="container-page py-10">
          <p className="eyebrow">Mega Sale</p>
          <h1 className="mt-2 text-4xl md:text-5xl">Mega Sale</h1>
          {sales.status === 'error' && (
            <div className="mt-6">
              <Alert kind="error">{sales.error}</Alert>
            </div>
          )}
          {!isSupabaseConfigured && (
            <div className="mt-6">
              <Alert kind="info">Mega Sale cần kết nối Supabase (giá sale do máy chủ áp dụng). Bản đang chạy chưa kết nối.</Alert>
            </div>
          )}
          <div className="mt-6">
            <EmptyState title="Hiện chưa có đợt Mega Sale nào" action={<Link to="/vouchers" className="font-semibold text-primary hover:underline">Xem mã giảm giá đang có</Link>}>
              Mega Sale mở vào các dịp lễ và ngày đặc biệt. Quay lại sau nhé!
            </EmptyState>
          </div>
        </div>
      )}

      <div className="container-page">
        {sales.list.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Chọn đợt sale">
            {sales.list.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === activeId}
                onClick={() => setActiveId(s.id)}
                className={`rounded-full border px-4 py-2 text-sm ${s.id === activeId ? 'border-ink bg-ink text-on-ink' : 'border-border bg-surface hover:border-text'}`}
              >
                {s.title}
                {saleState(s) === 'upcoming' && <span className="ml-1.5 text-xs opacity-75">(sắp mở)</span>}
              </button>
            ))}
          </div>
        )}
        {sale && <SaleDeals key={sale.id} sale={sale} />}
        <MoreDeals />
      </div>
    </div>
  )
}

function SaleHero({ sale }: { sale: MegaSale }) {
  const upcoming = saleState(sale) === 'upcoming'
  const cd = useCountdown(upcoming ? sale.starts_at : sale.ends_at)
  const parts = [
    { v: cd.days, l: 'Ngày' },
    { v: cd.hours, l: 'Giờ' },
    { v: cd.minutes, l: 'Phút' },
    { v: cd.seconds, l: 'Giây' },
  ]
  return (
    <section className="bg-ink text-on-ink" aria-labelledby="sale-heading">
      <div className="container-page grid items-center gap-8 py-10 md:py-14 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.26em] text-on-ink/80">
            <Icon name="bolt" size={18} className="text-sale" /> Mega Sale
          </p>
          <h1 id="sale-heading" className="mt-3 break-words font-display text-4xl font-semibold leading-[1.05] sm:text-5xl md:text-6xl">
            {sale.title}
          </h1>
          {sale.tagline && <p className="mt-3 max-w-xl text-on-ink/80">{sale.tagline}</p>}
          <ul className="mt-5 flex flex-wrap gap-2 text-sm">
            <li className="rounded-full border border-on-ink/25 px-3 py-1">Giảm từ {sale.min_discount_percent}%</li>
            <li className="rounded-full border border-on-ink/25 px-3 py-1">Giá tự áp dụng khi đặt hàng</li>
            <li className="rounded-full border border-on-ink/25 px-3 py-1">
              {formatDateTime(sale.starts_at)} – {formatDateTime(sale.ends_at)}
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm text-on-ink/80">{upcoming ? 'Bắt đầu sau' : 'Kết thúc sau'}</p>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-label={`${upcoming ? 'Bắt đầu sau' : 'Kết thúc sau'} ${cd.label}`}>
            {parts.map((p) => (
              <div key={p.l} className="rounded-2xl bg-on-ink/10 px-2 py-3 text-center">
                <span className="block font-display text-3xl font-semibold tabular-nums sm:text-4xl">{String(p.v).padStart(2, '0')}</span>
                <span className="mt-0.5 block text-xs text-on-ink/75">{p.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SaleDeals({ sale }: { sale: MegaSale }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: MegaSaleItem[]; products: Product[]; error?: string }>({ status: 'loading', items: [], products: [] })
  const [sort, setSort] = useState<Sort>('discount')
  const upcoming = saleState(sale) === 'upcoming'

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const items = await megaSaleService.approvedItems(sale.id)
        // Giá sale vừa được database áp dụng: tải lại danh mục để thẻ sản phẩm hiện giá mới
        await catalogService.refresh().catch(() => undefined)
        const products = await catalogService.getProductsByIds(items.map((i) => i.product_id))
        if (alive) setState({ status: 'ready', items, products })
      } catch (err) {
        if (alive) setState({ status: 'error', items: [], products: [], error: friendlyError(err) })
      }
    })()
    return () => {
      alive = false
    }
  }, [sale.id])

  const priceOf = useMemo(() => new Map(state.items.map((i) => [i.product_id, i.sale_price])), [state.items])
  const appliedIds = useMemo(() => new Set(state.items.filter((i) => i.applied).map((i) => i.product_id)), [state.items])

  const list = useMemo(() => {
    // Đang chạy: chỉ hiện sản phẩm đã được áp giá (giá trên thẻ = giá thanh toán)
    const base = upcoming ? state.products : state.products.filter((p) => appliedIds.has(p.id))
    const off = (p: Product) => {
      const orig = p.originalPrice ?? p.price
      const now = upcoming ? priceOf.get(p.id) ?? p.price : p.price
      return orig ? (orig - now) / orig : 0
    }
    const val = (p: Product) => (upcoming ? priceOf.get(p.id) ?? p.price : p.price)
    return [...base].sort((a, b) => (sort === 'discount' ? off(b) - off(a) : sort === 'price' ? val(a) - val(b) : b.soldCount - a.soldCount))
  }, [state.products, appliedIds, priceOf, sort, upcoming])

  return (
    <section className="mt-10" aria-labelledby="deals-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{upcoming ? 'Sắp mở bán' : 'Đang giảm giá'}</p>
          <h2 id="deals-heading" className="section-title mt-2">
            {upcoming ? 'Deal sắp lên sàn' : 'Deal Mega Sale'}
          </h2>
        </div>
        {list.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Sắp xếp</span>
            <select className="h-9 rounded-full border border-border bg-surface px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="discount">Giảm nhiều nhất</option>
              <option value="price">Giá thấp đến cao</option>
              <option value="popular">Bán chạy</option>
            </select>
          </label>
        )}
      </div>

      <div className="mt-6">
        {state.status === 'loading' && <ProductGridSkeleton count={4} />}
        {state.status === 'error' && <Alert kind="error">{state.error}</Alert>}
        {state.status === 'ready' && list.length === 0 && (
          <EmptyState title="Chưa có sản phẩm nào trong đợt sale này">Các cửa hàng đang đăng ký sản phẩm. Quay lại sau ít phút nhé!</EmptyState>
        )}
        {state.status === 'ready' && list.length > 0 && !upcoming && <ProductGrid products={list} eagerCount={4} />}
        {state.status === 'ready' && list.length > 0 && upcoming && (
          <>
            <p className="mb-4 text-sm text-muted">Giá Mega Sale tự áp dụng từ {formatDateTime(sale.starts_at)}. Trước thời điểm đó sản phẩm vẫn bán giá hiện tại.</p>
            <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <li key={p.id}>
                  <UpcomingCard product={p} salePrice={priceOf.get(p.id) ?? p.price} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

/** Thẻ sản phẩm sắp lên sale: giá dự kiến, chưa cho thêm giỏ với giá sale */
function UpcomingCard({ product, salePrice }: { product: Product; salePrice: number }) {
  const orig = product.originalPrice ?? product.price
  const off = orig > 0 ? Math.round(((orig - salePrice) / orig) * 100) : 0
  return (
    <Link to={`/products/${product.slug}`} className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface hover:border-primary">
      <span className="relative block aspect-[5/6] overflow-hidden bg-surface-2">
        <ProductImage product={product} />
        {off > 0 && <span className="absolute left-3 top-3 rounded-full bg-sale px-2.5 py-1 text-xs font-semibold text-surface">-{off}%</span>}
      </span>
      <span className="flex flex-1 flex-col p-3 sm:p-4">
        <span className="truncate text-xs text-muted">{product.brandName}</span>
        <span className="mt-1 line-clamp-2 text-sm font-medium group-hover:text-primary">{product.name}</span>
        <span className="mt-auto pt-2 text-xs text-muted">Giá Mega Sale</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-sale">{formatPrice(salePrice)}</span>
          <span className="text-xs text-muted line-through">{formatPrice(orig)}</span>
        </span>
      </span>
    </Link>
  )
}

function MoreDeals() {
  return (
    <section className="mt-14" aria-label="Săn thêm ưu đãi">
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <li>
          <Link to="/vouchers" className="group flex h-full items-center gap-4 rounded-card border border-border bg-surface p-4 hover:border-primary">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon name="ticket" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold group-hover:text-primary">Mã giảm giá toàn sàn</span>
              <span className="mt-0.5 block text-sm text-muted">Lưu mã vào ví, dùng chung với giá Mega Sale.</span>
            </span>
            <Icon name="arrowRight" size={18} className="shrink-0 text-muted" />
          </Link>
        </li>
        <li>
          <Link to="/beauty-quest/hop-qua" className="group flex h-full items-center gap-4 rounded-card border border-border bg-surface p-4 hover:border-primary">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon name="gift" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold group-hover:text-primary">Hộp quà Beauty Quest</span>
              <span className="mt-0.5 block text-sm text-muted">Mở hộp mỗi ngày để nhận thêm voucher riêng.</span>
            </span>
            <Icon name="arrowRight" size={18} className="shrink-0 text-muted" />
          </Link>
        </li>
      </ul>
    </section>
  )
}
