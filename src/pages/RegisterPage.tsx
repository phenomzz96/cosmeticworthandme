import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Alert, AuthCard, TextField } from '@/components/ui/Form'
import { button } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { SupabaseNotConfigured } from '@/features/auth/SupabaseNotConfigured'
import { useBrand } from '@/features/brand/BrandProvider'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { accountService, PASSWORD_MIN_LENGTH, validateEmail, validatePassword } from '@/services/account'
import { safeNext } from './LoginPage'

export function RegisterPage() {
  useDocumentTitle('Đăng ký')
  const { settings } = useBrand()
  const { status } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string | null>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'disabled') return <SupabaseNotConfigured />
  if (status === 'signed-in' && !submitting) return <Navigate to={safeNext(params.get('next'))} replace />

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = {
      fullName: form.fullName.trim().length < 2 ? 'Nhập họ tên (ít nhất 2 ký tự).' : form.fullName.length > 100 ? 'Họ tên tối đa 100 ký tự.' : null,
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? 'Mật khẩu nhập lại không khớp.' : null,
    }
    setErrors(v)
    setFormError(null)
    if (Object.values(v).some(Boolean)) return

    setSubmitting(true)
    try {
      const r = await accountService.signUp(form)
      if (r.alreadyExists) {
        setFormError('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng chức năng quên mật khẩu.')
      } else if (r.needsEmailConfirmation) {
        setSentTo(form.email.trim())
      } else {
        navigate(safeNext(params.get('next')), { replace: true })
      }
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Kiểm tra email của bạn" logo={<Logo height={36} asLink={false} />}>
        <div className="space-y-4">
          <Alert kind="success">
            Đã gửi email xác minh tới <strong>{sentTo}</strong>. Mở email và bấm vào liên kết để kích hoạt tài khoản, sau đó đăng nhập.
          </Alert>
          <p className="text-sm text-muted">Không thấy email? Kiểm tra mục Spam, hoặc đợi vài phút rồi gửi lại từ trang đăng nhập.</p>
          <Link to="/login" className={`${button('primary', 'lg')} w-full`}>
            Đến trang đăng nhập
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={`Tạo tài khoản ${settings.name}`} subtitle="Dùng để mua hàng, theo dõi đơn và mở cửa hàng." logo={<Logo height={36} asLink={false} />}>
      <div className="space-y-4">
        {formError && <Alert kind="error">{formError}</Alert>}
        <form className="space-y-4" onSubmit={submit} noValidate>
          <TextField label="Họ và tên" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} maxLength={100} />
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ và số.`}
          />
          <TextField label="Nhập lại mật khẩu" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          <button type="submit" className={`${button('primary', 'lg')} w-full`} disabled={submitting}>
            {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>
        <p className="text-center text-sm text-muted">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
