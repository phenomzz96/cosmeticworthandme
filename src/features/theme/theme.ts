export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Phải trùng với khóa trong script ở index.html */
export const THEME_STORAGE_KEY = 'glowup-theme'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* localStorage có thể bị chặn (chế độ riêng tư) */
  }
  return 'system'
}

export function savePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    /* bỏ qua: theme vẫn đổi, chỉ không nhớ được */
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return media().matches ? 'dark' : 'light'
  return pref
}

export function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function onSystemThemeChange(cb: () => void) {
  const m = media()
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
