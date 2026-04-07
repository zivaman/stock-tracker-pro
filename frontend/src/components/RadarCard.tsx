import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, ChevronLeft } from 'lucide-react';
import type { RadarStock } from '../types';

interface Props {
  stock: RadarStock;
  rank: number;
}

const signalConfig = {
  strong_buy: { label: 'קנייה חזקה', cls: 'bg-[#00d09c] text-[#0a0e1a]' },
  buy: { label: 'קנייה', cls: 'tag-buy' },
  watch: { label: 'מעקב', cls: 'tag-watch' },
  neutral: { label: 'ניטראלי', cls: 'tag-neutral' },
  sell: { label: 'מכירה', cls: 'tag-sell' },
};

function formatMarketCap(mc: number | null): string {
  if (!mc) return 'N/A';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc}`;
}

export default function RadarCard({ stock, rank }: Props) {
  const navigate = useNavigate();
  const cfg = signalConfig[stock.signal] || signalConfig.neutral;
  const isPositiveDay = (stock.day_change ?? 0) >= 0;

  return (
    <div
      className="card hover:border-[#3d4f6a] transition-all cursor-pointer group"
      onClick={() => navigate(`/stock/${stock.symbol}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[#1e2d47] flex items-center justify-center text-sm font-bold text-[#94a3b8]">
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">{stock.symbol}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.cls}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5 truncate max-w-[200px]">{stock.name}</p>
          </div>
        </div>
        <ChevronLeft size={16} className="text-[#475569] group-hover:text-[#94a3b8] transition-colors" />
      </div>

      {/* Price & Change */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-2xl font-bold num text-white">${stock.current_price}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`flex items-center gap-1 text-sm font-medium num ${isPositiveDay ? 'positive' : 'negative'}`}>
              {isPositiveDay ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isPositiveDay ? '+' : ''}{stock.day_change?.toFixed(2) ?? '0.00'}%
            </span>
            <span className="text-xs text-[#475569]">יום</span>
          </div>
        </div>

        {/* Score Bar */}
        <div className="text-right">
          <p className="text-xs text-[#64748b] mb-1">ציון טכני</p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-[#1e2d47] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stock.score}%`,
                  background: stock.score >= 65 ? '#00d09c' : stock.score >= 45 ? '#3498db' : stock.score >= 30 ? '#ffd32a' : '#ff4757',
                }}
              />
            </div>
            <span className="text-sm font-bold num text-white">{stock.score}</span>
          </div>
        </div>
      </div>

      {/* Indicators Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#111827] rounded-lg px-2 py-1.5 text-center">
          <p className="text-[10px] text-[#64748b]">RSI</p>
          <p className={`text-sm font-bold num ${
            stock.rsi && stock.rsi < 35 ? 'text-[#00d09c]' : stock.rsi && stock.rsi > 70 ? 'text-[#ff4757]' : 'text-white'
          }`}>{stock.rsi?.toFixed(1) ?? 'N/A'}</p>
        </div>
        <div className="bg-[#111827] rounded-lg px-2 py-1.5 text-center">
          <p className="text-[10px] text-[#64748b]">MACD</p>
          <p className={`text-sm font-bold num ${
            stock.macd && stock.macd_signal && stock.macd > stock.macd_signal ? 'text-[#00d09c]' : 'text-[#ff4757]'
          }`}>
            {stock.macd && stock.macd_signal
              ? stock.macd > stock.macd_signal ? '▲ חיובי' : '▼ שלילי'
              : 'N/A'}
          </p>
        </div>
        <div className="bg-[#111827] rounded-lg px-2 py-1.5 text-center">
          <p className="text-[10px] text-[#64748b]">Cap</p>
          <p className="text-sm font-bold num text-white">{formatMarketCap(stock.market_cap)}</p>
        </div>
      </div>

      {/* Hot signal banner */}
      {stock.hot_signal && (
        <div className="rounded-lg px-3 py-2 mb-2 flex items-center gap-2 text-xs font-semibold" style={{ background: '#ffd32a15', border: '1px solid #ffd32a40', color: '#ffd32a' }}>
          <span className="text-base">🔥</span>
          <span>{stock.hot_signal}</span>
        </div>
      )}

      {/* Top reason */}
      {stock.reasons.length > 0 && (
        <p className="text-xs text-[#00d09c] flex items-start gap-1">
          <span>✓</span> {stock.reasons[0]}
        </p>
      )}
      {stock.reasons.length === 0 && stock.warnings.length > 0 && (
        <p className="text-xs text-[#ff4757] flex items-start gap-1">
          <span>⚠</span> {stock.warnings[0]}
        </p>
      )}

      {/* Sector */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e2d47] text-[#64748b]">
          {stock.sector !== 'N/A' ? stock.sector : 'General'}
        </span>
        {stock.beta && (
          <span className="text-[10px] text-[#64748b]">β {stock.beta}</span>
        )}
      </div>
    </div>
  );
}
