import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [credential, setCredential] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!credential.trim()) {
      setErrorMsg('Masukkan username atau nomor WhatsApp terdaftar');
      return;
    }

    setIsSubmitting(true);
    const res = await authService.forgotPassword(credential);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(res.message || 'Tautan reset telah dikirim.');
    } else {
      setErrorMsg(res.message || 'Gagal mengirim permintaan reset.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a192f',
        padding: 'clamp(0.75rem, 3vw, 1.5rem)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          padding: 'clamp(1rem, 4vw, 2rem)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <Link
          to="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8125rem',
            color: 'var(--color-primary-700)',
            marginBottom: '1.25rem',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> Kembali ke Halaman Login
        </Link>

        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
          Lupa Kata Sandi
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Masukkan Username atau Nomor WhatsApp Anda. Tautan pemulihan kata sandi akan dikirimkan sesuai kebijakan aplikasi.
        </p>

        {successMsg && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-md)',
              color: '#065f46',
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              color: '#991b1b',
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-credential">
              Username atau WhatsApp
            </label>
            <input
              id="forgot-credential"
              type="text"
              className="form-input"
              placeholder="Contoh: operator atau 08123456789"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isSubmitting}
          >
            <Send size={16} /> {isSubmitting ? 'Mengirimkan...' : 'Kirim Instruksi Reset'}
          </button>
        </form>
      </div>
    </div>
  );
};
