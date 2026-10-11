import { describe, it, expect } from 'vitest';
import {
  attendanceService,
  calculateHaversineDistanceMeters,
} from '../services/attendanceService';

describe('Attendance and Geofence Logic Tests', () => {
  it('should accurately calculate Haversine distance in meters', () => {
    // Village Office coordinates: -6.4828, 106.8436
    const officeLat = -6.4828;
    const officeLng = 106.8436;

    // Same point -> 0 meters
    const d0 = calculateHaversineDistanceMeters(officeLat, officeLng, officeLat, officeLng);
    expect(d0).toBe(0);

    // Nearby point (~110 meters away)
    const dNearby = calculateHaversineDistanceMeters(officeLat, officeLng, -6.4838, 106.8436);
    expect(dNearby).toBeGreaterThan(50);
    expect(dNearby).toBeLessThan(150);
  });

  it('should accept locations inside allowed geofence radius and reject outside', () => {
    const officeLat = -6.4828;
    const officeLng = 106.8436;
    const allowedRadius = 100;

    // Inside radius
    const inside = attendanceService.validateGeofence({
      latitude: -6.48285,
      longitude: 106.84362,
      accuracy: 10,
      targetLatitude: officeLat,
      targetLongitude: officeLng,
      allowedRadiusMeters: allowedRadius,
    });
    expect(inside.isValid).toBe(true);
    expect(inside.validationResult).toBe('ACCEPT');

    // Outside radius (500m away)
    const outside = attendanceService.validateGeofence({
      latitude: -6.488,
      longitude: 106.848,
      accuracy: 15,
      targetLatitude: officeLat,
      targetLongitude: officeLng,
      allowedRadiusMeters: allowedRadius,
    });
    expect(outside.isValid).toBe(false);
    expect(outside.validationResult).toBe('REJECT');
  });

  it('should reject check-in when user is outside geofence', async () => {
    const res = await attendanceService.checkIn(
      'usr-test-outside',
      'Test Aparatur',
      'Kaur TU',
      undefined,
      {
        latitude: -6.55, // Way outside village
        longitude: 106.9,
        accuracy: 10,
      }
    );
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('OUT_OF_GEOFENCE');
  });

  it('should prevent duplicate check-in and prevent check-in after check-out', async () => {
    const testUserId = `usr-test-dup-${Date.now()}`;
    const officeCoords = { latitude: -6.4828, longitude: 106.8436, accuracy: 10 };

    // 1. First valid Check-In
    const checkIn1 = await attendanceService.checkIn(
      testUserId,
      'Aparatur Uji Coba',
      'Staff Teknis',
      undefined,
      officeCoords
    );
    expect(checkIn1.success).toBe(true);

    // 2. Duplicate Check-In attempt on the same day -> Must FAIL
    const checkIn2 = await attendanceService.checkIn(
      testUserId,
      'Aparatur Uji Coba',
      'Staff Teknis',
      undefined,
      officeCoords
    );
    expect(checkIn2.success).toBe(false);
    expect(checkIn2.errorCode).toBe('DUPLICATE_CHECKIN');

    // 3. Valid Check-Out (providing early leave reason if before shift end)
    const checkOut = await attendanceService.checkOut(
      testUserId,
      officeCoords,
      'Penyelesaian tugas harian'
    );
    expect(checkOut.success).toBe(true);

    // 4. Check-In again after successfully checked out -> Must FAIL
    const checkInAfterCheckOut = await attendanceService.checkIn(
      testUserId,
      'Aparatur Uji Coba',
      'Staff Teknis',
      undefined,
      officeCoords
    );
    expect(checkInAfterCheckOut.success).toBe(false);
    expect(checkInAfterCheckOut.errorCode).toBe('DUPLICATE_CHECKIN');
  });

  it('should reject check-out if user has not checked in today', async () => {
    const nonCheckedInUser = `usr-no-checkin-${Date.now()}`;
    const officeCoords = { latitude: -6.4828, longitude: 106.8436, accuracy: 10 };

    const res = await attendanceService.checkOut(nonCheckedInUser, officeCoords);
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum melakukan Check-In');
  });

  it('should record early leave attributes without changing primary daily status from HADIR or TERLAMBAT (ADR-010)', async () => {
    const testUserId = `usr-test-early-${Date.now()}`;
    const officeCoords = { latitude: -6.4828, longitude: 106.8436, accuracy: 10 };

    // 1. Check-In valid in morning (07:25)
    const morningTime = new Date();
    morningTime.setHours(7, 25, 0, 0);
    attendanceService.setMockServerTime(morningTime);

    const checkIn = await attendanceService.checkIn(
      testUserId,
      'Aparatur Pulang Awal',
      'Kaur Keuangan',
      undefined,
      officeCoords
    );
    expect(checkIn.success).toBe(true);
    expect(['HADIR', 'TERLAMBAT']).toContain(checkIn.data?.status);
    const originalStatus = checkIn.data?.status;

    // 2. Check-Out at 14:00 (before 15:30 shift end, exactly 90 minutes early)
    const earlyTime = new Date();
    earlyTime.setHours(14, 0, 0, 0);
    attendanceService.setMockServerTime(earlyTime);

    try {
      const checkOut = await attendanceService.checkOut(
        testUserId,
        officeCoords,
        'Izin urusan dinas mendesak ke kantor camat'
      );

      expect(checkOut.success).toBe(true);
      expect(checkOut.data).toBeDefined();

      // Critical invariant: status must NOT be modified to PULANG_CEPAT (must remain HADIR or TERLAMBAT)
      expect(checkOut.data?.status).toBe(originalStatus);
      expect((checkOut.data?.status as string)).not.toBe('PULANG_CEPAT');

      // Early leave attributes must be correctly populated
      expect(checkOut.data?.isEarlyLeave).toBe(true);
      expect(checkOut.data?.earlyLeaveReason).toBe('Izin urusan dinas mendesak ke kantor camat');
      expect(checkOut.data?.earlyLeaveMinutes).toBeGreaterThan(0);
    } finally {
      attendanceService.setMockServerTime(null);
    }
  });

  it('should require early leave reason when checking out before shift end', async () => {
    const testUserId = `usr-test-noreason-${Date.now()}`;
    const officeCoords = { latitude: -6.4828, longitude: 106.8436, accuracy: 10 };

    // Morning check-in
    const morningTime = new Date();
    morningTime.setHours(7, 25, 0, 0);
    attendanceService.setMockServerTime(morningTime);

    await attendanceService.checkIn(
      testUserId,
      'Aparatur Tanpa Alasan',
      'Staff Teknis',
      undefined,
      officeCoords
    );

    // Set time before shift end (14:30 < 15:30)
    const earlyTime = new Date();
    earlyTime.setHours(14, 30, 0, 0);
    attendanceService.setMockServerTime(earlyTime);

    try {
      // Attempt Check-Out without reason
      const checkOut = await attendanceService.checkOut(
        testUserId,
        officeCoords,
        '' // Empty reason
      );

      expect(checkOut.success).toBe(false);
      expect(checkOut.errorCode).toBe('EARLY_LEAVE_REASON_REQUIRED');
    } finally {
      attendanceService.setMockServerTime(null);
    }
  });

  it('should flag placeholder office coordinates as unconfirmed by default (ADR-012)', async () => {
    const { settingsService } = await import('../services/settingsService');
    const isConfirmed = await settingsService.isOfficeCoordinatesConfirmed();
    // Default placeholder coordinates (-6.4828, 106.8436) MUST NOT be marked confirmed for production
    expect(isConfirmed).toBe(false);
  });

  it('should evaluate exact boundary conditions (<= 100m accepted, > 100m rejected)', () => {
    const officeLat = -6.4828;
    const officeLng = 106.8436;
    const allowedRadius = 100;

    // Inside: 50m offset (approx +0.00045 deg lat)
    const insideRes = attendanceService.validateGeofence({
      latitude: officeLat + 0.00045,
      longitude: officeLng,
      accuracy: 10,
      targetLatitude: officeLat,
      targetLongitude: officeLng,
      allowedRadiusMeters: allowedRadius,
    });
    expect(insideRes.isValid).toBe(true);
    expect(insideRes.distanceMeters).toBeLessThanOrEqual(allowedRadius);

    // Exact boundary: point at ~100m
    const boundaryRes = attendanceService.validateGeofence({
      latitude: officeLat + 0.000899,
      longitude: officeLng,
      accuracy: 10,
      targetLatitude: officeLat,
      targetLongitude: officeLng,
      allowedRadiusMeters: allowedRadius,
    });
    expect(boundaryRes.distanceMeters).toBe(100);
    expect(boundaryRes.isValid).toBe(true);
    expect(boundaryRes.validationResult).toBe('ACCEPT');

    // Just outside boundary: point at ~102m
    const outsideBoundaryRes = attendanceService.validateGeofence({
      latitude: officeLat + 0.00092,
      longitude: officeLng,
      accuracy: 10,
      targetLatitude: officeLat,
      targetLongitude: officeLng,
      allowedRadiusMeters: allowedRadius,
    });
    expect(outsideBoundaryRes.distanceMeters).toBeGreaterThan(allowedRadius);
    expect(outsideBoundaryRes.isValid).toBe(false);
    expect(outsideBoundaryRes.validationResult).toBe('REJECT');
  });

  it('should reject invalid geographic coordinates (out of range latitude or longitude)', async () => {
    const officeCoords = { latitude: 95.0, longitude: 106.8436, accuracy: 10 }; // Lat > 90 invalid

    // Check validateGeofence directly
    const badGeofence = attendanceService.validateGeofence({
      latitude: 95.0,
      longitude: 106.8436,
      accuracy: 10,
      targetLatitude: -6.4828,
      targetLongitude: 106.8436,
      allowedRadiusMeters: 100,
    });
    expect(badGeofence.isValid).toBe(false);
    expect(badGeofence.validationResult).toBe('REJECT');

    // Check checkIn with invalid latitude
    const resLat = await attendanceService.checkIn(
      `usr-invalid-lat-${Date.now()}`,
      'Aparatur Invalid Lat',
      'Staff',
      undefined,
      officeCoords
    );
    expect(resLat.success).toBe(false);
    expect(resLat.errorCode).toBe('INVALID_COORDINATES');

    // Check checkIn with invalid longitude (> 180)
    const resLon = await attendanceService.checkIn(
      `usr-invalid-lon-${Date.now()}`,
      'Aparatur Invalid Lon',
      'Staff',
      undefined,
      { latitude: -6.4828, longitude: 185.0, accuracy: 10 }
    );
    expect(resLon.success).toBe(false);
    expect(resLon.errorCode).toBe('INVALID_COORDINATES');

    // Check checkOut with invalid coordinates
    const validUser = `usr-valid-for-out-${Date.now()}`;
    await attendanceService.checkIn(
      validUser,
      'Aparatur Valid In',
      'Staff',
      undefined,
      { latitude: -6.4828, longitude: 106.8436, accuracy: 10 }
    );
    const resOutBad = await attendanceService.checkOut(
      validUser,
      { latitude: -95.0, longitude: 106.8436, accuracy: 10 }
    );
    expect(resOutBad.success).toBe(false);
    expect(resOutBad.errorCode).toBe('INVALID_COORDINATES');
  });

  it('should validate check-out geofence and reject check-out outside allowed radius', async () => {
    const testUserId = `usr-test-checkout-geo-${Date.now()}`;
    const officeCoords = { latitude: -6.4828, longitude: 106.8436, accuracy: 10 };

    // Valid check-in at office
    const checkInRes = await attendanceService.checkIn(
      testUserId,
      'Aparatur Checkout Geo',
      'Staff',
      undefined,
      officeCoords
    );
    expect(checkInRes.success).toBe(true);

    // Check-out far away from office (e.g. 500m away)
    const checkOutFar = await attendanceService.checkOut(
      testUserId,
      { latitude: -6.488, longitude: 106.848, accuracy: 10 }
    );
    expect(checkOutFar.success).toBe(false);
    expect(checkOutFar.errorCode).toBe('OUT_OF_GEOFENCE');
    expect(checkOutFar.message).toContain('Check-Out ditolak');

    // Anti-tampering check: original check-in data must remain intact and unmodified
    const recordRes = await attendanceService.getTodayAttendanceForUser(testUserId);
    expect(recordRes.data?.checkInLatitude).toBe(officeCoords.latitude);
    expect(recordRes.data?.checkInLongitude).toBe(officeCoords.longitude);
    expect(recordRes.data?.checkOutAt).toBeNull();
  });

  it('should support DINAS_LUAR path as geofence exemption while requiring DL assignment and valid coordinates', async () => {
    const testUserId = `usr-test-dl-${Date.now()}`;
    const farAwayCoords = { latitude: -6.2088, longitude: 106.8456, accuracy: 15 }; // Jakarta (~35km away)

    // 1. DINAS_LUAR without dlAssignmentId must FAIL
    const failedDL = await attendanceService.checkIn(
      testUserId,
      'Aparatur Dinas Luar',
      'Kasi Pemerintahan',
      undefined,
      farAwayCoords,
      'DINAS_LUAR',
      undefined // missing dlAssignmentId
    );
    expect(failedDL.success).toBe(false);
    expect(failedDL.errorCode).toBe('DL_ASSIGNMENT_REQUIRED');

    // 2. DINAS_LUAR with invalid coordinates must FAIL
    const badCoordDL = await attendanceService.checkIn(
      testUserId,
      'Aparatur Dinas Luar',
      'Kasi Pemerintahan',
      undefined,
      { latitude: -105.0, longitude: 106.8456, accuracy: 15 },
      'DINAS_LUAR',
      'dla-official-001'
    );
    expect(badCoordDL.success).toBe(false);
    expect(badCoordDL.errorCode).toBe('INVALID_COORDINATES');

    // 2b. DINAS_LUAR without selfie photo must FAIL
    const noSelfieDL = await attendanceService.checkIn(
      testUserId,
      'Aparatur Dinas Luar',
      'Kasi Pemerintahan',
      undefined, // missing selfie
      farAwayCoords,
      'DINAS_LUAR',
      'dla-official-001'
    );
    expect(noSelfieDL.success).toBe(false);
    expect(noSelfieDL.errorCode).toBe('SELFIE_REQUIRED');

    // 3. Valid DINAS_LUAR with dlAssignmentId and selfie: succeeds even 35km away from village office
    const validDL = await attendanceService.checkIn(
      testUserId,
      'Aparatur Dinas Luar',
      'Kasi Pemerintahan',
      'data:image/jpeg;base64,mockselfiedata',
      farAwayCoords,
      'DINAS_LUAR',
      'dla-official-001'
    );
    expect(validDL.success).toBe(true);
    expect(validDL.data?.status).toBe('DINAS_LUAR');
    expect(validDL.data?.attendanceType).toBe('DINAS_LUAR');
    expect(validDL.data?.dlAssignmentId).toBe('dla-official-001');

    // 4. Check-out for DINAS_LUAR: allowed even far from village office
    const checkOutDL = await attendanceService.checkOut(
      testUserId,
      farAwayCoords
    );
    expect(checkOutDL.success).toBe(true);
    expect(checkOutDL.data?.checkOutAt).not.toBeNull();
  });

  it('should reject partial coordinates where latitude or longitude is missing/NaN/null', async () => {
    // 1. In validateGeofence
    const resPartial = attendanceService.validateGeofence({
      latitude: null as any,
      longitude: 106.8436,
      accuracy: 10,
      targetLatitude: -6.4828,
      targetLongitude: 106.8436,
      allowedRadiusMeters: 100,
    });
    expect(resPartial.isValid).toBe(false);
    expect(resPartial.validationResult).toBe('REJECT');

    // 2. In checkIn with partial/NaN coordinates
    const testUser = `usr-partial-${Date.now()}`;
    const checkInNaN = await attendanceService.checkIn(
      testUser,
      'Aparatur Partial',
      'Staff',
      undefined,
      { latitude: NaN, longitude: 106.8436, accuracy: 10 }
    );
    expect(checkInNaN.success).toBe(false);
    expect(checkInNaN.errorCode).toBe('INVALID_COORDINATES');

    // 3. In checkOut with partial coordinates
    const checkOutNull = await attendanceService.checkOut(
      testUser,
      { latitude: -6.4828, longitude: null as any, accuracy: 10 }
    );
    expect(checkOutNull.success).toBe(false);
  });
});
