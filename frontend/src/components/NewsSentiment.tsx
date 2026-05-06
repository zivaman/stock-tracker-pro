import { useState, useRef } from 'react';
import { getNewsSentiment } from '../api/client';

/* ── Types ── */
interface Article {
  title: string;
  link: string;
  source: string;
  published: string;
  session: 'premarket' | 'regular' | 'afterhours';
  sentiment: 'bullish' | 'neutral' | 'bearish';
  score: number;       // 0-100
  bottom_line: string; // Hebrew AI summary
}

interface SentimentData {
  score: number;
  direction: 'bullish' | 'neutral' | 'bearish';
  summary: string | null;
  key_themes: string[];
  analyst_calls: string[];
  pre_market_signal: string | null;
}

interface NewsData {
  symbol: string;
  company_name: string;
  total_articles: number;
  premium_count: number;
  premarket: Article[];
  regular: Article[];
  afterhours: Article[];
  sentiment: SentimentData;
}

/* ── Helpers ── */
function relativeTime(iso: string): string {
  if (!iso) return '';
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 60) return `לפני ${Math.round(diff)} דקות`;
    if (diff < 1440) return `לפני ${Math.round(diff / 60)} שעות`;
    return `לפני ${Math.round(diff / 1440)} ימים`;
  } catch { return ''; }
}

function sentimentColor(s: string) {
  if (s === 'bullish') return 'var(--green)';
  if (s === 'bearish') return 'var(--red)';
  return 'var(--yellow)';
}

function sentimentBg(s: string) {
  if (s === 'bullish') return 'rgba(34,197,94,.12)';
  if (s === 'bearish') return 'rgba(239,68,68,.12)';
  return 'rgba(234,179,8,.12)';
}

function sentimentEmoji(s: string) {
  if (s === 'bullish') return '📈';
  if (s === 'bearish') return '📉';
  return '➡';
}

function sentimentLabel(s: string) {
  if (s === 'bullish') return 'שורי';
  if (s === 'bearish') return 'דובי';
  return 'ניטרלי';
}

function directionColor(d: string) { return sentimentColor(d); }
function directionLabel(d: string) {
  if (d === 'bullish') return '📈 שורי';
  if (d === 'bearish') return '📉 דובי';
  return '➡ ניטרלי';
}

/* ── Overall sentiment meter (top-level) ── */
function SentimentMeter({ score, direction }: { score: number; direction: string }) {
  const color = directionColor(direction);
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>סנטימנט מדיה כולל</span>
        <span style={{ fontSize: '.82rem', fontWeight: 700, color }}>{directionLabel(direction)}</span>
      </div>
      <div style={{ position: 'relative', height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)',
          opacity: 0.18,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 5,
          transition: 'width .7s ease',
          boxShadow: `0 0 8px ${color}88`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: '.6rem', color: '#ef4444' }}>0 דובי</span>
        <span style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700 }}>{score}/100</span>
        <span style={{ fontSize: '.6rem', color: '#22c55e' }}>שורי 100</span>
      </div>
    </div>
  );
}

