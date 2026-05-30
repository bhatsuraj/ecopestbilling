import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { User, Mail, Lock, Globe, Shield, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SimpleRegisterPage() {
  const { language, setLanguage } = useApp();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('All fields are required.');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      await axios.post(`${API}/auth/simple-register`, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
      });
      
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login-simple'), 1500);
    } catch (e) {
      if (e.response?.data?.detail) {
        setError(e.response.data.detail);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-green-800">
        <img src="https://images.unsplash.com/photo-1730320631955-fb257a118940?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
          alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 w-full">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 mb-6 overflow-hidden">
            <CompanyLogo size={40} imgClass="h-full w-full object-contain p-1.5" />
          </div>
          <h1 className="text-4xl font-bold text-center mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Eco Pest Solutions
          </h1>
          <div className="mt-4 bg-white/20 border border-white/30 rounded-xl p-4 max-w-xs text-center">
            <Shield size={24} className="mx-auto mb-2 text-white" />
            <p className="text-white font-semibold text-sm">First registration</p>
            <p className="text-green-100 text-xs mt-1">You will become the Superior Admin with full access</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center overflow-hidden">
                <CompanyLogo size={18} imgClass="h-full w-full object-contain p-0.5" />
              </div>
              <span className="font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Eco Pest</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Globe size={16} className="text-slate-500" />
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700">
                {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div className="fade-in">
            <h2 className="text-3xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {t(language, 'register')}
            </h2>
            <p className="text-slate-500 mb-2 text-sm">Create the Superior Admin account</p>
            <div className="mb-4 flex items-center gap-2 text-xs bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-purple-700">
              <Shield size={14} />
              <span>First user → <strong>Superior Admin</strong> (full access)</span>
            </div>

            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t(language, 'fullName')}</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="name" type="text"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    placeholder="Full Name" value={form.name} onChange={handleChange} />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t(language, 'email')}</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="email" type="email"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    placeholder="email@example.com" value={form.email} onChange={handleChange} />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="password" type={showPassword ? "text" : "password"}
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    placeholder="At least 6 characters" value={form.password} onChange={handleChange} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex gap-2">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}
              
              {success && <p className="text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

              <button disabled={busy} onClick={handleRegister}
                className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin"/>}
                Create Superior Admin Account
              </button>
              
              <p className="text-xs text-slate-500 text-center">
                Simple registration (temporary workaround)
              </p>
            </div>

            <p className="mt-6 text-center text-slate-500 text-sm">
              {t(language, 'hasAccount')}{' '}
              <Link to="/login-simple" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
                {t(language, 'loginNow')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
