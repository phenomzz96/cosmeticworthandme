/**
 * TRANH MINH HỌA TRANG CHỦ — hoa, bướm và chai lọ mỹ phẩm, vẽ bằng SVG (tự thiết kế, không dùng ảnh của trang khác).
 * Màu lấy từ token --art-* trong tokens.css nên tự đổi theo chế độ sáng/tối.
 * Bướm vỗ cánh nhẹ (tắt khi người dùng chọn giảm chuyển động).
 */
import type { ReactNode } from 'react'

const v = (name: string) => `var(--art-${name})`

// ------------------------------------------------------------------ CHI TIẾT DÙNG CHUNG

/** Hoa 5 cánh (hoa mai, hoa anh đào cách điệu) */
function Blossom({ x, y, r, fill, rotate = 0, opacity = 1 }: { x: number; y: number; r: number; fill: string; rotate?: number; opacity?: number }) {
  const petal = `M0 0 C ${-r * 0.75} ${-r * 0.35} ${-r * 0.62} ${-r * 1.08} 0 ${-r} C ${r * 0.62} ${-r * 1.08} ${r * 0.75} ${-r * 0.35} 0 0Z`
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`} opacity={opacity}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d={petal} transform={`rotate(${a})`} fill={fill} />
      ))}
      <circle r={r * 0.2} fill={v('heart')} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} r={r * 0.05} cx={Math.cos((a * Math.PI) / 180) * r * 0.32} cy={Math.sin((a * Math.PI) / 180) * r * 0.32} fill={v('heart')} />
      ))}
    </g>
  )
}

/** Hoa nhiều lớp cánh (mẫu đơn cách điệu) */
function Peony({ x, y, r, outer, inner }: { x: number; y: number; r: number; outer: string; inner: string }) {
  const ring = (n: number, rr: number, fill: string, off: number, op: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (360 / n) * i + off
      return (
        <ellipse key={`${rr}-${i}`} cx={0} cy={-rr * 0.55} rx={rr * 0.42} ry={rr * 0.6} transform={`rotate(${a})`} fill={fill} opacity={op} />
      )
    })
  return (
    <g transform={`translate(${x} ${y})`}>
      {ring(8, r, outer, 0, 0.95)}
      {ring(7, r * 0.72, inner, 20, 0.9)}
      {ring(6, r * 0.46, outer, 8, 0.85)}
      <circle r={r * 0.16} fill={v('heart')} opacity={0.9} />
    </g>
  )
}

function Leaf({ x, y, len, angle, fill }: { x: number; y: number; len: number; angle: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0 Q ${len * 0.45} ${-len * 0.3} ${len} 0 Q ${len * 0.45} ${len * 0.3} 0 0Z`} fill={fill} />
      <path d={`M2 0 L ${len * 0.9} 0`} stroke={v('leaf-2')} strokeWidth={1.2} opacity={0.6} />
    </g>
  )
}

function Stem({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={v('leaf-2')} strokeWidth={2.2} strokeLinecap="round" />
}

/** Bướm: 2 cánh trên + 2 cánh dưới, tô chuyển màu */
function Butterfly({ x, y, s = 1, rotate = 0, gradient, delay = 0 }: { x: number; y: number; s?: number; rotate?: number; gradient: string; delay?: number }) {
  const upper = 'M0 -2 C -8 -34 -50 -46 -46 -14 C -43 6 -16 8 0 2Z'
  const lower = 'M0 3 C -10 20 -34 34 -30 14 C -27 4 -12 3 0 3Z'
  const wing = (
    <>
      <path d={upper} fill={`url(#${gradient})`} />
      <path d={lower} fill={`url(#${gradient})`} opacity={0.9} />
      <path d="M-4 -4 C -14 -18 -30 -26 -38 -18" fill="none" stroke={v('wing-line')} strokeWidth={0.9} opacity={0.35} />
      <circle cx={-30} cy={-20} r={3.2} fill={v('petal-4')} opacity={0.75} />
      <circle cx={-20} cy={14} r={2.2} fill={v('petal-4')} opacity={0.7} />
    </>
  )
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <g className="art-drift" style={{ animationDelay: `${delay}s` }}>
        <g className="art-flutter" style={{ animationDelay: `${delay}s` }}>
          {wing}
          <g transform="scale(-1 1)">{wing}</g>
        </g>
        <ellipse rx={2.6} ry={13} cy={2} fill={v('wing-line')} />
        <path d="M-1 -10 C -4 -20 -9 -26 -13 -28 M1 -10 C 4 -20 9 -26 13 -28" fill="none" stroke={v('wing-line')} strokeWidth={1.1} strokeLinecap="round" />
      </g>
    </g>
  )
}

