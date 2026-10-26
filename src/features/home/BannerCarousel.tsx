/** Băng chuyền banner trang chủ. Không có banner (hoặc chưa kết nối Supabase) thì không hiển thị gì. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { useAsync } from '@/lib/useAsync'
import { bannerService, bannerUrl } from '@/services/banners'

const AUTO_MS = 6000

export function BannerCarousel() {
  const state = useAsync(() => bannerService.listActive(), [])
  const banners = state.status === 'success' ? state.data : []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (banners.length < 2 || paused) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = window.setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTO_MS)
    return () => window.clearInterval(t)
  }, [banners.length, paused])

  if (!banners.length) return null
  const current = banners[Math.min(index, banners.length - 1)]
  const go = (d: number) => setIndex((i) => (i + d + banners.length) % banners.length)

  return (
    <section
      className="container-page mt-8"
      aria-roledescription="băng chuyền"
      aria-label="Chương trình nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-card border border-border bg-surface-2">
        <Link to={current.link_url} className="group block" aria-label={`${current.title}${current.subtitle ? `: ${current.subtitle}` : ''}`}>
          <img src={bannerUrl(current) ?? ''} alt="" className="aspect-[2/1] w-full object-cover sm:aspect-[3/1]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 sm:p-6">
            <p className="text-lg font-bold text-white sm:text-2xl">{current.title}</p>
            {current.subtitle && <p className="text-sm text-white/90 sm:text-base">{current.subtitle}</p>}
          </div>
        </Link>
        {banners.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-surface/90 shadow" aria-label="Banner trước">
              <Icon name="chevronLeft" size={18} />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-surface/90 shadow" aria-label="Banner sau">
              <Icon name="chevronRight" size={18} />
            </button>
            <div className="absolute bottom-2 right-3 flex gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Banner ${i + 1}: ${b.title}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`h-2 rounded-full ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
