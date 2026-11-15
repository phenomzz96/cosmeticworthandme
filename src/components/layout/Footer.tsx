import { Link } from 'react-router-dom'
import { brand, copyrightYear } from '@/config/brand'
import { Icon } from '@/components/ui/Icon'
import { specialFeatures } from '@/config/features'
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
    <footer className="mt-24 border-t border-border bg-surface-2">
      {/* Dải thương hiệu: logo đầy đủ của nhóm (có slogan) + mô tả do Admin soạn */}
      <div className="container-page flex flex-col gap-6 border-b border-border py-10 md:flex-row md:items-center md:justify-between">
        <Logo height={104} className="max-w-full [&_img]:max-w-full [&_img]:h-auto" />
        <div className="max-w-md md:text-right">
          {brand.slogan && <p className="font-display text-2xl italic leading-snug text-text sm:text-[1.7rem]">{brand.slogan}</p>}
          {about.ready && about.body && <p className="mt-2 text-sm leading-relaxed text-muted">{about.body}</p>}
        </div>
      </div>
      <div className="container-page grid grid-cols-2 gap-10 py-12 md:grid-cols-4">

        <div>
          <h2 className="eyebrow !text-muted">Chỉ có ở {settings.name}</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-text/85">
            {specialFeatures.map((f) => (
              <li key={f.to}>
                <Link to={f.to} className={`inline-flex items-center gap-2 ${linkClass}`}>
                  <Icon name={f.icon} size={15} className="shrink-0 text-primary" />
                  {f.fullName}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-muted">Mua sắm</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-text/85">
            <li><Link to="/products" className={linkClass}>Tất cả sản phẩm</Link></li>
            <li><Link to="/products?sort=newest" className={linkClass}>Hàng mới về</Link></li>
            <li><Link to="/brands" className={linkClass}>Thương hiệu A–Z</Link></li>
            <li><Link to="/shops" className={linkClass}>Cửa hàng</Link></li>
            <li><Link to="/vouchers" className={linkClass}>Ưu đãi và ví voucher</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-muted">Hỗ trợ</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-text/85">
            <li><Link to="/faq" className={linkClass}>Câu hỏi thường gặp</Link></li>
            <li><Link to="/contact" className={linkClass}>Liên hệ</Link></li>
            <li><Link to="/policies" className={linkClass}>Chính sách</Link></li>
            <li><Link to="/terms" className={linkClass}>Điều khoản sử dụng</Link></li>
            <li><Link to="/about" className={linkClass}>Giới thiệu</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-muted">Tài khoản</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-text/85">
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
