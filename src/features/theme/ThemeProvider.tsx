import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  onSystemThemeChange,
  readPreference,
  resolveTheme,
  savePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme'

interface ThemeContextValue {
  preference: ThemePreference
  theme: ResolvedTheme
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(readPreference()))

  useEffect(() => {
    const next = resolveTheme(preference)
    setTheme(next)
    applyTheme(next)
    if (preference !== 'system') return
    return onSystemThemeChange(() => {
      const t = resolveTheme('system')
      setTheme(t)
      applyTheme(t)
    })
  }, [preference])

  const setPreference = useCallback((p: ThemePreference) => {
    // Bật hiệu ứng chuyển màu chỉ trong lúc người dùng chủ động đổi theme
    const root = document.documentElement
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 250)
    savePreference(p)
    setPref(p)
  }, [])

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme phải được dùng bên trong <ThemeProvider>')
  return ctx
}
