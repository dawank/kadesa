import { describe, it, expect, beforeEach } from 'vitest';
import { masterService } from '../services/masterService';
import { settingsService } from '../services/settingsService';

describe('Branding, Village Logo & Login Background Tests', () => {
  beforeEach(async () => {
    // Reset to defaults
    await masterService.removeVillageLogo();
    await settingsService.resetLoginBackground('System Test');
  });

  it('should retrieve default village logo and login background', async () => {
    const vRes = await masterService.getVillage();
    expect(vRes.success).toBe(true);
    expect(vRes.data?.logo).toBe('/logo-kadesa.png');

    const bg = await settingsService.getLoginBackground();
    expect(bg).toContain('images.unsplash.com');
  });

  it('should overwrite village logo with new uploaded logo and allow reset', async () => {
    const mockNewLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    // Update / overwrite
    const updateRes = await masterService.updateVillageLogo(mockNewLogo);
    expect(updateRes.success).toBe(true);
    expect(updateRes.data).toBe(mockNewLogo);

    // Verify village profile now has new logo
    const vRes = await masterService.getVillage();
    expect(vRes.data?.logo).toBe(mockNewLogo);

    // Overwrite with second logo
    const mockSecondLogo = 'data:image/png;base64,second_logo_data';
    const secondUpdateRes = await masterService.updateVillageLogo(mockSecondLogo);
    expect(secondUpdateRes.success).toBe(true);
    const vRes2 = await masterService.getVillage();
    expect(vRes2.data?.logo).toBe(mockSecondLogo);

    // Reset logo to default
    const resetRes = await masterService.removeVillageLogo();
    expect(resetRes.success).toBe(true);
    expect(resetRes.data).toBe('/logo-kadesa.png');
    const vRes3 = await masterService.getVillage();
    expect(vRes3.data?.logo).toBe('/logo-kadesa.png');
  });

  it('should update and overwrite login background photo in system settings', async () => {
    const customBg = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80';
    
    // Update setting
    const updateRes = await settingsService.updateLoginBackground(customBg, 'Operator Test');
    expect(updateRes.success).toBe(true);
    expect(updateRes.data).toBe(customBg);

    const activeBg = await settingsService.getLoginBackground();
    expect(activeBg).toBe(customBg);

    // Overwrite with base64 custom uploaded photo
    const customUploadBg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    const overwriteRes = await settingsService.updateLoginBackground(customUploadBg, 'Operator Test');
    expect(overwriteRes.success).toBe(true);
    expect(await settingsService.getLoginBackground()).toBe(customUploadBg);

    // Reset to default
    const resetRes = await settingsService.resetLoginBackground('Operator Test');
    expect(resetRes.success).toBe(true);
    const defaultBg = await settingsService.getLoginBackground();
    expect(defaultBg).toContain('images.unsplash.com');
    expect(defaultBg).not.toBe(customUploadBg);
  });

  it('should retrieve default official letterhead configuration with 4 distinct lines', async () => {
    const config = await settingsService.getLetterheadConfig();
    expect(config).toBeDefined();
    expect(config.fontFamily).toContain('serif');
    expect(config.layout).toBe('left_logo_center_text');
    expect(config.borderStyle).toBe('double');
    expect(config.line1).toBeDefined();
    expect(config.line2).toBeDefined();
    expect(config.line3).toBeDefined();
    expect(config.line4).toBeDefined();
    expect(config.line1.text).toContain('PEMERINTAH');
    expect(config.line4.fontStyle).toBe('italic');
  });

  it('should allow operator to customize letterhead per-line and layout dynamically', async () => {
    const current = await settingsService.getLetterheadConfig();
    const updated = {
      ...current,
      templateId: 'standard_pemda' as const,
      fontFamily: 'Times New Roman, serif',
      layout: 'left_logo_center_text' as const,
      line1: {
        ...current.line1,
        text: 'PEMERINTAH DAERAH KABUPATEN TASIKMALAYA',
        fontSize: 14,
        fontWeight: '700' as const,
      },
      line2: {
        ...current.line2,
        text: 'KECAMATAN CISAYONG',
        fontSize: 13,
        fontWeight: '700' as const,
      },
      line3: {
        ...current.line3,
        text: 'DESA NUSAWANGI',
        fontSize: 16,
        fontWeight: '800' as const,
      },
      line4: {
        ...current.line4,
        text: 'Jl. Nusawangi no. 40 Cisayong 46153 Tasikmalaya | e-mail : nusawangi.ds@gmail.com',
        fontSize: 10,
        fontStyle: 'italic' as const,
      },
      borderStyle: 'double' as const,
      borderColor: '#000000',
    };

    const updateRes = await settingsService.updateLetterheadConfig(updated, 'Operator Cisayong');
    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.line1.text).toBe('PEMERINTAH DAERAH KABUPATEN TASIKMALAYA');
    expect(updateRes.data?.line2.text).toBe('KECAMATAN CISAYONG');
    expect(updateRes.data?.line3.text).toBe('DESA NUSAWANGI');
    expect(updateRes.data?.line4.text).toContain('nusawangi.ds@gmail.com');

    const fetched = await settingsService.getLetterheadConfig();
    expect(fetched.line3.text).toBe('DESA NUSAWANGI');
    expect(fetched.line3.fontSize).toBe(16);
    expect(fetched.line3.fontWeight).toBe('800');
    expect(fetched.borderStyle).toBe('double');

    // Reset back to standard
    const resetRes = await settingsService.resetLetterheadConfig('Operator Cisayong');
    expect(resetRes.success).toBe(true);
    const reverted = await settingsService.getLetterheadConfig();
    expect(reverted.line1.text).toBeDefined();
  });
});
