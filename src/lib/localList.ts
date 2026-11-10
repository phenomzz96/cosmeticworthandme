/**
 * Danh sách nhỏ lưu trên trình duyệt của từng người (lịch sử tìm kiếm, sản phẩm đã xem, danh sách so sánh).
 * Chỉ là tiện ích cá nhân, KHÔNG phải dữ liệu dùng chung: mất đi (ẩn danh, xóa dữ liệu) website vẫn chạy bình thường.
 */
const listeners = new Map<string, Set<() => void>>()

export function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function writeList(key: string, list: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* bộ nhớ trình duyệt bị chặn: bỏ qua */
  }
  listeners.get(key)?.forEach((l) => l())
}

/** Thêm vào đầu danh sách, bỏ trùng, giữ tối đa max phần tử */
export function pushFront(key: string, value: string, max: number) {
  writeList(key, [value, ...readList(key).filter((v) => v !== value)].slice(0, max))
}

export function removeItem(key: string, value: string) {
  writeList(key, readList(key).filter((v) => v !== value))
}

export function subscribeList(key: string, cb: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(cb)
  return () => {
    listeners.get(key)?.delete(cb)
  }
}

export const SEARCH_HISTORY_KEY = 'wm-search-history'
export const RECENTLY_VIEWED_KEY = 'wm-recently-viewed'
export const COMPARE_KEY = 'wm-compare'
export const COMPARE_MAX = 3
