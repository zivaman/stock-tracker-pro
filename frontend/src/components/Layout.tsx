import { NavLink } from 'react-router-dom';
import {
  TrendingUp, Bell, Sun, Moon, ScanLine, DollarSign,
  Briefcase, Radar, BarChart2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNotifications, markAllRead, scanPortfolio, getCurrencies } from '../api/client';
import { useTheme } from '../ThemeContext';
import type { Notification } from '../types';

interface CurrencyRates {
  [pair: string]: { rate: number; change_pct: number };
}

const CACHE_KEY_CURRENCIES = 'cache_currencies';
const CACHE_KEY_NOTIFS = 'cache_notifications';

function loadCache<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function saveCache<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

/* ─── Currency Ticker ─── */
function CurrencyTicker({ currencies }: { currencies: CurrencyRates }) {
  const entries = Object.entries(currencies);
  if (entries.length === 0) return null;
  return (
    <div className="currency-bar">
      <span className="currency-label">
        <DollarSign size={10} /> שערי מטבע
      </span>
      {entries.map(([pair, data]) => {
        const pos = data.change_pct >= 0;
        return (
          <div key={pair} className="currency-item">
            <span className="currency-pair">{pair}</span>
            <span className="currency-rate">{data.rate.toFixed(4)}</span>
            <span className="currency-change" style={{ color: pos ? 'var(--green)' : 'var(--red)' }}>
              {pos ? '+' : ''}{data.change_pct.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Notifications Panel ─── */
function NotifPanel({ notifications, show, onClose }: {
  notifications: Notification[];
  show: boolean;
  onClose: () => void;
}) {
  const unread = notifications.filter(n => !n.read).length;
  if (!show) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="notif-panel">
        <div className="notif-header">
          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '.85rem' }}>
            התראות{unread > 0 &&
              <span className="notif-badge">{unread}</span>}
          </span>
          {unread > 0 && (
            <button onClick={markAllRead} className="notif-mark-read">
              סמן הכל כנקרא
            </button>
          )}
        </div>
        <div className="notif-body">
          {notifications.length === 0
            ? <p className="notif-empty">אין התראות</p>
            : notifications.slice(0, 20).map(n => (
              <div key={n.id} className="notif-row"
                style={{ background: !n.read ? 'var(--hover)' : 'transparent' }}>
                <div className={`notif-dot ${!n.read ? 'pulse' : 'opacity-0'}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text)' }}>{n.symbol}</span>
                    <span className={n.signal_type === 'buy' ? 'tag tag-buy' : 'tag tag-sell'}>
                      {n.signal_type === 'buy' ? '▲ קנייה' : '▼ מכירה'}
                    </span>
                  </div>
                  <p style={{ fontSize: '.72rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                  <p style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: 2 }}>
                    {new Date(n.created_at).toLocaleString('he-IL')}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

/* ─── Main Navbar ─── */
function Navbar({ notifications, onScan, scanning }: {
  notifications: Notification[];
  onScan: () => void;
  scanning: boolean;
}) {
  const { theme, toggle } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <nav className="navbar">
      {/* Logo */}
      <div className="navbar-logo">
        <div className="logo-icon">
          <TrendingUp size={15} color="#fff" />
        </div>
        <span className="logo-text">StockTracker</span>
      </div>

      {/* Nav links */}
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Briefcase size={15} />
          <span>התיק שלי</span>
        </NavLink>
        <NavLink to="/radar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Radar size={15} />
          <span>המלצות מניות</span>
        </NavLink>
        <NavLink to="/ziv-index" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <BarChart2 size={15} />
          <span>מדד זיו</span>
        </NavLink>
      </div>

      {/* Right controls */}
      <div className="navbar-right">
        {/* Scan */}
        <button onClick={onScan} disabled={scanning} className="btn btn-sm btn-ghost flex items-center gap-1.5">
          {scanning
            ? <span className="w-3.5 h-3.5 border-2 spin rounded-full"
                style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
            : <ScanLine size={14} />}
          <span className="hidden sm:inline">סרוק תיק</span>
        </button>

        {/* Theme toggle */}
        <button onClick={toggle} className="theme-toggle" title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}>
          <div className="theme-track" style={{ background: theme === 'dark' ? 'var(--border2)' : 'var(--blue)' }}>
            <div className="theme-thumb" style={{ right: theme === 'dark' ? '0.125rem' : 'calc(100% - 1.25rem)' }} />
          </div>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          <span className="hidden sm:inline" style={{ fontSize: '.72rem', fontWeight: 600 }}>
            {theme === 'dark' ? 'בהיר' : 'כהה'}
          </span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotifs(v => !v)}
            className="btn btn-sm btn-ghost notif-btn relative">
            <Bell size={15} />
            {unread > 0 && (
              <span className="notif-count">{unread > 9 ? '9+' : unread}</span>
            )}
          </button>
          <NotifPanel
            notifications={notifications}
            show={showNotifs}
            onClose={() => setShowNotifs(false)}
          />
        </div>
      </div>
    </nav>
  );
}

/* ─── Main Layout ─── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(
    () => loadCache<Notification[]>(CACHE_KEY_NOTIFS) ?? []
  );
  const [currencies, setCurrencies] = useState<CurrencyRates>(
    () => loadCache<CurrencyRates>(CACHE_KEY_CURRENCIES) ?? {}
  );
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const loadNotifs = () =>
      getNotifications()
        .then(n => { setNotifications(n); saveCache(CACHE_KEY_NOTIFS, n); })
        .catch(() => {});

    const loadCurrencies = () =>
      getCurrencies()
        .then(d => { const r = d.rates || {}; setCurrencies(r); saveCache(CACHE_KEY_CURRENCIES, r); })
        .catch(() => {});

    loadNotifs();
    loadCurrencies();

    const i1 = setInterval(loadNotifs, 60_000);
    const i2 = setInterval(loadCurrencies, 300_000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await scanPortfolio();
      const n = await getNotifications();
      setNotifications(n);
      saveCache(CACHE_KEY_NOTIFS, n);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar notifications={notifications} onScan={handleScan} scanning={scanning} />
      <CurrencyTicker currencies={currencies} />
      <main className="main-content">
        {children}
      </main>
      <footer className="app-footer">
        נתונים: Yahoo Finance · אינם ייעוץ השקעות · מדד זיו — מעקב דיוק פנימי
      </footer>
    </div>
  );
}
