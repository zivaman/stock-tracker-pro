import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { getIntradayData } from '../api/client';
import type { PricePoint } from '../types';

interface FibData {
  swing_high: number;
  swing_low: number;
  levels: Record<string, number>;
}

interface DrawnLine {
  id: string;
  price: number;
  type: 'support' | 'resistance';
  label: string;
}

interface Props {
  symbol?: string;
  data: PricePoint[];
  fibonacci?: FibData;
  showFib?: boolean;
}

type DailyRange = '1m' | '3m' | '6m' | '1y';
type IntradayRange = '15m' | '30m' | '1h';
type Range = DailyRange | IntradayRange;

const DAILY_RANGES: { key: DailyRange; label: string; days: number }[] = [
  { key: '1m', label: '1M',   days: 21  },
  { key: '3m', label: '3M',   days: 63  },
  { key: '6m', label: '6M',   days: 126 },
  { key: '1y', label: '1Y',   days: 252 },
];
const INTRADAY_RANGES: { key: IntradayRange; label: string }[] = [
  { key: '15m', label: '15 דק' },
  { key: '30m', label: '30 דק' },
  { key: '1h',  label: 'שעה' },
];

const FIB_COLORS: Record<string, string> = {
  '0':    '#ef4444',
  '23.6': '#f97316',
  '38.2': '#eab308',
  '50':   '#22c55e',
  '61.8': '#3b82f6',
  '78.6': '#8b5cf6',
  '100':  '#ec4899',
};

