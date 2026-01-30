import { describe, it, expect } from 'vitest';
import {
  getMaxDurationMinutes,
  checkDurationLimit,
  _DURATION_LIMITS,
} from '../../src/device-gate.js';
import { mockCapabilityReports } from '../fixtures/capability-fixtures.js';

describe('device-gate', () => {
  describe('getMaxDurationMinutes', () => {
    describe('mobile devices', () => {
      it('should return 15 minutes for standard mobile', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.iPhone12Mini);
        expect(result).toBe(_DURATION_LIMITS.mobile.default);
      });

      it('should return 20 minutes for high-memory mobile (6GB+)', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.iPhone15Pro);
        expect(result).toBe(_DURATION_LIMITS.mobile.withHighMemory);
      });

      it('should return 15 minutes for low-end Android', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.androidLowEnd);
        expect(result).toBe(_DURATION_LIMITS.mobile.default);
      });

      it('should return 20 minutes for high-end Android', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.androidHighEnd);
        expect(result).toBe(_DURATION_LIMITS.mobile.withHighMemory);
      });
    });

    describe('tablet devices', () => {
      it('should return 30 minutes for standard tablet', () => {
        const caps = { ...mockCapabilityReports.iPadProM2, memoryGB: 4 };
        const result = getMaxDurationMinutes(caps);
        expect(result).toBe(_DURATION_LIMITS.tablet.default);
      });

      it('should return 45 minutes for high-memory tablet (8GB+)', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.iPadProM2);
        expect(result).toBe(_DURATION_LIMITS.tablet.withHighMemory);
      });
    });

    describe('desktop devices', () => {
      it('should return 15 minutes for low-memory desktop (≤2GB)', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.lowEndDesktop);
        expect(result).toBe(_DURATION_LIMITS.desktop.lowMemory);
      });

      it('should return 45 minutes for mid-range desktop (4GB)', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.midRangeDesktop);
        expect(result).toBe(_DURATION_LIMITS.desktop.midMemory);
      });

      it('should return 120 minutes for high-end desktop (8GB+)', () => {
        const result = getMaxDurationMinutes(mockCapabilityReports.highEndDesktop);
        expect(result).toBe(_DURATION_LIMITS.desktop.highMemory);
      });
    });
  });

  describe('checkDurationLimit', () => {
    it('should allow audio under the limit', () => {
      const durationSeconds = 10 * 60; // 10 minutes
      const result = checkDurationLimit(durationSeconds, mockCapabilityReports.highEndDesktop);

      expect(result.allowed).toBe(true);
      expect(result.audioMinutes).toBe(10);
      expect(result.maxMinutes).toBe(120);
      expect(result.message).toBeUndefined();
    });

    it('should allow audio at exactly the limit', () => {
      const durationSeconds = 120 * 60; // 120 minutes
      const result = checkDurationLimit(durationSeconds, mockCapabilityReports.highEndDesktop);

      expect(result.allowed).toBe(true);
    });

    it('should reject audio over the limit', () => {
      const durationSeconds = 30 * 60; // 30 minutes
      const result = checkDurationLimit(durationSeconds, mockCapabilityReports.androidLowEnd);

      expect(result.allowed).toBe(false);
      expect(result.audioMinutes).toBe(30);
      expect(result.maxMinutes).toBe(15);
      expect(result.message).toContain('exceeds');
      expect(result.message).toContain('15 minutes');
    });

    it('should include device type in rejection message for mobile', () => {
      const durationSeconds = 60 * 60; // 60 minutes
      const result = checkDurationLimit(durationSeconds, mockCapabilityReports.iPhone12Mini);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('mobile');
    });

    it('should include memory info in rejection message for desktop', () => {
      const durationSeconds = 60 * 60; // 60 minutes
      const result = checkDurationLimit(durationSeconds, mockCapabilityReports.lowEndDesktop);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('2GB RAM');
    });
  });

  describe('duration limits configuration', () => {
    it('should have sensible mobile limits', () => {
      expect(_DURATION_LIMITS.mobile.default).toBeLessThanOrEqual(20);
      expect(_DURATION_LIMITS.mobile.withHighMemory).toBeGreaterThan(_DURATION_LIMITS.mobile.default);
    });

    it('should have sensible tablet limits', () => {
      expect(_DURATION_LIMITS.tablet.default).toBeGreaterThan(_DURATION_LIMITS.mobile.default);
      expect(_DURATION_LIMITS.tablet.withHighMemory).toBeGreaterThan(_DURATION_LIMITS.tablet.default);
    });

    it('should have sensible desktop limits', () => {
      expect(_DURATION_LIMITS.desktop.lowMemory).toBeLessThanOrEqual(20);
      expect(_DURATION_LIMITS.desktop.midMemory).toBeGreaterThan(_DURATION_LIMITS.desktop.lowMemory);
      expect(_DURATION_LIMITS.desktop.highMemory).toBeGreaterThan(_DURATION_LIMITS.desktop.midMemory);
    });

    it('should have desktop high-memory as the highest limit', () => {
      const allLimits = [
        _DURATION_LIMITS.mobile.default,
        _DURATION_LIMITS.mobile.withHighMemory,
        _DURATION_LIMITS.tablet.default,
        _DURATION_LIMITS.tablet.withHighMemory,
        _DURATION_LIMITS.desktop.lowMemory,
        _DURATION_LIMITS.desktop.midMemory,
        _DURATION_LIMITS.desktop.highMemory,
      ];
      const maxLimit = Math.max(...allLimits);
      expect(_DURATION_LIMITS.desktop.highMemory).toBe(maxLimit);
    });
  });
});
