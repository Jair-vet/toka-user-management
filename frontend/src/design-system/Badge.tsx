import type { ReactNode } from 'react';

export type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple' | 'primary';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  primary: { bg: 'rgba(99,102,241,0.2)',   color: '#a5b4fc' },
  blue:    { bg: '#1d4ed8',                color: '#bfdbfe' },
  green:   { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  red:     { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  yellow:  { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  gray:    { bg: 'rgba(100,116,139,0.2)',  color: '#94a3b8' },
  purple:  { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
};

export function Badge({ children, variant = 'gray', size = 'sm', dot = false }: BadgeProps) {
  const { bg, color } = variantMap[variant];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: 500,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
