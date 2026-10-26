import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Alert, AuthCard, TextField } from '@/components/ui/Form'
import { button } from '@/components/ui/primitives'
import { useBrand } from '@/features/brand/BrandProvider'
import { useAuth } from '@/features/auth/AuthProvider'
import { SupabaseNotConfigured } from '@/features/auth/SupabaseNotConfigured'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { accountService, validateEmail } from '@/services/account'

/** Chỉ cho phép quay về trang nội bộ, tránh bị lợi dụng chuyển hướng sang website khác */
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

export function LoginPage() {
  useDocumentTitle('Đăng nhập')
  const { settings } = useBrand()
  const { status } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'disabled') return <SupabaseNotConfigured />
  if (status === 'signed-in' && !submitting) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = { email: validateEmail(email), password: password ? null : 'Nhập mật khẩu.' }
    setErrors(v)
    setFormError(null)
    setNotice(null)
    setUnconfirmed(false)
    if (v.email || v.password) return

    setSubmitting(true)
    try {
      await accountService.signIn(email, password)
      // Tài khoản bị khóa: không cho vào phiên làm việc
      const { data } = await supabase!.auth.getUser()
      const profile = data.user ? await accountService.getProfile(data.user.id) : null
      if (profile?.status === 'suspended') {
        await accountService.signOut()
        setFormError(
          `Tài khoản đang bị tạm khóa${profile.suspended_reason ? `: ${profile.suspended_reason}` : '.'} Liên hệ quản trị viên để được hỗ trợ.`,
        )
        return
      }
      navigate(next, { replace: true })
    } catch (err) {
      setUnconfirmed(/email not confirmed/i.test((err as Error)?.message ?? ''))
      setFormError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    try {
      await accountService.resendConfirmation(email)
      setNotice('Đã gửi lại email xác minh. Hãy kiểm tra hộp thư (cả mục Spam).')
      setFormError(null)
    } catch (err) {
      setFormError(friendlyError(err))
    }
  }

  return (
    <AuthCard title={`Đăng nhập vào ${settings.name}`} logo={<Logo height={36} asLink={false} />}>
      <div className="space-y-4">
        {params.get('verified') && <Alert kind="success">Email đã được xác minh. Bạn có thể đăng nhập.</Alert>}
        {params.get('reset') && <Alert kind="success">Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.</Alert>}
        {formError && (
          <Alert kind="error">
            {formError}
            {unconfirmed && (
              <button type="button" onClick={resend} className="mt-1 block font-semibold text-primary hover:underline">
                Gửi lại email xác minh
              </button>
            )}
          </Alert>
        )}
        {notice && <Alert kind="info">{notice}</Alert>}

        <form className="space-y-4" onSubmit={submit} noValidate>
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          <button type="submit" className={`${button('primary', 'lg')} w-full`} disabled={submitting}>
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          Chưa có tài khoản?{' '}
          <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
