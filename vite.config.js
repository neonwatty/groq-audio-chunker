import { defineConfig } from 'vite';

export default defineConfig({
  // Serve test-audio folder for development testing
  publicDir: 'public',
  server: {
    fs: {
      // Allow serving files from test-audio folder
      allow: ['..', 'test-audio']
    },
    // COOP/COEP headers required for SharedArrayBuffer (ffmpeg.wasm multi-threaded)
    // Using 'credentialless' instead of 'require-corp' to allow CDN resources
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  // Also set headers for preview mode
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  // Optimize ffmpeg.wasm dependencies
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
});
