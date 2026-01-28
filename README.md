# Groq Audio Chunker

Browser-based audio chunking with smart silence detection and overlap deduplication for transcribing long audio files using Groq's Whisper API.

## Features

- **100% Client-Side**: No server required. All processing happens in your browser.
- **Smart Silence Detection**: Finds natural pauses near chunk boundaries to avoid cutting words mid-sentence.
- **Overlap + Deduplication**: Configurable overlap between chunks ensures no words are lost, with automatic deduplication of repeated content.
- **Adjustable Parameters**: Fine-tune chunk length, silence detection, and overlap duration.
- **Visual Feedback**: Waveform visualization with chunk markers, silence regions, and overlap zones.
- **Progress Tracking**: Real-time progress with per-chunk status updates and merge statistics.
- **Mobile-Friendly Memory**: Processes chunks sequentially to minimize memory usage.

## How It Works

1. **Upload** an audio file (MP3, WAV, M4A, FLAC, etc.)
2. **Configure** chunk length, overlap, and silence detection parameters
3. **Analyze** to calculate chunk boundaries with smart silence detection
4. **Transcribe** by sending overlapping chunks to Groq's Whisper API
5. **Merge** transcripts with automatic deduplication of overlap regions
6. **Download** the final merged transcript

### Overlap Strategy

Instead of cutting exactly at boundaries (which might split words), the chunker:

1. Finds silence near the target cut point
2. Extends each chunk into the next by the configured overlap duration
3. Both chunks capture the boundary region
4. Deduplication removes the repeated content when merging

```
Example with 10-second overlap:

Chunk 1: 0:00 ──────────────────── 10:10
                              └─ 10s overlap ─┘
Chunk 2:                     9:50 ──────────────────── 20:10
                        └─ 10s overlap ─┘

The overlapping "9:50 - 10:10" region is transcribed twice,
then deduplicated when merging transcripts.
```

### Deduplication Algorithm

The merger uses a longest-common-subsequence approach to find overlapping text:

1. Tokenizes both transcript chunks into words
2. Searches for matching sequences at the boundary
3. Removes duplicated content from the second chunk
4. Joins the transcripts seamlessly

## Getting Started

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com/keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/neonwatty/groq-audio-chunker.git
cd groq-audio-chunker

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open http://localhost:5173 in your browser.

### Usage

1. Enter your Groq API key (it's only sent to Groq's API, never stored)
2. Adjust settings:
   - **Chunk Length**: Target duration for each chunk (1-30 minutes)
   - **Overlap Duration**: How much chunks should overlap (0-30 seconds, recommended: 10s)
   - **Silence Window**: How far to search for silence around cut points
   - **Silence Threshold**: How quiet audio must be to count as silence
3. Upload an audio file
4. Click "Analyze Chunks" to see where cuts will be made
5. Observe the purple overlap regions in the waveform visualization
6. Click "Start Transcription" to begin
7. View merge statistics showing how many words were deduplicated

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Chunk Length | 10 min | Target duration for each chunk |
| Overlap Duration | 10 sec | How much chunks should overlap (0 = disabled) |
| Silence Window | 30 sec | How far (±) to search for silence around cut points |
| Silence Threshold | 0.01 | RMS amplitude below which audio is considered silent |

### Recommended Settings

- **For reliability**: 10-minute chunks with 10-second overlap (~3.3% overhead)
- **For minimal API cost**: 10-minute chunks with 0 overlap (relies on silence detection)
- **For very long files**: Consider shorter chunks (5 min) to stay under Groq's 25MB limit

## Technical Details

### Memory Efficiency

The chunker is designed to work on mobile devices by:

- Only loading small windows of audio for silence analysis (~3-5MB)
- Processing and sending one chunk at a time
- Never holding the entire decoded file in memory
- Using byte slicing instead of full audio decoding where possible

### Groq API Limits

- **Free tier**: 25MB per file
- **Paid tier**: 100MB per file (via URL parameter)
- **Rate limits**: Vary by plan

The chunker automatically keeps chunks under the size limit.

### Deduplication Stats

After transcription, you'll see:
- **Overlap Regions Merged**: How many chunk boundaries were deduplicated
- **Words Deduplicated**: Total words removed as duplicates

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── main.js           # UI logic & orchestration
├── audio-analyzer.js # Silence detection, waveform analysis
├── chunker.js        # Chunk calculation with overlap
├── deduplication.js  # LCS-based transcript merging
├── groq-client.js    # Groq API integration
├── waveform.js       # Visualization rendering
├── logger.js         # Debug output
└── styles.css        # Dark theme UI
```

## License

MIT

## Acknowledgments

- [Groq](https://groq.com) for the fast Whisper API
- [Vite](https://vitejs.dev) for the build tooling
