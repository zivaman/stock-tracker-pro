import { NavLink, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Bell, Sun, Moon, ScanLine, DollarSign,
  Briefcase, Radar, BarChart2, Search, BookOpen, Globe,
  PanelRight, PanelTop, Settings, Eye, EyeOff, CheckCircle, XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNotifications, markAllRead, scanPortfolio, getCurrencies, getApiKeyStatus, saveApiKey } from '../api/client';
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
        const rate = (pair.startsWith('BTC') || pair.startsWith('ETH'))
          ? data.rate.toLocaleString('en-US', { maximumFractionDigits: 0 })
          : data.rate.toFixed(4);
        const prefix = pair.startsWith('BTC') ? '₿ ' : pair.startsWith('ETH') ? 'Ξ ' : '';
        return (
          <div key={pair} className="currency-item">
            <span className="currency-pair">{prefix}{pair}</span>
            <span className="currency-rate">{rate}</span>
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

/* ─── Quick Search Bar ─── */
function QuickSearch() {
  const navigate = useNavigate();
  const [val, setVal] = useState('');
  const [focused, setFocused] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = val.trim().toUpperCase();
    if (s) { navigate(`/search?q=${s}`); setVal(''); }
  };

  return (
    <form onSubmit={submit} style={{ position: 'relative' }}>
      <Search size={13} style={{
        position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
        color: focused ? 'var(--blue)' : 'var(--muted)', pointerEvents: 'none'
      }} />
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value.toUpperCase())}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="חפש מניה..."
        style={{
          background: 'var(--card2)',
          border: `1px solid ${focused ? 'var(--blue)' : 'var(--border)'}`,
          borderRadius: 8, padding: '0.32rem 1.8rem 0.32rem 0.7rem',
          color: 'var(--text)', fontSize: '.75rem', outline: 'none',
          width: 150, transition: 'all .15s', direction: 'rtl',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      />
    </form>
  );
}

