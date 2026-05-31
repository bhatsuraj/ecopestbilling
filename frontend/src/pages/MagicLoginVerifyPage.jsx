import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MagicLoginVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useApp();
  
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setError('Invalid magic link - no token found');
      return;
    }

    verifyToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const verifyToken = async (token) => {
    try {
      const { data } = await axios.post(`${API}/auth/magic-link/verify`, { token });
      
      setStatus('success');
      login(data);
      
      // Redirect to dashboard after 1 second
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (e) {
      setStatus('error');
      if (e.response?.data?.detail) {
        setError(e.response.data.detail);
      } else {
        setError('Failed to verify magic link. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-md p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center overflow-hidden">
              <CompanyLogo size={32} imgClass="h-full w-full object-contain p-1.5" />
            </div>
          </div>

          {status === 'verifying' && (
            <>
              <Loader2 size={48} className="animate-spin text-green-700 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Verifying Magic Link
              </h2>
              <p className="text-slate-600 text-sm">
                Please wait while we log you in...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Login Successful!
              </h2>
              <p className="text-slate-600 text-sm">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={48} className="text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Verification Failed
              </h2>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                onClick={() => navigate('/magic-login')}
                className="px-6 py-2 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm"
              >
                Request New Link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
