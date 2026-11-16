/**
 * BEAUTY QUEST — /beauty-quest
 * - Giới thiệu trò chơi Beauty Quest của nhóm phụ trách (website riêng, mở ở tab mới).
 * - Hộp quà may mắn: Admin tạo đợt quà theo dịp lễ / đợt sale ở /admin/rewards.
 *   Máy chủ kiểm tra lượt, chọn giải theo tỷ lệ công bố và tạo voucher riêng cho tài khoản.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alert } from '@/components/ui/Form'
import { Icon } from '@/components/ui/Icon'
import { button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { BEAUTY_QUEST_URL } from '@/config/features'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBrand } from '@/features/brand/BrandProvider'
import { friendlyError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useCountdown } from '@/lib/useCountdown'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import {
  campaignState,
  describePrize,
  giftStatusLabels,
  prizeAvailable,
  prizeOdds,
  rewardService,
  type MyPlay,
  type PlayResult,
  type RewardCampaign,
  type RewardPrize,
  type RewardTurns,
} from '@/services/rewards'

const BOXES = 6

export function BeautyQuestPage() {
  useDocumentTitle('Beauty Quest – Hộp quà')
  return (
    <div className="container-page py-8 md:py-12">
      <QuestIntro />
      <GiftSection />
    </div>
  )
}

/** Giới thiệu trò chơi Beauty Quest (website riêng của nhóm phụ trách) */
function QuestIntro() {
  const items = [
    { icon: 'sparkle' as const, text: 'Skin Quiz 6 câu, gợi ý routine khởi đầu' },
    { icon: 'check' as const, text: 'Nhiệm vụ chăm da mỗi ngày, tích Beauty Points' },
    { icon: 'leaf' as const, text: 'Skin Roadmap và nhật ký da' },
    { icon: 'star' as const, text: 'Mini game Glow Match' },
  ]
  return (
    <section aria-labelledby="bq-heading" className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="eyebrow">Tính năng chuyên biệt</p>
        <h1 id="bq-heading" className="mt-2 text-4xl md:text-5xl">
          Beauty Quest
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Biến việc chăm da thành hành trình nhẹ nhàng: làm nhiệm vụ mỗi ngày, theo dõi tiến bộ, và mở hộp quà để nhận voucher hoặc quà tặng trong các dịp lễ, đợt sale.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#hop-qua" className={button('dark', 'lg')}>
            <Icon name="gift" size={18} /> Mở hộp quà
          </a>
          <a href={BEAUTY_QUEST_URL} target="_blank" rel="noopener noreferrer" className={button('secondary', 'lg')}>
            Chơi Beauty Quest <Icon name="arrowRight" size={16} />
            <span className="sr-only">(mở ở tab mới)</span>
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">Trò chơi Beauty Quest mở ở tab mới và dùng tài khoản riêng của trò chơi. Hộp quà bên dưới dùng tài khoản của bạn trên sàn.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.text} className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon name={it.icon} size={18} />
            </span>
            <span className="text-sm leading-snug">{it.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function GiftSection() {
  const [campaigns, setCampaigns] = useState<{ status: 'loading' | 'ready' | 'error'; list: RewardCampaign[]; error?: string }>({ status: 'loading', list: [] })
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return setCampaigns({ status: 'ready', list: [] })
    rewardService
      .listCampaigns()
      .then((list) => {
        // Đợt đang chạy trước, sắp mở sau
        const sorted = [...list].sort((a, b) => Number(campaignState(a) !== 'running') - Number(campaignState(b) !== 'running'))
        setCampaigns({ status: 'ready', list: sorted })
        setActiveId(sorted[0]?.id ?? null)
      })
      .catch((err) => setCampaigns({ status: 'error', list: [], error: friendlyError(err) }))
  }, [])

  const campaign = campaigns.list.find((c) => c.id === activeId)

  return (
    <section id="hop-qua" aria-labelledby="gift-heading" className="mt-16 scroll-mt-40">
      <p className="eyebrow">Hộp quà may mắn</p>
      <h2 id="gift-heading" className="section-title mt-2">
        Mở hộp, nhận quà
      </h2>

      {!isSupabaseConfigured && (
        <div className="mt-6">
          <Alert kind="info">Hộp quà cần kết nối Supabase để máy chủ chọn quà và lưu voucher. Bản đang chạy chưa kết nối nên chưa chơi được.</Alert>
        </div>
      )}
      {campaigns.status === 'loading' && <Skeleton className="mt-6 h-72 w-full" />}
      {campaigns.status === 'error' && (
        <div className="mt-6">
          <Alert kind="error">{campaigns.error}</Alert>
        </div>
      )}
      {campaigns.status === 'ready' && isSupabaseConfigured && campaigns.list.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Chưa có đợt quà nào đang mở">Hộp quà mở vào các dịp lễ và đợt sale. Quay lại sau nhé!</EmptyState>
        </div>
      )}

      {campaigns.list.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Chọn đợt quà">
          {campaigns.list.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === activeId}
              onClick={() => setActiveId(c.id)}
              className={`rounded-full border px-4 py-2 text-sm ${c.id === activeId ? 'border-ink bg-ink text-on-ink' : 'border-border bg-surface hover:border-text'}`}
            >
              {c.occasion || c.title}
              {campaignState(c) === 'upcoming' && <span className="ml-1.5 text-xs opacity-75">(sắp mở)</span>}
            </button>
          ))}
        </div>
      )}

      {campaign && <CampaignBoard key={campaign.id} campaign={campaign} />}
    </section>
  )
}

