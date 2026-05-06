import { useEffect, useState, useRef } from 'react';
import { PlusCircle, RefreshCw, TrendingUp, TrendingDown, DollarSign, Briefcase, WifiOff, Search, X, ChevronLeft, Loader2 } from 'lucide-react';
import { getPortfolio, addPosition, removePosition, getStockDetail, searchSymbols } from '../api/client';
import type { SearchResult } from '../api/client';
import PortfolioCard from '../components/PortfolioCard';
import AIPortfolioAnalysis from '../components/AIPortfolioAnalysis';
import type { PortfolioPosition, PortfolioSummary } from '../types';

const CACHE_KEY = 'cache_portfolio';

interface PortfolioData {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
}

function loadCache(): PortfolioData | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function saveCache(data: PortfolioData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

/* ─── Popular stocks list ─── */
const POPULAR_STOCKS = [
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'MSFT',  name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'META',  name: 'Meta Platforms Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'WMT',   name: 'Walmart Inc.' },
  { symbol: 'DIS',   name: 'Walt Disney Co.' },
  { symbol: 'PYPL',  name: 'PayPal Holdings' },
  { symbol: 'COIN',  name: 'Coinbase Global Inc.' },
  { symbol: 'PLTR',  name: 'Palantir Technologies' },
  { symbol: 'SOFI',  name: 'SoFi Technologies' },
  { symbol: 'UBER',  name: 'Uber Technologies Inc.' },
  { symbol: 'SPOT',  name: 'Spotify Technology SA' },
];

/* ─── Stock Row in Picker ─── */
function StockRow({ stock, onSelect }: { stock: { symbol: string; name: string }; onSelect: (s: { symbol: string; name: string }) => void }) {
  return (
    <button
      onClick={() => onSelect(stock)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '0.6rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: 'transparent', textAlign: 'right', transition: 'background .12s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover)'}
      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      <div style={{ width: 34, height: 34, borderRadius: 7, background: 'var(--card2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '.62rem', fontWeight: 900, color: 'var(--blue)' }}>{stock.symbol.slice(0, 2)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.88rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>{stock.symbol}</div>
        <div style={{ fontSize: '.72rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</div>
      </div>
      <ChevronLeft size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </button>
  );
}

/* ─── Stock Picker Modal ─── */
function StockPickerModal({ onAdd, onClose }: { onAdd: () => void; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Step 2 form
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const typedQuery = query.trim();
  // Local filter of popular stocks
  const filtered = typedQuery
    ? POPULAR_STOCKS.filter(s =>
        s.symbol.toLowerCase().includes(typedQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(typedQuery.toLowerCase())
      )
    : POPULAR_STOCKS;

  // Debounced live search
  useEffect(() => {
    if (typedQuery.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchResults([]);
    setSearchError('');
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchSymbols(typedQuery);
        setSearchResults(results);
        if (results.length === 0) setSearchError(`לא נמצאו תוצאות עבור "${typedQuery}"`);
      } catch {
        setSearchError('שגיאה בחיפוש — נסה שוב');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [typedQuery]);

  const handleSelect = async (stock: { symbol: string; name: string }) => {
    setSelected(stock);
    setStep(2);
    setSubmitError('');
    setBuyPrice('');
    setLoadingPrice(true);
    try {
      const detail = await getStockDetail(stock.symbol);
      if (detail.current_price) setBuyPrice(String(detail.current_price));
    } catch { /* leave empty */ }
    finally { setLoadingPrice(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !buyPrice || !quantity) { setSubmitError('אנא מלא את כל השדות'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      await addPosition({
        symbol: selected.symbol,
        name: selected.name,
        buy_price: parseFloat(buyPrice),
        buy_date: buyDate,
        quantity: parseFloat(quantity),
      });
      onAdd(); onClose();
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || 'שגיאה בהוספת המניה');
    } finally { setSubmitting(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%',
    background: 'var(--card2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.5rem 0.75rem',
    fontSize: '.85rem',
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 460,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* Modal header */}
        <div style={{ padding: '1rem 1.2rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setBuyPrice(''); setQuantity(''); setSubmitError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: '2px 6px 2px 4px', borderRadius: 6, fontSize: '1rem', lineHeight: 1 }}
              >←</button>
            )}
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {step === 1 ? 'הוסף מניה לתיק' : `הוסף ${selected?.symbol} לתיק`}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* ── STEP 1: Browse & Search ── */}
        {step === 1 && (
          <>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="חפש מניה לפי שם או סימול..."
                  style={{ ...inp, paddingRight: '2.2rem' }}
                />
              </div>
              {searching && (
                <p style={{ fontSize: '.72rem', color: 'var(--blue)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Loader2 size={11} className="spin" /> מחפש...
                </p>
              )}
              {searchError && <p style={{ fontSize: '.72rem', color: 'var(--red)', marginTop: 5 }}>{searchError}</p>}
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
              {/* Live search results */}
              {typedQuery.length >= 2 && searchResults.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <p style={{ fontSize: '.65rem', color: 'var(--blue)', padding: '0.2rem 0.75rem 0.4rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    תוצאות חיפוש ({searchResults.length})
                  </p>
                  {searchResults.map(s => (
                    <StockRow key={s.symbol} stock={s} onSelect={handleSelect} />
                  ))}
                  {filtered.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0.75rem' }} />}
                </div>
              )}

              {/* Popular / filtered list */}
              {(typedQuery.length < 2 || filtered.length > 0) && (
                <>
                  <p style={{ fontSize: '.65rem', color: 'var(--muted)', padding: '0.2rem 0.75rem 0.4rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {typedQuery ? 'פופולריות מתאימות' : 'מניות פופולריות'}
                  </p>
                  {filtered.map(stock => (
                    <StockRow key={stock.symbol} stock={stock} onSelect={handleSelect} />
                  ))}
                </>
              )}

              {typedQuery.length >= 2 && !searching && searchResults.length === 0 && filtered.length === 0 && (
                <p style={{ fontSize: '.82rem', color: 'var(--text2)', padding: '1rem', textAlign: 'center' }}>לא נמצאו תוצאות</p>
              )}
            </div>
          </>
        )}

        {/* ── STEP 2: Add Details ── */}
        {step === 2 && selected && (
          <div style={{ padding: '1.2rem', overflowY: 'auto', flex: 1 }}>
            {/* Selected stock badge */}
            <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(59,130,246,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '.7rem', fontWeight: 900, color: 'var(--blue)' }}>{selected.symbol.slice(0, 2)}</span>
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>{selected.symbol}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--text2)' }}>{selected.name}</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '.75rem', color: 'var(--text2)', display: 'block', marginBottom: 5 }}>מחיר כניסה ($) *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number" step="0.01" min="0" placeholder="0.00"
                    value={buyPrice}
                    onChange={e => setBuyPrice(e.target.value)}
                    style={inp}
                    required
                  />
                  {loadingPrice && (
                    <Loader2 size={12} className="spin" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--blue)' }} />
                  )}
                </div>
                {loadingPrice && <p style={{ fontSize: '.7rem', color: 'var(--blue)', marginTop: 4 }}>טוען מחיר נוכחי...</p>}
              </div>

              <div>
                <label style={{ fontSize: '.75rem', color: 'var(--text2)', display: 'block', marginBottom: 5 }}>כמות יחידות *</label>
                <input
                  type="number" step="0.001" min="0" placeholder="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  style={inp}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '.75rem', color: 'var(--text2)', display: 'block', marginBottom: 5 }}>תאריך כניסה</label>
                <input
                  type="date"
                  value={buyDate}
                  onChange={e => setBuyDate(e.target.value)}
                  style={inp}
                />
              </div>

              {submitError && (
                <p style={{ fontSize: '.8rem', color: 'var(--red)', background: 'rgba(240,64,96,.08)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
                  {submitError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" disabled={submitting}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 9,
                    padding: '0.65rem', fontSize: '.85rem', fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .7 : 1,
                  }}>
                  {submitting
                    ? <><Loader2 size={14} className="spin" /> מוסיף...</>
                    : <><PlusCircle size={14} /> הוסף לתיק</>}
                </button>
                <button type="button" onClick={onClose}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--card2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 9,
                    padding: '0.65rem 1rem', fontSize: '.85rem', fontWeight: 600, cursor: 'pointer',
                  }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Summary Card ─── */
function SummaryCard({ label, value, sub, icon: Icon, positive }: {
  label: string; value: string; sub?: string; icon: any; positive?: boolean;
}) {
  const color = positive === true ? 'var(--green)' : positive === false ? 'var(--red)' : 'var(--blue)';
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1a`, flexShrink: 0 }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: '.72rem', color: 'var(--text2)' }}>{label}</p>
        <p className="num" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{value}</p>
        {sub && <p className="num" style={{ fontSize: '.78rem', fontWeight: 600, color, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(() => loadCache());
  const [loading, setLoading] = useState(!loadCache());
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await getPortfolio();
      setData(result);
      saveCache(result);
      setOffline(false);
    } catch (err) {
      console.error(err);
      setOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRemove = async (symbol: string) => {
    try { await removePosition(symbol); fetchData(); }
    catch (err: any) { alert(err.response?.data?.detail || 'שגיאה בהסרת המניה'); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="w-10 h-10 border-2 rounded-full spin mx-auto mb-3"
          style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text2)' }}>טוען תיק...</p>
      </div>
    </div>
  );

  const summary = data?.summary;
  const positions = data?.positions ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>התיק שלי</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: 2 }}>מעקב מלא אחר הפוזיציות שלך</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => fetchData(true)} disabled={refreshing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> רענן
          </button>
          <button onClick={() => setShowPicker(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PlusCircle size={15} /> הוסף מניה
          </button>
        </div>
      </div>

      {/* ── Offline banner ── */}
      {offline && (
        <div style={{ background: 'rgba(245,197,24,.08)', border: '1px solid rgba(245,197,24,.3)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={15} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <p style={{ fontSize: '.82rem', color: 'var(--yellow)' }}>
            אין חיבור לשוק — מציג נתוני cache אחרונים. הנתונים עשויים להיות לא עדכניים.
          </p>
        </div>
      )}

      {/* ── Stock Cards Grid — FIRST ── */}
      {positions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <Briefcase size={48} style={{ margin: '0 auto 1rem', color: 'var(--border2)' }} />
          <h3 style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>התיק ריק</h3>
          <p style={{ color: 'var(--text2)', fontSize: '.85rem', marginBottom: 16 }}>הוסף מניות לתיק כדי להתחיל לעקוב אחריהן</p>
          <button onClick={() => setShowPicker(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <PlusCircle size={15} /> הוסף מניה ראשונה
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {positions.map(p => (
            <PortfolioCard key={p.symbol} position={p} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* ── AI Portfolio Analysis ── */}
      {summary && positions.length > 0 && (
        <AIPortfolioAnalysis positions={positions} summary={summary} />
      )}

      {/* ── Portfolio Summary — BOTTOM ── */}
      {summary && positions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>
              סיכום תיק
            </p>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <SummaryCard label="שווי תיק" value={`$${summary.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={Briefcase} />
            <SummaryCard label="סה״כ השקעה" value={`$${summary.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={DollarSign} />
            <SummaryCard
              label="רווח / הפסד"
              value={`${summary.total_pnl >= 0 ? '+' : ''}$${summary.total_pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              sub={`${summary.total_pnl_pct >= 0 ? '+' : ''}${summary.total_pnl_pct.toFixed(2)}%`}
              icon={summary.total_pnl >= 0 ? TrendingUp : TrendingDown}
              positive={summary.total_pnl >= 0}
            />
            <SummaryCard label="מספר פוזיציות" value={`${summary.num_positions}`} icon={Briefcase} />
          </div>
        </div>
      )}

      {/* ── Stock Picker Modal ── */}
      {showPicker && (
        <StockPickerModal onAdd={() => fetchData()} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
