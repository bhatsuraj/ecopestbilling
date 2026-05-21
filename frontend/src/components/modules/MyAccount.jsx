import React, { useState } from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { User, Mail, Phone, BadgeCheck, Save, Shield, Lock, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { isStrongPassword, PASSWORD_RULE_TEXT } from '../../lib/password';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MyAccount() {
  const { language, currentUser, updateCurrentUser, login } = useApp();
  const [form, setForm] = useState({
    name:  currentUser?.name  || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  // ─── Password change state ─────────────────────────────────────────────
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });

  if (!currentUser) return null;

  const handleSave = () => {
    setError(''); setSuccess('');
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('All fields are required.'); return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      setError('Enter a valid 10-digit phone number.'); return;
    }
    updateCurrentUser(form);
    setSuccess('Profile updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleChangePassword = async () => {
    setPwdError(''); setPwdSuccess('');
    if (!pwd.current || !pwd.next || !pwd.confirm) {
      setPwdError('All password fields are required.'); return;
    }
    if (pwd.next.length < 8 || !isStrongPassword(pwd.next)) {
      setPwdError(PASSWORD_RULE_TEXT); return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdError('New password and confirmation do not match.'); return;
    }
    if (pwd.next === pwd.current) {
      setPwdError('New password must be different from the current password.'); return;
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

  return (
    <div className="fade-in space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {t(language, 'myAccount')}
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">View and update your account details</p>
      </div>

      {/* Header card */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
            <User size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>{currentUser.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
                {currentUser.employeeId}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                currentUser.role === 'superior' ? 'bg-purple-200 text-purple-800' : 'bg-blue-200 text-blue-800'
              }`}>
                <Shield size={10} className="inline mr-0.5" />
                {currentUser.role === 'superior' ? 'Superior Admin' : 'Assistant Admin'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Read-only info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <BadgeCheck size={16} className="text-green-700" />
          Account Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Employee ID</p>
            <p data-testid="account-emp-id" className="font-mono text-green-700 font-bold mt-1">{currentUser.employeeId}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Role</p>
            <p data-testid="account-role" className="text-slate-900 font-semibold mt-1 capitalize">
              {currentUser.role === 'superior' ? 'Superior Admin' : 'Assistant Admin'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Joined</p>
            <p className="text-slate-900 mt-1">
              {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Permissions</p>
            <p className="text-slate-900 mt-1 text-xs">
              {currentUser.role === 'superior'
                ? 'Create bills • Manage admins • Edit company profile'
                : 'Approve / reject bills • Manage customers • Service requests'}
            </p>
          </div>
        </div>
      </div>

      {/* Editable info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Edit Profile</h3>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Full Name</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="account-name-input" type="text"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Email</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="account-email-input" type="email"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Phone</label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="account-phone-input" type="tel" maxLength={10}
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        {error   && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {success && <p data-testid="account-success" className="text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

        <button data-testid="account-save-button" onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
          <Save size={16} /> Save Changes
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <KeyRound size={16} className="text-green-700" /> Change Password
        </h3>

        {[
          { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
          { key: 'next', label: 'New Password', placeholder: 'Min 8 chars, letters + numbers + @ ! #' },
          { key: 'confirm', label: 'Confirm New Password', placeholder: 'Re-enter new password' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid={`password-${key}-input`}
                type={showPwd[key] ? 'text' : 'password'}
                value={pwd[key]}
                placeholder={placeholder}
                onChange={e => setPwd({ ...pwd, [key]: e.target.value })}
                className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setShowPwd({ ...showPwd, [key]: !showPwd[key] })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Toggle password visibility">
                {showPwd[key] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {key === 'next' && (
              <p className="mt-1.5 text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
            )}
          </div>
        ))}

        {pwdError && <p data-testid="password-error" className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{pwdError}</p>}
        {pwdSuccess && <p data-testid="password-success" className="text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg">{pwdSuccess}</p>}

        <button
          data-testid="password-change-button"
          onClick={handleChangePassword}
          disabled={pwdBusy}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-60">
          {pwdBusy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {pwdBusy ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}
