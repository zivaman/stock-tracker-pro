/**
 * Trend Speed Analyzer — Zyerman
 * 3D-perspective bar chart showing trend speed, acceleration & zone.
 *
 * Calculation:
 *   Weighted ROC = ROC(3)×0.40 + ROC(5)×0.30 + ROC(10)×0.20 + ROC(20)×0.10
 *   Normalized to -100 … +100 range over the visible window.
 *   Volume-weighted boost: bars with vol > 1.5× average are brighter.
 *   Acceleration = change in speed between consecutive bars.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PricePoint } from '../types';

/* ─── types ─────────────────────────────────────────────────────── */
interface TrendBar {
  date: string;
  speed: number;        // normalised -100..100
  rawRoc: number;
  acceleration: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  volRatio: number;
  close: number;
}

interface ZoneInfo {
  zone: string;
  color: string;
  label: string;
  emoji: string;
}

interface Props {
  data: PricePoint[];
  symbol?: string;
}

/* ─── computation ────────────────────────────────────────────────── */
function computeTrendBars(data: PricePoint[]): TrendBar[] {
  if (data.length < 25) return [];
  const bars: TrendBar[] = [];

  for (let i = 20; i < data.length; i++) {
    const d = data[i];
    if (d.close == null) continue;

    const roc  = (p: number) => i >= p && data[i - p].close
      ? ((d.close - data[i - p].close) / data[i - p].close) * 100
      : 0;

    const rawRoc = roc(3) * 0.40 + roc(5) * 0.30 + roc(10) * 0.20 + roc(20) * 0.10;

    const slice = data.slice(Math.max(0, i - 20), i);
    const avgVol = slice.length
      ? slice.reduce((s, x) => s + x.volume, 0) / slice.length
      : 1;
    const volRatio = avgVol > 0 ? d.volume / avgVol : 1;

    const acceleration = bars.length ? rawRoc - bars[bars.length - 1].rawRoc : 0;

    bars.push({
      date: d.date,
      speed: rawRoc,
      rawRoc,
      acceleration,
      direction: rawRoc > 0.3 ? 'bullish' : rawRoc < -0.3 ? 'bearish' : 'neutral',
      volRatio,
      close: d.close,
    });
  }

  // normalise to -100..100
  const maxAbs = Math.max(...bars.map(b => Math.abs(b.speed)), 0.001);
  bars.forEach(b => { b.speed = Math.max(-100, Math.min(100, (b.speed / maxAbs) * 100)); });
  return bars;
}

function getZone(bars: TrendBar[]): ZoneInfo {
  if (!bars.length) return { zone: 'SIDEWAYS', color: '#6b7280', label: 'תנועה צידית', emoji: '➡' };
  const { speed } = bars[bars.length - 1];
  if (speed > 65)  return { zone: 'BULLISH_FAST',  color: '#00c896', label: 'מגמה שורית מהירה',  emoji: '🚀' };
  if (speed > 20)  return { zone: 'BULLISH_SLOW',  color: '#22c55e', label: 'מגמה שורית מתונה',  emoji: '📈' };
  if (speed < -65) return { zone: 'BEARISH_FAST',  color: '#f04060', label: 'מגמה דובית מהירה',  emoji: '🔻' };
  if (speed < -20) return { zone: 'BEARISH_SLOW',  color: '#ef4444', label: 'מגמה דובית מתונה',  emoji: '📉' };
  return { zone: 'SIDEWAYS',     color: '#f59e0b', label: 'תנועה צידית / איחוד', emoji: '⚖️' };
}