export default function CandlestickChart({ symbol, data, fibonacci, showFib = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef        = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma150Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const drawnLineRefs = useRef<Map<string, any>>(new Map());

  const [range, setRange] = useState<Range>('3m');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA150, setShowSMA150] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showFibLines, setShowFibLines] = useState(showFib);
  const [drawMode, setDrawMode] = useState(false);
  const [drawType, setDrawType] = useState<'support' | 'resistance'>('support');
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [intradayData, setIntradayData] = useState<Record<string, PricePoint[]>>({});
  const [loadingIntraday, setLoadingIntraday] = useState(false);
  const [intradayError, setIntradayError] = useState('');
  const drawModeRef = useRef(false);
  const drawTypeRef = useRef<'support' | 'resistance'>('support');
  const lastClickPriceRef = useRef<number | null>(null);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { drawTypeRef.current = drawType; }, [drawType]);

  const isIntraday = (r: Range): r is IntradayRange => ['15m', '30m', '1h'].includes(r);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af', fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1e2a3a' },
        horzLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1e2a3a' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', textColor: '#9ca3af' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, rightOffset: 6 },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00c896', downColor: '#f04060',
      borderUpColor: '#00c896', borderDownColor: '#f04060',
      wickUpColor: '#00c896', wickDownColor: '#f04060',
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(100,150,255,0.25)', priceFormat: { type: 'volume' }, priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const sma20s  = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, title: 'SMA20',  priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma50s  = chart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1, title: 'SMA50',  priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma150s = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, title: 'SMA150', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma200s = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, title: 'SMA200', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volRef.current = volSeries;
    sma20Ref.current  = sma20s;
    sma50Ref.current  = sma50s;
    sma150Ref.current = sma150s;
    sma200Ref.current = sma200s;

    // Click handler for drawing
    chart.subscribeClick((param) => {
      if (!drawModeRef.current || !param.point || !candleRef.current) return;
      const price = candleRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;

      const id = `line-${Date.now()}`;
      const type = drawTypeRef.current;
      const lineColor = type === 'support' ? '#00c896' : '#f04060';
      const priceLine = (candleRef.current as any).createPriceLine({
        price: Number(price.toFixed(2)),
        color: lineColor,
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: type === 'support' ? `תמיכה $${price.toFixed(2)}` : `התנגדות $${price.toFixed(2)}`,
      });
      drawnLineRefs.current.set(id, priceLine);
      setDrawnLines(prev => [...prev, { id, price: Number(price.toFixed(2)), type, label: type === 'support' ? 'תמיכה' : 'התנגדות' }]);
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Load data
  const getActiveData = useCallback((): PricePoint[] => {
    if (isIntraday(range)) return intradayData[range] ?? [];
    const r = DAILY_RANGES.find(d => d.key === range)!;
    return data.slice(-r.days);
  }, [range, data, intradayData]);

  // Fetch intraday
  const fetchIntraday = useCallback(async (iv: IntradayRange) => {
    if (!symbol || intradayData[iv]) return;
    setLoadingIntraday(true);
    setIntradayError('');
    try {
      const res = await getIntradayData(symbol, iv);
      setIntradayData(prev => ({ ...prev, [iv]: res.data }));
    } catch (e: any) {
      setIntradayError(e.response?.data?.detail || 'שגיאה בטעינת נתוני intraday');
    } finally {
      setLoadingIntraday(false);
    }
  }, [symbol, intradayData]);

  const handleRangeChange = (r: Range) => {
    setRange(r);
    if (isIntraday(r)) fetchIntraday(r as IntradayRange);
  };

  // Update chart data
  useEffect(() => {
    if (!candleRef.current || !volRef.current) return;
    const slice = getActiveData();
    if (!slice.length) return;

    const candles: CandlestickData[] = slice
      .filter(d => d.open != null && d.high != null && d.low != null && d.close != null)
      .map(d => ({ time: d.date as any, open: d.open, high: d.high, low: d.low, close: d.close }));
    const vols: HistogramData[] = slice.map(d => ({
      time: d.date as any, value: d.volume,
      color: d.close >= d.open ? 'rgba(0,200,150,0.3)' : 'rgba(240,64,96,0.3)',
    }));
    const sma20d:  LineData[] = slice.filter(d => d.sma20  != null).map(d => ({ time: d.date as any, value: d.sma20! }));
    const sma50d:  LineData[] = slice.filter(d => d.sma50  != null).map(d => ({ time: d.date as any, value: d.sma50! }));
    const sma150d: LineData[] = slice.filter(d => d.sma150 != null).map(d => ({ time: d.date as any, value: d.sma150! }));
    const sma200d: LineData[] = slice.filter(d => d.sma200 != null).map(d => ({ time: d.date as any, value: d.sma200! }));

    candleRef.current.setData(candles);
    volRef.current.setData(vols);
    sma20Ref.current?.setData(sma20d);
    sma50Ref.current?.setData(sma50d);
    sma150Ref.current?.setData(sma150d);
    sma200Ref.current?.setData(sma200d);
    chartRef.current?.timeScale().fitContent();
  }, [range, data, intradayData, getActiveData]);

  useEffect(() => { sma20Ref.current?.applyOptions({ visible: showSMA20 }); }, [showSMA20]);
  useEffect(() => { sma50Ref.current?.applyOptions({ visible: showSMA50 }); }, [showSMA50]);
  useEffect(() => { sma150Ref.current?.applyOptions({ visible: showSMA150 }); }, [showSMA150]);
  useEffect(() => { sma200Ref.current?.applyOptions({ visible: showSMA200 }); }, [showSMA200]);

  // Fibonacci lines
  useEffect(() => {
    if (!candleRef.current || !fibonacci?.levels) return;
    const series = candleRef.current as any;
    const prevLines: any[] = (containerRef.current as any).__fibLines || [];
    prevLines.forEach((l: any) => { try { series.removePriceLine(l); } catch {} });
    (containerRef.current as any).__fibLines = [];
    if (!showFibLines) return;
    const newLines = Object.entries(fibonacci.levels).map(([key, price]) =>
      series.createPriceLine({ price, color: FIB_COLORS[key] || '#fff', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Fib ${key}%` })
    );
    (containerRef.current as any).__fibLines = newLines;
  }, [fibonacci, showFibLines, range]);

  const removeLine = (id: string) => {
    const ref = drawnLineRefs.current.get(id);
    if (ref && candleRef.current) {
      try { (candleRef.current as any).removePriceLine(ref); } catch {}
      drawnLineRefs.current.delete(id);
    }
    setDrawnLines(prev => prev.filter(l => l.id !== id));
  };

  const clearLines = () => {
    drawnLines.forEach(l => {
      const ref = drawnLineRefs.current.get(l.id);
      if (ref && candleRef.current) { try { (candleRef.current as any).removePriceLine(ref); } catch {} }
    });
    drawnLineRefs.current.clear();
    setDrawnLines([]);
  };

  const btn = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 6, fontSize: '.72rem', fontWeight: 600,
    border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`,
    background: active ? `${color || 'var(--blue)'}22` : 'transparent',
    color: active ? (color || 'var(--blue)') : 'var(--muted)',
    cursor: 'pointer', transition: 'all .12s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ── Controls row 1: Range ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Intraday */}
          <div style={{ display: 'flex', gap: 3, marginLeft: 6, paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
            {INTRADAY_RANGES.map(r => (
              <button key={r.key} style={btn(range === r.key, '#f59e0b')} onClick={() => handleRangeChange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          {/* Daily */}
          {DAILY_RANGES.map(r => (
            <button key={r.key} style={btn(range === r.key)} onClick={() => handleRangeChange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button style={btn(showSMA20, '#60a5fa')}  onClick={() => setShowSMA20(s => !s)}>SMA20</button>
          <button style={btn(showSMA50, '#f97316')}  onClick={() => setShowSMA50(s => !s)}>SMA50</button>
          <button style={btn(showSMA150, '#10b981')} onClick={() => setShowSMA150(s => !s)}>SMA150</button>
          <button style={btn(showSMA200, '#a855f7')} onClick={() => setShowSMA200(s => !s)}>SMA200</button>
          {fibonacci?.levels && (
            <button style={btn(showFibLines, '#eab308')} onClick={() => setShowFibLines(s => !s)}>פיב׳</button>
          )}
        </div>
      </div>

      {/* ── Controls row 2: Drawing tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.68rem', color: 'var(--muted)', fontWeight: 700 }}>ציור:</span>
        <button
          style={btn(drawMode && drawType === 'support', '#00c896')}
          onClick={() => { setDrawMode(true); setDrawType('support'); }}
        >✏ תמיכה</button>
        <button
          style={btn(drawMode && drawType === 'resistance', '#f04060')}
          onClick={() => { setDrawMode(true); setDrawType('resistance'); }}
        >✏ התנגדות</button>
        {drawMode && (
          <button style={btn(false)} onClick={() => setDrawMode(false)}>✕ בטל</button>
        )}
        {drawnLines.length > 0 && (
          <button style={{ ...btn(false), color: 'var(--red)' }} onClick={clearLines}>נקה קווים</button>
        )}
        {drawMode && (
          <span style={{ fontSize: '.68rem', color: drawType === 'support' ? 'var(--green)' : 'var(--red)', marginRight: 4 }}>
            לחץ על הגרף לסימון {drawType === 'support' ? 'תמיכה' : 'התנגדות'}
          </span>
        )}
      </div>

      {/* ── Chart ── */}
      {loadingIntraday && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text2)', fontSize: '.8rem' }}>
          טוען נתוני intraday...
        </div>
      )}
      {intradayError && (
        <div style={{ fontSize: '.75rem', color: 'var(--red)', padding: '0.5rem', background: 'rgba(240,64,96,.08)', borderRadius: 6 }}>{intradayError}</div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: 400, cursor: drawMode ? 'crosshair' : 'default' }}
      />

      {/* ── Drawn lines list ── */}
      {drawnLines.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {drawnLines.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--card2)', border: `1px solid ${l.type === 'support' ? 'rgba(0,200,150,.3)' : 'rgba(240,64,96,.3)'}`,
              borderRadius: 6, padding: '2px 8px',
            }}>
              <span style={{ fontSize: '.68rem', color: l.type === 'support' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{l.label}</span>
              <span className="num" style={{ fontSize: '.68rem', color: 'var(--text2)' }}>${l.price}</span>
              <button onClick={() => removeLine(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '.7rem', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Fib legend ── */}
      {fibonacci?.levels && showFibLines && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(fibonacci.levels).map(([key, price]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 2, background: FIB_COLORS[key], borderRadius: 1 }} />
              <span style={{ fontSize: '.63rem', color: 'var(--text2)' }}>{key}% <span className="num" style={{ color: FIB_COLORS[key] }}>${price}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
