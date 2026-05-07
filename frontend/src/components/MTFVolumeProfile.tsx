/**
 * Multi Timeframe Volume Profile — Trading IQ
 *
 * Shows volume profile (price×volume distribution) for 4 timeframes
 * simultaneously on a shared price axis.
 *
 * Each profile computes:
 *   POC  — Point of Control (price with highest volume)
 *   VAH  — Value Area High (upper edge of 70% volume zone)
 *   VAL  — Value Area Low  (lower edge of 70% volume zone)
 *
 * Trading IQ score (0-100) measures:
 *   Price vs POC alignment  (25 pts)
 *   Value Area position     (25 pts)
 *   Cross-TF POC confluence (25 pts)
 *   Volume structure        (25 pts)
 */
import { useEffect, useRef, useState } from 'react';
import type { PricePoint } from '../types';

/* ─── types ────────────────────────────────────────────────────────── */
interface Bucket {
  priceMin: number;
  priceMax: number;
  priceMid: number;
  volume: number;
  isPOC: boolean;
  isVA: boolean;
}

interface Profile {
  label: string;
  shortLabel: string;
  days: number;
  buckets: Bucket[];
  poc: number;
  pocVol: number;
  vah: number;
  val: number;
  totalVol: number;
  priceMin: number;
  priceMax: number;
}

interface IQBreakdown {
  category: string;
  score: number;
  max: number;
  reason: string;
  color: string;
}

interface IQResult {
  score: number;
  grade: string;
  gradeColor: string;
  setup: string;
  setupColor: string;
  signals: string[];
  breakdown: IQBreakdown[];
}

interface Props {
  data: PricePoint[];
  currentPrice: number;
  symbol?: string;
}

/* ─── computation helpers ──────────────────────────────────────────── */
const BUCKETS = 36;

function buildProfile(slice: PricePoint[], label: string, shortLabel: string, days: number): Profile | null {
  const valid = slice.filter(d => d.high != null && d.low != null && d.volume > 0);
  if (valid.length < 3) return null;

  const priceMin = Math.min(...valid.map(d => d.low));
  const priceMax = Math.max(...valid.map(d => d.high));
  if (priceMax <= priceMin) return null;

  const bSize = (priceMax - priceMin) / BUCKETS;
  const buckets: Bucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
    priceMin: priceMin + i * bSize,
    priceMax: priceMin + (i + 1) * bSize,
    priceMid: priceMin + (i + 0.5) * bSize,
    volume: 0, isPOC: false, isVA: false,
  }));

  valid.forEach(d => {
    const range = d.high - d.low || 0.001;
    buckets.forEach(b => {
      const overlap = Math.min(d.high, b.priceMax) - Math.max(d.low, b.priceMin);
      if (overlap > 0) b.volume += d.volume * (overlap / range);
    });
  });

  const totalVol = buckets.reduce((s, b) => s + b.volume, 0);
  const pocIdx = buckets.reduce((mi, b, i, arr) => b.volume > arr[mi].volume ? i : mi, 0);
  buckets[pocIdx].isPOC = true;

  let vaVol = buckets[pocIdx].volume;
  let lo = pocIdx, hi = pocIdx;
  while (vaVol < totalVol * 0.70 && (lo > 0 || hi < BUCKETS - 1)) {
    const addLo = lo > 0 ? buckets[lo - 1].volume : 0;
    const addHi = hi < BUCKETS - 1 ? buckets[hi + 1].volume : 0;
    if (addHi >= addLo && hi < BUCKETS - 1) { hi++; vaVol += buckets[hi].volume; }
    else if (lo > 0) { lo--; vaVol += buckets[lo].volume; }
    else break;
  }
  for (let i = lo; i <= hi; i++) buckets[i].isVA = true;

  return {
    label, shortLabel, days, buckets,
    poc: buckets[pocIdx].priceMid,
    pocVol: buckets[pocIdx].volume,
    vah: buckets[hi].priceMax,
    val: buckets[lo].priceMin,
    totalVol, priceMin, priceMax,
  };
}