function CampaignBoard({ campaign }: { campaign: RewardCampaign }) {
  const { status } = useAuth()
  const { settings } = useBrand()
  const location = useLocation()
  const signedIn = status === 'signed-in'
  const state = campaignState(campaign)
  const countdown = useCountdown(state === 'upcoming' ? campaign.starts_at : campaign.ends_at, 30_000).label

  const [prizes, setPrizes] = useState<RewardPrize[] | null>(null)
  const [turns, setTurns] = useState<RewardTurns | null>(null)
  const [plays, setPlays] = useState<MyPlay[]>([])
  const [opening, setOpening] = useState<number | null>(null)
  const [result, setResult] = useState<{ box: number; data: PlayResult } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadMine = useCallback(async () => {
    if (!signedIn) return
    const [t, p] = await Promise.all([rewardService.turns(campaign.id).catch(() => null), rewardService.myPlays(campaign.id).catch(() => [])])
    setTurns(t)
    setPlays(p)
  }, [campaign.id, signedIn])

  useEffect(() => {
    rewardService.listPrizes(campaign.id).then(setPrizes).catch(() => setPrizes([]))
    void loadMine()
  }, [campaign.id, loadMine])

  const odds = useMemo(() => prizeOdds(prizes ?? []), [prizes])
  const soldOut = prizes != null && prizes.length > 0 && !prizes.some(prizeAvailable)
  const canPlay = signedIn && state === 'running' && !soldOut && (turns?.remaining ?? 0) > 0 && opening == null

  const open = async (box: number) => {
    if (!canPlay) return
    setError(null)
    setResult(null)
    setOpening(box)
    // Hộp rung ít nhất 0,7 giây cho cảm giác "đang mở"
    const [res] = await Promise.allSettled([rewardService.play(campaign.id), new Promise((r) => setTimeout(r, 700))])
    if (res.status === 'fulfilled') {
      setResult({ box, data: res.value })
      setTurns(res.value.turns)
      rewardService.myPlays(campaign.id).then(setPlays).catch(() => {})
      rewardService.listPrizes(campaign.id).then(setPrizes).catch(() => {})
    } else {
      setError(friendlyError(res.reason, 'Không mở được hộp quà. Vui lòng thử lại.'))
      void loadMine()
    }
    setOpening(null)
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div className="rounded-card border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {campaign.occasion && <span className="inline-block rounded-full bg-blush px-3 py-1 text-xs font-semibold text-on-blush">{campaign.occasion}</span>}
            <h3 className="mt-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">{campaign.title}</h3>
            {campaign.description && <p className="mt-1 max-w-prose text-sm text-muted">{campaign.description}</p>}
          </div>
          <p className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm" aria-live="off">
            <Icon name="clock" size={16} className="text-primary" />
            {state === 'upcoming' ? `Mở sau ${countdown}` : `Còn ${countdown}`}
          </p>
        </div>

        {/* Lượt chơi */}
        <div className="mt-5 rounded-2xl bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
          {!signedIn ? (
            <p>
              <Link to={`/login?next=${encodeURIComponent(location.pathname + '#hop-qua')}`} className="font-semibold text-primary hover:underline">
                Đăng nhập
              </Link>{' '}
              để mở hộp quà ({campaign.plays_per_day} lượt mỗi ngày).
            </p>
          ) : state === 'upcoming' ? (
            <p>Đợt quà mở lúc {formatDateTime(campaign.starts_at)}.</p>
          ) : soldOut ? (
            <p>Quà của đợt này đã được trao hết. Cảm ơn bạn đã tham gia!</p>
          ) : turns ? (
            <p>
              Bạn còn <strong className="text-primary">{turns.remaining}</strong> lượt mở hộp
              {turns.bonus_total > 0 && <span className="text-muted"> (gồm lượt thưởng từ đơn hàng)</span>}.
            </p>
          ) : (
            <p className="text-muted">Đang tải lượt chơi...</p>
          )}
        </div>

        {/* Hộp quà */}
        <ul className="mt-5 grid grid-cols-3 gap-3 sm:gap-4" aria-label="Chọn một hộp quà">
          {Array.from({ length: BOXES }, (_, i) => {
            const isOpening = opening === i
            const isOpened = result?.box === i
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => void open(i)}
                  disabled={!canPlay && !isOpened}
                  aria-label={`Hộp quà ${i + 1}`}
                  aria-busy={isOpening}
                  className={`group relative grid aspect-square w-full place-items-center rounded-2xl border transition-colors motion-reduce:transition-none ${
                    isOpened ? 'border-primary bg-primary-soft' : 'border-border bg-bg enabled:hover:border-primary enabled:hover:bg-primary-soft disabled:opacity-60'
                  }`}
                >
                  <GiftBoxArt className={`h-[62%] w-[62%] ${isOpening ? 'gift-shake' : ''} ${isOpened ? 'gift-open' : ''}`} />
                </button>
              </li>
            )
          })}
        </ul>

        {error && (
          <div className="mt-4">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        {result && <PrizeReveal result={result.data} />}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Mỗi ngày {campaign.plays_per_day} lượt (tính lại lúc 0 giờ).
          {campaign.bonus_per_order > 0 && ` Mỗi đơn đặt trong thời gian chương trình và đã giao: thêm ${campaign.bonus_per_order} lượt.`} Quà do máy chủ của {settings.name} chọn ngẫu nhiên theo
          tỷ lệ công bố bên cạnh. Voucher chỉ dùng được cho tài khoản của bạn, mỗi mã dùng 1 lần.
        </p>
      </div>

      <div className="space-y-6">
        <PrizeList prizes={prizes} odds={odds} />
        {signedIn && <MyPlays plays={plays} />}
      </div>
    </div>
  )
}

