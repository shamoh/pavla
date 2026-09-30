# CLAUDE.md

Osobní web akvarelistky Pavly Kramolišové. Spravuje ho Libor (manžel), s pomocí Claude Code.

## Stack
- Astro (statický výstup), žádný UI framework, vanilla JS jen pro filtry v galerii.
- `sharp` + `yaml` pro obrázkovou pipeline (`scripts/process-images.mjs`).
- Node.js ≥ 24 (`engines`); workflow na GitHubu `node-version: 24` ve všech workflow obou rep, držet je stejně.
- Instalační skripty závislostí jen přes `allowScripts` v `package.json` (npm 11 je jinak přeskakuje); nový balíček
  nejdřív posoudit, pak `npm install-scripts approve|deny`, nikdy plošně `--all`.
- Deploy: GitHub Actions → GitHub Pages, doména v `public/CNAME`.

## Data
- Zdroj obsahu je soukromé repo `pavla-content` (vedle tohoto repa): `tvorba/[<kolekce>/]<slug>.yaml` + master fotka,
  bez složek roků; rok díla = rok jeho `date` (`scripts/lib/content.mjs`). V tomto repu jsou výstupy dál podle roků.
- `npm run images` (`scripts/process-images.mjs`) z něj generuje `content/works/<rok>/<slug>-<id>.yaml`
  (kopie, needitovat) a `public/works/<rok>/<slug>-<id>/`; exporty pro Instagram a Fler jdou do `pavla-content/export/`.
- Každé dílo má trvalé 5znakové `id` (začíná písmenem, viz `scripts/lib/works.mjs`). URL: `/tvorba/<rok>/<slug>-<id>/`.
- Web načítá díla přes `src/lib/site.ts#getWorks`; `draft: true` a dílo bez `info.json` se nezobrazí.
- Veřejná kopie yaml obsahuje jen pole z `PUBLIC_WORK_FIELDS` (`scripts/lib/works.mjs`) / `PUBLIC_COLLECTION_FIELDS`,
  bez komentářů. `private_note` a neznámá pole nesmí nikdy do repa `pavla` (je veřejné). Nové veřejné pole = přidat do seznamu.
- Stav prodeje: `isOnSale` = `available` | `reserved` a musí mít `price` (kontrola v pipeline). Jen tato díla
  mají Fler exporty a filtr „neprodané“; `not-for-sale` a `sold` nikdy.
- Mockupy jen s `mockups: true` v popisu díla (výchozí false), nezávisle na stavu prodeje (`wantsMockups`);
  Fler mockupy jen u díla na prodej, které mockupy má.
- Exporty: Instagram jen u díla s `instagram: true` (výchozí false), originál (`-clean`) + detailní fotky, nikdy mockupy. Fler jen díla na prodej:
  originál + mockupy, vše s vodoznakem. Při přegenerování se staré exporty díla mažou (`clearExports`),
  plný běh navíc porovná `export/` s `expectedExports` a smaže vše navíc (`planExportPrune`), i bez přegenerování.
- Kolekce = složka `pavla-content/tvorba/<kolekce>/` (slug = slugify názvu, např. `2026-plener-sumava`, i přes víc let)
  s `_kolekce.yaml` a volitelnou `_uvod.jpg`; dílo do ní patří umístěním (max. jedna), `collection:` v yaml díla je chyba,
  do veřejné kopie ho doplní pipeline. Složka jménem díla vedle něj = detailní fotky. Pipeline `scripts/lib/collections.mjs`,
  web `getCollections` a `/tvorba/kolekce/<slug>/`.
  Úvodní obrázek: vlastní fotka > `cover: <id>` nebo `cover: <id>#<detail>` > nejnovější dílo; vždy ořez 3:2 kolem `focus`
  (`src/components/CollectionCover.astro`); `og:image` kolekce je týž výřez, `public/og/collections/<slug>.jpg`
  (`coverSource` + `focusCrop`). Každá výstupní složka pipeline v tomto repu (i `public/og`) musí být v `OUTPUT_PATHS` (`scripts/lib/pull-request.mjs`;
  do PR jdou jen ty z nich, které existují nebo je git zná).
- Detailní fotky díla: `pavla-content/tvorba/[<kolekce>/]<slug>/*.jpg` → `detail-<název>-<šířka>.*` a `info.json#details`;
  popisky v yaml díla `details: { <název fotky>: <popisek> }`.
- Filtry galerie (`scripts/lib/gallery-filter.mjs`): všechny se kombinují a každá změna se hned zapisuje do URL,
  aby šel odkaz poslat dál. Platí vždy, i pro každý nový filtr a pro stránku (`page`, i `page=all`).
- Každý výpis děl se stránkuje, v prohlížeči nad vyfiltrovaným seznamem (`paginate`); návštěvník volí počet
  na stránku (`gallery.pageSizes`, `?perPage=`, pamatuje se v `localStorage`, ale odkaz s `perPage`/`page` má vždy
  přednost) a může stránkování jednorázově vypnout („Zobrazit vše“, `?page=all`, nepamatuje se).
