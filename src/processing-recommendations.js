/**
 * Processing Recommendations Module
 *
 * Provides recommendations for audio processing settings based on
 * device capabilities, file size, and audio duration.
 */

import { getFullCapabilityReport } from './capability-detector.js';

/**
 * @typedef {Object} ProcessingRecommendation
 * @property {boolean} canProcess - Whether device can likely process the audio
 * @property {number} recommendedChunkDuration - Recommended chunk duration in seconds
 * @property {number} maxRecommendedDuration - Maximum recommended audio duration in minutes
 * @property {string} confidenceLevel - 'high', 'medium', or 'low'
 * @property {string[]} warnings - Array of warning messages
 * @property {string[]} tips - Array of helpful tips
 */

/**
 * @typedef {Object} AudioFileInfo
 * @property {number} durationSeconds - Audio duration in seconds
 * @property {number} fileSizeBytes - File size in bytes
 * @property {string} [mimeType] - Audio MIME type
 */

/**
 * Processing thresholds based on device memory
 * Maps memory (GB) to max recommended duration (minutes)
 */
const MEMORY_TO_MAX_DURATION = {
  2: 15,    // 2GB or less: 15 minutes max
  4: 30,    // 4GB: 30 minutes
  6: 60,    // 6GB: 1 hour
  8: 120,   // 8GB: 2 hours
  16: 180,  // 16GB+: 3 hours
};

/**
 * Chunk duration recommendations based on device memory
 * Maps memory (GB) to recommended chunk duration (seconds)
 */
const MEMORY_TO_CHUNK_DURATION = {
  2: 180,   // 2GB: 3-minute chunks (conservative)
  4: 300,   // 4GB: 5-minute chunks
  6: 420,   // 6GB: 7-minute chunks
  8: 600,   // 8GB+: 10-minute chunks (default)
};

/**
 * Get the appropriate threshold value for a given memory amount
 * @param {Object} thresholds - Threshold mapping object
 * @param {number} memoryGB - Device memory in GB
 * @returns {number} Threshold value
 */
function getThresholdForMemory(thresholds, memoryGB) {
  const memoryLevels = Object.keys(thresholds).map(Number).sort((a, b) => a - b);

  // Find the highest threshold that's <= our memory
  let applicableLevel = memoryLevels[0];
  for (const level of memoryLevels) {
    if (memoryGB >= level) {
      applicableLevel = level;
    }
  }

  return thresholds[applicableLevel];
}

/**
 * Calculate estimated memory usage for processing
 * @param {number} durationSeconds - Audio duration in seconds
 * @param {number} fileSizeBytes - File size in bytes
 * @returns {number} Estimated memory usage in GB
 */
export function estimateMemoryUsage(durationSeconds, fileSizeBytes) {
  // FFmpeg.wasm memory overhead ~100MB base
  const ffmpegBaseMemoryGB = 0.1;

  // Audio data in memory (decoded PCM is larger than compressed)
  // Assume 16-bit stereo at 44.1kHz = ~10MB per minute of audio
  const pcmMemoryGB = (durationSeconds / 60) * 0.01;

  // Working memory for transcoding (roughly 2x the PCM size)
  const workingMemoryGB = pcmMemoryGB * 2;

  // File buffer (original file in memory)
  const fileBufferGB = fileSizeBytes / (1024 * 1024 * 1024);

  // JavaScript heap overhead (~50MB)
  const jsOverheadGB = 0.05;

  return ffmpegBaseMemoryGB + pcmMemoryGB + workingMemoryGB + fileBufferGB + jsOverheadGB;
}

/**
 * Get processing recommendation based on device capabilities and audio info
 * @param {AudioFileInfo} audioInfo - Information about the audio file
 * @param {import('./capability-detector.js').CapabilityReport} [capabilities] - Pre-fetched capabilities (optional)
 * @returns {Promise<ProcessingRecommendation>} Processing recommendation
 */
