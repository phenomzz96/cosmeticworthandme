/**
 * SKINCARE ARCHITECT 3D — /skincare-architect (module tĩnh nằm ở /skincare-3d/index.html)
 * Tính năng chuyên biệt do nhóm 3D phát triển (modules/skincare-3d). Trang này nhúng module bằng iframe và nối dữ liệu
 * của sàn theo giao thức của module (modules/skincare-3d/docs/integration.md):
 *   - catalog            : sản phẩm skincare đang bán trên sàn (công dụng/thời điểm/vùng thoa do người bán khai báo, migration 010)
 *   - purchasedProductIds: sản phẩm khách đã mua trên sàn (đơn chưa hủy)
 *   - goals / skin       : câu trả lời Beauty Finder (da mặt) — khách không phải trả lời lại
 * Sau đó thêm bộ sản phẩm Beauty Finder đề xuất (?pick=) vào chu trình, và gợi ý sản phẩm của sàn cho bước còn thiếu.
 * Phân vai: Beauty Finder CHỌN sản phẩm; Skincare Architect SẮP XẾP chu trình sáng/tối, kiểm tra tổ hợp, minh họa 3D.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Breadcrumbs, button, Price } from '@/components/ui/primitives'
import { productTypeLabels } from '@/data/taxonomy'
import { useAuth } from '@/features/auth/AuthProvider'
import { answersFromParams } from '@/features/beauty-finder/questions'
import { useBrand } from '@/features/brand/BrandProvider'
import { useCart } from '@/features/cart/CartProvider'
import { isolateModuleData, markQuizSynced, quizChanged, readFinderSkin } from '@/features/skincare-3d/finderBridge'
import { activesOf, finderToModuleQuiz, isRoutineReady, MODULE_CATEGORY, MODULE_GOALS, toModuleProduct } from '@/features/skincare-3d/routineFields'
import { useTheme } from '@/features/theme/ThemeProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'
import { orderService } from '@/services/orders'
import type { Product } from '@/types/catalog'

const MODULE_PATH = '/skincare-3d/index.html'
const READY_TIMEOUT = 15000

/** Tên bước của module → nhóm sản phẩm (để gợi ý sản phẩm của sàn cho bước còn thiếu) */
const STEP_CATEGORY: Record<string, string> = {
  'Làm sạch': 'cleanser',
  Toner: 'toner',
  Serum: 'serum',
  'Chăm sóc chuyên biệt': 'treatment',
  'Dưỡng ẩm': 'moisturizer',
  'Chống nắng': 'sunscreen',
}
interface RoutineDetail {
  productIds: string[]
  missing: { title: string; category: string }[]
  unmetGoals: { key: string; label: string }[]
  /** Hoạt chất module giữ ngoài chu trình theo mục tiêu đang chọn (vd. da dễ kích ứng) — không gợi ý sản phẩm có chúng */
  avoid: string[]
  status: string
}

