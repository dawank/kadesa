import React from 'react';
import { useToast, ToastType } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={18} color="var(--color-primary-600)" />;
    case 'error':
      return <AlertCircle size={18} color="var(--color-accent-rose)" />;
    case 'warning':
      return <AlertTriangle size={18} color="var(--color-accent-amber)" />;
    case 'info':
    default:
      return <Info size={18} color="var(--color-accent-blue)" />;
  }
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {getToastIcon(toast.type)}
          <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
            {toast.message}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => removeToast(toast.id)}
            style={{ padding: '0.2rem', color: 'var(--color-slate-400)' }}
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
