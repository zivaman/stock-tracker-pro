import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Trash2, ArrowUpRight } from 'lucide-react';
import type { PortfolioPosition } from '../types';

interface Props {
  position: PortfolioPosition;
  onRemove: (symbol: string) => void;
}

export default function PortfolioCard({ position, onRemove }: Props) {
  const navigate = useNavigate();
  const isPnlPos = position.pnl >= 0;
  const pnlColor = isPnlPos ? 'var(--green)' : 'var(--red)';
  const pnlBg   = isPnlPos ? 'rgba(0,200,150,.08)' : 'rgba(240,64,96,.08)';

  const periods: { key: keyof typeof position.performance; label: string }[] = [
    { key: '1d',   label: '1D' },
    { key: '1w',   label: '1W' },
    { key: '1m',   label: '1M' },
    { key: '3m',   label: '3M' },
    { key: '6m',   label: '6M' },
    { key: '1y',   label: '1Y' },
  ];

  return (
    <div
      className="stock-card"
      onClick={() => navigate(`/stock/${position.symbol}`)}
      style={{ cursor: 'pointer' }}
    >
      {/* Top row: symbol + delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)', letterSpacing: '-0.5px' }}>
              {position.symbol}
            </span>
            {isPnlPos
              ? <TrendingUp size={14} style={{ color: 'var(--green)' }} />
              : <TrendingDown size={14} style={{ color: 'var(--red)' }} />}
            <ArrowUpRight size={12} style={{ color: 'var(--muted)' }} />
          </div>
          <p style={{ fontSize: '.7rem', color: 'var(--text2)', marginTop: 1, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {position.name}
          </p>
        </div>
        <button
          onClick={e => {
            e.stopPropagation();
            if (confirm(`האם למחוק את ${position.symbol} מהתיק?`)) onRemove(position.symbol);
          }}
          style={{ color: 'var(--muted)', padding: '2px', background: 'none', border: 'none', cursor: 'pointer' }}
          title="הסר מהתיק"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Current price */}
      <div>
        <p style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 2 }}>מחיר נוכחי</p>
        <p className="num" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
          ${position.current_price}
        </p>
        <p style={{ fontSize: '.7rem', color: 'var(--text2)', marginTop: 3 }}>
          כניסה: <span className="num">${position.buy_price}</span>
        </p>
      </div>

      {/* P&L box */}
      <div style={{ background: pnlBg, border: `1px solid ${isPnlPos ? 'rgba(0,200,150,.2)' : 'rgba(240,64,96,.2)'}`, borderRadius: 8, padding: '0.6rem 0.75rem' }}>
        <p style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>רווח / הפסד</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="num" style={{ fontSize: '1.1rem', fontWeight: 800, color: pnlColor }}>
            {isPnlPos ? '+' : ''}${position.pnl.toFixed(2)}
          </span>
          <span className="num" style={{ fontSize: '.78rem', fontWeight: 700, color: pnlColor }}>
            {isPnlPos ? '+' : ''}{position.pnl_pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Details row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
        {[
          { label: 'כמות', value: `${position.quantity}` },
          { label: 'השקעה', value: `$${position.invested.toFixed(0)}` },
          { label: 'שווי', value: `$${position.current_value.toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg2)', borderRadius: 6, padding: '0.35rem 0.2rem' }}>
            <p style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{label}</p>
            <p className="num" style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text)', marginTop: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Period performance */}
      <div>
        <p style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>ביצועים</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
          {periods.map(({ key, label }) => {
            const val = position.performance[key];
            if (val == null) return (
              <div key={key} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '.55rem', color: 'var(--muted)' }}>{label}</p>
                <p style={{ fontSize: '.65rem', color: 'var(--muted)' }}>—</p>
              </div>
            );
            const pos = val >= 0;
            return (
              <div key={key} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '.55rem', color: 'var(--muted)' }}>{label}</p>
                <p className="num" style={{ fontSize: '.65rem', fontWeight: 700, color: pos ? 'var(--green)' : 'var(--red)' }}>
                  {pos ? '+' : ''}{val.toFixed(1)}%
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
