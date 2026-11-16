import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductImage } from '@/components/ui/ProductImage'
import { button, EmptyState, ErrorState, Price, Skeleton } from '@/components/ui/primitives'
import { concernLabels, productTypeLabels, skinTypeLabels } from '@/data/taxonomy'
import { ingredientHints, relaxSuggestions, routineBundle, scoreProducts, starterSet, type FinderResult } from '@/features/beauty-finder/engine'
import { saveFinderSkin } from '@/features/skincare-3d/finderBridge'
import {
  answersFromParams,
  answersToParams,
  audienceOptions,
  avoidOptions,
  bodyOptions,
  budgetOptions,
  concernOptions,
  finishOptions,
  focusOptions,
  giftStyleOptions,
  ingredientOptions,
  lifestyleOptions,
  MAX_INGREDIENTS,
  modeOptions,
  setBudgetOptions,
  hairOptions,
  intensityOptions,
  makeupTypeOptions,
  MAX_CONCERNS,
  MAX_SCENTS,
  needOptions,
  occasionOptions,
  presetFromParams,
  scentOptions,
  skinTypeOptions,
  stepLabels,
  stepsFor,
  textureOptions,
  type Choice,
  type FinderAnswers,
  type StepKey,
} from '@/features/beauty-finder/questions'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCart } from '@/features/cart/CartProvider'
import { routineStepOf } from '@/features/routine/routine'
import { friendlyError } from '@/lib/errors'
import { formatDate, formatPrice } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { beautyProfileService, type SavedBeautyProfile } from '@/services/beautyProfile'
import { catalogService } from '@/services/catalog'

