import React, { useState } from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import {
  User,
  Mail,
  Phone,
  BadgeCheck,
  Save,
  Shield,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Sparkles,
  Activity,
} from 'lucide-react';
import { isStrongPassword, PASSWORD_RULE_TEXT } from '../../lib/password';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InfoCard = ({ label, value }) => (
  <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-semibold text-slate-900 break-words">{value || '—'}</p>
  </div>
);

const Field = ({
  icon: Icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  testId,
  maxLength,
  autoCapitalize,
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </label>
    <div className="relative">
      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />
      <input
        data-testid={testId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3 pl-9 pr-4 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  </div>
);

export default function MyAccount() {
  const { language, currentUser, updateCurrentUser, login } = useApp();

  const [form, setForm] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    // Always store just the 10-digit local number; +91 is a fixed display prefix.
    phone: (currentUser?.phone || '').replace(/\D/g, '').slice(-10),
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Password change state
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });

  if (!currentUser) return null;

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('All fields are required.');
      return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }

    updateCurrentUser(form);
    setSuccess('Profile updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');

    if (!pwd.current || !pwd.next || !pwd.confirm) {
      setPwdError('All password fields are required.');
      return;
    }
    if (pwd.next.length < 8 || !isStrongPassword(pwd.next)) {
      setPwdError(PASSWORD_RULE_TEXT);
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdError('New password and confirmation do not match.');
      return;
    }
    if (pwd.next === pwd.current) {
      setPwdError('New password must be different from the current password.');
      return;
    }

    setPwdBusy(true);
    try {
      await axios.put(`${API}/users/${currentUser.id}/password`, {
        current_password: pwd.current,
        new_password: pwd.next,
      });

      // Keep the session in sync so a future login uses the new password.
      login({ ...currentUser, password: pwd.next });

      setPwd({ current: '', next: '', confirm: '' });
      setPwdSuccess('Password updated successfully.');
      setTimeout(() => setPwdSuccess(''), 4000);
    } catch (e) {
      setPwdError(e.response?.data?.detail || 'Failed to update password.');
    } finally {
      setPwdBusy(false);
    }
  };

  const roleLabel = currentUser.role === 'superior' ? 'Superior Admin' : 'Assistant Admin';
  const permissionsText =
    currentUser.role === 'superior'
      ? 'Create bills • Manage admins • Edit company profile'
      : 'Approve / reject bills • Manage customers • Service requests';

  return (
    <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-200/35 blur-3xl" />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_28%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                <Activity size={12} />
                MY ACCOUNT
              </div>

              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {t(language, 'myAccount')}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                View and update your account details, profile information, and password settings in a clean floating layout.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
              <InfoCard label="Employee ID" value={currentUser.employeeId} />
              <InfoCard label="Role" value={roleLabel} />
              <InfoCard label="Status" value="Active" />
            </div>
          </div>
        </div>

        {/* Header card */}
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_14px_35px_rgba(16,185,129,0.20)]">
              <User size={32} />
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {currentUser.name}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  <Sparkles size={10} />
                  {currentUser.employeeId}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  currentUser.role === 'superior'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-sky-100 text-sky-700'
                }`}>
                  <Shield size={10} className="mr-0.5 inline" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Read-only info */}
        <div className="rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <BadgeCheck size={16} className="text-emerald-700" />
            Account Information
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard label="Employee ID" value={currentUser.employeeId} />
            <InfoCard label="Role" value={roleLabel} />
            <InfoCard
              label="Joined"
              value={
                currentUser.createdAt
                  ? new Date(currentUser.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            <InfoCard label="Permissions" value={permissionsText} />
          </div>
        </div>

        {/* Editable info */}
        <div className="rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Edit Profile</h3>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Profile Settings
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              icon={User}
              label="Full Name"
              testId="account-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter full name"
            />

            <Field
              icon={Mail}
              label="Email"
              type="email"
              testId="account-email-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
              placeholder="email@example.com"
            />

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Phone
              </label>
              <div className="relative flex items-stretch">
                <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />
                <span
                  data-testid="account-phone-prefix"
                  aria-label="Country code +91 (fixed)"
                  className="select-none flex items-center rounded-l-2xl border border-r-0 border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700"
                >
                  +91
                </span>
                <input
                  data-testid="account-phone-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                    })
                  }
                  onKeyDown={(e) => {
                    // Block any attempt to backspace/delete into the +91 prefix area
                    // (no-op here since prefix is a separate element, but kept for safety)
                  }}
                  placeholder="9876543210"
                  className="w-full rounded-r-2xl border border-slate-200 bg-white/95 py-3 pl-3 pr-4 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p data-testid="account-success" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <button
            data-testid="account-save-button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>

        {/* Change Password */}
        <div className="rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <KeyRound size={16} className="text-emerald-700" />
              Change Password
            </h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Secure update
            </span>
          </div>

          {[
            { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
            { key: 'next', label: 'New Password', placeholder: 'Min 8 chars, letters + numbers + @ ! #' },
            { key: 'confirm', label: 'Confirm New Password', placeholder: 'Re-enter new password' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {label}
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" />
                <input
                  data-testid={`password-${key}-input`}
                  type={showPwd[key] ? 'text' : 'password'}
                  value={pwd[key]}
                  placeholder={placeholder}
                  onChange={(e) => setPwd({ ...pwd, [key]: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3 pl-9 pr-11 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd({ ...showPwd, [key]: !showPwd[key] })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {showPwd[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {key === 'next' && (
                <p className="mt-1.5 text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
              )}
            </div>
          ))}

          {pwdError && (
            <p data-testid="password-error" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {pwdError}
            </p>
          )}
          {pwdSuccess && (
            <p data-testid="password-success" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {pwdSuccess}
            </p>
          )}

          <button
            data-testid="password-change-button"
            onClick={handleChangePassword}
            disabled={pwdBusy}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pwdBusy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {pwdBusy ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}