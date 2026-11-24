import { useEffect, useState, type DependencyList } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined; refreshing?: undefined }
  /** refreshing = true: đang tải dữ liệu mới, tạm hiện dữ liệu cũ (không nháy khung chờ) */
  | { status: 'success'; data: T; error?: undefined; refreshing?: boolean }
  | { status: 'error'; data?: undefined; error: Error; refreshing?: undefined }

export interface AsyncOptions<T> {
  /**
   * Khóa bộ nhớ đệm (trong phiên, trên trình duyệt này). Mở lại trang / bộ lọc đã xem thì hiện ngay kết quả lần trước,
   * đồng thời tải lại ngầm để cập nhật.
   */
  cacheKey?: string
  /** Khi dependency đổi: giữ dữ liệu đang hiện tới khi có dữ liệu mới, thay vì quay về trạng thái "đang tải" */
  keepPrevious?: boolean
  /** Lấy ngay dữ liệu đã có sẵn trong bộ nhớ (không chờ), ví dụ sản phẩm trong danh mục đã tải */
  peek?: () => T | undefined
}

// Bộ nhớ đệm dùng chung, giới hạn số mục để không phình bộ nhớ
const MAX_ENTRIES = 80
const cache = new Map<string, unknown>()
function remember(key: string, value: unknown) {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
}

function readInitial<T>(opts?: AsyncOptions<T>): T | undefined {
  if (!opts) return undefined
  const peeked = opts.peek?.()
  if (peeked !== undefined) return peeked
  if (opts.cacheKey && cache.has(opts.cacheKey)) return cache.get(opts.cacheKey) as T
  return undefined
}

/**
 * Gọi một hàm bất đồng bộ và theo dõi trạng thái loading / success / error.
 * Bỏ qua kết quả cũ nếu dependency đổi trước khi request trước trả về.
 * (Khi dự án lớn hơn có thể thay bằng TanStack Query.)
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, opts?: AsyncOptions<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>(() => {
    const initial = readInitial(opts)
    return initial !== undefined ? { status: 'success', data: initial } : { status: 'loading' }
  })

  useEffect(() => {
    let cancelled = false
    const initial = readInitial(opts)
    setState((prev) => {
      if (initial !== undefined) return prev.status === 'success' && prev.data === initial ? prev : { status: 'success', data: initial }
      if (opts?.keepPrevious && prev.status === 'success') return { status: 'success', data: prev.data, refreshing: true }
      return { status: 'loading' }
    })
    fn().then(
      (data) => {
        if (opts?.cacheKey) remember(opts.cacheKey, data)
        if (!cancelled) setState({ status: 'success', data })
      },
      (err: unknown) =>
        !cancelled && setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
