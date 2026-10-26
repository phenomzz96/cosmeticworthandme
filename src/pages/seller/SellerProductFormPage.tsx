/**
 * THÊM / SỬA SẢN PHẨM — /seller/products/new, /seller/products/:id
 * Kiểm tra dữ liệu ở trình duyệt cho nhanh; database kiểm tra lại toàn bộ (giá, tồn kho, ảnh, quyền).
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, TextAreaField, TextField } from '@/components/ui/Form'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { Breadcrumbs, button, Price, Skeleton } from '@/components/ui/primitives'
import { categories, concernLabels, productTypeLabels, skinTypeLabels, typesByCategory } from '@/data/taxonomy'
import { useSeller } from '@/features/seller/SellerLayout'
import { friendlyError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService, DEFAULT_VISUAL } from '@/services/catalog'
import { shopMediaUrl, uploadShopImage, validateShopImage } from '@/services/media'
import { sellerService } from '@/services/seller'
import type { CategoryId, ProductType, SkinConcern, SkinType } from '@/types/catalog'
import { MAX_PRODUCT_IMAGES, productStatusLabels, type ProductInput, type ProductStatus, type SellerProduct } from '@/types/seller'
import { ProductStatusBadge } from './SellerProductsPage'

interface FormState {
  name: string
  brand_name: string
  category: CategoryId
  product_type: ProductType
  size: string
  sku: string
  price: string
  sale_price: string
  stock: string
  description: string
  key_ingredients: string
  texture: string
  fragrance_free: '' | 'yes' | 'no'
  skin_types: SkinType[]
  concerns: SkinConcern[]
}

const emptyForm: FormState = {
  name: '',
  brand_name: '',
  category: 'skincare',
  product_type: 'cleanser',
  size: '',
  sku: '',
  price: '',
  sale_price: '',
  stock: '0',
  description: '',
  key_ingredients: '',
  texture: '',
  fragrance_free: '',
  skin_types: [],
  concerns: [],
}

function toForm(p: SellerProduct): FormState {
  return {
    name: p.name,
    brand_name: p.brand_name,
    category: p.category,
    product_type: p.product_type,
    size: p.size,
    sku: p.sku ?? '',
    price: String(p.price),
    sale_price: p.sale_price != null ? String(p.sale_price) : '',
    stock: String(p.stock),
    description: p.description,
    key_ingredients: p.key_ingredients.join(', '),
    texture: p.texture ?? '',
    fragrance_free: p.fragrance_free == null ? '' : p.fragrance_free ? 'yes' : 'no',
    skin_types: p.skin_types,
    concerns: p.concerns,
  }
}

const intOrNaN = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/[.\s]/g, '')))

/** Kiểm tra giống ràng buộc trong database, trả về lỗi từng ô */
export function validateProduct(f: FormState): Record<string, string> {
  const e: Record<string, string> = {}
  const price = intOrNaN(f.price)
  const sale = f.sale_price.trim() === '' ? null : intOrNaN(f.sale_price)
  const stock = intOrNaN(f.stock)
  if (f.name.trim().length < 2 || f.name.length > 150) e.name = 'Tên sản phẩm từ 2 đến 150 ký tự.'
  if (!f.brand_name.trim() || f.brand_name.length > 80) e.brand_name = 'Nhập thương hiệu (tối đa 80 ký tự).'
  if (!typesByCategory[f.category].includes(f.product_type)) e.product_type = 'Loại sản phẩm không thuộc danh mục đã chọn.'
  if (!Number.isInteger(price) || price < 1000 || price > 100_000_000) e.price = 'Giá từ 1.000đ đến 100.000.000đ, số nguyên.'
  if (sale !== null && (!Number.isInteger(sale) || sale < 1000)) e.sale_price = 'Giá khuyến mãi tối thiểu 1.000đ, số nguyên.'
  else if (sale !== null && Number.isInteger(price) && sale >= price) e.sale_price = 'Giá khuyến mãi phải thấp hơn giá gốc.'
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) e.stock = 'Tồn kho từ 0 đến 100.000.'
  if (f.sku.length > 60) e.sku = 'SKU tối đa 60 ký tự.'
  if (f.size.length > 40) e.size = 'Tối đa 40 ký tự.'
  if (f.description.length > 5000) e.description = 'Mô tả tối đa 5000 ký tự.'
  if (f.key_ingredients.split(',').filter((x) => x.trim()).length > 10) e.key_ingredients = 'Tối đa 10 thành phần chính.'
  if (f.texture.length > 60) e.texture = 'Tối đa 60 ký tự.'
  return e
}