/* ── Per-article mini sentiment bar ── */
function ArticleSentimentBar({ score, sentiment }: { score: number; sentiment: string }) {
  const color = sentimentColor(sentiment);
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {/* Badge */}
      <span style={{
        fontSize: '.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
        background: sentimentBg(sentiment), color: sentimentColor(sentiment),
        border: `1px solid ${sentimentColor(sentiment)}44`,
        whiteSpace: 'nowrap',
      }}>
        {sentimentEmoji(sentiment)} {sentimentLabel(sentiment)}
      </span>
      {/* Bar */}
      <div style={{ flex: 1, position: 'relative', height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)',
          opacity: 0.15,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: 'width .5s ease',
        }} />
      </div>
      <span style={{ fontSize: '.6rem', color: 'var(--muted)', minWidth: 28, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

/* ── Full article card with expandable bottom-line ── */
function ArticleCard({ a }: { a: Article }) {
  const [open, setOpen] = useState(false);
  const hasBL = !!a.bottom_line;
  const borderLeft = `3px solid ${sentimentColor(a.sentiment)}`;

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderLeft,
      borderRadius: 9,
      marginBottom: 9,
      overflow: 'hidden',
      transition: 'border-color .15s',
    }}>
      {/* ── Top row: title + open link ── */}
      <div style={{ padding: '10px 12px 6px' }}>
        <a
          href={a.link} target="_blank" rel="noreferrer"
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <p style={{
            fontSize: '.8rem', color: 'var(--text)', lineHeight: 1.45, marginBottom: 6,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {a.title}
          </p>
        </a>

        {/* Source + time */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
          <span style={{
            fontSize: '.62rem', fontWeight: 700, color: 'var(--blue)',
            background: 'rgba(99,102,241,.12)', borderRadius: 4, padding: '1px 6px',
          }}>{a.source}</span>
          {a.published && (
            <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{relativeTime(a.published)}</span>
          )}
          <span style={{
            fontSize: '.6rem', padding: '1px 5px', borderRadius: 4,
            background: 'var(--bg)', color: 'var(--muted)',
          }}>
            {a.session === 'premarket' ? '🌅 פרי-מרקט' : a.session === 'afterhours' ? '🌙 אחרי שוק' : '📰 שוטף'}
          </span>
        </div>

        {/* Mini sentiment bar */}
        <ArticleSentimentBar score={a.score} sentiment={a.sentiment} />
      </div>

      {/* ── Expand button ── */}
      {hasBL && (
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: '100%', padding: '5px 12px',
            borderTop: '1px solid var(--border)', border: 'none',
            background: open ? sentimentBg(a.sentiment) : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'var(--muted)', fontSize: '.67rem', fontWeight: 600,
            transition: 'background .2s',
          }}
        >
          <span>💡 שורה תחתונה</span>
          <span style={{ fontSize: '.7rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
        </button>
      )}

      {/* ── Bottom-line panel ── */}
      {open && hasBL && (
        <div style={{
          padding: '10px 14px 12px',
          borderTop: `1px solid ${sentimentColor(a.sentiment)}33`,
          background: sentimentBg(a.sentiment),
        }}>
          <p style={{
            fontSize: '.8rem', color: 'var(--text)', lineHeight: 1.6,
            borderRight: `3px solid ${sentimentColor(a.sentiment)}`,
            paddingRight: 10,
          }}>
            {a.bottom_line}
          </p>
          <a
            href={a.link} target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
              fontSize: '.68rem', color: 'var(--blue)', textDecoration: 'none', fontWeight: 600,
            }}
          >
            ← לקריאת הכתבה המלאה
          </a>
        </div>
      )}
    </div>
  );
}

type Tab = 'premarket' | 'regular' | 'afterhours' | 'summary';

