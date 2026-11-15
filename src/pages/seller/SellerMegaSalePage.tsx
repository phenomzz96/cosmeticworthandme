/**
 * MEGA SALE CỦA SHOP — /seller/mega-sale
 * Người bán đăng ký sản phẩm vào đợt Mega Sale với giá sale (giảm ít nhất mức Admin đặt), chờ Admin duyệt.
 * Database kiểm tra quyền, mức giảm; giá sale tự áp dụng trong thời gian chương trình.
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { useSeller } from '@/features/seller/SellerLayout'
import { friendlyError } from '@/lib/errors'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { itemStatusLabels, maxSalePrice, megaSaleService, saleState, type MegaSale, type MegaSaleItem } from '@/services/megaSale'
import { sellerService } from '@/services/seller'
import type { SellerProduct } from '@/types/seller'

export function SellerMegaSalePage() {
  useDocumentTitle('Mega Sale')
  const { shop } = useSeller()
  const [sales, setSales] = useState<{ status: 'loading' | 'ready' | 'error'; list: MegaSale[]; error?: string }>({ status: 'loading', list: [] })
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    megaSaleService
      .listOpen(true)
      .then((list) => {
        setSales({ status: 'ready', list })
        setActiveId(list[0]?.id ?? null)
      })
      .catch((err) => setSales({ status: 'error', list: [], error: friendlyError(err) }))
  }, [])

  const sale = sales.list.find((s) => s.id === activeId)

  return (
    <div className="container-page py-6">
      <h1 className="text-3xl md:text-4xl">Mega Sale</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Đăng ký sản phẩm vào đợt sale lớn của sàn. Sau khi Admin duyệt, giá sale tự áp dụng trong thời gian chương trình và tự trả về giá cũ khi kết thúc. Trong lúc đang chạy sale, giá
        sản phẩm không đổi được.
      </p>
      {shop.status !== 'active' ? (
        <div className="mt-6">
          <Alert kind="info">Cửa hàng cần được quản trị viên duyệt trước khi tham gia Mega Sale.</Alert>
        </div>
      ) : sales.status === 'loading' ? (
        <Skeleton className="mt-6 h-48 w-full" />
      ) : sales.status === 'error' ? (
        <div className="mt-6">
          <Alert kind="error">{sales.error}</Alert>
        </div>
      ) : sales.list.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Chưa có đợt Mega Sale nào đang mở đăng ký">Khi Admin mở đợt sale mới, bạn sẽ đăng ký sản phẩm tại đây.</EmptyState>
        </div>
      ) : (
        <>
          {sales.list.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Chọn đợt sale">
              {sales.list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={s.id === activeId}
                  onClick={() => setActiveId(s.id)}
                  className={`rounded-full border px-4 py-2 text-sm ${s.id === activeId ? 'border-ink bg-ink text-on-ink' : 'border-border bg-surface hover:border-text'}`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
          {sale && <EnrollTable key={sale.id} sale={sale} shopId={shop.id} />}
        </>
      )}
    </div>
  )
}

function EnrollTable({ sale, shopId }: { sale: MegaSale; shopId: string }) {
  const [products, setProducts] = useState<SellerProduct[] | null>(null)
  const [items, setItems] = useState<MegaSaleItem[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const running = saleState(sale) === 'running'

  const load = useCallback(async () => {
    try {
      const [list, mine] = await Promise.all([sellerService.listMyProducts(shopId), megaSaleService.myItems(sale.id, shopId)])
      setProducts(list.filter((p) => p.status === 'active'))
      setItems(mine)
    } catch (err) {
      setError(friendlyError(err))
      setProducts([])
    }
  }, [sale.id, shopId])
  useEffect(() => {
    void load()
  }, [load])

  const enroll = async (p: SellerProduct) => {
    const item = items.find((i) => i.product_id === p.id)
    const raw = prices[p.id] ?? (item ? String(item.sale_price) : '')
    const value = Math.floor(Number(raw) || 0)
    const max = maxSalePrice(p.price, sale.min_discount_percent)
    setError(null)
    setNotice(null)
    if (value < 1000 || value > max) return setError(`"${p.name}": giá sale từ 1.000đ đến ${formatPrice(max)} (giảm ít nhất ${sale.min_discount_percent}%).`)
    setBusy(p.id)
    try {
      await megaSaleService.enroll(sale.id, p.id, value)
      setNotice(`Đã gửi "${p.name}" giá ${formatPrice(value)}. Chờ Admin duyệt.`)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  const withdraw = async (p: SellerProduct, item: MegaSaleItem) => {
    setBusy(p.id)
    setError(null)
    try {
      await megaSaleService.withdraw(item.id)
      setNotice(`Đã rút "${p.name}" khỏi đợt sale.`)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-6">
      <div className="rounded-card border border-border bg-surface p-4 text-sm">
        <p className="font-semibold">{sale.title}</p>
        <p className="mt-1 text-muted">
          {formatDateTime(sale.starts_at)} – {formatDateTime(sale.ends_at)} · Giảm ít nhất {sale.min_discount_percent}% · {running ? 'Đang diễn ra' : 'Sắp diễn ra'}
        </p>
      </div>
      {notice && (
        <div className="mt-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {products == null ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : products.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Chưa có sản phẩm đang bán">Đăng sản phẩm trước rồi quay lại đăng ký Mega Sale.</EmptyState>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Sản phẩm của shop">
          {products.map((p) => {
            const item = items.find((i) => i.product_id === p.id)
            const max = maxSalePrice(p.price, sale.min_discount_percent)
            const locked = item?.applied
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Giá gốc {formatPrice(p.price)}
                    {p.sale_price != null && !locked && ` · đang giảm ${formatPrice(p.sale_price)}`} · giá sale tối đa {formatPrice(max)}
                  </p>
                  {item && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          item.status === 'approved' ? 'bg-success/10 text-success' : item.status === 'pending' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted'
                        }`}
                      >
                        {locked ? 'Đang chạy sale' : itemStatusLabels[item.status]}
                      </span>
                      <span>Giá đăng ký {formatPrice(item.sale_price)}</span>
                      {item.status === 'rejected' && item.reject_reason && <span className="text-muted">Lý do: {item.reject_reason}</span>}
                    </p>
                  )}
                </div>
                {!locked && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`ms-${p.id}`}>
                      Giá Mega Sale cho {p.name}
                    </label>
                    <input
                      id={`ms-${p.id}`}
                      type="number"
                      min={1000}
                      max={max}
                      inputMode="numeric"
                      placeholder={`≤ ${max}`}
                      value={prices[p.id] ?? (item ? String(item.sale_price) : '')}
                      onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })}
                      className="h-10 w-36 rounded-xl border border-border bg-surface px-3 text-sm"
                    />
                    <button type="button" className={button('dark', 'sm')} disabled={busy === p.id} onClick={() => void enroll(p)}>
                      {item ? 'Cập nhật' : 'Đăng ký'}
                    </button>
                    {item && (
                      <button type="button" className={button('ghost', 'sm')} disabled={busy === p.id} onClick={() => void withdraw(p, item)}>
                        Rút
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
