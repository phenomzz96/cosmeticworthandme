import type { Product, ProductVisual } from '@/types/catalog'

interface ProductImageProps {
  product: Pick<Product, 'name' | 'images' | 'visual'>
  /** Ảnh thứ mấy trong mảng images */
  index?: number
  className?: string
  /** Ảnh trên màn hình đầu tiên nên tải ngay; còn lại tải trễ */
  eager?: boolean
}

/**
 * Hiển thị ảnh sản phẩm. Khi sản phẩm chưa có ảnh thật (dữ liệu mẫu),
 * vẽ hình minh họa bao bì bằng SVG — nhẹ, nét, không cần tải file.
 */
export function ProductImage({ product, index = 0, className = '', eager = false }: ProductImageProps) {
  const src = product.images[index]
  if (src) {
    return (
      <img
        src={src}
        alt={product.name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }
  return <PackshotIllustration visual={product.visual} label={product.name} className={className} />
}

function PackshotIllustration({ visual, label, className }: { visual: ProductVisual; label: string; className: string }) {
  const { color, cap, shape } = visual
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Hình minh họa: ${label}`}
      className={`h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="200" height="200" fill={color} opacity="0.45" />
      <rect width="200" height="200" fill="url(#glow)" />
      <defs>
        <radialGradient id="glow" cx="0.5" cy="0.38" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="168" rx="48" ry="7" fill="#000" opacity="0.08" />
      <g stroke="#000" strokeOpacity="0.08" strokeWidth="1">
        <Shape shape={shape} color={color} cap={cap} />
      </g>
    </svg>
  )
}

function Shape({ shape, color, cap }: ProductVisual) {
  const shine = <rect x="0" y="0" width="6" height="0" fill="#fff" opacity="0.5" />
  switch (shape) {
    case 'bottle':
      return (
        <>
          <rect x="82" y="38" width="36" height="22" rx="4" fill={cap} />
          <rect x="68" y="58" width="64" height="108" rx="14" fill={color} />
          <rect x="76" y="70" width="6" height="80" rx="3" fill="#fff" opacity="0.55" />
          <rect x="80" y="100" width="40" height="26" rx="4" fill="#fff" opacity="0.6" />
        </>
      )
    case 'pump':
      return (
        <>
          <rect x="94" y="28" width="12" height="22" rx="2" fill={cap} />
          <rect x="94" y="28" width="34" height="8" rx="3" fill={cap} />
          <rect x="86" y="48" width="28" height="14" rx="3" fill={cap} />
          <rect x="66" y="60" width="68" height="106" rx="16" fill={color} />
          <rect x="74" y="72" width="6" height="80" rx="3" fill="#fff" opacity="0.55" />
          <rect x="80" y="98" width="40" height="30" rx="4" fill="#fff" opacity="0.6" />
        </>
      )
    case 'tube':
      return (
        <>
          <path d="M70 36 h60 l-6 104 h-48 Z" fill={color} />
          <rect x="68" y="30" width="64" height="10" rx="2" fill={color} />
          <rect x="74" y="138" width="52" height="28" rx="6" fill={cap} />
          <rect x="80" y="48" width="5" height="80" rx="2.5" fill="#fff" opacity="0.55" />
          <rect x="88" y="72" width="26" height="34" rx="3" fill="#fff" opacity="0.55" />
        </>
      )
    case 'jar':
      return (
        <>
          <rect x="54" y="78" width="92" height="24" rx="8" fill={cap} />
          <rect x="58" y="98" width="84" height="66" rx="16" fill={color} />
          <rect x="66" y="108" width="6" height="44" rx="3" fill="#fff" opacity="0.55" />
          <rect x="80" y="118" width="40" height="22" rx="4" fill="#fff" opacity="0.6" />
        </>
      )
    case 'dropper':
      return (
        <>
          <ellipse cx="100" cy="40" rx="11" ry="14" fill={cap} />
          <rect x="88" y="50" width="24" height="26" rx="4" fill={cap} />
          <rect x="74" y="74" width="52" height="92" rx="12" fill={color} />
          <rect x="81" y="84" width="5" height="70" rx="2.5" fill="#fff" opacity="0.55" />
          <rect x="86" y="104" width="28" height="28" rx="3" fill="#fff" opacity="0.6" />
        </>
      )
    case 'compact':
      return (
        <>
          <circle cx="100" cy="102" r="58" fill={cap} />
          <circle cx="100" cy="102" r="46" fill={color} />
          <circle cx="84" cy="86" r="12" fill="#fff" opacity="0.45" />
        </>
      )
    case 'lipstick':
      return (
        <>
          <path d="M88 44 l24 -10 v40 h-24 Z" fill={color} />
          <rect x="84" y="72" width="32" height="20" rx="2" fill="#d9b25f" />
          <rect x="80" y="90" width="40" height="76" rx="4" fill={cap} />
          <rect x="86" y="96" width="5" height="62" rx="2.5" fill="#fff" opacity="0.25" />
        </>
      )
    case 'brush':
      return (
        <g transform="rotate(-24 100 100)">
          <path d="M88 26 q12 -10 24 0 l-2 40 h-20 Z" fill={color} />
          <rect x="89" y="64" width="22" height="26" rx="2" fill="#c9c9d1" />
          <path d="M90 88 h20 l-4 84 h-12 Z" fill={cap} />
        </g>
      )
    case 'device':
      return (
        <>
          <rect x="66" y="34" width="68" height="132" rx="34" fill={cap} />
          <ellipse cx="100" cy="76" rx="26" ry="30" fill={color} />
          {[64, 76, 88].map((y) =>
            [86, 100, 114].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill="#fff" opacity="0.7" />),
          )}
          <circle cx="100" cy="134" r="8" fill="#fff" opacity="0.5" />
        </>
      )
    default:
      return shine
  }
}
