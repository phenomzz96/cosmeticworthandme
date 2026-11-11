/** THƯƠNG HIỆU A–Z — /brands: mọi thương hiệu đang có sản phẩm trên sàn, nhóm theo chữ cái đầu */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { categoryById } from '@/data/taxonomy'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { normalizeVi } from '@/lib/text'
import { catalogService } from '@/services/catalog'
import type { CategoryId } from '@/types/catalog'

interface BrandInfo {
  name: string
  count: number
  categories: CategoryId[]
}

export function BrandsPage() {
  useDocumentTitle('Thương hiệu')
  useCatalogVersion()
  const products = useAsync(() => catalogService.getAllActiveProducts(), [])
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    if (products.status !== 'success') return []
    const map = new Map<string, BrandInfo>()
    for (const p of products.data) {
      const key = p.brandName.trim().toLowerCase()
      const b = map.get(key) ?? { name: p.brandName.trim(), count: 0, categories: [] }
      b.count++
      if (!b.categories.includes(p.categoryId)) b.categories.push(p.categoryId)
      map.set(key, b)
    }
    const nq = normalizeVi(q)
    const list = [...map.values()].filter((b) => !nq || normalizeVi(b.name).includes(nq)).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    const byLetter = new Map<string, BrandInfo[]>()
    for (const b of list) {
      const first = normalizeVi(b.name).charAt(0).toUpperCase()
      const letter = /[A-Z]/.test(first) ? first : '#'
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), b])
    }
    return [...byLetter.entries()]
  }, [products, q])

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Thương hiệu' }]} />
      <p className="eyebrow mt-6">Thương hiệu A–Z</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl sm:text-5xl">Mua theo thương hiệu</h1>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm thương hiệu"
          aria-label="Tìm thương hiệu"
          className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm sm:w-72"
        />
      </div>

      {groups.length > 1 && (
        <nav aria-label="Chữ cái" className="mt-6 flex flex-wrap gap-1.5">
          {groups.map(([letter]) => (
            <a key={letter} href={`#brand-${letter}`} className="grid h-9 w-9 place-items-center rounded-full border border-border text-sm font-medium hover:border-primary hover:text-primary">
              {letter}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-8">
        {products.status === 'loading' && <Skeleton className="h-64 w-full" />}
        {products.status === 'error' && <ErrorState />}
        {products.status === 'success' && groups.length === 0 && <EmptyState title="Không tìm thấy thương hiệu" />}
        <div className="space-y-10">
          {groups.map(([letter, brands]) => (
            <section key={letter} id={`brand-${letter}`} className="scroll-mt-40" aria-labelledby={`brand-h-${letter}`}>
              <h2 id={`brand-h-${letter}`} className="font-display text-3xl font-semibold">
                {letter}
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {brands.map((b) => (
                  <li key={b.name}>
                    <Link
                      to={`/products?brand=${encodeURIComponent(b.name)}`}
                      className="block h-full rounded-card border border-border bg-surface p-4 transition-colors hover:border-primary motion-reduce:transition-none"
                    >
                      <span className="block font-semibold">{b.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {b.count} sản phẩm · {b.categories.map((c) => categoryById[c]?.label).join(', ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
