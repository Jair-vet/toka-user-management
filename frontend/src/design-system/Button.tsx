import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--primary)', color: '#fff', border: 'none' },
  secondary: { background: 'var(--bg-surface)', color: 'var(--text)', border: '1px solid var(--border)' },
  danger: { background: 'var(--error)', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' },
  success: { background: 'var(--success)', color: '#fff', border: 'none' },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 'var(--btn-height-sm)', padding: '0 var(--space-3)', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)' },
  md: { height: 'var(--btn-height-md)', padding: '0 var(--space-4)', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius)' },
  lg: { height: 'var(--btn-height-lg)', padding: '0 var(--space-6)', fontSize: 'var(--text-base)', borderRadius: 'var(--radius)' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 'var(--font-medium)' as React.CSSProperties['fontWeight'],
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          transition: 'var(--transition)',
          whiteSpace: 'nowrap',
          width: fullWidth ? '100%' : undefined,
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...(variant === 'ghost' && !isDisabled
            ? { ':hover': { background: 'var(--bg-surface)', color: 'var(--text)' } }
            : {}),
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
          }
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }
          props.onMouseLeave?.(e);
        }}
        {...props}
      >
        {loading ? (
          <span
            style={{
              width: size === 'sm' ? 12 : 16,
              height: size === 'sm' ? 12 : 16,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'ds-spin 0.6s linear infinite',
            }}
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
