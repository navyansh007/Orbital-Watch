import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { pagesFunctionsDev } from './vite-plugins/pages-functions-dev.ts';

// Cesium ships its workers, assets, widget CSS and third-party code as static
// files that must sit next to the bundle and be findable at runtime.
const CESIUM_BASE_URL = 'cesium';
const cesiumBuild = 'node_modules/cesium/Build/Cesium';

export default defineConfig({
  plugins: [
    react(),
    pagesFunctionsDev(),
    viteStaticCopy({
      targets: ['Workers', 'Assets', 'Widgets', 'ThirdParty'].map((dir) => ({
        src: `${cesiumBuild}/${dir}`,
        dest: CESIUM_BASE_URL,
      })),
    }),
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
