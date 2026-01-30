import { describe, it, expect, vi } from 'vitest';
import {
  detectDeviceMemory,
  detectCPUCores,
  detectDeviceType,
  detectPlatform,
  detectBrowserCapabilities,
  getBatteryStatus,
  getChromeMemoryInfo,
  isLowEndDevice,
  getFullCapabilityReport,
  getCapabilitySummary,
} from '../../src/capability-detector.js';
import {
  mockCapabilityReports,
  mockUserAgents,
} from '../fixtures/capability-fixtures.js';

describe('capability-detector', () => {
  describe('detectDeviceMemory', () => {
    it('should return navigator.deviceMemory when available', () => {
      const originalDeviceMemory = navigator.deviceMemory;
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 8,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceMemory();
      expect(result).toBe(8);

      // Restore
      Object.defineProperty(navigator, 'deviceMemory', {
        value: originalDeviceMemory,
        writable: true,
        configurable: true,
      });
    });

    it('should return default 4GB when deviceMemory is unavailable', () => {
      const originalDeviceMemory = navigator.deviceMemory;
      Object.defineProperty(navigator, 'deviceMemory', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Mock non-iOS user agent
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeWindows,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceMemory();
      expect(result).toBe(4);

      // Restore
      Object.defineProperty(navigator, 'deviceMemory', {
        value: originalDeviceMemory,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('detectCPUCores', () => {
    it('should return navigator.hardwareConcurrency when available', () => {
      const originalCores = navigator.hardwareConcurrency;
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 8,
        writable: true,
        configurable: true,
      });

      const result = detectCPUCores();
      expect(result).toBe(8);

      // Restore
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: originalCores,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('detectDeviceType', () => {
    it('should detect mobile devices', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.safariIPhone,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceType();
      expect(result).toBe('mobile');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect tablets', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.safariIPad,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceType();
      expect(result).toBe('tablet');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect desktops', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeWindows,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceType();
      expect(result).toBe('desktop');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect Android tablets', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.androidTablet,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceType();
      expect(result).toBe('tablet');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect Android phones', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeAndroid,
        writable: true,
        configurable: true,
      });

      const result = detectDeviceType();
      expect(result).toBe('mobile');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('detectPlatform', () => {
    it('should detect iOS', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.safariIPhone,
        writable: true,
        configurable: true,
      });

      const result = detectPlatform();
      expect(result).toBe('ios');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect Android', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeAndroid,
        writable: true,
        configurable: true,
      });

      const result = detectPlatform();
      expect(result).toBe('android');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect Windows', () => {
      const originalUA = navigator.userAgent;
      const originalPlatform = navigator.platform;

      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeWindows,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      });

      const result = detectPlatform();
      expect(result).toBe('windows');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true,
      });
    });

    it('should detect macOS', () => {
      const originalUA = navigator.userAgent;
      const originalPlatform = navigator.platform;

      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeMac,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      });

      const result = detectPlatform();
      expect(result).toBe('macos');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true,
      });
    });

    it('should detect Chrome OS', () => {
      const originalUA = navigator.userAgent;

      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeOS,
        writable: true,
        configurable: true,
      });

      const result = detectPlatform();
      expect(result).toBe('chromeos');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
    });

    it('should detect Linux', () => {
      const originalUA = navigator.userAgent;
      const originalPlatform = navigator.platform;

      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chromeLinux,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
      });

      const result = detectPlatform();
      expect(result).toBe('linux');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('detectBrowserCapabilities', () => {
    it('should detect available capabilities', () => {
      const result = detectBrowserCapabilities();

      // happy-dom should support most of these
      expect(typeof result.sharedArrayBuffer).toBe('boolean');
      expect(typeof result.webWorkers).toBe('boolean');
      expect(typeof result.webAudio).toBe('boolean');
      expect(typeof result.offscreenCanvas).toBe('boolean');
      expect(typeof result.webAssembly).toBe('boolean');
    });

    it('should have all required capability keys', () => {
      const result = detectBrowserCapabilities();
      expect(result).toHaveProperty('sharedArrayBuffer');
      expect(result).toHaveProperty('webWorkers');
      expect(result).toHaveProperty('webAudio');
      expect(result).toHaveProperty('offscreenCanvas');
      expect(result).toHaveProperty('webAssembly');
    });
  });

  describe('getBatteryStatus', () => {
    it('should return null when getBattery is not available', async () => {
      // happy-dom doesn't have getBattery
      const result = await getBatteryStatus();
      expect(result).toBeNull();
    });

    it('should return battery info when available', async () => {
      const mockBattery = {
        level: 0.75,
        charging: true,
      };

      const originalGetBattery = navigator.getBattery;
      Object.defineProperty(navigator, 'getBattery', {
        value: vi.fn().mockResolvedValue(mockBattery),
        writable: true,
        configurable: true,
      });

      const result = await getBatteryStatus();
      expect(result).toEqual({ level: 0.75, charging: true });

      Object.defineProperty(navigator, 'getBattery', {
        value: originalGetBattery,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('getChromeMemoryInfo', () => {
    it('should return null when performance.memory is not available', () => {
      // happy-dom doesn't have performance.memory
      const result = getChromeMemoryInfo();
      expect(result).toBeNull();
    });

    it('should return memory info when available', () => {
      const mockMemory = {
        usedJSHeapSize: 50000000,
        totalJSHeapSize: 100000000,
        jsHeapSizeLimit: 512000000,
      };

      const originalMemory = performance.memory;
      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        writable: true,
        configurable: true,
      });

      const result = getChromeMemoryInfo();
      expect(result).toEqual(mockMemory);

      Object.defineProperty(performance, 'memory', {
        value: originalMemory,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('isLowEndDevice', () => {
    it('should return true for low memory (<4GB)', () => {
      expect(isLowEndDevice(2, 4, 'desktop')).toBe(true);
      expect(isLowEndDevice(3, 4, 'desktop')).toBe(true);
    });

    it('should return true for mobile/tablet with less than 6GB', () => {
      expect(isLowEndDevice(4, 4, 'mobile')).toBe(true);
      expect(isLowEndDevice(4, 4, 'tablet')).toBe(true);
      expect(isLowEndDevice(5, 4, 'mobile')).toBe(true);
    });

    it('should return true for low CPU cores (<2)', () => {
      expect(isLowEndDevice(8, 1, 'desktop')).toBe(true);
    });

    it('should return false for adequate specs', () => {
      expect(isLowEndDevice(4, 4, 'desktop')).toBe(false);
      expect(isLowEndDevice(8, 4, 'mobile')).toBe(false);
      expect(isLowEndDevice(6, 4, 'tablet')).toBe(false);
    });
  });

  describe('getFullCapabilityReport', () => {
    it('should return a complete capability report', async () => {
      const report = await getFullCapabilityReport();

      expect(report).toHaveProperty('memoryGB');
      expect(report).toHaveProperty('cpuCores');
      expect(report).toHaveProperty('deviceType');
      expect(report).toHaveProperty('platform');
      expect(report).toHaveProperty('browserCapabilities');
      expect(report).toHaveProperty('battery');
      expect(report).toHaveProperty('isLowEndDevice');
      expect(report).toHaveProperty('userAgent');
      expect(report).toHaveProperty('screenWidth');
      expect(report).toHaveProperty('screenHeight');
      expect(report).toHaveProperty('devicePixelRatio');
    });

    it('should have valid device type', async () => {
      const report = await getFullCapabilityReport();
      expect(['mobile', 'tablet', 'desktop']).toContain(report.deviceType);
    });

    it('should have valid platform', async () => {
      const report = await getFullCapabilityReport();
      expect(['ios', 'android', 'macos', 'windows', 'linux', 'chromeos', 'other']).toContain(report.platform);
    });
  });

  describe('getCapabilitySummary', () => {
    it('should format high-end desktop report', () => {
      const summary = getCapabilitySummary(mockCapabilityReports.highEndDesktop);

      expect(summary).toContain('Desktop');
      expect(summary).toContain('MACOS');
      expect(summary).toContain('8GB');
      expect(summary).toContain('10');
      expect(summary).toContain('Multi-threaded FFmpeg');
      expect(summary).not.toContain('Limited device');
    });

    it('should format low-end device report with warning', () => {
      const summary = getCapabilitySummary(mockCapabilityReports.lowEndDesktop);

      expect(summary).toContain('Desktop');
      expect(summary).toContain('2GB');
      expect(summary).toContain('Limited device');
    });

    it('should include battery info when available', () => {
      const summary = getCapabilitySummary(mockCapabilityReports.midRangeDesktop);

      expect(summary).toContain('Battery: 75%');
    });

    it('should indicate charging status', () => {
      const summary = getCapabilitySummary(mockCapabilityReports.iPhone12Mini);

      expect(summary).toContain('charging');
    });

    it('should format mobile report', () => {
      const summary = getCapabilitySummary(mockCapabilityReports.iPhone15Pro);

      expect(summary).toContain('Mobile');
      expect(summary).toContain('IOS');
    });
  });
});
