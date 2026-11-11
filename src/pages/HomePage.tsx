import { ScrollRow } from '@/components/ui/ScrollRow'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, ErrorState } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { categories } from '@/data/taxonomy'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { BannerCarousel } from '@/features/home/BannerCarousel'
import { BloomArt, ButterflyMark, GroomArt, RoutineArt, ScentArt } from '@/features/home/HeroArt'
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
  fragrance: { shape: 'perfume', color: '#F0D3DE', cap: '#B8924A' },
  men: { shape: 'tube', color: '#3A3F44', cap: '#9DB4C0' },
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
      <CategoryMarquee />
      <TrustStrip />
      <BannerCarousel />

      {/* DANH MỤC */}
      <section className="container-page mt-20" aria-labelledby="cat-heading">
        <SectionHead eyebrow="Danh mục" title="Tìm sản phẩm cho bạn" id="cat-heading" link={{ to: '/products', label: 'Xem tất cả sản phẩm' }} />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-7">
          {categories.map((c, i) => (
            <li key={c.id} className={i === 0 ? 'col-span-2 sm:col-span-1' : ''}>
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

      <ForHerForHim />

      <FinderShowcase />

      <ArchitectShowcase />

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
          <ScrollRow as="ul" aria-label="Cửa hàng nổi bật" wrapClassName="-mx-4 mt-8 md:mx-0" className="flex snap-x gap-4 px-4 pb-2 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
            {/* Chỉ giới thiệu shop đang có hàng; shop chưa có sản phẩm vẫn xem được ở trang Cửa hàng */}
            {shops.data
              .filter((s) => catalogService.countProductsByShop(s.id) > 0)
              .slice(0, 8)
              .map((s) => (
                <li key={s.id} className="w-64 shrink-0 snap-start md:w-auto">
                  <ShopCard shop={s} />
                </li>
              ))}
          </ScrollRow>
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

const heroSlides = [
  {
    key: 'nang',
    eyebrow: 'Skincare · Makeup · Nước hoa',
    title: 'Chọn đúng mỹ phẩm,',
    accent: 'đẹp theo cách của bạn.',
    text: (name: string) => `${name} gom skincare, makeup, nước hoa và đồ chăm sóc cho cả nàng lẫn chàng từ nhiều cửa hàng về một nơi.`,
    primary: { to: '/products', label: 'Mua sắm ngay' },
    secondary: { to: '/beauty-finder', label: 'Bắt đầu Beauty Finder' },
    Art: BloomArt,
  },
  {
    key: 'architect',
    eyebrow: 'Mới · Skincare Architect 3D',
    title: 'Xếp chu trình sáng – tối,',
    accent: 'xem thoa ở đâu trên mô hình 3D.',
    text: () =>
      'Trả lời Beauty Finder một lần: hệ thống chọn sản phẩm, sắp thứ tự từng bước, báo bước còn thiếu và tổ hợp cần thận trọng. Chỉ minh họa vị trí thoa, không chẩn đoán da.',
    primary: { to: '/skincare-architect', label: 'Thử Skincare Architect 3D' },
    secondary: { to: '/beauty-finder?focus=skincare', label: 'Làm Beauty Finder trước' },
    Art: RoutineArt,
  },
  {
    key: 'chang',
    eyebrow: 'Dành cho phái mạnh',
    title: 'Gọn gàng mỗi sáng,',
    accent: 'tự tin cả ngày.',
    text: () => 'Sữa rửa mặt, dưỡng ẩm, cạo râu và chăm sóc râu: chọn nhanh theo làn da và thói quen của bạn.',
    primary: { to: '/products?category=men', label: 'Khám phá đồ nam' },
    secondary: { to: '/beauty-finder?for=male', label: 'Beauty Finder cho nam' },
    Art: GroomArt,
  },
  {
    key: 'huong',
    eyebrow: 'Nước hoa',
    title: 'Mùi hương kể câu chuyện',
    accent: 'của riêng bạn.',
    text: () => 'Hoa cỏ, gỗ ấm, cam chanh tươi mát… Lọc theo nhóm hương và dịp dùng để tìm mùi hợp mình.',
    primary: { to: '/products?category=fragrance', label: 'Xem nước hoa' },
    secondary: { to: '/beauty-finder?focus=fragrance', label: 'Tìm mùi hợp mình' },
    Art: ScentArt,
  },
]

const HERO_INTERVAL = 7000

function Hero() {
  const { settings } = useBrand()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    if (paused || reduced) return
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % heroSlides.length), HERO_INTERVAL)
    return () => window.clearTimeout(t)
  }, [index, paused, reduced])

  const slide = heroSlides[index]
  const go = (i: number) => setIndex((i + heroSlides.length) % heroSlides.length)

  return (
    <section
      className="relative overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Giới thiệu nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <h1 className="sr-only">{settings.name}: sàn mỹ phẩm nhiều cửa hàng cho cả nam và nữ</h1>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-0 h-[38rem] w-[38rem] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--primary-soft) 0%, var(--accent-soft) 45%, transparent 70%)' }}
      />
      <div className="container-page relative grid items-center gap-8 py-10 md:py-14 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:py-16">
        <div key={slide.key} className="hero-in" aria-roledescription="slide" aria-label={`${index + 1} / ${heroSlides.length}`}>
          <p className="eyebrow">{slide.eyebrow}</p>
          <h2 className="mt-5 max-w-xl font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-[4.4rem]">
            {slide.title} <em className="font-medium italic text-primary">{slide.accent}</em>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">{slide.text(settings.name)}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={slide.primary.to} className={button('dark', 'lg')}>
              {slide.primary.label} <Icon name="arrowRight" size={18} />
            </Link>
            <Link to={slide.secondary.to} className={button('secondary', 'lg')}>
              <Icon name="sparkle" size={18} /> {slide.secondary.label}
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-4">
            <button type="button" onClick={() => go(index - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-text" aria-label="Trang trước">
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="flex items-center gap-2" role="group" aria-label="Chọn trang giới thiệu">
              {heroSlides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${i + 1}: ${s.eyebrow}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`h-2 rounded-full transition-all motion-reduce:transition-none ${i === index ? 'w-8 bg-ink' : 'w-2 bg-border hover:bg-muted'}`}
                />
              ))}
            </div>
            <button type="button" onClick={() => go(index + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-text" aria-label="Trang sau">
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        </div>

        <div key={`art-${slide.key}`} className="hero-in relative mx-auto w-full max-w-[560px]">
          <slide.Art className="h-auto w-full drop-shadow-sm" />
        </div>
      </div>
    </section>
  )
}