export async function getProcessingRecommendation(audioInfo, capabilities = null) {
  const caps = capabilities || await getFullCapabilityReport();

  const warnings = [];
  const tips = [];

  const durationMinutes = audioInfo.durationSeconds / 60;
  const maxDuration = getThresholdForMemory(MEMORY_TO_MAX_DURATION, caps.memoryGB);
  const recommendedChunk = getThresholdForMemory(MEMORY_TO_CHUNK_DURATION, caps.memoryGB);

  // Estimate memory usage
  const estimatedMemory = estimateMemoryUsage(audioInfo.durationSeconds, audioInfo.fileSizeBytes);
  const availableMemory = caps.memoryGB * 0.7; // Assume 70% available for our use

  // Determine if processing is feasible
  let canProcess = true;
  let confidenceLevel = 'high';

  // Check memory constraints
  if (estimatedMemory > availableMemory) {
    warnings.push(`Estimated memory usage (${estimatedMemory.toFixed(1)}GB) may exceed available memory`);
    confidenceLevel = 'low';
  }

  // Check duration against recommendations
  if (durationMinutes > maxDuration) {
    warnings.push(`Audio duration (${Math.round(durationMinutes)} min) exceeds recommended maximum (${maxDuration} min) for this device`);
    confidenceLevel = 'low';
  } else if (durationMinutes > maxDuration * 0.8) {
    warnings.push('Audio duration is near the recommended limit for this device');
    if (confidenceLevel === 'high') {
      confidenceLevel = 'medium';
    }
  }

  // Check browser capabilities
  if (!caps.browserCapabilities.webAssembly) {
    warnings.push('WebAssembly not supported - audio processing unavailable');
    canProcess = false;
  }

  if (!caps.browserCapabilities.sharedArrayBuffer) {
    tips.push('Multi-threaded processing unavailable - processing may be slower');
  }

  // Low-end device warning
  if (caps.isLowEndDevice) {
    warnings.push('Limited device detected - consider shorter audio files');
    if (confidenceLevel === 'high') {
      confidenceLevel = 'medium';
    }
  }

  // Battery warning for mobile devices
  if (caps.battery && !caps.battery.charging && caps.battery.level < 0.2) {
    warnings.push('Low battery - consider charging device before processing');
  }

  // Device-specific tips
  if (caps.deviceType === 'mobile') {
    tips.push('Keep the app in foreground during processing');
    tips.push('Disable auto-lock to prevent interruption');
  }

  if (caps.platform === 'ios') {
    tips.push('Safari works best for audio processing on iOS');
  }

  // File size tips
  const fileSizeMB = audioInfo.fileSizeBytes / (1024 * 1024);
  if (fileSizeMB > 100) {
    tips.push('Large file detected - initial loading may take a moment');
  }

  return {
    canProcess,
    recommendedChunkDuration: recommendedChunk,
    maxRecommendedDuration: maxDuration,
    confidenceLevel,
    warnings,
    tips,
  };
}

/**
 * Get a quick assessment without full capability detection
 * Useful for UI hints before user selects a file
 * @returns {Promise<{maxDuration: number, deviceTier: string, tips: string[]}>}
 */
export async function getQuickAssessment() {
  const caps = await getFullCapabilityReport();

  const maxDuration = getThresholdForMemory(MEMORY_TO_MAX_DURATION, caps.memoryGB);

  let deviceTier;
  if (caps.memoryGB >= 8 && caps.cpuCores >= 4) {
    deviceTier = 'high';
  } else if (caps.memoryGB >= 4 && caps.cpuCores >= 2) {
    deviceTier = 'medium';
  } else {
    deviceTier = 'low';
  }

  const tips = [];
  if (deviceTier === 'low') {
    tips.push(`Recommended for audio up to ${maxDuration} minutes`);
  }

  if (!caps.browserCapabilities.sharedArrayBuffer) {
    tips.push('For faster processing, use Chrome or Firefox with cross-origin isolation');
  }

  return {
    maxDuration,
    deviceTier,
    tips,
  };
}

/**
 * Format a recommendation for display to users
 * @param {ProcessingRecommendation} recommendation - Processing recommendation
 * @returns {string} Human-readable recommendation
 */
export function formatRecommendation(recommendation) {
  const lines = [];

  if (recommendation.canProcess) {
    lines.push(`Ready to process (confidence: ${recommendation.confidenceLevel})`);
    lines.push(`Recommended chunk size: ${recommendation.recommendedChunkDuration / 60} minutes`);
  } else {
    lines.push('Unable to process this audio file');
  }

  if (recommendation.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    recommendation.warnings.forEach(w => lines.push(`  - ${w}`));
  }

  if (recommendation.tips.length > 0) {
    lines.push('');
    lines.push('Tips:');
    recommendation.tips.forEach(t => lines.push(`  - ${t}`));
  }

  return lines.join('\n');
}

/**
 * Check if audio duration is safe for the current device
 * @param {number} durationSeconds - Audio duration in seconds
 * @param {import('./capability-detector.js').CapabilityReport} [capabilities] - Pre-fetched capabilities
 * @returns {Promise<{safe: boolean, reason?: string}>}
 */
export async function isDurationSafe(durationSeconds, capabilities = null) {
  const caps = capabilities || await getFullCapabilityReport();
  const maxDuration = getThresholdForMemory(MEMORY_TO_MAX_DURATION, caps.memoryGB);
  const durationMinutes = durationSeconds / 60;

  if (durationMinutes <= maxDuration) {
    return { safe: true };
  }

  return {
    safe: false,
    reason: `Audio duration (${Math.round(durationMinutes)} min) exceeds the recommended maximum (${maxDuration} min) for your device with ${caps.memoryGB}GB memory`,
  };
}
