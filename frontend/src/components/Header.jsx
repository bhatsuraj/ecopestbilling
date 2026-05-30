import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { Menu, Moon, Sun, User, Bell, CheckCheck, Trash2 } from 'lucide-react';

const LANG_OPTIONS = [
  { code: 'en', label: 'EN' },
];

// Relative time helper — keeps notifications looking live (e.g., "2 min ago")
const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

export default function Header({ onMenuClick }) {
  const {
    language, setLanguage, darkMode, setDarkMode, currentUser, tick,
    getNotifications, getUnreadCount, markAllRead, clearNotifications,
  } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Re-render when context tick bumps (new notifications)
  // eslint-disable-next-line no-unused-vars
  const _ = tick;

  const notifs = currentUser ? getNotifications(currentUser.id) : [];
  const unread = currentUser ? getUnreadCount(currentUser.id)   : 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onItemClick = (n) => {
    setOpen(false);
    if (currentUser) markAllRead(currentUser.id);
    if (n.link) navigate(n.link);
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button data-testid="menu-toggle-button" onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
          <Menu size={20} />
        </button>
        <div className="hidden lg:block">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Eco Pest Solutions</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Language switcher */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {LANG_OPTIONS.map(l => (
            <button key={l.code} data-testid={`lang-btn-${l.code}`}
              onClick={() => setLanguage(l.code)}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                language === l.code ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Dark mode */}
        <button data-testid="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={ref}>
          <button data-testid="notification-bell" onClick={() => setOpen(o => !o)}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            title={`${unread} unread notification${unread !== 1 ? 's' : ''}`}>
            <Bell size={18} />
            {unread > 0 && (
              <span data-testid="notification-badge" className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <div data-testid="notification-dropdown" className="absolute right-0 mt-2 w-[340px] max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="font-bold text-slate-900 text-sm">{t(language, 'notifications')}</p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button data-testid="mark-all-read-btn"
                      onClick={() => currentUser && markAllRead(currentUser.id)}
                      title={t(language, 'markAllRead')}
                      className="text-xs text-green-700 hover:bg-green-50 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <CheckCheck size={12} /> {t(language, 'markAllRead')}
                    </button>
                  )}
                  {notifs.length > 0 && (
                    <button data-testid="clear-notifications-btn"
                      onClick={() => currentUser && clearNotifications(currentUser.id)}
                      title={t(language, 'clearAll')}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    {t(language, 'noNotifications')}
                  </div>
                ) : (
                  notifs.map(n => (
                    <button key={n.id}
                      data-testid={`notif-${n.id}`}
                      onClick={() => onItemClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        !n.read ? 'bg-green-50/60' : ''
                      }`}>
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-green-600 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
        {currentUser && (
          <div data-testid="user-info" className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <User size={16} className="text-green-700" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">{currentUser.name}</p>
              <p className="text-xs text-green-600">{currentUser.employeeId} · {currentUser.role === 'superior' ? 'Superior' : 'Assistant'}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
