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

function fmtCap(v: number | null) {
  if (!v) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

function fmtPct(v: number | null, showPlus = true) {
  if (v == null) return '—';
  return `${v >= 0 && showPlus ? '+' : ''}${v.toFixed(1)}%`;
}

function PctBadge({ v, size = 'sm' }: { v: number | null; size?: 'sm' | 'md' }) {
  if (v == null) return <span style={{ color: 'var(--muted)', fontSize: '.65rem' }}>—</span>;
  const up = v >= 0;
  const fs = size === 'sm' ? '.68rem' : '.78rem';
  return (
    <span style={{
      fontSize: fs, fontWeight: 700, fontFamily: 'monospace',
      color: up ? '#00c896' : '#f04060',
    }}>
      {up ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

// Progress bar showing price position between 52w low and 52w high
function RangeBar({ stock }: { stock: StockRow }) {
  const range = stock.high_52w - stock.low_52w;
  const pos = range > 0 ? ((stock.price - stock.low_52w) / range) * 100 : 50;
  const pctFromHigh = stock.pct_from_high;
  const barColor = pctFromHigh <= -30 ? '#f59e0b'
    : pctFromHigh <= -15 ? '#3b82f6'
    : pctFromHigh >= -5  ? '#00c896' : '#6b7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ position: 'relative', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pos}%`, background: barColor, borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: -1, width: 7, height: 7, borderRadius: '50%', background: barColor, border: '1.5px solid var(--bg)', left: `calc(${pos}% - 3px)` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.55rem', color: 'var(--muted)', fontFamily: 'monospace' }}>${stock.low_52w}</span>
        <span style={{ fontSize: '.55rem', color: 'var(--muted)', fontFamily: 'monospace' }}>${stock.high_52w}</span>
      </div>
    </div>
  );
}

function StockTable({ stocks, color }: { stocks: StockRow[]; color: string }) {
  const navigate = useNavigate();
  if (!stocks.length) return <p style={{ color: 'var(--muted)', fontSize: '.75rem' }}>אין נתונים</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.72rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['מניה', 'מחיר', '1D', '1M', '3M', 'שפל52 — שיא52', 'מהשיא', 'שווי שוק', 'נפח'].map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: '.6rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stocks.map((s, i) => {
            const attractive = s.pct_from_high <= -25;
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
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = veryAttractive ? 'rgba(245,158,11,0.06)' : attractive ? 'rgba(59,130,246,0.04)' : 'transparent')}
              >
                {/* Symbol + Name */}
                <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {veryAttractive && <span title="מאוד אטרקטיבי" style={{ fontSize: '0.7rem' }}>🔥</span>}
                    {attractive && !veryAttractive && <span title="אטרקטיבי" style={{ fontSize: '0.7rem' }}>⭐</span>}
                    <div>
                      <div style={{ fontWeight: 800, color: color, fontSize: '.78rem' }}>{s.symbol}</div>
                      <div style={{ fontSize: '.58rem', color: 'var(--muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                  </div>
                </td>
                {/* Price */}
                <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>
                  ${s.price.toFixed(2)}
                </td>
                {/* Changes */}
                <td style={{ padding: '7px 8px' }}><PctBadge v={s.change_1d} /></td>
                <td style={{ padding: '7px 8px' }}><PctBadge v={s.change_1m} /></td>
                <td style={{ padding: '7px 8px' }}><PctBadge v={s.change_3m} /></td>
                {/* 52w range */}
                <td style={{ padding: '7px 8px', minWidth: 120 }}>
                  <RangeBar stock={s} />
                </td>
                {/* Pct from high */}
                <td style={{ padding: '7px 8px' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 800, fontSize: '.72rem',
                    color: s.pct_from_high <= -30 ? '#f59e0b' : s.pct_from_high <= -15 ? '#3b82f6' : '#6b7280',
                  }}>
                    {s.pct_from_high.toFixed(1)}%
                  </span>
                </td>
                {/* Market cap */}
                <td style={{ padding: '7px 8px', color: 'var(--text2)', fontFamily: 'monospace' }}>
                  {fmtCap(s.market_cap)}
                </td>
                {/* Volume ratio */}
                <td style={{ padding: '7px 8px' }}>
                  <span style={{ fontSize: '.68rem', color: s.vol_ratio > 1.5 ? '#f59e0b' : 'var(--muted)', fontFamily: 'monospace' }}>
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

function SectorCard({ name, data }: { name: string; data: SectorData }) {
  const [open, setOpen] = useState(true);
  const best = data.stocks.reduce((b, s) => (s.change_1d ?? -999) > (b.change_1d ?? -999) ? s : b, data.stocks[0]);
  const attractive = data.stocks.filter(s => s.pct_from_high <= -25).length;

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${data.color}30`,
      borderTop: `3px solid ${data.color}`,
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          background: `linear-gradient(135deg, ${data.color}10 0%, transparent 60%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>{data.emoji}</span>
          <div>
            <div style={{ fontSize: '.88rem', fontWeight: 800, color: 'var(--text)' }}>{name}</div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)' }}>
              {data.stocks.length} מניות
              {attractive > 0 && (
                <span style={{ color: '#f59e0b', marginRight: 6, fontWeight: 700 }}>· ⭐ {attractive} אטרקטיביות</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Avg 1D change */}
          {data.stocks.length > 0 && (() => {
            const vals = data.stocks.map(s => s.change_1d).filter(v => v != null) as number[];
            const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
            return <PctBadge v={avg} size="md" />;
          })()}
          <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Table */}
      {open && (
        <div style={{ padding: '0 8px 10px' }}>
          <StockTable stocks={data.stocks} color={data.color} />
        </div>
      )}
    </div>
  );
}

function AttractiveCard({ stocks }: { stocks: StockRow[] }) {
  const navigate = useNavigate();
  if (!stocks.length) return null;

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(245,158,11,0.4)',
      borderTop: '3px solid #f59e0b',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, transparent 60%)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.4rem' }}>🎯</span>
          <div>
            <div style={{ fontSize: '.92rem', fontWeight: 800, color: '#f59e0b' }}>
              מניות אטרקטיביות להשקעה
            </div>
            <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>
              מחיר נמוך ב-25%+ מהשיא של 52 שבועות · {stocks.length} מניות
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {stocks.map(s => {
          const veryAttr = s.pct_from_high <= -40;
          const color = veryAttr ? '#f59e0b' : '#3b82f6';
          return (
            <div
              key={s.symbol}
              onClick={() => navigate(`/stock/${s.symbol}`)}
              style={{
                cursor: 'pointer',
                background: `${color}10`,
                border: `1px solid ${color}35`,
                borderRadius: 10, padding: '10px 14px',
                minWidth: 140,
                transition: 'all .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${color}20`)}
              onMouseLeave={e => (e.currentTarget.style.background = `${color}10`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <span style={{ fontWeight: 900, color, fontSize: '.82rem' }}>{s.symbol}</span>
                {veryAttr && <span style={{ fontSize: '.65rem' }}>🔥</span>}
              </div>
              <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 6, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', fontSize: '.78rem', marginBottom: 4 }}>
                ${s.price.toFixed(2)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>מהשיא:</span>
                <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
                  {s.pct_from_high.toFixed(1)}%
                </span>
              </div>
              <RangeBar stock={s} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SectorDashboard() {
  const [data, setData]     = useState<SectorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');

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

  const filteredSectors = data ? Object.entries(data.sectors).map(([name, sec]) => ({
    name, sec: {
      ...sec,
      stocks: search
        ? sec.stocks.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
        : sec.stocks,
    },
  })) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            📊 מסך סקטורים
          </h1>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 3 }}>
            ניתוח מניות לפי סקטורים · עמדת מחיר ביחס ל-52 שבועות · הזדמנויות השקעה
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
            onClick={load}
            disabled={loading}
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

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <span style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700 }}>מקרא:</span>
        {[
          { icon: '🔥', label: 'מחיר נמוך ב-35%+ מהשיא', color: '#f59e0b' },
          { icon: '⭐', label: 'מחיר נמוך ב-25%+ מהשיא', color: '#3b82f6' },
          { icon: '🎯', label: 'מניות אטרקטיביות', color: '#f59e0b' },
        ].map(({ icon, label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '.75rem' }}>{icon}</span>
            <span style={{ fontSize: '.62rem', color }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: '.6rem', color: 'var(--muted)', marginRight: 'auto' }}>
          לחיצה על מניה → עמוד מניה מפורט
        </span>
      </div>

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

      {/* Attractive section — first */}
      {data && data.attractive.length > 0 && (
        <AttractiveCard stocks={data.attractive} />
      )}

      {/* Sector cards */}
      {data && filteredSectors.map(({ name, sec }) => (
        sec.stocks.length > 0 && (
          <SectorCard key={name} name={name} data={sec} />
        )
      ))}
    </div>
  );
}
