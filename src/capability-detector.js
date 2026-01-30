/**
 * Device Capability Detection Module
 *
 * Detects device capabilities for audio processing recommendations.
 * Handles cross-browser differences and provides fallbacks.
 */

import { isIOSDevice, getIOSDeviceRAM } from './ios-device-memory.js';

/**
 * @typedef {Object} BrowserCapabilities
 * @property {boolean} sharedArrayBuffer - Whether SharedArrayBuffer is available (needed for FFmpeg multi-threading)
 * @property {boolean} webWorkers - Whether Web Workers are available
 * @property {boolean} webAudio - Whether Web Audio API is available
 * @property {boolean} offscreenCanvas - Whether OffscreenCanvas is available
 * @property {boolean} webAssembly - Whether WebAssembly is available
 */

/**
 * @typedef {Object} BatteryStatus
 * @property {number} level - Battery level from 0 to 1
 * @property {boolean} charging - Whether device is charging
 */

/**
 * @typedef {'mobile'|'tablet'|'desktop'} DeviceType
 */

/**
 * @typedef {'ios'|'android'|'macos'|'windows'|'linux'|'chromeos'|'other'} Platform
 */

/**
 * @typedef {Object} CapabilityReport
 * @property {number} memoryGB - Device memory in GB
 * @property {number} cpuCores - Number of logical CPU cores
 * @property {DeviceType} deviceType - Type of device
 * @property {Platform} platform - Operating system platform
 * @property {BrowserCapabilities} browserCapabilities - Browser feature support
 * @property {BatteryStatus|null} battery - Battery status or null if unavailable
 * @property {boolean} isLowEndDevice - Whether device is considered low-end
 * @property {string} userAgent - Raw user agent string
 * @property {number} screenWidth - Screen width in pixels
 * @property {number} screenHeight - Screen height in pixels
 * @property {number} devicePixelRatio - Device pixel ratio
 */

/**
 * Detect device memory in GB
 * @returns {number} Memory in GB (capped at 8 by browser API)
 */
export function detectDeviceMemory() {
  // navigator.deviceMemory returns approximate RAM in GB
  // Values are bucketed: 0.25, 0.5, 1, 2, 4, 8 (capped)
  // Not available on iOS Safari
  if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
    return navigator.deviceMemory;
  }

  // iOS fallback
  if (typeof navigator !== 'undefined' && isIOSDevice(navigator.userAgent)) {
    const screenInfo = typeof screen !== 'undefined' ? {
      width: screen.width * (window.devicePixelRatio || 1),
      height: screen.height * (window.devicePixelRatio || 1),
      devicePixelRatio: window.devicePixelRatio || 1,
    } : null;

    return getIOSDeviceRAM(navigator.userAgent, screenInfo);
  }

  // Conservative default for unknown devices
  return 4;
}

/**
 * Detect number of logical CPU cores
 * @returns {number} Number of CPU cores
 */
export function detectCPUCores() {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  // Conservative default
  return 2;
}

/**
 * Detect device type from user agent and screen size
 * @returns {DeviceType} Device type classification
 */
export function detectDeviceType() {
  if (typeof navigator === 'undefined') {
    return 'desktop';
  }

  const ua = navigator.userAgent.toLowerCase();

  // Check for tablets first (before mobile, as tablets may match mobile patterns)
  const isTablet = /ipad|tablet|playbook|silk/.test(ua) ||
    ((/android/.test(ua)) && !/mobile/.test(ua));

  if (isTablet) {
    return 'tablet';
  }

  // Check for mobile devices
  const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/.test(ua);

  if (isMobile) {
    return 'mobile';
  }

  // Additional check using screen size for edge cases
  if (typeof screen !== 'undefined') {
    const minDimension = Math.min(screen.width, screen.height);
    if (minDimension < 768) {
      return 'mobile';
    }
  }

  return 'desktop';
}

/**
 * Detect operating system platform
 * @returns {Platform} Platform identifier
 */
export function detectPlatform() {
  if (typeof navigator === 'undefined') {
    return 'other';
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  // iOS detection
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'ios';
  }

  // Android detection
  if (/Android/.test(ua)) {
    return 'android';
  }

  // macOS detection
  if (/Mac/.test(platform) || /Macintosh/.test(ua)) {
    return 'macos';
  }

  // Windows detection
  if (/Win/.test(platform) || /Windows/.test(ua)) {
    return 'windows';
  }

  // Chrome OS detection
  if (/CrOS/.test(ua)) {
    return 'chromeos';
  }

  // Linux detection
  if (/Linux/.test(platform) || /Linux/.test(ua)) {
    return 'linux';
  }

  return 'other';
}

/**
 * Detect browser capabilities for audio processing
 * @returns {BrowserCapabilities} Object with capability flags
 */