function Defs({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor={v('sky-1')} />
        <stop offset="1" stopColor={v('sky-2')} />
      </linearGradient>
      <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={v('wing-1')} />
        <stop offset="1" stopColor={v('wing-2')} />
      </linearGradient>
      <linearGradient id={`${id}-wing2`} x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={v('petal-3')} />
        <stop offset="1" stopColor={v('wing-2')} />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={v('glass')} stopOpacity={0.95} />
        <stop offset="1" stopColor={v('glass')} stopOpacity={0.7} />
      </linearGradient>
      <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={v('liquid-1')} />
        <stop offset="1" stopColor={v('liquid-2')} />
      </linearGradient>
      {children}
    </defs>
  )
}

// ------------------------------------------------------------------ CHAI LỌ

function Dropper({ x, y, h = 150, liquid }: { x: number; y: number; h?: number; liquid: string }) {
  const w = h * 0.36
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={-h * 0.74} rx={w * 0.2} ry={h * 0.09} fill={v('gold')} />
      <rect x={-w * 0.24} y={-h * 0.68} width={w * 0.48} height={h * 0.16} rx={3} fill={v('gold')} />
      <rect x={-w / 2} y={-h * 0.54} width={w} height={h * 0.54} rx={w * 0.2} fill={`url(#${liquid})`} />
      <rect x={-w / 2} y={-h * 0.54} width={w} height={h * 0.54} rx={w * 0.2} fill="none" stroke={v('glass')} strokeWidth={2} opacity={0.7} />
      <rect x={-w * 0.36} y={-h * 0.46} width={w * 0.09} height={h * 0.36} rx={2} fill={v('petal-4')} opacity={0.65} />
      <rect x={-w * 0.22} y={-h * 0.3} width={w * 0.5} height={h * 0.11} rx={2} fill={v('petal-4')} opacity={0.7} />
    </g>
  )
}

function Jar({ x, y, w = 110, body, lid }: { x: number; y: number; w?: number; body: string; lid: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-w * 0.66} width={w} height={w * 0.24} rx={8} fill={lid} />
      <rect x={-w * 0.47} y={-w * 0.44} width={w * 0.94} height={w * 0.44} rx={w * 0.12} fill={body} />
      <rect x={-w * 0.38} y={-w * 0.38} width={w * 0.06} height={w * 0.3} rx={2} fill={v('petal-4')} opacity={0.6} />
      <rect x={-w * 0.2} y={-w * 0.3} width={w * 0.44} height={w * 0.14} rx={3} fill={v('petal-4')} opacity={0.65} />
    </g>
  )
}

function Lipstick({ x, y, h = 120, bullet, tube, rotate = 0 }: { x: number; y: number; h?: number; bullet: string; tube: string; rotate?: number }) {
  const w = h * 0.3
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d={`M${-w * 0.36} ${-h * 0.62} L ${w * 0.36} ${-h * 0.82} L ${w * 0.36} ${-h * 0.5} L ${-w * 0.36} ${-h * 0.5}Z`} fill={bullet} />
      <rect x={-w * 0.44} y={-h * 0.52} width={w * 0.88} height={h * 0.14} rx={2} fill={v('gold')} />
      <rect x={-w / 2} y={-h * 0.4} width={w} height={h * 0.4} rx={4} fill={tube} />
      <rect x={-w * 0.34} y={-h * 0.36} width={w * 0.12} height={h * 0.3} rx={2} fill={v('petal-4')} opacity={0.3} />
    </g>
  )
}

