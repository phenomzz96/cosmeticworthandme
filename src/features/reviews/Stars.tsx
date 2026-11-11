import { Icon } from '@/components/ui/Icon'

/** Hiển thị số sao (chỉ đọc) */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} className={i <= Math.round(value) ? 'fill-star text-star' : 'text-border'} />
      ))}
    </span>
  )
}
