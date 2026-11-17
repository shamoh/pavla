import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { GAME_SHARE_LOOK, gameShareLayout, gameShareName, gameShareParts, renderGameShare } from './detail-game-share.mjs';

const work = (id, featured = false, modified = '2026-11-01') => ({ id, featured, folder: `tvorba/2026/${id}`, widths: [480, 960, 1600, 2400], modified });
const size = { width: 1200, height: 800, background: '#f4f1ea', quality: 85 };

test('gameShareParts: the newest of the author\'s selection first, others after them, three at most', () => {
  const parts = gameShareParts([work('a'), work('b', true), work('c'), work('d', true), work('e', true), work('f', true)]);
  assert.deepEqual(parts.map((p) => [p.id, p.effect, p.width]), [['b', 'clear', 1600], ['d', 'mist', 1600], ['e', 'mosaic', 1600]]);
  assert.deepEqual(gameShareParts([work('a'), work('b', true)]).map((p) => p.id), ['b', 'a']);
  assert.deepEqual(gameShareParts([]), []);
  assert.equal(gameShareParts([{ ...work('a'), widths: [480, 960] }])[0].width, 960, 'the picture nearest 1600 px');
});

test('gameShareName: a new name for new parts or another size, the same for the same', () => {
  const parts = gameShareParts([work('a', true), work('b', true), work('c', true)]);
  const name = gameShareName(parts, size);
  assert.match(name, /^og-[0-9a-f]{8}\.jpg$/);
  assert.equal(gameShareName(gameShareParts([work('a', true), work('b', true), work('c', true)]), size), name);
  assert.notEqual(gameShareName(gameShareParts([work('a', true), work('b', true), work('c', true, '2026-11-02')]), size), name, 'a changed work');
  assert.notEqual(gameShareName(parts, { ...size, width: 1000 }), name);
});

test('gameShareLayout: squares in a row, centred, inside the image', () => {
  const places = gameShareLayout(3, size);
  assert.equal(places.length, 3);
  assert.ok(places.every((p) => p.side === places[0].side && p.top + p.side <= size.height && p.left >= 0));
  assert.ok(places[2].left + places[2].side <= size.width);
  const left = places[0].left;
  const right = size.width - places[2].left - places[2].side;
  assert.ok(Math.abs(left - right) <= 1, 'centred');
});

test('renderGameShare: a JPEG of the size from the pictures of the works', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-share-'));
  try {
    const parts = gameShareParts([work('a', true), work('b', true), work('c', true)]);
    for (const p of parts) {
      await fs.mkdir(path.join(dir, p.folder), { recursive: true });
      await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#4a7a9a' } }).jpeg().toFile(path.join(dir, p.folder, '1600.jpg'));
    }
    const jpeg = await renderGameShare(parts, dir, size);
    const meta = await sharp(jpeg).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 800]);
    assert.ok(GAME_SHARE_LOOK.effects.length === 3);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
