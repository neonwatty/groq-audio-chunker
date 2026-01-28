/**
 * Audio analysis utilities - silence detection and duration extraction
 */

import { log } from './logger.js';

/**
 * Get the duration of an audio file without fully loading it
 */
export function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });

    audio.addEventListener('error', (e) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load audio metadata: ${e.message}`));
    });

    audio.src = url;
  });
}

/**
 * Analyze a portion of the audio file for silence detection
 * Only loads a small window around the target time into memory
 */
export async function analyzeWindowForSilence(file, targetTimeSec, windowSec, threshold) {
  log(`Analyzing ${windowSec}s window around ${formatTime(targetTimeSec)} for silence...`);

  const duration = await getAudioDuration(file);
  const startSec = Math.max(0, targetTimeSec - windowSec / 2);
  const endSec = Math.min(duration, targetTimeSec + windowSec / 2);

  // Estimate byte positions (rough approximation)
  const bytesPerSec = file.size / duration;
  const startByte = Math.floor(startSec * bytesPerSec);
  const endByte = Math.ceil(endSec * bytesPerSec);

  // Read only the relevant portion
  const slice = file.slice(startByte, endByte);
  const arrayBuffer = await slice.arrayBuffer();

  // Decode the audio slice
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const silences = findSilentRegions(audioBuffer, threshold);

    // Convert to absolute times
    return silences.map(s => ({
      start: s.start / 1000 + startSec,
      end: s.end / 1000 + startSec,
      duration: s.duration,
      midpoint: (s.start + s.end) / 2000 + startSec
    }));
  } catch (error) {
    // If decoding fails (e.g., partial file slice), fall back to target time
    log(`Silence detection failed for window, using target time: ${error.message}`, 'warning');
    return [];
  } finally {
    await audioContext.close();
  }
}

/**
 * Find silent regions in an AudioBuffer using RMS amplitude analysis
 */
export function findSilentRegions(audioBuffer, threshold = 0.01, minDurationMs = 300) {
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.floor(0.05 * sampleRate); // 50ms analysis windows

  const silences = [];
  let silenceStart = null;

  for (let i = 0; i < samples.length; i += windowSize) {
    const end = Math.min(i + windowSize, samples.length);
    const window = samples.slice(i, end);

    // Calculate RMS (Root Mean Square) amplitude
    let sum = 0;
    for (let j = 0; j < window.length; j++) {
      sum += window[j] * window[j];
    }
    const rms = Math.sqrt(sum / window.length);
    const timeMs = (i / sampleRate) * 1000;

    if (rms < threshold) {
      // Silent region
      if (silenceStart === null) {
        silenceStart = timeMs;
      }
    } else {
      // Sound detected
      if (silenceStart !== null) {
        const duration = timeMs - silenceStart;
        if (duration >= minDurationMs) {
          silences.push({
            start: silenceStart,
            end: timeMs,
            duration: duration
          });
        }
        silenceStart = null;
      }
    }
  }

  // Handle silence at the end
  if (silenceStart !== null) {
    const endTimeMs = (samples.length / sampleRate) * 1000;
    const duration = endTimeMs - silenceStart;
    if (duration >= minDurationMs) {
      silences.push({
        start: silenceStart,
        end: endTimeMs,
        duration: duration
      });
    }
  }

  return silences;
}

/**
 * Find the best cut point near a target time, preferring longer silences
 */
export function findBestCutPoint(silences, targetTimeSec) {
  if (silences.length === 0) {
    return null;
  }

  // Score each silence: prefer longer silences closer to target
  let bestSilence = null;
  let bestScore = -Infinity;

  for (const silence of silences) {
    const distance = Math.abs(silence.midpoint - targetTimeSec);
    // Score: duration bonus minus distance penalty
    const score = silence.duration - (distance * 100);

    if (score > bestScore) {
      bestScore = score;
      bestSilence = silence;
    }
  }

  return bestSilence ? bestSilence.midpoint : null;
}

/**
 * Generate waveform data for visualization
 */
export async function generateWaveformData(file, numPoints = 500) {
  log('Generating waveform visualization...');

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPoint = Math.floor(channelData.length / numPoints);

    const waveform = [];
    for (let i = 0; i < numPoints; i++) {
      const start = i * samplesPerPoint;
      const end = start + samplesPerPoint;

      // Calculate peak amplitude for this segment
      let max = 0;
      for (let j = start; j < end && j < channelData.length; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      waveform.push(max);
    }

    return {
      data: waveform,
      duration: audioBuffer.duration
    };
  } finally {
    await audioContext.close();
  }
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format file size
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
