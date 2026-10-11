import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { BrandingProvider } from './context/BrandingContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
import { PresensiRegulerPage } from './pages/attendance/PresensiRegulerPage';
import { MonitoringPresensiPage } from './pages/attendance/MonitoringPresensiPage';
import { DinasLuarListPage } from './pages/dl/DinasLuarListPage';
import { DinasLuarCreatePage } from './pages/dl/DinasLuarCreatePage';
import { DinasLuarDetailPage } from './pages/dl/DinasLuarDetailPage';
import { DinasLuarPresensiPage } from './pages/dl/DinasLuarPresensiPage';
import { IzinSakitPage } from './pages/absence/IzinSakitPage';
import { CutiPage } from './pages/absence/CutiPage';
import { MasterDesaPage } from './pages/master/MasterDesaPage';
import { MasterAparaturPage } from './pages/master/MasterAparaturPage';
import { MasterJabatanPage } from './pages/master/MasterJabatanPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SystemSettingsPage } from './pages/settings/SystemSettingsPage';
import { AuditLogPage } from './pages/audit/AuditLogPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { ForbiddenPage } from './pages/errors/ForbiddenPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrandingProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Authenticated Application Shell */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardRouter />} />

              {/* Attendance */}
              <Route
                path="attendance/regular"
                element={
                  <ProtectedRoute requiredPermission="regular_attendance">
                    <PresensiRegulerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="attendance/monitoring"
                element={
                  <ProtectedRoute requiredPermission="monitor_attendance">
                    <MonitoringPresensiPage />
                  </ProtectedRoute>
                }
              />

              {/* Dinas Luar */}
              <Route path="dl" element={<DinasLuarListPage />} />
              <Route path="dl/create" element={<DinasLuarCreatePage />} />
              <Route path="dl/:id" element={<DinasLuarDetailPage />} />
              <Route path="dl/presensi/:id" element={<DinasLuarPresensiPage />} />

              {/* Absences & Leave */}
              <Route path="absence/izin-sakit" element={<IzinSakitPage />} />
              <Route path="absence/cuti" element={<CutiPage />} />

              {/* Master Data */}
              <Route
                path="master/desa"
                element={
                  <ProtectedRoute requiredPermission="view_master_desa">
                    <MasterDesaPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="master/aparatur"
                element={
                  <ProtectedRoute requiredPermission="view_master_aparatur">
                    <MasterAparaturPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="master/jabatan"
                element={
                  <ProtectedRoute requiredPermission="view_master_jabatan">
                    <MasterJabatanPage />
                  </ProtectedRoute>
                }
              />

              {/* Reports */}
              <Route path="reports" element={<ReportsPage />} />

              {/* Settings */}
              <Route
                path="settings"
                element={
                  <ProtectedRoute requiredPermission="manage_settings">
                    <SystemSettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Audit */}
              <Route
                path="audit"
                element={
                  <ProtectedRoute requiredPermission="view_audit_logs">
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />

              {/* Profile & Notifications */}
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />

              {/* Errors & Access Denied */}
              <Route path="forbidden" element={<ForbiddenPage />} />
            </Route>

            {/* 404 Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </BrandingProvider>
  </AuthProvider>
  );
};

export default App;
