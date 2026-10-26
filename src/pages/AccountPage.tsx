import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, TextField } from '@/components/ui/Form'
import { Breadcrumbs, button, Skeleton } from '@/components/ui/primitives'
import { AddressBook } from '@/features/address/AddressBook'
import { useAuth } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { accountService, PASSWORD_MIN_LENGTH, validatePassword, validatePhone } from '@/services/account'
import { roleLabels } from '@/types/account'

export function AccountPage() {
  useDocumentTitle('Tài khoản của tôi')
  const { user, profile, profileError, isAdmin, isSuspended, setProfile, signOut, refreshProfile } = useAuth()

  if (profileError) {
    return (
      <div className="container-page py-12">
        <Alert kind="error">
          Không tải được hồ sơ.{' '}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => void refreshProfile()}>
            Thử lại
          </button>
        </Alert>
      </div>
    )
  }
  if (!profile || !user) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản' }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tài khoản của tôi</h1>
          <p className="mt-1 text-sm text-muted">
            {profile.email} · {roleLabels[profile.role]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/orders" className={button('primary', 'sm')}>
            Đơn hàng của tôi
          </Link>
          <Link to="/seller" className={button('secondary', 'sm')}>
            {profile.role === 'seller' ? 'Kênh người bán' : 'Cửa hàng của tôi'}
          </Link>
          {isAdmin && (
            <Link to="/admin" className={button('secondary', 'sm')}>
              Trang quản trị
            </Link>
          )}
          <button type="button" className={button('ghost', 'sm')} onClick={() => void signOut()}>
            Đăng xuất
          </button>
        </div>
      </div>

      {isSuspended && (
        <div className="mt-6">
          <Alert kind="error">
            Tài khoản đang bị tạm khóa{profile.suspended_reason ? `: ${profile.suspended_reason}` : '.'} Bạn không thể thay đổi thông tin hoặc thực hiện giao dịch.
          </Alert>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProfileForm
          key={profile.id}
          initialName={profile.full_name}
          initialPhone={profile.phone ?? ''}
          disabled={isSuspended}
          onSave={async (fullName, phone) => setProfile(await accountService.updateMyProfile(user.id, { fullName, phone }))}
        />
        <PasswordForm disabled={isSuspended} />
      </div>

      <div className="mt-6">
        <AddressBook disabled={isSuspended} />
      </div>
    </div>
  )
}

function ProfileForm({
  initialName,
  initialPhone,
  disabled,
  onSave,
}: {
  initialName: string
  initialPhone: string
  disabled: boolean
  onSave: (fullName: string, phone: string) => Promise<void>
}) {
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [errors, setErrors] = useState<{ fullName?: string | null; phone?: string | null }>({})
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (result?.kind !== 'success') return
    const t = window.setTimeout(() => setResult(null), 3000)
    return () => window.clearTimeout(t)
  }, [result])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = {
      fullName: fullName.trim().length < 2 ? 'Nhập họ tên (ít nhất 2 ký tự).' : fullName.length > 100 ? 'Họ tên tối đa 100 ký tự.' : null,
      phone: validatePhone(phone),
    }
    setErrors(v)
    setResult(null)
    if (v.fullName || v.phone) return
    setSaving(true)
    try {
      await onSave(fullName, phone)
      setResult({ kind: 'success', text: 'Đã lưu thông tin cá nhân.' })
    } catch (err) {
      setResult({ kind: 'error', text: friendlyError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5 sm:p-6" aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="text-lg font-semibold">
        Thông tin cá nhân
      </h2>
      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
        <fieldset disabled={disabled || saving} className="space-y-4">
          <TextField label="Họ và tên" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} maxLength={100} />
          <TextField
            label="Số điện thoại"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            hint="Không bắt buộc. Chỉ người bán xử lý đơn của bạn mới thấy (khi có đơn hàng)."
          />
          {result && <Alert kind={result.kind}>{result.text}</Alert>}
          <button type="submit" className={button('primary')}>
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}

function PasswordForm({ disabled }: { disabled: boolean }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ pw?: string | null; confirm?: string | null }>({})
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = { pw: validatePassword(pw), confirm: confirm !== pw ? 'Mật khẩu nhập lại không khớp.' : null }
    setErrors(v)
    setResult(null)
    if (v.pw || v.confirm) return
    setSaving(true)
    try {
      await accountService.updatePassword(pw)
      setPw('')
      setConfirm('')
      setResult({ kind: 'success', text: 'Đã đổi mật khẩu.' })
    } catch (err) {
      setResult({ kind: 'error', text: friendlyError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5 sm:p-6" aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-lg font-semibold">
        Đổi mật khẩu
      </h2>
      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
        <fieldset disabled={disabled || saving} className="space-y-4">
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
          {result && <Alert kind={result.kind}>{result.text}</Alert>}
          <button type="submit" className={button('secondary')}>
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
