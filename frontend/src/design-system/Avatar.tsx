export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, { px: number; font: string }> = {
  xs: { px: 24, font: '10px' },
  sm: { px: 32, font: '12px' },
  md: { px: 40, font: '14px' },
  lg: { px: 48, font: '16px' },
  xl: { px: 64, font: '20px' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

function colorFromName(name: string): string {
  const colors = [
    '#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const { px, font } = sizeMap[size];
  const initials = getInitials(name);
  const bg = colorFromName(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        style={{
          width: px, height: px,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid var(--border)',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      title={name}
      style={{
        width: px, height: px,
        borderRadius: '50%',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: font, fontWeight: 600, color: '#fff',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}