export function BeautyFinderPage() {
  useDocumentTitle('Beauty Finder')
  const [params, setParams] = useSearchParams()
  const submitted = useMemo(() => answersFromParams(params), [params])
  const preset = useMemo(() => presetFromParams(params), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<FinderAnswers>(() => submitted ?? preset.answers)
  const [step, setStep] = useState(submitted ? 0 : preset.step)

  const submit = (a: FinderAnswers) => {
    setAnswers(a)
    setParams(answersToParams(a))
    window.scrollTo({ top: 0 })
  }
  const editAnswers = () => {
    setStep(0)
    setParams({})
  }

  return (
    <div className="container-page py-8 md:py-10">
      <header className="max-w-2xl">
        <p className="eyebrow inline-flex items-center gap-1.5">
          <Icon name="sparkle" size={14} /> Beauty Finder
        </p>
        <h1 className="mt-3 text-4xl md:text-5xl">
          {submitted ? (submitted.mode === 'gift' ? 'Gợi ý quà tặng' : 'Sản phẩm gợi ý cho bạn') : answers.mode === 'gift' ? 'Tìm quà làm đẹp' : 'Tìm sản phẩm hợp với bạn'}
        </h1>
        {!submitted && (
          <p className="mt-3 text-muted">
            Vài câu hỏi ngắn cho cả nam và nữ: da mặt, trang điểm, tóc, cơ thể hoặc nước hoa. Câu hỏi đổi theo lựa chọn của bạn; kết quả lấy từ sản phẩm đang bán, kèm lý do gợi ý.
          </p>
        )}
      </header>

      {submitted ? (
        <Results answers={submitted} onEdit={editAnswers} onApply={submit} />
      ) : (
        <>
          <SavedProfileBanner onUse={submit} />
          <ModePicker
            mode={answers.mode}
            onChange={(mode) => {
              setAnswers({ ...answers, mode })
              setStep(0)
            }}
          />
          <Wizard answers={answers} setAnswers={setAnswers} step={step} setStep={setStep} onFinish={() => submit(answers)} />
        </>
      )}

      <p className="mt-10 max-w-3xl rounded-2xl border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
        <strong className="text-text">Lưu ý:</strong> Beauty Finder chỉ gợi ý sản phẩm dựa trên thông tin cửa hàng cung cấp (loại da phù hợp, thành phần, công dụng,
        nốt hương). Loại da do bạn tự chọn; đây không phải chẩn đoán y khoa và không thay thế tư vấn của bác sĩ da liễu. Với các vấn đề như mụn viêm nặng, dị ứng
        hoặc tổn thương da kéo dài, hãy đi khám chuyên khoa.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ CHẾ ĐỘ TÌM + HỒ SƠ ĐÃ LƯU

/** Chọn cách tìm: mỗi kiểu khách một hành trình (nhanh, tiêu chuẩn, chuyên sâu, mua quà) */
function ModePicker({ mode, onChange }: { mode: FinderAnswers['mode']; onChange: (m: FinderAnswers['mode']) => void }) {
  return (
    <div className="mt-6 max-w-3xl" role="radiogroup" aria-label="Cách tìm">
      <p className="text-sm font-semibold">Cách tìm</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {modeOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            onClick={() => mode !== o.value && onChange(o.value)}
            className={`rounded-2xl border px-3 py-2.5 text-left transition-colors motion-reduce:transition-none ${
              mode === o.value ? 'border-ink bg-ink text-on-ink' : 'border-border bg-surface hover:border-primary'
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {o.value === 'gift' && <Icon name="gift" size={15} />}
              {o.label}
            </span>
            <span className={`mt-0.5 block text-xs leading-snug ${mode === o.value ? 'opacity-80' : 'text-muted'}`}>{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Hồ sơ làm đẹp đã lưu trong tài khoản: dùng lại ngay, không phải trả lời lại */
function SavedProfileBanner({ onUse }: { onUse: (a: FinderAnswers) => void }) {
  const { status, user } = useAuth()
  const [saved, setSaved] = useState<SavedBeautyProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (status !== 'signed-in' || !isSupabaseConfigured) return
    beautyProfileService
      .get()
      .then(setSaved)
      .catch(() => undefined)
  }, [status])
  if (!saved) return null
  const remove = async () => {
    if (!user) return
    try {
      await beautyProfileService.remove(user.id)
      setSaved(null)
    } catch (err) {
      setError(friendlyError(err))
    }
  }
  return (
    <section className="mt-6 max-w-3xl rounded-card border border-primary/30 bg-primary-soft p-4" aria-labelledby="saved-profile-heading">
      <h2 id="saved-profile-heading" className="font-semibold">
        Hồ sơ làm đẹp của bạn
      </h2>
      <p className="mt-0.5 text-xs text-muted">Lưu ngày {formatDate(saved.updatedAt)} · dùng được trên mọi thiết bị khi đăng nhập</p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Câu trả lời đã lưu">
        {summaryOf(saved.answers).map((x) => (
          <li key={x} className="rounded-full bg-surface px-2.5 py-1 text-xs">
            {x}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={button('dark', 'sm')} onClick={() => onUse(saved.answers)}>
          <Icon name="sparkle" size={15} /> Xem gợi ý theo hồ sơ
        </button>
        <button type="button" className={button('ghost', 'sm')} onClick={() => void remove()}>
          Xóa hồ sơ
        </button>
      </div>
    </section>
  )
}

/** Lưu câu trả lời hiện tại vào hồ sơ làm đẹp của tài khoản */
function SaveProfileButton({ answers }: { answers: FinderAnswers }) {
  const { status } = useAuth()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  if (!isSupabaseConfigured || answers.mode === 'gift') return null
  if (status !== 'signed-in')
    return (
      <Link to="/login?next=%2Fbeauty-finder" className={button('ghost', 'sm')}>
        Đăng nhập để lưu hồ sơ
      </Link>
    )
  const save = async () => {
    setState('saving')
    setError(null)
    try {
      await beautyProfileService.save(answers)
      setState('saved')
    } catch (err) {
      setError(friendlyError(err))
      setState('error')
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={button('secondary', 'sm')} onClick={() => void save()} disabled={state === 'saving' || state === 'saved'}>
        {state === 'saved' ? (
          <>
            <Icon name="check" size={15} /> Đã lưu vào hồ sơ
          </>
        ) : state === 'saving' ? (
          'Đang lưu...'
        ) : (
          'Lưu vào hồ sơ làm đẹp'
        )}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
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

const toggle = <T,>(list: T[], v: T, max = Infinity) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v])

function Wizard({ answers, setAnswers, step, setStep, onFinish }: WizardProps) {
  const steps = stepsFor(answers.focus, answers.mode)
  const current: StepKey = steps[Math.min(step, steps.length - 1)]
  const isLast = step >= steps.length - 1
  const set = (patch: Partial<FinderAnswers>) => setAnswers({ ...answers, ...patch })
  const advance = useRef<number>(0)
  const headingRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => window.clearTimeout(advance.current), [])
  const mounted = useRef(false)
  useEffect(() => {
    // Chuyển câu: đưa con trỏ bàn phím / trình đọc màn hình tới câu hỏi mới (không làm ở lần mở trang đầu tiên)
    if (mounted.current) headingRef.current?.querySelector('legend')?.focus({ preventScroll: false })
    mounted.current = true
  }, [step])

  const next = () => (isLast ? onFinish() : setStep(step + 1))
  /** Câu chọn 1 đáp án: chọn xong tự sang câu tiếp (người dùng không phải bấm thêm) */
  const pickAndGo = (patch: Partial<FinderAnswers>) => {
    const nextAnswers = { ...answers, ...patch }
    setAnswers(nextAnswers)
    window.clearTimeout(advance.current)
    advance.current = window.setTimeout(() => {
      const last = step >= stepsFor(nextAnswers.focus, nextAnswers.mode).length - 1
      if (last) return
      setStep(step + 1)
    }, 260)
  }

  const single = <T extends string>(opts: Choice<T>[], value: T, field: keyof FinderAnswers) => (
    <OptionGrid>
      {opts.map((o) => (
        <Option key={o.value} selected={value === o.value} onSelect={() => pickAndGo({ [field]: o.value } as Partial<FinderAnswers>)} hint={o.hint} type="radio">
          {o.label}
        </Option>
      ))}
    </OptionGrid>
  )
  const multi = <T extends string>(opts: Choice<T>[], value: T[], field: keyof FinderAnswers, max = Infinity) => (
    <OptionGrid>
      {opts.map((o) => {
        const selected = value.includes(o.value)
        return (
          <Option
            key={o.value}
            selected={selected}
            disabled={!selected && value.length >= max}
            onSelect={() => set({ [field]: toggle(value, o.value, max) } as Partial<FinderAnswers>)}
            hint={o.hint}
            type="checkbox"
          >
            {o.label}
          </Option>
        )
      })}
    </OptionGrid>
  )

  let body: ReactNode
  let optional = false
  let selectedCount = 0
  switch (current) {
    case 'audience':
      body = (
        <Question title={answers.mode === 'gift' ? 'Bạn tặng quà cho ai?' : 'Bạn đang tìm sản phẩm cho ai?'}>{single(audienceOptions, answers.audience, 'audience')}</Question>
      )
      break
    case 'focus':
      body = (
        <Question
          title={answers.mode === 'gift' ? 'Người nhận thích nhóm nào?' : 'Bạn muốn tìm nhóm sản phẩm nào?'}
          subtitle={answers.mode === 'gift' ? 'Chưa chắc thì chọn Nước hoa hoặc Chăm sóc cơ thể: dễ tặng, ít phụ thuộc làn da.' : 'Câu hỏi tiếp theo sẽ đổi theo nhóm bạn chọn.'}
        >
          <OptionGrid>
            {focusOptions.map((o) => (
              <Option
                key={o.value}
                selected={answers.focus === o.value}
                onSelect={() => pickAndGo({ focus: o.value, types: [] })}
                hint={o.hint}
                type="radio"
              >
                {o.label}
              </Option>
            ))}
          </OptionGrid>
        </Question>
      )
      break
    case 'skin':
      body = (
        <Question title="Da của bạn thuộc loại nào?" subtitle="Bạn tự chọn theo cảm nhận; chưa chắc thì chọn “Mình chưa rõ”.">
          {single(skinTypeOptions, answers.skinType, 'skinType')}
        </Question>
      )
      break
    case 'concerns':
      optional = true
      selectedCount = answers.concerns.length
      body = (
        <Question title="Bạn quan tâm điều gì nhất?" subtitle={`Chọn tối đa ${MAX_CONCERNS}. Có thể bỏ qua.`}>
          {multi(concernOptions, answers.concerns, 'concerns', MAX_CONCERNS)}
        </Question>
      )
      break
    case 'prefs':
      optional = true
      selectedCount = answers.avoid.length + (answers.texture !== 'any' ? 1 : 0)
      body = (
        <Question title="Bạn muốn tránh gì, thích kết cấu nào?" subtitle="Có thể bỏ qua. Sản phẩm có hoạt chất mạnh sẽ bị loại nếu bạn chọn tránh.">
          <p className="mb-2 text-sm font-semibold">Muốn tránh</p>
          {multi(avoidOptions, answers.avoid, 'avoid')}
          <p className="mb-2 mt-6 text-sm font-semibold">Kết cấu ưa thích</p>
          <OptionGrid>
            {textureOptions.map((o) => (
              <Option key={o.value} selected={answers.texture === o.value} onSelect={() => set({ texture: o.value })} hint={o.hint} type="radio">
                {o.label}
              </Option>
            ))}
          </OptionGrid>
        </Question>
      )
      break
    case 'need':
      body = <Question title="Bạn muốn chăm sóc da mấy bước?">{single(needOptions, answers.need, 'need')}</Question>
      break
    case 'finish':
      body = <Question title="Bạn thích lớp trang điểm thế nào?">{single(finishOptions, answers.finish, 'finish')}</Question>
      break
    case 'makeupTypes':
      optional = true
      selectedCount = answers.types.length
      body = (
        <Question title="Bạn đang tìm sản phẩm nào?" subtitle="Có thể chọn nhiều. Không chọn = gợi ý mọi loại trang điểm.">
          {multi(makeupTypeOptions, answers.types, 'types')}
        </Question>
      )
      break
    case 'hair':
      optional = true
      selectedCount = answers.hair.length
      body = (
        <Question title="Tóc và da đầu của bạn đang thế nào?" subtitle="Chọn những ý đúng với bạn. Có thể bỏ qua.">
          {multi(hairOptions, answers.hair, 'hair')}
        </Question>
      )
      break
    case 'body':
      optional = true
      selectedCount = answers.body.length
      body = (
        <Question title="Bạn cần gì cho cơ thể?" subtitle="Có thể chọn nhiều.">
          {multi(bodyOptions, answers.body, 'body')}
        </Question>
      )
      break
    case 'avoid':
      optional = true
      selectedCount = answers.avoid.length
      body = (
        <Question title="Bạn muốn tránh gì?" subtitle="Có thể bỏ qua.">
          {multi(avoidOptions, answers.avoid, 'avoid')}
        </Question>
      )
      break
    case 'scents':
      optional = true
      selectedCount = answers.scents.length
      body = (
        <Question title="Bạn thích nhóm hương nào?" subtitle={`Chọn tối đa ${MAX_SCENTS}. Chưa biết thì bỏ qua, hệ thống gợi ý nhiều nhóm.`}>
          {multi(scentOptions, answers.scents, 'scents', MAX_SCENTS)}
        </Question>
      )
      break
    case 'occasion':
      body = <Question title="Bạn dùng vào dịp nào nhiều nhất?">{single(occasionOptions, answers.occasion, 'occasion')}</Question>
      break
    case 'intensity':
      body = <Question title="Bạn thích mùi đậm hay nhẹ?">{single(intensityOptions, answers.intensity, 'intensity')}</Question>
      break
    case 'ingredients':
      optional = true
      selectedCount = answers.ingredients.length
      body = (
        <Question title="Bạn muốn sản phẩm có thành phần nào?" subtitle={`Chọn tối đa ${MAX_INGREDIENTS}. Sản phẩm có thành phần bạn chọn được cộng điểm. Có thể bỏ qua.`}>
          {multi(ingredientOptions, answers.ingredients, 'ingredients', MAX_INGREDIENTS)}
        </Question>
      )
      break
    case 'lifestyle':
      optional = true
      selectedCount = answers.lifestyle.length
      body = (
        <Question title="Thói quen hằng ngày của bạn?" subtitle="Chọn những ý đúng với bạn để gợi ý sát hơn. Có thể bỏ qua.">
          {multi(lifestyleOptions, answers.lifestyle, 'lifestyle')}
        </Question>
      )
      break
    case 'setBudget':
      body = (
        <Question title="Tổng ngân sách cho cả bộ chu trình?" subtitle="Hệ thống chọn mỗi bước một sản phẩm sao cho tổng tiền nằm trong ngân sách.">
          <OptionGrid>
            {setBudgetOptions.map((o) => (
              <Option key={o.value} selected={answers.setBudget === o.value} onSelect={() => set({ setBudget: o.value })} type="radio">
                {o.label}
              </Option>
            ))}
          </OptionGrid>
        </Question>
      )
      break
    case 'giftStyle':
      body = <Question title="Bạn muốn món quà thế nào?">{single(giftStyleOptions, answers.giftStyle, 'giftStyle')}</Question>
      break
    case 'budget':
      body = (
        <Question title={answers.mode === 'gift' ? 'Ngân sách cho món quà?' : 'Ngân sách cho mỗi sản phẩm?'}>
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
  }

  const pct = Math.round(((step + 1) / steps.length) * 100)

  return (
    <div className="mt-8 max-w-3xl">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          Câu {step + 1}/{steps.length}: {stepLabels[current]}
        </span>
        <span className="text-muted">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label="Tiến trình">
        <div className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-7" ref={headingRef}>
        {body}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" className={button('ghost')} onClick={() => setStep(step - 1)} disabled={step === 0}>
          <Icon name="chevronLeft" size={18} /> Quay lại
        </button>
        {isLast ? (
          <button type="button" className={button('dark', 'lg')} onClick={onFinish}>
            <Icon name="sparkle" size={18} /> Xem gợi ý
          </button>
        ) : (
          <button type="button" className={button('dark', 'lg')} onClick={next}>
            {optional && selectedCount === 0 ? 'Bỏ qua' : 'Tiếp tục'} <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

function Question({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend tabIndex={-1} className="font-display text-3xl font-semibold leading-tight outline-none md:text-4xl">
        {title}
      </legend>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
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
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none ${
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

function summaryOf(a: FinderAnswers): string[] {
  const lab = <T extends string>(opts: Choice<T>[], v: T) => opts.find((o) => o.value === v)?.label
  return [
    a.mode !== 'standard' ? `Cách tìm: ${lab(modeOptions, a.mode)?.toLowerCase()}` : null,
    lab(audienceOptions, a.audience),
    lab(focusOptions, a.focus),
    a.focus === 'fragrance' || a.focus === 'haircare' || a.mode === 'gift' ? null : a.skinType === 'unsure' ? 'Chưa rõ loại da' : skinTypeLabels[a.skinType],
    ...a.concerns.map((c) => concernLabels[c]),
    a.focus === 'skincare' ? lab(needOptions, a.need) : null,
    ...a.avoid.map((x) => `Tránh ${lab(avoidOptions, x)?.toLowerCase()}`),
    a.texture !== 'any' ? `Kết cấu ${lab(textureOptions, a.texture)?.toLowerCase()}` : null,
    a.finish !== 'any' ? `Lớp nền ${lab(finishOptions, a.finish)?.toLowerCase()}` : null,
    ...a.hair.map((h) => lab(hairOptions, h)),
    ...a.body.map((b) => lab(bodyOptions, b)),
    ...a.scents.map((s) => `Hương ${lab(scentOptions, s)?.toLowerCase()}`),
    a.occasion !== 'any' ? lab(occasionOptions, a.occasion) : null,
    a.intensity !== 'any' ? `Mùi ${lab(intensityOptions, a.intensity)?.toLowerCase()}` : null,
    lab(budgetOptions, a.budget),
    ...a.types.map((t) => productTypeLabels[t]),
    ...a.ingredients.map((i) => `Có ${lab(ingredientOptions, i)}`),
    ...a.lifestyle.map((l) => lab(lifestyleOptions, l)),
    a.setBudget !== 'any' ? `Cả bộ ${lab(setBudgetOptions, a.setBudget)?.toLowerCase()}` : null,
    a.giftStyle !== 'any' ? `Quà ${lab(giftStyleOptions, a.giftStyle)?.toLowerCase()}` : null,
  ].filter(Boolean) as string[]
}

/** Phân tích ngắn dựa trên câu trả lời (thông tin tham khảo khi đọc bảng thành phần) */
function Insights({ answers }: { answers: FinderAnswers }) {
  const items: { title: string; text: string }[] = []
  if (answers.focus === 'skincare') {
    for (const c of answers.concerns) items.push({ title: concernLabels[c], text: `Thành phần thường thấy trong sản phẩm hướng tới mối quan tâm này: ${ingredientHints[c]}.` })
    if (answers.skinType === 'sensitive' || answers.avoid.includes('strong-actives'))
      items.push({ title: 'Da nhạy cảm', text: 'Ưu tiên sản phẩm không hương liệu, ít thành phần; thử sản phẩm mới trên vùng da nhỏ trước khi dùng toàn mặt.' })
    if (answers.concerns.includes('dark-spots') || answers.concerns.includes('dullness'))
      items.push({ title: 'Ban ngày', text: 'Sản phẩm làm sáng da nên đi kèm kem chống nắng mỗi sáng.' })
  }
  if (answers.focus === 'fragrance') {
    items.push({ title: 'Thử mùi', text: 'Xịt lên cổ tay, chờ 15–30 phút để ngửi tầng hương giữa và cuối; mùi trên da mỗi người có thể khác nhau.' })
    if (answers.intensity === 'strong') items.push({ title: 'Mùi đậm', text: 'Chỉ cần 1–2 lần xịt; ở văn phòng hoặc nơi đông người nên dùng nhẹ tay hơn.' })
  }
  if (answers.focus === 'haircare' && answers.hair.includes('dry-damaged')) items.push({ title: 'Tóc khô xơ', text: 'Dầu xả, kem ủ và dầu dưỡng tập trung ở phần ngọn tóc, tránh chân tóc để không bết.' })
  if (answers.audience === 'male' && answers.focus === 'skincare') items.push({ title: 'Cho nam', text: 'Kết quả ưu tiên sản phẩm nam và sản phẩm dùng chung; bao gồm cả đồ cạo râu, chăm sóc râu khi bạn chọn nhiều bước.' })
  if (!items.length) return null
  return (
    <section className="mt-6 rounded-card border border-border bg-primary-soft p-5" aria-labelledby="insight-heading">
      <h2 id="insight-heading" className="flex items-center gap-2 font-semibold">
        <Icon name="leaf" size={18} className="text-primary" /> Gợi ý khi chọn sản phẩm
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.slice(0, 4).map((it) => (
          <li key={it.title} className="text-sm">
            <span className="font-semibold">{it.title}: </span>
            <span className="text-muted">{it.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Results({ answers, onEdit, onApply }: { answers: FinderAnswers; onEdit: () => void; onApply: (a: FinderAnswers) => void }) {
  const products = useAsync(() => catalogService.getAllActiveProducts(), [])
  const all = useMemo(() => (products.status === 'success' ? scoreProducts(products.data, answers) : []), [products, answers])
  const results = all.slice(0, RESULT_LIMIT)
  const starter = useMemo(() => (answers.focus === 'skincare' ? starterSet(all, answers) : []), [all, answers])

  // Nhớ câu trả lời da mặt gần nhất trên trình duyệt này, để Skincare Architect 3D không phải hỏi lại
  useEffect(() => {
    if (answers.focus === 'skincare') saveFinderSkin(answers)
  }, [answers])

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
        <ul className="flex flex-wrap gap-2" aria-label="Câu trả lời của bạn">
          {summaryOf(answers).map((s) => (
            <li key={s} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
              {s}
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SaveProfileButton answers={answers} />
          <button type="button" className={button('secondary', 'sm')} onClick={onEdit}>
            Làm lại từ đầu
          </button>
        </div>
      </div>

      <Insights answers={answers} />

      {answers.mode === 'expert' && answers.focus === 'skincare' && products.status === 'success' && <BundleSection results={all} answers={answers} />}

      {answers.focus === 'skincare' && answers.mode !== 'gift' && products.status === 'success' && <ArchitectHandoff answers={answers} starter={starter} />}

      {products.status === 'loading' && (
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}
      {products.status === 'error' && (
        <div className="mt-6">
          <ErrorState />
        </div>
      )}

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
              {results.length} sản phẩm phù hợp nhất, sắp theo mức độ phù hợp.
            </p>
          </div>
          <ol className="mt-4 grid gap-4 lg:grid-cols-2">
            {results.map((r) => (
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

/** Chế độ chuyên sâu: mỗi bước một sản phẩm, tổng tiền trong ngân sách cả bộ */
function BundleSection({ results, answers }: { results: FinderResult[]; answers: FinderAnswers }) {
  const bundle = useMemo(() => routineBundle(results, answers), [results, answers])
  const { add, quantityOf } = useCart()
  const [added, setAdded] = useState(false)
  if (!bundle.items.length) return null
  const addAll = () => {
    for (const r of bundle.items) if (quantityOf(r.product.id) < r.product.stock) add(r.product.id)
    setAdded(true)
  }
  return (
    <section className="mt-6 rounded-card border border-border bg-surface p-5 sm:p-6" aria-labelledby="bundle-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Chuyên sâu</p>
          <h2 id="bundle-heading" className="mt-1 font-display text-3xl font-semibold leading-tight">
            Bộ chu trình {bundle.max != null ? 'trong ngân sách' : 'đề xuất'}
          </h2>
          <p className="mt-1 text-sm text-muted">Mỗi bước một sản phẩm phù hợp nhất; vượt ngân sách thì đổi sang lựa chọn rẻ hơn cùng bước, ít giảm mức phù hợp nhất.</p>
        </div>
        <p className="text-right">
          <span className="block text-xs text-muted">Tổng cộng</span>
          <span className={`font-display text-2xl font-semibold ${bundle.fits ? '' : 'text-sale'}`}>{formatPrice(bundle.total)}</span>
          {bundle.max != null && <span className="block text-xs text-muted">Ngân sách {formatPrice(bundle.max)}</span>}
        </p>
      </div>
      <ol className="mt-4 divide-y divide-border" aria-label="Sản phẩm trong bộ">
        {bundle.items.map((r) => {
          const st = routineStepOf(r.product.type)
          return (
            <li key={r.product.id} className="flex items-center gap-3 py-3">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                <ProductImage product={r.product} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{st ? `Bước ${st.order}: ${st.label}` : productTypeLabels[r.product.type]}</span>
                <Link to={`/products/${r.product.slug}`} className="block truncate text-sm font-medium hover:text-primary">
                  {r.product.name}
                </Link>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-semibold">{formatPrice(r.product.price)}</span>
                <span className="block text-xs text-primary">{r.match}% phù hợp</span>
              </span>
            </li>
          )
        })}
      </ol>
      {!bundle.fits && <p className="mt-2 text-sm text-sale">Chưa tìm được bộ đủ bước trong ngân sách này; bạn có thể chọn ngân sách cao hơn hoặc ít bước hơn.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={button('dark', 'sm')} onClick={addAll} disabled={added}>
          <Icon name="cart" size={16} /> {added ? 'Đã thêm cả bộ vào giỏ' : 'Thêm cả bộ vào giỏ'}
        </button>
      </div>
    </section>
  )
}

/** Chuyển sang Skincare Architect 3D: module dùng lại câu trả lời + bộ sản phẩm đề xuất, tự sắp sáng/tối và minh họa 3D */
function ArchitectHandoff({ answers, starter }: { answers: FinderAnswers; starter: FinderResult[] }) {
  const params = answersToParams(answers)
  if (starter.length) params.set('pick', starter.map((r) => r.product.id).join(','))
  params.set('from', 'finder')
  return (
    <section className="mt-6 overflow-hidden rounded-card border border-border bg-surface" aria-labelledby="architect-heading">
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow">Bước tiếp theo</p>
          <h2 id="architect-heading" className="mt-1 font-display text-3xl font-semibold leading-tight">
            Xếp thành chu trình sáng – tối, xem trên mô hình 3D
          </h2>
          <p className="mt-2 text-sm text-muted">
            Skincare Architect 3D dùng luôn câu trả lời của bạn (không hỏi lại), cùng sản phẩm bạn đã mua trên sàn
            {starter.length ? ' và bộ sản phẩm đề xuất dưới đây' : ''}; tự sắp thứ tự, báo bước còn thiếu và tổ hợp cần thận trọng.
          </p>
          {starter.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Bộ sản phẩm đề xuất cho chu trình">
              {starter.map((r) => (
                <li key={r.product.id} className="rounded-full bg-surface-2 px-3 py-1 text-xs">
                  <span className="text-muted">{productTypeLabels[r.product.type]}:</span> {r.product.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted">Chưa có sản phẩm nào trong kết quả được cửa hàng khai báo đủ công dụng và thời điểm dùng.</p>
          )}
        </div>
        <Link to={`/skincare-architect?${params.toString()}`} className={button('dark', 'lg')}>
          <Icon name="sparkle" size={18} /> Mở Skincare Architect 3D
        </Link>
      </div>
    </section>
  )
}

function ResultCard({ result }: { result: FinderResult }) {
  const { product, match, reasons, cautions, breakdown } = result
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
            {step ? <span className="text-muted"> · Bước {step.order}: {step.label}</span> : <span className="text-muted"> · {productTypeLabels[product.type]}</span>}
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

        {breakdown.length > 1 && (
          <details className="group mt-3 text-sm">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
              Vì sao {match}% phù hợp?
              <Icon name="chevronDown" size={14} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <ul className="mt-2 space-y-1.5" aria-label="Điểm theo từng tiêu chí">
              {breakdown.map((b) => {
                const pct = b.max ? Math.round((b.got / b.max) * 100) : 0
                return (
                  <li key={b.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_2.5rem] items-center gap-2 text-xs">
                    <span className="truncate text-muted">{b.label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{pct}%</span>
                  </li>
                )
              })}
            </ul>
          </details>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <button
            type="button"
            className={button('dark', 'sm')}
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
