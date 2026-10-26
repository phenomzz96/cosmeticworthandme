import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Alert, AuthCard, TextField } from '@/components/ui/Form'
import { button, Skeleton } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { SupabaseNotConfigured } from '@/features/auth/SupabaseNotConfigured'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { accountService, PASSWORD_MIN_LENGTH, validateEmail, validatePassword } from '@/services/account'

/** Bước 1: nhập email để nhận link đặt lại mật khẩu */
export function ForgotPasswordPage() {
  useDocumentTitle('Quên mật khẩu')
  const { status } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'disabled') return <SupabaseNotConfigured />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validateEmail(email)
    setError(v)
    setFormError(null)
    if (v) return
    setSubmitting(true)
    try {
      await accountService.sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Quên mật khẩu" subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu." logo={<Logo height={36} asLink={false} />}>
      <div className="space-y-4">
        {sent ? (
          // Cùng một thông báo dù email có tồn tại hay không, để không lộ ai đã đăng ký
          <Alert kind="success">
            Nếu <strong>{email.trim()}</strong> đã đăng ký, một email đặt lại mật khẩu sẽ được gửi tới đó trong ít phút.
          </Alert>
        ) : (
          <>
            {formError && <Alert kind="error">{formError}</Alert>}
            <form className="space-y-4" onSubmit={submit} noValidate>
              <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
              <button type="submit" className={`${button('primary', 'lg')} w-full`} disabled={submitting}>
                {submitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
              </button>
            </form>
          </>
        )}
        <p className="text-center text-sm">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}

/** Bước 2: mở từ link trong email, Supabase tự đăng nhập tạm để cho phép đổi mật khẩu */
export function ResetPasswordPage() {
  useDocumentTitle('Đặt lại mật khẩu')
  const { status, clearPasswordRecovery, signOut } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ pw?: string | null; confirm?: string | null }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'disabled') return <SupabaseNotConfigured />
  if (status === 'loading') {
    return (
      <div className="container-page py-12">
        <Skeleton className="mx-auto h-72 max-w-md" />
      </div>
    )
  }
  if (status === 'signed-out') {
    return (
      <AuthCard title="Liên kết không còn hiệu lực" logo={<Logo height={36} asLink={false} />}>
        <div className="space-y-4">
          <Alert kind="error">Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Hãy yêu cầu liên kết mới.</Alert>
          <Link to="/forgot-password" className={`${button('primary', 'lg')} w-full`}>
            Gửi lại liên kết
          </Link>
        </div>
      </AuthCard>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = { pw: validatePassword(pw), confirm: confirm !== pw ? 'Mật khẩu nhập lại không khớp.' : null }
    setErrors(v)
    setFormError(null)
    if (v.pw || v.confirm) return
    setSubmitting(true)
    try {
      await accountService.updatePassword(pw)
      clearPasswordRecovery()
      await signOut()
      navigate('/login?reset=1', { replace: true })
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Đặt mật khẩu mới" logo={<Logo height={36} asLink={false} />}>
      <div className="space-y-4">
        {formError && <Alert kind="error">{formError}</Alert>}
        <form className="space-y-4" onSubmit={submit} noValidate>
          <TextField
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            error={errors.pw}
            hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ và số.`}
          />
          <TextField label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
          <button type="submit" className={`${button('primary', 'lg')} w-full`} disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
          </button>
        </form>
      </div>
    </AuthCard>
  )
}
