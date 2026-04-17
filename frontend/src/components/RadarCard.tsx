import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Flame, ExternalLink, Target, Users } from 'lucide-react';
import type { RadarStock } from '../types';

interface Props { stock: RadarStock; rank: number; }

const SIGNAL_CFG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  strong_buy: { label: 'קנייה חזקה', icon: '▲▲', color: '#00c896', bg: 'rgba(0,200,150,.15)', border: 'rgba(0,200,150,.4)' },
  buy:        { label: 'קנייה',      icon: '▲',  color: '#3b82f6', bg: 'rgba(59,130,246,.12)', border: 'rgba(59,130,246,.35)' },
  watch:      { label: 'מעקב',       icon: '◆',  color: '#f5c518', bg: 'rgba(245,197,24,.1)',  border: 'rgba(245,197,24,.35)' },
  neutral:    { label: 'ניטראלי',    icon: '●',  color: '#8fa3bf', bg: 'rgba(143,163,191,.1)', border: 'rgba(143,163,191,.3)' },
  sell:       { label: 'מכירה',      icon: '▼',  color: '#f04060', bg: 'rgba(240,64,96,.1)',   border: 'rgba(240,64,96,.35)' },
};

function fmt(mc: number | null): string {
  if (!mc) return '—';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
  return `$${(mc / 1e6).toFixed(0)}M`;
}

function fmtVol(v: number | null): string {
  if (!v) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return `${(v / 1e3).toFixed(0)}K`;
}

function PerfBadge({ label, value }: { label: string; value: number | null }) {
  const pos = value != null && value >= 0;
  const color = value == null ? 'var(--muted)' : pos ? 'var(--green)' : 'var(--red)';
  return (
    <div style={{ textAlign: 'center', padding: '4px 2px' }}>
      <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontSize: '.75rem', fontWeight: 700, color }}>
        {value == null ? '—' : `${pos ? '+' : ''}${value.toFixed(1)}%`}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 65 ? '#00c896' : score >= 45 ? '#3b82f6' : score >= 30 ? '#f5c518' : '#f04060';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <span className="num" style={{ fontSize: '.85rem', fontWeight: 800, color, width: 28, textAlign: 'left' }}>{score}</span>
    </div>
  );
}

function TaRow({ label, value, status }: { label: string; value: string; status: 'positive' | 'negative' | 'neutral' }) {
  const color = status === 'positive' ? 'var(--green)' : status === 'negative' ? 'var(--red)' : 'var(--text2)';
  const icon = status === 'positive' ? '▲' : status === 'negative' ? '▼' : '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '.72rem', color: 'var(--text2)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: '.65rem', color }}>{icon}</span>
        <span className="num" style={{ fontSize: '.72rem', fontWeight: 600, color }}>{value}</span>
      </div>
    </div>
  );
}

