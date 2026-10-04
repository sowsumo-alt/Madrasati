import { test } from "node:test";
import assert from "node:assert/strict";

import { trimmedBounds } from "../src/lib/image-trim";

/** Image RGBA de `width` × `height`, peinte par `paint(x, y)`. */
function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number?]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return data;
}

// Une bannière colorée, avec des pixels variés (pas un aplat).
const banner = (x: number, y: number): [number, number, number] => [30 + ((x * 7) % 200), 120 + ((y * 5) % 100), 60];

test("la bande noire au-dessus de la bannière est retirée", () => {
  const data = image(60, 30, (x, y) => (y < 4 ? [0, 0, 0] : banner(x, y)));
  assert.deepEqual(trimmedBounds(data, 60, 30), { left: 0, top: 4, right: 60, bottom: 30 });
});

test("des marges blanches (ou transparentes) sont retirées aussi", () => {
  const data = image(60, 30, (x, y) =>
    x < 5 || x >= 55 ? [255, 255, 255] : y >= 27 ? [0, 0, 0, 0] : banner(x, y),
  );
  assert.deepEqual(trimmedBounds(data, 60, 30), { left: 5, top: 0, right: 55, bottom: 27 });
});

test("une image sans bord reste entière, et rien au-delà d'un tiers n'est retiré", () => {
  const plain = image(60, 30, banner);
  assert.deepEqual(trimmedBounds(plain, 60, 30), { left: 0, top: 0, right: 60, bottom: 30 });
  const white = image(60, 30, () => [255, 255, 255]);
  const b = trimmedBounds(white, 60, 30);
  assert.ok(b.bottom - b.top >= 10 && b.right - b.left >= 20);
});
