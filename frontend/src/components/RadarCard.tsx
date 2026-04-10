import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import type { RadarStock } from '../types';

interface Props {
  stock: RadarStock;
  rank: number;
}

const SIGNAL_CFG: Record<string, { label: string; color: string; bg: string }> = {
  strong_buy: { label: '🔥 קנייה חזקה', color: 'var(--green)',  bg: 'rgba(0,200,150,.15)' },
  buy:        { label: '▲ קנייה',       color: 'var(--green)',  bg: 'rgba(0,200,150,.1)' },
  watch:      { label: '◎ מעקב',        color: 'var(--yellow)', bg: 'rgba(245,197,24,.1)' },
  neutral:    { label: '— ניטראלי',     color: 'var(--text2)',  bg: 'rgba(143,163,191,.1)' },
  sell:       { label: '▼ מכירה',       color: 'var(--red)',    bg: 'rgba(240,64,96,.1)' },
};

function fmt(mc: number | null): string {
  if (!mc) return '—';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
  return `$${(mc / 1e6).toFixed(0)}M`;
}

export default function RadarCard({ stock, rank }: Props) {
  const navigate = useNavigate();
  const cfg = SIGNAL_CFG[stock.signal] ?? SIGNAL_CFG.neutral;
  const dayPos = (stock.day_change ?? 0) >= 0;
  const scoreColor = stock.score >= 65 ? 'var(--green)' : stock.score >= 45 ? 'var(--blue)' : stock.score >= 30 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div className="stock-card" onClick={() => navigate(`/stock/${stock.symbol}`)}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Rank badge */}
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'var(--bg2)', color: 'var(--muted)',
              fontSize: '.68rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>{rank}</span>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)', letterSpacing: '-.5px' }}>
              {stock.symbol}
            </span>
            {stock.hot_signal && <Flame size={14} style={{ color: 'var(--yellow)' }} />}
          </div>
          <p style={{ fontSize: '.68rem', color: 'var(--text2)', marginTop: 2, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stock.name}
          </p>
        </div>
        {/* Signal badge */}
        <span style={{
          fontSize: '.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}55`,
          whiteSpace: 'nowrap', flexShrink: 0
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Price */}
      <div>
        <p className="num" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1px' }}>
          ${stock.current_price}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          {dayPos ? <TrendingUp size={12} style={{ color: 'var(--green)' }} /> : <TrendingDown size={12} style={{ color: 'var(--red)' }} />}
          <span className="num" style={{ fontSize: '.75rem', fontWeight: 700, color: dayPos ? 'var(--green)' : 'var(--red)' }}>
            {dayPos ? '+' : ''}{stock.day_change?.toFixed(2) ?? '0.00'}%
          </span>
          <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>יום</span>
        </div>
      </div>

      {/* Score bar */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>ציון טכני</span>
          <span className="num" style={{ fontSize: '.9rem', fontWeight: 800, color: scoreColor }}>{stock.score}</span>
        </div>
        <div style={{ height: 5, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${stock.score}%`, background: scoreColor, borderRadius: 4, transition: 'width .4s' }} />
        </div>
      </div>

      {/* Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
        {[
          { label: 'RSI', value: stock.rsi?.toFixed(1) ?? '—', color: stock.rsi && stock.rsi < 35 ? 'var(--green)' : stock.rsi && stock.rsi > 70 ? 'var(--red)' : 'var(--text)' },
          { label: 'MACD', value: stock.macd && stock.macd_signal ? (stock.macd > stock.macd_signal ? '▲' : '▼') : '—', color: stock.macd && stock.macd_signal ? (stock.macd > stock.macd_signal ? 'var(--green)' : 'var(--red)') : 'var(--text2)' },
          { label: 'Cap', value: fmt(stock.market_cap), color: 'var(--text)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg2)', borderRadius: 7, padding: '0.35rem 0.2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</p>
            <p className="num" style={{ fontSize: '.78rem', fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Top reason or hot signal */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        {stock.hot_signal ? (
          <p style={{ fontSize: '.72rem', color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4 }}>
            🔥 {stock.hot_signal}
          </p>
        ) : stock.reasons.length > 0 ? (
          <p style={{ fontSize: '.72rem', color: 'var(--green)', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span>✓</span> {stock.reasons[0]}
          </p>
        ) : stock.warnings.length > 0 ? (
          <p style={{ fontSize: '.72rem', color: 'var(--yellow)', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span>⚠</span> {stock.warnings[0]}
          </p>
        ) : null}
        {/* Sector + Beta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '.62rem', color: 'var(--muted)', background: 'var(--bg2)', padding: '1px 7px', borderRadius: 999 }}>
            {stock.sector && stock.sector !== 'N/A' ? stock.sector : 'General'}
          </span>
          {stock.beta && <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>β {stock.beta}</span>}
        </div>
      </div>
    </div>
  );
}
