import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { button } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { messageService } from '@/services/messages'
import { Composer } from './ChatThread'

/** Nút "Nhắn tin cho shop": mở khung soạn tin ngay tại chỗ, gửi xong chuyển tới hộp thư */
export function AskShopButton({
  shopId,
  shopName,
  productId,
  productName,
  variant = 'secondary',
  className = '',
}: {
  shopId: string
  shopName: string
  productId?: string
  productName?: string
  variant?: 'secondary' | 'ghost' | 'dark'
  className?: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector('textarea')?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!isSupabaseConfigured) return null

  return (
    <div className={className}>
      <button
        type="button"
        className={button(variant, 'sm')}
        aria-expanded={open}
        onClick={() => (user ? setOpen((o) => !o) : navigate(`/login?next=${encodeURIComponent(pathname)}`))}
      >
        <Icon name="message" size={16} /> Nhắn tin cho shop
      </button>
      {open && (
        <div ref={panel} className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-card" role="dialog" aria-label={`Nhắn tin cho ${shopName}`}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="truncate text-sm font-semibold">Nhắn tin cho {shopName}</p>
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2" aria-label="Đóng">
              <Icon name="x" size={16} />
            </button>
          </div>
          {productName && <p className="px-4 pt-3 text-xs text-muted">Kèm sản phẩm: {productName}</p>}
          <Composer
            label={`Tin nhắn cho ${shopName}`}
            initial={productName ? `Chào shop, mình muốn hỏi về sản phẩm "${productName}": ` : ''}
            onSend={async (body) => {
              const id = await messageService.start(shopId, body, productId)
              navigate(`/messages?c=${id}`)
            }}
          />
        </div>
      )}
    </div>
  )
}
