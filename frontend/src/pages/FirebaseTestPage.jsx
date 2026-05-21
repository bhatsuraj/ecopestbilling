import React, { useState } from 'react';
import { sendSignInLinkToEmail, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { Leaf, CheckCircle, XCircle, Loader2, Smartphone, Mail } from 'lucide-react';

export default function FirebaseTestPage() {
  const [status, setStatus] = useState({});
  const [testing, setTesting] = useState(false);

  const testFirebaseConnection = async () => {
    setTesting(true);
    const results = {};

    // Test 1: Firebase initialized
    try {
      if (firebaseAuth) {
        results.init = { success: true, message: 'Firebase initialized successfully' };
      } else {
        results.init = { success: false, message: 'Firebase not initialized' };
      }
    } catch (e) {
      results.init = { success: false, message: e.message };
    }

    // Test 2: Check project configuration
    try {
      const config = firebaseAuth.app.options;
      results.config = {
        success: true,
        message: `Project: ${config.projectId}`,
        details: {
          projectId: config.projectId,
          authDomain: config.authDomain,
          apiKey: config.apiKey ? 'Present' : 'Missing',
        }
      };
    } catch (e) {
      results.config = { success: false, message: e.message };
    }

    // Test 3: Try email link (will fail if domain not authorized)
    try {
      await sendSignInLinkToEmail(firebaseAuth, 'test@example.com', {
        url: `${window.location.origin}/test`,
        handleCodeInApp: true,
      });
      results.emailLink = { 
        success: true, 
        message: '✅ Email link works! Domain is authorized!' 
      };
    } catch (e) {
      if (e.code === 'auth/unauthorized-domain') {
        results.emailLink = {
          success: false,
          message: '❌ Domain not authorized',
          fix: 'Add your domain to Firebase Console → Authentication → Settings → Authorized domains'
        };
      } else if (e.code === 'auth/invalid-email') {
        results.emailLink = {
          success: true,
          message: '✅ Firebase connection works! (Test email was invalid but connection succeeded)'
        };
      } else {
        results.emailLink = { success: false, message: `Error: ${e.code} - ${e.message}` };
      }
    }

    // Test 4: Check if email/password is enabled
    results.authMethods = {
      success: null,
      message: 'Check Firebase Console to verify Email/Password and Phone are enabled'
    };

    setStatus(results);
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-700 rounded-xl flex items-center justify-center">
              <Leaf size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Firebase Connection Test
              </h1>
              <p className="text-slate-600 text-sm">Verify your Firebase setup is working correctly</p>
            </div>
          </div>

          <button
            onClick={testFirebaseConnection}
            disabled={testing}
            className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {testing && <Loader2 size={18} className="animate-spin" />}
            {testing ? 'Testing...' : 'Run Firebase Tests'}
          </button>
        </div>

        {/* Test Results */}
        {Object.keys(status).length > 0 && (
          <div className="space-y-4">
            {/* Firebase Initialization */}
            <TestResult
              title="1. Firebase Initialization"
              result={status.init}
            />

            {/* Project Configuration */}
            <TestResult
              title="2. Project Configuration"
              result={status.config}
            />

            {/* Email Link Test */}
            <TestResult
              title="3. Email Link / Domain Authorization"
              result={status.emailLink}
            />

            {/* Auth Methods */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 font-bold text-sm">4</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">Authentication Methods</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 text-sm mb-3">
                      <strong>Manual Check Required:</strong> Verify these are enabled in Firebase Console
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-blue-600" />
                        <span>Email/Password + Email Link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-blue-600" />
                        <span>Phone Authentication</span>
                      </div>
                    </div>
                    <a
                      href="https://console.firebase.google.com/project/ecopestsolution-1/authentication/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Open Firebase Console →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Setup Guide */}
        <div className="mt-8 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">🚀 Quick Setup Checklist</h2>
          <div className="space-y-3">
            <SetupStep
              number="1"
              title="Enable Email/Password Authentication"
              link="https://console.firebase.google.com/project/ecopestsolution-1/authentication/providers"
              description="Enable 'Email/Password' and check 'Email link (passwordless sign-in)'"
            />
            <SetupStep
              number="2"
              title="Enable Phone Authentication"
              link="https://console.firebase.google.com/project/ecopestsolution-1/authentication/providers"
              description="Enable 'Phone' provider"
            />
            <SetupStep
              number="3"
              title="Add Authorized Domain"
              link="https://console.firebase.google.com/project/ecopestsolution-1/authentication/settings"
              description="Add: billing-preview-12.preview.emergentagent.com"
            />
            <SetupStep
              number="4"
              title="Test Authentication"
              link="/login"
              description="Go to login page and try Firebase authentication"
            />
          </div>
        </div>

        {/* Configuration Display */}
        {status.config?.details && (
          <div className="mt-6 bg-slate-900 rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-3">Current Firebase Configuration:</h3>
            <div className="font-mono text-sm space-y-1 text-green-400">
              <div>Project ID: {status.config.details.projectId}</div>
              <div>Auth Domain: {status.config.details.authDomain}</div>
              <div>API Key: {status.config.details.apiKey}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TestResult({ title, result }) {
  if (!result) return null;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {result.success === true ? (
            <CheckCircle size={24} className="text-green-600" />
          ) : result.success === false ? (
            <XCircle size={24} className="text-red-600" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
          <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
            {result.message}
          </p>
          {result.fix && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm">
                <strong>How to fix:</strong> {result.fix}
              </p>
            </div>
          )}
          {result.details && (
            <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function SetupStep({ number, title, link, description }) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-lg p-4">
      <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-green-700 text-sm font-semibold hover:text-green-800"
        >
          {link.includes('console.firebase') ? 'Open Firebase Console →' : 'Go to page →'}
        </a>
      </div>
    </div>
  );
}
