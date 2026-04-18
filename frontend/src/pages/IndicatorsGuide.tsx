import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, TrendingUp, Activity, BarChart2, Layers } from 'lucide-react';

interface IndicatorDetail {
  key: string;
  name: string;
  nameEn: string;
  weight: number;
  buyZone: string;
  sellZone: string;
  description: string;
  howItWorks: string;
  buyLogic: string;
  sellLogic: string;
  category: 'momentum' | 'trend' | 'volume' | 'fundamental' | 'volatility';
  optimal: string;
}

const INDICATORS: IndicatorDetail[] = [
  {
    key: 'rsi',
    name: 'RSI — מדד חוזק יחסי',
    nameEn: 'Relative Strength Index',
    weight: 22,
    buyZone: '30 – 45',
    sellZone: '> 70',
    description: 'מדד תנופה הבודק את עוצמת השינויים במחיר לאורך תקופה. נע בין 0 ל-100.',
    howItWorks: 'RSI מחשב את היחס בין עליות ממוצעות לירידות ממוצעות ב-14 ימי מסחר אחרונים. ערך גבוה מ-70 מעיד על "קניית יתר" (overbought) וערך נמוך מ-30 מעיד על "מכירת יתר" (oversold).',
    buyLogic: 'RSI בין 30-45: הנייר בתחום מכירת יתר ומתקרב להתאוששות. אזור קנייה היסטורי אמין.',
    sellLogic: 'RSI מעל 70: הנייר בקניית יתר. סיכוי גבוה לתיקון מחיר. שקול מכירה חלקית.',
    category: 'momentum',
    optimal: 'RSI 40-60 = ניטרלי | RSI <30 = חזק לקנייה | RSI >70 = אות מכירה',
  },
  {
    key: 'macd',
    name: 'MACD — מדד ממוצעים נעים',
    nameEn: 'Moving Average Convergence Divergence',
    weight: 25,
    buyZone: 'חציית ה-MACD את קו האות כלפי מעלה',
    sellZone: 'חציית ה-MACD את קו האות כלפי מטה',
    description: 'MACD הוא מדד מגמה ותנופה המחשב את ההפרש בין ממוצע נע אקספוננציאלי של 12 ימים לבין 26 ימים.',
    howItWorks: 'קו ה-MACD = EMA(12) – EMA(26). קו האות = EMA(9) של ה-MACD. כאשר MACD חוצה את קו האות מלמטה למעלה, זה אות קנייה. היסטוגרם מציג את הפער ביניהם.',
    buyLogic: 'MACD חוצה מעל קו האות (crossover bullish): מגמת עלייה מתחזקת. במיוחד כאשר הקרוסאובר קורה מתחת לקו האפס.',
    sellLogic: 'MACD חוצה מתחת לקו האות (crossover bearish): מגמת ירידה מתחזקת. המיוחד כשקורה מעל קו האפס.',
    category: 'trend',
    optimal: 'היסטוגרם עולה = מומנטום חיובי | היסטוגרם יורד = מומנטום שלילי',
  },
  {
    key: 'sma50',
    name: 'SMA50 — ממוצע נע 50 יום',
    nameEn: '50-Day Simple Moving Average',
    weight: 12,
    buyZone: 'מחיר מעל SMA50',
    sellZone: 'מחיר מתחת ל-SMA50',
    description: 'ממוצע פשוט של מחיר הסגירה ב-50 ימי המסחר האחרונים. מייצג מגמה לטווח בינוני.',
    howItWorks: 'SMA50 מחליק תנודות קצרות ומציג את מגמת המחיר לטווח בינוני (כ-2.5 חודשים). משמש כרמת תמיכה/התנגדות דינמית.',
    buyLogic: 'מחיר מעל SMA50: מגמה בינונית חיובית. המניה נסחרת בטריטוריה חיובית ביחס לממוצע.',
    sellLogic: 'מחיר מתחת ל-SMA50: איתות שלילי. המניה איבדה תמיכה בינונית.',
    category: 'trend',
    optimal: 'מחיר > SMA50 > SMA200 = מגמת עלייה מלאה',
  },
  {
    key: 'sma200',
    name: 'SMA200 — ממוצע נע 200 יום',
    nameEn: '200-Day Simple Moving Average',
    weight: 10,
    buyZone: 'Golden Cross (SMA50 חוצה SMA200 מעלה)',
    sellZone: 'Death Cross (SMA50 חוצה SMA200 מטה)',
    description: 'ממוצע פשוט של 200 ימי מסחר — הקו החשוב ביותר בניתוח טכני ארוך טווח.',
    howItWorks: 'SMA200 מייצג את המגמה הארוכה. Golden Cross (SMA50 עולה מעל SMA200) הוא אחד האיתותים הבולים ביותר בשוק. Death Cross הוא ההפך.',
    buyLogic: 'מחיר מעל SMA200 = מגמה ארוכת טווח חיובית. Golden Cross = אות קנייה חזק.',
    sellLogic: 'מחיר מתחת ל-SMA200 = מגמה ארוכת טווח שלילית. Death Cross = אות מכירה משמעותי.',
    category: 'trend',
    optimal: 'Golden Cross ב-200/50 = אות קנייה חזק מאוד',
  },
  {
    key: 'bb',
    name: 'Bollinger Bands — רצועות בולינגר',
    nameEn: 'Bollinger Bands (20, 2σ)',
    weight: 10,
    buyZone: 'מחיר ליד הרצועה התחתונה (Lower Band)',
    sellZone: 'מחיר ליד הרצועה העליונה (Upper Band)',
    description: 'שלוש רצועות המחושבות מ-SMA20 עם סטיות תקן של ±2σ. מראה תנודתיות וקצוות מחיר.',
    howItWorks: 'הרצועה האמצעית = SMA(20). העליונה = SMA + 2×סטיית תקן. התחתונה = SMA – 2×סטיית תקן. ~95% מהמחירים נמצאים בין הרצועות.',
    buyLogic: 'מחיר נוגע ברצועה תחתונה = קצה סטטיסטי תחתון. לרוב מגיע "bounce" חזרה למרכז.',
    sellLogic: 'מחיר נוגע ברצועה עליונה = קצה סטטיסטי עליון. המחיר לרוב חוזר לממוצע.',
    category: 'volatility',
    optimal: 'Squeeze (רצועות צרות) = תנועה גדולה עומדת להגיע',
  },
  {
    key: 'stoch',
    name: 'Stochastic — אוסצילטור סטוכסטי',
    nameEn: 'Stochastic Oscillator (14, 3, 3)',
    weight: 10,
    buyZone: 'K < 20 (מכירת יתר)',
    sellZone: 'K > 80 (קניית יתר)',
    description: 'משווה מחיר הסגירה לטווח המחירים ב-14 הימים האחרונים. נע בין 0 ל-100.',
    howItWorks: '%K = (Close – Low14) / (High14 – Low14) × 100. %D = ממוצע נע 3 ימים של %K. חציית K מעל D = אות קנייה.',
    buyLogic: 'K < 20 ו-K חוצה D מלמטה: מכירת יתר + אות חיובי. אות קנייה חזק.',
    sellLogic: 'K > 80 ו-K חוצה D מלמעלה: קניית יתר + אות שלילי. שקול מכירה.',
    category: 'momentum',
    optimal: 'K < 20 עם D שגם עולה = אות קנייה מאוד חזק',
  },
  {
    key: 'volume',
    name: 'Volume — נפח מסחר',
    nameEn: 'Trading Volume',
    weight: 8,
    buyZone: 'נפח גבוה פי 1.5 ממוצע עם עלייה',
    sellZone: 'נפח גבוה עם ירידה',
    description: 'מספר המניות שנסחרו בתקופה. נפח גבוה מאמת מגמות, נפח נמוך מעיד על חולשה.',
    howItWorks: 'Volume הוא "דלק" התנועה. עלייה בנפח מגמה = מאמת את המגמה. ירידה בנפח מגמה = חולשה אפשרית. Volume Spike מאותת שינוי מגמה.',
    buyLogic: 'נפח גבוה פי 1.5+ מהממוצע עם עלייה במחיר = קנייה מוסדית. מאותת כניסת כסף גדול.',
    sellLogic: 'נפח גבוה עם ירידה = מכירה מוסדית. סימן להפצה (distribution).',
    category: 'volume',
    optimal: 'Volume > 1.5x ממוצע 20 יום + תנועת מחיר = אות חזק',
  },
  {
    key: 'pe',
    name: 'מכפיל רווח — P/E Ratio',
    nameEn: 'Price to Earnings Ratio',
    weight: 13,
    buyZone: 'P/E < 15 (זול)',
    sellZone: 'P/E > 35 (יקר)',
    description: 'יחס בין מחיר המניה לרווח למניה. מדד פונדמנטלי להערכת שווי.',
    howItWorks: 'P/E = מחיר מניה / רווח שנתי למניה (EPS). P/E = 20 אומר שמשלמים 20 שנות רווח. ממוצע היסטורי של S&P 500 ≈ 15-18.',
    buyLogic: 'P/E < 15: המניה זולה ביחס לרווחים. קנייה אטרקטיבית היסטורית. P/E 15-18: הוגן.',
    sellLogic: 'P/E > 35: המניה יקרה מאוד. צפוי תיקון אלא אם צמיחה גבוהה מצדיקה זאת.',
    category: 'fundamental',
    optimal: 'P/E < 15 = זול | 15-18 = הוגן | 18-25 = ביקוש | >35 = יקר',
  },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  momentum:    { label: 'תנופה', color: 'var(--blue)' },
  trend:       { label: 'מגמה', color: 'var(--green)' },
  volume:      { label: 'נפח',  color: 'var(--purple)' },
  fundamental: { label: 'פונדמנטלי', color: 'var(--yellow)' },
  volatility:  { label: 'תנודתיות', color: 'var(--red)' },
};

