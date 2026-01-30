/**
 * Device Gate Module
 *
 * Shows warnings to mobile/tablet users about background processing limitations
 * and enforces duration limits based on device capabilities.
 */

import { getFullCapabilityReport } from './capability-detector.js';

const STORAGE_KEY = 'groqChunker_mobileWarningDismissed';

/**
 * Duration limits in minutes based on device type and memory
 */
const DURATION_LIMITS = {
  // Mobile devices - high risk of interruption
  mobile: {
    default: 15,
    withHighMemory: 20, // 6GB+ mobile
  },
  // Tablets - moderate risk
  tablet: {
    default: 30,
    withHighMemory: 45, // 8GB+ tablet
  },
  // Desktop - based on memory
  desktop: {
    lowMemory: 15,    // ≤2GB
    midMemory: 45,    // 4GB
    highMemory: 120,  // 8GB+
  },
};

/**
 * Get the maximum allowed duration in minutes for the current device
 * @param {import('./capability-detector.js').CapabilityReport} capabilities
 * @returns {number} Max duration in minutes
 */
export function getMaxDurationMinutes(capabilities) {
  const { deviceType, memoryGB } = capabilities;

  if (deviceType === 'mobile') {
    return memoryGB >= 6 ? DURATION_LIMITS.mobile.withHighMemory : DURATION_LIMITS.mobile.default;
  }

  if (deviceType === 'tablet') {
    return memoryGB >= 8 ? DURATION_LIMITS.tablet.withHighMemory : DURATION_LIMITS.tablet.default;
  }

  // Desktop
  if (memoryGB <= 2) {
    return DURATION_LIMITS.desktop.lowMemory;
  } else if (memoryGB <= 4) {
    return DURATION_LIMITS.desktop.midMemory;
  } else {
    return DURATION_LIMITS.desktop.highMemory;
  }
}

/**
 * Check if the user has previously dismissed the mobile warning
 * @returns {boolean}
 */
function hasUserDismissedWarning() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Save that user has dismissed the mobile warning
 */
function saveWarningDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Create the mobile warning modal HTML
 * @param {import('./capability-detector.js').CapabilityReport} capabilities
 * @returns {HTMLElement}
 */
function createMobileWarningModal(capabilities) {
  const maxDuration = getMaxDurationMinutes(capabilities);
  const deviceName = capabilities.deviceType === 'mobile' ? 'phone' : 'tablet';

  const modal = document.createElement('div');
  modal.className = 'device-gate-overlay';
  modal.id = 'deviceGateModal';

  modal.innerHTML = `
    <div class="device-gate-modal">
      <div class="device-gate-icon">📱</div>
      <h2 class="device-gate-title">Mobile Device Detected</h2>
      <div class="device-gate-content">
        <p>
          This app processes audio in your browser, which requires the tab to stay
          <strong>open and active</strong>.
        </p>
        <div class="device-gate-warning">
          <span class="warning-icon">⚠️</span>
          <div>
            <strong>On your ${deviceName}, processing will pause if you:</strong>
            <ul>
              <li>Switch to another app</li>
              <li>Lock your screen</li>
              <li>Switch browser tabs</li>
            </ul>
          </div>
        </div>
        <p class="device-gate-limit">
          For best results on this device, we recommend audio files
          <strong>under ${maxDuration} minutes</strong>.
        </p>
        <p class="device-gate-recommendation">
          For longer audio or uninterrupted processing, please use a <strong>desktop computer</strong>.
        </p>
      </div>
      <div class="device-gate-actions">
        <button type="button" class="btn-primary device-gate-continue" id="deviceGateContinue">
          Continue Anyway
        </button>
        <label class="device-gate-remember">
          <input type="checkbox" id="deviceGateRemember">
          Don't show this again
        </label>
      </div>
    </div>
  `;

  return modal;
}

/**
 * Show the mobile warning modal
 * @param {import('./capability-detector.js').CapabilityReport} capabilities
 * @returns {Promise<void>} Resolves when user dismisses the modal
 */
