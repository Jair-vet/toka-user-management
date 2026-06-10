import { useState, type ReactNode } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const config: Record<AlertVariant, { bg: string; border: string; color: string; icon: ReactNode }> = {
  info:    { bg: 'var(--info-bg)',    border: 'var(--info)',    color: 'var(--info)',    icon: <Info size={16} /> },
  success: { bg: 'var(--success-bg)', border: 'var(--success)', color: 'var(--success)', icon: <CheckCircle size={16} /> },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning)', color: 'var(--warning)', icon: <AlertTriangle size={16} /> },
  error:   { bg: 'var(--error-bg)',   border: 'var(--error)',   color: 'var(--error)',   icon: <XCircle size={16} /> },
};

export function Alert({ variant = 'info', title, children, dismissible = false, onDismiss }: AlertProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const { bg, border, color, icon } = config[variant];

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${border}`,
        borderRadius: 'var(--radius)',
        color: 'var(--text)',
      }}
    >
      <span style={{ color, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color, marginBottom: 2 }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 0, flexShrink: 0,
            display: 'flex', alignItems: 'flex-start',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
