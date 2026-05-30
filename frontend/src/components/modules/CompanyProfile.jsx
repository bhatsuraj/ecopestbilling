import React, { useState, useRef } from 'react';
import { useApp, DEFAULT_COMPANY } from '../../context/AppContext';
import {
  Save,
  Upload,
  Building2,
  CreditCard,
  Percent,
  PenLine,
  Stamp,
  Sparkles,
  Activity,
  BadgeCheck,
  Phone,
  Mail,
  Globe,
  MapPin,
} from 'lucide-react';

// Hoisted out of the parent so the input never re-mounts on each render — prevents focus loss.
const Field = ({
  label,
  field,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  suffix,
}) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </label>
    <div className="relative">
      <input
        data-testid={`company-${field}`}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 ${
          suffix ? 'pr-9' : 'pr-4'
        }`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, tone = 'emerald' }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p
            className="mt-2 text-2xl font-bold text-slate-900"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
};

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

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

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
    const cleanProfile = {
      ...profile,
      cgst: Math.max(0, Math.min(50, parseFloat(profile.cgst) || 0)),
      sgst: Math.max(0, Math.min(50, parseFloat(profile.sgst) || 0)),
    };
    saveCompanyProfile(cleanProfile);
    setProfile(cleanProfile);
    setSuccess('Company profile saved successfully — invoices will now use these tax rates.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleReset = () => {
    setProfile(DEFAULT_COMPANY);
    setLogoPreview(DEFAULT_COMPANY.logoUrl);
    setSignPreview(DEFAULT_COMPANY.signUrl || '');
    setSealPreview(DEFAULT_COMPANY.sealUrl || '');
  };

  const phoneSummary = [profile.phone1, profile.phone2, profile.phone3].filter(Boolean).join(' / ');

  return (
    <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-200/35 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_28%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                <Activity size={12} />
                COMPANY PROFILE
              </div>
              <h2
                className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Company Profile
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                These details and tax rates appear on all invoices automatically.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
              {/* <StatCard label="Company" value={profile.name || '—'} icon={Building2} tone="emerald" /> */}
              <StatCard label="Tax" value={`${(parseFloat(profile.cgst) || 0) + (parseFloat(profile.sgst) || 0)}%`} icon={Percent} tone="blue" />
              <StatCard label="Contacts" value={phoneSummary ? 'Ready' : 'Add details'} icon={Phone} tone="violet" />
            </div>
          </div>

          <div className="relative mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Reset Defaults
            </button>
            <button
              data-testid="save-company-profile"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition-transform hover:-translate-y-0.5"
            >
              <Save size={16} /> Save Profile
            </button>
          </div>
        </div>

        {success && (
          <div
            data-testid="profile-success"
            className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700"
          >
            {success}
          </div>
        )}

        {/* Logo + Company Info */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Company Logo</h3>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-xs text-slate-400">No logo</span>
                )}
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50"
              >
                <Upload size={14} /> Upload Logo
              </button>

              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

              <div className="w-full">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={profile.logoUrl || ''}
                  onChange={(e) => {
                    set('logoUrl', e.target.value);
                    setLogoPreview(e.target.value);
                  }}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-xs text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Company Information</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Company Name"
                  field="name"
                  placeholder="ECO PEST SOLUTIONS"
                  value={profile.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Address
                </label>
                <textarea
                  value={profile.address || ''}
                  onChange={(e) => set('address', e.target.value)}
                  rows={3}
                  placeholder="Full Address"
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <Field
                label="GST Number"
                field="gstNumber"
                placeholder="29XXXXX1234D1Z5"
                value={profile.gstNumber}
                onChange={(e) => set('gstNumber', e.target.value.toUpperCase())}
              />
              <Field
                label="SAC Code"
                field="sacCode"
                placeholder="998531"
                value={profile.sacCode}
                onChange={(e) => set('sacCode', e.target.value)}
              />
              <Field
                label="Primary Phone"
                field="phone1"
                placeholder="9876543210"
                value={profile.phone1}
                onChange={(e) => set('phone1', e.target.value)}
              />
              <Field
                label="Phone 2"
                field="phone2"
                placeholder="9876543210"
                value={profile.phone2}
                onChange={(e) => set('phone2', e.target.value)}
              />
              <Field
                label="Phone 3"
                field="phone3"
                placeholder=""
                value={profile.phone3}
                onChange={(e) => set('phone3', e.target.value)}
              />
              <Field
                label="Email"
                field="email"
                type="email"
                placeholder="email@company.com"
                value={profile.email}
                onChange={(e) => set('email', e.target.value.toLowerCase())}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Website"
                  field="website"
                  placeholder="www.yourcompany.com"
                  value={profile.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tax Rates */}
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <Percent size={16} className="text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Tax Rates (applied to Tax Bills)</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="CGST"
                field="cgst"
                type="number"
                placeholder="9"
                suffix="%"
                value={profile.cgst}
                onChange={(e) => set('cgst', e.target.value)}
              />
              <Field
                label="SGST"
                field="sgst"
                type="number"
                placeholder="9"
                suffix="%"
                value={profile.sgst}
                onChange={(e) => set('sgst', e.target.value)}
              />
              <div className="flex items-end">
                <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <span className="mr-2 text-slate-600">Total Tax:</span>
                  <span className="font-bold text-emerald-700">
                    {(parseFloat(profile.cgst) || 0) + (parseFloat(profile.sgst) || 0)}%
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              ℹ These rates are used automatically when generating Tax Invoices. Change here → click{' '}
              <b>Save Profile</b> → next bill will reflect new rates.
            </p>
          </div>

          {/* Signature & Seal */}
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <PenLine size={16} className="text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">
                Authorised Signature & Company Seal
              </h3>
            </div>

            <p className="mb-4 text-xs text-slate-500">
              Upload a transparent PNG/JPG for each. On every invoice the <b>signature is rendered on top</b> and the <b>seal directly below it</b>.
            </p>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Signature */}
              <div className="flex flex-col items-center gap-3">
                <div className="self-start">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Signature (top)
                  </span>
                </div>

                <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                  {signPreview ? (
                    <img
                      src={signPreview}
                      alt="Signature"
                      data-testid="sign-preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No signature uploaded</span>
                  )}
                </div>

                <div className="flex w-full items-center gap-2">
                  <button
                    data-testid="upload-sign-button"
                    onClick={() => signFileRef.current?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50"
                  >
                    <Upload size={14} /> Upload
                  </button>

                  {signPreview && (
                    <button
                      data-testid="remove-sign-button"
                      onClick={() => {
                        setSignPreview('');
                        set('signUrl', '');
                      }}
                      className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  )}

                  <input
                    ref={signFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload('signUrl', setSignPreview)}
                  />
                </div>
              </div>

              {/* Seal */}
              <div className="flex flex-col items-center gap-3">
                <div className="self-start">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Seal (bottom)
                  </span>
                </div>

                <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                  {sealPreview ? (
                    <img
                      src={sealPreview}
                      alt="Seal"
                      data-testid="seal-preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No seal uploaded</span>
                  )}
                </div>

                <div className="flex w-full items-center gap-2">
                  <button
                    data-testid="upload-seal-button"
                    onClick={() => sealFileRef.current?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50"
                  >
                    <Upload size={14} /> Upload
                  </button>

                  {sealPreview && (
                    <button
                      data-testid="remove-seal-button"
                      onClick={() => {
                        setSealPreview('');
                        set('sealUrl', '');
                      }}
                      className="rounded-2xl border border-rose-200 px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  )}

                  <input
                    ref={sealFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload('sealUrl', setSealPreview)}
                  />
                </div>
              </div>
            </div>

            {(signPreview || sealPreview) && (
              <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 text-center">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">
                  Invoice footer preview
                </p>
                <div className="text-xs font-bold text-slate-700">
                  For {profile.name || 'Eco Pest Solutions'}
                </div>
                {signPreview && <img src={signPreview} alt="Sign" className="mx-auto mt-2 h-12 object-contain" />}
                {sealPreview && (
                  <img src={sealPreview} alt="Seal" className="mx-auto -mt-1 h-16 object-contain" />
                )}
                <div className="mt-1 border-t border-slate-400 px-6 pt-1 text-[11px] font-bold text-slate-700">
                  Authorised Signature
                </div>
              </div>
            )}
          </div>

          {/* Bank Details */}
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Bank Details (shown on invoice)</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field
                label="Account Holder"
                field="bankHolder"
                placeholder="Company Name"
                value={profile.bankHolder}
                onChange={(e) => set('bankHolder', e.target.value)}
              />
              <Field
                label="Bank Name"
                field="bankName"
                placeholder="State Bank"
                value={profile.bankName}
                onChange={(e) => set('bankName', e.target.value)}
              />
              <Field
                label="Account Number"
                field="bankAccount"
                placeholder="XXXXXXXXXXXX"
                value={profile.bankAccount}
                onChange={(e) => set('bankAccount', e.target.value)}
              />
              <Field
                label="IFSC Code"
                field="ifscCode"
                placeholder="SBIN0001234"
                value={profile.ifscCode}
                onChange={(e) => set('ifscCode', e.target.value.toUpperCase())}
              />
              <Field
                label="MICR Code"
                field="micrCode"
                placeholder="560002014"
                value={profile.micrCode}
                onChange={(e) => set('micrCode', e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:col-span-3">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Invoice Header Preview</h3>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-16 w-16 rounded object-contain" />
                )}
                <div className="text-sm">
                  <p className="text-base font-bold text-slate-900">{profile.name}</p>
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{profile.address}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Mobile: {phoneSummary}
                  </p>
                  <p className="text-xs text-slate-600">
                    E Mail: {profile.email} | {profile.website}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    GST: {profile.gstNumber} | SAC: {profile.sacCode}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    CGST: {profile.cgst}% | SGST: {profile.sgst}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tiny footer hint */}
          <div className="lg:col-span-3">
            <div className="rounded-[24px] border border-white/80 bg-white/85 px-5 py-4 text-sm text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                <BadgeCheck size={16} className="text-emerald-600" />
                Saved profile values will flow automatically into future invoices and PDFs.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}