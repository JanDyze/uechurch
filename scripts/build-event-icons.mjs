#!/usr/bin/env node
/**
 * Generates the two things the event-icon system needs from Phosphor:
 *
 *   1. src/data/phosphorIcons.json — every icon name, for the picker's search.
 *   2. public/icons/events/*.png   — raster copies for email and push.
 *
 * The second one is why this script exists. Phosphor ships SVG, and neither
 * destination can use it: Gmail strips <svg> entirely, and the FCM webpush
 * `notification.icon` field takes a URL that Android rasterises. So the icons
 * that leave the app have to be PNGs, generated ahead of time and served from
 * our own origin.
 *
 * Only a curated set is rasterised. All ~1500 would bloat the deployment for
 * no gain — an email only ever needs the icon for an event type, plus the
 * handful of marks a church actually picks.
 *
 * Usage: npm run build:icons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { RASTERISED, toKebabCase } from "../lib/eventIcons.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SVG_DIR = path.join(ROOT, "node_modules/@phosphor-icons/core/assets/regular");
const PNG_DIR = path.join(ROOT, "public/icons/events");
const CATALOGUE = path.join(ROOT, "src/data/phosphorIcons.json");
// Path data, so the app can draw Phosphor icons without shipping the
// component library. Importing that library's namespace pulled 5.8 MB into
// the Events chunk, because a dynamic key lookup defeats tree-shaking
// entirely; these two files come to 644 KB for all 1512, and the common set
// is the only one loaded up front.
const PATHS_COMMON = path.join(ROOT, "src/data/eventIconPaths.json");
const PATHS_ALL = path.join(ROOT, "src/data/eventIconPathsAll.json");

// Rendered at 96px so a 44px email image and Android's notification tray both
// have pixels to spare on a high-DPI screen.
const PNG_SIZE = 96;
// Icons are drawn in the brand colour; the SVGs use fill="currentColor",
// so this is a straight substitution before rasterising.
const BRAND = "#01779b";

/** church-outline.svg -> ChurchOutline, matching the Vue component minus "Ph". */
const toPascalCase = (file) =>
  file
    .replace(/\.svg$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

async function main() {
  if (!fs.existsSync(SVG_DIR)) {
    console.error(`Phosphor assets not found at ${SVG_DIR}\nRun: npm install`);
    process.exit(1);
  }

  /* 1. catalogue */
  const names = fs
    .readdirSync(SVG_DIR)
    .filter((f) => f.endsWith(".svg"))
    .map(toPascalCase)
    .sort();

  fs.writeFileSync(CATALOGUE, JSON.stringify({ icons: names }, null, 0) + "\n");
  console.log(`catalogue : ${names.length} icons -> src/data/phosphorIcons.json`);

  /* 1b. path data — the markup inside <svg>, keyed by asset name */
  const innerOf = (file) =>
    fs
      .readFileSync(path.join(SVG_DIR, file), "utf8")
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .trim();

  const allPaths = {};
  for (const file of fs.readdirSync(SVG_DIR).filter((f) => f.endsWith(".svg"))) {
    allPaths[file.replace(/\.svg$/, "")] = innerOf(file);
  }

  const commonPaths = {};
  for (const name of RASTERISED) {
    const key = toKebabCase(name);
    if (allPaths[key]) commonPaths[key] = allPaths[key];
  }

  fs.writeFileSync(PATHS_COMMON, JSON.stringify(commonPaths) + "\n");
  fs.writeFileSync(PATHS_ALL, JSON.stringify(allPaths) + "\n");
  const kb = (f) => Math.round(fs.statSync(f).size / 1024);
  console.log(
    `paths     : ${Object.keys(commonPaths).length} common (${kb(PATHS_COMMON)} KB, bundled), ` +
      `${Object.keys(allPaths).length} all (${kb(PATHS_ALL)} KB, lazy)`
  );

  /* 2. PNGs */
  fs.mkdirSync(PNG_DIR, { recursive: true });

  let written = 0;
  const missing = [];
  for (const name of RASTERISED) {
    const file = path.join(SVG_DIR, `${toKebabCase(name)}.svg`);
    if (!fs.existsSync(file)) {
      missing.push(name);
      continue;
    }
    // The SVGs declare fill="currentColor", which means nothing to a
    // rasteriser — swap in a real colour first.
    const svg = fs.readFileSync(file, "utf8").replace(/currentColor/g, BRAND);
    await sharp(Buffer.from(svg))
      .resize(PNG_SIZE, PNG_SIZE)
      .png({ compressionLevel: 9 })
      .toFile(path.join(PNG_DIR, `${toKebabCase(name)}.png`));
    written += 1;
  }

  const bytes = fs
    .readdirSync(PNG_DIR)
    .reduce((sum, f) => sum + fs.statSync(path.join(PNG_DIR, f)).size, 0);
  console.log(`rasterised: ${written} PNGs at ${PNG_SIZE}px -> public/icons/events/ (${Math.round(bytes / 1024)} KB)`);

  if (missing.length) {
    // A typo in RASTERISE would otherwise fail silently at send time, when the
    // email quietly renders a broken image.
    console.error(`\nNOT FOUND in Phosphor (fix the names in RASTERISED (lib/eventIcons.js)):\n  ${missing.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
