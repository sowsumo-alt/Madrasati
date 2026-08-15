// Génère les icônes PWA/iOS à partir du logo de src/components/brand/logo.tsx,
// aplati en SVG statique (couleurs en dur : un manifest/icône ne peut pas lire
// les variables CSS de l'application). À relancer avec `node scripts/generate-icons.mjs`
// si la palette de marque change.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PRIMARY_500 = "#168a58";
const PRIMARY_600 = "#0f7248";
const PRIMARY_700 = "#0b5e38";
const PRIMARY_800 = "#094a2d";
const ACCENT_300 = "#ddbb6e";
const ACCENT_400 = "#d4a94c";
const ACCENT_500 = "#c9973a";

const LEAVES = [
  { x: 11, y: 27, a: -55 },
  { x: 9.5, y: 34, a: -35 },
  { x: 10, y: 41, a: -15 },
  { x: 12.5, y: 47.5, a: 5 },
  { x: 16.5, y: 52.5, a: 25 },
];

function branch() {
  return `
    <path d="M20 55C10 49 6.5 39 8.5 26" fill="none" stroke="${PRIMARY_600}" stroke-width="2" stroke-linecap="round"/>
    ${LEAVES.map(
      (l) =>
        `<ellipse cx="${l.x}" cy="${l.y}" rx="4.4" ry="2.3" fill="${PRIMARY_500}" transform="rotate(${l.a} ${l.x} ${l.y})"/>`,
    ).join("")}
  `;
}

function logoMark() {
  return `
    ${branch()}
    <g transform="translate(64,0) scale(-1,1)">${branch()}</g>
    <rect x="18" y="29.5" width="28" height="3.4" rx="1.2" fill="${ACCENT_400}"/>
    <rect x="21.4" y="34.5" width="3.8" height="11.5" fill="${ACCENT_400}"/>
    <rect x="30.1" y="34.5" width="3.8" height="11.5" fill="${ACCENT_300}"/>
    <rect x="38.8" y="34.5" width="3.8" height="11.5" fill="${ACCENT_400}"/>
    <rect x="16.5" y="47.4" width="31" height="3.6" rx="1.4" fill="${ACCENT_500}"/>
    <path d="M21 18.5V26c7.3 4.4 14.7 4.4 22 0v-7.5z" fill="${PRIMARY_700}"/>
    <path d="M32 4 54 14 32 24 10 14z" fill="${PRIMARY_800}"/>
    <path d="M54 14v8" stroke="${ACCENT_400}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="54" cy="24.5" r="2.4" fill="${ACCENT_400}"/>
  `;
}

/** contentScale < 1 laisse une marge (nécessaire pour les icônes "maskable"
 *  Android, dont l'OS peut rogner jusqu'à 20% des bords). */
function iconSvg({ background, cornerRadius = 0, contentScale = 1 }) {
  const bg = background
    ? `<rect width="64" height="64" rx="${cornerRadius}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    ${bg}
    <g transform="translate(32 32) scale(${contentScale}) translate(-32 -32)">
      ${logoMark()}
    </g>
  </svg>`;
}

const outDir = path.join(process.cwd(), "public", "icons");
await mkdir(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, svg: iconSvg({ background: PRIMARY_700 }) },
  { file: "icon-512.png", size: 512, svg: iconSvg({ background: PRIMARY_700 }) },
  {
    file: "maskable-192.png",
    size: 192,
    svg: iconSvg({ background: PRIMARY_700, contentScale: 0.7 }),
  },
  {
    file: "maskable-512.png",
    size: 512,
    svg: iconSvg({ background: PRIMARY_700, contentScale: 0.7 }),
  },
];

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(path.join(outDir, t.file));
  console.log(`  ${t.file}`);
}

// iOS ignore le manifest : il lui faut un <link rel="apple-touch-icon">
// séparé, sans transparence, à la racine de /public.
const appleSvg = iconSvg({ background: PRIMARY_700, cornerRadius: 0, contentScale: 0.82 });
await sharp(Buffer.from(appleSvg))
  .resize(180, 180)
  .flatten({ background: PRIMARY_700 })
  .png()
  .toFile(path.join(process.cwd(), "public", "apple-touch-icon.png"));
console.log("  apple-touch-icon.png");

console.log("Icônes générées dans public/icons/ et public/apple-touch-icon.png");
