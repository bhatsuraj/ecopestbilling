import React from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { formatDateDDMMYY } from '../../lib/date';
import {
  FileText,
  Users,
  ShieldCheck,
  TrendingUp,
  Calendar,
  ArrowRight,
  Inbox,
  Send,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, accent = 'emerald', testId }) {
  const accentClasses = {
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    blue: {
      iconBg: 'bg-sky-50 text-sky-600',
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-600',
    },
    purple: {
      iconBg: 'bg-violet-50 text-violet-600',
    },
  };

  const style = accentClasses[accent] || accentClasses.emerald;

  return (
    <div
      data-testid={testId}
      className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p
            className="mt-3 text-3xl font-bold text-slate-900"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${style.iconBg} shadow-lg shadow-black/5`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ label, icon: Icon, color = 'emerald', onClick }) {
  const colorClasses = {
    emerald: {
      iconBg: 'bg-emerald-500 text-white',
    },
    blue: {
      iconBg: 'bg-sky-500 text-white',
    },
    amber: {
      iconBg: 'bg-amber-500 text-white',
    },
  };

  const style = colorClasses[color] || colorClasses.emerald;

  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-between rounded-[24px] border border-white/80 bg-white/85 p-5 text-left shadow-[0_14px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.10)]"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${style.iconBg} shadow-lg`}
        >
          <Icon size={16} />
        </div>

        <span className="text-sm font-semibold text-slate-800">
          {label}
        </span>
      </div>

      <ArrowRight
        size={16}
        className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1"
      />
    </button>
  );
}

export default function Overview() {
  const {
    language,
    currentUser,
    tick,
    getBills,
    getCustomers,
    getVerificationRequestsFor,
    getVerificationRequestsSentBy,
  } = useApp();

  const navigate = useNavigate();

  // eslint-disable-next-line no-unused-vars
  const _ = tick;

  const bills = getBills();
  const customers = getCustomers();

  const received = currentUser
    ? getVerificationRequestsFor(currentUser.id).filter(
        (b) => (b.status || 'pending') === 'pending'
      )
    : [];

  const sent = currentUser
    ? getVerificationRequestsSentBy(currentUser.id).filter(
        (b) => (b.status || 'pending') === 'pending'
      )
    : [];

  const totalRevenue = bills.reduce(
    (sum, b) => sum + (b.grandTotal || b.total || 0),
    0
  );

  const recentBills = [...bills].reverse().slice(0, 5);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-200/35 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_28%)]" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div className="max-w-3xl">

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                <Activity size={12} />
                ECO PEST SOLUTIONS
              </div>

              <p className="mt-4 text-sm font-medium text-slate-500">
                {t(language, 'welcomeBack')}
              </p>

              <h1
                className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {currentUser?.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {currentUser?.employeeId}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  <Calendar size={12} className="text-emerald-600" />
                  {today}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">

              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Bills
                </p>

                <p
                  className="mt-2 text-2xl font-bold text-slate-900"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {bills.length}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Customers
                </p>

                <p
                  className="mt-2 text-2xl font-bold text-slate-900"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {customers.length}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Revenue
                </p>

                <p
                  className="mt-2 text-2xl font-bold text-slate-900"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            icon={FileText}
            label={t(language, 'totalBills')}
            value={bills.length}
            accent="blue"
          />

          <StatCard
            icon={Users}
            label={t(language, 'totalCustomers')}
            value={customers.length}
            accent="emerald"
          />

          <StatCard
            icon={TrendingUp}
            label={t(language, 'totalRevenue')}
            value={`₹${totalRevenue.toLocaleString('en-IN')}`}
            accent="purple"
          />

          <StatCard
            icon={ShieldCheck}
            label={t(language, 'pendingRequests')}
            value={received.length + sent.length}
            accent="amber"
          />
        </div>

        {/* Verification Requests */}
        <button
          onClick={() => navigate('/dashboard/verification-requests')}
          data-testid="pending-requests-card"
          className="group w-full overflow-hidden rounded-[30px] border border-white/80 bg-white/85 p-6 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <h3
                className="text-xl font-bold text-slate-900"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {t(language, 'pendingRequests')}
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:min-w-[22rem]">

              <div
                data-testid="pending-received"
                className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Inbox size={12} />
                  Received
                </div>

                <p
                  className="mt-3 text-3xl font-bold text-amber-600"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {received.length}
                </p>
              </div>

              <div
                data-testid="pending-sent"
                className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Send size={12} />
                  Sent
                </div>

                <p
                  className="mt-3 text-3xl font-bold text-cyan-600"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {sent.length}
                </p>
              </div>

            </div>
          </div>
        </button>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          <ActionCard
            label={t(language, 'billGenerate')}
            icon={FileText}
            color="emerald"
            onClick={() => navigate('/dashboard/bill-generate')}
          />

          <ActionCard
            label={t(language, 'customers')}
            icon={Users}
            color="blue"
            onClick={() => navigate('/dashboard/customers')}
          />

          <ActionCard
            label={t(language, 'verificationRequests')}
            icon={ShieldCheck}
            color="amber"
            onClick={() => navigate('/dashboard/verification-requests')}
          />

        </div>

        {/* Recent Bills */}
        {recentBills.length > 0 && (
          <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">

            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3
                className="text-lg font-bold text-slate-900"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {t(language, 'recentBills')}
              </h3>
            </div>

            <div className="divide-y divide-slate-100">

              {recentBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-emerald-50/50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {bill.billNumber}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {bill.customerName} • {formatDateDDMMYY(bill.date)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      ₹{(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}
                    </p>

                    <span
                      className="mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700"
                    >
                      {t(language, 'tax')}
                    </span>
                  </div>
                </div>
              ))}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}