/* ─── API Key Settings Modal ─── */
function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const [key, setKey]           = useState('');
  const [show, setShow]         = useState(false);
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState<'idle' | 'ok' | 'err'>('idle');
  const [msg, setMsg]           = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    getApiKeyStatus()
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true); setStatus('idle'); setMsg('');
    try {
      await saveApiKey(key.trim());
      setStatus('ok');
      setMsg('מפתח נשמר בהצלחה — כעת ניתן להשתמש ב-AI');
      setConfigured(true);
      setKey('');
    } catch (e: any) {
      setStatus('err');
      setMsg(e.response?.data?.detail || 'שגיאה בשמירת המפתח');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden',
      }}>
        {/* Accent */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)' }} />

        {/* Header */}
        <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={15} style={{ color: '#8b5cf6' }} />
            <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text)' }}>הגדרות AI</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Status badge */}
          {configured !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0.6rem 0.85rem', borderRadius: 9,
              background: configured ? 'rgba(0,200,150,.08)' : 'rgba(240,64,96,.08)',
              border: `1px solid ${configured ? 'rgba(0,200,150,.25)' : 'rgba(240,64,96,.25)'}`,
            }}>
              {configured
                ? <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                : <XCircle    size={14} style={{ color: 'var(--red)',   flexShrink: 0 }} />}
              <span style={{ fontSize: '.78rem', color: configured ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                {configured ? 'מפתח API מוגדר ופעיל' : 'מפתח API לא מוגדר — AI לא זמין'}
              </span>
            </div>
          )}

          <p style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.6 }}>
            הזן מפתח Claude API מ-<strong style={{ color: 'var(--text)' }}>console.anthropic.com</strong>.
            המפתח נשמר בשרת המקומי בלבד ולא מועבר לשום מקום אחר.
          </p>

          {/* Key input */}
          <div>
            <label style={{ fontSize: '.75rem', color: 'var(--text2)', display: 'block', marginBottom: 5, fontWeight: 600 }}>
              Anthropic API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                dir="ltr"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--card2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '0.55rem 2.4rem 0.55rem 0.85rem',
                  fontSize: '.82rem', color: 'var(--text)', outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                style={{
                  position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Feedback */}
          {msg && (
            <div style={{
              fontSize: '.78rem', padding: '0.55rem 0.8rem', borderRadius: 8,
              color: status === 'ok' ? 'var(--green)' : 'var(--red)',
              background: status === 'ok' ? 'rgba(0,200,150,.08)' : 'rgba(240,64,96,.08)',
              border: `1px solid ${status === 'ok' ? 'rgba(0,200,150,.25)' : 'rgba(240,64,96,.25)'}`,
            }}>
              {status === 'ok' ? '✓ ' : '⚠ '}{msg}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || !key.trim()}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: 9, border: 'none', cursor: saving || !key.trim() ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: '#fff',
                fontWeight: 700, fontSize: '.85rem', opacity: saving || !key.trim() ? 0.6 : 1,
              }}
            >
              {saving ? 'שומר...' : 'שמור מפתח'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.6rem 1rem', borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--card2)', color: 'var(--text2)', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer',
              }}
            >
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Navbar ─── */
function Navbar({ notifications, onScan, scanning, navSide, toggleNavSide, onOpenSettings }: {
  notifications: Notification[];
  onScan: () => void;
  scanning: boolean;
  navSide: 'top' | 'right';
  toggleNavSide: () => void;
  onOpenSettings: () => void;
}) {
  const { theme, toggle } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    getApiKeyStatus().then(d => setApiConfigured(d.configured)).catch(() => setApiConfigured(false));
  }, []);

  return (
    <nav className={navSide === 'right' ? 'navbar navbar-right-side' : 'navbar'}>
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
        <NavLink to="/search" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Search size={15} />
          <span>חיפוש מניה</span>
        </NavLink>
        <NavLink to="/indicators" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <BookOpen size={15} />
          <span>מדריך מדדים</span>
        </NavLink>
        <NavLink to="/market" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Globe size={15} />
          <span>שוק כללי</span>
        </NavLink>
      </div>

      {/* Right controls */}
      <div className="navbar-right">
        {/* Quick search */}
        <QuickSearch />

        {/* Scan */}
        <button onClick={onScan} disabled={scanning} className="btn btn-sm btn-ghost flex items-center gap-1.5">
          {scanning
            ? <span className="w-3.5 h-3.5 border-2 spin rounded-full"
                style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
            : <ScanLine size={14} />}
          <span className="hidden sm:inline">סרוק תיק</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="btn btn-sm btn-ghost"
          title="הגדרות AI"
          style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
        >
          <Settings size={14} style={{ color: apiConfigured === false ? 'var(--red)' : 'var(--muted)' }} />
          {apiConfigured === false && (
            <span style={{
              position: 'absolute', top: 1, right: 1, width: 7, height: 7,
              background: 'var(--red)', borderRadius: '50%', border: '1.5px solid var(--card)',
            }} />
          )}
        </button>

        {/* Nav side toggle */}
        <button
          onClick={toggleNavSide}
          className="btn btn-sm btn-ghost"
          title={navSide === 'top' ? 'העבר תפריט לצד ימין' : 'החזר תפריט למעלה'}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {navSide === 'top' ? <PanelRight size={14} /> : <PanelTop size={14} />}
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
const NAV_SIDE_KEY = 'nav_side_pref';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(
    () => loadCache<Notification[]>(CACHE_KEY_NOTIFS) ?? []
  );
  const [currencies, setCurrencies] = useState<CurrencyRates>(
    () => loadCache<CurrencyRates>(CACHE_KEY_CURRENCIES) ?? {}
  );
  const [scanning, setScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navSide, setNavSide] = useState<'top' | 'right'>(
    () => (localStorage.getItem(NAV_SIDE_KEY) as 'top' | 'right') ?? 'top'
  );

  const toggleNavSide = () => {
    setNavSide(s => {
      const next = s === 'top' ? 'right' : 'top';
      localStorage.setItem(NAV_SIDE_KEY, next);
      return next;
    });
  };

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
    <div className={`app-shell ${navSide === 'right' ? 'nav-right' : ''}`}>
      <Navbar
        notifications={notifications}
        onScan={handleScan}
        scanning={scanning}
        navSide={navSide}
        toggleNavSide={toggleNavSide}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && <ApiKeyModal onClose={() => setShowSettings(false)} />}
      <div className="below-nav">
        <CurrencyTicker currencies={currencies} />
        <main className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          נתונים: Yahoo Finance · אינם ייעוץ השקעות · מדד זיו — מעקב דיוק פנימי
        </footer>
      </div>
    </div>
  );
}
