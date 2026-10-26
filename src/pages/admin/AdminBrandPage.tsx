/**
 * QUẢN TRỊ THƯƠNG HIỆU — /admin/brand (chỉ Admin, Super Admin)
 * Lưu trên Supabase: ảnh vào bucket 'brand', cài đặt vào bảng site_settings qua hàm update_site_settings.
 * Database kiểm tra quyền admin ở mọi thao tác; việc ẩn trang chỉ để tiện dùng.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, TextField } from '@/components/ui/Form'
import { button, Skeleton } from '@/components/ui/primitives'
import { brand } from '@/config/brand'
import { toBrandSettings, useBrand } from '@/features/brand/BrandProvider'
import { friendlyError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import {
  brandAssetUrl,
  DEFAULT_SETTINGS,
  isValidHexColor,
  siteSettingsService,
  validateBrandFile,
  type BrandAssetKind,
  type HistoryEntry,
  type SiteSettingsRow,
} from '@/services/siteSettings'

const assetFields: { kind: BrandAssetKind; key: 'logo_light_path' | 'logo_dark_path' | 'favicon_path'; label: string; hint: string }[] = [
  { kind: 'logo-light', key: 'logo_light_path', label: 'Logo nền sáng', hint: 'PNG/JPG/WebP, tối đa 2 MB. Nên có nền trong suốt, cao ít nhất 96 px.' },
  { kind: 'logo-dark', key: 'logo_dark_path', label: 'Logo nền tối', hint: 'Không bắt buộc. Bỏ trống thì dùng logo nền sáng (có nền trắng phía sau ở chế độ tối).' },
  { kind: 'favicon', key: 'favicon_path', label: 'Favicon', hint: 'Ảnh vuông, PNG 64×64 hoặc lớn hơn.' },
]

export function AdminBrandPage() {
  useDocumentTitle('Quản trị thương hiệu')
  const { raw, status, apply } = useBrand()
  const [form, setForm] = useState<SiteSettingsRow>(raw)
  const [loadedFrom, setLoadedFrom] = useState<string | undefined>(raw.updated_at)
  const [uploading, setUploading] = useState<BrandAssetKind | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string | null>>>({})
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Khi dữ liệu từ server về (hoặc thay đổi) và người dùng chưa sửa gì → nạp vào form
  useEffect(() => {
    if (raw.updated_at !== loadedFrom) {
      setForm(raw)
      setLoadedFrom(raw.updated_at)
    }
  }, [raw, loadedFrom])

  const loadHistory = async () => {
    try {
      setHistory(await siteSettingsService.history())
      setHistoryError(null)
    } catch (err) {
      setHistoryError(friendlyError(err))
    }
  }
  useEffect(() => {
    void loadHistory()
  }, [])

  const dirty = useMemo(() => JSON.stringify(stripMeta(form)) !== JSON.stringify(stripMeta(raw)), [form, raw])
  const preview = toBrandSettings(form)

  const upload = async (kind: BrandAssetKind, key: (typeof assetFields)[number]['key'], file: File | undefined) => {
    if (!file) return
    const invalid = validateBrandFile(file)
    setFieldErrors((e) => ({ ...e, [key]: invalid }))
    if (invalid) return
    setUploading(kind)
    try {
      const path = await siteSettingsService.uploadAsset(kind, file)
      setForm((f) => ({ ...f, [key]: path }))
    } catch (err) {
      setFieldErrors((e) => ({ ...e, [key]: friendlyError(err, 'Tải ảnh lên không thành công.') }))
    } finally {
      setUploading(null)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = {
      brand_name: form.brand_name.trim().length === 0 ? 'Nhập tên thương hiệu.' : form.brand_name.trim().length > 60 ? 'Tối đa 60 ký tự.' : null,
      primary_color: isValidHexColor(form.primary_color) ? null : 'Mã màu dạng #RRGGBB, ví dụ #79628e.',
      shipping_fee:
        Number.isInteger(form.shipping_fee) && form.shipping_fee >= 0 && form.shipping_fee <= 1_000_000 ? null : 'Phí từ 0 đến 1.000.000đ, số nguyên.',
    }
    setFieldErrors((old) => ({ ...old, ...v }))
    setResult(null)
    if (Object.values(v).some(Boolean)) return
    setSaving(true)
    try {
      const saved = await siteSettingsService.save(form)
      apply(saved)
      setForm(saved)
      setLoadedFrom(saved.updated_at)
      setResult({ kind: 'success', text: 'Đã lưu. Mọi người dùng sẽ thấy thay đổi khi tải lại trang.' })
      void loadHistory()
    } catch (err) {
      setResult({ kind: 'error', text: friendlyError(err, 'Lưu không thành công.') })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold tracking-tight">Thương hiệu</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Thay đổi được lưu trên hệ thống chung: mọi thiết bị và người dùng đều thấy cùng phiên bản sau khi tải lại trang.
      </p>

      {status === 'error' && (
        <div className="mt-4">
          <Alert kind="error">Không tải được cài đặt hiện tại từ máy chủ. Đang hiển thị giá trị mặc định; hãy tải lại trang trước khi lưu.</Alert>
        </div>
      )}

      <LegacyImport onImported={(patch) => setForm((f) => ({ ...f, ...patch }))} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <form className="space-y-6 rounded-card border border-border bg-surface p-5 sm:p-6" onSubmit={submit} noValidate>
          <fieldset disabled={saving} className="space-y-6">
            <TextField
              label="Tên thương hiệu"
              value={form.brand_name}
              maxLength={60}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
              error={fieldErrors.brand_name}
              hint="Hiển thị ở header, footer, trang đăng nhập và tiêu đề tab."
            />

            {assetFields.map((f) => {
              const url = brandAssetUrl(form[f.key])
              return (
                <div key={f.key}>
                  <p className="text-sm font-medium">{f.label}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <div className="grid h-16 min-w-16 place-items-center rounded-xl border border-dashed border-border bg-surface-2 px-2">
                      {url ? <img src={url} alt="" className="max-h-12 max-w-48 object-contain" /> : <span className="text-xs text-muted">Chưa có</span>}
                    </div>
                    <label className={`${button('secondary', 'sm')} cursor-pointer`}>
                      {uploading === f.kind ? 'Đang tải lên...' : url ? 'Đổi ảnh' : 'Tải ảnh lên'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={uploading !== null}
                        aria-label={`Tải ${f.label.toLowerCase()} từ máy`}
                        onChange={(e) => {
                          void upload(f.kind, f.key, e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {url && (
                      <button type="button" className={button('ghost', 'sm')} onClick={() => setForm({ ...form, [f.key]: null })}>
                        Gỡ ảnh
                      </button>
                    )}
                  </div>
                  {fieldErrors[f.key] ? (
                    <p className="mt-1 text-xs font-medium text-danger">{fieldErrors[f.key]}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">{f.hint}</p>
                  )}
                </div>
              )
            })}

            <div>
              <label htmlFor="primary-color" className="text-sm font-medium">
                Màu chủ đạo
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={isValidHexColor(form.primary_color) ? form.primary_color : brand.primaryColor}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1"
                  aria-label="Chọn màu chủ đạo"
                />
                <input
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value.trim() })}
                  className="h-11 w-32 rounded-xl border border-border bg-surface px-3 font-mono text-sm"
                  aria-label="Mã màu chủ đạo"
                  maxLength={7}
                />
              </div>
              {fieldErrors.primary_color ? (
                <p className="mt-1 text-xs font-medium text-danger">{fieldErrors.primary_color}</p>
              ) : (
                <p className="mt-1 text-xs text-muted">Chế độ tối tự dùng bản sáng hơn của màu này để chữ đủ tương phản.</p>
              )}
            </div>

            <TextField
              label="Phí vận chuyển mỗi đơn của từng shop (đồng)"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000000}
              step={1000}
              value={Number.isFinite(form.shipping_fee) ? form.shipping_fee : ''}
              onChange={(e) => setForm({ ...form, shipping_fee: e.target.value === '' ? NaN : Number(e.target.value) })}
              error={fieldErrors.shipping_fee}
              hint={`Đặt 0 nếu miễn phí. Hiện: ${Number.isFinite(form.shipping_fee) ? formatPrice(form.shipping_fee) : '—'}. Áp dụng khi có chức năng đặt hàng.`}
            />

            {result && <Alert kind={result.kind}>{result.text}</Alert>}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={button('primary')} disabled={!dirty || uploading !== null}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button type="button" className={button('ghost')} disabled={!dirty} onClick={() => setForm(raw)}>
                Hủy thay đổi
              </button>
              <button
                type="button"
                className={button('ghost')}
                onClick={() => setForm({ ...DEFAULT_SETTINGS, updated_at: form.updated_at })}
                title="Điền giá trị mặc định vào form; bấm Lưu để áp dụng"
              >
                Điền giá trị mặc định
              </button>
              {dirty && <span className="text-sm text-muted">Có thay đổi chưa lưu</span>}
            </div>
          </fieldset>
        </form>

        <aside className="space-y-6">
          <BrandPreview name={preview.name} logoLight={preview.logoLight} logoDark={preview.logoDark} color={preview.primaryColor} />
          <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="history-heading">
            <h2 id="history-heading" className="font-semibold">
              Phiên bản trước
            </h2>
            {historyError && <p className="mt-2 text-sm text-danger">{historyError}</p>}
            {history === null && !historyError && <Skeleton className="mt-3 h-20" />}
            {history?.length === 0 && <p className="mt-2 text-sm text-muted">Chưa có thay đổi nào.</p>}
            {history && history.length > 0 && (
              <ul className="mt-3 divide-y divide-border">
                {history.map((h) => (
                  <HistoryItem
                    key={h.id}
                    entry={h}
                    onRestore={async () => {
                      const saved = await siteSettingsService.restore(h.id)
                      apply(saved)
                      setForm(saved)
                      setLoadedFrom(saved.updated_at)
                      setResult({ kind: 'success', text: 'Đã khôi phục phiên bản trước.' })
                      void loadHistory()
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function stripMeta(r: SiteSettingsRow) {
  const { updated_at: _ignored, ...rest } = r
  return rest
}

function HistoryItem({ entry, onRestore }: { entry: HistoryEntry; onRestore: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const s = entry.snapshot
  return (
    <li className="py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{new Date(entry.changed_at).toLocaleString('vi-VN')}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-muted">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-border" style={{ background: s.primary_color }} />
            {s.brand_name} · {s.logo_light_path ? 'có logo' : 'logo chữ'}
          </p>
        </div>
        {confirming ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className={button('primary', 'sm')}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await onRestore()
                  setConfirming(false)
                } catch (err) {
                  setError(friendlyError(err))
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? '...' : 'Xác nhận'}
            </button>
            <button type="button" className={button('ghost', 'sm')} onClick={() => setConfirming(false)}>
              Thôi
            </button>
          </div>
        ) : (
          <button type="button" className={button('secondary', 'sm')} onClick={() => setConfirming(true)}>
            Khôi phục
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-danger">{error}</p>}
    </li>
  )
}

/** Xem trước header ở cả 2 nền, dùng chính các giá trị trong form (chưa lưu) */
function BrandPreview({ name, logoLight, logoDark, color }: { name: string; logoLight: string; logoDark: string; color: string }) {
  const tile = (bg: string, fg: string, logo: string, backdrop: boolean) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3" style={{ background: bg }}>
      {logo ? (
        <span className={backdrop ? 'rounded-md bg-white px-1.5 py-1' : undefined}>
          <img src={logo} alt="" className="h-8 w-auto max-w-44 object-contain" />
        </span>
      ) : (
        <span className="flex items-center gap-2 font-extrabold" style={{ color: fg }}>
          <span className="grid h-8 w-8 place-items-center rounded-full text-sm text-white" style={{ background: color }}>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          {name || 'Tên thương hiệu'}
        </span>
      )}
      <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: color }}>
        Nút chính
      </span>
    </div>
  )
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="preview-heading">
      <h2 id="preview-heading" className="font-semibold">
        Xem trước
      </h2>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted">Nền sáng</p>
        {tile('#ffffff', '#241521', logoLight, false)}
        <p className="text-xs text-muted">Nền tối</p>
        {tile('#170f16', '#f3e9f0', logoDark || logoLight, !logoDark && !!logoLight)}
      </div>
    </section>
  )
}

