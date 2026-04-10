import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Trash2, BarChart2, ChevronLeft } from 'lucide-react';
import type { PortfolioPosition } from '../types';

interface Props { position: PortfolioPosition; onRemove: (symbol: string) => void; }

function PerfCell({ label, value }: { label: string; value: number | undefined }) {
  if (value == null) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>—</div>
    </div>
  );
  const pos = value >= 0;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 1 }}>{label}</div>
      <div className="num" style={{ fontSize: '.72rem', fontWeight: 700, color: pos ? 'var(--green)' : 'var(--red)' }}>
        {pos ? '+' : ''}{value.toFixed(1)}%
      </div>
    </div>
  );
}

export default function PortfolioCard({ position, onRemove }: Props) {
  const navigate = useNavigate();
  const isPnlPos = position.pnl >= 0;
  const pnlColor  = isPnlPos ? 'var(--green)' : 'var(--red)';
  const pnlBg     = isPnlPos ? 'rgba(0,200,150,.08)' : 'rgba(240,64,96,.08)';
  const pnlBorder = isPnlPos ? 'rgba(0,200,150,.25)' : 'rgba(240,64,96,.25)';

  const periods: { key: keyof typeof position.performance; label: string }[] = [
    { key: 'since_buy', label: 'כניסה' },
    { key: '1d',        label: '1D' },
    { key: '1w',        label: '1W' },
    { key: '1m',        label: '1M' },
    { key: '3m',        label: '3M' },
    { key: '6m',        label: '6M' },
  ];

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'all .18s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isPnlPos ? 'rgba(0,200,150,.45)' : 'rgba(240,64,96,.45)';
        (e.currentTarget as HTMLDivElement).style.transform   = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow  = '0 10px 35px rgba(0,0,0,.22)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform   = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow  = 'none';
      }}
    >
      {/* ── Color strip ── */}
      <div style={{ height: 4, background: pnlColor }} />

      {/* ── Header: symbol + name + delete ── */}
      <div style={{ padding: '0.9rem 1rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
                {position.symbol}
              </span>
              {isPnlPos
                ? <TrendingUp  size={15} style={{ color: 'var(--green)' }} />
                : <TrendingDown size={15} style={{ color: 'var(--red)' }} />}
            </div>
            <div style={{ fontSize: '.73rem', color: 'var(--text2)', marginTop: 3, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {position.name}
            </div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 2 }}>
              כניסה: <span className="num">${position.buy_price}</span>
              {' · '}{new Date(position.buy_date).toLocaleDateString('he-IL')}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); if (confirm(`למחוק ${position.symbol} מהתיק?`)) onRemove(position.symbol); }}
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 3, marginTop: 1, borderRadius: 5, transition: 'color .15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'}
            title="הסר מהתיק"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Price + P&L ── */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--card2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>מחיר נוכחי</div>
          <div className="num" style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
            ${position.current_price}
          </div>
        </div>
        <div style={{ background: pnlBg, border: `1px solid ${pnlBorder}`, borderRadius: 9, padding: '7px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>רווח / הפסד</div>
          <div className="num" style={{ fontSize: '1rem', fontWeight: 900, color: pnlColor, lineHeight: 1 }}>
            {isPnlPos ? '+' : ''}${position.pnl.toFixed(2)}
          </div>
          <div className="num" style={{ fontSize: '.78rem', fontWeight: 700, color: pnlColor, marginTop: 2 }}>
            {isPnlPos ? '+' : ''}{position.pnl_pct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ── Qty / Invested / Value ── */}
      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { label: 'כמות',  value: `${position.quantity}` },
          { label: 'השקעה', value: `$${position.invested.toFixed(0)}` },
          { label: 'שווי',  value: `$${position.current_value.toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg2)', borderRadius: 7, padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 1 }}>{label}</div>
            <div className="num" style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Performance by period ── */}
      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>ביצועים לפי תקופה</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {periods.map(({ key, label }) => (
            <PerfCell key={key} label={label} value={position.performance[key]} />
          ))}
        </div>
      </div>

      {/* ── TA Mini Panel ── */}
      {position.ta && (
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '.6rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>ניתוח טכני</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 60, height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${position.ta.score}%`, borderRadius: 2,
                  background: position.ta.score >= 65 ? 'var(--green)' : position.ta.score >= 45 ? 'var(--blue)' : position.ta.score >= 30 ? 'var(--yellow)' : 'var(--red)',
                }} />
              </div>
              <span className="num" style={{
                fontSize: '.78rem', fontWeight: 800,
                color: position.ta.score >= 65 ? 'var(--green)' : position.ta.score >= 45 ? 'var(--blue)' : position.ta.score >= 30 ? 'var(--yellow)' : 'var(--red)',
              }}>{position.ta.score}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
            {[
              {
                label: 'RSI',
                value: position.ta.rsi?.toFixed(1) ?? '—',
                color: position.ta.rsi == null ? 'var(--text2)' : position.ta.rsi < 35 ? 'var(--green)' : position.ta.rsi > 70 ? 'var(--red)' : 'var(--text2)',
              },
              {
                label: 'MACD',
                value: position.ta.macd != null && position.ta.macd_signal != null ? (position.ta.macd > position.ta.macd_signal ? '▲' : '▼') : '—',
                color: position.ta.macd != null && position.ta.macd_signal != null ? (position.ta.macd > position.ta.macd_signal ? 'var(--green)' : 'var(--red)') : 'var(--text2)',
              },
              {
                label: 'SMA50',
                value: position.ta.sma50 ? (position.current_price > position.ta.sma50 ? '▲' : '▼') : '—',
                color: position.ta.sma50 ? (position.current_price > position.ta.sma50 ? 'var(--green)' : 'var(--red)') : 'var(--text2)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 1 }}>{label}</div>
                <div className="num" style={{ fontSize: '.78rem', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
          {position.ta.reasons.length > 0 && (
            <p style={{ fontSize: '.66rem', color: 'var(--green)', marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
              <span>✓</span> {position.ta.reasons[0]}
            </p>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          ACTION BUTTONS — PROMINENT
      ══════════════════════════════ */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: 8, background: 'var(--card)', marginTop: 'auto' }}>

        {/* PRIMARY — open stock page */}
        <button
          onClick={() => navigate(`/stock/${position.symbol}`)}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '0.6rem 0',
            background: 'var(--blue)', color: '#fff',
            border: 'none', borderRadius: 9,
            fontSize: '.82rem', fontWeight: 700,
            cursor: 'pointer', transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '.85'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
        >
          <BarChart2 size={14} />
          פתח ניתוח מלא
          <ChevronLeft size={13} />
        </button>

        {/* SECONDARY — view position in chart */}
        <button
          onClick={() => navigate(`/stock/${position.symbol}`)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '0.6rem 0.9rem',
            background: isPnlPos ? 'rgba(0,200,150,.1)' : 'rgba(240,64,96,.08)',
            color: pnlColor,
            border: `1px solid ${pnlBorder}`,
            borderRadius: 9,
            fontSize: '.78rem', fontWeight: 700,
            cursor: 'pointer', transition: 'opacity .15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '.75'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
        >
          {isPnlPos ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {isPnlPos ? '+' : ''}{position.pnl_pct.toFixed(1)}%
        </button>
      </div>
    </div>
  );
}
