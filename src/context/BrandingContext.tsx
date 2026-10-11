import React, { createContext, useContext, useState, useEffect } from 'react';
import { masterService } from '../services/masterService';
import { settingsService } from '../services/settingsService';
import { LetterheadConfig, DEFAULT_LETTERHEAD_CONFIG } from '../types/settings';

export const DEFAULT_VILLAGE_LOGO = '/logo-kadesa.png';
export const DEFAULT_LOGIN_BACKGROUND = 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80';

interface BrandingContextType {
  logo: string;
  villageName: string;
  loginBackground: string;
  letterheadConfig: LetterheadConfig;
  updateVillageLogo: (newLogo: string) => Promise<boolean>;
  removeVillageLogo: () => Promise<boolean>;
  updateLoginBackground: (newBg: string, updatedBy?: string) => Promise<boolean>;
  resetLoginBackground: (updatedBy?: string) => Promise<boolean>;
  updateLetterheadConfig: (config: LetterheadConfig, updatedBy?: string) => Promise<boolean>;
  resetLetterheadConfig: (updatedBy?: string) => Promise<boolean>;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logo, setLogo] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kadesa_village_logo') || DEFAULT_VILLAGE_LOGO;
    }
    return DEFAULT_VILLAGE_LOGO;
  });

  const [villageName, setVillageName] = useState<string>('Desa Sukamaju');

  const [loginBackground, setLoginBackground] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kadesa_login_bg') || DEFAULT_LOGIN_BACKGROUND;
    }
    return DEFAULT_LOGIN_BACKGROUND;
  });

  const [letterheadConfig, setLetterheadConfig] = useState<LetterheadConfig>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('kadesa_letterhead_config');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    return DEFAULT_LETTERHEAD_CONFIG;
  });

  const refreshBranding = async () => {
    try {
      const vRes = await masterService.getVillage();
      if (vRes.data) {
        if (vRes.data.logo) {
          setLogo(vRes.data.logo);
          if (typeof window !== 'undefined') {
            localStorage.setItem('kadesa_village_logo', vRes.data.logo);
          }
        }
        if (vRes.data.nama) {
          setVillageName(vRes.data.nama);
        }
      }

      const bg = await settingsService.getLoginBackground();
      if (bg) {
        setLoginBackground(bg);
      }

      const lh = await settingsService.getLetterheadConfig();
      if (lh) {
        setLetterheadConfig(lh);
      }
    } catch {
      // Ignore errors on initial load
    }
  };

  useEffect(() => {
    refreshBranding();

    const handleBrandingChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        logo?: string;
        loginBackground?: string;
        letterheadConfig?: LetterheadConfig;
      }>;
      if (customEvent.detail?.logo) {
        setLogo(customEvent.detail.logo);
      }
      if (customEvent.detail?.loginBackground) {
        setLoginBackground(customEvent.detail.loginBackground);
      }
      if (customEvent.detail?.letterheadConfig) {
        setLetterheadConfig(customEvent.detail.letterheadConfig);
      }
      refreshBranding();
    };

    window.addEventListener('kadesa-branding-changed', handleBrandingChanged);
    return () => {
      window.removeEventListener('kadesa-branding-changed', handleBrandingChanged);
    };
  }, []);

  const handleUpdateLogo = async (newLogo: string): Promise<boolean> => {
    const res = await masterService.updateVillageLogo(newLogo);
    if (res.success && res.data) {
      setLogo(res.data);
      return true;
    }
    return false;
  };

  const handleRemoveLogo = async (): Promise<boolean> => {
    const res = await masterService.removeVillageLogo();
    if (res.success) {
      setLogo(DEFAULT_VILLAGE_LOGO);
      return true;
    }
    return false;
  };

  const handleUpdateLoginBackground = async (newBg: string, updatedBy?: string): Promise<boolean> => {
    const res = await settingsService.updateLoginBackground(newBg, updatedBy);
    if (res.success && res.data) {
      setLoginBackground(res.data);
      return true;
    }
    return false;
  };

  const handleResetLoginBackground = async (updatedBy?: string): Promise<boolean> => {
    const res = await settingsService.resetLoginBackground(updatedBy);
    if (res.success) {
      setLoginBackground(DEFAULT_LOGIN_BACKGROUND);
      return true;
    }
    return false;
  };

  const handleUpdateLetterheadConfig = async (
    config: LetterheadConfig,
    updatedBy?: string
  ): Promise<boolean> => {
    const res = await settingsService.updateLetterheadConfig(config, updatedBy);
    if (res.success && res.data) {
      setLetterheadConfig(res.data);
      return true;
    }
    return false;
  };

  const handleResetLetterheadConfig = async (updatedBy?: string): Promise<boolean> => {
    const res = await settingsService.resetLetterheadConfig(updatedBy);
    if (res.success && res.data) {
      setLetterheadConfig(res.data);
      return true;
    }
    return false;
  };

  return (
    <BrandingContext.Provider
      value={{
        logo,
        villageName,
        loginBackground,
        letterheadConfig,
        updateVillageLogo: handleUpdateLogo,
        removeVillageLogo: handleRemoveLogo,
        updateLoginBackground: handleUpdateLoginBackground,
        resetLoginBackground: handleResetLoginBackground,
        updateLetterheadConfig: handleUpdateLetterheadConfig,
        resetLetterheadConfig: handleResetLetterheadConfig,
        refreshBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      logo: (typeof window !== 'undefined' && localStorage.getItem('kadesa_village_logo')) || DEFAULT_VILLAGE_LOGO,
      villageName: 'Desa Sukamaju',
      loginBackground: (typeof window !== 'undefined' && localStorage.getItem('kadesa_login_bg')) || DEFAULT_LOGIN_BACKGROUND,
      letterheadConfig: DEFAULT_LETTERHEAD_CONFIG,
      updateVillageLogo: async () => false,
      removeVillageLogo: async () => false,
      updateLoginBackground: async () => false,
      resetLoginBackground: async () => false,
      updateLetterheadConfig: async () => false,
      resetLetterheadConfig: async () => false,
      refreshBranding: async () => {},
    };
  }
  return context;
};
