# Groq Audio Chunker

Browser-based audio chunking with smart silence detection for transcribing long audio files using Groq's Whisper API.

## Features

- **100% Client-Side**: No server required. All processing happens in your browser.
- **Smart Silence Detection**: Finds natural pauses near chunk boundaries to avoid cutting words mid-sentence.
- **Adjustable Parameters**: Fine-tune chunk length, silence detection window, and threshold.
- **Visual Feedback**: Waveform visualization with chunk markers and silence regions.
- **Progress Tracking**: Real-time progress with per-chunk status updates.
- **Mobile-Friendly Memory**: Processes chunks sequentially to minimize memory usage.

## How It Works

1. **Upload** an audio file (MP3, WAV, M4A, FLAC, etc.)
2. **Configure** chunk length and silence detection parameters
3. **Analyze** to calculate chunk boundaries with smart silence detection
4. **Transcribe** by sending chunks to Groq's Whisper API
5. **Download** the merged transcript

### Silence Detection

Instead of cutting at exact 10-minute boundaries (which might split a word), the chunker:

1. Looks for silent regions within a configurable window around each cut point
2. Uses RMS (Root Mean Square) amplitude analysis to detect silence
3. Chooses the longest silence closest to the target time
4. Falls back to exact cuts if no suitable silence is found

## Getting Started

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com/keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/groq-audio-chunker.git
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
   - **Chunk Length**: How long each chunk should be (1-30 minutes)
   - **Silence Window**: How far to search for silence around cut points
   - **Silence Threshold**: How quiet audio must be to count as silence
3. Upload an audio file
4. Click "Analyze Chunks" to see where cuts will be made
5. Click "Start Transcription" to begin

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Chunk Length | 10 min | Target duration for each chunk |
| Silence Window | 30 sec | How far (±) to search for silence around cut points |
| Silence Threshold | 0.01 | RMS amplitude below which audio is considered silent (0.01 = 1%) |

## Technical Details

### Memory Efficiency

The chunker is designed to work on mobile devices by:

- Only loading small windows of audio for silence analysis (~3-5MB)
- Processing and sending one chunk at a time
- Never holding the entire decoded file in memory

### Groq API Limits

- **Free tier**: 25MB per file
- **Paid tier**: 100MB per file (via URL)
- **Rate limits**: Vary by plan

The chunker automatically keeps chunks under the size limit.

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT

## Acknowledgments

- [Groq](https://groq.com) for the fast Whisper API
- [Vite](https://vitejs.dev) for the build tooling
