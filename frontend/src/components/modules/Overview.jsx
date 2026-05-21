import React from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { formatDateDDMMYY } from '../../lib/date';
import { FileText, Users, ShieldCheck, TrendingUp, Calendar, ArrowRight, Inbox, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Overview() {
  const {
    language, currentUser, tick,
    getBills, getCustomers,
    getVerificationRequestsFor, getVerificationRequestsSentBy,
  } = useApp();
  const navigate = useNavigate();

  // Re-render on context tick (cross-tab sync, instant updates after sending/receiving requests)
  // eslint-disable-next-line no-unused-vars
  const _ = tick;

  const bills = getBills();
  const customers = getCustomers();

  // Verification request buckets — only count "pending" status to match the Sidebar badge logic
  const received = currentUser ? getVerificationRequestsFor(currentUser.id).filter(b => (b.status || 'pending') === 'pending') : [];
  const sent     = currentUser ? getVerificationRequestsSentBy(currentUser.id).filter(b => (b.status || 'pending') === 'pending') : [];

  const totalRevenue = bills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);
  const recentBills  = [...bills].reverse().slice(0, 5);

  return (
    <div className="fade-in space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 rounded-2xl p-6 text-white">
        <p className="text-green-100 text-sm font-medium">{t(language, 'welcomeBack')}</p>
        <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {currentUser?.name}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
            {currentUser?.employeeId}
          </span>
          <span className="text-green-100 text-xs flex items-center gap-1">
            <Calendar size={12} />
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bills */}
        <div className="stat-card bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <FileText size={20} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>{bills.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t(language, 'totalBills')}</p>
        </div>

        {/* Total Customers */}
        <div className="stat-card bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3">
            <Users size={20} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>{customers.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t(language, 'totalCustomers')}</p>
        </div>

        {/* Pending Verifications — split card showing both received and sent counts */}
        <button
          onClick={() => navigate('/dashboard/verification-requests')}
          data-testid="pending-requests-card"
          className="stat-card bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-left hover:border-amber-300 transition-colors">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
            <ShieldCheck size={20} className="text-amber-600" />
          </div>
          <div className="flex items-stretch">
            {/* Received */}
            <div className="flex-1 pr-3" data-testid="pending-received">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                <Inbox size={10} /> Received
              </div>
              <p className="text-2xl font-bold text-amber-600 leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {received.length}
              </p>
            </div>
            {/* Vertical divider */}
            <div className="w-px bg-slate-200 mx-1" />
            {/* Sent */}
            <div className="flex-1 pl-3" data-testid="pending-sent">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                <Send size={10} /> Sent
              </div>
              <p className="text-2xl font-bold text-indigo-600 leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {sent.length}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">{t(language, 'pendingRequests')}</p>
        </button>

        {/* Total Revenue */}
        <div className="stat-card bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp size={20} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            ₹{totalRevenue.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t(language, 'totalRevenue')}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t(language, 'billGenerate'), path: '/dashboard/bill-generate', color: 'border-green-200 hover:border-green-400' },
          { label: t(language, 'customers'), path: '/dashboard/customers', color: 'border-blue-200 hover:border-blue-400' },
          { label: t(language, 'verificationRequests'), path: '/dashboard/verification-requests', color: 'border-amber-200 hover:border-amber-400' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className={`flex items-center justify-between p-4 bg-white rounded-xl border-2 ${item.color} transition-all hover:shadow-sm`}>
            <span className="font-semibold text-slate-700 text-sm">{item.label}</span>
            <ArrowRight size={16} className="text-slate-400" />
          </button>
        ))}
      </div>

      {/* Recent Bills */}
      {recentBills.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {t(language, 'recentBills')}
            </h3>
            <button onClick={() => navigate('/dashboard/bill-summary')} className="text-green-700 text-sm font-medium hover:text-green-800">
              View All →
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentBills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{bill.billNumber}</p>
                  <p className="text-xs text-slate-500">{bill.customerName} • {formatDateDDMMYY(bill.date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">₹{(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bill.type === 'tax' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>
                    {bill.type === 'tax' ? t(language, 'tax') : t(language, 'cashless')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
