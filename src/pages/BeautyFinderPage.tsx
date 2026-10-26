import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, EmptyState, ErrorState, Price, Skeleton } from '@/components/ui/primitives'
import { concernLabels, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import { relaxSuggestions, scoreProducts, type FinderResult } from '@/features/beauty-finder/engine'
import {
  answersFromParams,
  answersToParams,
  budgetOptions,
  concernOptions,
  defaultAnswers,
  MAX_CONCERNS,
  needOptions,
  skinTypeOptions,
  typeOptions,
  type FinderAnswers,
} from '@/features/beauty-finder/questions'
import { useCart } from '@/features/cart/CartProvider'
import { routineStepOf, sortByRoutine } from '@/features/routine/routine'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { catalogService } from '@/services/catalog'

const STEPS = ['Loại da', 'Mối quan tâm', 'Nhu cầu', 'Ngân sách', 'Loại sản phẩm'] as const

export function BeautyFinderPage() {
  useDocumentTitle('Beauty Finder')
  const [params, setParams] = useSearchParams()
  const submitted = useMemo(() => answersFromParams(params), [params])

  // ?start=oily từ trang chủ: chọn sẵn loại da, vào thẳng câu 2
  const start = params.get('start')
  const startSkin = skinTypeOptions.find((o) => o.value === start)?.value

  const [answers, setAnswers] = useState<FinderAnswers>(() =>
    submitted ?? (startSkin ? { ...defaultAnswers, skinType: startSkin } : defaultAnswers),
  )
  const [step, setStep] = useState(startSkin && !submitted ? 1 : 0)

  const submit = (a: FinderAnswers) => {
    setAnswers(a)
    setParams(answersToParams(a))
  }
  const editAnswers = () => {
    setStep(0)
    setParams({})
  }

  return (
    <div className="container-page py-8 md:py-10">
      <header className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Icon name="sparkle" size={16} /> Beauty Finder
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
          {submitted ? 'Sản phẩm gợi ý cho bạn' : 'Tìm sản phẩm hợp với làn da của bạn'}
        </h1>
        {!submitted && (
          <p className="mt-2 text-muted">5 câu hỏi ngắn. Kết quả lấy từ các sản phẩm đang bán trên sàn, kèm lý do gợi ý.</p>
        )}
      </header>

      {submitted ? (
        <Results answers={submitted} onEdit={editAnswers} onApply={submit} />
      ) : (
        <Wizard answers={answers} setAnswers={setAnswers} step={step} setStep={setStep} onFinish={() => submit(answers)} />
      )}

      <p className="mt-10 max-w-3xl rounded-2xl border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
        <strong className="text-text">Lưu ý:</strong> Beauty Finder chỉ gợi ý sản phẩm dựa trên thông tin cửa hàng cung cấp (loại da phù hợp,
        thành phần, công dụng). Đây không phải chẩn đoán y khoa và không thay thế tư vấn của bác sĩ da liễu. Với các vấn đề như mụn viêm nặng,
        dị ứng hoặc tổn thương da kéo dài, hãy đi khám chuyên khoa.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ WIZARD

interface WizardProps {
  answers: FinderAnswers
  setAnswers: (a: FinderAnswers) => void
  step: number
  setStep: (n: number) => void
  onFinish: () => void
}

function Wizard({ answers, setAnswers, step, setStep, onFinish }: WizardProps) {
  const set = (patch: Partial<FinderAnswers>) => setAnswers({ ...answers, ...patch })
  const isLast = step === STEPS.length - 1

  const toggle = <T,>(list: T[], v: T, max = Infinity) =>
    list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]

  let body: ReactNode
  switch (step) {
    case 0:
      body = (
        <Question title="Da của bạn thuộc loại nào?">
          <OptionGrid>
            {skinTypeOptions.map((o) => (
              <Option key={o.value} selected={answers.skinType === o.value} onSelect={() => set({ skinType: o.value })} hint={o.hint} type="radio">
                {o.label}
              </Option>
            ))}
          </OptionGrid>
        </Question>
      )
      break
    case 1:
      body = (
        <Question title="Bạn quan tâm điều gì nhất?" subtitle={`Chọn tối đa ${MAX_CONCERNS}. Có thể bỏ qua.`}>
          <OptionGrid>
            {concernOptions.map((o) => {
              const selected = answers.concerns.includes(o.value)
              const disabled = !selected && answers.concerns.length >= MAX_CONCERNS
              return (
                <Option
                  key={o.value}
                  selected={selected}
                  disabled={disabled}
                  onSelect={() => set({ concerns: toggle(answers.concerns, o.value, MAX_CONCERNS) })}
                  type="checkbox"
                >
                  {o.label}
                </Option>
              )
            })}
          </OptionGrid>
        </Question>
      )
      break
    case 2:
      body = (
        <Question title="Bạn đang cần gì?">
          <OptionGrid>
            {needOptions.map((o) => (
              <Option key={o.value} selected={answers.need === o.value} onSelect={() => set({ need: o.value })} hint={o.hint} type="radio">
                {o.label}
              </Option>
            ))}
          </OptionGrid>
        </Question>
      )
      break
    case 3:
      body = (
        <Question title="Ngân sách cho mỗi sản phẩm?">
          <OptionGrid>
            {budgetOptions.map((o) => (
              <Option key={o.value} selected={answers.budget === o.value} onSelect={() => set({ budget: o.value })} type="radio">
                {o.label}
              </Option>
            ))}
          </OptionGrid>
        </Question>
      )
      break
    default:
      body = (
        <Question title="Bạn muốn tìm loại sản phẩm nào?" subtitle="Có thể chọn nhiều. Không chọn = gợi ý mọi loại phù hợp.">
          <OptionGrid>
            {typeOptions.map((o) => (
              <Option key={o.value} selected={answers.types.includes(o.value)} onSelect={() => set({ types: toggle(answers.types, o.value) })} type="checkbox">
                {o.label}
              </Option>
            ))}
          </OptionGrid>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={answers.fragranceFree}
              onChange={(e) => set({ fragranceFree: e.target.checked })}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-medium">Ưu tiên sản phẩm không hương liệu</span>
              <span className="text-sm text-muted">Phù hợp nếu da bạn dễ kích ứng với mùi hương.</span>
            </span>
          </label>
        </Question>
      )
  }

  return (
    <div className="mt-8 max-w-3xl">
      {/* Thanh tiến trình */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          Câu {step + 1}/{STEPS.length}: {STEPS[step]}
        </span>
        <span className="text-muted">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Tiến trình">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="mt-7">{body}</div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" className={button('ghost')} onClick={() => setStep(step - 1)} disabled={step === 0}>
          <Icon name="chevronLeft" size={18} /> Quay lại
        </button>
        {isLast ? (
          <button type="button" className={button('primary', 'lg')} onClick={onFinish}>
            <Icon name="sparkle" size={18} /> Xem gợi ý
          </button>
        ) : (
          <button type="button" className={button('primary', 'lg')} onClick={() => setStep(step + 1)}>
            {step === 1 && answers.concerns.length === 0 ? 'Bỏ qua' : 'Tiếp tục'} <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

function Question({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xl font-bold md:text-2xl">{title}</legend>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </fieldset>
  )
}

function OptionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function Option({
  selected,
  onSelect,
  hint,
  disabled,
  type,
  children,
}: {
  selected: boolean
  onSelect: () => void
  hint?: string
  disabled?: boolean
  type: 'radio' | 'checkbox'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-45 ${
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border-2 ${type === 'radio' ? 'rounded-full' : 'rounded-md'} ${
          selected ? 'border-primary bg-primary text-on-primary' : 'border-border'
        }`}
      >
        {selected && (type === 'radio' ? <span className="h-2 w-2 rounded-full bg-on-primary" /> : <Icon name="check" size={13} strokeWidth={3} />)}
      </span>
      <span>
        <span className="block font-semibold">{children}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
    </button>
  )
}

// ------------------------------------------------------------------ RESULTS

const RESULT_LIMIT = 12

function Results({ answers, onEdit, onApply }: { answers: FinderAnswers; onEdit: () => void; onApply: (a: FinderAnswers) => void }) {
  const products = useAsync(() => catalogService.getAllActiveProducts(), [])
  const [order, setOrder] = useState<'match' | 'routine'>('match')

  const results = useMemo(
    () => (products.status === 'success' ? scoreProducts(products.data, answers).slice(0, RESULT_LIMIT) : []),
    [products, answers],
  )
  const shown = order === 'routine' ? sortByRoutine(results.map((r) => ({ ...r, type: r.product.type }))) : results

  const summary = [
    answers.skinType === 'unsure' ? 'Chưa rõ loại da' : skinTypeLabels[answers.skinType],
    ...answers.concerns.map((c) => concernLabels[c]),
    needOptions.find((n) => n.value === answers.need)?.label,
    budgetOptions.find((b) => b.value === answers.budget)?.label,
    ...answers.types.map((t) => productTypeLabels[t]),
    answers.fragranceFree ? 'Không hương liệu' : null,
  ].filter(Boolean) as string[]

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
        <ul className="flex flex-wrap gap-2" aria-label="Câu trả lời của bạn">
          {summary.map((s) => (
            <li key={s} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
              {s}
            </li>
          ))}
        </ul>
        <button type="button" className={button('secondary', 'sm')} onClick={onEdit}>
          Làm lại từ đầu
        </button>
      </div>

      {products.status === 'loading' && (
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}
      {products.status === 'error' && <div className="mt-6"><ErrorState /></div>}

      {products.status === 'success' && results.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Chưa có sản phẩm khớp tất cả điều kiện"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {relaxSuggestions(answers).map((s) => (
                  <button key={s.label} type="button" className={button('secondary', 'sm')} onClick={() => onApply(s.answers)}>
                    {s.label}
                  </button>
                ))}
                <button type="button" className={button('primary', 'sm')} onClick={onEdit}>
                  Sửa câu trả lời
                </button>
              </div>
            }
          >
            Thử nới bớt một điều kiện bên dưới.
          </EmptyState>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {results.length} sản phẩm phù hợp nhất, sắp theo {order === 'match' ? 'mức độ phù hợp' : 'thứ tự các bước chăm sóc da'}.
            </p>
            <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm" role="group" aria-label="Thứ tự hiển thị">
              {(['match', 'routine'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={order === o}
                  onClick={() => setOrder(o)}
                  className={`rounded-full px-3 py-1.5 ${order === o ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}
                >
                  {o === 'match' ? 'Phù hợp nhất' : 'Theo chu trình'}
                </button>
              ))}
            </div>
          </div>
          <ol className="mt-4 grid gap-4 lg:grid-cols-2">
            {shown.map((r) => (
              <li key={r.product.id}>
                <ResultCard result={r} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: FinderResult }) {
  const { product, match, reasons, cautions } = result
  const { add, quantityOf } = useCart()
  const [added, setAdded] = useState(false)
  const step = routineStepOf(product.type)
  const atLimit = quantityOf(product.id) >= product.stock

  return (
    <article className="relative flex h-full gap-4 rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2 sm:h-32 sm:w-32">
        <ProductImage product={product} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-primary">
            {product.brandName}
            {step && <span className="text-muted"> · Bước {step.order}: {step.label}</span>}
          </p>
          <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary" title="Mức độ phù hợp với câu trả lời">
            {match}% phù hợp
          </span>
        </div>
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">
          <Link to={`/products/${product.slug}`} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div className="mt-1.5">
          <Price price={product.price} originalPrice={product.originalPrice} />
        </div>

        <ul className="mt-3 space-y-1 text-sm" aria-label="Lý do gợi ý">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <Icon name="sparkle" size={14} className="mt-1 shrink-0 text-primary" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {cautions.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted" aria-label="Lưu ý">
            {cautions.map((c) => (
              <li key={c} className="flex gap-2">
                <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <button
            type="button"
            className={button('primary', 'sm')}
            disabled={atLimit}
            onClick={() => {
              add(product.id)
              setAdded(true)
              window.setTimeout(() => setAdded(false), 1500)
            }}
          >
            <Icon name="cart" size={16} /> {added ? 'Đã thêm' : 'Thêm vào giỏ'}
          </button>
          <Link to={`/products/${product.slug}`} className={button('ghost', 'sm')}>
            Chi tiết
          </Link>
        </div>
      </div>
    </article>
  )
}
