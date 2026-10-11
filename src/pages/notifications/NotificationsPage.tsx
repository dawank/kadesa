import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { NotificationItem } from '../../types/notification';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
  Bell,
  CheckCheck,
  Briefcase,
  Calendar,
  FileText,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const loadNotifications = async () => {
    if (!currentUser) return;
    const res = await notificationService.getNotifications(currentUser.id);
    if (res.data) setNotifications(res.data);
  };

  useEffect(() => {
    loadNotifications();
  }, [currentUser]);

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    const res = await notificationService.markAllAsRead(currentUser.id);
    if (res.success) {
      showToast('Semua notifikasi ditandai telah dibaca', 'success');
      loadNotifications();
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    await notificationService.markAsRead(id);
    loadNotifications();
  };

  const filtered = filterUnreadOnly ? notifications.filter((n) => !n.readAt) : notifications;

  const getEntityLink = (notif: NotificationItem) => {
    switch (notif.referenceType) {
      case 'DL':
        return notif.referenceId ? `/dl/${notif.referenceId}` : '/dl';
      case 'LEAVE':
        return '/absence/cuti';
      case 'ABSENCE':
        return '/absence/izin-sakit';
      case 'CORRECTION':
        return '/attendance/monitoring';
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Notifikasi In-App</h1>
          <p>Pemberitahuan aktivitas alur kerja persetujuan dan kehadiran aparatur desa</p>
        </div>

        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={handleMarkAllRead}>
            <CheckCheck size={16} /> Tandai Semua Telah Dibaca
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterUnreadOnly}
              onChange={(e) => setFilterUnreadOnly(e.target.checked)}
            />
            <span>Tampilkan yang belum dibaca saja</span>
          </label>

          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Total: <strong>{filtered.length}</strong> Notifikasi
          </span>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={36} color="var(--color-slate-300)" style={{ margin: '0 auto 0.75rem' }} />
            <p>Tidak ada notifikasi baru untuk Anda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map((notif) => {
              const link = getEntityLink(notif);
              return (
                <div
                  key={notif.id}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: notif.readAt ? '#ffffff' : 'var(--color-primary-50)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: notif.readAt ? 'var(--color-slate-100)' : '#dcfce7',
                        color: notif.readAt ? 'var(--color-slate-500)' : '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {notif.referenceType === 'DL' ? (
                        <Briefcase size={18} />
                      ) : notif.referenceType === 'LEAVE' ? (
                        <Calendar size={18} />
                      ) : (
                        <Bell size={18} />
                      )}
                    </div>

                    <div>
                      <strong style={{ fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
                        {notif.title}
                      </strong>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', marginTop: 2, lineHeight: 1.4 }}>
                        {notif.body}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        {new Date(notif.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                    {link && (
                      <Link
                        to={link}
                        onClick={() => handleMarkSingleRead(notif.id)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Buka Item <ArrowRight size={12} />
                      </Link>
                    )}
                    {!notif.readAt && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                        onClick={() => handleMarkSingleRead(notif.id)}
                      >
                        Tandai dibaca
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
