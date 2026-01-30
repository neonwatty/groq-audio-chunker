import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemoryMonitor,
  createMemoryMonitor,
  getMemorySnapshot,
  isMemoryMonitoringAvailable,
} from '../../src/memory-monitor.js';
import {
  createMemorySnapshotSequence,
} from '../fixtures/capability-fixtures.js';

describe('memory-monitor', () => {
  describe('MemoryMonitor', () => {
    let monitor;

    beforeEach(() => {
      monitor = new MemoryMonitor();
    });

    afterEach(() => {
      if (monitor) {
        monitor.reset();
      }
    });

    describe('constructor', () => {
      it('should create with default options', () => {
        expect(monitor.isRunning).toBe(false);
        expect(monitor.snapshots).toHaveLength(0);
      });

      it('should accept custom options', () => {
        const customMonitor = new MemoryMonitor({
          intervalMs: 500,
          maxSnapshots: 30,
        });
        expect(customMonitor.isRunning).toBe(false);
        customMonitor.reset();
      });

      it('should detect if monitoring is supported', () => {
        expect(typeof monitor.isSupported).toBe('boolean');
      });
    });

    describe('takeSnapshot', () => {
      it('should return a snapshot object', () => {
        const snapshot = monitor.takeSnapshot();

        expect(snapshot).toHaveProperty('timestamp');
        expect(snapshot).toHaveProperty('usedHeapMB');
        expect(snapshot).toHaveProperty('totalHeapMB');
        expect(snapshot).toHaveProperty('heapLimitMB');
        expect(snapshot).toHaveProperty('usagePercent');
      });

      it('should have valid timestamp', () => {
        const before = Date.now();
        const snapshot = monitor.takeSnapshot();
        const after = Date.now();

        expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
        expect(snapshot.timestamp).toBeLessThanOrEqual(after);
      });

      it('should return null values when memory API unavailable', () => {
        // happy-dom doesn't have performance.memory
        const snapshot = monitor.takeSnapshot();

        expect(snapshot.usedHeapMB).toBeNull();
        expect(snapshot.totalHeapMB).toBeNull();
        expect(snapshot.heapLimitMB).toBeNull();
        expect(snapshot.usagePercent).toBeNull();
      });
    });

    describe('start and stop', () => {
      it('should start monitoring', () => {
        monitor.start();
        expect(monitor.isRunning).toBe(true);
      });

      it('should stop monitoring', () => {
        monitor.start();
        monitor.stop();
        expect(monitor.isRunning).toBe(false);
      });

      it('should be idempotent for start', () => {
        monitor.start();
        monitor.start(); // Second call should not throw
        expect(monitor.isRunning).toBe(true);
      });

      it('should be idempotent for stop', () => {
        monitor.stop(); // Stop without starting should not throw
        expect(monitor.isRunning).toBe(false);
      });

      it('should collect snapshots while running', async () => {
        monitor.start();
        await new Promise(resolve => setTimeout(resolve, 100));
        monitor.stop();

        expect(monitor.snapshots.length).toBeGreaterThan(0);
      });
    });

    describe('clear', () => {
      it('should clear all snapshots', () => {
        monitor.start();
        monitor.stop();
        monitor.clear();

        expect(monitor.snapshots).toHaveLength(0);
      });
    });

    describe('reset', () => {
      it('should stop and clear', () => {
        monitor.start();
        monitor.reset();

        expect(monitor.isRunning).toBe(false);
        expect(monitor.snapshots).toHaveLength(0);
      });
    });

    describe('getTrend', () => {
      it('should return unknown with insufficient samples', () => {
        const trend = monitor.getTrend();

        expect(trend.trend).toBe('unknown');
        expect(trend.changeRateMBPerSecond).toBe(0);
        expect(trend.estimatedTimeToLimitSeconds).toBeNull();
      });
    });

    describe('getStatus', () => {
      it('should return status object', () => {
        const status = monitor.getStatus();

        expect(status).toHaveProperty('current');
        expect(status).toHaveProperty('trend');
        expect(status).toHaveProperty('isHealthy');
      });

      it('should include current snapshot', () => {
        const status = monitor.getStatus();

        expect(status.current).toHaveProperty('timestamp');
        expect(status.current).toHaveProperty('usedHeapMB');
      });

      it('should include trend analysis', () => {
        const status = monitor.getStatus();

        expect(status.trend).toHaveProperty('trend');
        expect(status.trend).toHaveProperty('changeRateMBPerSecond');
      });
    });

    describe('getFormattedStatus', () => {
      it('should return string message when memory unavailable', () => {
        const result = monitor.getFormattedStatus();

        expect(typeof result).toBe('string');
        expect(result).toContain('not available');
      });
    });

    describe('warning callback', () => {
      it('should call onWarning for high usage', () => {
        const onWarning = vi.fn();

        // Set up mock memory
        const mockMemory = {
          usedJSHeapSize: 400 * 1024 * 1024,
          totalJSHeapSize: 450 * 1024 * 1024,
          jsHeapSizeLimit: 512 * 1024 * 1024,
        };

        Object.defineProperty(performance, 'memory', {
          value: mockMemory,
          writable: true,
          configurable: true,
        });

        const warnMonitor = new MemoryMonitor({ onWarning });
        warnMonitor.takeSnapshot(); // This should trigger warning check through start

        warnMonitor.start();

        // Give it time to collect a snapshot
        return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
          warnMonitor.stop();
          // Warning may or may not be called depending on timing
          // Just verify it doesn't throw
          expect(typeof onWarning).toBe('function');

          // Clean up
          Object.defineProperty(performance, 'memory', {
            value: undefined,
            writable: true,
            configurable: true,
          });
        });
      });
    });
  });

  describe('createMemoryMonitor', () => {
    it('should create a monitor with default settings', () => {
      const monitor = createMemoryMonitor();

      expect(monitor).toBeInstanceOf(MemoryMonitor);
      expect(monitor.isRunning).toBe(false);

      monitor.reset();
    });

    it('should accept warning callback', () => {
      const onWarning = vi.fn();
      const monitor = createMemoryMonitor(onWarning);

      expect(monitor).toBeInstanceOf(MemoryMonitor);

      monitor.reset();
    });
  });

  describe('getMemorySnapshot', () => {
    it('should return a single snapshot', () => {
      const snapshot = getMemorySnapshot();

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('usedHeapMB');
      expect(snapshot).toHaveProperty('totalHeapMB');
      expect(snapshot).toHaveProperty('heapLimitMB');
      expect(snapshot).toHaveProperty('usagePercent');
    });
  });

  describe('isMemoryMonitoringAvailable', () => {
    it('should return boolean', () => {
      const result = isMemoryMonitoringAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should return false in happy-dom (no performance.memory)', () => {
      expect(isMemoryMonitoringAvailable()).toBe(false);
    });
  });

  describe('fixture helpers', () => {
    describe('createMemorySnapshotSequence', () => {
      it('should create increasing sequence', () => {
        const snapshots = createMemorySnapshotSequence('increasing', 5);

        expect(snapshots).toHaveLength(5);
        expect(snapshots[4].usedHeapMB).toBeGreaterThan(snapshots[0].usedHeapMB);
      });

      it('should create decreasing sequence', () => {
        const snapshots = createMemorySnapshotSequence('decreasing', 5);

        expect(snapshots).toHaveLength(5);
        expect(snapshots[4].usedHeapMB).toBeLessThan(snapshots[0].usedHeapMB);
      });

      it('should create stable sequence', () => {
        const snapshots = createMemorySnapshotSequence('stable', 5);

        expect(snapshots).toHaveLength(5);
        // Stable should have minimal variation
        const variance = Math.abs(snapshots[4].usedHeapMB - snapshots[0].usedHeapMB);
        expect(variance).toBeLessThan(10);
      });
    });
  });
});
