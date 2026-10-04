// Messages from visitors: the form on the contact page and the panel on every other page ("Napište mi").
// A message is sent by Web3Forms (https://web3forms.com) and arrives as an e-mail; the site has no server.
// This module holds what both the build and the browser need: the kinds of messages, the context of the page a
// message is about, its subject and the request to Web3Forms. The panel itself: src/components/MessagePanel.astro,
// the form: src/components/MessageForm.astro, the behaviour in the browser: src/lib/message-form.ts.

/**
 * Kinds of messages in the order of the select. `needsEmail`: without an address there is no way to answer.
 * Labels are Czech, they are what the visitor sees.
 */
export const MESSAGE_TYPES = [
  { id: 'greeting', label: 'Pozdrav nebo vzkaz' },
  { id: 'work', label: 'Dotaz na obraz', needsEmail: true },
  { id: 'purchase', label: 'Zájem o koupi', needsEmail: true },
  { id: 'collaboration', label: 'Spolupráce, výstava, plenér' },
  { id: 'bug', label: 'Chyba na webu' },
  { id: 'other', label: 'Něco jiného' },
];

const TYPE_BY_ID = new Map(MESSAGE_TYPES.map((t) => [t.id, t]));

/** The kind of message for an id; an unknown id is the first kind, so an old draft never breaks the form. */
export const messageType = (id) => TYPE_BY_ID.get(id) ?? MESSAGE_TYPES[0];

/** True when the kind of message needs an address to answer to. */
export const needsEmail = (id) => Boolean(messageType(id).needsEmail);

/**
 * What a page is, for a message about it: { kind: 'work', path, title, id, year, onSale } for a work,
 * { kind: 'page', path, title } for any other page. null = the message is about nothing in particular.
 */
export function workContext(work, path) {
  return { kind: 'work', path, title: work.title, id: work.id, year: work.year, onSale: Boolean(work.onSale) };
}
export const pageContext = (path, title) => ({ kind: 'page', path, title });

/** The kind preselected for a context: a work for sale = purchase, another work = a question, otherwise a greeting. */
export function defaultType(context) {
  if (context?.kind !== 'work') return 'greeting';
  return context.onSale ? 'purchase' : 'work';
}

/** The line above the form saying what the message is about, e.g. "K obrazu: Ovce (2026)"; null without context. */
export function contextLabel(context) {
  if (!context) return null;
  if (context.kind === 'work') return `K obrazu: ${context.title}${context.year ? ` (${context.year})` : ''}`;
  return `Ke stránce: ${context.title || context.path}`;
}

/** Subject of the e-mail, e.g. "[pavla-web] Dotaz na obraz: Ovce (v39nd)" or "[pavla-web] Chyba na webu: Kolekce". */
export function messageSubject(typeId, context) {
  const label = messageType(typeId).label;
  if (!context) return `[pavla-web] ${label}`;
  const about = context.kind === 'work' ? `${context.title} (${context.id})` : context.title || context.path;
  return `[pavla-web] ${label}: ${about}`;
}

/** A plausible e-mail address (the browser checks it too; this is the same rule for the draft and the tests). */
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());

/**
 * Problems of a filled form, as { field: Czech message }; empty object = it can be sent.
 * `fields`: { type, text, email }.
 */
export function validateMessage({ type, text, email }) {
  const errors = {};
  if (!String(text ?? '').trim()) errors.text = 'Napište prosím pár slov.';
  const mail = String(email ?? '').trim();
  if (mail && !isEmail(mail)) errors.email = 'Tahle adresa nevypadá správně.';
  else if (!mail && needsEmail(type)) errors.email = 'Bez e-mailu vám nebudu moct odpovědět.';
  return errors;
}

/** Web3Forms endpoint. */
export const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

/** A Web3Forms access key: a UUID. It is public by design (it only says where to deliver), so it lives in the config. */
export const isAccessKey = (key) => typeof key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

/** Page the visitor lands on after sending without JavaScript (Web3Forms redirects there). */
export const SENT_PATH = '/kontakt/odeslano/';

