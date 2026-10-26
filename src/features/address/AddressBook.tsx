/**
 * Sổ địa chỉ: form nhập địa chỉ + danh sách (thêm, sửa, xóa, đặt mặc định).
 * Dùng ở trang Tài khoản và trang Đặt hàng.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, TextField } from '@/components/ui/Form'
import { button, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { addressService, emptyAddress, formatAddress, MAX_ADDRESSES, validateAddress, type Address, type AddressInput } from '@/services/addresses'

export function AddressForm({
  initial,
  submitLabel = 'Lưu địa chỉ',
  disabled,
  onSubmit,
  onCancel,
}: {
  initial?: AddressInput
  submitLabel?: string
  disabled?: boolean
  onSubmit: (a: AddressInput) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState<AddressInput>(initial ?? emptyAddress)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof AddressInput>(k: K, v: AddressInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validateAddress(form)
    setErrors(v)
    setError(null)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được địa chỉ.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Địa chỉ giao hàng">
      <fieldset disabled={disabled || saving} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Họ tên người nhận" autoComplete="name" value={form.recipient_name} maxLength={80} onChange={(e) => set('recipient_name', e.target.value)} error={errors.recipient_name} />
          <TextField label="Số điện thoại người nhận" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Tỉnh / Thành phố" autoComplete="address-level1" value={form.province} maxLength={60} onChange={(e) => set('province', e.target.value)} error={errors.province} />
          <TextField label="Quận / Huyện" autoComplete="address-level2" value={form.district} maxLength={60} onChange={(e) => set('district', e.target.value)} error={errors.district} />
          <TextField label="Phường / Xã" autoComplete="address-level3" value={form.ward} maxLength={60} onChange={(e) => set('ward', e.target.value)} error={errors.ward} />
        </div>
        <TextField label="Số nhà, tên đường" autoComplete="street-address" value={form.street} maxLength={200} onChange={(e) => set('street', e.target.value)} error={errors.street} />
        <div className="flex flex-wrap items-end gap-4">
          <TextField label="Gợi nhớ (không bắt buộc)" placeholder="Nhà, Công ty..." value={form.label} maxLength={30} onChange={(e) => set('label', e.target.value)} error={errors.label} className="w-48" />
          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => set('is_default', e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Đặt làm địa chỉ mặc định
          </label>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2">
          <button type="submit" className={button('primary')}>
            {saving ? 'Đang lưu...' : submitLabel}
          </button>
          {onCancel && (
            <button type="button" className={button('ghost')} onClick={onCancel}>
              Hủy
            </button>
          )}
        </div>
      </fieldset>
      <p className="text-xs text-muted">Địa chỉ và số điện thoại chỉ bạn xem được. Khi đặt hàng, người bán của đơn đó mới thấy thông tin giao hàng.</p>
    </form>
  )
}

export function AddressCard({ address, children }: { address: Address; children?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-medium">
        {address.recipient_name} <span className="font-normal text-muted">· {address.phone}</span>
        {address.label && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{address.label}</span>}
        {address.is_default && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Mặc định</span>}
      </p>
      <p className="mt-0.5 text-sm text-muted">{formatAddress(address)}</p>
      {children}
    </div>
  )
}

export function useAddresses() {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; list: Address[]; error?: string }>({ status: 'loading', list: [] })
  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', list: await addressService.list() })
    } catch (err) {
      setState({ status: 'error', list: [], error: friendlyError(err) })
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { ...state, reload }
}

/** Sổ địa chỉ đầy đủ (trang Tài khoản) */
export function AddressBook({ disabled }: { disabled?: boolean }) {
  const { status, list, error, reload } = useAddresses()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setNotice(null)
    try {
      await fn()
      await reload()
      setNotice({ kind: 'success', text: ok })
    } catch (err) {
      setNotice({ kind: 'error', text: friendlyError(err) })
    }
  }

  return (
    <section id="addresses" className="rounded-card border border-border bg-surface p-5 sm:p-6" aria-labelledby="addresses-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="addresses-heading" className="text-lg font-semibold">
          Sổ địa chỉ
        </h2>
        {!disabled && editing === null && status === 'ready' && list.length < MAX_ADDRESSES && (
          <button type="button" className={button('secondary', 'sm')} onClick={() => setEditing('new')}>
            Thêm địa chỉ
          </button>
        )}
      </div>
      {notice && (
        <div className="mt-3">
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      )}
      {status === 'loading' && <Skeleton className="mt-4 h-24 w-full" />}
      {status === 'error' && (
        <div className="mt-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {editing === 'new' && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <AddressForm
            submitLabel="Thêm địa chỉ"
            onCancel={() => setEditing(null)}
            onSubmit={async (a) => {
              await addressService.create(a)
              setEditing(null)
              await reload()
              setNotice({ kind: 'success', text: 'Đã thêm địa chỉ.' })
            }}
          />
        </div>
      )}
      {status === 'ready' && list.length === 0 && editing !== 'new' && <p className="mt-3 text-sm text-muted">Chưa có địa chỉ nào. Thêm địa chỉ để đặt hàng nhanh hơn.</p>}
      {status === 'ready' && list.length > 0 && (
        <ul className="mt-4 divide-y divide-border" aria-label="Danh sách địa chỉ">
          {list.map((a) => (
            <li key={a.id} className="py-3">
              {editing === a.id ? (
                <AddressForm
                  initial={a}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (input) => {
                    await addressService.update(a.id, input)
                    setEditing(null)
                    await reload()
                    setNotice({ kind: 'success', text: 'Đã cập nhật địa chỉ.' })
                  }}
                />
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <AddressCard address={a} />
                  {!disabled && (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {confirmDelete === a.id ? (
                        <>
                          <span className="self-center text-xs text-muted">Xóa địa chỉ này?</span>
                          <button type="button" className={button('primary', 'sm')} onClick={() => void run(() => addressService.remove(a.id), 'Đã xóa địa chỉ.').then(() => setConfirmDelete(null))}>
                            Xác nhận
                          </button>
                          <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirmDelete(null)}>
                            Thôi
                          </button>
                        </>
                      ) : (
                        <>
                          {!a.is_default && (
                            <button type="button" className={button('ghost', 'sm')} onClick={() => void run(() => addressService.setDefault(a.id), 'Đã đổi địa chỉ mặc định.')}>
                              Đặt mặc định
                            </button>
                          )}
                          <button type="button" className={button('secondary', 'sm')} onClick={() => setEditing(a.id)} aria-label={`Sửa địa chỉ ${a.recipient_name}, ${a.street}`}>
                            Sửa
                          </button>
                          <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirmDelete(a.id)} aria-label={`Xóa địa chỉ ${a.recipient_name}, ${a.street}`}>
                            Xóa
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {status === 'ready' && list.length >= MAX_ADDRESSES && <p className="mt-2 text-xs text-muted">Đã đủ {MAX_ADDRESSES} địa chỉ. Xóa bớt để thêm mới.</p>}
    </section>
  )
}
