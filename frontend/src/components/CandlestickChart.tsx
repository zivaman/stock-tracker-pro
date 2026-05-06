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
  LineStyle,
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

interface SupportResistance {
  support: number | null;
  resistance: number | null;
}

interface ChartPattern {
  type: string;
  name_he: string;
  implication: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  start_date: string;
  end_date: string;
  key_prices: Record<string, number>;
  description_he: string;
}

interface Props {
  symbol?: string;
  data: PricePoint[];
  fibonacci?: FibData;
  showFib?: boolean;
  supportResistance?: SupportResistance;
  patterns?: ChartPattern[];
}

type ChartType   = 'candle' | 'line';
type Granularity = 'intraday' | 'daily' | 'weekly';
type DailyRange  = '1m' | '3m' | '6m' | '1y';
type IntradayRange = '15m' | '30m' | '1h';
type Range = DailyRange | IntradayRange;

const DAILY_RANGES: { key: DailyRange; label: string; days: number }[] = [
  { key: '1m', label: '1M',  days: 21  },
  { key: '3m', label: '3M',  days: 63  },
  { key: '6m', label: '6M',  days: 126 },
  { key: '1y', label: '1Y',  days: 252 },
];
const INTRADAY_RANGES: { key: IntradayRange; label: string }[] = [
  { key: '15m', label: '15 דק' },
  { key: '30m', label: '30 דק' },
  { key: '1h',  label: 'שעה'  },
];

/** Aggregate daily PricePoints into weekly candles (Mon–Fri groups) */
function aggregateWeekly(points: PricePoint[]): PricePoint[] {
  if (!points.length) return [];
  const buckets = new Map<string, PricePoint[]>();
  points.forEach(p => {
    const d   = new Date(p.date);
    const day = d.getDay();                          // 0=Sun…6=Sat
    const diff = (day === 0 ? -6 : 1) - day;        // offset to Monday
    const mon  = new Date(d);
    mon.setDate(d.getDate() + diff);
    const key  = mon.toISOString().slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  });
  const weeks: PricePoint[] = [];
  buckets.forEach((days, weekStart) => {
    weeks.push({
      date:    weekStart,
      open:    days[0].open,
      high:    Math.max(...days.map(d => d.high)),
      low:     Math.min(...days.map(d => d.low)),
      close:   days[days.length - 1].close,
      volume:  days.reduce((s, d) => s + d.volume, 0),
      sma20:   days[days.length - 1].sma20,
      sma50:   days[days.length - 1].sma50,
      sma150:  days[days.length - 1].sma150,
      sma200:  days[days.length - 1].sma200,
      bb_upper:days[days.length - 1].bb_upper,
      bb_lower:days[days.length - 1].bb_lower,
      rsi: null, macd: null, macd_signal: null, macd_hist: null,
    });
  });
  return weeks.sort((a, b) => a.date.localeCompare(b.date));
}

/** Compute anchored VWAP from a given start date */
function computeAnchoredVWAP(points: PricePoint[], anchorDate: string): LineData[] {
  const startIdx = points.findIndex(p => p.date >= anchorDate);
  if (startIdx < 0) return [];
  let cumTPV = 0, cumVol = 0;
  const result: LineData[] = [];
  for (const d of points.slice(startIdx)) {
    if (d.volume > 0 && d.high != null && d.low != null && d.close != null) {
      const tp = (d.high + d.low + d.close) / 3;
      cumTPV += tp * d.volume;
      cumVol += d.volume;
      result.push({ time: d.date as any, value: Math.round((cumTPV / cumVol) * 100) / 100 });
    }
  }
  return result;
}

/** Compute cumulative VWAP from an array of PricePoints */
function computeVWAP(points: PricePoint[]): LineData[] {
  let cumTPV = 0;
  let cumVol = 0;
  const result: LineData[] = [];
  for (const d of points) {
    if (d.volume > 0 && d.high != null && d.low != null && d.close != null) {
      const tp = (d.high + d.low + d.close) / 3;
      cumTPV += tp * d.volume;
      cumVol += d.volume;
      result.push({ time: d.date as any, value: Math.round((cumTPV / cumVol) * 100) / 100 });
    }
  }
  return result;
}

/** Compute cumulative delta (order flow) */
function computeCumulativeDelta(points: PricePoint[]): HistogramData[] {
  let cumDelta = 0;
  return points
    .filter(d => d.high != null && d.low != null && d.close != null && d.open != null && d.volume > 0)
    .map(d => {
      const range = d.high - d.low;
      const ratio = range > 0 ? (d.close - d.low) / range : 0.5;
      const buyVol = d.volume * ratio;
      const sellVol = d.volume * (1 - ratio);
      const delta = buyVol - sellVol;
      cumDelta += delta;
      return {
        time: d.date as any,
        value: cumDelta / 1e6,
        color: delta >= 0 ? 'rgba(0,200,150,0.6)' : 'rgba(240,64,96,0.6)',
      };
    });
}

/** Get AMD session from a datetime string "YYYY-MM-DD HH:MM" */
function getAMDSession(dateStr: string): 'accumulation' | 'manipulation' | 'distribution' | 'afterhours' {
  const timePart = dateStr.includes(' ') ? dateStr.split(' ')[1] : '10:00';
  const [h] = timePart.split(':').map(Number);
  const etH = (h - 4 + 24) % 24;
  if (etH >= 0 && etH < 7) return 'accumulation';
  if (etH >= 7 && etH < 10) return 'manipulation';
  if (etH >= 10 && etH < 16) return 'distribution';
  return 'afterhours';
}

interface VolBucket { priceMin: number; priceMax: number; priceMid: number; volume: number; isPOC: boolean; isVA: boolean; }

