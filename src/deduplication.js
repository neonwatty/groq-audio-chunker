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
 * 1. Sort all words by absolute start time
 * 2. For words with similar timestamps (within tolerance), keep the one with higher centrality
 * 3. Reconstruct the text from the deduplicated word list
 */
function deduplicateByTimestamp(words, overlapDurationSec) {
  // Sort by absolute start time
  words.sort((a, b) => a.absoluteStart - b.absoluteStart);

  const TIMESTAMP_TOLERANCE = 0.3; // 300ms tolerance for "same" word
  const deduplicated = [];
  let wordsDeduplicated = 0;
  let overlapRegionsProcessed = new Set();

  for (let i = 0; i < words.length; i++) {
    const current = words[i];

    // Look ahead for duplicates (words from different chunks at similar timestamps)
    let dominated = false;

    for (let j = i + 1; j < words.length; j++) {
      const next = words[j];

      // If we're past the tolerance window, stop looking
      if (next.absoluteStart - current.absoluteStart > TIMESTAMP_TOLERANCE) {
        break;
      }

      // Check if this is the same word from a different chunk
      if (next.chunkIndex !== current.chunkIndex) {
        // Same timestamp region, different chunks = overlap
        overlapRegionsProcessed.add(`${current.chunkIndex}-${next.chunkIndex}`);

        // Compare the words (might be transcribed slightly differently)
        const sameWord = normalizeWord(current.word) === normalizeWord(next.word);
        const similarTiming = Math.abs(next.absoluteStart - current.absoluteStart) < TIMESTAMP_TOLERANCE;

        if (similarTiming) {
          // Keep the one with higher centrality (further from chunk boundary)
          if (next.centrality > current.centrality) {
            dominated = true;
            wordsDeduplicated++;
            break;
          }
        }
      }
    }

    if (!dominated) {
      deduplicated.push(current);
    }
  }

  // Also check backwards for any we missed (words where a later one dominates an earlier one)
  // This handles cases where the second chunk's word should replace the first chunk's word
  const finalWords = [];
  const seen = new Set();

  for (const word of deduplicated) {
    // Create a key for this timestamp region
    const timeKey = Math.round(word.absoluteStart * 3); // ~333ms buckets

    // Check if we've already seen a word in this time bucket
    if (seen.has(timeKey)) {
      // Find the existing word
      const existing = finalWords.find(w => Math.round(w.absoluteStart * 3) === timeKey);
      if (existing && word.centrality > existing.centrality) {
        // Replace with higher centrality word
        const idx = finalWords.indexOf(existing);
        finalWords[idx] = word;
        wordsDeduplicated++;
      } else {
        wordsDeduplicated++;
      }
    } else {
      seen.add(timeKey);
      finalWords.push(word);
    }
  }

  // Reconstruct text from deduplicated words
  const text = finalWords.map(w => w.word).join(' ');

  log(`Timestamp deduplication: ${wordsDeduplicated} duplicate words removed`, 'success');

  // Mark which words in the original list were deduplicated (for debug view)
  const finalWordSet = new Set(finalWords.map(w => `${w.absoluteStart.toFixed(3)}-${w.chunkIndex}`));
  const allWordsWithStatus = words.map(w => ({
    ...w,
    deduplicated: !finalWordSet.has(`${w.absoluteStart.toFixed(3)}-${w.chunkIndex}`),
    inOverlap: overlapRegionsProcessed.has(`${Math.min(w.chunkIndex, w.chunkIndex + 1)}-${Math.max(w.chunkIndex, w.chunkIndex + 1)}`) ||
               overlapRegionsProcessed.has(`${w.chunkIndex - 1}-${w.chunkIndex}`) ||
               overlapRegionsProcessed.has(`${w.chunkIndex}-${w.chunkIndex + 1}`)
  }));

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
  return word.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '');
}
