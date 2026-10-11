import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { DemoModeBanner } from '../common/DemoModeBanner';
import { ToastContainer } from '../common/Toast';
import { ErrorBoundary } from '../common/ErrorBoundary';

export const AppLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-close mobile drawer when window viewport crosses above 768px
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth > 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }, []);

  const handleCloseMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return (
    <div className="app-container">
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={handleCloseMobile}
          aria-label="Tutup navigasi samping"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') handleCloseMobile();
          }}
        />
      )}
      <Sidebar
        isMobileOpen={isMobileOpen}
        isCollapsed={isCollapsed}
        onCloseMobile={handleCloseMobile}
      />
      <div className="main-wrapper">
        <DemoModeBanner />
        <Navbar
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isCollapsed}
        />
        <main className="content-area">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
