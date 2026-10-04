/**
 * Bords à retirer d'une image de logo : des bandes unies, noires ou
 * blanches, laissées par une capture d'écran ou un export mal recadré.
 * L'en-tête d'IBDAA2 portait ainsi 10 lignes noires au-dessus de la
 * bannière, imprimées en grosse barre noire sur chaque bulletin et chaque
 * reçu.
 *
 * Une ligne (ou colonne) est un bord quand presque tous ses pixels sont
 * noirs, ou presque tous blancs. On ne retire jamais plus d'un tiers de
 * l'image d'un même côté : un logo très clair ne doit pas disparaître.
 *
 * Sans dépendance au navigateur : `data` est le tableau RGBA d'un
 * ImageData. Testé à part (tests/image-trim.test.ts).
 */

export interface Bounds {
  left: number;
  top: number;
  /** Bornes exclusives. */
  right: number;
  bottom: number;
}

const DARK = 40;
const LIGHT = 235;
const SHARE = 0.97;

function isFlat(data: Uint8ClampedArray, width: number, indices: Iterable<[number, number]>): boolean {
  let dark = 0;
  let light = 0;
  let total = 0;
  for (const [x, y] of indices) {
    const i = (y * width + x) * 4;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    // Un pixel transparent compte comme blanc : c'est ainsi qu'il s'imprime.
    if (data[i + 3] < 16 || min > LIGHT) light++;
    else if (max < DARK) dark++;
    total++;
  }
  return total > 0 && (dark / total >= SHARE || light / total >= SHARE);
}

function* row(y: number, from: number, to: number): Generator<[number, number]> {
  for (let x = from; x < to; x++) yield [x, y];
}
function* column(x: number, from: number, to: number): Generator<[number, number]> {
  for (let y = from; y < to; y++) yield [x, y];
}

export function trimmedBounds(data: Uint8ClampedArray, width: number, height: number): Bounds {
  const maxRows = Math.floor(height / 3);
  const maxCols = Math.floor(width / 3);
  let top = 0;
  while (top < maxRows && isFlat(data, width, row(top, 0, width))) top++;
  let bottom = height;
  while (height - bottom < maxRows && isFlat(data, width, row(bottom - 1, 0, width))) bottom--;
  let left = 0;
  while (left < maxCols && isFlat(data, width, column(left, top, bottom))) left++;
  let right = width;
  while (width - right < maxCols && isFlat(data, width, column(right - 1, top, bottom))) right--;
  return { left, top, right, bottom };
}