function computeVolumeBuckets(data: PricePoint[], numBuckets = 24): VolBucket[] {
  if (data.length < 2) return [];
  const minP = Math.min(...data.map(d => d.low).filter(v => v != null));
  const maxP = Math.max(...data.map(d => d.high).filter(v => v != null));
  if (maxP <= minP) return [];
  const bucketSize = (maxP - minP) / numBuckets;
  const buckets: VolBucket[] = Array.from({ length: numBuckets }, (_, i) => ({
    priceMin: minP + i * bucketSize,
    priceMax: minP + (i + 1) * bucketSize,
    priceMid: minP + (i + 0.5) * bucketSize,
    volume: 0, isPOC: false, isVA: false,
  }));
  data.forEach(d => {
    if (d.high == null || d.low == null || d.volume <= 0) return;
    buckets.forEach(b => {
      const overlap = Math.min(d.high, b.priceMax) - Math.max(d.low, b.priceMin);
      if (overlap > 0) {
        const ratio = overlap / Math.max(0.001, d.high - d.low);
        b.volume += d.volume * ratio;
      }
    });
  });
  const totalVol = buckets.reduce((s, b) => s + b.volume, 0);
  const pocIdx = buckets.reduce((mi, b, i, arr) => b.volume > arr[mi].volume ? i : mi, 0);
  buckets[pocIdx].isPOC = true;
  let vaVol = buckets[pocIdx].volume;
  let lo = pocIdx, hi = pocIdx;
  while (vaVol < totalVol * 0.7 && (lo > 0 || hi < numBuckets - 1)) {
    const addLo = lo > 0 ? buckets[lo - 1].volume : 0;
    const addHi = hi < numBuckets - 1 ? buckets[hi + 1].volume : 0;
    if (addHi >= addLo && hi < numBuckets - 1) { hi++; vaVol += buckets[hi].volume; }
    else if (lo > 0) { lo--; vaVol += buckets[lo].volume; }
    else break;
  }
  for (let i = lo; i <= hi; i++) buckets[i].isVA = true;
  return buckets;
}

const FIB_COLORS: Record<string, string> = {
  '0':    '#ef4444',
  '23.6': '#f97316',
  '38.2': '#eab308',
  '50':   '#22c55e',
  '61.8': '#3b82f6',
  '78.6': '#8b5cf6',
  '100':  '#ec4899',
};

// Candle colors for active vs transparent mode
const CANDLE_VISIBLE = {
  upColor: '#00c896', downColor: '#f04060',
  borderUpColor: '#00c896', borderDownColor: '#f04060',
  wickUpColor: '#00c896',   wickDownColor: '#f04060',
};
const CANDLE_HIDDEN = {
  upColor: 'rgba(0,0,0,0)', downColor: 'rgba(0,0,0,0)',
  borderUpColor: 'rgba(0,0,0,0)', borderDownColor: 'rgba(0,0,0,0)',
  wickUpColor: 'rgba(0,0,0,0)',   wickDownColor: 'rgba(0,0,0,0)',
};

