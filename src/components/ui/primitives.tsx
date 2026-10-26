import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { discountPercent, formatPrice } from '@/lib/format'
import { Icon } from './Icon'

/** Class cho nút. Dùng: className={button('primary')} trên <button> hoặc <Link> */
export function button(variant: 'primary' | 'secondary' | 'ghost' | 'accent' = 'primary', size: 'md' | 'lg' | 'sm' = 'md') {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50'
  const sizes = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-13 px-7 text-base' }
  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary-hover',
    secondary: 'border border-border bg-surface text-text hover:border-primary hover:text-primary',
    ghost: 'text-text hover:bg-surface-2',
    accent: 'bg-accent text-on-accent hover:brightness-95',
  }
  return `${base} ${sizes[size]} ${variants[variant]}`
}

export function Price({ price, originalPrice, size = 'md' }: { price: number; originalPrice?: number; size?: 'md' | 'lg' }) {
  const off = discountPercent(price, originalPrice)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`font-bold tabular-nums text-text ${size === 'lg' ? 'text-3xl' : 'text-base'}`}>{formatPrice(price)}</span>
      {off > 0 && (
        <>
          <span className={`tabular-nums text-muted line-through ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
            <span className="sr-only">Giá gốc </span>
            {formatPrice(originalPrice!)}
          </span>
          <span className="rounded-md bg-sale/10 px-1.5 py-0.5 text-xs font-semibold text-sale">-{off}%</span>
        </>
      )}
    </div>
  )
}

export function Rating({ value, count, sold }: { value: number; count?: number; sold?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <Icon name="star" size={14} className="fill-star text-star" />
      <span className="font-semibold text-text">{value.toFixed(1)}</span>
      {count != null && <span>({count})</span>}
      {sold && <span className="before:mr-1.5 before:content-['|']">Đã bán {sold}</span>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none ${className}`} aria-hidden="true" />
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <EmptyState title="Không tải được dữ liệu" action={<button className={button('secondary')} onClick={() => location.reload()}>Tải lại trang</button>}>
      {message ?? 'Kiểm tra kết nối mạng rồi thử lại.'}
    </EmptyState>
  )
}

export function QuantityStepper({
  value,
  max,
  onChange,
  label = 'Số lượng',
}: {
  value: number
  max: number
  onChange: (v: number) => void
  label?: string
}) {
  return (
    <div className="inline-flex h-10 items-center rounded-control border border-border bg-surface" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-l-control text-muted hover:text-text disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Giảm số lượng"
      >
        <Icon name="minus" size={16} />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-r-control text-muted hover:text-text disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Tăng số lượng"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Đường dẫn" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={14} />}
            {item.to ? (
              <Link to={item.to} className="hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="line-clamp-1 text-text">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Ảnh đại diện shop: dùng logo nếu có, nếu không dùng chữ cái đầu trên màu của shop */
export function ShopAvatar({ name, color, logo, size = 44 }: { name: string; color: string; logo?: string; size?: number }) {
  if (logo) return <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" />
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {name.charAt(0)}
    </span>
  )
}

/** Nhãn báo cho người dùng biết nội dung là dữ liệu mẫu / chưa phải tính năng thật */
export function DemoBadge({ children = 'Dữ liệu mẫu' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-on-accent dark:text-accent">
      <Icon name="info" size={13} />
      {children}
    </span>
  )
}
