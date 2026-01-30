/**
 * Pre-flight Check UI Component
 *
 * Displays device capabilities and processing recommendations
 * before users start transcription.
 */

import { getFullCapabilityReport } from './capability-detector.js';
import { getProcessingRecommendation, isDurationSafe } from './processing-recommendations.js';

/**
 * @typedef {Object} PreflightElements
 * @property {HTMLElement} container - Main container element
 * @property {HTMLElement} deviceInfo - Device info display
 * @property {HTMLElement} recommendation - Recommendation display
 * @property {HTMLElement} warnings - Warnings list
 * @property {HTMLElement} tips - Tips list
 */

/** @type {import('./capability-detector.js').CapabilityReport|null} */
let cachedCapabilities = null;

/**
 * Create the pre-flight check UI elements
 * @returns {PreflightElements} Created elements
 */
export function createPreflightUI() {
  const container = document.createElement('div');
  container.id = 'preflightCheck';
  container.className = 'preflight-container';
  container.hidden = true;

  container.innerHTML = `
    <div class="preflight-header">
      <h3>📊 Device Check</h3>
      <button type="button" class="preflight-toggle" aria-label="Toggle details">▼</button>
    </div>
    <div class="preflight-content">
      <div class="preflight-device" id="preflightDevice">
        <div class="device-loading">Checking device capabilities...</div>
      </div>
      <div class="preflight-recommendation" id="preflightRecommendation" hidden>
        <div class="recommendation-status" id="recommendationStatus"></div>
        <div class="recommendation-details" id="recommendationDetails"></div>
      </div>
      <div class="preflight-warnings" id="preflightWarnings" hidden>
        <h4>⚠️ Warnings</h4>
        <ul id="warningsList"></ul>
      </div>
      <div class="preflight-tips" id="preflightTips" hidden>
        <h4>💡 Tips</h4>
        <ul id="tipsList"></ul>
      </div>
    </div>
  `;

  // Set up toggle functionality
  /** @type {HTMLButtonElement} */
  const toggle = container.querySelector('.preflight-toggle');
  /** @type {HTMLElement} */
  const content = container.querySelector('.preflight-content');

  toggle.addEventListener('click', () => {
    const isExpanded = !content.hidden;
    content.hidden = isExpanded;
    toggle.textContent = isExpanded ? '▶' : '▼';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
  });

  return {
    container,
    deviceInfo: /** @type {HTMLElement} */ (container.querySelector('#preflightDevice')),
    recommendation: /** @type {HTMLElement} */ (container.querySelector('#preflightRecommendation')),
    warnings: /** @type {HTMLElement} */ (container.querySelector('#preflightWarnings')),
    tips: /** @type {HTMLElement} */ (container.querySelector('#preflightTips')),
  };
}

/**
 * Initialize the pre-flight UI and detect device capabilities
 * @param {PreflightElements} elements - UI elements
 */
export async function initializePreflight(elements) {
  try {
    cachedCapabilities = await getFullCapabilityReport();
    displayDeviceInfo(elements.deviceInfo, cachedCapabilities);
  } catch (error) {
    elements.deviceInfo.innerHTML = `
      <div class="device-error">
        Unable to detect device capabilities: ${error.message}
      </div>
    `;
  }
}

/**
 * Display device information
 * @param {HTMLElement} container - Container element
 * @param {import('./capability-detector.js').CapabilityReport} capabilities - Device capabilities
 */
function displayDeviceInfo(container, capabilities) {
  const deviceType = capabilities.deviceType.charAt(0).toUpperCase() + capabilities.deviceType.slice(1);
  const platform = capabilities.platform.toUpperCase();

  // Determine device tier and icon
  let tierIcon, tierClass;
  if (capabilities.memoryGB >= 8 && capabilities.cpuCores >= 4) {
    tierIcon = '🟢';
    tierClass = 'tier-high';
  } else if (capabilities.memoryGB >= 4 && capabilities.cpuCores >= 2) {
    tierIcon = '🟡';
    tierClass = 'tier-medium';
  } else {
    tierIcon = '🔴';
    tierClass = 'tier-low';
  }

  // Build capability badges
  const badges = [];
  if (capabilities.browserCapabilities.webAssembly) {
    badges.push('<span class="capability-badge supported">WebAssembly</span>');
  } else {
    badges.push('<span class="capability-badge unsupported">No WebAssembly</span>');
  }

  if (capabilities.browserCapabilities.sharedArrayBuffer) {
    badges.push('<span class="capability-badge supported">Multi-threaded</span>');
  } else {
    badges.push('<span class="capability-badge limited">Single-threaded</span>');
  }

  container.innerHTML = `
    <div class="device-summary ${tierClass}">
      <span class="device-tier-icon">${tierIcon}</span>
      <span class="device-type">${deviceType}</span>
      <span class="device-platform">(${platform})</span>
    </div>
    <div class="device-specs">
      <span class="spec-item">💾 ${capabilities.memoryGB}GB RAM</span>
      <span class="spec-item">🔲 ${capabilities.cpuCores} CPU cores</span>
      ${capabilities.battery ? `<span class="spec-item">🔋 ${Math.round(capabilities.battery.level * 100)}%${capabilities.battery.charging ? ' ⚡' : ''}</span>` : ''}
    </div>
    <div class="device-capabilities">
      ${badges.join('')}
    </div>
  `;
}

