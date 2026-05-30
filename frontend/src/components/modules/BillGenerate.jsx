import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../ui/confirm-dialog';
import { t } from '../../i18n/translations';
import { Plus, Trash2, Eye, ShieldCheck, X, ArrowLeft, Check, Search, ChevronDown } from 'lucide-react';
import InvoicePreview from './InvoicePreview';

const VISIT_TYPES = [
  { value: 'Per Visit',   key: 'perVisit'   },
  { value: 'Per Month',   key: 'perMonth'   },
  { value: 'Per Service', key: 'perService' },
  { value: 'Per Week',    key: 'perWeek'    },
];

const newRow = (defaults = {}) => ({
  id: Date.now() + Math.random(),
  selectedService: '',
  description: '',
  descriptionTemplate: '',   // template with {LOCATION} placeholder
  location: '',              // row-specific location
  visitType: 'Per Visit',
  rate: 1500,
  qty: 1,
  ...defaults,
});

// Amount = rate × qty (visitType is just a label, not a multiplier)
const calcAmount = (row) =>
  (parseFloat(row.rate) || 0) * (parseFloat(row.qty) || 0);

const splitRsPs = (n) => {
  const v = parseFloat(n) || 0;
  return {
    rs: Math.floor(v).toLocaleString('en-IN'),
    ps: String(Math.round((v - Math.floor(v)) * 100)).padStart(2, '0'),
  };
};

