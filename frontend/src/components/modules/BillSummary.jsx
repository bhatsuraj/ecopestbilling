import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { Eye, FileText, Search, Filter, Download, FileSpreadsheet, FileDown, Ban, Send as SendIcon, MessageCircle, Mail, Calendar } from 'lucide-react';
import InvoicePreview from './InvoicePreview';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY, isWithinRange } from '../../lib/date';

// Format YYYY-MM-DD → "April - 2026"
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const getMonthLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} - ${d.getFullYear()}`;
};
const getMonthKey = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.slice(0, 7); // YYYY-MM
};

export default function BillSummary() {
  const { language, getBills, tick, cancelBill, markBillSent, getCustomers } = useApp();
  const { notify, confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [previewBill, setPreviewBill] = useState(null);
  const [previewAutoShare, setPreviewAutoShare] = useState(null); // 'whatsapp' | 'email' | null
  const [exportOpen, setExportOpen] = useState(false);
  const [sendOpenId, setSendOpenId] = useState(null);
  const [sendModalBill, setSendModalBill] = useState(null);
  const exportBtnRef = useRef(null);
  const sendMenuRef = useRef(null);

  // Re-render on context tick (cross-tab updates)
  // eslint-disable-next-line no-unused-vars
  const _ = tick;

  const bills = getBills();

  // Close export menu on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e) => {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exportOpen]);

  // Close per-row send menu on outside click (legacy inline dropdown — kept
  // to avoid touching unrelated code; the new flow uses a centered modal).
  useEffect(() => {
    if (!sendOpenId) return;
    const onDocClick = (e) => {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target)) setSendOpenId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [sendOpenId]);

  // Enrich the bill with the customer's email & phone, looked up from the
  // saved Customers collection. This guarantees the WhatsApp/Email share
  // gets the contact details auto-filled even if the bill itself was missing them.
  const enrichBillWithCustomer = (bill) => {
    const customers = getCustomers();
    const match = customers.find(c =>
      (bill.customerId && String(c.id) === String(bill.customerId)) ||
      (bill.customerName && String(c.name || '').toLowerCase() === String(bill.customerName || '').toLowerCase())
    );
    return {
      ...bill,
      customerPhone: bill.customerPhone || match?.phone || '',
      customerEmail: bill.customerEmail || match?.email || '',
      customerAddress: bill.customerAddress || match?.address || '',
    };
  };

  const openSendModal = (bill) => {
    setSendOpenId(null);
    setSendModalBill(enrichBillWithCustomer(bill));
  };

  const sendViaWhatsApp = (bill) => {
    const enriched = enrichBillWithCustomer(bill);
    setSendModalBill(null);
    setSendOpenId(null);
    setPreviewAutoShare('whatsapp');
    setPreviewBill(enriched);
  };

  const sendViaEmail = (bill) => {
    const enriched = enrichBillWithCustomer(bill);
    setSendModalBill(null);
    setSendOpenId(null);
    setPreviewAutoShare('email');
    setPreviewBill(enriched);
  };

  const closePreview = () => {
    setPreviewBill(null);
    setPreviewAutoShare(null);
  };

  const handleSent = (channel) => {
    if (previewBill?.billNumber) {
      markBillSent(previewBill.billNumber, channel);
    }
  };

  const filtered = bills.filter(b => {
    const matchSearch    = (b.billNumber || '').toLowerCase().includes(search.toLowerCase()) ||
                           (b.customerName || '').toLowerCase().includes(search.toLowerCase());
    const matchDate      = !dateFilter || b.date === dateFilter;
    const matchRange     = isWithinRange(b.date, fromDate, toDate);
    const matchMonth     = !monthFilter || getMonthKey(b.date) === monthFilter;
    const matchCustomer  = !customerFilter || b.customerName === customerFilter;
    const matchType      = !typeFilter || b.type === typeFilter;
    const matchStatus    = !statusFilter || (b.status || 'pending') === statusFilter;
    return matchSearch && matchDate && matchRange && matchMonth && matchCustomer && matchType && matchStatus;
  }).reverse();

  const uniqueCustomers = [...new Set(bills.map(b => b.customerName))].filter(Boolean);

  // Unique months from bills, sorted desc
  const uniqueMonths = [...new Set(bills.map(b => getMonthKey(b.date)).filter(Boolean))]
    .sort()
    .reverse();

  const totalRevenue = filtered.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);

  const hasActiveFilters = dateFilter || fromDate || toDate || monthFilter || customerFilter || typeFilter || statusFilter;

  // ── Export rows in the EXACT requested format ──
  // Columns: Sl No | Month | Bill Date | Invoice No | Company Name | Generated By | Role | Bill Amount | Bill Status
  const buildExportRows = () => filtered.map((b, idx) => {
    const role = (b.createdByRole || '').toLowerCase();
    const roleLabel = role === 'superior' ? 'Superior' : role === 'assistant' ? 'Assistant' : (b.createdByRole || '—');
    return {
      'Sl No':         idx + 1,
      'Month':         getMonthLabel(b.date),
      'Bill Date':     formatDateDDMMYY(b.date),
      'Invoice No':    b.billNumber,
      'Company Name':  b.customerName || '',
      'Generated By':  b.createdBy || b.employeeName || '—',
      'Employee ID':   b.employeeId || '—',
      'Role':          roleLabel,
      'Bill Amount':   b.grandTotal || b.total || 0,
      'Bill Status':   (b.status || 'pending').toUpperCase(),
    };
  });

  const exportCsv = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      await notify({ title: 'No bills to export', message: 'There are no bills matching the current filters.', variant: 'info' });
      return;
    }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `bills_${ts}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportXlsx = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      await notify({ title: 'No bills to export', message: 'There are no bills matching the current filters.', variant: 'info' });
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths for nicer Excel rendering
    ws['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 32 },
      { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill Summary');
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `bills_${ts}.xlsx`);
    setExportOpen(false);
  };

  const handleCancel = async (bill) => {
    const ok = await confirm({
      title: `Cancel bill ${bill.billNumber}?`,
      message:
        `This will mark ${bill.billNumber} (${bill.customerName || 'customer'}, ` +
        `₹${(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}) as CANCELLED. ` +
        'The bill record will be preserved but flagged as cancelled. Continue?',
      confirmText: 'Cancel Bill',
      cancelText: 'Keep Bill',
      variant: 'danger',
    });
    if (!ok) return;
    cancelBill(bill.billNumber, '');
  };

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {t(language, 'billSummary')}
          </h2>
          <p className="text-slate-500 text-sm">
            {filtered.length} bills · Total: ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            {hasActiveFilters && <span className="ml-2 text-amber-600 font-medium">(filtered)</span>}
          </p>
        </div>
        {/* Export menu */}
        <div className="relative" ref={exportBtnRef}>
          <button data-testid="export-menu-toggle" onClick={() => setExportOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
            <Download size={15} /> {t(language, 'export')}
          </button>
          {exportOpen && (
            <div data-testid="export-menu"
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-30 overflow-hidden">
              <button data-testid="export-xlsx" onClick={exportXlsx}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-green-50 transition-colors">
                <FileSpreadsheet size={16} className="text-green-700" />
                <div>
                  <p className="font-semibold">{t(language, 'exportExcel')}</p>
                  <p className="text-xs text-slate-400">.xlsx · {filtered.length} rows</p>
                </div>
              </button>
              <button data-testid="export-csv" onClick={exportCsv}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-green-50 transition-colors border-t border-slate-100">
                <FileDown size={16} className="text-green-700" />
                <div>
                  <p className="font-semibold">{t(language, 'exportCsv')}</p>
                  <p className="text-xs text-slate-400">.csv · {filtered.length} rows</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="bill-search-input" type="text"
              placeholder={t(language, 'search')}
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input data-testid="date-filter-input" type="date"
              value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <select data-testid="month-filter-select"
            value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">{t(language, 'allMonths')}</option>
            {uniqueMonths.map(m => {
              const [y, mo] = m.split('-');
              const idx = parseInt(mo, 10) - 1;
              return <option key={m} value={m}>{MONTHS[idx]} - {y}</option>;
            })}
          </select>
          <select data-testid="customer-filter-select"
            value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">{t(language, 'allCustomers')}</option>
            {uniqueCustomers.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select data-testid="status-filter-select"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">{t(language, 'allStatuses')}</option>
            <option value="pending">{t(language, 'pending')}</option>
            <option value="approved">{t(language, 'approved')}</option>
            <option value="rejected">{t(language, 'rejected')}</option>
            <option value="cancelled">{t(language, 'cancelled')}</option>
          </select>
        </div>

        {/* Date Range Filter — From / To (drives both on-screen list AND export) */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <Calendar size={13} className="text-slate-400" />
            Date Range
          </span>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium" htmlFor="from-date-input">From</label>
            <input
              id="from-date-input"
              data-testid="from-date-input"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={e => setFromDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium" htmlFor="to-date-input">To</label>
            <input
              id="to-date-input"
              data-testid="to-date-input"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              data-testid="clear-date-range"
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors">
              Clear range ×
            </button>
          )}
          {(fromDate || toDate) && (
            <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5 font-medium">
              {fromDate ? formatDateDDMMYY(fromDate) : '…'} → {toDate ? formatDateDDMMYY(toDate) : '…'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <select data-testid="type-filter-select"
            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">{t(language, 'allTypes')}</option>
            <option value="cashless">{t(language, 'cashless')}</option>
            <option value="tax">{t(language, 'tax')}</option>
          </select>
          {hasActiveFilters && (
            <button onClick={() => { setDateFilter(''); setFromDate(''); setToDate(''); setMonthFilter(''); setCustomerFilter(''); setTypeFilter(''); setStatusFilter(''); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
              Clear Filters ×
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t(language, 'noData')}</p>
          <p className="text-sm mt-1">Generate your first bill to see it here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'slNo')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'month')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'billDate') || 'Bill Date'}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'invoiceNo') || 'Invoice No'}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Generated By</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'billAmount') || 'Bill Amount'}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'billStatus') || 'Bill Status'}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((bill, idx) => {
                  const status = bill.status || 'pending';
                  const cls = status === 'approved' ? 'bg-green-100 text-green-700'
                            : status === 'rejected' ? 'bg-red-100 text-red-700'
                            : status === 'cancelled' ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700';
                  const isCancelled = status === 'cancelled';
                  const isApproved  = status === 'approved';
                  const rowTextCls = isCancelled ? 'text-red-600' : '';
                  return (
                    <tr key={bill.id} className={`hover:bg-slate-50 transition-colors ${rowTextCls}`}>
                      <td className={`px-4 py-3 text-sm ${isCancelled ? 'text-red-600' : 'text-slate-500'}`}>{idx + 1}</td>
                      <td className={`px-4 py-3 text-sm ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>{getMonthLabel(bill.date)}</td>
                      <td className={`px-4 py-3 text-sm ${isCancelled ? 'text-red-600' : 'text-slate-600'}`}>{formatDateDDMMYY(bill.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-semibold text-sm ${isCancelled ? 'text-red-600 line-through' : 'text-green-700'}`}>{bill.billNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-semibold text-sm ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>{bill.customerName}</p>
                        {bill.customerPhone && <p className={`text-xs ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>{bill.customerPhone}</p>}
                      </td>
                      <td className={`px-4 py-3 text-sm hidden md:table-cell ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>
                        <p className={`font-semibold text-sm ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>
                          {bill.createdBy || bill.employeeName || '—'}
                        </p>
                        {(bill.createdByRole || bill.employeeId) && (
                          <p className={`text-[11px] ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
                            {bill.createdByRole === 'superior' ? 'Superior' : bill.createdByRole === 'assistant' ? 'Assistant' : (bill.createdByRole || '')}
                            {bill.employeeId ? ` · ${bill.employeeId}` : ''}
                          </p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold text-sm ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>
                        ₹{(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span data-testid={`bill-status-${bill.id}`} className={`text-xs px-2 py-1 rounded-full font-semibold ${cls}`}>
                          {t(language, status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button data-testid={`view-bill-${bill.id}`} onClick={() => { setPreviewAutoShare(null); setPreviewBill(bill); }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                            <Eye size={12} />
                            {t(language, 'viewBill')}
                          </button>

                          {/* Send / Resend — opens a centered pop-style modal.
                              Stays disabled until the bill has been approved. */}
                          {!isCancelled && (
                            <button
                              data-testid={`send-bill-${bill.id}`}
                              onClick={() => isApproved && openSendModal(bill)}
                              disabled={!isApproved}
                              title={!isApproved
                                ? 'Send is enabled only after the approval request is approved'
                                : ((bill.sentChannels?.length) ? 'Resend invoice' : 'Send invoice to customer')}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                !isApproved
                                  ? 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-70'
                                  : bill.sentChannels?.length
                                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                                    : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                              }`}>
                              <SendIcon size={12} />
                              {bill.sentChannels?.length ? t(language, 'resend') : t(language, 'send')}
                            </button>
                          )}

                          {!isCancelled && (
                            <button data-testid={`cancel-bill-${bill.id}`} onClick={() => handleCancel(bill)}
                              title="Cancel this bill"
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                              <Ban size={12} />
                              {t(language, 'cancelBill')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send (WhatsApp / Email) — centered pop modal */}
      {sendModalBill && (
        <div
          data-testid="send-modal-overlay"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
          onClick={() => setSendModalBill(null)}>
          <div
            data-testid="send-modal"
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden pop-in">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {sendModalBill.sentChannels?.length ? t(language, 'resend') : t(language, 'send')} invoice
                </h3>
                <button
                  data-testid="send-modal-close"
                  onClick={() => setSendModalBill(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  ×
                </button>
              </div>
              <p className="text-sm text-slate-500">
                <span className="font-mono font-semibold text-green-700">{sendModalBill.billNumber}</span>
                {' · '}{sendModalBill.customerName || 'Customer'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              {/* WhatsApp */}
              <button
                data-testid="send-modal-whatsapp"
                onClick={() => sendViaWhatsApp(sendModalBill)}
                className="group relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-green-100 group-hover:bg-green-500 flex items-center justify-center transition-colors">
                  <MessageCircle size={26} className="text-green-600 group-hover:text-white transition-colors" />
                </div>
                <p className="text-sm font-bold text-slate-900">{t(language, 'sendViaWhatsApp')}</p>
                {sendModalBill.customerPhone ? (
                  <p className="text-[11px] text-slate-500 truncate max-w-full px-2">{sendModalBill.customerPhone}</p>
                ) : (
                  <p className="text-[11px] text-amber-600 italic">No phone on file</p>
                )}
                {sendModalBill.sentChannels?.includes('whatsapp') && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md">
                    Sent
                  </span>
                )}
              </button>

              {/* Email */}
              <button
                data-testid="send-modal-email"
                onClick={() => sendViaEmail(sendModalBill)}
                className="group relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors">
                  <Mail size={26} className="text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <p className="text-sm font-bold text-slate-900">{t(language, 'sendViaEmailLabel')}</p>
                {sendModalBill.customerEmail ? (
                  <p className="text-[11px] text-slate-500 truncate max-w-full px-2">{sendModalBill.customerEmail}</p>
                ) : (
                  <p className="text-[11px] text-amber-600 italic">No email on file</p>
                )}
                {sendModalBill.sentChannels?.includes('email') && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md">
                    Sent
                  </span>
                )}
              </button>
            </div>

            <p className="px-6 pb-5 text-[11px] text-slate-400 text-center">
              The invoice PDF will be generated and attached automatically.
            </p>
          </div>
        </div>
      )}

      {previewBill && (
        <InvoicePreview
          bill={previewBill}
          onClose={closePreview}
          language={language}
          autoShare={previewAutoShare}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
