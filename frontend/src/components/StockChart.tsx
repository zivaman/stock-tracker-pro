import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { PricePoint } from '../types';
import { useState } from 'react';

interface Props {
  data: PricePoint[];
  currentPrice: number;
  supportResistance?: { support: number | null; resistance: number | null };
}

type Range = '1m' | '3m' | '6m' | '1y';

const RANGE_DAYS: Record<Range, number> = { '1m': 21, '3m': 63, '6m': 126, '1y': 252 };
const RANGE_LABELS: Record<Range, string> = { '1m': 'חודש', '3m': '3 חודשים', '6m': 'חצי שנה', '1y': 'שנה' };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as PricePoint;
  if (!d) return null;
  return (
    <div className="card text-xs space-y-1 min-w-[160px]" style={{ padding: '10px 14px' }}>
      <p className="text-[#94a3b8] mb-2">{label}</p>
      <p className="text-white font-bold">סגירה: <span className="num">${d.close}</span></p>
      <p className="text-[#64748b]">פתיחה: <span className="num">${d.open}</span></p>
      <p className="text-[#00d09c]">גבוה: <span className="num">${d.high}</span></p>
      <p className="text-[#ff4757]">נמוך: <span className="num">${d.low}</span></p>
      {d.sma50 && <p className="text-[#3498db]">SMA50: <span className="num">${d.sma50}</span></p>}
      {d.sma200 && <p className="text-[#ffd32a]">SMA200: <span className="num">${d.sma200}</span></p>}
    </div>
  );
};

export default function StockChart({ data, currentPrice, supportResistance }: Props) {
  const [range, setRange] = useState<Range>('6m');
  const [showBB, setShowBB] = useState(true);
  const [showSMA, setShowSMA] = useState(true);

  const sliced = data.slice(-RANGE_DAYS[range]);

  const minClose = Math.min(...sliced.map(d => d.low));
  const maxClose = Math.max(...sliced.map(d => d.high));
  const padding = (maxClose - minClose) * 0.05;
  const yDomain = [Math.floor(minClose - padding), Math.ceil(maxClose + padding)];

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {(Object.keys(RANGE_DAYS) as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-[#00d09c] text-[#0a0e1a]'
                  : 'bg-[#1e2d47] text-[#94a3b8] hover:text-white'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs text-[#94a3b8]">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showSMA} onChange={e => setShowSMA(e.target.checked)} className="accent-[#3498db]" />
            ממוצעים
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showBB} onChange={e => setShowBB(e.target.checked)} className="accent-[#64748b]" />
            Bollinger
          </label>
        </div>
      </div>

      {/* Price Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sliced} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={v => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={v => `$${v}`}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Bollinger Bands */}
            {showBB && (
              <>
                <Area
                  dataKey="bb_upper"
                  stroke="transparent"
                  fill="#3498db"
                  fillOpacity={0.05}
                  connectNulls
                  name="BB Upper"
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bb_upper"
                  stroke="#3498db"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                  name="BB עליון"
                />
                <Line
                  type="monotone"
                  dataKey="bb_lower"
                  stroke="#3498db"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                  name="BB תחתון"
                />
              </>
            )}

            {/* SMA Lines */}
            {showSMA && (
              <>
                <Line
                  type="monotone"
                  dataKey="sma20"
                  stroke="#00d09c"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="SMA 20"
                />
                <Line
                  type="monotone"
                  dataKey="sma50"
                  stroke="#3498db"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="SMA 50"
                />
                <Line
                  type="monotone"
                  dataKey="sma200"
                  stroke="#ffd32a"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="SMA 200"
                />
              </>
            )}

            {/* Price */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#e2e8f0"
              strokeWidth={2}
              dot={false}
              name="מחיר"
            />

            {/* Support/Resistance */}
            {supportResistance?.resistance && (
              <ReferenceLine y={supportResistance.resistance} stroke="#ff4757" strokeDasharray="6 3" label={{ value: 'התנגדות', fill: '#ff4757', fontSize: 10, position: 'insideTopLeft' }} />
            )}
            {supportResistance?.support && (
              <ReferenceLine y={supportResistance.support} stroke="#00d09c" strokeDasharray="6 3" label={{ value: 'תמיכה', fill: '#00d09c', fontSize: 10, position: 'insideBottomLeft' }} />
            )}

            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 4 }}
              iconType="line"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sliced} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Bar
              dataKey="volume"
              fill="#3498db"
              fillOpacity={0.4}
              name="נפח"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
