// How alike two works are: one measure for the similar works of a work page (scripts/lib/similar.mjs), the lookalikes
// of the game Detail dne (rankLookalikes, which adds how alike the close-up looks) and, later, the search. 0 = the
// same, more = farther apart:
//   - colours: the shares of the colours of the painted part and the mood (warm / cool, light / dark, vivid / pastel),
//     colourDistance of scripts/lib/colors.mjs over the colour profile of each work (colourProfile),
//   - technique: the same one nothing, one of the same family (techniqueFamily: painting or drawing) a little,
//     another family more,
//   - tags: the more of the smaller set of tags of the two they share, the nearer (one shared tag of a work with one
//     tag = the same subject); nothing when either has no tags.
// The weights are AFFINITY_WEIGHTS for the similar works (tried in the prototype .prototypes/barvy.html, tab „Podobné
// obrazy“) and GAME_AFFINITY_WEIGHTS for the lookalikes of the game (rankLookalikes in scripts/lib/detail-game.mjs).

import { colourBins, colourDistance, familyShares, paletteMood } from './colors.mjs';

/**
 * What a technique looks like to a player: `colour` = a painting (watercolour, oil, acrylic, gouache, pastel, also with lines in it),
 * `drawing` = lines in black or one colour (ink, brush pen, marker, pencil, a print). A player tells the two apart at a glance, the
 * techniques of one family hardly.
 */
export function techniqueFamily(technique) {
  return /akvarel|olej|akryl|kvaš|pastel|tempera/i.test(String(technique ?? '')) ? 'colour' : 'drawing';
}

/**
 * The weights of workDistance: `colour` × colourDistance (with `mood` as its moodWeight), `technique` for another
 * technique family (`sameFamily` for another technique of the same family), `tags` × the share of tags not shared
 * (`anyTag`: GAME_AFFINITY_WEIGHTS).
 */
export const AFFINITY_WEIGHTS = { colour: 1, mood: 0.5, technique: 0.15, sameFamily: 0.05, tags: 0.08 };

/**
 * The weights of the game Detail dne (× GAME_AFFINITY_SCALE, added to how alike the close-up looks, lookalikeDistance):
 * a drawing among paintings far (25), another painting technique a little (6), another subject (8), the colours and
 * mood of the whole work up to 15: the close-up decides, the whole work tips the balance. `anyTag`: the subject of the game
 * (one tag of the target shared is the same subject, a target without tags has no subject), the levels are tuned to it.
 */
export const GAME_AFFINITY_WEIGHTS = { colour: 0.15, mood: 0.5, technique: 0.25, sameFamily: 0.06, tags: 0.08, anyTag: true };
/** The scale of workDistance in the game: the units of lookalikeDistance (OKLab-like distances of colours × 100). */
export const GAME_AFFINITY_SCALE = 100;

/**
 * The colour profile of a work: { shares (familyShares of the colours of `settings`, colourSettings), mood (paletteMood) },
 * from its info.json `colors` (analyseColours); empty without an analysis (then colours tell nothing).
 */
export function colourProfile(colors, settings) {
  const bins = colourBins(colors);
  if (!bins.length) return { shares: {}, mood: { warm: 0, light: 0, vivid: 0 }, analysed: false };
  return { shares: familyShares(bins, settings.families), mood: paletteMood(bins), analysed: true };
}

/**
 * How far apart two works are ({ technique, tags, colourProfile }), 0 = the same. Colours count only when both works
 * have them analysed (otherwise a work without its analysis would look like a grey one).
 */
export function workDistance(a, b, weights = AFFINITY_WEIGHTS) {
  const both = a.colourProfile?.analysed && b.colourProfile?.analysed;
  const colour = both ? weights.colour * colourDistance(a.colourProfile, b.colourProfile, { moodWeight: weights.mood }) : 0;
  const technique = a.technique === b.technique ? 0
    : techniqueFamily(a.technique) === techniqueFamily(b.technique) ? weights.sameFamily : weights.technique;
  const tagsA = new Set(a.tags ?? []);
  const tagsB = new Set(b.tags ?? []);
  const shared = [...tagsA].filter((t) => tagsB.has(t)).length;
  // anyTag (the game, `a` = the work of the puzzle): one shared tag is the same subject, a target without tags has none
  const tags = weights.anyTag
    ? (tagsA.size && !shared ? weights.tags : 0)
    : (tagsA.size && tagsB.size ? weights.tags * (1 - shared / Math.min(tagsA.size, tagsB.size)) : 0);
  return Math.round((colour + technique + tags) * 1000) / 1000;
}
