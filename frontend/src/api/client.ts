import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// Portfolio
export const getPortfolio = () => api.get('/portfolio').then(r => r.data);
export const addPosition = (data: {
  symbol: string;
  name?: string;
  buy_price: number;
  buy_date: string;
  quantity: number;
}) => api.post('/portfolio/add', data).then(r => r.data);
export const removePosition = (symbol: string) =>
  api.delete(`/portfolio/${symbol}`).then(r => r.data);

// Radar
export const getRadar = () => api.get('/radar').then(r => r.data);
export const refreshRadar = () => api.post('/radar/refresh').then(r => r.data);
export const getCurrencies = () => api.get('/radar/currencies').then(r => r.data);
export const scanPortfolio = () => api.post('/radar/scan-portfolio').then(r => r.data);

// Notifications
export const getNotifications = () =>
  api.get('/radar/notifications').then(r => r.data);
export const markNotificationRead = (id: number) =>
  api.post(`/radar/notifications/read/${id}`).then(r => r.data);
export const markAllRead = () =>
  api.post('/radar/notifications/read-all').then(r => r.data);

// Stocks
export const getStockDetail = (symbol: string) =>
  api.get(`/stock/${symbol}`).then(r => r.data);
export const getStockNews = (symbol: string) =>
  api.get(`/stock/${symbol}/news`).then(r => r.data);

export default api;
