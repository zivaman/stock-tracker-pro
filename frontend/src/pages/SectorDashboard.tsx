import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface StockRow {
  symbol: string;
  name: string;
  price: number;
  change_1d: number | null;
  change_1m: number | null;
  change_3m: number | null;
  high_52w: number;
  low_52w: number;
  pct_from_high: number;
  pct_from_low: number;
  volume: number;
  avg_volume: number;
  vol_ratio: number;
  market_cap: number | null;
  week_prices: number[];
  week_volumes: number[];
  trend_signal: 'bullish' | 'bearish' | 'weak_up' | 'weak_down' | 'neutral';
}

interface SectorData {
  emoji: string;
  color: string;
  stocks: StockRow[];
}

interface SectorsResponse {
  sectors: Record<string, SectorData>;
  attractive: StockRow[];
}

/* ─── helpers ─── */
function fmtCap(v: number | null) {
  if (!v) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

function PctBadge({ v, size = 'sm' }: { v: number | null; size?: 'sm' | 'md' }) {
  if (v == null) return <span style={{ color: 'var(--muted)', fontSize: '.65rem' }}>—</span>;
  const up = v >= 0;
  return (
    <span style={{
      fontSize: size === 'md' ? '.78rem' : '.68rem',
      fontWeight: 700, fontFamily: 'monospace',
      color: up ? '#00c896' : '#f04060',
    }}>
      {up ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

/* ─── Trend badge ─── */
const TREND_CFG = {
  bullish:    { label: 'שורי 🚀',   color: '#00c896', bg: 'rgba(0,200,150,0.12)',   desc: 'מחיר ↑ + נפח ↑' },
  weak_up:    { label: 'עלייה חלשה', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  desc: 'מחיר ↑ + נפח ↓' },
  bearish:    { label: 'דובי 🐻',    color: '#f04060', bg: 'rgba(240,64,96,0.10)',   desc: 'מחיר ↓ + נפח ↑' },
  weak_down:  { label: 'ירידה חלשה', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  desc: 'מחיר ↓ + נפח ↓' },
  neutral:    { label: 'ניטרלי',     color: '#6b7280', bg: 'rgba(107,114,128,0.08)', desc: '' },
};

function TrendBadge({ signal }: { signal: StockRow['trend_signal'] }) {
  const cfg = TREND_CFG[signal] ?? TREND_CFG.neutral;
  return (
    <span title={cfg.desc} style={{
      fontSize: '.6rem', fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}35`,
      borderRadius: 5, padding: '2px 6px',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

/* ─── Price Sparkline (5-day price line) ─── */
function PriceSparkline({ prices, change }: { prices: number[]; change: number | null }) {
  if (!prices || prices.length < 2) return <span style={{ color: 'var(--muted)', fontSize: '.6rem' }}>—</span>;
  const W = 64, H = 24;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.01;
  const color = (change ?? 0) >= 0 ? '#00c896' : '#f04060';
  const pts = prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // fill area under line
  const first = prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = `0,${H} ` + first.join(' ') + ` ${W},${H}`;

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${prices[0]}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#sg-${prices[0]})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* last dot */}
      {(() => {
        const last = prices[prices.length - 1];
        const x = W;
        const y = H - 2 - ((last - min) / range) * (H - 4);
        return <circle cx={x} cy={y} r={2.5} fill={color} />;
      })()}
    </svg>
  );
}

/* ─── Volume Bars (5-day) vs avg ─── */
function VolumeSparkline({ volumes, avg_volume }: { volumes: number[]; avg_volume: number }) {
  if (!volumes || volumes.length < 2) return null;
  const W = 64, H = 24;
  const maxV = Math.max(...volumes, avg_volume * 1.1);
  const barW = (W / volumes.length) - 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* avg line */}
        {avg_volume > 0 && (
          <line
            x1={0} y1={H - (avg_volume / maxV) * H}
            x2={W} y2={H - (avg_volume / maxV) * H}
            stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="3,2"
          />
        )}
        {volumes.map((v, i) => {
          const h = Math.max(2, (v / maxV) * H);
          const x = i * (W / volumes.length) + 1;
          const aboveAvg = v > avg_volume;
          return (
            <rect
              key={i}
              x={x} y={H - h} width={barW} height={h}
              rx={1}
              fill={aboveAvg ? 'rgba(245,158,11,0.75)' : 'rgba(107,114,128,0.45)'}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.5rem', color: 'rgba(255,255,255,0.2)' }}>5D</span>
        <span style={{ fontSize: '.5rem', color: 'rgba(255,255,255,0.2)' }}>VOL</span>
      </div>
    </div>
  );
}

/* ─── Combined week chart (price + volume stacked) ─── */
function WeekChart({ stock }: { stock: StockRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      <PriceSparkline prices={stock.week_prices} change={stock.change_1d} />
      <VolumeSparkline volumes={stock.week_volumes} avg_volume={stock.avg_volume} />
    </div>
  );
}

/* ─── 52w Range Bar ─── */
function RangeBar({ stock }: { stock: StockRow }) {
  const range = stock.high_52w - stock.low_52w;
  const pos = range > 0 ? ((stock.price - stock.low_52w) / range) * 100 : 50;
  const barColor = stock.pct_from_high <= -30 ? '#f59e0b'
    : stock.pct_from_high <= -15 ? '#3b82f6'
    : stock.pct_from_high >= -5  ? '#00c896' : '#6b7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ position: 'relative', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, minWidth: 90 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.max(2, Math.min(100, pos))}%`, background: barColor, borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: -1, width: 7, height: 7, borderRadius: '50%', background: barColor, border: '1.5px solid var(--bg)', left: `calc(${Math.max(2, Math.min(96, pos))}% - 3px)` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.5rem', color: 'var(--muted)', fontFamily: 'monospace' }}>${stock.low_52w}</span>
        <span style={{ fontSize: '.5rem', color: 'var(--muted)', fontFamily: 'monospace' }}>${stock.high_52w}</span>
      </div>
    </div>
  );
}

/* ─── Stock Table ─── */
function StockTable({ stocks, color }: { stocks: StockRow[]; color: string }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<string>('market_cap');
  const [sortAsc, setSortAsc] = useState(false);

  if (!stocks.length) return <p style={{ color: 'var(--muted)', fontSize: '.75rem', padding: '8px 0' }}>אין נתונים</p>;

  const doSort = (key: string) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...stocks].sort((a, b) => {
    const av = (a as any)[sortKey] ?? -Infinity;
    const bv = (b as any)[sortKey] ?? -Infinity;
    return sortAsc ? av - bv : bv - av;
  });

  const Th = ({ label, k }: { label: string; k: string }) => (
    <th
      onClick={() => doSort(k)}
      style={{
        padding: '5px 8px', textAlign: 'right', color: sortKey === k ? color : 'var(--muted)',
        fontWeight: 700, fontSize: '.58rem', textTransform: 'uppercase',
        whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
      }}
    >
      {label}{sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.72rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <Th label="מניה"         k="symbol" />
            <Th label="מחיר"         k="price" />
            <Th label="1D"           k="change_1d" />
            <Th label="1M"           k="change_1m" />
            <Th label="3M"           k="change_3m" />
            <th style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: '.58rem', whiteSpace: 'nowrap' }}>מגמה שבועית</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: '.58rem', whiteSpace: 'nowrap' }}>מחיר + נפח 5D</th>
            <Th label="שפל—שיא 52"   k="pct_from_high" />
            <Th label="מהשיא"        k="pct_from_high" />
            <Th label="שווי שוק"     k="market_cap" />
            <Th label="נפח×"         k="vol_ratio" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => {
            const attractive    = s.pct_from_high <= -25;
            const veryAttractive = s.pct_from_high <= -35;
            return (
              <tr
                key={s.symbol}
                onClick={() => navigate(`/stock/${s.symbol}`)}
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: veryAttractive ? 'rgba(245,158,11,0.06)' : attractive ? 'rgba(59,130,246,0.04)' : 'transparent',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = veryAttractive ? 'rgba(245,158,11,0.06)' : attractive ? 'rgba(59,130,246,0.04)' : 'transparent')}
              >
                {/* Symbol */}
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {veryAttractive && <span title="מאוד אטרקטיבי" style={{ fontSize: '.68rem' }}>🔥</span>}
                    {attractive && !veryAttractive && <span title="אטרקטיבי" style={{ fontSize: '.68rem' }}>⭐</span>}
                    <div>
                      <div style={{ fontWeight: 800, color, fontSize: '.78rem' }}>{s.symbol}</div>
                      <div style={{ fontSize: '.54rem', color: 'var(--muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                  </div>
                </td>
                {/* Price */}
                <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', fontSize: '.76rem' }}>
                  ${s.price.toFixed(2)}
                </td>
                {/* Changes */}
                <td style={{ padding: '6px 8px' }}><PctBadge v={s.change_1d} /></td>
                <td style={{ padding: '6px 8px' }}><PctBadge v={s.change_1m} /></td>
                <td style={{ padding: '6px 8px' }}><PctBadge v={s.change_3m} /></td>
                {/* Trend badge */}
                <td style={{ padding: '6px 8px' }}>
                  <TrendBadge signal={s.trend_signal ?? 'neutral'} />
                </td>
                {/* Week chart */}
                <td style={{ padding: '6px 8px' }}>
                  <WeekChart stock={s} />
                </td>
                {/* 52w range */}
                <td style={{ padding: '6px 8px', minWidth: 110 }}>
                  <RangeBar stock={s} />
                </td>
                {/* Pct from high */}
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 800, fontSize: '.72rem',
                    color: s.pct_from_high <= -30 ? '#f59e0b' : s.pct_from_high <= -15 ? '#3b82f6' : '#6b7280',
                  }}>
                    {s.pct_from_high.toFixed(1)}%
                  </span>
                </td>
                {/* Market cap */}
                <td style={{ padding: '6px 8px', color: 'var(--text2)', fontFamily: 'monospace', fontSize: '.68rem' }}>
                  {fmtCap(s.market_cap)}
                </td>
                {/* Vol ratio */}
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    fontSize: '.68rem', fontFamily: 'monospace', fontWeight: 700,
                    color: s.vol_ratio >= 2 ? '#f59e0b' : s.vol_ratio >= 1.5 ? '#a78bfa' : 'var(--muted)',
                  }}>
                    {s.vol_ratio.toFixed(1)}×
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Sector Card ─── */
function SectorCard({ name, data }: { name: string; data: SectorData }) {
  const [open, setOpen] = useState(true);
  const attractive = data.stocks.filter(s => s.pct_from_high <= -25).length;
  const bullishCount  = data.stocks.filter(s => s.trend_signal === 'bullish').length;
  const bearishCount  = data.stocks.filter(s => s.trend_signal === 'bearish').length;

  const avg1d = (() => {
    const vals = data.stocks.map(s => s.change_1d).filter(v => v != null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${data.color}30`,
      borderTop: `3px solid ${data.color}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          background: `linear-gradient(135deg, ${data.color}12 0%, transparent 60%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>{data.emoji}</span>
          <div>
            <div style={{ fontSize: '.88rem', fontWeight: 800, color: 'var(--text)' }}>{name}</div>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', display: 'flex', gap: 8 }}>
              <span>{data.stocks.length} מניות</span>
              {attractive > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>⭐ {attractive} אטרקטיביות</span>}
              {bullishCount > 0 && <span style={{ color: '#00c896', fontWeight: 700 }}>🚀 {bullishCount} שוריים</span>}
              {bearishCount > 0 && <span style={{ color: '#f04060', fontWeight: 700 }}>🐻 {bearishCount} דוביים</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <PctBadge v={avg1d} size="md" />
          <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 8px 10px' }}>
          <StockTable stocks={data.stocks} color={data.color} />
        </div>
      )}
    </div>
  );
}

/* ─── Attractive screener card ─── */
function AttractiveCard({ stocks }: { stocks: StockRow[] }) {
  const navigate = useNavigate();
  if (!stocks.length) return null;

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(245,158,11,0.4)',
      borderTop: '3px solid #f59e0b',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, transparent 60%)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.4rem' }}>🎯</span>
          <div>
            <div style={{ fontSize: '.92rem', fontWeight: 800, color: '#f59e0b' }}>מניות אטרקטיביות להשקעה</div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)' }}>
              מחיר נמוך ב-25%+ מהשיא של 52 שבועות · {stocks.length} מניות
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {stocks.map(s => {
          const veryAttr = s.pct_from_high <= -40;
          const color = veryAttr ? '#f59e0b' : '#3b82f6';
          const trendCfg = TREND_CFG[s.trend_signal ?? 'neutral'];
          return (
            <div
              key={s.symbol}
              onClick={() => navigate(`/stock/${s.symbol}`)}
              style={{
                cursor: 'pointer', background: `${color}10`,
                border: `1px solid ${color}35`, borderRadius: 12, padding: '10px 12px',
                minWidth: 155, transition: 'all .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${color}20`)}
              onMouseLeave={e => (e.currentTarget.style.background = `${color}10`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 900, color, fontSize: '.82rem' }}>{s.symbol}</span>
                {veryAttr && <span style={{ fontSize: '.65rem' }}>🔥</span>}
              </div>
              <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>

              {/* Sparkline */}
              <div style={{ marginBottom: 4 }}>
                <PriceSparkline prices={s.week_prices} change={s.change_1d} />
              </div>

              {/* Price + gap */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', fontSize: '.78rem' }}>${s.price.toFixed(2)}</span>
                <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>{s.pct_from_high.toFixed(1)}%</span>
              </div>

              {/* Trend */}
              <div style={{ marginBottom: 5 }}>
                <TrendBadge signal={s.trend_signal ?? 'neutral'} />
              </div>

              <RangeBar stock={s} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function SectorDashboard() {
  const [data, setData]       = useState<SectorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await axios.get('/api/market/sectors', { timeout: 90000 });
      setData(r.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'שגיאה בטעינת נתוני סקטורים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredSectors = data
    ? Object.entries(data.sectors).map(([name, sec]) => ({
        name,
        sec: {
          ...sec,
          stocks: search
            ? sec.stocks.filter(s =>
                s.symbol.toLowerCase().includes(search.toLowerCase()) ||
                s.name.toLowerCase().includes(search.toLowerCase()))
            : sec.stocks,
        },
      }))
    : [];

  // Sector-level stats summary
  const stats = data ? (() => {
    const allStocks = Object.values(data.sectors).flatMap(s => s.stocks);
    const unique = [...new Map(allStocks.map(s => [s.symbol, s])).values()];
    const bullish   = unique.filter(s => s.trend_signal === 'bullish').length;
    const bearish   = unique.filter(s => s.trend_signal === 'bearish').length;
    const weakUp    = unique.filter(s => s.trend_signal === 'weak_up').length;
    const weakDown  = unique.filter(s => s.trend_signal === 'weak_down').length;
    return { total: unique.length, bullish, bearish, weakUp, weakDown };
  })() : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            📊 מסך סקטורים
          </h1>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 3 }}>
            מגמת מחיר + ריכוז נפח שבועי · עמדת 52 שבועות · הזדמנויות השקעה
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חפש מניה..."
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px', fontSize: '.78rem',
              color: 'var(--text)', outline: 'none', direction: 'rtl', width: 160,
            }}
          />
          <button
            onClick={load} disabled={loading}
            style={{
              background: 'var(--blue)', border: 'none', borderRadius: 8,
              padding: '6px 16px', cursor: loading ? 'not-allowed' : 'pointer',
              color: '#fff', fontSize: '.75rem', fontWeight: 700, opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ טוען...' : '🔄 רענן'}
          </button>
        </div>
      </div>

      {/* Market mood summary bar */}
      {stats && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 16px', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <span style={{ fontSize: '.68rem', color: 'var(--muted)', fontWeight: 700 }}>מצב שוק — {stats.total} מניות:</span>
          {[
            { label: '🚀 שוריים', v: stats.bullish,  color: '#00c896' },
            { label: '📈 עלייה חלשה', v: stats.weakUp,  color: '#3b82f6' },
            { label: '📉 ירידה חלשה', v: stats.weakDown, color: '#f59e0b' },
            { label: '🐻 דוביים',   v: stats.bearish, color: '#f04060' },
          ].map(({ label, v, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: '.72rem', color, fontWeight: 700 }}>{v}</span>
              <span style={{ fontSize: '.65rem', color: 'var(--text2)' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginRight: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { icon: '🔥', label: '35%+ מתחת לשיא' },
              { icon: '⭐', label: '25%+ מתחת לשיא' },
              { icon: '🟡', label: 'נפח מעל ממוצע' },
            ].map(({ icon, label }) => (
              <span key={label} style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{icon} {label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spin" style={{ width: 44, height: 44, border: '3px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ color: 'var(--text2)', fontSize: '.85rem' }}>טוען נתוני סקטורים... (עד 40 שניות)</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(240,64,96,.1)', border: '1px solid rgba(240,64,96,.3)', borderRadius: 10, padding: '1rem', color: 'var(--red)', fontSize: '.82rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Attractive stocks — top */}
      {data && data.attractive.length > 0 && (
        <AttractiveCard stocks={data.attractive} />
      )}

      {/* Sector cards */}
      {data && filteredSectors.map(({ name, sec }) =>
        sec.stocks.length > 0 && (
          <SectorCard key={name} name={name} data={sec} />
        )
      )}
    </div>
  );
}
