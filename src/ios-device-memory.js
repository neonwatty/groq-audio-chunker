/**
 * iOS Device RAM Lookup Table
 *
 * Maps iOS device identifiers to RAM amounts in GB.
 * Used as fallback since navigator.deviceMemory is unavailable on iOS Safari.
 *
 * Sources:
 * - https://iosref.com/ram-processor
 * - https://9to5mac.com/ipad-ram-list-2/
 * - https://9to5mac.com/2023/11/18/iphone-ram-list/
 */

/**
 * iPhone RAM by model identifier
 * Format: 'iPhoneX,Y' -> RAM in GB
 */
const IPHONE_RAM = {
  // iPhone 15 series (2023)
  'iPhone16,1': 8,   // iPhone 15 Pro
  'iPhone16,2': 8,   // iPhone 15 Pro Max
  'iPhone15,4': 6,   // iPhone 15
  'iPhone15,5': 6,   // iPhone 15 Plus

  // iPhone 14 series (2022)
  'iPhone15,2': 6,   // iPhone 14 Pro
  'iPhone15,3': 6,   // iPhone 14 Pro Max
  'iPhone14,7': 6,   // iPhone 14
  'iPhone14,8': 6,   // iPhone 14 Plus

  // iPhone 13 series (2021)
  'iPhone14,2': 6,   // iPhone 13 Pro
  'iPhone14,3': 6,   // iPhone 13 Pro Max
  'iPhone14,5': 4,   // iPhone 13
  'iPhone14,4': 4,   // iPhone 13 mini

  // iPhone 12 series (2020)
  'iPhone13,1': 4,   // iPhone 12 mini
  'iPhone13,2': 4,   // iPhone 12
  'iPhone13,3': 6,   // iPhone 12 Pro
  'iPhone13,4': 6,   // iPhone 12 Pro Max

  // iPhone 11 series (2019)
  'iPhone12,1': 4,   // iPhone 11
  'iPhone12,3': 4,   // iPhone 11 Pro
  'iPhone12,5': 4,   // iPhone 11 Pro Max

  // iPhone XS/XR series (2018)
  'iPhone11,2': 4,   // iPhone XS
  'iPhone11,4': 4,   // iPhone XS Max
  'iPhone11,6': 4,   // iPhone XS Max (China)
  'iPhone11,8': 3,   // iPhone XR

  // iPhone X/8 series (2017)
  'iPhone10,1': 2,   // iPhone 8
  'iPhone10,2': 3,   // iPhone 8 Plus
  'iPhone10,3': 3,   // iPhone X
  'iPhone10,4': 2,   // iPhone 8
  'iPhone10,5': 3,   // iPhone 8 Plus
  'iPhone10,6': 3,   // iPhone X

  // iPhone SE series
  'iPhone14,6': 4,   // iPhone SE (3rd gen, 2022)
  'iPhone12,8': 3,   // iPhone SE (2nd gen, 2020)
  'iPhone8,4': 2,    // iPhone SE (1st gen, 2016)

  // Older models
  'iPhone9,1': 2,    // iPhone 7
  'iPhone9,2': 3,    // iPhone 7 Plus
  'iPhone9,3': 2,    // iPhone 7
  'iPhone9,4': 3,    // iPhone 7 Plus
  'iPhone8,1': 2,    // iPhone 6s
  'iPhone8,2': 2,    // iPhone 6s Plus
};

/**
 * iPad RAM by model identifier
 * Format: 'iPadX,Y' -> RAM in GB
 */
