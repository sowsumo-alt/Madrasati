// Génère les icônes PWA/iOS/favicon à partir de public/logo-crest.png (le
// blason extrait du logo officiel). À relancer avec
// `node scripts/generate-icons.mjs` si public/logo-crest.png est remplacé.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PRIMARY_700 = "#0b5e38";
const CREST = path.join(process.cwd(), "public", "logo-crest.png");

/** contentScale < 1 laisse une marge (nécessaire pour les icônes "maskable"
 *  Android, dont l'OS peut rogner jusqu'à 20% des bords). */
async function iconBuffer(size, { contentScale, opaque = false }) {
  const contentSize = Math.round(size * contentScale);
  const crest = await sharp(CREST)
    .resize(contentSize, contentSize, { fit: "contain" })
    .toBuffer();

  let img = sharp({
    create: { width: size, height: size, channels: 4, background: PRIMARY_700 },
  }).composite([{ input: crest, gravity: "center" }]);

  if (opaque) img = img.flatten({ background: PRIMARY_700 });

  return img.png().toBuffer();
}

/** Enveloppe un PNG dans un conteneur .ico minimal (format supporté par
 *  tous les navigateurs modernes depuis Windows Vista). */
function wrapPngAsIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(6 + 16, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

const outDir = path.join(process.cwd(), "public", "icons");
await mkdir(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, contentScale: 0.88 },
  { file: "icon-512.png", size: 512, contentScale: 0.88 },
  { file: "maskable-192.png", size: 192, contentScale: 0.72 },
  { file: "maskable-512.png", size: 512, contentScale: 0.72 },
];

for (const t of targets) {
  const buf = await iconBuffer(t.size, { contentScale: t.contentScale });
  await writeFile(path.join(outDir, t.file), buf);
  console.log(`  icons/${t.file}`);
}

// iOS ignore le manifest : il lui faut un <link rel="apple-touch-icon">
// séparé, sans transparence, à la racine de /public.
const appleBuf = await iconBuffer(180, { contentScale: 0.86, opaque: true });
await writeFile(path.join(process.cwd(), "public", "apple-touch-icon.png"), appleBuf);
console.log("  apple-touch-icon.png");

// favicon.ico (convention Next.js : src/app/favicon.ico)
const faviconPng = await iconBuffer(48, { contentScale: 0.86, opaque: true });
await writeFile(
  path.join(process.cwd(), "src", "app", "favicon.ico"),
  wrapPngAsIco(faviconPng, 48),
);
console.log("  src/app/favicon.ico");

console.log("Icônes régénérées à partir de public/logo-crest.png");
