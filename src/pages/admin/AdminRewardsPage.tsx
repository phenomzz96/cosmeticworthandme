/**
 * ĐỢT QUÀ BEAUTY QUEST — /admin/rewards. Chỉ Admin; database kiểm tra quyền và ghi nhật ký mọi thao tác.
 * Tạo đợt quà theo dịp (lễ, sale), tùy chỉnh giải thưởng (voucher / quà tặng / chúc may mắn), tỷ lệ, số lượng;
 * xem người trúng và cập nhật trạng thái gửi quà tặng.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, TextAreaField, TextField } from '@/components/ui/Form'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { friendlyError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import {
  campaignState,
  describePrize,
  giftStatusLabels,
  prizeOdds,
  rewardService,
  type AdminPlay,
  type CampaignInput,
  type GiftStatus,
  type PrizeInput,
  type PrizeKind,
  type RewardCampaign,
  type RewardPrize,
} from '@/services/rewards'

const stateLabel = {
  running: { text: 'Đang mở', cls: 'bg-success/10 text-success' },
  upcoming: { text: 'Sắp mở', cls: 'bg-primary-soft text-primary' },
  ended: { text: 'Đã kết thúc', cls: 'bg-surface-2 text-muted' },
  off: { text: 'Đang tắt', cls: 'bg-surface-2 text-muted' },
} as const

const kindLabels: Record<PrizeKind, string> = { voucher: 'Voucher', gift: 'Quà tặng', none: 'Chúc may mắn' }

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.floor(Number(v) || 0)))

function emptyCampaign(): CampaignInput {
  return {
    id: null,
    title: '',
    occasion: '',
    description: '',
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: toLocalInput(new Date(Date.now() + 7 * 86_400_000).toISOString()),
    plays_per_day: 1,
    bonus_per_order: 1,
    is_active: false,
  }
}

function emptyPrize(campaignId: string, order: number): PrizeInput {
  return {
    id: null,
    campaign_id: campaignId,
    kind: 'voucher',
    label: '',
    description: '',
    weight: 10,
    stock: null,
    discount_type: 'percent',
    discount_value: 10,
    max_discount: 50000,
    min_spend: 0,
    valid_days: 7,
    sort_order: order,
  }
}

/** Bộ giải mẫu để Admin bắt đầu nhanh (sửa lại tùy dịp) */
const SAMPLE_PRIZES: Omit<PrizeInput, 'id' | 'campaign_id' | 'sort_order'>[] = [
  { kind: 'voucher', label: 'Voucher giảm 10%', description: '', weight: 30, stock: null, discount_type: 'percent', discount_value: 10, max_discount: 50000, min_spend: 150000, valid_days: 7 },
  { kind: 'voucher', label: 'Voucher giảm 30.000đ', description: '', weight: 20, stock: 200, discount_type: 'fixed', discount_value: 30000, max_discount: null, min_spend: 250000, valid_days: 7 },
  { kind: 'gift', label: 'Quà tặng mini size', description: 'Gửi kèm đơn hàng tiếp theo', weight: 5, stock: 20, discount_type: null, discount_value: null, max_discount: null, min_spend: 0, valid_days: 7 },
  { kind: 'none', label: 'Chúc may mắn lần sau', description: '', weight: 45, stock: null, discount_type: null, discount_value: null, max_discount: null, min_spend: 0, valid_days: 7 },
]

