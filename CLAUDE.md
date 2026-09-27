# CLAUDE.md

Osobní web akvarelistky Pavly Kramolišové. Spravuje ho Libor (manžel), s pomocí Claude Code.

## Stack
- Astro (statický výstup), žádný UI framework, vanilla JS jen pro filtry v galerii.
- `sharp` + `yaml` pro obrázkovou pipeline (`scripts/process-images.mjs`).
- Deploy: GitHub Actions → GitHub Pages, doména v `public/CNAME`.

## Data
- Zdroj obsahu je soukromé repo `pavla-content` (vedle tohoto repa): `tvorba/<rok>/<slug>.yaml` + master fotka.
- `npm run images` (`scripts/process-images.mjs`) z něj generuje `content/works/<rok>/<slug>-<id>.yaml`
  (kopie, needitovat) a `public/works/<rok>/<slug>-<id>/`; exporty pro Instagram a Fler jdou do `pavla-content/export/`.
- Každé dílo má trvalé 5znakové `id` (začíná písmenem, viz `scripts/lib/works.mjs`). URL: `/tvorba/<rok>/<slug>-<id>/`.
- Web načítá díla přes `src/lib/site.ts#getWorks`; `draft: true` a dílo bez `info.json` se nezobrazí.
- Veřejná kopie yaml obsahuje jen pole z `PUBLIC_WORK_FIELDS` (`scripts/lib/works.mjs`) / `PUBLIC_COLLECTION_FIELDS`,
  bez komentářů. `private_note` a neznámá pole nesmí nikdy do repa `pavla` (je veřejné). Nové veřejné pole = přidat do seznamu.
- Stav prodeje: `isOnSale` = `available` | `reserved` a musí mít `price` (kontrola v pipeline). Jen tato díla
  mají mockupy, Fler exporty a filtr „neprodané“; `not-for-sale` a `sold` nikdy.
- Exporty: Instagram vždy originál (`-clean`) + detailní fotky, nikdy mockupy. Fler jen díla na prodej:
  originál + mockupy, vše s vodoznakem. Při přegenerování se staré exporty díla mažou (`clearExports`),
  plný běh navíc porovná `export/` s `expectedExports` a smaže vše navíc (`planExportPrune`), i bez přegenerování.
- Kolekce: `pavla-content/kolekce/<slug>.yaml` (+ volitelná úvodní `<slug>.jpg`), dílo `collection: <slug>` (max. jedna).
  Pipeline `scripts/lib/collections.mjs`, web `getCollections` a `/tvorba/kolekce/<slug>/`.
  Úvodní obrázek: vlastní fotka > `cover: <id>` nebo `cover: <id>#<detail>` > nejnovější dílo; vždy ořez 3:2 kolem `focus`
  (`src/components/CollectionCover.astro`); `og:image` kolekce je týž výřez, `public/og/collections/<slug>.jpg`
  (`coverSource` + `focusCrop`). `public/og` musí být v add-paths workflow `publish.yml`.
- Detailní fotky díla: `pavla-content/tvorba/<rok>/<slug>/*.jpg` → `detail-<název>-<šířka>.*` a `info.json#details`;
  popisky v yaml díla `details: { <název fotky>: <popisek> }`.
- Filtry galerie (`scripts/lib/gallery-filter.mjs`): všechny se kombinují a každá změna se hned zapisuje do URL,
  aby šel odkaz poslat dál. Platí vždy, i pro každý nový filtr a pro stránku (`page`, i `page=all`).
- Každý výpis děl se stránkuje, v prohlížeči nad vyfiltrovaným seznamem (`paginate`); návštěvník volí počet
  na stránku (`gallery.pageSizes`, `?perPage=`, pamatuje se v `localStorage`, ale odkaz s `perPage`/`page` má vždy
  přednost) a může stránkování jednorázově vypnout („Zobrazit vše“, `?page=all`, nepamatuje se).
