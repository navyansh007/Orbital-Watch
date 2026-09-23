/**
 * Copies CesiumJS's static runtime files into public/cesium/.
 *
 * Cesium loads its web workers, textures, IAU data and widget images at
 * runtime by URL rather than through the bundler, so they have to exist as
 * plain files under a known base path (CESIUM_BASE_URL, set in vite.config.ts).
 *
 * public/ is the one directory Vite both serves in dev and copies into the
 * build, so putting them there keeps dev and production on the same path.
 * The copy is generated, not source — see .gitignore.
 *
 * Runs automatically via the predev / prebuild npm hooks.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(projectRoot, 'node_modules/cesium/Build/Cesium');
const destination = join(projectRoot, 'public/cesium');
const stampFile = join(destination, '.cesium-version');

/** Everything Cesium fetches at runtime. Cesium.js itself is not needed — we bundle from source. */
const DIRECTORIES = ['Assets', 'ThirdParty', 'Widgets', 'Workers'];

const { version } = JSON.parse(
  await readFile(join(projectRoot, 'node_modules/cesium/package.json'), 'utf8'),
);

if ((await readFile(stampFile, 'utf8').catch(() => null)) === version) {
  process.stdout.write(`cesium assets already up to date (v${version})\n`);
  process.exit(0);
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const directory of DIRECTORIES) {
  await cp(join(source, directory), join(destination, directory), { recursive: true });
}

await writeFile(stampFile, version);
process.stdout.write(`copied cesium v${version} assets -> public/cesium\n`);
