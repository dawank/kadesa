import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { authService } from '../services/authService';

describe('ProtectedRoute & Authentication Guard Tests', () => {
  beforeEach(async () => {
    await authService.logout();
  });

  it('should redirect unauthenticated users away from protected route to /login', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Halaman Login KADESA</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Halaman Dashboard Rahasia</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Saat memuat, indikator loading tampil
    expect(screen.queryByText('Halaman Dashboard Rahasia')).toBeNull();

    // Setelah pemuatan sesi selesai tanpa kredensial, wajib redirect ke /login
    await waitFor(() => {
      expect(screen.getByText('Halaman Login KADESA')).toBeDefined();
    });

    // Pastikan dashboard rahasia TIDAK pernah dirender
    expect(screen.queryByText('Halaman Dashboard Rahasia')).toBeNull();
  });

  it('should permit authenticated user to view protected route', async () => {
    // Login terlebih dahulu
    await authService.login('operator', 'password123');

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Halaman Login KADESA</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Halaman Dashboard Sah</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Halaman Dashboard Sah')).toBeDefined();
    });

    expect(screen.queryByText('Halaman Login KADESA')).toBeNull();
  });
});
