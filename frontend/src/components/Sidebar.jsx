import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import {
  Leaf, LayoutDashboard, FileText, Users,
  BarChart2, LogOut, X, Building2, ShieldCheck, UserCog,
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
  const { language, logout, currentUser, isSuperior, tick,
          getPendingVerificationsCount } = useApp();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Re-render on context tick for real-time badge updates
  // eslint-disable-next-line no-unused-vars
  const _ = tick;
  const verificationPending = currentUser ? getPendingVerificationsCount(currentUser.id) : 0;

  const handleLogout = () => { logout(); navigate('/login'); };

  // Common items both roles see — "Requests" renamed to "Verification Requests"
  // with a badge reflecting pending verification requests involving the current user.
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

  // Superior-only: Company Profile, Admin Management
  const SUPERIOR_ITEMS = [
    { to: '/dashboard/company-profile', label: 'companyProfile', icon: Building2 },
    { to: '/dashboard/admin-management', label: 'adminManagement', icon: ShieldCheck },
  ];

  // My Account is for both roles
  const ACCOUNT_ITEM = { to: '/dashboard/my-account', label: 'myAccount', icon: UserCog };

  return (
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col
      transform transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Eco Pest
            </p>
            <p className="text-slate-400 text-xs">Solutions</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* User Info */}
      {currentUser && (
        <div className="mx-4 mt-4 p-3 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold truncate">{currentUser.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              currentUser.role === 'superior' ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'
            }`}>
              {currentUser.role === 'superior' ? 'Superior' : 'Assistant'}
            </span>
          </div>
          <p className="text-green-400 text-xs mt-0.5">{currentUser.employeeId}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-4 pt-2 pb-1">Main Menu</p>

        {COMMON_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} data-testid={`nav-${label}`} onClick={onClose}
            className={({ isActive }) => `
              sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${isActive ? 'bg-green-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
            `}>
            <Icon size={18} />
            <span className="flex-1">{t(language, label)}</span>
            {badge && (
              <span data-testid={`badge-${label}`} className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </NavLink>
        ))}

        {/* Superior-only: Administration */}
        {isSuperior() && (
          <>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-1">Administration</p>
            {SUPERIOR_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} data-testid={`nav-${label}`} onClick={onClose}
                className={({ isActive }) => `
                  sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${isActive ? 'bg-green-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                `}>
                <Icon size={18} />
                <span>{t(language, label)}</span>
              </NavLink>
            ))}
          </>
        )}

        {/* Account section — visible to all */}
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-1">Account</p>
        <NavLink to={ACCOUNT_ITEM.to} data-testid={`nav-${ACCOUNT_ITEM.label}`} onClick={onClose}
          className={({ isActive }) => `
            sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
            ${isActive ? 'bg-green-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
          `}>
          <ACCOUNT_ITEM.icon size={18} />
          <span>{t(language, ACCOUNT_ITEM.label)}</span>
        </NavLink>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700">
        <button data-testid="logout-button" onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all">
          <LogOut size={18} />
          <span>{t(language, 'logout')}</span>
        </button>
      </div>

      {/* Confirm-logout modal — replaces an immediate logout to prevent accidental session loss */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl fade-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <LogOut size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Confirm logout?
                </h3>
                <p className="text-slate-600 text-sm mt-1">
                  You&apos;ll need to sign back in with your email/OTP to continue using Eco Pest Solutions.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button data-testid="cancel-logout-btn"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">
                {t(language, 'cancel')}
              </button>
              <button data-testid="confirm-logout-btn"
                onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                {t(language, 'logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
