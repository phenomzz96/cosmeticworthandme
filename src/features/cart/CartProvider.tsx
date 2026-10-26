/**
 * GIỎ HÀNG
 * - Chưa đăng nhập (hoặc chưa kết nối Supabase): lưu trên trình duyệt (localStorage).
 * - Đã đăng nhập: lưu trong bảng cart_items theo tài khoản, đồng bộ giữa các thiết bị.
 *   Lúc đăng nhập, giỏ trên trình duyệt được gộp vào giỏ của tài khoản rồi xóa khỏi trình duyệt.
 *   Đăng xuất: giỏ trên trình duyệt trống (không để lộ giỏ của tài khoản trên máy dùng chung).
 * - Giá luôn lấy lại từ dữ liệu sản phẩm; khi đặt hàng, database tính lại giá và kiểm tra tồn kho.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCatalogVersion } from '@/features/catalog/useCatalogVersion'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cartService, type CartLine } from '@/services/cart'
import { catalogService } from '@/services/catalog'
import type { Product } from '@/types/catalog'

const STORAGE_KEY = 'glowup-cart-v1'
export const MAX_QTY_PER_ITEM = 10

export interface CartItem extends CartLine {
  product: Product
  lineTotal: number
}

type Action =
  | { type: 'add'; productId: string; quantity: number }
  | { type: 'set'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'removeMany'; productIds: string[] }
  | { type: 'clear' }
  | { type: 'sanitize' }

/** Số lượng hợp lệ: 1..min(tồn kho, giới hạn mỗi sản phẩm) */
function clampQty(productId: string, qty: number) {
  const product = catalogService.getProductByIdSync(productId)
  // Danh mục chưa tải xong: giữ nguyên số lượng (không xóa nhầm), sẽ kiểm tra lại khi tải xong
  if (!product) return catalogService.isLoaded() ? 0 : Math.max(0, Math.min(Math.floor(qty), MAX_QTY_PER_ITEM))
  return Math.max(0, Math.min(Math.floor(qty), product.stock, MAX_QTY_PER_ITEM))
}

export function cartReducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((l) => l.productId === action.productId)
      const quantity = clampQty(action.productId, (existing?.quantity ?? 0) + action.quantity)
      if (quantity <= 0 || quantity === existing?.quantity) return state
      return existing
        ? state.map((l) => (l.productId === action.productId ? { ...l, quantity } : l))
        : [...state, { productId: action.productId, quantity }]
    }
    case 'set': {
      const quantity = clampQty(action.productId, action.quantity)
      return quantity <= 0
        ? state.filter((l) => l.productId !== action.productId)
        : state.map((l) => (l.productId === action.productId ? { ...l, quantity } : l))
    }
    case 'remove':
      return state.filter((l) => l.productId !== action.productId)
    case 'removeMany':
      return state.filter((l) => !action.productIds.includes(l.productId))
    case 'clear':
      return state.length ? [] : state
    case 'sanitize': {
      // Sau khi danh mục tải xong: bỏ sản phẩm không còn bán, giới hạn theo tồn kho mới
      const next = state.flatMap((l) => {
        const quantity = clampQty(l.productId, l.quantity)
        return quantity > 0 ? [{ ...l, quantity }] : []
      })
      return next.length === state.length && next.every((l, i) => l.quantity === state[i].quantity) ? state : next
    }
  }
}

function readGuest(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((l) => {
      if (typeof l?.productId !== 'string' || typeof l?.quantity !== 'number') return []
      const quantity = clampQty(l.productId, l.quantity)
      return quantity > 0 ? [{ productId: l.productId, quantity }] : []
    })
  } catch {
    return []
  }
}

