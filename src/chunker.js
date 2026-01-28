/**
 * Audio chunking logic with smart silence-based cut points
 */

import { log } from './logger.js';
import {
  getAudioDuration,
  analyzeWindowForSilence,
  findBestCutPoint,
  formatTime
} from './audio-analyzer.js';

/**
 * Calculate chunk boundaries with smart silence detection
 */
export async function calculateChunks(file, options = {}) {
  const {
    chunkLengthMinutes = 10,
    silenceWindowSec = 30,
    silenceThreshold = 0.01,
    onProgress = () => {}
  } = options;

  const chunkLengthSec = chunkLengthMinutes * 60;
  const duration = await getAudioDuration(file);

  log(`Audio duration: ${formatTime(duration)} (${duration.toFixed(1)}s)`);
  log(`Chunk length: ${chunkLengthMinutes} min, Silence window: ${silenceWindowSec}s, Threshold: ${silenceThreshold}`);

  const chunks = [];
  let currentStart = 0;
  let chunkIndex = 0;

  while (currentStart < duration) {
    const idealEnd = Math.min(currentStart + chunkLengthSec, duration);

    let actualEnd = idealEnd;
    let cutInfo = { type: 'exact', silence: null };

    // Try to find silence near the cut point (except for last chunk)
    if (idealEnd < duration - 1) {
      try {
        const silences = await analyzeWindowForSilence(
          file,
          idealEnd,
          silenceWindowSec,
          silenceThreshold
        );

        const cutPoint = findBestCutPoint(silences, idealEnd);

        if (cutPoint !== null) {
          actualEnd = cutPoint;
          cutInfo = {
            type: 'silence',
            silence: silences.find(s => Math.abs(s.midpoint - cutPoint) < 0.1),
            searchedSilences: silences.length
          };
          log(`Chunk ${chunkIndex + 1}: Found silence at ${formatTime(cutPoint)} (${silences.length} candidates)`, 'success');
        } else {
          log(`Chunk ${chunkIndex + 1}: No silence found, cutting at ${formatTime(idealEnd)}`, 'warning');
        }
      } catch (error) {
        log(`Chunk ${chunkIndex + 1}: Silence detection failed: ${error.message}`, 'warning');
      }
    }

    chunks.push({
      index: chunkIndex,
      start: currentStart,
      end: actualEnd,
      duration: actualEnd - currentStart,
      cutInfo
    });

    currentStart = actualEnd;
    chunkIndex++;

    onProgress((currentStart / duration) * 100);
  }

  log(`Calculated ${chunks.length} chunks`, 'success');
  return chunks;
}

/**
 * Extract a chunk from the audio file as a Blob
 * Uses byte slicing with a small buffer to ensure valid audio frames
 */
export async function extractChunkBlob(file, chunk) {
  const duration = await getAudioDuration(file);
  const bytesPerSec = file.size / duration;

  // Add small overlap at boundaries to avoid cutting mid-frame
  const overlapSec = 0.1; // 100ms overlap
  const startByte = Math.max(0, Math.floor((chunk.start - overlapSec) * bytesPerSec));
  const endByte = Math.min(file.size, Math.ceil((chunk.end + overlapSec) * bytesPerSec));

  const blob = file.slice(startByte, endByte, file.type || 'audio/mpeg');

  log(`Extracted chunk ${chunk.index + 1}: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  return blob;
}

/**
 * Check if a chunk is within Groq's size limits
 */
export function validateChunkSize(blob, maxSizeMB = 25) {
  const sizeMB = blob.size / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      size: sizeMB,
      message: `Chunk is ${sizeMB.toFixed(1)}MB, exceeds ${maxSizeMB}MB limit`
    };
  }
  return {
    valid: true,
    size: sizeMB
  };
}