export function AdminRewardsPage() {
  useDocumentTitle('Đợt quà Beauty Quest')
  const [list, setList] = useState<{ status: 'loading' | 'ready' | 'error'; items: RewardCampaign[]; error?: string }>({ status: 'loading', items: [] })
  const [form, setForm] = useState<CampaignInput | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await rewardService.adminCampaigns()
      setList({ status: 'ready', items })
    } catch (err) {
      setList({ status: 'error', items: [], error: friendlyError(err) })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setError(null)
    if (form.title.trim().length < 3) return setError('Nhập tên đợt quà (ít nhất 3 ký tự).')
    if (new Date(form.ends_at) <= new Date(form.starts_at)) return setError('Thời gian kết thúc phải sau thời gian bắt đầu.')
    setBusy(true)
    try {
      const id = await rewardService.saveCampaign({ ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() })
      setNotice(form.id ? 'Đã cập nhật đợt quà.' : 'Đã tạo đợt quà. Thêm giải thưởng rồi bật đợt quà để khách chơi.')
      setForm(null)
      setSelected(id)
      void load()
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được đợt quà.'))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (c: RewardCampaign) => {
    setError(null)
    try {
      await rewardService.saveCampaign({ ...c, is_active: !c.is_active })
      setNotice(c.is_active ? `Đã tắt "${c.title}".` : `Đã bật "${c.title}".`)
      void load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const remove = async (c: RewardCampaign) => {
    if (!window.confirm(`Xóa đợt quà "${c.title}"? Chỉ xóa được khi chưa có ai chơi.`)) return
    setError(null)
    try {
      await rewardService.deleteCampaign(c.id)
      setNotice(`Đã xóa "${c.title}".`)
      if (selected === c.id) setSelected(null)
      void load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const current = list.items.find((c) => c.id === selected)

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">Đợt quà Beauty Quest</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Tạo hộp quà may mắn cho các dịp lễ, đợt sale. Bạn chọn giải thưởng (voucher, quà tặng hoặc "chúc may mắn"), tỷ lệ và số lượng; máy chủ chọn quà ngẫu nhiên theo tỷ
            lệ và tạo voucher riêng cho người trúng.
          </p>
        </div>
        {!form && (
          <button type="button" className={button('dark')} onClick={() => (setForm(emptyCampaign()), setError(null), setNotice(null))}>
            Tạo đợt quà
          </button>
        )}
      </div>

      {notice && (
        <div className="mt-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && !form && (
        <div className="mt-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="mt-6 space-y-4 rounded-card border border-border bg-surface p-5" aria-label={form.id ? 'Sửa đợt quà' : 'Tạo đợt quà'}>
          <h2 className="font-display text-2xl font-semibold">{form.id ? `Sửa "${form.title}"` : 'Đợt quà mới'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Tên đợt quà" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Hộp quà Black Friday" required />
            <TextField label="Dịp (hiện thành nhãn)" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} maxLength={40} placeholder="Black Friday, Tết, 8/3..." />
          </div>
          <TextAreaField label="Mô tả ngắn" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} maxLength={400} counter />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Bắt đầu" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
            <TextField label="Kết thúc" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Lượt mở hộp mỗi ngày (1–10)" type="number" min={1} max={10} value={String(form.plays_per_day)} onChange={(e) => setForm({ ...form, plays_per_day: Math.min(10, Math.max(1, num(e.target.value))) })} />
            <TextField
              label="Lượt thưởng cho mỗi đơn đã giao (0–5)"
              type="number"
              min={0}
              max={5}
              value={String(form.bonus_per_order)}
              onChange={(e) => setForm({ ...form, bonus_per_order: Math.min(5, num(e.target.value)) })}
              hint="Tính cho đơn đặt trong thời gian chương trình"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[var(--primary)]" />
            Bật đợt quà (khách thấy và chơi được trong thời gian hiệu lực)
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="flex gap-2">
            <button type="submit" className={button('dark')} disabled={busy}>
              {busy ? 'Đang lưu...' : 'Lưu đợt quà'}
            </button>
            <button type="button" className={button('ghost')} onClick={() => setForm(null)}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {list.status === 'loading' && <Skeleton className="h-40 w-full" />}
        {list.status === 'error' && <Alert kind="error">{list.error}</Alert>}
        {list.status === 'ready' && list.items.length === 0 && !form && <EmptyState title="Chưa có đợt quà">Tạo đợt quà cho dịp lễ hoặc đợt sale sắp tới.</EmptyState>}
        {list.items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="Danh sách đợt quà">
            {list.items.map((c) => {
              const st = stateLabel[campaignState(c)]
              return (
                <li key={c.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${selected === c.id ? 'bg-primary-soft/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.title}</span>
                      {c.occasion && <span className="rounded-full bg-blush px-2 py-0.5 text-xs text-on-blush">{c.occasion}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDateTime(c.starts_at)} – {formatDateTime(c.ends_at)} · {c.plays_per_day} lượt/ngày
                      {c.bonus_per_order > 0 && ` · +${c.bonus_per_order} lượt mỗi đơn đã giao`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" className={button(selected === c.id ? 'dark' : 'secondary', 'sm')} onClick={() => setSelected(selected === c.id ? null : c.id)} aria-expanded={selected === c.id}>
                      Giải thưởng & người trúng
                    </button>
                    <button
                      type="button"
                      className={button('ghost', 'sm')}
                      onClick={() => (setForm({ ...c, starts_at: toLocalInput(c.starts_at), ends_at: toLocalInput(c.ends_at) }), setError(null), setNotice(null))}
                    >
                      Sửa
                    </button>
                    <button type="button" className={button('ghost', 'sm')} onClick={() => void toggle(c)}>
                      {c.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button type="button" className={button('ghost', 'sm')} onClick={() => void remove(c)}>
                      Xóa
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {current && <CampaignDetail key={current.id} campaign={current} />}
    </div>
  )
}

function CampaignDetail({ campaign }: { campaign: RewardCampaign }) {
  const [prizes, setPrizes] = useState<RewardPrize[] | null>(null)
  const [form, setForm] = useState<PrizeInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => rewardService.listPrizes(campaign.id).then(setPrizes).catch((err) => setError(friendlyError(err))), [campaign.id])
  useEffect(() => {
    void load()
  }, [load])

  // Tỷ lệ xem trước: tính cả giải đang sửa
  const odds = useMemo(() => prizeOdds(prizes ?? []), [prizes])
  const totalWeight = (prizes ?? []).reduce((s, p) => s + (p.weight > 0 && (p.stock == null || p.awarded_count < p.stock) ? p.weight : 0), 0)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setError(null)
    if (form.label.trim().length < 2) return setError('Nhập tên giải (ít nhất 2 ký tự).')
    if (form.kind === 'voucher' && form.discount_type === 'percent' && ((form.discount_value ?? 0) < 1 || (form.discount_value ?? 0) > 90)) return setError('Giảm theo phần trăm từ 1 đến 90.')
    if (form.kind === 'voucher' && form.discount_type === 'fixed' && (form.discount_value ?? 0) < 1000) return setError('Số tiền giảm tối thiểu 1.000đ.')
    setBusy(true)
    try {
      await rewardService.savePrize(form)
      setNotice(form.id ? 'Đã cập nhật giải thưởng.' : 'Đã thêm giải thưởng.')
      setForm(null)
      void load()
    } catch (err) {
      setError(friendlyError(err, 'Không lưu được giải thưởng.'))
    } finally {
      setBusy(false)
    }
  }

  const addSamples = async () => {
    setBusy(true)
    setError(null)
    try {
      const start = prizes?.length ?? 0
      for (const [i, p] of SAMPLE_PRIZES.entries()) await rewardService.savePrize({ ...p, id: null, campaign_id: campaign.id, sort_order: start + i + 1 })
      setNotice('Đã thêm bộ giải mẫu. Hãy sửa lại tên, mức giảm, tỷ lệ cho phù hợp với dịp này.')
      void load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: RewardPrize) => {
    if (!window.confirm(`Xóa giải "${p.label}"? Lịch sử người đã trúng vẫn được giữ.`)) return
    try {
      await rewardService.deletePrize(p.id)
      setNotice(`Đã xóa giải "${p.label}".`)
      void load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section aria-labelledby="prizes-heading" className="rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="prizes-heading" className="font-display text-2xl font-semibold">
            Giải thưởng: {campaign.title}
          </h2>
          {!form && (
            <div className="flex flex-wrap gap-2">
              {prizes?.length === 0 && (
                <button type="button" className={button('secondary', 'sm')} onClick={() => void addSamples()} disabled={busy}>
                  Thêm bộ giải mẫu
                </button>
              )}
              <button type="button" className={button('dark', 'sm')} onClick={() => (setForm(emptyPrize(campaign.id, (prizes?.length ?? 0) + 1)), setError(null), setNotice(null))}>
                Thêm giải
              </button>
            </div>
          )}
        </div>
        {notice && (
          <div className="mt-3">
            <Alert kind="success">{notice}</Alert>
          </div>
        )}
        {error && !form && (
          <div className="mt-3">
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        {form && (
          <form onSubmit={save} className="mt-4 space-y-4 rounded-2xl border border-border bg-bg p-4" aria-label={form.id ? 'Sửa giải thưởng' : 'Thêm giải thưởng'}>
            <fieldset>
              <legend className="text-sm font-medium">Loại giải</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['voucher', 'gift', 'none'] as const).map((k) => (
                  <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${form.kind === k ? 'border-ink bg-ink text-on-ink' : 'border-border'}`}>
                    <input type="radio" name="prize-kind" className="sr-only" checked={form.kind === k} onChange={() => setForm({ ...form, kind: k })} />
                    {kindLabels[k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Tên giải (khách thấy)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={60} placeholder={form.kind === 'gift' ? 'Bộ mini size' : form.kind === 'none' ? 'Chúc may mắn lần sau' : 'Voucher giảm 20%'} required />
              <TextField label="Mô tả (không bắt buộc)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} />
            </div>
            {form.kind === 'voucher' && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(['percent', 'fixed'] as const).map((t) => (
                    <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${form.discount_type === t ? 'border-ink bg-ink text-on-ink' : 'border-border'}`}>
                      <input type="radio" name="prize-discount" className="sr-only" checked={form.discount_type === t} onChange={() => setForm({ ...form, discount_type: t, discount_value: t === 'percent' ? 10 : 20000 })} />
                      {t === 'percent' ? 'Theo phần trăm' : 'Số tiền cố định'}
                    </label>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <TextField label={form.discount_type === 'percent' ? 'Giảm (%)' : 'Giảm (đ)'} type="number" min={1} value={String(form.discount_value ?? '')} onChange={(e) => setForm({ ...form, discount_value: num(e.target.value) })} required />
                  {form.discount_type === 'percent' && (
                    <TextField label="Tối đa (đ)" type="number" min={1} value={form.max_discount == null ? '' : String(form.max_discount)} onChange={(e) => setForm({ ...form, max_discount: e.target.value === '' ? null : num(e.target.value) })} />
                  )}
                  <TextField label="Đơn tối thiểu (đ)" type="number" min={0} value={String(form.min_spend)} onChange={(e) => setForm({ ...form, min_spend: num(e.target.value) })} />
                  <TextField label="Hạn dùng (ngày)" type="number" min={1} max={90} value={String(form.valid_days)} onChange={(e) => setForm({ ...form, valid_days: Math.min(90, Math.max(1, num(e.target.value))) })} />
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Tỷ lệ (trọng số)" type="number" min={0} max={10000} value={String(form.weight)} onChange={(e) => setForm({ ...form, weight: Math.min(10000, num(e.target.value)) })} hint="0 = tạm không trao" />
              <TextField label="Số lượng (trống = không giới hạn)" type="number" min={0} value={form.stock == null ? '' : String(form.stock)} onChange={(e) => setForm({ ...form, stock: e.target.value === '' ? null : num(e.target.value) })} />
              <TextField label="Thứ tự hiển thị" type="number" min={0} value={String(form.sort_order)} onChange={(e) => setForm({ ...form, sort_order: num(e.target.value) })} />
            </div>
            {form.weight > 0 && (
              <p className="text-sm text-muted">
                Tỷ lệ trúng ước tính: <strong className="text-text">{(((form.weight) / (totalWeight - (form.id ? (prizes?.find((p) => p.id === form.id)?.weight ?? 0) : 0) + form.weight)) * 100).toFixed(1)}%</strong>
              </p>
            )}
            {error && <Alert kind="error">{error}</Alert>}
            <div className="flex gap-2">
              <button type="submit" className={button('dark')} disabled={busy}>
                {busy ? 'Đang lưu...' : 'Lưu giải'}
              </button>
              <button type="button" className={button('ghost')} onClick={() => setForm(null)}>
                Hủy
              </button>
            </div>
          </form>
        )}

        {prizes == null ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : prizes.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Chưa có giải thưởng. Bấm "Thêm bộ giải mẫu" để bắt đầu nhanh.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border" aria-label="Danh sách giải thưởng">
            {prizes.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{kindLabels[p.kind]}</span>
                    <span className="font-medium">{p.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {describePrize(p) && `${describePrize(p)} · `}Trọng số {p.weight} ≈ {odds[p.id] ? odds[p.id].toFixed(1) : '0'}% · Đã trao {p.awarded_count}
                    {p.stock != null && `/${p.stock}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className={button('secondary', 'sm')}
                    onClick={() => (setForm({ ...p, discount_type: p.discount_type ?? 'percent', discount_value: p.discount_value ?? 10 }), setError(null), setNotice(null))}
                  >
                    Sửa
                  </button>
                  <button type="button" className={button('ghost', 'sm')} onClick={() => void remove(p)}>
                    Xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <WinnersPanel campaign={campaign} />
    </div>
  )
}

function WinnersPanel({ campaign }: { campaign: RewardCampaign }) {
  const [onlyGifts, setOnlyGifts] = useState(true)
  const [plays, setPlays] = useState<AdminPlay[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  const load = useCallback(() => {
    rewardService
      .adminPlays(campaign.id, onlyGifts)
      .then(setPlays)
      .catch((err) => setError(friendlyError(err)))
  }, [campaign.id, onlyGifts])
  useEffect(() => {
    void load()
  }, [load])

  const update = async (p: AdminPlay, status: GiftStatus) => {
    setError(null)
    try {
      await rewardService.updateGift(p.id, status, notes[p.id] ?? p.admin_note)
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <section aria-labelledby="winners-heading" className="rounded-card border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="winners-heading" className="font-display text-2xl font-semibold">
          Người trúng
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyGifts} onChange={(e) => setOnlyGifts(e.target.checked)} className="accent-[var(--primary)]" />
          Chỉ quà tặng cần gửi
        </label>
      </div>
      {error && (
        <div className="mt-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {plays == null ? (
        <Skeleton className="mt-4 h-32 w-full" />
      ) : plays.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{onlyGifts ? 'Chưa có ai trúng quà tặng.' : 'Chưa có lượt chơi nào.'}</p>
      ) : (
        <ul className="mt-4 max-h-[32rem] divide-y divide-border overflow-y-auto pr-1" aria-label="Danh sách người trúng">
          {plays.map((p) => (
            <li key={p.id} className="py-3 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{p.prize_label}</span>
                <span className="text-xs text-muted">{formatDateTime(p.played_at)}</span>
              </p>
              <p className="mt-0.5 break-all text-xs text-muted">
                {p.full_name || 'Khách'} · {p.email}
                {p.voucher_code && ` · ${p.voucher_code}`}
                {p.is_bonus && ' · lượt thưởng'}
              </p>
              {p.gift_status && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.gift_status === 'fulfilled' ? 'bg-success/10 text-success' : p.gift_status === 'pending' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted'}`}>
                    {giftStatusLabels[p.gift_status]}
                  </span>
                  <input
                    aria-label={`Ghi chú gửi quà cho ${p.email}`}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs"
                    placeholder="Ghi chú (ví dụ: gửi kèm đơn WM...)"
                    maxLength={300}
                    value={notes[p.id] ?? p.admin_note}
                    onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                  />
                  {p.gift_status !== 'fulfilled' && (
                    <button type="button" className={button('dark', 'sm')} onClick={() => void update(p, 'fulfilled')}>
                      Đã gửi
                    </button>
                  )}
                  {p.gift_status === 'pending' && (
                    <button type="button" className={button('ghost', 'sm')} onClick={() => void update(p, 'cancelled')}>
                      Hủy quà
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
