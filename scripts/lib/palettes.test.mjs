import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  AUTO, PALETTES, PALETTE_KEY, checkPalettes, contrast, paletteCss, paletteEventParams, paletteScript, paperBlend, pictureShadows, resolvePalette, tokenVar,
} from './palettes.mjs';

const fake = (id, scheme, over = {}) => ({ id, label: id, scheme, colors: { ...PALETTES[0].colors, ...over }, picture: { shadow: 1, edge: null } });

test('the palettes of the site are complete and readable (every text colour at least 4.5 : 1 on its paper)', () => {
  assert.deepEqual(checkPalettes(), []);
  assert.deepEqual(PALETTES.map((p) => p.id), ['papir', 'pergamen', 'noc']);
});

test('checkPalettes: catches unreadable text, a missing token, a bad colour, a duplicate id and no dark palette', () => {
  const dark = { ...PALETTES[2] };
  assert.match(checkPalettes([fake('a', 'light', { inkSoft: '#bbbbbb' }), dark]).join('\n'), /a: inkSoft on paper has contrast/);
  const { error, ...noError } = PALETTES[0].colors;
  assert.match(checkPalettes([PALETTES[0], { ...dark, colors: { ...noError, paper: '#000000', ink: '#ffffff', inkSoft: '#cccccc', accent: '#cccccc', ok: '#cccccc' } }]).join('\n'), /noc: error must be #rrggbb/);
  assert.match(checkPalettes([fake('a', 'light', { line: 'red' }), dark]).join('\n'), /a: line must be #rrggbb/);
  assert.match(checkPalettes([fake('a', 'light'), fake('a', 'light'), dark]).join('\n'), /a: duplicate/);
  assert.match(checkPalettes([fake('auto', 'light'), dark]).join('\n'), /auto: duplicate or reserved/);
  assert.match(checkPalettes([fake('a', 'light')]).join('\n'), /one light and one dark/);
});

test('contrast: black on white is 21, a colour on itself is 1', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#777777', '#777777'), 1);
});

test('resolvePalette: a chosen palette wins; auto and unknown follow the system', () => {
  assert.equal(resolvePalette('pergamen', true).id, 'pergamen');
  assert.equal(resolvePalette(AUTO, false).id, 'papir');
  assert.equal(resolvePalette(AUTO, true).id, 'noc');
  assert.equal(resolvePalette('nonsense', true).id, 'noc');
});

test('tokenVar and paletteCss: one rule per palette, the system default without JavaScript', () => {
  assert.equal(tokenVar('inkSoft'), '--ink-soft');
  assert.equal(tokenVar('paper2'), '--paper-2');
  const css = paletteCss();
  assert.match(css, /^:root\{color-scheme:light;--paper:#f7f4ee;/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)\{:root\{color-scheme:dark;--paper:#1c1a18;/);
  for (const p of PALETTES) assert.match(css, new RegExp(`:root\\[data-palette="${p.id}"\\]\\{color-scheme:${p.scheme};`));
});

/** Runs the inline script against a tiny fake page; returns what it set. */
function runScript({ stored = null, dark = false, storage = true } = {}) {
  const attrs = {};
  const meta = { content: '', setAttribute(k, v) { this[k] = v; } };
  const store = new Map(stored ? [[PALETTE_KEY, stored]] : []);
  const listeners = [];
  const events = [];
  const window = {
    matchMedia: () => ({ matches: dark, addEventListener: (_, f) => listeners.push(f) }),
  };
  const context = {
    window,
    document: {
      documentElement: { setAttribute: (k, v) => { attrs[k] = v; } },
      querySelector: () => meta,
      dispatchEvent: (e) => events.push(e.detail),
    },
    localStorage: storage
      ? { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
      : { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } },
    CustomEvent: class { constructor(_, { detail }) { this.detail = detail; } },
  };
  vm.runInNewContext(paletteScript(), context);
  return { attrs, meta, store, events, api: window.pavlaPalette, listeners };
}

test('paletteScript: nothing stored = auto by the system; a stored choice wins; the bar colour follows', () => {
  const day = runScript();
  assert.deepEqual([day.attrs['data-palette'], day.attrs['data-palette-choice'], day.meta.content], ['papir', AUTO, '#f7f4ee']);
  assert.equal(runScript({ dark: true }).attrs['data-palette'], 'noc');
  const chosen = runScript({ stored: 'pergamen', dark: true });
  assert.deepEqual([chosen.attrs['data-palette'], chosen.attrs['data-palette-choice']], ['pergamen', 'pergamen']);
  assert.equal(runScript({ stored: 'gone' }).attrs['data-palette-choice'], AUTO, 'a removed palette falls back to auto');
});

test('paletteScript: set() stores the choice, auto forgets it, a blocked storage still switches', () => {
  const page = runScript();
  page.api.set('noc');
  assert.equal(page.store.get(PALETTE_KEY), 'noc');
  assert.equal(page.attrs['data-palette'], 'noc');
  assert.deepEqual({ ...page.events.at(-1) }, { choice: 'noc', palette: 'noc' }, 'the switcher hears about the change');
  page.api.set(AUTO);
  assert.equal(page.store.has(PALETTE_KEY), false);
  assert.equal(page.attrs['data-palette'], 'papir');
  const blocked = runScript({ storage: false });
  blocked.api.set('pergamen');
  assert.equal(blocked.attrs['data-palette'], 'pergamen');
});

test('pictureShadows: the light strength as it was, stronger on dark paper with a hairline edge; checked in palettes', () => {
  assert.deepEqual(pictureShadows({ shadow: 1, edge: null }), {
    '--shadow-soft': '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
    '--shadow-deep': '0 2px 4px rgb(0 0 0 / 0.05), 0 24px 48px -24px rgb(0 0 0 / 0.3)',
    '--drop-soft': 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.06)) drop-shadow(0 6px 8px rgb(0 0 0 / 0.12))',
    '--drop-deep': 'drop-shadow(0 2px 2px rgb(0 0 0 / 0.05)) drop-shadow(0 14px 16px rgb(0 0 0 / 0.22))',
  });
  const night = pictureShadows({ shadow: 2.2, edge: 'rgb(255 255 255 / 0.08)' });
  assert.match(night['--drop-deep'], /^drop-shadow\(0 0 1px rgb\(255 255 255 \/ 0.08\)\) drop-shadow/, 'a cut-out work gets the hairline too');
  assert.match(night['--shadow-deep'], /^0 0 0 1px rgb\(255 255 255 \/ 0.08\), 0 2px 4px rgb\(0 0 0 \/ 0.11\), 0 24px 48px -24px rgb\(0 0 0 \/ 0.66\)$/);
  assert.equal(pictureShadows({ shadow: 10, edge: null })['--shadow-deep'].includes('/ 1)'), true, 'an alpha never exceeds 1');
  assert.match(paletteCss(), /:root\[data-palette="noc"\]\{[^}]*--shadow-deep:0 0 0 1px/);
  assert.match(checkPalettes([{ ...fake('a', 'light'), picture: { shadow: 0 } }, PALETTES[2]]).join('\n'), /a: picture.shadow must be a positive number/);
});

test('paperBlend: white edges melt into light paper (multiply), dark paper keeps the picture as it is', () => {
  assert.equal(paperBlend('light'), 'multiply');
  assert.equal(paperBlend('dark'), 'normal');
  const css = paletteCss();
  for (const p of PALETTES) assert.match(css, new RegExp(`:root\\[data-palette="${p.id}"\\]\\{[^}]*--paper-blend:${paperBlend(p.scheme)}`));
  assert.match(css, /@media \(prefers-color-scheme: dark\)\{:root\{[^}]*--paper-blend:normal/);
});

test('paletteEventParams: the chosen palette, auto for anything else', () => {
  assert.deepEqual(paletteEventParams('noc'), { palette: 'noc' });
  assert.deepEqual(paletteEventParams(AUTO), { palette: AUTO });
  assert.deepEqual(paletteEventParams('gone'), { palette: AUTO });
});
