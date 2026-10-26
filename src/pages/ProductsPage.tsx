import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Breadcrumbs, button, EmptyState, ErrorState } from '@/components/ui/primitives'
import { categories, categoryById, productTypeLabels, skinTypeLabels, typesByCategory } from '@/data/taxonomy'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductCard'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService, SEARCH_PAGE_SIZE } from '@/services/catalog'
import type { CategoryId, ProductQuery, ProductSort, ProductType, SkinType } from '@/types/catalog'

const sortOptions: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Bán chạy' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'rating', label: 'Đánh giá cao' },
  { value: 'price-asc', label: 'Giá thấp đến cao' },
  { value: 'price-desc', label: 'Giá cao đến thấp' },
]

const priceRanges = [
  { key: '0-200000', label: 'Dưới 200.000đ' },
  { key: '200000-350000', label: '200.000đ – 350.000đ' },
  { key: '350000-', label: 'Trên 350.000đ' },
]

/** Đọc bộ lọc từ URL — URL là nguồn sự thật nên có thể chia sẻ link, bấm quay lại */
function parseQuery(params: URLSearchParams): ProductQuery {
  const category = params.get('category')
  const [min, max] = (params.get('price') ?? '').split('-')
  const skin = params.get('skin')
  const sort = params.get('sort')
  return {
    q: params.get('q') ?? undefined,
    category: category && category in categoryById ? (category as CategoryId) : undefined,
    types: (params.get('types') ?? '').split(',').filter((t): t is ProductType => t in productTypeLabels),
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
    skinType: skin && skin in skinTypeLabels ? (skin as SkinType) : undefined,
    sort: sortOptions.some((o) => o.value === sort) ? (sort as ProductSort) : 'popular',
  }
}

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseQuery(params), [params])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const result = useAsync(() => catalogService.searchProducts(query, page), [params.toString()])
  const pages = result.status === 'success' ? Math.max(1, Math.ceil(result.data.total / SEARCH_PAGE_SIZE)) : 1

  const category = query.category ? categoryById[query.category] : undefined
  const title = query.q ? `Kết quả cho “${query.q}”` : (category?.name ?? 'Tất cả sản phẩm')
  useDocumentTitle(query.q ? `Tìm: ${query.q}` : (category?.name ?? 'Sản phẩm'))

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    // Đổi bộ lọc thì về trang 1
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const goPage = (n: number) => {
    update({ page: n > 1 ? String(n) : null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleType = (t: ProductType) => {
    const set = new Set(query.types)
    if (set.has(t)) set.delete(t)
    else set.add(t)
    update({ types: [...set].join(',') || null })
  }

  const activeFilterCount =
    (query.types?.length ?? 0) + (params.get('price') ? 1 : 0) + (query.skinType ? 1 : 0) + (query.category ? 1 : 0)
  const availableTypes = query.category ? typesByCategory[query.category] : []

  const renderFilters = (idPrefix: string) => (
    <div className="space-y-7">
      <fieldset>
        <legend className="text-sm font-semibold">Danh mục</legend>
        <div className="mt-3 flex flex-col gap-1">
          <FilterRadio name={`${idPrefix}-category`} checked={!query.category} onChange={() => update({ category: null, types: null })}>
            Tất cả
          </FilterRadio>
          {categories.map((c) => (
            <FilterRadio key={c.id} name={`${idPrefix}-category`} checked={query.category === c.id} onChange={() => update({ category: c.id, types: null })}>
              {c.name} <span className="text-muted">· {c.label}</span>
            </FilterRadio>
          ))}
        </div>
      </fieldset>

      {availableTypes.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold">Loại sản phẩm</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTypes.map((t) => {
              const on = query.types?.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-primary'}`}
                >
                  {productTypeLabels[t]}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">Phù hợp loại da</legend>
        <select
          className="mt-3 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={query.skinType ?? ''}
          onChange={(e) => update({ skin: e.target.value || null })}
          aria-label="Loại da"
        >
          <option value="">Mọi loại da</option>
          {(Object.keys(skinTypeLabels) as SkinType[]).map((s) => (
            <option key={s} value={s}>
              {skinTypeLabels[s]}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Khoảng giá</legend>
        <div className="mt-3 flex flex-col gap-1">
          <FilterRadio name={`${idPrefix}-price`} checked={!params.get('price')} onChange={() => update({ price: null })}>
            Mọi mức giá
          </FilterRadio>
          {priceRanges.map((r) => (
            <FilterRadio key={r.key} name={`${idPrefix}-price`} checked={params.get('price') === r.key} onChange={() => update({ price: r.key })}>
              {r.label}
            </FilterRadio>
          ))}
        </div>
      </fieldset>

      {activeFilterCount > 0 && (
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setParams(query.q ? { q: query.q } : {})}>
          Xóa bộ lọc
        </button>
      )}
    </div>
  )

  return (
    <div className="container-page py-6 md:py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: category?.name ?? 'Sản phẩm' }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {category && !query.q && <p className="mt-1 text-sm text-muted">{category.description}</p>}
          {result.status === 'success' && (
            <p className="mt-1 text-sm text-muted">
              {result.data.total} sản phẩm{pages > 1 && ` · Trang ${page}/${pages}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${button('secondary', 'sm')} lg:hidden`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="filters-mobile"
          >
            <Icon name="filter" size={16} /> Bộ lọc{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">Sắp xếp</span>
            <select
              className="h-9 rounded-full border border-border bg-surface px-3 text-sm"
              value={query.sort}
              onChange={(e) => update({ sort: e.target.value === 'popular' ? null : e.target.value })}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtersOpen && (
        <div id="filters-mobile" className="mt-4 rounded-card border border-border bg-surface p-4 lg:hidden">
          {renderFilters('m')}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Bộ lọc">
          <div className="sticky top-36">{renderFilters('d')}</div>
        </aside>
        <div>
          {result.status === 'loading' && <ProductGridSkeleton count={8} />}
          {result.status === 'error' && <ErrorState />}
          {result.status === 'success' &&
            (result.data.products.length ? (
              <>
                <ProductGrid products={result.data.products} eagerCount={4} />
                {pages > 1 && (
                  <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Phân trang sản phẩm">
                    <button type="button" className={button('secondary', 'sm')} disabled={page <= 1} onClick={() => goPage(page - 1)}>
                      Trang trước
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1)
                      .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                      .map((n, i, arr) => (
                        <span key={n} className="flex items-center gap-2">
                          {i > 0 && n - arr[i - 1] > 1 && <span className="text-muted">…</span>}
                          <button
                            type="button"
                            aria-current={n === page ? 'page' : undefined}
                            className={`h-9 min-w-9 rounded-full border px-3 text-sm ${n === page ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:border-primary'}`}
                            onClick={() => goPage(n)}
                          >
                            {n}
                          </button>
                        </span>
                      ))}
                    <button type="button" className={button('secondary', 'sm')} disabled={page >= pages} onClick={() => goPage(page + 1)}>
                      Trang sau
                    </button>
                  </nav>
                )}
              </>
            ) : page > 1 ? (
              <EmptyState title="Trang này không còn sản phẩm" action={<button type="button" className={button('primary')} onClick={() => goPage(1)}>Về trang 1</button>} />
            ) : (
              <EmptyState
                title="Không có sản phẩm phù hợp"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" className={button('secondary')} onClick={() => setParams({})}>
                      Xóa tìm kiếm và bộ lọc
                    </button>
                    <Link to="/beauty-finder" className={button('primary')}>
                      Thử Beauty Finder
                    </Link>
                  </div>
                }
              >
                Thử từ khóa ngắn hơn, bỏ bớt bộ lọc, hoặc để Beauty Finder gợi ý theo làn da của bạn.
              </EmptyState>
            ))}
        </div>
      </div>
    </div>
  )
}

function FilterRadio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 ${checked ? 'font-semibold text-primary' : ''}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-[var(--primary)]" />
      <span>{children}</span>
    </label>
  )
}
