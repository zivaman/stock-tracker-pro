import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ExternalLink, Globe, TrendingUp, TrendingDown,
  Building2, DollarSign, BarChart3, AlertCircle, RefreshCw,
  PlusCircle
} from 'lucide-react';
import { getStockDetail, getStockNews } from '../api/client';
import StockChart from '../components/StockChart';
import TechnicalAnalysis from '../components/TechnicalAnalysis';
import type { StockDetail as StockDetailType } from '../types';

function formatMarketCap(mc: number | null): string {
  if (!mc) return 'N/A';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  return `$${mc}`;
}

function PerfBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return (
    <div className="text-center">
      <p className="text-[10px] text-[#64748b]">{label}</p>
      <p className="text-sm font-bold text-[#475569]">N/A</p>
    </div>
  );
  const isPos = value >= 0;
  return (
    <div className="text-center">
      <p className="text-[10px] text-[#64748b]">{label}</p>
      <p className={`text-sm font-bold num ${isPos ? 'text-[#00d09c]' : 'text-[#ff4757]'}`}>
        {isPos ? '+' : ''}{value.toFixed(2)}%
      </p>
    </div>
  );
}

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StockDetailType | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'analysis' | 'info'>('chart');

  const fetchData = async () => {
    if (!symbol) return;
    setLoading(true);
    setError('');
    try {
      const [detail, newsData] = await Promise.all([
        getStockDetail(symbol),
        getStockNews(symbol),
      ]);
      if (detail.error) {
        setError(detail.error);
      } else {
        setData(detail);
        setNews(newsData.news || []);
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת נתוני המניה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-2 border-[#00d09c] border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-white font-medium">טוען נתוני {symbol}...</p>
          <p className="text-[#94a3b8] text-sm mt-1">מחשב ניתוח טכני</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card text-center py-12">
        <AlertCircle size={40} className="mx-auto text-[#ff4757] mb-3" />
        <p className="text-white font-semibold">לא ניתן לטעון את {symbol}</p>
        <p className="text-[#94a3b8] text-sm mt-1">{error}</p>
        <div className="flex gap-3 justify-center mt-5">
          <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2">
            <ArrowRight size={15} />
            חזור
          </button>
          <button onClick={fetchData} className="btn-primary flex items-center gap-2">
            <RefreshCw size={15} />
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  const signalConfig: Record<string, { label: string; color: string }> = {
    strong_buy: { label: 'קנייה חזקה', color: '#00d09c' },
    buy: { label: 'קנייה', color: '#00d09c' },
    watch: { label: 'מעקב', color: '#ffd32a' },
    neutral: { label: 'ניטראלי', color: '#94a3b8' },
    sell: { label: 'מכירה / מכור', color: '#ff4757' },
  };
  const sig = signalConfig[data.signal.signal] || signalConfig.neutral;
  const isPriceUp = (data.performance['1d'] ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-white transition-colors"
      >
        <ArrowRight size={16} />
        חזור
      </button>

      {/* Stock Header */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl font-black text-white num">{data.symbol}</h1>
              <span
                className="px-3 py-1 rounded-full text-sm font-bold border"
                style={{ color: sig.color, borderColor: `${sig.color}40`, background: `${sig.color}15` }}
              >
                {sig.label}
              </span>
            </div>
            <p className="text-[#94a3b8]">{data.name}</p>
            {data.info.sector && data.info.sector !== 'N/A' && (
              <p className="text-xs text-[#64748b] mt-1">{data.info.sector} · {data.info.industry}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-4xl font-black num text-white">${data.current_price}</p>
            <div className="flex items-center justify-end gap-2 mt-1">
              {isPriceUp
                ? <TrendingUp size={16} className="text-[#00d09c]" />
                : <TrendingDown size={16} className="text-[#ff4757]" />
              }
              <span className={`text-lg font-bold num ${isPriceUp ? 'text-[#00d09c]' : 'text-[#ff4757]'}`}>
                {isPriceUp ? '+' : ''}{data.performance['1d']?.toFixed(2) ?? '0'}%
              </span>
              <span className="text-[#64748b] text-sm">היום</span>
            </div>
          </div>
        </div>

        {/* Performance Row */}
        <div className="mt-4 pt-4 border-t border-[#2d3748] grid grid-cols-3 sm:grid-cols-6 gap-3">
          <PerfBadge label="יום" value={data.performance['1d']} />
          <PerfBadge label="שבוע" value={data.performance['5d']} />
          <PerfBadge label="חודש" value={data.performance['1m']} />
          <PerfBadge label="3 חודשים" value={data.performance['3m']} />
          <PerfBadge label="חצי שנה" value={data.performance['6m']} />
          <PerfBadge label="שנה" value={data.performance['1y']} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'chart', label: 'גרף מחיר', icon: BarChart3 },
          { key: 'analysis', label: 'ניתוח טכני', icon: TrendingUp },
          { key: 'info', label: 'מידע חברה', icon: Building2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-[#00d09c] text-[#0a0e1a]'
                : 'bg-[#1a2235] text-[#94a3b8] hover:text-white border border-[#2d3748]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {activeTab === 'chart' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-4">
                גרף מחיר עם אינדיקטורים
              </h3>
              <StockChart
                data={data.price_history}
                currentPrice={data.current_price}
                supportResistance={data.support_resistance}
              />
            </div>
          )}

          {activeTab === 'analysis' && (
            <TechnicalAnalysis signal={data.signal} history={data.price_history} />
          )}

          {activeTab === 'info' && (
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">על החברה</h3>

              {data.info.description ? (
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  {data.info.description.slice(0, 800)}{data.info.description.length > 800 ? '...' : ''}
                </p>
              ) : (
                <p className="text-[#475569] text-sm">אין תיאור זמין</p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { label: 'שווי שוק', value: formatMarketCap(data.info.market_cap) },
                  { label: 'P/E Ratio', value: data.info.pe_ratio?.toFixed(2) ?? 'N/A' },
                  { label: 'תשואת דיבידנד', value: data.info.dividend_yield ? `${(data.info.dividend_yield * 100).toFixed(2)}%` : 'אין' },
                  { label: 'Beta', value: data.info.beta?.toFixed(2) ?? 'N/A' },
                  { label: '52W שיא', value: data.info['52w_high'] ? `$${data.info['52w_high']}` : 'N/A' },
                  { label: '52W שפל', value: data.info['52w_low'] ? `$${data.info['52w_low']}` : 'N/A' },
                  { label: 'ממוצע נפח', value: data.info.avg_volume ? `${(data.info.avg_volume / 1e6).toFixed(1)}M` : 'N/A' },
                  { label: 'מדינה', value: data.info.country || 'N/A' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#111827] rounded-lg p-3">
                    <p className="text-[10px] text-[#64748b] mb-0.5">{label}</p>
                    <p className="text-sm font-bold num text-white">{value}</p>
                  </div>
                ))}
              </div>

              {data.info.website && (
                <a
                  href={data.info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#3498db] hover:underline"
                >
                  <Globe size={14} />
                  {data.info.website}
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Signal */}
          <div className="card text-center">
            <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-2">המלצה</p>
            <div
              className="text-2xl font-black py-3 rounded-xl mb-2"
              style={{ color: sig.color, background: `${sig.color}15` }}
            >
              {sig.label}
            </div>
            <p className="text-xs text-[#64748b]">ציון: {data.signal.score}/100</p>
            <div className="mt-3 w-full bg-[#1e2d47] rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${data.signal.score}%`, background: sig.color }}
              />
            </div>
          </div>

          {/* Key levels */}
          {(data.support_resistance.support || data.support_resistance.resistance) && (
            <div className="card">
              <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">רמות מפתח</h4>
              {data.support_resistance.resistance && (
                <div className="flex justify-between items-center py-2 border-b border-[#2d3748]">
                  <span className="text-sm text-[#ff4757]">התנגדות</span>
                  <span className="num font-bold text-white">${data.support_resistance.resistance}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-[#2d3748]">
                <span className="text-sm text-white">מחיר נוכחי</span>
                <span className="num font-bold text-white">${data.current_price}</span>
              </div>
              {data.support_resistance.support && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-[#00d09c]">תמיכה</span>
                  <span className="num font-bold text-white">${data.support_resistance.support}</span>
                </div>
              )}
            </div>
          )}

          {/* News */}
          {news.length > 0 && (
            <div className="card">
              <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">חדשות אחרונות</h4>
              <div className="space-y-3">
                {news.slice(0, 5).map((item, i) => (
                  <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:bg-[#1e2d47] rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <p className="text-sm text-white leading-snug line-clamp-2">{item.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-[#64748b]">{item.publisher}</span>
                      <ExternalLink size={10} className="text-[#475569]" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Risk Disclaimer */}
          <div className="card border-[#ffd32a33] bg-[#ffd32a05]">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-[#ffd32a] mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-[#94a3b8] leading-relaxed">
                הניתוח הטכני מבוסס על נתוני עבר ואינו מבטיח תשואה עתידית. ייעוץ השקעות מקצועי מומלץ לפני כל החלטה.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
