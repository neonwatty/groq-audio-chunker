#!/bin/bash
# Download YouTube audio for testing
# Usage: ./download-youtube.sh <youtube-url>

if [ -z "$1" ]; then
  echo "Usage: ./download-youtube.sh <youtube-url>"
  echo "Example: ./download-youtube.sh https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  exit 1
fi

mkdir -p test-audio
mkdir -p public/test-audio

echo "Downloading audio from: $1"
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  --print-to-file "%(title)s" /tmp/yt-title.txt \
  -o "test-audio/%(title)s.%(ext)s" \
  "$1"

# Get the title from the download
TITLE=$(cat /tmp/yt-title.txt 2>/dev/null | head -1)
FILENAME="${TITLE}.mp3"

if [ -f "test-audio/${FILENAME}" ]; then
  # Copy to public folder for serving
  cp "test-audio/${FILENAME}" "public/test-audio/"

  # Get duration
  DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "test-audio/${FILENAME}" 2>/dev/null)
  MINS=$(echo "$DURATION / 60" | bc)
  SECS=$(echo "$DURATION % 60" | bc | xargs printf "%.0f")
  DURATION_FMT="${MINS}:$(printf "%02d" $SECS)"

  echo ""
  echo "Done! Audio saved:"
  echo "  File: ${FILENAME}"
  echo "  Duration: ${DURATION_FMT}"
  echo "  Location: public/test-audio/"
  echo ""
  echo "Note: Update public/test-audio-manifest.json to add this file to the UI dropdown."
else
  echo "Error: Download failed"
  exit 1
fi
