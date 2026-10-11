import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
  LayoutDashboard,
  Clock,
  Eye,
  Briefcase,
  FileText,
  Calendar,
  Building2,
  Users,
  Award,
  BarChart3,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean; // legacy compatibility
  isMobileOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void; // legacy compatibility
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  isMobileOpen,
  isCollapsed = false,
  onClose,
  onCloseMobile,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const { logo, villageName } = useBranding();

  const role = currentUser?.role;
  const mobileOpen = isMobileOpen ?? isOpen;
  const closeMobile = onCloseMobile ?? onClose ?? (() => {});

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        closeMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, closeMobile]);

  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      closeMobile();
    }
  };

  return (
    <aside
      className={`sidebar ${mobileOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
      aria-label="Navigasi Utama"
    >
      <div className="sidebar-header">
        <img
          src="/logo-kadesa.png"
          alt="Logo Aplikasi KADESA"
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            objectFit: 'contain',
            backgroundColor: '#ffffff',
            padding: 2,
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0,
          }}
        />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">KADESA</span>
          <span className="sidebar-brand-sub">Sistem Kehadiran Aparatur</span>
        </div>
        <button
          type="button"
          className="sidebar-close-mobile-btn"
          onClick={closeMobile}
          aria-label="Tutup Menu Navigasi"
          title="Tutup Menu Navigasi"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Menu Utama</div>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={handleNavClick}
          title="Dashboard"
          data-tooltip="Dashboard"
        >
          <LayoutDashboard size={20} className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Dashboard</span>
        </NavLink>

        {/* Regular Attendance (for subjects of attendance, not super admin) */}
        {role !== 'SUPER_ADMIN' && (
          <NavLink
            to="/attendance/regular"
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            title="Presensi Reguler"
            data-tooltip="Presensi Reguler"
          >
            <Clock size={20} className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Presensi Reguler</span>
          </NavLink>
        )}

        {/* Attendance Monitoring */}
        {hasPermission('monitor_attendance') && (
          <NavLink
            to="/attendance/monitoring"
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            title="Monitoring Presensi"
            data-tooltip="Monitoring Presensi"
          >
            <Eye size={20} className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Monitoring Presensi</span>
          </NavLink>
        )}

        <div className="sidebar-section-title">Tugas & Ketidakhadiran</div>
        <NavLink
          to="/dl"
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={handleNavClick}
          title="Dinas Luar (DL)"
          data-tooltip="Dinas Luar (DL)"
        >
          <Briefcase size={20} className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Dinas Luar (DL)</span>
        </NavLink>

        <NavLink
          to="/absence/izin-sakit"
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={handleNavClick}
          title="Izin & Sakit"
          data-tooltip="Izin & Sakit"
        >
          <FileText size={20} className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Izin & Sakit</span>
        </NavLink>

        <NavLink
          to="/absence/cuti"
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={handleNavClick}
          title="Pengajuan Cuti"
          data-tooltip="Pengajuan Cuti"
        >
          <Calendar size={20} className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Pengajuan Cuti</span>
        </NavLink>

        {/* Master Data Section - Disembunyikan untuk Role Perangkat Desa */}
        {role !== 'PERANGKAT_DESA' && hasPermission('view_master_desa') && (
          <>
            <div className="sidebar-section-title">Master Data Desa</div>
            <NavLink
              to="/master/desa"
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
              title="Profil Desa"
              data-tooltip="Profil Desa"
            >
              <Building2 size={20} className="sidebar-nav-icon" />
              <span className="sidebar-nav-text">Profil Desa</span>
            </NavLink>

            {hasPermission('view_master_aparatur') && (
              <NavLink
                to="/master/aparatur"
                className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
                onClick={handleNavClick}
                title="Perangkat Desa"
                data-tooltip="Perangkat Desa"
              >
                <Users size={20} className="sidebar-nav-icon" />
                <span className="sidebar-nav-text">Perangkat Desa</span>
              </NavLink>
            )}

            {hasPermission('view_master_jabatan') && (
              <NavLink
                to="/master/jabatan"
                className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
                onClick={handleNavClick}
                title="Master Jabatan"
                data-tooltip="Master Jabatan"
              >
                <Award size={20} className="sidebar-nav-icon" />
                <span className="sidebar-nav-text">Master Jabatan</span>
              </NavLink>
            )}
          </>
        )}

        <div className="sidebar-section-title">Administrasi & Sistem</div>
        <NavLink
          to="/reports"
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={handleNavClick}
          title="Laporan Kehadiran"
          data-tooltip="Laporan Kehadiran"
        >
          <BarChart3 size={20} className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Laporan Kehadiran</span>
        </NavLink>

        {hasPermission('manage_settings') && (
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            title="Pengaturan Sistem"
            data-tooltip="Pengaturan Sistem"
          >
            <Settings size={20} className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Pengaturan Sistem</span>
          </NavLink>
        )}

        {hasPermission('view_audit_logs') && (
          <NavLink
            to="/audit"
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            title="Audit Log & Keamanan"
            data-tooltip="Audit Log & Keamanan"
          >
            <Shield size={20} className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Audit Log & Keamanan</span>
          </NavLink>
        )}

        <NavLink
          to="/profile"
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={handleNavClick}
          title="Profil Pengguna"
          data-tooltip="Profil Pengguna"
        >
          <User size={20} className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Profil Pengguna</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center' }}>
          KADESA v1.0.0-MVP • Production Ready Target
        </div>
      </div>
    </aside>
  );
};
