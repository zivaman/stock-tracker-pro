import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, TrendingDown, AlertTriangle, Target, Zap, Shield, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { getAIInsights } from '../api/client';
import type { StockDetail } from '../types';

interface Insights {
  summary: string;
  recommendation: string;
  confidence: number;
  price_target_3m: number | null;
  upside_pct: number | null;
  opportunity: string;
  risk: string;
  catalysts: string[];
  technical_view: string;
  fundamental_view: string;
  time_horizon: string;
  sector_context: string;
  _tokens?: { input: number; output: number; cache_read: number; cache_write: number };
}

interface Props {
  stock: StockDetail;
}

const REC_CFG: Record<string, { color: string; icon: string; bg: string }> = {
  'קנייה חזקה':  { color: '#00c896', icon: '▲▲', bg: 'rgba(0,200,150,.12)' },
  'קנייה':        { color: '#00c896', icon: '▲',  bg: 'rgba(0,200,150,.08)' },
  'המתן':         { color: '#f5c518', icon: '◆',  bg: 'rgba(245,197,24,.08)' },
  'מכירה':        { color: '#f04060', icon: '▼',  bg: 'rgba(240,64,96,.08)'  },
  'מכירה חזקה':  { color: '#f04060', icon: '▼▼', bg: 'rgba(240,64,96,.12)' },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? '#00c896' : value >= 45 ? '#f5c518' : '#f04060';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .6s ease' }} />
      </div>
      <span style={{ fontSize: '.72rem', fontWeight: 700, color, minWidth: 32 }}>{value}%</span>
    </div>
  );
}

