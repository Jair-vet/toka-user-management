import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type Toast } from '@/store/toastStore';

const icons = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
};

const colors: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
  success: { bg: '#14532d', border: '#16a34a', icon: '#22c55e' },
  error:   { bg: '#450a0a', border: '#dc2626', icon: '#ef4444' },
  info:    { bg: '#1e3a5f', border: '#2563eb', icon: '#3b82f6' },
  warning: { bg: '#451a03', border: '#d97706', icon: '#f59e0b' },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { remove } = useToastStore();
  const c = colors[toast.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.75rem 1rem',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        minWidth: 280,
        maxWidth: 360,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        animation: 'toast-in 0.2s ease',
      }}
    >
      <span style={{ color: c.icon, flexShrink: 0, marginTop: 1 }}>
        {icons[toast.type]}
      </span>
      <span style={{ flex: 1, fontSize: '0.875rem', color: '#f1f5f9', lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={() => remove(toast.id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '0 0 0 0.25rem',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
