import { Link } from 'react-router-dom'
import { brand, copyrightYear, PLACEHOLDER, team } from '@/config/brand'
import { categories } from '@/data/taxonomy'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBrand } from '@/features/brand/BrandProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Logo } from './Logo'

export function Footer() {
  const { settings } = useBrand()
  const { isAdmin } = useAuth()
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-3">
          <Logo height={30} />
          <p className="max-w-xs text-sm text-muted">{brand.description}</p>
          {brand.slogan && <p className="text-sm font-medium text-primary">{brand.slogan}</p>}
        </div>

        <div>
          <h2 className="text-sm font-semibold">Danh mục</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/products?category=${c.id}`} className="hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Khám phá</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link to="/beauty-finder" className="hover:text-primary">Beauty Finder</Link></li>
            <li><Link to="/shops" className="hover:text-primary">Cửa hàng</Link></li>
            <li><Link to="/products?sort=newest" className="hover:text-primary">Sản phẩm mới</Link></li>
            <li><Link to="/seller" className="hover:text-primary">Mở cửa hàng</Link></li>
            {isAdmin && <li><Link to="/admin" className="hover:text-primary">Trang quản trị</Link></li>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Về dự án</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="sr-only">Nhóm thực hiện</dt>
              <dd className={team.name ? 'text-text' : 'italic text-muted'} data-placeholder={team.name ? undefined : 'team-name'}>
                {team.name ?? PLACEHOLDER.teamName}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Môn học</dt>
              <dd className="text-muted">Dự án học tập · {team.course}</dd>
            </div>
            {team.members.length > 0 && (
              <div>
                <dt className="sr-only">Thành viên</dt>
                <dd className="text-muted">{team.members.join(', ')}</dd>
              </div>
            )}
            {brand.contact.email && (
              <div>
                <dt className="sr-only">Email</dt>
                <dd><a href={`mailto:${brand.contact.email}`} className="text-muted hover:text-primary">{brand.contact.email}</a></dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="container-page py-5 text-xs text-muted">
          © {copyrightYear} {settings.name}. Website phục vụ học tập, chưa có giao dịch thật.{isSupabaseConfigured ? '' : ' Đang hiển thị dữ liệu mẫu.'}
        </p>
      </div>
    </footer>
  )
}
