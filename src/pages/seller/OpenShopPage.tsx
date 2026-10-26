/** MỞ CỬA HÀNG — hiện khi người dùng đã đăng nhập nhưng chưa có shop */
import { useState, type FormEvent } from 'react'
import { Alert, TextAreaField, TextField } from '@/components/ui/Form'
import { button } from '@/components/ui/primitives'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBrand } from '@/features/brand/BrandProvider'
import { friendlyError } from '@/lib/errors'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { normalizePhone, validateEmail, validatePhone } from '@/services/account'
import { makeShopSlug, sellerService } from '@/services/seller'
import type { SellerShop } from '@/types/seller'

export function validateShopName(name: string) {
  const n = name.trim()
  if (n.length < 2) return 'Tên cửa hàng cần ít nhất 2 ký tự.'
  if (n.length > 80) return 'Tên cửa hàng tối đa 80 ký tự.'
  return null
}

export function validateSlug(slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Chỉ gồm chữ thường không dấu, số và dấu gạch ngang.'
  if (slug.length < 3 || slug.length > 60) return 'Từ 3 đến 60 ký tự.'
  return null
}

export function OpenShopPage({ onCreated }: { onCreated: (s: SellerShop) => void }) {
  useDocumentTitle('Mở cửa hàng')
  const { user, profile, isSuspended } = useAuth()
  const { settings } = useBrand()
  const [form, setForm] = useState({ name: '', slug: '', tagline: '', description: '', location: '', contact_email: profile?.email ?? '', contact_phone: profile?.phone ?? '' })
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form, v: string) => {
    const next = { ...form, [k]: v }
    if (k === 'name' && !slugTouched) next.slug = makeShopSlug(v)
    setForm(next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = {
      name: validateShopName(form.name),
      slug: validateSlug(form.slug),
      tagline: form.tagline.length > 120 ? 'Tối đa 120 ký tự.' : null,
      description: form.description.trim().length < 20 ? 'Mô tả cửa hàng ít nhất 20 ký tự để quản trị viên xét duyệt.' : form.description.length > 2000 ? 'Tối đa 2000 ký tự.' : null,
      contact_email: form.contact_email ? validateEmail(form.contact_email) : null,
      contact_phone: validatePhone(form.contact_phone),
    }
    setErrors(v)
    setFormError(null)
    if (Object.values(v).some(Boolean) || !user) return
    setSaving(true)
    try {
      const shop = await sellerService.createShop(user.id, {
        name: form.name.trim(),
        slug: form.slug,
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        contact_email: form.contact_email.trim() || null,
        contact_phone: normalizePhone(form.contact_phone),
        policy: '',
        theme_color: settings.primaryColor,
      })
      onCreated(shop)
    } catch (err) {
      setFormError(friendlyError(err, 'Không mở được cửa hàng. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Mở cửa hàng trên {settings.name}</h1>
        <ol className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
          <li className="rounded-xl border border-border bg-surface p-3">
            <span className="font-semibold text-text">1. Gửi thông tin</span>
            <br />
            Tên, mô tả, liên hệ của cửa hàng.
          </li>
          <li className="rounded-xl border border-border bg-surface p-3">
            <span className="font-semibold text-text">2. Chờ duyệt</span>
            <br />
            Quản trị viên kiểm tra thông tin. Bạn vẫn chuẩn bị sản phẩm được.
          </li>
          <li className="rounded-xl border border-border bg-surface p-3">
            <span className="font-semibold text-text">3. Bắt đầu bán</span>
            <br />
            Sản phẩm hiển thị cho khách khi shop được duyệt.
          </li>
        </ol>

        {isSuspended ? (
          <div className="mt-6">
            <Alert kind="error">Tài khoản của bạn đang bị khóa nên không thể mở cửa hàng.</Alert>
          </div>
        ) : (
          <form className="mt-6 space-y-5 rounded-card border border-border bg-surface p-5 sm:p-6" onSubmit={submit} noValidate>
            {formError && <Alert kind="error">{formError}</Alert>}
            <fieldset disabled={saving} className="space-y-5">
              <TextField label="Tên cửa hàng" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} error={errors.name} />
              <TextField
                label="Đường dẫn cửa hàng"
                value={form.slug}
                maxLength={60}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', e.target.value.toLowerCase())
                }}
                error={errors.slug}
                hint={
                  <>
                    Địa chỉ trang shop: <span className="font-mono">/shops/{form.slug || 'ten-cua-hang'}</span>. Không đổi được sau khi tạo.
                  </>
                }
              />
              <TextField label="Khẩu hiệu ngắn (không bắt buộc)" value={form.tagline} maxLength={120} onChange={(e) => set('tagline', e.target.value)} error={errors.tagline} />
              <TextAreaField
                label="Giới thiệu cửa hàng"
                value={form.description}
                onChange={(v) => set('description', v)}
                rows={4}
                maxLength={2000}
                counter
                error={errors.description}
                placeholder="Bạn bán những sản phẩm gì, nguồn hàng từ đâu, cam kết gì với khách..."
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Email liên hệ của shop" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} error={errors.contact_email} />
                <TextField label="SĐT liên hệ của shop" type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} error={errors.contact_phone} />
              </div>
              <TextField label="Khu vực (không bắt buộc)" value={form.location} maxLength={80} placeholder="Ví dụ: TP. Hồ Chí Minh" onChange={(e) => set('location', e.target.value)} />
              <p className="text-xs text-muted">Email và SĐT liên hệ của shop sẽ hiển thị công khai trên trang cửa hàng.</p>
              <button type="submit" className={button('primary', 'lg')}>
                {saving ? 'Đang gửi...' : 'Gửi yêu cầu mở cửa hàng'}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  )
}
