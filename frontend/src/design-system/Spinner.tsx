export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  inline?: boolean;
}

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 36,
};

export function Spinner({ size = 'md', color = 'var(--primary)', inline = false }: SpinnerProps) {
  const px = sizeMap[size];

  return (
    <span
      style={{
        display: inline ? 'inline-flex' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        role="status"
        aria-label="Loading"
        style={{
          width: px,
          height: px,
          border: `2px solid var(--border)`,
          borderTopColor: color,
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'ds-spin 0.6s linear infinite',
          flexShrink: 0,
        }}
      />
    </span>
  );
}
