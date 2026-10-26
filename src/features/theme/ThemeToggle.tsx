import { Icon } from '@/components/ui/Icon'
import { useTheme } from './ThemeProvider'

/**
 * Công tắc Sáng ↔ Tối. Mỗi lần bấm luôn đổi sang giao diện ngược lại với giao diện đang thấy.
 * Khi người dùng chưa bấm lần nào, website theo thiết lập sáng/tối của hệ điều hành.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setPreference } = useTheme()
  const isDark = theme === 'dark'
  const nextLabel = isDark ? 'giao diện sáng' : 'giao diện tối'

  return (
    <button
      type="button"
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text ${className}`}
      aria-label={`Chuyển sang ${nextLabel}`}
      title={`Chuyển sang ${nextLabel}`}
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
      <span className="hidden xl:inline">{isDark ? 'Sáng' : 'Tối'}</span>
    </button>
  )
}
