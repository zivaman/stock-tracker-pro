import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Layout from './components/Layout';
import Radar from './pages/Radar';
import StockDetail from './pages/StockDetail';
import ZivIndex from './pages/ZivIndex';
import Search from './pages/Search';
import IndicatorsGuide from './pages/IndicatorsGuide';
import MarketDashboard from './pages/MarketDashboard';
import SectorDashboard from './pages/SectorDashboard';
import ChartPage from './pages/ChartPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone chart page — no nav bar */}
          <Route path="/chart/:symbol" element={<ChartPage />} />

          {/* All other pages inside the Layout */}
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/radar" replace />} />
                <Route path="/radar" element={<Radar />} />
                <Route path="/stock/:symbol" element={<StockDetail />} />
                <Route path="/ziv-index" element={<ZivIndex />} />
                <Route path="/search" element={<Search />} />
                <Route path="/indicators" element={<IndicatorsGuide />} />
                <Route path="/market" element={<MarketDashboard />} />
                <Route path="/sectors" element={<SectorDashboard />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