/* ─── canvas 3-D renderer ────────────────────────────────────────── */
function drawBar3D(
  ctx: CanvasRenderingContext2D,
  x: number, baseY: number,
  w: number, h: number,
  depth: number,
  front: string, top: string, side: string,
) {
  // front face
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.rect(x, baseY - h, w, h);
  ctx.fill();

  // top face
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x,         baseY - h);
  ctx.lineTo(x + w,     baseY - h);
  ctx.lineTo(x + w + depth, baseY - h - depth * 0.45);
  ctx.lineTo(x     + depth, baseY - h - depth * 0.45);
  ctx.closePath();
  ctx.fill();

  // right side face
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x + w,         baseY - h);
  ctx.lineTo(x + w + depth, baseY - h - depth * 0.45);
  ctx.lineTo(x + w + depth, baseY     - depth * 0.45);
  ctx.lineTo(x + w,         baseY);
  ctx.closePath();
  ctx.fill();
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  bars: TrendBar[],
  windowSize: number,
  darkMode: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const visible = bars.slice(-windowSize);
  const N = visible.length;
  if (!N) return;

  // clear
  ctx.clearRect(0, 0, W, H);

  // background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#080c18');
  bg.addColorStop(1, '#0d1425');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const ML = 50, MR = 30, MT = 28, MB = 50;
  const chartW = W - ML - MR;
  const chartH = H - MT - MB;

  const DEPTH = 8;
  const slotW = Math.max(8, Math.floor(chartW / N));
  const barW = Math.max(4, slotW - 3);
  const maxBarH = chartH * 0.80;
  const baseY = MT + chartH;

  // ── perspective floor grid ──
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  // horizontal grid lines
  for (let pct of [0, 0.25, 0.5, 0.75, 1.0]) {
    const y = baseY - pct * maxBarH;
    ctx.beginPath();
    ctx.moveTo(ML, y);
    ctx.lineTo(ML + N * slotW, y);
    ctx.stroke();
  }
  // vertical grid lines
  for (let i = 0; i <= N; i += Math.max(1, Math.floor(N / 10))) {
    const x = ML + i * slotW;
    ctx.beginPath();
    ctx.moveTo(x, MT);
    ctx.lineTo(x, baseY);
    ctx.stroke();
  }
  // floor depth lines (3D illusion)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i <= N; i += Math.max(1, Math.floor(N / 10))) {
    const x = ML + i * slotW;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + DEPTH, baseY - DEPTH * 0.45);
    ctx.stroke();
  }
  // floor base line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ML, baseY);
  ctx.lineTo(ML + N * slotW + DEPTH, baseY - DEPTH * 0.45);
  ctx.stroke();

  // ── zero line ──
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ML, baseY);
  ctx.lineTo(ML + N * slotW, baseY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── speed line (sparkline overlay) ──
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(251,191,36,0.45)';
  ctx.lineWidth = 1.5;
  visible.forEach((b, i) => {
    const cx = ML + i * slotW + barW / 2;
    const cy = baseY - (b.speed / 100) * maxBarH;
    if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  // ── 3D bars ──
  visible.forEach((bar, i) => {
    const x = ML + i * slotW;
    const absSpeed = Math.abs(bar.speed);
    const h = Math.max(2, (absSpeed / 100) * maxBarH);
    const alpha = 0.55 + (absSpeed / 100) * 0.45;
    const volBright = bar.volRatio > 1.5 ? 0.25 : 0;

    // upward = green, downward = red, neutral = amber
    let rF: string, rT: string, rS: string;
    if (bar.direction === 'bullish') {
      rF = `rgba(${Math.round(0  + volBright*80)},${Math.round(200 + volBright*55)},${Math.round(150)},${alpha})`;
      rT = `rgba(${Math.round(110+ volBright*60)},${Math.round(231)},${Math.round(183)},0.9)`;
      rS = `rgba(0,130,90,${alpha * 0.75})`;
    } else if (bar.direction === 'bearish') {
      rF = `rgba(${Math.round(240+volBright*15)},${Math.round(64)},${Math.round(96)},${alpha})`;
      rT = `rgba(252,165,165,0.9)`;
      rS = `rgba(160,20,50,${alpha * 0.75})`;
    } else {
      rF = `rgba(245,158,11,${alpha})`;
      rT = `rgba(253,230,138,0.9)`;
      rS = `rgba(180,110,0,${alpha * 0.75})`;
    }

    drawBar3D(ctx, x, baseY, barW, h, DEPTH, rF, rT, rS);

    // highlight last bar
    if (i === N - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, baseY - h, barW, h);
    }
  });

  // ── Y-axis labels ──
  ctx.fillStyle = 'rgba(156,163,175,0.8)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (const pct of [0, 0.5, 1.0]) {
    const y = baseY - pct * maxBarH;
    const label = pct === 0 ? '0' : pct === 0.5 ? '50' : '100';
    ctx.fillText(label, ML - 6, y + 4);
  }

  // ── X-axis date labels (every ~10 bars) ──
  ctx.fillStyle = 'rgba(156,163,175,0.7)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(N / 6));
  for (let i = 0; i < N; i += step) {
    const x = ML + i * slotW + barW / 2;
    const lbl = visible[i].date.slice(5); // MM-DD
    ctx.fillText(lbl, x, baseY + 14);
  }

  // ── "Zyerman" watermark ──
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ZYERMAN', W / 2, H / 2 + 10);
  ctx.restore();
}

