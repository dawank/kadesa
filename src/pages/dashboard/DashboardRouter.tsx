import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PerangkatDashboard } from './PerangkatDashboard';
import { OperatorDashboard } from './OperatorDashboard';
import { KadesSekdesDashboard } from './KadesSekdesDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';

export const DashboardRouter: React.FC = () => {
  const { currentUser } = useAuth();

  switch (currentUser?.role) {
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard />;
    case 'OPERATOR_DESA':
      return <OperatorDashboard />;
    case 'KEPALA_DESA':
    case 'SEKRETARIS_DESA':
      return <KadesSekdesDashboard />;
    case 'PERANGKAT_DESA':
    default:
      return <PerangkatDashboard />;
  }
};
