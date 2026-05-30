import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import {
  Eye,
  FileText,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileDown,
  Ban,
  Send as SendIcon,
  MessageCircle,
  Mail,
  Calendar,
  Sparkles,
  Activity,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import InvoicePreview from './InvoicePreview';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY, isWithinRange } from '../../lib/date';

// Format YYYY-MM-DD → "April - 2026"
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

const StatCard = ({ label, value, hint, icon: Icon }) => (
  <div className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <p className="mt-3 text-3xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {value}
        </p>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-lg shadow-black/5">
          <Icon size={18} />
        </div>
      )}
    </div>
  </div>
);

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
    const match = customers.find(
      (c) =>
        (bill.customerId && String(c.id) === String(bill.customerId)) ||
        (bill.customerName &&
          String(c.name || '').toLowerCase() === String(bill.customerName || '').toLowerCase())
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

  const filtered = bills
    .filter((b) => {
      const matchSearch =
        (b.billNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.customerName || '').toLowerCase().includes(search.toLowerCase());
      const matchDate = !dateFilter || b.date === dateFilter;
      const matchRange = isWithinRange(b.date, fromDate, toDate);
      const matchMonth = !monthFilter || getMonthKey(b.date) === monthFilter;
      const matchCustomer = !customerFilter || b.customerName === customerFilter;
      const matchType = !typeFilter || b.type === typeFilter;
      const matchStatus = !statusFilter || (b.status || 'pending') === statusFilter;
      return matchSearch && matchDate && matchRange && matchMonth && matchCustomer && matchType && matchStatus;
    })
    .reverse();

  const uniqueCustomers = [...new Set(bills.map((b) => b.customerName))].filter(Boolean);

  // Unique months from bills, sorted desc
  const uniqueMonths = [...new Set(bills.map((b) => getMonthKey(b.date)).filter(Boolean))]
    .sort()
    .reverse();

  const totalRevenue = filtered.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);

  const hasActiveFilters =
    dateFilter || fromDate || toDate || monthFilter || customerFilter || typeFilter || statusFilter;

  // ── Export rows in the EXACT requested format ──
  // Columns: Sl No | Month | Bill Date | Invoice No | Company Name | Generated By | Role | Bill Amount | Bill Status
  const buildExportRows = () =>
    filtered.map((b, idx) => {
      const role = (b.createdByRole || '').toLowerCase();
      const roleLabel =
        role === 'superior'
          ? 'Superior'
          : role === 'assistant'
            ? 'Assistant'
            : b.createdByRole || '—';
      return {
        'Sl No': idx + 1,
        Month: getMonthLabel(b.date),
        'Bill Date': formatDateDDMMYY(b.date),
        'Invoice No': b.billNumber,
        'Company Name': b.customerName || '',
        'Generated By': b.createdBy || b.employeeName || '—',
        'Employee ID': b.employeeId || '—',
        Role: roleLabel,
        'Bill Amount': b.grandTotal || b.total || 0,
        'Bill Status': (b.status || 'pending').toUpperCase(),
      };
    });

  const exportCsv = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      await notify({
        title: 'No bills to export',
        message: 'There are no bills matching the current filters.',
        variant: 'info',
      });
      return;
    }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bills_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportXlsx = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      await notify({
        title: 'No bills to export',
        message: 'There are no bills matching the current filters.',
        variant: 'info',
      });
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths for nicer Excel rendering
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 12 },
      { wch: 14 },
      { wch: 32 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
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
                BILL SUMMARY
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {t(language, 'billSummary')}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {filtered.length} bills · Total: ₹
                {totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                {hasActiveFilters && <span className="ml-2 font-medium text-amber-600">(filtered)</span>}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
              <StatCard label="Bills" value={bills.length} hint="All records" icon={FileText} />
              <StatCard label="Revenue" value={`₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`} hint="Filtered total" icon={TrendingUp} />
              <StatCard label="Visible" value={filtered.length} hint="Current result set" icon={Search} />
            </div>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div />
          <div className="relative self-start sm:self-auto" ref={exportBtnRef}>
            <button
              data-testid="export-menu-toggle"
              onClick={() => setExportOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5"
            >
              <Download size={15} /> {t(language, 'export')}
            </button>
            {exportOpen && (
              <div
                data-testid="export-menu"
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl z-30"
              >
                <button
                  data-testid="export-xlsx"
                  onClick={exportXlsx}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-emerald-50"
                >
                  <FileSpreadsheet size={16} className="text-emerald-700" />
                  <div>
                    <p className="font-semibold">{t(language, 'exportExcel')}</p>
                    <p className="text-xs text-slate-400">.xlsx · {filtered.length} rows</p>
                  </div>
                </button>
                <button
                  data-testid="export-csv"
                  onClick={exportCsv}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-emerald-50"
                >
                  <FileDown size={16} className="text-emerald-700" />
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
        <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="bill-search-input"
                type="text"
                placeholder={t(language, 'search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="relative">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="date-filter-input"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <select
              data-testid="month-filter-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">{t(language, 'allMonths')}</option>
              {uniqueMonths.map((m) => {
                const [y, mo] = m.split('-');
                const idx = parseInt(mo, 10) - 1;
                return (
                  <option key={m} value={m}>
                    {MONTHS[idx]} - {y}
                  </option>
                );
              })}
            </select>

            <select
              data-testid="customer-filter-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">{t(language, 'allCustomers')}</option>
              {uniqueCustomers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <select
              data-testid="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">{t(language, 'allStatuses')}</option>
              <option value="pending">{t(language, 'pending')}</option>
              <option value="approved">{t(language, 'approved')}</option>
              <option value="rejected">{t(language, 'rejected')}</option>
              <option value="cancelled">{t(language, 'cancelled')}</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Date Range</span>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-500" htmlFor="from-date-input">
                From
              </label>
              <input
                id="from-date-input"
                data-testid="from-date-input"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-500" htmlFor="to-date-input">
                To
              </label>
              <input
                id="to-date-input"
                data-testid="to-date-input"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                data-testid="clear-date-range"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="text-[11px] font-medium text-red-500 transition-colors hover:text-red-700"
              >
                Clear range ×
              </button>
            )}

            {(fromDate || toDate) && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {fromDate ? formatDateDDMMYY(fromDate) : '…'} → {toDate ? formatDateDDMMYY(toDate) : '…'}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              data-testid="type-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">{t(language, 'allTypes')}</option>
              <option value="cashless">{t(language, 'cashless')}</option>
              <option value="tax">{t(language, 'tax')}</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setDateFilter('');
                  setFromDate('');
                  setToDate('');
                  setMonthFilter('');
                  setCustomerFilter('');
                  setTypeFilter('');
                  setStatusFilter('');
                }}
                className="text-xs font-medium text-red-500 transition-colors hover:text-red-700"
              >
                Clear Filters ×
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-[28px] border border-white/80 bg-white/90 px-6 py-16 text-center shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[0_10px_25px_rgba(16,185,129,0.12)]">
              <FileText size={30} />
            </div>
            <p className="text-lg font-semibold text-slate-800">{t(language, 'noData')}</p>
            <p className="mt-1 text-sm text-slate-500">Generate your first bill to see it here</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'slNo')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'month')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'billDate') || 'Bill Date'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'invoiceNo') || 'Invoice No'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Company Name
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                      Generated By
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'billAmount') || 'Bill Amount'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'billStatus') || 'Bill Status'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t(language, 'actions')}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map((bill, idx) => {
                    const status = bill.status || 'pending';
                    const cls =
                      status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700';
                    const isCancelled = status === 'cancelled';
                    const isApproved = status === 'approved';
                    const rowTextCls = isCancelled ? 'text-red-600' : '';

                    return (
                      <tr key={bill.id} className={`transition-colors hover:bg-slate-50 ${rowTextCls}`}>
                        <td className={`px-4 py-3 text-sm ${isCancelled ? 'text-red-600' : 'text-slate-500'}`}>
                          {idx + 1}
                        </td>

                        <td className={`px-4 py-3 text-sm ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>
                          {getMonthLabel(bill.date)}
                        </td>

                        <td className={`px-4 py-3 text-sm ${isCancelled ? 'text-red-600' : 'text-slate-600'}`}>
                          {formatDateDDMMYY(bill.date)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`font-mono text-sm font-semibold ${isCancelled ? 'text-red-600 line-through' : 'text-emerald-700'}`}
                          >
                            {bill.billNumber}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <p className={`text-sm font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>
                            {bill.customerName}
                          </p>
                          {bill.customerPhone && (
                            <p className={`text-xs ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
                              {bill.customerPhone}
                            </p>
                          )}
                        </td>

                        <td className={`hidden px-4 py-3 text-sm md:table-cell ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>
                          <p className={`text-sm font-semibold ${isCancelled ? 'text-red-600' : 'text-slate-700'}`}>
                            {bill.createdBy || bill.employeeName || '—'}
                          </p>
                          {(bill.createdByRole || bill.employeeId) && (
                            <p className={`text-[11px] ${isCancelled ? 'text-red-400' : 'text-slate-400'}`}>
                              {bill.createdByRole === 'superior'
                                ? 'Superior'
                                : bill.createdByRole === 'assistant'
                                  ? 'Assistant'
                                  : bill.createdByRole || ''}
                              {bill.employeeId ? ` · ${bill.employeeId}` : ''}
                            </p>
                          )}
                        </td>

                        <td className={`px-4 py-3 text-right text-sm font-bold ${isCancelled ? 'text-red-600' : 'text-slate-900'}`}>
                          ₹{(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            data-testid={`bill-status-${bill.id}`}
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}
                          >
                            {t(language, status)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              data-testid={`view-bill-${bill.id}`}
                              onClick={() => {
                                setPreviewAutoShare(null);
                                setPreviewBill(bill);
                              }}
                              className="flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              <Eye size={12} />
                              {t(language, 'viewBill')}
                            </button>

                            {!isCancelled && (
                              <button
                                data-testid={`send-bill-${bill.id}`}
                                onClick={() => isApproved && openSendModal(bill)}
                                disabled={!isApproved}
                                title={
                                  !isApproved
                                    ? 'Send is enabled only after the approval request is approved'
                                    : bill.sentChannels?.length
                                      ? 'Resend invoice'
                                      : 'Send invoice to customer'
                                }
                                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  !isApproved
                                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70'
                                    : bill.sentChannels?.length
                                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                }`}
                              >
                                <SendIcon size={12} />
                                {bill.sentChannels?.length ? t(language, 'resend') : t(language, 'send')}
                              </button>
                            )}

                            {!isCancelled && (
                              <button
                                data-testid={`cancel-bill-${bill.id}`}
                                onClick={() => handleCancel(bill)}
                                title="Cancel this bill"
                                className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                              >
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

        {/* Send (WhatsApp / Email) */}
        {sendModalBill && (
          <div
            data-testid="send-modal-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md fade-in"
            onClick={() => setSendModalBill(null)}
          >
            <div
              data-testid="send-modal"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl pop-in"
            >
              <div className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 px-6 py-5 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {sendModalBill.sentChannels?.length ? t(language, 'resend') : t(language, 'send')} invoice
                  </h3>
                  <button
                    data-testid="send-modal-close"
                    onClick={() => setSendModalBill(null)}
                    className="rounded-lg bg-white/10 p-1.5 text-white/90 transition-colors hover:bg-white/20"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 text-sm text-white/90">
                  <span className="font-mono font-semibold">{sendModalBill.billNumber}</span>
                  {' · '}
                  {sendModalBill.customerName || 'Customer'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-5">
                <button
                  data-testid="send-modal-whatsapp"
                  onClick={() => sendViaWhatsApp(sendModalBill)}
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-lg"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 transition-colors group-hover:bg-emerald-500">
                    <MessageCircle size={26} className="text-emerald-600 transition-colors group-hover:text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{t(language, 'sendViaWhatsApp')}</p>
                  {sendModalBill.customerPhone ? (
                    <p className="max-w-full truncate px-2 text-[11px] text-slate-500">{sendModalBill.customerPhone}</p>
                  ) : (
                    <p className="text-[11px] italic text-amber-600">No phone on file</p>
                  )}
                  {sendModalBill.sentChannels?.includes('whatsapp') && (
                    <span className="absolute right-2 top-2 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                      Sent
                    </span>
                  )}
                </button>

                <button
                  data-testid="send-modal-email"
                  onClick={() => sendViaEmail(sendModalBill)}
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 p-5 transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-50 hover:shadow-lg"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 transition-colors group-hover:bg-sky-500">
                    <Mail size={26} className="text-sky-600 transition-colors group-hover:text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{t(language, 'sendViaEmailLabel')}</p>
                  {sendModalBill.customerEmail ? (
                    <p className="max-w-full truncate px-2 text-[11px] text-slate-500">{sendModalBill.customerEmail}</p>
                  ) : (
                    <p className="text-[11px] italic text-amber-600">No email on file</p>
                  )}
                  {sendModalBill.sentChannels?.includes('email') && (
                    <span className="absolute right-2 top-2 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                      Sent
                    </span>
                  )}
                </button>
              </div>

              <p className="px-6 pb-5 text-center text-[11px] text-slate-400">
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
    </div>
  );
}