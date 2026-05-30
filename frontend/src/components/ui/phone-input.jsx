import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸', name: 'United States/Canada' },
  { code: '+44', country: 'UK', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
];

/**
 * PhoneInput Component with Country Code Selector
 * 
 * @param {Object} props
 * @param {string} props.value - Full E.164 format phone number (e.g., "+919876543210")
 * @param {Function} props.onChange - Callback when phone changes
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.testId - Test ID for testing
 */
export default function PhoneInput({
  value = '',
  onChange,
  placeholder = '9876543210',
  className = '',
  testId = 'phone-input',
  onKeyDown,
  lockedCountryCode = null, // when set (e.g. "+91"), the country selector becomes a non-editable label
}) {
  // Parse existing value into country code and number
  const parsePhone = (phone) => {
    if (!phone) return { countryCode: lockedCountryCode || '+91', number: '' };

    const match = COUNTRY_CODES.find(c => phone.startsWith(c.code));
    if (match) {
      return {
        countryCode: lockedCountryCode || match.code,
        number: phone.slice(match.code.length),
      };
    }
    return { countryCode: lockedCountryCode || '+91', number: phone.replace(/^\+/, '') };
  };

  const { countryCode: initialCode, number: initialNumber } = parsePhone(value);
  const [countryCode, setCountryCode] = useState(initialCode);
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);

  const handleCountryChange = (e) => {
    const newCode = e.target.value;
    setCountryCode(newCode);
    // Notify parent with updated full number
    onChange(newCode + phoneNumber);
  };

  const handleNumberChange = (e) => {
    // Only allow digits
    const cleaned = e.target.value.replace(/\D/g, '');
    // Enforce 10-digit limit when country is locked to India (+91).
    // Other countries keep their existing maxLength of 15.
    const limit = lockedCountryCode === '+91' ? 10 : 15;
    const trimmed = cleaned.slice(0, limit);
    setPhoneNumber(trimmed);
    // Notify parent with full E.164 format
    onChange(countryCode + trimmed);
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[2];

  return (
    <div className={`relative ${className}`}>
      <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
      
      <div className="flex gap-0">
        {/* Country Code — non-editable label when locked, dropdown otherwise */}
        {lockedCountryCode ? (
          <div
            data-testid={`${testId}-country-locked`}
            aria-readonly="true"
            className="flex items-center justify-center pl-10 pr-3 py-3 border border-slate-300 border-r-0 rounded-l-xl bg-slate-50 text-slate-700 text-sm font-semibold select-none cursor-not-allowed"
            style={{ width: '95px' }}
          >
            🇮🇳 {lockedCountryCode}
          </div>
        ) : (
          <div className="relative">
            <select
              data-testid={`${testId}-country`}
              value={countryCode}
              onChange={handleCountryChange}
              className="appearance-none h-full pl-10 pr-2 py-3 border border-slate-300 border-r-0 rounded-l-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:z-10 cursor-pointer font-semibold"
              style={{ width: '95px' }}
            >
              {COUNTRY_CODES.map(({ code, flag, name }) => (
                <option key={code} value={code}>
                  {flag} {code}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Phone Number Input */}
        <input
          data-testid={testId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          className="flex-1 px-4 py-3 border border-slate-300 rounded-r-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:z-10 transition-all"
          placeholder={placeholder}
          value={phoneNumber}
          onChange={handleNumberChange}
          onKeyDown={onKeyDown}
          maxLength={lockedCountryCode === '+91' ? 10 : 15}
        />
      </div>
      
      {/* Helper text showing full E.164 format */}
      {phoneNumber && (
        <p className="text-xs text-slate-500 mt-1">
          Format: <span className="font-mono font-semibold">{countryCode}{phoneNumber}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Utility function to format phone number for display
 * @param {string} phone - E.164 format phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';
  
  const country = COUNTRY_CODES.find(c => phone.startsWith(c.code));
  if (!country) return phone;
  
  const number = phone.slice(country.code.length);
  // Format based on length (simple formatting)
  if (number.length === 10) {
    return `${country.code} ${number.slice(0, 5)} ${number.slice(5)}`;
  }
  return `${country.code} ${number}`;
}

/**
 * Validate E.164 phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid E.164 format
 */
export function isValidE164Phone(phone) {
  if (!phone) return false;
  
  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Convert legacy 10-digit phone to E.164 (assumes India +91)
 * @param {string} phone - 10-digit phone number
 * @returns {string} - E.164 format
 */
export function convertToE164(phone, defaultCountryCode = '+91') {
  if (!phone) return '';
  
  // Already in E.164 format
  if (phone.startsWith('+')) return phone;
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Assume default country code for 10-digit numbers
  if (cleaned.length === 10) {
    return defaultCountryCode + cleaned;
  }
  
  return '+' + cleaned;
}