/**
 * How messages work in this build, from `messages` in site.config.yaml:
 * 'live' = sent by Web3Forms; 'preview' = the site from the test data (always, so trying it never e-mails the author),
 * the form works but sends nothing; null = no key, no form (the contact page shows the address as before).
 * A key that is set but invalid is an error.
 */
export function messagesMode(config, { demo }) {
  const key = config?.accessKey;
  const set = !(key === undefined || key === null || key === '');
  if (set && !isAccessKey(key)) throw new Error(`messages.accessKey must be a Web3Forms access key (a UUID), got ${JSON.stringify(key)}`);
  if (demo) return 'preview';
  return set ? 'live' : null;
}

/**
 * Everything about messages for this build, from `messages` in site.config.yaml: { mode (see messagesMode), accessKey }.
 * The key is only put into the pages when messages are live (the preview of the test data has none).
 */
export function messagesSettings(config, { demo }) {
  const mode = messagesMode(config, { demo });
  return { mode, accessKey: mode === 'live' ? config.accessKey : '' };
}

/** Parameters of the message_sent event (scripts/lib/analytics.mjs EVENTS.message): the kind and the work, if any. */
export function messageEventParams({ type, context }) {
  return {
    message_type: messageType(type).id,
    ...(context?.kind === 'work' && { work_id: context.id, work_title: context.title }),
  };
}

/**
 * The JSON body for Web3Forms. `site`: { title, url }; `fields`: { type, text, email }; `context` as above.
 * Fields other than the Web3Forms ones (access_key, subject, from_name, replyto, botcheck) show up in the e-mail as they are.
 */
export function web3formsBody(accessKey, site, { type, text, email }, context) {
  const mail = String(email ?? '').trim();
  return {
    access_key: accessKey,
    subject: messageSubject(type, context),
    from_name: site.title,
    ...(mail && { replyto: mail, 'E-mail': mail }),
    'O čem': messageType(type).label,
    'Zpráva': String(text ?? '').trim(),
    ...(sitePath(context?.path) && { 'Stránka': new URL(sitePath(context.path), site.url).href }),
    ...(context?.kind === 'work' && { 'Obraz': `${context.title} (${context.id})` }),
    botcheck: false,
  };
}

/**
 * The footer link "Napsat k této stránce" for browsers without JavaScript: the contact page with the context in
 * the query (stranka = address, nazev = title, obraz = id of a work), e.g. /kontakt/?stranka=%2Ftvorba%2F&nazev=Tvorba.
 */
export function contactLink(context) {
  if (!context) return '/kontakt/';
  const q = new URLSearchParams({ stranka: context.path, nazev: context.title ?? '' });
  if (context.kind === 'work') q.set('obraz', context.id);
  return `/kontakt/?${q}`;
}

/**
 * A path on this site, normalised the way a browser reads it ("/tvorba/?x=1"), or null for anything that would leave
 * the site: "//host", "/\\host" (a backslash counts as a slash), "https://…", control characters. The check is done by
 * resolving it as a URL, not by looking at the string, so it cannot disagree with how the e-mail link is built.
 */
export function sitePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || /[\\\u0000-\u001f]/.test(path)) return null;
  const base = 'https://site.invalid';
  let u;
  try {
    u = new URL(path, base);
  } catch {
    return null;
  }
  return u.origin === base ? `${u.pathname}${u.search}` : null;
}

/** The context back from the query of the contact page (contactLink); null when there is none or it is odd. */
export function contextFromQuery(params) {
  const path = sitePath(params.get('stranka'));
  if (!path) return null;
  const title = params.get('nazev') ?? '';
  const id = params.get('obraz');
  return id ? { kind: 'work', path, title, id, onSale: false } : pageContext(path, title);
}

/**
 * A mailto: link with the same subject as a sent message ("[pavla-web] Dotaz na obraz: Ovce (v39nd)"), so the mail
 * filter treats both alike: the address on the contact page and "Napsat autorce" of a work when there is no form.
 */
export function mailtoLink(email, typeId, context) {
  return `mailto:${email}?subject=${encodeURIComponent(messageSubject(typeId, context))}`;
}