function PrizeReveal({ result }: { result: PlayResult }) {
  const win = result.kind !== 'none'
  return (
    <div className="gift-pop mt-5 rounded-2xl border border-primary/30 bg-primary-soft p-5 text-center" role="status">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{win ? 'Chúc mừng bạn!' : 'Tiếc quá!'}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{result.label}</p>
      {result.description && <p className="mt-1 text-sm text-muted">{result.description}</p>}
      {result.kind === 'voucher' && result.voucher_code && (
        <>
          <p className="mt-3 inline-block rounded-lg border border-dashed border-primary bg-surface px-4 py-2 font-mono text-lg font-semibold tracking-widest">{result.voucher_code}</p>
          <p className="mt-2 text-sm">
            Mã đã nằm trong{' '}
            <Link to="/vouchers" className="font-semibold text-primary hover:underline">
              ví voucher
            </Link>
            {result.voucher_ends_at && `, dùng trước ${formatDate(result.voucher_ends_at)}`}.
          </p>
        </>
      )}
      {result.kind === 'gift' && <p className="mt-2 text-sm">Đội ngũ sàn sẽ liên hệ hoặc gửi quà kèm đơn hàng tiếp theo của bạn.</p>}
      {!win && <p className="mt-2 text-sm">Còn lượt thì thử hộp khác nhé.</p>}
    </div>
  )
}

