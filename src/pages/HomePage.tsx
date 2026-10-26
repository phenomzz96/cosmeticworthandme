import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, ErrorState } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { categories } from '@/data/taxonomy'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { BannerCarousel } from '@/features/home/BannerCarousel'
import { skinTypeOptions } from '@/features/beauty-finder/questions'
import { ShopCard } from '@/features/shops/ShopCard'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import type { CategoryId, ProductVisual } from '@/types/catalog'

/** Hình minh họa đại diện cho từng danh mục */
const categoryVisual: Record<CategoryId, ProductVisual> = {
  skincare: { shape: 'dropper', color: '#EDE3F1', cap: '#6E4A86' },
  makeup: { shape: 'lipstick', color: '#A8372E', cap: '#2A1A1A' },
  haircare: { shape: 'pump', color: '#E7EFD3', cap: '#7A8A3A' },
  'body-care': { shape: 'jar', color: '#FBEBD9', cap: '#D08A4E' },
  'beauty-tools': { shape: 'brush', color: '#E8D9C8', cap: '#3B3B4F' },
}

export function HomePage() {
  const { settings } = useBrand()
  useDocumentTitle()
  const featured = useAsync(() => catalogService.getFeaturedProducts(8), [])
  const shops = useAsync(() => catalogService.getShops(), [])

  return (
    <>
      <Hero />
      <BannerCarousel />

      {/* DANH MỤC */}
      <section className="container-page mt-14" aria-labelledby="cat-heading">
        <div className="flex items-end justify-between gap-4">
          <h2 id="cat-heading" className="text-2xl font-bold tracking-tight">
            Mua theo danh mục
          </h2>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            Xem tất cả sản phẩm
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c, i) => (
            <li key={c.id} className={i === 0 ? 'col-span-2 sm:col-span-1' : ''}>
              <Link
                to={`/products?category=${c.id}`}
                className="group flex h-full items-center gap-3 rounded-card border border-border bg-surface p-3 hover:border-primary lg:flex-col lg:items-start lg:p-4"
              >
                <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-2xl lg:h-auto lg:w-full lg:aspect-[4/3]">
                  <ProductImage product={{ name: c.name, images: [], visual: categoryVisual[c.id] }} />
                </span>
                <span>
                  <span className="block font-semibold group-hover:text-primary">{c.name}</span>
                  <span className="block text-sm text-muted">{c.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FinderShowcase />

      {/* SẢN PHẨM NỔI BẬT */}
      <section className="container-page mt-16" aria-labelledby="featured-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="featured-heading" className="text-2xl font-bold tracking-tight">
              Sản phẩm nổi bật
            </h2>
            <p className="mt-1 text-sm text-muted">Được mua nhiều trong tháng từ các cửa hàng trên sàn.</p>
          </div>
          <Link to="/products?sort=popular" className="hidden text-sm font-medium text-primary hover:underline sm:block">
            Xem thêm
          </Link>
        </div>
        <div className="mt-5">
          {featured.status === 'loading' && <ProductGridSkeleton count={8} />}
          {featured.status === 'error' && <ErrorState />}
          {featured.status === 'success' && <ProductGrid products={featured.data} />}
        </div>
      </section>

      {/* CỬA HÀNG */}
      <section className="container-page mt-16" aria-labelledby="shops-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="shops-heading" className="text-2xl font-bold tracking-tight">
              Cửa hàng trên {settings.name}
            </h2>
            <p className="mt-1 text-sm text-muted">Mỗi cửa hàng tự quản lý sản phẩm, giá và tồn kho của mình.</p>
          </div>
          <Link to="/shops" className="text-sm font-medium text-primary hover:underline">
            Tất cả cửa hàng
          </Link>
        </div>
        {shops.status === 'success' && (
          <ul className="scrollbar-none -mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-5">
            {shops.data.map((s) => (
              <li key={s.id} className="w-64 shrink-0 snap-start md:w-auto">
                <ShopCard shop={s} />
              </li>
            ))}
          </ul>
        )}
        {shops.status === 'loading' && <div className="mt-5 h-40 animate-pulse rounded-card bg-surface-2" />}
      </section>

      {/* MỞ CỬA HÀNG */}
      <section className="container-page mt-16">
        <div className="flex flex-col items-start gap-4 rounded-card border border-border bg-surface p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="text-xl font-bold">Bạn kinh doanh mỹ phẩm?</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Mở cửa hàng trên {settings.name} để đăng bán sản phẩm và quản lý đơn hàng. Tính năng này sẽ có ở giai đoạn tiếp theo.
            </p>
          </div>
          <Link to="/seller" className={button('secondary')}>
            <Icon name="store" size={18} /> Tìm hiểu kênh người bán
          </Link>
        </div>
      </section>
    </>
  )
}

function Hero() {
  const { settings } = useBrand()
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface">
      {/* Quầng sáng "glow" — điểm nhấn thị giác duy nhất của trang chủ */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, var(--primary-soft) 45%, transparent 70%)' }}
      />
      <div className="container-page relative grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <h1 className="max-w-xl text-[2.25rem] font-extrabold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Chọn mỹ phẩm hợp với làn da của bạn, từ nhiều cửa hàng uy tín.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            {settings.name} gom skincare, makeup, haircare và body care từ nhiều cửa hàng về một nơi. Trả lời vài câu hỏi để
            Beauty Finder lọc ra sản phẩm phù hợp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/beauty-finder" className={button('primary', 'lg')}>
              <Icon name="sparkle" size={18} /> Bắt đầu Beauty Finder
            </Link>
            <Link to="/products" className={button('secondary', 'lg')}>
              Xem sản phẩm
            </Link>
          </div>
        </div>

        {/* Thẻ khởi động nhanh Beauty Finder */}
        <div className="rounded-[28px] border border-border bg-surface/90 p-5 shadow-pop backdrop-blur sm:p-7">
          <p className="text-sm font-semibold text-primary">Beauty Finder · Câu 1/5</p>
          <h2 className="mt-1.5 text-xl font-bold">Da của bạn thuộc loại nào?</h2>
          <ul className="mt-5 grid grid-cols-2 gap-2.5">
            {skinTypeOptions.map((o) => (
              <li key={o.value}>
                <Link
                  to={`/beauty-finder?start=${o.value}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-surface px-3.5 py-3 hover:border-primary hover:bg-primary-soft"
                >
                  <span className="text-sm font-semibold">{o.label}</span>
                  <span className="mt-0.5 text-xs leading-snug text-muted">{o.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Chọn một ô để tiếp tục. Gợi ý dựa trên thông tin sản phẩm, không thay thế tư vấn chuyên môn.</p>
        </div>
      </div>
    </section>
  )
}

const finderSteps = [
  { title: 'Loại da', text: 'Dầu, khô, hỗn hợp, thường hay nhạy cảm.' },
  { title: 'Mối quan tâm', text: 'Chọn tối đa 3: mụn, thâm, thiếu ẩm, lỗ chân lông...' },
  { title: 'Nhu cầu', text: 'Chăm sóc cơ bản, tập trung vấn đề hay chu trình đầy đủ.' },
  { title: 'Ngân sách', text: 'Khoảng giá bạn muốn chi cho mỗi sản phẩm.' },
  { title: 'Loại sản phẩm', text: 'Serum, kem dưỡng, chống nắng... hoặc để hệ thống gợi ý.' },
]

function FinderShowcase() {
  return (
    <section className="container-page mt-16" aria-labelledby="finder-heading">
      <div className="grid gap-8 rounded-[28px] bg-primary p-6 text-on-primary sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:gap-12">
        <div>
          <h2 id="finder-heading" className="text-3xl font-extrabold tracking-tight">
            Beauty Finder
          </h2>
          <p className="mt-3 max-w-md opacity-90">
            Năm câu hỏi ngắn, kết quả lấy từ chính các sản phẩm đang bán trên sàn. Mỗi gợi ý đều kèm lý do vì sao sản phẩm hợp với bạn.
          </p>
          <Link to="/beauty-finder" className={`${button('accent', 'lg')} mt-7`}>
            Tìm sản phẩm cho tôi
          </Link>
          <p className="mt-4 max-w-md text-xs opacity-75">
            Beauty Finder không chẩn đoán hay điều trị bệnh da liễu. Nếu da có dấu hiệu bất thường, hãy hỏi ý kiến bác sĩ da liễu.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {finderSteps.map((s, i) => (
            <li key={s.title} className={`rounded-2xl bg-white/10 p-4 ${i === finderSteps.length - 1 ? 'sm:col-span-2' : ''}`}>
              <span className="text-sm font-bold opacity-80">Bước {i + 1}</span>
              <p className="mt-1 font-semibold">{s.title}</p>
              <p className="mt-0.5 text-sm opacity-85">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
