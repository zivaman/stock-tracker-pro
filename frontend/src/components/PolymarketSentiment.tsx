import { useState, useEffect } from 'react';
import { getPolymarketSentiment } from '../api/client';

/* ─── Types ─── */
interface PolyMarket {
  question: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  liquidity: number;
  end_date: string;
  is_active: boolean;
  resolved: boolean;
  winner: string | null;
  slug: string;
  event_title: string;
  poly_url: string;
}
interface Sentiment {
  bullish_days: number;
  bearish_days: number;
  active_count: number;
  total_volume: number;
  active_bull_pct: number | null;
}
interface WeekMarket extends PolyMarket {
  volume_1wk: number;
  volume_24h: number;
  category: 'company' | 'macro';
}
interface PolyData {
  symbol: string;
  company_name: string;
  company_markets: PolyMarket[];
  macro_markets: PolyMarket[];
  week_activity: WeekMarket[];
  sentiment: Sentiment;
}

/* ─── Helpers ─── */
function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/* ─── Probability Bar ─── */
function ProbBar({ outcomes, prices, winner, isActive }: {
  outcomes: string[]; prices: number[]; winner: string | null; isActive: boolean;
}) {
  if (!outcomes.length || !prices.length) return null;

  // For "Up/Down" type — show as bull/bear bar
  const isUpDown = outcomes[0] === 'Up' && outcomes[1] === 'Down';
  const isYesNo  = outcomes[0] === 'Yes' && outcomes[1] === 'No';

  if ((isUpDown || isYesNo) && prices.length >= 2) {
    const bullPct = Math.round(prices[0] * 100);
    const bearPct = Math.round(prices[1] * 100);
    const bullColor = isActive ? '#00c896' : 'rgba(0,200,150,0.45)';
    const bearColor = isActive ? '#f04060' : 'rgba(240,64,96,0.45)';

    return (
      <div>
        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', marginBottom: 4 }}>
          <span style={{ color: bullColor, fontWeight: 700 }}>
            {isUpDown ? '▲ עלייה' : '✓ כן'} {bullPct}%
          </span>
          <span style={{ color: bearColor, fontWeight: 700 }}>
            {bearPct}% {isUpDown ? 'ירידה ▼' : 'לא ✗'}
          </span>
        </div>
        {/* Bar */}
        <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${bullPct}%`, background: bullColor, transition: 'width .5s', borderRadius: '4px 0 0 4px' }} />
          <div style={{ flex: 1, background: bearColor, borderRadius: '0 4px 4px 0' }} />
        </div>
        {/* Winner badge */}
        {winner && (
          <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: '.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 5,
              background: winner === 'Up' || winner === 'Yes' ? 'rgba(0,200,150,.2)' : 'rgba(240,64,96,.2)',
              color: winner === 'Up' || winner === 'Yes' ? '#00c896' : '#f04060',
              border: `1px solid ${winner === 'Up' || winner === 'Yes' ? '#00c89640' : '#f0406040'}`,
            }}>
              ✓ תוצאה: {winner === 'Up' ? '▲ עלה' : winner === 'Down' ? '▼ ירד' : winner === 'Yes' ? 'כן' : 'לא'}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Generic multi-outcome bars
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {outcomes.map((o, i) => {
        const pct = Math.round((prices[i] ?? 0) * 100);
        const isWinner = winner === o;
        const col = isWinner ? '#00c896' : pct > 50 ? '#3b82f6' : 'rgba(255,255,255,0.3)';
        return (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ fontSize: '.6rem', color: col, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o}: {pct}%
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: col, transition: 'width .5s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Market Card ─── */
function MarketCard({ m }: { m: PolyMarket }) {
  const isUpDown = m.outcomes[0] === 'Up' && m.outcomes[1] === 'Down';
  const borderCol = m.is_active
    ? 'rgba(0,200,150,0.3)'
    : m.resolved && m.winner
    ? (m.winner === 'Up' || m.winner === 'Yes' ? 'rgba(0,200,150,0.15)' : 'rgba(240,64,96,0.15)')
    : 'var(--border)';

  const bgCol = m.is_active
    ? 'rgba(0,200,150,0.04)'
    : 'var(--card2)';

  return (
    <div style={{
      background: bgCol, border: `1px solid ${borderCol}`,
      borderRadius: 10, padding: '10px 12px', marginBottom: 6,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {m.is_active ? (
              <span style={{ fontSize: '.6rem', fontWeight: 800, color: '#00c896', background: 'rgba(0,200,150,.15)', border: '1px solid rgba(0,200,150,.3)', borderRadius: 5, padding: '1px 7px' }}>
                🟢 פתוח
              </span>
            ) : (
              <span style={{ fontSize: '.6rem', color: 'var(--muted)', background: 'rgba(255,255,255,.05)', borderRadius: 5, padding: '1px 7px', border: '1px solid var(--border)' }}>
                ✅ הוכרע
              </span>
            )}
            <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>
              {m.is_active ? `נסגר: ${m.end_date}` : m.end_date}
            </span>
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--text)', fontWeight: 600, lineHeight: 1.4 }}>
            {m.question}
          </div>
        </div>
        {/* Volume */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>נפח</div>
          <div className="num" style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text2)' }}>{fmtVol(m.volume)}</div>
        </div>
      </div>

      {/* Probability bar */}
      <ProbBar outcomes={m.outcomes} prices={m.prices} winner={m.winner} isActive={m.is_active} />

      {/* Polymarket link */}
      <a
        href={m.poly_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.62rem', color: 'var(--muted)', marginTop: 7, textDecoration: 'none', transition: 'color .15s' }}
        onMouseOver={e => (e.currentTarget.style.color = '#6366f1')}
        onMouseOut={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        🔗 ראה ב-Polymarket ↗
      </a>
    </div>
  );
}

/* ─── Sentiment Gauge ─── */
function SentimentGauge({ s, companyMarkets }: { s: Sentiment; companyMarkets: PolyMarket[] }) {
  const totalDays = s.bullish_days + s.bearish_days;
  const bullPct = totalDays > 0 ? Math.round((s.bullish_days / totalDays) * 100) : null;
  const hasActive = s.active_count > 0;

  // Display bull pct: prefer active market signal, fallback to historical
  const displayBull = s.active_bull_pct !== null ? s.active_bull_pct : bullPct;
  const label =
    displayBull === null ? 'אין נתוני שוק' :
    displayBull >= 65 ? 'שורי' :
    displayBull >= 45 ? 'ניטרלי' :
    'דובי';
  const color =
    displayBull === null ? 'var(--muted)' :
    displayBull >= 65 ? '#00c896' :
    displayBull >= 45 ? '#f59e0b' :
    '#f04060';

  return (
    <div style={{
      background: 'var(--card2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '1rem', display: 'flex', gap: 16, alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      {/* Gauge ring */}
      <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
        <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle cx="36" cy="36" r="28" fill="none" stroke={color}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(displayBull ?? 50) * 1.759} 175.9`}
            style={{ transition: 'stroke-dasharray .8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="num" style={{ fontSize: '.95rem', fontWeight: 900, color, lineHeight: 1 }}>
            {displayBull !== null ? `${displayBull}%` : '—'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 4 }}>
          סנטימנט Polymarket
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color, marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: '.68rem', flexWrap: 'wrap' }}>
          {totalDays > 0 && (
            <>
              <span style={{ color: '#00c896' }}>▲ ימי עלייה: {s.bullish_days}</span>
              <span style={{ color: '#f04060' }}>▼ ימי ירידה: {s.bearish_days}</span>
            </>
          )}
          <span style={{ color: 'var(--muted)' }}>
            📊 {fmtVol(s.total_volume)} נפח כולל
          </span>
        </div>
        {hasActive && (
          <div style={{ marginTop: 4, fontSize: '.63rem', color: '#00c896' }}>
            🟢 {s.active_count} שוקי ניבוי פתוחים כרגע
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function PolymarketSentiment({ symbol, companyName }: { symbol: string; companyName?: string }) {
  const [data, setData] = useState<PolyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'company' | 'macro' | 'week'>('week');

  useEffect(() => {
    setLoading(true); setError('');
    getPolymarketSentiment(symbol, companyName || symbol)
      .then(d => setData(d))
      .catch(e => setError(e.response?.data?.detail || 'שגיאה בטעינת נתוני Polymarket'))
      .finally(() => setLoading(false));
  }, [symbol, companyName]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '1.5rem' }}>
      <div className="spin" style={{ width: 30, height: 30, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 10px' }} />
      <p style={{ color: 'var(--text2)', fontSize: '.82rem' }}>טוען נתוני Polymarket...</p>
    </div>
  );
  if (error) return <p style={{ color: 'var(--red)', fontSize: '.85rem' }}>⚠ {error}</p>;
  if (!data) return null;

  const hasCompany = data.company_markets.length > 0;
  const hasMacro   = data.macro_markets.length > 0;
  const hasWeek    = (data.week_activity || []).length > 0;

  const TABS = [
    { key: 'week'    as const, label: '📅 שבוע אחרון', count: (data.week_activity || []).length },
    { key: 'company' as const, label: `📌 ${symbol}`,  count: data.company_markets.length },
    { key: 'macro'   as const, label: '🌍 מאקרו',      count: data.macro_markets.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Polymarket header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>🔮</span>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 800, color: '#6366f1', letterSpacing: '.04em' }}>POLYMARKET</div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)' }}>שוק ניבויים — הימורים ציבוריים על תוצאות עתידיות</div>
          </div>
        </div>
        <a href={`https://polymarket.com/search?q=${encodeURIComponent(symbol)}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '.65rem', color: '#6366f1', textDecoration: 'none', border: '1px solid rgba(99,102,241,.3)', borderRadius: 6, padding: '4px 10px' }}
        >
          polymarket.com ↗
        </a>
      </div>

      {/* ── Sentiment gauge ── */}
      <SentimentGauge s={data.sentiment} companyMarkets={data.company_markets} />

      {/* ── Tab nav ── */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 2, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '5px 14px', borderRadius: 6, fontSize: '.73rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
            background: tab === t.key ? '#6366f1' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--muted)',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ marginRight: 6, background: tab === t.key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0 5px', fontSize: '.6rem' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Company markets ── */}
      {tab === 'company' && (
        <div>
          {!hasCompany ? (
            <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: 4 }}>
                אין שוקי ניבוי פעילים עבור {symbol}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                Polymarket מכיל בעיקר שווקים לניירות ניידים ופופולריים כמו GME, DJT, וקריפטו
              </div>
              <a href={`https://polymarket.com/search?q=${encodeURIComponent(symbol)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 10, fontSize: '.7rem', color: '#6366f1', textDecoration: 'none' }}
              >
                חפש ב-Polymarket ↗
              </a>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{data.company_markets.length} שוקי ניבוי ל-{symbol}</span>
                <span>
                  {data.sentiment.bullish_days > 0 || data.sentiment.bearish_days > 0
                    ? `▲ ${data.sentiment.bullish_days} עליות · ▼ ${data.sentiment.bearish_days} ירידות`
                    : ''}
                </span>
              </div>
              {data.company_markets.map((m, i) => <MarketCard key={i} m={m} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Week Activity ── */}
      {tab === 'week' && (
        <div>
          {!hasWeek ? (
            <div style={{ color: 'var(--muted)', fontSize: '.82rem', textAlign: 'center', padding: '1rem' }}>
              אין פעילות שבועית רלוונטית בפולימרקט
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>שוקי ניבוי עם הכי הרבה מסחר השבוע — רלוונטיים לסקטור ולמאקרו</span>
                <span style={{ color: '#6366f1' }}>7 ימים אחרונים</span>
              </div>
              {(data.week_activity || []).map((m, i) => (
                <div key={i} style={{
                  background: m.category === 'company' ? 'rgba(99,102,241,.04)' : 'var(--card2)',
                  border: `1px solid ${m.category === 'company' ? 'rgba(99,102,241,.2)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '9px 12px', marginBottom: 6,
                }}>
                  {/* Category + volume badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: '.58rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                      background: m.category === 'company' ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.05)',
                      color: m.category === 'company' ? '#818cf8' : 'var(--muted)',
                      border: `1px solid ${m.category === 'company' ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                    }}>
                      {m.category === 'company' ? `📌 ${data.symbol}` : '🌍 מאקרו'}
                    </span>
                    {m.is_active ? (
                      <span style={{ fontSize: '.58rem', color: '#00c896', background: 'rgba(0,200,150,.1)', border: '1px solid rgba(0,200,150,.25)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>🟢 פתוח</span>
                    ) : (
                      <span style={{ fontSize: '.58rem', color: 'var(--muted)', background: 'rgba(255,255,255,.04)', borderRadius: 4, padding: '2px 6px' }}>✅ הוכרע</span>
                    )}
                    <span className="num" style={{ fontSize: '.6rem', color: '#6366f1', marginRight: 'auto' }}>
                      📊 שבועי: {fmtVol(m.volume_1wk)}
                    </span>
                    {m.volume_24h > 0 && (
                      <span className="num" style={{ fontSize: '.58rem', color: 'var(--muted)' }}>24h: {fmtVol(m.volume_24h)}</span>
                    )}
                  </div>
                  {/* Question */}
                  <div style={{ fontSize: '.78rem', color: 'var(--text)', fontWeight: 600, marginBottom: 7 }}>
                    {m.question}
                  </div>
                  {/* Prob bar */}
                  <ProbBar outcomes={m.outcomes} prices={m.prices} winner={m.winner} isActive={m.is_active} />
                  {/* End date + link */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>
                      {m.is_active ? `נסגר: ${m.end_date}` : `הוכרע: ${m.end_date}`}
                    </span>
                    <a href={m.poly_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '.6rem', color: 'var(--muted)', textDecoration: 'none' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#6366f1')}
                      onMouseOut={e => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                      🔗 Polymarket ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Macro markets ── */}
      {tab === 'macro' && (
        <div>
          {!hasMacro ? (
            <div style={{ color: 'var(--muted)', fontSize: '.82rem', textAlign: 'center', padding: '1rem' }}>
              לא נמצאו שוקי מאקרו פעילים כרגע
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 8 }}>
                שוקי מאקרו רלוונטיים — ריבית פד, מיתון, כלכלה גלובלית
              </div>
              {data.macro_markets.map((m, i) => <MarketCard key={i} m={m} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div style={{ fontSize: '.62rem', color: 'var(--muted)', background: 'var(--card2)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
        ⚠ <b>Polymarket</b> הוא שוק ניבויים (Prediction Market) — ציבור המשתמשים מהמר על תוצאות.
        ההסתברויות משקפות דעת קהל ולא ניתוח מקצועי. אין לראות בכך המלצת השקעה.
      </div>
    </div>
  );
}