export default function CandlestickChart({
  symbol, data, fibonacci, showFib = true, supportResistance, patterns,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const closeLineRef  = useRef<ISeriesApi<'Line'> | null>(null);
  const volRef        = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma150Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef     = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef     = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef    = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSigRef     = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapRef        = useRef<ISeriesApi<'Line'> | null>(null);
  const drawnLineRefs  = useRef<Map<string, any>>(new Map());
  const autoSRRef     = useRef<{ support: any | null; resistance: any | null }>({ support: null, resistance: null });
  const anchoredVwapRef = useRef<ISeriesApi<'Line'> | null>(null);
  const anchorModeRef   = useRef(false);
  const footprintLinesRef = useRef<any[]>([]);
  const pocLineRef = useRef<any>(null);
  const vahLineRef = useRef<any>(null);
  const valLineRef = useRef<any>(null);
  const priceTimeLinesRef = useRef<any[]>([]);
  const fibExtLinesRef = useRef<any[]>([]);
  const cumDeltaRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const patternLinesRef = useRef<any[]>([]);

  const [chartType,      setChartType]      = useState<ChartType>('candle');
  const [granularity,    setGranularity]    = useState<Granularity>('daily');
  const [range,          setRange]          = useState<Range>('3m');
  const [showSMA20,      setShowSMA20]      = useState(true);
  const [showSMA50,      setShowSMA50]      = useState(true);
  const [showSMA150,     setShowSMA150]     = useState(true);
  const [showSMA200,     setShowSMA200]     = useState(true);
  const [showBB,         setShowBB]         = useState(false);
  const [showMACD,       setShowMACD]       = useState(false);
  const [showVol,        setShowVol]        = useState(true);
  const [showVWAP,       setShowVWAP]       = useState(false);
  const [showFibLines,   setShowFibLines]   = useState(showFib);
  const [showFibExt,     setShowFibExt]     = useState(false);
  const [showAnchoredVWAP,  setShowAnchoredVWAP]  = useState(false);
  const [anchorDate,        setAnchorDate]         = useState<string | null>(null);
  const [anchorMode,        setAnchorMode]         = useState(false);
  const [showVolumeFootprint,setShowVolumeFootprint]= useState(false);
  const [showSessionProfile, setShowSessionProfile] = useState(false);
  const [showPriceTime,      setShowPriceTime]      = useState(false);
  const [showIndicatorsPanel,setShowIndicatorsPanel]= useState(false);
  const [showOrderFlow,      setShowOrderFlow]      = useState(false);
  const [showAMD,            setShowAMD]            = useState(false);
  const [showVolProfile,     setShowVolProfile]     = useState(false);
  const [isFullscreen,       setIsFullscreen]       = useState(false);
  const [drawMode,       setDrawMode]       = useState(false);
  const [drawType,       setDrawType]       = useState<'support' | 'resistance'>('support');
  const [drawnLines,     setDrawnLines]     = useState<DrawnLine[]>([]);
  const [intradayData,   setIntradayData]   = useState<Record<string, PricePoint[]>>({});
  const [loadingIntraday,setLoadingIntraday]= useState(false);
  const [intradayError,  setIntradayError]  = useState('');

  const dropdownAnchorRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const drawModeRef = useRef(false);
  const drawTypeRef = useRef<'support' | 'resistance'>('support');

  useEffect(() => { drawModeRef.current = drawMode;    }, [drawMode]);
  useEffect(() => { drawTypeRef.current = drawType;    }, [drawType]);
  useEffect(() => { anchorModeRef.current = anchorMode; }, [anchorMode]);

  /* ── ESC closes fullscreen ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsFullscreen(false); setShowIndicatorsPanel(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── Dropdown position (fixed, so it escapes overflow:hidden parents) ── */
  useEffect(() => {
    if (showIndicatorsPanel && dropdownAnchorRef.current) {
      const rect = dropdownAnchorRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 520),
      });
    }
  }, [showIndicatorsPanel]);

  /* ── Click outside dropdown → close ── */
  useEffect(() => {
    if (!showIndicatorsPanel) return;
    const handler = (e: MouseEvent) => {
      if (dropdownAnchorRef.current && !dropdownAnchorRef.current.contains(e.target as Node)) {
        // Also check if click is inside the fixed dropdown itself
        const fixed = document.getElementById('indicators-dropdown-fixed');
        if (fixed && fixed.contains(e.target as Node)) return;
        setShowIndicatorsPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIndicatorsPanel]);

  const chartHeight = isFullscreen ? Math.floor(window.innerHeight * 0.72) : 420;

  const isIntraday = (r: Range): r is IntradayRange => ['15m', '30m', '1h'].includes(r);

  const handleGranularity = (g: Granularity) => {
    setGranularity(g);
    if (g === 'intraday') {
      setRange('1h');
      fetchIntraday('1h');
    } else {
      setRange('3m');
    }
  };

  /* ─── Create chart (once) ─── */
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

    // ── Candle series (always in DOM — hosts ALL price lines) ──
    const candleSeries = chart.addSeries(CandlestickSeries, CANDLE_VISIBLE);

    // ── Close-price line series (line-chart mode) — starts hidden ──
    const clSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6', lineWidth: 2,
      priceLineVisible: false, lastValueVisible: true,
      crosshairMarkerVisible: true,
      visible: false,
    });

    // ── Volume ──
    const volSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(100,150,255,0.25)', priceFormat: { type: 'volume' }, priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // ── MA lines ──
    const sma20s  = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, title: 'SMA20',  priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma50s  = chart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1, title: 'SMA50',  priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma150s = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, title: 'SMA150', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma200s = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, title: 'SMA200', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    // ── Bollinger Bands ──
    const bbUpper = chart.addSeries(LineSeries, {
      color: 'rgba(251,191,36,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed,
      title: 'BB Upper', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      visible: false,
    });
    const bbLower = chart.addSeries(LineSeries, {
      color: 'rgba(251,191,36,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed,
      title: 'BB Lower', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      visible: false,
    });

    // ── VWAP ──
    const vwapSeries = chart.addSeries(LineSeries, {
      color: 'rgba(167,139,250,0.85)', lineWidth: 2,
      title: 'VWAP', priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: true,
      visible: false,
    });

    // ── Anchored VWAP ──
    const anchoredVwap = chart.addSeries(LineSeries, {
      color: 'rgba(251,191,36,0.9)', lineWidth: 2, lineStyle: LineStyle.Dashed,
      title: 'A-VWAP', priceLineVisible: false, lastValueVisible: true,
      crosshairMarkerVisible: true, visible: false,
    });
    anchoredVwapRef.current = anchoredVwap;

    // ── MACD panel (priceScaleId 'macd') ──
    const macdHist = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      priceLineVisible: false, lastValueVisible: false,
      visible: false,
    });
    const macdLine = chart.addSeries(LineSeries, {
      color: '#3b82f6', lineWidth: 2,
      priceScaleId: 'macd',
      title: 'MACD', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      visible: false,
    });
    const macdSig = chart.addSeries(LineSeries, {
      color: '#f04060', lineWidth: 1, lineStyle: LineStyle.Dashed,
      priceScaleId: 'macd',
      title: 'Signal', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      visible: false,
    });
    chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } });

    // ── Cumulative Delta (Order Flow) ──
    const cumDeltaSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'delta',
      priceLineVisible: false, lastValueVisible: false,
      visible: false,
    });
    chart.priceScale('delta').applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
    cumDeltaRef.current = cumDeltaSeries;

    chartRef.current      = chart;
    candleRef.current     = candleSeries;
    closeLineRef.current  = clSeries;
    volRef.current        = volSeries;
    sma20Ref.current      = sma20s;
    sma50Ref.current      = sma50s;
    sma150Ref.current     = sma150s;
    sma200Ref.current     = sma200s;
    bbUpperRef.current    = bbUpper;
    bbLowerRef.current    = bbLower;
    macdHistRef.current   = macdHist;
    macdLineRef.current   = macdLine;
    macdSigRef.current    = macdSig;
    vwapRef.current       = vwapSeries;

    // ── Click → draw user line or set anchor ──
    chart.subscribeClick((param) => {
      if (anchorModeRef.current) {
        if (param.time) {
          const t = param.time as string;
          setAnchorDate(t);
          setAnchorMode(false);
        }
        return;
      }
      if (!drawModeRef.current || !param.point || !candleRef.current) return;
      const price = candleRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;
      const id    = `line-${Date.now()}`;
      const type  = drawTypeRef.current;
      const color = type === 'support' ? '#00c896' : '#f04060';
      const pl = (candleRef.current as any).createPriceLine({
        price: Number(price.toFixed(2)), color,
        lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: type === 'support' ? `✏ תמיכה $${price.toFixed(2)}` : `✏ התנגדות $${price.toFixed(2)}`,
      });
      drawnLineRefs.current.set(id, pl);
      setDrawnLines(prev => [...prev, {
        id, price: Number(price.toFixed(2)), type,
        label: type === 'support' ? 'תמיכה' : 'התנגדות',
      }]);
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  /* ── Resize chart when fullscreen changes ── */
  useEffect(() => {
    if (chartRef.current && containerRef.current) {
      chartRef.current.applyOptions({ height: chartHeight });
    }
  }, [chartHeight]);

  /* ─── Candle ↔ Line toggle ─── */
  useEffect(() => {
    if (chartType === 'candle') {
      candleRef.current?.applyOptions(CANDLE_VISIBLE);
      closeLineRef.current?.applyOptions({ visible: false });
    } else {
      candleRef.current?.applyOptions(CANDLE_HIDDEN);
      closeLineRef.current?.applyOptions({ visible: true });
    }
  }, [chartType]);

  /* ─── Auto Support / Resistance lines (always on candleRef) ─── */
  useEffect(() => {
    if (!candleRef.current) return;
    const series = candleRef.current as any;

    if (autoSRRef.current.support)    { try { series.removePriceLine(autoSRRef.current.support);    } catch {} }
    if (autoSRRef.current.resistance) { try { series.removePriceLine(autoSRRef.current.resistance); } catch {} }
    autoSRRef.current = { support: null, resistance: null };

    if (supportResistance?.support) {
      autoSRRef.current.support = series.createPriceLine({
        price: supportResistance.support,
        color: '#00c896',
        lineWidth: 2,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: `◀ תמיכה $${supportResistance.support}`,
      });
    }
    if (supportResistance?.resistance) {
      autoSRRef.current.resistance = series.createPriceLine({
        price: supportResistance.resistance,
        color: '#f04060',
        lineWidth: 2,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: `◀ התנגדות $${supportResistance.resistance}`,
      });
    }
  }, [supportResistance]);

  /* ─── Data ─── */
  const getActiveData = useCallback((): PricePoint[] => {
    if (granularity === 'intraday') return intradayData[range as IntradayRange] ?? [];
    const r    = DAILY_RANGES.find(d => d.key === range) ?? DAILY_RANGES[1];
    const days = granularity === 'weekly' ? r.days * 3 : r.days;
    const slice = data.slice(-Math.min(days, data.length));
    return granularity === 'weekly' ? aggregateWeekly(slice) : slice;
  }, [granularity, range, data, intradayData]);

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

  useEffect(() => {
    if (!candleRef.current || !volRef.current || !closeLineRef.current) return;
    const slice = getActiveData();
    if (!slice.length) return;

    const candles: CandlestickData[] = slice
      .filter(d => d.open != null && d.high != null && d.low != null && d.close != null)
      .map(d => ({ time: d.date as any, open: d.open, high: d.high, low: d.low, close: d.close }));

    const lineData: LineData[] = slice
      .filter(d => d.close != null)
      .map(d => ({ time: d.date as any, value: d.close }));

    const sessionColors: Record<string, string> = {
      accumulation: 'rgba(59,130,246,0.5)',
      manipulation: 'rgba(249,115,22,0.5)',
      distribution: 'rgba(34,197,94,0.5)',
      afterhours: 'rgba(168,85,247,0.4)',
    };
    const vols: HistogramData[] = slice.map(d => {
      let color: string;
      if (showAMD && granularity === 'intraday') {
        const session = getAMDSession(d.date);
        color = sessionColors[session];
      } else {
        color = d.close >= d.open ? 'rgba(0,200,150,0.3)' : 'rgba(240,64,96,0.3)';
      }
      return { time: d.date as any, value: d.volume, color };
    });

    const sma20d:  LineData[] = slice.filter(d => d.sma20  != null).map(d => ({ time: d.date as any, value: d.sma20!  }));
    const sma50d:  LineData[] = slice.filter(d => d.sma50  != null).map(d => ({ time: d.date as any, value: d.sma50!  }));
    const sma150d: LineData[] = slice.filter(d => d.sma150 != null).map(d => ({ time: d.date as any, value: d.sma150! }));
    const sma200d: LineData[] = slice.filter(d => d.sma200 != null).map(d => ({ time: d.date as any, value: d.sma200! }));
    const bbUpperD: LineData[] = slice.filter(d => d.bb_upper != null).map(d => ({ time: d.date as any, value: d.bb_upper! }));
    const bbLowerD: LineData[] = slice.filter(d => d.bb_lower != null).map(d => ({ time: d.date as any, value: d.bb_lower! }));

    const macdHistD: HistogramData[] = slice
      .filter(d => d.macd_hist != null)
      .map(d => ({
        time: d.date as any,
        value: d.macd_hist!,
        color: d.macd_hist! >= 0 ? 'rgba(0,200,150,0.75)' : 'rgba(240,64,96,0.75)',
      }));
    const macdLineD: LineData[] = slice.filter(d => d.macd != null).map(d => ({ time: d.date as any, value: d.macd! }));
    const macdSigD:  LineData[] = slice.filter(d => d.macd_signal != null).map(d => ({ time: d.date as any, value: d.macd_signal! }));

    candleRef.current.setData(candles);
    closeLineRef.current.setData(lineData);
    volRef.current.setData(vols);
    sma20Ref.current?.setData(sma20d);
    sma50Ref.current?.setData(sma50d);
    sma150Ref.current?.setData(sma150d);
    sma200Ref.current?.setData(sma200d);
    bbUpperRef.current?.setData(bbUpperD);
    bbLowerRef.current?.setData(bbLowerD);
    macdHistRef.current?.setData(macdHistD);
    macdLineRef.current?.setData(macdLineD);
    macdSigRef.current?.setData(macdSigD);
    vwapRef.current?.setData(computeVWAP(slice));
    cumDeltaRef.current?.setData(computeCumulativeDelta(slice));
    chartRef.current?.timeScale().fitContent();
  }, [range, data, intradayData, getActiveData, showAMD, granularity]);

  useEffect(() => { sma20Ref.current?.applyOptions({ visible: showSMA20 });   }, [showSMA20]);
  useEffect(() => { sma50Ref.current?.applyOptions({ visible: showSMA50 });   }, [showSMA50]);
  useEffect(() => { sma150Ref.current?.applyOptions({ visible: showSMA150 }); }, [showSMA150]);
  useEffect(() => { sma200Ref.current?.applyOptions({ visible: showSMA200 }); }, [showSMA200]);
  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB });
    bbLowerRef.current?.applyOptions({ visible: showBB });
  }, [showBB]);

  useEffect(() => {
    macdHistRef.current?.applyOptions({ visible: showMACD });
    macdLineRef.current?.applyOptions({ visible: showMACD });
    macdSigRef.current?.applyOptions({ visible: showMACD });
  }, [showMACD]);

  useEffect(() => { volRef.current?.applyOptions({ visible: showVol }); }, [showVol]);
  useEffect(() => { vwapRef.current?.applyOptions({ visible: showVWAP }); }, [showVWAP]);
  useEffect(() => { cumDeltaRef.current?.applyOptions({ visible: showOrderFlow }); }, [showOrderFlow]);

  /* ─── Anchored VWAP ─── */
  useEffect(() => {
    if (!anchoredVwapRef.current) return;
    if (!showAnchoredVWAP || !anchorDate) {
      anchoredVwapRef.current.applyOptions({ visible: false });
      return;
    }
    const slice = getActiveData();
    const avwapData = computeAnchoredVWAP(slice, anchorDate);
    anchoredVwapRef.current.setData(avwapData);
    anchoredVwapRef.current.applyOptions({ visible: true });
  }, [showAnchoredVWAP, anchorDate, range, data, intradayData, getActiveData]);

  /* ─── Volume Footprint ─── */
  useEffect(() => {
    if (!candleRef.current) return;
    const series = candleRef.current as any;
    footprintLinesRef.current.forEach(pl => { try { series.removePriceLine(pl); } catch {} });
    footprintLinesRef.current = [];
    if (!showVolumeFootprint) return;
    const slice = getActiveData();
    if (!slice.length) return;
    const avgVol = slice.reduce((s, d) => s + d.volume, 0) / slice.length;
    slice.filter(d => d.volume > 1.5 * avgVol && d.close != null).forEach(d => {
      const pl = series.createPriceLine({
        price: d.close,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `🔥 Vol ×${(d.volume / avgVol).toFixed(1)}`,
      });
      footprintLinesRef.current.push(pl);
    });
  }, [showVolumeFootprint, range, data, intradayData, getActiveData]);

  /* ─── Session Volume Profile ─── */
  useEffect(() => {
    if (!candleRef.current) return;
    const series = candleRef.current as any;
    if (pocLineRef.current) { try { series.removePriceLine(pocLineRef.current); } catch {} pocLineRef.current = null; }
    if (vahLineRef.current) { try { series.removePriceLine(vahLineRef.current); } catch {} vahLineRef.current = null; }
    if (valLineRef.current) { try { series.removePriceLine(valLineRef.current); } catch {} valLineRef.current = null; }
    if (!showSessionProfile) return;
    const slice = getActiveData();
    if (!slice.length) return;
    const minLow  = Math.min(...slice.filter(d => d.low  != null).map(d => d.low));
    const maxHigh = Math.max(...slice.filter(d => d.high != null).map(d => d.high));
    const numBuckets = 30;
    const bucketSize = (maxHigh - minLow) / numBuckets;
    if (bucketSize <= 0) return;
    const buckets: number[] = new Array(numBuckets).fill(0);
    slice.forEach(d => {
      if (d.high == null || d.low == null) return;
      for (let i = 0; i < numBuckets; i++) {
        const bLow  = minLow + i * bucketSize;
        const bHigh = bLow + bucketSize;
        if (d.high >= bLow && d.low <= bHigh) {
          buckets[i] += d.volume;
        }
      }
    });
    const maxBucket = Math.max(...buckets);
    const pocIdx = buckets.indexOf(maxBucket);
    const poc = minLow + (pocIdx + 0.5) * bucketSize;
    const totalVol = buckets.reduce((s, v) => s + v, 0);
    const target = totalVol * 0.7;
    let cumVol = buckets[pocIdx];
    let lo = pocIdx, hi = pocIdx;
    while (cumVol < target && (lo > 0 || hi < numBuckets - 1)) {
      const extendLo = lo > 0 ? buckets[lo - 1] : 0;
      const extendHi = hi < numBuckets - 1 ? buckets[hi + 1] : 0;
      if (extendLo >= extendHi && lo > 0) { lo--; cumVol += buckets[lo]; }
      else if (hi < numBuckets - 1) { hi++; cumVol += buckets[hi]; }
      else break;
    }
    const vah = minLow + (hi + 1) * bucketSize;
    const val = minLow + lo * bucketSize;
    pocLineRef.current = series.createPriceLine({ price: poc, color: '#eab308', lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '⬛ POC' });
    vahLineRef.current = series.createPriceLine({ price: vah, color: '#3b82f6', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '↑ VAH' });
    valLineRef.current = series.createPriceLine({ price: val, color: '#3b82f6', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '↓ VAL' });
  }, [showSessionProfile, range, data, intradayData, getActiveData]);

  /* ─── Price & Time Opportunities ─── */
  useEffect(() => {
    if (!candleRef.current) return;
    const series = candleRef.current as any;
    priceTimeLinesRef.current.forEach(pl => { try { series.removePriceLine(pl); } catch {} });
    priceTimeLinesRef.current = [];
    if (!showPriceTime) return;
    const slice = getActiveData();
    if (!slice.length) return;
    const high = Math.max(...slice.filter(d => d.high != null).map(d => d.high));
    const low  = Math.min(...slice.filter(d => d.low  != null).map(d => d.low));
    const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
    const colorKeys = ['0', '23.6', '38.2', '50', '61.8', '78.6', '100'];
    fibLevels.forEach((level, i) => {
      const price = low + (high - low) * (1 - level);
      const color = FIB_COLORS[colorKeys[i]] || '#fff';
      const pl = series.createPriceLine({
        price, color,
        lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `⏱ ${(level * 100).toFixed(1)}%`,
      });
      priceTimeLinesRef.current.push(pl);
    });
  }, [showPriceTime, range, data, intradayData, getActiveData]);

  /* ─── Fibonacci price lines ─── */
  useEffect(() => {
    if (!candleRef.current || !fibonacci?.levels) return;
    const series = candleRef.current as any;
    const prev: any[] = (containerRef.current as any).__fibLines || [];
    prev.forEach((l: any) => { try { series.removePriceLine(l); } catch {} });
    (containerRef.current as any).__fibLines = [];
    if (!showFibLines) return;
    const lines = Object.entries(fibonacci.levels).map(([key, price]) =>
      series.createPriceLine({
        price, color: FIB_COLORS[key] || '#fff',
        lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: `Fib ${key}%`,
      })
    );
    (containerRef.current as any).__fibLines = lines;
  }, [fibonacci, showFibLines, range]);

  /* ─── Fibonacci Extensions ─── */
  useEffect(() => {
    if (!candleRef.current) return;
    const series = candleRef.current as any;
    fibExtLinesRef.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    fibExtLinesRef.current = [];
    if (!showFibExt || !fibonacci?.swing_high || !fibonacci?.swing_low) return;
    const range_fib = fibonacci.swing_high - fibonacci.swing_low;
    const extLevels: Record<string, number> = {
      '127.2%': fibonacci.swing_high + range_fib * 0.272,
      '161.8%': fibonacci.swing_high + range_fib * 0.618,
      '200%':   fibonacci.swing_high + range_fib * 1.0,
      '261.8%': fibonacci.swing_high + range_fib * 1.618,
    };
    const extColors: Record<string, string> = {
      '127.2%': '#f59e0b', '161.8%': '#ef4444', '200%': '#ec4899', '261.8%': '#8b5cf6',
    };
    fibExtLinesRef.current = Object.entries(extLevels).map(([key, price]) =>
      series.createPriceLine({
        price: Math.round(price * 100) / 100,
        color: extColors[key],
        lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: `Ext ${key}`,
      })
    );
  }, [showFibExt, fibonacci]);

  /* ─── Chart Patterns ─── */
  useEffect(() => {
    if (!candleRef.current) return;
    const series = candleRef.current as any;
    patternLinesRef.current.forEach(l => { try { series.removePriceLine(l); } catch {} });
    patternLinesRef.current = [];
    if (!patterns?.length) return;
    const colorMap: Record<string, string> = { bullish: '#22c55e', bearish: '#ef4444', neutral: '#eab308' };
    patterns.forEach(p => {
      const color = colorMap[p.implication] || '#fff';
      Object.entries(p.key_prices).forEach(([label, price]) => {
        const line = series.createPriceLine({
          price, color,
          lineWidth: 1, lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: true,
          title: `📐 ${p.name_he} — ${label}`,
        });
        patternLinesRef.current.push(line);
      });
    });
  }, [patterns]);

  /* ─── User-drawn line helpers ─── */
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

  /* ─── Style helpers ─── */
  const btn = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 6, fontSize: '.72rem', fontWeight: 600,
    border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`,
    background: active ? `${color || 'var(--blue)'}22` : 'transparent',
    color: active ? (color || 'var(--blue)') : 'var(--muted)',
    cursor: 'pointer', transition: 'all .12s',
  });

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Row 1: Granularity + Range + Chart type toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>

        {/* Left: granularity selector + time ranges */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Granularity pill */}
          <div style={{ display: 'flex', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 7, padding: 2, gap: 2 }}>
            {([
              { key: 'intraday', label: 'תוך-יומי' },
              { key: 'daily',    label: 'יומי' },
              { key: 'weekly',   label: 'שבועי' },
            ] as { key: Granularity; label: string }[]).map(g => (
              <button
                key={g.key}
                onClick={() => handleGranularity(g.key)}
                style={{
                  padding: '3px 10px', borderRadius: 5, fontSize: '.72rem', fontWeight: 700,
                  background: granularity === g.key ? 'var(--blue)' : 'transparent',
                  color: granularity === g.key ? '#fff' : 'var(--muted)',
                  border: 'none', cursor: 'pointer', transition: 'all .15s',
                }}
              >{g.label}</button>
            ))}
          </div>

          {/* divider */}
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

          {/* Intraday sub-ranges */}
          {granularity === 'intraday' && INTRADAY_RANGES.map(r => (
            <button key={r.key} style={btn(range === r.key, '#f59e0b')} onClick={() => handleRangeChange(r.key)}>
              {r.label}
            </button>
          ))}

          {/* Daily / Weekly sub-ranges */}
          {granularity !== 'intraday' && DAILY_RANGES.map(r => (
            <button key={r.key} style={btn(range === r.key)} onClick={() => setRange(r.key as Range)}>
              {r.label}
            </button>
          ))}

          {/* Expand to fullscreen */}
          <button
            onClick={() => setIsFullscreen(true)}
            style={{ ...btn(false), padding: '3px 9px', marginRight: 4 }}
            title="הרחב גרף למסך מלא"
          >
            ⛶
          </button>
        </div>

        {/* Right: chart type + Indicators dropdown */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Chart type toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 7, padding: 2 }}>
            <button
              style={{
                padding: '3px 10px', borderRadius: 5, fontSize: '.72rem', fontWeight: 700,
                background: chartType === 'candle' ? 'var(--blue)' : 'transparent',
                color: chartType === 'candle' ? '#fff' : 'var(--muted)',
                border: 'none', cursor: 'pointer', transition: 'all .15s',
              }}
              onClick={() => setChartType('candle')}
              title="גרף נרות"
            >
              🕯 נרות
            </button>
            <button
              style={{
                padding: '3px 10px', borderRadius: 5, fontSize: '.72rem', fontWeight: 700,
                background: chartType === 'line' ? 'var(--blue)' : 'transparent',
                color: chartType === 'line' ? '#fff' : 'var(--muted)',
                border: 'none', cursor: 'pointer', transition: 'all .15s',
              }}
              onClick={() => setChartType('line')}
              title="גרף קו"
            >
              〰 קו
            </button>
          </div>

          {/* divider */}
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

          {/* Indicators dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownAnchorRef}>
            <button
              onClick={() => setShowIndicatorsPanel(v => !v)}
              style={{
                ...btn(showIndicatorsPanel, 'var(--blue)'),
                padding: '5px 14px', fontSize: '.75rem', fontWeight: 700,
              }}
            >
              📊 אינדיקטורים {showIndicatorsPanel ? '▲' : '▼'}
            </button>

            {showIndicatorsPanel && (
              <div id="indicators-dropdown-fixed" style={{
                position: 'fixed',
                top: dropdownPos.top,
                left: dropdownPos.left,
                zIndex: 9999,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 18px',
                width: 520, maxHeight: '78vh', overflowY: 'auto',
                boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
              }}>

                {/* Group: Moving Averages */}
                <p style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  📈 ממוצעים נעים
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  <button style={btn(showSMA20,  '#60a5fa')} onClick={() => setShowSMA20(s => !s)}>SMA20</button>
                  <button style={btn(showSMA50,  '#f97316')} onClick={() => setShowSMA50(s => !s)}>SMA50</button>
                  <button style={btn(showSMA150, '#10b981')} onClick={() => setShowSMA150(s => !s)}>SMA150</button>
                  <button style={btn(showSMA200, '#a855f7')} onClick={() => setShowSMA200(s => !s)}>SMA200</button>
                </div>

                {/* Group: Oscillators */}
                <p style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  📉 אוסצילטורים
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  <button style={btn(showMACD, '#3b82f6')} onClick={() => setShowMACD(s => !s)}>MACD</button>
                </div>

                {/* Group: Bands & VWAP */}
                <p style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  📊 בנדים ו-VWAP
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <button style={btn(showBB,   '#fbbf24')} onClick={() => setShowBB(s => !s)}>BB</button>
                  <button style={btn(showVWAP, '#a78bfa')} onClick={() => setShowVWAP(s => !s)}>VWAP</button>
                  <button style={btn(showAnchoredVWAP, '#fbbf24')} onClick={() => setShowAnchoredVWAP(s => !s)}>A-VWAP</button>
                </div>
                {showAnchoredVWAP && (
                  <div style={{ marginBottom: 10, paddingRight: 4 }}>
                    <button
                      style={{
                        ...btn(anchorMode, '#fbbf24'),
                        fontSize: '.68rem',
                      }}
                      onClick={() => setAnchorMode(v => !v)}
                    >
                      {anchorMode ? '⏳ לחץ על הגרף לבחירת עוגן' : `⚓ הגדר עוגן${anchorDate ? ` (${anchorDate})` : ''}`}
                    </button>
                  </div>
                )}

                {/* Group: Volume */}
                <p style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  📦 נפח
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  <button style={btn(showVol,  '#64b4ff')} onClick={() => setShowVol(s => !s)}>VOL</button>
                  <button style={btn(showVolumeFootprint, '#f97316')} onClick={() => setShowVolumeFootprint(s => !s)}>Footprint</button>
                  <button style={btn(showSessionProfile,  '#eab308')} onClick={() => setShowSessionProfile(s => !s)}>Session POC</button>
                  <button style={btn(showOrderFlow, '#06b6d4')} onClick={() => setShowOrderFlow(s => !s)}>Order Flow</button>
                  <button style={btn(showVolProfile, '#eab308')} onClick={() => setShowVolProfile(s => !s)}>Vol Profile</button>
                </div>

                {/* Group: Advanced */}
                <p style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ⚡ מתקדם
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {fibonacci?.levels && (
                    <button style={btn(showFibLines, '#eab308')} onClick={() => setShowFibLines(s => !s)}>פיב׳</button>
                  )}
                  <button style={btn(showFibExt, '#f59e0b')} onClick={() => setShowFibExt(s => !s)}>Fib Ext</button>
                  <button style={btn(showPriceTime, '#22c55e')} onClick={() => setShowPriceTime(s => !s)}>Price &amp; Time</button>
                </div>

                {/* Group: ICT */}
                <p style={{ fontSize: '.62rem', color: 'var(--muted)', fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ⚡ מתקדם / ICT
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  <button style={btn(showAMD, '#8b5cf6')} onClick={() => setShowAMD(s => !s)} title="Accumulation–Manipulation–Distribution">AMD Model</button>
                </div>

                {/* Close button */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowIndicatorsPanel(false)}
                    style={{ ...btn(false), fontSize: '.68rem' }}
                  >
                    ✕ סגור
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Drawing tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.68rem', color: 'var(--muted)', fontWeight: 700 }}>ציור ידני:</span>
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

      {/* ── Auto S/R legend ── */}
      {(supportResistance?.support || supportResistance?.resistance) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700 }}>ניתוח אוטומטי:</span>
          {supportResistance.support && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,200,150,.08)', border: '1px solid rgba(0,200,150,.25)',
              borderRadius: 6, padding: '3px 10px',
            }}>
              <div style={{ width: 14, height: 2, background: '#00c896', borderRadius: 1 }} />
              <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#00c896' }}>
                תמיכה ${supportResistance.support}
              </span>
            </div>
          )}
          {supportResistance.resistance && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(240,64,96,.08)', border: '1px solid rgba(240,64,96,.25)',
              borderRadius: 6, padding: '3px 10px',
            }}>
              <div style={{ width: 14, height: 2, background: '#f04060', borderRadius: 1 }} />
              <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#f04060' }}>
                התנגדות ${supportResistance.resistance}
              </span>
            </div>
          )}
          <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>— מחושב אוטומטי לפי ממצועים סוינג 60 בארים</span>
        </div>
      )}

      {/* ── Chart ── */}
      {loadingIntraday && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text2)', fontSize: '.8rem' }}>
          טוען נתוני intraday...
        </div>
      )}
      {intradayError && (
        <div style={{ fontSize: '.75rem', color: 'var(--red)', padding: '0.5rem', background: 'rgba(240,64,96,.08)', borderRadius: 6 }}>
          {intradayError}
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: chartHeight, cursor: (drawMode || anchorMode) ? 'crosshair' : 'default' }}
      />

      {/* ── AMD legend strip ── */}
      {showAMD && granularity === 'intraday' && (
        <div style={{
          display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--border)', fontSize: '.65rem', fontWeight: 700,
          marginTop: 4,
        }}>
          {[
            { label: '🅐 צבירה', sub: '12:00–07:00 ET', color: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.5)' },
            { label: '🅜 מניפולציה', sub: '07:00–10:00 ET', color: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.5)' },
            { label: '🅓 הפצה', sub: '10:00–16:00 ET', color: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.5)' },
            { label: '🌙 אחרי שוק', sub: '16:00–00:00 ET', color: 'rgba(168,85,247,0.18)', border: 'rgba(168,85,247,0.5)' },
          ].map(z => (
            <div key={z.label} style={{
              flex: 1, padding: '5px 8px', background: z.color,
              borderRight: `1px solid ${z.border}`, textAlign: 'center',
            }}>
              <div style={{ color: 'var(--text)' }}>{z.label}</div>
              <div style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '.58rem' }}>{z.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Volume Profile panel ── */}
      {showVolProfile && (() => {
        const slice = getActiveData();
        const buckets = computeVolumeBuckets(slice, 24);
        if (!buckets.length) return null;
        const maxVol = Math.max(...buckets.map(b => b.volume));
        return (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
            background: 'var(--bg2)', padding: '8px',
          }}>
            <p style={{ fontSize: '.63rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
              📊 Volume Profile — {slice.length} בארים
            </p>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1.5, height: 200, position: 'relative' }}>
              {buckets.map((b, i) => {
                const barW = maxVol > 0 ? (b.volume / maxVol) * 70 : 0;
                const color = b.isPOC ? '#eab308' : b.isVA ? '#3b82f6' : '#6b7280';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minHeight: 0 }}>
                    <span style={{ fontSize: '.55rem', color: 'var(--muted)', width: 48, textAlign: 'right', flexShrink: 0, fontFamily: 'monospace' }}>
                      ${b.priceMid.toFixed(1)}
                    </span>
                    <div style={{ flex: 1, position: 'relative', height: '75%', display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        height: '100%', width: `${barW}%`,
                        background: color, borderRadius: '0 3px 3px 0',
                        opacity: b.isPOC ? 1 : b.isVA ? 0.8 : 0.5,
                        minWidth: barW > 0 ? 2 : 0,
                      }} />
                    </div>
                    {b.isPOC && <span style={{ fontSize: '.55rem', color: '#eab308', fontWeight: 700, flexShrink: 0 }}>POC</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {[
                { color: '#eab308', label: 'POC — נקודת שליטה (מחיר הנפח הגבוה ביותר)' },
                { color: '#3b82f6', label: 'Value Area (70% מהנפח)' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
                  <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Chart Patterns ── */}
      {patterns && patterns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <p style={{ fontSize: '.63rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 2 }}>📐 תבניות גרף שזוהו</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
            {patterns.map((p, i) => (
              <div key={i} style={{
                background: 'var(--bg2)', border: `1px solid ${p.implication === 'bullish' ? 'rgba(34,197,94,.3)' : p.implication === 'bearish' ? 'rgba(239,68,68,.3)' : 'rgba(234,179,8,.3)'}`,
                borderRadius: 8, padding: '8px 10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text)' }}>{p.name_he}</span>
                  <span style={{
                    fontSize: '.6rem', padding: '1px 6px', borderRadius: 10, fontWeight: 700,
                    background: p.implication === 'bullish' ? 'rgba(34,197,94,.15)' : p.implication === 'bearish' ? 'rgba(239,68,68,.15)' : 'rgba(234,179,8,.15)',
                    color: p.implication === 'bullish' ? '#22c55e' : p.implication === 'bearish' ? '#ef4444' : '#eab308',
                  }}>
                    {p.implication === 'bullish' ? '📈 שורי' : p.implication === 'bearish' ? '📉 דובי' : '➡ ניטרלי'} · {p.confidence}%
                  </span>
                </div>
                <p style={{ fontSize: '.72rem', color: 'var(--text2)', lineHeight: 1.4 }}>{p.description_he}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── User drawn lines list ── */}
      {drawnLines.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {drawnLines.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--card2)',
              border: `1px solid ${l.type === 'support' ? 'rgba(0,200,150,.3)' : 'rgba(240,64,96,.3)'}`,
              borderRadius: 6, padding: '2px 8px',
            }}>
              <span style={{ fontSize: '.65rem', color: l.type === 'support' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                ✏ {l.label}
              </span>
              <span style={{ fontSize: '.68rem', color: 'var(--text2)', fontFamily: 'monospace' }}>${l.price}</span>
              <button
                onClick={() => removeLine(l.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '.8rem', lineHeight: 1 }}
              >×</button>
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
              <span style={{ fontSize: '.63rem', color: 'var(--text2)' }}>
                {key}% <span style={{ color: FIB_COLORS[key], fontFamily: 'monospace' }}>${price}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Fib Extensions legend ── */}
      {fibonacci?.swing_high && showFibExt && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['127.2%','#f59e0b'],['161.8%','#ef4444'],['200%','#ec4899'],['261.8%','#8b5cf6']].map(([k,c]) => {
            const r = fibonacci.swing_high - fibonacci.swing_low;
            const ext: Record<string, number> = {
              '127.2%': fibonacci.swing_high + r*0.272,
              '161.8%': fibonacci.swing_high + r*0.618,
              '200%': fibonacci.swing_high + r,
              '261.8%': fibonacci.swing_high + r*1.618,
            };
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 16, height: 2, background: c, borderRadius: 1 }} />
                <span style={{ fontSize: '.63rem', color: 'var(--text2)' }}>
                  {k} <span style={{ color: c, fontFamily: 'monospace' }}>${ext[k]?.toFixed(2)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return isFullscreen ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      padding: '12px 16px', overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>
          📊 {symbol || ''} — גרף מלא
        </span>
        <button
          onClick={() => setIsFullscreen(false)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: '.8rem', fontWeight: 700 }}
        >
          ✕ סגור (ESC)
        </button>
      </div>
      {inner}
    </div>
  ) : inner;
}