function computeIQ(profiles: Profile[], currentPrice: number): IQResult {
  const signals: string[] = [];
  const breakdown: IQBreakdown[] = [];

  // 1. Price vs long-TF POC (25 pts)
  const longP = profiles[profiles.length - 1];
  const pocPct = longP ? (currentPrice - longP.poc) / longP.poc * 100 : 0;
  let pocScore = 0;
  let pocReason = '';
  if (pocPct > 3)         { pocScore = 25; pocReason = `מחיר ${pocPct.toFixed(1)}% מעל POC ארוך-טווח`; signals.push('📈 מחיר מעל POC — עוצמה שורית'); }
  else if (pocPct > -1)   { pocScore = 16; pocReason = `מחיר קרוב ל-POC (${pocPct.toFixed(1)}%)`; signals.push('⚖️ מחיר ב-POC — נקודת החלטה'); }
  else if (pocPct > -5)   { pocScore = 9;  pocReason = `מחיר ${Math.abs(pocPct).toFixed(1)}% מתחת ל-POC`; }
  else                    { pocScore = 3;  pocReason = `מחיר רחוק מ-POC (${pocPct.toFixed(1)}%)`; signals.push('📉 מחיר מתחת ל-POC — לחץ דובי'); }
  breakdown.push({ category: 'מחיר vs POC', score: pocScore, max: 25, reason: pocReason, color: pocScore >= 20 ? '#22c55e' : pocScore >= 12 ? '#f59e0b' : '#ef4444' });

  // 2. Value Area position (25 pts)
  let vaScore = 0, vaReason = '';
  if (longP) {
    if (currentPrice > longP.vah) {
      vaScore = 25; vaReason = 'מחיר מעל Value Area — פריצה שורית';
      signals.push('🚀 פריצת Value Area מעלה');
    } else if (currentPrice >= longP.val) {
      const relPos = (currentPrice - longP.val) / (longP.vah - longP.val);
      vaScore = relPos > 0.5 ? 20 : 14;
      vaReason = `מחיר בתוך Value Area (${(relPos*100).toFixed(0)}%)`;
      signals.push('📊 מחיר בתוך Value Area');
    } else {
      vaScore = 5; vaReason = 'מחיר מתחת ל-Value Area — נפח דובי';
      signals.push('⚠️ מחיר מתחת ל-Value Area');
    }
  }
  breakdown.push({ category: 'Value Area', score: vaScore, max: 25, reason: vaReason, color: vaScore >= 20 ? '#22c55e' : vaScore >= 12 ? '#f59e0b' : '#ef4444' });

  // 3. Cross-TF POC confluence (25 pts)
  const pocDists = profiles.map(p => Math.abs(currentPrice - p.poc) / currentPrice * 100);
  const closePOCs = pocDists.filter(d => d < 2.5).length;
  const confluenceScore = Math.min(25, closePOCs * 8 + (closePOCs >= 2 ? 4 : 0));
  const confReason = closePOCs >= 3 ? `${closePOCs} POC בקונפלואנס — אזור מפתח!`
    : closePOCs >= 2 ? `${closePOCs} POC קרובים — תמיכה/התנגדות טובה`
    : 'אין קונפלואנס POC משמעותי';
  if (closePOCs >= 2) signals.push(`🎯 קונפלואנס ${closePOCs} POC ב-2.5% מהמחיר`);
  breakdown.push({ category: 'קונפלואנס POC', score: confluenceScore, max: 25, reason: confReason, color: confluenceScore >= 20 ? '#22c55e' : confluenceScore >= 10 ? '#f59e0b' : '#6b7280' });

  // 4. Volume structure — short POC vs long POC (25 pts)
  const shortP = profiles[0];
  let structScore = 0, structReason = '';
  if (shortP && longP) {
    const structPct = (shortP.poc - longP.poc) / longP.poc * 100;
    if (structPct > 2)   { structScore = 25; structReason = 'POC קצר > POC ארוך — מבנה שורי'; signals.push('🏗️ מבנה נפח שורי'); }
    else if (structPct > -1) { structScore = 16; structReason = 'POC קצר ≈ POC ארוך — מבנה ניטרלי'; }
    else                 { structScore = 6;  structReason = 'POC קצר < POC ארוך — מבנה דובי'; signals.push('⬇️ מבנה נפח דובי'); }
  }
  breakdown.push({ category: 'מבנה נפח', score: structScore, max: 25, reason: structReason, color: structScore >= 20 ? '#22c55e' : structScore >= 12 ? '#f59e0b' : '#ef4444' });

  const total = pocScore + vaScore + confluenceScore + structScore;
  const grade = total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : total >= 35 ? 'D' : 'F';
  const gradeColor = total >= 80 ? '#00c896' : total >= 65 ? '#22c55e' : total >= 50 ? '#f59e0b' : total >= 35 ? '#f97316' : '#ef4444';
  const setup = total >= 70 ? 'LONG SETUP' : total >= 50 ? 'NEUTRAL' : 'SHORT SETUP';
  const setupColor = total >= 70 ? '#00c896' : total >= 50 ? '#f59e0b' : '#ef4444';

  return { score: Math.min(100, total), grade, gradeColor, setup, setupColor, signals, breakdown };
}