export default function AIInsights({ stock }: Props) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(true);

  const fetch = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAIInsights({
        symbol:            stock.symbol,
        name:              stock.name,
        current_price:     stock.current_price,
        sector:            stock.info?.sector,
        signal:            stock.signal,
        info:              stock.info,
        performance:       (stock as any).performance,
        support_resistance: stock.support_resistance,
        fibonacci:         stock.fibonacci,
      });
      setInsights(res);
      setExpanded(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'שגיאה בקבלת ניתוח AI');
    } finally {
      setLoading(false);
    }
  };

  const rec = insights ? (REC_CFG[insights.recommendation] ?? REC_CFG['המתן']) : null;

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
    }}>
      {/* ── Accent bar ── */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #8b5cf6, #3b82f6, #00c896)' }} />

      {/* ── Header ── */}
      <div style={{
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>
            ניתוח AI — Claude
          </span>
          {insights?._tokens && (
            <span style={{ fontSize: '.6rem', color: 'var(--muted)', background: 'var(--card2)', padding: '1px 6px', borderRadius: 4 }}>
              {insights._tokens.cache_read > 0
                ? `⚡ cached (${insights._tokens.cache_read} tokens)`
                : `${insights._tokens.input + insights._tokens.output} tokens`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {insights && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={fetch}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0.35rem 0.9rem', borderRadius: 7, fontSize: '.75rem', fontWeight: 700,
              background: insights ? 'var(--card2)' : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
              color: insights ? 'var(--text2)' : '#fff',
              border: insights ? '1px solid var(--border)' : 'none',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><Loader2 size={12} className="spin" /> מנתח...</>
              : insights
                ? <><RefreshCw size={12} /> רענן</>
                : <><Sparkles size={12} /> בקש ניתוח AI</>}
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {!insights && !loading && !error && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
          <Sparkles size={28} style={{ margin: '0 auto 10px', color: '#8b5cf6', opacity: 0.6 }} />
          <p style={{ fontSize: '.8rem', color: 'var(--text2)', marginBottom: 4 }}>
            קבל ניתוח AI מעמיק על {stock.symbol}
          </p>
          <p style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
            ממליצות, יעדי מחיר, קטליסטורים וסיכונים — מבוסס על כל הנתונים הטכניים והפונדמנטליים
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '1rem 1.1rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--red)', background: 'rgba(240,64,96,.08)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 8, padding: '0.65rem 0.85rem' }}>
            ⚠ {error}
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[120, 80, 200, 60, 60, 60].map((w, i) => (
            <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--border)', width: `${w}%`, maxWidth: '100%', opacity: 0.5 + i * 0.05 }} />
          ))}
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
            Claude מנתח את {stock.symbol}...
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {insights && expanded && (
        <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Top: Recommendation + Confidence + Price Target */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Recommendation */}
            <div style={{
              flex: '1 1 140px', borderRadius: 10, padding: '0.85rem 1rem',
              background: rec?.bg, border: `1px solid ${rec?.color}44`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{rec?.icon}</div>
              <div style={{ fontSize: '.85rem', fontWeight: 800, color: rec?.color }}>{insights.recommendation}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: 4 }}>{insights.time_horizon}</div>
            </div>

            {/* Confidence */}
            <div style={{ flex: '2 1 180px', background: 'var(--card2)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>ביטחון AI</div>
              <ConfidenceBar value={insights.confidence} />
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 6 }}>
                {insights.confidence >= 70 ? 'ביטחון גבוה' : insights.confidence >= 45 ? 'ביטחון בינוני' : 'ביטחון נמוך — חסר נתונים'}
              </div>
            </div>

            {/* Price target */}
            {insights.price_target_3m != null && (
              <div style={{ flex: '1 1 130px', background: 'var(--card2)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                  <Target size={11} style={{ color: 'var(--blue)' }} />
                  <span style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700 }}>יעד 3M</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>
                  ${insights.price_target_3m.toFixed(0)}
                </div>
                {insights.upside_pct != null && (
                  <div style={{
                    fontSize: '.72rem', fontWeight: 700,
                    color: insights.upside_pct >= 0 ? 'var(--green)' : 'var(--red)',
                    marginTop: 2,
                  }}>
                    {insights.upside_pct >= 0 ? '+' : ''}{insights.upside_pct.toFixed(1)}%
                    {insights.upside_pct >= 0 ? <TrendingUp size={10} style={{ display: 'inline', marginRight: 2 }} /> : <TrendingDown size={10} style={{ display: 'inline', marginRight: 2 }} />}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--card2)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
              <Sparkles size={10} style={{ display: 'inline', marginLeft: 4, color: '#8b5cf6' }} />תקציר מנהלים
            </div>
            <p style={{ fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.75 }}>{insights.summary}</p>
          </div>

          {/* Opportunity + Risk */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(0,200,150,.06)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 10, padding: '0.75rem 0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Zap size={11} style={{ color: 'var(--green)' }} />
                <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--green)' }}>הזדמנות</span>
              </div>
              <p style={{ fontSize: '.77rem', color: 'var(--text2)', lineHeight: 1.6 }}>{insights.opportunity}</p>
            </div>
            <div style={{ background: 'rgba(240,64,96,.06)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 10, padding: '0.75rem 0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Shield size={11} style={{ color: 'var(--red)' }} />
                <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--red)' }}>סיכון</span>
              </div>
              <p style={{ fontSize: '.77rem', color: 'var(--text2)', lineHeight: 1.6 }}>{insights.risk}</p>
            </div>
          </div>

          {/* Catalysts */}
          {insights.catalysts?.length > 0 && (
            <div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                <AlertTriangle size={10} style={{ display: 'inline', marginLeft: 4, color: 'var(--yellow)' }} />קטליסטורים מרכזיים
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {insights.catalysts.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    background: 'var(--card2)', borderRadius: 7, padding: '0.5rem 0.75rem',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '.7rem', color: 'var(--yellow)', fontWeight: 800, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: '.77rem', color: 'var(--text2)', lineHeight: 1.5 }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical + Fundamental view */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ borderRadius: 8, padding: '0.65rem 0.85rem', background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.62rem', color: 'var(--blue)', fontWeight: 700, marginBottom: 5 }}>📊 ניתוח טכני</div>
              <p style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>{insights.technical_view}</p>
            </div>
            <div style={{ borderRadius: 8, padding: '0.65rem 0.85rem', background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.62rem', color: 'var(--purple)', fontWeight: 700, marginBottom: 5 }}>🏢 ניתוח פונדמנטלי</div>
              <p style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>{insights.fundamental_view}</p>
            </div>
          </div>

          {/* Sector context */}
          {insights.sector_context && (
            <div style={{ fontSize: '.73rem', color: 'var(--muted)', padding: '0.5rem 0.75rem', background: 'var(--card2)', borderRadius: 7, border: '1px solid var(--border)' }}>
              🌐 {insights.sector_context}
            </div>
          )}

          {/* Disclaimer */}
          <p style={{ fontSize: '.62rem', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            * ניתוח AI אינו ייעוץ השקעות. מבוסס על נתונים היסטוריים ואלגוריתמי ניתוח בלבד. תמיד בצע בדיקה עצמאית לפני השקעה.
          </p>
        </div>
      )}
    </div>
  );
}
