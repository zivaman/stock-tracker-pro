export interface PortfolioPosition {
  id: number;
  symbol: string;
  name: string;
  buy_price: number;
  buy_date: string;
  quantity: number;
  current_price: number;
  invested: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  performance: {
    since_buy?: number;
    '1d'?: number;
    '1w'?: number;
    '1m'?: number;
    '3m'?: number;
    '6m'?: number;
    '1y'?: number;
  };
  ta?: {
    score: number;
    signal: string;
    rsi: number | null;
    macd: number | null;
    macd_signal: number | null;
    sma50: number | null;
    sma200: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    reasons: string[];
    warnings: string[];
  };
}

export interface PortfolioSummary {
  total_invested: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  num_positions: number;
}

export interface RadarStock {
  symbol: string;
  name: string;
  sector: string;
  current_price: number;
  currency: string;
  market_cap: number | null;
  beta: number | null;
  score: number;
  signal: 'strong_buy' | 'buy' | 'watch' | 'neutral' | 'sell';
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  sma50: number | null;
  sma200: number | null;
  reasons: string[];
  warnings: string[];
  day_change: number | null;
  week_change: number | null;
  hot_signal: string | null;
  description: string;
  pe_ratio: number | null;
  target_price: number | null;
  analyst_rec: string;
  analyst_count: number | null;
  '52w_high': number | null;
  '52w_low': number | null;
  avg_volume: number | null;
  volume: number | null;
  perf_1m: number | null;
  perf_3m: number | null;
  perf_6m: number | null;
  perf_1y: number | null;
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
}

export interface SignalData {
  score: number;
  signal: string;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  bb_middle: number | null;
  reasons: string[];
  warnings: string[];
}

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  beta: number | null;
  '52w_high': number | null;
  '52w_low': number | null;
  avg_volume: number | null;
  website: string;
  country: string;
  currency: string;
}

export interface StockDetail {
  symbol: string;
  name: string;
  current_price: number;
  info: StockInfo;
  signal: SignalData;
  support_resistance: { resistance: number | null; support: number | null };
  price_history: PricePoint[];
  performance: {
    '1d': number | null;
    '5d': number | null;
    '1m': number | null;
    '3m': number | null;
    '6m': number | null;
    '1y': number | null;
  };
}

export interface Notification {
  id: number;
  symbol: string;
  signal_type: 'buy' | 'sell';
  message: string;
  score: number;
  price: number | null;
  created_at: string;
  read: boolean;
}