function Perfume({ x, y, w = 120, liquid, cap }: { x: number; y: number; w?: number; liquid: string; cap: string }) {
  const h = w * 1.05
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w * 0.16} y={-h - w * 0.26} width={w * 0.32} height={w * 0.26} rx={w * 0.05} fill={cap} />
      <rect x={-w * 0.08} y={-h - w * 0.02} width={w * 0.16} height={w * 0.1} fill={cap} opacity={0.8} />
      <path
        d={`M${-w / 2} ${-h * 0.72} Q ${-w / 2} ${-h * 0.92} ${-w * 0.3} ${-h * 0.92} L ${w * 0.3} ${-h * 0.92} Q ${w / 2} ${-h * 0.92} ${w / 2} ${-h * 0.72} L ${w / 2} ${-h * 0.1} Q ${w / 2} 0 ${w * 0.38} 0 L ${-w * 0.38} 0 Q ${-w / 2} 0 ${-w / 2} ${-h * 0.1}Z`}
        fill={`url(#${liquid})`}
      />
      <path
        d={`M${-w / 2} ${-h * 0.72} Q ${-w / 2} ${-h * 0.92} ${-w * 0.3} ${-h * 0.92} L ${w * 0.3} ${-h * 0.92} Q ${w / 2} ${-h * 0.92} ${w / 2} ${-h * 0.72} L ${w / 2} ${-h * 0.1} Q ${w / 2} 0 ${w * 0.38} 0 L ${-w * 0.38} 0 Q ${-w / 2} 0 ${-w / 2} ${-h * 0.1}Z`}
        fill="none"
        stroke={v('glass')}
        strokeWidth={3}
        opacity={0.75}
      />
      <path d={`M${-w * 0.36} ${-h * 0.78} L ${-w * 0.36} ${-h * 0.18}`} stroke={v('petal-4')} strokeWidth={w * 0.06} strokeLinecap="round" opacity={0.55} />
      <rect x={-w * 0.22} y={-h * 0.5} width={w * 0.44} height={h * 0.16} rx={3} fill={v('petal-4')} opacity={0.75} />
    </g>
  )
}

function Pump({ x, y, h = 170, body, cap }: { x: number; y: number; h?: number; body: string; cap: string }) {
  const w = h * 0.4
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w * 0.08} y={-h * 1.02} width={w * 0.16} height={h * 0.16} fill={cap} />
      <rect x={-w * 0.08} y={-h * 1.02} width={w * 0.5} height={h * 0.05} rx={3} fill={cap} />
      <rect x={-w * 0.24} y={-h * 0.88} width={w * 0.48} height={h * 0.1} rx={4} fill={cap} />
      <rect x={-w / 2} y={-h * 0.8} width={w} height={h * 0.8} rx={w * 0.24} fill={body} />
      <rect x={-w * 0.36} y={-h * 0.72} width={w * 0.08} height={h * 0.56} rx={3} fill={v('petal-4')} opacity={0.35} />
      <rect x={-w * 0.26} y={-h * 0.5} width={w * 0.52} height={h * 0.16} rx={3} fill={v('petal-4')} opacity={0.5} />
    </g>
  )
}

// ------------------------------------------------------------------ 3 BỨC TRANH

const frame = 'M40 560 L40 250 A260 250 0 0 1 560 250 L560 560Z'

