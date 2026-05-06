import { useState } from 'react';
import {
  Sparkles, Loader2, RefreshCw, ShieldCheck, ShieldAlert, ShieldX,
  TrendingUp, AlertTriangle, BarChart2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getAIPortfolioAnalysis } from '../api/client';
import type { PortfolioPosition, PortfolioSummary } from '../types';

interface AnalysisResult {
  overall_health: string;
  health_score: number;
  summary: string;
  diversification: string;
  top_picks: Array<{ symbol: string; action: string; reason: string }>;
  sector_insights: string;
  risk_level: string;
  risk_comment: string;
  opportunities: string[];
  warnings: string[];
  rebalance_suggestion: string;
  market_context: string;
  _tokens?: { input: number; output: number; cache_read: number; cache_write: number };
}

interface Props {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
}

const HEALTH_CFG: Record<string, { color: string; icon: any; bg: string }> = {
  'מצוין': { color: '#00c896', icon: ShieldCheck, bg: 'rgba(0,200,150,.1)' },
  'טוב':   { color: '#3b82f6', icon: ShieldCheck, bg: 'rgba(59,130,246,.1)' },
  'בינוני':{ color: '#f5c518', icon: ShieldAlert, bg: 'rgba(245,197,24,.1)' },
  'חלש':   { color: '#f04060', icon: ShieldX,    bg: 'rgba(240,64,96,.1)'  },
};

const ACTION_COLOR: Record<string, string> = {
  'הגדל': '#00c896',
  'שמור': '#3b82f6',
  'הקטן': '#f5c518',
  'מכור': '#f04060',
};

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? '#00c896' : score >= 45 ? '#f5c518' : '#f04060';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .6s ease' }} />
      </div>
      <span style={{ fontSize: '.72rem', fontWeight: 700, color, minWidth: 32 }}>{score}</span>
    </div>
  );
}

