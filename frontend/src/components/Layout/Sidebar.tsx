import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  ScrollText,
  Bot,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/roles', icon: Shield, label: 'Roles' },
  { to: '/audit', icon: ScrollText, label: 'Auditoría' },
  { to: '/chat', icon: Bot, label: 'Asistente de IA' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);

  const showTip = (e: React.MouseEvent<HTMLDivElement>, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2 });
  };
  const hideTip = () => setTip(null);

  return (
    <aside
      className={`layout-sidebar${collapsed ? ' collapsed' : ''}`}
      style={{
        width: collapsed ? 60 : 220,
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0',
        transition: 'width 0.25s ease',
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
        overflowX: collapsed ? 'visible' : 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: collapsed ? '0 0' : '0 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: collapsed ? '1rem' : '1.1rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
          {collapsed ? 'T' : 'Toka'}
        </span>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <div
            key={to}
            className="sidebar-nav-item"
            style={{ position: 'relative' }}
            onMouseEnter={collapsed ? (e) => showTip(e, label) : undefined}
            onMouseLeave={collapsed ? hideTip : undefined}
          >
            <NavLink
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '0.6rem',
                padding: collapsed ? '0.6rem 0' : '0.55rem 1.5rem',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                width: '100%',
              })}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && label}
            </NavLink>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: collapsed ? '1rem 0' : '1rem 1.5rem',
        borderTop: '1px solid var(--border)',
      }}>
        {!collapsed && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', overflow: 'hidden' }}>
            <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? '—'}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? '—'}
            </div>
          </div>
        )}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={collapsed ? (e) => showTip(e, 'Cerrar sesión') : undefined}
          onMouseLeave={collapsed ? hideTip : undefined}
        >
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => void logout()}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <LogOut size={14} />
            {!collapsed && ' Cerrar sesión'}
          </button>
        </div>
      </div>
      {/* Fixed tooltip — not clipped by any parent overflow */}
      {collapsed && tip && (
        <div style={{
          position: 'fixed',
          left: 68,
          top: tip.top,
          transform: 'translateY(-50%)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '0.3rem 0.7rem',
          borderRadius: 6,
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {tip.label}
        </div>
      )}
    </aside>
  );
}
