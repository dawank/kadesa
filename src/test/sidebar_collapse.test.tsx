import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthProvider } from '../context/AuthContext';
import { BrandingProvider } from '../context/BrandingContext';
import { ToastProvider } from '../context/ToastContext';

describe('Sidebar Collapse and Responsive Behavior Tests', () => {
  const renderSidebar = (props: { isCollapsed?: boolean; isMobileOpen?: boolean; onCloseMobile?: () => void }) => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <BrandingProvider>
            <Sidebar {...props} />
          </BrandingProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('should render expanded sidebar with full brand title, logo, and menu labels', () => {
    const { container } = renderSidebar({ isCollapsed: false, isMobileOpen: false });

    const aside = container.querySelector('aside.sidebar');
    expect(aside).toBeDefined();
    expect(aside?.classList.contains('collapsed')).toBe(false);

    // Brand and logo
    expect(screen.getByText('KADESA')).toBeDefined();
    expect(screen.getByText('Sistem Kehadiran Aparatur')).toBeDefined();
    const logoImg = screen.getByAltText('Logo Aplikasi KADESA');
    expect(logoImg).toBeDefined();

    // Menu text items
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Presensi Reguler')).toBeDefined();
    expect(screen.getByText('Dinas Luar (DL)')).toBeDefined();
    expect(screen.getByText('Laporan Kehadiran')).toBeDefined();
    expect(screen.getByText('Profil Pengguna')).toBeDefined();
  });

  it('should apply "collapsed" class and keep menu icons, tooltips, and logo when isCollapsed is true', () => {
    const { container } = renderSidebar({ isCollapsed: true, isMobileOpen: false });

    const aside = container.querySelector('aside.sidebar');
    expect(aside).toBeDefined();
    expect(aside?.classList.contains('collapsed')).toBe(true);

    // Logo must still be present in collapsed mode
    const logoImg = screen.getByAltText('Logo Aplikasi KADESA');
    expect(logoImg).toBeDefined();

    // Nav links must have tooltip attributes
    const dashboardLink = container.querySelector('a[href="/dashboard"]');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink?.getAttribute('title')).toBe('Dashboard');
    expect(dashboardLink?.getAttribute('data-tooltip')).toBe('Dashboard');

    // Nav icons must remain rendered
    const icons = container.querySelectorAll('.sidebar-nav-icon');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('should toggle collapsed state on desktop (> 768px) and toggle mobile drawer on mobile (<= 768px)', () => {
    // Mock desktop viewport (> 768px)
    window.innerWidth = 1024;

    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <BrandingProvider>
            <ToastProvider>
              <AppLayout />
            </ToastProvider>
          </BrandingProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const toggleBtn = screen.getByTitle('Kecilkan Menu Navigasi (Collapse)');
    expect(toggleBtn).toBeDefined();

    const aside = container.querySelector('aside.sidebar');
    expect(aside?.classList.contains('collapsed')).toBe(false);

    // Click toggle on desktop -> should collapse
    fireEvent.click(toggleBtn);
    expect(aside?.classList.contains('collapsed')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    // Click toggle again on desktop -> should expand back
    fireEvent.click(toggleBtn);
    expect(aside?.classList.contains('collapsed')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

    // Switch to mobile viewport (<= 768px)
    window.innerWidth = 500;
    fireEvent(window, new Event('resize'));

    // Click toggle on mobile -> should open mobile drawer
    fireEvent.click(toggleBtn);
    expect(aside?.classList.contains('open')).toBe(true);
    expect(container.querySelector('.sidebar-backdrop')).toBeDefined();

    // Click backdrop -> should close mobile drawer
    const backdrop = container.querySelector('.sidebar-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(aside?.classList.contains('open')).toBe(false);
  });
});
