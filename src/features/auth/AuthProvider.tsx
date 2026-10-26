/**
 * Trạng thái đăng nhập dùng chung. Lắng nghe Supabase Auth và tải hồ sơ (profiles).
 *
 * Lưu ý bảo mật: isAdmin ở đây CHỈ dùng để ẩn/hiện giao diện cho tiện.
 * Quyền thật được database kiểm tra ở mọi thao tác (RLS + hàm SQL).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { accountService } from '@/services/account'
import { ADMIN_ROLES, type Profile } from '@/types/account'

type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  /** Hồ sơ không tải được (mạng lỗi...) */
  profileError: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isSuspended: boolean
  /** Người dùng vừa mở link đặt lại mật khẩu trong email */
  passwordRecovery: boolean
  refreshProfile: () => Promise<void>
  setProfile: (p: Profile) => void
  signOut: () => Promise<void>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'disabled')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  // Mỗi sự kiện đăng nhập/đăng xuất tăng số này; kết quả tải hồ sơ của sự kiện cũ bị bỏ qua
  const authEventSeq = useRef(0)

  const loadProfile = useCallback(async (u: User | null) => {
    const seq = authEventSeq.current
    if (!u) {
      setProfile(null)
      return
    }
    try {
      const p = await accountService.getProfile(u.id)
      if (seq !== authEventSeq.current) return
      setProfile(p)
      setProfileError(false)
    } catch {
      if (seq === authEventSeq.current) setProfileError(true)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      const seq = ++authEventSeq.current
      setUser(u)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (!u) {
        setProfile(null)
        setStatus('signed-out')
        return
      }
      // Không gọi API Supabase trực tiếp trong callback này (khuyến nghị của Supabase): đẩy ra ngoài
      window.setTimeout(() => {
        void loadProfile(u).finally(() => {
          // Đã có sự kiện mới hơn (ví dụ vừa đăng xuất) → bỏ kết quả cũ, tránh "đăng nhập lại" nhầm
          if (seq === authEventSeq.current) setStatus('signed-in')
        })
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    authEventSeq.current++
    await accountService.signOut()
    setProfile(null)
    setUser(null)
    setStatus('signed-out')
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const active = profile?.status === 'active'
    return {
      status,
      user,
      profile,
      profileError,
      isAdmin: !!profile && active && ADMIN_ROLES.includes(profile.role),
      isSuperAdmin: !!profile && active && profile.role === 'super_admin',
      isSuspended: profile?.status === 'suspended',
      passwordRecovery,
      refreshProfile: () => loadProfile(user),
      setProfile,
      signOut,
      clearPasswordRecovery: () => setPasswordRecovery(false),
    }
  }, [status, user, profile, profileError, passwordRecovery, loadProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return ctx
}