function toInput(f: FormState): ProductInput {
  return {
    name: f.name.trim(),
    brand_name: f.brand_name.trim(),
    category: f.category,
    product_type: f.product_type,
    size: f.size.trim(),
    sku: f.sku.trim() || null,
    price: intOrNaN(f.price),
    sale_price: f.sale_price.trim() === '' ? null : intOrNaN(f.sale_price),
    stock: intOrNaN(f.stock),
    description: f.description.trim(),
    key_ingredients: f.key_ingredients.split(',').map((x) => x.trim()).filter(Boolean),
    texture: f.texture.trim() || null,
    fragrance_free: f.fragrance_free === '' ? null : f.fragrance_free === 'yes',
    skin_types: f.skin_types,
    concerns: f.concerns,
  }
}

export function SellerProductFormPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  useDocumentTitle(isNew ? 'Thêm sản phẩm' : 'Sửa sản phẩm')
  const { shop, canManageProducts } = useSeller()
  const navigate = useNavigate()

  const [product, setProduct] = useState<SellerProduct | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>(isNew ? 'ready' : 'loading')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) {
      setProduct(null)
      setForm(emptyForm)
      setLoadState('ready')
      return
    }
    let cancelled = false
    setLoadState('loading')
    sellerService
      .getMyProduct(id!)
      .then((p) => {
        if (cancelled) return
        if (!p || p.shop_id !== shop.id) return setLoadState('missing')
        setProduct(p)
        setForm(toForm(p))
        setLoadState('ready')
      })
      .catch(() => !cancelled && setLoadState('missing'))
    return () => {
      cancelled = true
    }
  }, [id, isNew, shop.id])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (nextStatus?: ProductStatus) => {
    const v = validateProduct(form)
    setErrors(v)
    setResult(null)
    if (Object.keys(v).length) {
      setResult({ kind: 'error', text: 'Một số thông tin chưa hợp lệ, hãy kiểm tra các ô được đánh dấu.' })
      return
    }
    setSaving(true)
    try {
      const input = toInput(form)
      if (isNew) {
        const created = await sellerService.createProduct(shop.id, input)
        navigate(`/seller/products/${created.id}?created=1`, { replace: true })
        return
      }
      const updated = await sellerService.updateProduct(product!.id, { ...input, ...(nextStatus ? { status: nextStatus } : {}) })
      setProduct(updated)
      setForm(toForm(updated))
      setResult({ kind: 'success', text: nextStatus === 'active' ? 'Đã lưu và đăng bán sản phẩm.' : 'Đã lưu thay đổi.' })
      void catalogService.refresh().catch(() => undefined)
    } catch (err) {
      setResult({ kind: 'error', text: friendlyError(err, 'Lưu không thành công.') })
    } finally {
      setSaving(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void save()
  }

  const justCreated = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('created') === '1'

  // Vừa chuyển từ /new sang /:id (cùng một component): chờ effect tải sản phẩm, tránh render với product = null
  const stale = !isNew && loadState !== 'missing' && product?.id !== id
  if (loadState === 'loading' || stale) {
    return (
      <div className="container-page py-6">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (loadState === 'missing') {
    return (
      <div className="container-page py-10">
        <Alert kind="error">Không tìm thấy sản phẩm này trong cửa hàng của bạn.</Alert>
        <Link to="/seller/products" className={`${button('secondary', 'sm')} mt-4`}>
          Về danh sách sản phẩm
        </Link>
      </div>
    )
  }

  const readOnly = !canManageProducts
  const imageCount = product?.product_images.length ?? 0
  const canPublish = !isNew && product?.status !== 'active' && (imageCount > 0 || !!product?.placeholder_visual)

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'Sản phẩm', to: '/seller/products' }, { label: isNew ? 'Thêm sản phẩm' : product!.name }]} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'Thêm sản phẩm' : 'Sửa sản phẩm'}</h1>
        {product && <ProductStatusBadge status={product.status} />}
      </div>

      {product?.admin_hidden && (
        <div className="mt-4">
          <Alert kind="error">
            Sản phẩm đang bị quản trị viên ẩn khỏi website{product.admin_hidden_reason ? `: ${product.admin_hidden_reason}` : '.'} Hãy sửa theo yêu cầu rồi liên hệ quản trị viên để
            được xem xét hiển thị lại.
          </Alert>
        </div>
      )}

      {justCreated && !result && (
        <div className="mt-4">
          <Alert kind="success">Đã lưu bản nháp. Thêm ít nhất 1 ảnh rồi bấm "Lưu và đăng bán".</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form className="space-y-6" onSubmit={submit} noValidate>
          <fieldset disabled={readOnly || saving} className="space-y-6">
            <Section title="Thông tin cơ bản">
              <TextField label="Tên sản phẩm" value={form.name} maxLength={150} onChange={(e) => set('name', e.target.value)} error={errors.name} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Thương hiệu" value={form.brand_name} maxLength={80} onChange={(e) => set('brand_name', e.target.value)} error={errors.brand_name} />
                <TextField label="Dung tích / quy cách" placeholder="Ví dụ: 50 ml" value={form.size} maxLength={40} onChange={(e) => set('size', e.target.value)} error={errors.size} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Danh mục"
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v as CategoryId, product_type: typesByCategory[v as CategoryId][0] }))}
                  options={categories.map((c) => ({ value: c.id, label: `${c.name} · ${c.label}` }))}
                />
                <SelectField
                  label="Loại sản phẩm"
                  value={form.product_type}
                  onChange={(v) => set('product_type', v as ProductType)}
                  options={typesByCategory[form.category].map((t) => ({ value: t, label: productTypeLabels[t] }))}
                  error={errors.product_type}
                />
                <TextField label="SKU (không bắt buộc)" value={form.sku} maxLength={60} onChange={(e) => set('sku', e.target.value)} error={errors.sku} />
              </div>
            </Section>

            <Section title="Giá và tồn kho">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Giá gốc (đồng)" inputMode="numeric" value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
                <TextField
                  label="Giá khuyến mãi (đồng)"
                  inputMode="numeric"
                  value={form.sale_price}
                  onChange={(e) => set('sale_price', e.target.value)}
                  error={errors.sale_price}
                  hint="Bỏ trống nếu không giảm giá."
                />
                <TextField label="Tồn kho" inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value)} error={errors.stock} />
              </div>
            </Section>

            <Section title="Mô tả và thành phần">
              <TextAreaField
                label="Mô tả chi tiết"
                value={form.description}
                onChange={(v) => set('description', v)}
                rows={5}
                maxLength={5000}
                counter
                error={errors.description}
                placeholder="Công dụng, cách dùng, lưu ý. Không ghi cam kết điều trị bệnh."
              />
              <TextField
                label="Thành phần chính"
                value={form.key_ingredients}
                onChange={(e) => set('key_ingredients', e.target.value)}
                error={errors.key_ingredients}
                hint="Cách nhau bằng dấu phẩy, tối đa 10. Ví dụ: Niacinamide 10%, Kẽm PCA"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Kết cấu" placeholder="Ví dụ: Gel mỏng nhẹ" value={form.texture} maxLength={60} onChange={(e) => set('texture', e.target.value)} error={errors.texture} />
                <SelectField
                  label="Hương liệu"
                  value={form.fragrance_free}
                  onChange={(v) => set('fragrance_free', v as FormState['fragrance_free'])}
                  options={[
                    { value: '', label: 'Không ghi' },
                    { value: 'yes', label: 'Không hương liệu' },
                    { value: 'no', label: 'Có hương liệu' },
                  ]}
                />
              </div>
            </Section>

            <Section title="Phù hợp với" hint="Dùng cho bộ lọc và Beauty Finder. Bỏ trống nếu sản phẩm không phụ thuộc loại da (son, dụng cụ...).">
              <CheckGroup
                legend="Loại da"
                options={(Object.keys(skinTypeLabels) as SkinType[]).map((s) => ({ value: s, label: skinTypeLabels[s] }))}
                values={form.skin_types}
                onChange={(v) => set('skin_types', v as SkinType[])}
              />
              <CheckGroup
                legend="Nhu cầu"
                options={(Object.keys(concernLabels) as SkinConcern[]).map((c) => ({ value: c, label: concernLabels[c] }))}
                values={form.concerns}
                onChange={(v) => set('concerns', v as SkinConcern[])}
              />
            </Section>

            {result && <Alert kind={result.kind}>{result.text}</Alert>}

            {!readOnly && (
              <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:bg-surface">
                <button type="submit" className={button(isNew || product?.status === 'active' ? 'primary' : 'secondary')}>
                  {saving ? 'Đang lưu...' : isNew ? 'Lưu bản nháp' : 'Lưu thay đổi'}
                </button>
                {!isNew && product?.status !== 'active' && (
                  <button
                    type="button"
                    className={button('primary')}
                    disabled={!canPublish}
                    title={canPublish ? undefined : 'Thêm ít nhất 1 ảnh trước khi đăng bán'}
                    onClick={() => void save('active')}
                  >
                    Lưu và đăng bán
                  </button>
                )}
                {!isNew && product?.status !== 'active' && !canPublish && <span className="text-sm text-muted">Cần ít nhất 1 ảnh để đăng bán.</span>}
                {product?.status === 'active' && shop.status === 'active' && (
                  <Link to={`/products/${product.slug}`} className="text-sm font-medium text-primary hover:underline">
                    Xem trang sản phẩm
                  </Link>
                )}
              </div>
            )}
          </fieldset>
        </form>

        <aside className="space-y-6 lg:sticky lg:top-36 lg:self-start">
          {product ? (
            <ImageManager product={product} disabled={readOnly} onChange={(p) => setProduct(p)} />
          ) : (
            <section className="rounded-card border border-dashed border-border bg-surface p-5 text-sm text-muted">
              <h2 className="font-semibold text-text">Ảnh sản phẩm</h2>
              <p className="mt-1">Lưu bản nháp trước, sau đó tải ảnh lên (tối đa {MAX_PRODUCT_IMAGES} ảnh).</p>
            </section>
          )}
          <PreviewCard form={form} product={product} />
        </aside>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function SelectField({ label, value, onChange, options, error }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 h-11 w-full rounded-xl border bg-surface px-3 ${error ? 'border-danger' : 'border-border'}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  )
}

