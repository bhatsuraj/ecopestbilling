import React, { useState } from 'react';
import { Leaf } from 'lucide-react';
import { DEFAULT_COMPANY } from '../context/AppContext';

/**
 * CompanyLogo — renders the company logo from the Company Profile
 * (falls back to a Leaf icon when no logoUrl is configured or the image
 * fails to load).
 *
 * Props:
 *   - logoUrl?:   string  override; otherwise reads DEFAULT_COMPANY.logoUrl
 *   - size:       number  icon px size for the fallback Leaf  (default 18)
 *   - imgClass:   string  classes applied to the rendered <img>
 *   - alt:        string  alt text (default 'Eco Pest Solutions')
 */
export default function CompanyLogo({
  logoUrl,
  size = 18,
  imgClass = 'h-full w-full object-contain p-1',
  alt = 'Eco Pest Solutions',
}) {
  const [failed, setFailed] = useState(false);
  const url = (logoUrl ?? DEFAULT_COMPANY.logoUrl ?? '').trim();

  if (!url || failed) {
    return <Leaf size={size} className="text-white" data-testid="company-logo-fallback" />;
  }

  return (
    <img
      src={url}
      alt={alt}
      data-testid="company-logo"
      className={imgClass}
      onError={() => setFailed(true)}
    />
  );
}