/* ─── canvas renderer ──────────────────────────────────────────────── */
function renderMTF(
  canvas: HTMLCanvasElement,
  profiles: Profile[],
  currentPrice: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !profiles.length) return;

  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070b17');
  bg.addColorStop(1, '#0c1222');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const PRICE_W = 64, HDR_H = 26, FOOT_H = 8;
  const chartH   = H - HDR_H - FOOT_H;
  const colW     = (W - PRICE_W) / profiles.length;

  // Global price range (shared axis)
  const globalMin = Math.min(...profiles.map(p => p.priceMin)) * 0.998;
  const globalMax = Math.max(...profiles.map(p => p.priceMax)) * 1.002;
  const gRange = globalMax - globalMin || 1;

  const priceToY = (p: number) =>
    HDR_H + chartH - ((p - globalMin) / gRange) * chartH;

  // ── Horizontal grid ──
  const gridSteps = 8;
  for (let i = 0; i <= gridSteps; i++) {
    const y = HDR_H + (i / gridSteps) * chartH;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W - PRICE_W, y);
    ctx.stroke();
  }

  // ── Per-profile columns ──
  profiles.forEach((prof, pi) => {
    const x0 = pi * colW;
    const maxBVol = Math.max(...prof.buckets.map(b => b.volume), 1);

    // Column separator
    if (pi > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x0, 0, 1, H);
    }

    // Header background
    const headerGrad = ctx.createLinearGradient(x0, 0, x0 + colW, 0);
    headerGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
    headerGrad.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(x0, 0, colW, HDR_H);

    // Header text
    ctx.fillStyle = 'rgba(209,213,219,.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(prof.shortLabel, x0 + colW / 2, HDR_H - 8);

    // Volume buckets (horizontal bars, left-filled)
    prof.buckets.forEach(b => {
      if (b.volume <= 0) return;
      const y1 = priceToY(b.priceMax);
      const y2 = priceToY(b.priceMin);
      const bH = Math.max(1, y2 - y1 - 0.5);
      const barW = (b.volume / maxBVol) * (colW - 8);

      if (b.isPOC) {
        const g = ctx.createLinearGradient(x0 + 4, 0, x0 + 4 + barW, 0);
        g.addColorStop(0, 'rgba(234,179,8,0.95)');
        g.addColorStop(1, 'rgba(234,179,8,0.35)');
        ctx.fillStyle = g;
      } else if (b.isVA) {
        const g = ctx.createLinearGradient(x0 + 4, 0, x0 + 4 + barW, 0);
        g.addColorStop(0, 'rgba(59,130,246,0.65)');
        g.addColorStop(1, 'rgba(59,130,246,0.15)');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = 'rgba(107,114,128,0.28)';
      }
      ctx.fillRect(x0 + 4, y1, barW, bH);
    });

    // POC dashed line
    const pocY = priceToY(prof.poc);
    ctx.strokeStyle = 'rgba(234,179,8,0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x0, pocY); ctx.lineTo(x0 + colW, pocY); ctx.stroke();
    ctx.setLineDash([]);

    // VAH / VAL dashed lines
    for (const lvl of [prof.vah, prof.val]) {
      const ly = priceToY(lvl);
      ctx.strokeStyle = 'rgba(59,130,246,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x0 + colW, ly); ctx.stroke();
      ctx.setLineDash([]);
    }

    // POC price label (right side of column)
    ctx.fillStyle = 'rgba(234,179,8,0.8)';
    ctx.font = '8.5px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${prof.poc.toFixed(1)}`, x0 + colW - 3, pocY - 2);
  });

  // ── Current price line ──
  const cpY = priceToY(currentPrice);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 3]);
  ctx.beginPath(); ctx.moveTo(0, cpY); ctx.lineTo(W - PRICE_W, cpY); ctx.stroke();
  ctx.setLineDash([]);

  // CP label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`▶ $${currentPrice.toFixed(2)}`, W - PRICE_W + 4, cpY + 4);

  // ── Price axis ──
  ctx.fillStyle = 'rgba(156,163,175,0.65)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const price = globalMin + (gRange * i / steps);
    const y = priceToY(price);
    if (y < HDR_H + 6 || y > H - FOOT_H - 4) continue;
    ctx.fillText(`$${price.toFixed(0)}`, W - PRICE_W + 4, y + 3.5);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - PRICE_W, y); ctx.stroke();
  }

  // ── Column labels: POC, VAH, VAL legend ──
  // (bottom strip)
}

