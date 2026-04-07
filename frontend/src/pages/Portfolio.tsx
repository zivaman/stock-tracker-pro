import { useEffect, useState } from 'react';
import { PlusCircle, RefreshCw, TrendingUp, TrendingDown, DollarSign, Briefcase } from 'lucide-react';
import { getPortfolio, addPosition, removePosition } from '../api/client';
import PortfolioCard from '../components/PortfolioCard';
import type { PortfolioPosition, PortfolioSummary } from '../types';

interface PortfolioData {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
}

function AddPositionModal({ onAdd, onClose }: { onAdd: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    symbol: '',
    name: '',
    buy_price: '',
    buy_date: new Date().toISOString().split('T')[0],
    quantity: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol || !form.buy_price || !form.quantity) {
      setError('אנא מלא את כל השדות החובה');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await addPosition({
        symbol: form.symbol.toUpperCase(),
        name: form.name || undefined,
        buy_price: parseFloat(form.buy_price),
        buy_date: form.buy_date,
        quantity: parseFloat(form.quantity),
      });
      onAdd();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שגיאה בהוספת המניה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md" style={{ background: '#1a2235' }}>
        <h2 className="text-lg font-bold text-white mb-5">הוסף מניה לתיק</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">סימול מניה *</label>
              <input
                type="text"
                placeholder="AAPL"
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                className="w-full bg-[#111827] border border-[#2d3748] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d09c] uppercase"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">שם החברה</label>
              <input
                type="text"
                placeholder="Apple Inc."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#111827] border border-[#2d3748] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d09c]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">מחיר כניסה ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="150.00"
                value={form.buy_price}
                onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                className="w-full bg-[#111827] border border-[#2d3748] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d09c]"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">כמות *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="10"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full bg-[#111827] border border-[#2d3748] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d09c]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#94a3b8] block mb-1">תאריך כניסה *</label>
            <input
              type="date"
              value={form.buy_date}
              onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))}
              className="w-full bg-[#111827] border border-[#2d3748] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d09c]"
              required
            />
          </div>

          {error && <p className="text-[#ff4757] text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-[#0a0e1a] border-t-transparent rounded-full animate-spin" />
              ) : (
                <PlusCircle size={16} />
              )}
              הוסף לתיק
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, positive }: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  positive?: boolean;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
        positive === true ? 'bg-[#00d09c1a]' : positive === false ? 'bg-[#ff47571a]' : 'bg-[#3498db1a]'
      }`}>
        <Icon size={22} className={
          positive === true ? 'text-[#00d09c]' : positive === false ? 'text-[#ff4757]' : 'text-[#3498db]'
        } />
      </div>
      <div>
        <p className="text-xs text-[#94a3b8]">{label}</p>
        <p className="text-xl font-bold num text-white">{value}</p>
        {sub && <p className={`text-sm font-medium num ${positive === true ? 'text-[#00d09c]' : positive === false ? 'text-[#ff4757]' : 'text-[#94a3b8]'}`}>{sub}</p>}
      </div>
    </div>
  );
}

export default function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = async () => {
    try {
      const result = await getPortfolio();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRemove = async (symbol: string) => {
    try {
      await removePosition(symbol);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'שגיאה בהסרת המניה');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#00d09c] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#94a3b8]">טוען תיק...</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const positions = data?.positions ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">תיק ההשקעות שלי</h2>
          <p className="text-[#94a3b8] text-sm mt-1">מעקב מלא אחר הפוזיציות שלך</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            רענן
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusCircle size={16} />
            הוסף מניה
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="שווי תיק כולל"
            value={`$${summary.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            icon={Briefcase}
          />
          <SummaryCard
            label="סה״כ השקעה"
            value={`$${summary.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
          />
          <SummaryCard
            label="רווח / הפסד"
            value={`${summary.total_pnl >= 0 ? '+' : ''}$${summary.total_pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            sub={`${summary.total_pnl_pct >= 0 ? '+' : ''}${summary.total_pnl_pct.toFixed(2)}%`}
            icon={summary.total_pnl >= 0 ? TrendingUp : TrendingDown}
            positive={summary.total_pnl >= 0}
          />
          <SummaryCard
            label="מספר פוזיציות"
            value={`${summary.num_positions}`}
            icon={Briefcase}
          />
        </div>
      )}

      {/* Positions */}
      {positions.length === 0 ? (
        <div className="card text-center py-16">
          <Briefcase size={48} className="mx-auto text-[#2d3748] mb-4" />
          <h3 className="text-white font-semibold mb-2">התיק ריק</h3>
          <p className="text-[#94a3b8] text-sm mb-5">הוסף מניות לתיק כדי להתחיל לעקוב אחריהן</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex items-center gap-2">
            <PlusCircle size={16} />
            הוסף מניה ראשונה
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {positions.map(p => (
            <PortfolioCard key={p.symbol} position={p} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddPositionModal onAdd={fetchData} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
