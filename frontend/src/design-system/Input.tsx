import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, inputSize = 'md', style, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const heights: Record<string, string> = {
      sm: 'var(--input-height-sm)',
      md: 'var(--input-height-md)',
      lg: 'var(--input-height-lg)',
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-medium)' as React.CSSProperties['fontWeight'],
              color: 'var(--text-secondary)',
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {leftIcon && (
            <span style={{
              position: 'absolute', left: 'var(--space-3)',
              color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none',
            }}>
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            style={{
              display: 'block',
              width: '100%',
              height: heights[inputSize],
              padding: `0 ${rightIcon ? 'var(--space-8)' : 'var(--space-3)'}`,
              paddingLeft: leftIcon ? 'var(--space-8)' : 'var(--space-3)',
              background: 'var(--bg-surface)',
              border: `1px solid ${error ? 'var(--border-error)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'var(--transition)',
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--border-focus)';
              e.currentTarget.style.boxShadow = `0 0 0 2px ${error ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`;
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error ? 'var(--border-error)' : 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
              props.onBlur?.(e);
            }}
            {...props}
          />
          {rightIcon && (
            <span style={{
              position: 'absolute', right: 'var(--space-3)',
              color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none',
            }}>
              {rightIcon}
            </span>
          )}
        </div>
        {(error || helperText) && (
          <span style={{
            fontSize: 'var(--text-xs)',
            color: error ? 'var(--error)' : 'var(--text-muted)',
          }}>
            {error ?? helperText}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
