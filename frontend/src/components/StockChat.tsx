import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import axios from 'axios';
import type { SignalData } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  symbol: string;
  currentPrice?: number;
  signal?: SignalData;
  sector?: string;
  name?: string;
}

const SUGGESTED = [
  'האם כדאי לקנות עכשיו?',
  'מה אומר הניתוח הטכני?',
  'מה רמות התמיכה וההתנגדות?',
  'מה הסיכונים העיקריים?',
  'השווה לממוצעים הנעים',
];

export default function StockChat({ symbol, currentPrice, signal, sector, name }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      // Welcome message
      setMessages([{
        role: 'assistant',
        content: `שלום! אני כאן לענות על שאלות לגבי המניה **${symbol}**${name ? ` (${name})` : ''}.\n\nהמחיר הנוכחי: $${currentPrice?.toFixed(2) ?? '—'} | ציון: ${signal?.score ?? '—'}/100\n\nמה תרצה לדעת?`,
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const context_data = {
      current_price: currentPrice,
      signal: signal?.signal,
      score: signal?.score,
      rsi: signal?.rsi,
      macd: signal?.macd,
      sma50: signal?.sma50,
      sma200: signal?.sma200,
      pe_ratio: signal?.pe_ratio,
      reasons: signal?.reasons ?? [],
      warnings: signal?.warnings ?? [],
      sector,
      name,
    };

    try {
      const res = await axios.post('/api/chat', {
        symbol,
        question,
        history: messages.slice(-8),
        context_data,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'שגיאה בחיבור לשרת';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${detail}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, left: 28, zIndex: 100,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? 'var(--red)' : 'var(--blue)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,.4)',
          transition: 'all .2s',
        }}
        title={open ? 'סגור צ\'אט' : 'שאל על המניה'}
      >
        {open ? <X size={20} color="#fff" /> : <MessageCircle size={20} color="#fff" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, left: 28, zIndex: 99,
          width: 340, maxHeight: '70vh',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp .2s ease',
        }}>
          {/* Header */}
          <div style={{ padding: '0.85rem 1rem', background: 'var(--card2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={15} style={{ color: 'var(--blue)' }} />
            <div>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>צ׳אט מניה — {symbol}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>שאל שאלה על הנייר</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--blue)' : 'rgba(0,200,150,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User size={13} color="#fff" />
                    : <Bot size={13} color="var(--green)" />}
                </div>
                <div style={{
                  background: msg.role === 'user' ? 'var(--blue)' : 'var(--card2)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  padding: '0.55rem 0.8rem',
                  fontSize: '.78rem', lineHeight: 1.55, maxWidth: '80%',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,200,150,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={13} color="var(--green)" />
                </div>
                <div style={{ background: 'var(--card2)', borderRadius: '4px 12px 12px 12px', padding: '0.55rem 0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} className="spin" style={{ color: 'var(--blue)' }} />
                  <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>חושב...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 1 && !loading && (
            <div style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: 5, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => send(q)}
                  style={{ fontSize: '.68rem', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--text2)', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="שאל שאלה על המניה..."
              disabled={loading}
              style={{
                flex: 1, background: 'var(--card2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0.45rem 0.7rem', fontSize: '.8rem',
                color: 'var(--text)', outline: 'none', direction: 'rtl',
              }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{
                background: 'var(--blue)', border: 'none', borderRadius: 8,
                width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: !input.trim() ? .5 : 1,
              }}>
              <Send size={13} color="#fff" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