const IPAD_RAM = {
  // iPad Pro M4 (2024)
  'iPad16,3': 8,     // iPad Pro 11" M4 (256/512GB)
  'iPad16,4': 8,     // iPad Pro 11" M4 (256/512GB)
  'iPad16,5': 8,     // iPad Pro 13" M4 (256/512GB)
  'iPad16,6': 8,     // iPad Pro 13" M4 (256/512GB)
  // Note: 1TB/2TB models have 16GB but same identifier

  // iPad Air M2 (2024)
  'iPad14,8': 8,     // iPad Air 11" M2
  'iPad14,9': 8,     // iPad Air 11" M2
  'iPad14,10': 8,    // iPad Air 13" M2
  'iPad14,11': 8,    // iPad Air 13" M2

  // iPad Pro M2 (2022)
  'iPad14,3': 8,     // iPad Pro 11" M2
  'iPad14,4': 8,     // iPad Pro 11" M2
  'iPad14,5': 8,     // iPad Pro 12.9" M2
  'iPad14,6': 8,     // iPad Pro 12.9" M2

  // iPad Pro M1 (2021)
  'iPad13,4': 8,     // iPad Pro 11" M1
  'iPad13,5': 8,     // iPad Pro 11" M1
  'iPad13,6': 8,     // iPad Pro 11" M1
  'iPad13,7': 8,     // iPad Pro 11" M1
  'iPad13,8': 8,     // iPad Pro 12.9" M1
  'iPad13,9': 8,     // iPad Pro 12.9" M1
  'iPad13,10': 8,    // iPad Pro 12.9" M1
  'iPad13,11': 8,    // iPad Pro 12.9" M1

  // iPad Air (2022) M1
  'iPad13,16': 8,    // iPad Air (5th gen) M1
  'iPad13,17': 8,    // iPad Air (5th gen) M1

  // iPad Air (2020)
  'iPad13,1': 4,     // iPad Air (4th gen)
  'iPad13,2': 4,     // iPad Air (4th gen)

  // iPad (10th gen, 2022)
  'iPad13,18': 4,    // iPad (10th gen)
  'iPad13,19': 4,    // iPad (10th gen)

  // iPad (9th gen, 2021)
  'iPad12,1': 3,     // iPad (9th gen)
  'iPad12,2': 3,     // iPad (9th gen)

  // iPad mini (6th gen, 2021)
  'iPad14,1': 4,     // iPad mini (6th gen)
  'iPad14,2': 4,     // iPad mini (6th gen)

  // iPad mini (5th gen, 2019)
  'iPad11,1': 3,     // iPad mini (5th gen)
  'iPad11,2': 3,     // iPad mini (5th gen)

  // Older iPad Pro models
  'iPad8,1': 4,      // iPad Pro 11" (2018)
  'iPad8,2': 4,      // iPad Pro 11" (2018)
  'iPad8,3': 4,      // iPad Pro 11" (2018)
  'iPad8,4': 4,      // iPad Pro 11" (2018)
  'iPad8,5': 4,      // iPad Pro 12.9" (2018)
  'iPad8,6': 4,      // iPad Pro 12.9" (2018)
  'iPad8,7': 4,      // iPad Pro 12.9" (2018)
  'iPad8,8': 4,      // iPad Pro 12.9" (2018)
  'iPad8,9': 6,      // iPad Pro 11" (2020)
  'iPad8,10': 6,     // iPad Pro 11" (2020)
  'iPad8,11': 6,     // iPad Pro 12.9" (2020)
  'iPad8,12': 6,     // iPad Pro 12.9" (2020)

  // Older iPads
  'iPad11,3': 3,     // iPad Air (3rd gen, 2019)
  'iPad11,4': 3,     // iPad Air (3rd gen, 2019)
  'iPad11,6': 3,     // iPad (8th gen, 2020)
  'iPad11,7': 3,     // iPad (8th gen, 2020)
  'iPad7,11': 2,     // iPad (7th gen, 2019)
  'iPad7,12': 2,     // iPad (7th gen, 2019)
};

/**
 * Default RAM values when device can't be identified
 */
const DEFAULTS = {
  iphone: 4,    // Conservative default for unknown iPhone
  ipad: 4,      // Conservative default for unknown iPad
  ipod: 2,      // Conservative default for iPod Touch (older devices)
  unknown: 4,   // Conservative default for any iOS device
};

/**
 * Extract iOS device identifier from user agent
 * @param {string} userAgent - Browser user agent string
 * @returns {string|null} Device identifier like 'iPhone15,2' or null
 */
export function extractIOSDeviceId(userAgent) {
  // iOS user agents don't include device model directly
  // This is a limitation - we can only detect via platform
  // For accurate detection, we'd need to use a fingerprinting library
  // or check screen dimensions + device pixel ratio

  // Check if it's an iOS device
  if (!/iPhone|iPad|iPod/.test(userAgent)) {
    return null;
  }

  // Try to extract from user agent (some browsers include it)
  const match = userAgent.match(/(iPhone|iPad)\d+,\d+/);
  if (match) {
    return match[0];
  }

  return null;
}

/**
 * Detect iOS device type from user agent
 * @param {string} userAgent - Browser user agent string
 * @returns {'iphone'|'ipad'|'ipod'|null} Device type or null if not iOS
 */
