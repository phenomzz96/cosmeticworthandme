import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, ErrorState } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { categories } from '@/data/taxonomy'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { BannerCarousel } from '@/features/home/BannerCarousel'
import { skinTypeOptions } from '@/features/beauty-finder/questions'
import { Stars } from '@/features/reviews/ReviewsSection'
import { ShopCard } from '@/features/shops/ShopCard'
import { formatCompact } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { reviewService } from '@/services/reviews'
import type { CategoryId, Product, ProductVisual } from '@/types/catalog'

/** Hình minh họa đại diện cho từng danh mục (vẽ bằng SVG, không dùng ảnh của bên khác). Mã màu là màu bao bì minh họa, cùng loại với dữ liệu mẫu, không phải màu giao diện. */
const categoryVisual: Record<CategoryId, ProductVisual> = {
  skincare: { shape: 'dropper', color: '#E7DDEE', cap: '#6E5585' },
  makeup: { shape: 'lipstick', color: '#B4555A', cap: '#2B2126' },
  haircare: { shape: 'pump', color: '#E4E9D6', cap: '#7D8A55' },
  'body-care': { shape: 'jar', color: '#F3E3D3', cap: '#C08A5B' },
  'beauty-tools': { shape: 'brush', color: '#E9DED3', cap: '#3E3846' },
}

function SectionHead({ eyebrow, title, id, link }: { eyebrow: string; title: string; id: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="section-title mt-2">
          {title}
        </h2>
      </div>
      {link && (
        <Link to={link.to} className="hidden shrink-0 items-center gap-1.5 pb-1 text-sm font-medium hover:text-primary sm:inline-flex">
          {link.label} <Icon name="arrowRight" size={16} />
        </Link>
      )}
    </div>
  )
}

