import React, { useState, useEffect } from 'react';
import { auditService } from '../../services/auditService';
import { AuditLogItem, SecurityEventItem, AuditEventType } from '../../types/audit';
import { Modal } from '../../components/common/Modal';
import {
  Shield,
  Filter,
  Calendar,
  Eye,
  AlertTriangle,
  User,
  Loader2,
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'SECURITY'>('AUDIT');
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<AuditEventType | 'ALL'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (auditLogs.length === 0) setIsLoading(true);

    Promise.all([
      auditService.getAuditLogs({ eventType: eventTypeFilter }),
      auditService.getSecurityEvents(),
    ])
      .then(([resLogs, resSec]) => {
        if (!isMounted) return;
        if (resLogs.data) setAuditLogs(resLogs.data);
        if (resSec.data) setSecurityEvents(resSec.data);
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [eventTypeFilter]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Audit Trail & Peristiwa Keamanan</h1>
          <p>Rekam jejak seluruh aktivitas perubahan data dan keamanan sistem</p>
        </div>
      </div>


      {/* Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('AUDIT')}
            >
              <Shield size={14} /> Log Mutasi Sistem ({auditLogs.length})
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'SECURITY' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('SECURITY')}
            >
              <AlertTriangle size={14} /> Security Events ({securityEvents.length})
            </button>
          </div>

          {activeTab === 'AUDIT' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Jenis Mutasi:</label>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value as AuditEventType | 'ALL')}
              >
                <option value="ALL">Semua Peristiwa</option>
                <option value="LOGIN_SUCCESS">Login Berhasil</option>
                <option value="ATTENDANCE_CHECK_IN">Presensi Check-In</option>
                <option value="ATTENDANCE_CORRECTION">Koreksi Presensi</option>
                <option value="DL_APPROVED">DL Disetujui</option>
                <option value="SETTINGS_CHANGED">Perubahan Pengaturan</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      {activeTab === 'AUDIT' ? (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu (Server Timestamp)</th>
                  <th>Aktor (Pengguna)</th>
                  <th>Peran</th>
                  <th>Jenis Aksi</th>
                  <th>Entitas Target</th>
                  <th>Alasan / Keterangan</th>
                  <th style={{ textAlign: 'right' }}>Diff Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary-600)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat rekaman log audit sistem...</span>
                      </div>
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      Belum ada rekaman audit log untuk kriteria ini.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {log.createdAt.replace('T', ' ').slice(0, 19)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <User size={14} color="var(--text-muted)" />
                          <strong>{log.actorNama}</strong>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {log.actorRole.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: 'var(--color-primary-50)',
                            color: 'var(--color-primary-700)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 4,
                          }}
                        >
                          {log.eventType}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {log.entityType}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)' }}>
                          {log.reason || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye size={12} /> Lihat Data
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Security Events Table */
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tingkat Bahaya</th>
                  <th>Jenis Security Event</th>
                  <th>Aktor Terlibat</th>
                  <th>Data Anomali / Metadata</th>
                  <th>Status Review</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && securityEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary-600)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat daftar peristiwa keamanan...</span>
                      </div>
                    </td>
                  </tr>
                ) : securityEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      Belum ada peristiwa keamanan yang tercatat.
                    </td>
                  </tr>
                ) : (
                  securityEvents.map((sec) => (
                    <tr key={sec.id}>
                      <td>
                        <span
                          className={`badge ${
                            sec.severity === 'CRITICAL' || sec.severity === 'HIGH'
                              ? 'badge-alpha'
                              : 'badge-terlambat'
                          }`}
                        >
                          {sec.severity}
                        </span>
                      </td>
                      <td><strong>{sec.eventType}</strong></td>
                      <td>{sec.actorNama}</td>
                      <td>
                        <pre
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            margin: 0,
                            color: 'var(--color-slate-700)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {JSON.stringify(sec.metadata, null, 2)}
                        </pre>
                      </td>
                      <td>
                        <span className="badge badge-verified">{sec.state}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {sec.createdAt.replace('T', ' ').slice(0, 16)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Diff Before vs After */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Detail Perubahan — ${selectedLog.eventType}`}
          size="lg"
          footer={
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
              Tutup
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="form-grid-2">
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Aktor</span>
                <div style={{ fontWeight: 700 }}>
                  {selectedLog.actorNama} ({selectedLog.actorRole})
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Waktu Eksekusi</span>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{selectedLog.createdAt}</div>
              </div>
            </div>

            {selectedLog.reason && (
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                <strong>Alasan / Dasar Perubahan:</strong>
                <p style={{ marginTop: 2, color: 'var(--color-slate-700)' }}>{selectedLog.reason}</p>
              </div>
            )}

            {/* Side-by-side JSON Diff View */}
            <div className="form-grid-2">
              <div style={{ backgroundColor: '#fff1f2', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ color: '#9f1239', fontSize: '0.75rem' }}>DATA SEBELUM (BEFORE):</strong>
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: '#881337',
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    overflowX: 'auto',
                  }}
                >
                  {selectedLog.beforeData ? JSON.stringify(selectedLog.beforeData, null, 2) : '(Data Baru / Null)'}
                </pre>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ color: '#166534', fontSize: '0.75rem' }}>DATA SESUDAH (AFTER):</strong>
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: '#14532d',
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    overflowX: 'auto',
                  }}
                >
                  {selectedLog.afterData ? JSON.stringify(selectedLog.afterData, null, 2) : '(Null / Dihapus)'}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
