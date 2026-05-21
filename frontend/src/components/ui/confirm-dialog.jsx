import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, Trash2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

const VARIANT_STYLES = {
  danger: {
    iconWrap: 'bg-red-100',
    icon: 'text-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700',
    IconComp: Trash2,
  },
  warning: {
    iconWrap: 'bg-amber-100',
    icon: 'text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700',
    IconComp: AlertTriangle,
  },
  success: {
    iconWrap: 'bg-green-100',
    icon: 'text-green-700',
    confirmBtn: 'bg-green-700 hover:bg-green-800',
    IconComp: CheckCircle,
  },
  info: {
    iconWrap: 'bg-blue-100',
    icon: 'text-blue-600',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700',
    IconComp: Info,
  },
};

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r(result);
    }
    setDialog(null);
  }, []);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        kind: 'confirm',
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        variant: opts.variant || 'warning',
      });
    });
  }, []);

  const notify = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        kind: 'alert',
        title: opts.title || 'Notice',
        message: opts.message || '',
        confirmText: opts.confirmText || 'OK',
        variant: opts.variant || 'info',
      });
    });
  }, []);

  // Esc key dismisses (treated as cancel / dismiss).
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter' && dialog.kind === 'alert') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  const variant = VARIANT_STYLES[dialog?.variant] || VARIANT_STYLES.info;
  const IconComp = variant.IconComp;

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}
      {dialog && (
        <div
          data-testid="confirm-dialog"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            // click on backdrop = cancel
            if (e.target === e.currentTarget) close(false);
          }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl fade-in relative">
            <button
              data-testid="confirm-dialog-close"
              onClick={() => close(false)}
              className="absolute right-3 top-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close">
              <X size={16} />
            </button>

            <div className="flex items-start gap-3 mb-5">
              <div className={`w-10 h-10 ${variant.iconWrap} rounded-full flex items-center justify-center flex-shrink-0`}>
                <IconComp size={20} className={variant.icon} />
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="font-bold text-slate-900 text-base leading-snug" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {dialog.title}
                </h3>
                {dialog.message && (
                  <p className="text-slate-600 text-sm mt-1 whitespace-pre-line">{dialog.message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {dialog.kind === 'confirm' && (
                <button
                  data-testid="confirm-dialog-cancel"
                  onClick={() => close(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">
                  {dialog.cancelText}
                </button>
              )}
              <button
                data-testid="confirm-dialog-confirm"
                onClick={() => close(true)}
                className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors ${variant.confirmBtn}`}>
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  return ctx;
}
