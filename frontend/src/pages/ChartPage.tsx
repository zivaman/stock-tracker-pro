import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStockDetail, getChartPatterns } from '../api/client';
import CandlestickChart from '../components/CandlestickChart';
import type { StockDetail } from '../types';

export default function ChartPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [data, setData] = useState<StockDetail | null>(null);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    getStockDetail(symbol)
      .then(d => {
        setData(d);
        // also fetch patterns non-blocking
        getChartPatterns(symbol, '6m')
          .then(p => setPatterns(p.patterns || []))
          .catch(() => {});
      })
      .catch(e => setError(e.response?.data?.detail || 'שגיאה בטעינת נתונים'))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text)', fontSize: '1rem',
    }}>
      טוען נתונים עבור {symbol}...
    </div>
  );

  if (error || !data) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--red)', fontSize: '1rem',
    }}>
      {error || 'לא נמצאו נתונים'}
    </div>
  );

  const change = data.current_price - (data.price_history?.[data.price_history.length - 2]?.close ?? data.current_price);
  const changePct = data.price_history?.length > 1
    ? ((data.current_price / (data.price_history[data.price_history.length - 2]?.close ?? data.current_price)) - 1) * 100
    : 0;
  const isUp = changePct >= 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)' }}>{data.symbol}</span>
          <span style={{ fontSize: '.85rem', color: 'var(--text2)' }}>{data.name}</span>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
            ${data.current_price?.toFixed(2)}
          </span>
          <span style={{
            fontSize: '.8rem', fontWeight: 700,
            color: isUp ? 'var(--green)' : 'var(--red)',
            background: isUp ? 'rgba(0,200,150,.1)' : 'rgba(240,64,96,.1)',
            borderRadius: 6, padding: '2px 8px',
          }}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <button
          onClick={() => window.close()}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 16px', cursor: 'pointer',
            color: 'var(--text)', fontSize: '.8rem', fontWeight: 600,
          }}
        >
          ✕ סגור
        </button>
      </div>

      {/* Chart — takes remaining space */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '0.85rem 1.1rem',
        flex: 1,
      }}>
        <CandlestickChart
          symbol={data.symbol}
          data={data.price_history}
          fibonacci={data.fibonacci}
          showFib={true}
          supportResistance={data.support_resistance}
          patterns={patterns}
        />
      </div>
    </div>
  );
}
