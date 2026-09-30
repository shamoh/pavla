// Every attribute of the content YAML files (a work, a collection's _kolekce.yaml, a photo in fotky/), in order,
// with its default value and its technical comment. The single source of truth: skeletons of new files are built
// from it and the pipeline brings every existing file in line with it (scripts/lib/metadata-yaml.mjs).
// A new attribute = a new entry here (and, when public, in PUBLIC_WORK_FIELDS / PUBLIC_COLLECTION_FIELDS).
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

/** Prefix of a technical comment whose value still needs checking; the pipeline adds it, people remove it. */
export const TODO = 'DOPLNIT';
/** Technical comment of an attribute the pipeline does not know (a typo?); it is kept, at the end of the file. */
export const UNKNOWN_DOC = 'NEZNÁMÝ atribut: pipeline ho nezná (překlep?) a nepoužije ho. Oprav jeho název, nebo řádek smaž.';

const demo = {
  key: 'demo',
  optional: true,
  doc: 'Jen testovací data (repo pavla, složka demo/): true = testovací položka. Ve skutečném obsahu být nesmí.',
  value: true,
};

export const WORK_SCHEMA = {
  name: 'work',
  header: [
    'Popis obrazu – kostru vytvořila pipeline podle fotky.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž. Dokud je draft: true, obraz se na webu nezobrazí.`,
  ],
  fields: [
    {
      key: 'id',
      generated: true,
      doc: [
        'Trvalý kód obrazu: podle něj web pozná obraz i po přejmenování (krátká adresa /tvorba/<id>/).',
        'Generuje ho pipeline, NIKDY neměnit. Hodí se napsat tužkou na zadní stranu obrazu.',
      ],
      value: null,
    },
    demo,
    { key: 'draft', doc: 'true = rozpracovaný, na webu se nezobrazí; false = zveřejnit.', value: true, missing: false },
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
    { key: 'support', doc: 'Podklad, např. papír Arches 300 g. Nepovinné, prázdné = na webu se nezobrazí.', value: '' },
    {
      key: 'size_cm',
      doc: [
        'Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu:',
        'podle rozměrů se dělají mockupy ve skutečné velikosti.',
      ],
      value: [0, 0],
      missing: null,
    },
    { key: 'tags', doc: 'Štítky pro filtr v galerii, např. [krajina, voda, plenér]. Prázdné = [].', value: [] },
    {
      key: 'status',
      doc: [
        'Stav prodeje: available (k prodeji) | reserved (rezervováno) | sold (prodáno)',
        '| not-for-sale (není na prodej, na webu bez štítku).',
      ],
      value: 'not-for-sale',
    },
    {
      key: 'price',
      doc: 'Cena v Kč, např. 2500. Povinná u available a reserved, jinak nech prázdné.',
      value: null,
    },
    {
      key: 'fler',
      doc: 'Odkaz na obraz na Fleru (https://www.fler.cz/…). U obrazu na prodej s ním web ukáže tlačítko „Koupit na Fleru“.',
      value: '',
    },
    {
      key: 'instagram',
      doc: 'true = připravit fotky pro Instagram (export/instagram: originál a detailní fotky); false = žádné.',
      value: false,
    },
    {
      key: 'mockups',
      doc: 'true = mockupy (obraz v rámu v interiéru) na webu, u obrazu na prodej i pro Fler; false = žádné.',
      value: false,
    },
    {
      key: 'featured',
      doc: [
        'true = ve výběru autorky: filtr „Výběr autorky“ v galerii; z 10 nejnovějších vybraných se náhodně',
        'střídají obrazy nahoře na úvodní stránce, stránce roku a na úvodu kolekce (bez cover). false = ne.',
      ],
      value: false,
      previous: [[
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
      doc: [
        'Popisky detailních fotek ze složky se jménem obrazu (vedle tohoto souboru), nepovinné. Např.:',
        'details:',
        '  1-mlha: Mlha nad hladinou',
      ],
      value: null,
    },
    {
      key: 'private_note',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ],
};

export const COLLECTION_SCHEMA = {
  name: 'collection',
  header: [
    'Kolekce – kostru vytvořila pipeline pro tuto složku.',
    'Obrazy kolekce jsou soubory v této složce. Adresa kolekce na webu je název složky (bez diakritiky).',
    'Úvodní fotka kolekce (nepovinná): _uvod.jpg vedle tohoto souboru.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž.`,
  ],
  fields: [
    demo,
    { key: 'title', doc: 'Název kolekce na webu, např. Plenér Šumava 2026.', value: '' },
    {
      key: 'description',
      block: true,
      doc: 'Pár vět o kolekci: kde a kdy obrazy vznikly. Víc řádků pod sebou, odsazených dvěma mezerami.',
      value: 'Pár vět o kolekci: kde a kdy obrazy vznikly.\n',
      missing: null,
    },
    {
      key: 'cover',
      doc: [
        'Úvodní obraz: id díla z kolekce (např. k3f9a) nebo jeho detailní fotka (k3f9a#1-kvet), bez mezer.',
        'Nepovinné: bez něj vlastní fotka _uvod.jpg, jinak nejnovější dílo. Dílo s draft: true nejde.',
      ],
      value: '',
    },
    {
      key: 'focus',
      doc: [
        'Úvodní obraz se ořízne na 3:2; [zleva %, shora %] = co zůstane vidět,',
        'např. [50, 50] = střed, [80, 30] = vpravo nahoře.',
      ],
      value: [50, 50],
    },
    {
      key: 'private_note',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ],
};

export const PHOTO_SCHEMA = {
  name: 'photo',
  header: [
    'Popis fotky – kostru vytvořila pipeline.',
    `Zkontroluj a doplň hodnoty označené ${TODO}, pak slovo ${TODO} smaž.`,
  ],
  fields: [
    demo,
    {
      key: 'alt',
      doc: 'Co je na fotce (pro nevidomé a vyhledávače), např. „Pavla maluje v ateliéru“.',
      value: '',
    },
    { key: 'caption', doc: 'Popisek pod fotkou, nepovinné.', value: '' },
    {
      key: 'focus',
      doc: [
        'Kam se fotka vycentruje, když ji stránka ořízne: [zleva %, shora %],',
        'např. [50, 50] = střed, [80, 70] = vpravo dole.',
      ],
      value: [50, 50],
    },
  ],
};

export const YEAR_SCHEMA = {
  name: 'year',
  header: [
    'Rok – kostru vytvořila pipeline pro rok, ve kterém jsou obrazy (název souboru je rok).',
    'Text je nepovinný: prázdný se na webu nezobrazí. Po vyplnění slovo DOPLNIT smaž.',
  ],
  fields: [
    demo,
    {
      key: 'description',
      doc: [
        'Pár vět o roce za sebe (jaký byl, co se v tvorbě dělo); zobrazí se nahoře na stránce roku /tvorba/<rok>/.',
        'Víc řádků: napiš description: | a pod to text odsazený dvěma mezerami. Prázdné "" = bez textu.',
      ],
      value: '',
    },
    {
      key: 'private_note',
      doc: 'Soukromá poznámka, zůstane jen v tomto repu, na web se nikdy nedostane.',
      value: '',
    },
  ],
};

/** Keys of a schema, without the ones only test data have. */
export const fieldKeys = (schema) => schema.fields.filter((f) => f.key !== 'demo').map((f) => f.key);

/** Lines of a technical comment. */
export const docLines = (field) => (Array.isArray(field.doc) ? field.doc : [field.doc]);

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
