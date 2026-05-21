import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Overview from '../components/modules/Overview';
import BillGenerate from '../components/modules/BillGenerate';
import Customers from '../components/modules/Customers';
import BillSummary from '../components/modules/BillSummary';
import VerificationRequests from '../components/modules/VerificationRequests';
import CompanyProfile from '../components/modules/CompanyProfile';
import AdminManagement from '../components/modules/AdminManagement';
import MyAccount from '../components/modules/MyAccount';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="bill-generate" element={<BillGenerate />} />
            <Route path="bill-generate/:billNumber" element={<BillGenerate />} />
            <Route path="customers" element={<Customers />} />
            <Route path="bill-summary" element={<BillSummary />} />
            <Route path="verification-requests" element={<VerificationRequests />} />
            {/* Legacy route — redirect old links to new Verification Requests page */}
            <Route path="requests" element={<Navigate to="/dashboard/verification-requests" replace />} />
            <Route path="company-profile" element={<CompanyProfile />} />
            <Route path="admin-management" element={<AdminManagement />} />
            {/* Legacy redirect — Bill Approvals removed in favor of Verification Requests */}
            <Route path="bill-approvals" element={<Navigate to="/dashboard/verification-requests" replace />} />
            <Route path="my-account" element={<MyAccount />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
