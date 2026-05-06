import { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area,
} from 'recharts';
import { getInstitutional, explainInstitutional, getInsiderRecent } from '../api/client';

/* ─── Types ─── */
interface Holder {
  holder: string;
  shares: number;
  value: number;
  pct_held: number;
  pct_change: number | null;
  action: string;
  action_label: string;
  date: string;
}
interface SmartMoney {
  buyers: Holder[];
  sellers: Holder[];
  new_positions: Holder[];
  sentiment_score: number;
  n_increased: number;
  n_decreased: number;
  n_maintained: number;
}
interface TrendPoint {
  date: string; close: number; volume: number;
  vol_ma20: number | null; vol_ma50: number | null;
  up_day: boolean; vol_ratio: number | null;
}
interface MajorSummary {
  insiders_pct: number | null;
  institutions_pct: number | null;
  float_held_pct: number | null;
  institutions_count: number | null;
}
interface InstitutionalData {
  symbol: string; name: string;
  institutional: Holder[]; mutual_funds: Holder[];
  major_summary: MajorSummary;
  smart_money: SmartMoney;
  price_volume_trend: TrendPoint[];
}

/* ─── Helpers ─── */
function fmtB(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}
function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}
function actionColor(action: string): string {
  switch (action) {
    case 'new_position':            return '#a78bfa';
    case 'significantly_increased': return '#00c896';
    case 'increased':               return '#22c55e';
    case 'maintained':              return 'var(--muted)';
    case 'decreased':               return '#f97316';
    case 'significantly_decreased': return '#f04060';
    default: return 'var(--muted)';
  }
}
function actionBg(action: string): string {
  switch (action) {
    case 'new_position':            return 'rgba(167,139,250,.15)';
    case 'significantly_increased': return 'rgba(0,200,150,.12)';
    case 'increased':               return 'rgba(34,197,94,.08)';
    case 'maintained':              return 'rgba(255,255,255,.04)';
    case 'decreased':               return 'rgba(249,115,22,.08)';
    case 'significantly_decreased': return 'rgba(240,64,96,.12)';
    default: return 'transparent';
  }
}