export function showMobileWarning(capabilities) {
  return new Promise((resolve) => {
    const modal = createMobileWarningModal(capabilities);
    document.body.appendChild(modal);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    const continueBtn = modal.querySelector('#deviceGateContinue');
    /** @type {HTMLInputElement} */
    const rememberCheckbox = modal.querySelector('#deviceGateRemember');

    continueBtn.addEventListener('click', () => {
      if (rememberCheckbox.checked) {
        saveWarningDismissed();
      }

      // Animate out
      modal.classList.add('closing');
      setTimeout(() => {
        modal.remove();
        document.body.style.overflow = '';
        resolve();
      }, 200);
    });
  });
}

/**
 * Check if device gate should be shown and show it if needed
 * @returns {Promise<{capabilities: import('./capability-detector.js').CapabilityReport, maxDuration: number}>}
 */
export async function checkDeviceGate() {
  const capabilities = await getFullCapabilityReport();
  const maxDuration = getMaxDurationMinutes(capabilities);

  // Show warning for mobile/tablet if not previously dismissed
  if ((capabilities.deviceType === 'mobile' || capabilities.deviceType === 'tablet') &&
      !hasUserDismissedWarning()) {
    await showMobileWarning(capabilities);
  }

  return { capabilities, maxDuration };
}

/**
 * Check if audio duration exceeds device limit
 * @param {number} durationSeconds - Audio duration in seconds
 * @param {import('./capability-detector.js').CapabilityReport} capabilities
 * @returns {{allowed: boolean, maxMinutes: number, audioMinutes: number, message?: string}}
 */
export function checkDurationLimit(durationSeconds, capabilities) {
  const maxMinutes = getMaxDurationMinutes(capabilities);
  const audioMinutes = durationSeconds / 60;

  if (audioMinutes <= maxMinutes) {
    return {
      allowed: true,
      maxMinutes,
      audioMinutes,
    };
  }

  const deviceDesc = capabilities.deviceType === 'desktop'
    ? `desktop with ${capabilities.memoryGB}GB RAM`
    : capabilities.deviceType;

  return {
    allowed: false,
    maxMinutes,
    audioMinutes,
    message: `This audio (${Math.round(audioMinutes)} min) exceeds the recommended maximum of ${maxMinutes} minutes for your ${deviceDesc}. Processing may fail or be interrupted.`,
  };
}

/**
 * Create duration exceeded warning modal
 * @param {number} audioMinutes - Audio duration in minutes
 * @param {number} maxMinutes - Max allowed minutes
 * @param {string} deviceType - Device type
 * @returns {Promise<boolean>} True if user wants to proceed anyway
 */
export function showDurationWarning(audioMinutes, maxMinutes, deviceType) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'device-gate-overlay';
    modal.id = 'durationWarningModal';

    modal.innerHTML = `
      <div class="device-gate-modal duration-warning">
        <div class="device-gate-icon">⚠️</div>
        <h2 class="device-gate-title">Audio May Be Too Long</h2>
        <div class="device-gate-content">
          <p>
            Your audio is <strong>${Math.round(audioMinutes)} minutes</strong>, but we recommend
            a maximum of <strong>${maxMinutes} minutes</strong> for your ${deviceType}.
          </p>
          <p>
            Processing longer audio may:
          </p>
          <ul class="duration-warning-list">
            <li>Run out of memory and crash</li>
            <li>Take a very long time</li>
            <li>Be interrupted if you switch apps/tabs</li>
          </ul>
          <p class="device-gate-recommendation">
            Consider splitting your audio into smaller files, or use a desktop computer.
          </p>
        </div>
        <div class="device-gate-actions">
          <button type="button" class="btn-secondary" id="durationWarningCancel">
            Cancel
          </button>
          <button type="button" class="btn-warning" id="durationWarningProceed">
            Proceed Anyway
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const cancelBtn = modal.querySelector('#durationWarningCancel');
    const proceedBtn = modal.querySelector('#durationWarningProceed');

    const closeModal = (result) => {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.remove();
        document.body.style.overflow = '';
        resolve(result);
      }, 200);
    };

    cancelBtn.addEventListener('click', () => closeModal(false));
    proceedBtn.addEventListener('click', () => closeModal(true));
  });
}

// Export duration limits for testing
export const _DURATION_LIMITS = DURATION_LIMITS;
