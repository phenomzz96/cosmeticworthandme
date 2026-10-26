import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '@/config/brand'
import { useBrand } from '@/features/brand/BrandProvider'

interface LogoProps {
  /** Chiều cao hiển thị (px). Chiều rộng tự theo tỷ lệ ảnh nên không méo. */
  height?: number
  /** Bọc trong link về trang chủ */
  asLink?: boolean
  className?: string
}

/**
 * Logo dùng chung cho MỌI vị trí (header, footer, trang đăng nhập...).
 * Nguồn: cài đặt thương hiệu trên Supabase (useBrand). Bản sáng/tối đổi theo theme bằng CSS.
 * Chưa có logo, hoặc ảnh lỗi → logo chữ dự phòng, màu theo design tokens.
 */
export function Logo({ height = 32, asLink = true, className = '' }: LogoProps) {
  const { settings } = useBrand()
  const content = <LogoImage height={height} />
  const wrapper = `inline-flex shrink-0 items-center ${className}`

  if (!asLink) return <span className={wrapper}>{content}</span>
  return (
    <Link to="/" className={`${wrapper} rounded-md`} aria-label={`${settings.name} – Trang chủ`}>
      {content}
    </Link>
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

  const common = {
    height,
    alt: settings.name,
    decoding: 'async' as const,
    onError: () => setFailed(true),
    // object-contain + width auto: luôn giữ tỷ lệ gốc, không kéo giãn hay cắt logo
    style: { height, width: 'auto', maxWidth: height * 7 },
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
 * LOGO DỰ PHÒNG — dùng khi chưa có logo chính thức.
 * Sinh từ tên thương hiệu; màu theo token nên luôn đủ tương phản ở cả 2 theme.
 */
export function FallbackLogo({ height = 32 }: { height?: number }) {
  const { settings } = useBrand()
  const initial = settings.name.trim().charAt(0).toUpperCase()
  const fontSize = Math.round(height * 0.56)
  return (
    <span className="inline-flex items-center gap-2" style={{ height }} data-brand-fallback="">
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full bg-primary font-extrabold text-on-primary"
        style={{ width: height, height, fontSize: Math.round(height * 0.5) }}
      >
        {initial}
      </span>
      <span className="whitespace-nowrap font-extrabold leading-none tracking-tight text-text" style={{ fontSize }}>
        {settings.name}
      </span>
    </span>
  )
}
