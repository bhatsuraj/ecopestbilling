import React, { useState, useRef } from 'react';
import { useApp, DEFAULT_COMPANY } from '../../context/AppContext';
import { Save, Upload, Building2, CreditCard, Percent, PenLine, Stamp } from 'lucide-react';

// Hoisted out of the parent so the input never re-mounts on each render — prevents focus loss.
const Field = ({ label, field, type = 'text', placeholder = '', value, onChange, suffix }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
    <div className="relative">
      <input
        data-testid={`company-${field}`}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full border border-slate-300 rounded-xl px-3 ${suffix ? 'pr-9' : 'pr-3'} py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">{suffix}</span>
      )}
    </div>
  </div>
);

export default function CompanyProfile() {
  const { getCompanyProfile, saveCompanyProfile } = useApp();
  const [profile, setProfile] = useState(() => getCompanyProfile());
  const [success, setSuccess] = useState('');
  const [logoPreview, setLogoPreview] = useState(profile.logoUrl || '');
  const [signPreview, setSignPreview] = useState(profile.signUrl || '');
  const [sealPreview, setSealPreview] = useState(profile.sealUrl || '');
  const fileRef = useRef(null);
  const signFileRef = useRef(null);
  const sealFileRef = useRef(null);

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
      set('logoUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (field, setPreview) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      set(field, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    // Coerce CGST/SGST to numbers (clamp 0–50)
    const cleanProfile = {
      ...profile,
      cgst: Math.max(0, Math.min(50, parseFloat(profile.cgst) || 0)),
      sgst: Math.max(0, Math.min(50, parseFloat(profile.sgst) || 0)),
    };
    saveCompanyProfile(cleanProfile);
    setProfile(cleanProfile);
    setSuccess('Company profile saved successfully \u2014 invoices will now use these tax rates.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleReset = () => {
    setProfile(DEFAULT_COMPANY);
    setLogoPreview(DEFAULT_COMPANY.logoUrl);
  };

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Company Profile
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">These details (and tax rates) appear on all invoices automatically</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="px-4 py-2 text-sm border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
            Reset Defaults
          </button>
          <button data-testid="save-company-profile" onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
            <Save size={16} /> Save Profile
          </button>
        </div>
      </div>

      {success && (
        <div data-testid="profile-success" className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-green-700" />
            <h3 className="font-bold text-slate-900 text-sm">Company Logo</h3>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                : <span className="text-xs text-slate-400 text-center px-2">No logo</span>
              }
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              <Upload size={14} /> Upload Logo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Logo URL</label>
              <input type="text" value={profile.logoUrl || ''}
                onChange={e => { set('logoUrl', e.target.value); setLogoPreview(e.target.value); }}
                placeholder="https://..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-green-700" />
            <h3 className="font-bold text-slate-900 text-sm">Company Information</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Company Name" field="name" placeholder="ECO PEST SOLUTIONS"
                value={profile.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
              <textarea value={profile.address || ''} onChange={e => set('address', e.target.value)}
                rows={3} placeholder="Full Address"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <Field label="GST Number"     field="gstNumber" placeholder="29XXXXX1234D1Z5" value={profile.gstNumber} onChange={e => set('gstNumber', e.target.value.toUpperCase())} />
            <Field label="SAC Code"       field="sacCode"   placeholder="998531"          value={profile.sacCode}   onChange={e => set('sacCode', e.target.value)} />
            <Field label="Primary Phone"  field="phone1"    placeholder="9876543210"      value={profile.phone1}    onChange={e => set('phone1', e.target.value)} />
            <Field label="Phone 2"        field="phone2"    placeholder="9876543210"      value={profile.phone2}    onChange={e => set('phone2', e.target.value)} />
            <Field label="Phone 3"        field="phone3"    placeholder=""                value={profile.phone3}    onChange={e => set('phone3', e.target.value)} />
            <Field label="Email"          field="email"     type="email" placeholder="email@company.com" value={profile.email} onChange={e => set('email', e.target.value.toLowerCase())} />
            <div className="sm:col-span-2">
              <Field label="Website" field="website" placeholder="www.yourcompany.com"
                value={profile.website} onChange={e => set('website', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Tax Rates — NEW */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Percent size={16} className="text-green-700" />
            <h3 className="font-bold text-slate-900 text-sm">Tax Rates (applied to Tax Bills)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="CGST" field="cgst" type="number" placeholder="9" suffix="%"
              value={profile.cgst} onChange={e => set('cgst', e.target.value)} />
            <Field label="SGST" field="sgst" type="number" placeholder="9" suffix="%"
              value={profile.sgst} onChange={e => set('sgst', e.target.value)} />
            <div className="flex items-end">
              <div className="w-full bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm">
                <span className="text-slate-600 mr-2">Total Tax:</span>
                <span className="font-bold text-green-700">{(parseFloat(profile.cgst) || 0) + (parseFloat(profile.sgst) || 0)}%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            ℹ These rates are used automatically when generating Tax Invoices. Change here → click <b>Save Profile</b> → next bill will reflect new rates.
          </p>
        </div>

        {/* Signature & Seal */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PenLine size={16} className="text-green-700" />
            <h3 className="font-bold text-slate-900 text-sm">Authorised Signature & Company Seal</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Upload a transparent PNG/JPG for each. On every invoice the <b>signature is rendered on top</b> and the <b>seal directly below it</b>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Signature */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 self-start">
                <PenLine size={14} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Signature (top)</span>
              </div>
              <div className="w-full h-28 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50">
                {signPreview
                  ? <img src={signPreview} alt="Signature" data-testid="sign-preview" className="max-w-full max-h-full object-contain" />
                  : <span className="text-xs text-slate-400">No signature uploaded</span>
                }
              </div>
              <div className="flex items-center gap-2 self-stretch">
                <button
                  data-testid="upload-sign-button"
                  onClick={() => signFileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <Upload size={14} /> Upload
                </button>
                {signPreview && (
                  <button
                    data-testid="remove-sign-button"
                    onClick={() => { setSignPreview(''); set('signUrl', ''); }}
                    className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50 transition-colors">
                    Remove
                  </button>
                )}
                <input ref={signFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload('signUrl', setSignPreview)} />
              </div>
            </div>

            {/* Seal */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 self-start">
                <Stamp size={14} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Seal (bottom)</span>
              </div>
              <div className="w-full h-28 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50">
                {sealPreview
                  ? <img src={sealPreview} alt="Seal" data-testid="seal-preview" className="max-w-full max-h-full object-contain" />
                  : <span className="text-xs text-slate-400">No seal uploaded</span>
                }
              </div>
              <div className="flex items-center gap-2 self-stretch">
                <button
                  data-testid="upload-seal-button"
                  onClick={() => sealFileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <Upload size={14} /> Upload
                </button>
                {sealPreview && (
                  <button
                    data-testid="remove-seal-button"
                    onClick={() => { setSealPreview(''); set('sealUrl', ''); }}
                    className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50 transition-colors">
                    Remove
                  </button>
                )}
                <input ref={sealFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload('sealUrl', setSealPreview)} />
              </div>
            </div>
          </div>

          {/* Live invoice-style preview */}
          {(signPreview || sealPreview) && (
            <div className="mt-6 flex flex-col items-center gap-1 p-4 border border-slate-200 rounded-xl bg-slate-50/60">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Invoice footer preview</p>
              <div className="text-xs font-bold text-slate-700">For {profile.name || 'Eco Pest Solutions'}</div>
              {signPreview && (
                <img src={signPreview} alt="Sign" className="h-12 object-contain mt-1" />
              )}
              {sealPreview && (
                <img src={sealPreview} alt="Seal" className="h-16 object-contain -mt-1" />
              )}
              <div className="border-t border-slate-400 pt-1 mt-1 px-6 text-[11px] font-bold text-slate-700">Authorised Signature</div>
            </div>
          )}
        </div>

        {/* Bank Details */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-green-700" />
            <h3 className="font-bold text-slate-900 text-sm">Bank Details (shown on invoice)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Field label="Account Holder"  field="bankHolder"  placeholder="Company Name"   value={profile.bankHolder}  onChange={e => set('bankHolder', e.target.value)} />
            <Field label="Bank Name"       field="bankName"    placeholder="State Bank"     value={profile.bankName}    onChange={e => set('bankName', e.target.value)} />
            <Field label="Account Number"  field="bankAccount" placeholder="XXXXXXXXXXXX"   value={profile.bankAccount} onChange={e => set('bankAccount', e.target.value)} />
            <Field label="IFSC Code"       field="ifscCode"    placeholder="SBIN0001234"    value={profile.ifscCode}    onChange={e => set('ifscCode', e.target.value.toUpperCase())} />
            <Field label="MICR Code"       field="micrCode"    placeholder="560002014"      value={profile.micrCode}    onChange={e => set('micrCode', e.target.value)} />
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Invoice Header Preview</h3>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-start gap-4">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="w-16 h-16 object-contain rounded" />
              )}
              <div className="text-sm">
                <p className="font-bold text-slate-900 text-base">{profile.name}</p>
                <p className="text-slate-600 text-xs mt-1 whitespace-pre-line">{profile.address}</p>
                <p className="text-slate-600 text-xs mt-1">
                  Mobile: {[profile.phone1, profile.phone2, profile.phone3].filter(Boolean).join(' / ')}
                </p>
                <p className="text-slate-600 text-xs">E Mail: {profile.email} | {profile.website}</p>
                <p className="text-slate-500 text-xs mt-1">GST: {profile.gstNumber} | SAC: {profile.sacCode}</p>
                <p className="text-slate-500 text-xs mt-1">CGST: {profile.cgst}% | SGST: {profile.sgst}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
