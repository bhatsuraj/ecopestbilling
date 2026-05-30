import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  User,
  Phone,
  MapPin,
  Mail,
  FileText,
  Calendar,
  Hash,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY } from '../../lib/date';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  gstNumber: '',
  sacNumber: '',
  poNumber: '',
  poDate: '',
};

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// IMPORTANT: hoisted OUTSIDE the parent component to keep the same component
// reference across renders — otherwise the input loses focus after every keystroke.
const Field = ({
  icon: Icon,
  label,
  name,
  type = 'text',
  required = false,
  placeholder = '',
  maxLength,
  value,
  onChange,
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      {required && ' *'}
      {!required && <span className="ml-1 normal-case text-slate-400">(optional)</span>}
    </label>
    <div className="relative">
      {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />}
      <input
        data-testid={`customer-${name}-input`}
        type={type}
        maxLength={maxLength}
        className={`w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 ${Icon ? 'pl-9' : 'pl-4'} pr-4`}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  </div>
);

function StatCard({ label, value, hint, accent = 'emerald' }) {
  const accentStyles = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {value}
          </p>
          {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentStyles[accent]} shadow-lg shadow-black/5`}>
          <User size={18} />
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const { language, getCustomers, saveCustomers } = useApp();
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const customers = getCustomers();

  // Alphabetical sort (A–Z) by Customer Name (case-insensitive).
  // Secondary tiebreaker: GST/Company identifier (this app stores company info
  // under `gstNumber` / `name` itself — using `gstNumber` then `email` as a
  // stable secondary key so ordering stays deterministic across renders.)
  const sortedCustomers = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    return [...customers].sort((a, b) => {
      const an = (a.name || '').trim();
      const bn = (b.name || '').trim();
      const primary = collator.compare(an, bn);
      if (primary !== 0) return primary;
      const ac = (a.gstNumber || a.email || '').trim();
      const bc = (b.gstNumber || b.email || '').trim();
      return collator.compare(ac, bc);
    });
  }, [customers]);

  const filtered = sortedCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const setField = (name, value) =>
    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'gstNumber'
          ? String(value).toUpperCase()
          : name === 'sacNumber'
            ? String(value).replace(/\D/g, '')
            : name === 'email'
              ? String(value).toLowerCase()
              : value,
    }));

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      gstNumber: c.gstNumber || '',
      sacNumber: c.sacNumber || '',
      poNumber: c.poNumber || '',
      poDate: c.poDate || '',
    });
    setEditId(c.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = () => {
    setError('');

    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email.trim())) {
      setError('Please enter a valid email like name@domain.com');
      return;
    }
    if (!form.address.trim()) {
      setError('Address is required.');
      return;
    }
    if (form.phone && !/^\d{10}$/.test(form.phone.trim())) {
      setError('Phone must be a 10-digit number, or leave blank.');
      return;
    }

    const list = getCustomers();
    const phoneTail = (form.phone || '').replace(/\D/g, '').slice(-10);

    if (editId) {
      if (phoneTail) {
        const dupPhone = list.find(
          (c) =>
            c.id !== editId &&
            String(c.phone || '').replace(/\D/g, '').slice(-10) === phoneTail
        );
        if (dupPhone) {
          setError(`Phone ${form.phone} is already used by "${dupPhone.name}".`);
          return;
        }
      }
      saveCustomers(list.map((c) => (c.id === editId ? { ...c, ...form } : c)));
    } else {
      if (form.email.trim()) {
        const dup = list.find(
          (c) => (c.email || '').toLowerCase() === form.email.trim().toLowerCase()
        );
        if (dup) {
          setError('A customer with this email already exists.');
          return;
        }
      }
      if (phoneTail) {
        const dupPhone = list.find(
          (c) => String(c.phone || '').replace(/\D/g, '').slice(-10) === phoneTail
        );
        if (dupPhone) {
          setError(`Phone ${form.phone} is already used by "${dupPhone.name}".`);
          return;
        }
      }
      saveCustomers([
        ...list,
        { ...form, id: Date.now(), createdAt: new Date().toISOString() },
      ]);
    }

    setShowModal(false);
  };

  const handleDelete = async (id) => {
    const target = getCustomers().find((c) => c.id === id);
    const ok = await confirm({
      title: `Delete ${target?.name || 'this customer'}?`,
      message: 'They will be permanently removed from your customer list. This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (ok) {
      saveCustomers(getCustomers().filter((c) => c.id !== id));
    }
  };

  const handleDownloadExcel = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Yield to the browser so the spinner can paint before the (potentially
      // CPU-heavy) workbook generation kicks in.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const rows = sortedCustomers.map((c, idx) => ({
        '#': idx + 1,
        'Customer Name': c.name || '',
        Email: c.email || '',
        Phone: c.phone || '',
        Address: c.address || '',
        'GST Number': c.gstNumber || '',
        'SAC No.': c.sacNumber || '',
        'P.O. Number': c.poNumber || '',
        'P.O. Date': c.poDate ? formatDateDDMMYY(c.poDate) : '',
        'Created On': c.createdAt ? formatDateDDMMYY(c.createdAt) : '',
      }));

      const headers = [
        '#',
        'Customer Name',
        'Email',
        'Phone',
        'Address',
        'GST Number',
        'SAC No.',
        'P.O. Number',
        'P.O. Date',
        'Created On',
      ];

      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

      // Bold header row styling
      headers.forEach((_, idx) => {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: idx });
        if (ws[cellAddr]) {
          ws[cellAddr].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '059669' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      });

      // Auto-size columns based on the longest value in each column
      ws['!cols'] = headers.map((h) => {
        const maxLen = rows.reduce(
          (acc, row) => Math.max(acc, String(row[h] ?? '').length),
          h.length
        );
        return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');

      const stamp = new Date()
        .toISOString()
        .replace(/[:T]/g, '-')
        .split('.')[0];
      XLSX.writeFile(wb, `customers_${stamp}.xlsx`);
    } catch (err) {
      console.error('Excel export failed', err);
    } finally {
      setDownloading(false);
    }
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
                <User size={12} />
                CUSTOMER MANAGEMENT
              </div>

              <p className="mt-4 text-sm font-medium text-slate-500">
                {t(language, 'welcomeBack') || 'Manage your customers with a clean premium view'}
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {t(language, 'customers')}
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Add, search, edit, and organize customer records in a smooth floating dashboard layout.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Customers</p>
                <p className="mt-2 text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {customers.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Visible</p>
                <p className="mt-2 text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {filtered.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                <p className="mt-2 text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Active
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-6 flex flex-wrap items-center gap-3">
            <button
              data-testid="add-customer-button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5"
            >
              <Plus size={16} />
              {t(language, 'addCustomer')}
            </button>

            <button
              data-testid="download-customers-excel-button"
              onClick={handleDownloadExcel}
              disabled={downloading || customers.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              title={customers.length === 0 ? 'No customers to export' : 'Download Excel'}
            >
              {downloading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  Download Excel
                </>
              )}
            </button>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_10px_25px_rgba(15,23,42,0.06)]">
              <Search size={16} className="text-emerald-600" />
              <span>{filtered.length} {String(t(language, 'activeCustomers') || 'active customers').toLowerCase()}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="rounded-[26px] border border-white/80 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
            <input
              data-testid="customer-search-input"
              type="text"
              placeholder={t(language, 'search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-[28px] border border-white/80 bg-white/90 px-6 py-16 text-center shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[0_10px_25px_rgba(16,185,129,0.12)]">
              <User size={30} />
            </div>
            <p className="text-lg font-semibold text-slate-800">{t(language, 'noData')}</p>
            <p className="mt-1 text-sm text-slate-500">Add your first customer to get started</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50">
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">#</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t(language, 'customerName')}</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t(language, 'email')}</th>
                    <th className="hidden px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 md:table-cell">{t(language, 'phone')}</th>
                    <th className="hidden px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 lg:table-cell">GST</th>
                    <th className="hidden px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 lg:table-cell">SAC No.</th>
                    <th className="hidden px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 xl:table-cell">P.O. No.</th>
                    <th className="hidden px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 xl:table-cell">P.O. Date</th>
                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t(language, 'actions')}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c, i) => (
                    <tr key={c.id} className="transition-colors hover:bg-emerald-50/50">
                      <td className="px-4 py-4 text-sm text-slate-500">{i + 1}</td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_12px_25px_rgba(16,185,129,0.20)]">
                            <span className="text-sm font-bold">{(c.name || '?').charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-400 md:hidden">{c.phone || '—'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">{c.email || '—'}</td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 md:table-cell">{c.phone || '—'}</td>
                      <td className="hidden px-4 py-4 font-mono text-xs text-slate-500 lg:table-cell">{c.gstNumber || '—'}</td>
                      <td className="hidden px-4 py-4 font-mono text-xs text-slate-500 lg:table-cell">{c.sacNumber || '—'}</td>

                      <td className="hidden px-4 py-4 text-xs text-slate-500 xl:table-cell">
                        <span className="font-mono">{c.poNumber || '—'}</span>
                      </td>

                      <td className="hidden px-4 py-4 text-xs text-slate-500 xl:table-cell">
                        {c.poDate ? formatDateDDMMYY(c.poDate) : '—'}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            data-testid={`edit-customer-${c.id}`}
                            onClick={() => openEdit(c)}
                            className="rounded-xl border border-slate-200 p-2 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            data-testid={`delete-customer-${c.id}`}
                            onClick={() => handleDelete(c.id)}
                            className="rounded-xl border border-slate-200 p-2 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-sm">
            <div className="my-8 w-full max-w-4xl overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
                <div className="relative bg-gradient-to-br from-emerald-500 via-cyan-500 to-sky-500 p-6 text-white sm:p-8">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_30%)]" />
                  <div className="relative flex h-full flex-col justify-between gap-6">
                    <div>
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white/90">
                        CUSTOMER FORM
                      </div>
                      <h3 className="text-2xl font-bold leading-tight sm:text-3xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {editId ? `${t(language, 'edit')} Customer` : t(language, 'addCustomer')}
                      </h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-white/90">
                        Fill customer information in this clean floating panel.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/75">Fields</p>
                        <p className="mt-2 text-2xl font-bold">8</p>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/75">Mode</p>
                        <p className="mt-2 text-2xl font-bold">{editId ? 'Edit' : 'Create'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Details</p>
                      <h4 className="mt-1 text-lg font-bold text-slate-900">Customer information</h4>
                    </div>
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <Field
                      icon={User}
                      label="Customer Name"
                      name="name"
                      required
                      placeholder="Full Name"
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                    />
                    <Field
                      icon={Mail}
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="email@example.com"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                    />
                    <Field
                      icon={Phone}
                      label="Phone Number"
                      name="phone"
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                    />

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Address *
                      </label>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-3 text-emerald-600/70" />
                        <textarea
                          data-testid="customer-address-input"
                          rows={3}
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 pl-9 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          placeholder="Full Address"
                          value={form.address}
                          onChange={(e) => setField('address', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        icon={FileText}
                        label="GST Number"
                        name="gstNumber"
                        placeholder="29ABCDE1234F1Z5"
                        value={form.gstNumber}
                        onChange={(e) => setField('gstNumber', e.target.value)}
                      />
                      <Field
                        icon={Hash}
                        label="SAC No."
                        name="sacNumber"
                        placeholder="998531"
                        maxLength={8}
                        value={form.sacNumber}
                        onChange={(e) => setField('sacNumber', e.target.value)}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        icon={FileText}
                        label="P.O. Number"
                        name="poNumber"
                        placeholder="PO-12345"
                        value={form.poNumber}
                        onChange={(e) => setField('poNumber', e.target.value)}
                      />
                      <Field
                        icon={Calendar}
                        label="P.O. Date"
                        name="poDate"
                        type="date"
                        value={form.poDate}
                        onChange={(e) => setField('poDate', e.target.value)}
                      />
                    </div>

                    {error && (
                      <p data-testid="customer-error" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                        {error}
                      </p>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowModal(false)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {t(language, 'cancel')}
                      </button>
                      <button
                        data-testid="save-customer-button"
                        onClick={handleSave}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5"
                      >
                        {editId ? t(language, 'update') : t(language, 'save')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}