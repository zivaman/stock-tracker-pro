import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ExternalLink, Globe, TrendingUp, TrendingDown,
  Building2, BarChart3, AlertCircle, RefreshCw, PlusCircle, Sun
} from 'lucide-react';
import { getStockDetail, addZivRecord } from '../api/client';
import StockChart from '../components/StockChart';
import TechnicalAnalysis from '../components/TechnicalAnalysis';
import type { StockDetail as StockDetailType } from '../types';

function fmt(n: number | null | undefined, prefix = '$', suffix = '') {
  if (n == null) return 'N/A';
  if (Math.abs(n) >= 1e12) return `${prefix}${(n / 1e12).toFixed(1)}T${suffix}`;
  if (Math.abs(n) >= 1e9)  return `${prefix}${(n / 1e9).toFixed(1)}B${suffix}`;
  if (Math.abs(n) >= 1e6)  return `${prefix}${(n / 1e6).toFixed(0)}M${suffix}`;
  return `${prefix}${n.toLocaleString()}${suffix}`;
}

function PerfBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return (
    <div className="text-center">
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>N/A</p>
    </div>
  );
  const isPos = value >= 0;
  return (
    <div className="text-center">
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-bold num" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
        {isPos ? '+' : ''}{value.toFixed(2)}%
      </p>
    </div>
  );
}

