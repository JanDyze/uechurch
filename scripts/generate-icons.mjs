import sharp from "sharp";
import { mkdirSync } from "node:fs";

const src = "public/uec-logo.png";
const out = "public/icons";
mkdirSync(out, { recursive: true });

// Standard icons: transparent background, full-bleed logo
for (const size of [64, 192, 512]) {
  await sharp(src).resize(size, size).png().toFile(`${out}/pwa-${size}x${size}.png`);
}

// Maskable icon: logo at ~65% inside a solid brand-colored square (safe zone)
const logo = await sharp(src).resize(332, 332).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#01779b" },
})
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile(`${out}/maskable-512x512.png`);

// Apple touch icon: 180x180 on white (iOS dislikes transparency)
const logo180 = await sharp(src).resize(150, 150).png().toBuffer();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: "#ffffff" },
})
  .composite([{ input: logo180, gravity: "center" }])
  .png()
  .toFile(`${out}/apple-touch-icon.png`);

console.log("icons generated");