export default function BillGenerate() {
  const { billNumber: editingBillNumber } = useParams();
  const navigate = useNavigate();
  const {
    language, currentUser,
    getCustomers, getServices, saveServices,
    getBills, saveBills, generateBillNumber, getBillByNumber,
    getCompanyProfile, notifyEditAfterVerification,
    getUsers, requestVerification,
    getLocations, saveLocations,
  } = useApp();
  const { confirm, notify } = useConfirm();

  const editingBill = useMemo(
    () => editingBillNumber ? getBillByNumber(editingBillNumber) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingBillNumber]
  );
  const isEditing = !!editingBill;
  const isEditingCancelled = isEditing && editingBill?.status === 'cancelled';

  // Hard guard: cancelled invoices are read-only. If the user lands here via a
  // direct URL (e.g. /dashboard/bill-generate/EPS000004 for a cancelled bill),
  // bounce them back to the bill summary.
  useEffect(() => {
    if (isEditingCancelled) {
      navigate('/dashboard/bill-summary', { replace: true });
    }
  }, [isEditingCancelled, navigate]);

  // Form state — initialized from editingBill if present
  const [billType, setBillType]         = useState(editingBill?.type || 'tax');
  const [rows, setRows]                 = useState(() => {
    if (editingBill?.rows?.length) {
      return editingBill.rows.map(r => ({
        id: Date.now() + Math.random(),
        selectedService:     r.selectedService     || '',
        description:         r.description         || '',
        descriptionTemplate: r.descriptionTemplate || '',
        location:            r.location            || '',
        visitType:           r.visitType           || (typeof r.visits === 'string' ? r.visits : 'Per Visit'),
        rate:                r.rate                || 1500,
        qty:                 r.qty                 || 1,
      }));
    }
    return [newRow()];
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState(editingBill?.customerId || '');
  const [customer, setCustomer] = useState({
    name:    editingBill?.customerName    || '',
    phone:   editingBill?.customerPhone   || '',
    email:   editingBill?.customerEmail   || '',
    address: editingBill?.customerAddress || '',
    gstNumber: editingBill?.customerGst   || '',
    sacNumber: editingBill?.customerSac   || '',
  });
  const [billDate, setBillDate]         = useState(editingBill?.date || new Date().toISOString().split('T')[0]);
  const [poNumber, setPoNumber]         = useState(editingBill?.poNumber || '');
  const [poDate, setPoDate]             = useState(editingBill?.poDate || '');
  const [remarks, setRemarks]           = useState(editingBill?.remarks || '');
  const [billNumber]                    = useState(() => editingBill?.billNumber || generateBillNumber());
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [previewBill, setPreviewBill]   = useState(null);
  const [successMsg, setSuccessMsg]     = useState('');
  const [errorMsg, setErrorMsg]         = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [showDeleteService, setShowDeleteService] = useState(false);
  // ─── Customer combobox state ──────────────────────────────────────────
  const [customerComboOpen, setCustomerComboOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerComboRef = useRef(null);
  // Inline confirmation for deleting a service (replaces the native browser confirm)
  const [confirmDeleteService, setConfirmDeleteService] = useState(null); // { id, name }
  const [newService, setNewService]     = useState({ name: '', description: '', rate: 1500 });
  // ─── Bill-level (default) location — cascades to all rows ─────────────
  // Any row that doesn't have an explicit override follows this value.
  // Picking a new value re-renders every row's description so the user sees the cascade instantly.
  const [billLocation, setBillLocation] = useState(() => {
    // If editing, pre-fill from the most common row location
    if (editingBill?.rows?.length) {
      const locs = editingBill.rows.map(r => r.location).filter(Boolean);
      return locs[0] || '';
    }
    return '';
  });
  // Inline add-location UI state (shown next to the Bill-Location dropdown)
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const newLocationInputRef = useRef(null);
  useEffect(() => {
    if (addingLocation) {
      // Focus the inline input as soon as it mounts
      setTimeout(() => newLocationInputRef.current?.focus(), 0);
    }
  }, [addingLocation]);
  // ─── Verification modal state ─────────────────────────────────────────
  const [showVerify, setShowVerify]                 = useState(false);
  const [selectedAssistants, setSelectedAssistants] = useState([]);
  const [verifyMsg, setVerifyMsg]                   = useState('');
  const [verifyReason, setVerifyReason]             = useState('');
  // Holds the bill that was just saved so confirmation can send verification request on it
  const [savedBill, setSavedBill]                   = useState(null);

  const customers = getCustomers();
  const services  = getServices();
  const company   = getCompanyProfile();
  const locationOptions = getLocations();
  const cgstRate  = parseFloat(company.cgst) || 0;
  const sgstRate  = parseFloat(company.sgst) || 0;

  // Substitute {LOCATION} placeholder in a template with the chosen location (or <Location> placeholder if empty)
  const renderDescription = (template, location) => {
    if (!template) return '';
    const loc = location || '<Location>';
    return template.replace(/\{LOCATION\}/gi, loc);
  };

  // ─── Customer helpers ──────────────────────────────────────────────────
  // When user picks a saved customer from dropdown, auto-fill ALL fields (still editable).
  const handleCustomerSelect = (id) => {
    setSelectedCustomerId(id);
    if (!id) return;
    const c = customers.find(x => String(x.id) === String(id));
    if (c) {
      setCustomer({
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        gstNumber: c.gstNumber || '',
        sacNumber: c.sacNumber || '',
      });
      if (c.poNumber) setPoNumber(c.poNumber);
      if (c.poDate)   setPoDate(c.poDate);
    }
  };

  const updateCustomer = (k, v) => setCustomer(prev => ({ ...prev, [k]: v }));

  // Close customer combobox on outside click
  useEffect(() => {
    if (!customerComboOpen) return;
    const onDocClick = (e) => {
      if (customerComboRef.current && !customerComboRef.current.contains(e.target)) {
        setCustomerComboOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [customerComboOpen]);

  // Top 3 most-recent customers shown by default; full filtered list when searching.
  // "Recency" is inferred from createdAt where available, falling back to list order.
  const topCustomers = useMemo(() => {
    const sorted = [...customers].sort((a, b) => {
      const aTs = a.createdAt || '';
      const bTs = b.createdAt || '';
      if (aTs && bTs) return bTs.localeCompare(aTs);
      return 0;
    });
    return sorted.slice(0, 3);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return topCustomers;
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  }, [customerSearch, customers, topCustomers]);

  const selectedCustomerLabel = useMemo(() => {
    if (!selectedCustomerId) return '';
    const c = customers.find(x => String(x.id) === String(selectedCustomerId));
    return c ? `${c.name}${c.email ? ' · ' + c.email : ''}` : '';
  }, [selectedCustomerId, customers]);

  // ─── Row helpers ───────────────────────────────────────────────────────
  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  // Selecting a saved service auto-fills its description template & rate (still editable).
  const handleServiceSelect = (id, serviceName) => {
    if (!serviceName) {
      updateRow(id, 'selectedService', '');
      return;
    }
    const svc = services.find(s => s.name === serviceName);
    const tpl = svc?.descriptionTemplate || svc?.description || serviceName;
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      // If the row has no override, fall back to the bill-level location so the cascade still applies.
      const effectiveLoc = row.location || billLocation;
      return {
        ...row,
        selectedService:     serviceName,
        descriptionTemplate: tpl,
        location:            effectiveLoc,
        description:         renderDescription(tpl, effectiveLoc),
        descriptionEdited:   false, // fresh service → description is template-generated again
        rate:                svc?.rate ?? svc?.defaultRate ?? row.rate ?? 1500,
      };
    }));
  };

  // When user picks/changes a location:
  //   • Untouched description (still template-generated) → re-render from template.
  //   • Manually-edited description → preserve the user's custom text, but
  //     swap the previous location word for the new one so the highlighted
  //     location inside the description stays correct.
  const swapLocationInText = (text, oldLoc, newLoc) => {
    const safe = text || '';
    if (!newLoc) return safe;
    if (oldLoc) {
      const escaped = oldLoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'gi');
      // Only replace if the old location actually appears — otherwise leave the user's text alone.
      if (re.test(safe)) return safe.replace(new RegExp(escaped, 'gi'), newLoc);
    }
    // No previous location — replace the <Location> placeholder if it's still there.
    return safe.replace(/<Location>/gi, newLoc);
  };

  const handleLocationChange = (id, location) => {
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      if (!row.descriptionTemplate) {
        return { ...row, location };
      }
      const lastAutoDescription = renderDescription(row.descriptionTemplate, row.location);
      const isManuallyEdited = row.descriptionEdited === true || row.description !== lastAutoDescription;
      if (isManuallyEdited) {
        return { ...row, location, description: swapLocationInText(row.description, row.location, location) };
      }
      return { ...row, location, description: renderDescription(row.descriptionTemplate, location) };
    }));
  };

  // Bill-level location cascade — applies to every row.
  // Manually-edited rows: only swap the location word inside the existing text.
  // Untouched rows: re-render from template.
  const handleBillLocationChange = (location) => {
    setBillLocation(location);
    if (!location) return;
    setRows(prev => prev.map(row => {
      if (!row.descriptionTemplate) {
        return { ...row, location };
      }
      const lastAutoDescription = renderDescription(row.descriptionTemplate, row.location);
      const isManuallyEdited = row.descriptionEdited === true || row.description !== lastAutoDescription;
      if (isManuallyEdited) {
        return { ...row, location, description: swapLocationInText(row.description, row.location, location) };
      }
      return { ...row, location, description: renderDescription(row.descriptionTemplate, location) };
    }));
  };

  // Add a custom bill-location to the dropdown list (persisted via company profile).
  // IMPORTANT: Adding a new location only appends it to the dropdown — it must NOT
  // auto-select or cascade to any existing rows. The user has to explicitly pick
  // it from the dropdown afterward for it to take effect.
  const commitNewLocation = () => {
    const v = newLocationName.trim();
    if (!v) { setAddingLocation(false); setNewLocationName(''); return; }
    const exists = locationOptions.some(l => l.toLowerCase() === v.toLowerCase());
    if (!exists) {
      saveLocations([...locationOptions, v]);
    }
    // Do NOT call handleBillLocationChange — added location should not
    // automatically reflect anywhere until user explicitly selects it.
    setAddingLocation(false);
    setNewLocationName('');
  };
  const cancelAddLocation = () => { setAddingLocation(false); setNewLocationName(''); };

  // Delete the currently-selected bill-location after confirmation.
  const handleDeleteLocation = async () => {
    if (!billLocation) {
      await notify({ title: 'No location selected', message: 'Pick a location from the dropdown first, then delete it.', variant: 'info' });
      return;
    }
    const ok = await confirm({
      title: 'Delete location?',
      message: `Remove "${billLocation}" from the location list? Existing bills are unaffected.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    const next = locationOptions.filter(l => l.toLowerCase() !== billLocation.toLowerCase());
    saveLocations(next);
    handleBillLocationChange('');
  };

  // Delete a saved service from the catalog
  const handleDeleteService = (serviceId) => {
    saveServices(services.filter(s => s.id !== serviceId));
  };

  const addRow    = () => setRows(prev => [...prev, newRow({ location: billLocation })]);
  const deleteRow = (id) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  // ─── Totals ────────────────────────────────────────────────────────────
  const subtotal   = rows.reduce((s, r) => s + calcAmount(r), 0);
  const cgst       = billType === 'tax' ? subtotal * (cgstRate / 100) : 0;
  const sgst       = billType === 'tax' ? subtotal * (sgstRate / 100) : 0;
  const grandTotal = subtotal + cgst + sgst;

  // ─── Build bill snapshot ───────────────────────────────────────────────
  const buildBill = () => ({
    id: editingBill?.id || Date.now(),
    billNumber,
    type: billType,
    date: billDate,
    poNumber, poDate,
    remarks: remarks || '',
    customerId: selectedCustomerId || null,
    customerName:    customer.name      || '',
    customerPhone:   customer.phone     || '',
    customerEmail:   customer.email     || '',
    customerAddress: customer.address   || '',
    customerGst:     customer.gstNumber || '',
    rows: rows.map((r, idx) => ({
      slNo:                idx + 1,
      selectedService:     r.selectedService     || '',
      description:         r.description         || '',
      descriptionTemplate: r.descriptionTemplate || '',
      location:            r.location            || '',
      visitType:           r.visitType           || 'Per Visit',
      visits:              r.visitType           || 'Per Visit', // legacy compat
      rate:                parseFloat(r.rate) || 0,
      qty:                 parseFloat(r.qty)  || 1,
      amount:              calcAmount(r),
    })),
    subtotal, cgst, sgst, grandTotal,
    // Snapshot of tax rates used at bill generation time — InvoicePreview renders these
    cgstRate, sgstRate,
    total: grandTotal,
    // Status: preserve approval state when editing, else 'pending'
    status: editingBill?.status === 'approved' || editingBill?.status === 'rejected'
      ? editingBill.status : 'pending',
    approvedBy: editingBill?.approvedBy, approvedAt: editingBill?.approvedAt,
    rejectedBy: editingBill?.rejectedBy, rejectedAt: editingBill?.rejectedAt, rejectReason: editingBill?.rejectReason,
    createdBy:     editingBill?.createdBy     || currentUser?.name       || '',
    createdById:   editingBill?.createdById   || currentUser?.id         || '',
    createdByRole: editingBill?.createdByRole || currentUser?.role       || '',
    employeeId:    editingBill?.employeeId    || currentUser?.employeeId || '',
    employeeName:  editingBill?.employeeName  || currentUser?.name       || '',
    createdAt:     editingBill?.createdAt     || new Date().toISOString(),
    updatedAt:     isEditing ? new Date().toISOString() : undefined,
  });

  // ─── Validation ────────────────────────────────────────────────────────
  const validate = () => {
    if (!customer.name.trim()) { setErrorMsg('Please enter or select a customer name.'); return false; }
    if (rows.length === 0)     { setErrorMsg('Please add at least one service row.');    return false; }
    if (grandTotal <= 0)       { setErrorMsg('Grand total must be greater than zero.');  return false; }
    setErrorMsg(''); return true;
  };

  // ─── Save (upsert by billNumber) — called from Request Verification flow ──
  // Persists the bill and returns the saved bill object. Used by handleRequestVerification
  // which then opens the assistant-multi-select modal.
  const persistBill = () => {
    const bill  = buildBill();
    const bills = getBills();
    const idx   = bills.findIndex(b => b.billNumber === bill.billNumber);
    let finalBill;
    if (idx >= 0) {
      const existing = bills[idx];
      // Preserve verification fields across edit
      finalBill = {
        ...existing, ...bill, id: existing.id,
        verificationRequestedTo:   existing.verificationRequestedTo,
        verificationRequestedAt:   existing.verificationRequestedAt,
        verificationRequestedBy:   existing.verificationRequestedBy,
        verificationRequestedById: existing.verificationRequestedById,
      };
      const updated = [...bills];
      updated[idx] = finalBill;
      saveBills(updated);
      // Auto-notify assistants who were asked to verify — real-time sync
      if (finalBill.verificationRequestedTo?.length) {
        notifyEditAfterVerification(finalBill);
      }
    } else {
      finalBill = bill;
      saveBills([...bills, finalBill]);
      // No global notification on save — verification request will fire ONLY to the selected admins.
    }
    return finalBill;
  };

  // Click handler for the "Request Verification" button: validate → persist → open modal.
  const handleRequestVerification = () => {
    if (!validate()) return;
    const finalBill = persistBill();
    setSavedBill(finalBill);
    setSelectedAssistants([]);
    setVerifyReason('');
    setVerifyMsg('');
    setShowVerify(true);
    setSuccessMsg(`✓ ${isEditing ? 'Updated' : 'Saved'} ${finalBill.billNumber} — now pick admins & add a reason`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Toggle an assistant in the multi-select
  const toggleAssistant = (id) =>
    setSelectedAssistants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Confirm: fire the verification request notifications
  const submitVerification = () => {
    if (!selectedAssistants.length) {
      setVerifyMsg('Please select at least one Assistant Admin.');
      return;
    }
    if (!savedBill) { setShowVerify(false); return; }
    requestVerification(savedBill.billNumber, selectedAssistants, verifyReason);
    setVerifyMsg(t(language, 'verificationSent'));
    setTimeout(() => {
      setShowVerify(false);
      setVerifyMsg('');
      setSelectedAssistants([]);
      setVerifyReason('');
      setSavedBill(null);
    }, 1200);
  };

  const handlePreview = () => {
    if (!validate()) return;
    setPreviewBill(buildBill());
    setPreviewOpen(true);
  };

  // ─── New service from inside the modal ─────────────────────────────────
  const handleAddService = () => {
    if (!newService.name.trim()) return;
    const desc = newService.description.trim();
    const svc = {
      id: Date.now().toString(),
      name: newService.name.trim(),
      description: desc,
      descriptionTemplate: desc,  // enable {LOCATION} substitution for custom services
      rate: parseFloat(newService.rate) || 1500,
    };
    saveServices([...services, svc]);
    setNewService({ name: '', description: '', rate: 1500 });
    setShowAddService(false);
  };

  // Keep state synced if user navigates between edit URLs
  useEffect(() => {
    if (editingBill) {
      setSuccessMsg('');
    }
  }, [editingBill]);

  return (
    <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-200/35 blur-3xl" />
      <div className="relative space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isEditing && (
            <button onClick={() => navigate('/dashboard/bill-summary')}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" title="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {isEditing ? `Edit Invoice ${billNumber}` : t(language, 'billGenerate')}
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {isEditing ? 'Update invoice details — Save will overwrite the existing record' : 'Create a new bill for your customer'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
            {billNumber}
          </span>
          <input data-testid="bill-date-input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* Bill Type — Tax only (Cashless removed) */}


      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">

          {/* Customer / Company Details */}
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t(language, 'customerCompanyDetails')}</p>

            {/* Customer combobox — top 3 by default, search to see all */}
            <div className="relative mb-3" ref={customerComboRef}>
              <button
                type="button"
                data-testid="customer-select"
                onClick={() => { setCustomerComboOpen(o => !o); setCustomerSearch(''); }}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <span className={selectedCustomerLabel ? 'text-slate-900 truncate' : 'text-slate-400'}>
                  {selectedCustomerLabel || '— Select a saved customer (or just type below) —'}
                </span>
                <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${customerComboOpen ? 'rotate-180' : ''}`} />
              </button>

              {customerComboOpen && (
                <div
                  data-testid="customer-select-popover"
                  className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 overflow-hidden">
                  {/* Search */}
                  <div className="relative p-2 border-b border-slate-100">
                    <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      autoFocus
                      data-testid="customer-search-input"
                      type="text"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Search by name, email or phone..."
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Hint when not searching */}
                  {!customerSearch.trim() && customers.length > 3 && (
                    <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                      Showing top 3 · type to search all {customers.length}
                    </div>
                  )}

                  {/* List */}
                  <div className="max-h-64 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-slate-400">
                        No matching customers
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          data-testid={`customer-option-${c.id}`}
                          onClick={() => {
                            handleCustomerSelect(c.id);
                            setCustomerComboOpen(false);
                            setCustomerSearch('');
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-b-0 ${
                            String(selectedCustomerId) === String(c.id) ? 'bg-emerald-50' : ''
                          }`}>
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedCustomerId && (
                    <div className="border-t border-slate-100 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleCustomerSelect('');
                          setCustomerComboOpen(false);
                          setCustomerSearch('');
                        }}
                        className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-1.5">
                        Clear selection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* All fields are editable, regardless of whether customer was picked from dropdown or typed manually */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input data-testid="customer-name-input" type="text" placeholder="Customer Name *"
                value={customer.name} onChange={e => updateCustomer('name', e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input data-testid="customer-email-input" type="email" placeholder="Email"
                value={customer.email} onChange={e => updateCustomer('email', e.target.value.toLowerCase())}
                className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input data-testid="customer-phone-input" type="tel" placeholder="Phone (optional)" maxLength={10}
                value={customer.phone} onChange={e => updateCustomer('phone', e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input data-testid="customer-gst-input" type="text" placeholder="Customer GST (optional)"
                value={customer.gstNumber} onChange={e => updateCustomer('gstNumber', e.target.value.toUpperCase())}
                className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
              <input data-testid="customer-sac-input" type="text" placeholder="SAC No. (optional)" maxLength={8}
                value={customer.sacNumber} onChange={e => updateCustomer('sacNumber', e.target.value.replace(/\D/g, ''))}
                className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
              <input data-testid="customer-address-input" type="text" placeholder="Address"
                value={customer.address} onChange={e => updateCustomer('address', e.target.value)}
                className="sm:col-span-2 border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            {/* P.O. Number / P.O. Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">P.O. Number</label>
                <input data-testid="po-number-input" type="text" placeholder="P.O. number (optional)"
                  value={poNumber} onChange={e => setPoNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">P.O. Date</label>
                <input data-testid="po-date-input" type="date" value={poDate} onChange={e => setPoDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            {/* Remarks Field */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Remarks (Optional)</label>
              <textarea data-testid="remarks-input" placeholder="Add any additional notes or remarks..."
                value={remarks} onChange={e => setRemarks(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Services Table */}
          <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Services</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bill-level Location — cascades to ALL rows; row-level override still allowed */}
                <div className="inline-flex items-stretch rounded-lg overflow-hidden shadow-sm">
                  <select data-testid="bill-location-select"
                    value={billLocation}
                    onChange={e => handleBillLocationChange(e.target.value)}
                    title={t(language, 'billLocation')}
                    className={`text-xs px-3 py-1.5 border-y border-l rounded-l-lg focus:outline-none focus:ring-1 ${
                      billLocation
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold focus:ring-emerald-500'
                        : 'border-red-400 bg-red-50 text-red-700 font-semibold focus:ring-red-500 animate-pulse'
                    }`}>
                    <option value="">{t(language, 'billLocation')}</option>
                    {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {addingLocation ? (
                    <>
                      <input
                        ref={newLocationInputRef}
                        data-testid="new-location-input"
                        value={newLocationName}
                        onChange={e => setNewLocationName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitNewLocation(); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelAddLocation(); }
                        }}
                        placeholder="New location"
                        className="text-xs px-2 py-1.5 border-y border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32"
                      />
                      <button
                        data-testid="confirm-add-location-btn"
                        onClick={commitNewLocation}
                        title="Save location"
                        className="px-2 py-1.5 border-y border-l border-emerald-300 bg-green-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center">
                        <Check size={14} />
                      </button>
                      <button
                        data-testid="cancel-add-location-btn"
                        onClick={cancelAddLocation}
                        title="Cancel"
                        className="px-2 py-1.5 border-y border-l border-r border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center rounded-r-lg">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        data-testid="add-location-btn"
                        onClick={() => setAddingLocation(true)}
                        title="Add a new bill location"
                        className="px-2 py-1.5 border-y border-l border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center justify-center">
                        <Plus size={14} />
                      </button>
                      <button
                        data-testid="delete-location-btn"
                        onClick={handleDeleteLocation}
                        disabled={!billLocation}
                        title={billLocation ? `Delete "${billLocation}"` : 'Select a location to delete'}
                        className={`px-2 py-1.5 border-y border-l border-r rounded-r-lg flex items-center justify-center transition-colors ${
                          billLocation
                            ? 'border-red-300 bg-white text-red-600 hover:bg-red-50'
                            : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                        }`}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                <button data-testid="add-new-service-btn" onClick={() => setShowAddService(true)}
                  className="text-xs px-3 py-1.5 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors font-medium">
                  + New Service
                </button>
                <button data-testid="delete-service-btn" onClick={() => setShowDeleteService(true)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
                  <Trash2 size={12} className="inline -mt-0.5 mr-1" /> {t(language, 'deleteService')}
                </button>
                <button data-testid="add-row-button" onClick={addRow}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors font-medium">
                  <Plus size={14} /> Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full bill-table text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-2 py-3 text-center w-10">SL</th>
                    <th className="px-2 py-3 text-left min-w-[150px]">Service</th>
                    <th className="px-2 py-3 text-left w-32">{t(language, 'locationType')}</th>
                    <th className="px-2 py-3 text-left min-w-[200px]">Description</th>
                    <th className="px-2 py-3 text-center w-32">{t(language, 'typeOfVisit')}</th>
                    <th className="px-2 py-3 text-center w-24">Rate</th>
                    <th className="px-2 py-3 text-center w-20">{t(language, 'qtyServices')}</th>
                    <th className="px-2 py-3 text-right w-20">Rs</th>
                    <th className="px-2 py-3 text-center w-12">Ps</th>
                    <th className="px-1 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const amt = splitRsPs(calcAmount(row));
                    return (
                      <tr key={row.id} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                        <td className="px-2 py-2">
                          <select data-testid={`service-select-${idx}`} value={row.selectedService}
                            onChange={e => handleServiceSelect(row.id, e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                            <option value="">— Pick saved service —</option>
                            {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select data-testid={`location-select-${idx}`} value={row.location}
                            onChange={e => handleLocationChange(row.id, e.target.value)}
                            className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 ${
                              row.descriptionTemplate && !row.location
                                ? 'border-red-400 bg-red-50 text-red-700 font-semibold animate-pulse'
                                : 'border-slate-200 bg-white text-slate-900'
                            }`}>
                            <option value="">{t(language, 'selectLocation')}</option>
                            {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <textarea data-testid={`description-input-${idx}`} value={row.description} rows={3}
                            onChange={e => setRows(prev => prev.map(r =>
                              r.id === row.id
                                ? { ...r, description: e.target.value, descriptionEdited: true }
                                : r
                            ))}
                            placeholder="Service description (auto-filled, editable)"
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y leading-relaxed" />
                        </td>
                        <td className="px-2 py-2">
                          <select data-testid={`visit-type-${idx}`} value={row.visitType}
                            onChange={e => updateRow(row.id, 'visitType', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                            {VISIT_TYPES.map(v => (
                              <option key={v.value} value={v.value}>{t(language, v.key)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input data-testid={`rate-input-${idx}`} type="number" min="0" value={row.rate}
                            onChange={e => updateRow(row.id, 'rate', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                        </td>
                        <td className="px-2 py-2">
                          <input data-testid={`qty-input-${idx}`} type="number" min="1" value={row.qty}
                            onChange={e => updateRow(row.id, 'qty', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                        </td>
                        <td className="px-2 py-3 text-right font-bold text-emerald-700">₹{amt.rs}</td>
                        <td className="px-2 py-3 text-center font-mono text-emerald-700">{amt.ps}</td>
                        <td className="px-1 py-3">
                          <button data-testid={`delete-row-${idx}`} onClick={() => deleteRow(row.id)}
                            disabled={rows.length === 1}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-4">
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl sticky top-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Tax Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">{t(language, 'subtotal')}</span>
                <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {billType === 'tax' && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">{t(language, 'cgst')} ({cgstRate}%)</span>
                    <span className="font-semibold text-orange-600">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">{t(language, 'sgst')} ({sgstRate}%)</span>
                    <span className="font-semibold text-orange-600">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-3">
                <span className="font-bold text-slate-900 text-sm">{t(language, 'grandTotal')}</span>
                <span className="text-2xl font-bold text-emerald-700">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {errorMsg && (
              <div data-testid="bill-error-msg" className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">{errorMsg}</div>
            )}

            <div className="mt-5 space-y-3">
              <button data-testid="preview-bill-button" onClick={handlePreview}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-green-700 text-emerald-700 rounded-xl font-semibold text-sm hover:bg-emerald-50 transition-colors">
                <Eye size={16} /> {t(language, 'preview')}
              </button>
              <button data-testid="request-verification-button" onClick={handleRequestVerification}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white`}>
                <ShieldCheck size={16} /> {isEditing ? `Update & ${t(language, 'requestVerification')}` : t(language, 'requestVerification')}
              </button>
            </div>

            {successMsg && (
              <div data-testid="save-success-msg" className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium text-center">
                {successMsg}
              </div>
            )}

            <p className="mt-3 text-center text-xs text-slate-400">
              {rows.length} service row{rows.length !== 1 ? 's' : ''} · {cgstRate + sgstRate}% GST
            </p>
          </div>
        </div>
      </div>

      {/* Add new service modal */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>Add New Service</h3>
              <button onClick={() => setShowAddService(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input data-testid="new-service-name" type="text" placeholder="Service name"
                value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              <textarea placeholder="Description — use {LOCATION} as a placeholder that will be replaced by the chosen location in each bill row" rows={3}
                value={newService.description} onChange={e => setNewService(p => ({ ...p, description: e.target.value }))}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="number" placeholder="Default rate (₹)" min="0"
                value={newService.rate} onChange={e => setNewService(p => ({ ...p, rate: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddService(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                <button data-testid="save-service-btn" onClick={handleAddService}
                  className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 transition-colors">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete service modal */}
      {showDeleteService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <Trash2 size={16} className="text-red-500" /> {t(language, 'deleteService')}
              </h3>
              <button onClick={() => setShowDeleteService(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {services.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No saved services to delete.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {services.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 truncate">₹{s.rate} · {s.descriptionTemplate?.slice(0, 50) || s.description?.slice(0, 50) || ''}...</p>
                    </div>
                    <button data-testid={`delete-service-${s.id}`}
                      onClick={() => setConfirmDeleteService({ id: s.id, name: s.name })}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowDeleteService(false)}
              className="w-full mt-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">
              {t(language, 'close')}
            </button>
          </div>
        </div>
      )}

      {/* Confirm-delete-service inline modal (replaces native browser confirm) */}
      {confirmDeleteService && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-sm rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>Delete service?</h3>
                <p className="text-slate-600 text-sm mt-1">
                  &quot;<span className="font-semibold">{confirmDeleteService.name}</span>&quot; will be permanently removed from your services list. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button data-testid="cancel-delete-service-btn"
                onClick={() => setConfirmDeleteService(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">
                {t(language, 'cancel')}
              </button>
              <button data-testid="confirm-delete-service-btn"
                onClick={() => {
                  handleDeleteService(confirmDeleteService.id);
                  setConfirmDeleteService(null);
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Verification — admin multi-select modal (all admins except self) */}
      {showVerify && (() => {
        const selectable = getUsers().filter(u => String(u.id) !== String(currentUser?.id));
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <ShieldCheck size={20} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-900">{t(language, 'selectAssistants')}</h3>
                  <p className="text-slate-500 text-xs">{savedBill?.billNumber}</p>
                </div>
                <button onClick={() => { setShowVerify(false); setSelectedAssistants([]); setVerifyMsg(''); }}
                  className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {selectable.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  No other admins exist yet. Create one in <b>Admin Management</b> first — the bill itself has been saved.
                </div>
              ) : (
                <div data-testid="assistant-list" className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {selectable.map(a => {
                    const active = selectedAssistants.includes(a.id);
                    const roleLabel = a.role === 'superior' ? 'Superior' : 'Assistant';
                    return (
                      <button key={a.id} type="button"
                        data-testid={`assistant-option-${a.id}`}
                        onClick={() => toggleAssistant(a.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                        }`}>
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                          active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {active && <Check size={14} />}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{a.name}</p>
                          <p className="text-xs text-slate-500">{a.email} · {roleLabel} · {a.employeeId}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Reason / note from the requester — surfaced to recipients in the notification message and on the Verification Requests page */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Reason / Note <span className="text-slate-400 normal-case">(optional)</span>
                </label>
                <textarea data-testid="verify-reason-input" rows={2}
                  value={verifyReason}
                  onChange={e => setVerifyReason(e.target.value)}
                  placeholder="e.g. Please double-check the GST calculation, customer is in a hurry…"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              {verifyMsg && (
                <div data-testid="verify-msg" className={`mt-3 p-2.5 rounded-xl text-sm font-medium ${
                  verifyMsg === t(language, 'verificationSent')
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}>{verifyMsg}</div>
              )}

              <div className="flex gap-3 mt-5">
                <button onClick={() => {
                    // "Skip" — keep the bill saved but don't send verification
                    setShowVerify(false);
                    setSelectedAssistants([]);
                    setVerifyReason('');
                    setVerifyMsg('');
                    setSavedBill(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium">
                  Skip
                </button>
                <button data-testid="confirm-verification-button" onClick={submitVerification}
                  disabled={!selectable.length || !selectedAssistants.length}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {t(language, 'confirmRequest')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invoice preview modal */}
      {previewOpen && previewBill && (
        <InvoicePreview bill={previewBill} onClose={() => setPreviewOpen(false)}
          onEdit={() => setPreviewOpen(false)} language={language} />
      )}
      </div>
    </div>
  );
}
