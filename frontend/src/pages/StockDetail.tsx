import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, TrendingUp, TrendingDown, RefreshCw, PlusCircle,
  BarChart2, Activity, Building2, Globe, ExternalLink,
  AlertCircle, Target, Users, Shield, Newspaper, Sun
} from 'lucide-react';
import { getStockDetail, addZivRecord, addPosition, getChartPatterns } from '../api/client';
import CandlestickChart from '../components/CandlestickChart';
import TechnicalAnalysis from '../components/TechnicalAnalysis';
import StockChat from '../components/StockChat';
import AIInsights from '../components/AIInsights';
import InstitutionalHoldings from '../components/InstitutionalHoldings';
import InsiderTrading from '../components/InsiderTrading';
import TrendSpeedAnalyzer from '../components/TrendSpeedAnalyzer';
import PolymarketSentiment from '../components/PolymarketSentiment';
import NewsSentiment from '../components/NewsSentiment';
import type { StockDetail as StockDetailType } from '../types';

/* ─── Helpers ─── */
function fmt(n: number | null | undefined, pre = '$'): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e12) return `${pre}${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `${pre}${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${pre}${(n / 1e6).toFixed(0)}M`;
  return `${pre}${n.toLocaleString()}`;
}
function pct(v: number | null | undefined, dp = 2): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;
}

/* ─── Panel wrapper ─── */
function Panel({ title, icon: Icon, color = 'var(--blue)', action, children }: {
  title: string; icon?: any; color?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'visible' }}>
      <div style={{ height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
      <div style={{ padding: '0.85rem 1.1rem 0.6rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={13} style={{ color }} />}
          <span style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '0.85rem 1.1rem' }}>{children}</div>
    </div>
  );
}

/* ─── Perf badge ─── */
function PerfBadge({ label, value }: { label: string; value: number | null | undefined }) {
  const pos = value != null && value >= 0;
  return (
    <div style={{ textAlign: 'center', background: 'var(--bg2)', borderRadius: 8, padding: '6px 4px' }}>
      <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontSize: '.82rem', fontWeight: 700, color: value == null ? 'var(--muted)' : pos ? 'var(--green)' : 'var(--red)' }}>
        {value == null ? '—' : pct(value)}
      </div>
    </div>
  );
}

/* ─── Price range bar ─── */
function RangeBar({ label, low, high, current }: { label: string; low: number | null; high: number | null; current: number }) {
  if (!low || !high || high === low) return null;
  const pos = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text2)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <span className="num" style={{ fontSize: '.72rem', color: 'var(--red)' }}>נמוך ${low.toFixed(2)}</span>
          <span className="num" style={{ fontSize: '.72rem', color: 'var(--green)' }}>גבוה ${high.toFixed(2)}</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg2)', position: 'relative', overflow: 'visible' }}>
        <div style={{ height: '100%', width: `${pos}%`, background: `linear-gradient(90deg, var(--red), var(--yellow), var(--green))`, borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: -3, left: `calc(${pos}% - 6px)`, width: 12, height: 12, borderRadius: '50%', background: 'var(--text)', border: '2px solid var(--card)', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>נמוך</span>
        <span className="num" style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--blue)' }}>מיקום: {pos.toFixed(0)}%</span>
        <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>גבוה</span>
      </div>
    </div>
  );
}

/* ─── TA row ─── */
function TaRow({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  const color = ok === null ? 'var(--text2)' : ok ? 'var(--green)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '.78rem', color: 'var(--text2)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {ok !== null && <span style={{ fontSize: '.65rem', color }}>{ok ? '▲' : '▼'}</span>}
        <span className="num" style={{ fontSize: '.78rem', fontWeight: 700, color }}>{value}</span>
      </div>
    </div>
  );
}

/* ─── Market status ─── */
function getMarketStatus(): { open: boolean; label: string; color: string } {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); const mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return { open: false, label: 'שוק סגור — סוף שבוע', color: 'var(--muted)' };
  if (mins >= 570 && mins < 960) return { open: true, label: 'שוק פתוח', color: 'var(--green)' };
  if (mins >= 480 && mins < 570) return { open: false, label: 'טרום מסחר', color: 'var(--yellow)' };
  if (mins >= 960 && mins < 1200) return { open: false, label: 'After-Hours', color: 'var(--yellow)' };
  return { open: false, label: 'שוק סגור', color: 'var(--muted)' };
}

/* ─── Live Watch ─── */
function LiveWatch({ onRefresh, lastRefresh }: { onRefresh: () => void; lastRefresh: Date | null }) {
  const INTERVAL = 20 * 60;
  const [live, setLive] = useState(false);
  const [countdown, setCountdown] = useState(INTERVAL);
  const market = getMarketStatus();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!live) { if (timerRef.current) clearInterval(timerRef.current); return; }
    setCountdown(INTERVAL);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { onRefresh(); return INTERVAL; } return c - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [live]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 1rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: market.color, display: 'inline-block', animation: market.open && live ? 'pulse 1.5s infinite' : 'none' }} />
        <span style={{ fontSize: '.75rem', fontWeight: 600, color: market.color }}>{market.label}</span>
      </div>
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
      <button onClick={() => setLive(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 7, cursor: 'pointer',
        border: `1px solid ${live ? 'var(--green)' : 'var(--border)'}`,
        background: live ? 'rgba(0,200,150,.08)' : 'transparent',
        color: live ? 'var(--green)' : 'var(--text2)', fontSize: '.75rem', fontWeight: 700
      }}>
        {live ? <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1s infinite' }} /> מעקב חי פעיל</> : '▷ הפעל מעקב חי'}
      </button>
      {live && (
        <span className="num" style={{ fontSize: '.8rem', fontWeight: 800, color: 'var(--text)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      )}
      <button onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text2)', fontSize: '.72rem' }}>
        <RefreshCw size={11} /> רענן
      </button>
      {lastRefresh && (
        <span style={{ fontSize: '.65rem', color: 'var(--muted)', marginRight: 'auto' }}>
          עודכן: {lastRefresh.toLocaleTimeString('he-IL')}
        </span>
      )}
    </div>
  );
}

/* ─── Add to Portfolio Mini-Modal ─── */
function AddPortfolioModal({ symbol, name, price, onClose, onDone }: {
  symbol: string; name: string; price: number; onClose: () => void; onDone: () => void;
}) {
  const [qty, setQty] = useState('1');
  const [buyPrice, setBuyPrice] = useState(price.toFixed(2));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: '.85rem', outline: 'none', width: '100%' };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setErr('');
    try {
      await addPosition({ symbol, name, buy_price: parseFloat(buyPrice), buy_date: date, quantity: parseFloat(qty) });
      onDone();
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'שגיאה'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 380, padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 16, fontSize: '1rem' }}>הוסף {symbol} לתיק</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={{ fontSize: '.72rem', color: 'var(--text2)', display: 'block', marginBottom: 4 }}>מחיר כניסה ($)</label>
            <input style={inp} type="number" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} required /></div>
          <div><label style={{ fontSize: '.72rem', color: 'var(--text2)', display: 'block', marginBottom: 4 }}>כמות</label>
            <input style={inp} type="number" step="0.001" min="0" value={qty} onChange={e => setQty(e.target.value)} required /></div>
          <div><label style={{ fontSize: '.72rem', color: 'var(--text2)', display: 'block', marginBottom: 4 }}>תאריך</label>
            <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '.78rem', color: 'var(--text2)' }}>סה"כ השקעה</span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>${(parseFloat(buyPrice || '0') * parseFloat(qty || '0')).toFixed(2)}</span>
          </div>
          {err && <p style={{ color: 'var(--red)', fontSize: '.78rem' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <span className="spin" style={{ width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> : <PlusCircle size={14} />}
              הוסף לתיק
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════ MAIN PAGE ═══════════════════════════════════════ */
export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StockDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingZiv, setAddingZiv] = useState(false);
  const [zivMsg, setZivMsg] = useState('');
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [portfolioMsg, setPortfolioMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [chartPatterns, setChartPatterns] = useState<any[]>([]);

  const fetchData = async () => {
    if (!symbol) return;
    setLoading(true); setError('');
    try {
      const d = await getStockDetail(symbol);
      if (d.error) setError(d.error);
      else {
        setData(d);
        setLastRefresh(new Date());
        // Fetch chart patterns in parallel (non-blocking)
        getChartPatterns(symbol, '6m')
          .then(pd => setChartPatterns(pd?.patterns ?? []))
          .catch(() => {});
      }
    } catch (e: any) { setError(e.message || 'שגיאה בטעינת נתונים'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [symbol]);

  const handleAddZiv = async () => {
    if (!data) return;
    setAddingZiv(true);
    try {
      await addZivRecord({
        symbol: data.symbol, name: data.name,
        signal_type: data.signal.signal.includes('buy') ? 'buy' : 'sell',
        rec_price: data.current_price, ta_score: data.signal.score,
        rule40_score: (data as any).rule_of_40?.score ?? undefined,
      });
      setZivMsg('✓ נוסף למדד זיו');
      setTimeout(() => setZivMsg(''), 3000);
    } catch { setZivMsg('שגיאה'); }
    finally { setAddingZiv(false); }
  };

  /* ─── Loading ─── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 16 }}>
      <div className="spin" style={{ width: 44, height: 44, border: '3px solid var(--green)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      <p style={{ color: 'var(--text2)' }}>טוען נתוני {symbol}...</p>
    </div>
  );

  /* ─── Error ─── */
  if (error || !data) return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <AlertCircle size={40} style={{ margin: '0 auto 12px', color: 'var(--red)' }} />
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>לא ניתן לטעון את {symbol}</p>
      <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: 16 }}>{error}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2"><ArrowRight size={14} />חזור</button>
        <button onClick={fetchData} className="btn-primary flex items-center gap-2"><RefreshCw size={14} />נסה שוב</button>
      </div>
    </div>
  );

  /* ─── Derived values ─── */
  const SIG_CFG: Record<string, { label: string; color: string; bg: string }> = {
    strong_buy: { label: '🔥 קנייה חזקה', color: 'var(--green)', bg: 'rgba(0,200,150,.1)' },
    buy:        { label: '▲ קנייה',       color: 'var(--green)', bg: 'rgba(0,200,150,.08)' },
    watch:      { label: '◎ מעקב',        color: 'var(--yellow)', bg: 'rgba(245,197,24,.08)' },
    neutral:    { label: '— ניטראלי',     color: 'var(--text2)', bg: 'rgba(143,163,191,.06)' },
    sell:       { label: '▼ מכירה',       color: 'var(--red)', bg: 'rgba(240,64,96,.08)' },
  };
  const sigCfg = SIG_CFG[data.signal.signal] ?? SIG_CFG.neutral;
  const scoreColor = data.signal.score >= 65 ? 'var(--green)' : data.signal.score >= 45 ? 'var(--blue)' : data.signal.score >= 30 ? 'var(--yellow)' : 'var(--red)';
  const dayUp = (data.performance['1d'] ?? 0) >= 0;
  const pr   = (data as any).price_ranges;
  const det  = (data as any).company_details;
  const r40  = (data as any).rule_of_40;
  const pre  = (data as any).premarket;
  const sig  = data.signal;
  const info = data.info;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

      {/* ─── Top bar ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.82rem' }}>
          <ArrowRight size={15} /> חזור
        </button>
        <LiveWatch onRefresh={fetchData} lastRefresh={lastRefresh} />
      </div>

      {/* ══════════════════════════════════
          PANEL 1 — HEADER (FULL WIDTH)
      ══════════════════════════════════ */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ height: 4, background: sigCfg.color }} />
        <div style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

            {/* Left: identity */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1 }}>{data.symbol}</span>
                <div style={{ background: sigCfg.bg, border: `1px solid ${sigCfg.color}50`, borderRadius: 8, padding: '4px 14px' }}>
                  <span style={{ fontSize: '.85rem', fontWeight: 800, color: sigCfg.color }}>{sigCfg.label}</span>
                </div>
                {pre && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.75rem', padding: '3px 10px', borderRadius: 7, border: '1px solid rgba(245,197,24,.4)', background: 'rgba(245,197,24,.08)', color: 'var(--yellow)' }}>
                    <Sun size={11} /> טרום: ${pre.price} <span style={{ color: pre.change_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{pct(pre.change_pct)}</span>
                  </span>
                )}
              </div>
              <p style={{ fontSize: '.9rem', color: 'var(--text2)', marginTop: 4 }}>{data.name}</p>
              <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>
                {info.sector && info.sector !== 'N/A' ? info.sector : ''}
                {info.sector !== 'N/A' && info.industry && info.industry !== 'N/A' ? ` · ${info.industry}` : ''}
                {info.country ? ` · ${info.country}` : ''}
              </p>
            </div>

            {/* Right: price + actions */}
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1 }}>
                ${data.current_price.toFixed(2)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 4 }}>
                {dayUp ? <TrendingUp size={14} style={{ color: 'var(--green)' }} /> : <TrendingDown size={14} style={{ color: 'var(--red)' }} />}
                <span className="num" style={{ fontSize: '.9rem', fontWeight: 700, color: dayUp ? 'var(--green)' : 'var(--red)' }}>
                  {pct(data.performance['1d'])} היום
                </span>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 7, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => setShowAddPortfolio(true)} className="btn-primary" style={{ fontSize: '.78rem', gap: 5 }}>
                  <PlusCircle size={13} /> הוסף לתיק
                </button>
                <button onClick={handleAddZiv} disabled={addingZiv} className="btn-secondary" style={{ fontSize: '.78rem', gap: 5, color: 'var(--purple)', borderColor: 'var(--purple)' }}>
                  <BarChart2 size={13} />
                  {zivMsg || (addingZiv ? 'מוסיף...' : 'הוסף למדד זיו')}
                </button>
                {portfolioMsg && <span style={{ fontSize: '.75rem', color: 'var(--green)', alignSelf: 'center' }}>{portfolioMsg}</span>}
              </div>
            </div>
          </div>

          {/* Performance grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <PerfBadge label="1D"  value={data.performance['1d']} />
            <PerfBadge label="5D"  value={data.performance['5d']} />
            <PerfBadge label="1M"  value={data.performance['1m']} />
            <PerfBadge label="3M"  value={data.performance['3m']} />
            <PerfBadge label="6M"  value={data.performance['6m']} />
            <PerfBadge label="1Y"  value={data.performance['1y']} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          ROW 2 — CHART (2/3) + SIGNAL (1/3)
      ══════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>

        {/* Chart */}
        <Panel
          title="גרף מחיר"
          icon={BarChart2}
          color="var(--blue)"
          action={
            <button
              onClick={() => window.open(`/chart/${data.symbol}`, '_blank')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                color: 'var(--muted)', fontSize: '.68rem', fontWeight: 600,
              }}
              title="פתח גרף בעמוד נפרד"
            >
              <ExternalLink size={11} /> פתח בעמוד נפרד
            </button>
          }
        >
          <CandlestickChart
            symbol={data.symbol}
            data={data.price_history}
            fibonacci={data.fibonacci}
            showFib={true}
            supportResistance={data.support_resistance}
            patterns={chartPatterns}
          />
        </Panel>

        {/* AI Insights */}
        <AIInsights stock={data} />

        {/* Signal + Score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Panel title="המלצה וציון טכני" icon={Activity} color={sigCfg.color}>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: sigCfg.color, marginBottom: 6 }}>{sigCfg.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${data.signal.score}%`, background: scoreColor, borderRadius: 4 }} />
                </div>
                <span className="num" style={{ fontSize: '1.2rem', fontWeight: 900, color: scoreColor, width: 38 }}>{data.signal.score}</span>
              </div>
              <p style={{ fontSize: '.72rem', color: 'var(--muted)' }}>ציון מ-100 · מבוסס TA</p>
            </div>
            {/* Support / Resistance */}
            {(data.support_resistance.support || data.support_resistance.resistance) && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <p style={{ fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>תמיכה והתנגדות</p>
                {data.support_resistance.resistance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '.78rem', color: 'var(--red)' }}>התנגדות</span>
                    <span className="num" style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--red)' }}>${data.support_resistance.resistance}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.78rem', color: 'var(--text2)' }}>מחיר נוכחי</span>
                  <span className="num" style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>${data.current_price.toFixed(2)}</span>
                </div>
                {data.support_resistance.support && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ fontSize: '.78rem', color: 'var(--green)' }}>תמיכה</span>
                    <span className="num" style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--green)' }}>${data.support_resistance.support}</span>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* Rule of 40 */}
          {r40 && (
            <Panel title="כלל ה-40 (Rule of 40)" icon={Shield} color={r40.pass ? 'var(--green)' : 'var(--yellow)'}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span className="num" style={{ fontSize: '2rem', fontWeight: 900, color: r40.pass ? 'var(--green)' : r40.score >= 20 ? 'var(--yellow)' : 'var(--red)' }}>
                  {r40.score > 0 ? '+' : ''}{r40.score}
                </span>
                <p style={{ fontSize: '.72rem', color: r40.pass ? 'var(--green)' : 'var(--muted)', marginTop: 3 }}>
                  {r40.pass ? '✓ עובר כלל ה-40' : '✗ לא עובר'} · {r40.rating}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '.62rem', color: 'var(--muted)' }}>צמיחת הכנסות</p>
                  <p className="num" style={{ fontWeight: 700, color: r40.revenue_growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {r40.revenue_growth_pct > 0 ? '+' : ''}{r40.revenue_growth_pct}%
                  </p>
                </div>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '.62rem', color: 'var(--muted)' }}>מרווח תפעולי</p>
                  <p className="num" style={{ fontWeight: 700, color: r40.operating_margin_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {r40.operating_margin_pct > 0 ? '+' : ''}{r40.operating_margin_pct}%
                  </p>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════
          ROW — TREND SPEED ANALYZER (Zyerman)
      ══════════════════════════════════ */}
      <Panel title="Trend Speed Analyzer — Zyerman" icon={Activity} color="#8b5cf6">
        <TrendSpeedAnalyzer data={data.price_history} symbol={data.symbol} />
      </Panel>

      {/* ══════════════════════════════════
          ROW 3 — TECHNICAL ANALYSIS (full)
      ══════════════════════════════════ */}
      <Panel title="ניתוח טכני מפורט" icon={Activity} color="var(--purple)"
        action={
          <button onClick={() => setShowAddPortfolio(true)} className="btn-secondary" style={{ fontSize: '.68rem', gap: 4, padding: '3px 10px' }}>
            <PlusCircle size={11} /> הוסף לתיק
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <p style={{ fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>אינדיקטורים</p>
            <TaRow label="RSI (14)" value={sig.rsi?.toFixed(2) ?? '—'} ok={sig.rsi == null ? null : sig.rsi < 35 ? true : sig.rsi > 70 ? false : null} />
            <TaRow label="MACD" value={sig.macd != null && sig.macd_signal != null ? (sig.macd > sig.macd_signal ? 'Bullish Crossover' : 'Bearish') : '—'} ok={sig.macd != null && sig.macd_signal != null ? sig.macd > sig.macd_signal : null} />
            <TaRow label="SMA 20" value={sig.sma20 ? `$${sig.sma20.toFixed(2)}` : '—'} ok={sig.sma20 ? data.current_price > sig.sma20 : null} />
            <TaRow label="SMA 50" value={sig.sma50 ? `$${sig.sma50.toFixed(2)}` : '—'} ok={sig.sma50 ? data.current_price > sig.sma50 : null} />
            <TaRow label="SMA 200" value={sig.sma200 ? `$${sig.sma200.toFixed(2)}` : '—'} ok={sig.sma200 ? data.current_price > sig.sma200 : null} />
            <TaRow label="Bollinger Up" value={sig.bb_upper ? `$${sig.bb_upper.toFixed(2)}` : '—'} ok={sig.bb_upper ? data.current_price < sig.bb_upper : null} />
            <TaRow label="Bollinger Down" value={sig.bb_lower ? `$${sig.bb_lower.toFixed(2)}` : '—'} ok={sig.bb_lower ? data.current_price > sig.bb_lower : null} />
          </div>
          <div>
            {sig.reasons.length > 0 && (
              <>
                <p style={{ fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>סיגנלים חיוביים</p>
                {sig.reasons.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: 'var(--green)', flexShrink: 0, fontSize: '.78rem' }}>✓</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.4 }}>{r}</span>
                  </div>
                ))}
              </>
            )}
            {sig.warnings.length > 0 && (
              <>
                <p style={{ fontSize: '.62rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginTop: 14, marginBottom: 8 }}>אזהרות</p>
                {sig.warnings.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: 'var(--yellow)', flexShrink: 0, fontSize: '.78rem' }}>⚠</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.4 }}>{w}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        {/* Full TA component */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <TechnicalAnalysis signal={data.signal} history={data.price_history} peRatio={data.info?.pe_ratio} />
        </div>
      </Panel>

      {/* ══════════════════════════════════
          ROW 4 — PRICE RANGES (full width)
      ══════════════════════════════════ */}
      {pr && (
        <Panel title="טווחי מחיר — גבוה / נמוך" icon={BarChart2} color="var(--blue)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
            <RangeBar label="52 שבועות" low={pr['52w']?.low} high={pr['52w']?.high} current={data.current_price} />
            <RangeBar label="חודש"      low={pr['1m']?.low}  high={pr['1m']?.high}  current={data.current_price} />
            <RangeBar label="שבוע"      low={pr['1w']?.low}  high={pr['1w']?.high}  current={data.current_price} />
            <RangeBar label="יום"       low={pr['1d']?.low}  high={pr['1d']?.high}  current={data.current_price} />
          </div>
        </Panel>
      )}

      {/* ══════════════════════════════════
          ROW 5 — COMPANY + FINANCIALS + ANALYST
      ══════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>

        {/* Company info */}
        <Panel title="אודות החברה" icon={Building2} color="var(--blue)">
          {info.description && (
            <p style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.65, marginBottom: 14 }}>
              {info.description.slice(0, 700)}{info.description.length > 700 ? '...' : ''}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[
              { label: 'שווי שוק', value: fmt(info.market_cap) },
              { label: 'P/E', value: info.pe_ratio?.toFixed(1) ?? '—' },
              { label: 'Forward P/E', value: (info as any).forward_pe?.toFixed(1) ?? '—' },
              { label: 'Beta', value: info.beta?.toFixed(2) ?? '—' },
              { label: 'דיבידנד', value: info.dividend_yield ? `${(info.dividend_yield * 100).toFixed(2)}%` : 'אין' },
              { label: 'עובדים', value: info.employees ? info.employees.toLocaleString() : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '7px 10px' }}>
                <p style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</p>
                <p className="num" style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </div>
          {info.website && (
            <a href={info.website} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: '.75rem', color: 'var(--blue)', textDecoration: 'none' }}>
              <Globe size={12} /> {info.website} <ExternalLink size={10} />
            </a>
          )}
        </Panel>

        {/* Financial metrics */}
        {det && (
          <Panel title="נתונים פיננסיים" icon={BarChart2} color="var(--green)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'הכנסות שנתיות', value: det.revenue_str },
                { label: 'תזרים מזומנים', value: det.free_cashflow_str },
                { label: 'מרווח גולמי', value: det.gross_margin_pct != null ? `${det.gross_margin_pct}%` : null },
                { label: 'מרווח תפעולי', value: det.operating_margin_pct != null ? `${det.operating_margin_pct}%` : null },
                { label: 'מרווח נקי', value: det.profit_margin_pct != null ? `${det.profit_margin_pct}%` : null },
                { label: 'אחזקות מוסדיות', value: det.held_institutions_pct != null ? `${det.held_institutions_pct}%` : null },
                { label: 'Short Ratio', value: det.short_ratio != null ? `${det.short_ratio}` : null },
              ].filter(i => i.value).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.75rem', color: 'var(--text2)' }}>{label}</span>
                  <span className="num" style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
              {det.next_earnings && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 4 }}>
                  <span style={{ fontSize: '.75rem', color: 'var(--text2)' }}>דוח רווחים</span>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--yellow)' }}>{det.next_earnings}</span>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Analyst consensus */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {det?.analyst_consensus && (
            <Panel title="קונסנזוס אנליסטים" icon={Users} color="var(--blue)">
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>{det.analyst_consensus}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{det.analyst_count} אנליסטים</div>
              </div>
              {det.analyst_target && (
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 2 }}>מחיר יעד</p>
                  <p className="num" style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--blue)' }}>${det.analyst_target}</p>
                  <p className="num" style={{ fontSize: '.75rem', fontWeight: 700, color: det.analyst_target > data.current_price ? 'var(--green)' : 'var(--red)' }}>
                    {det.analyst_target > data.current_price ? '+' : ''}
                    {((det.analyst_target - data.current_price) / data.current_price * 100).toFixed(1)}% פוטנציאל
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* Key metrics panel */}
          <Panel title="מדדי מפתח" icon={Target} color="var(--yellow)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: '52W גבוה', value: info['52w_high'] ? `$${info['52w_high']?.toFixed(2)}` : '—' },
                { label: '52W נמוך', value: info['52w_low'] ? `$${info['52w_low']?.toFixed(2)}` : '—' },
                { label: 'ממוצע נפח', value: info.avg_volume ? `${(info.avg_volume / 1e6).toFixed(1)}M` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.75rem', color: 'var(--text2)' }}>{label}</span>
                  <span className="num" style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ══════════════════════════════════
          ROW 6 — NEWS / KEY FACTORS
      ══════════════════════════════════ */}
      {det?.key_factors?.length > 0 && (
        <Panel title="חדשות ואירועי מפתח" icon={Newspaper} color="var(--blue)"
          action={
            <button onClick={handleAddZiv} disabled={addingZiv} className="btn-secondary" style={{ fontSize: '.68rem', gap: 4, padding: '3px 10px', color: 'var(--purple)', borderColor: 'var(--purple)' }}>
              <BarChart2 size={11} /> {zivMsg || 'הוסף למדד זיו'}
            </button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {det.key_factors.map((f: any, i: number) => (
              <a key={i} href={f.link} target="_blank" rel="noreferrer"
                style={{ display: 'block', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', textDecoration: 'none', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--blue)'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'}
              >
                <p style={{ fontSize: '.78rem', color: 'var(--text)', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {f.title}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>{f.publisher}</span>
                  {f.published > 0 && <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>{new Date(f.published * 1000).toLocaleDateString('he-IL')}</span>}
                </div>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {/* ══════════════════════════════════
          ROW — INSIDER TRADING (Form 4)
      ══════════════════════════════════ */}
      <Panel title="מסחר בעלי עניין — Form 4" icon={Users} color="#f59e0b">
        <InsiderTrading symbol={data.symbol} />
      </Panel>

      {/* ══════════════════════════════════
          ROW — INSTITUTIONAL HOLDINGS (13F)
      ══════════════════════════════════ */}
      <Panel title="אחזקות מוסדיות — 13F" icon={BarChart2} color="var(--blue)">
        <InstitutionalHoldings symbol={data.symbol} sector={data.info?.sector} />
      </Panel>

      {/* ══════════════════════════════════
          ROW — POLYMARKET SENTIMENT
      ══════════════════════════════════ */}
      <Panel title="Polymarket — שוק הניבויים" icon={Globe} color="#6366f1">
        <PolymarketSentiment symbol={data.symbol} companyName={data.name} />
      </Panel>

      {/* ══════════════════════════════════
          ROW — NEWS SENTIMENT
      ══════════════════════════════════ */}
      <Panel title="סנטימנט מדיה — Bloomberg · Reuters · CNBC" icon={Newspaper} color="var(--blue)">
        <NewsSentiment symbol={data.symbol} companyName={data.name} />
      </Panel>

      {/* Modals */}
      {showAddPortfolio && (
        <AddPortfolioModal
          symbol={data.symbol} name={data.name} price={data.current_price}
          onClose={() => setShowAddPortfolio(false)}
          onDone={() => { setShowAddPortfolio(false); setPortfolioMsg('✓ נוסף לתיק!'); setTimeout(() => setPortfolioMsg(''), 3000); }}
        />
      )}

      {/* LLM Chat — floating, full context */}
      <StockChat
        symbol={data.symbol}
        currentPrice={data.current_price}
        signal={data.signal}
        info={data.info}
        performance={data.performance}
        supportResistance={data.support_resistance}
        fibonacci={data.fibonacci}
      />
    </div>
  );
}