export function SkincareArchitectPage() {
  useDocumentTitle('Skincare Architect 3D')
  const { user, status: authStatus } = useAuth()
  const authLoading = authStatus === 'loading'
  const { settings } = useBrand()
  const { theme } = useTheme()
  const [params] = useSearchParams()
  const frame = useRef<HTMLIFrameElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'prepare' | 'loading' | 'ready' | 'slow' | 'error'>('prepare')
  const [products, setProducts] = useState<Product[] | null>(null)
  const [purchased, setPurchased] = useState<string[] | null>(null)
  const [detail, setDetail] = useState<RoutineDetail | null>(null)
  const [moduleReady, setModuleReady] = useState(false)
  const [pickMissed, setPickMissed] = useState(0)
  const synced = useRef(false)
  const picked = useRef(false)
  const pickRequest = useRef(0)

  // Câu trả lời Beauty Finder: từ đường dẫn (bấm từ trang kết quả) hoặc lần làm gần nhất trên trình duyệt này
  const quiz = useMemo(() => {
    const fromUrl = params.get('from') === 'finder' ? answersFromParams(params) : null
    if (fromUrl?.focus === 'skincare') return finderToModuleQuiz(fromUrl.concerns, fromUrl.skinType)
    const saved = readFinderSkin()
    return saved ? finderToModuleQuiz(saved.concerns, saved.skinType) : null
  }, [params])
  const picks = useMemo(() => (params.get('pick') ?? '').split(',').filter(Boolean).slice(0, 8), [params])

  const routineProducts = useMemo(() => (products ?? []).filter((p) => MODULE_CATEGORY[p.type]), [products])
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products])

  // 1. Tách dữ liệu module theo tài khoản, tải sản phẩm và lịch sử mua
  useEffect(() => {
    if (authLoading) return
    let alive = true
    void (async () => {
      await isolateModuleData(user?.id ?? 'guest')
      try {
        const [list, ids] = await Promise.all([
          catalogService.getAllActiveProducts(),
          user && isSupabaseConfigured ? orderService.purchasedProductIds().catch(() => [] as string[]) : Promise.resolve([] as string[]),
        ])
        if (!alive) return
        setProducts(list)
        setPurchased(ids)
        setStatus('loading')
      } catch {
        if (alive) setStatus('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [authLoading, user])

  const post = useCallback((message: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(message, window.location.origin)
  }, [])

  // 2. Nhận sự kiện từ module (chỉ từ đúng iframe, đúng tên miền)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== window.location.origin) return
      const m = e.data as { source?: string; type?: string; detail?: Record<string, unknown> } | null
      if (m?.source === 'skincare-widget') {
        if (m.type === 'skincare:ready') setModuleReady(true)
        if (m.type === 'host:applied' && !picked.current) {
          picked.current = true
          if (picks.length) {
            pickRequest.current = picks.length
            post({ source: 'wm-host', type: 'wm:select', ids: picks })
          }
          setStatus('ready')
        }
        if (m.type === 'routine:updated' && synced.current) setDetail(readDetail(m.detail))
        if (m.type === 'host:error') setStatus('error')
      }
      // Lớp nhúng của Worth & Me báo kết quả thêm sản phẩm (module chỉ cho thêm khi đã chọn mục tiêu)
      if (m?.source === 'wm-embed' && m.type === 'wm:selected') {
        const blocked = Array.isArray(m.detail?.blocked) ? (m.detail.blocked as string[]) : []
        if (pickRequest.current) setPickMissed(blocked.length)
        pickRequest.current = 0
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [picks, post])

  // 3. Module sẵn sàng + đã có dữ liệu → gửi dữ liệu của sàn
  useEffect(() => {
    if (!moduleReady || !products || !purchased || synced.current) return
    synced.current = true
    const catalog = routineProducts.map(toModuleProduct)
    const known = new Set(catalog.map((c) => c.id))
    const payload: Record<string, unknown> = { catalog, purchasedProductIds: purchased.filter((id) => known.has(id)) }
    const signature = quiz ? JSON.stringify(quiz) : ''
    if (quiz && (params.get('from') === 'finder' || quizChanged(signature))) {
      payload.goals = quiz.goals
      payload.skin = quiz.skin
      markQuizSynced(signature)
    }
    post({ source: 'skincare-widget-host', type: 'skincare:sync', payload })
  }, [moduleReady, products, purchased, routineProducts, quiz, params, post])

  // Đổi sáng/tối trên website → đổi trong module (không tải lại)
  useEffect(() => {
    if (moduleReady) post({ source: 'wm-host', type: 'wm:theme', theme, accent: settings.primaryColor })
  }, [theme, settings.primaryColor, moduleReady, post])

  useEffect(() => {
    if (status !== 'loading') return
    const t = window.setTimeout(() => setStatus((s) => (s === 'loading' ? 'slow' : s)), READY_TIMEOUT)
    return () => window.clearTimeout(t)
  }, [status])

  // iframe chỉ tạo một lần (đổi giao diện qua tin nhắn, không đổi src)
  const src = useMemo(
    () =>
      `${MODULE_PATH}?hostOrigin=${encodeURIComponent(window.location.origin)}&embed=1&theme=${theme}&accent=${encodeURIComponent(settings.primaryColor)}`,
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fullscreen = () => {
    const el = wrap.current
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined)
  }

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
            Xếp sản phẩm của bạn thành chu trình sáng – tối và xem vị trí thoa từng bước trên mô hình khuôn mặt 3D/2D. Mô hình chỉ minh họa vị trí áp dụng,
            không dự đoán hiệu quả và không phải chẩn đoán da liễu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fullscreen} className={button('secondary', 'sm')}>
            Toàn màn hình
          </button>
          <Link to="/beauty-finder?focus=skincare" className={button('ghost', 'sm')}>
            <Icon name="sparkle" size={14} /> {quiz ? 'Làm lại Beauty Finder' : 'Làm Beauty Finder trước'}
          </Link>
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2 text-xs" aria-label="Dữ liệu đang dùng">
        <DataChip ok={!!products}>{products ? `${routineProducts.filter(isRoutineReady).length} sản phẩm skincare của sàn có đủ thông tin chu trình` : 'Đang tải sản phẩm…'}</DataChip>
        <DataChip ok={!!user && !!purchased?.length}>
          {!user ? 'Chưa đăng nhập: chưa dùng lịch sử mua' : purchased?.length ? `Dùng ${purchased.filter((id) => byId.get(id) && MODULE_CATEGORY[byId.get(id)!.type]).length} sản phẩm skincare bạn đã mua` : 'Bạn chưa mua sản phẩm skincare nào'}
        </DataChip>
        <DataChip ok={!!quiz}>{quiz ? 'Mục tiêu lấy từ Beauty Finder' : 'Chưa làm Beauty Finder: chọn mục tiêu trong khung bên dưới'}</DataChip>
        {picks.length > 0 && <DataChip ok>{`${picks.length} sản phẩm Beauty Finder đề xuất được thêm vào chu trình`}</DataChip>}
      </ul>
      {!user && !authLoading && (
        <p className="mt-3 text-sm text-muted">
          <Link to="/login?next=/skincare-architect" className="font-medium text-primary underline">
            Đăng nhập
          </Link>{' '}
          để chu trình dùng sản phẩm bạn đã mua trên sàn.
        </p>
      )}

      {pickMissed > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-2 px-4 py-3 text-sm" role="status">
          <span className="min-w-0 flex-1">
            Chưa thêm được {pickMissed} sản phẩm vào chu trình: hãy chọn mục tiêu ở bước "Mục tiêu" trong khung bên dưới trước (hoặc làm Beauty Finder).
          </span>
          <button
            type="button"
            className={button('dark', 'sm')}
            onClick={() => {
              pickRequest.current = picks.length
              post({ source: 'wm-host', type: 'wm:select', ids: picks })
            }}
          >
            Thêm lại
          </button>
        </div>
      )}

      <div ref={wrap} className="relative mt-5 overflow-hidden rounded-card border border-border bg-surface">
        {status !== 'ready' && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-surface p-6 text-center" role="status" aria-live="polite">
            {status === 'error' ? (
              <div className="max-w-sm">
                <p className="font-semibold">Chưa tải được dữ liệu cho Skincare Architect</p>
                <p className="mt-1 text-sm text-muted">Kiểm tra kết nối rồi tải lại trang.</p>
                <button type="button" className={`${button('dark', 'sm')} mt-4`} onClick={() => window.location.reload()}>
                  Tải lại
                </button>
              </div>
            ) : status === 'slow' ? (
              <div className="max-w-sm">
                <p className="font-semibold">Module tải chậm hơn bình thường</p>
                <p className="mt-1 text-sm text-muted">Mạng chậm có thể làm mô hình tải lâu.</p>
                <button type="button" className={`${button('ghost', 'sm')} mt-4`} onClick={() => setStatus('ready')}>
                  Vẫn hiện
                </button>
              </div>
            ) : (
              <div>
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary motion-reduce:animate-none" />
                <p className="mt-3 text-sm text-muted">Đang chuẩn bị chu trình từ dữ liệu của bạn…</p>
              </div>
            )}
          </div>
        )}
        {status !== 'prepare' && (
          <iframe
            ref={frame}
            src={src}
            title="Skincare Architect 3D: chu trình skincare và mô hình khuôn mặt"
            className="block h-[min(88dvh,960px)] min-h-[640px] w-full border-0"
            allow="fullscreen"
          />
        )}
      </div>

      {detail && <RoutineShop detail={detail} byId={byId} purchased={purchased ?? []} catalog={routineProducts} onAdd={(id) => post({ source: 'wm-host', type: 'wm:select', ids: [id] })} />}

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted">
        Module do nhóm Skincare Architect phát triển. Chu trình chỉ dùng công dụng, thời điểm dùng và vùng thoa do cửa hàng khai báo; sản phẩm chưa khai báo
        sẽ được báo "thiếu dữ liệu" thay vì đoán. Chu trình, nhật ký, ảnh lưu trên trình duyệt này và được xóa khi tài khoản khác dùng trình duyệt. Mô hình 3D
        cần Internet để tải thư viện Three.js; thiết bị không hỗ trợ 3D sẽ tự chuyển sang sơ đồ 2D.
      </p>
    </div>
  )
}

function DataChip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${ok ? 'border-primary/30 bg-primary-soft text-text' : 'border-border text-muted'}`}>
      <Icon name={ok ? 'check' : 'info'} size={13} />
      {children}
    </li>
  )
}

function readDetail(d: Record<string, unknown> | undefined): RoutineDetail {
  const res = (d?.res ?? {}) as {
    status?: string
    warnings?: { type?: string; title?: string }[]
    goals?: { key?: string; label?: string; state?: string }[]
  }
  const missing = (res.warnings ?? [])
    .filter((w) => w.type === 'missing' && typeof w.title === 'string')
    .map((w) => {
      const name = Object.keys(STEP_CATEGORY).find((n) => w.title!.includes(`bước ${n}`))
      return { title: w.title!, category: name ? STEP_CATEGORY[name] : '' }
    })
    .filter((m) => m.category)
  const unmetGoals = (res.goals ?? [])
    .filter((g) => g.state === 'unmet' && !!g.key && !!MODULE_GOALS[g.key]?.functions.length)
    .map((g) => ({ key: g.key!, label: g.label ?? g.key! }))
  const goals = ((d?.quiz as { goals?: unknown } | null)?.goals ?? []) as unknown[]
  const avoid = goals.flatMap((g) => (typeof g === 'string' ? (MODULE_GOALS[g]?.avoidActives ?? []) : []))
  return { productIds: Array.isArray(d?.productIds) ? (d!.productIds as string[]) : [], missing, unmetGoals, avoid, status: res.status ?? '' }
}

/** Nối chu trình với cửa hàng: sản phẩm trong chu trình (mua ngay nếu chưa mua) + gợi ý cho bước thiếu / mục tiêu chưa đáp ứng */
function RoutineShop({
  detail,
  byId,
  purchased,
  catalog,
  onAdd,
}: {
  detail: RoutineDetail
  byId: Map<string, Product>
  purchased: string[]
  catalog: Product[]
  onAdd: (id: string) => void
}) {
  const inRoutine = detail.productIds.map((id) => byId.get(id)).filter((p): p is Product => !!p)
  const notBought = inRoutine.filter((p) => !purchased.includes(p.id))
  const pool = catalog
    .filter((p) => isRoutineReady(p) && p.stock > 0 && !detail.productIds.includes(p.id) && !activesOf(p.keyIngredients).some((a) => detail.avoid.includes(a)))
    .sort((a, b) => b.rating - a.rating || b.soldCount - a.soldCount)
  const seen = new Set<string>()
  const take = (list: Product[], n: number) => {
    const out = list.filter((p) => !seen.has(p.id)).slice(0, n)
    out.forEach((p) => seen.add(p.id))
    return out
  }
  const groups = [
    ...[...new Map(detail.missing.map((m) => [m.category, m])).values()].map((m) => ({
      title: `${m.title.replace('Thiếu bước', 'Còn thiếu bước')}`,
      items: take(pool.filter((p) => MODULE_CATEGORY[p.type] === m.category), 3),
    })),
    ...detail.unmetGoals.map((g) => ({
      title: `Mục tiêu "${g.label}" chưa có sản phẩm đáp ứng`,
      items: take(pool.filter((p) => (p.skincareFunctions ?? []).some((f) => MODULE_GOALS[g.key].functions.includes(f))), 3),
    })),
  ].filter((g) => g.items.length)

  if (!notBought.length && !groups.length) return null
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Mua sắm cho chu trình">
      {notBought.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="font-display text-2xl font-semibold">Trong chu trình, bạn chưa mua</h2>
          <p className="mt-1 text-sm text-muted">Sản phẩm bạn hoặc Beauty Finder thêm vào chu trình, chưa có trong lịch sử mua.</p>
          <ul className="mt-4 space-y-3">
            {notBought.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </ul>
        </div>
      )}
      {groups.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="font-display text-2xl font-semibold">Gợi ý từ sàn để hoàn thiện chu trình</h2>
          <p className="mt-1 text-sm text-muted">Chỉ gợi ý sản phẩm cửa hàng đã khai báo đủ công dụng và thời điểm dùng.</p>
          {groups.map((g) => (
            <div key={g.title} className="mt-4">
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <ul className="mt-2 space-y-3">
                {g.items.map((p) => (
                  <ProductRow key={p.id} product={p} onAdd={() => onAdd(p.id)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ProductRow({ product: p, onAdd }: { product: Product; onAdd?: () => void }) {
  const { add, quantityOf } = useCart()
  const [added, setAdded] = useState<'cart' | 'routine' | null>(null)
  return (
    <li className="flex items-center gap-3">
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        <ProductImage product={p} />
      </span>
      <span className="min-w-0 flex-1">
        <Link to={`/products/${p.slug}`} className="line-clamp-1 text-sm font-medium hover:text-primary">
          {p.name}
        </Link>
        <span className="block text-xs text-muted">
          {p.brandName} · {productTypeLabels[p.type]}
        </span>
        <Price price={p.price} originalPrice={p.originalPrice} />
      </span>
      <span className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        {onAdd && (
          <button
            type="button"
            className={button('secondary', 'sm')}
            onClick={() => {
              onAdd()
              setAdded('routine')
            }}
            aria-label={`Thêm ${p.name} vào chu trình`}
          >
            {added === 'routine' ? 'Đã thêm' : 'Vào chu trình'}
          </button>
        )}
        <button
          type="button"
          className={button('dark', 'sm')}
          disabled={quantityOf(p.id) >= p.stock}
          onClick={() => {
            add(p.id)
            setAdded('cart')
          }}
          aria-label={`Thêm ${p.name} vào giỏ`}
        >
          <Icon name="cart" size={14} /> {added === 'cart' ? 'Đã thêm' : 'Giỏ hàng'}
        </button>
      </span>
    </li>
  )
}