function IndicatorCard({ ind }: { ind: IndicatorDetail }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_LABELS[ind.category];

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
      overflow: 'hidden', transition: 'box-shadow .2s',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '1rem 1.2rem', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'right',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${cat.color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: cat.color }}>
            {ind.weight}%
          </span>
        </div>

        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--text)' }}>
            {ind.name}
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>
            {ind.nameEn}
          </div>
        </div>

        <span style={{
          fontSize: '.65rem', padding: '3px 8px', borderRadius: 6,
          background: `${cat.color}22`, color: cat.color, fontWeight: 600,
          flexShrink: 0,
        }}>
          {cat.label}
        </span>

        <div style={{ color: 'var(--muted)', flexShrink: 0 }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Summary row (always visible) */}
      <div style={{
        display: 'flex', gap: 12, padding: '0 1.2rem 0.9rem',
        borderBottom: open ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{
          flex: 1, background: 'rgba(0,200,150,.08)', border: '1px solid rgba(0,200,150,.2)',
          borderRadius: 8, padding: '0.45rem 0.75rem',
        }}>
          <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 3 }}>אזור קנייה</div>
          <div style={{ fontSize: '.75rem', color: 'var(--green)', fontWeight: 600 }}>{ind.buyZone}</div>
        </div>
        <div style={{
          flex: 1, background: 'rgba(240,64,96,.08)', border: '1px solid rgba(240,64,96,.2)',
          borderRadius: 8, padding: '0.45rem 0.75rem',
        }}>
          <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 3 }}>אזור מכירה</div>
          <div style={{ fontSize: '.75rem', color: 'var(--red)', fontWeight: 600 }}>{ind.sellZone}</div>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.7 }}>
            {ind.description}
          </p>

          <div style={{ background: 'var(--card2)', borderRadius: 8, padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>⚙ איך זה עובד?</div>
            <p style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.7 }}>{ind.howItWorks}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'rgba(0,200,150,.06)', border: '1px solid rgba(0,200,150,.15)', borderRadius: 8, padding: '0.65rem 0.85rem' }}>
              <div style={{ fontSize: '.68rem', color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>▲ היגיון קנייה</div>
              <p style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.6 }}>{ind.buyLogic}</p>
            </div>
            <div style={{ background: 'rgba(240,64,96,.06)', border: '1px solid rgba(240,64,96,.15)', borderRadius: 8, padding: '0.65rem 0.85rem' }}>
              <div style={{ fontSize: '.68rem', color: 'var(--red)', fontWeight: 700, marginBottom: 4 }}>▼ היגיון מכירה</div>
              <p style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.6 }}>{ind.sellLogic}</p>
            </div>
          </div>

          <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>
              <Info size={11} style={{ display: 'inline', marginLeft: 4 }} />
              ערכים אופטימליים
            </div>
            <p style={{ fontSize: '.78rem', color: 'var(--text2)' }}>{ind.optimal}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IndicatorsGuide() {
  const totalWeight = INDICATORS.reduce((s, i) => s + i.weight, 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--card) 0%, var(--card2) 100%)',
        border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem 2rem',
        marginBottom: '1.5rem', textAlign: 'right',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Layers size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>
              מדריך אינדיקטורים טכניים
            </h1>
            <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 2 }}>
              כל המדדים, המשקולות, ואזורי הקנייה/מכירה במקום אחד
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <span key={k} style={{
              fontSize: '.68rem', padding: '3px 10px', borderRadius: 6,
              background: `${v.color}22`, color: v.color, fontWeight: 600,
            }}>
              {v.label}
            </span>
          ))}
          <span style={{
            fontSize: '.68rem', padding: '3px 10px', borderRadius: 6,
            background: 'var(--card2)', color: 'var(--muted)', fontWeight: 600,
          }}>
            סה״כ משקל: {totalWeight}%
          </span>
        </div>
      </div>

      {/* Weights summary table */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        overflow: 'hidden', marginBottom: '1.5rem',
      }}>
        <div style={{ padding: '0.75rem 1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} style={{ color: 'var(--blue)' }} />
          <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>
            טבלת משקולות — ציון איתות ({totalWeight}%)
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem', direction: 'rtl' }}>
            <thead>
              <tr style={{ background: 'var(--card2)' }}>
                {['מדד', 'קטגוריה', 'משקל', 'אזור קנייה', 'אזור מכירה'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'right', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INDICATORS.map((ind, i) => {
                const cat = CATEGORY_LABELS[ind.category];
                return (
                  <tr key={ind.key} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--card2)' }}>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{ind.name.split(' — ')[0]}</td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <span style={{ fontSize: '.65rem', padding: '2px 7px', borderRadius: 5, background: `${cat.color}22`, color: cat.color, fontWeight: 600 }}>
                        {cat.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, minWidth: 60 }}>
                          <div style={{ width: `${(ind.weight / 25) * 100}%`, height: '100%', background: cat.color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: cat.color, minWidth: 30 }}>{ind.weight}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', color: 'var(--green)', fontSize: '.75rem' }}>{ind.buyZone}</td>
                    <td style={{ padding: '0.6rem 1rem', color: 'var(--red)', fontSize: '.75rem' }}>{ind.sellZone}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score legend */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '1rem 1.2rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={15} style={{ color: 'var(--yellow)' }} />
          <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>פרשנות ציון האיתות (0-100)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { range: '80-100', label: '▲▲ קנייה חזקה', bg: 'rgba(0,200,150,.15)', color: 'var(--green)' },
            { range: '55-79', label: '▲ קנייה',       bg: 'rgba(0,200,150,.08)', color: 'var(--green)' },
            { range: '35-54', label: '◆ ניטרלי',      bg: 'rgba(245,197,24,.08)', color: 'var(--yellow)' },
            { range: '20-34', label: '● מכירה קלה',   bg: 'rgba(240,64,96,.08)',  color: 'var(--red)' },
            { range: '0-19',  label: '▼ מכירה',       bg: 'rgba(240,64,96,.15)',  color: 'var(--red)' },
          ].map(s => (
            <div key={s.range} style={{
              flex: 1, minWidth: 100, padding: '0.6rem 0.85rem', borderRadius: 8,
              background: s.bg, border: `1px solid ${s.color}44`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontWeight: 700, color: s.color, fontSize: '.85rem' }}>{s.label}</span>
              <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>ציון: {s.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Indicator cards */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <TrendingUp size={15} style={{ color: 'var(--blue)' }} />
        <span style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)' }}>
          פירוט אינדיקטורים — לחץ להרחבה
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {INDICATORS.map(ind => (
          <IndicatorCard key={ind.key} ind={ind} />
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
          * הנתונים מוצגים לצרכי ניתוח בלבד ואינם מהווים ייעוץ השקעות. ציוני האיתות מחושבים על בסיס אלגוריתם פנימי.
        </p>
      </div>
    </div>
  );
}
