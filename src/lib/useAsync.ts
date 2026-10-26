import { useEffect, useState, type DependencyList } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }

/**
 * Gọi một hàm bất đồng bộ và theo dõi trạng thái loading / success / error.
 * Bỏ qua kết quả cũ nếu dependency đổi trước khi request trước trả về.
 * (Khi dự án lớn hơn có thể thay bằng TanStack Query.)
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fn().then(
      (data) => !cancelled && setState({ status: 'success', data }),
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
