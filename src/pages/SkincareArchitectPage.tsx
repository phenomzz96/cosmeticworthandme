/**
 * SKINCARE ARCHITECT 3D — /skincare-architect (module tĩnh nằm ở /skincare-3d/index.html)
 * Tính năng chuyên biệt do nhóm 3D phát triển (mã nguồn: modules/skincare-3d). Trang này CHỈ nhúng module bằng iframe
 * theo hướng dẫn tích hợp của nhóm 3D (modules/skincare-3d/docs/integration.md), không sửa logic bên trong module.
 *
 * - iframe cùng origin với website, có ?hostOrigin=<origin website> để module gửi sự kiện đích danh về trang này.
 * - Chờ sự kiện 'skincare:ready' rồi mới ẩn khung chờ (không đoán thời gian tải).
 * - Chưa gửi 'skincare:sync' (đồng bộ sản phẩm/mục tiêu): sản phẩm của sàn chưa có các trường module cần
 *   (functions, recommendedPeriod...), và module không tự đoán dữ liệu thiếu. Khi nhóm thống nhất cách nhập các trường này
 *   thì mới bật đồng bộ.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Breadcrumbs, button } from '@/components/ui/primitives'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const MODULE_PATH = '/skincare-3d/index.html'
/** Quá thời gian này mà module chưa báo sẵn sàng → hiện hướng dẫn mở trong thẻ mới */
const READY_TIMEOUT = 15000

export function SkincareArchitectPage() {
  useDocumentTitle('Skincare Architect 3D')
  const frame = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'slow'>('loading')
  const src = `${MODULE_PATH}?hostOrigin=${encodeURIComponent(window.location.origin)}`

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Chỉ nhận tin từ đúng iframe của module, cùng origin với website
      if (e.source !== frame.current?.contentWindow || e.origin !== window.location.origin) return
      const data = e.data as { source?: string; type?: string } | null
      if (data?.source !== 'skincare-widget') return
      if (data.type === 'skincare:ready') setStatus('ready')
    }
    window.addEventListener('message', onMessage)
    const t = window.setTimeout(() => setStatus((s) => (s === 'loading' ? 'slow' : s)), READY_TIMEOUT)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(t)
    }
  }, [])

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Skincare Architect 3D' }]} />
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow inline-flex items-center gap-1.5">
            <Icon name="sparkle" size={14} /> Tính năng chuyên biệt
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Skincare Architect 3D</h1>
          <p className="mt-3 text-muted">
            Dựng chu trình skincare từ sản phẩm bạn chọn và xem vị trí thoa từng bước trên mô hình khuôn mặt 3D/2D. Mô hình chỉ minh họa vị trí áp dụng, không
            dự đoán hiệu quả và không phải chẩn đoán da liễu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={MODULE_PATH} target="_blank" rel="noopener" className={button('secondary', 'sm')}>
            Mở toàn màn hình <Icon name="arrowRight" size={14} />
          </a>
          <Link to="/beauty-finder" className={button('ghost', 'sm')}>
            Beauty Finder
          </Link>
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-card border border-border bg-surface">
        {status !== 'ready' && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-surface p-6 text-center" role="status" aria-live="polite">
            {status === 'loading' ? (
              <div>
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary motion-reduce:animate-none" />
                <p className="mt-3 text-sm text-muted">Đang tải Skincare Architect…</p>
              </div>
            ) : (
              <div className="max-w-sm">
                <p className="font-semibold">Module tải chậm hơn bình thường</p>
                <p className="mt-1 text-sm text-muted">Bạn có thể mở trong thẻ mới để dùng toàn màn hình.</p>
                <a href={MODULE_PATH} target="_blank" rel="noopener" className={`${button('dark', 'sm')} mt-4`}>
                  Mở trong thẻ mới
                </a>
                <button type="button" className={`${button('ghost', 'sm')} ml-2 mt-4`} onClick={() => setStatus('ready')}>
                  Vẫn hiện ở đây
                </button>
              </div>
            )}
          </div>
        )}
        <iframe
          ref={frame}
          src={src}
          title="Skincare Architect 3D: dựng chu trình skincare và xem trên mô hình khuôn mặt"
          className="block h-[min(88dvh,960px)] min-h-[640px] w-full border-0"
          loading="lazy"
          allow="fullscreen"
        />
      </div>

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
        Module do nhóm Skincare Architect phát triển, đang dùng thương hiệu và sản phẩm minh họa riêng; chưa liên kết với giỏ hàng của sàn. Dữ liệu chu trình,
        nhật ký chỉ lưu trên trình duyệt của bạn. Mô hình 3D cần Internet để tải thư viện Three.js; nếu thiết bị không hỗ trợ 3D, module tự chuyển sang sơ đồ 2D.
      </p>
    </div>
  )
}
