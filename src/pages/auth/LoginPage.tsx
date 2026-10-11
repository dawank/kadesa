import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { Lock, User as UserIcon, Shield, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';
import { IS_DEMO_MODE } from '../../services/apiClient';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { User } from '../../types/auth';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isLoading, login } = useAuth();
  const { villageName, loginBackground } = useBranding();
  const [username, setUsername] = useState(IS_DEMO_MODE ? 'operator' : '');
  const [password, setPassword] = useState(IS_DEMO_MODE ? 'password123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (!isLoading && currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, isLoading, navigate]);

  const demoUsers = IS_DEMO_MODE ? authService.getDemoUsers().slice(0, 5) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim();
    const cleanPassword = password;

    if (!cleanUsername || !cleanPassword) {
      setErrorMessage('Username dan kata sandi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    let timeoutId: any = setTimeout(() => {
      setIsSubmitting(false);
      setErrorMessage('Waktu tunggu verifikasi habis (10 detik). Silakan coba lagi.');
    }, 10000);

    try {
      console.log('[KADESA AUTH] Memulai verifikasi login untuk:', cleanUsername);
      const res = await login(cleanUsername, cleanPassword);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.log('[KADESA AUTH] Hasil login:', res);

      if (res.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMessage(res.message || 'Login gagal.');
      }
    } catch (err: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error('[KADESA AUTH] Terjadi kesalahan saat login:', err);
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat memproses login.');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsSubmitting(false);
    }
  };

  const handleSelectDemoUser = (user: User) => {
    setUsername(user.username);
    setPassword('password123');
    setErrorMessage(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundImage: `url("${loginBackground}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        padding: 'clamp(0.75rem, 3vw, 1.5rem)',
        overflow: 'hidden',
      }}
    >
      {/* Dark & Vibrant Backdrop Overlay for Premium Aesthetics and Readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.84) 0%, rgba(10, 25, 47, 0.88) 100%)',
          backdropFilter: 'blur(3px)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b, #047857)',
            padding: 'clamp(1.25rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem) 1.25rem',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#ffffff',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            }}
          >
            <img
              src="/logo-kadesa.png"
              alt="Logo Aplikasi KADESA"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
            KADESA
          </h2>
          <p style={{ color: '#a7f3d0', fontSize: 'clamp(0.78rem, 2.5vw, 0.875rem)', margin: 0 }}>
            Sistem Kehadiran Aparatur {villageName}
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
          {!IS_DEMO_MODE && !isSupabaseConfigured() && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.8125rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>Koneksi Supabase belum terkonfigurasi di hosting (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY). Silakan periksa environment variable.</span>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.8125rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-username">
                <UserIcon size={14} /> Username
              </label>
              <input
                id="login-username"
                type="text"
                className="form-input"
                placeholder="Masukkan username Anda"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="login-password">
                  <Lock size={14} /> Kata Sandi
                </label>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', fontWeight: 600 }}
                >
                  Lupa Sandi?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Demo User Fast-Picker (Demo Mode Only) */}
          {IS_DEMO_MODE && demoUsers.length > 0 && (
            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <Shield size={14} color="var(--color-primary-600)" />
                Pilih Akun Demo untuk Pengujian:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {demoUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectDemoUser(user)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.375rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: username === user.username ? 'var(--color-primary-50)' : '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--color-slate-900)' }}>{user.nama}</strong>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>({user.jabatanNama})</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--color-primary-700)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 4,
                      }}
                    >
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Branding Info */}
      <div
        style={{
          marginTop: '1.25rem',
          color: '#e2e8f0',
          fontSize: '0.8125rem',
          textAlign: 'center',
          position: 'relative',
          zIndex: 2,
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        <span>Pemerintah {villageName} • Sistem Kehadiran KADESA v1.0</span>
      </div>
    </div>
  );
};
