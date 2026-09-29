// Version of the built site shown in the footer: calendar versioning (CalVer), the version *is* the build time.
//   label  v26.0928.1423                      year (2 digits), month+day, hour+minute, local time of the site
//   title  Web vygenerován 28. 9. 2026 ve 14:23 · commit 6031b4d   (tooltip; commit only when known)
//   iso    2026-09-28T14:23+02:00              for <time datetime>

export const SITE_TIME_ZONE = 'Europe/Prague';

/** Calendar parts of `date` in `timeZone`, plus its UTC offset as "+02:00". */
export function localParts(date, timeZone = SITE_TIME_ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.replace('GMT', '');
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, offset };
}

/**
 * Czech preposition before a time: "ve" when the spoken hour starts with a consonant cluster
 * (ve dvě, ve tři, ve čtyři, ve dvanáct, ve třináct, ve čtrnáct, ve dvacet…), otherwise "v" (v devět, v 15:00).
 */
export const timePreposition = (hour) => ([2, 3, 4, 12, 13, 14, 20, 21, 22, 23].includes(hour) ? 've' : 'v');

/** Footer version of a build at `date`, optionally with the short commit hash. */
export function buildVersion(date, commit = '', timeZone = SITE_TIME_ZONE) {
  const p = localParts(date, timeZone);
  const hour = Number(p.hour);
  const human = `${Number(p.day)}. ${Number(p.month)}. ${p.year} ${timePreposition(hour)} ${hour}:${p.minute}`;
  const short = String(commit).trim().slice(0, 7);
  return {
    label: `v${p.year.slice(2)}.${p.month}${p.day}.${p.hour}${p.minute}`,
    iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}${p.offset}`,
    title: `Web vygenerován ${human}${short ? ` · commit ${short}` : ''}`,
  };
}
