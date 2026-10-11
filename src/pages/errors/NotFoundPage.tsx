import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
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
          backgroundColor: 'var(--color-slate-100)',
          color: 'var(--color-slate-400)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <HelpCircle size={36} />
      </div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
        404 — Halaman Tidak Ditemukan
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 440, fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
        Tautan yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        <ArrowLeft size={16} /> Kembali ke Beranda
      </Link>
    </div>
  );
};
