/**
 * THIẾT LẬP CỬA HÀNG — /seller/shop
 * Sửa thông tin hiển thị, liên hệ, chính sách, màu nhận diện, logo và ảnh bìa.
 * Database chỉ cho chủ shop sửa các cột này; đường dẫn shop và trạng thái duyệt không sửa được từ đây.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Alert, TextAreaField, TextField } from '@/components/ui/Form'
import { button, ShopAvatar } from '@/components/ui/primitives'
import { useSeller } from '@/features/seller/SellerLayout'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { normalizePhone, validateEmail, validatePhone } from '@/services/account'
import { catalogService } from '@/services/catalog'
import { removeShopImages, shopMediaUrl, uploadShopImage, validateShopImage } from '@/services/media'
import { sellerService } from '@/services/seller'
import type { SellerShop } from '@/types/seller'
import { validateShopName } from './OpenShopPage'

const HEX = /^#[0-9A-Fa-f]{6}$/

function toForm(s: SellerShop) {
  return {
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    location: s.location,
    contact_email: s.contact_email ?? '',
    contact_phone: s.contact_phone ?? '',
    policy: s.policy,
    theme_color: s.theme_color,
  }
}

type Form = ReturnType<typeof toForm>

export function validateShopForm(f: Form): Record<string, string | null> {
  return {
    name: validateShopName(f.name),
    tagline: f.tagline.length > 120 ? 'Tối đa 120 ký tự.' : null,
    description: f.description.length > 2000 ? 'Tối đa 2000 ký tự.' : null,
    location: f.location.length > 80 ? 'Tối đa 80 ký tự.' : null,
    contact_email: f.contact_email.trim() ? validateEmail(f.contact_email.trim()) : null,
    contact_phone: validatePhone(f.contact_phone),
    policy: f.policy.length > 3000 ? 'Tối đa 3000 ký tự.' : null,
    theme_color: HEX.test(f.theme_color) ? null : 'Màu dạng #RRGGBB.',
  }
}

export function SellerShopSettingsPage() {
  useDocumentTitle('Thiết lập cửa hàng')
  const { shop, setShop, canEditShop } = useSeller()
  const [form, setForm] = useState<Form>(() => toForm(shop))
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Shop đổi từ nơi khác (gửi duyệt lại, đổi ảnh) → đồng bộ form nếu người dùng chưa sửa gì
  useEffect(() => {
    setForm(toForm(shop))
  }, [shop.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validateShopForm(form)
    setErrors(v)
    setResult(null)
    if (Object.values(v).some(Boolean)) return
    setSaving(true)
    try {
      const updated = await sellerService.updateShop(shop.id, {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        contact_email: form.contact_email.trim() || null,
        contact_phone: normalizePhone(form.contact_phone),
        policy: form.policy.trim(),
        theme_color: form.theme_color,
      })
      setShop(updated)
      setForm(toForm(updated))
      setResult({ kind: 'success', text: shop.status === 'rejected' ? 'Đã lưu. Bấm "Gửi duyệt lại" ở phía trên khi đã sửa xong.' : 'Đã lưu thông tin cửa hàng.' })
      void catalogService.refresh().catch(() => undefined)
    } catch (err) {
      setResult({ kind: 'error', text: friendlyError(err, 'Lưu không thành công.') })
    } finally {
      setSaving(false)
    }
  }

  const readOnly = !canEditShop

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold tracking-tight">Thiết lập cửa hàng</h1>
      <p className="mt-1 text-sm text-muted">
        Đường dẫn: <span className="font-mono">/shops/{shop.slug}</span> (không đổi được).
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <form className="space-y-6" onSubmit={submit} noValidate>
          <fieldset disabled={readOnly || saving} className="space-y-6">
            <section className="space-y-4 rounded-card border border-border bg-surface p-5">
              <h2 className="font-semibold">Thông tin hiển thị</h2>
              <TextField label="Tên cửa hàng" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} error={errors.name} />
              <TextField label="Khẩu hiệu ngắn" value={form.tagline} maxLength={120} onChange={(e) => set('tagline', e.target.value)} error={errors.tagline} />
              <TextAreaField label="Giới thiệu cửa hàng" value={form.description} rows={4} maxLength={2000} counter onChange={(v) => set('description', v)} error={errors.description} />
              <TextField label="Khu vực" value={form.location} maxLength={80} placeholder="Ví dụ: Hà Nội" onChange={(e) => set('location', e.target.value)} error={errors.location} />
            </section>

            <section className="space-y-4 rounded-card border border-border bg-surface p-5">
              <div>
                <h2 className="font-semibold">Liên hệ</h2>
                <p className="mt-0.5 text-xs text-muted">Hiển thị công khai trên trang cửa hàng. Không dùng số điện thoại cá nhân nếu không muốn công khai.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Email liên hệ" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} error={errors.contact_email} />
                <TextField label="Số điện thoại" type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} error={errors.contact_phone} />
              </div>
            </section>

            <section className="space-y-4 rounded-card border border-border bg-surface p-5">
              <h2 className="font-semibold">Chính sách cửa hàng</h2>
              <TextAreaField
                label="Đổi trả, bảo hành, thời gian xử lý đơn"
                value={form.policy}
                rows={5}
                maxLength={3000}
                counter
                onChange={(v) => set('policy', v)}
                error={errors.policy}
                placeholder="Ví dụ: Đổi trả trong 7 ngày nếu sản phẩm lỗi do nhà sản xuất, còn nguyên tem..."
              />
            </section>

            <section className="space-y-3 rounded-card border border-border bg-surface p-5">
              <h2 className="font-semibold">Màu nhận diện</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={HEX.test(form.theme_color) ? form.theme_color : '#000000'}
                  onChange={(e) => set('theme_color', e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-surface p-1"
                  aria-label="Chọn màu nhận diện cửa hàng"
                />
                <TextField label="Mã màu" value={form.theme_color} maxLength={7} onChange={(e) => set('theme_color', e.target.value)} error={errors.theme_color} className="w-40" />
              </div>
              <p className="text-xs text-muted">Dùng cho ảnh đại diện mặc định và dải màu trên trang cửa hàng.</p>
            </section>

            {result && <Alert kind={result.kind}>{result.text}</Alert>}
            {!readOnly && (
              <button type="submit" className={button('primary')}>
                {saving ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            )}
          </fieldset>
        </form>

        <aside className="space-y-6 lg:sticky lg:top-36 lg:self-start">
          <MediaCard shop={shop} disabled={readOnly} onChange={setShop} />
          <section className="overflow-hidden rounded-card border border-border bg-surface" aria-label="Xem trước trang cửa hàng">
            <ShopCover shop={{ ...shop, theme_color: HEX.test(form.theme_color) ? form.theme_color : shop.theme_color }} />
            <div className="flex items-center gap-3 p-4">
              <ShopAvatar name={form.name || shop.name} color={HEX.test(form.theme_color) ? form.theme_color : shop.theme_color} logo={shopMediaUrl(shop.logo_path)} size={52} />
              <div className="min-w-0">
                <p className="truncate font-bold">{form.name || 'Tên cửa hàng'}</p>
                <p className="truncate text-sm text-muted">{form.tagline || 'Khẩu hiệu ngắn'}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

/** Ảnh bìa trang shop; không có ảnh thì dùng dải màu nhận diện */
export function ShopCover({ shop, className = 'h-28' }: { shop: Pick<SellerShop, 'cover_path' | 'theme_color' | 'name'>; className?: string }) {
  const url = shopMediaUrl(shop.cover_path)
  if (url) return <img src={url} alt="" className={`${className} w-full object-cover`} />
  return <div className={`${className} w-full opacity-80`} style={{ background: `linear-gradient(135deg, ${shop.theme_color}, ${shop.theme_color}55)` }} aria-hidden />
}

