import { useState, useEffect } from 'react';
import { getInsiderRecent } from '../api/client';
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw } from 'lucide-react';

interface Transaction {
  insider: string;
  position: string;
  kind: string;
  label: string;
  shares: number;
  value: number;
  price: number;
  text: string;
  date: string;
  ownership: string;
  url: string;
}

interface Summary {
  total_txs: number;
  sales_count: number;
  purchase_count: number;
  total_sold_usd: number;
  total_bought_usd: number;
  net_sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface InsiderData {
  symbol: string;
  period_days: number;
  transactions: Transaction[];
  summary: Summary;
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const KIND_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  purchase:        { color: '#22c55e', bg: 'rgba(34,197,94,.12)',   icon: '🟢' },
  sale:            { color: '#ef4444', bg: 'rgba(239,68,68,.12)',   icon: '🔴' },
  option_exercise: { color: '#f59e0b', bg: 'rgba(245,158,11,.10)', icon: '📋' },
  award:           { color: '#8b5cf6', bg: 'rgba(139,92,246,.10)', icon: '🎁' },
  gift:            { color: '#6b7280', bg: 'rgba(107,114,128,.10)', icon: '🎁' },
  other:           { color: '#6b7280', bg: 'rgba(107,114,128,.08)', icon: '↔' },
};

const PERIODS = [
  { days: 30,  label: '30 יום' },
  { days: 90,  label: '90 יום' },
  { days: 180, label: '6 חודשים' },
  { days: 365, label: 'שנה' },
];

export default function InsiderTrading({ symbol }: { symbol: string }) {
  const [data,    setData]    = useState<InsiderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [days,    setDays]    = useState(90);
  const [filter,  setFilter]  = useState<'all' | 'purchase' | 'sale' | 'option_exercise'>('all');

  const load = async (d = days) => {
    setLoading(true); setError('');
    try {
      const res = await getInsiderRecent(symbol, d);
      setData(res);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'שגיאה בטעינת נתוני Insider');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [symbol]);

  const handlePeriod = (d: number) => { setDays(d); load(d); };

  const txs = data?.transactions ?? [];
  const filtered = filter === 'all' ? txs : txs.filter(t => t.kind === filter);
  const s = data?.summary;

  const sentimentColor = s?.net_sentiment === 'bullish' ? '#22c55e'
    : s?.net_sentiment === 'bearish' ? '#ef4444' : '#6b7280';
  const SentimentIcon = s?.net_sentiment === 'bullish' ? TrendingUp
    : s?.net_sentiment === 'bearish' ? TrendingDown : Minus;

  // Bar showing buys vs sells
  const totalActivity = (s?.total_bought_usd ?? 0) + (s?.total_sold_usd ?? 0);
  const buyPct  = totalActivity > 0 ? ((s?.total_bought_usd ?? 0) / totalActivity) * 100 : 50;
  const sellPct = 100 - buyPct;

  const btn = (active: boolean, color?: string) => ({
    padding: '3px 10px', borderRadius: 6, fontSize: '.7rem', fontWeight: 600,
    border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`,
    background: active ? `${color || 'var(--blue)'}20` : 'transparent',
    color: active ? (color || 'var(--blue)') : 'var(--muted)',
    cursor: 'pointer', transition: 'all .12s',
  } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.days} style={btn(days === p.days)} onClick={() => handlePeriod(p.days)}>
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          רענן
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: '.78rem', color: 'var(--red)', background: 'rgba(239,68,68,.08)', borderRadius: 8, padding: '8px 12px' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '.82rem' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
          טוען נתוני Form 4...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          {s && s.total_txs > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Sentiment Banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: `${sentimentColor}10`,
                border: `1px solid ${sentimentColor}30`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <SentimentIcon size={20} style={{ color: sentimentColor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 800, color: sentimentColor }}>
                    {s.net_sentiment === 'bullish' ? 'סנטימנט שורי — Insiders קונים יותר ממה שמוכרים' :
                     s.net_sentiment === 'bearish' ? 'סנטימנט דובי — Insiders מוכרים יותר ממה שקונים' :
                     'סנטימנט ניטרלי'}
                  </div>
                  <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 2 }}>
                    {s.total_txs} עסקאות ב-{days} הימים האחרונים
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'קניות', value: s.purchase_count, sub: fmt(s.total_bought_usd), color: '#22c55e' },
                  { label: 'מכירות', value: s.sales_count,   sub: fmt(s.total_sold_usd),  color: '#ef4444' },
                  { label: 'סה"כ קנוי', value: fmt(s.total_bought_usd), sub: `${s.purchase_count} עסקאות`, color: '#22c55e' },
                  { label: 'סה"כ נמכר', value: fmt(s.total_sold_usd),  sub: `${s.sales_count} עסקאות`,  color: '#ef4444' },
                ].map((c, i) => (
                  <div key={i} style={{
                    background: 'var(--bg2)', border: `1px solid ${c.color}20`,
                    borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 3 }}>{c.label}</div>
                    <div style={{ fontSize: '.92rem', fontWeight: 800, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
                    <div style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Buy vs Sell bar */}
              {totalActivity > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.62rem', color: 'var(--muted)', marginBottom: 4 }}>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>קנייה {buyPct.toFixed(0)}%</span>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>מכירה {sellPct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'var(--bg2)' }}>
                    <div style={{ width: `${buyPct}%`, background: '#22c55e', transition: 'width .4s' }} />
                    <div style={{ width: `${sellPct}%`, background: '#ef4444', transition: 'width .4s' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter tabs */}
          {txs.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button style={btn(filter === 'all')} onClick={() => setFilter('all')}>
                הכל ({txs.length})
              </button>
              <button style={btn(filter === 'purchase', '#22c55e')} onClick={() => setFilter('purchase')}>
                🟢 קניות ({txs.filter(t => t.kind === 'purchase').length})
              </button>
              <button style={btn(filter === 'sale', '#ef4444')} onClick={() => setFilter('sale')}>
                🔴 מכירות ({txs.filter(t => t.kind === 'sale').length})
              </button>
              <button style={btn(filter === 'option_exercise', '#f59e0b')} onClick={() => setFilter('option_exercise')}>
                📋 אופציות ({txs.filter(t => t.kind === 'option_exercise').length})
              </button>
            </div>
          )}

          {/* Transactions */}
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '2rem',
              color: 'var(--muted)', fontSize: '.82rem',
              background: 'var(--bg2)', borderRadius: 10,
            }}>
              אין עסקאות Insider ב-{days} הימים האחרונים
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((tx, i) => {
                const cfg = KIND_CONFIG[tx.kind] ?? KIND_CONFIG.other;
                return (
                  <div key={i} style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.color}25`,
                    borderLeft: `3px solid ${cfg.color}`,
                    borderRadius: 10, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  }}>

                    {/* Icon + Type */}
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 60 }}>
                      <div style={{ fontSize: '1.1rem' }}>{cfg.icon}</div>
                      <div style={{ fontSize: '.58rem', fontWeight: 700, color: cfg.color, marginTop: 1 }}>
                        {tx.kind === 'purchase' ? 'קנייה' :
                         tx.kind === 'sale' ? 'מכירה' :
                         tx.kind === 'option_exercise' ? 'אופציה' :
                         tx.kind === 'award' ? 'הקצאה' : 'אחר'}
                      </div>
                    </div>

                    {/* Insider info */}
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)' }}>
                        {tx.insider || '—'}
                      </div>
                      <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 1 }}>
                        {tx.position || 'Insider'}{tx.ownership ? ` · ${tx.ownership}` : ''}
                      </div>
                    </div>

                    {/* Numbers */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      {tx.shares > 0 && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>מניות</div>
                          <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
                            {tx.shares.toLocaleString()}
                          </div>
                        </div>
                      )}
                      {tx.price > 0 && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>מחיר</div>
                          <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
                            ${tx.price.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {tx.value > 0 && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>שווי</div>
                          <div style={{ fontSize: '.88rem', fontWeight: 800, color: cfg.color, fontFamily: 'monospace' }}>
                            {fmt(tx.value)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Date + Link */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <div style={{ fontSize: '.68rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {tx.date}
                      </div>
                      {tx.url && tx.url !== 'None' && (
                        <a
                          href={tx.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '.62rem', color: 'var(--blue)', textDecoration: 'none' }}
                        >
                          <ExternalLink size={10} /> Form 4
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Disclaimer */}
          {txs.length > 0 && (
            <p style={{ fontSize: '.6rem', color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              * נתוני Form 4 מגיעים מ-SEC EDGAR דרך yfinance. עסקאות בעלי עניין כוללות מנהלים, דירקטורים ובעלי מניות מעל 10%.
              קנייה ישירה של בעלי עניין נחשבת לרוב לסימן שורי. מכירה עשויה לנבוע מסיבות אישיות שאינן קשורות לביצועי החברה.
            </p>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
