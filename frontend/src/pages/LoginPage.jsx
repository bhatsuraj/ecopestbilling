import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from 'firebase/auth';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { Leaf, Mail, Smartphone, Key, Globe, Loader2, AlertCircle } from 'lucide-react';
import { firebaseAuth, EMAIL_LINK_SETTINGS } from '../lib/firebase';
import {
  getFirebaseErrorMessage,
  safeFirebaseOperation,
  ensureE164Format,
  isValidE164Phone,
} from '../lib/firebase-helpers';
import PhoneInput, { isValidE164Phone as validateE164 } from '../components/ui/phone-input';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LoginPage() {
  const { language, setLanguage, login } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState('email');           // 'email' | 'phone'
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recaptchaRef = useRef(null);

  // ── Exchange a Firebase ID token for the MongoDB user record, then login ──
  const finishLogin = async (firebaseUser, fallbackName) => {
    const idToken = await firebaseUser.getIdToken(true);
    const { data } = await axios.post(`${API}/auth/firebase`, {
      id_token: idToken,
      name: fallbackName || firebaseUser.displayName || '',
      phone: firebaseUser.phoneNumber || '',
    });
    login(data);
    navigate('/dashboard');
  };

  // ── Handle the magic-link callback when user clicks the email link ──
  useEffect(() => {
    if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) return;
    const stored = window.localStorage.getItem('eco_email_for_signin');
    const targetEmail =
      stored || window.prompt('Please confirm your email to complete sign-in:');
    if (!targetEmail) return;
    setBusy(true);
    signInWithEmailLink(firebaseAuth, targetEmail, window.location.href)
      .then((result) => {
        window.localStorage.removeItem('eco_email_for_signin');
        return finishLogin(result.user, '');
      })
      .catch((e) => setError(e.message || 'Magic-link sign-in failed'))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lazily mount the invisible reCAPTCHA when phone tab activates ──
  useEffect(() => {
    if (tab !== 'phone') {
      // Clean up reCAPTCHA when leaving phone tab
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (e) {
          // Ignore cleanup errors
        }
        recaptchaRef.current = null;
      }
      return;
    }
    
    if (recaptchaRef.current) return;
    
    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      try {
        const container = document.getElementById('recaptcha-container');
        if (!container) {
          console.warn('reCAPTCHA container not found');
          return;
        }
        
        recaptchaRef.current = new RecaptchaVerifier(
          firebaseAuth,
          'recaptcha-container',
          { 
            size: 'invisible',
            callback: () => {
              // reCAPTCHA solved
            },
            'expired-callback': () => {
              // reCAPTCHA expired
              setError('reCAPTCHA expired. Please try again.');
            }
          },
        );
        recaptchaRef.current.render().catch((err) => {
          console.warn('reCAPTCHA render failed:', err);
        });
      } catch (e) {
        console.warn('reCAPTCHA init failed', e);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [tab]);

  const handleSendEmailLink = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await sendSignInLinkToEmail(firebaseAuth, email.trim(), EMAIL_LINK_SETTINGS);
      window.localStorage.setItem('eco_email_for_signin', email.trim());
      setEmailSent(true);
    } catch (e) {
      setError(e.message || 'Could not send sign-in link');
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');
    const trimmed = phone.trim();
    
    // Validate E.164 format
    if (!validateE164(trimmed)) {
      setError('Please enter a valid phone number with country code (e.g., +919876543210)');
      return;
    }
    
    if (!recaptchaRef.current) {
      setError('reCAPTCHA not ready yet — please wait a moment.');
      return;
    }
    
    setBusy(true);
    try {
      const cnf = await safeFirebaseOperation(
        () => signInWithPhoneNumber(firebaseAuth, trimmed, recaptchaRef.current),
        'Send Phone OTP'
      );
      setConfirmation(cnf);
    } catch (e) {
      setError(getFirebaseErrorMessage(e));
      // reset reCAPTCHA so the user can try again
      try { await recaptchaRef.current.clear(); } catch { /* ignore */ }
      recaptchaRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP sent to your phone.');
      return;
    }
    setBusy(true);
    try {
      const result = await safeFirebaseOperation(
        () => confirmation.confirm(otp),
        'Verify OTP'
      );
      await finishLogin(result.user, '');
    } catch (e) {
      setError(getFirebaseErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

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
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
              <Leaf size={32} className="text-white" />
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
              <div className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center">
                <Leaf size={18} className="text-white" />
              </div>
              <span className="font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Eco Pest</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Globe size={16} className="text-slate-500" />
              <select
                data-testid="language-select-dropdown"
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

            {/* Tabs */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 mb-6">
              <button
                data-testid="tab-email"
                onClick={() => { setTab('email'); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${tab==='email' ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Mail size={14}/> Email
              </button>
              <button
                data-testid="tab-phone"
                onClick={() => { setTab('phone'); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${tab==='phone' ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Smartphone size={14}/> Phone
              </button>
            </div>

            {/* EMAIL TAB — Magic Link */}
            {tab === 'email' && !emailSent && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      data-testid="email-input"
                      type="email"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendEmailLink()}
                    />
                  </div>
                </div>
                {error && (
                  <div data-testid="login-error" className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="flex gap-2">
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                )}
                <button
                  data-testid="send-magic-link-button"
                  disabled={busy}
                  onClick={handleSendEmailLink}
                  className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy && <Loader2 size={14} className="animate-spin"/>}
                  Send Magic Link
                </button>
                <p className="text-xs text-slate-500">We&apos;ll email you a one-tap sign-in link. No password required.</p>
              </div>
            )}

            {tab === 'email' && emailSent && (
              <div data-testid="email-sent-banner" className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-green-800 font-semibold text-sm mb-1">Check your inbox 📩</p>
                <p className="text-green-900 text-sm">
                  We sent a sign-in link to <strong>{email}</strong>. Click the link from this device to log in.
                </p>
                <button
                  onClick={() => { setEmailSent(false); setEmail(''); }}
                  className="mt-3 text-green-700 text-xs font-semibold underline"
                >
                  Use a different email
                </button>
              </div>
            )}

            {/* PHONE TAB — SMS OTP */}
            {tab === 'phone' && !confirmation && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    placeholder="9876543210"
                    testId="phone-input"
                    onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  />
                </div>
                {error && (
                  <div data-testid="login-error" className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="flex gap-2">
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                )}
                <button
                  data-testid="send-otp-button"
                  disabled={busy}
                  onClick={handleSendOtp}
                  className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy && <Loader2 size={14} className="animate-spin"/>}
                  Send OTP via SMS
                </button>
                {/* reCAPTCHA container - always present when phone tab is active */}
                <div id="recaptcha-container" className="flex justify-center min-h-[78px]" />
              </div>
            )}

            {tab === 'phone' && confirmation && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 text-sm">📱 OTP sent to <strong>{phone}</strong></p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Enter 6-digit OTP</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      data-testid="otp-input"
                      type="text" maxLength={6} inputMode="numeric"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-center text-2xl tracking-[0.4em] font-bold focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                      placeholder="------"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </div>
                </div>
                {error && (
                  <div data-testid="otp-error" className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="flex gap-2">
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                )}
                <button
                  data-testid="verify-otp-button"
                  disabled={busy}
                  onClick={handleVerifyOtp}
                  className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy && <Loader2 size={14} className="animate-spin"/>}
                  Verify &amp; Login
                </button>
                <button
                  onClick={() => { setConfirmation(null); setOtp(''); setError(''); }}
                  className="w-full py-2 text-slate-500 text-sm hover:text-slate-700 transition-colors"
                >
                  ← Use a different number
                </button>
              </div>
            )}

            <p className="mt-6 text-center text-slate-500 text-sm">
              {t(language, 'noAccount')}{' '}
              <Link data-testid="register-link" to="/register" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
                {t(language, 'registerNow')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