/* ── Main component ── */
export default function NewsSentiment({ symbol, companyName }: { symbol: string; companyName: string }) {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('summary');
  const fetched = useRef(false);

  if (!fetched.current && !loading && !data && !error) {
    fetched.current = true;
    setLoading(true);
    getNewsSentiment(symbol, companyName)
      .then(d => setData(d))
      .catch(e => setError(e?.response?.data?.detail || e.message || 'שגיאה בטעינת חדשות'))
      .finally(() => setLoading(false));
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '.82rem' }}>
      ⏳ טוען חדשות וסנטימנט…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--red)', fontSize: '.82rem' }}>
      ⚠ {error}
    </div>
  );

  if (!data) return null;

  const s = data.sentiment;

  /* Count per-direction for tab labels */
  function countDir(arts: Article[], dir: string) {
    return arts.filter(a => a.sentiment === dir).length;
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'summary',    label: '📊 סיכום AI' },
    { key: 'premarket',  label: '🌅 פרי-מרקט',  count: data.premarket.length },
    { key: 'regular',    label: '📰 שוטף',       count: data.regular.length },
    { key: 'afterhours', label: '🌙 אחרי שוק',   count: data.afterhours.length },
  ];

  /* Bullish/bearish/neutral counts across all articles */
  const allArts = [...data.premarket, ...data.regular, ...data.afterhours];
  const nBull = countDir(allArts, 'bullish');
  const nBear = countDir(allArts, 'bearish');
  const nNeut = allArts.length - nBull - nBear;

  return (
    <div style={{ fontSize: '.82rem' }}>
      {/* ── Header stat row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'כתבות', value: data.total_articles, color: 'var(--text)' },
          { label: '📈 שוריות', value: nBull, color: 'var(--green)' },
          { label: '📉 דוביות', value: nBear, color: 'var(--red)' },
          { label: '➡ ניטרלי', value: nNeut, color: 'var(--yellow)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg2)', borderRadius: 8, padding: '7px 8px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</p>
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Overall sentiment meter ── */}
      <SentimentMeter score={s.score} direction={s.direction} />

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid',
              fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: tab === t.key ? 'var(--blue)' : 'var(--bg2)',
              color:      tab === t.key ? '#fff' : 'var(--text2)',
              borderColor: tab === t.key ? 'var(--blue)' : 'var(--border)',
            }}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── Summary tab ── */}
      {tab === 'summary' && (
        <div>
          {s.summary && (
            <div style={{
              background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.25)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 12,
            }}>
              <p style={{ fontSize: '.68rem', color: '#6366f1', fontWeight: 700, marginBottom: 6 }}>
                🤖 ניתוח AI — סנטימנט מדיה
              </p>
              <p style={{ fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.6 }}>{s.summary}</p>
            </div>
          )}

          {s.pre_market_signal && (
            <div style={{
              background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.3)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 12,
            }}>
              <p style={{ fontSize: '.68rem', color: 'var(--yellow)', fontWeight: 700, marginBottom: 4 }}>
                🌅 סיגנל פרי-מרקט
              </p>
              <p style={{ fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.55 }}>{s.pre_market_signal}</p>
            </div>
          )}

          {s.key_themes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: '.63rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 8 }}>נושאים מרכזיים</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {s.key_themes.map((theme, i) => (
                  <span key={i} style={{
                    fontSize: '.72rem', padding: '3px 9px', borderRadius: 20,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    color: 'var(--text2)', fontWeight: 600,
                  }}>{theme}</span>
                ))}
              </div>
            </div>
          )}

          {s.analyst_calls.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: '.63rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 8 }}>המלצות אנליסטים</p>
              {s.analyst_calls.map((call, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--blue)', fontSize: '.78rem', flexShrink: 0 }}>▸</span>
                  <span style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.4 }}>{call}</span>
                </div>
              ))}
            </div>
          )}

          {!s.summary && s.key_themes.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '.78rem', textAlign: 'center', padding: '1rem' }}>
              אין ניתוח AI זמין — ANTHROPIC_API_KEY לא מוגדר
            </p>
          )}

          {/* Preview: first 3 articles from each session */}
          {allArts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: '.63rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 8 }}>כתבות אחרונות</p>
              {allArts.slice(0, 5).map((a, i) => <ArticleCard key={i} a={a} />)}
              {allArts.length > 5 && (
                <p style={{ fontSize: '.7rem', color: 'var(--blue)', textAlign: 'center', marginTop: 4, cursor: 'pointer' }}
                  onClick={() => setTab('regular')}>
                  ← ראה את כל הכתבות
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'premarket' && (
        <div>
          {data.premarket.length === 0
            ? <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>אין כתבות פרי-מרקט</p>
            : data.premarket.map((a, i) => <ArticleCard key={i} a={a} />)
          }
        </div>
      )}

      {tab === 'regular' && (
        <div>
          {data.regular.length === 0
            ? <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>אין כתבות שוטפות</p>
            : data.regular.map((a, i) => <ArticleCard key={i} a={a} />)
          }
        </div>
      )}

      {tab === 'afterhours' && (
        <div>
          {data.afterhours.length === 0
            ? <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>אין כתבות אחרי שעות המסחר</p>
            : data.afterhours.map((a, i) => <ArticleCard key={i} a={a} />)
          }
        </div>
      )}

      {/* Footer */}
      <p style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
        מקורות: Google News · CNBC · Bloomberg · Reuters · Barron's ואחרים · ניתוח AI: Claude
      </p>
    </div>
  );
}
