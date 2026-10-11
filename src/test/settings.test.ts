import { describe, it, expect } from 'vitest';
import { settingsService } from '../services/settingsService';

describe('System Settings and Configuration Resolver Tests', () => {
  it('should resolve active configuration parameters without hard-coding', async () => {
    const tz = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    expect(tz).toBe('Asia/Jakarta');

    const radius = await settingsService.getNumberSetting('REGULAR_ATTENDANCE_RADIUS_METERS', 50);
    expect(radius).toBe(100);

    const deadline = await settingsService.getNumberSetting('DL_RATIFICATION_DEADLINE_HOURS', 24);
    expect(deadline).toBe(72);
  });

  it('should update setting with effective date and archive previous version', async () => {
    const updateRes = await settingsService.updateSetting(
      'DL_RATIFICATION_DEADLINE_HOURS',
      '96',
      '2026-11-01',
      'Operator Test'
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.value).toBe('96');
    expect(updateRes.data?.effectiveFrom).toBe('2026-11-01');

    // For date before effective date (today), active setting should still be 72
    const pastSetting = await settingsService.getActiveSetting('DL_RATIFICATION_DEADLINE_HOURS', '2026-10-01');
    expect(pastSetting?.value).toBe('72');

    // For date on or after effective date, active setting should be 96
    const futureSetting = await settingsService.getActiveSetting('DL_RATIFICATION_DEADLINE_HOURS', '2026-11-05');
    expect(futureSetting?.value).toBe('96');
  });

  it('should establish work_schedules as the authoritative single source of truth for daily schedules', async () => {
    const schedulesRes = await settingsService.getWorkSchedules();
    expect(schedulesRes.success).toBe(true);
    expect(schedulesRes.data).toBeDefined();
    expect(schedulesRes.data?.length).toBe(7);

    // Verify Friday schedule differs from Monday-Thursday
    const monday = schedulesRes.data?.find((s) => s.dayOfWeek === 1);
    const friday = schedulesRes.data?.find((s) => s.dayOfWeek === 5);
    const sunday = schedulesRes.data?.find((s) => s.dayOfWeek === 7);

    expect(monday?.startTime).toBe('07:30');
    expect(monday?.endTime).toBe('15:30');
    expect(monday?.active).toBe(true);

    expect(friday?.startTime).toBe('07:30');
    expect(friday?.endTime).toBe('16:00');
    expect(friday?.active).toBe(true);

    expect(sunday?.active).toBe(false);

    // Test getScheduleForDate accurately resolves Friday end time
    // 2026-10-16 is a Friday
    const fridayDate = new Date('2026-10-16T10:00:00Z');
    const fridayInfo = await settingsService.getScheduleForDate(fridayDate, 'Asia/Jakarta');
    expect(fridayInfo.dayName).toBe('Jumat');
    expect(fridayInfo.isWorkingDay).toBe(true);
    expect(fridayInfo.schedule?.endTime).toBe('16:00');

    // Test getScheduleForDate accurately identifies holiday
    // 2026-08-17 is Hari Kemerdekaan RI
    const holidayDate = new Date('2026-08-17T10:00:00Z');
    const holidayInfo = await settingsService.getScheduleForDate(holidayDate, 'Asia/Jakarta');
    expect(holidayInfo.isHoliday).toBe(true);
    expect(holidayInfo.isWorkingDay).toBe(false);
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

