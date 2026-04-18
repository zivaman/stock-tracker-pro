import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Layout from './components/Layout';
import Portfolio from './pages/Portfolio';
import Radar from './pages/Radar';
import StockDetail from './pages/StockDetail';
import ZivIndex from './pages/ZivIndex';
import Search from './pages/Search';
import IndicatorsGuide from './pages/IndicatorsGuide';
import MarketDashboard from './pages/MarketDashboard';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Portfolio />} />
            <Route path="/radar" element={<Radar />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
            <Route path="/ziv-index" element={<ZivIndex />} />
            <Route path="/search" element={<Search />} />
            <Route path="/indicators" element={<IndicatorsGuide />} />
            <Route path="/market" element={<MarketDashboard />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
