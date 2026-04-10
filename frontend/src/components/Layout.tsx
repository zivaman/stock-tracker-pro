import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Radar, Bell, TrendingUp, DollarSign, Sun, Moon, BarChart2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNotifications, markAllRead, scanPortfolio, getCurrencies } from '../api/client';
import { useTheme } from '../ThemeContext';
import type { Notification } from '../types';

interface CurrencyRates {
  [pair: string]: { rate: number; change_pct: number; month_change: number | null };
}

function CurrencyBar({ rates }: { rates: CurrencyRates }) {
  const pairs = Object.entries(rates);
  if (pairs.length === 0) return null;
  return (
    <div className="border-b px-6 py-1.5 flex items-center gap-6 overflow-x-auto text-xs"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      <span className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        <DollarSign size={10} /> שערי מטבע
      </span>
      {pairs.map(([pair, data]) => {
        const isPos = data.change_pct >= 0;
        return (
          <div key={pair} className="flex items-center gap-2 flex-shrink-0">
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{pair}</span>
            <span className="font-bold num" style={{ color: 'var(--text-primary)' }}>{data.rate.toFixed(4)}</span>
            <span className="num font-medium" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
              {isPos ? '+' : ''}{data.change_pct.toFixed(3)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currencies, setCurrencies] = useState<CurrencyRates>({});

  const unread = notifications.filter(n => !n.read).length;

  const fetchNotifs = async () => {
    try { setNotifications(await getNotifications()); } catch {}
  };
  const fetchCurrencies = async () => {
    try { const d = await getCurrencies(); setCurrencies(d.rates || {}); } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    fetchCurrencies();
    const i1 = setInterval(fetchNotifs, 60_000);
    const i2 = setInterval(fetchCurrencies, 300_000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try { await scanPortfolio(); await fetchNotifs(); } finally { setScanning(false); }
  };

  const navItems = [
    { to: '/',           label: 'תיק השקעות', icon: LayoutDashboard },
    { to: '/radar',      label: 'מכ"ם מניות',  icon: Radar },
    { to: '/ziv-index',  label: 'מדד זיו',      icon: BarChart2 },
  ];

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between sticky top-0 z-50"
        style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <TrendingUp style={{ color: 'var(--green)' }} size={26} />
          <div>
            <h1 className="text-lg font-bold leading-none" style={{ color: 'white' }}>StockTracker Pro</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>מערכת מעקב מניות מקצועית</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'border' : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => isActive
                ? { color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--green) 30%, transparent)' }
                : { color: 'var(--text-secondary)' }
              }
            >
              <Icon size={15} />{label}
            </NavLink>
          ))}

          <button onClick={handleScan} disabled={scanning}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ml-1"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
            {scanning
              ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
              : <Radar size={15} />}
            סרוק תיק
          </button>

          {/* Light/Dark toggle */}
          <button onClick={toggle}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors border ml-1"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            title={isDark ? 'מצב בהיר' : 'מצב כהה'}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Notifications */}
          <div className="relative ml-1">
            <button onClick={() => setShowNotifs(v => !v)}
              className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-1 -left-1 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--red)' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute left-0 top-11 w-96 rounded-xl border shadow-2xl z-50 overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>התראות</span>
                  {unread > 0 && (
                    <button onClick={async () => { await markAllRead(); setNotifications(p => p.map(n => ({ ...n, read: true }))); }}
                      className="text-xs hover:underline" style={{ color: 'var(--green)' }}>
                      סמן הכל כנקרא
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0
                    ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>אין התראות</p>
                    : notifications.slice(0, 20).map(n => (
                      <div key={n.id} className="px-4 py-3 border-b last:border-0"
                        style={{ borderColor: 'var(--border)', background: !n.read ? 'var(--bg-hover)' : 'transparent' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{n.symbol}</span>
                              <span className={n.signal_type === 'buy' ? 'tag-buy' : 'tag-sell'}>
                                {n.signal_type === 'buy' ? 'קנייה' : 'מכירה'}
                              </span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                              {new Date(n.created_at).toLocaleString('he-IL')}
                            </p>
                          </div>
                          {!n.read && <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: 'var(--green)' }} />}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>

      {showNotifs && <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />}

      <CurrencyBar rates={currencies} />

      <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">
        {children}
      </main>

      <footer className="border-t px-6 py-3 text-center" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          הנתונים מסופקים ע"י Yahoo Finance · אינם מהווים ייעוץ השקעות · מדד זיו — מעקב דיוק המלצות פנימי
        </p>
      </footer>
    </div>
  );
}
