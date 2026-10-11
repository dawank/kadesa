import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { ShieldAlert, UserCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { IS_DEMO_MODE } from '../../services/apiClient';

export const DemoModeBanner: React.FC = () => {
  if (!IS_DEMO_MODE) {
    return null;
  }

  const { currentUser, switchRole } = useAuth();
  const { showToast } = useToast();

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as UserRole;
    await switchRole(newRole);
    showToast(`Beralih ke Role: ${newRole.replace('_', ' ')}`, 'info');
  };

  return (
    <div className="demo-banner">
      <div className="demo-banner-content">
        <ShieldAlert size={16} color="#34d399" style={{ flexShrink: 0 }} />
        <span>
          <strong className="desktop-only-text" style={{ fontSize: '0.8rem' }}>MODE DEMO:</strong>
          <strong className="mobile-only-text" style={{ fontSize: '0.725rem', color: '#34d399' }}>DEMO</strong>
          <span className="demo-banner-subtext"> Data simulasi interaktif pratinjau sistem.</span>
        </span>
      </div>
      <div className="demo-role-selector">
        <UserCheck size={14} color="#94a3b8" className="demo-role-selector-label" />
        <span className="demo-role-selector-label" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Simulasi Role:</span>
        <select
          className="demo-role-select"
          value={currentUser?.role || 'OPERATOR_DESA'}
          onChange={handleRoleChange}
          aria-label="Pilih Role Pengguna untuk Pengujian"
        >
          <option value="SUPER_ADMIN">1. Super Admin (Budi Santoso)</option>
          <option value="OPERATOR_DESA">2. Operator Desa / Admin Desa (Siti Rahmawati)</option>
          <option value="KEPALA_DESA">3. Kepala Desa (Drs. H. Ahmad Dahlan)</option>
          <option value="SEKRETARIS_DESA">4. Sekretaris Desa (Bambang Wijaya)</option>
          <option value="PERANGKAT_DESA">5. Perangkat Desa (Dewi Lestari)</option>
        </select>
      </div>
    </div>
  );
};
