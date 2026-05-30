import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import {
  Leaf,
  LayoutDashboard,
  FileText,
  Users,
  BarChart2,
  LogOut,
  X,
  Building2,
  ShieldCheck,
  UserCog,
  Sparkles,
  Activity,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
  const { language, logout, currentUser, isSuperior, tick, getPendingVerificationsCount } = useApp();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Re-render on context tick for real-time badge updates
  // eslint-disable-next-line no-unused-vars
  const _ = tick;

  const verificationPending = currentUser ? getPendingVerificationsCount(currentUser.id) : 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const COMMON_ITEMS = [
    { to: '/dashboard', label: 'dashboard', icon: LayoutDashboard, end: true },
    { to: '/dashboard/bill-generate', label: 'billGenerate', icon: FileText },
    { to: '/dashboard/customers', label: 'customers', icon: Users },
    { to: '/dashboard/bill-summary', label: 'billSummary', icon: BarChart2 },
    {
      to: '/dashboard/verification-requests',
      label: 'verificationRequests',
      icon: ShieldCheck,
      badge: verificationPending > 0 ? verificationPending : null,
    },
  ];

  const SUPERIOR_ITEMS = [
    { to: '/dashboard/company-profile', label: 'companyProfile', icon: Building2 },
    { to: '/dashboard/admin-management', label: 'adminManagement', icon: ShieldCheck },
  ];

  const ACCOUNT_ITEM = { to: '/dashboard/my-account', label: 'myAccount', icon: UserCog };

  const NavItem = ({ to, label, icon: Icon, end, badge }) => (
    <NavLink
      to={to}
      end={end}
      data-testid={`nav-${label}`}
      onClick={onClose}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300',
          isActive
            ? 'bg-white text-slate-900 shadow-[0_12px_30px_rgba(16,185,129,0.15)]'
            : 'text-slate-300 hover:bg-white/10 hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300',
              isActive
                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_10px_25px_rgba(16,185,129,0.28)]'
                : 'bg-white/5 text-emerald-200 group-hover:bg-white/10 group-hover:text-white',
            ].join(' ')}
          >
            <Icon size={18} />
          </span>

          <span className="flex-1">{t(language, label)}</span>

          {badge ? (
            <span
              data-testid={`badge-${label}`}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white shadow-sm"
            >
              {badge > 9 ? '9+' : badge}
            </span>
          ) : (
            <ChevronRight size={14} className="text-slate-400 opacity-0 transition-all group-hover:opacity-100" />
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden border-r border-white/10 bg-[#07111a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.30)]',
          'transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Background accents */}
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />

        {/* Logo */}
        <div className="relative border-b border-white/10 px-5 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-[0_12px_30px_rgba(16,185,129,0.25)]">
                <Leaf size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Eco Pest
                </p>
                <p className="text-xs text-slate-400">Solutions</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <Sparkles size={12} />
              Dashboard Control
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Manage bills, customers, verification, and company settings from one clean panel.
            </p>
          </div> */}
        </div>

        {/* User Info */}
        {currentUser && (
          <div className="relative mx-4 mt-4 rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{currentUser.name}</p>
                <p className="mt-0.5 text-xs text-emerald-200">{currentUser.employeeId}</p>
              </div>
              <span
                className={[
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  currentUser.role === 'superior'
                    ? 'bg-violet-500/15 text-violet-200'
                    : 'bg-sky-500/15 text-sky-200',
                ].join(' ')}
              >
                {currentUser.role === 'superior' ? 'Superior' : 'Assistant'}
              </span>
            </div>

            {/* <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Activity size={12} className="text-emerald-300" />
              <span>Live badge updates enabled</span>
            </div> */}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-4 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Main Menu
          </p>

          {COMMON_ITEMS.map(({ to, label, icon, end, badge }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={end} badge={badge} />
          ))}

          {isSuperior() && (
            <>
              <p className="px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Administration
              </p>
              {SUPERIOR_ITEMS.map(({ to, label, icon, end }) => (
                <NavItem key={to} to={to} label={label} icon={icon} end={end} />
              ))}
            </>
          )}

          <p className="px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Account
          </p>
          <NavItem to={ACCOUNT_ITEM.to} label={ACCOUNT_ITEM.label} icon={ACCOUNT_ITEM.icon} />
        </nav>

        {/* Logout */}
        <div className="relative border-t border-white/10 p-4">
          <button
            data-testid="logout-button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/10 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition-all hover:bg-rose-500/20 hover:text-white"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
              <LogOut size={18} />
            </span>
            <span>{t(language, 'logout')}</span>
          </button>
        </div>
      </aside>

      {/* Confirm-logout modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="bg-gradient-to-r from-rose-500 to-red-500 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                  <LogOut size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Confirm logout?
                  </h3>
                  <p className="text-sm text-white/90">You&apos;ll need to sign back in to continue.</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex gap-3">
                <button
                  data-testid="cancel-logout-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {t(language, 'cancel')}
                </button>
                <button
                  data-testid="confirm-logout-btn"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(244,63,94,0.20)] transition-transform hover:-translate-y-0.5"
                >
                  {t(language, 'logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}