import { Link } from 'react-router-dom'
import { copyrightYear } from '@/config/brand'
import { categories } from '@/data/taxonomy'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBrand } from '@/features/brand/BrandProvider'
import { useSitePage } from '@/features/content/useSitePage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Logo } from './Logo'

const linkClass = 'hover:text-primary'

export function Footer() {
  const { settings } = useBrand()
  const { isAdmin } = useAuth()
  // Mô tả dưới logo do Admin soạn ở /admin/pages (để trống = không hiện)
  const about = useSitePage('footer')

  return (
    <footer className="mt-24 border-t border-border bg-surface-2/60">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo height={38} />
          {about.ready && about.body && <p className="max-w-xs text-sm text-muted">{about.body}</p>}
        </div>

        <div>
          <h2 className="eyebrow !text-text">Danh mục</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/products?category=${c.id}`} className={linkClass}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-text">Mua sắm</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link to="/products?sort=newest" className={linkClass}>Hàng mới về</Link></li>
            <li><Link to="/products?sort=popular" className={linkClass}>Bán chạy</Link></li>
            <li><Link to="/brands" className={linkClass}>Thương hiệu A–Z</Link></li>
            <li><Link to="/shops" className={linkClass}>Cửa hàng</Link></li>
            <li><Link to="/vouchers" className={linkClass}>Ví voucher</Link></li>
            <li><Link to="/beauty-finder" className={linkClass}>Beauty Finder</Link></li>
            <li><Link to="/skincare-architect" className={linkClass}>Skincare Architect 3D</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-text">Hỗ trợ</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link to="/faq" className={linkClass}>Câu hỏi thường gặp</Link></li>
            <li><Link to="/contact" className={linkClass}>Liên hệ</Link></li>
            <li><Link to="/policies" className={linkClass}>Chính sách</Link></li>
            <li><Link to="/terms" className={linkClass}>Điều khoản sử dụng</Link></li>
            <li><Link to="/about" className={linkClass}>Giới thiệu</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-text">Tài khoản</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link to="/orders" className={linkClass}>Đơn hàng của tôi</Link></li>
            <li><Link to="/messages" className={linkClass}>Tin nhắn</Link></li>
            <li><Link to="/favorites" className={linkClass}>Yêu thích</Link></li>
            <li><Link to="/seller" className={linkClass}>Bán hàng cùng {settings.name}</Link></li>
            {isAdmin && <li><Link to="/admin" className={linkClass}>Trang quản trị</Link></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="container-page py-5 text-xs text-muted">
          © {copyrightYear} {settings.name}.{isSupabaseConfigured ? '' : ' Đang hiển thị dữ liệu mẫu.'}
        </p>
      </div>
    </footer>
  )
}
