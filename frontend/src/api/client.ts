import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 60000 });

// Portfolio
export const getPortfolio = () => api.get('/portfolio').then(r => r.data);
export const addPosition = (data: { symbol: string; name?: string; buy_price: number; buy_date: string; quantity: number }) =>
  api.post('/portfolio/add', data).then(r => r.data);
export const removePosition = (symbol: string) => api.delete(`/portfolio/${symbol}`).then(r => r.data);

// Radar
export const getRadar = () => api.get('/radar').then(r => r.data);
export const refreshRadar = () => api.post('/radar/refresh').then(r => r.data);
export const scanPortfolio = () => api.post('/radar/scan-portfolio').then(r => r.data);
export const getCurrencies = () => api.get('/radar/currencies').then(r => r.data);

// Notifications
export const getNotifications = () => api.get('/radar/notifications').then(r => r.data);
export const markNotificationRead = (id: number) => api.post(`/radar/notifications/read/${id}`).then(r => r.data);
export const markAllRead = () => api.post('/radar/notifications/read-all').then(r => r.data);

// Stocks
export const getStockDetail = (symbol: string) => api.get(`/stock/${symbol}`).then(r => r.data);
export const getStockNews = (symbol: string) => api.get(`/stock/${symbol}/news`).then(r => r.data);
export const searchSymbols = (q: string) => api.get('/stock/search', { params: { q }, timeout: 8000 }).then(r => r.data as SearchResult[]);
export const getInstitutional = (symbol: string) => api.get(`/stock/${symbol}/institutional`, { timeout: 25000 }).then(r => r.data);
export const getPolymarketSentiment = (symbol: string, company: string) =>
  api.get(`/stock/${symbol}/polymarket`, { params: { company }, timeout: 20000 }).then(r => r.data);
export const getInsiderRecent = (symbol: string, days = 30) =>
  api.get(`/stock/${symbol}/insider-recent`, { params: { days }, timeout: 15000 }).then(r => r.data);

export const getChartPatterns = (symbol: string, period = '6m') =>
  api.get(`/stock/${symbol}/chart-patterns`, { params: { period }, timeout: 15000 }).then(r => r.data);

export const getNewsSentiment = (symbol: string, company: string) =>
  api.get(`/stock/${symbol}/news-sentiment`, { params: { company }, timeout: 25000 }).then(r => r.data);

export const explainInstitutional = (symbol: string, data: {
  institution: string; action: string; pct_change: number | null;
  stock_name: string; symbol: string; sector?: string;
  shares?: number; value_usd?: number; pct_held?: number; date?: string;
  sentiment_score?: number; n_increased?: number; n_decreased?: number;
}) => api.post(`/stock/${symbol}/institutional/explain`, data, { timeout: 20000 }).then(r => r.data as { explanation: string; institution: string });

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  sector: string;
}

// מדד זיו
export const getZivIndex = () => api.get('/ziv-index').then(r => r.data);
export const getZivSummary = () => api.get('/ziv-index/summary').then(r => r.data);
export const addZivRecord = (data: { symbol: string; name: string; signal_type: string; rec_price: number; ta_score?: number; rule40_score?: number; notes?: string }) =>
  api.post('/ziv-index/add', data).then(r => r.data);
export const evaluateZivRecord = (id: number) => api.post(`/ziv-index/evaluate/${id}`).then(r => r.data);
export const autoEvaluateZiv = () => api.post('/ziv-index/auto-evaluate').then(r => r.data);
export const deleteZivRecord = (id: number) => api.delete(`/ziv-index/${id}`).then(r => r.data);

// Chat
export const chatWithStock = (data: { symbol: string; question: string; history?: any[]; context_data?: any }) =>
  api.post('/chat', data).then(r => r.data);

// Intraday
export const getIntradayData = (symbol: string, interval: '15m' | '30m' | '1h') =>
  api.get(`/stock/${symbol}/intraday`, { params: { interval } }).then(r => r.data);

// Market overview
export const getMarketOverview = () => api.get('/market/overview').then(r => r.data);

// AI Insights (Claude-powered, with prompt caching)
export const getAIInsights = (data: {
  symbol: string; name: string; current_price: number;
  sector?: string; signal?: any; info?: any;
  performance?: any; support_resistance?: any; fibonacci?: any;
}) => api.post('/ai/insights', data, { timeout: 30000 }).then(r => r.data);

// AI Portfolio Analysis
export const getAIPortfolioAnalysis = (data: {
  positions: Array<{
    symbol: string; name: string; sector?: string;
    buy_price: number; current_price: number; quantity: number;
    pnl_pct: number; invested: number; current_value: number;
    ta_score?: number; ta_signal?: string; rsi?: number;
  }>;
  total_invested: number;
  total_value: number;
  total_pnl_pct: number;
}) => api.post('/ai/portfolio-analysis', data, { timeout: 40000 }).then(r => r.data);

// Settings
export const getApiKeyStatus = () => api.get('/settings/apikey-status').then(r => r.data);
export const saveApiKey = (api_key: string) => api.post('/settings/apikey', { api_key }).then(r => r.data);

export default api;
