/**
 * Unit tests for waveform.js rendering functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  drawWaveform,
  renderChunkMarkers,
  renderChunkList,
  updateChunkStatus,
  renderProgressPips,
  updateProgressPip,
} from '../../src/waveform.js';
import {
  createMockChunk,
  twoChunksWithOverlap,
  threeChunksWithOverlap,
} from '../fixtures/index.js';

describe('drawWaveform', () => {
  let canvas;
  let mockCtx;

  beforeEach(() => {
    // Create a mock canvas with a mocked 2D context
    // happy-dom doesn't fully support canvas 2D context
    mockCtx = {
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    };

    canvas = document.createElement('canvas');
    canvas.style.width = '500px';
    canvas.style.height = '100px';
    document.body.appendChild(canvas);

    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = () => ({
      width: 500,
      height: 100,
      top: 0,
      left: 0,
      right: 500,
      bottom: 100,
    });

    // Mock getContext to return our mock context
    canvas.getContext = vi.fn(() => mockCtx);
  });

  it('should draw waveform without errors', () => {
    const waveformData = [0.1, 0.5, 0.8, 0.3, 0.6];

    expect(() => {
      drawWaveform(canvas, waveformData);
    }).not.toThrow();

    // Verify context was used
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(mockCtx.scale).toHaveBeenCalled();
  });

  it('should handle empty waveform data', () => {
    expect(() => {
      drawWaveform(canvas, []);
    }).not.toThrow();
  });

  it('should accept custom options', () => {
    const waveformData = [0.5, 0.5, 0.5];

    expect(() => {
      drawWaveform(canvas, waveformData, {
        barColor: '#ff0000',
        backgroundColor: '#000000',
        barWidth: 3,
        barGap: 2,
      });
    }).not.toThrow();
  });
});

describe('renderChunkMarkers', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should render markers for multiple chunks', () => {
    const duration = 1200;
    renderChunkMarkers(container, twoChunksWithOverlap, duration);

    // Should have at least one chunk marker (not for first chunk)
    const markers = container.querySelectorAll('.chunk-marker');
    expect(markers.length).toBeGreaterThanOrEqual(1);
  });

  it('should not render marker for first chunk', () => {
    const chunks = [createMockChunk({ index: 0, logicalStart: 0, logicalEnd: 600 })];
    renderChunkMarkers(container, chunks, 600);

    const markers = container.querySelectorAll('.chunk-marker');
    expect(markers.length).toBe(0);
  });

  it('should position markers correctly based on duration', () => {
    const chunks = [
      createMockChunk({ index: 0, logicalStart: 0, logicalEnd: 500 }),
      createMockChunk({ index: 1, logicalStart: 500, logicalEnd: 1000 }),
    ];
    renderChunkMarkers(container, chunks, 1000);

    const marker = container.querySelector('.chunk-marker');
    expect(marker).not.toBeNull();
    // Marker should be at 50% (500/1000)
    expect(marker.style.left).toBe('50%');
  });

  it('should render overlap regions', () => {
    renderChunkMarkers(container, twoChunksWithOverlap, 1200);

    const overlapRegions = container.querySelectorAll('.overlap-region');
    // Two chunks with overlap should have overlap regions
    expect(overlapRegions.length).toBeGreaterThanOrEqual(1);
  });

  it('should clear container before rendering', () => {
    container.innerHTML = '<div class="old-content">Old</div>';

    renderChunkMarkers(container, twoChunksWithOverlap, 1200);

    const oldContent = container.querySelector('.old-content');
    expect(oldContent).toBeNull();
  });
});

describe('renderChunkList', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should render correct number of chunk items', () => {
    renderChunkList(container, threeChunksWithOverlap);

    const items = container.querySelectorAll('.chunk-item');
    expect(items.length).toBe(threeChunksWithOverlap.length);
  });

  it('should display chunk number', () => {
    const chunks = [createMockChunk({ index: 0 })];
    renderChunkList(container, chunks);

    const chunkNumber = container.querySelector('.chunk-number');
    expect(chunkNumber.textContent).toContain('1');
  });

  it('should show pending status initially', () => {
    const chunks = [createMockChunk()];
    renderChunkList(container, chunks);

    const status = container.querySelector('.chunk-status');
    expect(status.classList.contains('pending')).toBe(true);
    expect(status.textContent).toBe('Pending');
  });

  it('should display time range', () => {
    const chunk = createMockChunk({ logicalStart: 0, logicalEnd: 600 });
    renderChunkList(container, [chunk]);

    const timeElement = container.querySelector('.chunk-time');
    expect(timeElement.textContent).toContain('0:00');
    expect(timeElement.textContent).toContain('10:00');
  });

  it('should show overlap badge when chunk has overlap', () => {
    const chunk = createMockChunk({
      overlapLeading: 10,
      overlapTrailing: 10,
    });
    renderChunkList(container, [chunk]);

    const badge = container.querySelector('.overlap-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('overlap');
  });

  it('should not show overlap badge when no overlap', () => {
    const chunk = createMockChunk({
      overlapLeading: 0,
      overlapTrailing: 0,
    });
    renderChunkList(container, [chunk]);

    const badge = container.querySelector('.overlap-badge');
    expect(badge).toBeNull();
  });

  it('should set data-chunk-index attribute', () => {
    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1 }),
    ];
    renderChunkList(container, chunks);

    const items = container.querySelectorAll('.chunk-item');
    expect(items[0].dataset.chunkIndex).toBe('0');
    expect(items[1].dataset.chunkIndex).toBe('1');
  });
});

describe('updateChunkStatus', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    renderChunkList(container, [createMockChunk({ index: 0 })]);
  });

  it('should update status to processing', () => {
    updateChunkStatus(container, 0, 'processing');

    const status = container.querySelector('.chunk-status');
    expect(status.classList.contains('processing')).toBe(true);
    expect(status.textContent).toBe('Processing...');
  });

  it('should update status to done', () => {
    updateChunkStatus(container, 0, 'done');

    const status = container.querySelector('.chunk-status');
    expect(status.classList.contains('done')).toBe(true);
    expect(status.textContent).toBe('Done');
  });

  it('should update status to error', () => {
    updateChunkStatus(container, 0, 'error');

    const status = container.querySelector('.chunk-status');
    expect(status.classList.contains('error')).toBe(true);
    expect(status.textContent).toBe('Error');
  });

  it('should display custom extra text', () => {
    updateChunkStatus(container, 0, 'processing', 'Retrying (2/5)...');

    const status = container.querySelector('.chunk-status');
    expect(status.textContent).toBe('Retrying (2/5)...');
  });

  it('should handle non-existent chunk index gracefully', () => {
    expect(() => {
      updateChunkStatus(container, 99, 'done');
    }).not.toThrow();
  });

  it('should remove previous status class', () => {
    updateChunkStatus(container, 0, 'processing');
    updateChunkStatus(container, 0, 'done');

    const status = container.querySelector('.chunk-status');
    expect(status.classList.contains('processing')).toBe(false);
    expect(status.classList.contains('done')).toBe(true);
  });
});

describe('renderProgressPips', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('should render correct number of pips', () => {
    renderProgressPips(container, 5);

    const pips = container.querySelectorAll('.chunk-pip');
    expect(pips.length).toBe(5);
  });

  it('should number pips starting from 1', () => {
    renderProgressPips(container, 3);

    const pips = container.querySelectorAll('.chunk-pip');
    expect(pips[0].textContent).toBe('1');
    expect(pips[1].textContent).toBe('2');
    expect(pips[2].textContent).toBe('3');
  });

  it('should set data-chunk-index attribute', () => {
    renderProgressPips(container, 3);

    const pips = container.querySelectorAll('.chunk-pip');
    expect(pips[0].dataset.chunkIndex).toBe('0');
    expect(pips[1].dataset.chunkIndex).toBe('1');
    expect(pips[2].dataset.chunkIndex).toBe('2');
  });

  it('should clear container before rendering', () => {
    container.innerHTML = '<div>Old content</div>';
    renderProgressPips(container, 2);

    expect(container.children.length).toBe(2);
    expect(container.querySelector('div:not(.chunk-pip)')).toBeNull();
  });

  it('should handle zero chunks', () => {
    renderProgressPips(container, 0);

    const pips = container.querySelectorAll('.chunk-pip');
    expect(pips.length).toBe(0);
  });
});

describe('updateProgressPip', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    renderProgressPips(container, 3);
  });

  it('should update pip to processing status', () => {
    updateProgressPip(container, 0, 'processing');

    const pip = container.querySelector('[data-chunk-index="0"]');
    expect(pip.classList.contains('processing')).toBe(true);
  });

  it('should update pip to done status', () => {
    updateProgressPip(container, 1, 'done');

    const pip = container.querySelector('[data-chunk-index="1"]');
    expect(pip.classList.contains('done')).toBe(true);
  });

  it('should update pip to error status', () => {
    updateProgressPip(container, 2, 'error');

    const pip = container.querySelector('[data-chunk-index="2"]');
    expect(pip.classList.contains('error')).toBe(true);
  });

  it('should replace previous status class', () => {
    updateProgressPip(container, 0, 'processing');
    updateProgressPip(container, 0, 'done');

    const pip = container.querySelector('[data-chunk-index="0"]');
    expect(pip.classList.contains('processing')).toBe(false);
    expect(pip.classList.contains('done')).toBe(true);
  });

  it('should handle non-existent chunk index gracefully', () => {
    expect(() => {
      updateProgressPip(container, 99, 'done');
    }).not.toThrow();
  });
});
