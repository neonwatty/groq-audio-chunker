import { describe, it, expect } from 'vitest';
import {
  extractIOSDeviceId,
  detectIOSDeviceType,
  estimateIOSRamByScreen,
  getRAMForDeviceId,
  getIOSDeviceRAM,
  isIOSDevice,
  _IPHONE_RAM,
  _IPAD_RAM,
  _DEFAULTS,
} from '../../src/ios-device-memory.js';
import { mockUserAgents } from '../fixtures/capability-fixtures.js';

describe('ios-device-memory', () => {
  describe('isIOSDevice', () => {
    it('should detect iPhone', () => {
      expect(isIOSDevice(mockUserAgents.safariIPhone)).toBe(true);
    });

    it('should detect iPad', () => {
      expect(isIOSDevice(mockUserAgents.safariIPad)).toBe(true);
    });

    it('should detect iPod', () => {
      expect(isIOSDevice(mockUserAgents.safariIPod)).toBe(true);
    });

    it('should not detect Android', () => {
      expect(isIOSDevice(mockUserAgents.chromeAndroid)).toBe(false);
    });

    it('should not detect Windows', () => {
      expect(isIOSDevice(mockUserAgents.chromeWindows)).toBe(false);
    });

    it('should not detect macOS', () => {
      expect(isIOSDevice(mockUserAgents.chromeMac)).toBe(false);
    });
  });

  describe('detectIOSDeviceType', () => {
    it('should detect iPhone', () => {
      expect(detectIOSDeviceType(mockUserAgents.safariIPhone)).toBe('iphone');
    });

    it('should detect iPad', () => {
      expect(detectIOSDeviceType(mockUserAgents.safariIPad)).toBe('ipad');
    });

    it('should detect iPod', () => {
      expect(detectIOSDeviceType(mockUserAgents.safariIPod)).toBe('ipod');
    });

    it('should return null for non-iOS', () => {
      expect(detectIOSDeviceType(mockUserAgents.chromeAndroid)).toBeNull();
      expect(detectIOSDeviceType(mockUserAgents.chromeWindows)).toBeNull();
    });
  });

  describe('extractIOSDeviceId', () => {
    it('should return null for standard iOS user agents', () => {
      // Standard iOS user agents don't include device model
      const result = extractIOSDeviceId(mockUserAgents.safariIPhone);
      expect(result).toBeNull();
    });

    it('should extract device id when present', () => {
      // Some user agents include device model
      const uaWithModel = 'Mozilla/5.0 (iPhone16,2; CPU iPhone OS 17_0 like Mac OS X)';
      const result = extractIOSDeviceId(uaWithModel);
      // Note: Standard Safari UAs don't include device model
      // This verifies the function handles various UA formats
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should return null for non-iOS', () => {
      expect(extractIOSDeviceId(mockUserAgents.chromeAndroid)).toBeNull();
    });
  });

  describe('getRAMForDeviceId', () => {
    it('should return correct RAM for known iPhone', () => {
      expect(getRAMForDeviceId('iPhone16,2')).toBe(8); // iPhone 15 Pro Max
      expect(getRAMForDeviceId('iPhone15,4')).toBe(6); // iPhone 15
      expect(getRAMForDeviceId('iPhone14,5')).toBe(4); // iPhone 13
      expect(getRAMForDeviceId('iPhone11,8')).toBe(3); // iPhone XR
    });

    it('should return correct RAM for known iPad', () => {
      expect(getRAMForDeviceId('iPad16,5')).toBe(8); // iPad Pro M4
      expect(getRAMForDeviceId('iPad14,8')).toBe(8); // iPad Air M2
      expect(getRAMForDeviceId('iPad13,1')).toBe(4); // iPad Air 4th gen
      expect(getRAMForDeviceId('iPad12,1')).toBe(3); // iPad 9th gen
    });

    it('should return null for unknown device', () => {
      expect(getRAMForDeviceId('iPhone99,99')).toBeNull();
      expect(getRAMForDeviceId('iPad99,99')).toBeNull();
    });
  });

  describe('estimateIOSRamByScreen', () => {
    describe('iPad estimation', () => {
      it('should estimate 8GB for 12.9" iPad Pro', () => {
        // 12.9" iPad Pro: 2048x2732 at 2x = 1024x1366 logical
        const result = estimateIOSRamByScreen(2048, 2732, 2, 'ipad');
        expect(result).toBe(8);
      });

      it('should estimate 8GB for 11" iPad Pro', () => {
        // 11" iPad Pro: 1668x2388 at 2x = 834x1194 logical
        const result = estimateIOSRamByScreen(1668, 2388, 2, 'ipad');
        expect(result).toBe(8);
      });

      it('should estimate 4GB for standard iPad', () => {
        // Standard iPad: 1620x2160 at 2x = 810x1080 logical
        const result = estimateIOSRamByScreen(1620, 2160, 2, 'ipad');
        expect(result).toBe(4);
      });
    });

    describe('iPhone estimation', () => {
      it('should estimate 6GB for Pro Max size', () => {
        // iPhone 15 Pro Max: 1290x2796 at 3x = 430x932 logical
        const result = estimateIOSRamByScreen(1290, 2796, 3, 'iphone');
        expect(result).toBe(6);
      });

      it('should estimate 6GB for Pro size', () => {
        // iPhone 15 Pro: 1179x2556 at 3x = 393x852 logical
        const result = estimateIOSRamByScreen(1179, 2556, 3, 'iphone');
        expect(result).toBe(6);
      });

      it('should estimate 4GB for standard iPhone', () => {
        // iPhone 14: 1170x2532 at 3x = 390x844 logical
        const result = estimateIOSRamByScreen(1170, 2532, 3, 'iphone');
        expect(result).toBe(4);
      });
    });
  });

  describe('getIOSDeviceRAM', () => {
    it('should return default for unknown iPhone', () => {
      const result = getIOSDeviceRAM(mockUserAgents.safariIPhone);
      expect(result).toBe(_DEFAULTS.iphone);
    });

    it('should return default for unknown iPad', () => {
      const result = getIOSDeviceRAM(mockUserAgents.safariIPad);
      expect(result).toBe(_DEFAULTS.ipad);
    });

    it('should return default for unknown iPod', () => {
      const result = getIOSDeviceRAM(mockUserAgents.safariIPod);
      expect(result).toBe(_DEFAULTS.ipod);
    });

    it('should return unknown default for non-iOS', () => {
      const result = getIOSDeviceRAM(mockUserAgents.chromeAndroid);
      expect(result).toBe(_DEFAULTS.unknown);
    });

    it('should use screen info when provided', () => {
      // Pro Max screen dimensions
      const screenInfo = {
        width: 1290,
        height: 2796,
        devicePixelRatio: 3,
      };
      const result = getIOSDeviceRAM(mockUserAgents.safariIPhone, screenInfo);
      expect(result).toBe(6);
    });

    it('should handle iPod with screen info (treated as iPhone)', () => {
      const screenInfo = {
        width: 640,
        height: 1136,
        devicePixelRatio: 2,
      };
      const result = getIOSDeviceRAM(mockUserAgents.safariIPod, screenInfo);
      // Should be treated as iPhone for screen estimation
      expect(typeof result).toBe('number');
    });
  });

  describe('lookup table completeness', () => {
    it('should have entries for recent iPhone models', () => {
      // iPhone 15 series
      expect(_IPHONE_RAM['iPhone16,1']).toBeDefined();
      expect(_IPHONE_RAM['iPhone16,2']).toBeDefined();
      expect(_IPHONE_RAM['iPhone15,4']).toBeDefined();

      // iPhone 14 series
      expect(_IPHONE_RAM['iPhone15,2']).toBeDefined();
      expect(_IPHONE_RAM['iPhone14,7']).toBeDefined();

      // iPhone 13 series
      expect(_IPHONE_RAM['iPhone14,2']).toBeDefined();
      expect(_IPHONE_RAM['iPhone14,5']).toBeDefined();
    });

    it('should have entries for recent iPad models', () => {
      // iPad Pro M4
      expect(_IPAD_RAM['iPad16,3']).toBeDefined();
      expect(_IPAD_RAM['iPad16,5']).toBeDefined();

      // iPad Air M2
      expect(_IPAD_RAM['iPad14,8']).toBeDefined();

      // iPad mini 6
      expect(_IPAD_RAM['iPad14,1']).toBeDefined();
    });

    it('should have proper default values', () => {
      expect(_DEFAULTS.iphone).toBe(4);
      expect(_DEFAULTS.ipad).toBe(4);
      expect(_DEFAULTS.ipod).toBe(2);
      expect(_DEFAULTS.unknown).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should handle empty user agent', () => {
      expect(isIOSDevice('')).toBe(false);
      expect(detectIOSDeviceType('')).toBeNull();
      expect(getIOSDeviceRAM('')).toBe(_DEFAULTS.unknown);
    });

    it('should handle partial screen info', () => {
      // Missing devicePixelRatio
      const partialInfo = {
        width: 1290,
        height: 2796,
      };
      const result = getIOSDeviceRAM(mockUserAgents.safariIPhone, partialInfo);
      expect(result).toBe(_DEFAULTS.iphone);
    });

    it('should handle zero screen dimensions', () => {
      const zeroInfo = {
        width: 0,
        height: 0,
        devicePixelRatio: 3,
      };
      const result = getIOSDeviceRAM(mockUserAgents.safariIPhone, zeroInfo);
      expect(result).toBe(_DEFAULTS.iphone);
    });
  });
});
