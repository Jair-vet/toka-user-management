import type { ReactNode, CSSProperties } from 'react';

export interface CardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  footer?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  style?: CSSProperties;
  className?: string;
}

const paddingMap = {
  none: '0',
  sm:   'var(--space-4)',
  md:   'var(--space-6)',
  lg:   'var(--space-8)',
};

export function Card({
  children,
  title,
  description,
  footer,
  padding = 'md',
  hoverable = false,
  style,
}: CardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        transition: hoverable ? 'var(--transition)' : undefined,
        ...style,
      }}
      onMouseEnter={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-focus)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
      } : undefined}
      onMouseLeave={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      } : undefined}
    >
      {(title || description) && (
        <div style={{
          padding: `var(--space-5) ${paddingMap[padding]} var(--space-4)`,
          borderBottom: '1px solid var(--border)',
        }}>
          {title && (
            <h3 style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}>
              {title}
            </h3>
          )}
          {description && (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-1)',
            }}>
              {description}
            </p>
          )}
        </div>
      )}

      <div style={{ padding: paddingMap[padding] }}>
        {children}
      </div>

      {footer && (
        <div style={{
          padding: `var(--space-4) ${paddingMap[padding]}`,
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.1)',
          borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}
