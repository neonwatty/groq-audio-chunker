/**
 * Main application entry point
 */

import { log, clearLogs } from './logger.js';
import {
  getAudioDuration,
  generateWaveformData,
  formatTime,
  formatSize
} from './audio-analyzer.js';
import { calculateChunks, extractChunkBlob, validateChunkSize } from './chunker.js';
import { transcribeChunks, validateApiKey } from './groq-client.js';
import { mergeTranscriptsWithDeduplication } from './deduplication.js';
import {
  drawWaveform,
  renderChunkMarkers,
  renderChunkList,
  updateChunkStatus,
  renderProgressPips,
  updateProgressPip
} from './waveform.js';

// State
let currentFile = null;
let currentChunks = null;
let transcriptionResults = null;
let mergeStats = null;
let mergedWords = null; // Word-level data with timestamps for debug view
let allWordsRaw = null; // All words before deduplication
let startTime = null;
let timerInterval = null;

// DOM Elements
const elements = {
  // Config
  apiKey: document.getElementById('apiKey'),
  chunkLength: document.getElementById('chunkLength'),
  chunkLengthValue: document.getElementById('chunkLengthValue'),
  silenceWindow: document.getElementById('silenceWindow'),
  silenceWindowValue: document.getElementById('silenceWindowValue'),
  silenceThreshold: document.getElementById('silenceThreshold'),
  silenceThresholdValue: document.getElementById('silenceThresholdValue'),
  overlapDuration: document.getElementById('overlapDuration'),
  overlapDurationValue: document.getElementById('overlapDurationValue'),

  // Upload
  uploadArea: document.getElementById('uploadArea'),
  audioFile: document.getElementById('audioFile'),
  browseBtn: document.getElementById('browseBtn'),
  fileInfo: document.getElementById('fileInfo'),
  fileName: document.getElementById('fileName'),
  fileMeta: document.getElementById('fileMeta'),
  removeFile: document.getElementById('removeFile'),

  // Analysis
  analysisSection: document.getElementById('analysisSection'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  chunkMarkers: document.getElementById('chunkMarkers'),
  chunkList: document.getElementById('chunkList'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  transcribeBtn: document.getElementById('transcribeBtn'),

  // Progress
  progressSection: document.getElementById('progressSection'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  currentChunk: document.getElementById('currentChunk'),
  elapsedTime: document.getElementById('elapsedTime'),
  chunkProgress: document.getElementById('chunkProgress'),

  // Results
  resultsSection: document.getElementById('resultsSection'),
  mergeStats: document.getElementById('mergeStats'),
  overlapsMerged: document.getElementById('overlapsMerged'),
  wordsDeduplicated: document.getElementById('wordsDeduplicated'),
  copyBtn: document.getElementById('copyBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  transcriptText: document.getElementById('transcriptText'),
  chunkTranscripts: document.getElementById('chunkTranscripts'),

  // Debug View
  showWordTimestamps: document.getElementById('showWordTimestamps'),
  wordTimeline: document.getElementById('wordTimeline'),
  jumpToTime: document.getElementById('jumpToTime'),
  wordFilter: document.getElementById('wordFilter'),
  wordList: document.getElementById('wordList'),

  // Logs
  clearLogs: document.getElementById('clearLogs')
};

// Initialize
function init() {
  log('Groq Audio Chunker initialized (with overlap + deduplication)');
  setupEventListeners();
  loadSavedSettings();
}

function setupEventListeners() {
  // Config sliders
  elements.chunkLength.addEventListener('input', (e) => {
    elements.chunkLengthValue.textContent = e.target.value;
    saveSettings();
  });

  elements.silenceWindow.addEventListener('input', (e) => {
    elements.silenceWindowValue.textContent = e.target.value;
    saveSettings();
  });

  elements.silenceThreshold.addEventListener('input', (e) => {
    elements.silenceThresholdValue.textContent = e.target.value;
    saveSettings();
  });

  elements.overlapDuration.addEventListener('input', (e) => {
    elements.overlapDurationValue.textContent = e.target.value;
    saveSettings();
  });

  // File upload
  elements.browseBtn.addEventListener('click', () => elements.audioFile.click());
  elements.uploadArea.addEventListener('click', (e) => {
    if (e.target !== elements.browseBtn) {
      elements.audioFile.click();
    }
  });

  elements.audioFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // Drag and drop
  elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
  });

  elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.classList.remove('dragover');
  });

  elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  elements.removeFile.addEventListener('click', handleFileRemove);

  // Actions
  elements.analyzeBtn.addEventListener('click', handleAnalyze);
  elements.transcribeBtn.addEventListener('click', handleTranscribe);

  // Results
  elements.copyBtn.addEventListener('click', handleCopyText);
  elements.downloadBtn.addEventListener('click', handleDownload);

  // Debug View
  elements.showWordTimestamps.addEventListener('change', (e) => {
    elements.wordTimeline.hidden = !e.target.checked;
    if (e.target.checked && allWordsRaw) {
      renderWordTimeline();
    }
  });

  elements.wordFilter.addEventListener('change', () => {
    if (allWordsRaw) renderWordTimeline();
  });

  elements.jumpToTime.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      jumpToTimeInWordList();
    }
  });

  // Logs
  elements.clearLogs.addEventListener('click', clearLogs);
}

