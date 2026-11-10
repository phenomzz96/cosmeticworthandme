/** SO SÁNH SẢN PHẨM — /compare. Danh sách so sánh lưu trên trình duyệt này (tối đa 3 sản phẩm). */
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Breadcrumbs, button, EmptyState, Price } from '@/components/ui/primitives'
import { useCart } from '@/features/cart/CartProvider'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { compareFields } from '@/features/compare/compareFields'
import { COMPARE_KEY, removeItem, writeList } from '@/lib/localList'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useLocalList } from '@/lib/useLocalList'
import { catalogService } from '@/services/catalog'
import type { Product } from '@/types/catalog'

export function ComparePage() {
  useDocumentTitle('So sánh sản phẩm')
  useCatalogVersion()
  const ids = useLocalList(COMPARE_KEY)
  const { add } = useCart()
  // Đảm bảo danh mục đã tải trước khi tra cứu
  const ready = useAsync(() => catalogService.getProducts({}), [])
  const products = ids.map((id) => catalogService.getProductByIdSync(id)).filter((p): p is Product => Boolean(p))

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'So sánh sản phẩm' }]} />
      <p className="eyebrow mt-6">So sánh</p>
      <h1 className="mt-2 text-4xl md:text-5xl">So sánh sản phẩm</h1>

      {ready.status !== 'loading' && products.length === 0 && (
        <div className="mt-8">
          <EmptyState title="Chưa có sản phẩm để so sánh" action={<Link to="/products" className={button('dark')}>Xem sản phẩm</Link>}>
            Bấm "So sánh" trên trang sản phẩm để thêm tối đa 3 sản phẩm.
          </EmptyState>
        </div>
      )}

      {products.length > 0 && (
        <>
          <div className="mt-8 overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Bảng so sánh {products.length} sản phẩm</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-40 p-4 text-left align-bottom text-xs font-medium uppercase tracking-wider text-muted">
                    Sản phẩm
                  </th>
                  {products.map((p) => (
                    <th key={p.id} scope="col" className="p-4 text-left align-top font-normal">
                      <div className="aspect-square w-full max-w-44 overflow-hidden rounded-2xl bg-surface-2">
                        <ProductImage product={p} />
                      </div>
                      <Link to={`/products/${p.slug}`} className="mt-3 line-clamp-2 font-medium hover:text-primary">
                        {p.name}
                      </Link>
                      <div className="mt-1">
                        <Price price={p.price} originalPrice={p.originalPrice} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className={button('dark', 'sm')} disabled={p.stock <= 0} onClick={() => add(p.id, 1)}>
                          {p.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}
                        </button>
                        <button type="button" className={button('ghost', 'sm')} onClick={() => removeItem(COMPARE_KEY, p.id)} aria-label={`Bỏ ${p.name} khỏi so sánh`}>
                          <Icon name="x" size={16} /> Bỏ
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareFields.map((f) => (
                  <tr key={f.key} className="border-t border-border">
                    <th scope="row" className="p-4 text-left font-normal text-muted">
                      {f.label}
                    </th>
                    {products.map((p) => (
                      <td key={p.id} className="p-4 align-top">
                        {f.value(p) || <span className="text-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/products" className={button('secondary', 'sm')}>
              <Icon name="plus" size={16} /> Thêm sản phẩm khác
            </Link>
            <button type="button" className={button('ghost', 'sm')} onClick={() => writeList(COMPARE_KEY, [])}>
              Xóa danh sách so sánh
            </button>
          </div>
          <p className="mt-4 text-xs text-muted">Thông tin do cửa hàng cung cấp, không phải lời khuyên y khoa.</p>
        </>
      )}
    </div>
  )
}