/** Tranh 1: hoa nở, bướm và bộ skincare/makeup */
export function BloomArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} role="img" aria-label="Minh họa: hoa, bướm và các sản phẩm skincare, makeup">
      <Defs id="bl" />
      <path d={frame} fill="url(#bl-sky)" />
      {/* Cành hoa phía sau */}
      <Stem d="M80 520 C 120 420 150 330 230 240" />
      <Stem d="M520 520 C 500 430 470 360 420 290" />
      <Leaf x={120} y={430} len={70} angle={-60} fill={v('leaf')} />
      <Leaf x={150} y={350} len={60} angle={-20} fill={v('leaf')} />
      <Leaf x={492} y={420} len={64} angle={-130} fill={v('leaf')} />
      <Leaf x={470} y={350} len={56} angle={-160} fill={v('leaf-2')} />
      <Peony x={230} y={238} r={58} outer={v('petal-2')} inner={v('petal-3')} />
      <Peony x={420} y={290} r={46} outer={v('petal-1')} inner={v('petal-4')} />
      <Blossom x={150} y={300} r={26} fill={v('petal-4')} rotate={12} />
      <Blossom x={330} y={180} r={22} fill={v('petal-2')} rotate={30} opacity={0.9} />
      <Blossom x={505} y={250} r={20} fill={v('petal-3')} rotate={-10} />
      <Blossom x={95} y={380} r={18} fill={v('petal-1')} />
      {/* Sản phẩm */}
      <ellipse cx={300} cy={548} rx={230} ry={14} fill={v('wing-line')} opacity={0.08} />
      <Jar x={170} y={545} w={120} body={v('petal-3')} lid={v('gold')} />
      <Dropper x={300} y={545} h={210} liquid="bl-liquid" />
      <Lipstick x={405} y={545} h={150} bullet={v('wing-2')} tube={v('wing-line')} />
      <Perfume x={480} y={545} w={80} liquid="bl-liquid" cap={v('gold')} />
      {/* Bướm */}
      <Butterfly x={455} y={150} s={1.25} rotate={14} gradient="bl-wing" />
      <Butterfly x={110} y={200} s={0.8} rotate={-18} gradient="bl-wing2" delay={0.6} />
      <Butterfly x={360} y={390} s={0.6} rotate={8} gradient="bl-wing" delay={1.2} />
    </svg>
  )
}

/** Tranh 2: tông đêm, lá nhiệt đới, đồ chăm sóc nam */
export function GroomArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} role="img" aria-label="Minh họa: lá nhiệt đới, bướm đêm và các sản phẩm chăm sóc nam">
      <Defs id="gr">
        <linearGradient id="gr-night" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor={v('night-2')} />
          <stop offset="1" stopColor={v('night-1')} />
        </linearGradient>
        <linearGradient id="gr-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={v('steel')} />
          <stop offset="1" stopColor={v('night-2')} />
        </linearGradient>
        <linearGradient id="gr-moth" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={v('moth')} />
          <stop offset="1" stopColor={v('gold')} />
        </linearGradient>
        <linearGradient id="gr-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v('gold')} />
          <stop offset="1" stopColor={v('moth')} />
        </linearGradient>
      </Defs>
      <path d={frame} fill="url(#gr-night)" />
      <circle cx={300} cy={250} r={150} fill="none" stroke={v('gold')} strokeWidth={1.5} opacity={0.5} />
      <circle cx={300} cy={250} r={190} fill="none" stroke={v('steel')} strokeWidth={0.8} opacity={0.35} strokeDasharray="2 8" />
      {/* Lá nhiệt đới */}
      <Leaf x={70} y={470} len={190} angle={-58} fill={v('leaf-2')} />
      <Leaf x={90} y={520} len={170} angle={-30} fill={v('leaf')} />
      <Leaf x={530} y={480} len={180} angle={-125} fill={v('leaf-2')} />
      <Leaf x={540} y={530} len={150} angle={-150} fill={v('leaf')} />
      <Blossom x={140} y={300} r={20} fill={v('moth')} opacity={0.85} />
      <Blossom x={470} y={240} r={16} fill={v('steel')} opacity={0.8} rotate={20} />
      {/* Sản phẩm */}
      <ellipse cx={300} cy={548} rx={220} ry={14} fill={v('night-1')} opacity={0.5} />
      <Pump x={215} y={545} h={250} body="url(#gr-steel)" cap={v('night-1')} />
      <Dropper x={315} y={545} h={170} liquid="gr-amber" />
      <Perfume x={420} y={545} w={120} liquid="gr-steel" cap={v('gold')} />
      <Jar x={130} y={545} w={90} body={v('steel')} lid={v('night-2')} />
      <Butterfly x={420} y={150} s={1.15} rotate={-12} gradient="gr-moth" />
      <Butterfly x={170} y={190} s={0.7} rotate={16} gradient="gr-moth" delay={0.8} />
    </svg>
  )
}

