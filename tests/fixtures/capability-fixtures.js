/**
 * Test fixtures for capability detection testing
 *
 * Provides mock data for various devices and environments.
 */

/**
 * Mock capability reports for different device types
 */
export const mockCapabilityReports = {
  // High-end desktop (MacBook Pro M2)
  highEndDesktop: {
    memoryGB: 8,
    cpuCores: 10,
    deviceType: 'desktop',
    platform: 'macos',
    browserCapabilities: {
      sharedArrayBuffer: true,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: null,
    isLowEndDevice: false,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    screenWidth: 2560,
    screenHeight: 1600,
    devicePixelRatio: 2,
  },

  // Mid-range desktop (Windows laptop)
  midRangeDesktop: {
    memoryGB: 4,
    cpuCores: 4,
    deviceType: 'desktop',
    platform: 'windows',
    browserCapabilities: {
      sharedArrayBuffer: true,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: { level: 0.75, charging: false },
    isLowEndDevice: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
  },

  // Low-end desktop (older machine)
  lowEndDesktop: {
    memoryGB: 2,
    cpuCores: 2,
    deviceType: 'desktop',
    platform: 'windows',
    browserCapabilities: {
      sharedArrayBuffer: false,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: false,
      webAssembly: true,
    },
    battery: null,
    isLowEndDevice: true,
    userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36',
    screenWidth: 1366,
    screenHeight: 768,
    devicePixelRatio: 1,
  },

  // iPhone 15 Pro
  iPhone15Pro: {
    memoryGB: 8,
    cpuCores: 6,
    deviceType: 'mobile',
    platform: 'ios',
    browserCapabilities: {
      sharedArrayBuffer: false, // iOS Safari doesn't support this
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: { level: 0.85, charging: false },
    isLowEndDevice: false,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    screenWidth: 393,
    screenHeight: 852,
    devicePixelRatio: 3,
  },

  // iPhone 12 mini
  iPhone12Mini: {
    memoryGB: 4,
    cpuCores: 6,
    deviceType: 'mobile',
    platform: 'ios',
    browserCapabilities: {
      sharedArrayBuffer: false,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: { level: 0.45, charging: true },
    isLowEndDevice: true, // Mobile with <6GB
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    screenWidth: 360,
    screenHeight: 780,
    devicePixelRatio: 3,
  },

  // iPad Pro M2
  iPadProM2: {
    memoryGB: 8,
    cpuCores: 8,
    deviceType: 'tablet',
    platform: 'ios',
    browserCapabilities: {
      sharedArrayBuffer: false,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: { level: 0.92, charging: true },
    isLowEndDevice: false,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    screenWidth: 1024,
    screenHeight: 1366,
    devicePixelRatio: 2,
  },

  // Android high-end (Pixel 8)
  androidHighEnd: {
    memoryGB: 8,
    cpuCores: 8,
    deviceType: 'mobile',
    platform: 'android',
    browserCapabilities: {
      sharedArrayBuffer: true,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: { level: 0.65, charging: false },
    isLowEndDevice: false,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    screenWidth: 412,
    screenHeight: 915,
    devicePixelRatio: 2.625,
  },

  // Android low-end (budget phone)
  androidLowEnd: {
    memoryGB: 2,
    cpuCores: 4,
    deviceType: 'mobile',
    platform: 'android',
    browserCapabilities: {
      sharedArrayBuffer: false,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: false,
      webAssembly: true,
    },
    battery: { level: 0.15, charging: false },
    isLowEndDevice: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-A107F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.0.0 Mobile Safari/537.36',
    screenWidth: 320,
    screenHeight: 568,
    devicePixelRatio: 2,
  },

  // Chromebook
  chromebook: {
    memoryGB: 4,
    cpuCores: 2,
    deviceType: 'desktop',
    platform: 'chromeos',
    browserCapabilities: {
      sharedArrayBuffer: true,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: true,
      webAssembly: true,
    },
    battery: { level: 0.80, charging: false },
    isLowEndDevice: false,
    userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    screenWidth: 1366,
    screenHeight: 768,
    devicePixelRatio: 1,
  },

  // No WebAssembly (very old browser)
  noWebAssembly: {
    memoryGB: 4,
    cpuCores: 2,
    deviceType: 'desktop',
    platform: 'windows',
    browserCapabilities: {
      sharedArrayBuffer: false,
      webWorkers: true,
      webAudio: true,
      offscreenCanvas: false,
      webAssembly: false,
    },
    battery: null,
    isLowEndDevice: true,
    userAgent: 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
    screenWidth: 1024,
    screenHeight: 768,
    devicePixelRatio: 1,
  },
};

/**
 * Mock audio file info for testing recommendations
 */
export const mockAudioFiles = {
  // Short podcast (5 minutes)
  shortPodcast: {
    durationSeconds: 300,
    fileSizeBytes: 5 * 1024 * 1024, // 5MB
    mimeType: 'audio/mp3',
  },

  // Medium podcast (30 minutes)
  mediumPodcast: {
    durationSeconds: 1800,
    fileSizeBytes: 30 * 1024 * 1024, // 30MB
    mimeType: 'audio/mp3',
  },

  // Long podcast (1 hour)
  longPodcast: {
    durationSeconds: 3600,
    fileSizeBytes: 60 * 1024 * 1024, // 60MB
    mimeType: 'audio/mp3',
  },

  // Very long audio (2 hours)
  veryLongAudio: {
    durationSeconds: 7200,
    fileSizeBytes: 120 * 1024 * 1024, // 120MB
    mimeType: 'audio/mp3',
  },

  // Short voice memo (1 minute)
  voiceMemo: {
    durationSeconds: 60,
    fileSizeBytes: 1 * 1024 * 1024, // 1MB
    mimeType: 'audio/m4a',
  },

  // Large WAV file (10 minutes, uncompressed)
  largeWav: {
    durationSeconds: 600,
    fileSizeBytes: 150 * 1024 * 1024, // 150MB
    mimeType: 'audio/wav',
  },
};

/**
 * Mock user agent strings for device detection testing
 */
export const mockUserAgents = {
  // Desktop browsers
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',

  // Mobile browsers
  safariIPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  safariIPad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
  samsungBrowser: 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',

  // Tablets
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  kindleFire: 'Mozilla/5.0 (Linux; Android 9; KFMAWI Build/PS7326.2684N) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.4.1 like Chrome/120.0.6099.230 Safari/537.36',

  // Chrome OS
  chromeOS: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Linux
  chromeLinux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',

  // iPod
  safariIPod: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
};

/**
 * Mock memory snapshots for memory monitor testing
 */
export const mockMemorySnapshots = {
  healthy: {
    timestamp: Date.now(),
    usedHeapMB: 50,
    totalHeapMB: 100,
    heapLimitMB: 512,
    usagePercent: 9.77,
  },
  moderate: {
    timestamp: Date.now(),
    usedHeapMB: 200,
    totalHeapMB: 350,
    heapLimitMB: 512,
    usagePercent: 39.06,
  },
  high: {
    timestamp: Date.now(),
    usedHeapMB: 400,
    totalHeapMB: 450,
    heapLimitMB: 512,
    usagePercent: 78.13,
  },
  critical: {
    timestamp: Date.now(),
    usedHeapMB: 460,
    totalHeapMB: 480,
    heapLimitMB: 512,
    usagePercent: 89.84,
  },
  unavailable: {
    timestamp: Date.now(),
    usedHeapMB: null,
    totalHeapMB: null,
    heapLimitMB: null,
    usagePercent: null,
  },
};

/**
 * Create a sequence of memory snapshots for trend testing
 * @param {'stable'|'increasing'|'decreasing'} trend - Trend type
 * @param {number} count - Number of snapshots
 * @param {number} intervalMs - Interval between snapshots
 * @returns {Array} Array of memory snapshots
 */
export function createMemorySnapshotSequence(trend, count = 10, intervalMs = 1000) {
  const snapshots = [];
  const baseTimestamp = Date.now() - (count * intervalMs);
  const baseUsedMB = 200;

  for (let i = 0; i < count; i++) {
    let usedHeapMB;
    switch (trend) {
      case 'increasing':
        usedHeapMB = baseUsedMB + (i * 10); // +10MB per snapshot
        break;
      case 'decreasing':
        usedHeapMB = baseUsedMB - (i * 5); // -5MB per snapshot
        break;
      case 'stable':
      default:
        usedHeapMB = baseUsedMB + (Math.random() * 2 - 1); // ±1MB random variation
        break;
    }

    snapshots.push({
      timestamp: baseTimestamp + (i * intervalMs),
      usedHeapMB: Math.max(0, usedHeapMB),
      totalHeapMB: 350,
      heapLimitMB: 512,
      usagePercent: (usedHeapMB / 512) * 100,
    });
  }

  return snapshots;
}