/* ─── IQ Score Arc ──────────────────────────────────────────────────── */
function IQGauge({ score, grade, color }: { score: number; grade: string; color: string }) {
  const R = 48, SW = 11, cx = 60, cy = 60;
  const startAngle = (215 * Math.PI) / 180;
  const sweep = Math.min(1, score / 100) * 250;
  const endAngle = startAngle + (sweep * Math.PI) / 180;
  const px = (a: number) => ({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  const s = px(startAngle), e = px(endAngle);
  const large = sweep > 180 ? 1 : 0;
  const arc = score < 1
    ? ''
    : `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;

  // Gradient stops for the arc
  const gradId = `iq-grad-${score}`;
  return (
    <svg width={120} height={90} viewBox="0 0 120 90">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#00c896" />
        </linearGradient>
      </defs>
      {/* track */}
      <path
        d={`M ${px(startAngle).x} ${px(startAngle).y} A ${R} ${R} 0 1 1 ${px((325 * Math.PI) / 180).x} ${px((325 * Math.PI) / 180).y}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} strokeLinecap="round"
      />
      {arc && (
        <path d={arc} fill="none" stroke={`url(#${gradId})`} strokeWidth={SW} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      )}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={18} fontWeight={900} fill="#fff" fontFamily="monospace">{score}</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize={11} fontWeight={800} fill={color} fontFamily="monospace">{grade}</text>
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={8} fill="rgba(156,163,175,.7)" fontFamily="monospace">IQ SCORE</text>
    </svg>
  );
}

/* ─── main component ───────────────────────────────────────────────── */
const TF_DEFS = [
  { label: '5 ימים',    shortLabel: '5D',  days: 5  },
  { label: 'חודש',      shortLabel: '1M',  days: 21 },
  { label: '3 חודשים',  shortLabel: '3M',  days: 63 },
  { label: '6 חודשים',  shortLabel: '6M',  days: 126 },
];

