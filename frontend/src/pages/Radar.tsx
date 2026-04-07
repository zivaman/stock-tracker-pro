import { useEffect, useState } from 'react';
import { RefreshCw, Radar as RadarIcon, Clock, AlertCircle } from 'lucide-react';
import { getRadar, refreshRadar } from '../api/client';
import RadarCard from '../components/RadarCard';
import type { RadarStock } from '../types';

interface RadarData {
  stocks: RadarStock[];
  cached: boolean;
  last_updated: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  strong_buy: 'קנייה חזקה',
  buy: 'קנייה',
  watch: 'מעקב',
  neutral: 'ניטראלי',
  sell: 'מכירה',
};

export default function Radar() {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = async () => {
    try {
      const result = await getRadar();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshRadar();
      setData(result);
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = data?.stocks.filter(s =>
    filter === 'all' ? true : s.signal === filter
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <RadarIcon size={28} className="text-[#00d09c]" />
            <h2 className="text-2xl font-bold text-white">מכ"ם מניות</h2>
            <span className="flex items-center gap-1 text-xs text-[#00d09c]">
              <span className="w-2 h-2 rounded-full bg-[#00d09c] live-dot" />
              חי
            </span>
          </div>
          <p className="text-[#94a3b8] text-sm mt-1">
            10 מניות מומלצות לפי ניתוח טכני מקצועי · סיכון בינוני
          </p>
          {data?.last_updated && (
            <p className="text-xs text-[#475569] mt-1 flex items-center gap-1">
              <Clock size={11} />
              עדכון אחרון: {new Date(data.last_updated).toLocaleString('he-IL')}
              {data.cached && <span className="text-[#64748b]"> (cache)</span>}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'סורק...' : 'רענן סריקה'}
        </button>
      </div>

      {/* Info Banner */}
      <div className="card border-[#3498db33] bg-[#3498db08] flex items-start gap-3">
        <AlertCircle size={18} className="text-[#3498db] mt-0.5 flex-shrink-0" />
        <div className="text-sm text-[#94a3b8]">
          <strong className="text-[#3498db]">קריטריוני הסריקה:</strong> RSI, MACD crossover, ממוצעים נעים (SMA20/50/200), Bollinger Bands, נפח מסחר.
          המלצות מותאמות ל<strong className="text-white">לקוח עם סיכון בינוני</strong> — חברות עם שווי שוק מעל מיליארד דולר ונזילות גבוהה.
          אינן מהוות ייעוץ השקעות.
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'הכל' },
          { key: 'strong_buy', label: 'קנייה חזקה' },
          { key: 'buy', label: 'קנייה' },
          { key: 'watch', label: 'מעקב' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-[#00d09c] text-[#0a0e1a]'
                : 'bg-[#1e2d47] text-[#94a3b8] hover:text-white'
            }`}
          >
            {label}
            {key !== 'all' && data && (
              <span className="mr-1.5 text-xs opacity-70">
                ({data.stocks.filter(s => s.signal === key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-12 h-12 border-2 border-[#00d09c] border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-white font-medium">סורק שוק...</p>
            <p className="text-[#94a3b8] text-sm mt-1">זה עשוי לקחת כדקה. סורקים {'>'}40 מניות</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <RadarIcon size={48} className="mx-auto text-[#2d3748] mb-4" />
          <p className="text-white font-semibold">אין מניות לפי הפילטר הנבחר</p>
          <p className="text-[#94a3b8] text-sm mt-2">נסה פילטר אחר או רענן את הסריקה</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((stock, i) => (
            <RadarCard key={stock.symbol} stock={stock} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[#94a3b8] mb-3">מדריך הציונים</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
          {[
            { label: 'קנייה חזקה', range: '65-100', color: '#00d09c' },
            { label: 'קנייה', range: '45-64', color: '#3498db' },
            { label: 'מעקב', range: '30-44', color: '#ffd32a' },
            { label: 'ניטראלי', range: '15-29', color: '#94a3b8' },
            { label: 'מכירה', range: '0-14', color: '#ff4757' },
          ].map(item => (
            <div key={item.label} className="bg-[#111827] rounded-lg p-2">
              <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: item.color }} />
              <p className="font-semibold" style={{ color: item.color }}>{item.label}</p>
              <p className="text-[#64748b] mt-0.5">{item.range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
