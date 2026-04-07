import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Trash2, ChevronLeft } from 'lucide-react';
import type { PortfolioPosition } from '../types';

interface Props {
  position: PortfolioPosition;
  onRemove: (symbol: string) => void;
}

type Period = 'since_buy' | '1d' | '1w' | '1m' | '3m' | '6m' | '1y';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'since_buy', label: 'מהכניסה' },
  { key: '1d', label: 'יום' },
  { key: '1w', label: 'שבוע' },
  { key: '1m', label: 'חודש' },
  { key: '3m', label: '3 חודשים' },
  { key: '6m', label: '6 חודשים' },
  { key: '1y', label: 'שנה' },
];

function PeriodBadge({ label, value }: { label: string; value: number | undefined }) {
  if (value == null) return null;
  const isPos = value >= 0;
  return (
    <div className="text-center">
      <p className="text-[9px] text-[#64748b] mb-0.5">{label}</p>
      <p className={`text-xs font-bold num ${isPos ? 'text-[#00d09c]' : 'text-[#ff4757]'}`}>
        {isPos ? '+' : ''}{value.toFixed(2)}%
      </p>
    </div>
  );
}

export default function PortfolioCard({ position, onRemove }: Props) {
  const navigate = useNavigate();
  const isPnlPos = position.pnl >= 0;

  return (
    <div className="card group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate(`/stock/${position.symbol}`)}
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-xl">{position.symbol}</h3>
              {isPnlPos
                ? <TrendingUp size={16} className="text-[#00d09c]" />
                : <TrendingDown size={16} className="text-[#ff4757]" />
              }
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5">{position.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/stock/${position.symbol}`)}
            className="text-[#64748b] hover:text-white transition-colors"
            title="ניתוח טכני"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => {
              if (confirm(`האם למחוק את ${position.symbol} מהתיק?`)) {
                onRemove(position.symbol);
              }
            }}
            className="text-[#475569] hover:text-[#ff4757] transition-colors"
            title="הסר מהתיק"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* P&L */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#111827] rounded-xl p-3">
          <p className="text-xs text-[#64748b] mb-1">מחיר נוכחי</p>
          <p className="text-xl font-bold num text-white">${position.current_price}</p>
          <p className="text-xs text-[#64748b] mt-1">כניסה: ${position.buy_price}</p>
        </div>
        <div className={`rounded-xl p-3 ${isPnlPos ? 'bg-[#00d09c0d]' : 'bg-[#ff47570d]'}`}>
          <p className="text-xs text-[#64748b] mb-1">רווח / הפסד</p>
          <p className={`text-xl font-bold num ${isPnlPos ? 'text-[#00d09c]' : 'text-[#ff4757]'}`}>
            {isPnlPos ? '+' : ''}${position.pnl.toFixed(2)}
          </p>
          <p className={`text-xs font-medium num mt-1 ${isPnlPos ? 'text-[#00d09c]' : 'text-[#ff4757]'}`}>
            {isPnlPos ? '+' : ''}{position.pnl_pct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Portfolio Details */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div>
          <p className="text-[10px] text-[#64748b]">כמות</p>
          <p className="text-sm font-medium num text-white">{position.quantity}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#64748b]">השקעה</p>
          <p className="text-sm font-medium num text-white">${position.invested.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#64748b]">שווי נוכחי</p>
          <p className="text-sm font-medium num text-white">${position.current_value.toFixed(0)}</p>
        </div>
      </div>

      {/* Performance by period */}
      <div className="border-t border-[#2d3748] pt-3">
        <p className="text-[10px] text-[#64748b] mb-2 uppercase tracking-wider">ביצועים לפי תקופה</p>
        <div className="grid grid-cols-7 gap-1">
          {PERIODS.map(({ key, label }) => (
            <PeriodBadge
              key={key}
              label={label}
              value={position.performance[key]}
            />
          ))}
        </div>
      </div>

      {/* Buy date */}
      <p className="text-[10px] text-[#475569] mt-2">
        תאריך כניסה: {new Date(position.buy_date).toLocaleDateString('he-IL')}
      </p>
    </div>
  );
}
