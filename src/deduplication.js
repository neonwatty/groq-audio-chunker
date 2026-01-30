/**
 * Transcript deduplication using word-level timestamps
 *
 * When chunks overlap, both will have words with similar absolute timestamps.
 * We deduplicate by timestamp, keeping the word from whichever chunk has it
 * further from the boundary (more context = better accuracy).
 */

import { log } from './logger.js';

/**
 * Merge transcripts from overlapping chunks using timestamp-based deduplication
 *
 * @param {Array} results - Array of transcription results with words[] containing timestamps
 * @param {number} overlapDurationSec - Expected overlap duration in seconds
 * @returns {Object} - { text: string, words: array, stats: { overlapsMerged, wordsDeduplicated } }
 */
export function mergeTranscriptsWithDeduplication(results, overlapDurationSec = 10) {
  const successfulResults = results.filter(r => r.success && r.text);

  if (successfulResults.length === 0) {
    return { text: '', words: [], stats: { overlapsMerged: 0, wordsDeduplicated: 0 } };
  }

  // Convert all words to absolute timestamps
  const allWordsWithAbsoluteTime = [];

  for (const result of successfulResults) {
    const chunk = result.chunk;
    const chunkStart = chunk.start; // Absolute start time in the original audio
    const chunkLogicalStart = chunk.logicalStart;
    const chunkLogicalEnd = chunk.logicalEnd;

    // Check if we have word-level timestamps
    if (result.words && result.words.length > 0) {
      for (const word of result.words) {
        // Convert relative timestamp to absolute
        const absoluteStart = chunkStart + word.start;
        const absoluteEnd = chunkStart + word.end;

        // Calculate how "central" this word is in the chunk (0 = at boundary, 1 = center)
        // Words further from boundaries are likely more accurate
        const distanceFromStart = absoluteStart - chunkLogicalStart;
        const distanceFromEnd = chunkLogicalEnd - absoluteEnd;
        const minDistanceFromBoundary = Math.min(distanceFromStart, distanceFromEnd);
        const chunkDuration = chunkLogicalEnd - chunkLogicalStart;
        const centrality = minDistanceFromBoundary / (chunkDuration / 2); // 0 to 1

        allWordsWithAbsoluteTime.push({
          word: word.word,
          absoluteStart,
          absoluteEnd,
          centrality,
          chunkIndex: result.chunk.index,
          original: word
        });
      }
    } else {
      // Fallback: no word timestamps, can't do timestamp-based dedup
      log(`Chunk ${chunk.index + 1}: No word timestamps available, falling back to text merge`, 'warning');
    }
  }

  // If we have words with timestamps, do timestamp-based deduplication
  if (allWordsWithAbsoluteTime.length > 0) {
    return deduplicateByTimestamp(allWordsWithAbsoluteTime, overlapDurationSec);
  }

  // Fallback to simple text concatenation if no word timestamps
  return fallbackTextMerge(successfulResults, overlapDurationSec);
}

/**
 * Deduplicate words by their absolute timestamps
 *
 * Algorithm:
 * 1. Group words by chunk, preserving original order within each chunk
 * 2. Process chunks sequentially (NOT sorted by timestamp globally)
 * 3. For overlap regions, determine which chunk is authoritative
 * 4. Build final transcript by concatenating non-overlap portions from each chunk
 *
 * KEY INSIGHT: We must NOT sort words by timestamp globally because Whisper
 * sometimes returns slightly out-of-order timestamps within a chunk. Instead,
 * we preserve the original word order within each chunk.
 */
