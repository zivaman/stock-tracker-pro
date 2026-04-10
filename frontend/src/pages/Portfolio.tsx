import { useEffect, useState } from 'react';
import { PlusCircle, RefreshCw, TrendingUp, TrendingDown, DollarSign, Briefcase, WifiOff } from 'lucide-react';
import { getPortfolio, addPosition, removePosition } from '../api/client';
import PortfolioCard from '../components/PortfolioCard';
import type { PortfolioPosition, PortfolioSummary } from '../types';

const CACHE_KEY = 'cache_portfolio';

interface PortfolioData {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
}

function loadCache(): PortfolioData | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function saveCache(data: PortfolioData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

/* ─── Add Modal ─── */
function AddPositionModal({ onAdd, onClose }: { onAdd: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    symbol: '', name: '',
    buy_price: '',
    buy_date: new Date().toISOString().split('T')[0],
    quantity: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol || !form.buy_price || !form.quantity) { setError('אנא מלא את כל השדות החובה'); return; }
    setLoading(true); setError('');
    try {
      await addPosition({
        symbol: form.symbol.toUpperCase(),
        name: form.name || undefined,
        buy_price: parseFloat(form.buy_price),
        buy_date: form.buy_date,
        quantity: parseFloat(form.quantity),
      });
      onAdd(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שגיאה בהוספת המניה');
    } finally { setLoading(false); }
  };

  const inp = "w-full bg-[#111827] border border-[#2d3748] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00d09c]";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md" style={{ background: 'var(--card)' }}>
        <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--text)' }}>הוסף מניה לתיק</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text2)' }}>סימול מניה *</label>
              <input type="text" placeholder="AAPL" value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                className={inp} style={{ color: 'var(--text)' }} required />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text2)' }}>שם החברה</label>
              <input type="text" placeholder="Apple Inc." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inp} style={{ color: 'var(--text)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text2)' }}>מחיר כניסה ($) *</label>
              <input type="number" step="0.01" min="0" placeholder="150.00" value={form.buy_price}
                onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                className={inp} style={{ color: 'var(--text)' }} required />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text2)' }}>כמות *</label>
              <input type="number" step="0.001" min="0" placeholder="10" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className={inp} style={{ color: 'var(--text)' }} required />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text2)' }}>תאריך כניסה *</label>
            <input type="date" value={form.buy_date}
              onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))}
              className={inp} style={{ color: 'var(--text)' }} required />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading
                ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full spin" />
                : <PlusCircle size={16} />}
              הוסף לתיק
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Summary Card ─── */
function SummaryCard({ label, value, sub, icon: Icon, positive }: {
  label: string; value: string; sub?: string; icon: any; positive?: boolean;
}) {
  const color = positive === true ? 'var(--green)' : positive === false ? 'var(--red)' : 'var(--blue)';
  return (
    <div className="card flex items-center gap-4">
      <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1a`, flexShrink: 0 }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: '.72rem', color: 'var(--text2)' }}>{label}</p>
        <p className="num" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{value}</p>
        {sub && <p className="num" style={{ fontSize: '.78rem', fontWeight: 600, color, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(() => loadCache());
  const [loading, setLoading] = useState(!loadCache());
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await getPortfolio();
      setData(result);
      saveCache(result);
      setOffline(false);
    } catch (err) {
      console.error(err);
      setOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => fetchData(true);

  const handleRemove = async (symbol: string) => {
    try { await removePosition(symbol); fetchData(); }
    catch (err: any) { alert(err.response?.data?.detail || 'שגיאה בהסרת המניה'); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="w-10 h-10 border-2 rounded-full spin mx-auto mb-3"
          style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
        <p style={{ color: 'var(--text2)' }}>טוען תיק...</p>
      </div>
    </div>
  );

  const summary = data?.summary;
  const positions = data?.positions ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>התיק שלי</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: 2 }}>מעקב מלא אחר הפוזיציות שלך</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> רענן
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <PlusCircle size={15} /> הוסף מניה
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div style={{ background: 'rgba(245,197,24,.08)', border: '1px solid rgba(245,197,24,.3)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={15} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <p style={{ fontSize: '.82rem', color: 'var(--yellow)' }}>
            אין חיבור לשוק — מציג נתוני cache אחרונים. הנתונים עשויים להיות לא עדכניים.
          </p>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="שווי תיק" value={`$${summary.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={Briefcase} />
          <SummaryCard label="סה״כ השקעה" value={`$${summary.total_invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={DollarSign} />
          <SummaryCard
            label="רווח / הפסד"
            value={`${summary.total_pnl >= 0 ? '+' : ''}$${summary.total_pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            sub={`${summary.total_pnl_pct >= 0 ? '+' : ''}${summary.total_pnl_pct.toFixed(2)}%`}
            icon={summary.total_pnl >= 0 ? TrendingUp : TrendingDown}
            positive={summary.total_pnl >= 0}
          />
          <SummaryCard label="פוזיציות" value={`${summary.num_positions}`} icon={Briefcase} />
        </div>
      )}

      {/* Grid */}
      {positions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <Briefcase size={48} style={{ margin: '0 auto 1rem', color: 'var(--border2)' }} />
          <h3 style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>התיק ריק</h3>
          <p style={{ color: 'var(--text2)', fontSize: '.85rem', marginBottom: 16 }}>הוסף מניות לתיק כדי להתחיל לעקוב אחריהן</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex items-center gap-2">
            <PlusCircle size={15} /> הוסף מניה ראשונה
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {positions.map(p => (
            <PortfolioCard key={p.symbol} position={p} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {showAddModal && <AddPositionModal onAdd={() => fetchData()} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
