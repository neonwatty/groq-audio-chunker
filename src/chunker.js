/**
 * Audio chunking logic with smart silence-based cut points and overlap support
 */

import { log } from './logger.js';
import {
  getAudioDuration,
  analyzeWindowForSilence,
  findBestCutPoint,
  formatTime
} from './audio-analyzer.js';

/**
 * Calculate chunk boundaries with smart silence detection and configurable overlap
 *
 * Overlap Strategy:
 * - Each chunk extends into the next chunk's territory by overlapDurationSec
 * - This ensures words at boundaries are captured by both chunks
 * - Deduplication later removes the repeated content
 *
 * Example with 10-second overlap:
 *   Chunk 1: 0:00 - 10:10 (extends 10s past cut point)
 *   Chunk 2: 10:00 - 20:10 (starts 10s before its logical start)
 */
export async function calculateChunks(file, options = {}) {
  const {
    chunkLengthMinutes = 10,
    silenceWindowSec = 30,
    silenceThreshold = 0.01,
    overlapDurationSec = 10,
    onProgress = () => {}
  } = options;

  const chunkLengthSec = chunkLengthMinutes * 60;
  const duration = await getAudioDuration(file);

  log(`Audio duration: ${formatTime(duration)} (${duration.toFixed(1)}s)`);
  log(`Chunk length: ${chunkLengthMinutes} min, Overlap: ${overlapDurationSec}s, Silence window: ${silenceWindowSec}s`);

  // First pass: find all cut points
  const cutPoints = [0]; // Start with beginning
  let currentPosition = 0;

  while (currentPosition < duration) {
    const idealCut = Math.min(currentPosition + chunkLengthSec, duration);

    if (idealCut >= duration - 1) {
      // Last chunk - no more cuts needed
      break;
    }

    let actualCut = idealCut;

    // Try to find silence near the cut point
    try {
      const silences = await analyzeWindowForSilence(
        file,
        idealCut,
        silenceWindowSec,
        silenceThreshold
      );

      const cutPoint = findBestCutPoint(silences, idealCut);

      if (cutPoint !== null) {
        actualCut = cutPoint;
        log(`Cut point ${cutPoints.length}: Found silence at ${formatTime(cutPoint)} (${silences.length} candidates)`, 'success');
      } else {
        log(`Cut point ${cutPoints.length}: No silence found, cutting at ${formatTime(idealCut)}`, 'warning');
      }
    } catch (error) {
      log(`Cut point ${cutPoints.length}: Silence detection failed: ${error.message}`, 'warning');
    }

    cutPoints.push(actualCut);
    currentPosition = actualCut;

    onProgress((currentPosition / duration) * 50); // First 50% is cut point detection
  }

  cutPoints.push(duration); // End with the end

  // Second pass: create chunks with overlap
  const chunks = [];

  for (let i = 0; i < cutPoints.length - 1; i++) {
    const logicalStart = cutPoints[i];
    const logicalEnd = cutPoints[i + 1];

    // Add overlap: extend the end (except for last chunk)
    // and start earlier (except for first chunk)
    const actualStart = i === 0 ? logicalStart : Math.max(0, logicalStart - overlapDurationSec);
    const actualEnd = i === cutPoints.length - 2 ? logicalEnd : Math.min(duration, logicalEnd + overlapDurationSec);

    const hasLeadingOverlap = i > 0 && overlapDurationSec > 0;
    const hasTrailingOverlap = i < cutPoints.length - 2 && overlapDurationSec > 0;

    chunks.push({
      index: i,
      // Logical boundaries (where content "belongs")
      logicalStart,
      logicalEnd,
      // Actual extraction boundaries (with overlap)
      start: actualStart,
      end: actualEnd,
      duration: actualEnd - actualStart,
      // Overlap info for visualization and merging
      overlap: {
        leading: hasLeadingOverlap ? overlapDurationSec : 0,
        trailing: hasTrailingOverlap ? overlapDurationSec : 0,
        leadingStart: hasLeadingOverlap ? actualStart : null,
        leadingEnd: hasLeadingOverlap ? logicalStart : null,
        trailingStart: hasTrailingOverlap ? logicalEnd : null,
        trailingEnd: hasTrailingOverlap ? actualEnd : null
      },
      cutInfo: {
        type: i === cutPoints.length - 2 ? 'end' : 'silence', // Simplified for now
        silence: null
      }
    });

    onProgress(50 + (i / (cutPoints.length - 1)) * 50); // Second 50% is chunk creation
  }

  // Log summary
  const totalOverlapSec = chunks.reduce((sum, c) => sum + c.overlap.leading + c.overlap.trailing, 0);
  const totalDuration = chunks.reduce((sum, c) => sum + c.duration, 0);
  const overheadPercent = ((totalDuration - duration) / duration * 100).toFixed(1);

  log(`Calculated ${chunks.length} chunks`, 'success');
  log(`Total overlap: ${totalOverlapSec.toFixed(0)}s (${overheadPercent}% overhead)`);

  return chunks;
}

/**
 * Extract a chunk from the audio file as a Blob
 * Uses byte slicing with a small buffer to ensure valid audio frames
 */
export async function extractChunkBlob(file, chunk) {
  const duration = await getAudioDuration(file);
  const bytesPerSec = file.size / duration;

  // Add tiny buffer for audio frame alignment (separate from semantic overlap)
  const frameBuffer = 0.05; // 50ms for frame alignment
  const startByte = Math.max(0, Math.floor((chunk.start - frameBuffer) * bytesPerSec));
  const endByte = Math.min(file.size, Math.ceil((chunk.end + frameBuffer) * bytesPerSec));

  const blob = file.slice(startByte, endByte, file.type || 'audio/mpeg');

  const overlapInfo = chunk.overlap.leading > 0 || chunk.overlap.trailing > 0
    ? ` (overlap: ${chunk.overlap.leading}s leading, ${chunk.overlap.trailing}s trailing)`
    : '';

  log(`Extracted chunk ${chunk.index + 1}: ${(blob.size / 1024 / 1024).toFixed(2)} MB${overlapInfo}`);

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

/**
 * Estimate total audio to be transcribed (including overlap)
 */
export function estimateTotalTranscriptionTime(chunks) {
  return chunks.reduce((sum, chunk) => sum + chunk.duration, 0);
}
