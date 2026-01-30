/**
 * Memory Monitoring Utility
 *
 * Provides real-time memory monitoring during audio processing.
 * Uses Chrome's performance.memory API when available, with fallbacks.
 */

import { getChromeMemoryInfo } from './capability-detector.js';

/**
 * @typedef {Object} MemorySnapshot
 * @property {number} timestamp - Timestamp of the snapshot
 * @property {number|null} usedHeapMB - Used JS heap in MB (Chrome only)
 * @property {number|null} totalHeapMB - Total JS heap in MB (Chrome only)
 * @property {number|null} heapLimitMB - Heap limit in MB (Chrome only)
 * @property {number|null} usagePercent - Percentage of heap used (Chrome only)
 */

/**
 * @typedef {Object} MemoryTrend
 * @property {'stable'|'increasing'|'decreasing'|'unknown'} trend
 * @property {number} changeRateMBPerSecond - Rate of change in MB/s
 * @property {number|null} estimatedTimeToLimitSeconds - Estimated time until heap limit reached
 */

/**
 * @typedef {Object} MemoryWarning
 * @property {'high_usage'|'rapid_growth'|'near_limit'} type
 * @property {string} message
 * @property {number} severity - 1 (info) to 3 (critical)
 */

/**
 * Memory usage thresholds
 */
const THRESHOLDS = {
  HIGH_USAGE_PERCENT: 70,      // Warn when heap usage > 70%
  CRITICAL_USAGE_PERCENT: 85,  // Critical when heap usage > 85%
  RAPID_GROWTH_MB_PER_SEC: 50, // Warn if memory growing > 50MB/s
  MIN_SAMPLES_FOR_TREND: 3,    // Minimum samples to calculate trend
};

/**
 * Memory Monitor class for tracking memory during processing
 */
export class MemoryMonitor {
  /** @type {MemorySnapshot[]} */
  #snapshots = [];

  /** @type {ReturnType<typeof setInterval>|null} */
  #intervalId = null;

  /** @type {number} */
  #intervalMs;

  /** @type {number} */
  #maxSnapshots;

  /** @type {((warning: MemoryWarning) => void)|null} */
  #onWarning = null;

  /** @type {boolean} */
  #isSupported;

  /**
   * Create a memory monitor
   * @param {Object} options - Monitor options
   * @param {number} [options.intervalMs=1000] - Sampling interval in milliseconds
   * @param {number} [options.maxSnapshots=60] - Maximum number of snapshots to keep
   * @param {(warning: MemoryWarning) => void} [options.onWarning] - Warning callback
   */
  constructor(options = {}) {
    this.#intervalMs = options.intervalMs || 1000;
    this.#maxSnapshots = options.maxSnapshots || 60;
    this.#onWarning = options.onWarning || null;
    this.#isSupported = getChromeMemoryInfo() !== null;
  }

  /**
   * Check if memory monitoring is supported
   * @returns {boolean} True if Chrome memory API is available
   */
  get isSupported() {
    return this.#isSupported;
  }

  /**
   * Check if monitor is currently running
   * @returns {boolean} True if monitoring is active
   */
  get isRunning() {
    return this.#intervalId !== null;
  }

  /**
   * Get all snapshots
   * @returns {MemorySnapshot[]} Array of snapshots
   */
  get snapshots() {
    return [...this.#snapshots];
  }

  /**
   * Take a single memory snapshot
   * @returns {MemorySnapshot} Current memory snapshot
   */
  takeSnapshot() {
    const memInfo = getChromeMemoryInfo();
    const timestamp = Date.now();

    if (!memInfo) {
      return {
        timestamp,
        usedHeapMB: null,
        totalHeapMB: null,
        heapLimitMB: null,
        usagePercent: null,
      };
    }

    const usedHeapMB = memInfo.usedJSHeapSize / (1024 * 1024);
    const totalHeapMB = memInfo.totalJSHeapSize / (1024 * 1024);
    const heapLimitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
    const usagePercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;

    return {
      timestamp,
      usedHeapMB,
      totalHeapMB,
      heapLimitMB,
      usagePercent,
    };
  }

  /**
   * Start continuous monitoring
   */
  start() {
    if (this.#intervalId !== null) {
      return; // Already running
    }

    // Take initial snapshot
    this.#recordSnapshot();

    // Start interval
    this.#intervalId = setInterval(() => {
      this.#recordSnapshot();
    }, this.#intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  /**
   * Clear all snapshots
   */
  clear() {
    this.#snapshots = [];
  }

  /**
   * Reset monitor (stop and clear)
   */
  reset() {
    this.stop();
    this.clear();
  }

  /**
   * Record a snapshot and check for warnings
   */
  #recordSnapshot() {
    const snapshot = this.takeSnapshot();
    this.#snapshots.push(snapshot);

    // Trim old snapshots
    while (this.#snapshots.length > this.#maxSnapshots) {
      this.#snapshots.shift();
    }

    // Check for warnings
    this.#checkWarnings(snapshot);
  }

  /**
   * Check for memory warnings
   * @param {MemorySnapshot} snapshot - Current snapshot
   */
  #checkWarnings(snapshot) {
    if (!this.#onWarning || snapshot.usagePercent === null) {
      return;
    }