export default function MTFVolumeProfile({ data, currentPrice, symbol }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(900);
  const [canvasH, setCanvasH] = useState(320);
  const [showSignals, setShowSignals] = useState(true);

  // Build profiles
  const profiles: Profile[] = TF_DEFS.map(tf => {
    const slice = data.slice(-tf.days);
    return buildProfile(slice, tf.label, tf.shortLabel, tf.days);
  }).filter((p): p is Profile => p !== null);

  const iq = profiles.length >= 2 ? computeIQ(profiles, currentPrice) : null;

  // Responsive canvas width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setCanvasW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Render canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !profiles.length) return;
    c.width  = canvasW;
    c.height = canvasH;
    renderMTF(c, profiles, currentPrice);
  }, [profiles, currentPrice, canvasW, canvasH]);

  if (!profiles.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '.82rem' }}>
        אין מספיק נתונים לבניית Volume Profile
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Canvas ── */}
      <div ref={wrapRef} style={{
        width: '100%', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}>
        <canvas ref={canvasRef} width={canvasW} height={canvasH} style={{ display: 'block', width: '100%' }} />
      </div>

      {/* ── Legend row ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', paddingRight: 4 }}>
        {[
          { color: '#eab308', label: 'POC — נקודת שליטה (נפח מקסימלי)' },
          { color: '#3b82f6', label: 'Value Area (70% מהנפח)' },
          { color: 'rgba(107,114,128,0.6)', label: 'מחוץ ל-Value Area' },
          { color: '#fff', label: '— מחיר נוכחי' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, background: color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Per-TF summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {profiles.map((p, i) => {
          const priceInVA = currentPrice >= p.val && currentPrice <= p.vah;
          const aboveVA   = currentPrice > p.vah;
          const pocDist   = ((currentPrice - p.poc) / p.poc * 100);
          return (
            <div key={i} style={{
              background: 'var(--bg2)',
              border: `1px solid ${priceInVA ? 'rgba(59,130,246,.3)' : aboveVA ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.25)'}`,
              borderTop: `3px solid ${priceInVA ? '#3b82f6' : aboveVA ? '#22c55e' : '#ef4444'}`,
              borderRadius: 10, padding: '10px 10px 8px',
            }}>
              <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                {p.label} ({p.days}d)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  { lbl: 'POC',  val: `$${p.poc.toFixed(2)}`,  color: '#eab308' },
                  { lbl: 'VAH',  val: `$${p.vah.toFixed(2)}`,  color: '#60a5fa' },
                  { lbl: 'VAL',  val: `$${p.val.toFixed(2)}`,  color: '#60a5fa' },
                ].map(({ lbl, val, color }) => (
                  <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{lbl}</span>
                    <span style={{ fontSize: '.68rem', fontWeight: 700, color, fontFamily: 'monospace' }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>vs POC</span>
                  <span style={{ fontSize: '.65rem', fontWeight: 700, fontFamily: 'monospace', color: pocDist >= 0 ? '#22c55e' : '#ef4444' }}>
                    {pocDist >= 0 ? '+' : ''}{pocDist.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Trading IQ ── */}
      {iq && (
        <div style={{
          background: 'var(--bg2)',
          border: `1px solid ${iq.gradeColor}30`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* IQ header */}
          <div style={{
            background: `linear-gradient(135deg, ${iq.gradeColor}18 0%, transparent 60%)`,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            borderBottom: '1px solid var(--border)',
          }}>
            <IQGauge score={iq.score} grade={iq.grade} color={iq.gradeColor} />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Trading IQ — ניתוח Volume Profile רב-טווח
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: `${iq.setupColor}18`,
                border: `1px solid ${iq.setupColor}40`,
                borderRadius: 8, padding: '4px 12px', marginBottom: 8,
              }}>
                <span style={{ fontSize: '.85rem', fontWeight: 900, color: iq.setupColor }}>
                  {iq.setup === 'LONG SETUP' ? '📈' : iq.setup === 'SHORT SETUP' ? '📉' : '⚖️'} {iq.setup}
                </span>
              </div>

              {/* Score breakdown bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {iq.breakdown.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '.62rem', color: 'var(--muted)', minWidth: 90, textAlign: 'right' }}>{b.category}</span>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(b.score / b.max) * 100}%`,
                        background: b.color,
                        borderRadius: 3, transition: 'width .4s',
                      }} />
                    </div>
                    <span style={{ fontSize: '.65rem', fontWeight: 700, color: b.color, minWidth: 30, fontFamily: 'monospace' }}>
                      {b.score}/{b.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Signals */}
          {iq.signals.length > 0 && (
            <div style={{ padding: '10px 16px' }}>
              <button
                onClick={() => setShowSignals(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '.68rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
              >
                {showSignals ? '▲' : '▼'} אותות ({iq.signals.length})
              </button>
              {showSignals && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {iq.signals.map((sig, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: 7, padding: '6px 10px',
                      fontSize: '.75rem', color: 'var(--text)',
                    }}>
                      {sig}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Breakdown detail */}
          <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {iq.breakdown.map((b, i) => (
              <div key={i} style={{ fontSize: '.68rem', color: 'var(--text2)', display: 'flex', gap: 6 }}>
                <span style={{ color: b.color, fontWeight: 700, minWidth: 6 }}>•</span>
                <span style={{ color: 'var(--muted)', minWidth: 90 }}>{b.category}:</span>
                <span>{b.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Methodology note ── */}
      <p style={{ fontSize: '.6rem', color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
        * Volume Profile מחושב לפי חלוקת הנפח לפי רמות מחיר בכל טווח זמן. POC = נקודת השליטה (הרמה עם הנפח הגבוה ביותר).
        Value Area = טווח המחירים שבו נסחרו 70% מהנפח. אזורי קונפלואנס (ריבוי POC) = רמות תמיכה/התנגדות חזקות.
        Trading IQ Score מודד את מיקום המחיר הנוכחי ביחס לפרופילי הנפח של כל הטווחים.
      </p>
    </div>
  );
}
