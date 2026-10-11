import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, PermissionAction } from '../types/auth';
import { authService } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { IS_DEMO_MODE } from '../services/apiClient';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  hasPermission: (action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (mounted) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('Failed to load user', err);
        if (mounted) {
          setCurrentUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Dengarkan perubahan state autentikasi Supabase secara real-time
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT' || !session) {
          setCurrentUser(null);
          setIsLoading(false);
        } else if (session?.user) {
          // JANGAN panggil getSession() di dalam callback onAuthStateChange untuk menghindari deadlock navigator.locks di browser.
          // Gunakan session.user.id langsung untuk memuat profil aparatur desa.
          try {
            const user = await authService.getProfileByAuthUserId(session.user.id, session.access_token);
            if (mounted && user) {
              setCurrentUser(user);
            }
          } catch (err) {
            console.error('KADESA: Gagal memuat profil saat perubahan sesi auth:', err);
          } finally {
            if (mounted) setIsLoading(false);
          }
        }
      });
      authListener = { subscription: data.subscription };
    }

    return () => {
      mounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = useCallback(async (username: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login(username, pass);
      if (res.success && res.data) {
        setCurrentUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Terjadi kesalahan sistem saat autentikasi.' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
  }, []);

  const switchRole = useCallback(async (role: UserRole) => {
    setIsLoading(true);
    try {
      const user = await authService.switchRole(role);
      setCurrentUser(user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchUser = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const user = await authService.switchUser(userId);
      setCurrentUser(user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasPermission = useCallback(
    (action: PermissionAction): boolean => {
      if (!currentUser) return false;
      return authService.hasPermission(currentUser.role, action);
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        logout,
        switchRole,
        switchUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
