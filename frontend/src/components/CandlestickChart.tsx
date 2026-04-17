import { useEffect, useRef, useState } from 'react';
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
import type { PricePoint } from '../types';

interface FibLevel {
  level: string;   // "0", "23.6", "38.2", ...
  price: number;
}
interface FibData {
  swing_high: number;
  swing_low: number;
  levels: Record<string, number>;
}

interface Props {
  data: PricePoint[];
  fibonacci?: FibData;
  showFib?: boolean;
}

type Range = '1m' | '3m' | '6m' | '1y';

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: '1m', label: '1 חודש',   days: 21  },
  { key: '3m', label: '3 חודשים', days: 63  },
  { key: '6m', label: '6 חודשים', days: 126 },
  { key: '1y', label: 'שנה',      days: 252 },
];

const FIB_COLORS: Record<string, string> = {
  '0':    '#ef4444',  // red   — top (swing high)
  '23.6': '#f97316',  // orange
  '38.2': '#eab308',  // yellow — key support/resistance
  '50':   '#22c55e',  // green  — 50% midpoint
  '61.8': '#3b82f6',  // blue   — golden ratio (strongest)
  '78.6': '#8b5cf6',  // purple
  '100':  '#ec4899',  // pink   — swing low
};

export default function CandlestickChart({ data, fibonacci, showFib = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef        = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);

  const [range, setRange]       = useState<Range>('3m');
  const [showSMA20, setShowSMA20]   = useState(true);
  const [showSMA50, setShowSMA50]   = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showFibLines, setShowFibLines] = useState(showFib);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
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
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        textColor: '#9ca3af',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        rightOffset: 6,
      },
      handleScroll: true,
      handleScale: true,
    });

    // Candlestick
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:          '#00c896',
      downColor:        '#f04060',
      borderUpColor:    '#00c896',
      borderDownColor:  '#f04060',
      wickUpColor:      '#00c896',
      wickDownColor:    '#f04060',
    });

    // Volume histogram (scaled to 20% of chart height)
    const volSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(100,150,255,0.25)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // MA lines
    const sma20Series = chart.addSeries(LineSeries, {
      color: '#60a5fa', lineWidth: 1, title: 'SMA20',
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const sma50Series = chart.addSeries(LineSeries, {
      color: '#f97316', lineWidth: 1, title: 'SMA50',
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const sma200Series = chart.addSeries(LineSeries, {
      color: '#a855f7', lineWidth: 1, title: 'SMA200',
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current  = chart;
    candleRef.current = candleSeries;
    volRef.current    = volSeries;
    sma20Ref.current  = sma20Series;
    sma50Ref.current  = sma50Series;
    sma200Ref.current = sma200Series;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // Update data when range/data changes
  useEffect(() => {
    if (!candleRef.current || !volRef.current) return;
    const rangeObj = RANGES.find(r => r.key === range)!;
    const slice = data.slice(-rangeObj.days);

    const candles: CandlestickData[] = slice.map(d => ({
      time: d.date as any,
      open: d.open, high: d.high, low: d.low, close: d.close,
    }));
    const vols: HistogramData[] = slice.map(d => ({
      time: d.date as any,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(0,200,150,0.3)' : 'rgba(240,64,96,0.3)',
    }));
    const sma20d: LineData[] = slice.filter(d => d.sma20 != null).map(d => ({ time: d.date as any, value: d.sma20! }));
    const sma50d: LineData[] = slice.filter(d => d.sma50 != null).map(d => ({ time: d.date as any, value: d.sma50! }));
    const sma200d: LineData[] = slice.filter(d => d.sma200 != null).map(d => ({ time: d.date as any, value: d.sma200! }));

    candleRef.current.setData(candles);
    volRef.current.setData(vols);
    sma20Ref.current?.setData(sma20d);
    sma50Ref.current?.setData(sma50d);
    sma200Ref.current?.setData(sma200d);

    chartRef.current?.timeScale().fitContent();
  }, [data, range]);

  // Toggle MA visibility
  useEffect(() => { sma20Ref.current?.applyOptions({ visible: showSMA20 }); }, [showSMA20]);
  useEffect(() => { sma50Ref.current?.applyOptions({ visible: showSMA50 }); }, [showSMA50]);
  useEffect(() => { sma200Ref.current?.applyOptions({ visible: showSMA200 }); }, [showSMA200]);

  // Fibonacci price lines
  useEffect(() => {
    if (!candleRef.current || !fibonacci?.levels) return;
    // Remove all existing price lines by recreating them
    // lightweight-charts v5 uses createPriceLine on a series
    const series = candleRef.current as any;
    // Clear old fib lines stored on the element
    const prevLines: any[] = (containerRef.current as any).__fibLines || [];
    prevLines.forEach((l: any) => { try { series.removePriceLine(l); } catch {} });
    (containerRef.current as any).__fibLines = [];

    if (!showFibLines) return;

    const newLines: any[] = [];
    Object.entries(fibonacci.levels).forEach(([key, price]) => {
      const line = series.createPriceLine({
        price,
        color: FIB_COLORS[key] || '#ffffff',
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: `Fib ${key}%`,
      });
      newLines.push(line);
    });
    (containerRef.current as any).__fibLines = newLines;
  }, [fibonacci, showFibLines, range]);

  const btnStyle = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 6, fontSize: '.72rem', fontWeight: 600,
    border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`,
    background: active ? `${color || 'var(--blue)'}22` : 'transparent',
    color: active ? (color || 'var(--blue)') : 'var(--muted)',
    cursor: 'pointer', transition: 'all .12s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {/* Range */}
        <div style={{ display: 'flex', gap: 5 }}>
          {RANGES.map(r => (
            <button key={r.key} style={btnStyle(range === r.key)} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        {/* Toggles */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button style={btnStyle(showSMA20, '#60a5fa')} onClick={() => setShowSMA20(s => !s)}>SMA20</button>
          <button style={btnStyle(showSMA50, '#f97316')} onClick={() => setShowSMA50(s => !s)}>SMA50</button>
          <button style={btnStyle(showSMA200, '#a855f7')} onClick={() => setShowSMA200(s => !s)}>SMA200</button>
          {fibonacci?.levels && (
            <button style={btnStyle(showFibLines, '#eab308')} onClick={() => setShowFibLines(s => !s)}>פיבונאצ׳י</button>
          )}
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} style={{ width: '100%', height: 380 }} />

      {/* Fibonacci legend */}
      {fibonacci?.levels && showFibLines && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
          {Object.entries(fibonacci.levels).map(([key, price]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 18, height: 2, background: FIB_COLORS[key], borderRadius: 1 }} />
              <span style={{ fontSize: '.65rem', color: 'var(--text2)' }}>{key}% <span className="num" style={{ color: FIB_COLORS[key] }}>${price}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
