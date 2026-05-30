import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import {
  ShieldCheck,
  Eye,
  Inbox,
  Send,
  CheckCircle,
  XCircle,
  Pencil,
  Clock,
  Sparkles,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InvoicePreview from './InvoicePreview';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY } from '../../lib/date';

const SectionHeader = ({ icon: Icon, label, count, tint = 'slate' }) => {
  const styles = {
    slate: {
      icon: 'text-slate-600 bg-slate-100',
      pill: 'bg-slate-100 text-slate-700',
    },
    indigo: {
      icon: 'text-indigo-600 bg-indigo-50',
      pill: 'bg-indigo-50 text-indigo-700',
    },
    green: {
      icon: 'text-emerald-600 bg-emerald-50',
      pill: 'bg-emerald-50 text-emerald-700',
    },
    amber: {
      icon: 'text-amber-600 bg-amber-50',
      pill: 'bg-amber-50 text-amber-700',
    },
  };

  const style = styles[tint] || styles.slate;

  return (
    <div className="mb-4 flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${style.icon} shadow-sm`}>
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${style.pill}`}>
          {count}
        </span>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, hint, icon: Icon }) => (
  <div className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {value}
        </p>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-lg shadow-black/5">
        <Icon size={18} />
      </div>
    </div>
  </div>
);

export default function VerificationRequests() {
  const {
    language,
    currentUser,
    tick,
    getVerificationRequestsFor,
    getVerificationRequestsSentBy,
    approveBill,
    rejectBill,
    getUsers,
  } = useApp();

  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [previewBill, setPreviewBill] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState('');

  // Re-render on global tick (cross-tab sync)
  // eslint-disable-next-line no-unused-vars
  const _ = tick;

  if (!currentUser) return null;

  const usersById = Object.fromEntries(getUsers().map((u) => [String(u.id), u]));
  const namesFor = (ids = []) => ids.map((id) => usersById[String(id)]?.name).filter(Boolean);

  const received = getVerificationRequestsFor(currentUser.id);
  const sent = getVerificationRequestsSentBy(currentUser.id);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const onApprove = (billNumber) => {
    approveBill(billNumber);
    showToast(`✓ ${billNumber} marked verified`);
  };

  const onSelfApprove = async (billNumber) => {
    const ok = await confirm({
      title: `Self-approve ${billNumber}?`,
      message:
        'You are approving a verification request you sent yourself. This will mark the bill as verified and the action will be recorded as a self-approval. Continue?',
      confirmText: 'Self-Approve',
      cancelText: 'Cancel',
      variant: 'primary',
    });
    if (!ok) return;
    approveBill(billNumber, { selfApproved: true });
    showToast(`✓ ${billNumber} self-approved`);
  };

  const submitReject = () => {
    if (!rejectingId) return;
    rejectBill(rejectingId, rejectReason || 'No reason provided');
    showToast(`✗ ${rejectingId} rejected`);
    setRejectingId(null);
    setRejectReason('');
  };

  const StatusChip = ({ status }) => {
    const map = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-200 text-slate-600',
    };
    return (
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[status] || map.pending}`}>
        {t(language, status) || status}
      </span>
    );
  };

  const Row = ({ bill, mode }) => {
    const senderName = bill.verificationRequestedBy || bill.createdBy || '—';
    const receiverNames = namesFor(bill.verificationRequestedTo || []);
    const receiverLabel = receiverNames.length ? receiverNames.join(', ') : '—';
    const showActions = mode === 'received';
    const isCancelled = bill.status === 'cancelled';

    return (
      <>
        <tr className={`transition-colors hover:bg-slate-50/80 ${isCancelled ? 'text-red-600' : ''}`}>
          <td className="px-4 py-4 align-top">
            <span className={`font-mono text-sm font-semibold ${isCancelled ? 'text-red-600 line-through' : 'text-emerald-700'}`}>
              {bill.billNumber}
            </span>
            <p className={`mt-0.5 text-xs ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
              {formatDateDDMMYY(bill.date)}
            </p>
          </td>

          <td className="px-4 py-4 align-top">
            <p className={`text-sm font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>
              {bill.customerName}
            </p>
            {bill.customerPhone && (
              <p className={`text-xs ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
                {bill.customerPhone}
              </p>
            )}
          </td>

          <td className={`px-4 py-4 text-sm align-top ${isCancelled ? 'text-red-600' : 'text-slate-600'}`}>
            <div className="flex items-center gap-1.5 text-xs">
              <Send size={11} className={isCancelled ? 'text-red-400' : 'text-slate-400'} />
              <span className={isCancelled ? 'text-red-400' : 'text-slate-400'}>From:</span>
              <span className={`font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>{senderName}</span>
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-xs">
              <Inbox size={11} className={`mt-0.5 ${isCancelled ? 'text-red-400' : 'text-slate-400'}`} />
              <span className={isCancelled ? 'text-red-400' : 'text-slate-400'}>To:</span>
              <span className={`font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>{receiverLabel}</span>
            </div>
          </td>

          <td className={`px-4 py-4 text-right text-sm font-bold align-top ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>
            ₹{(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>

          <td className="px-4 py-4 text-center align-top">
            <StatusChip status={bill.status || 'pending'} />
            {bill.selfApproved && bill.status === 'approved' && (
              <div className="mt-1 inline-block rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Self-approved
              </div>
            )}
          </td>

          <td className="px-4 py-4 align-top">
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                data-testid={`view-vr-${bill.id}`}
                onClick={() => setPreviewBill(bill)}
                title="Preview"
                className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-100"
              >
                <Eye size={14} />
                View
              </button>

              {showActions && bill.status === 'pending' && (
                <>
                  <button
                    data-testid={`approve-vr-${bill.id}`}
                    onClick={() => onApprove(bill.billNumber)}
                    className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(16,185,129,0.20)] transition-transform hover:-translate-y-0.5"
                  >
                    <CheckCircle size={12} /> {t(language, 'verifyMarkApproved')}
                  </button>

                  <button
                    data-testid={`reject-vr-${bill.id}`}
                    onClick={() => setRejectingId(bill.billNumber)}
                    className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(244,63,94,0.18)] transition-transform hover:-translate-y-0.5"
                  >
                    <XCircle size={12} /> {t(language, 'reject')}
                  </button>
                </>
              )}

              {!showActions && bill.status === 'pending' && (
                <>
                  <button
                    data-testid={`self-approve-vr-${bill.id}`}
                    onClick={() => onSelfApprove(bill.billNumber)}
                    title="Self-approve this request"
                    className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(16,185,129,0.20)] transition-transform hover:-translate-y-0.5"
                  >
                    <CheckCircle size={12} /> {t(language, 'selfApprove')}
                  </button>

                  <button
                    data-testid={`edit-vr-${bill.id}`}
                    onClick={() => navigate(`/dashboard/bill-generate/${encodeURIComponent(bill.billNumber)}`)}
                    title="Edit bill"
                    className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_25px_rgba(245,158,11,0.18)] transition-transform hover:-translate-y-0.5"
                  >
                    <Pencil size={12} /> {t(language, 'edit')}
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>

        {bill.verificationReason && (
          <tr className="bg-amber-50/40">
            <td colSpan={6} className="px-4 py-2 text-xs">
              <span className="mr-2 font-semibold uppercase tracking-wider text-amber-700">Reason:</span>
              <span className="italic text-slate-700">&ldquo;{bill.verificationReason}&rdquo;</span>
            </td>
          </tr>
        )}

        {bill.status === 'rejected' && bill.rejectReason && (
          <tr className="bg-red-50/60">
            <td colSpan={6} className="px-4 py-2 text-xs">
              <span className="mr-2 font-semibold uppercase tracking-wider text-red-700">Rejected:</span>
              <span className="italic text-slate-700">&ldquo;{bill.rejectReason}&rdquo;</span>
            </td>
          </tr>
        )}
      </>
    );
  };

  const Table = ({ rows, mode }) => (
    <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50">
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bill #</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sender / Receiver
              </th>
              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((b) => (
              <Row key={b.id} bill={b} mode={mode} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
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
                VERIFICATION REQUESTS
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {t(language, 'verificationRequests')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Bills pending or previously flagged for verification involving you.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[34rem]">
              <StatCard
                label={t(language, 'verificationsAwaitingYou')}
                value={received.length}
                hint="Need review"
                icon={Inbox}
              />
              <StatCard
                label={t(language, 'verificationsSentByYou')}
                value={sent.length}
                hint="Shared by you"
                icon={Send}
              />
            </div>
          </div>
        </div>

        {toast && (
          <div
            data-testid="vr-toast"
            className="fixed right-4 top-20 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl fade-in"
          >
            {toast}
          </div>
        )}

        {/* Awaiting your review */}
        <div>
          <SectionHeader
            icon={Inbox}
            label={t(language, 'verificationsAwaitingYou')}
            count={received.length}
            tint="indigo"
          />
          {received.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/85 py-10 text-center text-slate-400 backdrop-blur-xl">
              <Clock size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">{t(language, 'noVerificationRequests')}</p>
            </div>
          ) : (
            <Table
              rows={[...received].sort((a, b) =>
                (b.verificationRequestedAt || '').localeCompare(a.verificationRequestedAt || '')
              )}
              mode="received"
            />
          )}
        </div>

        {/* Requests you sent */}
        <div>
          <SectionHeader
            icon={Send}
            label={t(language, 'verificationsSentByYou')}
            count={sent.length}
            tint="green"
          />
          {sent.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/85 py-10 text-center text-slate-400 backdrop-blur-xl">
              <ShieldCheck size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">You haven&apos;t sent any verification requests yet.</p>
              <p className="mt-1 text-xs">Open a bill and click <b>Request Verification</b> to send one.</p>
            </div>
          ) : (
            <Table
              rows={[...sent].sort((a, b) =>
                (b.verificationRequestedAt || '').localeCompare(a.verificationRequestedAt || '')
              )}
              mode="sent"
            />
          )}
        </div>

        {/* Reject modal */}
        {rejectingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md">
            <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl fade-in">
              <h3 className="mb-2 text-lg font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Reject {rejectingId}
              </h3>
              <p className="mb-4 text-sm text-slate-500">Please provide a reason</p>
              <textarea
                data-testid="vr-reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setRejectingId(null);
                    setRejectReason('');
                  }}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {t(language, 'cancel')}
                </button>
                <button
                  data-testid="vr-confirm-reject"
                  onClick={submitReject}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(244,63,94,0.18)] transition-transform hover:-translate-y-0.5"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {previewBill && (
          <InvoicePreview
            bill={previewBill}
            onClose={() => setPreviewBill(null)}
            language={language}
          />
        )}
      </div>
    </div>
  );
}