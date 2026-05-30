import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { Mail, Lock, Globe, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SimpleLoginPage() {
  const { language, setLanguage, login } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [superiorExists, setSuperiorExists] = useState(true);

  // Hide the "Register Now" link once a Superior Admin already exists.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/auth/superior-exists`);
        if (active) setSuperiorExists(Boolean(data?.exists));
      } catch (_e) {
        // Default to hidden on failure (safer than exposing register link).
      }
    })();
    return () => { active = false; };
  }, []);

  // Detect whether the typed identifier looks like an email or a phone number.
  // Anything containing '@' or any non-digit letter is treated as an email;
  // pure digits (with an optional leading '+') are treated as phone.
  const looksLikePhone = (v) => /^[+\d\s-]*$/.test(v) && /\d/.test(v);

  const onIdentifierChange = (e) => {
    let v = e.target.value;
    if (v.includes('@')) {
      setEmail(v.toLowerCase());
      return;
    }
    // If user is clearly typing a phone, keep only digits & a single leading '+'.
    if (looksLikePhone(v) || v === '' || v === '+') {
      const hasPlus = v.trim().startsWith('+');
      const digits = v.replace(/\D/g, '');
      setEmail(hasPlus ? `+${digits}` : digits);
      return;
    }
    // Anything else (e.g. partial email being typed) — keep as lowercase text.
    setEmail(v.toLowerCase());
  };

  // Normalise a phone identifier to E.164 with the default India country code (+91).
  //   "9876543210"      → "+919876543210"
  //   "+919876543210"   → "+919876543210"
  //   "919876543210"    → "+919876543210"
  const normalisePhone = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return raw;
    if (raw.trim().startsWith('+')) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length > 10 && digits.startsWith('91')) return `+${digits}`;
    return `+91${digits}`;
  };

  const handleLogin = async () => {
    setError('');

    const identifier = email.trim();
    if (!identifier || !password.trim()) {
      setError('Please enter your email or phone and password.');
      return;
    }

    let payloadIdentifier;
    if (identifier.includes('@')) {
      payloadIdentifier = identifier.toLowerCase();
    } else {
      payloadIdentifier = normalisePhone(identifier);
    }

    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/auth/simple-login`, {
        email: payloadIdentifier,
        password: password,
      });

      login(data);
      navigate('/dashboard');
    } catch (e) {
      if (e.response?.data?.detail) {
        setError(e.response.data.detail);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setBusy(false);
    }
  };

  // Show the "+91" prefix badge only when the user is typing a phone number
  // (and hasn't already supplied their own + prefix).
  const showPhonePrefix =
    email !== '' && looksLikePhone(email) && !email.trim().startsWith('+');

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Left Panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-green-800">
        <img
          src="https://images.unsplash.com/photo-1773700066931-f33f507cfbd3?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
          alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 overflow-hidden">
              <CompanyLogo size={32} imgClass="h-full w-full object-contain p-1.5" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Eco Pest Solutions
          </h1>
          <p className="text-green-100 text-lg text-center max-w-sm mb-8">
            {t(language, 'tagline')}
          </p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            {['Professional Service','Eco-Friendly','100% Safe','Guaranteed Results'].map(f => (
              <div key={f} className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <p className="text-white text-sm font-medium">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — auth */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Language + Mobile logo */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center overflow-hidden">
                <CompanyLogo size={18} imgClass="h-full w-full object-contain p-0.5" />
              </div>
              <span className="font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Eco Pest</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Globe size={16} className="text-slate-500" />
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div className="fade-in">
            <h2 className="text-3xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Welcome Back
            </h2>
            <p className="text-slate-500 mb-6 text-sm">Sign in to your billing account</p>

            <div className="space-y-4">
              {/* Email / Phone Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email or Phone</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {showPhonePrefix && (
                    <span
                      data-testid="login-phone-prefix"
                      className="absolute left-9 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-medium pointer-events-none select-none"
                    >
                      +91
                    </span>
                  )}
                  <input
                    type="text"
                    autoComplete="username"
                    className={`w-full ${showPhonePrefix ? 'pl-[4.25rem]' : 'pl-10'} pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all`}
                    placeholder="you@example.com or 9876543210"
                    value={email}
                    onChange={onIdentifierChange}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    data-testid="login-identifier-input"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Phone numbers default to India (+91). Add your own + prefix to use another country code.
                </p>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
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

              <button
                disabled={busy}
                onClick={handleLogin}
                className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 size={14} className="animate-spin"/>}
                Sign In
              </button>
            </div>

            <p className="mt-6 text-center text-slate-500 text-sm">
              {superiorExists ? (
                <span>Need an account? Please contact your administrator.</span>
              ) : (
                <>
                  {t(language, 'noAccount')}{' '}
                  <Link data-testid="register-link" to="/register" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
                    {t(language, 'registerNow')}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