/**
 * Chuyển logo cũ từ bản demo trước (lưu dạng base64 trong localStorage của TRÌNH DUYỆT NÀY)
 * lên Storage. Không tự xóa dữ liệu cũ, để không làm mất file logo nếu đây là bản duy nhất.
 */
const LEGACY_KEY = 'worth-and-me-brand-settings-v1'

function LegacyImport({ onImported }: { onImported: (patch: Partial<SiteSettingsRow>) => void }) {
  const legacy = useMemo(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as Record<string, string> | null
      if (!v) return null
      const images = (['logoLight', 'logoDark', 'favicon'] as const).filter((k) => typeof v[k] === 'string' && v[k].startsWith('data:image/'))
      return images.length ? { data: v, images } : null
    } catch {
      return null
    }
  }, [])
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!legacy || state === 'done') {
    return message ? (
      <div className="mt-4">
        <Alert kind="success">{message}</Alert>
      </div>
    ) : null
  }

  const run = async () => {
    setState('busy')
    const map = { logoLight: ['logo-light', 'logo_light_path'], logoDark: ['logo-dark', 'logo_dark_path'], favicon: ['favicon', 'favicon_path'] } as const
    const patch: Partial<SiteSettingsRow> = {}
    const skipped: string[] = []
    for (const k of legacy.images) {
      try {
        const blob = await (await fetch(legacy.data[k])).blob()
        const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]
        const file = new File([blob], `${k}.${ext}`, { type: blob.type })
        if (validateBrandFile(file)) {
          skipped.push(k === 'favicon' ? 'favicon' : 'logo (định dạng SVG hoặc quá 2 MB)')
          continue
        }
        const [kind, key] = map[k]
        patch[key] = await siteSettingsService.uploadAsset(kind, file)
      } catch {
        skipped.push(k)
      }
    }
    if (legacy.data.name) patch.brand_name = legacy.data.name
    if (legacy.data.primaryColor && isValidHexColor(legacy.data.primaryColor)) patch.primary_color = legacy.data.primaryColor
    onImported(patch)
    setState('done')
    setMessage(
      `Đã tải logo cũ lên hệ thống và điền vào form. Bấm "Lưu thay đổi" để áp dụng.${skipped.length ? ` Bỏ qua: ${skipped.join(', ')}.` : ''}`,
    )
  }

  return (
    <div className="mt-4">
      <Alert kind="info">
        Trình duyệt này còn logo từ bản demo cũ (chỉ lưu trên máy này, người khác không thấy).
        <button type="button" className="mt-1 block font-semibold text-primary hover:underline" disabled={state === 'busy'} onClick={() => void run()}>
          {state === 'busy' ? 'Đang chuyển...' : 'Chuyển logo cũ lên hệ thống'}
        </button>
      </Alert>
    </div>
  )
}
