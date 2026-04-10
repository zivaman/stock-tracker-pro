import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Trash2, ExternalLink } from 'lucide-react';
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
  const pnlColor = isPnlPos ? 'var(--green)' : 'var(--red)';
  const pnlBg    = isPnlPos ? 'rgba(0,200,150,.06)' : 'rgba(240,64,96,.06)';
  const pnlBorder = isPnlPos ? 'rgba(0,200,150,.2)' : 'rgba(240,64,96,.2)';

  const periods: { key: keyof typeof position.performance; label: string }[] = [
    { key: 'since_buy', label: 'כניסה' },
    { key: '1d', label: '1D' },
    { key: '1w', label: '1W' },
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
  ];

  return (
    <div
      style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transition: 'all .18s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isPnlPos ? 'rgba(0,200,150,.4)' : 'rgba(240,64,96,.4)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 30px rgba(0,0,0,.2)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Top color strip */}
      <div style={{ height: 3, background: pnlColor }} />

      {/* Header */}
      <div style={{ padding: '0.85rem 1rem 0.65rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div
            style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
            onClick={() => navigate(`/stock/${position.symbol}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
                {position.symbol}
              </span>
              {isPnlPos
                ? <TrendingUp size={14} style={{ color: 'var(--green)' }} />
                : <TrendingDown size={14} style={{ color: 'var(--red)' }} />}
              <ExternalLink size={11} style={{ color: 'var(--muted)' }} />
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {position.name}
            </div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 1 }}>
              כניסה: <span className="num">${position.buy_price}</span>
              {' · '}
              <span>{new Date(position.buy_date).toLocaleDateString('he-IL')}</span>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); if (confirm(`למחוק ${position.symbol} מהתיק?`)) onRemove(position.symbol); }}
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginTop: 2 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Price + P&L */}
      <div style={{ padding: '0.7rem 1rem', background: 'var(--card2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Current price */}
          <div>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 1 }}>מחיר נוכחי</div>
            <div className="num" style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
              ${position.current_price}
            </div>
          </div>
          {/* P&L box */}
          <div style={{ background: pnlBg, border: `1px solid ${pnlBorder}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>רווח / הפסד</div>
            <div className="num" style={{ fontSize: '.95rem', fontWeight: 800, color: pnlColor, lineHeight: 1 }}>
              {isPnlPos ? '+' : ''}${position.pnl.toFixed(2)}
            </div>
            <div className="num" style={{ fontSize: '.75rem', fontWeight: 700, color: pnlColor, marginTop: 1 }}>
              {isPnlPos ? '+' : ''}{position.pnl_pct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Details: qty, invested, value */}
      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { label: 'כמות', value: `${position.quantity}` },
          { label: 'השקעה', value: `$${position.invested.toFixed(0)}` },
          { label: 'שווי', value: `$${position.current_value.toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg2)', borderRadius: 7, padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 1 }}>{label}</div>
            <div className="num" style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Performance periods */}
      <div style={{ padding: '0.6rem 1rem' }}>
        <div style={{ fontSize: '.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>ביצועים לפי תקופה</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {periods.map(({ key, label }) => (
            <PerfCell key={key} label={label} value={position.performance[key]} />
          ))}
        </div>
      </div>
    </div>
  );
}
