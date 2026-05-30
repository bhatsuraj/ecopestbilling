import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { Mail, Copy, CheckCircle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MagicLinkLoginPage() {
  const { login } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRequestLink = async () => {
    setError('');
    setMagicLink('');
    
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/auth/magic-link/request`, {
        email: email.trim(),
      });
      
      setMagicLink(data.link);
    } catch (e) {
      if (e.response?.data?.detail) {
        setError(e.response.data.detail);
      } else {
        setError('Failed to generate magic link. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    window.open(magicLink, '_self');
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Left Panel */}
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
            Professional Pest Control Services
          </p>
          <div className="bg-white/20 border border-white/30 rounded-xl p-4 max-w-sm text-center">
            <Mail size={24} className="mx-auto mb-2 text-white" />
            <p className="text-white font-semibold text-sm">Magic Link Login</p>
            <p className="text-green-100 text-xs mt-1">No password required - secure one-click access</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center overflow-hidden">
                <CompanyLogo size={18} imgClass="h-full w-full object-contain p-0.5" />
              </div>
              <span className="font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Eco Pest</span>
            </div>
          </div>

          <div className="fade-in">
            <h2 className="text-3xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Magic Link Login
            </h2>
            <p className="text-slate-500 mb-6 text-sm">Enter your email to receive a secure login link</p>

            {!magicLink ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRequestLink()}
                    />
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
                  onClick={handleRequestLink}
                  className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy && <Loader2 size={14} className="animate-spin"/>}
                  Generate Magic Link
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Works immediately - no waiting for email! (Email sending coming soon)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex gap-2 mb-3">
                    <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-green-800 font-semibold text-sm">Magic Link Generated!</p>
                      <p className="text-green-700 text-xs mt-1">Click the link below or copy it to login</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Your Magic Link</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      className="w-full px-4 py-3 pr-24 border border-slate-300 rounded-xl bg-slate-50 text-slate-700 text-xs font-mono focus:outline-none"
                      value={magicLink}
                    />
                    <button
                      onClick={handleCopyLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleOpenLink}
                    className="flex-1 py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Open Link & Login
                  </button>
                  <button
                    onClick={() => { setMagicLink(''); setEmail(''); setError(''); }}
                    className="px-4 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-sm"
                  >
                    New Link
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-blue-800 text-xs">
                    <strong>⏰ Expires in 15 minutes</strong><br />
                    This link is for one-time use only and will be invalid after login.
                  </p>
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-slate-500 text-sm">
              Don't have an account?{' '}
              <Link to="/register-simple" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
                Register Now
              </Link>
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Other login options:{' '}
                <Link to="/login-simple" className="text-green-700 hover:text-green-800">Email/Password</Link>
                {' • '}
                <Link to="/login" className="text-green-700 hover:text-green-800">Firebase Auth</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
