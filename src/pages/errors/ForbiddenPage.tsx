import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div
      style={{
        minHeight: '65vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <ShieldX size={36} />
      </div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
        403 — Akses Ditolak (Forbidden)
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 480, fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
        Anda masuk sebagai <strong>{currentUser?.nama}</strong> dengan peran{' '}
        <strong>{currentUser?.role.replace('_', ' ')}</strong>. Halaman atau aksi ini memerlukan kewenangan yang tidak
        dimiliki oleh peran Anda menurut matriks permission resmi KADESA.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        <ArrowLeft size={16} /> Kembali ke Dashboard
      </Link>
    </div>
  );
};
