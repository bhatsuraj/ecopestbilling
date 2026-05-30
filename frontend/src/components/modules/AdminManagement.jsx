import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  X,
  Shield,
  UserCheck,
  User,
  Trash2,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  FileDown,
  Sparkles,
  Activity,
  BadgeCheck,
  Users,
  KeyRound,
} from 'lucide-react';
import PhoneInput, { isValidE164Phone } from '../ui/phone-input';
import { useConfirm } from '../ui/confirm-dialog';
import { isStrongPassword, PASSWORD_RULE_TEXT } from '../../lib/password';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyForm = { name: '', email: '', phone: '', password: '', role: 'assistant' };

// Build a credentials PDF for one or more users using jsPDF. Plain-text,
// single-column layout. Persists nothing.
const generateCredentialsPdf = async (users, fileName) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Eco Pest Solutions – Login Credentials', 14, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${today}`, 14, y);
  y += 10;

  users.forEach((u, i) => {
    if (y > 260) {
      doc.addPage();
      y = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${i + 1}. ${u.name || '—'}`, 14, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const lines = [
      `Employee ID : ${u.employeeId || '—'}`,
      `Role        : ${u.role === 'superior' ? 'Superior Admin' : 'Assistant Admin'}`,
      `Email       : ${u.email || '—'}`,
      `Phone       : ${u.phone || '—'}`,
      `Password    : ${u.password || '—'}`,
    ];

    lines.forEach((line) => {
      doc.text(line, 18, y);
      y += 6;
    });

    y += 4;
    doc.setDrawColor(220);
    doc.line(14, y, 196, y);
    y += 6;
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Confidential – please share securely with the user.', 14, 287);
  doc.save(fileName);
};

const StatCard = ({ label, value, hint, icon: Icon, tone = 'emerald' }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    purple: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
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
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone]} shadow-lg shadow-black/5`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
};

const MiniCard = ({ title, value, icon: Icon, tone = 'emerald' }) => {
  const tones = {
    emerald: 'from-emerald-500 to-cyan-500 text-emerald-600',
    blue: 'from-sky-500 to-blue-500 text-sky-600',
    purple: 'from-violet-500 to-fuchsia-500 text-violet-600',
  };

  return (
    <div className="rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone].split(' ')[0]} ${tones[tone].split(' ')[1]} text-white shadow-lg`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
};

export default function AdminManagement() {
  const { currentUser, isSuperior } = useApp();
  const { confirm, notify } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data } = await axios.get(`${API}/users`);
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperior()) {
    return (
      <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-[32px] border border-white/80 bg-white/85 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-[0_14px_35px_rgba(16,185,129,0.16)]">
              <Shield size={30} />
            </div>
            <p className="text-lg font-bold text-slate-900">Access Denied</p>
            <p className="mt-1 text-sm text-slate-500">Only Superior Admins can manage users.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleAdd = async () => {
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      setError('All fields are required including password.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!isValidE164Phone(form.phone)) {
      setError('Enter a valid phone number with country code (e.g., +919876543210)');
      return;
    }

    // With the +91 prefix locked, the user-entered portion must be exactly
    // 10 digits — guard against an early-submit when fewer digits are typed.
    const rawDigits = String(form.phone || '').replace(/\D/g, '');
    if (form.phone.startsWith('+91') && rawDigits.length !== 12 /* 91 + 10 */) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    const phoneTail = String(form.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneTail) {
      const dup = users.find((u) => String(u.phone || '').replace(/\D/g, '').slice(-10) === phoneTail);
      if (dup) {
        setError(`Phone ${form.phone} is already registered to ${dup.name || dup.email}.`);
        return;
      }
    }

    if (!isStrongPassword(form.password)) {
      setError(PASSWORD_RULE_TEXT);
      return;
    }

    setBusy(true);
    try {
      const emailLc = form.email.trim().toLowerCase();
      const { data } = await axios.post(`${API}/auth/create-assistant`, {
        name: form.name.trim(),
        email: emailLc,
        phone: form.phone.trim(),
        password: form.password,
      });

      setSuccess(
        `Assistant ${form.name} (${data.employeeId}) added successfully! They can now login with email: ${emailLc}`
      );
      setLastCreated({
        name: form.name.trim(),
        email: emailLc,
        phone: form.phone.trim(),
        password: form.password,
        employeeId: data.employeeId,
        role: 'assistant',
      });
      setShowModal(false);
      setForm(emptyForm);
      await loadUsers();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add assistant');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadLastCredentials = async () => {
    if (!lastCreated) return;
    try {
      await generateCredentialsPdf(
        [lastCreated],
        `Credentials_${lastCreated.employeeId}_${lastCreated.name.replace(/\s+/g, '_')}.pdf`
      );
    } catch (e) {
      await notify({
        title: 'Download failed',
        message: 'Could not generate credentials PDF. Please try again.',
        variant: 'warning',
      });
    }
  };

  const handleDownloadAllCredentials = async () => {
    if (!users.length) return;
    try {
      await generateCredentialsPdf(users, `EcoPest_All_Credentials_${Date.now()}.pdf`);
    } catch (e) {
      await notify({
        title: 'Download failed',
        message: 'Could not generate credentials PDF. Please try again.',
        variant: 'warning',
      });
    }
  };

  const handleDelete = async (userId) => {
    if (String(userId) === String(currentUser?.id)) {
      await notify({
        title: 'Action blocked',
        message: "You can't delete your own account.",
        variant: 'warning',
      });
      return;
    }

    const user = users.find((u) => u.id === userId);
    const ok = await confirm({
      title: `Remove ${user?.name || 'this user'}?`,
      message: 'They will no longer be able to log in. This cannot be undone.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await axios.delete(`${API}/users/${userId}`);
      await loadUsers();
    } catch (e) {
      await notify({
        title: 'Delete failed',
        message: 'Could not delete the user. Please try again.',
        variant: 'danger',
      });
    }
  };

  const toggleRole = async (userId) => {
    if (String(userId) === String(currentUser?.id)) {
      await notify({
        title: 'Action blocked',
        message: "You can't change your own role.",
        variant: 'warning',
      });
      return;
    }

    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const newRole = user.role === 'superior' ? 'assistant' : 'superior';
    const newRoleLabel = newRole === 'superior' ? 'Superior Admin' : 'Assistant Admin';

    const ok = await confirm({
      title: `Change role to ${newRoleLabel}?`,
      message: `${user.name} will become a ${newRoleLabel}. You can change this again later.`,
      confirmText: 'Change role',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!ok) return;

    try {
      await axios.patch(`${API}/users/${userId}/role`, { role: newRole });
      await loadUsers();
    } catch (e) {
      await notify({
        title: 'Role update failed',
        message: e.response?.data?.detail || 'Could not update the role. Please try again.',
        variant: 'danger',
      });
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="relative flex min-h-[60vh] items-center justify-center">
          <Loader2 size={34} className="animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-200/35 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_28%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                <Activity size={12} />
                ADMIN MANAGEMENT
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Admin Management
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Create assistants, update roles, delete users, and download credentials in a clean floating dashboard layout.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
              <MiniCard title="Users" value={users.length} icon={Users} tone="emerald" />
              <MiniCard title="Current Role" value="Superior" icon={Shield} tone="blue" />
              {/* <MiniCard title="Secure PDF" value="Enabled" icon={Download} tone="purple" /> */}
            </div>
          </div>

          <div className="relative mt-6 flex flex-wrap items-center gap-3">
            <button
              data-testid="download-all-credentials-button"
              onClick={handleDownloadAllCredentials}
              disabled={users.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileDown size={16} /> Download All
            </button>

            <button
              data-testid="add-admin-button"
              onClick={() => {
                setShowModal(true);
                setError('');
                setForm(emptyForm);
                setLastCreated(null);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5"
            >
              <Plus size={16} /> Add Assistant
            </button>
          </div>
        </div>

        {success && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            <span>{success}</span>
            {lastCreated && (
              <div className="flex items-center gap-2">
                <button
                  data-testid="download-credentials-button"
                  onClick={handleDownloadLastCredentials}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                  <Download size={14} /> Download Credentials PDF
                </button>
                <button
                  onClick={() => {
                    setSuccess('');
                    setLastCreated(null);
                  }}
                  className="text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-900"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50">
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Emp ID</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-emerald-50/50 ${String(u.id) === String(currentUser?.id) ? 'bg-emerald-50/70' : ''}`}
                  >
                    <td className="px-4 py-4 text-sm text-slate-500">{i + 1}</td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_12px_25px_rgba(16,185,129,0.20)]">
                          <span className="text-sm font-bold">{(u.name || '?').charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-400">{String(u.id) === String(currentUser?.id) ? 'You' : 'Team member'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{u.phone || '-'}</td>
                    <td className="px-4 py-4">
                      <span className="inline-block rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                        {u.employeeId}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <button
                        data-testid={`role-toggle-${u.employeeId}`}
                        onClick={() => toggleRole(u.id)}
                        disabled={String(u.id) === String(currentUser?.id)}
                        title={
                          String(u.id) === String(currentUser?.id)
                            ? 'Cannot change your own role'
                            : `Click to switch to ${u.role === 'superior' ? 'Assistant' : 'Superior'}`
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                          u.role === 'superior'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-sky-100 text-sky-700'
                        } ${
                          String(u.id) === String(currentUser?.id)
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:opacity-90 hover:ring-2 hover:ring-current hover:ring-offset-1'
                        }`}
                      >
                        {u.role === 'superior' ? <Shield size={12} /> : <UserCheck size={12} />}
                        {u.role === 'superior' ? 'Superior' : 'Assistant'}
                      </button>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={String(u.id) === String(currentUser?.id)}
                        className={`rounded-xl p-2 text-rose-600 transition-colors hover:bg-rose-50 ${
                          String(u.id) === String(currentUser?.id) ? 'cursor-not-allowed opacity-30' : ''
                        }`}
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md">
            <div className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 px-6 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Add New Assistant
                    </h3>
                    <p className="text-sm text-white/90">Create a new login and role access</p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-lg bg-white/10 p-1.5 text-white/90 transition-colors hover:bg-white/20"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3 pl-9 pr-4 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                      className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3 pl-9 pr-4 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Phone Number
                  </label>
                  <PhoneInput
                    value={form.phone}
                    onChange={(value) => setForm({ ...form, phone: value })}
                    placeholder="9876543210"
                    lockedCountryCode="+91"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3 pl-9 pr-12 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Min 8 chars, letters + numbers + @ ! #"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
                </div>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <div className="flex gap-2">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-rose-500" />
                      <p className="text-sm text-rose-700">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Add Assistant
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}