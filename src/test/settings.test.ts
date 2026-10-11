import { describe, it, expect } from 'vitest';
import { settingsService } from '../services/settingsService';

describe('System Settings and Configuration Resolver Tests', () => {
  it('should resolve active configuration parameters without hard-coding', async () => {
    const startTime = await settingsService.getStringSetting('WORK_START_TIME', '08:00');
    expect(startTime).toBe('07:30');

    const tolerance = await settingsService.getNumberSetting('LATE_TOLERANCE_MINUTES', 0);
    expect(tolerance).toBe(15);

    const radius = await settingsService.getNumberSetting('REGULAR_ATTENDANCE_RADIUS_METERS', 50);
    expect(radius).toBe(100);
  });

  it('should update setting with effective date and archive previous version', async () => {
    const updateRes = await settingsService.updateSetting(
      'LATE_TOLERANCE_MINUTES',
      '20',
      '2026-11-01',
      'Operator Test'
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.value).toBe('20');
    expect(updateRes.data?.effectiveFrom).toBe('2026-11-01');

    // For date before effective date (today), active setting should still be 15
    const pastSetting = await settingsService.getActiveSetting('LATE_TOLERANCE_MINUTES', '2026-10-01');
    expect(pastSetting?.value).toBe('15');

    // For date on or after effective date, active setting should be 20
    const futureSetting = await settingsService.getActiveSetting('LATE_TOLERANCE_MINUTES', '2026-11-05');
    expect(futureSetting?.value).toBe('20');
  });

  it('should enforce hardcoded key immutability and reject updates to non-existent keys', async () => {
    // Attempting to update a non-existent or arbitrary key must fail
    const invalidRes = await settingsService.updateSetting(
      'CUSTOM_ARBITRARY_KEY',
      'some_value',
      '2026-11-01',
      'Hacker'
    );
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.message).toBe('Pengaturan tidak ditemukan');

    // Valid update must strictly retain the original key
    const validRes = await settingsService.updateSetting(
      'REGULAR_ATTENDANCE_RADIUS_METERS',
      '120',
      '2026-11-01',
      'Admin'
    );
    expect(validRes.success).toBe(true);
    expect(validRes.data?.key).toBe('REGULAR_ATTENDANCE_RADIUS_METERS');
  });

  it('should record audit log when system settings or geofence status are updated', async () => {
    const { auditService } = await import('../services/auditService');
    const updateRes = await settingsService.updateSetting(
      'OFFICE_COORDINATES_CONFIRMED',
      'true',
      '2026-10-10',
      'SuperAdmin Official'
    );
    expect(updateRes.success).toBe(true);

    const auditLogsRes = await auditService.getAuditLogs({ eventType: 'SETTINGS_CHANGED' });
    expect(auditLogsRes.data).toBeDefined();
    const confirmedAudit = auditLogsRes.data?.find(
      (log) => (log.afterData as any)?.key === 'OFFICE_COORDINATES_CONFIRMED'
    );
    expect(confirmedAudit).toBeDefined();
    expect(confirmedAudit?.eventType).toBe('SETTINGS_CHANGED');
  });
});

