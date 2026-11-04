import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { button } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { isSupabaseConfigured } from '@/lib/supabase'
import { socialService } from '@/services/social'

/** Trạng thái bật/tắt lưu trong database; chưa đăng nhập thì chuyển tới trang đăng nhập */
function useToggle(load: () => Promise<boolean>, toggle: () => Promise<boolean>, deps: unknown[]) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setOn(false)
    if (user && isSupabaseConfigured) {
      load()
        .then((v) => alive && setOn(v))
        .catch(() => undefined)
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ...deps])

  const click = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setOn(await toggle())
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  return { on, busy, error, click, available: isSupabaseConfigured }
}

export function FavoriteButton({ productId, size = 'lg' }: { productId: string; size?: 'sm' | 'lg' }) {
  const t = useToggle(() => socialService.isFavorite(productId), () => socialService.toggleFavorite(productId), [productId])
  if (!t.available) return null
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className={button('secondary', size)}
        onClick={() => void t.click()}
        disabled={t.busy}
        aria-pressed={t.on}
        title={t.on ? 'Bỏ khỏi danh sách yêu thích' : 'Thêm vào danh sách yêu thích'}
      >
        <Icon name="heart" size={18} className={t.on ? 'fill-sale text-sale' : ''} />
        {t.on ? 'Đã yêu thích' : 'Yêu thích'}
      </button>
      {t.error && <span className="mt-1 text-xs text-danger">{t.error}</span>}
    </span>
  )
}

export function FollowButton({ shopId, onChange }: { shopId: string; onChange?: (following: boolean, delta: number) => void }) {
  const [initial, setInitial] = useState<boolean | null>(null)
  const t = useToggle(
    async () => {
      const v = await socialService.isFollowing(shopId)
      setInitial(v)
      return v
    },
    () => socialService.toggleFollow(shopId),
    [shopId],
  )
  // Báo cho trang shop cập nhật số người theo dõi ngay (database đã đếm lại)
  useEffect(() => {
    if (initial === null) return
    onChange?.(t.on, Number(t.on) - Number(initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.on, initial])
  if (!t.available) return null
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className={button(t.on ? 'secondary' : 'primary', 'sm')}
        onClick={() => void t.click()}
        disabled={t.busy}
        aria-pressed={t.on}
      >
        {t.on ? (
          <>
            <Icon name="check" size={16} /> Đang theo dõi
          </>
        ) : (
          <>
            <Icon name="plus" size={16} /> Theo dõi
          </>
        )}
      </button>
      {t.error && <span className="mt-1 max-w-56 text-xs text-danger">{t.error}</span>}
    </span>
  )
}