export function HomePage() {
  const { settings } = useBrand()
  useDocumentTitle()
  useCatalogVersion()
  const best = useAsync(() => catalogService.getBestSellers(4), [])
  const featured = useAsync(() => catalogService.getFeaturedProducts(8), [])
  const fresh = useAsync(() => catalogService.getNewArrivals(4), [])
  const shops = useAsync(() => catalogService.getShops(), [])
  const stats = useAsync(() => catalogService.getStats(), [])
  const reviews = useAsync(() => reviewService.latest(3).catch(() => []), [])

  // "Bán chạy" chỉ hiện khi đã có lượt bán thật; chưa có thì hiện sản phẩm nổi bật
  const hasBest = best.status === 'success' && best.data.length >= 2
  const highlight = hasBest ? best : featured

  return (
    <>
      <Hero />
      <TrustStrip />
      <BannerCarousel />

      {/* DANH MỤC */}
      <section className="container-page mt-20" aria-labelledby="cat-heading">
        <SectionHead eyebrow="Danh mục" title="Tìm sản phẩm cho bạn" id="cat-heading" link={{ to: '/products', label: 'Xem tất cả sản phẩm' }} />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {categories.map((c, i) => (
            <li key={c.id} className={i === 0 ? 'col-span-2 lg:col-span-1' : ''}>
              <Link
                to={`/products?category=${c.id}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-surface-2 lg:aspect-[3/4]"
              >
                <span className="absolute inset-0 transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none">
                  <ProductImage product={{ name: c.name, images: [], visual: categoryVisual[c.id] }} />
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent p-4 pt-14 text-white">
                  <span className="flex items-end justify-between gap-2">
                    <span>
                      <span className="block font-display text-2xl font-semibold leading-none">{c.name}</span>
                      <span className="mt-1 block text-xs opacity-90">{c.label}</span>
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/25 backdrop-blur">
                      <Icon name="arrowRight" size={15} />
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* BÁN CHẠY / NỔI BẬT */}
      <section className="container-page mt-20" aria-labelledby="best-heading">
        <SectionHead
          eyebrow={hasBest ? 'Được yêu thích nhất' : 'Gợi ý cho bạn'}
          title={hasBest ? 'Sản phẩm bán chạy' : 'Sản phẩm nổi bật'}
          id="best-heading"
          link={{ to: '/products?sort=popular', label: 'Xem tất cả' }}
        />
        <div className="mt-8">
          {highlight.status === 'loading' && <ProductGridSkeleton count={4} />}
          {highlight.status === 'error' && <ErrorState />}
          {highlight.status === 'success' && <ProductGrid products={highlight.data.slice(0, hasBest ? 4 : 8)} eagerCount={4} />}
        </div>
      </section>

      {/* VỀ SÀN — số liệu thật */}
      <section className="container-page mt-20" aria-labelledby="story-heading">
        <div className="grid overflow-hidden rounded-[28px] bg-primary-soft lg:grid-cols-2">
          <StoryCollage products={featured.status === 'success' ? featured.data : []} />
          <div className="p-7 sm:p-12">
            <p className="eyebrow">Về {settings.name}</p>
            <h2 id="story-heading" className="section-title mt-3 max-w-md">
              Nhiều cửa hàng, một nơi để chọn đúng sản phẩm
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-muted">
              Mỗi cửa hàng được quản trị viên duyệt trước khi bán. Giá, tồn kho và phí giao hàng được máy chủ kiểm tra lại khi đặt hàng; đánh giá chỉ
              đến từ khách đã nhận hàng.
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                { label: 'Cửa hàng đang bán', value: stats.status === 'success' ? stats.data.shops : null },
                { label: 'Sản phẩm', value: stats.status === 'success' ? stats.data.products : null },
                { label: 'Thương hiệu', value: stats.status === 'success' ? stats.data.brands : null },
              ].map((s) => (
                <div key={s.label} className="flex flex-col-reverse">
                  <dt className="mt-1 text-xs text-muted sm:text-sm">{s.label}</dt>
                  <dd className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{s.value == null ? '–' : formatCompact(s.value)}</dd>
                </div>
              ))}
            </dl>
            <Link to="/about" className={`${button('secondary')} mt-8`}>
              Tìm hiểu thêm
            </Link>
          </div>
        </div>
      </section>

      {/* HÀNG MỚI */}
      <section className="container-page mt-20" aria-labelledby="new-heading">
        <SectionHead eyebrow="Vừa lên kệ" title="Sản phẩm mới" id="new-heading" link={{ to: '/products?sort=newest', label: 'Xem tất cả' }} />
        <div className="mt-8">
          {fresh.status === 'loading' && <ProductGridSkeleton count={4} />}
          {fresh.status === 'success' && <ProductGrid products={fresh.data} />}
        </div>
      </section>

      <FinderShowcase />

      {/* ĐÁNH GIÁ THẬT CỦA KHÁCH */}
      {reviews.status === 'success' && reviews.data.length > 0 && (
        <section className="container-page mt-20" aria-labelledby="reviews-heading">
          <SectionHead eyebrow="Khách hàng nói gì" title="Đánh giá từ người đã mua" id="reviews-heading" />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.data.map((r) => (
              <li key={r.id} className="flex flex-col rounded-card border border-border bg-surface p-6">
                <Stars value={r.rating} size={15} />
                <blockquote className="mt-4 flex-1 font-display text-xl leading-snug">“{r.comment}”</blockquote>
                <p className="mt-5 text-sm">
                  <span className="font-medium">{r.reviewer_name}</span>
                  <span className="text-muted"> · đã mua </span>
                  <Link to={`/products/${r.product_slug}`} className="text-primary hover:underline">
                    {r.product_name}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CỬA HÀNG */}
      <section className="container-page mt-20" aria-labelledby="shops-heading">
        <SectionHead eyebrow="Cửa hàng" title={`Cửa hàng trên ${settings.name}`} id="shops-heading" link={{ to: '/shops', label: 'Tất cả cửa hàng' }} />
        {shops.status === 'success' && (
          <ul className="scrollbar-none -mx-4 mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
            {/* Chỉ giới thiệu shop đang có hàng; shop chưa có sản phẩm vẫn xem được ở trang Cửa hàng */}
            {shops.data
              .filter((s) => catalogService.countProductsByShop(s.id) > 0)
              .slice(0, 8)
              .map((s) => (
                <li key={s.id} className="w-64 shrink-0 snap-start md:w-auto">
                  <ShopCard shop={s} />
                </li>
              ))}
          </ul>
        )}
        {shops.status === 'loading' && <div className="mt-8 h-40 animate-pulse rounded-card bg-surface-2" />}
      </section>

      {/* MỞ CỬA HÀNG */}
      <section className="container-page mt-20">
        <div className="flex flex-col items-start gap-5 rounded-[28px] bg-ink p-8 text-on-ink md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <p className="eyebrow !text-on-ink/70">Dành cho người bán</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Bạn kinh doanh mỹ phẩm?</h2>
            <p className="mt-3 max-w-xl text-sm opacity-80">
              Mở cửa hàng trên {settings.name} miễn phí: đăng ký shop, chờ quản trị viên duyệt, rồi đăng bán sản phẩm, tạo mã giảm giá và xử lý đơn hàng ngay trên kênh
              người bán.
            </p>
          </div>
          <Link to="/seller" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control bg-on-ink px-6 text-[15px] font-medium text-ink hover:opacity-90">
            <Icon name="store" size={18} /> Mở cửa hàng
          </Link>
        </div>
      </section>
    </>
  )
}

function Hero() {
  const { settings } = useBrand()
  const showcase = useAsync(async () => {
    const list = await catalogService.getFeaturedProducts(12)
    // Ưu tiên sản phẩm có ảnh thật do cửa hàng tải lên
    return [...list.filter((p) => p.images.length), ...list.filter((p) => !p.images.length)].slice(0, 3)
  }, [])
  const items = showcase.status === 'success' ? showcase.data : []

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-0 h-[38rem] w-[38rem] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--primary-soft) 0%, var(--accent-soft) 45%, transparent 70%)' }}
      />
      <div className="container-page relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <p className="eyebrow">Sàn mỹ phẩm nhiều cửa hàng</p>
          <h1 className="mt-5 max-w-xl text-[2.75rem] leading-[1.02] text-balance sm:text-6xl lg:text-7xl">
            Chọn mỹ phẩm hợp với làn da của bạn, <em className="font-medium italic text-primary">từ nhiều cửa hàng uy tín.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            {settings.name} gom skincare, makeup, haircare và body care từ nhiều cửa hàng về một nơi. Trả lời vài câu hỏi để Beauty Finder lọc ra sản phẩm phù hợp.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/products" className={button('dark', 'lg')}>
              Mua sắm ngay <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/beauty-finder" className={button('secondary', 'lg')}>
              <Icon name="sparkle" size={18} /> Bắt đầu Beauty Finder
            </Link>
          </div>
        </div>

        {/* Bố cục 3 khung vòm: ảnh sản phẩm đang bán trên sàn */}
        <div className="relative mx-auto grid w-full max-w-[540px] grid-cols-3 items-end gap-3 sm:gap-4" aria-hidden={items.length === 0}>
          {[0, 1, 2].map((i) => {
            const p: Product | undefined = items[i]
            return (
              <div
                key={i}
                className={`overflow-hidden rounded-t-full rounded-b-[24px] bg-surface-2 shadow-pop ${i === 1 ? 'aspect-[3/5]' : 'aspect-[3/4.4]'} ${i === 1 ? '' : 'mb-6'}`}
              >
                {p ? (
                  <Link to={`/products/${p.slug}`} className="block h-full" tabIndex={-1} aria-label={p.name}>
                    <ProductImage product={p} eager />
                  </Link>
                ) : (
                  <div className="h-full animate-pulse motion-reduce:animate-none" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Cam kết của sàn — chỉ ghi những gì website thật sự làm */
function TrustStrip() {
  const items = [
    { icon: 'store' as const, title: 'Shop được duyệt', text: 'Quản trị viên duyệt trước khi cửa hàng được bán' },
    { icon: 'bag' as const, title: 'Một giỏ, nhiều shop', text: 'Đặt hàng nhiều cửa hàng trong một lần thanh toán' },
    { icon: 'star' as const, title: 'Đánh giá thật', text: 'Chỉ khách đã nhận hàng mới viết được đánh giá' },
    { icon: 'truck' as const, title: 'Thanh toán khi nhận', text: 'Hỗ trợ COD, theo dõi đơn từng bước' },
  ]
  return (
    <section className="border-y border-border bg-surface/70" aria-label="Cam kết của sàn">
      <ul className="container-page grid grid-cols-2 gap-x-4 gap-y-6 py-7 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.title} className="flex items-start gap-3">
            <Icon name={it.icon} size={22} className="mt-0.5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold">{it.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{it.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StoryCollage({ products }: { products: Product[] }) {
  const list = [...products.filter((p) => p.images.length), ...products.filter((p) => !p.images.length)].slice(0, 4)
  return (
    <div className="grid min-h-72 grid-cols-2 gap-2 p-2 sm:min-h-96" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`overflow-hidden bg-surface-2 ${['rounded-tl-[22px]', 'rounded-tr-[22px] lg:rounded-tr-none', 'rounded-bl-[22px]', 'rounded-br-[22px] lg:rounded-br-none'][i]}`}>
          {list[i] && <ProductImage product={list[i]} />}
        </div>
      ))}
    </div>
  )
}

function FinderShowcase() {
  return (
    <section className="container-page mt-20" aria-labelledby="finder-heading">
      <div className="grid gap-10 rounded-[28px] border border-border bg-surface p-7 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
        <div>
          <p className="eyebrow">Beauty Finder</p>
          <h2 id="finder-heading" className="section-title mt-3">
            Chưa biết bắt đầu từ đâu?
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted">
            Năm câu hỏi ngắn, kết quả lấy từ chính các sản phẩm đang bán trên sàn. Mỗi gợi ý đều kèm lý do vì sao sản phẩm hợp với bạn.
          </p>
          <Link to="/beauty-finder" className={`${button('dark', 'lg')} mt-8`}>
            Tìm sản phẩm cho tôi <Icon name="arrowRight" size={18} />
          </Link>
          <p className="mt-5 max-w-md text-xs text-muted">
            Beauty Finder không chẩn đoán hay điều trị bệnh da liễu. Nếu da có dấu hiệu bất thường, hãy hỏi ý kiến bác sĩ da liễu.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Câu 1/5 · Da của bạn thuộc loại nào?</p>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {skinTypeOptions.map((o) => (
              <li key={o.value}>
                <Link
                  to={`/beauty-finder?start=${o.value}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-bg px-4 py-3.5 transition-colors hover:border-primary hover:bg-primary-soft motion-reduce:transition-none"
                >
                  <span className="text-sm font-semibold">{o.label}</span>
                  <span className="mt-0.5 text-xs leading-snug text-muted">{o.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
