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

export const WORK_SCHEMA = {
  name: 'work',
  header: [
    'Popis obrazu - kostru vytvořila pipeline podle fotky.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž. Dokud je meta_draft: true, obraz se na webu nezobrazí.`,
  ],
  // former names of attributes: a file still using one is an error (rename it), never migrated silently
  renamed: { draft: 'meta_draft', instagram: 'meta_instagram' },
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
        'Rohy listu na fotce: všechno vně čtyřúhelníku (podlaha) bude na webu průhledné. Najde je pipeline, smíš je',
        'upravit. photo = [šířka, výška] fotky; tl/tr/br/bl = levý horní, pravý horní, pravý dolní, levý dolní roh jako',
        '[px vodorovně, px svisle] od toho rohu fotky směrem dovnitř, např. tl: [40, 25]. false = nic neořezávat.',
        'Po výměně fotky za jinou velikost atribut smaž, pipeline rohy najde znovu.',
      ],
      value: null,
    },
    { key: 'title', doc: 'Název obrazu, jak ho uvidí návštěvníci webu.', value: '' },
    {
      key: 'date',
      doc: 'Den vzniku ve tvaru 2026-06-14. Rok z něj určuje rok obrazu na webu (stránka roku, adresa).',
      value: '',
    },
    {
      key: 'technique',
      doc: 'Technika, např. akvarel, kresba tužkou, linoryt, kombinovaná technika. Podle ní se filtruje v galerii.',
      value: 'akvarel',
      missing: '',
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
      ],
      value: '',
      previous: [
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
        '- [41, 30] - Canson XL',
      ],
      value: [0, 0],
      missing: null,
      previous: [[
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
      options: ['available', 'reserved', 'sold', 'not-for-sale'],
      doc: [
        'Stav prodeje, možnosti:',
        '- available - k prodeji (s cenou price)',
        '- reserved - rezervováno (s cenou price)',
        '- sold - prodáno',
        '- not-for-sale - není na prodej, na webu bez štítku',
      ],
      value: 'not-for-sale',
      previous: [[
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
      key: 'meta_instagram',
      settled: true,
      options: [true, false],
      doc: [
        'Fotky pro Instagram, možnosti:',
        '- true - připravit (export/instagram: originál a detailní fotky)',
        '- false - žádné',
      ],
      previous: [[
        'Fotky pro Instagram, možnosti:',
        '- true – připravit (export/instagram: originál a detailní fotky)',
        '- false – žádné',
      ], 'true = připravit fotky pro Instagram (export/instagram: originál a detailní fotky); false = žádné.'],
      value: false,
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
        '- true - ve výběru: filtr „Výběr autorky“ v galerii; z 10 nejnovějších vybraných se náhodně střídají',
        '  obrazy nahoře na úvodní stránce, stránce roku a na úvodu kolekce (bez cover)',
        '- false - ne',
      ],
      value: false,
      previous: [[
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
    {
      key: 'description',
      block: true,
      doc: 'Pár vět o obraze, zobrazí se na jeho stránce. Víc řádků pod sebou, odsazených dvěma mezerami.',
      value: 'Pár vět o obraze.\n',
      missing: null,
    },
    {
      key: 'details',
      commented: true,
      example: '{ 1-mlha: Ranní mlha nad vodou }',
      doc: 'Popisky detailních fotek ze složky se jménem obrazu (vedle tohoto souboru): { název fotky: popisek, … }.',
      value: null,
      previous: [[
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
    {
      key: 'description',
      block: true,
      doc: 'Pár vět o kolekci: kde a kdy obrazy vznikly. Víc řádků pod sebou, odsazených dvěma mezerami.',
      value: 'Pár vět o kolekci: kde a kdy obrazy vznikly.\n',
      missing: null,
    },
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

export const YEAR_SCHEMA = {
  name: 'year',
  header: [
    'Rok - kostru vytvořila pipeline pro rok, ve kterém jsou obrazy (název souboru je rok).',
    'Text i úvodní obraz jsou nepovinné. Po vyplnění slovo DOPLNIT smaž.',
  ],
  fields: ordered([
    {
      key: 'description',
      doc: [
        'Pár vět o roce za sebe (jaký byl, co se v tvorbě dělo); zobrazí se nahoře na stránce roku /tvorba/<rok>/.',
        'Víc řádků: napiš description: | a pod to text odsazený dvěma mezerami. Prázdné "" = bez textu.',
      ],
      value: '',
    },
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

/**
 * Default text of the home page: the value of a new skeleton of _index.yaml, and what the site shows before the
 * first public copy exists. The same as the text of the home page in the content repository (texts to approve: T4).
 */
export const HOME_TEXT = 'Maluji pro radost, hlavně akvarelem – na plenérech, na procházkách i doma u stolu. Tady najdete,\n'
  + 'co mi právě uschlo na papíře, rychlé skici tužkou a brush penem i obrazy, které už visí jinde.\n';

export const HOME_SCHEMA = {
  name: 'home',
  header: [
    'Úvodní stránka webu - kostru vytvořila pipeline.',
    'Úvodní obraz je nepovinný. Po kontrole hodnot slovo DOPLNIT smaž.',
  ],
  fields: ordered([
    {
      key: 'description',
      block: true,
      doc: [
        'Text na úvodní stránce vedle velkého obrazu (pod nadpisem). Víc řádků pod sebou, odsazených dvěma',
        'mezerami. Prázdné "" = bez textu.',
      ],
      value: HOME_TEXT,
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
    .map((f) => `${where}: ${f.key} „${typeof data[f.key] === 'string' ? data[f.key] : JSON.stringify(data[f.key])}“ není mezi možnostmi: ${f.options.join(', ')}`);
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
