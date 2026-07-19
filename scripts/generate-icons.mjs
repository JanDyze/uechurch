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

// Notification badge: Android draws this as a flat silhouette using only the
// alpha channel. Cut the blue "uec" letters (and blue rim) out as transparent
// so they read as negative space; everything else becomes solid white.
{
  const size = 512;
  const { data } = await sharp(src)
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const isBackground = a < 40 || (r > 240 && g > 240 && b > 240);
    const isBlue = b > 110 && b > r + 40 && g > r;
    if (isBackground || isBlue) {
      data[i + 3] = 0;
    } else {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
  }

  await sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .resize(96, 96)
    .png()
    .toFile(`${out}/badge-96x96.png`);
}

console.log("icons generated");