function loadSavedSettings() {
  const saved = localStorage.getItem('groqChunkerSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      if (settings.chunkLength) {
        elements.chunkLength.value = settings.chunkLength;
        elements.chunkLengthValue.textContent = settings.chunkLength;
      }
      if (settings.silenceWindow) {
        elements.silenceWindow.value = settings.silenceWindow;
        elements.silenceWindowValue.textContent = settings.silenceWindow;
      }
      if (settings.silenceThreshold) {
        elements.silenceThreshold.value = settings.silenceThreshold;
        elements.silenceThresholdValue.textContent = settings.silenceThreshold;
      }
      if (settings.overlapDuration !== undefined) {
        elements.overlapDuration.value = settings.overlapDuration;
        elements.overlapDurationValue.textContent = settings.overlapDuration;
      }
    } catch (e) {
      // Ignore invalid saved settings
    }
  }
}

function saveSettings() {
  const settings = {
    chunkLength: elements.chunkLength.value,
    silenceWindow: elements.silenceWindow.value,
    silenceThreshold: elements.silenceThreshold.value,
    overlapDuration: elements.overlapDuration.value
  };
  localStorage.setItem('groqChunkerSettings', JSON.stringify(settings));
}

async function handleFileSelect(file) {
  if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|flac|ogg|webm)$/i)) {
    log('Invalid file type. Please select an audio file.', 'error');
    return;
  }

  currentFile = file;
  currentChunks = null;
  transcriptionResults = null;
  mergeStats = null;

  log(`File selected: ${file.name} (${formatSize(file.size)})`);

  try {
    const duration = await getAudioDuration(file);
    log(`Audio duration: ${formatTime(duration)}`);

    elements.fileName.textContent = file.name;
    elements.fileMeta.textContent = `${formatSize(file.size)} • ${formatTime(duration)}`;
    elements.fileInfo.hidden = false;
    elements.uploadArea.hidden = true;

    // Show analysis section
    elements.analysisSection.hidden = false;
    elements.transcribeBtn.disabled = true;

    // Generate and draw waveform
    try {
      const waveform = await generateWaveformData(file);
      drawWaveform(elements.waveformCanvas, waveform.data);
      log('Waveform generated', 'success');
    } catch (e) {
      log(`Waveform generation failed: ${e.message}`, 'warning');
    }

    // Reset other sections
    elements.progressSection.hidden = true;
    elements.resultsSection.hidden = true;
    elements.chunkList.innerHTML = '';
    elements.chunkMarkers.innerHTML = '';

  } catch (error) {
    log(`Error loading audio: ${error.message}`, 'error');
    handleFileRemove();
  }
}