/**
 * Update the pre-flight UI with audio file information
 * @param {PreflightElements} elements - UI elements
 * @param {Object} audioInfo - Audio file information
 * @param {number} audioInfo.durationSeconds - Audio duration in seconds
 * @param {number} audioInfo.fileSizeBytes - File size in bytes
 * @param {string} [audioInfo.mimeType] - MIME type
 */
export async function updatePreflightWithAudio(elements, audioInfo) {
  if (!cachedCapabilities) {
    await initializePreflight(elements);
  }

  try {
    const recommendation = await getProcessingRecommendation(audioInfo, cachedCapabilities);

    // Show recommendation section
    elements.recommendation.hidden = false;

    // Status
    const statusEl = elements.recommendation.querySelector('#recommendationStatus');
    const detailsEl = elements.recommendation.querySelector('#recommendationDetails');

    if (recommendation.canProcess) {
      const statusClass = recommendation.confidenceLevel === 'high' ? 'status-good' :
        recommendation.confidenceLevel === 'medium' ? 'status-ok' : 'status-warning';

      statusEl.className = `recommendation-status ${statusClass}`;
      statusEl.innerHTML = `
        <span class="status-icon">${recommendation.confidenceLevel === 'high' ? '✅' : recommendation.confidenceLevel === 'medium' ? '⚠️' : '❓'}</span>
        <span class="status-text">Ready to process (${recommendation.confidenceLevel} confidence)</span>
      `;

      const durationMinutes = Math.round(audioInfo.durationSeconds / 60);
      const chunkMinutes = Math.round(recommendation.recommendedChunkDuration / 60);

      detailsEl.innerHTML = `
        <div class="detail-item">
          <span class="detail-label">Audio duration:</span>
          <span class="detail-value">${durationMinutes} min</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Max recommended:</span>
          <span class="detail-value">${recommendation.maxRecommendedDuration} min</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Suggested chunk size:</span>
          <span class="detail-value">${chunkMinutes} min</span>
        </div>
      `;
    } else {
      statusEl.className = 'recommendation-status status-error';
      statusEl.innerHTML = `
        <span class="status-icon">❌</span>
        <span class="status-text">Unable to process this audio</span>
      `;
      detailsEl.innerHTML = '';
    }

    // Warnings
    if (recommendation.warnings.length > 0) {
      elements.warnings.hidden = false;
      const warningsList = elements.warnings.querySelector('#warningsList');
      warningsList.innerHTML = recommendation.warnings.map(w => `<li>${w}</li>`).join('');
    } else {
      elements.warnings.hidden = true;
    }

    // Tips
    if (recommendation.tips.length > 0) {
      elements.tips.hidden = false;
      const tipsList = elements.tips.querySelector('#tipsList');
      tipsList.innerHTML = recommendation.tips.map(t => `<li>${t}</li>`).join('');
    } else {
      elements.tips.hidden = true;
    }

    return recommendation;
  } catch (error) {
    elements.recommendation.hidden = false;
    elements.recommendation.querySelector('#recommendationStatus').innerHTML = `
      <span class="status-icon">⚠️</span>
      <span class="status-text">Unable to check recommendations: ${error.message}</span>
    `;
    return null;
  }
}

/**
 * Show the pre-flight container
 * @param {PreflightElements} elements - UI elements
 */
export function showPreflight(elements) {
  elements.container.hidden = false;
}

/**
 * Hide the pre-flight container
 * @param {PreflightElements} elements - UI elements
 */
export function hidePreflight(elements) {
  elements.container.hidden = true;
}

/**
 * Reset the pre-flight UI (clear audio-specific recommendations)
 * @param {PreflightElements} elements - UI elements
 */
export function resetPreflightRecommendation(elements) {
  elements.recommendation.hidden = true;
  elements.warnings.hidden = true;
  elements.tips.hidden = true;
}

/**
 * Get cached capabilities
 * @returns {import('./capability-detector.js').CapabilityReport|null}
 */
export function getCachedCapabilities() {
  return cachedCapabilities;
}

/**
 * Check if duration is safe and return a user-friendly result
 * @param {number} durationSeconds - Audio duration in seconds
 * @returns {Promise<{safe: boolean, message: string}>}
 */
export async function checkDurationSafety(durationSeconds) {
  if (!cachedCapabilities) {
    cachedCapabilities = await getFullCapabilityReport();
  }

  const result = await isDurationSafe(durationSeconds, cachedCapabilities);

  if (result.safe) {
    return {
      safe: true,
      message: 'Audio duration is within recommended limits for your device.',
    };
  }

  return {
    safe: false,
    message: result.reason || 'Audio may be too long for your device.',
  };
}
