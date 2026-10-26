/**
 * DANH MỤC CÔNG KHAI (sản phẩm, cửa hàng) — mọi trang mua sắm lấy dữ liệu qua đây.
 *
 * - Đã cấu hình Supabase: đọc sản phẩm 'active' của shop 'active' từ database.
 *   Database (RLS) tự ẩn shop bị tạm ngưng, chủ shop bị khóa, sản phẩm nháp/ẩn.
 * - Chưa cấu hình: dùng dữ liệu mẫu trong src/data/mock (để chạy thử giao diện).
 *
 * Giai đoạn này tải toàn bộ danh mục đang bán một lần (vài trăm sản phẩm) rồi lọc ở trình duyệt.
 * Giai đoạn 3 sẽ chuyển tìm kiếm, lọc, phân trang sang phía server khi dữ liệu lớn hơn.
 */
import { categories, categoryById, productTypeLabels } from '@/data/taxonomy'
import { mockProducts } from '@/data/mock/products'
import { mockShops } from '@/data/mock/shops'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { normalizeVi } from '@/lib/text'
import { shopMediaUrl } from '@/services/media'
import type { Category, CategoryId, Product, ProductQuery, ProductType, ProductVisual, Shop, SkinConcern, SkinType } from '@/types/catalog'

export const DEFAULT_VISUAL: ProductVisual = { shape: 'bottle', color: '#E9E4EE', cap: '#79628E' }
const CATALOG_LIMIT = 1000
export const SEARCH_PAGE_SIZE = 24
const REFRESH_AFTER_MS = 60_000

// ------------------------------------------------------------------ Kho dữ liệu trong bộ nhớ
let products: Product[] = isSupabaseConfigured ? [] : mockProducts
let shops: Shop[] = isSupabaseConfigured ? [] : mockShops
let loaded = !isSupabaseConfigured
let loadedAt = 0
let version = 0
let inflight: Promise<void> | null = null
let searchIndex = new Map<string, string>()
const listeners = new Set<() => void>()

function buildIndex() {
  searchIndex = new Map(
    products.map((p) => [
      p.id,
      normalizeVi(
        [p.name, p.brandName, productTypeLabels[p.type], categoryById[p.categoryId]?.name, categoryById[p.categoryId]?.label, ...p.keyIngredients].join(' '),
      ),
    ]),
  )
}
buildIndex()

// ------------------------------------------------------------------ Chuyển dòng database → kiểu dùng trong giao diện
interface ShopRow {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  logo_path: string | null
  cover_path: string | null
  theme_color: string
  contact_email: string | null
  contact_phone: string | null
  location: string
  policy: string
  rating: number | string
  follower_count: number
  verified: boolean
  created_at: string
}

interface ProductRow {
  id: string
  slug: string
  shop_id: string
  category: string
  product_type: string
  name: string
  brand_name: string
  description: string
  price: number
  sale_price: number | null
  stock: number
  size: string
  skin_types: string[]
  concerns: string[]
  key_ingredients: string[]
  texture: string | null
  fragrance_free: boolean | null
  placeholder_visual: ProductVisual | null
  rating: number | string
  review_count: number
  sold_count: number
  featured: boolean
  created_at: string
  product_images?: { path: string; sort_order: number }[]
}

export const SHOP_COLUMNS =
  'id, slug, name, tagline, description, logo_path, cover_path, theme_color, contact_email, contact_phone, location, policy, rating, follower_count, verified, created_at'
export const PRODUCT_COLUMNS =
  'id, slug, shop_id, category, product_type, name, brand_name, description, price, sale_price, stock, size, skin_types, concerns, key_ingredients, texture, fragrance_free, placeholder_visual, rating, review_count, sold_count, featured, created_at, product_images(path, sort_order)'

export function shopFromRow(r: ShopRow): Shop {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    color: r.theme_color,
    logo: shopMediaUrl(r.logo_path),
    cover: shopMediaUrl(r.cover_path),
    rating: Number(r.rating),
    followerCount: r.follower_count,
    joinedAt: r.created_at,
    verified: r.verified,
    location: r.location,
    policy: r.policy || undefined,
    contactEmail: r.contact_email ?? undefined,
    contactPhone: r.contact_phone ?? undefined,
  }
}

