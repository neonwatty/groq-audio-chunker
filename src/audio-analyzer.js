/**
 * Audio analysis utilities - silence detection and duration extraction
 * Uses FFmpeg.wasm for memory-efficient processing with Web Audio API fallback
 */

import { log } from './logger.js';
import {
  isFFmpegLoaded,
  getDurationWithFFmpeg,
  detectSilenceWithFFmpeg,
  extractWaveformWithFFmpeg
} from './ffmpeg-service.js';

/**
 * Get the duration of an audio file
 * Uses FFmpeg if available (memory-efficient), falls back to Web Audio API
 */
export async function getAudioDuration(file) {
  // First try the fast Audio element approach
  try {
    const duration = await getAudioDurationViaAudioElement(file);
    if (duration && duration !== Infinity && !isNaN(duration)) {
      return duration;
    }
  } catch (e) {
    log(`Audio element approach failed: ${e.message}`, 'warning');
  }

  // Try FFmpeg (memory-efficient)
  if (isFFmpegLoaded()) {
    try {
      const duration = await getDurationWithFFmpeg(file);
      log(`Duration from FFmpeg: ${duration.toFixed(1)}s`);
      return duration;
    } catch (e) {
      log(`FFmpeg duration extraction failed: ${e.message}, trying AudioContext...`, 'warning');
    }
  }

  // Fallback to AudioContext (slower, uses more memory)
  log('Falling back to AudioContext for duration (higher memory usage)', 'warning');
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return audioBuffer.duration;
  } catch (e) {
    await audioContext.close();
    throw new Error(`Failed to decode audio: ${e.message}`);
  }
}

/**
 * Try to get duration via Audio element (fast but not always reliable)
 */
function getAudioDurationViaAudioElement(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout'));
    }, 3000);

    const cleanup = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
    };

    audio.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      cleanup();
      reject(new Error('Error loading'));
    });

    audio.preload = 'metadata';
    audio.src = url;
  });
}

/**
 * Analyze a portion of the audio file for silence detection
 * Uses FFmpeg silencedetect filter if available (memory-efficient)
 */
export async function analyzeWindowForSilence(file, targetTimeSec, windowSec, threshold) {
  log(`Analyzing ${windowSec}s window around ${formatTime(targetTimeSec)} for silence...`);

  const duration = await getAudioDuration(file);
  const startSec = Math.max(0, targetTimeSec - windowSec / 2);
  const endSec = Math.min(duration, targetTimeSec + windowSec / 2);

  // Try FFmpeg silencedetect (memory-efficient)
  if (isFFmpegLoaded()) {
    try {
      // Convert linear threshold to dB (e.g., 0.01 → -40dB)
      const thresholdDb = Math.round(20 * Math.log10(threshold));

      const silences = await detectSilenceWithFFmpeg(file, startSec, endSec, thresholdDb, 0.3);

      // Add midpoint for cut point selection
      return silences.map(s => ({
        ...s,
        midpoint: (s.start + s.end) / 2
      }));
    } catch (error) {
      log(`FFmpeg silence detection failed: ${error.message}, trying Web Audio...`, 'warning');
    }
  }

  // Fallback to Web Audio API (higher memory usage)
  return analyzeWindowForSilenceWebAudio(file, startSec, endSec, duration, threshold);
}

/**
 * Web Audio API fallback for silence detection
 */
async function analyzeWindowForSilenceWebAudio(file, startSec, endSec, duration, threshold) {
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
 * Uses FFmpeg if available (memory-efficient), falls back to Web Audio API
 */
export async function generateWaveformData(file, numPoints = 500) {
  log('Generating waveform visualization...');

  // Try FFmpeg (memory-efficient)
  if (isFFmpegLoaded()) {
    try {
      const result = await extractWaveformWithFFmpeg(file, numPoints);
      log('Waveform generated via FFmpeg (memory-efficient)', 'success');
      return result;
    } catch (error) {
      log(`FFmpeg waveform failed: ${error.message}, trying Web Audio...`, 'warning');
    }
  }

  // Fallback to Web Audio API
  log('Generating waveform via Web Audio (higher memory usage)', 'warning');
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
        if (abs > max) {max = abs;}
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
  if (bytes < 1024) {return bytes + ' B';}
  if (bytes < 1024 * 1024) {return (bytes / 1024).toFixed(1) + ' KB';}
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
