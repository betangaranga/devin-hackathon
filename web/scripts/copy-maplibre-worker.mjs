// Copia el web worker de maplibre-gl a public/ para servirlo estático.
// maplibre-gl deriva la URL del worker desde import.meta.url, lo que no
// funciona bajo bundlers (Turbopack): se fija con setWorkerUrl() en MapView.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkg = require.resolve("maplibre-gl/package.json");
const src = join(dirname(pkg), "dist", "maplibre-gl-worker.mjs");
const destDir = join(dirname(fileURLToPath(import.meta.url)), "../public");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "maplibre-gl-worker.mjs"));
console.log("maplibre-gl-worker.mjs -> public/");