- **Kostry popisů musí vždy obsahovat všechny podporované atributy.** Nový atribut díla, kolekce nebo fotky
  = ve stejné změně doplnit šablonu (`scripts/templates/work.yaml`, `collection.yaml`, `photo.yaml`) s komentářem
  a výchozí hodnotou, výčet `WORK_FIELDS` / `COLLECTION_FIELDS` / `PHOTO_FIELDS` (veřejné pole i do
  `PUBLIC_*_FIELDS`), tabulku „Co automatika vyplní sama“ v README `pavla-content` a testovací data.
  Test „skeletons contain every supported attribute“ to hlídá.
- Testovacích děl (`pavla/demo/`) musí být vždy víc, než je nejmenší počet na stránku (aspoň 15 při 12).
- Náhledy pro sdílení (`og:image` + rozměry): dílo = `og.jpg` celý obraz na papíře (nikdy neořezávat),
  kolekce = ořez 3:2 kolem `focus`; helpery `*ShareImage` v `src/lib/site.ts`.
- Mockupy: scény v `mockups/scenes.yaml` (kalibrace px/cm), výběr a vykreslení `scripts/lib/mockups.mjs`.
- Ostatní fotky: `pavla-content/fotky/<název>.jpg` → `public/photos/<název>/`, na stránce `<Photo name="…" />`;
  `aspect` ořízne na poměr stran kolem `focus: [x, y]` (%) z yaml fotky. O mně: `o-mne-uvod` (2:1) a `portret`.
- Automatika: workflow v `pavla-content/.github/workflows/publish.yml` spouští pipeline a otevírá PR
  do tohoto repa (větev `obsah/aktualizace`, secret `PAVLA_TOKEN`). Souhrn běhu: `scripts/lib/summary.mjs`.
  Na ostatních větvích `pavla-content` jen `--prepare-only` (kostry, id, kontroly) s commitem zpět do větve.
  Týdenní kontrola (token, selhané běhy, zkušební běh, nasazení, čekající PR): `health-check.yml` + `scripts/check-health.mjs` (`scripts/lib/health.mjs`).
  Pull request připravuje `scripts/pull-request.mjs` (`scripts/lib/pull-request.mjs`, `OUTPUT_PATHS`), totéž v `publish.yml`
  i ve „Zkušebním běhu zpracování“ (`.github/workflows/dry-run.yml`, každou neděli na testovacích datech, nic nepushne).
  Změna kroků `publish.yml` = stejná změna ve `dry-run.yml`, ať zkušební běh zkouší opravdu totéž.
  Workflow obou rep kontroluje `actionlint` (job `workflows` v `check.yml`, v `pavla-content` `check-workflows.yml`);
  po každé úpravě workflow ho spusť i lokálně.
- Deploy workflow tohoto repa obrázky negeneruje, jen staví web z toho, co je commitnuté.
- Srovnání fotek obrazů (perspektiva, ořez podkladu): `npm run straighten -- <fotka|složka>` (`scripts/straighten.mjs`),
  originály nikdy nepřepisuje, výstup do `upravene/`; ruční rohy a další výřezy v `<fotka>.orez.yaml`, `--white-balance`, `--width`, `--margin` (výchozí okraj podkladu kolem listu, aby byly vidět okraje papíru).
  S okrajem zapíše do JPEGu polohu listu (XMP `pavla:sheet`, `scripts/lib/sheet-box.mjs`); pipeline podle ní
  pro mockupy (web i Fler) ořízne master na holý papír, jinde okraj zůstává.
- Návštěvnost: Google Analytics 4 (`analytics.googleMeasurementId` v `site.config.yaml`, `scripts/lib/analytics.mjs`,
  značka v `Base.astro`), jen produkční build skutečného webu, nikdy dev ani testovací data; URL i s parametry filtrů.
  Vlastní události (`EVENTS`: `gallery_filter`, `fler_click`, `email_click`); nový parametr události = zapsat do README
  (tabulka událostí + seznam vlastních dimenzí k registraci v GA).
- Patička nese verzi buildu `vRR.MMDD.HHMM` (pražský čas) s bublinou (datum, commit): `scripts/lib/build-version.mjs`.
- „Kontrola kódu“ (`.github/workflows/check.yml`): u PR a pushe do `main` jen `npm test` + `npm run build` (rychlé).
  Web z testovacích dat se na GitHubu nestaví (pomalé, nikde se nezveřejňuje): před commitem změn webu nebo pipeline
  vždy lokálně `npm run demo:build` (a výsledek zkontrolovat).

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
- Před commitem: `npm test`, `npm run build` a `npm run demo:build` musí projít.
- README obou rep (`pavla` technicky, `pavla-content` pro Pavlu) musí **vždy obsahovat kompletní popis všech
  vlastností**: celou strukturu, každou schopnost webu i pipeline (včetně voleb, parametrů v URL, kontrol a chyb),
  jak ji nastavit a jak ji lokálně vyzkoušet. Nic, co web nebo pipeline umí, nesmí v README chybět.
  Uprav je v téže změně jako kód, nikdy „až potom“.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