function CheckGroup({ legend, options, values, onChange }: { legend: string; options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value)
          return (
            <label key={o.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-primary'}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? values.filter((x) => x !== o.value) : [...values, o.value])} />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Ảnh sản phẩm: tải lên, đổi thứ tự (ảnh đầu là ảnh đại diện), xóa */
function ImageManager({ product, disabled, onChange }: { product: SellerProduct; disabled: boolean; onChange: (p: SellerProduct) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const images = product.product_images
  const full = images.length >= MAX_PRODUCT_IMAGES

  const refresh = async () => {
    const p = await sellerService.getMyProduct(product.id)
    if (p) onChange(p)
    void catalogService.refresh().catch(() => undefined)
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const room = MAX_PRODUCT_IMAGES - images.length
    const list = Array.from(files).slice(0, room)
    const invalid = list.map((f) => validateShopImage(f)).find(Boolean)
    if (invalid) return setError(invalid)
    setBusy(true)
    try {
      let order = images.length ? Math.max(...images.map((i) => i.sort_order)) + 1 : 0
      for (const f of list) {
        const path = await uploadShopImage(product.shop_id, 'product', f)
        await sellerService.addImage(product.id, path, order++)
      }
      if (files.length > room) setError(`Chỉ thêm được ${room} ảnh (tối đa ${MAX_PRODUCT_IMAGES}).`)
      await refresh()
    } catch (err) {
      setError(friendlyError(err, 'Tải ảnh lên không thành công.'))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const ids = images.map((i) => i.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    setBusy(true)
    setError(null)
    try {
      await sellerService.reorderImages(ids)
      await refresh()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (imageId: string, path: string) => {
    setBusy(true)
    setError(null)
    try {
      await sellerService.removeImage(imageId, path)
      await refresh()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="images-heading">
      <div className="flex items-center justify-between">
        <h2 id="images-heading" className="font-semibold">
          Ảnh sản phẩm
        </h2>
        <span className="text-xs text-muted">
          {images.length}/{MAX_PRODUCT_IMAGES}
        </span>
      </div>
      {images.length > 0 ? (
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <li key={img.id} className="group relative overflow-hidden rounded-xl border border-border bg-surface-2">
              <img src={shopMediaUrl(img.path)} alt={`Ảnh ${i + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-on-primary">Ảnh đại diện</span>}
              {!disabled && (
                <div className="flex justify-between bg-surface/90 p-1">
                  <button type="button" className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30" disabled={busy || i === 0} onClick={() => void move(i, -1)} aria-label={`Đưa ảnh ${i + 1} lên trước`}>
                    <Icon name="chevronLeft" size={14} />
                  </button>
                  <button type="button" className="grid h-7 w-7 place-items-center rounded-full text-danger hover:bg-surface-2 disabled:opacity-30" disabled={busy} onClick={() => void remove(img.id, img.path)} aria-label={`Xóa ảnh ${i + 1}`}>
                    <Icon name="trash" size={14} />
                  </button>
                  <button type="button" className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30" disabled={busy || i === images.length - 1} onClick={() => void move(i, 1)} aria-label={`Đưa ảnh ${i + 1} ra sau`}>
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">{product.placeholder_visual ? 'Sản phẩm mẫu đang dùng hình minh họa.' : 'Chưa có ảnh. Cần ít nhất 1 ảnh để đăng bán.'}</p>
      )}
      {!disabled && (
        <label className={`${button('secondary', 'sm')} mt-3 w-full cursor-pointer ${full || busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? 'Đang xử lý...' : full ? 'Đã đủ 8 ảnh' : 'Tải ảnh lên'}
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={full || busy} aria-label="Tải ảnh sản phẩm từ máy" onChange={(e) => {
            void upload(e.target.files)
            e.target.value = ''
          }} />
        </label>
      )}
      <p className="mt-2 text-xs text-muted">PNG, JPG hoặc WebP, tối đa 3 MB mỗi ảnh. Nên dùng ảnh vuông, nền sáng.</p>
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </section>
  )
}

/** Xem trước thẻ sản phẩm như khách sẽ thấy, theo dữ liệu đang nhập (chưa cần lưu) */
function PreviewCard({ form, product }: { form: FormState; product: SellerProduct | null }) {
  const price = intOrNaN(form.price)
  const sale = form.sale_price.trim() === '' ? NaN : intOrNaN(form.sale_price)
  const onSale = Number.isFinite(sale) && Number.isFinite(price) && sale < price
  const images = useMemo(() => (product?.product_images ?? []).map((i) => shopMediaUrl(i.path)!).filter(Boolean), [product])
  const stock = intOrNaN(form.stock)
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-labelledby="preview-heading">
      <h2 id="preview-heading" className="font-semibold">
        Xem trước
      </h2>
      <div className="mt-3 overflow-hidden rounded-card border border-border">
        <div className="aspect-square bg-surface-2">
          <ProductImage product={{ name: form.name || 'Sản phẩm', images, visual: product?.placeholder_visual ?? DEFAULT_VISUAL }} />
        </div>
        <div className="space-y-1.5 p-3.5">
          <p className="text-xs font-medium text-primary">{form.brand_name || 'Thương hiệu'}</p>
          <p className="line-clamp-2 text-sm font-medium">{form.name || 'Tên sản phẩm'}</p>
          {Number.isFinite(price) ? (
            <Price price={onSale ? sale : price} originalPrice={onSale ? price : undefined} />
          ) : (
            <p className="text-sm text-muted">Chưa nhập giá</p>
          )}
          <p className="text-xs text-muted">
            {productTypeLabels[form.product_type]}
            {form.size && ` · ${form.size}`}
            {Number.isFinite(stock) && ` · ${stock === 0 ? 'Hết hàng' : `Còn ${stock}`}`}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {product ? `Trạng thái: ${productStatusLabels[product.status]}.` : 'Sản phẩm mới lưu ở trạng thái bản nháp.'} Giá hiển thị:{' '}
        {Number.isFinite(price) ? formatPrice(onSale ? sale : price) : '—'}
      </p>
    </section>
  )
}
