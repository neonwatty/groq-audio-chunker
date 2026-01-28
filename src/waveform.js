/**
 * Waveform visualization and chunk marker rendering
 */

/**
 * Draw waveform on canvas
 */
export function drawWaveform(canvas, waveformData, options = {}) {
  const {
    barColor = '#f97316',
    backgroundColor = 'transparent',
    barWidth = 2,
    barGap = 1
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size accounting for device pixel ratio
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Clear canvas
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Calculate bar dimensions
  const numBars = waveformData.length;
  const totalBarWidth = barWidth + barGap;
  const startX = (width - numBars * totalBarWidth) / 2;

  // Draw bars
  ctx.fillStyle = barColor;

  for (let i = 0; i < numBars; i++) {
    const amplitude = waveformData[i];
    const barHeight = Math.max(2, amplitude * height * 0.9);
    const x = startX + i * totalBarWidth;
    const y = (height - barHeight) / 2;

    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

/**
 * Render chunk markers on the waveform
 */
export function renderChunkMarkers(container, chunks, duration) {
  container.innerHTML = '';

  chunks.forEach((chunk, index) => {
    // Skip the first chunk's start marker (it's at 0)
    if (index > 0) {
      const position = (chunk.start / duration) * 100;

      const marker = document.createElement('div');
      marker.className = 'chunk-marker';
      marker.style.left = `${position}%`;
      marker.dataset.time = formatTime(chunk.start);

      container.appendChild(marker);
    }

    // Render silence region if detected
    if (chunk.cutInfo.type === 'silence' && chunk.cutInfo.silence) {
      const silence = chunk.cutInfo.silence;
      const startPos = (silence.start / duration) * 100;
      const endPos = (silence.end / duration) * 100;

      const region = document.createElement('div');
      region.className = 'silence-region';
      region.style.left = `${startPos}%`;
      region.style.width = `${endPos - startPos}%`;
      region.title = `Silence: ${(silence.duration / 1000).toFixed(1)}s`;

      container.appendChild(region);
    }
  });
}

/**
 * Render chunk list UI
 */
export function renderChunkList(container, chunks) {
  container.innerHTML = '';

  chunks.forEach((chunk, index) => {
    const item = document.createElement('div');
    item.className = 'chunk-item';
    item.dataset.chunkIndex = index;

    const cutType = chunk.cutInfo.type === 'silence' ? '🔇' : '✂️';
    const cutLabel = chunk.cutInfo.type === 'silence' ? 'silence cut' : 'exact cut';

    item.innerHTML = `
      <div class="chunk-item-header">
        <span class="chunk-number">Chunk ${index + 1}</span>
        <span class="chunk-status pending">Pending</span>
      </div>
      <div class="chunk-time">
        ${formatTime(chunk.start)} → ${formatTime(chunk.end)}
      </div>
      <div class="chunk-duration">
        ${formatDuration(chunk.duration)} ${cutType} <small>${cutLabel}</small>
      </div>
    `;

    container.appendChild(item);
  });
}

/**
 * Update chunk status in the UI
 */
export function updateChunkStatus(container, chunkIndex, status, extra = '') {
  const item = container.querySelector(`[data-chunk-index="${chunkIndex}"]`);
  if (!item) return;

  const statusEl = item.querySelector('.chunk-status');
  statusEl.className = `chunk-status ${status}`;

  const statusLabels = {
    pending: 'Pending',
    processing: 'Processing...',
    done: 'Done',
    error: 'Error'
  };

  statusEl.textContent = extra || statusLabels[status] || status;
}

/**
 * Render progress pips
 */
export function renderProgressPips(container, numChunks) {
  container.innerHTML = '';

  for (let i = 0; i < numChunks; i++) {
    const pip = document.createElement('div');
    pip.className = 'chunk-pip';
    pip.dataset.chunkIndex = i;
    pip.textContent = i + 1;
    container.appendChild(pip);
  }
}

/**
 * Update progress pip status
 */
export function updateProgressPip(container, chunkIndex, status) {
  const pip = container.querySelector(`[data-chunk-index="${chunkIndex}"]`);
  if (pip) {
    pip.className = `chunk-pip ${status}`;
  }
}

// Helper functions
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}
