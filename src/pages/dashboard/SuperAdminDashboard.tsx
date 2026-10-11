import React, { useState, useEffect } from 'react';
import { auditService } from '../../services/auditService';
import { settingsService } from '../../services/settingsService';
import { masterService } from '../../services/masterService';
import { checkDatabaseConnection } from '../../services/supabaseClient';
import { SecurityEventItem } from '../../types/audit';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Server,
  Settings,
  ShieldAlert,
  Database,
  Building2,
  Users,
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);
  const [apparatusCount, setApparatusCount] = useState<number>(0);
  const [settingsCount, setSettingsCount] = useState<number>(0);
  const [dbStatus, setDbStatus] = useState<{
    status: 'CHECKING' | 'CONNECTED' | 'UNCONFIGURED' | 'RLS_RESTRICTED' | 'ERROR';
    latencyMs?: number;
    message?: string;
  }>({ status: 'CHECKING' });

  useEffect(() => {
    checkDatabaseConnection().then((res) => {
      setDbStatus(res);
    });
    auditService.getSecurityEvents().then((res) => {
      if (res.data) setSecurityEvents(res.data);
    });
    masterService.getApparatusList().then((res) => {
      if (res.data) setApparatusCount(res.data.length);
    });
    settingsService.getAllSettings().then((res) => {
      if (res.data) setSettingsCount(res.data.length);
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard Super Administrator</h1>
          <p>Pusat Pengawasan Sistem, Keamanan & Integritas Data Aplikasi KADESA</p>
        </div>
        <div className="page-actions">
          <Link to="/audit" className="btn btn-secondary">
            <ShieldCheck size={16} /> Audit Log Lengkap
          </Link>
          <Link to="/settings" className="btn btn-primary">
            <Settings size={16} /> Pengaturan Parameter Sistem
          </Link>
        </div>
      </div>

      {/* Deployment & Architecture Badge */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          color: '#ffffff',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Server size={18} color="#34d399" />
              <strong style={{ fontSize: '0.9375rem', color: '#f8fafc' }}>
                Arsitektur Deployment: 1 Deployment = 1 Desa (Desa Sukamaju)
              </strong>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>
              Database PostgreSQL Target • Server Official Time Sync • RLS Isolation Active
            </p>
          </div>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor:
                dbStatus.status === 'CONNECTED'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : dbStatus.status === 'CHECKING'
                  ? 'rgba(100, 116, 139, 0.2)'
                  : 'rgba(239, 68, 68, 0.2)',
              color:
                dbStatus.status === 'CONNECTED'
                  ? '#34d399'
                  : dbStatus.status === 'CHECKING'
                  ? '#94a3b8'
                  : '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: `1px solid ${
                dbStatus.status === 'CONNECTED'
                  ? 'rgba(16, 185, 129, 0.4)'
                  : dbStatus.status === 'CHECKING'
                  ? 'rgba(100, 116, 139, 0.4)'
                  : 'rgba(239, 68, 68, 0.4)'
              }`,
            }}
          >
            {dbStatus.status === 'CONNECTED'
              ? 'STATUS SISTEM SEHAT'
              : dbStatus.status === 'CHECKING'
              ? 'MEMERIKSA SISTEM...'
              : 'PERINGATAN KONEKSI'}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Aparatur Terdaftar</div>
            <div className="stat-value">{apparatusCount}</div>
            <div className="stat-subtext">Akun aparatur desa aktif</div>
          </div>
          <div className="stat-icon stat-icon-blue">
            <Users size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Security Events</div>
            <div className="stat-value" style={{ color: securityEvents.length > 0 ? '#dc2626' : 'var(--color-primary-700)' }}>
              {securityEvents.length}
            </div>
            <div className="stat-subtext">Peringatan anomali lokasi</div>
          </div>
          <div className="stat-icon stat-icon-rose">
            <ShieldAlert size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Konfigurasi Aktif</div>
            <div className="stat-value">{settingsCount}</div>
            <div className="stat-subtext">Parameter operasional desa</div>
          </div>
          <div className="stat-icon stat-icon-purple">
            <Settings size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Koneksi Database</div>
            <div
              className="stat-value"
              style={{
                color:
                  dbStatus.status === 'CONNECTED'
                    ? '#059669'
                    : dbStatus.status === 'CHECKING'
                    ? '#64748b'
                    : dbStatus.status === 'UNCONFIGURED'
                    ? '#f59e0b'
                    : '#dc2626',
                fontSize: '1.15rem',
              }}
            >
              {dbStatus.status === 'CONNECTED'
                ? `ONLINE (${dbStatus.latencyMs}ms)`
                : dbStatus.status === 'CHECKING'
                ? 'MEMERIKSA...'
                : dbStatus.status === 'UNCONFIGURED'
                ? 'BELUM TERPASANG'
                : dbStatus.status === 'RLS_RESTRICTED'
                ? 'RLS TERKUNCI'
                : 'OFFLINE / GAGAL'}
            </div>
            <div className="stat-subtext">
              {dbStatus.status === 'CONNECTED'
                ? 'Kueri uji ke Supabase berhasil'
                : dbStatus.message || 'PostgreSQL / Supabase Target'}
            </div>
          </div>
          <div className="stat-icon stat-icon-emerald">
            <Database size={24} />
          </div>
        </div>
      </div>

      {/* Security Events Monitoring */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <ShieldAlert size={18} color="var(--color-accent-rose)" />
            Peringatan Keamanan & Anomali Lokasi Terbaru
          </h3>
          <Link to="/audit" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
            Lihat Semua Audit
          </Link>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tingkat (Severity)</th>
                <th>Jenis Peristiwa</th>
                <th>Aparatur Terkait</th>
                <th>Detail & Metadata</th>
                <th>Waktu Kejadian</th>
                <th>Status Review</th>
              </tr>
            </thead>
            <tbody>
              {securityEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Tidak ada peringatan keamanan atau anomali lokasi yang tercatat di database.
                  </td>
                </tr>
              ) : (
                securityEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span
                        className={`badge ${
                          ev.severity === 'CRITICAL' || ev.severity === 'HIGH'
                            ? 'badge-alpha'
                            : ev.severity === 'MEDIUM'
                            ? 'badge-terlambat'
                            : 'badge-libur'
                        }`}
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td>
                      <strong>{ev.eventType}</strong>
                    </td>
                    <td>{ev.actorNama}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {JSON.stringify(ev.metadata).slice(0, 70)}...
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {ev.createdAt.replace('T', ' ').slice(0, 16)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-verified">{ev.state}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
