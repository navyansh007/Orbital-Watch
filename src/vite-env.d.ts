/// <reference types="vite/client" />

/** Injected by `define` in vite.config.ts — where Cesium loads its static assets from. */
declare const CESIUM_BASE_URL: string;

interface ImportMetaEnv {
  readonly VITE_CESIUM_ION_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Cesium reads this to locate its static assets. Set in Globe.tsx. */
  CESIUM_BASE_URL: string;
}
