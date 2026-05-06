import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search as SearchIcon, TrendingUp, TrendingDown, PlusCircle,
  BarChart2, ExternalLink, X, Loader, Building2, Globe,
  Users, Target, Activity, ChevronLeft
} from 'lucide-react';
import { getStockDetail, addPosition, addZivRecord, searchSymbols } from '../api/client';
import type { SearchResult } from '../api/client';
import type { StockDetail } from '../types';

/* ─── Popular suggestions ─── */
const POPULAR = [
  { symbol: 'AAPL', name: 'Apple' }, { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' }, { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'AMZN', name: 'Amazon' }, { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta' }, { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'AMD', name: 'AMD' }, { symbol: 'SPY', name: 'S&P 500 ETF' },
];

/* ─── Helpers ─── */
function fmt(n: number | null | undefined, prefix = '$'): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e12) return `${prefix}${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9)  return `${prefix}${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6)  return `${prefix}${(n / 1e6).toFixed(0)}M`;
  return `${prefix}${n.toLocaleString()}`;
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/* ─── Score color ─── */
function scoreColor(s: number) {
  return s >= 65 ? 'var(--green)' : s >= 45 ? 'var(--blue)' : s >= 30 ? 'var(--yellow)' : 'var(--red)';
}

/* ─── TA indicator row ─── */
function TaRow({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  const color = ok === null ? 'var(--text2)' : ok ? 'var(--green)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '.75rem', color: 'var(--text2)' }}>{label}</span>
      <span className="num" style={{ fontSize: '.75rem', fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

/* ─── Period bar ─── */
function PeriodBadge({ label, value }: { label: string; value: number | null }) {
  const pos = value != null && value >= 0;
  return (
    <div style={{ textAlign: 'center', background: 'var(--bg2)', borderRadius: 8, padding: '6px 4px' }}>
      <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontSize: '.78rem', fontWeight: 700, color: value == null ? 'var(--muted)' : pos ? 'var(--green)' : 'var(--red)' }}>
        {value == null ? '—' : pct(value)}
      </div>
    </div>
  );
}

/* ─── Add to Portfolio Modal ─── */
function AddPortfolioModal({ symbol, name, currentPrice, onClose, onDone }: {
  symbol: string; name: string; currentPrice: number;
  onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({
    buy_price: currentPrice.toFixed(2),
    buy_date: new Date().toISOString().split('T')[0],
    quantity: '1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inp = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: '.85rem', outline: 'none', width: '100%' } as React.CSSProperties;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await addPosition({ symbol, name, buy_price: parseFloat(form.buy_price), buy_date: form.buy_date, quantity: parseFloat(form.quantity) });
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שגיאה בהוספה');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 400, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1.1rem' }}>הוסף {symbol} לתיק</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '.72rem', color: 'var(--text2)', display: 'block', marginBottom: 5 }}>מחיר כניסה ($)</label>
            <input style={inp} type="number" step="0.01" value={form.buy_price}
              onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '.72rem', color: 'var(--text2)', display: 'block', marginBottom: 5 }}>כמות מניות</label>
            <input style={inp} type="number" step="0.001" min="0.001" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '.72rem', color: 'var(--text2)', display: 'block', marginBottom: 5 }}>תאריך כניסה</label>
            <input style={inp} type="date" value={form.buy_date}
              onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))} required />
          </div>
          {/* Value preview */}
          <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '.78rem', color: 'var(--text2)' }}>סה"כ השקעה</span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>
              ${(parseFloat(form.buy_price || '0') * parseFloat(form.quantity || '0')).toFixed(2)}
            </span>
          </div>
          {error && <p style={{ color: 'var(--red)', fontSize: '.8rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <span className="spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', display: 'inline-block' }} /> : <PlusCircle size={15} />}
              הוסף לתיק
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Search Page ─── */
export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StockDetail | null>(null);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addedMsg, setAddedMsg] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const q = searchParams.get('q');
    if (q) doSearch(q);
  }, []);

  // Live autocomplete while typing
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    if (sugTimer.current) clearTimeout(sugTimer.current);
    setSugLoading(true);
    sugTimer.current = setTimeout(async () => {
      try {
        const res = await searchSymbols(q);
        setSuggestions(res);
        setShowSuggestions(res.length > 0);
      } catch { /* ignore */ }
      finally { setSugLoading(false); }
    }, 300);
    return () => { if (sugTimer.current) clearTimeout(sugTimer.current); };
  }, [query]);

  const doSearch = async (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setQuery(s); setLoading(true); setError(''); setResult(null); setAddedMsg('');
    setShowSuggestions(false); setSuggestions([]);
    try {
      const data = await getStockDetail(s);
      setResult(data);
    } catch {
      setError(`לא נמצאו נתונים עבור "${s}". בדוק את הסימול ונסה שוב.`);
    } finally { setLoading(false); }
  };

  const handleAddZiv = async () => {
    if (!result) return;
    try {
      await addZivRecord({
        symbol: result.symbol,
        name: result.name,
        signal_type: result.signal.signal.includes('buy') ? 'buy' : 'sell',
        rec_price: result.current_price,
        ta_score: result.signal.score,
      });
      setAddedMsg('✓ נוסף למדד זיו בהצלחה');
    } catch { setAddedMsg('שגיאה בהוספה למדד זיו'); }
  };

  const sig = result?.signal;
  const info = result?.info;
  const perf = result?.performance;

  const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
    strong_buy: { label: 'קנייה חזקה', color: 'var(--green)' },
    buy:        { label: 'קנייה',      color: 'var(--blue)' },
    watch:      { label: 'מעקב',       color: 'var(--yellow)' },
    neutral:    { label: 'ניטראלי',    color: 'var(--text2)' },
    sell:       { label: 'מכירה',      color: 'var(--red)' },
  };
  const sigCfg = sig ? (SIGNAL_LABELS[sig.signal] ?? SIGNAL_LABELS.neutral) : null;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* ─── Search Header ─── */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>חיפוש מניה</h1>
        <p style={{ fontSize: '.85rem', color: 'var(--text2)' }}>חפש לפי שם חברה או סימול — Apple, NVIDIA, TSLA...</p>
      </div>

      {/* ─── Search Box ─── */}
      <form
        onSubmit={e => { e.preventDefault(); doSearch(query); }}
        style={{ display: 'flex', gap: 10, marginBottom: '1.5rem' }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <SearchIcon size={17} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
            placeholder="הקלד שם חברה או סימול... Apple, NVDA, Tesla"
            style={{
              width: '100%', background: 'var(--card)', border: '2px solid var(--border)',
              borderRadius: showSuggestions && suggestions.length > 0 ? '12px 12px 0 0' : 12,
              padding: '0.85rem 1rem 0.85rem 3rem',
              color: 'var(--text)', fontSize: '1rem', outline: 'none',
              transition: 'border-color .15s', direction: 'ltr',
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.5px',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--blue)'; setShowSuggestions(true); }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; setTimeout(() => setShowSuggestions(false), 150); }}
          />
          {sugLoading && (
            <div style={{ position: 'absolute', left: 40, top: '50%', transform: 'translateY(-50%)' }}>
              <Loader size={14} className="spin" style={{ color: 'var(--blue)' }} />
            </div>
          )}
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResult(null); setError(''); setSuggestions([]); inputRef.current?.focus(); }}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          )}
          {/* ── Autocomplete dropdown ── */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--card)', border: '2px solid var(--blue)',
              borderTop: 'none', borderRadius: '0 0 12px 12px',
              overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            }}>
              {suggestions.slice(0, 8).map(s => (
                <button
                  key={s.symbol}
                  type="button"
                  onMouseDown={() => doSearch(s.symbol)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '0.6rem 1rem', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--card2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '.85rem', color: 'var(--blue)', width: 70, flexShrink: 0, textAlign: 'left' }}>{s.symbol}</span>
                  <span style={{ fontSize: '.8rem', color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ fontSize: '.65rem', color: 'var(--muted)', flexShrink: 0 }}>{s.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={loading || !query.trim()} className="btn-primary" style={{ padding: '0.85rem 1.5rem', fontSize: '.9rem', gap: 8 }}>
          {loading ? <Loader size={15} className="spin" /> : <SearchIcon size={15} />}
          חפש
        </button>
      </form>

      {/* ─── Popular chips ─── */}
      {!result && !loading && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>מניות פופולריות</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {POPULAR.map(p => (
              <button key={p.symbol} onClick={() => doSearch(p.symbol)} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 14px', cursor: 'pointer', transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--blue)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
              >
                <span style={{ fontWeight: 800, fontSize: '.82rem', color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{p.symbol}</span>
                <span style={{ fontSize: '.72rem', color: 'var(--text2)' }}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Loading ─── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', gap: 14 }}>
          <div className="spin" style={{ width: 40, height: 40, border: '3px solid var(--green)', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ color: 'var(--text2)' }}>טוען נתונים עבור {query}...</p>
        </div>
      )}

      {/* ─── Error ─── */}
      {error && (
        <div style={{ background: 'rgba(240,64,96,.08)', border: '1px solid rgba(240,64,96,.3)', borderRadius: 12, padding: '1rem 1.25rem', color: 'var(--red)', fontSize: '.9rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* ─── Result card ─── */}
      {result && sig && info && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

          {/* Signal strip */}
          <div style={{ height: 4, background: sigCfg?.color }} />

          {/* ─── Header ─── */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1 }}>{result.symbol}</span>
                <div style={{ background: sigCfg?.color + '22', border: `1px solid ${sigCfg?.color}55`, borderRadius: 8, padding: '4px 12px' }}>
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: sigCfg?.color }}>{sigCfg?.label}</span>
                </div>
              </div>
              <p style={{ fontSize: '.9rem', color: 'var(--text2)', marginTop: 4 }}>{result.name}</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                {info.sector && info.sector !== 'N/A' && (
                  <span style={{ fontSize: '.68rem', color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>{info.sector}</span>
                )}
                {info.industry && info.industry !== 'N/A' && (
                  <span style={{ fontSize: '.68rem', color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>{info.industry}</span>
                )}
                {info.country && (
                  <span style={{ fontSize: '.68rem', color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>🌍 {info.country}</span>
                )}
              </div>
            </div>
            {/* Price */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="num" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1 }}>
                ${result.current_price.toFixed(2)}
              </div>
              {perf?.['1d'] != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                  {perf['1d'] >= 0 ? <TrendingUp size={13} style={{ color: 'var(--green)' }} /> : <TrendingDown size={13} style={{ color: 'var(--red)' }} />}
                  <span className="num" style={{ fontSize: '.85rem', fontWeight: 700, color: perf['1d'] >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {pct(perf['1d'])} היום
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ─── Company description ─── */}
          {info.description && (
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Building2 size={13} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>אודות החברה</span>
              </div>
              <p style={{ fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.6 }}>
                {info.description.slice(0, 400)}{info.description.length > 400 ? '...' : ''}
              </p>
              {info.website && (
                <a href={info.website} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '.72rem', color: 'var(--blue)', textDecoration: 'none' }}>
                  <Globe size={11} /> {info.website}
                </a>
              )}
            </div>
          )}

          {/* ─── Key Metrics ─── */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700, marginBottom: 10 }}>נתוני מפתח</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {[
                { label: 'שווי שוק', value: fmt(info.market_cap) },
                { label: 'P/E', value: info.pe_ratio?.toFixed(1) ?? '—' },
                { label: 'ביטא', value: info.beta?.toFixed(2) ?? '—' },
                { label: 'דיבידנד', value: info.dividend_yield ? `${(info.dividend_yield * 100).toFixed(2)}%` : 'אין' },
                { label: '52W גבוה', value: info['52w_high'] ? `$${info['52w_high'].toFixed(2)}` : '—' },
                { label: '52W נמוך', value: info['52w_low'] ? `$${info['52w_low'].toFixed(2)}` : '—' },
                { label: 'עובדים', value: info.employees ? info.employees.toLocaleString() : '—' },
                { label: 'הכנסות', value: fmt(info.revenue) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                  <div className="num" style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Technical Analysis ─── */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Activity size={13} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>ניתוח טכני</span>
              </div>
              {/* Score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${sig.score}%`, background: scoreColor(sig.score), borderRadius: 4, transition: 'width .5s' }} />
                </div>
                <span className="num" style={{ fontSize: '1.1rem', fontWeight: 900, color: scoreColor(sig.score), width: 36 }}>{sig.score}</span>
              </div>
              <TaRow label="RSI (14)" value={sig.rsi?.toFixed(1) ?? '—'}
                ok={sig.rsi == null ? null : sig.rsi < 35 ? true : sig.rsi > 70 ? false : null} />
              <TaRow label="MACD" value={sig.macd != null && sig.macd_signal != null ? (sig.macd > sig.macd_signal ? 'Bullish ▲' : 'Bearish ▼') : '—'}
                ok={sig.macd != null && sig.macd_signal != null ? sig.macd > sig.macd_signal : null} />
              <TaRow label="SMA 50" value={sig.sma50 ? `$${sig.sma50.toFixed(2)}` : '—'}
                ok={sig.sma50 ? result.current_price > sig.sma50 : null} />
              <TaRow label="SMA 200" value={sig.sma200 ? `$${sig.sma200.toFixed(2)}` : '—'}
                ok={sig.sma200 ? result.current_price > sig.sma200 : null} />
              <TaRow label="Bollinger" value={sig.bb_upper && sig.bb_lower ? `$${sig.bb_lower.toFixed(0)} – $${sig.bb_upper.toFixed(0)}` : '—'}
                ok={null} />
            </div>

            {/* Reasons */}
            <div>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>סיגנלים ✓</span>
              </div>
              {sig.reasons.slice(0, 4).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.4 }}>{r}</span>
                </div>
              ))}
              {sig.warnings.length > 0 && (
                <>
                  <div style={{ marginTop: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>אזהרות ⚠</span>
                  </div>
                  {sig.warnings.slice(0, 2).map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--yellow)', flexShrink: 0 }}>⚠</span>
                      <span style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.4 }}>{w}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ─── Performance by period ─── */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700, marginBottom: 10 }}>ביצועים לפי תקופה</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <PeriodBadge label="1D"  value={perf?.['1d'] ?? null} />
              <PeriodBadge label="1M"  value={perf?.['1m'] ?? null} />
              <PeriodBadge label="3M"  value={perf?.['3m'] ?? null} />
              <PeriodBadge label="6M"  value={perf?.['6m'] ?? null} />
              <PeriodBadge label="1Y"  value={perf?.['1y'] ?? null} />
            </div>
          </div>

          {/* ─── Action buttons ─── */}
          <div style={{ padding: '1rem 1.5rem', background: 'var(--card2)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Full analysis */}
            <button
              onClick={() => navigate(`/stock/${result.symbol}`)}
              className="btn-primary"
              style={{ gap: 8 }}
            >
              <ExternalLink size={14} />
              ניתוח מלא + גרף
              <ChevronLeft size={13} />
            </button>

            {/* Add to portfolio */}
            <button onClick={() => setShowAddModal(true)} className="btn-secondary" style={{ gap: 8 }}>
              <PlusCircle size={14} />
              הוסף לתיק
            </button>

            {/* Add to Ziv Index */}
            <button onClick={handleAddZiv} className="btn-secondary" style={{ gap: 8, color: 'var(--purple)', borderColor: 'var(--purple)' }}>
              <BarChart2 size={14} />
              הוסף למדד זיו
            </button>

            {addedMsg && (
              <span style={{ fontSize: '.78rem', color: addedMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)', marginRight: 'auto' }}>
                {addedMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}
      {showAddModal && result && (
        <AddPortfolioModal
          symbol={result.symbol}
          name={result.name}
          currentPrice={result.current_price}
          onClose={() => setShowAddModal(false)}
          onDone={() => { setShowAddModal(false); setAddedMsg('✓ נוסף לתיק בהצלחה'); }}
        />
      )}
    </div>
  );
}
