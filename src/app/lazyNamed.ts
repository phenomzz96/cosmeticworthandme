import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'wm-chunk-reload'

/**
 * Website vừa cập nhật (deploy mới) thì tên file mã trang đổi: tab đang mở bản cũ sẽ không tải được trang chưa mở.
 * Khi đó tải lại trang một lần để lấy bản mới (không lặp vô hạn: tối đa 1 lần mỗi 30 giây).
 */
async function withReload<M>(load: () => Promise<M>): Promise<M> {
  try {
    const m = await load()
    sessionStorage.removeItem(RELOAD_KEY)
    return m
  } catch (e) {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      window.location.reload()
      return new Promise<M>(() => undefined)
    }
    throw e
  }
}

/** React.lazy cho module dùng export có tên (export function X) thay vì export default */
export function lazyNamed<M extends Record<string, unknown>, K extends keyof M & string>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await withReload(load))[name] as ComponentType }))
}
