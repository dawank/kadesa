import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import {
  PASSWORD_PLACEHOLDER,
  PASSWORD_CONFIRM_MISMATCH_MESSAGE,
  validatePasswordLength,
} from '../../types/auth';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const val = validatePasswordLength(newPassword, 'Kata sandi baru');
    if (!val.isValid) {
      setErrorMsg(val.message!);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(PASSWORD_CONFIRM_MISMATCH_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    const res = await authService.resetPassword('demo-token', newPassword);
    setIsSubmitting(false);

    if (res.success) {
      alert('Kata sandi berhasil diatur ulang. Silakan login kembali.');
      navigate('/login');
    } else {
      setErrorMsg(res.message || 'Gagal mengatur ulang kata sandi');
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
          Atur Ulang Kata Sandi
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Masukkan kata sandi baru untuk akun aparatur desa Anda.
        </p>

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
            <label className="form-label" htmlFor="reset-new-password">
              <Lock size={14} /> Kata Sandi Baru
            </label>
            <input
              id="reset-new-password"
              type="password"
              className="form-input"
              placeholder={PASSWORD_PLACEHOLDER}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reset-confirm-password">
              <Lock size={14} /> Konfirmasi Kata Sandi Baru
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              className="form-input"
              placeholder="Ketik ulang kata sandi baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isSubmitting}
          >
            <CheckCircle2 size={16} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>
      </div>
    </div>
  );
};
