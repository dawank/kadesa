import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PermissionAction } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionAction;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
}) => {
  const { currentUser, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#64748b',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: '3px solid #e2e8f0',
            borderTopColor: '#059669',
            borderRadius: '50%',
            animation: 'kadesaSpin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
          Memuat sesi aparatur desa...
        </p>
        <style>{`
          @keyframes kadesaSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
