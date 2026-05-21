import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SimpleLoginPage from './pages/SimpleLoginPage';
import SimpleRegisterPage from './pages/SimpleRegisterPage';
import MagicLinkLoginPage from './pages/MagicLinkLoginPage';
import MagicLoginVerifyPage from './pages/MagicLoginVerifyPage';
import FirebaseTestPage from './pages/FirebaseTestPage';
import DashboardPage from './pages/DashboardPage';
import { Toaster } from './components/ui/sonner';
import { ConfirmDialogProvider } from './components/ui/confirm-dialog';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useApp();
  return currentUser ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
  const { currentUser, loaded } = useApp();

  // Wait for the initial MongoDB load so synchronous getX() reads have data.
  if (!loaded) {
    return (
      <div data-testid="app-loading" className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Loading data from database…</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Firebase Test Page */}
        <Route path="/firebase-test" element={<FirebaseTestPage />} />
        
        {/* Main Auth Routes (Email/Phone/Password) */}
        <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <SimpleLoginPage />} />
        <Route path="/register" element={currentUser ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        
        {/* Alternative Login Methods */}
        <Route path="/magic-login" element={currentUser ? <Navigate to="/dashboard" replace /> : <MagicLinkLoginPage />} />
        <Route path="/magic-login/verify" element={<MagicLoginVerifyPage />} />
        <Route path="/login-simple" element={currentUser ? <Navigate to="/dashboard" replace /> : <SimpleLoginPage />} />
        <Route path="/register-simple" element={currentUser ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        
        {/* Dashboard */}
        <Route path="/dashboard/*" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        
        {/* Default - use main login */}
        <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AppProvider>
      <ConfirmDialogProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors closeButton />
      </ConfirmDialogProvider>
    </AppProvider>
  );
}

export default App;
