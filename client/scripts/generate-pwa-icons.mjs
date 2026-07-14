import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "public", "icon.svg");
const outDir = path.join(root, "public", "pwa");

await mkdir(outDir, { recursive: true });

const sizes = [180, 192, 512];
for (const size of sizes) {
  const png = await sharp(svgPath).resize(size, size).png().toBuffer();
  await writeFile(path.join(outDir, `icon-${size}.png`), png);
}

// Maskable icon with safe padding for Android adaptive icons
const padded = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#0A84FF"/>
  <g transform="translate(64 64) scale(0.75)">
    <rect x="112" y="148" width="288" height="216" rx="36" fill="#FFFFFF" fill-opacity="0.96"/>
    <path d="M168 236h176M168 280h128M168 324h96" stroke="#0A84FF" stroke-width="28" stroke-linecap="round"/>
    <circle cx="368" cy="324" r="28" fill="#30D158"/>
  </g>
</svg>
`);
await writeFile(
  path.join(outDir, "maskable-512.png"),
  await sharp(padded).resize(512, 512).png().toBuffer(),
);

console.log("Generated PWA icons in public/pwa/");
