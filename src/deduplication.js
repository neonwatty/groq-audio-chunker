/**
 * Transcript deduplication using Longest Common Subsequence (LCS)
 *
 * When chunks overlap, both transcripts will contain the same words in the
 * overlap region. This module finds and removes the duplicated content.
 */

import { log } from './logger.js';

/**
 * Merge transcripts from overlapping chunks using LCS-based deduplication
 *
 * @param {Array} results - Array of transcription results with text
 * @param {number} overlapDurationSec - Expected overlap duration in seconds
 * @returns {Object} - { text: string, stats: { overlapsMerged, wordsDeduplicated } }
 */
export function mergeTranscriptsWithDeduplication(results, overlapDurationSec = 10) {
  const successfulResults = results.filter(r => r.success && r.text);

  if (successfulResults.length === 0) {
    return { text: '', stats: { overlapsMerged: 0, wordsDeduplicated: 0 } };
  }

  if (successfulResults.length === 1) {
    return {
      text: successfulResults[0].text.trim(),
      stats: { overlapsMerged: 0, wordsDeduplicated: 0 }
    };
  }

  let mergedText = successfulResults[0].text.trim();
  let totalWordsDeduplicated = 0;
  let overlapsMerged = 0;

  for (let i = 1; i < successfulResults.length; i++) {
    const currentText = successfulResults[i].text.trim();

    if (overlapDurationSec > 0) {
      const mergeResult = mergeOverlappingTexts(mergedText, currentText);
      mergedText = mergeResult.merged;
      totalWordsDeduplicated += mergeResult.wordsDeduplicated;

      if (mergeResult.wordsDeduplicated > 0) {
        overlapsMerged++;
        log(`Merged chunk ${i + 1}: deduplicated ${mergeResult.wordsDeduplicated} words`, 'success');
      }
    } else {
      // No overlap, just concatenate
      mergedText = mergedText + ' ' + currentText;
    }
  }

  return {
    text: mergedText,
    stats: {
      overlapsMerged,
      wordsDeduplicated: totalWordsDeduplicated
    }
  };
}

/**
 * Merge two overlapping texts by finding the longest common subsequence
 * at the boundary and removing the duplicate.
 *
 * @param {string} text1 - First text (earlier chunk)
 * @param {string} text2 - Second text (later chunk, starts with overlap)
 * @returns {Object} - { merged: string, wordsDeduplicated: number }
 */
function mergeOverlappingTexts(text1, text2) {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  // Look for overlap in the last portion of text1 and first portion of text2
  // We expect the overlap to be at most ~20% of either text
  const searchWindow1 = Math.min(words1.length, Math.ceil(words1.length * 0.3));
  const searchWindow2 = Math.min(words2.length, Math.ceil(words2.length * 0.3));

  const tail1 = words1.slice(-searchWindow1);
  const head2 = words2.slice(0, searchWindow2);

  // Find the best overlap match
  const overlap = findBestOverlap(tail1, head2);

  if (overlap.length >= 3) { // Require at least 3 words to consider it a valid overlap
    // Remove the overlapping portion from text2
    const text2WithoutOverlap = words2.slice(overlap.endIndex2).join(' ');

    return {
      merged: text1 + ' ' + text2WithoutOverlap,
      wordsDeduplicated: overlap.length
    };
  }

  // No significant overlap found, just concatenate
  return {
    merged: text1 + ' ' + text2,
    wordsDeduplicated: 0
  };
}

/**
 * Find the best overlapping sequence between the tail of arr1 and head of arr2
 */
function findBestOverlap(tail1, head2) {
  let bestOverlap = { length: 0, startIndex1: 0, endIndex2: 0 };

  // Try different starting positions in tail1
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

/**
 * Find how many consecutive words match starting from position in tail1
 */
function findMatchFromPosition(tail1, head2, startIndex1) {
  let matchLength = 0;
  let j = 0;

  // Find where in head2 the match starts
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

  // Count consecutive matches
  let i1 = startIndex1;
  let i2 = startIndex2;

  while (i1 < tail1.length && i2 < head2.length) {
    if (normalizeWord(tail1[i1]) === normalizeWord(head2[i2])) {
      matchLength++;
      i1++;
      i2++;
    } else {
      // Allow small gaps (1 word difference) for robustness
      if (i1 + 1 < tail1.length && normalizeWord(tail1[i1 + 1]) === normalizeWord(head2[i2])) {
        i1++;
      } else if (i2 + 1 < head2.length && normalizeWord(tail1[i1]) === normalizeWord(head2[i2 + 1])) {
        i2++;
      } else {
        break;
      }
    }
  }

  return { length: matchLength, endIndex2: i2 };
}

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return text
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Normalize a word for comparison (lowercase, remove punctuation)
 */
function normalizeWord(word) {
  return word
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}]/g, '');
}

/**
 * Alternative: Simple suffix-prefix matching
 * Faster but less robust than LCS
 */
export function simpleMerge(text1, text2, minOverlapWords = 5) {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  // Try to find where text2 overlaps with the end of text1
  for (let overlapLen = Math.min(50, words2.length); overlapLen >= minOverlapWords; overlapLen--) {
    const suffix1 = words1.slice(-overlapLen).map(normalizeWord).join(' ');
    const prefix2 = words2.slice(0, overlapLen).map(normalizeWord).join(' ');

    // Check for fuzzy match (allow 80% similarity)
    if (similarity(suffix1, prefix2) > 0.8) {
      const merged = words1.concat(words2.slice(overlapLen)).join(' ');
      return {
        merged,
        wordsDeduplicated: overlapLen
      };
    }
  }

  return {
    merged: text1 + ' ' + text2,
    wordsDeduplicated: 0
  };
}

/**
 * Calculate similarity between two strings (Jaccard-like)
 */
function similarity(str1, str2) {
  const set1 = new Set(str1.split(' '));
  const set2 = new Set(str2.split(' '));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
