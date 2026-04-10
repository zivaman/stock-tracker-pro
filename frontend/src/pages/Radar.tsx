import { useEffect, useState } from 'react';
import { RefreshCw, Radar as RadarIcon, Clock, AlertCircle, WifiOff } from 'lucide-react';
import { getRadar, refreshRadar } from '../api/client';
import RadarCard from '../components/RadarCard';
import type { RadarStock } from '../types';

const CACHE_KEY = 'cache_radar';

interface RadarData {
  stocks: RadarStock[];
  cached: boolean;
  last_updated: string;
}

function loadCache(): RadarData | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function saveCache(data: RadarData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

export default function Radar() {
  const [data, setData] = useState<RadarData | null>(() => loadCache());
  const [loading, setLoading] = useState(!loadCache());
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = async () => {
    try {
      const result = await getRadar();
      setData(result);
      saveCache(result);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshRadar();
      setData(result);
      saveCache(result);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally { setRefreshing(false); }
  };

  const filtered = (data?.stocks ?? []).filter(s =>
    filter === 'all' ? true : s.signal === filter
  );

  const counts = (data?.stocks ?? []).reduce((acc, s) => {
    acc[s.signal] = (acc[s.signal] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RadarIcon size={26} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>המלצות מניות</h2>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem', color: 'var(--green)' }}>
              <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} /> חי
            </span>
          </div>
          <p style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: 3 }}>
            מניות מומלצות לפי ניתוח טכני מקצועי · סיכון בינוני
          </p>
          {data?.last_updated && (
            <p style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              עדכון: {new Date(data.last_updated).toLocaleString('he-IL')}
              {data.cached && <span>(cache)</span>}
            </p>
          )}
        </div>
        <button onClick={handleRefresh} disabled={refreshing || loading} className="btn-primary flex items-center gap-2">
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'סורק...' : 'רענן סריקה'}
        </button>
      </div>

      {/* Offline banner */}
      {offline && (
        <div style={{ background: 'rgba(245,197,24,.08)', border: '1px solid rgba(245,197,24,.3)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={15} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <p style={{ fontSize: '.82rem', color: 'var(--yellow)' }}>
            אין חיבור לשוק — מציג נתוני cache אחרונים. הנתונים עשויים להיות לא עדכניים.
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="card" style={{ borderColor: 'rgba(59,130,246,.3)', background: 'rgba(59,130,246,.05)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertCircle size={16} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: '.82rem', color: 'var(--text2)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--blue)' }}>קריטריוני הסריקה:</strong> RSI, MACD crossover, ממוצעים נעים (SMA20/50/200), Bollinger Bands, נפח מסחר.
          המלצות מותאמות ל<strong style={{ color: 'var(--text)' }}>לקוח עם סיכון בינוני</strong> — שווי שוק מעל מיליארד ונזילות גבוהה.
          אינן מהוות ייעוץ השקעות.
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'הכל' },
          { key: 'strong_buy', label: 'קנייה חזקה' },
          { key: 'buy', label: 'קנייה' },
          { key: 'watch', label: 'מעקב' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '0.35rem 1rem', borderRadius: 999, fontSize: '.78rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all .15s', border: '1px solid',
            background: filter === key ? 'var(--green)' : 'var(--card2)',
            color: filter === key ? '#fff' : 'var(--text2)',
            borderColor: filter === key ? 'var(--green)' : 'var(--border)',
          }}>
            {label}
            {key !== 'all' && data && counts[key] ? (
              <span style={{ marginRight: 5, fontSize: '.68rem', opacity: .75 }}>({counts[key]})</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 16 }}>
          <div className="spin" style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--green)', borderTopColor: 'transparent' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>סורק שוק...</p>
            <p style={{ color: 'var(--text2)', fontSize: '.82rem', marginTop: 4 }}>זה עשוי לקחת כדקה</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <RadarIcon size={44} style={{ margin: '0 auto 1rem', color: 'var(--border2)' }} />
          <p style={{ color: 'var(--text)', fontWeight: 600 }}>אין מניות לפי הפילטר הנבחר</p>
          <p style={{ color: 'var(--text2)', fontSize: '.82rem', marginTop: 6 }}>נסה פילטר אחר או רענן</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {filtered.map((stock, i) => (
            <RadarCard key={stock.symbol} stock={stock} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Score legend */}
      <div className="card">
        <h3 style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>מדריך הציונים</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, textAlign: 'center' }}>
          {[
            { label: 'קנייה חזקה', range: '65-100', color: 'var(--green)' },
            { label: 'קנייה',       range: '45-64',  color: 'var(--blue)' },
            { label: 'מעקב',        range: '30-44',  color: 'var(--yellow)' },
            { label: 'ניטראלי',     range: '15-29',  color: 'var(--text2)' },
            { label: 'מכירה',       range: '0-14',   color: 'var(--red)' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '0.6rem 0.4rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, margin: '0 auto 5px' }} />
              <p style={{ fontWeight: 700, color: item.color, fontSize: '.75rem' }}>{item.label}</p>
              <p style={{ color: 'var(--muted)', fontSize: '.65rem', marginTop: 2 }}>{item.range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
