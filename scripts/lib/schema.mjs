// Every attribute of the content YAML files (a work, a collection's _index.yaml, a photo in fotky/), with its default
// value and its technical comment. The single source of truth: skeletons of new files are built from it and the
// pipeline brings every existing file in line with it (scripts/lib/metadata-yaml.mjs).
// A new attribute = a new entry here; its prefix decides where it is used (attributeGroup below).
//
// Groups of attributes by prefix, in this order in every file (alphabetically within a group, `id` first):
//   meta_<name>      content repository only: controls the processing (meta_draft, meta_instagram), never copied
//   <name>           shared: valid in both repositories, copied 1:1 to the public copy (content/ of the site repo)
//   private_<name>   content repository only, never copied; any private_ attribute may be added freely
//   derived_<name>   site repository only: made by the pipeline (from other attributes or the place of a file);
//                    one in the content repository is an error
//
// Comments are Czech: Pavla reads and edits these files. A technical comment describes the attribute in general
// (type, allowed values, examples); it stands right above the attribute and is the same in every file.
// When its wording changes, keep the old wording in `previous`, so the pipeline recognises and replaces it.
//
// Field: { key, doc (technical comment, one or more lines), value (default in a new skeleton),
//          missing (value added to an existing file that lacks the attribute: it must mean the same as the
//          attribute being absent, so adding it changes nothing on the site; defaults to `value`),
//          generated (set by the pipeline, never marked DOPLNIT), optional (only kept when present, never added),
//          block (a new value is written as a block text |), previous (older wordings of doc) }

export const META_PREFIX = 'meta_';
export const PRIVATE_PREFIX = 'private_';
export const DERIVED_PREFIX = 'derived_';

/** Group of an attribute by its prefix: 'meta' | 'shared' | 'private' | 'derived'. */
export function attributeGroup(key) {
  if (key.startsWith(META_PREFIX)) return 'meta';
  if (key.startsWith(PRIVATE_PREFIX)) return 'private';
  if (key.startsWith(DERIVED_PREFIX)) return 'derived';
  return 'shared';
}

const GROUP_ORDER = { meta: 0, shared: 1, private: 2, derived: 2 };