/** Tranh 3: chai nước hoa giữa vườn hoa, nhiều bướm */
export function ScentArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} role="img" aria-label="Minh họa: chai nước hoa giữa hoa và bướm">
      <Defs id="sc">
        <linearGradient id="sc-rose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v('petal-2')} />
          <stop offset="1" stopColor={v('petal-3')} />
        </linearGradient>
        <linearGradient id="sc-lav" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v('petal-1')} />
          <stop offset="1" stopColor={v('liquid-1')} />
        </linearGradient>
      </Defs>
      <path d={frame} fill="url(#sc-sky)" />
      <Stem d="M300 560 C 290 470 300 400 300 330" />
      <Stem d="M300 450 C 250 420 200 380 170 330" />
      <Stem d="M300 430 C 360 400 410 360 440 300" />
      <Leaf x={300} y={470} len={70} angle={-150} fill={v('leaf')} />
      <Leaf x={300} y={420} len={64} angle={-35} fill={v('leaf-2')} />
      <Peony x={300} y={300} r={64} outer={v('petal-1')} inner={v('petal-4')} />
      <Peony x={165} y={320} r={44} outer={v('petal-2')} inner={v('petal-3')} />
      <Peony x={445} y={290} r={48} outer={v('petal-3')} inner={v('petal-2')} />
      <Blossom x={230} y={210} r={20} fill={v('petal-4')} />
      <Blossom x={380} y={200} r={18} fill={v('petal-2')} rotate={22} />
      <Blossom x={110} y={250} r={14} fill={v('petal-1')} />
      <ellipse cx={300} cy={548} rx={230} ry={14} fill={v('wing-line')} opacity={0.08} />
      <Perfume x={190} y={545} w={110} liquid="sc-rose" cap={v('gold')} />
      <Perfume x={310} y={545} w={140} liquid="sc-lav" cap={v('wing-line')} />
      <Perfume x={430} y={545} w={95} liquid="sc-liquid" cap={v('gold')} />
      <Butterfly x={470} y={140} s={1} rotate={10} gradient="sc-wing" />
      <Butterfly x={120} y={150} s={0.9} rotate={-14} gradient="sc-wing2" delay={0.5} />
      <Butterfly x={300} y={120} s={0.65} rotate={4} gradient="sc-wing" delay={1.1} />
      <Butterfly x={520} y={380} s={0.55} rotate={-20} gradient="sc-wing2" delay={1.6} />
    </svg>
  )
}

/** Bướm nhỏ trang trí (dùng ở các khối khác) */
/**
 * Tranh 4: Skincare Architect 3D — khuôn mặt cách điệu với lưới 3D, các vùng thoa sáng lên theo thứ tự chu trình,
 * mặt trời (sáng) / mặt trăng (tối). Chỉ minh họa, không phải mô hình thật của module.
 */
