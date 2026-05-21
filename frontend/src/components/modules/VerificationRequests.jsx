import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { ShieldCheck, Eye, Inbox, Send, CheckCircle, XCircle, Pencil, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InvoicePreview from './InvoicePreview';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY } from '../../lib/date';

// Small section header used above each bucket of requests
const SectionHeader = ({ icon: Icon, label, count, tint = 'slate' }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={16} className={`text-${tint}-600`} />
    <h3 className="font-bold text-slate-900 text-sm">{label}</h3>
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-${tint}-100 text-${tint}-700`}>{count}</span>
  </div>
);

export default function VerificationRequests() {
  const {
    language, currentUser, tick,
    getVerificationRequestsFor, getVerificationRequestsSentBy,
    approveBill, rejectBill, getUsers,
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

  // Build a quick id→name map so we can show receiver names on sent requests
  const usersById = Object.fromEntries(getUsers().map(u => [String(u.id), u]));
  const namesFor  = (ids = []) => ids.map(id => usersById[String(id)]?.name).filter(Boolean);

  const received = getVerificationRequestsFor(currentUser.id);
  const sent     = getVerificationRequestsSentBy(currentUser.id);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const onApprove = (billNumber) => {
    approveBill(billNumber);
    showToast(`✓ ${billNumber} marked verified`);
  };

  const onSelfApprove = async (billNumber) => {
    const ok = await confirm({
      title: `Self-approve ${billNumber}?`,
      message:
        'You are approving a verification request you sent yourself. ' +
        'This will mark the bill as verified and the action will be recorded as a self-approval. Continue?',
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
      pending:   'bg-amber-100 text-amber-700',
      approved:  'bg-green-100 text-green-700',
      rejected:  'bg-red-100 text-red-700',
      cancelled: 'bg-slate-200 text-slate-600',
    };
    return (
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${map[status] || map.pending}`}>
        {t(language, status) || status}
      </span>
    );
  };

  const Row = ({ bill, mode }) => {
    // mode = 'received' (current user is verifier) | 'sent' (current user is requester)
    const senderName    = bill.verificationRequestedBy || bill.createdBy || '—';
    const receiverNames = namesFor(bill.verificationRequestedTo || []);
    const receiverLabel = receiverNames.length ? receiverNames.join(', ') : '—';
    const showActions   = mode === 'received';
    const isCancelled   = bill.status === 'cancelled';
    return (
      <>
        <tr className={`hover:bg-slate-50 transition-colors ${isCancelled ? 'text-red-600' : ''}`}>
          <td className="px-4 py-3 align-top">
            <span className={`font-mono font-semibold text-sm ${isCancelled ? 'text-red-600 line-through' : 'text-green-700'}`}>{bill.billNumber}</span>
            <p className={`text-xs mt-0.5 ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>{formatDateDDMMYY(bill.date)}</p>
          </td>
          <td className="px-4 py-3 align-top">
            <p className={`font-semibold text-sm ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>{bill.customerName}</p>
            {bill.customerPhone && <p className={`text-xs ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>{bill.customerPhone}</p>}
          </td>
          <td className={`px-4 py-3 text-sm align-top ${isCancelled ? 'text-red-600' : 'text-slate-600'}`}>
            <div className="flex items-center gap-1.5 text-xs">
              <Send size={11} className={isCancelled ? 'text-red-400' : 'text-slate-400'} />
              <span className={isCancelled ? 'text-red-400' : 'text-slate-400'}>From:</span>
              <span className={`font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>{senderName}</span>
            </div>
            <div className="flex items-start gap-1.5 text-xs mt-1">
              <Inbox size={11} className={`mt-0.5 ${isCancelled ? 'text-red-400' : 'text-slate-400'}`} />
              <span className={isCancelled ? 'text-red-400' : 'text-slate-400'}>To:</span>
              <span className={`font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>{receiverLabel}</span>
            </div>
          </td>
          <td className={`px-4 py-3 text-right font-bold text-sm align-top ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>
            ₹{(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td className="px-4 py-3 text-center align-top">
            <StatusChip status={bill.status || 'pending'} />
            {bill.selfApproved && bill.status === 'approved' && (
              <div className="mt-1 inline-block text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md tracking-wider">
                Self-approved
              </div>
            )}
          </td>
          <td className="px-4 py-3 align-top">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <button data-testid={`view-vr-${bill.id}`} onClick={() => setPreviewBill(bill)}
                title="Preview" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <Eye size={14} />
              </button>
              {showActions && bill.status === 'pending' && (
                <>
                  <button data-testid={`approve-vr-${bill.id}`} onClick={() => onApprove(bill.billNumber)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                    <CheckCircle size={12} /> {t(language, 'verifyMarkApproved')}
                  </button>
                  <button data-testid={`reject-vr-${bill.id}`} onClick={() => setRejectingId(bill.billNumber)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
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
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                    <CheckCircle size={12} /> {t(language, 'selfApprove')}
                  </button>
                  <button data-testid={`edit-vr-${bill.id}`}
                    onClick={() => navigate(`/dashboard/bill-generate/${encodeURIComponent(bill.billNumber)}`)}
                    title="Edit bill"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
                    <Pencil size={12} /> {t(language, 'edit')}
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
        {/* Reason row — full-width, only when a reason was attached */}
        {bill.verificationReason && (
          <tr className="bg-amber-50/40">
            <td colSpan={6} className="px-4 py-2 text-xs">
              <span className="text-amber-700 font-semibold uppercase tracking-wider mr-2">Reason:</span>
              <span className="text-slate-700 italic">&ldquo;{bill.verificationReason}&rdquo;</span>
            </td>
          </tr>
        )}
        {bill.status === 'rejected' && bill.rejectReason && (
          <tr className="bg-red-50/60">
            <td colSpan={6} className="px-4 py-2 text-xs">
              <span className="text-red-700 font-semibold uppercase tracking-wider mr-2">Rejected:</span>
              <span className="text-slate-700 italic">&ldquo;{bill.rejectReason}&rdquo;</span>
            </td>
          </tr>
        )}
      </>
    );
  };

  const Table = ({ rows, mode }) => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Bill #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sender / Receiver</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(b => <Row key={b.id} bill={b} mode={mode} />)}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {t(language, 'verificationRequests')}
        </h2>
        <p className="text-slate-500 text-sm">Bills pending or previously flagged for verification involving you</p>
      </div>

      {toast && (
        <div data-testid="vr-toast" className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold fade-in">
          {toast}
        </div>
      )}

      {/* Awaiting your review */}
      <div>
        <SectionHeader icon={Inbox} label={t(language, 'verificationsAwaitingYou')} count={received.length} tint="indigo" />
        {received.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <Clock size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">{t(language, 'noVerificationRequests')}</p>
          </div>
        ) : (
          <Table rows={[...received].sort((a, b) => (b.verificationRequestedAt || '').localeCompare(a.verificationRequestedAt || ''))} mode="received" />
        )}
      </div>

      {/* Requests you sent */}
      <div>
        <SectionHeader icon={Send} label={t(language, 'verificationsSentByYou')} count={sent.length} tint="green" />
        {sent.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <ShieldCheck size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">You haven&apos;t sent any verification requests yet.</p>
            <p className="text-xs mt-1">Open a bill and click <b>Request Verification</b> to send one.</p>
          </div>
        ) : (
          <Table rows={[...sent].sort((a, b) => (b.verificationRequestedAt || '').localeCompare(a.verificationRequestedAt || ''))} mode="sent" />
        )}
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl fade-in">
            <h3 className="font-bold text-lg text-slate-900 mb-2">Reject {rejectingId}</h3>
            <p className="text-slate-500 text-sm mb-4">Please provide a reason</p>
            <textarea data-testid="vr-reject-reason" rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium">
                {t(language, 'cancel')}
              </button>
              <button data-testid="vr-confirm-reject" onClick={submitReject}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {previewBill && (
        <InvoicePreview bill={previewBill} onClose={() => setPreviewBill(null)} language={language} />
      )}
    </div>
  );
}
