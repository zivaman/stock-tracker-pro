import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, ChevronDown } from 'lucide-react';
import axios from 'axios';
import type { SignalData, StockInfo, FibonacciData } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

interface Props {
  symbol: string;
  currentPrice?: number;
  signal?: SignalData;
  info?: StockInfo;
  performance?: Record<string, number | null>;
  supportResistance?: { support: number | null; resistance: number | null };
  fibonacci?: FibonacciData;
}

const SUGGESTED_GROUPS = [
  {
    label: '📈 טכני',
    questions: [
      'מה אומר הניתוח הטכני כרגע?',
      'מה רמות התמיכה וההתנגדות?',
      'האם יש תבנית גרף בולטת?',
      'מה אומר ה-RSI וה-MACD?',
    ],
  },
  {
    label: '🏢 יסודות',
    questions: [
      'מה המודל העסקי של החברה?',
      'האם המניה יקרה או זולה יחסית?',
      'מה מרווחי הרווח של החברה?',
      'מתי הדוח הרווחים הבא ומה לצפות?',
    ],
  },
  {
    label: '🌍 מאקרו וסקטור',
    questions: [
      'מי המתחרים העיקריים?',
      'איך הריבית משפיעה על המניה?',
      'מה מגמות הסקטור?',
      'מה הסיכונים הרגולטוריים?',
    ],
  },
  {
    label: '💰 השקעה',
    questions: [
      'האם כדאי לקנות עכשיו?',
      'מה מחיר היעד של האנליסטים?',
      'מה הקטליזטורים הבאים?',
      'מה הסיכונים העיקריים?',
    ],
  },
];

