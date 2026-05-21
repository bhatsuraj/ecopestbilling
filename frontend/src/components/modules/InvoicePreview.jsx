import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n/translations';
import { X, Printer, Download, Pencil, Share2, MessageCircle, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../ui/confirm-dialog';
import { formatDateDDMMYY } from '../../lib/date';

const TERMS = [
  '1. Payment is to be made within ten days on receipt of the bill date.',
  '2. Cheque or cash Payment is only accepted.',
  '3. An interest rate of 18% per annum will be charged if the amount remains after 60 days.',
  '4. Subject to Bangalore jurisdiction declaration.',
  '5. We declare that this invoice shows the actual price for the service provided is true and correct.',
];

const PRINT_STYLES = `
@media print {
  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  #invoice-print-area {
    width: 210mm !important;
    max-width: 210mm !important;
    min-height: 297mm !important;
    height: auto !important;
    margin: 0 auto !important;
    padding: 10mm !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    background: #ffffff !important;
    display: block !important;
    position: relative !important;
    border: 1.5px solid #000 !important;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  thead {
    display: table-header-group;
  }

  tfoot {
    display: table-footer-group;
  }

  tr,
  td,
  th {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  @page {
    size: A4 portrait;
    margin: 10mm;
  }
}
`;

const cell = (extra = {}) => ({
  border: '1px solid #000',
  padding: '8px 10px',  // Increased from 4px 6px
  fontSize: '12px',     // Increased from 11px
  lineHeight: '1.6',    // Increased from 1.4
  verticalAlign: 'top',
  ...extra,
});

// Special cell style for Description column (no side borders, merged cells)
const descCell = (extra = {}) => ({
  borderTop: '1px solid #000',
  borderBottom: '1px solid #000',
  borderLeft: 'none',
  borderRight: 'none',
  padding: '8px 10px',
  fontSize: '12px',
  lineHeight: '1.6',
  verticalAlign: 'top',
  textAlign: 'center',
  ...extra,
});


// Use the row's stored amount if present (already calculated), else fallback:
// new format → rate × qty (visitType is just a label)
// legacy format → visits × rate × qty (visits was numeric)
const calcAmount = (row) => {
  if (row && typeof row.amount === 'number') return row.amount;
  const rate = parseFloat(row?.rate) || 0;
  const qty  = parseFloat(row?.qty)  || 0;
  // Legacy support: only multiply by visits if visits is numeric (old bills)
  const visitsNum = parseFloat(row?.visits);
  const visitMul  = !isNaN(visitsNum) && visitsNum > 0 ? visitsNum : 1;
  return rate * qty * visitMul;
};

function numberToWords(num) {
  if (!num || num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  return convert(Math.min(Math.floor(num), 999999999));
}

const fmtAmt = (v) => {
  const n = parseFloat(v) || 0;
  const rs = Math.floor(n);
  const ps = Math.round((n - rs) * 100);
  return { rs: rs.toLocaleString('en-IN'), ps: String(ps).padStart(2, '0') };
};

export default function InvoicePreview({ bill, onClose, onEdit, language, autoShare, onSent }) {
  const { getCompanyProfile } = useApp();
  const { notify } = useConfirm();
  const navigate = useNavigate();
  const invoiceRef = useRef(null);
  const company    = getCompanyProfile();
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  // Logo as base64 — pre-loaded on mount so PDF generation is fully synchronous after user click
  const [logoSrc, setLogoSrc] = useState(company.logoUrl || '');
  const [signSrc, setSignSrc] = useState(company.signUrl || '');
  const [sealSrc, setSealSrc] = useState(company.sealUrl || '');
  const isCancelled = (bill?.status === 'cancelled');
  // Share/Send must remain disabled until the bill has been approved.
  // Pending and rejected bills cannot be shared with the customer.
  const isApproved = (bill?.status === 'approved');
  const shareDisabled = !isApproved || isCancelled;

  // If onEdit not provided, default to navigating to /dashboard/bill-generate/:billNumber
  const handleEdit = () => {
    if (isCancelled) return; // hard guard — cancelled invoices are read-only
    if (onEdit) return onEdit();
    if (bill?.billNumber) {
      onClose && onClose();
      navigate(`/dashboard/bill-generate/${encodeURIComponent(bill.billNumber)}`);
    }
  };

  // Convert any image URL (cross-origin or not) to a base64 data URI.
  // Tries fetch+blob first; falls back to canvas-from-loaded-img which works for any
  // already-rendered <img> regardless of CORS (as long as server allows crossOrigin attr).
  const toBase64 = (url) => new Promise((resolve) => {
    if (!url) return resolve('');
    if (url.startsWith('data:')) return resolve(url);
    fetch(url, { mode: 'cors' })
      .then(res => { if (!res.ok) throw new Error('fetch failed'); return res.blob(); })
      .then(blob => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.onerror = () => fallbackCanvas(url, resolve);
        fr.readAsDataURL(blob);
      })
      .catch(() => fallbackCanvas(url, resolve));
  });

  // Canvas fallback — load the image with crossOrigin attribute, draw to canvas, export
  const fallbackCanvas = (url, resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  };

  // Pre-load logo as base64 on mount so html2canvas can always read it
  useEffect(() => {
    let mounted = true;
    if (company.logoUrl && !company.logoUrl.startsWith('data:')) {
      toBase64(company.logoUrl).then(b64 => { if (mounted) setLogoSrc(b64); });
    } else {
      setLogoSrc(company.logoUrl);
    }
    return () => { mounted = false; };
  }, [company.logoUrl]);

  // Pre-load sign + seal as base64 so html2canvas can include them in the PDF
  useEffect(() => {
    let mounted = true;
    if (company.signUrl && !company.signUrl.startsWith('data:')) {
      toBase64(company.signUrl).then(b64 => { if (mounted) setSignSrc(b64); });
    } else {
      setSignSrc(company.signUrl || '');
    }
    return () => { mounted = false; };
  }, [company.signUrl]);
  useEffect(() => {
    let mounted = true;
    if (company.sealUrl && !company.sealUrl.startsWith('data:')) {
      toBase64(company.sealUrl).then(b64 => { if (mounted) setSealSrc(b64); });
    } else {
      setSealSrc(company.sealUrl || '');
    }
    return () => { mounted = false; };
  }, [company.sealUrl]);

  // Auto-share when the parent asks for it (e.g. Bill Summary → Send → WhatsApp/Email).
  // Wait until the invoice DOM ref is mounted before triggering the share so
  // html2pdf can read the rendered content.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (!autoShare || autoFiredRef.current) return;
    if (!invoiceRef.current) return;
    autoFiredRef.current = true;
    // Small delay so the modal paints first.
    const t = setTimeout(() => {
      if (autoShare === 'whatsapp') handleWhatsAppShare();
      else if (autoShare === 'email') handleEmailShare();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoShare, logoSrc]);

  const subtotal   = bill.subtotal   ?? (bill.rows || []).reduce((s, r) => s + calcAmount(r), 0);
  // Prefer the rate stored on the bill (snapshot at generation), fall back to current company profile
  const cgstRate   = bill.cgstRate ?? parseFloat(company.cgst) ?? 9;
  const sgstRate   = bill.sgstRate ?? parseFloat(company.sgst) ?? 9;
  
  // Calculate tax based on bill type
  let cgst = 0;
  let sgst = 0;
  let grandTotal = subtotal;
  
  if (bill.type === 'tax') {
    // Tax Bill: Calculate CGST and SGST
    cgst = bill.cgst ?? (subtotal * cgstRate / 100);
    sgst = bill.sgst ?? (subtotal * sgstRate / 100);
    grandTotal = bill.grandTotal ?? bill.total ?? (subtotal + cgst + sgst);
  } else {
    // Cash Bill: No tax
    cgst = 0;
    sgst = 0;
    grandTotal = bill.grandTotal ?? bill.total ?? subtotal;
  }
  
  const amtWords = numberToWords(Math.floor(grandTotal));

  // Render a description with the {LOCATION} placeholder (or the bare location word) highlighted in red.
  // Handles legacy bills (no template) by searching for the stored `location` string and wrapping it.
  const renderDescriptionWithHighlight = (row) => {
    const desc = row?.description || '—';
    const loc  = row?.location;
    if (!loc) return desc;
    const parts = desc.split(new RegExp(`(${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === loc.toLowerCase()
        ? <span key={i} style={{ color: '#cc0000', fontWeight: 700 }}>{part}</span>
        : <React.Fragment key={i}>{part}</React.Fragment>
    );
  };

  const handlePrint = () => window.print();

  // Build a PDF Blob from the current invoice DOM (shared by download + share).
  const buildPdfBlob = async () => {
    const { default: html2pdf } = await import('html2pdf.js');

    const element = invoiceRef.current;

    return html2pdf()
      .set({
        margin: 0,
        image: {
          type: 'jpeg',
          quality: 1,
        },
        html2canvas: {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: true,
          hotfixes: ['px_scaling'],
        },
        pagebreak: {
          mode: ['css', 'legacy'],
        },
      })
      .from(element)
      .outputPdf('blob');
  };

  const buildPdfFilename = () => {
    const billNum = bill?.billNumber?.replace('BILL-', '').replace('EPS', '') || '001';
    const billType = bill?.type === 'tax' ? 'TaxInvoice' : 'CashBill';
    return `${billType}_${billNum}.pdf`;
  };

  const handlePDF = async () => {
    setGeneratingPDF(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildPdfFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('PDF generation error:', err);
      await notify({ title: 'PDF failed', message: 'PDF generation failed. Please try again.', variant: 'danger' });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Upload the freshly-generated PDF to the backend and return a public URL
  // that can be sent over WhatsApp/Email. (Removed: no more server-side storage.)
  // Helper that builds a File from a freshly-generated PDF blob.
  const buildPdfFile = async () => {
    const blob = await buildPdfBlob();
    const filename = buildPdfFilename();
    return new File([blob], filename, { type: 'application/pdf' });
  };

  // Convert a Blob/File to a raw base64 string (no data: prefix).
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.onload = () => {
      const result = reader.result || '';
      const comma = String(result).indexOf(',');
      resolve(comma === -1 ? String(result) : String(result).slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });

  // Trigger a local download of the PDF (used as a fallback when Web Share
  // with files isn't available — typically on desktop browsers).
  const downloadPdfLocally = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Share via WhatsApp — uses the Web Share API with the PDF attached when
  // supported (mobile / modern browsers). On desktop wa.me cannot attach files
  // (WhatsApp limitation), so we also copy the PDF to the OS clipboard so the
  // user can paste (Ctrl+V) into WhatsApp Web for one-step attach.
  const handleWhatsAppShare = async () => {
    setShowShareMenu(false);
    // Open wa.me synchronously so popup blockers stay happy.
    // Support both new (top-level customerPhone) and legacy (customer.phone) shapes.
    const rawPhone = bill?.customerPhone || bill?.customer?.phone || '';
    let customerPhone = rawPhone.replace(/[^\d]/g, '');
    if (customerPhone.length === 10) customerPhone = `91${customerPhone}`;
    const billNumber = bill?.billNumber || '';
    const amount = (bill?.totalAmount ?? bill?.grandTotal ?? 0).toLocaleString('en-IN');
    const companyName = company.name || 'Eco Pest Solutions';
    const message =
      `Hi! Your invoice from ${companyName}\n\n` +
      `Bill No: ${billNumber}\n` +
      `Total Amount: ₹${amount}\n\n` +
      `Thank you for your business!`;

    setGeneratingPDF(true);
    try {
      const file = await buildPdfFile();

      // Preferred path: native Web Share API with file attachment (mobile).
      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === 'function'
      ) {
        try {
          await navigator.share({
            title: `Invoice ${billNumber}`,
            text: message,
            files: [file],
          });
          onSent && onSent('whatsapp');
          return; // user picked WhatsApp (or any other app) from the share sheet
        } catch (err) {
          if (err?.name === 'AbortError') return; // user cancelled
          // fall through to manual fallback
        }
      }

      // Desktop fallback: try to copy PDF to clipboard so user can paste into
      // WhatsApp Web with Ctrl+V. Always also download a local copy as backup.
      let clipboardOk = false;
      try {
        if (window.ClipboardItem && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'application/pdf': file }),
          ]);
          clipboardOk = true;
        }
      } catch (_) { /* clipboard not permitted — fall back to download */ }
      if (!clipboardOk) downloadPdfLocally(file);

      const whatsappUrl = customerPhone
        ? `https://wa.me/${customerPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      onSent && onSent('whatsapp');
      await notify({
        title: clipboardOk ? 'PDF copied to clipboard' : 'PDF downloaded',
        message: clipboardOk
          ? 'WhatsApp Web opened — press Ctrl+V (Cmd+V on Mac) in the chat to attach the invoice.'
          : 'Please attach the downloaded PDF to your WhatsApp chat.',
        variant: 'success',
      });
    } catch (err) {
      console.error('WhatsApp share error:', err);
      await notify({ title: 'Share failed', message: 'Could not prepare bill for sharing. Please try again.', variant: 'danger' });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Share via Email — Sends the invoice via the backend SMTP endpoint, so the
  // customer receives a real email with the PDF attached. No mailto:, no
  // Gmail compose URL, no clipboard step.
  const handleEmailShare = async () => {
    setShowShareMenu(false);
    const customerEmail = bill?.customerEmail || bill?.customer?.email || '';
    const billNumber = bill?.billNumber || '';
    const amount = (bill?.totalAmount ?? bill?.grandTotal ?? 0).toLocaleString('en-IN');
    const companyName = company.name || 'Eco Pest Solutions';
    const subject = `Invoice ${billNumber} from ${companyName}`;
    const body =
      `Dear Customer,\n\n` +
      `Please find your invoice attached.\n\n` +
      `Bill Number: ${billNumber}\n` +
      `Total Amount: ₹${amount}\n\n` +
      `Thank you for your business!\n\n` +
      `Best regards,\n${companyName}`;

    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      await notify({
        title: 'No customer email',
        message: 'This customer does not have a valid email on file. Add one in the Customers page and try again.',
        variant: 'warning',
      });
      return;
    }

    setGeneratingPDF(true);
    try {
      const file = await buildPdfFile();
      const pdfBase64 = await blobToBase64(file);

      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/bills/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerEmail,
          subject,
          body,
          pdfBase64,
          filename: file.name,
        }),
      });

      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try { const j = await resp.json(); if (j?.detail) detail = j.detail; } catch (_) { /* ignore */ }
        throw new Error(detail);
      }

      onSent && onSent('email');
      await notify({
        title: 'Email sent',
        message: `Invoice ${billNumber} delivered to ${customerEmail} with the PDF attached.`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Email send error:', err);
      await notify({
        title: 'Email failed',
        message: String(err?.message || err) || 'Could not send the email. Please try again.',
        variant: 'danger',
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Phone string helper
  const phones = [company.phone1, company.phone2, company.phone3].filter(Boolean).join(' / ');

  // Table base style
  const tbl = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-6 px-4 no-print">
      {/* Floating action bar */}
      <div className="fixed top-4 right-4 flex flex-wrap items-center gap-2 z-[60] no-print">
        {isCancelled && (
          <span
            data-testid="invoice-cancelled-badge"
            className="px-3 py-1.5 rounded-xl text-sm font-bold tracking-wider bg-red-600 text-white shadow-lg"
          >
            CANCELLED
          </span>
        )}
        <button
          data-testid="edit-invoice-button"
          onClick={handleEdit}
          disabled={isCancelled}
          title={isCancelled ? 'Cancelled invoices cannot be edited' : 'Edit invoice'}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg transition-colors ${
            isCancelled
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}>
          <Pencil size={15} /> Edit
        </button>
        
        {/* Share Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
            data-testid="share-invoice-button"
            disabled={generatingPDF || shareDisabled}
            title={shareDisabled
              ? (isCancelled ? 'Cancelled invoices cannot be shared' : 'Share is enabled only after the approval request is approved')
              : 'Share invoice'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg transition-colors ${
              shareDisabled
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-60`}>
            <Share2 size={15} /> {generatingPDF ? 'Preparing...' : 'Share'}
          </button>
        </div>
        
        {showShareMenu && (
          <div
            data-testid="share-modal-overlay"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 fade-in"
            onClick={() => setShowShareMenu(false)}>
            <div
              data-testid="share-modal"
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden pop-in">
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Share invoice
                  </h3>
                  <button
                    data-testid="share-modal-close"
                    onClick={() => setShowShareMenu(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    ×
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  <span className="font-mono font-semibold text-green-700">{bill?.billNumber}</span>
                  {' · '}{bill?.customerName || 'Customer'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-5">
                {/* WhatsApp */}
                <button
                  data-testid="share-modal-whatsapp"
                  onClick={handleWhatsAppShare}
                  disabled={generatingPDF}
                  className="group relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0">
                  <div className="w-14 h-14 rounded-2xl bg-green-100 group-hover:bg-green-500 flex items-center justify-center transition-colors">
                    <MessageCircle size={26} className="text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">WhatsApp</p>
                  {(bill?.customerPhone || bill?.customer?.phone) ? (
                    <p className="text-[11px] text-slate-500 truncate max-w-full px-2">{bill?.customerPhone || bill?.customer?.phone}</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic">No phone on file</p>
                  )}
                </button>

                {/* Email */}
                <button
                  data-testid="share-modal-email"
                  onClick={handleEmailShare}
                  disabled={generatingPDF}
                  className="group relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors">
                    <Mail size={26} className="text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Email</p>
                  {(bill?.customerEmail || bill?.customer?.email) ? (
                    <p className="text-[11px] text-slate-500 truncate max-w-full px-2">{bill?.customerEmail || bill?.customer?.email}</p>
                  ) : (
                    <p className="text-[11px] text-amber-600 italic">No email on file</p>
                  )}
                </button>
              </div>

              <p className="px-6 pb-5 text-[11px] text-slate-400 text-center">
                {generatingPDF
                  ? 'Preparing invoice PDF…'
                  : 'The invoice PDF will be generated and attached automatically.'}
              </p>
            </div>
          </div>
        )}
        
        <button data-testid="print-invoice-button" onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-lg transition-colors">
          <Printer size={15} /> {t(language, 'print')}
        </button>
        <button data-testid="download-pdf-button" onClick={handlePDF} disabled={generatingPDF}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 shadow-lg transition-colors disabled:opacity-60">
          <Download size={15} /> {generatingPDF ? 'Generating PDF...' : 'Download PDF'}
        </button>
        <button data-testid="close-invoice-button" onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 shadow-lg transition-colors">
          <X size={15} /> {t(language, 'close')}
        </button>
      </div>

      <style>{PRINT_STYLES}</style>

      {/* ─────────────── INVOICE BODY (A4 Size: 210mm x 297mm) - CASH BILL FORMAT ─────────────── */}
      <div
        id="invoice-print-area"
        ref={invoiceRef}
        style={{
          background: '#ffffff',
          width: '210mm',
          minHeight: '297mm',
          height: 'auto',
          maxWidth: '210mm',
          margin: '0 auto',
          padding: '10mm',
          boxSizing: 'border-box',
          overflow: 'visible',
          position: 'relative',
          display: 'block',
          pageBreakInside: 'auto',
          WebkitBoxDecorationBreak: 'clone',
          boxDecorationBreak: 'clone',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: '#0d0000',
          border: '1.5px solid #000',
          boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        }}
      >

        {/* ── Row 1: ORIGINAL COPY | TAX INVOICE ── */}
        <table style={{ ...tbl, marginBottom: '0' }}>
          <tbody>
            <tr>
              <td style={{ ...cell({ fontWeight: 'bold', width: '33%', fontSize: '12px', padding: '8px' }) }}>
                ORIGINAL COPY
              </td>
              <td style={{ ...cell({ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', letterSpacing: '1.5px', width: '34%', padding: '10px',color:'#2a5f51'}) }}>
                {bill.type === 'tax' ? 'TAX INVOICE' : 'CASH BILL'}
              </td>
              <td style={{ ...cell({ width: '33%', padding: '8px' }) }}></td>
            </tr>
          </tbody>
        </table>

        {/* ── Row 2: Logo + Company Details ── */}
        <table style={{ ...tbl, marginBottom: '0' }}>
          <tbody>
            <tr>
              <td style={{ ...cell({ width: '15%', textAlign: 'center', verticalAlign: 'middle', padding: '10px' }) }}>
                {logoSrc && (
                  <img src={logoSrc} alt="Logo" data-pdf-logo
                    style={{ width: '90px', height: '90px', objectFit: 'contain' }} />
                )}
              </td>
              <td style={{ ...cell({ width: '85%', verticalAlign: 'middle', textAlign: 'left', padding: '10px' }) }}>
                <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px',color:"#000000" }}>{company.name || 'ECO PEST SOLUTIONS'}</div>
                <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                  <div>Address: {company.address || 'No. 281, 3rd Floor, 3rd Main, 4th Cross, B-Block, Vijayanandanagar, Nandini Layout Post, Bangalore-560096.'}</div>
                  <div>Mobile No: {phones || '9731066971 / 9481566971 / 9663996594'}</div>
                  <div>E Mail ID: {company.email || 'mge.ecopestsolutions@gmail.com'}</div>
                  <div>Website: {company.website || 'www.ecopestsolutions.org'}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Row 3: Customer Info (left) + Invoice Details (right) ── */}
        <table style={{ ...tbl, marginBottom: '0' }}>
          <tbody>
            {/* Header row */}
            <tr>
              <td style={{ ...cell({ fontWeight: 'bold', width: '50%', background: '#f5f5f5', padding: '8px', fontSize: '11px', textAlign: 'center' }) }}>
                CUSTOMER NAME & ADDRESS
              </td>
              <td style={{ ...cell({ fontWeight: 'bold', width: '25%', background: '#f5f5f5', padding: '8px', fontSize: '11px', textAlign: 'left' }) }}>
                Invoice No:
              </td>
              <td style={{ ...cell({ width: '25%', background: '#f5f5f5', padding: '8px', fontSize: '11px', textAlign: 'left' ,fontWeight: 'bold'}) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{bill.billNumber}</span>
                  {isCancelled && (
                    <span style={{
                      color: '#cc0000',
                      fontWeight: 800,
                      letterSpacing: '1.5px',
                      fontSize: '11px',
                      border: '1.5px solid #cc0000',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                    }}>
                      CANCELLED
                    </span>
                  )}
                </div>
              </td>
            </tr>
            {/* Customer address rows with invoice fields */}
            <tr>
              <td rowSpan={6} style={{ ...cell({ verticalAlign: 'top', padding: '10px', lineHeight: '1.6' }) }}>
                <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>M/S.</strong></div>
                {/* <div style={{ fontSize: '11px', marginBottom: '4px' }}>To,</div> */}
                <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 'bold' }}>{bill.customerName}</div>
                {bill.customerAddress && (
                  <div style={{ fontSize: '11px', marginBottom: '8px' }}>{bill.customerAddress}</div>
                )}
                {bill.customerPhone && (
                  <div style={{ fontSize: '11px', marginBottom: '8px' }}>Ph: {bill.customerPhone}</div>
                )}
                <div style={{ fontSize: '11px', marginTop: '12px' }}>
                  <strong>CUSTOMER GST NO:</strong> {bill.customerGst || ''}
                </div>
              </td>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>Invoice Date:</td>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>{formatDateDDMMYY(bill.date)}</td>
            </tr>
            <tr>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>P.O No:</td>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>{bill.poNumber || ''}</td>
            </tr>
            <tr>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>P.O Date:</td>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>{formatDateDDMMYY(bill.poDate)}</td>
            </tr>
            <tr>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>GST No</td>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>{company.gstNumber}</td>
            </tr>
            <tr>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>SAC No.</td>
              <td style={{ ...cell({ padding: '6px 8px', fontSize: '11px', textAlign: 'left' }) }}>{bill.customerSac || company.sacCode}</td>
            </tr>
            <tr>
              <td
                colSpan={2}
                style={{
                  ...cell({
                    padding: '10px',
                    fontSize: '11px',
                    lineHeight: '1.9',
                    verticalAlign: 'top',
                    textAlign: 'left',
                  }),
                }}
              >
                <div><strong>BANK HOLDER :</strong> {company.bankHolder || 'ECO PEST SOLUTIONS'}</div>
                <div><strong>BANK :</strong> {company.bankName || 'State Bank of India'}</div>
                <div><strong>BANK A/C :</strong> {company.bankAccount || '43207089599'}</div>
                <div><strong>IFSC CODE :</strong> {company.ifscCode || 'SBIN0040257'}</div>
                <div><strong>MICR :</strong> {company.micrCode || '560002405'}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Service Table ── */}
        <table style={{ ...tbl, marginBottom: '0' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <td style={{ ...cell({ fontWeight: 'bold', textAlign: 'center', width: '6%', padding: '8px 6px', fontSize: '11px' }) }}>
                SL<br />No.
              </td>
              <td style={{ ...descCell({ fontWeight: 'bold', textAlign: 'center', width: '46%', padding: '8px', fontSize: '11px', background: '#f0f0f0' }) }}>
                Description of service
              </td>
              <td style={{ ...cell({ fontWeight: 'bold', textAlign: 'center', width: '14%', padding: '8px 6px', fontSize: '11px' }) }}>
                Type of<br />Visit
              </td>
              <td style={{ ...cell({ fontWeight: 'bold', textAlign: 'center', width: '14%', padding: '8px 6px', fontSize: '11px' }) }}>
                Rate Per<br />Visit / Service
              </td>
              <td style={{ ...cell({ fontWeight: 'bold', textAlign: 'center', width: '8%', padding: '8px 6px', fontSize: '11px' }) }}>
                Qty /<br />Services
              </td>
              <td style={{ ...cell({ fontWeight: 'bold', textAlign: 'center', width: '8%', padding: '8px 6px', fontSize: '11px' }) }}>
                Amount<br />Rs
              </td>
              <td style={{ ...cell({ fontWeight: 'bold', textAlign: 'center', width: '4%', padding: '8px 6px', fontSize: '11px' }) }}>
                Ps
              </td>
            </tr>
          </thead>
          <tbody>
            {(bill.rows || []).map((row, idx) => {
              const a = fmtAmt(calcAmount(row));
              const visitLabel = row.visitType || row.visits || 'Per Visit';
              return (
                <tr key={idx}>
                  <td style={{ ...cell({ textAlign: 'center', verticalAlign: 'middle', padding: '8px 6px' }) }}>
                    {idx + 1}.
                  </td>
                  <td style={{ ...descCell({ textAlign: 'left', verticalAlign: 'middle', padding: '8px' }) }}>
                    {row.description || '—'}
                  </td>
                  <td style={{ ...cell({ textAlign: 'center', verticalAlign: 'middle', padding: '8px 6px' }) }}>
                    {visitLabel}
                  </td>
                  <td style={{ ...cell({ textAlign: 'center', verticalAlign: 'middle', padding: '8px 6px' }) }}>
                    Rs {(parseFloat(row.rate) || 0).toLocaleString('en-IN')}/-
                  </td>
                  <td style={{ ...cell({ textAlign: 'center', verticalAlign: 'middle', padding: '8px 6px' }) }}>
                    {row.qty || 1}
                  </td>
                  <td style={{ ...cell({ textAlign: 'right', verticalAlign: 'middle', fontWeight: '600', padding: '8px 6px' }) }}>
                    {a.rs}
                  </td>
                  <td style={{ ...cell({ textAlign: 'center', verticalAlign: 'middle', padding: '8px 6px' }) }}>
                    {a.ps}
                  </td>
                </tr>
              );
            })}
            {/* Empty filler rows */}
            {(bill.rows || []).length < 2 && Array.from({ length: 2 - (bill.rows || []).length }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td style={{ ...cell({ height: '35px', padding: '8px 6px' }) }}></td>
                <td style={{ ...descCell({ padding: '8px' }) }}></td>
                <td style={{ ...cell({ padding: '8px' }) }}></td>
                <td style={{ ...cell({ padding: '8px' }) }}></td>
                <td style={{ ...cell({ padding: '8px' }) }}></td>
                <td style={{ ...cell({ padding: '8px' }) }}></td>
                <td style={{ ...cell({ padding: '8px' }) }}></td>
              </tr>
            ))}
            
            {/* Enclosed Service Vouchers row */}
            <tr>
              <td style={{ ...cell({ padding: '8px 6px' }) }}></td>
              <td style={{ ...descCell({ fontWeight: 'bold', color: '#dc2626', padding: '12px 8px', fontSize: '12px', textAlign: 'center' }) }}>
                ** Enclosed Service Vouchers
              </td>
              <td style={{ ...cell({ padding: '8px' }) }}></td>
              <td style={{ ...cell({ padding: '8px' }) }}></td>
              <td style={{ ...cell({ padding: '8px' }) }}></td>
              <td style={{ ...cell({ padding: '8px' }) }}></td>
              <td style={{ ...cell({ padding: '8px' }) }}></td>
            </tr>
          </tbody>
          <tfoot>
            {(() => {
              const tot = fmtAmt(subtotal);
              const cg  = fmtAmt(cgst);
              const sg  = fmtAmt(sgst);
              const gt  = fmtAmt(grandTotal);
              return (
                <>
                  <tr>
                    <td style={{ ...cell({ textAlign: 'right', fontWeight: 'bold', background: '#f9f9f9', padding: '10px 8px', fontSize: '12px' }) }} colSpan={5}>
                      TOTAL
                    </td>
                    <td style={{ ...cell({ textAlign: 'right', fontWeight: 'bold', background: '#f9f9f9', padding: '10px 8px', fontSize: '12px' }) }}>
                      {tot.rs}
                    </td>
                    <td style={{ ...cell({ textAlign: 'center', fontWeight: 'bold', background: '#f9f9f9', padding: '10px 8px' }) }}>
                      {tot.ps}
                    </td>
                  </tr>
                  
                  {/* Show tax rows only for Tax Bill */}
                  {bill.type === 'tax' ? (
                    <>
                      <tr>
                        <td style={{ ...cell({ textAlign: 'right', background: '#fff', padding: '10px 8px', fontSize: '11px' }) }} colSpan={5}>
                          CGST {cgstRate}%
                        </td>
                        <td style={{ ...cell({ textAlign: 'right', background: '#fff', padding: '10px 8px', fontSize: '11px' }) }}>
                          {cg.rs}
                        </td>
                        <td style={{ ...cell({ textAlign: 'center', background: '#fff', padding: '10px 8px' }) }}>
                          {cg.ps}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...cell({ textAlign: 'right', background: '#fff', padding: '10px 8px', fontSize: '11px' }) }} colSpan={5}>
                          SGST {sgstRate}%
                        </td>
                        <td style={{ ...cell({ textAlign: 'right', background: '#fff', padding: '10px 8px', fontSize: '11px' }) }}>
                          {sg.rs}
                        </td>
                        <td style={{ ...cell({ textAlign: 'center', background: '#fff', padding: '10px 8px' }) }}>
                          {sg.ps}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td style={{ ...cell({ background: '#fff', color: '#666', fontSize: '10px', textAlign: 'center', padding: '8px' }) }} colSpan={7}>
                        (Cashless Bill — No GST Applied)
                      </td>
                    </tr>
                  )}
                  
                  <tr>
                    <td style={{ ...cell({ textAlign: 'right', fontWeight: 'bold', background: '#f9f9f9', padding: '10px 8px', fontSize: '12px' }) }} colSpan={5}>
                      GRAND TOTAL
                    </td>
                    <td style={{ ...cell({ textAlign: 'right', fontWeight: 'bold', background: '#f9f9f9', padding: '10px 8px', fontSize: '12px' }) }}>
                      {gt.rs}
                    </td>
                    <td style={{ ...cell({ textAlign: 'center', fontWeight: 'bold', background: '#f9f9f9', padding: '10px 8px' }) }}>
                      {gt.ps}
                    </td>
                  </tr>
                </>
              );
            })()}
          </tfoot>
        </table>

        {/* ── Amount in Words ── */}
        <table style={{ ...tbl, marginBottom: '0' }}>
          <tbody>
            <tr>
              <td style={{ ...cell({ fontWeight: 'bold', padding: '10px', fontSize: '11px' }) }}>
                Total Amount In Words: <span style={{ fontWeight: 'normal' }}>{amtWords} Only</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Remarks (if present) ── */}
        {bill.remarks && bill.remarks.trim() && (
          <table style={{ ...tbl, marginBottom: '0' }}>
            <tbody>
              <tr>
                <td style={{ ...cell({ padding: '10px', fontSize: '11px', color: '#043a0e' }) }}>
                  <span style={{ fontWeight: 'bold' }}>Remarks:</span> {bill.remarks}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── Footer: Terms & Conditions | Signature ── */}
        <table style={tbl}>
          <tbody>
            <tr>
              <td style={{ ...cell({ width: '60%', verticalAlign: 'top', padding: '10px' }) }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', textDecoration: 'underline', fontSize: '11px' }}>
                  Terms & Conditions
                </div>
                {TERMS.map((t, i) => (
                  <div key={i} style={{ marginBottom: '3px', fontSize: '10px', lineHeight: '1.5' }}>{t}</div>
                ))}
              </td>
              <td style={{ ...cell({ width: '40%', textAlign: 'center', verticalAlign: 'bottom', padding: '10px' }) }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '11px' }}>
                  For {company.name || 'Eco Pest Solutions'}
                </div>
                {/* Seal + Signature — signature overlaid on top of the seal,
                    centered, like a real stamped invoice. */}
                {(signSrc || sealSrc) && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      position: 'relative',
                      display: 'inline-block',
                      minHeight: '80px',
                      lineHeight: 0,
                    }}>
                      {sealSrc && (
                        <img
                          src={sealSrc}
                          alt="Seal"
                          style={{
                            height: '90px',
                            maxWidth: '180px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      )}
                      {signSrc && (
                        <img
                          src={signSrc}
                          alt="Signature"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            height: '60px',
                            maxWidth: '170px',
                            objectFit: 'contain',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
                {/* Spacer when neither image is provided so the layout stays balanced */}
                {!signSrc && !sealSrc && (
                  <div style={{ height: '50px' }} />
                )}
                <div style={{ borderTop: '1px solid #000', paddingTop: '6px', marginTop: '6px', fontWeight: 'bold', fontSize: '11px' }}>
                  Authorized Signature
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
