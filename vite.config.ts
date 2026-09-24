import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { workerApiDev } from './vite-plugins/worker-api-dev.ts';

// Cesium fetches its workers, textures and widget images at runtime by URL.
// scripts/copy-cesium-assets.mjs stages them in public/cesium/ before dev and
// build; this is where the library is told to look for them.
const CESIUM_BASE_URL = 'cesium';

export default defineConfig({
  plugins: [
    react(),
    workerApiDev(),
  ],
  build: {
    // Cesium alone is several megabytes; that is the cost of the globe and it is
    // immutable and cached forever (see public/_headers).
    chunkSizeWarningLimit: 5000,
  },
  worker: {
    // satellite.js's optional multi-threaded WASM propagator is emscripten
    // output using top-level await, which cannot be bundled as an IIFE worker.
    // We only ever use the single-threaded JS SGP4 path.
    format: 'es',
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${CESIUM_BASE_URL}/`),
  },
});
