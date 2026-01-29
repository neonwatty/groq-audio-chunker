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
 * Uses Web Audio API to properly decode and re-encode as WAV
 * This avoids MP3 frame boundary issues from byte slicing
 */
export async function extractChunkBlob(file, chunk) {
  const overlapInfo = chunk.overlap.leading > 0 || chunk.overlap.trailing > 0
    ? ` (overlap: ${chunk.overlap.leading}s leading, ${chunk.overlap.trailing}s trailing)`
    : '';

  log(`Extracting chunk ${chunk.index + 1}: ${formatTime(chunk.start)} → ${formatTime(chunk.end)}${overlapInfo}`);

  // Decode the entire audio file
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Calculate sample positions for the chunk
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(chunk.start * sampleRate);
    const endSample = Math.min(Math.ceil(chunk.end * sampleRate), audioBuffer.length);
    const numSamples = endSample - startSample;

    // Create a new buffer for the chunk
    const numChannels = audioBuffer.numberOfChannels;
    const chunkBuffer = audioContext.createBuffer(numChannels, numSamples, sampleRate);

    // Copy the samples for each channel
    for (let channel = 0; channel < numChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const destData = chunkBuffer.getChannelData(channel);
      for (let i = 0; i < numSamples; i++) {
        destData[i] = sourceData[startSample + i];
      }
    }

    // Encode as WAV
    const wavBlob = audioBufferToWav(chunkBuffer);

    log(`Extracted chunk ${chunk.index + 1}: ${(wavBlob.size / 1024 / 1024).toFixed(2)} MB (WAV)`);

    return wavBlob;
  } finally {
    await audioContext.close();
  }
}

/**
 * Convert an AudioBuffer to a WAV Blob
 * WAV format avoids the frame boundary issues of compressed formats like MP3
 */
function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;

  // Interleave channels
  const interleaved = new Float32Array(numSamples * numChannels);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < numSamples; i++) {
      interleaved[i * numChannels + channel] = channelData[i];
    }
  }

  // Convert to 16-bit PCM
  const pcmData = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }

  // Create WAV file
  const wavBuffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(wavBuffer);

  // WAV header
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);

  // Write PCM data
  const pcmOffset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(pcmOffset + i * 2, pcmData[i], true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
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
