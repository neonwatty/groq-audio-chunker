/**
 * FFmpeg.wasm singleton service for memory-efficient audio processing
 *
 * Key benefits over Web Audio API:
 * - Time-based extraction without loading entire file into memory
 * - 100MB MP3 → ~100MB peak RAM vs 600MB-1.2GB with decodeAudioData
 * - Supports files 1-3 hours long without crashing
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { log } from './logger.js';

// Singleton instance
let ffmpeg = null;
let loadPromise = null;
let isLoaded = false;

/**
 * Check if SharedArrayBuffer is available (required for multi-threaded ffmpeg)
 */
export function isSharedArrayBufferAvailable() {
  try {
    return typeof SharedArrayBuffer !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Load ffmpeg.wasm (lazy loaded, ~25MB download)
 * @param {Function} onProgress - Progress callback (0-100), -1 for indeterminate
 * @returns {Promise<boolean>} - True if loaded successfully
 */
export async function loadFFmpeg(onProgress = () => {}) {
  if (isLoaded) {
    return true;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      if (!isSharedArrayBufferAvailable()) {
        log('SharedArrayBuffer not available - COOP/COEP headers may be missing', 'warning');
        log('FFmpeg requires cross-origin isolation. Check browser console for details.', 'warning');
      }

      ffmpeg = new FFmpeg();

      ffmpeg.on('log', ({ message }) => {
        // Only log errors and important messages
        if (message.includes('Error') || message.includes('error')) {
          log(`FFmpeg: ${message}`, 'warning');
        }
      });

      log('Loading FFmpeg.wasm (~25MB)...');

      // Signal indeterminate progress (load doesn't provide progress events)
      onProgress(-1);

      // Load ffmpeg core from CDN - use single-threaded version for reliability
      // The multi-threaded version has CORS issues with CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

      log('Loading FFmpeg core (single-threaded)...');

      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });

      isLoaded = true;
      onProgress(100);
      log('FFmpeg.wasm loaded successfully', 'success');
      return true;
    } catch (error) {
      const errorMsg = error?.message || error?.toString() || String(error);
      log(`Failed to load FFmpeg: ${errorMsg}`, 'error');
      console.error('FFmpeg load error (full):', error);
      ffmpeg = null;
      loadPromise = null;
      return false;
    }
  })();

  return loadPromise;
}

/**
 * Check if FFmpeg is loaded and ready
 */
export function isFFmpegLoaded() {
  return isLoaded && ffmpeg !== null;
}

/**
 * Get audio duration using FFmpeg (memory-efficient)
 * Parses duration from ffprobe-style output without decoding
 * @param {File} file - Audio file
 * @returns {Promise<number>} - Duration in seconds
 */
