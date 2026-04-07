import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { PricePoint, SignalData } from '../types';

interface Props {
  signal: SignalData;
  history: PricePoint[];
}

function ScoreMeter({ score }: { score: number }) {
  const color =
    score >= 65 ? '#00d09c' : score >= 45 ? '#3498db' : score >= 30 ? '#ffd32a' : '#ff4757';
  const label =
    score >= 65 ? 'קנייה חזקה' : score >= 45 ? 'קנייה' : score >= 30 ? 'מעקב' : score >= 15 ? 'ניטראלי' : 'מכירה';

  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#1e2d47" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(score / 100) * 314} 314`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute text-center">
          <div className="text-3xl font-bold num" style={{ color }}>{score}</div>
          <div className="text-xs text-[#94a3b8]">/ 100</div>
        </div>
      </div>
      <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
    </div>
  );
}

function RSIChart({ data }: { data: PricePoint[] }) {
  const recent = data.slice(-60).filter(d => d.rsi != null);
  return (
    <div>
      <h4 className="text-xs font-semibold text-[#94a3b8] mb-2 uppercase tracking-wider">RSI (14)</h4>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={recent} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} width={28} />
            <Tooltip
              formatter={(v: number) => [v?.toFixed(1), 'RSI']}
              contentStyle={{ background: '#1a2235', border: '1px solid #2d3748', fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <ReferenceLine y={70} stroke="#ff4757" strokeDasharray="4 2" strokeOpacity={0.7} />
            <ReferenceLine y={30} stroke="#00d09c" strokeDasharray="4 2" strokeOpacity={0.7} />
            <ReferenceLine y={50} stroke="#2d3748" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="rsi" stroke="#ffd32a" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
        <span className="text-[#ff4757]">מכירה &gt;70</span>
        <span className="text-[#00d09c]">קנייה &lt;30</span>
      </div>
    </div>
  );
}

function MACDChart({ data }: { data: PricePoint[] }) {
  const recent = data.slice(-60).filter(d => d.macd != null);
  return (
    <div>
      <h4 className="text-xs font-semibold text-[#94a3b8] mb-2 uppercase tracking-wider">MACD (12,26,9)</h4>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={recent} margin={{ top: 2, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} width={35} />
            <Tooltip
              contentStyle={{ background: '#1a2235', border: '1px solid #2d3748', fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <ReferenceLine y={0} stroke="#2d3748" />
            <Line type="monotone" dataKey="macd" stroke="#3498db" strokeWidth={2} dot={false} connectNulls name="MACD" />
            <Line type="monotone" dataKey="macd_signal" stroke="#ff4757" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls name="Signal" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-[10px] mt-1">
        <span className="text-[#3498db]">── MACD</span>
        <span className="text-[#ff4757]">- - Signal</span>
      </div>
    </div>
  );
}

interface IndicatorRowProps {
  label: string;
  value: string | null;
  description: string;
  status?: 'positive' | 'negative' | 'neutral';
}

function IndicatorRow({ label, value, description, status = 'neutral' }: IndicatorRowProps) {
  const statusColor =
    status === 'positive' ? 'text-[#00d09c]' : status === 'negative' ? 'text-[#ff4757]' : 'text-white';
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2d3748] last:border-0">
      <div>
        <span className="text-sm font-medium text-[#94a3b8]">{label}</span>
        <p className="text-xs text-[#475569] mt-0.5">{description}</p>
      </div>
      <span className={`num text-sm font-bold ${statusColor}`}>{value ?? 'N/A'}</span>
    </div>
  );
}

export default function TechnicalAnalysis({ signal, history }: Props) {
  const rsiStatus = signal.rsi
    ? signal.rsi < 35 || signal.rsi < 50
      ? 'positive'
      : signal.rsi > 70
      ? 'negative'
      : 'neutral'
    : 'neutral';

  const macdStatus = signal.macd && signal.macd_signal
    ? signal.macd > signal.macd_signal ? 'positive' : 'negative'
    : 'neutral';

  const sma50Status = signal.sma50 && history.length > 0
    ? history[history.length - 1].close > signal.sma50 ? 'positive' : 'negative'
    : 'neutral';

  return (
    <div className="space-y-5">
      {/* Score Meter */}
      <div className="card flex flex-col items-center gap-3">
        <h3 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">ציון טכני</h3>
        <ScoreMeter score={signal.score} />

        {/* Reasons */}
        {signal.reasons.length > 0 && (
          <div className="w-full space-y-1">
            {signal.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[#00d09c]">
                <span className="mt-0.5">✓</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}
        {signal.warnings.length > 0 && (
          <div className="w-full space-y-1">
            {signal.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[#ff4757]">
                <span className="mt-0.5">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key Indicators */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">אינדיקטורים מרכזיים</h3>
        <IndicatorRow
          label="RSI (14)"
          value={signal.rsi?.toFixed(1) ?? null}
          description="מדד עוצמה יחסית | קנייה <30, מכירה >70"
          status={rsiStatus}
        />
        <IndicatorRow
          label="MACD"
          value={signal.macd?.toFixed(3) ?? null}
          description="ממוצע נע מתכנס/מתפצל | חיובי = מומנטום עולה"
          status={macdStatus}
        />
        <IndicatorRow
          label="SMA 50"
          value={signal.sma50 ? `$${signal.sma50}` : null}
          description="ממוצע נע 50 יום | מחיר מעליו = מגמה חיובית"
          status={sma50Status}
        />
        <IndicatorRow
          label="SMA 200"
          value={signal.sma200 ? `$${signal.sma200}` : null}
          description="ממוצע נע 200 יום | מגמה ארוכת טווח"
          status={
            signal.sma50 && signal.sma200
              ? signal.sma50 > signal.sma200 ? 'positive' : 'negative'
              : 'neutral'
          }
        />
        <IndicatorRow
          label="BB עליון"
          value={signal.bb_upper ? `$${signal.bb_upper}` : null}
          description="פס בולינגר עליון | מעל = מתוח"
          status="neutral"
        />
        <IndicatorRow
          label="BB תחתון"
          value={signal.bb_lower ? `$${signal.bb_lower}` : null}
          description="פס בולינגר תחתון | מתחת = הזדמנות"
          status="neutral"
        />
      </div>

      {/* RSI Chart */}
      <div className="card">
        <RSIChart data={history} />
      </div>

      {/* MACD Chart */}
      <div className="card">
        <MACDChart data={history} />
      </div>
    </div>
  );
}