export function productFromRow(r: ProductRow): Product {
  const onSale = r.sale_price != null && r.sale_price < r.price
  return {
    id: r.id,
    slug: r.slug,
    shopId: r.shop_id,
    categoryId: r.category as CategoryId,
    type: r.product_type as ProductType,
    name: r.name,
    brandName: r.brand_name,
    description: r.description,
    price: onSale ? r.sale_price! : r.price,
    originalPrice: onSale ? r.price : undefined,
    stock: r.stock,
    rating: Number(r.rating),
    reviewCount: r.review_count,
    soldCount: r.sold_count,
    size: r.size,
    skinTypes: r.skin_types as SkinType[],
    concerns: r.concerns as SkinConcern[],
    keyIngredients: r.key_ingredients,
    texture: r.texture ?? undefined,
    fragranceFree: r.fragrance_free ?? undefined,
    images: [...(r.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((i) => shopMediaUrl(i.path)!).filter(Boolean),
    visual: r.placeholder_visual ?? DEFAULT_VISUAL,
    featured: r.featured,
    createdAt: r.created_at,
  }
}

async function loadFromDatabase() {
  if (!supabase) return
  const [shopRes, productRes] = await Promise.all([
    supabase.from('shops').select(SHOP_COLUMNS).eq('status', 'active').limit(CATALOG_LIMIT),
    // admin_hidden: chủ shop vẫn đọc được sản phẩm bị Admin ẩn của mình (RLS), nhưng không đưa vào danh mục công khai
    supabase.from('products').select(PRODUCT_COLUMNS).eq('status', 'active').eq('admin_hidden', false).limit(CATALOG_LIMIT),
  ])
  if (shopRes.error) throw shopRes.error
  if (productRes.error) throw productRes.error
  shops = (shopRes.data as ShopRow[]).map(shopFromRow)
  const shopIds = new Set(shops.map((s) => s.id))
  // Chủ shop đang đăng nhập cũng đọc được sản phẩm của shop mình chưa duyệt: không đưa vào danh mục công khai
  products = (productRes.data as ProductRow[]).filter((p) => shopIds.has(p.shop_id)).map(productFromRow)
  buildIndex()
  loaded = true
  loadedAt = Date.now()
  version++
  listeners.forEach((l) => l())
}

/** Đảm bảo danh mục đã tải (tải lại nếu đã cũ hơn 60 giây) */
async function ensureLoaded(force = false): Promise<void> {
  if (!isSupabaseConfigured) return
  const stale = Date.now() - loadedAt > REFRESH_AFTER_MS
  if (loaded && !stale && !force) return
  if (!inflight) {
    inflight = loadFromDatabase().finally(() => {
      inflight = null
    })
  }
  // Đã có dữ liệu cũ: trả ngay, tải mới chạy nền (lỗi tải nền thì giữ dữ liệu cũ)
  if (loaded && !force) {
    inflight.catch(() => undefined)
    return
  }
  await inflight
}

// ------------------------------------------------------------------ Lọc, sắp xếp (dùng chung cho mọi nguồn dữ liệu)
export function filterProducts(list: Product[], query: ProductQuery): Product[] {
  const terms = query.q ? normalizeVi(query.q).split(/\s+/).filter(Boolean) : []
  let out = list.filter((p) => {
    if (query.category && p.categoryId !== query.category) return false
    if (query.types?.length && !query.types.includes(p.type)) return false
    if (query.shopId && p.shopId !== query.shopId) return false
    if (query.minPrice != null && p.price < query.minPrice) return false
    if (query.maxPrice != null && p.price > query.maxPrice) return false
    if (query.skinType && p.skinTypes.length > 0 && !p.skinTypes.includes(query.skinType)) return false
    if (terms.length) {
      // Giống database: mỗi từ khóa khớp phần đầu một từ ("kem" khớp "kem dưỡng", không khớp "skem")
      const hay = ' ' + (searchIndex.get(p.id) ?? normalizeVi(p.name))
      if (!terms.every((t) => hay.includes(' ' + t))) return false
    }
    return true
  })

  switch (query.sort) {
    case 'price-asc':
      out = [...out].sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      out = [...out].sort((a, b) => b.price - a.price)
      break
    case 'rating':
      out = [...out].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      break
    case 'newest':
      out = [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    default:
      out = [...out].sort((a, b) => b.soldCount - a.soldCount)
  }
  return out
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

export const catalogService = {
  isLoaded: () => loaded,
  getVersion: () => version,
  subscribe(cb: () => void) {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  },
  /** Gọi sau khi người bán sửa sản phẩm để danh mục công khai cập nhật ngay */
  async refresh() {
    await ensureLoaded(true)
  },

  async getCategories(): Promise<Category[]> {
    return categories
  },

  async getProducts(query: ProductQuery = {}): Promise<Product[]> {
    if (isSupabaseConfigured) await ensureLoaded()
    else await delay()
    return filterProducts(products, query)
  },

  /**
   * Tìm kiếm + lọc + phân trang cho trang danh sách sản phẩm.
   * Có Supabase: chạy hàm search_products trong database (không phụ thuộc giới hạn danh mục tải sẵn).
   * Chưa có: lọc dữ liệu mẫu trong trình duyệt.
   */
  async searchProducts(query: ProductQuery, page = 1, pageSize = SEARCH_PAGE_SIZE): Promise<{ products: Product[]; total: number }> {
    const from = (Math.max(1, page) - 1) * pageSize
    if (!supabase) {
      await delay()
      const all = filterProducts(products, query)
      return { products: all.slice(from, from + pageSize), total: all.length }
    }
    // Tải song song danh mục cửa hàng (tên shop trên thẻ sản phẩm, giỏ hàng)
    const [res] = await Promise.all([
      supabase.rpc('search_products', {
        p_query: query.q?.trim() || null,
        p_category: query.category ?? null,
        p_types: query.types?.length ? query.types : null,
        p_shop_id: query.shopId ?? null,
        p_min_price: query.minPrice ?? null,
        p_max_price: query.maxPrice ?? null,
        p_skin_type: query.skinType ?? null,
        p_sort: query.sort ?? 'popular',
        p_limit: pageSize,
        p_offset: from,
      }),
      ensureLoaded().catch(() => undefined),
    ])
    if (res.error) throw res.error
    const rows = (res.data ?? []) as (ProductRow & { total_count: number })[]
    return { products: rows.map(productFromRow), total: rows[0] ? Number(rows[0].total_count) : 0 }
  },

  async getFeaturedProducts(limit = 8): Promise<Product[]> {
    if (isSupabaseConfigured) await ensureLoaded()
    else await delay()
    const featured = products.filter((p) => p.featured)
    // Chưa có sản phẩm nổi bật: lấy sản phẩm bán chạy
    return (featured.length ? featured : [...products].sort((a, b) => b.soldCount - a.soldCount)).slice(0, limit)
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    if (isSupabaseConfigured) await ensureLoaded()
    else await delay()
    return products.find((p) => p.slug === slug) ?? null
  },

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    await ensureLoaded()
    return products.filter((p) => ids.includes(p.id))
  },

  /** Toàn bộ sản phẩm còn hàng — Beauty Finder chấm điểm phía trình duyệt */
  async getAllActiveProducts(): Promise<Product[]> {
    if (isSupabaseConfigured) await ensureLoaded()
    else await delay()
    return products.filter((p) => p.stock > 0)
  },

  async getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
    return products
      .filter((p) => p.id !== product.id && (p.type === product.type || p.categoryId === product.categoryId))
      .sort((a, b) => Number(b.type === product.type) - Number(a.type === product.type) || b.soldCount - a.soldCount)
      .slice(0, limit)
  },

  async getShops(): Promise<Shop[]> {
    if (isSupabaseConfigured) await ensureLoaded()
    else await delay()
    return shops
  },

  async getShopBySlug(slug: string): Promise<Shop | null> {
    if (isSupabaseConfigured) await ensureLoaded()
    else await delay()
    return shops.find((s) => s.slug === slug) ?? null
  },

  /** Tra cứu nhanh từ dữ liệu đã tải (thẻ sản phẩm, giỏ hàng) */
  getShopByIdSync(id: string): Shop | undefined {
    return shops.find((s) => s.id === id)
  },

  getProductByIdSync(id: string): Product | undefined {
    return products.find((p) => p.id === id)
  },

  countProductsByShop(shopId: string): number {
    return products.filter((p) => p.shopId === shopId).length
  },
}

// Bắt đầu tải ngay khi mở website để giỏ hàng, thẻ sản phẩm có dữ liệu sớm
if (isSupabaseConfigured) void ensureLoaded().catch(() => undefined)
