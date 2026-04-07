import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radar, Bell, TrendingUp, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNotifications, markAllRead, scanPortfolio, getCurrencies } from '../api/client';
import type { Notification } from '../types';

interface CurrencyRates {
  [pair: string]: { rate: number; change_pct: number; month_change: number | null };
}

function CurrencyBar({ rates }: { rates: CurrencyRates }) {
  const pairs = Object.entries(rates);
  if (pairs.length === 0) return null;
  return (
    <div className="border-b border-[#2d3748] px-6 py-1.5 flex items-center gap-6 overflow-x-auto" style={{ background: '#0d1526' }}>
      <span className="flex items-center gap-1 text-[10px] text-[#475569] flex-shrink-0">
        <DollarSign size={10} />
        שערי מטבע
      </span>
      {pairs.map(([pair, data]) => {
        const isPos = data.change_pct >= 0;
        return (
          <div key={pair} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-semibold text-[#94a3b8]">{pair}</span>
            <span className="text-[11px] font-bold num text-white">{data.rate.toFixed(4)}</span>
            <span className={`text-[10px] num font-medium ${isPos ? 'text-[#00d09c]' : 'text-[#ff4757]'}`}>
              {isPos ? '+' : ''}{data.change_pct.toFixed(3)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currencies, setCurrencies] = useState<CurrencyRates>({});
  const location = useLocation();

  const unread = notifications.filter(n => !n.read).length;

  const fetchNotifs = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {}
  };

  const fetchCurrencies = async () => {
    try {
      const data = await getCurrencies();
      setCurrencies(data.rates || {});
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    fetchCurrencies();
    const interval = setInterval(fetchNotifs, 60_000);
    const currInterval = setInterval(fetchCurrencies, 300_000); // every 5 min
    return () => {
      clearInterval(interval);
      clearInterval(currInterval);
    };
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanPortfolio();
      await fetchNotifs();
    } finally {
      setScanning(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const navItems = [
    { to: '/', label: 'תיק השקעות', icon: LayoutDashboard },
    { to: '/radar', label: 'מכ"ם מניות', icon: Radar },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0e1a' }}>
      {/* Header */}
      <header className="border-b border-[#2d3748] px-6 py-4 flex items-center justify-between sticky top-0 z-50" style={{ background: '#0d1526' }}>
        <div className="flex items-center gap-3">
          <TrendingUp className="text-[#00d09c]" size={28} />
          <div>
            <h1 className="text-xl font-bold text-white leading-none">StockTracker Pro</h1>
            <p className="text-xs text-[#94a3b8] mt-0.5">מערכת מעקב מניות מקצועית</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#00d09c1a] text-[#00d09c] border border-[#00d09c33]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1e2d47]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          {/* Scan portfolio button */}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1e2d47] text-[#94a3b8] hover:text-white hover:bg-[#2d3f5e] transition-colors border border-[#2d3748] disabled:opacity-50"
          >
            {scanning ? (
              <span className="inline-block w-4 h-4 border-2 border-[#00d09c] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Radar size={16} />
            )}
            סרוק תיק
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(v => !v)}
              className="relative flex items-center justify-center w-10 h-10 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#1e2d47] transition-colors"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-1 -left-1 bg-[#ff4757] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div
                className="absolute left-0 top-12 w-96 rounded-xl border border-[#2d3748] shadow-2xl z-50 overflow-hidden"
                style={{ background: '#1a2235' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3748]">
                  <span className="font-semibold text-white">התראות</span>
                  {unread > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#00d09c] hover:underline"
                    >
                      סמן הכל כנקרא
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-[#94a3b8] text-sm text-center py-8">אין התראות</p>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-[#2d3748] last:border-0 ${
                          !n.read ? 'bg-[#1e2d47]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-white">{n.symbol}</span>
                              <span className={n.signal_type === 'buy' ? 'tag-buy' : 'tag-sell'}>
                                {n.signal_type === 'buy' ? 'קנייה' : 'מכירה'}
                              </span>
                            </div>
                            <p className="text-xs text-[#94a3b8]">{n.message}</p>
                            <p className="text-[10px] text-[#64748b] mt-1">
                              {new Date(n.created_at).toLocaleString('he-IL')}
                            </p>
                          </div>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-[#00d09c] mt-1 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Click outside to close */}
      {showNotifs && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifs(false)}
        />
      )}

      {/* Currency ticker bar */}
      <CurrencyBar rates={currencies} />

      {/* Main content */}
      <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2d3748] px-6 py-3 text-center">
        <p className="text-xs text-[#475569]">
          הנתונים מסופקים ע"י Yahoo Finance ומיועדים למטרות מידע בלבד · אינם מהווים ייעוץ השקעות
        </p>
      </footer>
    </div>
  );
}
