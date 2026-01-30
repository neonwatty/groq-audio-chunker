// Type declarations for browser APIs and custom types

// Vendor-prefixed AudioContext for Safari
interface Window {
  webkitAudioContext: typeof AudioContext;
}

// Global webkitAudioContext for Safari (for typeof checks)
declare var webkitAudioContext: typeof AudioContext | undefined;

// Custom error with status code
interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

// Navigator extensions for device capability detection
interface Navigator {
  // Device Memory API (Chrome, Edge, Opera)
  // Returns approximate RAM in GB: 0.25, 0.5, 1, 2, 4, 8 (capped)
  deviceMemory?: number;

  // Battery Status API
  getBattery?: () => Promise<BatteryManager>;
}

// Battery Status API types
interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => any) | null;
}

// Chrome-specific Performance extensions
interface Performance {
  // Chrome-only memory info
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}