- Testovacích děl (`pavla/demo/`) musí být vždy víc, než je nejmenší počet na stránku (aspoň 15 při 12).
- Náhledy pro sdílení (`og:image` + rozměry): dílo = `og.jpg` celý obraz na papíře (nikdy neořezávat),
  kolekce = ořez 3:2 kolem `focus`; helpery `*ShareImage` v `src/lib/site.ts`.
- Mockupy: scény v `mockups/scenes.yaml` (kalibrace px/cm), výběr a vykreslení `scripts/lib/mockups.mjs`.
- Ostatní fotky: `pavla-content/fotky/<název>.jpg` → `public/photos/<název>/`, na stránce `<Photo name="…" />`;
  `aspect` ořízne na poměr stran kolem `focus: [x, y]` (%) z yaml fotky. O mně: `o-mne-uvod` (2:1) a `portret`.
- Automatika: workflow v `pavla-content/.github/workflows/publish.yml` spouští pipeline a otevírá PR
  do tohoto repa (větev `obsah/aktualizace`, secret `PAVLA_TOKEN`). Souhrn běhu: `scripts/lib/summary.mjs`.
  Týdenní kontrola (token, selhané běhy, nasazení, čekající PR): `health-check.yml` + `scripts/check-health.mjs` (`scripts/lib/health.mjs`).
- Deploy workflow tohoto repa obrázky negeneruje, jen staví web z toho, co je commitnuté.
- „Kontrola kódu“ (`.github/workflows/check.yml`): u PR a pushe do `main` `npm test` + `npm run demo:build`.
  Když přidáš funkci, která potřebuje ověřit ve výsledném webu, přidej kontrolu i do jeho posledního kroku.

## Testovací a skutečná data
- Testovací (demo) data žijí **jen** v `pavla/demo/` (yaml + recept `demo/images.yaml`) a zpracovávají se přes
  `npm run demo` do `.demo/` (mimo git). Skutečná data jsou **jen** v `pavla-content`; web v produkci se staví
  jen z nich (i když jsou prázdná).
- **Nikdy netvoř testovací/ukázková data v `pavla-content`** (díla, kolekce, fotky, obrázky), ani „dočasně“.
  Nové testovací případy = nové soubory v `pavla/demo/` s `demo-` jménem a `demo: true`.
- Pipeline to hlídá (`scripts/lib/demo.mjs`): skutečná data s `demo-…`/`demo: true` = chyba, testovací data bez
  úplného označení = chyba. Kontrolu neobcházej ani nevypínej.
- Ověřování nových funkcí dělej na testovacích datech (`npm run demo:build`), ne úpravou skutečného obsahu.

## Pravidla
- Jazyk: česky je vše, co vidí uživatelé a Pavla (texty webu, URL, README, CLAUDE.md, návody, složky v `pavla-content`).
  Anglicky je kód (názvy, komentáře, hlášky pipeline). Tohle záměrně přebíjí globální pravidlo „README anglicky“.
- Texty na webu jsou česky, s diakritikou, ve 1. osobě autorky.
- Minimalistický design: papírové tóny, serif nadpisy (Cormorant Garamond), Work Sans text. Obraz má vždy přednost před UI.
- Vodoznak pro Fler: jen jméno, nikdy URL ani @handle (pravidla Fleru).
- Mockupy musí držet reálné měřítko podle `size_cm`.
- Před commitem: `npm test` a `npm run build` musí projít.
- README obou rep (`pavla` technicky, `pavla-content` pro Pavlu) musí **vždy obsahovat kompletní popis všech
  vlastností**: celou strukturu, každou schopnost webu i pipeline (včetně voleb, parametrů v URL, kontrol a chyb),
  jak ji nastavit a jak ji lokálně vyzkoušet. Nic, co web nebo pipeline umí, nesmí v README chybět.
  Uprav je v téže změně jako kód, nikdy „až potom“.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