/* ─── Explain Panel ─── */
interface ExplainPanelProps {
  holder: Holder;
  symbol: string;
  stockName: string;
  sector: string;
  sentimentScore: number;
  nIncreased: number;
  nDecreased: number;
}
function ExplainPanel({ holder, symbol, stockName, sector, sentimentScore, nIncreased, nDecreased }: ExplainPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const fetched = useRef(false);

  function toggle() {
    setOpen(o => {
      const next = !o;
      if (next && !fetched.current) {
        fetched.current = true;
        setLoading(true);
        explainInstitutional(symbol, {
          institution: holder.holder,
          action: holder.action,
          pct_change: holder.pct_change,
          stock_name: stockName,
          symbol,
          sector,
          shares: holder.shares,
          value_usd: holder.value,
          pct_held: holder.pct_held,
          date: holder.date,
          sentiment_score: sentimentScore,
          n_increased: nIncreased,
          n_decreased: nDecreased,
        })
          .then(d => setText(d.explanation))
          .catch(() => setErr('שגיאה בטעינת הסבר — נסה שוב'))
          .finally(() => setLoading(false));
      }
      return next;
    });
  }

  const ac = actionColor(holder.action);

  return (
    <div>
      {/* Explain toggle button */}
      <button
        onClick={toggle}
        style={{
          background: open ? `${ac}18` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? ac + '40' : 'var(--border)'}`,
          borderRadius: 6,
          padding: '3px 10px',
          fontSize: '.65rem',
          fontWeight: 700,
          color: open ? ac : 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'all .15s',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {loading
          ? <span style={{ display: 'inline-block', width: 10, height: 10, border: `2px solid ${ac}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <span>{open ? '▲' : '▼'}</span>
        }
        {open ? 'הסתר הסבר' : '💡 הסבר אנליסטים'}
      </button>

      {/* Explanation text */}
      {open && (
        <div style={{
          marginTop: 8,
          background: `linear-gradient(135deg, ${ac}08, rgba(0,0,0,0))`,
          border: `1px solid ${ac}25`,
          borderRadius: 10,
          padding: '10px 14px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Accent bar */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: ac, borderRadius: '3px 0 0 3px' }} />

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: '.78rem' }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${ac}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              מנתח את הפעולה המוסדית...
            </div>
          )}

          {err && <p style={{ color: '#f04060', fontSize: '.78rem', margin: 0 }}>⚠ {err}</p>}

          {text && !loading && (
            <div>
              <div style={{ fontSize: '.65rem', fontWeight: 800, color: ac, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, marginRight: 6 }}>
                ניתוח AI — {holder.holder}
              </div>
              <p style={{
                fontSize: '.8rem',
                color: 'var(--text)',
                lineHeight: 1.7,
                margin: 0,
                paddingRight: 6,
                whiteSpace: 'pre-wrap',
              }}>
                {text}
              </p>
              <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: 8, paddingRight: 6 }}>
                ⚠ מבוסס על דיווח 13F · עיכוב עד 45 יום · לצרכי מחקר בלבד
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sentiment Meter ─── */
function SentimentMeter({ score, nUp, nDown, nMaintained }: { score: number; nUp: number; nDown: number; nMaintained: number }) {
  const color = score >= 65 ? '#00c896' : score >= 45 ? '#f59e0b' : '#f04060';
  const label = score >= 65 ? 'צבירה מוסדית' : score >= 45 ? 'מעורב' : 'פדיון מוסדי';
  const total = nUp + nDown + nMaintained || 1;
  return (
    <div style={{ background: 'var(--card2)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        סנטימנט מוסדי (רבעון אחרון)
      </div>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
        <div style={{ width: `${(nUp / total) * 100}%`, background: '#00c896', transition: 'width .6s' }} />
        <div style={{ width: `${(nMaintained / total) * 100}%`, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ width: `${(nDown / total) * 100}%`, background: '#f04060' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, fontSize: '.7rem' }}>
          <span style={{ color: '#00c896' }}>▲ הגדילו: {nUp}</span>
          <span style={{ color: 'var(--muted)' }}>● שמרו: {nMaintained}</span>
          <span style={{ color: '#f04060' }}>▼ הקטינו: {nDown}</span>
        </div>
        <div style={{ background: `${color}20`, border: `1px solid ${color}44`, borderRadius: 8, padding: '3px 10px' }}>
          <span style={{ fontSize: '.78rem', fontWeight: 800, color }}>{label}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Smart Money Table with inline explain ─── */
interface SmartMoneyTableProps {
  holders: Holder[];
  title: string;
  emptyMsg: string;
  symbol: string;
  stockName: string;
  sector: string;
  sentimentScore: number;
  nIncreased: number;
  nDecreased: number;
}
function SmartMoneyTable({ holders, title, emptyMsg, symbol, stockName, sector, sentimentScore, nIncreased, nDecreased }: SmartMoneyTableProps) {
  if (holders.length === 0) return (
    <div style={{ color: 'var(--muted)', fontSize: '.78rem', padding: '8px 0' }}>{emptyMsg}</div>
  );
  return (
    <div>
      <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{title}</div>
      {holders.map((h, i) => {
        const ac = actionColor(h.action);
        const ab = actionBg(h.action);
        return (
          <div key={i} style={{
            borderRadius: 10, marginBottom: 6,
            background: ab, border: `1px solid ${ac}28`,
            overflow: 'hidden',
          }}>
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '.75rem', fontWeight: 800, color: ac, flexShrink: 0 }}>{h.action_label}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.78rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{h.holder}</div>
                  <div style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{h.date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                {h.pct_change !== null && (
                  <span className="num" style={{ fontSize: '.75rem', fontWeight: 800, color: ac }}>
                    {h.pct_change > 0 ? '+' : ''}{h.pct_change.toFixed(1)}%
                  </span>
                )}
                <span className="num" style={{ fontSize: '.7rem', color: 'var(--muted)', minWidth: 52, textAlign: 'right' }}>{fmtB(h.value)}</span>
                <span style={{ fontSize: '.62rem', color: 'var(--muted)', minWidth: 40, textAlign: 'right' }}>{h.pct_held.toFixed(2)}%</span>
              </div>
            </div>

            {/* Explain button + panel */}
            {h.action !== 'maintained' && (
              <div style={{ padding: '0 10px 8px' }}>
                <ExplainPanel
                  holder={h}
                  symbol={symbol}
                  stockName={stockName}
                  sector={sector}
                  sentimentScore={sentimentScore}
                  nIncreased={nIncreased}
                  nDecreased={nDecreased}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Price + Volume Combo Chart ─── */
function PriceVolChart({ trend }: { trend: TrendPoint[] }) {
  const slice = trend.slice(-60);
  const data = slice.map(p => ({
    date: p.date.slice(5),
    price: p.close,
    volume: p.volume,
    volMA20: p.vol_ma20,
    up: p.up_day,
  }));

  return (
    <div>
      <h4 style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        מחיר ומחזור — 60 ימים
      </h4>
      <div style={{ height: 100, marginBottom: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#64748b' }} interval={14} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} width={46} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'מחיר']}
            />
            <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} fill="url(#priceGrad)" dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 70 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" hide />
            <YAxis tickFormatter={fmtVol} tick={{ fontSize: 9, fill: '#64748b' }} width={46} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}
              formatter={(v: number, name: string) => [fmtVol(v), name === 'volMA20' ? 'Vol MA20' : 'מחזור']}
            />
            <Bar dataKey="volume" maxBarSize={8} radius={[1, 1, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.up ? 'rgba(0,200,150,0.6)' : 'rgba(240,64,96,0.6)'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="volMA20" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls name="volMA20" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: '.63rem', marginTop: 4 }}>
        <span style={{ color: '#3b82f6' }}>── מחיר</span>
        <span style={{ color: '#00c896' }}>■ יום עולה</span>
        <span style={{ color: '#f04060' }}>■ יום יורד</span>
        <span style={{ color: '#f59e0b' }}>── Vol MA20</span>
      </div>
      {trend.length >= 30 && <VolPriceCorr trend={trend} />}
    </div>
  );
}

/* ─── Vol/Price period breakdown ─── */
function VolPriceCorr({ trend }: { trend: TrendPoint[] }) {
  const third = Math.floor(trend.length / 3);
  const periods = [
    { label: '2 חודשים+', color: 'var(--muted)', pts: trend.slice(0, third) },
    { label: 'חודש שעבר',  color: '#f59e0b',    pts: trend.slice(third, third * 2) },
    { label: 'חודש אחרון', color: '#3b82f6',    pts: trend.slice(third * 2) },
  ];
  const stats = periods.map(p => ({
    label: p.label, color: p.color,
    avgPrice: p.pts.reduce((s, x) => s + x.close, 0) / (p.pts.length || 1),
    avgVol:   p.pts.reduce((s, x) => s + x.volume, 0) / (p.pts.length || 1),
    upDays:   p.pts.filter(x => x.up_day).length,
    totalDays: p.pts.length,
  }));
  const maxVol = Math.max(...stats.map(s => s.avgVol), 1);

  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
      {stats.map((s, i) => {
        const prev = i > 0 ? stats[i - 1] : null;
        const priceDir = prev ? (s.avgPrice > prev.avgPrice ? '▲' : '▼') : '●';
        const priceCol = prev ? (s.avgPrice > prev.avgPrice ? '#00c896' : '#f04060') : 'var(--text2)';
        const volDir = prev ? (s.avgVol > prev.avgVol ? '▲' : '▼') : '●';
        const volCol = prev ? (s.avgVol > prev.avgVol ? '#f59e0b' : 'var(--muted)') : 'var(--text2)';
        return (
          <div key={i} style={{ background: 'var(--card2)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.6rem', color: s.color, fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>מחיר ממוצע</div>
              <div className="num" style={{ fontSize: '.82rem', fontWeight: 800, color: priceCol }}>{priceDir} ${s.avgPrice.toFixed(2)}</div>
            </div>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>מחזור ממוצע</div>
              <div className="num" style={{ fontSize: '.75rem', fontWeight: 700, color: volCol }}>{volDir} {fmtVol(s.avgVol)}</div>
            </div>
            <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 3 }}>ימים עולים: {s.upDays}/{s.totalDays}</div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${(s.avgVol / maxVol) * 100}%`, background: 'rgba(251,191,36,0.55)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Full Holders Table ─── */
function HoldersTable({ holders, maxVal, symbol, stockName, sector, sentimentScore, nIncreased, nDecreased }: {
  holders: Holder[]; maxVal: number;
  symbol: string; stockName: string; sector: string;
  sentimentScore: number; nIncreased: number; nDecreased: number;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, padding: '0 4px' }}>
        <span>מחזיק</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ minWidth: 44, textAlign: 'right' }}>% מניות</span>
          <span style={{ minWidth: 60, textAlign: 'right' }}>שינוי</span>
          <span style={{ minWidth: 54, textAlign: 'right' }}>שווי</span>
        </div>
      </div>

      {holders.map((h, i) => {
        const ac = actionColor(h.action);
        const barW = maxVal > 0 ? (h.value / maxVal) * 100 : 0;
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: i < 3 ? 'rgba(251,191,36,.2)' : 'var(--card2)', border: `1px solid ${i < 3 ? 'rgba(251,191,36,.4)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.58rem', fontWeight: 900, color: i < 3 ? '#fbbf24' : 'var(--muted)', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{h.holder}</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{h.date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span className="num" style={{ fontSize: '.7rem', color: 'var(--text2)' }}>{h.pct_held.toFixed(2)}%</span>
                <span style={{ fontSize: '.7rem', fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}30`, borderRadius: 5, padding: '1px 6px', minWidth: 70, textAlign: 'center' }}>
                  {h.action_label}
                </span>
                <span className="num" style={{ fontSize: '.7rem', color: 'var(--muted)', minWidth: 54, textAlign: 'right' }}>{fmtB(h.value)}</span>
              </div>
            </div>
            {/* bar */}
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginRight: 24, marginBottom: 4 }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${barW}%`, background: i === 0 ? '#3b82f6' : i === 1 ? '#6366f1' : i === 2 ? '#8b5cf6' : 'rgba(255,255,255,0.2)', transition: 'width .5s' }} />
            </div>
            {/* Explain */}
            {h.action !== 'maintained' && (
              <div style={{ marginRight: 24 }}>
                <ExplainPanel
                  holder={h}
                  symbol={symbol}
                  stockName={stockName}
                  sector={sector}
                  sentimentScore={sentimentScore}
                  nIncreased={nIncreased}
                  nDecreased={nDecreased}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Insider Activity Panel ─── */
interface InsiderTx {
  insider: string; position: string; kind: string; label: string;
  shares: number; value: number; price: number; text: string; date: string;
}
interface InsiderData {
  transactions: InsiderTx[];
  summary: { total_txs: number; sales_count: number; purchase_count: number; total_sold_usd: number; total_bought_usd: number; net_sentiment: string };
}

function InsiderActivity({ symbol }: { symbol: string }) {
  const [data, setData] = useState<InsiderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    getInsiderRecent(symbol, days)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol, days]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      <div className="spin" style={{ width: 22, height: 22, border: '3px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  );
  if (!data) return <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>אין נתוני פעילות אחרונה</p>;

  const { transactions: txs, summary: s } = data;
  const sentColor = s.net_sentiment === 'bullish' ? '#00c896' : s.net_sentiment === 'bearish' ? '#f04060' : 'var(--muted)';
  const sentLabel = s.net_sentiment === 'bullish' ? 'שורי 🟢' : s.net_sentiment === 'bearish' ? 'דובי 🔴' : 'ניטרלי ⚪';

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Summary pills */}
          <div style={{ background: 'rgba(240,64,96,.1)', border: '1px solid rgba(240,64,96,.25)', borderRadius: 7, padding: '4px 10px' }}>
            <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>מכירות</div>
            <div className="num" style={{ fontSize: '.82rem', fontWeight: 800, color: '#f04060' }}>${(s.total_sold_usd / 1e6).toFixed(1)}M</div>
          </div>
          <div style={{ background: 'rgba(0,200,150,.1)', border: '1px solid rgba(0,200,150,.25)', borderRadius: 7, padding: '4px 10px' }}>
            <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>רכישות</div>
            <div className="num" style={{ fontSize: '.82rem', fontWeight: 800, color: '#00c896' }}>${(s.total_bought_usd / 1e6).toFixed(1)}M</div>
          </div>
          <div style={{ background: `${sentColor}15`, border: `1px solid ${sentColor}30`, borderRadius: 7, padding: '4px 10px' }}>
            <div style={{ fontSize: '.58rem', color: 'var(--muted)' }}>סנטימנט</div>
            <div style={{ fontSize: '.82rem', fontWeight: 800, color: sentColor }}>{sentLabel}</div>
          </div>
        </div>
        {/* Days selector */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '3px 8px', borderRadius: 5, fontSize: '.62rem', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: days === d ? 'var(--blue)' : 'var(--card2)',
              color: days === d ? '#fff' : 'var(--muted)',
            }}>{d}י</button>
          ))}
        </div>
      </div>

      {txs.length === 0 ? (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>אין פעילות פנים ב-{days} הימים האחרונים</div>
        </div>
      ) : (
        <div>
          {txs.map((tx, i) => {
            const isSale = tx.kind === 'sale';
            const isBuy  = tx.kind === 'purchase';
            const col = isSale ? '#f04060' : isBuy ? '#00c896' : 'var(--muted)';
            const bg  = isSale ? 'rgba(240,64,96,.06)' : isBuy ? 'rgba(0,200,150,.06)' : 'var(--card2)';
            return (
              <div key={i} style={{
                background: bg, border: `1px solid ${col}22`,
                borderRadius: 9, padding: '9px 12px', marginBottom: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: '.7rem', fontWeight: 800, color: col }}>{tx.label}</span>
                    <span style={{ fontSize: '.6rem', color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 5px' }}>{tx.date}</span>
                  </div>
                  <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text)' }}>{tx.insider}</div>
                  <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>{tx.position}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="num" style={{ fontSize: '.8rem', fontWeight: 800, color: col }}>${(tx.value / 1e6).toFixed(2)}M</div>
                  <div className="num" style={{ fontSize: '.65rem', color: 'var(--muted)' }}>{tx.shares.toLocaleString()} מניות</div>
                  {tx.price > 0 && <div className="num" style={{ fontSize: '.62rem', color: 'var(--muted)' }}>@ ${tx.price.toFixed(0)}</div>}
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 8, padding: '6px 10px', background: 'var(--card2)', borderRadius: 7 }}>
            📌 <b>מקור:</b> SEC Form 4 דרך Yahoo Finance · עיכוב עד 2 ימי עסקים · מייצג פעילות בעלי תפקיד ודירקטורים בלבד
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function InstitutionalHoldings({ symbol, sector }: { symbol: string; sector?: string }) {
  const [data, setData] = useState<InstitutionalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'smart' | 'inst' | 'mf' | 'chart' | 'insider'>('smart');

  useEffect(() => {
    setLoading(true); setError('');
    getInstitutional(symbol)
      .then(d => setData(d))
      .catch(e => setError(e.response?.data?.detail || 'שגיאה בטעינת נתוני מוסדיים'))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px' }} />
      <p style={{ color: 'var(--text2)', fontSize: '.85rem' }}>טוען נתוני 13F...</p>
    </div>
  );
  if (error) return <p style={{ color: 'var(--red)', fontSize: '.85rem' }}>⚠ {error}</p>;
  if (!data) return null;

  const sm = data.smart_money;
  const ms = data.major_summary;
  const allInst = data.institutional;
  const maxVal   = allInst.length ? Math.max(...allInst.map(h => h.value)) : 1;
  const maxValMF = data.mutual_funds.length ? Math.max(...data.mutual_funds.map(h => h.value)) : 1;
  const stockSector = sector || '';

  const TABS = [
    { key: 'smart',   label: '🧠 כסף חכם' },
    { key: 'insider', label: '🔔 פנים — אחרון' },
    { key: 'chart',   label: '📈 מחיר/מחזור' },
    { key: 'inst',    label: '🏦 מוסדיים' },
    { key: 'mf',      label: '📊 קרנות' },
  ] as { key: typeof tab; label: string }[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Summary pills ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ms.institutions_pct != null && (
          <div style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.25)', borderRadius: 8, padding: '5px 12px' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>מוסדיים מחזיקים</div>
            <div className="num" style={{ fontSize: '.9rem', fontWeight: 900, color: '#3b82f6' }}>{ms.institutions_pct.toFixed(1)}%</div>
          </div>
        )}
        {ms.float_held_pct != null && (
          <div style={{ background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 8, padding: '5px 12px' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>מה-Float</div>
            <div className="num" style={{ fontSize: '.9rem', fontWeight: 900, color: '#8b5cf6' }}>{ms.float_held_pct.toFixed(1)}%</div>
          </div>
        )}
        {ms.insiders_pct != null && (
          <div style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 8, padding: '5px 12px' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>Insiders</div>
            <div className="num" style={{ fontSize: '.9rem', fontWeight: 900, color: '#f59e0b' }}>{ms.insiders_pct.toFixed(2)}%</div>
          </div>
        )}
        {ms.institutions_count != null && (
          <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, padding: '5px 12px' }}>
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 2 }}>מספר מוסדיים</div>
            <div className="num" style={{ fontSize: '.9rem', fontWeight: 900, color: '#10b981' }}>{ms.institutions_count.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* ── Tab nav ── */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 2, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '5px 14px', borderRadius: 6, fontSize: '.73rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
            background: tab === t.key ? 'var(--blue)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--muted)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── SMART MONEY ── */}
      {tab === 'smart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SentimentMeter
            score={sm.sentiment_score}
            nUp={sm.n_increased}
            nDown={sm.n_decreased}
            nMaintained={sm.n_maintained}
          />

          {sm.new_positions.length > 0 && (
            <div style={{ background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.25)', borderRadius: 10, padding: '0.75rem' }}>
              <SmartMoneyTable
                holders={sm.new_positions} title="🆕 פוזיציות חדשות — נכנסו רבעון זה" emptyMsg=""
                symbol={symbol} stockName={data.name} sector={stockSector}
                sentimentScore={sm.sentiment_score} nIncreased={sm.n_increased} nDecreased={sm.n_decreased}
              />
            </div>
          )}

          <div style={{ background: 'rgba(0,200,150,.04)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 10, padding: '0.75rem' }}>
            <SmartMoneyTable
              holders={sm.buyers} title="🚀 הגדילו חשיפה — מיון לפי שינוי גדול ביותר" emptyMsg="אין נתוני הגדלה ברבעון זה"
              symbol={symbol} stockName={data.name} sector={stockSector}
              sentimentScore={sm.sentiment_score} nIncreased={sm.n_increased} nDecreased={sm.n_decreased}
            />
          </div>

          {sm.sellers.length > 0 && (
            <div style={{ background: 'rgba(240,64,96,.04)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 10, padding: '0.75rem' }}>
              <SmartMoneyTable
                holders={sm.sellers} title="⚠ הקטינו חשיפה — מוכרים" emptyMsg=""
                symbol={symbol} stockName={data.name} sector={stockSector}
                sentimentScore={sm.sentiment_score} nIncreased={sm.n_increased} nDecreased={sm.n_decreased}
              />
            </div>
          )}

          <div style={{ fontSize: '.65rem', color: 'var(--muted)', background: 'var(--card2)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
            📌 <b>מקור:</b> דיווחי 13F שהוגשו ל-SEC (EDGAR) · <b>עיכוב:</b> עד 45 יום מסוף הרבעון
            · שינוי % = שינוי רבעוני Q/Q בכמות המניות המוחזקות
          </div>
        </div>
      )}

      {/* ── INSIDER ACTIVITY ── */}
      {tab === 'insider' && <InsiderActivity symbol={symbol} />}

      {/* ── CHART ── */}
      {tab === 'chart' && data.price_volume_trend.length > 10 && (
        <PriceVolChart trend={data.price_volume_trend} />
      )}

      {/* ── INSTITUTIONAL TABLE ── */}
      {tab === 'inst' && (
        <HoldersTable
          holders={allInst} maxVal={maxVal}
          symbol={symbol} stockName={data.name} sector={stockSector}
          sentimentScore={sm.sentiment_score} nIncreased={sm.n_increased} nDecreased={sm.n_decreased}
        />
      )}

      {/* ── MUTUAL FUNDS TABLE ── */}
      {tab === 'mf' && (
        <HoldersTable
          holders={data.mutual_funds} maxVal={maxValMF}
          symbol={symbol} stockName={data.name} sector={stockSector}
          sentimentScore={sm.sentiment_score} nIncreased={sm.n_increased} nDecreased={sm.n_decreased}
        />
      )}
    </div>
  );
}