export function RoutineArt({ className = '' }: { className?: string }) {
  const zones = [
    { x: 300, y: 222, n: 1, d: 0 },
    { x: 246, y: 318, n: 2, d: 0.5 },
    { x: 354, y: 318, n: 3, d: 1 },
    { x: 300, y: 402, n: 4, d: 1.5 },
  ]
  return (
    <svg viewBox="0 0 600 600" className={className} role="img" aria-label="Minh họa: khuôn mặt với lưới 3D và các vùng thoa theo thứ tự chu trình sáng – tối">
      <Defs id="rt">
        <radialGradient id="rt-face" cx="0.45" cy="0.38" r="0.7">
          <stop offset="0" stopColor={v('petal-4')} />
          <stop offset="1" stopColor={v('petal-3')} />
        </radialGradient>
        <radialGradient id="rt-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={v('wing-1')} stopOpacity={0.85} />
          <stop offset="1" stopColor={v('wing-1')} stopOpacity={0} />
        </radialGradient>
      </Defs>
      <path d={frame} fill="url(#rt-sky)" />
      {/* Mặt trời (sáng) và mặt trăng (tối) */}
      <g transform="translate(118 168)">
        <circle r={26} fill={v('heart')} opacity={0.9} />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M0 -36 L0 -46" stroke={v('heart')} strokeWidth={4} strokeLinecap="round" transform={`rotate(${i * 45})`} />
        ))}
      </g>
      <g transform="translate(482 168)">
        <circle r={28} fill={v('wing-1')} />
        <circle r={26} cx={12} cy={-8} fill="url(#rt-sky)" />
      </g>
      {/* Tóc + khuôn mặt */}
      <path d="M182 300 C 172 170 250 112 312 116 C 390 120 436 184 420 300 C 404 230 360 196 300 194 C 240 196 198 232 182 300Z" fill={v('hair')} />
      <ellipse cx={300} cy={315} rx={112} ry={142} fill="url(#rt-face)" />
      {/* Lưới 3D */}
      <g fill="none" stroke={v('wing-1')} strokeWidth={1.2} opacity={0.45}>
        {[-80, -40, 0, 40, 80].map((dx) => (
          <ellipse key={dx} cx={300} cy={315} rx={Math.abs(dx) || 1} ry={142} />
        ))}
        {[-100, -50, 0, 50, 100].map((dy) => {
          const ry = 142, rx = 112, k = Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))
          return <ellipse key={dy} cx={300} cy={315 + dy} rx={rx * k} ry={10 * k} />
        })}
      </g>
      {/* Mắt nhắm, nụ cười */}
      <path d="M248 300 Q 262 310 276 300 M324 300 Q 338 310 352 300" fill="none" stroke={v('hair')} strokeWidth={3} strokeLinecap="round" />
      <path d="M282 372 Q 300 384 318 372" fill="none" stroke={v('wing-2')} strokeWidth={4} strokeLinecap="round" />
      {/* Vùng thoa theo thứ tự */}
      {zones.map((z) => (
        <g key={z.n} transform={`translate(${z.x} ${z.y})`}>
          <circle r={30} fill="url(#rt-glow)" className="art-pulse" style={{ animationDelay: `${z.d}s` }} />
          <circle r={13} fill={v('wing-1')} />
          <text y={5} textAnchor="middle" fontSize={15} fontWeight={700} fill={v('petal-4')}>
            {z.n}
          </text>
        </g>
      ))}
      {/* Chai lọ */}
      <ellipse cx={300} cy={548} rx={230} ry={14} fill={v('wing-line')} opacity={0.08} />
      <Pump x={120} y={545} h={150} body={v('petal-1')} cap={v('gold')} />
      <Dropper x={480} y={545} h={170} liquid="rt-liquid" />
      <Jar x={395} y={545} w={84} body={v('petal-2')} lid={v('gold')} />
      <Butterfly x={470} y={300} s={0.75} rotate={12} gradient="rt-wing" delay={0.4} />
    </svg>
  )
}

export function ButterflyMark({ className = '', id = 'bm' }: { className?: string; id?: string }) {
  return (
    <svg viewBox="-60 -50 120 100" className={className} aria-hidden="true">
      <Defs id={id} />
      <Butterfly x={0} y={0} s={1} gradient={`${id}-wing`} />
    </svg>
  )
}