function deduplicateByTimestamp(words, _overlapDurationSec) {
  // Step 1: Group words by chunk, preserving original order (do NOT sort!)
  const wordsByChunk = new Map();
  for (const word of words) {
    if (!wordsByChunk.has(word.chunkIndex)) {
      wordsByChunk.set(word.chunkIndex, []);
    }
    wordsByChunk.get(word.chunkIndex).push(word);
  }

  const chunkIndices = [...wordsByChunk.keys()].sort((a, b) => a - b);

  if (chunkIndices.length === 0) {
    return { text: '', words: [], allWords: [], stats: { overlapsMerged: 0, wordsDeduplicated: 0 } };
  }

  // Step 2: Identify overlap regions and determine authoritative chunk for each
  const overlapRegions = new Map(); // chunkIndex -> { overlapStart, cutoffIndex, nextChunkStartIndex }
  const overlapRegionsProcessed = new Set();

  for (let i = 0; i < chunkIndices.length - 1; i++) {
    const chunkIndex = chunkIndices[i];
    const nextChunkIndex = chunkIndices[i + 1];

    const chunkWords = wordsByChunk.get(chunkIndex);
    const nextChunkWords = wordsByChunk.get(nextChunkIndex);

    if (chunkWords.length === 0 || nextChunkWords.length === 0) {continue;}

    // Find where timestamps overlap using the first/last word timestamps
    const thisChunkEnd = chunkWords[chunkWords.length - 1].absoluteEnd;
    const nextChunkStart = nextChunkWords[0].absoluteStart;

    // If there's overlap (this chunk ends after next chunk starts)
    if (thisChunkEnd > nextChunkStart) {
      const overlapStart = nextChunkStart;
      const overlapEnd = thisChunkEnd;

      overlapRegionsProcessed.add(`${chunkIndex}-${nextChunkIndex}`);

      // Find words in the overlap region from both chunks
      // For this chunk: words where absoluteStart >= overlapStart
      // For next chunk: words where absoluteStart <= overlapEnd
      let thisChunkOverlapStartIdx = chunkWords.length;
      for (let j = 0; j < chunkWords.length; j++) {
        if (chunkWords[j].absoluteStart >= overlapStart - 0.1) {
          thisChunkOverlapStartIdx = j;
          break;
        }
      }

      let nextChunkOverlapEndIdx = 0;
      for (let j = 0; j < nextChunkWords.length; j++) {
        if (nextChunkWords[j].absoluteStart > overlapEnd + 0.1) {
          break;
        }
        nextChunkOverlapEndIdx = j + 1;
      }

      const thisChunkOverlapWords = chunkWords.slice(thisChunkOverlapStartIdx);
      const nextChunkOverlapWords = nextChunkWords.slice(0, nextChunkOverlapEndIdx);

      // Calculate average centrality for each chunk's overlap words
      const thisChunkCentrality = thisChunkOverlapWords.length > 0
        ? thisChunkOverlapWords.reduce((sum, w) => sum + w.centrality, 0) / thisChunkOverlapWords.length
        : 0;
      const nextChunkCentrality = nextChunkOverlapWords.length > 0
        ? nextChunkOverlapWords.reduce((sum, w) => sum + w.centrality, 0) / nextChunkOverlapWords.length
        : 0;

      // The chunk with higher centrality is authoritative for the overlap region
      const useNextChunk = nextChunkCentrality > thisChunkCentrality;

      log(`Overlap region ${overlapStart.toFixed(2)}s-${overlapEnd.toFixed(2)}s: Chunk ${useNextChunk ? nextChunkIndex + 1 : chunkIndex + 1} is authoritative (centrality: ${useNextChunk ? nextChunkCentrality.toFixed(2) : thisChunkCentrality.toFixed(2)} vs ${useNextChunk ? thisChunkCentrality.toFixed(2) : nextChunkCentrality.toFixed(2)})`);

      // Store where to cut off this chunk and where to start the next chunk
      if (useNextChunk) {
        // Cut off this chunk at the overlap start, next chunk starts from beginning
        overlapRegions.set(chunkIndex, {
          cutoffIndex: thisChunkOverlapStartIdx, // Exclude overlap words from this chunk
          overlapWordsCount: thisChunkOverlapWords.length
        });
        overlapRegions.set(nextChunkIndex, {
          startIndex: 0, // Include all words from next chunk
          overlapWordsCount: 0
        });
      } else {
        // Keep all words from this chunk, skip overlap portion of next chunk
        overlapRegions.set(chunkIndex, {
          cutoffIndex: chunkWords.length, // Include all words from this chunk
          overlapWordsCount: 0
        });
        overlapRegions.set(nextChunkIndex, {
          startIndex: nextChunkOverlapEndIdx, // Skip overlap words from next chunk
          overlapWordsCount: nextChunkOverlapWords.length
        });
      }
    }
  }

  // Step 3: Build final word list by processing chunks in order
  const finalWords = [];
  let wordsDeduplicated = 0;
  const allWordsWithStatus = [];

  for (let i = 0; i < chunkIndices.length; i++) {
    const chunkIndex = chunkIndices[i];
    const chunkWords = wordsByChunk.get(chunkIndex);

    // Determine start and end indices for this chunk
    let startIdx = 0;
    let endIdx = chunkWords.length;

    // Check if we have overlap info for this chunk
    if (overlapRegions.has(chunkIndex)) {
      const overlapInfo = overlapRegions.get(chunkIndex);
      if (overlapInfo.cutoffIndex !== undefined) {
        endIdx = overlapInfo.cutoffIndex;
        wordsDeduplicated += overlapInfo.overlapWordsCount || 0;
      }
      if (overlapInfo.startIndex !== undefined) {
        startIdx = overlapInfo.startIndex;
        wordsDeduplicated += overlapInfo.overlapWordsCount || 0;
      }
    }

    // Add words from this chunk (in original order!)
    for (let j = 0; j < chunkWords.length; j++) {
      const word = chunkWords[j];
      const isIncluded = j >= startIdx && j < endIdx;

      allWordsWithStatus.push({
        ...word,
        deduplicated: !isIncluded,
        inOverlap: overlapRegionsProcessed.has(`${chunkIndex - 1}-${chunkIndex}`) ||
                   overlapRegionsProcessed.has(`${chunkIndex}-${chunkIndex + 1}`)
      });

      if (isIncluded) {
        finalWords.push(word);
      }
    }
  }

  // Reconstruct text from deduplicated words
  const text = finalWords.map(w => w.word).join(' ');

  log(`Timestamp deduplication: ${wordsDeduplicated} duplicate words removed`, 'success');

  return {
    text,
    words: finalWords,
    allWords: allWordsWithStatus, // All words including deduplicated ones for debug
    stats: {
      overlapsMerged: overlapRegionsProcessed.size,
      wordsDeduplicated
    }
  };
}

