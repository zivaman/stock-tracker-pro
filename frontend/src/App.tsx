import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Portfolio from './pages/Portfolio';
import Radar from './pages/Radar';
import StockDetail from './pages/StockDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