function PrizeList({ prizes, odds }: { prizes: RewardPrize[] | null; odds: Record<string, number> }) {
  return (
    <section aria-labelledby="prize-heading" className="rounded-card border border-border bg-surface p-5">
      <h3 id="prize-heading" className="font-semibold">
        Giải thưởng và tỷ lệ
      </h3>
      {prizes == null ? (
        <Skeleton className="mt-3 h-32 w-full" />
      ) : prizes.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Đợt quà chưa có giải thưởng.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {prizes.map((p) => {
            const left = p.stock == null ? null : Math.max(0, p.stock - p.awarded_count)
            return (
              <li key={p.id} className="flex items-start gap-3 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.kind === 'none' ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary'}`}>
                  <Icon name={p.kind === 'voucher' ? 'ticket' : p.kind === 'gift' ? 'gift' : 'sparkle'} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{p.label}</span>
                  {describePrize(p) && <span className="block text-xs text-muted">{describePrize(p)}</span>}
                  {left != null && <span className={`block text-xs ${left === 0 ? 'text-muted' : 'text-primary'}`}>{left === 0 ? 'Đã trao hết' : `Còn ${left} quà`}</span>}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{odds[p.id] ? `${odds[p.id] < 1 ? odds[p.id].toFixed(1) : Math.round(odds[p.id])}%` : '—'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MyPlays({ plays }: { plays: MyPlay[] }) {
  return (
    <section aria-labelledby="mine-heading" className="rounded-card border border-border bg-surface p-5">
      <h3 id="mine-heading" className="font-semibold">
        Quà của tôi
      </h3>
      {plays.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Bạn chưa mở hộp nào trong đợt này.</p>
      ) : (
        <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto pr-1">
          {plays.map((p) => (
            <li key={p.id} className="py-2.5 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{p.prize_label}</span>
                <span className="text-xs text-muted">{formatDateTime(p.played_at)}</span>
              </p>
              {p.voucher_code && (
                <p className="mt-0.5 text-xs text-muted">
                  Mã <span className="font-mono font-semibold text-text">{p.voucher_code}</span>
                  {p.voucher_used ? ' · đã dùng' : p.voucher_ends_at && Date.parse(p.voucher_ends_at) < Date.now() ? ' · đã hết hạn' : p.voucher_ends_at ? ` · hạn ${formatDate(p.voucher_ends_at)}` : ''}
                </p>
              )}
              {p.gift_status && (
                <p className="mt-0.5 text-xs text-muted">
                  {giftStatusLabels[p.gift_status]}
                  {p.admin_note && ` · ${p.admin_note}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Hộp quà vẽ bằng SVG, màu theo token (đúng cả sáng/tối) */
function GiftBoxArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="10" y="28" width="44" height="30" rx="4" fill="var(--primary)" />
      <rect x="29" y="28" width="6" height="30" fill="var(--accent)" />
      <g className="gift-lid">
        <rect x="6" y="19" width="52" height="11" rx="3" fill="var(--primary-hover)" />
        <rect x="29" y="19" width="6" height="11" fill="var(--accent)" />
        <path d="M32 19c-3-7-12-9-12-4s7 4 12 4Zm0 0c3-7 12-9 12-4s-7 4-12 4Z" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