function PriceRangeRow({ label, low, high, current }: { label: string; low: number | null; high: number | null; current: number }) {
  if (!low || !high) return null;
  const pos = high !== low ? ((current - low) / (high - low)) * 100 : 50;
  const clamped = Math.max(0, Math.min(100, pos));
  return (
    <div className="py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="flex gap-4 num">
          <span style={{ color: 'var(--red)' }}>נמוך ${low}</span>
          <span style={{ color: 'var(--green)' }}>גבוה ${high}</span>
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
        <div className="h-full rounded-full" style={{
          width: `${clamped}%`,
          background: `linear-gradient(to left, var(--green), var(--yellow), var(--red))`
        }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 shadow"
          style={{ left: `calc(${clamped}% - 6px)`, background: 'white', borderColor: 'var(--blue)' }} />
      </div>
      <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
        <span>נמוך</span>
        <span className="font-semibold num" style={{ color: 'var(--blue)' }}>
          מיקום נוכחי: {pos.toFixed(0)}%
        </span>
        <span>גבוה</span>
      </div>
    </div>
  );
}

function Rule40Card({ rule40 }: { rule40: any }) {
  if (!rule40) return null;
  const color = rule40.pass ? 'var(--green)' : rule40.score >= 20 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          כלל ה-40 (Rule of 40)
        </h4>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
          style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
          {rule40.rating}
        </span>
      </div>
      <div className="text-center mb-3">
        <p className="text-4xl font-black num" style={{ color }}>
          {rule40.score > 0 ? '+' : ''}{rule40.score}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {rule40.pass ? '✓ עובר כלל ה-40' : '✗ לא עובר כלל ה-40'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg p-2" style={{ background: 'var(--bg-hover)' }}>
          <p style={{ color: 'var(--text-muted)' }}>צמיחת הכנסות</p>
          <p className="font-bold num mt-0.5" style={{ color: rule40.revenue_growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {rule40.revenue_growth_pct > 0 ? '+' : ''}{rule40.revenue_growth_pct}%
          </p>
        </div>
        <div className="rounded-lg p-2" style={{ background: 'var(--bg-hover)' }}>
          <p style={{ color: 'var(--text-muted)' }}>מרווח תפעולי</p>
          <p className="font-bold num mt-0.5" style={{ color: rule40.operating_margin_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {rule40.operating_margin_pct > 0 ? '+' : ''}{rule40.operating_margin_pct}%
          </p>
        </div>
      </div>
    </div>
  );
}

function CompanyDetails({ details, info }: { details: any; info: any }) {
  if (!details) return null;
  return (
    <div className="space-y-4">
      {/* Analyst consensus */}
      {details.analyst_consensus && (
        <div className="card">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            קונסנזוס אנליסטים
          </h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{details.analyst_consensus}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{details.analyst_count} אנליסטים</p>
            </div>
            {details.analyst_target && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>מחיר יעד</p>
                <p className="font-black text-xl num" style={{ color: 'var(--blue)' }}>${details.analyst_target}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial metrics */}
      <div className="card">
        <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
          נתונים פיננסיים
        </h4>
        <div className="space-y-2">
          {[
            { label: 'הכנסות שנתיות', value: details.revenue_str },
            { label: 'תזרים מזומנים חופשי', value: details.free_cashflow_str },
            { label: 'מרווח גולמי', value: details.gross_margin_pct != null ? `${details.gross_margin_pct}%` : null },
            { label: 'מרווח תפעולי', value: details.operating_margin_pct != null ? `${details.operating_margin_pct}%` : null },
            { label: 'מרווח רווח נקי', value: details.profit_margin_pct != null ? `${details.profit_margin_pct}%` : null },
            { label: 'אחזקות מוסדיות', value: details.held_institutions_pct != null ? `${details.held_institutions_pct}%` : null },
            { label: 'Short Ratio', value: details.short_ratio != null ? `${details.short_ratio}` : null },
            { label: 'עובדים', value: details.employees?.toLocaleString() },
          ].filter(i => i.value).map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b last:border-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span className="text-sm font-bold num" style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
          {details.next_earnings && (
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>דוח רווחים הבא</span>
              <span className="text-sm font-bold" style={{ color: 'var(--yellow)' }}>{details.next_earnings}</span>
            </div>
          )}
        </div>
      </div>

      {/* Key factors / news */}
      {details.key_factors?.length > 0 && (
        <div className="card">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            גורמי מפתח ואירועים
          </h4>
          <div className="space-y-2">
            {details.key_factors.map((f: any, i: number) => (
              <a key={i} href={f.link} target="_blank" rel="noopener noreferrer"
                className="block rounded-lg p-2.5 -mx-1 transition-opacity hover:opacity-75"
                style={{ background: 'var(--bg-hover)' }}>
                <p className="text-sm leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {f.title}
                </p>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{f.publisher}</span>
                  {f.published > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(f.published * 1000).toLocaleDateString('he-IL')}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Market hours helper (US Eastern) ─── */
function getMarketStatus(): { open: boolean; label: string; color: string } {
  const now = new Date();
  // Convert to US Eastern time
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const day = et.getDay(); // 0=Sun, 6=Sat
  const h = et.getHours(); const m = et.getMinutes();
  const mins = h * 60 + m;
  if (day === 0 || day === 6) return { open: false, label: 'שוק סגור (סוף שבוע)', color: 'var(--muted)' };
  if (mins >= 570 && mins < 960) return { open: true, label: 'שוק פתוח 🟢', color: 'var(--green)' }; // 9:30–16:00
  if (mins >= 480 && mins < 570) return { open: false, label: 'טרום מסחר', color: 'var(--yellow)' };
  if (mins >= 960 && mins < 1200) return { open: false, label: 'מסחר after-hours', color: 'var(--yellow)' };
  return { open: false, label: 'שוק סגור', color: 'var(--muted)' };
}

/* ─── Live Watch Component ─── */
function LiveWatch({ onRefresh, lastRefresh }: { onRefresh: () => void; lastRefresh: Date | null }) {
  const INTERVAL = 20 * 60; // 20 minutes in seconds
  const [live, setLive] = useState(false);
  const [countdown, setCountdown] = useState(INTERVAL);
  const market = getMarketStatus();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!live) { if (timerRef.current) clearInterval(timerRef.current); return; }
    setCountdown(INTERVAL);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { onRefresh(); return INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [live]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1rem', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
      {/* Market status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: market.color, display: 'inline-block', animation: market.open && live ? 'pulse 1.5s infinite' : 'none' }} />
        <span style={{ fontSize: '.75rem', fontWeight: 600, color: market.color }}>{market.label}</span>
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

      {/* Live toggle */}
      <button
        onClick={() => setLive(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${live ? 'var(--green)' : 'var(--border)'}`,
          background: live ? 'rgba(0,200,150,.1)' : 'var(--bg2)',
          color: live ? 'var(--green)' : 'var(--text2)',
          fontSize: '.78rem', fontWeight: 700, transition: 'all .15s'
        }}
      >
        {live ? (
          <>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            מעקב חי פעיל
          </>
        ) : (
          <>▷ הפעל מעקב חי</>
        )}
      </button>

      {/* Countdown */}
      {live && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>עדכון בעוד:</span>
          <span className="num" style={{ fontSize: '.85rem', fontWeight: 800, color: 'var(--text)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Manual refresh */}
      <button onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text2)', fontSize: '.72rem' }}>
        <RefreshCw size={12} /> רענן עכשיו
      </button>

      {lastRefresh && (
        <span style={{ fontSize: '.68rem', color: 'var(--muted)', marginRight: 'auto' }}>
          עדכון אחרון: {lastRefresh.toLocaleTimeString('he-IL')}
        </span>
      )}
    </div>
  );
}

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StockDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'analysis' | 'info'>('chart');
  const [addingZiv, setAddingZiv] = useState(false);
  const [zivAdded, setZivAdded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = async () => {
    if (!symbol) return;
    setLoading(true); setError('');
    try {
      const detail = await getStockDetail(symbol);
      if (detail.error) setError(detail.error);
      else { setData(detail); setLastRefresh(new Date()); }
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת נתוני המניה');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [symbol]);

  const handleAddZiv = async () => {
    if (!data) return;
    setAddingZiv(true);
    try {
      await addZivRecord({
        symbol: data.symbol,
        name: data.name,
        signal_type: data.signal.signal.includes('buy') ? 'buy' : 'sell',
        rec_price: data.current_price,
        ta_score: data.signal.score,
        rule40_score: data.rule_of_40?.score ?? undefined,
      });
      setZivAdded(true);
      setTimeout(() => setZivAdded(false), 3000);
    } finally { setAddingZiv(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
      <div className="text-center">
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>טוען נתוני {symbol}...</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>מחשב ניתוח טכני מלא</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="card text-center py-12">
      <AlertCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--red)' }} />
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>לא ניתן לטעון את {symbol}</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
      <div className="flex gap-3 justify-center mt-5">
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2"><ArrowRight size={15} />חזור</button>
        <button onClick={fetchData} className="btn-primary flex items-center gap-2"><RefreshCw size={15} />נסה שוב</button>
      </div>
    </div>
  );

  const signalConfig: Record<string, { label: string; color: string }> = {
    strong_buy: { label: 'קנייה חזקה', color: 'var(--green)' },
    buy:        { label: 'קנייה',       color: 'var(--green)' },
    watch:      { label: 'מעקב',        color: 'var(--yellow)' },
    neutral:    { label: 'ניטראלי',     color: 'var(--text-secondary)' },
    sell:       { label: 'מכירה',       color: 'var(--red)' },
  };
  const sig = signalConfig[data.signal.signal] || signalConfig.neutral;
  const isPriceUp = (data.performance['1d'] ?? 0) >= 0;
  const pr = (data as any).price_ranges;
  const details = (data as any).company_details;
  const rule40 = (data as any).rule_of_40;
  const premarket = (data as any).premarket;

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-70"
          style={{ color: 'var(--text2)' }}>
          <ArrowRight size={16} /> חזור
        </button>
        <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{symbol}</span>
      </div>

      {/* Live watch bar */}
      <LiveWatch onRefresh={fetchData} lastRefresh={lastRefresh} />

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-4xl font-black num" style={{ color: 'var(--text-primary)' }}>{data.symbol}</h1>
              <span className="px-3 py-1 rounded-full text-sm font-bold border"
                style={{ color: sig.color, borderColor: `color-mix(in srgb, ${sig.color} 40%, transparent)`, background: `color-mix(in srgb, ${sig.color} 15%, transparent)` }}>
                {sig.label}
              </span>
              {/* Pre-market */}
              {premarket && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                  style={{ color: 'var(--yellow)', borderColor: 'color-mix(in srgb, var(--yellow) 40%, transparent)', background: 'color-mix(in srgb, var(--yellow) 10%, transparent)' }}>
                  <Sun size={11} /> טרום מסחר: ${premarket.price}
                  <span style={{ color: premarket.change_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {premarket.change_pct >= 0 ? '+' : ''}{premarket.change_pct}%
                  </span>
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>{data.name}</p>
            {data.info.sector && data.info.sector !== 'N/A' && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{data.info.sector} · {data.info.industry}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-4xl font-black num" style={{ color: 'var(--text-primary)' }}>${data.current_price}</p>
            <div className="flex items-center justify-end gap-2 mt-1">
              {isPriceUp ? <TrendingUp size={16} style={{ color: 'var(--green)' }} /> : <TrendingDown size={16} style={{ color: 'var(--red)' }} />}
              <span className="text-lg font-bold num" style={{ color: isPriceUp ? 'var(--green)' : 'var(--red)' }}>
                {isPriceUp ? '+' : ''}{data.performance['1d']?.toFixed(2) ?? '0'}%
              </span>
            </div>
            {/* Add to מדד זיו */}
            <button onClick={handleAddZiv} disabled={addingZiv}
              className="mt-2 btn-secondary flex items-center gap-1 text-xs mr-auto"
              style={{ color: zivAdded ? 'var(--green)' : undefined }}>
              <PlusCircle size={13} />
              {zivAdded ? '✓ נוסף למדד זיו' : addingZiv ? 'מוסיף...' : 'הוסף למדד זיו'}
            </button>
          </div>
        </div>

        {/* Performance row */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 sm:grid-cols-6 gap-3"
          style={{ borderColor: 'var(--border)' }}>
          <PerfBadge label="יום" value={data.performance['1d']} />
          <PerfBadge label="שבוע" value={data.performance['5d']} />
          <PerfBadge label="חודש" value={data.performance['1m']} />
          <PerfBadge label="3 חודשים" value={data.performance['3m']} />
          <PerfBadge label="חצי שנה" value={data.performance['6m']} />
          <PerfBadge label="שנה" value={data.performance['1y']} />
        </div>
      </div>

      {/* Price Ranges */}
      {pr && (
        <div className="card">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            טווחי מחיר — גבוה/נמוך
          </h3>
          <PriceRangeRow label="שנה (52 שבועות)" low={pr['52w']?.low} high={pr['52w']?.high} current={data.current_price} />
          <PriceRangeRow label="חודש" low={pr['1m']?.low} high={pr['1m']?.high} current={data.current_price} />
          <PriceRangeRow label="שבוע" low={pr['1w']?.low} high={pr['1w']?.high} current={data.current_price} />
          <PriceRangeRow label="יום" low={pr['1d']?.low} high={pr['1d']?.high} current={data.current_price} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'chart', label: 'גרף מחיר', icon: BarChart3 },
          { key: 'analysis', label: 'ניתוח טכני', icon: TrendingUp },
          { key: 'info', label: 'מידע חברה', icon: Building2 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
            style={activeTab === key
              ? { background: 'var(--green)', color: '#0a0e1a', borderColor: 'var(--green)' }
              : { background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {activeTab === 'chart' && (
            <div className="card">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
                גרף מחיר עם אינדיקטורים
              </h3>
              <StockChart data={data.price_history} currentPrice={data.current_price} supportResistance={data.support_resistance} />
            </div>
          )}
          {activeTab === 'analysis' && (
            <TechnicalAnalysis signal={data.signal} history={data.price_history} />
          )}
          {activeTab === 'info' && (
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>על החברה</h3>
              {data.info.description
                ? <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {data.info.description.slice(0, 900)}{data.info.description.length > 900 ? '...' : ''}
                  </p>
                : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>אין תיאור זמין</p>
              }
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { label: 'שווי שוק', value: fmt(data.info.market_cap) },
                  { label: 'P/E', value: data.info.pe_ratio?.toFixed(1) ?? 'N/A' },
                  { label: 'Forward P/E', value: (data.info as any).forward_pe?.toFixed(1) ?? 'N/A' },
                  { label: 'Beta', value: data.info.beta?.toFixed(2) ?? 'N/A' },
                  { label: '52W גבוה', value: data.info['52w_high'] ? `$${data.info['52w_high']}` : 'N/A' },
                  { label: '52W נמוך', value: data.info['52w_low'] ? `$${data.info['52w_low']}` : 'N/A' },
                  { label: 'דיבידנד', value: data.info.dividend_yield ? `${(data.info.dividend_yield * 100).toFixed(2)}%` : 'אין' },
                  { label: 'מדינה', value: data.info.country || 'N/A' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: 'var(--bg-hover)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="text-sm font-bold num mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>
              {data.info.website && (
                <a href={data.info.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--blue)' }}>
                  <Globe size={14} />{data.info.website}<ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Signal */}
          <div className="card text-center">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>המלצה</p>
            <div className="text-2xl font-black py-3 rounded-xl mb-2"
              style={{ color: sig.color, background: `color-mix(in srgb, ${sig.color} 15%, transparent)` }}>
              {sig.label}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ציון: {data.signal.score}/100</p>
            <div className="mt-3 rounded-full h-2" style={{ background: 'var(--bg-hover)' }}>
              <div className="h-2 rounded-full" style={{ width: `${data.signal.score}%`, background: sig.color }} />
            </div>
          </div>

          {/* Rule of 40 */}
          <Rule40Card rule40={rule40} />

          {/* Support/Resistance */}
          {(data.support_resistance.support || data.support_resistance.resistance) && (
            <div className="card">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                תמיכה והתנגדות
              </h4>
              {data.support_resistance.resistance && (
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm" style={{ color: 'var(--red)' }}>התנגדות</span>
                  <span className="num font-bold" style={{ color: 'var(--text-primary)' }}>${data.support_resistance.resistance}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>מחיר נוכחי</span>
                <span className="num font-bold" style={{ color: 'var(--text-primary)' }}>${data.current_price}</span>
              </div>
              {data.support_resistance.support && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm" style={{ color: 'var(--green)' }}>תמיכה</span>
                  <span className="num font-bold" style={{ color: 'var(--text-primary)' }}>${data.support_resistance.support}</span>
                </div>
              )}
            </div>
          )}

          {/* Company details */}
          <CompanyDetails details={details} info={data.info} />

          {/* Disclaimer */}
          <div className="card border" style={{ borderColor: 'color-mix(in srgb, var(--yellow) 30%, transparent)', background: 'color-mix(in srgb, var(--yellow) 5%, transparent)' }}>
            <div className="flex items-start gap-2">
              <AlertCircle size={14} style={{ color: 'var(--yellow)' }} className="mt-0.5 flex-shrink-0" />
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                הניתוח מבוסס על נתוני עבר ואינו ערובה לתשואה עתידית. ייעוץ השקעות מקצועי מומלץ לפני כל החלטה.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