export async function getDurationWithFFmpeg(file) {
  if (!isFFmpegLoaded()) {
    throw new Error('FFmpeg not loaded');
  }

  const inputName = 'input_' + Date.now() + getExtension(file.name);

  try {
    // Write file to virtual filesystem
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Capture logs to parse duration
    let durationStr = null;
    const logHandler = ({ message }) => {
      // Look for duration in format "Duration: HH:MM:SS.ms"
      const match = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        const ms = parseInt(match[4]) / 100;
        durationStr = hours * 3600 + minutes * 60 + seconds + ms;
      }
    };

    ffmpeg.on('log', logHandler);

    // Run ffmpeg to get file info (no output)
    await ffmpeg.exec(['-i', inputName, '-f', 'null', '-']);

    ffmpeg.off('log', logHandler);

    // Clean up virtual filesystem
    await ffmpeg.deleteFile(inputName);

    if (durationStr !== null) {
      return durationStr;
    }

    throw new Error('Could not parse duration from FFmpeg output');
  } catch (error) {
    // Clean up on error
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Extract a chunk from audio file as WAV (time-based, memory-efficient)
 * @param {File} file - Source audio file
 * @param {number} startSec - Start time in seconds
 * @param {number} endSec - End time in seconds
 * @returns {Promise<Blob>} - WAV blob of the extracted chunk
 */
export async function extractChunkWithFFmpeg(file, startSec, endSec) {
  if (!isFFmpegLoaded()) {
    throw new Error('FFmpeg not loaded');
  }

  const inputName = 'input_' + Date.now() + getExtension(file.name);
  const outputName = 'output_' + Date.now() + '.wav';

  try {
    // Write file to virtual filesystem
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Extract chunk using time-based seeking (doesn't decode entire file)
    // -ss before -i enables fast seeking
    // Output: 16kHz mono WAV for Whisper compatibility
    await ffmpeg.exec([
      '-ss', startSec.toString(),
      '-to', endSec.toString(),
      '-i', inputName,
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputName
    ]);

    // Read output file
    const data = await ffmpeg.readFile(outputName);

    // Clean up virtual filesystem immediately
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Convert to Blob
    return new Blob([data.buffer], { type: 'audio/wav' });
  } catch (error) {
    // Clean up on error
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Detect silence regions in a portion of audio using FFmpeg's silencedetect filter
 * @param {File} file - Audio file
 * @param {number} startSec - Start time to analyze
 * @param {number} endSec - End time to analyze
 * @param {number} threshold - Silence threshold in dB (e.g., -40)
 * @param {number} minDurationSec - Minimum silence duration in seconds
 * @returns {Promise<Array>} - Array of {start, end, duration} silence regions
 */
export async function detectSilenceWithFFmpeg(file, startSec, endSec, threshold = -40, minDurationSec = 0.3) {
  if (!isFFmpegLoaded()) {
    throw new Error('FFmpeg not loaded');
  }

  const inputName = 'input_' + Date.now() + getExtension(file.name);
  const silences = [];

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Track silence detections from logs
    let currentSilenceStart = null;
    const logHandler = ({ message }) => {
      // Parse silence_start
      const startMatch = message.match(/silence_start:\s*([\d.]+)/);
      if (startMatch) {
        currentSilenceStart = parseFloat(startMatch[1]);
      }

      // Parse silence_end
      const endMatch = message.match(/silence_end:\s*([\d.]+)/);
      if (endMatch && currentSilenceStart !== null) {
        const silenceEnd = parseFloat(endMatch[1]);
        silences.push({
          start: currentSilenceStart + startSec, // Adjust to absolute time
          end: silenceEnd + startSec,
          duration: (silenceEnd - currentSilenceStart) * 1000 // ms
        });
        currentSilenceStart = null;
      }
    };

    ffmpeg.on('log', logHandler);

    // Run silencedetect filter on the specified range
    await ffmpeg.exec([
      '-ss', startSec.toString(),
      '-to', endSec.toString(),
      '-i', inputName,
      '-af', `silencedetect=noise=${threshold}dB:d=${minDurationSec}`,
      '-f', 'null',
      '-'
    ]);

    ffmpeg.off('log', logHandler);
    await ffmpeg.deleteFile(inputName);

    return silences;
  } catch (error) {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Extract low-resolution waveform data for visualization
 * Uses sample-based approach for memory efficiency - extracts small snippets
 * across the file instead of loading the entire file at once.
 *
 * @param {File} file - Audio file
 * @param {number} numPoints - Number of waveform points (default: 500)
 * @returns {Promise<{data: number[], duration: number}>}
 */
export async function extractWaveformWithFFmpeg(file, numPoints = 500) {
  if (!isFFmpegLoaded()) {
    throw new Error('FFmpeg not loaded');
  }

  // First get duration (this is lightweight - just parses metadata)
  const duration = await getDurationWithFFmpeg(file);

  // For short files (< 10 min), use the simple full-file approach
  // For longer files, use sample-based approach for memory efficiency
  const SHORT_FILE_THRESHOLD = 600; // 10 minutes

  if (duration < SHORT_FILE_THRESHOLD) {
    return extractWaveformFullFile(file, numPoints, duration);
  }

  return extractWaveformSampled(file, numPoints, duration);
}

/**
 * Extract waveform by loading the full file (for short files)
 */
async function extractWaveformFullFile(file, numPoints, duration) {
  const inputName = 'input_' + Date.now() + getExtension(file.name);
  const outputName = 'waveform_' + Date.now() + '.raw';

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Use 8000 Hz sample rate for visualization
    const sampleRate = 8000;

    await ffmpeg.exec([
      '-i', inputName,
      '-ar', sampleRate.toString(),
      '-ac', '1',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      outputName
    ]);

    const rawData = await ffmpeg.readFile(outputName);

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Convert raw PCM to waveform data
    const samples = new Int16Array(rawData.buffer);
    const samplesPerPoint = Math.max(1, Math.floor(samples.length / numPoints));

    const waveform = [];
    for (let i = 0; i < numPoints && i * samplesPerPoint < samples.length; i++) {
      const start = i * samplesPerPoint;
      const end = Math.min(start + samplesPerPoint, samples.length);

      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j]) / 32768; // Normalize to 0-1
        if (abs > max) {max = abs;}
      }
      waveform.push(max);
    }

    return { data: waveform, duration };
  } catch (error) {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Extract waveform using sample-based approach (for long files)
 * Extracts small snippets at regular intervals across the file.
 * Memory efficient: only loads ~2 seconds of audio at a time.
 */
async function extractWaveformSampled(file, numPoints, duration) {
  const inputName = 'input_' + Date.now() + getExtension(file.name);
  const outputName = 'sample_' + Date.now() + '.raw';

  // Sample parameters - use longer samples with fewer FFmpeg calls for efficiency
  const SAMPLE_DURATION = 2.0; // seconds per sample (longer = fewer FFmpeg calls)
  const SAMPLE_RATE = 8000;

  // Limit number of FFmpeg calls to keep it fast
  // ~50 samples is a good balance between quality and speed
  const MAX_SNIPPETS = 50;
  const numSnippets = Math.min(MAX_SNIPPETS, Math.floor(duration / SAMPLE_DURATION));
  const interval = duration / numSnippets;
  const pointsPerSnippet = Math.ceil(numPoints / numSnippets);

  const waveform = [];

  try {
    // Write the file once to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    log(`Generating waveform from ${numSnippets} samples across ${(duration / 60).toFixed(1)} minutes...`);

    for (let i = 0; i < numSnippets; i++) {
      const startTime = i * interval;

      try {
        // Extract a small snippet using time-based seeking
        await ffmpeg.exec([
          '-ss', startTime.toFixed(3),
          '-t', SAMPLE_DURATION.toFixed(3),
          '-i', inputName,
          '-ar', SAMPLE_RATE.toString(),
          '-ac', '1',
          '-f', 's16le',
          '-acodec', 'pcm_s16le',
          '-y', // Overwrite output
          outputName
        ]);

        const rawData = await ffmpeg.readFile(outputName);
        const samples = new Int16Array(rawData.buffer);

        // Extract amplitude points from this snippet
        const snippetPointCount = Math.min(pointsPerSnippet, Math.ceil(samples.length / 100));
        const samplesPerPoint = Math.max(1, Math.floor(samples.length / snippetPointCount));

        for (let j = 0; j < snippetPointCount && waveform.length < numPoints; j++) {
          const start = j * samplesPerPoint;
          const end = Math.min(start + samplesPerPoint, samples.length);

          let max = 0;
          for (let k = start; k < end; k++) {
            const abs = Math.abs(samples[k]) / 32768;
            if (abs > max) {max = abs;}
          }
          waveform.push(max);
        }

        // Clean up the sample file
        try {
          await ffmpeg.deleteFile(outputName);
        } catch {
      // Ignore cleanup errors
    }

      } catch {
        // If a snippet fails, add zeros and continue
        for (let j = 0; j < pointsPerSnippet && waveform.length < numPoints; j++) {
          waveform.push(0);
        }
      }
    }

    // Clean up input file
    await ffmpeg.deleteFile(inputName);

    // Ensure we have exactly numPoints (pad or trim)
    while (waveform.length < numPoints) {
      waveform.push(0);
    }
    if (waveform.length > numPoints) {
      waveform.length = numPoints;
    }

    log(`Waveform generated from ${numSnippets} samples (memory-efficient)`, 'success');
    return { data: waveform, duration };

  } catch (error) {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Get file extension from filename
 */
function getExtension(filename) {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '.mp3';
}