/** Simple markdown → styled JSX (bold + line-breaks) */
function renderMarkdown(text: string) {
  // Split into lines, process bold (**text**) within each line
  return text.split('\n').map((line, li) => {
    const parts: React.ReactNode[] = [];
    const boldRe = /\*\*(.+?)\*\*/g;
    let last = 0, m;
    while ((m = boldRe.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(<strong key={m.index}>{m[1]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    // Heading lines (### or ##)
    if (line.startsWith('### ')) {
      return <p key={li} style={{ fontWeight: 800, color: 'var(--blue)', fontSize: '.8rem', margin: '6px 0 2px 0' }}>{parts.map((p, i) => typeof p === 'string' ? p.replace(/^###\s*/, '') : p)}</p>;
    }
    if (line.startsWith('## ')) {
      return <p key={li} style={{ fontWeight: 800, color: 'var(--text)', fontSize: '.82rem', margin: '8px 0 2px 0' }}>{parts.map((p, i) => typeof p === 'string' ? p.replace(/^##\s*/, '') : p)}</p>;
    }
    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      return <p key={li} style={{ margin: '1px 0', paddingRight: 10, fontSize: '.78rem', lineHeight: 1.55 }}>• {parts.map((p, i) => typeof p === 'string' ? p.replace(/^[-•*]\s*/, '') : p)}</p>;
    }
    if (line.trim() === '') return <br key={li} />;
    return <p key={li} style={{ margin: '2px 0', fontSize: '.78rem', lineHeight: 1.6 }}>{parts}</p>;
  });
}

export default function StockChat({
  symbol, currentPrice, signal, info, performance, supportResistance, fibonacci,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `שלום! אני אנליסט AI מלא עבור **${symbol}**${info?.name ? ` — ${info.name}` : ''}.\n\nמחיר נוכחי: **$${currentPrice?.toFixed(2) ?? '—'}** | ציון TA: **${signal?.score ?? '—'}/100** | סקטור: **${info?.sector ?? '—'}**\n\nאני יכול לענות על כל שאלה — טכנית, יסודית, מאקרו, תחרות, הערכת שווי ועוד. מה תרצה לדעת?`,
        ts: Date.now(),
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildContextData = () => ({
    current_price:       currentPrice,
    signal:              signal?.signal,
    score:               signal?.score,
    trend:               signal?.trend_label ?? signal?.trend,
    rsi:                 signal?.rsi,
    macd:                signal?.macd,
    macd_signal:         signal?.macd_signal,
    sma20:               signal?.sma20,
    sma50:               signal?.sma50,
    sma150:              signal?.sma150,
    sma200:              signal?.sma200,
    bb_upper:            signal?.bb_upper,
    bb_lower:            signal?.bb_lower,
    stoch_k:             signal?.stoch_k,
    adx:                 signal?.adx,
    atr:                 signal?.atr,
    williams_r:          signal?.williams_r,
    cci:                 signal?.cci,
    vol_ratio:           signal?.vol_ratio,
    reasons:             signal?.reasons ?? [],
    warnings:            signal?.warnings ?? [],
    // Info
    name:                info?.name,
    sector:              info?.sector,
    industry:            info?.industry,
    description:         info?.description,
    country:             info?.country,
    currency:            info?.currency,
    website:             info?.website,
    market_cap:          info?.market_cap,
    pe_ratio:            info?.pe_ratio ?? signal?.pe_ratio,
    dividend_yield:      info?.dividend_yield,
    beta:                info?.beta,
    '52w_high':          info?.['52w_high'],
    '52w_low':           info?.['52w_low'],
    avg_volume:          info?.avg_volume,
    revenue:             info?.revenue,
    employees:           info?.employees,
    // Extra info fields (may come from enriched backend)
    profit_margins:      (info as any)?.profit_margins,
    operating_margins:   (info as any)?.operating_margins,
    earnings_growth:     (info as any)?.earnings_growth,
    revenue_growth:      (info as any)?.revenue_growth,
    return_on_equity:    (info as any)?.return_on_equity,
    debt_to_equity:      (info as any)?.debt_to_equity,
    free_cashflow:       (info as any)?.free_cashflow,
    price_to_book:       (info as any)?.price_to_book,
    price_to_sales:      (info as any)?.price_to_sales,
    enterprise_value:    (info as any)?.enterprise_value,
    short_float:         (info as any)?.short_float,
    institutional_pct:   (info as any)?.institutional_pct,
    target_price:        (info as any)?.target_price,
    analyst_rec:         (info as any)?.analyst_rec,
    analyst_count:       (info as any)?.analyst_count,
    next_earnings:       (info as any)?.next_earnings,
    // Performance
    performance,
    // Support / Resistance
    support:             supportResistance?.support,
    resistance:          supportResistance?.resistance,
    // Fibonacci
    fibonacci,
  });

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: question, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await axios.post('/api/chat', {
        symbol,
        question,
        history: messages.slice(-14).map(m => ({ role: m.role, content: m.content })),
        context_data: buildContextData(),
      }, { timeout: 30000 });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer, ts: Date.now() }]);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'שגיאה בחיבור לשרת';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${detail}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const signalColor = signal?.signal?.includes('buy') ? 'var(--green)'
    : signal?.signal?.includes('sell') ? 'var(--red)' : 'var(--yellow)';

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, left: 28, zIndex: 200,
          width: 54, height: 54, borderRadius: '50%',
          background: open ? '#ef4444' : 'var(--blue)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,.45)',
          transition: 'all .2s',
        }}
        title={open ? "סגור צ'אט" : 'אנליסט AI — שאל על המניה'}
      >
        {open ? <X size={21} color="#fff" /> : <MessageCircle size={21} color="#fff" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, left: 28, zIndex: 199,
          width: 420, height: '72vh',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 18, boxShadow: '0 24px 72px rgba(0,0,0,.55)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp .2s ease',
        }}>

          {/* Header */}
          <div style={{
            padding: '0.8rem 1rem',
            background: 'var(--card2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(59,130,246,.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={17} style={{ color: 'var(--blue)' }} />
              </div>
              <div>
                <div style={{ fontSize: '.88rem', fontWeight: 800, color: 'var(--text)' }}>
                  אנליסט AI — {symbol}
                </div>
                <div style={{ fontSize: '.63rem', color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: signalColor, fontWeight: 700 }}>{signal?.signal ?? '—'}</span>
                  <span>·</span>
                  <span>${currentPrice?.toFixed(2) ?? '—'}</span>
                  <span>·</span>
                  <span>{info?.sector ?? '—'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '0.8rem',
            display: 'flex', flexDirection: 'column', gap: 10,
            minHeight: 0,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', gap: 7, alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--blue)' : 'rgba(0,200,150,.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User size={13} color="#fff" />
                    : <Bot size={13} color="var(--green)" />}
                </div>

                {/* Bubble */}
                <div style={{
                  background: msg.role === 'user' ? 'var(--blue)' : 'var(--card2)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  padding: '0.6rem 0.9rem',
                  maxWidth: '85%',
                  fontSize: '.78rem', lineHeight: 1.6,
                }}>
                  {msg.role === 'assistant'
                    ? <div>{renderMarkdown(msg.content)}</div>
                    : <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,200,150,.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={13} color="var(--green)" />
                </div>
                <div style={{
                  background: 'var(--card2)', borderRadius: '4px 14px 14px 14px',
                  padding: '0.55rem 0.9rem',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Loader2 size={13} className="spin" style={{ color: 'var(--blue)' }} />
                  <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>מנתח...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 1 && !loading && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 0.75rem' }}>
              {/* Group tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {SUGGESTED_GROUPS.map((g, gi) => (
                  <button key={gi}
                    onClick={() => setActiveGroup(gi)}
                    style={{
                      fontSize: '.6rem', padding: '2px 7px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${activeGroup === gi ? 'var(--blue)' : 'var(--border)'}`,
                      background: activeGroup === gi ? 'rgba(59,130,246,.12)' : 'transparent',
                      color: activeGroup === gi ? 'var(--blue)' : 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >{g.label}</button>
                ))}
              </div>
              {/* Questions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SUGGESTED_GROUPS[activeGroup].questions.map(q => (
                  <button key={q} onClick={() => send(q)}
                    style={{
                      textAlign: 'right', fontSize: '.72rem', padding: '5px 9px',
                      borderRadius: 7, border: '1px solid var(--border)',
                      background: 'var(--bg2)', color: 'var(--text2)',
                      cursor: 'pointer', transition: 'all .12s',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '0.65rem 0.75rem',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 6, alignItems: 'center',
            background: 'var(--card2)',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="שאל כל שאלה על המניה..."
              disabled={loading}
              style={{
                flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '0.5rem 0.8rem', fontSize: '.8rem',
                color: 'var(--text)', outline: 'none', direction: 'rtl',
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() ? 'var(--blue)' : 'var(--border)',
                border: 'none', borderRadius: 10,
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              <Send size={14} color="#fff" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
