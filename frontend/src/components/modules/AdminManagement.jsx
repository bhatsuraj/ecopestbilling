import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { Plus, X, Shield, UserCheck, User, Trash2, Lock, Mail, Phone as PhoneIcon, Loader2, AlertCircle, Eye, EyeOff, Download, FileDown } from 'lucide-react';
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

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
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
    if (y > 260) { doc.addPage(); y = 18; }
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
    lines.forEach((line) => { doc.text(line, 18, y); y += 6; });
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
  // Newly-created assistant (keeps plaintext password client-side so the
  // Superior can download a credentials PDF once). Cleared after download or
  // when the modal is reopened.
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
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Access Denied</p>
          <p className="text-sm">Only Superior Admins can manage users.</p>
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

    // Pre-flight duplicate-phone check against the already-loaded users list.
    // Compares the last 10 digits so +91 vs raw 10-digit forms are equivalent.
    // (Backend also enforces this — this is a fast UX guard.)
    const phoneTail = String(form.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneTail) {
      const dup = users.find(u =>
        String(u.phone || '').replace(/\D/g, '').slice(-10) === phoneTail);
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

      setSuccess(`Assistant ${form.name} (${data.employeeId}) added successfully! They can now login with email: ${emailLc}`);
      // Keep the plaintext credentials in memory so the Superior can download
      // a one-time credentials PDF for the new assistant.
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
        `Credentials_${lastCreated.employeeId}_${lastCreated.name.replace(/\s+/g, '_')}.pdf`,
      );
    } catch (e) {
      await notify({ title: 'Download failed', message: 'Could not generate credentials PDF. Please try again.', variant: 'warning' });
    }
  };

  const handleDownloadAllCredentials = async () => {
    if (!users.length) return;
    try {
      await generateCredentialsPdf(users, `EcoPest_All_Credentials_${Date.now()}.pdf`);
    } catch (e) {
      await notify({ title: 'Download failed', message: 'Could not generate credentials PDF. Please try again.', variant: 'warning' });
    }
  };

  const handleDelete = async (userId) => {
    if (String(userId) === String(currentUser?.id)) {
      await notify({ title: 'Action blocked', message: "You can't delete your own account.", variant: 'warning' });
      return;
    }

    const user = users.find(u => u.id === userId);
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
      await notify({ title: 'Delete failed', message: 'Could not delete the user. Please try again.', variant: 'danger' });
    }
  };

  const toggleRole = async (userId) => {
    if (String(userId) === String(currentUser?.id)) {
      await notify({ title: 'Action blocked', message: "You can't change your own role.", variant: 'warning' });
      return;
    }

    const user = users.find(u => u.id === userId);
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
      await notify({ title: 'Role update failed', message: e.response?.data?.detail || 'Could not update the role. Please try again.', variant: 'danger' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-green-700" />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Admin Management
          </h2>
          <p className="text-slate-500 text-sm">{users.length} registered users</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="download-all-credentials-button"
            onClick={handleDownloadAllCredentials}
            disabled={users.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
            <FileDown size={16} /> Download All
          </button>
          <button 
            data-testid="add-admin-button" 
            onClick={() => { setShowModal(true); setError(''); setForm(emptyForm); setLastCreated(null); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
            <Plus size={16} /> Add Assistant
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium flex items-center justify-between gap-3 flex-wrap">
          <span>{success}</span>
          {lastCreated && (
            <div className="flex items-center gap-2">
              <button
                data-testid="download-credentials-button"
                onClick={handleDownloadLastCredentials}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800 transition-colors">
                <Download size={14} /> Download Credentials PDF
              </button>
              <button
                onClick={() => { setSuccess(''); setLastCreated(null); }}
                className="text-green-700 hover:text-green-900 text-xs font-medium">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Emp ID</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u, i) => (
              <tr key={u.id} className={`hover:bg-slate-50 ${String(u.id) === String(currentUser?.id) ? 'bg-green-50/50' : ''}`}>
                <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-700 text-xs font-bold">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-900">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{u.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded">{u.employeeId}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button 
                    data-testid={`role-toggle-${u.employeeId}`}
                    onClick={() => toggleRole(u.id)}
                    disabled={String(u.id) === String(currentUser?.id)}
                    title={String(u.id) === String(currentUser?.id) ? 'Cannot change your own role' : `Click to switch to ${u.role === 'superior' ? 'Assistant' : 'Superior'}`}
                    className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full font-semibold ${
                      u.role === 'superior'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    } ${String(u.id) === String(currentUser?.id) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current'}`}>
                    {u.role === 'superior' ? <Shield size={12} /> : <UserCheck size={12} />}
                    {u.role === 'superior' ? 'Superior' : 'Assistant'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={String(u.id) === String(currentUser?.id)}
                    className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                      String(u.id) === String(currentUser?.id) ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="Delete user">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Add New Assistant
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="John Doe" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="john@example.com" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                <PhoneInput
                  value={form.phone}
                  onChange={(value) => setForm({ ...form, phone: value })}
                  placeholder="9876543210"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Min 8 chars, letters + numbers + @ ! #" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">{PASSWORD_RULE_TEXT}</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex gap-2">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={busy}
                  className="flex-1 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Add Assistant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
