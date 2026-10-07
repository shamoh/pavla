// The tooltip (title attribute) over the picture of a work wherever it leads to the work: gallery cards and the
// covers of the home page, a year and a collection. One plain text in lines, the same everywhere:
//   <title>[, detail: <caption>]
//   <technique> · <size> · <year>
//   <support>
//   <status>                       (only for sale, reserved, sold or given away)
//
//   <description, shortened>

import { summarize } from './seo.mjs';
import { formatSizeCm } from './works.mjs';

/** Longest description in the tooltip; browsers cut long titles anyway. */
export const TOOLTIP_DESCRIPTION_MAX = 240;

/** Statuses worth telling over the picture; not-for-sale says nothing a visitor needs. */
const SHOWN_STATUSES = new Set(['available', 'reserved', 'sold', 'gifted']);

/**
 * The tooltip of a work: `statusLabel` names the statuses (src/lib/site.ts), `detail` = the cover is its detail
 * photo (its caption, '' when none).
 */
export function workTooltip(work, statusLabel, { detail } = {}) {
  const heading = detail === undefined ? work.title : `${work.title}, detail${detail ? `: ${detail}` : ''}`;
  const facts = [work.technique, formatSizeCm(work.size_cm), work.year].filter(Boolean).join(' · ');
  const status = SHOWN_STATUSES.has(work.status) ? statusLabel[work.status] : '';
  const description = summarize(work.description, TOOLTIP_DESCRIPTION_MAX);
  const head = [heading, facts, work.support?.trim(), status].filter(Boolean).join('\n');
  return description ? `${head}\n\n${description}` : head;
}