    // Check high usage
    if (snapshot.usagePercent >= THRESHOLDS.CRITICAL_USAGE_PERCENT) {
      this.#onWarning({
        type: 'near_limit',
        message: `Memory usage critical: ${snapshot.usagePercent.toFixed(1)}% of heap limit`,
        severity: 3,
      });
    } else if (snapshot.usagePercent >= THRESHOLDS.HIGH_USAGE_PERCENT) {
      this.#onWarning({
        type: 'high_usage',
        message: `Memory usage high: ${snapshot.usagePercent.toFixed(1)}% of heap limit`,
        severity: 2,
      });
    }

    // Check rapid growth
    const trend = this.getTrend();
    if (trend.changeRateMBPerSecond > THRESHOLDS.RAPID_GROWTH_MB_PER_SEC) {
      this.#onWarning({
        type: 'rapid_growth',
        message: `Memory growing rapidly: ${trend.changeRateMBPerSecond.toFixed(1)}MB/s`,
        severity: 2,
      });
    }
  }

  /**
   * Calculate memory usage trend
   * @returns {MemoryTrend} Memory trend analysis
   */
  getTrend() {
    if (this.#snapshots.length < THRESHOLDS.MIN_SAMPLES_FOR_TREND) {
      return {
        trend: 'unknown',
        changeRateMBPerSecond: 0,
        estimatedTimeToLimitSeconds: null,
      };
    }

    // Get recent snapshots with valid data
    const validSnapshots = this.#snapshots.filter(s => s.usedHeapMB !== null);
    if (validSnapshots.length < THRESHOLDS.MIN_SAMPLES_FOR_TREND) {
      return {
        trend: 'unknown',
        changeRateMBPerSecond: 0,
        estimatedTimeToLimitSeconds: null,
      };
    }

    // Calculate linear regression for trend
    const n = validSnapshots.length;
    const firstSnapshot = validSnapshots[0];
    const lastSnapshot = validSnapshots[n - 1];

    const timeDeltaSeconds = (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000;
    if (timeDeltaSeconds === 0) {
      return {
        trend: 'stable',
        changeRateMBPerSecond: 0,
        estimatedTimeToLimitSeconds: null,
      };
    }

    const memoryDeltaMB = lastSnapshot.usedHeapMB - firstSnapshot.usedHeapMB;
    const changeRateMBPerSecond = memoryDeltaMB / timeDeltaSeconds;

    // Determine trend
    /** @type {'stable'|'increasing'|'decreasing'|'unknown'} */
    let trend;
    if (Math.abs(changeRateMBPerSecond) < 1) {
      trend = 'stable';
    } else if (changeRateMBPerSecond > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Estimate time to limit (if growing)
    let estimatedTimeToLimitSeconds = null;
    if (changeRateMBPerSecond > 0 && lastSnapshot.heapLimitMB !== null) {
      const remainingMB = lastSnapshot.heapLimitMB - lastSnapshot.usedHeapMB;
      estimatedTimeToLimitSeconds = remainingMB / changeRateMBPerSecond;
    }

    return {
      trend,
      changeRateMBPerSecond,
      estimatedTimeToLimitSeconds,
    };
  }

  /**
   * Get current memory status summary
   * @returns {{current: MemorySnapshot, trend: MemoryTrend, isHealthy: boolean}}
   */
  getStatus() {
    const current = this.takeSnapshot();
    const trend = this.getTrend();

    // Determine health
    let isHealthy = true;
    if (current.usagePercent !== null) {
      isHealthy = current.usagePercent < THRESHOLDS.HIGH_USAGE_PERCENT;
    }
    if (trend.changeRateMBPerSecond > THRESHOLDS.RAPID_GROWTH_MB_PER_SEC) {
      isHealthy = false;
    }

    return {
      current,
      trend,
      isHealthy,
    };
  }

  /**
   * Get a formatted status string
   * @returns {string} Human-readable status
   */
  getFormattedStatus() {
    const status = this.getStatus();

    if (status.current.usedHeapMB === null) {
      return 'Memory monitoring not available in this browser';
    }

    const lines = [];
    lines.push(`Memory: ${status.current.usedHeapMB.toFixed(1)}MB / ${status.current.heapLimitMB.toFixed(0)}MB (${status.current.usagePercent.toFixed(1)}%)`);
    lines.push(`Trend: ${status.trend.trend} (${status.trend.changeRateMBPerSecond >= 0 ? '+' : ''}${status.trend.changeRateMBPerSecond.toFixed(1)}MB/s)`);

    if (status.trend.estimatedTimeToLimitSeconds !== null && status.trend.estimatedTimeToLimitSeconds < 300) {
      lines.push(`Warning: May reach limit in ${Math.round(status.trend.estimatedTimeToLimitSeconds)}s`);
    }

    return lines.join('\n');
  }
}

/**
 * Create a simple memory monitor with default settings
 * @param {(warning: MemoryWarning) => void} [onWarning] - Warning callback
 * @returns {MemoryMonitor} Memory monitor instance
 */
export function createMemoryMonitor(onWarning = null) {
  return new MemoryMonitor({
    intervalMs: 1000,
    maxSnapshots: 60,
    onWarning,
  });
}

/**
 * Get a single memory reading (no continuous monitoring)
 * @returns {MemorySnapshot} Current memory snapshot
 */
export function getMemorySnapshot() {
  const monitor = new MemoryMonitor();
  return monitor.takeSnapshot();
}

/**
 * Check if memory monitoring is available
 * @returns {boolean} True if Chrome memory API is available
 */
export function isMemoryMonitoringAvailable() {
  return getChromeMemoryInfo() !== null;
}