/* ─── speed gauge (SVG arc) ─────────────────────────────────────── */
function SpeedGauge({ speed, color }: { speed: number; color: string }) {
  const abs = Math.abs(speed);
  const R = 44, SW = 10;
  const cx = 56, cy = 56;
  // arc: 210° sweep (from 210° clockwise to 210° + 210°)
  const startAngle = (210 * Math.PI) / 180;
  const sweepDeg = (abs / 100) * 210;
  const endAngle = startAngle + (sweepDeg * Math.PI) / 180;
  const p = (a: number) => ({
    x: cx + R * Math.cos(a),
    y: cy + R * Math.sin(a),
  });
  const s = p(startAngle);
  const e = p(endAngle);
  const large = sweepDeg > 180 ? 1 : 0;
  const arcPath = abs < 1
    ? ''
    : `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;

  return (
    <svg width={112} height={80} viewBox="0 0 112 80">
      {/* track */}
      <path
        d={`M ${p(startAngle).x} ${p(startAngle).y} A ${R} ${R} 0 1 1 ${p((30 * Math.PI) / 180).x} ${p((30 * Math.PI) / 180).y}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={SW} strokeLinecap="round"
      />
      {/* fill */}
      {arcPath && (
        <path
          d={arcPath}
          fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
      {/* value */}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={16} fontWeight={800} fill="#fff" fontFamily="monospace">
        {abs.toFixed(0)}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={8.5} fill="rgba(156,163,175,.8)" fontFamily="monospace">
        SPEED
      </text>
    </svg>
  );
}

/* ─── main component ─────────────────────────────────────────────── */
const WINDOW_OPTIONS = [20, 30, 50, 80];

export default function TrendSpeedAnalyzer({ data, symbol }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);
  const [winSize,   setWinSize]   = useState(50);
  const [canvasW,   setCanvasW]   = useState(800);

  const allBars  = computeTrendBars(data);
  const visiBars = allBars.slice(-winSize);
  const zone     = getZone(allBars);
  const last     = allBars[allBars.length - 1];
  const prev     = allBars[allBars.length - 2];
  const accel    = last ? last.acceleration : 0;
  const accelDir = accel > 0.5 ? '▲' : accel < -0.5 ? '▼' : '➡';
  const accelColor = accel > 0.5 ? '#00c896' : accel < -0.5 ? '#f04060' : '#f59e0b';

  // measure container width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setCanvasW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // redraw
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !allBars.length) return;
    c.width  = canvasW;
    c.height = 280;
    renderCanvas(c, allBars, winSize, true);
  }, [allBars, winSize, canvasW]);

  const btn = (active: boolean) => ({
    padding: '3px 10px', borderRadius: 6, fontSize: '.7rem', fontWeight: 600,
    border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
    background: active ? 'rgba(59,130,246,.15)' : 'transparent',
    color: active ? 'var(--blue)' : 'var(--muted)',
    cursor: 'pointer',
  } as React.CSSProperties);

  if (!allBars.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '.82rem' }}>
        אין מספיק נתוני מחיר לחישוב מהירות מגמה (נדרשים לפחות 25 בארים)
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Top bar: zone + stats + window selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>

        {/* Zone badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: `${zone.color}14`,
          border: `1px solid ${zone.color}40`,
          borderRadius: 10, padding: '6px 14px',
        }}>
          <span style={{ fontSize: '1.1rem' }}>{zone.emoji}</span>
          <div>
            <div style={{ fontSize: '.78rem', fontWeight: 800, color: zone.color }}>{zone.label}</div>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{zone.zone}</div>
          </div>
        </div>

        {/* Current speed stats */}
        {last && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>מהירות</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: zone.color, fontFamily: 'monospace' }}>
                {last.speed > 0 ? '+' : ''}{last.speed.toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>תאוצה</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: accelColor, fontFamily: 'monospace' }}>
                {accelDir} {Math.abs(accel).toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>נפח יחסי</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: last.volRatio > 1.5 ? '#f59e0b' : 'var(--text)', fontFamily: 'monospace' }}>
                {last.volRatio.toFixed(2)}×
              </div>
            </div>
          </div>
        )}

        {/* Window selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {WINDOW_OPTIONS.map(w => (
            <button key={w} style={btn(winSize === w)} onClick={() => setWinSize(w)}>
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3D Canvas ── */}
      <div ref={wrapRef} style={{
        width: '100%', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={280}
          style={{ display: 'block', width: '100%' }}
        />
      </div>

      {/* ── Bottom info row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>

        {/* Speed gauge */}
        {last && <SpeedGauge speed={last.speed} color={zone.color} />}

        {/* Last 5 bars mini-table */}
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '.6rem', color: 'var(--muted)', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            5 בארים אחרונים
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {allBars.slice(-5).reverse().map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.62rem', color: 'var(--muted)', fontFamily: 'monospace', minWidth: 55 }}>
                  {b.date.slice(5)}
                </span>
                {/* speed bar */}
                <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.abs(b.speed)}%`,
                    background: b.direction === 'bullish' ? '#00c896' : b.direction === 'bearish' ? '#f04060' : '#f59e0b',
                    borderRadius: 3,
                    transition: 'width .3s',
                  }} />
                </div>
                <span style={{ fontSize: '.65rem', fontWeight: 700, fontFamily: 'monospace', minWidth: 40, color: b.direction === 'bullish' ? '#00c896' : b.direction === 'bearish' ? '#f04060' : '#f59e0b' }}>
                  {b.speed > 0 ? '+' : ''}{b.speed.toFixed(1)}
                </span>
                <span style={{ fontSize: '.6rem', color: 'var(--muted)', fontFamily: 'monospace', minWidth: 36 }}>
                  {b.volRatio.toFixed(1)}×v
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Acceleration detail */}
        {last && (
          <div style={{
            background: `${accelColor}10`,
            border: `1px solid ${accelColor}30`,
            borderRadius: 10, padding: '10px 14px',
            textAlign: 'center', minWidth: 90,
          }}>
            <div style={{ fontSize: '1.6rem' }}>{accelDir}</div>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: accelColor }}>תאוצה</div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 2 }}>
              {accel > 0.5 ? 'מגמה מתחזקת' : accel < -0.5 ? 'מגמה מחלישה' : 'מגמה יציבה'}
            </div>
          </div>
        )}
      </div>

      {/* ── Formula legend ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px',
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: '.6rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Zyerman Formula:
        </span>
        {[
          { label: 'ROC(3)', w: '40%', color: '#60a5fa' },
          { label: 'ROC(5)', w: '30%', color: '#34d399' },
          { label: 'ROC(10)', w: '20%', color: '#f59e0b' },
          { label: 'ROC(20)', w: '10%', color: '#a78bfa' },
        ].map(({ label, w, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '.62rem', color: 'var(--text2)' }}>{label}</span>
            <span style={{ fontSize: '.62rem', color, fontWeight: 700 }}>×{w}</span>
          </div>
        ))}
        <span style={{ fontSize: '.6rem', color: 'var(--muted)', marginRight: 'auto' }}>
          עמודות גבוהות + נפח גבוה = אות חזק
        </span>
      </div>
    </div>
  );
}
