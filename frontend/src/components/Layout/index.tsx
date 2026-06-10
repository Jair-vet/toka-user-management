import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 19,
          }}
        />
      )}

      {/* Sidebar — desktop: inline; mobile: fixed drawer */}
      <div
        className={`layout-sidebar-wrapper${mobileOpen ? ' mobile-open' : ''}`}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
        />
      </div>

      <main
        className="layout-main"
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '100vh',
          minWidth: 0,
        }}
      >
        {/* Mobile hamburger */}
        <button
          className="mobile-menu-btn btn btn-secondary btn-sm"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          style={{
            display: 'none',
            marginBottom: '1rem',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Menu size={16} /> Menu
        </button>

        <Outlet />
      </main>
    </div>
  );
}
