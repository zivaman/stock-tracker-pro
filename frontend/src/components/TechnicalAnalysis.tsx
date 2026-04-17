import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import type { PricePoint, SignalData } from '../types';

interface Props {
  signal: SignalData;
  history: PricePoint[];
  peRatio?: number | null;
}

/* ─── Score Meter ─── */
function ScoreMeter({ score }: { score: number }) {
  const color = score >= 65 ? '#00c896' : score >= 45 ? '#3b82f6' : score >= 30 ? '#f59e0b' : '#f04060';
  const label = score >= 65 ? 'קנייה חזקה' : score >= 45 ? 'קנייה' : score >= 30 ? 'מעקב' : score >= 15 ? 'ניטראלי' : 'מכירה';
  const arc = (score / 100) * 314;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="130" height="130" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${arc} 314`} strokeLinecap="round"
            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray .8s ease' }} />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div className="num" style={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>/ 100</div>
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
        background: `${color}20`, border: `1px solid ${color}55`, borderRadius: 8,
        padding: '4px 14px' }}>
        <span style={{ fontSize: '.85rem', fontWeight: 800, color }}>{label}</span>
      </div>
    </div>
  );
}

/* ─── Indicator Explanation Card ─── */
interface IndicatorCardProps {
  title: string;
  subtitle: string;
  currentValue: string | null;
  currentStatus: 'buy' | 'sell' | 'neutral' | 'watch';
  buyZone: string;
  sellZone: string;
  explanation: string;
  extraInfo?: string;
}
function IndicatorCard({ title, subtitle, currentValue, currentStatus, buyZone, sellZone, explanation, extraInfo }: IndicatorCardProps) {
  const statusColor = currentStatus === 'buy' ? 'var(--green)' : currentStatus === 'sell' ? 'var(--red)' : currentStatus === 'watch' ? 'var(--yellow)' : 'var(--text2)';
  const statusLabel = currentStatus === 'buy' ? '▲ קנייה' : currentStatus === 'sell' ? '▼ מכירה' : currentStatus === 'watch' ? '◆ מעקב' : '● ניטראלי';
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <div style={{ background: 'var(--card2)', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '.88rem', fontWeight: 800, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 1 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentValue && (
            <span className="num" style={{ fontSize: '1rem', fontWeight: 900, color: statusColor }}>{currentValue}</span>
          )}
          <span style={{ fontSize: '.72rem', fontWeight: 700, color: statusColor,
            background: `${statusColor}18`, border: `1px solid ${statusColor}44`,
            borderRadius: 6, padding: '2px 8px' }}>{statusLabel}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--card)' }}>
        <p style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.55, marginBottom: 8 }}>{explanation}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: 'rgba(0,200,150,.07)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 7, padding: '5px 8px' }}>
            <div style={{ fontSize: '.62rem', color: 'var(--green)', fontWeight: 700, marginBottom: 2 }}>▲ אזור קנייה</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text)', fontWeight: 600 }}>{buyZone}</div>
          </div>
          <div style={{ background: 'rgba(240,64,96,.07)', border: '1px solid rgba(240,64,96,.2)', borderRadius: 7, padding: '5px 8px' }}>
            <div style={{ fontSize: '.62rem', color: 'var(--red)', fontWeight: 700, marginBottom: 2 }}>▼ אזור מכירה</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text)', fontWeight: 600 }}>{sellZone}</div>
          </div>
        </div>
        {extraInfo && (
          <p style={{ fontSize: '.7rem', color: 'var(--blue)', marginTop: 7, background: 'rgba(59,130,246,.07)', borderRadius: 6, padding: '4px 8px', lineHeight: 1.4 }}>
            💡 {extraInfo}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── RSI Spark ─── */
function RSIChart({ data }: { data: PricePoint[] }) {
  const recent = data.slice(-60).filter(d => d.rsi != null);
  return (
    <div>
      <h4 style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>RSI (14) — גרף היסטורי</h4>
      <div style={{ height: 90 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={recent} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} width={24} />
            <Tooltip formatter={(v: number) => [v?.toFixed(1), 'RSI']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}
              labelStyle={{ color: 'var(--text2)' }} />
            <ReferenceLine y={70} stroke="#f04060" strokeDasharray="4 2" strokeOpacity={0.6} />
            <ReferenceLine y={30} stroke="#00c896" strokeDasharray="4 2" strokeOpacity={0.6} />
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" />
            <Line type="monotone" dataKey="rsi" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', marginTop: 3 }}>
        <span style={{ color: 'var(--red)' }}>מכירה &gt;70</span>
        <span style={{ color: 'var(--green)' }}>קנייה &lt;30</span>
      </div>
    </div>
  );
}

/* ─── MACD Chart ─── */
function MACDChart({ data }: { data: PricePoint[] }) {
  const recent = data.slice(-60).filter(d => d.macd != null);
  return (
    <div>
      <h4 style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>MACD (12,26,9) — גרף היסטורי</h4>
      <div style={{ height: 90 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={recent} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} width={30} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}
              labelStyle={{ color: 'var(--text2)' }} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
            <Bar dataKey="macd_hist" fill="#3b82f6" name="Histogram" radius={[1,1,0,0]}>
              {recent.map((d, i) => (
                <Cell key={i} fill={(d.macd_hist ?? 0) >= 0 ? 'rgba(0,200,150,0.5)' : 'rgba(240,64,96,0.5)'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls name="MACD" />
            <Line type="monotone" dataKey="macd_signal" stroke="#f04060" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="Signal" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: '.65rem', marginTop: 3 }}>
        <span style={{ color: '#3b82f6' }}>── MACD</span>
        <span style={{ color: '#f04060' }}>- - Signal</span>
        <span style={{ color: 'var(--muted)' }}>■ Histogram</span>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function TechnicalAnalysis({ signal, history, peRatio }: Props) {
  const latest = history[history.length - 1];
  const currentPrice = latest?.close;

  // RSI status
  const rsiStatus: 'buy' | 'sell' | 'neutral' | 'watch' =
    !signal.rsi ? 'neutral' :
    signal.rsi < 30 ? 'buy' : signal.rsi < 45 ? 'buy' :
    signal.rsi > 70 ? 'sell' : signal.rsi > 55 ? 'watch' : 'neutral';

  // MACD status
  const macdStatus: 'buy' | 'sell' | 'neutral' =
    signal.macd && signal.macd_signal
      ? signal.macd > signal.macd_signal ? 'buy' : 'sell'
      : 'neutral';

  // SMA50 status
  const sma50Status: 'buy' | 'sell' | 'neutral' =
    signal.sma50 && currentPrice
      ? currentPrice > signal.sma50 ? 'buy' : 'sell'
      : 'neutral';

  // Golden/Death Cross
  const crossStatus: 'buy' | 'sell' | 'neutral' =
    signal.sma50 && signal.sma200
      ? signal.sma50 > signal.sma200 ? 'buy' : 'sell'
      : 'neutral';

  // BB status
  const bbStatus: 'buy' | 'sell' | 'neutral' =
    signal.bb_lower && signal.bb_upper && currentPrice
      ? currentPrice < signal.bb_lower + (signal.bb_upper - signal.bb_lower) * 0.2 ? 'buy'
      : currentPrice > signal.bb_lower + (signal.bb_upper - signal.bb_lower) * 0.8 ? 'sell'
      : 'neutral'
      : 'neutral';

  // P/E status
  const peStatus: 'buy' | 'sell' | 'neutral' | 'watch' =
    !peRatio ? 'neutral' :
    peRatio < 15 ? 'buy' : peRatio < 25 ? 'neutral' :
    peRatio < 35 ? 'watch' : 'sell';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Score + signals ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>ציון ניתוח טכני</p>
        <ScoreMeter score={signal.score} />
      </div>

      {/* ── Reasons / Warnings summary ── */}
      {(signal.reasons.length > 0 || signal.warnings.length > 0) && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
          <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>סיבות לאיתות</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {signal.reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '.78rem', color: 'var(--green)', lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span><span>{r}</span>
              </div>
            ))}
            {signal.warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '.78rem', color: 'var(--red)', lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span><span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Indicator Explanations ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
        <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
          פירוט אינדיקטורים — מה הם ומתי לפעול
        </p>

        <IndicatorCard
          title="RSI — מדד עוצמה יחסית"
          subtitle="Relative Strength Index (14 ימים)"
          currentValue={signal.rsi ? `${signal.rsi.toFixed(1)}` : null}
          currentStatus={rsiStatus}
          buyZone="מתחת ל-30 (Oversold) או 30-45 (התאוששות)"
          sellZone="מעל 70 (Overbought) — שקול מכירה חלקית"
          explanation="RSI מודד את עוצמת תנועת המחיר בסקלה של 0-100. ערך נמוך מסמן לחץ מכירה מוגזם (הזדמנות), ערך גבוה מסמן קנייה מוגזמת (סיכון). מדובר במדד מומנטום קצר-טווח (14 ימים)."
          extraInfo="טיפ: RSI בין 30-50 לאחר ירידה חדה מהווה לעתים קרובות נקודת כניסה אופטימלית"
        />

        <IndicatorCard
          title="MACD — ממוצע נע מתכנס/מתפצל"
          subtitle="Moving Average Convergence Divergence (12,26,9)"
          currentValue={signal.macd ? `${signal.macd.toFixed(3)}` : null}
          currentStatus={macdStatus}
          buyZone="MACD חוצה את קו האות מלמטה (Bullish Crossover)"
          sellZone="MACD חוצה את קו האות מלמעלה (Bearish Crossover)"
          explanation="MACD מחשב את ההפרש בין ממוצע נע של 12 ימים ל-26 ימים. חציה של קו ה-Signal (9 ימים) מעלה = איתות קנייה. הממוצע הנוכחי מול קו האות: חיובי = מומנטום עולה."
          extraInfo="הכלי האמין ביותר לזיהוי שינוי מגמה. שילוב עם RSI < 40 = איתות כניסה חזק"
        />

        <IndicatorCard
          title="SMA50 — ממוצע נע 50 יום"
          subtitle="Simple Moving Average"
          currentValue={signal.sma50 ? `$${signal.sma50}` : null}
          currentStatus={sma50Status}
          buyZone={`מחיר מעל $${signal.sma50 ?? '—'} — תמיכה חיובית`}
          sellZone={`מחיר מתחת ל-$${signal.sma50 ?? '—'} — SMA50 הופך להתנגדות`}
          explanation="ממוצע 50 הימים האחרונים. כאשר המחיר נמצא מעל הממוצע — מגמה חיובית לטווח בינוני. מנהלי קרנות גדולים עוקבים אחר SMA50 כרמת תמיכה/התנגדות מרכזית."
          extraInfo={signal.sma50 && signal.sma200 ? (signal.sma50 > signal.sma200 ? 'Golden Cross פעיל — SMA50 > SMA200, מגמה ראשית חיובית!' : 'Death Cross — SMA50 < SMA200, זהירות!') : undefined}
        />

        <IndicatorCard
          title="SMA200 — ממוצע נע 200 יום"
          subtitle="Long-Term Trend Indicator"
          currentValue={signal.sma200 ? `$${signal.sma200}` : null}
          currentStatus={crossStatus}
          buyZone="Golden Cross: SMA50 > SMA200 = מגמה עולה ארוכת טווח"
          sellZone="Death Cross: SMA50 < SMA200 = מגמה יורדת ארוכת טווח"
          explanation="SMA200 הוא מדד המגמה הראשית החשוב ביותר. 'Golden Cross' (SMA50 חוצה מעל SMA200) נחשב לאחד מאיתותי הקנייה החזקים ביותר בהיסטוריה. 'Death Cross' הוא האיתות ההפוך."
        />

        <IndicatorCard
          title="רצועות בולינגר (Bollinger Bands)"
          subtitle="20 ימים, 2 סטיות תקן"
          currentValue={signal.bb_lower && signal.bb_upper ? `$${signal.bb_lower}–$${signal.bb_upper}` : null}
          currentStatus={bbStatus}
          buyZone="מחיר ליד הרצועה התחתונה — oversold יחסי, הזדמנות"
          sellZone="מחיר ליד הרצועה העליונה — overbought יחסי, שקול מכירה"
          explanation="רצועות בולינגר מרחב 2 סטיות תקן סביב ממוצע 20 יום. כ-95% מהמחירים נמצאים בתוך הרצועות. כאשר המחיר נוגע ברצועה התחתונה — לחץ מכירה מוגזם. ברצועה העליונה — קנייה מוגזמת."
          extraInfo="כיווץ הרצועות (Squeeze) מסמן פיצוץ פוטנציאלי — מחכה לבחירת כיוון"
        />

        {(peRatio ?? null) !== null && (
          <IndicatorCard
            title="P/E — מכפיל רווח"
            subtitle="Price-to-Earnings Ratio"
            currentValue={peRatio ? `${peRatio.toFixed(1)}x` : null}
            currentStatus={peStatus}
            buyZone="P/E מתחת ל-15 = מניה זולה, מתחת ל-18 = שווי הוגן"
            sellZone="P/E מעל 35 = מניה יקרה מאוד, מעל 50 = ציפיות גבוהות מסוכנות"
            explanation="מכפיל הרווח מראה כמה שוק מוכן לשלם על כל $1 של רווח. P/E נמוך = מניה זולה יחסית. P/E גבוה = שוק מצפה לצמיחה גבוהה. לחברות טכנולוגיה ייתכן P/E גבוה יותר באופן מקובל."
            extraInfo="השווה P/E לממוצע הסקטור ולהיסטוריה של החברה — P/E לא עובד בוואקום"
          />
        )}
      </div>

      {/* ── RSI Chart ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
        <RSIChart data={history} />
      </div>

      {/* ── MACD Chart ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
        <MACDChart data={history} />
      </div>
    </div>
  );
}
