import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '@/config/brand'
import { useBrand } from '@/features/brand/BrandProvider'

interface LogoProps {
  /** Chiều cao hiển thị (px). Chiều rộng tự theo tỷ lệ ảnh nên không méo. */
  height?: number
  /**
   * mark: biểu tượng W&M + tên thương hiệu (đầu trang, trang đăng nhập — chỗ nhỏ, slogan trong logo đầy đủ sẽ không đọc được).
   * full: logo đầy đủ có slogan (chân trang, trang giới thiệu).
   */
  variant?: 'mark' | 'full'
  /** variant mark: ẩn tên chữ trên màn hình rất hẹp (vẫn có trong nhãn cho trình đọc màn hình) */
  compactName?: boolean
  /** Bọc trong link về trang chủ */
  asLink?: boolean
  className?: string
}

/**
 * Logo dùng chung cho MỌI vị trí (header, footer, trang đăng nhập...).
 * - Logo đầy đủ: logo Admin tải lên ở /admin/brand (Supabase), chưa có thì dùng logo nhóm cung cấp trong public/brand/.
 * - Biểu tượng: file trong public/brand/ (src/config/brand.ts, mục logo.mark).
 * Bản sáng/tối đổi theo theme bằng CSS, ảnh có sẵn chiều rộng/cao nên không làm trang nhảy khi tải.
 * Ảnh lỗi → logo chữ dự phòng.
 */
export function Logo({ height = 32, variant = 'full', compactName = false, asLink = true, className = '' }: LogoProps) {
  const { settings } = useBrand()
  const content = variant === 'mark' ? <LogoMark height={height} compactName={compactName} /> : <LogoImage height={height} />
  const wrapper = `inline-flex shrink-0 items-center ${className}`

  if (!asLink) return <span className={wrapper}>{content}</span>
  return (
    <Link to="/" className={`${wrapper} rounded-md`} aria-label={`${settings.name} – Trang chủ`}>
      {content}
    </Link>
  )
}

/** Biểu tượng W&M + tên thương hiệu viết bằng font tiêu đề */
function LogoMark({ height, compactName }: { height: number; compactName: boolean }) {
  const { settings } = useBrand()
  const [failed, setFailed] = useState(false)
  const { light, dark, aspectRatio } = brand.logo.mark
  const width = Math.round(height * aspectRatio)
  const img = {
    width,
    height,
    alt: '',
    decoding: 'async' as const,
    onError: () => setFailed(true),
    style: { width, height },
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      {!failed && (
        <>
          <img src={light} {...img} className="block shrink-0 object-contain dark:hidden" />
          <img src={dark} {...img} className="hidden shrink-0 object-contain dark:block" />
        </>
      )}
      <span
        className={`whitespace-nowrap font-display font-semibold leading-none tracking-tight text-text ${compactName && !failed ? 'max-[380px]:sr-only' : ''}`}
        style={{ fontSize: Math.round(height * 0.66) }}
      >
        {settings.name}
      </span>
    </span>
  )
}

function LogoImage({ height }: { height: number }) {
  const { settings } = useBrand()
  const light = settings.logoLight
  const dark = settings.logoDark
  const [failed, setFailed] = useState(false)

  // Logo đổi (Admin vừa lưu) → thử hiển thị lại
  useEffect(() => setFailed(false), [light, dark])

  if (!light || failed) return <FallbackLogo height={height} />

  // Logo nhóm cung cấp: biết tỷ lệ → đặt sẵn chiều rộng (không nhảy bố cục). Logo Admin tải lên: chỉ cố định chiều cao.
  const known = light === brand.logo.light
  const width = known ? Math.round(height * brand.logo.aspectRatio) : undefined
  const common = {
    height,
    width,
    alt: settings.name,
    decoding: 'async' as const,
    onError: () => setFailed(true),
    // object-contain + width auto: luôn giữ tỷ lệ gốc, không kéo giãn hay cắt logo
    style: { height, width: width ?? 'auto', maxWidth: height * 7 },
  }

  if (!dark) {
    return (
      <span className={brand.logo.darkBackdrop ? 'dark:rounded-md dark:bg-white dark:px-1.5 dark:py-1' : undefined}>
        <img src={light} {...common} className="block object-contain" />
      </span>
    )
  }

  return (
    <>
      <img src={light} {...common} className="block object-contain dark:hidden" />
      <img src={dark} {...common} className="hidden object-contain dark:block" />
    </>
  )
}

/**
 * LOGO DỰ PHÒNG — dùng khi ảnh logo lỗi.
 * Chỉ là tên thương hiệu viết bằng font tiêu đề. Màu theo token nên đủ tương phản ở cả 2 theme.
 */
export function FallbackLogo({ height = 32 }: { height?: number }) {
  const { settings } = useBrand()
  const fontSize = Math.round(height * 0.84)
  return (
    <span className="inline-flex items-center" style={{ height }} data-brand-fallback="">
      <span className="whitespace-nowrap font-display font-semibold leading-none tracking-tight text-text" style={{ fontSize }}>
        {settings.name}
      </span>
    </span>
  )
}