/** Dải chữ chạy: các nhóm sản phẩm (trang trí; liên kết thật nằm ở menu danh mục) */
function CategoryMarquee() {
  const words = categories.map((c) => c.name.toUpperCase())
  const row = [...words, ...words]
  return (
    <div className="overflow-hidden border-y border-border bg-ink py-4 text-on-ink" aria-hidden="true">
      <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap font-display text-2xl italic sm:text-3xl">
        {[...row, ...row].map((w, i) => (
          <span key={i} className="inline-flex items-center gap-8">
            {w}
            <span className="text-base not-italic text-on-ink/60">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Hai lối vào: cho nàng / cho chàng */
function ForHerForHim() {
  const tiles = [
    {
      key: 'her',
      eyebrow: 'Cho nàng',
      title: 'Dịu dàng hay cá tính, đều có lựa chọn.',
      links: [
        { to: '/products?category=skincare', label: 'Skincare' },
        { to: '/products?category=makeup', label: 'Makeup' },
        { to: '/products?category=fragrance&types=perfume-women,body-mist', label: 'Nước hoa nữ' },
        { to: '/products?category=body-care', label: 'Body care' },
      ],
      cta: { to: '/beauty-finder?for=female', label: 'Beauty Finder cho nàng' },
      dark: false,
    },
    {
      key: 'him',
      eyebrow: 'Cho chàng',
      title: 'Ít bước, đúng sản phẩm, gọn gàng.',
      links: [
        { to: '/products?category=men', label: 'Chăm sóc da nam' },
        { to: '/products?category=men&types=shaving,beard-care', label: 'Cạo & chăm sóc râu' },
        { to: '/products?category=fragrance&types=perfume-men,perfume-unisex', label: 'Nước hoa nam' },
        { to: '/products?category=haircare&types=hair-styling', label: 'Tạo kiểu tóc' },
      ],
      cta: { to: '/beauty-finder?for=male', label: 'Beauty Finder cho chàng' },
      dark: true,
    },
  ]
  return (
    <section className="container-page mt-20" aria-label="Mua sắm theo phong cách">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tiles.map((t) => (
          <div
            key={t.key}
            className="relative overflow-hidden rounded-[28px] p-7 sm:p-10"
            style={{ background: t.dark ? 'linear-gradient(140deg, var(--art-night-2), var(--art-night-1))' : 'linear-gradient(140deg, var(--art-sky-1), var(--art-sky-2))' }}
          >
            <ButterflyMark id={`ff-${t.key}`} className="pointer-events-none absolute -right-4 -top-2 h-32 w-40 opacity-80 sm:h-40 sm:w-48" />
            <p className={`eyebrow ${t.dark ? '!text-[var(--art-moth)]' : ''}`}>{t.eyebrow}</p>
            <h2 className={`mt-3 max-w-sm font-display text-3xl font-semibold leading-tight sm:text-4xl ${t.dark ? 'text-[var(--art-petal-4)]' : ''}`}>{t.title}</h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {t.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className={`inline-flex rounded-full border px-4 py-2 text-sm transition-colors motion-reduce:transition-none ${
                      t.dark ? 'border-white/25 text-[var(--art-petal-4)] hover:bg-white/10' : 'border-border bg-surface/70 hover:border-text'
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to={t.cta.to}
              className={`mt-7 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline ${t.dark ? 'text-[var(--art-moth)]' : 'text-primary'}`}
            >
              <Icon name="sparkle" size={16} /> {t.cta.label}
            </Link>
          </div>
        ))}
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

/** Quảng bá tính năng chuyên biệt Skincare Architect 3D */
function ArchitectShowcase() {
  const steps = [
    { n: 1, title: 'Trả lời Beauty Finder một lần', text: 'Loại da, vấn đề da, số bước bạn muốn: không phải hỏi lại.' },
    { n: 2, title: 'Tự xếp chu trình sáng – tối', text: 'Sắp thứ tự từng bước, báo bước còn thiếu, sản phẩm trùng công dụng và tổ hợp cần thận trọng.' },
    { n: 3, title: 'Xem thoa ở đâu trên mô hình 3D', text: 'Từng bước sáng lên đúng vùng da. Máy không hỗ trợ 3D thì xem sơ đồ 2D.' },
  ]
  return (
    <section className="container-page mt-20" aria-labelledby="architect-home-heading">
      <div
        className="relative grid items-center gap-8 overflow-hidden rounded-[28px] p-7 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:gap-12"
        style={{ background: 'linear-gradient(140deg, var(--art-night-2), var(--art-night-1))' }}
      >
        <div className="min-w-0">
          <p className="eyebrow inline-flex items-center gap-2 !text-[var(--art-moth)]">
            <span className="rounded-full bg-[var(--art-moth)] px-2 py-0.5 text-[11px] font-bold tracking-normal text-[var(--art-night-1)]">MỚI</span>
            Tính năng chuyên biệt
          </p>
          <h2 id="architect-home-heading" className="mt-3 font-display text-4xl font-semibold leading-tight text-[var(--art-petal-4)] sm:text-5xl">
            Skincare Architect 3D
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-[var(--art-petal-4)] opacity-80">
            Biến sản phẩm bạn đã mua hoặc được gợi ý thành một chu trình chăm sóc da rõ ràng, có thứ tự, kèm mô hình khuôn mặt chỉ vị trí thoa.
          </p>
          <ol className="mt-7 grid gap-4">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--art-wing-1)] font-bold text-[var(--art-petal-4)]">{s.n}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--art-petal-4)]">{s.title}</span>
                  <span className="block text-sm leading-relaxed text-[var(--art-petal-4)] opacity-75">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/skincare-architect" className="inline-flex h-12 items-center gap-2 rounded-control bg-[var(--art-petal-4)] px-6 text-[15px] font-semibold text-[var(--art-night-1)] hover:opacity-90">
              Thử ngay <Icon name="arrowRight" size={18} />
            </Link>
            <Link
              to="/beauty-finder?focus=skincare"
              className="inline-flex h-12 items-center gap-2 rounded-control border border-white/25 px-6 text-[15px] font-medium text-[var(--art-petal-4)] hover:bg-white/10"
            >
              <Icon name="sparkle" size={18} /> Làm Beauty Finder trước
            </Link>
          </div>
          <p className="mt-5 text-xs text-[var(--art-petal-4)] opacity-60">Chỉ minh họa vị trí thoa theo thông tin cửa hàng khai báo, không dự đoán hiệu quả và không chẩn đoán da liễu.</p>
        </div>
        <div className="mx-auto w-full max-w-[420px]">
          <RoutineArt className="h-auto w-full" />
        </div>
      </div>
    </section>
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
            Vài câu hỏi ngắn cho cả nam và nữ: da mặt, trang điểm, tóc, cơ thể hay nước hoa. Kết quả lấy từ sản phẩm đang bán trên sàn, kèm lý do vì sao sản phẩm hợp với bạn.
          </p>
          <Link to="/beauty-finder" className={`${button('dark', 'lg')} mt-8`}>
            Tìm sản phẩm cho tôi <Icon name="arrowRight" size={18} />
          </Link>
          <p className="mt-5 max-w-md text-xs text-muted">
            Beauty Finder không chẩn đoán hay điều trị bệnh da liễu. Nếu da có dấu hiệu bất thường, hãy hỏi ý kiến bác sĩ da liễu.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Bắt đầu nhanh với chăm sóc da · Da của bạn thuộc loại nào?</p>
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
          <p className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="text-muted">Hoặc:</span>
            <Link to="/beauty-finder?for=male" className="font-medium text-primary underline-offset-4 hover:underline">
              Gợi ý cho nam
            </Link>
            <span className="text-muted">·</span>
            <Link to="/beauty-finder?focus=fragrance" className="font-medium text-primary underline-offset-4 hover:underline">
              Tìm nước hoa
            </Link>
            <span className="text-muted">·</span>
            <Link to="/beauty-finder?focus=haircare" className="font-medium text-primary underline-offset-4 hover:underline">
              Chăm sóc tóc
            </Link>
            <span className="text-muted">·</span>
            <Link to="/skincare-architect" className="font-medium text-primary underline-offset-4 hover:underline">
              Skincare Architect 3D
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