export default function AIPortfolioAnalysis({ positions, summary }: Props) {
  const [result, setResult]     = useState<AnalysisResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(true);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAIPortfolioAnalysis({
        positions: positions.map(p => ({
          symbol: p.symbol,
          name: p.name,
          sector: p.sector,
          buy_price: p.buy_price,
          current_price: p.current_price,
          quantity: p.quantity,
          pnl_pct: p.pnl_pct,
          invested: p.invested,
          current_value: p.current_value,
          ta_score: p.ta?.score,
          ta_signal: p.ta?.signal,
          rsi: p.ta?.rsi ?? undefined,
        })),
        total_invested: summary.total_invested,
        total_value: summary.total_value,
        total_pnl_pct: summary.total_pnl_pct,
      });
      setResult(res);
      setExpanded(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'שגיאה בניתוח AI');
    } finally {
      setLoading(false);
    }
  };

  const health = result ? (HEALTH_CFG[result.overall_health] ?? HEALTH_CFG['בינוני']) : null;
  const HealthIcon = health?.icon ?? ShieldCheck;

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #00c896)' }} />

      {/* Header */}
      <div style={{
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={14} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>
            ניתוח תיק AI — Claude
          </span>
          {result?._tokens && (
            <span style={{ fontSize: '.6rem', color: 'var(--muted)', background: 'var(--card2)', padding: '1px 6px', borderRadius: 4 }}>
              {result._tokens.cache_read > 0
                ? `⚡ cached (${result._tokens.cache_read} tokens)`
                : `${result._tokens.input + result._tokens.output} tokens`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {result && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0.35rem 0.9rem', borderRadius: 7, fontSize: '.75rem', fontWeight: 700,
              background: result ? 'var(--card2)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: result ? 'var(--text2)' : '#fff',
              border: result ? '1px solid var(--border)' : 'none',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><Loader2 size={12} className="spin" /> מנתח תיק...</>
              : result
                ? <><RefreshCw size={12} /> רענן ניתוח</>
                : <><Sparkles size={12} /> נתח תיק עם AI</>}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!result && !loading && !error && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
          <BarChart2 size={28} style={{ margin: '0 auto 10px', color: '#3b82f6', opacity: 0.6 }} />
          <p style={{ fontSize: '.8rem', color: 'var(--text2)', marginBottom: 4 }}>ניתוח AI לתיק כולו</p>
          <p style={{ fontSize: '.7rem', color: 'var(--muted)' }}>
            בריאות תיק, פיזור, המלצות לאיזון וזיהוי סיכונים — מבוסס על {positions.length} פוזיציות
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '1rem 1.1rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--red)', background: 'rgba(240,64,96,.08)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 8, padding: '0.65rem 0.85rem' }}>
            ⚠ {error}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[100, 80, 60, 120, 60, 60].map((w, i) => (
            <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--border)', width: `${w}%`, maxWidth: '100%', opacity: 0.5 + i * 0.05 }} />
          ))}
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
            Claude מנתח את התיק שלך ({positions.length} פוזיציות)...
          </p>
        </div>
      )}

      {/* Results */}
      {result && expanded && (
        <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Top row: Health + Risk */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Health */}
            <div style={{
              flex: '1 1 140px', borderRadius: 10, padding: '0.85rem 1rem',
              background: health?.bg, border: `1px solid ${health?.color}44`,
              textAlign: 'center',
            }}>
              <HealthIcon size={22} style={{ color: health?.color, margin: '0 auto 6px' }} />
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: health?.color }}>{result.overall_health}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: 4 }}>בריאות תיק</div>
            </div>

            {/* Health score */}
            <div style={{ flex: '2 1 180px', background: 'var(--card2)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>ציון בריאות</div>
              <HealthBar score={result.health_score} />
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 6 }}>
                רמת סיכון: <span style={{ fontWeight: 700, color: result.risk_level === 'נמוך' ? 'var(--green)' : result.risk_level === 'גבוה מאוד' ? 'var(--red)' : 'var(--yellow)' }}>{result.risk_level}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--card2)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
              <Sparkles size={10} style={{ display: 'inline', marginLeft: 4, color: '#3b82f6' }} />תקציר מנהלים
            </div>
            <p style={{ fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.75 }}>{result.summary}</p>
          </div>

          {/* Top picks */}
          {result.top_picks?.length > 0 && (
            <div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                <TrendingUp size={10} style={{ display: 'inline', marginLeft: 4, color: 'var(--blue)' }} />המלצות לפוזיציות
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.top_picks.map((pick, i) => {
                  const actionColor = ACTION_COLOR[pick.action] ?? 'var(--text2)';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--card2)', borderRadius: 8, padding: '0.55rem 0.85rem',
                      border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: '.78rem', fontWeight: 900, color: 'var(--text)', minWidth: 46 }}>{pick.symbol}</span>
                      <span style={{
                        fontSize: '.65rem', fontWeight: 800, color: actionColor,
                        background: `${actionColor}18`, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                      }}>{pick.action}</span>
                      <span style={{ fontSize: '.74rem', color: 'var(--text2)', flex: 1, lineHeight: 1.4 }}>{pick.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Opportunities + Warnings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(0,200,150,.06)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 10, padding: '0.75rem 0.85rem' }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>✦ הזדמנויות</div>
              {result.opportunities?.map((o, i) => (
                <p key={i} style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.55, marginBottom: i < result.opportunities.length - 1 ? 4 : 0 }}>• {o}</p>
              ))}
            </div>
            <div style={{ background: 'rgba(240,64,96,.06)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 10, padding: '0.75rem 0.85rem' }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ אזהרות</div>
              {result.warnings?.map((w, i) => (
                <p key={i} style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.55, marginBottom: i < result.warnings.length - 1 ? 4 : 0 }}>• {w}</p>
              ))}
            </div>
          </div>

          {/* Diversification + Risk */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ borderRadius: 8, padding: '0.65rem 0.85rem', background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.62rem', color: 'var(--blue)', fontWeight: 700, marginBottom: 5 }}>🗂 פיזור</div>
              <p style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>{result.diversification}</p>
            </div>
            <div style={{ borderRadius: 8, padding: '0.65rem 0.85rem', background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.62rem', color: 'var(--yellow)', fontWeight: 700, marginBottom: 5 }}>⚖ סיכון</div>
              <p style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>{result.risk_comment}</p>
            </div>
          </div>

          {/* Sector insights */}
          {result.sector_insights && (
            <div style={{ fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6, padding: '0.65rem 0.85rem', background: 'var(--card2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.62rem', color: 'var(--purple)', fontWeight: 700, marginBottom: 5 }}>🏢 סקטורים</div>
              {result.sector_insights}
            </div>
          )}

          {/* Rebalance suggestion */}
          {result.rebalance_suggestion && (
            <div style={{ fontSize: '.75rem', color: 'var(--text2)', padding: '0.65rem 0.85rem', background: 'rgba(139,92,246,.06)', borderRadius: 8, border: '1px solid rgba(139,92,246,.2)', lineHeight: 1.6 }}>
              <AlertTriangle size={11} style={{ display: 'inline', marginLeft: 4, color: '#8b5cf6' }} />
              <span style={{ fontSize: '.62rem', fontWeight: 700, color: '#8b5cf6' }}>המלצת איזון: </span>
              {result.rebalance_suggestion}
            </div>
          )}

          {/* Market context */}
          {result.market_context && (
            <div style={{ fontSize: '.73rem', color: 'var(--muted)', padding: '0.5rem 0.75rem', background: 'var(--card2)', borderRadius: 7, border: '1px solid var(--border)' }}>
              🌐 {result.market_context}
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