function MediaCard({ shop, disabled, onChange }: { shop: SellerShop; disabled: boolean; onChange: (s: SellerShop) => void }) {
  const [busy, setBusy] = useState<null | 'logo' | 'cover'>(null)
  const [error, setError] = useState<string | null>(null)

  const replace = async (kind: 'logo' | 'cover', file: File | null) => {
    setError(null)
    const field = kind === 'logo' ? 'logo_path' : 'cover_path'
    const old = shop[field]
    if (file) {
      const invalid = validateShopImage(file)
      if (invalid) return setError(invalid)
    }
    setBusy(kind)
    let uploaded: string | null = null
    try {
      uploaded = file ? await uploadShopImage(shop.id, kind, file) : null
      const updated = await sellerService.updateShop(shop.id, { [field]: uploaded })
      onChange(updated)
      if (old) await removeShopImages([old])
      void catalogService.refresh().catch(() => undefined)
    } catch (err) {
      if (uploaded) await removeShopImages([uploaded])
      setError(friendlyError(err, 'Cập nhật ảnh không thành công.'))
    } finally {
      setBusy(null)
    }
  }

  const row = (kind: 'logo' | 'cover', label: string, hint: string) => {
    const path = kind === 'logo' ? shop.logo_path : shop.cover_path
    return (
      <div className="flex items-center gap-3">
        <div className={`shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2 ${kind === 'logo' ? 'h-14 w-14' : 'h-14 w-24'}`}>
          {path ? <img src={shopMediaUrl(path)} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[10px] text-muted">Chưa có</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted">{hint}</p>
          {!disabled && (
            <div className="mt-1.5 flex gap-2">
              <label className={`${button('secondary', 'sm')} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                {busy === kind ? 'Đang tải...' : path ? 'Đổi ảnh' : 'Tải lên'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label={`Tải ${label.toLowerCase()} từ máy`}
                  disabled={!!busy}
                  onChange={(e) => {
                    void replace(kind, e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
              {path && (
                <button type="button" className={button('ghost', 'sm')} disabled={!!busy} onClick={() => void replace(kind, null)}>
                  Gỡ
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-5" aria-labelledby="media-heading">
      <h2 id="media-heading" className="font-semibold">
        Logo và ảnh bìa
      </h2>
      {row('logo', 'Logo cửa hàng', 'Ảnh vuông, tối đa 3 MB.')}
      {row('cover', 'Ảnh bìa', 'Ảnh ngang (khoảng 3:1), tối đa 3 MB.')}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </section>
  )
}
