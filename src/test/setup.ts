import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

import { authService } from '../services/authService';
import { masterService } from '../services/masterService';
import { attendanceService } from '../services/attendanceService';
import { settingsService } from '../services/settingsService';
import { dlService } from '../services/dlService';
import { absenceService } from '../services/absenceService';
import { correctionService } from '../services/correctionService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';

import {
  mockVillage,
  mockPositions,
  mockUsers,
  mockAttendanceRecords,
  mockDLAssignments,
  mockAbsenceRequests,
  mockLeaveRequests,
  mockCorrectionRequests,
  mockNotifications,
  mockAuditLogs,
  mockSecurityEvents,
  mockSystemSettings,
  mockWorkSchedules,
  mockHolidays,
} from './fixtures/mockData';

// Function to reset & seed all isolated test fixtures
export const seedAllTestFixtures = () => {
  authService.seedTestFixtures({ users: mockUsers });
  masterService.seedTestFixtures({
    village: mockVillage,
    positions: mockPositions,
    apparatusList: mockUsers,
  });
  attendanceService.seedTestFixtures({ records: mockAttendanceRecords });
  settingsService.seedTestFixtures({
    settings: mockSystemSettings,
    schedules: mockWorkSchedules,
    holidays: mockHolidays,
  });
  dlService.seedTestFixtures({ assignments: mockDLAssignments });
  absenceService.seedTestFixtures({
    absences: mockAbsenceRequests,
    leaves: mockLeaveRequests,
  });
  correctionService.seedTestFixtures({ requests: mockCorrectionRequests });
  notificationService.seedTestFixtures({ notifications: mockNotifications });
  auditService.seedTestFixtures({
    auditLogs: mockAuditLogs,
    securityEvents: mockSecurityEvents,
  });
};

// Initial seeding for test environment
seedAllTestFixtures();

// Ensure fixtures are fresh before each test
beforeEach(() => {
  seedAllTestFixtures();
});

// Mock Geolocation API in tests
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});
