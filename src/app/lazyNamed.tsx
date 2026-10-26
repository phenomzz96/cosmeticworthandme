import { lazy, type ComponentType } from 'react'

/** React.lazy cho module dùng export có tên (export function X) thay vì export default */
export function lazyNamed<M extends Record<string, unknown>, K extends keyof M & string>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }))
}