/**
 * Fallback: text-based merge when word timestamps aren't available
 */
function fallbackTextMerge(results, overlapDurationSec) {
  log('Using fallback text-based merge (no word timestamps)', 'warning');

  let mergedText = results[0].text.trim();
  let totalWordsDeduplicated = 0;
  let overlapsMerged = 0;

  for (let i = 1; i < results.length; i++) {
    const currentText = results[i].text.trim();

    if (overlapDurationSec > 0) {
      const mergeResult = mergeOverlappingTexts(mergedText, currentText);
      mergedText = mergeResult.merged;
      totalWordsDeduplicated += mergeResult.wordsDeduplicated;

      if (mergeResult.wordsDeduplicated > 0) {
        overlapsMerged++;
      } else {
        log(`Chunk ${i + 1}: Text-based dedup failed, possible duplicate content`, 'warning');
      }
    } else {
      mergedText = mergedText + ' ' + currentText;
    }
  }

  return {
    text: mergedText,
    words: [],
    stats: {
      overlapsMerged,
      wordsDeduplicated: totalWordsDeduplicated
    }
  };
}

/**
 * Text-based overlap merge (fallback when timestamps unavailable)
 */
function mergeOverlappingTexts(text1, text2) {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  const searchWindow1 = Math.min(words1.length, Math.ceil(words1.length * 0.3));
  const searchWindow2 = Math.min(words2.length, Math.ceil(words2.length * 0.3));

  const tail1 = words1.slice(-searchWindow1);
  const head2 = words2.slice(0, searchWindow2);

  const overlap = findBestOverlap(tail1, head2);

  if (overlap.length >= 2) { // Lowered threshold since this is fallback
    const text2WithoutOverlap = words2.slice(overlap.endIndex2).join(' ');
    return {
      merged: text1 + ' ' + text2WithoutOverlap,
      wordsDeduplicated: overlap.length
    };
  }

  return {
    merged: text1 + ' ' + text2,
    wordsDeduplicated: 0
  };
}

function findBestOverlap(tail1, head2) {
  let bestOverlap = { length: 0, startIndex1: 0, endIndex2: 0 };

  for (let i = 0; i < tail1.length; i++) {
    const matchResult = findMatchFromPosition(tail1, head2, i);
    if (matchResult.length > bestOverlap.length) {
      bestOverlap = {
        length: matchResult.length,
        startIndex1: i,
        endIndex2: matchResult.endIndex2
      };
    }
  }

  return bestOverlap;
}

function findMatchFromPosition(tail1, head2, startIndex1) {
  let matchLength = 0;
  const firstWord = normalizeWord(tail1[startIndex1]);
  let startIndex2 = -1;

  for (let k = 0; k < head2.length; k++) {
    if (normalizeWord(head2[k]) === firstWord) {
      startIndex2 = k;
      break;
    }
  }

  if (startIndex2 === -1) {
    return { length: 0, endIndex2: 0 };
  }

  let i1 = startIndex1;
  let i2 = startIndex2;

  while (i1 < tail1.length && i2 < head2.length) {
    if (normalizeWord(tail1[i1]) === normalizeWord(head2[i2])) {
      matchLength++;
      i1++;
      i2++;
    } else {
      break;
    }
  }

  return { length: matchLength, endIndex2: i2 };
}

function tokenize(text) {
  return text.split(/\s+/).filter(word => word.length > 0);
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '');
}
