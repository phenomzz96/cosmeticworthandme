/** Thành phần dùng chung cho các trang đơn hàng: nhãn trạng thái, tiến trình, dòng sản phẩm, mã QR mô phỏng */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ProductImage } from '@/components/ui/ProductImage'
import { formatPrice } from '@/lib/format'
import { encodeQr, qrSvgPath } from '@/lib/qr'
import { DEFAULT_VISUAL } from '@/services/catalog'
import { shopMediaUrl } from '@/services/media'
import { ORDER_FLOW, orderStatusLabels, paymentStatusLabels, type OrderItem, type OrderStatus, type PaymentStatus } from '@/types/order'

const statusStyles: Record<OrderStatus, string> = {
  pending: 'bg-accent-soft text-on-accent dark:text-accent',
  confirmed: 'bg-primary-soft text-primary',
  preparing: 'bg-primary-soft text-primary',
  shipping: 'bg-primary-soft text-primary',
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-danger/10 text-danger',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>{orderStatusLabels[status]}</span>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const s = { unpaid: 'bg-surface-2 text-muted', pending_confirmation: 'bg-accent-soft text-on-accent dark:text-accent', paid: 'bg-success/15 text-success' }[status]
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s}`}>{paymentStatusLabels[status]}</span>
}

/** Tiến trình 5 bước của đơn con. Đơn đã hủy hiển thị dòng thông báo thay cho tiến trình. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null
  const current = ORDER_FLOW.indexOf(status)
  return (
    <ol className="flex items-center gap-1" aria-label={`Tiến trình đơn: ${orderStatusLabels[status]}`}>
      {ORDER_FLOW.map((s, i) => (
        <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <span className={`h-1.5 w-full rounded-full ${i <= current ? 'bg-primary' : 'bg-surface-2'}`} aria-hidden />
          <span className={`hidden text-[11px] sm:block ${i === current ? 'font-semibold text-primary' : i < current ? 'text-text' : 'text-muted'}`}>{orderStatusLabels[s]}</span>
          {i === current && <span className="sr-only">Bước hiện tại</span>}
        </li>
      ))}
    </ol>
  )
}

export function OrderItemRow({ item, linkProduct = true }: { item: OrderItem; linkProduct?: boolean }) {
  const img = shopMediaUrl(item.image_path)
  const name = linkProduct && item.product_slug ? (
    <Link to={`/products/${item.product_slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
      {item.product_name}
    </Link>
  ) : (
    <p className="line-clamp-2 text-sm font-medium">{item.product_name}</p>
  )
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        <ProductImage product={{ name: item.product_name, images: img ? [img] : [], visual: DEFAULT_VISUAL }} />
      </div>
      <div className="min-w-0 flex-1">
        {name}
        <p className="text-xs text-muted">
          {formatPrice(item.unit_price)} × {item.quantity}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(item.line_total)}</p>
    </li>
  )
}

/** Mã QR (SVG). Màu cố định đen/trắng để máy quét đọc được ở cả giao diện tối. */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const { d, size: n } = useMemo(() => qrSvgPath(encodeQr(value)), [value])
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" className="rounded-lg">
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  )
}
