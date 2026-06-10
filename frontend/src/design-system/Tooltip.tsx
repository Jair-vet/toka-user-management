import { useState, type ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
}

const positionStyle: Record<TooltipPosition, React.CSSProperties> = {
  top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
  bottom: { top: '100%',   left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
  left:   { right: '100%', top: '50%',  transform: 'translateY(-50%)', marginRight: 6 },
  right:  { left: '100%',  top: '50%',  transform: 'translateY(-50%)', marginLeft: 6 },
};

export function Tooltip({ content, children, position = 'top', delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  let timer: ReturnType<typeof setTimeout>;

  const show = () => { timer = setTimeout(() => setVisible(true), delay); };
  const hide = () => { clearTimeout(timer); setVisible(false); };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 'var(--z-tooltip)' as React.CSSProperties['zIndex'],
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            ...positionStyle[position],
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