function handleFileRemove() {
  currentFile = null;
  currentChunks = null;
  transcriptionResults = null;
  mergeStats = null;

  elements.fileInfo.hidden = true;
  elements.uploadArea.hidden = false;
  elements.analysisSection.hidden = true;
  elements.progressSection.hidden = true;
  elements.resultsSection.hidden = true;
  elements.audioFile.value = '';

  log('File removed');
}

async function handleAnalyze() {
  if (!currentFile) return;

  elements.analyzeBtn.disabled = true;
  elements.analyzeBtn.textContent = '⏳ Analyzing...';

  try {
    const chunkLengthMinutes = parseInt(elements.chunkLength.value);
    const silenceWindowSec = parseInt(elements.silenceWindow.value);
    const silenceThreshold = parseFloat(elements.silenceThreshold.value);
    const overlapDurationSec = parseInt(elements.overlapDuration.value);

    log(`Starting chunk analysis (${chunkLengthMinutes}min chunks, ${overlapDurationSec}s overlap, ${silenceWindowSec}s window)...`);

    currentChunks = await calculateChunks(currentFile, {
      chunkLengthMinutes,
      silenceWindowSec,
      silenceThreshold,
      overlapDurationSec,
      onProgress: (pct) => {
        elements.analyzeBtn.textContent = `⏳ Analyzing... ${Math.round(pct)}%`;
      }
    });

    // Render chunk visualization
    const duration = await getAudioDuration(currentFile);
    renderChunkMarkers(elements.chunkMarkers, currentChunks, duration);
    renderChunkList(elements.chunkList, currentChunks);

    // Enable transcription
    elements.transcribeBtn.disabled = false;

    log(`Analysis complete: ${currentChunks.length} chunks`, 'success');

    // Log chunk summary with overlap info
    currentChunks.forEach((chunk, i) => {
      const overlapInfo = chunk.overlap.leading > 0 || chunk.overlap.trailing > 0
        ? ` [overlap: ${chunk.overlap.leading}s/${chunk.overlap.trailing}s]`
        : '';
      log(`  Chunk ${i + 1}: ${formatTime(chunk.logicalStart)} → ${formatTime(chunk.logicalEnd)}${overlapInfo}`);
    });

  } catch (error) {
    log(`Analysis failed: ${error.message}`, 'error');
  } finally {
    elements.analyzeBtn.disabled = false;
    elements.analyzeBtn.textContent = '🔍 Analyze Chunks';
  }
}

async function handleTranscribe() {
  if (!currentFile || !currentChunks) return;

  // Validate API key
  const apiKey = elements.apiKey.value.trim();
  const keyValidation = validateApiKey(apiKey);
  if (!keyValidation.valid) {
    log(keyValidation.message, 'error');
    elements.apiKey.focus();
    return;
  }

  // Disable controls
  elements.analyzeBtn.disabled = true;
  elements.transcribeBtn.disabled = true;

  // Show progress section
  elements.progressSection.hidden = false;
  elements.resultsSection.hidden = true;
  renderProgressPips(elements.chunkProgress, currentChunks.length);

  // Start timer
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);

  const overlapDurationSec = parseInt(elements.overlapDuration.value);
  log(`Starting transcription of ${currentChunks.length} chunks (overlap: ${overlapDurationSec}s)...`);

  try {
    transcriptionResults = await transcribeChunks(
      currentChunks,
      (chunk) => extractChunkBlob(currentFile, chunk),
      apiKey,
      {
        onChunkStart: (chunk, index) => {
          log(`Transcribing chunk ${index + 1}/${currentChunks.length}...`);
          updateChunkStatus(elements.chunkList, index, 'processing');
          updateProgressPip(elements.chunkProgress, index, 'processing');
          elements.currentChunk.textContent = `Chunk ${index + 1} of ${currentChunks.length}`;
          updateProgress((index / currentChunks.length) * 100);
        },
        onChunkComplete: (chunk, index, result) => {
          updateChunkStatus(elements.chunkList, index, 'done');
          updateProgressPip(elements.chunkProgress, index, 'done');
          updateProgress(((index + 1) / currentChunks.length) * 100);
        },
        onChunkError: (chunk, index, error) => {
          updateChunkStatus(elements.chunkList, index, 'error', error.message);
          updateProgressPip(elements.chunkProgress, index, 'error');
        }
      }
    );

    // Show results with deduplication
    clearInterval(timerInterval);
    showResults(overlapDurationSec);

    const successCount = transcriptionResults.filter(r => r.success).length;
    log(`Transcription complete: ${successCount}/${currentChunks.length} chunks successful`, 'success');

  } catch (error) {
    log(`Transcription failed: ${error.message}`, 'error');
  } finally {
    clearInterval(timerInterval);
    elements.analyzeBtn.disabled = false;
    elements.transcribeBtn.disabled = false;
  }
}

