import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Globe, RefreshCw, Activity } from 'lucide-react';
import { getMarketOverview } from '../api/client';

interface SectorData {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
}

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
}

interface VixData {
  value: number;
  level: string;
  description: string;
  color: string;
}

interface MarketOverview {
  vix: VixData;
  indices: IndexData[];
  sectors: SectorData[];
  fear_greed: { score: number; label: string; color: string };
  timestamp: string;
}

function pct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function PctBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const pos = value >= 0;
  const fs = size === 'lg' ? '1.1rem' : '.78rem';
  return (
    <span style={{
      color: pos ? 'var(--green)' : 'var(--red)',
      fontWeight: 700, fontSize: fs, display: 'flex', alignItems: 'center', gap: 2,
    }}>
      {pos ? <TrendingUp size={size === 'lg' ? 16 : 12} /> : <TrendingDown size={size === 'lg' ? 16 : 12} />}
      {pct(value)}
    </span>
  );
}

/* ─── VIX Card ─── */
function VixCard({ vix }: { vix: VixData }) {
  const getGaugeFill = () => {
    if (vix.value < 15) return 'var(--green)';
    if (vix.value < 25) return 'var(--yellow)';
    if (vix.value < 35) return '#f97316';
    return 'var(--red)';
  };
  const fillPct = Math.min((vix.value / 50) * 100, 100);

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={15} style={{ color: 'var(--yellow)' }} />
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>VIX — מדד תנודתיות</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <span style={{ fontSize: '2.8rem', fontWeight: 800, color: getGaugeFill(), lineHeight: 1 }}>
          {vix.value.toFixed(1)}
        </span>
        <span style={{
          fontSize: '.72rem', padding: '4px 10px', borderRadius: 6,
          background: `${getGaugeFill()}22`, color: getGaugeFill(), fontWeight: 700, marginBottom: 6,
        }}>
          {vix.level}
        </span>
      </div>

      {/* Gauge bar */}
      <div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${fillPct}%`, borderRadius: 4,
            background: `linear-gradient(90deg, var(--green), var(--yellow), var(--red))`,
            backgroundSize: '400px 8px',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>0 (שקט)</span>
          <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>50 (פאניקה)</span>
        </div>
      </div>

      <p style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>
        {vix.description}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { range: '< 15', label: 'רגיעה קיצונית', color: 'var(--green)' },
          { range: '15-25', label: 'נורמלי', color: 'var(--yellow)' },
          { range: '25-35', label: 'תנודתי', color: '#f97316' },
          { range: '> 35', label: 'פאניקה', color: 'var(--red)' },
        ].map(r => (
          <div key={r.range} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
            <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{r.range}</span>
            <span style={{ fontSize: '.7rem', color: r.color, fontWeight: 600 }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Fear & Greed Card ─── */
function FearGreedCard({ fg }: { fg: MarketOverview['fear_greed'] }) {
  const angle = (fg.score / 100) * 180 - 90; // -90 to +90 degrees

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
        <Activity size={15} style={{ color: 'var(--purple)' }} />
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>Fear & Greed פרוקסי</span>
      </div>

      {/* Score display */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: fg.color, lineHeight: 1 }}>
          {fg.score}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: fg.color, marginTop: 4 }}>
          {fg.label}
        </div>
      </div>

      {/* Color scale */}
      <div style={{ width: '100%' }}>
        <div style={{
          height: 12, borderRadius: 6,
          background: 'linear-gradient(to left, #00c896, #f5c518, #f04060)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: `${fg.score}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', border: '3px solid ' + fg.color,
            boxShadow: '0 2px 8px rgba(0,0,0,.4)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '.6rem', color: 'var(--green)' }}>חמדנות (100)</span>
          <span style={{ fontSize: '.6rem', color: 'var(--red)' }}>פחד (0)</span>
        </div>
      </div>

      <p style={{ fontSize: '.72rem', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
        מחושב על בסיס VIX + ביצועי שוק. ערכים נמוכים = פחד שמרוב פעמים מאותת הזדמנות קנייה.
      </p>
    </div>
  );
}

/* ─── Index Card ─── */
function IndexCard({ idx }: { idx: IndexData }) {
  const pos = idx.change_pct >= 0;
  return (
    <div style={{
      background: 'var(--card)', border: `1px solid ${pos ? 'rgba(0,200,150,.2)' : 'rgba(240,64,96,.2)'}`,
      borderRadius: 12, padding: '1rem',
    }}>
      <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 4 }}>{idx.name}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
        {idx.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </div>
      <PctBadge value={idx.change_pct} size="sm" />
    </div>
  );
}

/* ─── Sector Heatmap ─── */
function SectorHeatmap({ sectors }: { sectors: SectorData[] }) {
  const sorted = [...sectors].sort((a, b) => b.change_pct - a.change_pct);
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.change_pct)), 1);

  const getBg = (pct: number) => {
    const intensity = Math.min(Math.abs(pct) / maxAbs, 1);
    if (pct >= 0) return `rgba(0,200,150,${0.1 + intensity * 0.4})`;
    return `rgba(240,64,96,${0.1 + intensity * 0.4})`;
  };

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '1.2rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <Globe size={15} style={{ color: 'var(--blue)' }} />
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>
          ביצועי סקטורים (ETF)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {sorted.map(s => {
          const pos = s.change_pct >= 0;
          return (
            <div key={s.symbol} style={{
              borderRadius: 10, padding: '0.7rem 0.8rem',
              background: getBg(s.change_pct),
              border: `1px solid ${pos ? 'rgba(0,200,150,.25)' : 'rgba(240,64,96,.25)'}`,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 600 }}>{s.symbol}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text)', fontWeight: 700, lineHeight: 1.2 }}>{s.name}</div>
              <div style={{ fontSize: '.85rem', fontWeight: 800, color: pos ? 'var(--green)' : 'var(--red)' }}>
                {pct(s.change_pct)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function MarketDashboard() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getMarketOverview();
      setData(res);
      setError('');
    } catch {
      setError('שגיאה בטעינת נתוני השוק');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '.85rem' }}>טוען נתוני שוק...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 600, margin: '3rem auto', textAlign: 'center', color: 'var(--red)' }}>
        <AlertTriangle size={40} style={{ margin: '0 auto 12px' }} />
        <p>{error || 'אין נתונים'}</p>
        <button onClick={() => load()} style={{
          marginTop: 16, padding: '0.5rem 1.5rem', borderRadius: 8,
          background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer',
        }}>נסה שוב</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>
            לוח מחוונים — שוק כללי
          </h1>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 4 }}>
            עדכון אחרון: {new Date(data.timestamp).toLocaleString('he-IL')}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.45rem 1rem', borderRadius: 8,
            background: 'var(--card2)', border: '1px solid var(--border)',
            color: 'var(--text2)', cursor: 'pointer', fontSize: '.78rem',
          }}
        >
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          רענן
        </button>
      </div>

      {/* Indices row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {data.indices.map(idx => (
          <IndexCard key={idx.symbol} idx={idx} />
        ))}
      </div>

      {/* VIX + Fear/Greed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
        <VixCard vix={data.vix} />
        <FearGreedCard fg={data.fear_greed} />
      </div>

      {/* Sector heatmap */}
      <SectorHeatmap sectors={data.sectors} />

      {/* Disclaimer */}
      <div style={{ marginTop: '2rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
          נתונים: Yahoo Finance. Fear &amp; Greed הוא פרוקסי פנימי — לא CNN Fear &amp; Greed Index המקורי. אינו ייעוץ השקעות.
        </p>
      </div>
    </div>
  );
}
