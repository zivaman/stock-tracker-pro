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

export default api;
