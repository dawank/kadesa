import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { Bell, LogOut, Menu, User as UserIcon } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { NotificationItem } from '../../types/notification';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface NavbarProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarCollapsed = false }) => {
  const { currentUser, logout } = useAuth();
  const { logo, villageName } = useBranding();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      notificationService.getNotifications(currentUser.id).then((res) => {
        if (res.data) setNotifications(res.data);
      });
    }
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleLogout = async () => {
    await logout();
    setIsLogoutDialogOpen(false);
    navigate('/login');
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-toggle-btn"
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Perluas Menu Navigasi' : 'Kecilkan Menu Navigasi'}
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? 'Perluas Menu Navigasi (Expand)' : 'Kecilkan Menu Navigasi (Collapse)'}
          >
            <Menu size={20} />
          </button>
          <img
            src="/logo-kadesa.png"
            alt="Logo Aplikasi KADESA"
            style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
          />
          <div className="topbar-brand-wrap">
            <span className="topbar-brand-title desktop-only-text">
              Pemerintah {villageName}
            </span>
            <span className="topbar-brand-title mobile-only-text">
              Pemdes {villageName.replace('Desa ', '')}
            </span>
            <span className="topbar-location-subtitle" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Kec. Cibinong, Kab. Bogor, Jawa Barat
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {/* Notifications Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="topbar-btn"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              aria-label="Buka Notifikasi"
              title="Notifikasi"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: 'var(--color-accent-rose)',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 45,
                  right: 0,
                  width: 320,
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-xl)',
                  border: '1px solid var(--border-subtle)',
                  zIndex: 60,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <strong style={{ fontSize: '0.875rem' }}>Notifikasi In-App</strong>
                  <Link
                    to="/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)' }}
                  >
                    Lihat Semua
                  </Link>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      Belum ada notifikasi baru
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: n.readAt ? '#ffffff' : 'var(--color-primary-50)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{n.title}</div>
                        <div style={{ color: 'var(--color-slate-600)', fontSize: '0.75rem', marginTop: 2 }}>{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Current User Quick Info */}
          <Link
            to="/profile"
            className="topbar-avatar-link"
            title={`Profil: ${currentUser?.nama}`}
          >
            {currentUser?.fotoReference ? (
              <img
                src={currentUser.fotoReference}
                alt={currentUser.nama}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-100)',
                  color: 'var(--color-primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UserIcon size={17} />
              </div>
            )}
            <div className="topbar-user-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                {currentUser?.nama}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {currentUser?.jabatanNama} ({currentUser?.role.replace('_', ' ')})
              </span>
            </div>
          </Link>

          {/* Logout Button */}
          <button
            type="button"
            className="topbar-btn"
            onClick={() => setIsLogoutDialogOpen(true)}
            style={{ color: 'var(--color-accent-rose)' }}
            title="Keluar dari Akun"
            aria-label="Keluar dari Akun"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <ConfirmDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={handleLogout}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari sesi aplikasi KADESA saat ini?"
        confirmLabel="Ya, Keluar"
        isDestructive={true}
      />
    </>
  );
};