export function detectIOSDeviceType(userAgent) {
  if (/iPad/.test(userAgent)) {
    return 'ipad';
  }
  // Check iPod before iPhone since iPod user agents contain "CPU iPhone OS"
  if (/iPod/.test(userAgent)) {
    return 'ipod';
  }
  if (/iPhone/.test(userAgent)) {
    return 'iphone';
  }
  return null;
}

/**
 * Estimate iOS device RAM based on screen size and pixel ratio
 * This is a heuristic when we can't get the exact device model
 * @param {number} screenWidth - Screen width in pixels
 * @param {number} screenHeight - Screen height in pixels
 * @param {number} devicePixelRatio - Device pixel ratio
 * @param {'iphone'|'ipad'} deviceType - Device type
 * @returns {number} Estimated RAM in GB
 */
export function estimateIOSRamByScreen(screenWidth, screenHeight, devicePixelRatio, deviceType) {
  const logicalWidth = screenWidth / devicePixelRatio;
  const logicalHeight = screenHeight / devicePixelRatio;
  const maxDimension = Math.max(logicalWidth, logicalHeight);

  if (deviceType === 'ipad') {
    // iPad screen size heuristics
    if (maxDimension >= 1366) {
      // 12.9" iPad Pro - likely 8GB+
      return 8;
    } else if (maxDimension >= 1180) {
      // 11" iPad Pro or iPad Air - likely 8GB
      return 8;
    } else if (maxDimension >= 1024) {
      // Standard iPad - likely 4GB
      return 4;
    }
    return 4;
  }

  if (deviceType === 'iphone') {
    // iPhone screen size heuristics
    // Pro Max models have larger screens and more RAM
    if (devicePixelRatio >= 3 && maxDimension >= 932) {
      // iPhone 14/15 Pro Max size - 6-8GB
      return 6;
    } else if (devicePixelRatio >= 3 && maxDimension >= 852) {
      // iPhone 14/15 Pro size - 6-8GB
      return 6;
    } else if (devicePixelRatio >= 3 && maxDimension >= 812) {
      // iPhone X and later base models - 4-6GB
      return 4;
    }
    return 4;
  }

  return DEFAULTS.unknown;
}

/**
 * Get RAM for a known iOS device identifier
 * @param {string} deviceId - Device identifier like 'iPhone15,2'
 * @returns {number|null} RAM in GB or null if unknown
 */
export function getRAMForDeviceId(deviceId) {
  if (IPHONE_RAM[deviceId]) {
    return IPHONE_RAM[deviceId];
  }
  if (IPAD_RAM[deviceId]) {
    return IPAD_RAM[deviceId];
  }
  return null;
}

/**
 * Get iOS device RAM with fallbacks
 * @param {string} userAgent - Browser user agent string
 * @param {object} [screenInfo] - Optional screen info for heuristic detection
 * @param {number} [screenInfo.width] - Screen width
 * @param {number} [screenInfo.height] - Screen height
 * @param {number} [screenInfo.devicePixelRatio] - Device pixel ratio
 * @returns {number} Estimated RAM in GB
 */
export function getIOSDeviceRAM(userAgent, screenInfo = null) {
  // First, try to get exact device ID
  const deviceId = extractIOSDeviceId(userAgent);
  if (deviceId) {
    const ram = getRAMForDeviceId(deviceId);
    if (ram) {
      return ram;
    }
  }

  // Get device type
  const deviceType = detectIOSDeviceType(userAgent);
  if (!deviceType) {
    return DEFAULTS.unknown;
  }

  // Try screen-based heuristic
  // Treat 'ipod' as 'iphone' for screen estimation (similar form factors)
  if (screenInfo && screenInfo.width && screenInfo.height && screenInfo.devicePixelRatio) {
    const screenDeviceType = deviceType === 'ipod' ? 'iphone' : deviceType;
    return estimateIOSRamByScreen(
      screenInfo.width,
      screenInfo.height,
      screenInfo.devicePixelRatio,
      screenDeviceType
    );
  }

  // Fall back to conservative defaults
  return DEFAULTS[deviceType] || DEFAULTS.unknown;
}

/**
 * Check if user agent indicates an iOS device
 * @param {string} userAgent - Browser user agent string
 * @returns {boolean} True if iOS device
 */
export function isIOSDevice(userAgent) {
  return /iPhone|iPad|iPod/.test(userAgent);
}

// Export lookup tables for testing
export const _IPHONE_RAM = IPHONE_RAM;
export const _IPAD_RAM = IPAD_RAM;
export const _DEFAULTS = DEFAULTS;
