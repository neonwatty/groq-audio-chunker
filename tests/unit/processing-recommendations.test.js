import { describe, it, expect } from 'vitest';
import {
  estimateMemoryUsage,
  getProcessingRecommendation,
  getQuickAssessment,
  formatRecommendation,
  isDurationSafe,
} from '../../src/processing-recommendations.js';
import {
  mockCapabilityReports,
  mockAudioFiles,
} from '../fixtures/capability-fixtures.js';

describe('processing-recommendations', () => {
  describe('estimateMemoryUsage', () => {
    it('should estimate memory for short audio', () => {
      const result = estimateMemoryUsage(
        mockAudioFiles.shortPodcast.durationSeconds,
        mockAudioFiles.shortPodcast.fileSizeBytes
      );

      // Should be a reasonable amount (less than 1GB for 5 minutes)
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should estimate more memory for longer audio', () => {
      const shortResult = estimateMemoryUsage(
        mockAudioFiles.shortPodcast.durationSeconds,
        mockAudioFiles.shortPodcast.fileSizeBytes
      );

      const longResult = estimateMemoryUsage(
        mockAudioFiles.longPodcast.durationSeconds,
        mockAudioFiles.longPodcast.fileSizeBytes
      );

      expect(longResult).toBeGreaterThan(shortResult);
    });

    it('should account for file size', () => {
      const smallFile = estimateMemoryUsage(600, 10 * 1024 * 1024);
      const largeFile = estimateMemoryUsage(600, 100 * 1024 * 1024);

      expect(largeFile).toBeGreaterThan(smallFile);
    });
  });

  describe('getProcessingRecommendation', () => {
    it('should recommend processing for high-end device with short audio', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.highEndDesktop
      );

      expect(result.canProcess).toBe(true);
      expect(result.confidenceLevel).toBe('high');
      expect(result.warnings).toHaveLength(0);
      expect(result.recommendedChunkDuration).toBeGreaterThan(0);
    });

    it('should warn for long audio on low-end device', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.longPodcast,
        mockCapabilityReports.lowEndDesktop
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.confidenceLevel).not.toBe('high');
    });

    it('should not allow processing without WebAssembly', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.noWebAssembly
      );

      expect(result.canProcess).toBe(false);
      expect(result.warnings).toContain('WebAssembly not supported - audio processing unavailable');
    });

    it('should provide tips for mobile devices', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.iPhone15Pro
      );

      expect(result.tips).toContain('Keep the app in foreground during processing');
    });

    it('should provide tips for iOS devices', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.iPhone15Pro
      );

      expect(result.tips).toContain('Safari works best for audio processing on iOS');
    });

    it('should warn about low battery', async () => {
      const lowBatteryDevice = {
        ...mockCapabilityReports.androidHighEnd,
        battery: { level: 0.15, charging: false },
      };

      const result = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        lowBatteryDevice
      );

      expect(result.warnings.some(w => w.includes('Low battery'))).toBe(true);
    });

    it('should tip about SharedArrayBuffer when unavailable', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.iPhone15Pro
      );

      expect(result.tips).toContain('Multi-threaded processing unavailable - processing may be slower');
    });

    it('should tip about large files', async () => {
      const result = await getProcessingRecommendation(
        mockAudioFiles.largeWav,
        mockCapabilityReports.highEndDesktop
      );

      expect(result.tips).toContain('Large file detected - initial loading may take a moment');
    });

    it('should set lower max duration for low-end devices', async () => {
      const highEnd = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.highEndDesktop
      );

      const lowEnd = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.lowEndDesktop
      );

      expect(lowEnd.maxRecommendedDuration).toBeLessThan(highEnd.maxRecommendedDuration);
    });

    it('should use smaller chunks for low-memory devices', async () => {
      const highEnd = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.highEndDesktop
      );

      const lowEnd = await getProcessingRecommendation(
        mockAudioFiles.shortPodcast,
        mockCapabilityReports.lowEndDesktop
      );

      expect(lowEnd.recommendedChunkDuration).toBeLessThan(highEnd.recommendedChunkDuration);
    });
  });

  describe('getQuickAssessment', () => {
    it('should return quick assessment', async () => {
      // Mock the getFullCapabilityReport to return predictable values
      const result = await getQuickAssessment();

      expect(result).toHaveProperty('maxDuration');
      expect(result).toHaveProperty('deviceTier');
      expect(result).toHaveProperty('tips');
      expect(['high', 'medium', 'low']).toContain(result.deviceTier);
    });
  });

  describe('formatRecommendation', () => {
    it('should format processable recommendation', () => {
      const rec = {
        canProcess: true,
        recommendedChunkDuration: 600,
        maxRecommendedDuration: 120,
        confidenceLevel: 'high',
        warnings: [],
        tips: [],
      };

      const result = formatRecommendation(rec);

      expect(result).toContain('Ready to process');
      expect(result).toContain('confidence: high');
      expect(result).toContain('10 minutes');
    });

    it('should format non-processable recommendation', () => {
      const rec = {
        canProcess: false,
        recommendedChunkDuration: 0,
        maxRecommendedDuration: 0,
        confidenceLevel: 'low',
        warnings: ['WebAssembly not supported'],
        tips: [],
      };

      const result = formatRecommendation(rec);

      expect(result).toContain('Unable to process');
      expect(result).toContain('Warnings:');
      expect(result).toContain('WebAssembly not supported');
    });

    it('should include tips in output', () => {
      const rec = {
        canProcess: true,
        recommendedChunkDuration: 600,
        maxRecommendedDuration: 120,
        confidenceLevel: 'high',
        warnings: [],
        tips: ['Keep the app in foreground'],
      };

      const result = formatRecommendation(rec);

      expect(result).toContain('Tips:');
      expect(result).toContain('Keep the app in foreground');
    });
  });

  describe('isDurationSafe', () => {
    it('should return safe for short duration on high-end device', async () => {
      const result = await isDurationSafe(300, mockCapabilityReports.highEndDesktop);

      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return unsafe for very long duration on low-end device', async () => {
      // 3 hours on 2GB device
      const result = await isDurationSafe(10800, mockCapabilityReports.lowEndDesktop);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('exceeds');
      expect(result.reason).toContain('2GB');
    });

    it('should respect device memory in determining safety', async () => {
      // 2 hours (7200 seconds) - safe for 8GB, unsafe for 2GB
      const highEndResult = await isDurationSafe(7200, mockCapabilityReports.highEndDesktop);
      const lowEndResult = await isDurationSafe(7200, mockCapabilityReports.lowEndDesktop);

      expect(highEndResult.safe).toBe(true);
      expect(lowEndResult.safe).toBe(false);
    });
  });
});