function writeGuest(lines: CartLine[]) {
  try {
    if (lines.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* không lưu được thì giỏ vẫn dùng được trong phiên hiện tại */
  }
}

interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  /** Giỏ đang lưu theo tài khoản (true) hay trên trình duyệt (false) */
  isAccountCart: boolean
  /** Đang gộp/tải giỏ của tài khoản */
  syncing: boolean
  add: (productId: string, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  /** Bỏ các sản phẩm đã đặt hàng khỏi giỏ (database đã xóa phía server; đây cập nhật giao diện) */
  removeOrdered: (productIds: string[]) => void
  clear: () => void
  quantityOf: (productId: string) => number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  const userId = user?.id ?? null
  const [lines, setLines] = useState<CartLine[]>(readGuest)
  const [syncing, setSyncing] = useState(false)
  const linesRef = useRef(lines)
  // Id tài khoản mà giỏ đang đồng bộ; null = giỏ trên trình duyệt
  const accountRef = useRef<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)

  const replace = useCallback((next: CartLine[]) => {
    linesRef.current = next
    setLines(next)
  }, [])

  const reloadFromServer = useCallback(async () => {
    const owner = accountRef.current
    if (!owner) return
    try {
      const server = await cartService.load()
      if (accountRef.current === owner) replace(server)
    } catch {
      /* giữ trạng thái hiện tại */
    }
  }, [replace])

  /** Ghi các thay đổi lên database (chỉ khi đang dùng giỏ của tài khoản) */
  const syncDiff = useCallback(
    (prev: CartLine[], next: CartLine[]) => {
      const owner = accountRef.current
      if (!owner) return
      const ids = new Set([...prev, ...next].map((l) => l.productId))
      for (const id of ids) {
        const before = prev.find((l) => l.productId === id)?.quantity ?? 0
        const after = next.find((l) => l.productId === id)?.quantity ?? 0
        if (before === after) continue
        cartService
          .setItem(id, after)
          .then((accepted) => {
            if (accountRef.current !== owner || accepted === after) return
            replace(cartReducer(linesRef.current, { type: 'set', productId: id, quantity: accepted }))
          })
          .catch(() => void reloadFromServer())
      }
    },
    [replace, reloadFromServer],
  )

  const apply = useCallback(
    (action: Action) => {
      const prev = linesRef.current
      const next = cartReducer(prev, action)
      if (next === prev) return
      replace(next)
      syncDiff(prev, next)
    },
    [replace, syncDiff],
  )

  // Đăng nhập → gộp giỏ trình duyệt vào tài khoản; đăng xuất → giỏ trình duyệt trống
  useEffect(() => {
    if (!isSupabaseConfigured || status === 'loading') return
    if (userId && accountRef.current !== userId) {
      accountRef.current = userId
      setAccountId(userId)
      const guest = linesRef.current
      setSyncing(true)
      cartService
        .merge(guest)
        .then((server) => {
          if (accountRef.current !== userId) return
          replace(server)
          writeGuest([])
        })
        .catch(() => {
          /* không gộp được (mạng lỗi, tài khoản bị khóa): vẫn hiển thị giỏ hiện có */
        })
        .finally(() => setSyncing(false))
    } else if (!userId && accountRef.current) {
      accountRef.current = null
      setAccountId(null)
      replace([])
      writeGuest([])
    }
  }, [userId, status, replace])

  // Lưu giỏ trình duyệt khi chưa đăng nhập
  useEffect(() => {
    if (!accountRef.current) writeGuest(lines)
  }, [lines])

  // Đồng bộ giữa các tab: giỏ trình duyệt đổi ở tab khác
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && !accountRef.current) replace(readGuest())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [replace])

  const catalogVersion = useCatalogVersion()
  useEffect(() => {
    if (catalogService.isLoaded()) apply({ type: 'sanitize' })
  }, [catalogVersion, apply])

  const items = useMemo<CartItem[]>(
    () =>
      lines.flatMap((l) => {
        const product = catalogService.getProductByIdSync(l.productId)
        return product ? [{ ...l, product, lineTotal: product.price * l.quantity }] : []
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, catalogVersion],
  )

  const add = useCallback((productId: string, quantity = 1) => apply({ type: 'add', productId, quantity }), [apply])
  const setQuantity = useCallback((productId: string, quantity: number) => apply({ type: 'set', productId, quantity }), [apply])
  const remove = useCallback((productId: string) => apply({ type: 'remove', productId }), [apply])
  const removeOrdered = useCallback((productIds: string[]) => replace(cartReducer(linesRef.current, { type: 'removeMany', productIds })), [replace])
  const clear = useCallback(() => apply({ type: 'clear' }), [apply])
  const quantityOf = useCallback((id: string) => lines.find((l) => l.productId === id)?.quantity ?? 0, [lines])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.lineTotal, 0),
      isAccountCart: accountId !== null,
      syncing,
      add,
      setQuantity,
      remove,
      removeOrdered,
      clear,
      quantityOf,
    }),
    [items, accountId, syncing, add, setQuantity, remove, removeOrdered, clear, quantityOf],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart phải được dùng bên trong <CartProvider>')
  return ctx
}