export function detectBrowserCapabilities() {
  const capabilities = {
    sharedArrayBuffer: false,
    webWorkers: false,
    webAudio: false,
    offscreenCanvas: false,
    webAssembly: false,
  };

  if (typeof window === 'undefined') {
    return capabilities;
  }

  // SharedArrayBuffer - needed for FFmpeg.wasm multi-threading
  // Requires Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers
  try {
    capabilities.sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  } catch {
    capabilities.sharedArrayBuffer = false;
  }

  // Web Workers
  capabilities.webWorkers = typeof Worker !== 'undefined';

  // Web Audio API
  capabilities.webAudio = typeof AudioContext !== 'undefined' ||
    typeof webkitAudioContext !== 'undefined';

  // OffscreenCanvas - for background canvas operations
  capabilities.offscreenCanvas = typeof OffscreenCanvas !== 'undefined';

  // WebAssembly - required for FFmpeg.wasm
  capabilities.webAssembly = typeof WebAssembly !== 'undefined';

  return capabilities;
}

/**
 * Get battery status if available
 * @returns {Promise<BatteryStatus|null>} Battery status or null
 */
export async function getBatteryStatus() {
  if (typeof navigator === 'undefined' || !navigator.getBattery) {
    return null;
  }

  try {
    const battery = await navigator.getBattery();
    return {
      level: battery.level,
      charging: battery.charging,
    };
  } catch {
    return null;
  }
}

/**
 * Get Chrome-specific memory info if available
 * @returns {{usedJSHeapSize: number, totalJSHeapSize: number, jsHeapSizeLimit: number}|null}
 */
export function getChromeMemoryInfo() {
  if (typeof performance === 'undefined' || !performance.memory) {
    return null;
  }

  return {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
  };
}

/**
 * Determine if device is considered low-end for audio processing
 * @param {number} memoryGB - Device memory in GB
 * @param {number} cpuCores - Number of CPU cores
 * @param {DeviceType} deviceType - Device type
 * @returns {boolean} True if device is low-end
 */
export function isLowEndDevice(memoryGB, cpuCores, deviceType) {
  // Low-end criteria:
  // - Less than 4GB RAM
  // - OR mobile/tablet with less than 6GB RAM
  // - OR fewer than 2 CPU cores

  if (memoryGB < 4) {
    return true;
  }

  if ((deviceType === 'mobile' || deviceType === 'tablet') && memoryGB < 6) {
    return true;
  }

  if (cpuCores < 2) {
    return true;
  }

  return false;
}

/**
 * Get full capability report for the current device
 * @returns {Promise<CapabilityReport>} Complete capability report
 */
export async function getFullCapabilityReport() {
  const memoryGB = detectDeviceMemory();
  const cpuCores = detectCPUCores();
  const deviceType = detectDeviceType();
  const platform = detectPlatform();
  const browserCapabilities = detectBrowserCapabilities();
  const battery = await getBatteryStatus();

  const report = {
    memoryGB,
    cpuCores,
    deviceType,
    platform,
    browserCapabilities,
    battery,
    isLowEndDevice: isLowEndDevice(memoryGB, cpuCores, deviceType),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    screenWidth: typeof screen !== 'undefined' ? screen.width : 0,
    screenHeight: typeof screen !== 'undefined' ? screen.height : 0,
    devicePixelRatio: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
  };

  return report;
}

/**
 * Get a human-readable summary of device capabilities
 * @param {CapabilityReport} report - Capability report
 * @returns {string} Human-readable summary
 */
export function getCapabilitySummary(report) {
  const lines = [];

  // Device info
  const deviceDesc = report.deviceType.charAt(0).toUpperCase() + report.deviceType.slice(1);
  const platformDesc = report.platform.toUpperCase();
  lines.push(`${deviceDesc} (${platformDesc})`);

  // Memory
  lines.push(`Memory: ${report.memoryGB}GB`);

  // CPU
  lines.push(`CPU Cores: ${report.cpuCores}`);

  // Key capabilities
  const caps = [];
  if (report.browserCapabilities.sharedArrayBuffer) {
    caps.push('Multi-threaded FFmpeg');
  }
  if (report.browserCapabilities.webAssembly) {
    caps.push('WebAssembly');
  }
  if (caps.length > 0) {
    lines.push(`Capabilities: ${caps.join(', ')}`);
  }

  // Battery
  if (report.battery) {
    const batteryPct = Math.round(report.battery.level * 100);
    const chargingStatus = report.battery.charging ? ' (charging)' : '';
    lines.push(`Battery: ${batteryPct}%${chargingStatus}`);
  }

  // Warning for low-end
  if (report.isLowEndDevice) {
    lines.push('⚠️ Limited device - shorter audio recommended');
  }

  return lines.join('\n');
}