/** Order of attributes in a file: meta_, shared (`id` first), private_ / derived_; alphabetically within a group. */
export function compareKeys(a, b) {
  const group = GROUP_ORDER[attributeGroup(a)] - GROUP_ORDER[attributeGroup(b)];
  if (group) return group;
  if (a === 'id' || b === 'id') return a === b ? 0 : a === 'id' ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The fields of a schema in file order (compareKeys). */
function ordered(fields) {
  return [...fields].sort((x, y) => compareKeys(x.key, y.key));
}

/** Prefix of a technical comment whose value still needs checking; the pipeline adds it, people remove it. */
export const TODO = 'DOPLNIT';

/**
 * Sample texts of new skeletons, in a block ("description: |"), so the text is written in the right place with the
 * indentation already there. A collection, a year and "Mimo kolekce" are public at once, so a real sentence (no
 * DOPLNIT, which would stop the run): the author rewrites it whenever she likes.
 */
// "nejvíc nejoblíbenější" on purpose (a nod to Forrest Gump), do not correct it
export const COLLECTION_SKELETON_TEXT = 'Toto je moje nejvíc nejoblíbenější kolekce.\n';
export const yearSkeletonText = (year) => `Můj oblíbený rok, rok ${year}.\n`;
export const UNCOLLECTED_SKELETON_TEXT = 'Tato díla se nevešla do žádné složky a toulají se volně po ateliéru.\n';
/** Technical comment of an attribute the pipeline does not know (a typo?); it is kept, at the end of the file. */
export const UNKNOWN_DOC = 'NEZNÁMÝ atribut: pipeline ho nezná (překlep?) a nepoužije ho. Oprav jeho název, nebo řádek smaž.';

/** Current wording of the technical comment of `cover`, for the own cover photo `photo`. */
const coverDoc = (scope, photo) => [
  `Vybraný úvodní obraz: id díla ${scope} (např. k3f9a), nebo jeho detailní fotka (k3f9a#1-kvet), bez mezer;`,
  `vede na to dílo. Nebo místo toho vlastní fotka ${photo} (bez odkazu). Ukáže se celý, s aspect nebo focus oříznutý.`,
  'Prázdné = náhodně jeden z 10 nejnovějších obrazů ve výběru autorky (featured), celý, bez ořezu.',
];

/** Older wordings of the technical comment of `cover`, for the own cover photo `photo`. */
const coverOlderDocs = (scope, photo) => [
  [
    `Vybraný úvodní obraz: id díla ${scope} (např. k3f9a), nebo jeho detailní fotka (k3f9a#1-kvet), bez mezer;`,
    `vede na to dílo. Nebo místo toho vlastní fotka ${photo} (bez odkazu). Ukáže se celý, s aspect a focus oříznutý.`,
    'Prázdné = náhodně jeden z 10 nejnovějších obrazů ve výběru autorky (featured), celý, bez ořezu.',
  ],
  [
    `Vybraný úvodní obraz: id díla ${scope} (např. k3f9a), nebo jeho detailní fotka (k3f9a#1-kvet), bez mezer;`,
    `vede na to dílo. Nebo místo toho vlastní fotka ${photo} (bez odkazu). Ukáže se celý, s focus oříznutý na 3:2.`,
    'Prázdné = náhodně jeden z 10 nejnovějších obrazů ve výběru autorky (featured), celý, bez ořezu.',
  ],
  ...[photo, photo.replace(/ vedle tohoto souboru$/, ' (vedle tohoto souboru)')].map((p) => [
    `Vybraný úvodní obraz: id díla ${scope} (např. k3f9a), nebo jeho detailní fotka (k3f9a#1-kvet), bez mezer;`,
    `vede na to dílo. Nebo místo toho vlastní fotka ${p} (bez odkazu). Obojí se ořízne na 3:2 kolem focus.`,
    'Prázdné = náhodně jeden z 10 nejnovějších obrazů ve výběru autorky (featured), celý, bez ořezu.',
  ]),
];

/**
 * `cover` of a place (collection, year, home page), see scripts/lib/covers.mjs. `scope`: which works it may name,
 * `photo`: the file of its own cover photo, `formerPhotos`: its former names (every wording with them is recognised
 * and replaced); `previous`: older wordings of the comment.
 */
const coverField = (scope, photo, previous, formerPhotos = []) => ({
  key: 'cover',
  commented: true,
  example: 'k3f9a',
  doc: coverDoc(scope, photo),
  value: '',
  previous: [
    ...coverOlderDocs(scope, photo),
    ...formerPhotos.flatMap((p) => [coverDoc(scope, p), ...coverOlderDocs(scope, p)]),
    ...(previous ? [previous] : []),
  ],
});

/**
 * `aspect` of a chosen cover (own photo or `cover`): crops it to this aspect ratio; `focus` alone means 1:1.
 * Commented out unless used (`commented`, see scripts/lib/metadata-yaml.mjs).
 */
const aspectField = {
  key: 'aspect',
  commented: true,
  example: '"3:2"',
  doc: [
    'Ořez vybraného obrazu (cover nebo vlastní fotky) na poměr stran šířka:výška v uvozovkách, např. "3:2", "2:1",',
    '"1:1". Jen s focus = "1:1". Bez aspect i focus = celý.',
  ],
  value: null,
  previous: [
    [
      'Nepovinné, zapneš smazáním "# " na začátku řádku. Ořez vybraného obrazu (cover nebo vlastní fotky) na poměr',
      'stran šířka:výška v uvozovkách, např. "3:2", "2:1", "1:1". Jen s focus = "1:1". Bez aspect i focus = celý.',
    ],
    [
      'Ořez vybraného obrazu (cover nebo vlastní fotky) na poměr stran šířka:výška, např. "3:2", "2:1", "1:1"',
      '(v uvozovkách). Prázdné i s focus = "1:1". Prázdné aspect i focus = obraz celý, bez ořezu.',
    ],
    [
      'Jen s cover a focus: vybraný obraz se ořízne na tento poměr stran šířka:výška, např. "3:2", "2:1", "1:1"',
      '(v uvozovkách). Prázdné = obraz celý, bez ořezu. Bez cover (i s vlastní fotkou) nechat prázdné.',
    ],
  ],
};

/**
 * `focus` of a chosen cover: what stays visible when cropped; `aspect` alone means [50, 50]. Commented out unless
 * used (`commented`); `previous`: older wordings.
 */
const focusField = (previous) => ({
  key: 'focus',
  commented: true,
  example: '[50, 50]',
  doc: [
    'Při ořezu vybraného obrazu zůstane vidět [zleva %, shora %], např. [50, 50] = střed, [80, 30] = vpravo nahoře.',
    'Jen s aspect = střed. Náhodný obraz se neořezává.',
  ],
  value: null,
  previous: [
    [
      'Nepovinné, zapneš smazáním "# " na začátku řádku. Při ořezu vybraného obrazu zůstane vidět [zleva %, shora %],',
      'např. [50, 50] = střed, [80, 30] = vpravo nahoře. Jen s aspect = střed. Náhodný obraz se neořezává.',
    ],
    [
      'Při ořezu vybraného obrazu zůstane vidět [zleva %, shora %], např. [50, 50] = střed, [80, 30] = vpravo nahoře.',
      'Prázdné i s aspect = [50, 50]. Prázdné aspect i focus = obraz celý, bez ořezu. Náhodný obraz se neořezává.',
    ],
    [
      'Jen s cover a aspect: při ořezu zůstane vidět [zleva %, shora %], např. [50, 50] = střed, [80, 30] = vpravo',
      'nahoře. Prázdné = obraz celý, bez ořezu. Bez cover (i s vlastní fotkou) nechat prázdné.',
    ],
    [
      'Jen s cover: vybraný obraz se ořízne na 3:2 a [zleva %, shora %] = co zůstane vidět, např. [50, 50] = střed,',
      '[80, 30] = vpravo nahoře. Prázdné = obraz celý, bez ořezu. Bez cover (i s vlastní fotkou) nechat prázdné.',
    ],
    [
      'Jen pro vybraný úvodní obraz (cover nebo vlastní fotka): ořízne se na 3:2 a [zleva %, shora %] = co zůstane',
      'vidět, např. [50, 50] = střed, [80, 30] = vpravo nahoře. U náhodného obrazu se nepoužije.',
    ],
    ...(previous ? [previous] : []),
  ],
});

/** Longest description of a page for search engines (longer ones are cut in the results). */
export const PAGE_DESCRIPTION_CHARS = 160;

/**
 * How a text is written and formatted (scripts/lib/rich-text.mjs: paragraphs and formatting; the pipeline writes every
 * text as a block "|", scripts/lib/metadata-yaml.mjs blockText). Lines of the technical comment of `text`.
 */
const writingRules = (empty) => [
  '  - řádky zalamuj, kde chceš: na webu se spojí mezerou (příliš dlouhé zalomí automatika),',
  '  - prázdný řádek = nový odstavec,',
  `  - prázdné "" = ${empty}.`,
];
/**
 * The formatting (scripts/lib/rich-text.mjs) in the technical comment of every formatted attribute (`rich`, `richMap`):
 * always the whole list, so nobody has to look it up elsewhere (a test checks every such attribute has it).
 */
export const FORMATTING_DOC = [
  'Formátování:',
  '  - **slovo** = tučně,',
  '  - *slovo* = kurzívou,',
  '  - [text](/tvorba/) = odkaz na stránku tohoto webu (adresa začíná /),',
  '  - [text](https://…) = odkaz na jiný web, [text](mailto:…) = odkaz na e-mail.',
];
const textRules = (empty) => [...writingRules(empty), ...FORMATTING_DOC];

/**
 * The text shown on the page (`where`: what and where, Czech), formatted: a block "|" with the rules above; `empty`:
 * what an empty text means. `rich`: its links are checked (scripts/lib/rich-text.mjs linkProblems). Other
 * properties (value, missing, settled, commented, previous…) as given.
 */
const textField = (where, { empty = 'bez textu', ...more } = {}) => ({
  key: 'text',
  block: true,
  rich: true,
  doc: [`${where}.`, 'Piš ho pod „text: |“, každý řádek odsazený dvěma mezerami:', ...textRules(empty)],
  value: '',
  ...more,
});

/** The optional muted closing paragraph under the text, formatted like `text`. */
const closingField = (previous = []) => ({
  key: 'closing',
  commented: true,
  settled: true,
  block: true,
  rich: true,
  example: 'Kdyby vás některý obraz oslovil, napište mi.',
  doc: [
    'Závěrečný odstavec pod textem, menším tlumeným písmem (např. pozvání, ať mi lidé napíšou).',
    'Piš ho pod „closing: |“, každý řádek odsazený dvěma mezerami:',
    ...writingRules('bez závěrečného odstavce'),
    ...FORMATTING_DOC,
  ],
  value: '',
  previous: [...previous, [
    'Závěrečný odstavec pod textem, menším tlumeným písmem (např. pozvání, ať mi lidé napíšou).',
    'Piš ho pod „closing: |“ stejně jako text, i s formátováním.',
  ]],
});

/**
 * The description for search engines (and link previews), optional: without it they get the beginning of the text.
 * Plain text, never shown on the page. `previous`: former wordings of `description` (also of the time it was the text
 * shown on the page, before 2026-10), so an old comment is recognized and replaced.
 */
const searchDescriptionField = (previous = []) => ({
  key: 'description',
  commented: true,
  settled: true,
  block: true,
  example: 'Jedna nebo dvě věty pro Google, nejvýš 160 znaků.',
  doc: [
    'Popis pro vyhledávače a náhled odkazu (Google, Facebook, WhatsApp): jedna nebo dvě věty, nejvýš',
    `${PAGE_DESCRIPTION_CHARS} znaků, bez formátování; na stránce se neukáže. Prázdné = začátek textu.`,
  ],
  value: '',
  previous,
});

/** Wordings of `description` of a work while it was the text on its page (before 2026-10, now `text`). */
const WORK_DESCRIPTION_BEFORE = [
  [
    'Pár vět o obraze, zobrazí se na jeho stránce. Text piš pod „description: |“, každý řádek odsazený dvěma',
    'mezerami; dlouhý řádek automatika zalomí.',
  ],
  'Pár vět o obraze, zobrazí se na jeho stránce. Víc řádků pod sebou, odsazených dvěma mezerami.',
  'Pár vět o obraze, zobrazí se na jeho stránce. Stačí v uvozovkách na jeden řádek, dlouhý text automatika zalomí.',
];

export const WORK_SCHEMA = {
  name: 'work',
  header: [
    'Popis obrazu - kostru vytvořila pipeline podle fotky.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž. Dokud je meta_draft: true, obraz se na webu nezobrazí.`,
  ],
  // former names of attributes: a file still using one is an error (rename it), never migrated silently
  // (`instagram` was the former name of meta_instagram; it is a link to the post now, and a leftover `instagram: true`
  // is reported by the check of that link)
  renamed: { draft: 'meta_draft' },
  fields: ordered([
    {
      key: 'id',
      generated: true,
      doc: [
        'Trvalý kód obrazu: podle něj web pozná obraz i po přejmenování (krátká adresa /tvorba/<id>/).',
        'Generuje ho pipeline, NIKDY neměnit. Hodí se napsat tužkou na zadní stranu obrazu.',
      ],
      value: null,
    },
    {
      key: 'meta_draft',
      settled: true,
      options: [true, false],
      doc: [
        'Rozpracovaný obraz, možnosti:',
        '- true - rozpracovaný, na webu se nezobrazí',
        '- false - zveřejnit',
      ],
      value: true,
      missing: false,
      previous: [[
        'Rozpracovaný obraz, možnosti:',
        '- true – rozpracovaný, na webu se nezobrazí',
        '- false – zveřejnit',
      ], 'true = rozpracovaný, na webu se nezobrazí; false = zveřejnit.'],
    },
    {
      key: 'meta_corners',
      generated: true,
      optional: true,
      doc: [
        'Rohy obrazu na fotce: všechno vně čtyřúhelníku (pozadí: podlaha, zeď, podkladový papír) bude na webu průhledné.',
        'Najde je pipeline, smíš je upravit. photo = [šířka, výška] fotky; tl/tr/br/bl = levý horní, pravý horní, pravý',
        'dolní, levý dolní roh jako [px vodorovně, px svisle] od toho rohu fotky směrem dovnitř, např. tl: [40, 25].',
        'false = nic neořezávat. Po výměně fotky za jinou velikost atribut smaž, pipeline rohy najde znovu.',
      ],
      value: null,
      previous: [[
        'Rohy listu na fotce: všechno vně čtyřúhelníku (podlaha) bude na webu průhledné. Najde je pipeline, smíš je',
        'upravit. photo = [šířka, výška] fotky; tl/tr/br/bl = levý horní, pravý horní, pravý dolní, levý dolní roh jako',
        '[px vodorovně, px svisle] od toho rohu fotky směrem dovnitř, např. tl: [40, 25]. false = nic neořezávat.',
        'Po výměně fotky za jinou velikost atribut smaž, pipeline rohy najde znovu.',
      ]],
    },
    { key: 'title', doc: 'Název obrazu, jak ho uvidí návštěvníci webu.', value: '' },
    {
      key: 'date',
      doc: 'Den vzniku ve tvaru 2026-06-14. Rok z něj určuje rok obrazu na webu (stránka roku, adresa).',
      value: '',
    },
    {
      key: 'technique',
      doc: [
        'Technika, podle ní se filtruje v galerii. Nejčastější možnosti jsou:',
        '- akvarel',
        '- brush pen',
        '- tisk z výšky',
        '- kresba tužkou',
      ],
      // no default: DOPLNIT keeps a work from being published until people choose its technique
      value: TODO,
      missing: '',
      previous: ['Technika, např. akvarel, kresba tužkou, linoryt, kombinovaná technika. Podle ní se filtruje v galerii.'],
    },
    {
      key: 'support',
      commented: true,
      example: 'papír Canson XL Aquarelle (300 g), 100% celulóza',
      doc: [
        'Podklad, např. papír. Bez něj se na webu nezobrazí. Nejčastější možnosti jsou:',
        '- papír Baohong Cold Pressed (300 g), 100% bavlna',
        '- ruční papír Khadi (320 g), 100% bavlna',
        '- papír Canson Montval Cold Pressed (300 g), 100% celulóza',
        '- papír Canson XL Aquarelle (300 g), 100% celulóza',
        '- akvarelový karton Chamoix (220 g)',
      ],
      value: '',
      previous: [
        [
          'Podklad, např. papír. Bez něj se na webu nezobrazí. Nejčastější možnosti jsou:',
          '- papír Baohong Cold Pressed (300 g), 100% bavlna',
          '- ruční papír Khadi (320 g), 100% bavlna',
          '- papír Canson Montval Cold Pressed (300 g), 100% celulóza',
          '- papír Canson XL Aquarelle (300 g), 100% celulóza',
        ],
        'Podklad, např. papír Arches 300 g. Bez něj se na webu nezobrazí.',
        'Podklad, např. papír Arches 300 g. Nepovinné, prázdné = na webu se nezobrazí.',
      ],
    },
    {
      key: 'size_cm',
      doc: [
        'Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu.',
        'Podle rozměrů se dělají mockupy ve skutečné velikosti. Nejčastější možnosti jsou:',
        '- [38, 29] - Baohong',
        '- [20, 20] - Khadi malý',
        '- [30, 30] - Khadi velký',
        '- [42, 30] - Canson Montval A3',
        '- [21, 30] - Canson Montval A4',
        '- [41, 30] - Canson XL A3',
        '- [43, 31] - Chamoix A3',
      ],
      value: [0, 0],
      missing: null,
      previous: [[
        'Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu.',
        'Podle rozměrů se dělají mockupy ve skutečné velikosti. Nejčastější možnosti jsou:',
        '- [38, 29] - Baohong',
        '- [20, 20] - Khadi malý',
        '- [30, 30] - Khadi velký',
        '- [42, 30] - Canson Montval A3',
        '- [21, 30] - Canson Montval A4',
        '- [41, 30] - Canson XL',
      ], [
        'Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu.',
        'Podle rozměrů se dělají mockupy ve skutečné velikosti. Nejčastější možnosti jsou:',
        '- [38, 29] – Baohong',
        '- [20, 20] – Khadi malý',
        '- [30, 30] – Khadi velký',
        '- [42, 30] – Canson Montval A3',
        '- [21, 30] – Canson Montval A4',
      ], [
        'Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu:',
        'podle rozměrů se dělají mockupy ve skutečné velikosti.',
      ]],
    },
    { key: 'tags', settled: true, doc: 'Štítky pro filtr v galerii, např. [krajina, voda, plenér]. Prázdné = [].', value: [] },
    {
      key: 'status',
      options: ['available', 'reserved', 'sold', 'gifted', 'not-for-sale'],
      doc: [
        'Stav obrazu, možnosti:',
        '- available - k prodeji (s cenou price)',
        '- reserved - rezervováno (s cenou price)',
        '- sold - prodáno, na webu „V soukromé sbírce“',
        '- gifted - darováno, na webu „V soukromé sbírce“ (stejně jako prodané)',
        '- not-for-sale - není na prodej, na webu bez štítku',
      ],
      value: 'not-for-sale',
      previous: [[
        'Stav prodeje, možnosti:',
        '- available - k prodeji (s cenou price)',
        '- reserved - rezervováno (s cenou price)',
        '- sold - prodáno',
        '- not-for-sale - není na prodej, na webu bez štítku',
      ], [
        'Stav prodeje, možnosti:',
        '- available – k prodeji (s cenou price)',
        '- reserved – rezervováno (s cenou price)',
        '- sold – prodáno',
        '- not-for-sale – není na prodej, na webu bez štítku',
      ], [
        'Stav prodeje: available (k prodeji) | reserved (rezervováno) | sold (prodáno)',
        '| not-for-sale (není na prodej, na webu bez štítku).',
      ]],
    },
    {
      key: 'price',
      commented: true,
      example: '2500',
      doc: 'Cena v Kč, např. 2500. Povinná u available a reserved.',
      value: null,
      previous: ['Cena v Kč, např. 2500. Povinná u available a reserved, jinak nech prázdné.'],
    },
    {
      key: 'fler',
      commented: true,
      example: 'https://www.fler.cz/zbozi/…',
      doc: 'Odkaz na obraz na Fleru (https://www.fler.cz/…). U obrazu na prodej s ním web ukáže tlačítko „Koupit na Fleru“.',
      value: '',
    },
    {
      key: 'instagram',
      commented: true,
      example: 'https://www.instagram.com/p/…',
      doc: 'Odkaz na příspěvek s obrazem na Instagramu (https://www.instagram.com/p/…), až ho zveřejníš. Web ho ukáže u obrazu.',
      value: '',
    },
    {
      key: 'meta_edge',
      settled: true,
      options: ['deckle', 'cut', 'canvas'],
      doc: [
        'Hrana obrazu ve scénách ateliéru pro Instagram, možnosti:',
        '- deckle - papír s roztřepenou hranou (akvarel na ručním nebo trhaném papíru)',
        '- cut - papír s čistou rovnou hranou (ořezaný list, karton)',
        '- canvas - plátno na rámu: čistá zaoblená hrana, tlusté asi 2 cm, rovné',
      ],
      value: 'deckle',
    },
    {
      key: 'meta_instagram',
      settled: true,
      options: [true, false],
      doc: [
        'Fotky pro Instagram, možnosti:',
        '- true - připravit (export/instagram: s popiskem na 3 pozadích, ve 3 scénách ateliéru, panorama pro karusel, příběh, detailní fotky)',
        '- false - žádné',
      ],
      previous: [[
        'Fotky pro Instagram, možnosti:',
        '- true - připravit (export/instagram: s popiskem na 3 pozadích, ve 3 scénách ateliéru, detailní fotky)',
        '- false - žádné',
      ], [
        'Fotky pro Instagram, možnosti:',
        '- true - připravit (export/instagram: originál a detailní fotky)',
        '- false - žádné',
      ], [
        'Fotky pro Instagram, možnosti:',
        '- true – připravit (export/instagram: originál a detailní fotky)',
        '- false – žádné',
      ], 'true = připravit fotky pro Instagram (export/instagram: originál a detailní fotky); false = žádné.'],
      value: false,
    },
    {
      key: 'meta_instagram_grid',
      commented: true,
      example: '3x3',
      doc: [
        'Mřížka na profilu Instagramu (obraz rozřezaný na dlaždice), sloupce x řádky, např. 3x3, 2x1, 3x1, 1x2, 3x4',
        '(od 1x1 do 5x5; jen spolu s meta_instagram: true a jen pro aplikaci v telefonu, web na počítači má 4 sloupce).',
      ],
      previous: [[
        'Mřížka na profilu Instagramu (obraz rozřezaný na dlaždice, jen spolu s meta_instagram: true), možnosti:',
        '- 2 - 2 × 1 dlaždice (dvojice vedle sebe, obraz na šířku)',
        '- 3 - 3 × 1 dlaždice (hodně široký obraz)',
        '- 6 - 3 × 2 dlaždice (obraz na šířku)',
        '- 9 - 3 × 3 dlaždice (obraz na výšku)',
        '- 12 - 3 × 4 dlaždice (hodně vysoký obraz)',
      ], [
        'Mřížka na profilu Instagramu (obraz rozřezaný na dlaždice, jen spolu s meta_instagram: true), možnosti:',
        '- 3 - 3 × 1 dlaždice (hodně široký obraz)',
        '- 6 - 3 × 2 dlaždice (obraz na šířku)',
        '- 9 - 3 × 3 dlaždice (obraz na výšku)',
        '- 12 - 3 × 4 dlaždice (hodně vysoký obraz)',
      ]],
      value: null,
    },
    {
      key: 'meta_pinterest',
      settled: true,
      options: [true, false],
      doc: [
        'Pin na Pinterest, možnosti:',
        '- true - připravit (obrázek pinu na webu, Pinterest si ho sám vezme z kanálu /pinterest.xml)',
        '- false - žádný',
      ],
      value: false,
    },
    {
      key: 'meta_pinterest_version',
      commented: true,
      example: 2,
      doc: [
        'Verze pinu na Pinterestu (celé číslo od 1, bez něj 1). Pinterest pozná pin podle adresy obrázku, ta zůstává stejná.',
        'Když chceš obraz připnout znovu (nová fotka, opravený název), zvyš číslo o 1; starý pin pak na Pinterestu smaž.',
      ],
      value: null,
    },
    {
      key: 'mockups',
      settled: true,
      options: [true, false],
      doc: [
        'Mockupy (obraz v rámu v interiéru), možnosti:',
        '- true - na webu, u obrazu na prodej i pro Fler',
        '- false - žádné',
      ],
      previous: [[
        'Mockupy (obraz v rámu v interiéru), možnosti:',
        '- true – na webu, u obrazu na prodej i pro Fler',
        '- false – žádné',
      ], 'true = mockupy (obraz v rámu v interiéru) na webu, u obrazu na prodej i pro Fler; false = žádné.'],
      value: false,
    },
    {
      key: 'featured',
      settled: true,
      options: [true, false],
      doc: [
        'Výběr autorky, možnosti:',
        '- true - ve výběru: přepínač „Doporučené“ v galerii; z 10 nejnovějších vybraných se náhodně střídají',
        '  obrazy nahoře na úvodní stránce, stránce roku a na úvodu kolekce (bez cover)',
        '- false - ne',
      ],
      value: false,
      previous: [[
        'Výběr autorky, možnosti:',
        '- true - ve výběru: filtr „Výběr autorky“ v galerii; z 10 nejnovějších vybraných se náhodně střídají',
        '  obrazy nahoře na úvodní stránce, stránce roku a na úvodu kolekce (bez cover)',
        '- false - ne',
      ], [
        'Výběr autorky, možnosti:',
        '- true – ve výběru: filtr „Výběr autorky“ v galerii; z 10 nejnovějších vybraných se náhodně střídají',
        '  obrazy nahoře na úvodní stránce, stránce roku a na úvodu kolekce (bez cover)',
        '- false – ne',
      ], [
        'true = ve výběru autorky: filtr „Výběr autorky“ v galerii; z 10 nejnovějších vybraných se náhodně',
        'střídají obrazy nahoře na úvodní stránce, stránce roku a na úvodu kolekce (bez cover). false = ne.',
      ], [
        'true = ve výběru autorky: filtr „Výběr autorky“ v galerii; z 5 nejnovějších vybraných se náhodně',
        'střídají obrazy nahoře na úvodní stránce a na úvodu kolekce (bez cover). false = ne.',
      ], [
        'true = obraz může být na úvodní stránce webu (velký obraz nahoře, vybere se nejnovější z označených)',
        'a náhled pro sdílení stránky jeho roku; false = ne. Bez označeného obrazu se použije nejnovější.',
      ]],
    },
    searchDescriptionField(WORK_DESCRIPTION_BEFORE),
    // a block ready for the text, so nobody has to add "|" and the indentation by hand
    textField('Pár vět o obraze, zobrazí se na jeho stránce', { value: `${TODO} popisek\n`, missing: null, previous: WORK_DESCRIPTION_BEFORE }),
    {
      key: 'details',
      commented: true,
      richMap: true,
      example: '{ 1-mlha: Ranní mlha nad vodou }',
      doc: [
        'Popisky detailních fotek ze složky se jménem obrazu (vedle tohoto souboru): { název fotky: popisek, … }.',
        ...FORMATTING_DOC,
      ],
      value: null,
      previous: ['Popisky detailních fotek ze složky se jménem obrazu (vedle tohoto souboru): { název fotky: popisek, … }.', [
        'Popisky detailních fotek ze složky se jménem obrazu (vedle tohoto souboru): { název fotky: popisek, … }.',
        'Formátování jako u text: **tučně**, *kurzívou*, [odkaz](/tvorba/).',
      ], [
        'Popisky detailních fotek ze složky se jménem obrazu (vedle tohoto souboru), nepovinné. Např.:',
        'details:',
        '  1-mlha: Mlha nad hladinou',
      ]],
    },
    {
      key: 'private_note',
      commented: true,
      example: 'kde obraz visí, komu patří',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ]),
};

/** Wordings of `description` of a collection while it was the text on its page (before 2026-10, now `text`). */
const COLLECTION_DESCRIPTION_BEFORE = [
  [
    'Pár vět o kolekci: kde a kdy obrazy vznikly. Text piš pod „description: |“, každý řádek odsazený dvěma',
    'mezerami; dlouhý řádek automatika zalomí.',
  ],
  'Pár vět o kolekci: kde a kdy obrazy vznikly. Víc řádků pod sebou, odsazených dvěma mezerami.',
  'Pár vět o kolekci: kde a kdy obrazy vznikly. Stačí v uvozovkách na jeden řádek, dlouhý text automatika zalomí.',
];

export const COLLECTION_SCHEMA = {
  name: 'collection',
  header: [
    'Kolekce - kostru vytvořila pipeline pro tuto složku.',
    'Obrazy kolekce jsou soubory v této složce. Adresa kolekce na webu je název složky (bez diakritiky).',
    'Úvodní fotka kolekce (nepovinná): _cover.jpg vedle tohoto souboru.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž.`,
  ],
  fields: ordered([
    { key: 'title', doc: 'Název kolekce na webu, např. Plenér Šumava 2026.', value: '' },
    searchDescriptionField(COLLECTION_DESCRIPTION_BEFORE),
    // a sample text in a block (a collection is public at once, so no DOPLNIT): rewrite it, keep the indentation
    textField('Pár vět o kolekci (kde a kdy obrazy vznikly), na stránce kolekce a v přehledu kolekcí', {
      value: COLLECTION_SKELETON_TEXT, missing: null, previous: COLLECTION_DESCRIPTION_BEFORE,
    }),
    coverField('z kolekce', '_cover.jpg', [
      'Úvodní obraz: id díla z kolekce (např. k3f9a) nebo jeho detailní fotka (k3f9a#1-kvet), bez mezer.',
      'Nepovinné: bez něj vlastní fotka _uvod.jpg, jinak nejnovější dílo. Dílo s draft: true nejde.',
    ], ['_uvod.jpg']),
    aspectField,
    focusField([
      'Úvodní obraz se ořízne na 3:2; [zleva %, shora %] = co zůstane vidět,',
      'např. [50, 50] = střed, [80, 30] = vpravo nahoře.',
    ]),
    {
      key: 'private_note',
      commented: true,
      example: 'kde obraz visí, komu patří',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ]),
};

export const PHOTO_SCHEMA = {
  name: 'photo',
  header: [
    'Popis fotky - kostru vytvořila pipeline.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž.`,
  ],
  fields: ordered([
    {
      key: 'alt',
      doc: 'Co je na fotce (pro nevidomé a vyhledávače), např. „Pavla maluje v ateliéru“.',
      value: '',
    },
    { key: 'caption', commented: true, example: 'Na plenéru na Šumavě', doc: 'Popisek pod fotkou.', value: '', previous: ['Popisek pod fotkou, nepovinné.'] },
    {
      key: 'focus',
      doc: [
        'Kam se fotka vycentruje, když ji stránka ořízne: [zleva %, shora %],',
        'např. [50, 50] = střed, [80, 70] = vpravo dole.',
      ],
      value: [50, 50],
    },
  ]),
};

/** Wordings of `description` of a year while it was the text on its page (before 2026-10, now `text`). */
const YEAR_DESCRIPTION_BEFORE = [[
  'Pár vět o roce za sebe (jaký byl, co se v tvorbě dělo); zobrazí se nahoře na stránce roku /tvorba/<rok>/.',
  'Text piš pod „description: |“, každý řádek odsazený dvěma mezerami. Prázdné "" = bez textu.',
], [
  'Pár vět o roce za sebe (jaký byl, co se v tvorbě dělo); zobrazí se nahoře na stránce roku /tvorba/<rok>/.',
  'Stačí v uvozovkách na jeden řádek, dlouhý text automatika zalomí. Prázdné "" = bez textu.',
], [
  'Pár vět o roce za sebe (jaký byl, co se v tvorbě dělo); zobrazí se nahoře na stránce roku /tvorba/<rok>/.',
  'Víc řádků: napiš description: | a pod to text odsazený dvěma mezerami. Prázdné "" = bez textu.',
]];

export const YEAR_SCHEMA = {
  name: 'year',
  header: [
    'Rok - kostru vytvořila pipeline pro rok, ve kterém jsou obrazy (název souboru je rok).',
    'Text i úvodní obraz jsou nepovinné. Po vyplnění slovo DOPLNIT smaž.',
  ],
  fields: ordered([
    searchDescriptionField(YEAR_DESCRIPTION_BEFORE),
    // the skeleton gets yearSkeletonText(<year>) (scripts/lib/years.mjs); a file without it stays without text
    textField('Pár vět o roce za sebe (jaký byl, co se v tvorbě dělo), nahoře na stránce roku /tvorba/<rok>/', {
      previous: YEAR_DESCRIPTION_BEFORE,
    }),
    coverField('z toho roku', '<rok>.jpg vedle tohoto souboru'),
    aspectField,
    focusField(),
    {
      key: 'private_note',
      commented: true,
      example: 'kde obraz visí, komu patří',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ]),
};

/** Default text of "Mimo kolekce" on the collections overview, while tvorba/_index.yaml has no text. */
export const UNCOLLECTED_TEXT = 'Obrazy, které nepatří do žádné kolekce.';

export const UNCOLLECTED_SCHEMA = {
  name: 'uncollected',
  header: [
    'Obrazy mimo kolekce (obrazy přímo ve složce tvorba/) - kostru vytvořila pipeline.',
    'Na přehledu kolekcí jsou poslední položkou „Mimo kolekce“. Úvodní obraz je nepovinný.',
  ],
  fields: ordered([
    coverField('mimo kolekce', '_cover.jpg vedle tohoto souboru'),
    // the skeleton gets UNCOLLECTED_SKELETON_TEXT (scripts/lib/uncollected.mjs); no description: no page of its own
    textField('Pár vět pod „Mimo kolekce“ na přehledu kolekcí', {
      empty: `„${UNCOLLECTED_TEXT}“`,
      commented: true,
      example: 'Obrazy, které nepatří do žádné kolekce: samostatné listy, dárky a skici.',
      previous: [[
        'Pár vět pod „Mimo kolekce“ na přehledu kolekcí. Text piš pod „description: |“, každý řádek odsazený',
        `dvěma mezerami. Prázdné = „${UNCOLLECTED_TEXT}“`,
      ], [
        'Pár vět pod „Mimo kolekce“ na přehledu kolekcí. Stačí v uvozovkách na jeden řádek, dlouhý text automatika',
        `zalomí. Prázdné = „${UNCOLLECTED_TEXT}“`,
      ], [
        'Pár vět pod „Mimo kolekce“ na přehledu kolekcí. Víc řádků: napiš description: | a pod to text odsazený',
        `dvěma mezerami. Prázdné = „${UNCOLLECTED_TEXT}“`,
      ]],
    }),
    aspectField,
    focusField(),
    {
      key: 'private_note',
      commented: true,
      example: 'kde obraz visí, komu patří',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ]),
};

/**
 * Default text of the home page: the value of a new skeleton of _index.yaml, and what the site shows before the
 * first public copy exists. The same as the text of the home page in the content repository (texts to approve: T4).
 */
export const HOME_TEXT = 'Maluji pro radost, hlavně akvarelem – na plenérech, na procházkách i doma u stolu. Tady najdete,\n'
  + 'co mi právě uschlo na papíře, rychlé skici tužkou a brush penem i obrazy, které už visí jinde.\n';

/** Default texts of the home page while the site has no work yet, and of its button. */
export const HOME_BUTTON = 'Prohlédnout tvorbu';
export const HOME_EMPTY_TEXT = 'Obrazy tu brzy přibudou.';
/** The sentence under HOME_EMPTY_TEXT, with a link to the Instagram profile `instagram` (site.instagram), '' without one. */
export const homeEmptyClosing = (instagram) => (instagram
  ? `Než je sem nahraji, co právě maluji, najdete [na Instagramu](https://www.instagram.com/${instagram}/).\n`
  : '');

/** Wordings of `description` of the home page while it was the text on the page (before 2026-10, now `text`). */
const HOME_DESCRIPTION_BEFORE = [[
  'Text na úvodní stránce vedle velkého obrazu (pod nadpisem). Víc řádků pod sebou, odsazených dvěma',
  'mezerami. Prázdné "" = bez textu.',
]];

/** Default heading of the home page: its lines are the lines of the heading. */
export const HOME_HEADING = 'Barvy, voda\na trochu náhody\n';

export const HOME_SCHEMA = {
  name: 'home',
  header: [
    'Úvodní stránka webu - kostru vytvořila pipeline.',
    'Úvodní obraz je nepovinný. Po kontrole hodnot slovo DOPLNIT smaž.',
  ],
  fields: ordered([
    searchDescriptionField(HOME_DESCRIPTION_BEFORE),
    textField('Text na úvodní stránce vedle velkého obrazu (pod nadpisem)', { value: HOME_TEXT, previous: HOME_DESCRIPTION_BEFORE }),
    {
      key: 'button',
      settled: true,
      doc: 'Text tlačítka pod textem úvodní stránky, které vede na celou tvorbu. Povinné.',
      value: HOME_BUTTON,
      missing: HOME_BUTTON,
    },
    {
      key: 'empty_text',
      settled: true,
      doc: 'Velká věta na úvodní stránce, dokud na webu není žádný obraz (místo velkého obrazu). Povinné.',
      value: HOME_EMPTY_TEXT,
      missing: HOME_EMPTY_TEXT,
    },
    {
      key: 'empty_closing',
      settled: true,
      block: true,
      rich: true,
      doc: [
        'Menší věta pod ní (dokud není žádný obraz).',
        'Piš ji pod „empty_closing: |“, každý řádek odsazený dvěma mezerami:',
        ...writingRules('nic'),
        ...FORMATTING_DOC,
      ],
      previous: [[
        'Menší věta pod ní (dokud není žádný obraz). Piš ji pod „empty_closing: |“, formátování jako u text.',
        'Prázdné "" = nic.',
      ]],
      // the skeleton and a file without it get homeEmptyClosing(<Instagram of site.config.yaml>) (scripts/lib/home.mjs)
      value: '',
      missing: '',
    },
    {
      key: 'heading',
      settled: true,
      block: true,
      doc: [
        'Velký nadpis úvodní stránky; každý řádek je řádek nadpisu (odsazený dvěma mezerami pod „heading: |“).',
        'Povinné.',
      ],
      value: HOME_HEADING,
      missing: HOME_HEADING,
    },
    coverField('z celé tvorby', '_cover.jpg vedle tohoto souboru', undefined, ['uvod.jpg vedle tohoto souboru']),
    aspectField,
    focusField(),
    {
      key: 'private_note',
      commented: true,
      example: 'kde obraz visí, komu patří',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ]),
};

/**
 * Default texts of the pages O mně and Kontakt: the values of new skeletons of stranky/<page>.yaml, and what the
 * site shows before the first public copy exists. The same as the texts the pages had in the code (approved 2026-10).
 */
export const ABOUT_DESCRIPTION = 'Maluji pro radost už dlouhé roky, doma v Roztokách i na procházkách. Nejvíc mě chytil akvarel, skicuji i tužkou a brush penem. Kdo jsem a jak maluji.';
export const ABOUT_TEXT = 'Maluji pro radost. Je to moje velká vášeň a dlouholetý koníček – chvíle, kdy se svět zpomalí\n'
  + 'a zbude jen papír, barva a voda.\n'
  + '\n'
  + 'Posledních pár let mě nejvíc chytil akvarel. Baví mě, že se nedá úplně ovládat: voda si vždycky\n'
  + 'trochu dělá, co chce, a právě to bývá na obraze nejhezčí.\n'
  + '\n'
  + 'Nejraději maluji na procházkách v přírodě, hlavně krajinu a zvířata – a ta nejlépe v pohybu.\n'
  + 'Obrazy a skicy tvořím převážně akvarelem, někdy fixem, brush penem či tužkou, podle toho, co si\n'
  + 'zrovna žádá chvíle.\n'
  + '\n'
  + 'Kdykoli mám volnou chvilku, cvičím si ruku i oko slepou kresbou: kreslím lidi a zvířata\n'
  + 'a na papír se přitom vůbec nedívám.\n';
export const ABOUT_CLOSING = 'Obrazy maluji hlavně pro sebe. Některé u mě ale jen přečkávají, než najdou svůj domov.\n'
  + 'Kdyby vás některý oslovil, napište mi.\n';
export const CONTACT_DESCRIPTION = 'Zaujal vás obraz, nebo jen chcete pozdravit? Napište mi – a když se vám některý obraz zalíbí, domluvíme se. Žiji a maluji v Roztokách.';
export const CONTACT_TEXT = 'Zaujal vás obraz nebo jen chcete pozdravit?\n';

export const CONTACT_LOCATION_LABEL = 'Žiji a maluji';
/** Default texts of the page not found (404). */
export const NOT_FOUND_TITLE = 'Obraz, který ještě nevznikl';
export const NOT_FOUND_HEADING = 'Tento obraz ještě nebyl namalován';
export const NOT_FOUND_DESCRIPTION = 'Tento obraz ještě nebyl namalován.';
export const NOT_FOUND_TEXT = 'Na téhle adrese zatím zůstal jen čistý papír. Možná se obraz přestěhoval, možná na něj teprve\n'
  + 'čeká štětec, barvy a sklenice s vodou.\n';
export const NOT_FOUND_CLOSING = 'Mezitím se podívejte na [výběr autorky](/tvorba/?featured=1),\n'
  + 'nebo [na celou tvorbu](/tvorba/).\n';

/** Former wording of the formatting of the texts of pages (in their `previous`). */
const FORMATTING = 'Odkaz [text](https://…) nebo [text](/tvorba/), tučně **slovo**, kurzíva *slovo*.';

const PRIVATE_NOTE = {
  key: 'private_note',
  commented: true,
  example: 'co jsem na stránce změnila a proč',
  doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
  value: '',
};

/**
 * Fields of a page in stranky/ (`text` = what the page shows under its heading; the skeleton gets the texts the page
 * had in the code, scripts/lib/pages.mjs). Options add the optional muted `closing` paragraph and the `title`
 * (`title`: its doc lines; the title in the browser tab, of a generic page also its heading).
 */
const pageFields = (where, { closing = false, title = null } = {}) => [
  searchDescriptionField([[
    `Popis stránky pro vyhledávače a náhled odkazu (Google, Facebook, WhatsApp), nejvýš ${PAGE_DESCRIPTION_CHARS} znaků; na stránce`,
    'samotné se neukáže, bez formátování. Povinné.',
  ], [
    `Popis stránky pro vyhledávače a náhled odkazu (Google, Facebook, WhatsApp), nejvýš ${PAGE_DESCRIPTION_CHARS} znaků; na stránce`,
    'samotné se neukáže. Povinné.',
  ]]),
  // an existing file without it stays without text
  textField(`Text stránky ${where}`, {
    settled: true,
    missing: '',
    previous: [[
      `Text stránky ${where}. Piš pod „text: |“, každý řádek odsazený dvěma mezerami; prázdný řádek`,
      'mezi řádky = nový odstavec. Prázdné "" = bez textu.',
      FORMATTING,
    ], [
      `Text stránky ${where}. Piš pod „text: |“, každý řádek odsazený dvěma mezerami; prázdný řádek`,
      'mezi řádky = nový odstavec. Prázdné "" = bez textu.',
    ]],
  }),
  ...(closing ? [closingField([
    ['Závěrečný odstavec pod textem, menším tlumeným písmem (např. pozvání, ať mi lidé napíšou).', FORMATTING],
    'Závěrečný odstavec pod textem, menším tlumeným písmem (např. pozvání, ať mi lidé napíšou).',
  ])] : []),
  ...(title ? [{ key: 'title', settled: true, doc: title, value: '' }] : []),
  PRIVATE_NOTE,
];

export const ABOUT_SCHEMA = {
  name: 'about',
  header: [
    'Stránka O mně (/o-mne/) - kostru vytvořila pipeline s textem, který stránka měla.',
    'Nadpis a fotky (fotky/o-mne-uvod.jpg, fotky/portret.jpg) jsou zvlášť.',
  ],
  fields: ordered(pageFields('O mně vedle portrétu', { closing: true })),
};

export const CONTACT_SCHEMA = {
  name: 'contact',
  header: [
    'Stránka Kontakt (/kontakt/) - kostru vytvořila pipeline s textem, který stránka měla.',
    'Formulář, kontakty (site.config.yaml webu) a fotka (fotky/kontakt.jpg) jsou zvlášť.',
  ],
  fields: ordered([
    ...pageFields('Kontakt nad formulářem'),
    {
      key: 'location_label',
      settled: true,
      doc: 'Popisek nad místem, kde žiji (místo samo je site.location v site.config.yaml webu), např. „Žiji a maluji“.',
      value: CONTACT_LOCATION_LABEL,
      missing: CONTACT_LOCATION_LABEL,
    },
  ]),
};

export const NOT_FOUND_SCHEMA = {
  name: 'not-found',
  header: [
    'Stránka, která se ukáže na neexistující adrese (chyba 404) - kostru vytvořila pipeline s textem, který stránka měla.',
    'Pod textem jsou vždy tři obrazy z výběru autorky. Vyhledávače tuto stránku neindexují.',
  ],
  fields: ordered([
    ...pageFields('pod nadpisem', { closing: true, title: 'Titulek v záložce prohlížeče, např. „Obraz, který ještě nevznikl“. Povinné.' }),
    {
      key: 'heading',
      settled: true,
      doc: 'Velký nadpis stránky, např. „Tento obraz ještě nebyl namalován“. Povinné.',
      value: '',
    },
  ]),
};

/**
 * A generic page with a text (a planned page, e.g. kurzy): /<name>/ with its title, text and muted closing. Made only
 * when stranky/<name>.yaml exists (no skeleton); its name must be in PAGES (scripts/lib/pages.mjs).
 */
export const TEXT_PAGE_SCHEMA = {
  name: 'text-page',
  header: [
    'Textová stránka webu (adresa = název souboru, např. stranky/kurzy.yaml = /kurzy/).',
    'Stránka je na webu, dokud tento soubor existuje; do menu ji přidá správce webu.',
  ],
  fields: ordered(pageFields('pod nadpisem', { closing: true, title: 'Nadpis stránky, zároveň titulek v záložce prohlížeče, např. „Kurzy“. Povinné.' })),
};

/** The schema of each page with a text in stranky/ of the content repository, by its file name (= its address). */
export const PAGE_SCHEMAS = { 'o-mne': ABOUT_SCHEMA, kontakt: CONTACT_SCHEMA, 404: NOT_FOUND_SCHEMA, kurzy: TEXT_PAGE_SCHEMA };

/** Keys of a schema. */
export const fieldKeys = (schema) => schema.fields.map((f) => f.key);
/** Keys of a schema copied to the public copy: the shared ones (without a prefix), in file order. */
export const publicKeys = (schema) => fieldKeys(schema).filter((k) => attributeGroup(k) === 'shared');

/** Lines of a technical comment. */
/** Mark in front of the technical comment of a commented-out (optional, off by default) attribute. */
export const OPTIONAL = 'NEPOVINNÉ.';

/** The technical comment of a field as lines as written in the file (a commented-out one starts with OPTIONAL). */
export const docLines = (field) => {
  const doc = Array.isArray(field.doc) ? field.doc : [field.doc];
  return field.commented ? [`${OPTIONAL} ${doc[0]}`, ...doc.slice(1)] : doc;
};

/**
 * Values outside the `options` of a field (an attribute with a fixed set of values: a list or true/false), as Czech
 * problems "<where>: status „availble“ není mezi možnostmi: available, reserved, sold, not-for-sale". A missing value
 * (absent or empty in YAML) is no problem: its default applies.
 */
export function optionProblems(where, data, schema) {
  return schema.fields
    .filter((f) => f.options && data?.[f.key] !== undefined && data[f.key] !== null && !f.options.includes(data[f.key]))
    .map((f) => `${where}: ${f.key} „${typeof data[f.key] === 'string' ? data[f.key] : JSON.stringify(data[f.key])}“ není mezi možnostmi: ${f.options.join(', ')} [neplatna-moznost]`);
}

/**
 * Comments of the templates before the technical comments existed (at the end of a line, or below a key).
 * The pipeline drops them when it converts an old file; any other comment is kept as the author's own.
 */
export const LEGACY_COMMENTS = new Set([
  'unikátní kód obrazu, NEMĚNIT',
  'den vzniku; rok z něj určuje rok obrazu na webu (stránky roků, adresa)',
  'den vzniku; rok z něj určuje rok obrazu na webu (stránky roků, adresa, URL)',
  'např. papír Arches 300 g, nepovinné',
  'šířka × výška v cm, DOPLNIT (podle toho se dělá mockup)',
  'šířka × výška v cm',
  'např. [krajina, voda, plenér]',
  'available | reserved | sold | not-for-sale',
  'Kč, jen u available, nepovinné',
  'Kč, jen u available a reserved',
  'odkaz na Fler, až bude',
  'true = připravit fotky pro Instagram (export/instagram: originál a detaily)',
  'true = mockupy (obraz v rámu na zdi) na webu, u obrazu na prodej i pro Fler',
  'true = mockupy (obraz v rámu na zdi)',
  'kandidát na úvodní stránku',
  'popisky detailních fotek ze složky se jménem obrazu, nepovinné, např.:',
  '  1-mlha: Mlha nad hladinou',
  'soukromá poznámka, zůstane jen tady, na web se nedostane',
  'úvodní obraz: id díla z kolekce (k3f9a) nebo jeho detail (k3f9a#1-kvet), bez mezer; nepovinné',
  'úvodní obraz: id díla z kolekce (k3f9a) nebo jeho detail (k3f9a#1-kvet); bez něj nejnovější dílo',
  'úvodní obraz se ořízne na 3:2; [zleva %, shora %] = co zůstane vidět',
  'soukromá poznámka, na web se nedostane',
  'co je na fotce (pro nevidomé a vyhledávače), např. „Pavla maluje v ateliéru“',
  'popisek pod fotkou, nepovinné',
  'kam se fotka vycentruje, když ji stránka ořízne: [zleva %, shora %], např. [80, 70] = vpravo dole',
  'kam se fotka vycentruje, když ji stránka ořízne: [zleva %, shora %]',
]);