export default function RadarCard({ stock, rank }: Props) {
  const navigate = useNavigate();
  const cfg = SIGNAL_CFG[stock.signal] ?? SIGNAL_CFG.neutral;
  const dayPos = (stock.day_change ?? 0) >= 0;

  // 52W range position
  const hi = stock['52w_high'];
  const lo = stock['52w_low'];
  const rangePct = hi && lo && hi > lo ? ((stock.current_price - lo) / (hi - lo)) * 100 : null;

  // TA statuses
  const rsiStatus = stock.rsi == null ? 'neutral' : stock.rsi < 35 ? 'positive' : stock.rsi > 70 ? 'negative' : 'neutral';
  const macdStatus = stock.macd != null && stock.macd_signal != null ? (stock.macd > stock.macd_signal ? 'positive' : 'negative') : 'neutral';
  const sma50Status = stock.sma50 != null ? (stock.current_price > stock.sma50 ? 'positive' : 'negative') : 'neutral';
  const sma200Status = stock.sma200 != null ? (stock.current_price > stock.sma200 ? 'positive' : 'negative') : 'neutral';

  const analystLabel: Record<string, string> = {
    'strong_buy': 'Strong Buy', 'buy': 'Buy', 'hold': 'Hold',
    'underperform': 'Underperform', 'sell': 'Sell',
  };

  return (
    <div
      onClick={() => navigate(`/stock/${stock.symbol}`)}
      style={{
        background: 'var(--card)',
        border: `1px solid var(--border)`,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all .2s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = cfg.border;
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 40px rgba(0,0,0,.25)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Signal color strip */}
      <div style={{ height: 3, background: cfg.color, width: '100%' }} />

      {/* Header: Rank + Symbol + Company + Signal */}
      <div style={{ padding: '0.9rem 1rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
            {/* Rank */}
            <div style={{
              width: 26, height: 26, borderRadius: 6, background: 'var(--bg2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.7rem', fontWeight: 700, color: 'var(--muted)', flexShrink: 0, marginTop: 2
            }}>{rank}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {stock.symbol}
                </span>
                {stock.hot_signal && <Flame size={14} style={{ color: '#f5c518' }} />}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stock.name}
              </div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: 1 }}>
                {stock.sector !== 'N/A' ? stock.sector : ''}{stock.sector !== 'N/A' && ' · '}מדד S&P
              </div>
            </div>
          </div>
          {/* Signal badge — enlarged with icon */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <div style={{
              padding: '5px 12px', borderRadius: 8, fontWeight: 800,
              color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: '.85rem' }}>{cfg.icon}</span>
              <span style={{ fontSize: '.8rem' }}>{cfg.label}</span>
            </div>
            <div className="num" style={{ fontSize: '.72rem', color: cfg.color, fontWeight: 700 }}>ציון: {stock.score}/100</div>
          </div>
        </div>

        {/* Description */}
        {stock.description && (
          <p style={{
            fontSize: '.68rem', color: 'var(--text2)', marginTop: 8, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {stock.description}
          </p>
        )}
      </div>

      {/* Price section */}
      <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="num" style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1 }}>
              ${stock.current_price.toFixed(2)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              {dayPos ? <TrendingUp size={12} style={{ color: 'var(--green)' }} /> : <TrendingDown size={12} style={{ color: 'var(--red)' }} />}
              <span className="num" style={{ fontSize: '.78rem', fontWeight: 700, color: dayPos ? 'var(--green)' : 'var(--red)' }}>
                {dayPos ? '+' : ''}{stock.day_change?.toFixed(2) ?? '0.00'}%
              </span>
              <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>יום</span>
              {stock.week_change != null && (
                <>
                  <span style={{ color: 'var(--border2)', fontSize: '.7rem' }}>·</span>
                  <span className="num" style={{ fontSize: '.72rem', fontWeight: 600, color: stock.week_change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {stock.week_change >= 0 ? '+' : ''}{stock.week_change.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>שבוע</span>
                </>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 2 }}>שווי שוק</div>
            <div className="num" style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)' }}>{fmt(stock.market_cap)}</div>
            {stock.pe_ratio && (
              <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 1 }}>P/E: <span className="num" style={{ color: 'var(--text2)' }}>{stock.pe_ratio.toFixed(1)}</span></div>
            )}
          </div>
        </div>

        {/* 52W range bar */}
        {rangePct != null && hi && lo && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>52W Low <span className="num">${lo.toFixed(2)}</span></span>
              <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}><span className="num">${hi.toFixed(2)}</span> 52W High</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, position: 'relative' }}>
              <div style={{ height: '100%', width: `${Math.min(rangePct, 100)}%`, background: `linear-gradient(90deg, var(--red), var(--yellow), var(--green))`, borderRadius: 2 }} />
              <div style={{
                position: 'absolute', top: -3, width: 10, height: 10, borderRadius: '50%',
                background: 'var(--text)', border: '2px solid var(--card)',
                left: `calc(${Math.min(rangePct, 100)}% - 5px)`
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Technical Analysis */}
      <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
          ניתוח טכני
        </div>
        <ScoreBar score={stock.score} />
        <div style={{ marginTop: 8 }}>
          <TaRow label="RSI (14)" value={stock.rsi?.toFixed(1) ?? '—'} status={rsiStatus} />
          <TaRow
            label="MACD"
            value={macdStatus === 'positive' ? 'Bullish Crossover' : macdStatus === 'negative' ? 'Bearish' : '—'}
            status={macdStatus}
          />
          <TaRow
            label="SMA 50"
            value={stock.sma50 ? `$${stock.sma50.toFixed(2)}` : '—'}
            status={sma50Status}
          />
          <TaRow
            label="SMA 200"
            value={stock.sma200 ? `$${stock.sma200.toFixed(2)}` : '—'}
            status={sma200Status}
          />
          {stock.volume != null && stock.avg_volume != null && (
            <TaRow
              label="Volume"
              value={`${fmtVol(stock.volume)} (avg ${fmtVol(stock.avg_volume)})`}
              status={stock.volume > stock.avg_volume * 1.2 ? 'positive' : 'neutral'}
            />
          )}
        </div>
      </div>

      {/* Performance by period */}
      <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
          ביצועים לפי תקופה
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
          <PerfBadge label="1D"  value={stock.day_change ?? null} />
          <PerfBadge label="1W"  value={stock.week_change ?? null} />
          <PerfBadge label="1M"  value={stock.perf_1m ?? null} />
          <PerfBadge label="3M"  value={stock.perf_3m ?? null} />
          <PerfBadge label="6M"  value={stock.perf_6m ?? null} />
          <PerfBadge label="1Y"  value={stock.perf_1y ?? null} />
        </div>
      </div>

      {/* Analyst + Target */}
      {(stock.analyst_rec || stock.target_price) && (
        <div style={{ padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card2)' }}>
          {stock.analyst_rec && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Users size={11} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: '.68rem', color: 'var(--text2)' }}>
                {analystLabel[stock.analyst_rec] || stock.analyst_rec}
                {stock.analyst_count ? ` (${stock.analyst_count})` : ''}
              </span>
            </div>
          )}
          {stock.target_price && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Target size={11} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: '.68rem', color: 'var(--text2)' }}>
                יעד: <span className="num" style={{ color: 'var(--text)', fontWeight: 700 }}>${stock.target_price.toFixed(2)}</span>
                {' '}
                <span style={{ color: stock.target_price > stock.current_price ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  ({stock.target_price > stock.current_price ? '+' : ''}{((stock.target_price - stock.current_price) / stock.current_price * 100).toFixed(1)}%)
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reasons / Hot signal */}
      <div style={{ padding: '0.6rem 1rem', flex: 1 }}>
        {stock.hot_signal && (
          <div style={{ background: 'rgba(245,197,24,.08)', border: '1px solid rgba(245,197,24,.25)', borderRadius: 7, padding: '5px 9px', marginBottom: 6, fontSize: '.7rem', color: '#f5c518', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Flame size={12} /> {stock.hot_signal}
          </div>
        )}
        {stock.reasons.slice(0, 2).map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 3 }}>
            <span style={{ color: 'var(--green)', fontSize: '.7rem', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '.7rem', color: 'var(--text2)', lineHeight: 1.4 }}>{r}</span>
          </div>
        ))}
        {stock.warnings.slice(0, 1).map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 3 }}>
            <span style={{ color: 'var(--yellow)', fontSize: '.7rem', flexShrink: 0 }}>⚠</span>
            <span style={{ fontSize: '.7rem', color: 'var(--text2)', lineHeight: 1.4 }}>{w}</span>
          </div>
        ))}
      </div>

      {/* Footer: sector + beta + link */}
      <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card2)' }}>
        <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>
          {stock.sector !== 'N/A' ? stock.sector : 'General'}
          {stock.beta ? ` · β${stock.beta}` : ''}
        </span>
        <ExternalLink size={11} style={{ color: 'var(--muted)' }} />
      </div>
    </div>
  );
}
