import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { Plus, Pencil, Trash2, X, Search, User, Phone, MapPin, Mail, FileText, Calendar, Hash } from 'lucide-react';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY } from '../../lib/date';

const emptyForm = {
  name: '', email: '', phone: '', address: '',
  gstNumber: '', sacNumber: '', poNumber: '', poDate: '',
};

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// IMPORTANT: hoisted OUTSIDE the parent component to keep the same component
// reference across renders — otherwise the input loses focus after every keystroke.
const Field = ({ icon: Icon, label, name, type = 'text', required = false, placeholder = '',
                maxLength, value, onChange }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
      {label}{required && ' *'}{!required && <span className="text-slate-400 normal-case ml-1">(optional)</span>}
    </label>
    <div className="relative">
      {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
      <input
        data-testid={`customer-${name}-input`}
        type={type}
        maxLength={maxLength}
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500`}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  </div>
);

export default function Customers() {
  const { language, getCustomers, saveCustomers } = useApp();
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const customers = getCustomers();
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const setField = (name, value) => setForm(prev => ({
    ...prev,
    [name]:
      name === 'gstNumber' ? String(value).toUpperCase() :
      name === 'sacNumber' ? String(value).replace(/\D/g, '') : // SAC code is digits-only
      name === 'email'     ? String(value).toLowerCase() :
      value,
  }));

  const openAdd = () => { setForm(emptyForm); setEditId(null); setError(''); setShowModal(true); };
  const openEdit = (c) => {
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '',
      gstNumber: c.gstNumber || '', sacNumber: c.sacNumber || '',
      poNumber: c.poNumber || '', poDate: c.poDate || '',
    });
    setEditId(c.id); setError(''); setShowModal(true);
  };

  const handleSave = () => {
    setError('');
    if (!form.name.trim()) { setError('Customer name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!isValidEmail(form.email.trim())) { setError('Please enter a valid email like name@domain.com'); return; }
    if (!form.address.trim()) { setError('Address is required.'); return; }
    if (form.phone && !/^\d{10}$/.test(form.phone.trim())) {
      setError('Phone must be a 10-digit number, or leave blank.'); return;
    }

    const list = getCustomers();
    // Last 10 digits of normalised phone — handles "+91..." vs raw 10-digit consistently.
    const phoneTail = (form.phone || '').replace(/\D/g, '').slice(-10);
    if (editId) {
      // Duplicate phone check on edit — must not collide with any OTHER customer.
      if (phoneTail) {
        const dupPhone = list.find(c => c.id !== editId &&
          (String(c.phone || '').replace(/\D/g, '').slice(-10) === phoneTail));
        if (dupPhone) { setError(`Phone ${form.phone} is already used by "${dupPhone.name}".`); return; }
      }
      saveCustomers(list.map(c => c.id === editId ? { ...c, ...form } : c));
    } else {
      const dup = list.find(c => (c.email || '').toLowerCase() === form.email.trim().toLowerCase());
      if (dup) { setError('A customer with this email already exists.'); return; }
      if (phoneTail) {
        const dupPhone = list.find(c =>
          String(c.phone || '').replace(/\D/g, '').slice(-10) === phoneTail);
        if (dupPhone) { setError(`Phone ${form.phone} is already used by "${dupPhone.name}".`); return; }
      }
      saveCustomers([...list, { ...form, id: Date.now(), createdAt: new Date().toISOString() }]);
    }
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    const target = getCustomers().find(c => c.id === id);
    const ok = await confirm({
      title: `Delete ${target?.name || 'this customer'}?`,
      message: 'They will be permanently removed from your customer list. This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (ok) {
      saveCustomers(getCustomers().filter(c => c.id !== id));
    }
  };

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {t(language, 'customers')}
          </h2>
          <p className="text-slate-500 text-sm">{filtered.length} {(t(language, 'activeCustomers') || '').toLowerCase()}</p>
        </div>
        <button data-testid="add-customer-button" onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
          <Plus size={16} />
          {t(language, 'addCustomer')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input data-testid="customer-search-input" type="text"
          placeholder={t(language, 'search')}
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t(language, 'noData')}</p>
          <p className="text-sm mt-1">Add your first customer to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'customerName')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'email')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t(language, 'phone')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">GST</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">SAC No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">P.O.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{t(language, 'actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c, i) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-green-700 text-xs font-bold">{(c.name || '?').charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                          <p className="text-xs text-slate-400 md:hidden">{c.phone || '\u2014'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{c.phone || '\u2014'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell font-mono">{c.gstNumber || '\u2014'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell">
                      {c.poNumber ? <>
                        <span className="font-mono">{c.poNumber}</span>
                        {c.poDate && <span className="text-slate-400 ml-1">· {formatDateDDMMYY(c.poDate)}</span>}
                      </> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button data-testid={`edit-customer-${c.id}`} onClick={() => openEdit(c)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button data-testid={`delete-customer-${c.id}`} onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl fade-in my-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {editId ? t(language, 'edit') + ' Customer' : t(language, 'addCustomer')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <Field icon={User}     label="Customer Name" name="name"     required placeholder="Full Name"
                value={form.name}     onChange={e => setField('name', e.target.value)} />
              <Field icon={Mail}     label="Email"         name="email"    type="email" required placeholder="email@example.com"
                value={form.email}    onChange={e => setField('email', e.target.value)} />
              <Field icon={Phone}    label="Phone Number"  name="phone"    type="tel" maxLength={10} placeholder="9876543210"
                value={form.phone}    onChange={e => setField('phone', e.target.value)} />

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Address *</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
                  <textarea data-testid="customer-address-input" rows={2}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Full Address" value={form.address} onChange={e => setField('address', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="GST Number" name="gstNumber" placeholder="29ABCDE1234F1Z5"
                  value={form.gstNumber} onChange={e => setField('gstNumber', e.target.value)} />
                <Field icon={Hash} label="SAC No." name="sacNumber" placeholder="998531" maxLength={8}
                  value={form.sacNumber} onChange={e => setField('sacNumber', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field icon={FileText} label="P.O. Number" name="poNumber" placeholder="PO-12345"
                  value={form.poNumber} onChange={e => setField('poNumber', e.target.value)} />
                <Field icon={Calendar} label="P.O. Date"   name="poDate"   type="date"
                  value={form.poDate}   onChange={e => setField('poDate', e.target.value)} />
              </div>

              {error && <p data-testid="customer-error" className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">
                  {t(language, 'cancel')}
                </button>
                <button data-testid="save-customer-button" onClick={handleSave}
                  className="flex-1 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
                  {editId ? t(language, 'update') : t(language, 'save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