function updateProgress(percent) {
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = `${Math.round(percent)}%`;
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  elements.elapsedTime.textContent = `Elapsed: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showResults(overlapDurationSec) {
  elements.resultsSection.hidden = false;

  // Merge transcripts with deduplication
  log('Merging transcripts with deduplication...');
  const mergeResult = mergeTranscriptsWithDeduplication(transcriptionResults, overlapDurationSec);
  mergeStats = mergeResult.stats;
  mergedWords = mergeResult.words;
  allWordsRaw = mergeResult.allWords || [];

  elements.transcriptText.textContent = mergeResult.text || '(No transcription results)';

  // Reset debug view
  elements.showWordTimestamps.checked = false;
  elements.wordTimeline.hidden = true;

  // Show merge stats if overlap was used
  if (overlapDurationSec > 0) {
    elements.mergeStats.hidden = false;
    elements.overlapsMerged.textContent = mergeStats.overlapsMerged;
    elements.wordsDeduplicated.textContent = mergeStats.wordsDeduplicated;
    log(`Deduplication: ${mergeStats.overlapsMerged} overlaps merged, ${mergeStats.wordsDeduplicated} words deduplicated`, 'success');
  } else {
    elements.mergeStats.hidden = true;
  }

  // Show individual chunk transcripts
  elements.chunkTranscripts.innerHTML = '';

  transcriptionResults.forEach((result, index) => {
    const div = document.createElement('div');
    div.className = 'chunk-transcript';

    if (result.success) {
      const chunk = result.chunk;
      const hasOverlap = chunk.overlap.leading > 0 || chunk.overlap.trailing > 0;
      const overlapBadge = hasOverlap
        ? `<span class="overlap-badge">🔀 ${chunk.overlap.leading}s/${chunk.overlap.trailing}s overlap</span>`
        : '';

      div.innerHTML = `
        <div class="chunk-transcript-header">
          <span>Chunk ${index + 1} ${overlapBadge}</span>
          <span>${formatTime(chunk.logicalStart)} → ${formatTime(chunk.logicalEnd)}</span>
        </div>
        <div class="chunk-transcript-text">${escapeHtml(result.text)}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="chunk-transcript-header">
          <span>Chunk ${index + 1}</span>
          <span style="color: var(--error)">Error</span>
        </div>
        <div class="chunk-transcript-text" style="color: var(--error)">
          ${escapeHtml(result.error)}
        </div>
      `;
    }

    elements.chunkTranscripts.appendChild(div);
  });
}

function handleCopyText() {
  const text = elements.transcriptText.textContent;
  navigator.clipboard.writeText(text).then(() => {
    log('Transcript copied to clipboard', 'success');
    elements.copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      elements.copyBtn.textContent = '📋 Copy Text';
    }, 2000);
  }).catch(err => {
    log(`Failed to copy: ${err.message}`, 'error');
  });
}

function handleDownload() {
  const text = elements.transcriptText.textContent;
  const filename = currentFile ? currentFile.name.replace(/\.[^.]+$/, '') + '_transcript.txt' : 'transcript.txt';

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
  log(`Downloaded: ${filename}`, 'success');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render the word timeline debug view
 */
function renderWordTimeline() {
  if (!allWordsRaw || allWordsRaw.length === 0) {
    elements.wordList.innerHTML = '<p class="no-words">No word timestamp data available</p>';
    return;
  }

  const filter = elements.wordFilter.value;
  let wordsToShow = allWordsRaw;

  // Apply filter
  if (filter === 'overlap') {
    wordsToShow = allWordsRaw.filter(w => w.inOverlap);
  } else if (filter === 'deduplicated') {
    wordsToShow = allWordsRaw.filter(w => w.deduplicated);
  }

  if (wordsToShow.length === 0) {
    elements.wordList.innerHTML = `<p class="no-words">No words match the filter "${filter}"</p>`;
    return;
  }

  // Group words by time (for easier visualization)
  const html = wordsToShow.map((w, idx) => {
    const classes = ['word-item'];

    // Chunk color class (cycle through 3 colors)
    classes.push(`chunk-${w.chunkIndex % 3}`);

    // Overlap and deduplication status
    if (w.inOverlap) classes.push('in-overlap');
    if (w.deduplicated) classes.push('deduplicated');

    const startTime = formatTimeMs(w.absoluteStart);
    const endTime = formatTimeMs(w.absoluteEnd);
    const centralityPct = Math.round(w.centrality * 100);

    return `
      <div class="${classes.join(' ')}" data-time="${w.absoluteStart}">
        <span class="word-text">${escapeHtml(w.word)}</span>
        <span class="word-time">${startTime} - ${endTime}</span>
        <span class="word-chunk">Chunk ${w.chunkIndex + 1}</span>
        <span class="word-centrality" title="Distance from chunk boundary">📍 ${centralityPct}%</span>
        ${w.deduplicated ? '<span class="word-status">✗ Removed</span>' : '<span class="word-status kept">✓ Kept</span>'}
      </div>
    `;
  }).join('');

  elements.wordList.innerHTML = html;
  log(`Word timeline: showing ${wordsToShow.length} of ${allWordsRaw.length} words`, 'info');
}

/**
 * Jump to a specific time in the word list
 */
function jumpToTimeInWordList() {
  const input = elements.jumpToTime.value.trim();
  if (!input) return;

  // Parse time input (supports "10:30", "10:30.5", "630" seconds)
  let targetTime;
  if (input.includes(':')) {
    const parts = input.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    targetTime = minutes * 60 + seconds;
  } else {
    targetTime = parseFloat(input);
  }

  if (isNaN(targetTime)) {
    log(`Invalid time format: "${input}"`, 'warning');
    return;
  }

  // Find the first word at or after this time
  const wordElements = elements.wordList.querySelectorAll('.word-item');
  let foundElement = null;

  for (const el of wordElements) {
    const wordTime = parseFloat(el.dataset.time);
    if (wordTime >= targetTime) {
      foundElement = el;
      break;
    }
  }

  if (foundElement) {
    // Scroll to the element
    foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight briefly
    foundElement.classList.add('highlight');
    setTimeout(() => foundElement.classList.remove('highlight'), 2000);

    log(`Jumped to ${formatTimeMs(targetTime)}`, 'success');
  } else {
    log(`No words found at or after ${formatTimeMs(targetTime)}`, 'warning');
  }
}

/**
 * Format time with milliseconds (e.g., "1:23.456")
 */
function formatTimeMs(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
}

// Start the app
init();
