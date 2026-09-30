# CLAUDE.md

Osobní web akvarelistky Pavly Kramolišové, spravovaný s pomocí Claude Code.
Do tohoto repa (je veřejné) nepatří osobní ani provozní údaje (kdo web spravuje, registrátor domény, IP adresy,
účty, tokeny): ty jsou v dokumentaci obsahového repa.

## Stack
- Astro (statický výstup), žádný UI framework, vanilla JS jen pro filtry v galerii.
- `sharp` + `yaml` pro obrázkovou pipeline (`scripts/process-images.mjs`).
- Node.js ≥ 24 (`engines`); workflow na GitHubu `node-version: 24` ve všech workflow (i v obsahovém repu), držet je stejně.
- Instalační skripty závislostí jen přes `allowScripts` v `package.json` (npm 11 je jinak přeskakuje); nový balíček
  nejdřív posoudit, pak `npm install-scripts approve|deny`, nikdy plošně `--all`.
- Deploy: GitHub Actions → GitHub Pages, doména v `public/CNAME`.

## Data
- **Toto repo je veřejné, obsah je v odděleném soukromém obsahovém repu.** Jeho název, cestu ani odkazy na něj
  sem nikdy nepiš (kód, komentáře, README, CLAUDE.md, commity, texty pull requestů); piš jen „obsahové repo“
  / „the content repository“. Odkazy vedou jen z obsahového repa sem, nikdy obráceně. Lokálně ho pipeline najde
  přes `CONTENT_DIR` v `.env` (mimo git), na GitHubu ho předá workflow obsahového repa.
- Obsahové repo: `tvorba/[<kolekce>/]<slug>.yaml` + master fotka,
  bez složek roků; rok díla = rok jeho `date` (`scripts/lib/content.mjs`). V tomto repu jsou výstupy dál podle roků.
- `npm run images` (`scripts/process-images.mjs`) z něj generuje `content/works/<rok>/<slug>-<id>.yaml`
  (kopie, needitovat) a `public/works/<rok>/<slug>-<id>/`; exporty pro Instagram a Fler jdou do `export/` obsahového repa.
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
- Kolekce = složka `tvorba/<kolekce>/` obsahového repa (slug = slugify názvu, např. `2026-plener-sumava`, i přes víc let)
  s `_kolekce.yaml` a volitelnou `_uvod.jpg`; dílo do ní patří umístěním (max. jedna), `collection:` v yaml díla je chyba,
  do veřejné kopie ho doplní pipeline. Složka jménem díla vedle něj = detailní fotky. Pipeline `scripts/lib/collections.mjs`,
  web `getCollections` a `/tvorba/kolekce/<slug>/`.
  Úvodní obrázek: vlastní fotka > `cover: <id>` nebo `cover: <id>#<detail>` > nejnovější dílo; vždy ořez 3:2 kolem `focus`
  (`src/components/CollectionCover.astro`); `og:image` kolekce je týž výřez, `public/og/collections/<slug>.jpg`
  (`coverSource` + `focusCrop`). Každá výstupní složka pipeline v tomto repu (i `public/og`) musí být v `OUTPUT_PATHS` (`scripts/lib/pull-request.mjs`;
  do PR jdou jen ty z nich, které existují nebo je git zná).
- Detailní fotky díla: `tvorba/[<kolekce>/]<slug>/*.jpg` (obsahové repo) → `detail-<název>-<šířka>.*` a `info.json#details`;
  popisky v yaml díla `details: { <název fotky>: <popisek> }`.
- Filtry galerie (`scripts/lib/gallery-filter.mjs`): všechny se kombinují a každá změna se hned zapisuje do URL,
  aby šel odkaz poslat dál. Platí vždy, i pro každý nový filtr a pro stránku (`page`, i `page=all`).
- Každý výpis děl se stránkuje, v prohlížeči nad vyfiltrovaným seznamem (`paginate`); návštěvník volí počet
  na stránku (`gallery.pageSizes`, `?perPage=`, pamatuje se v `localStorage`, ale odkaz s `perPage`/`page` má vždy
  přednost) a může stránkování jednorázově vypnout („Zobrazit vše“, `?page=all`, nepamatuje se).
- **Atributy popisů (dílo, kolekce, fotka) jsou jen v `scripts/lib/schema.mjs`**: pořadí, výchozí hodnota kostry,
  `missing` (hodnota pro doplnění do existujícího souboru, musí znamenat totéž co chybějící atribut) a technický
  komentář (česky, typ, hodnoty, příklady). Pipeline z něj staví kostry a při každém běhu srovná všechny popisy
  (`scripts/lib/metadata-yaml.mjs`): doplní chybějící atributy s `DOPLNIT`, srovná pořadí a technické komentáře,
  neznámé označí `NEZNÁMÝ`. Nový atribut = záznam ve schématu (+ `PUBLIC_*_FIELDS`, když je veřejný), README obou rep
  a testovací data; změna znění komentáře = staré znění do `previous`. `DOPLNIT` nikdy neodstraňovat za lidi.
- Testovacích děl (`pavla/demo/`) musí být vždy víc, než je nejmenší počet na stránku (aspoň 15 při 12).
- Náhledy pro sdílení (`og:image` + rozměry): dílo = `og.jpg` celý obraz na papíře (nikdy neořezávat),
  kolekce = ořez 3:2 kolem `focus`; helpery `*ShareImage` v `src/lib/site.ts`.
- Mockupy: scény v `mockups/scenes.yaml` (kalibrace px/cm), výběr a vykreslení `scripts/lib/mockups.mjs`.
- Ostatní fotky: `fotky/<název>.jpg` obsahového repa → `public/photos/<název>/`, na stránce `<Photo name="…" />`;
  `aspect` ořízne na poměr stran kolem `focus: [x, y]` (%) z yaml fotky. O mně: `o-mne-uvod` (2:1) a `portret`.
- Automatika: workflow obsahového repa spouští tuto pipeline a otevírá PR do tohoto repa (větev `obsah/aktualizace`,
  auto-merge po projití „Kontroly kódu“, větev se po sloučení maže);
  na jeho ostatních větvích jen `--prepare-only`. Souhrn běhu: `scripts/lib/summary.mjs`. Pull request připravuje
  `scripts/pull-request.mjs` (`scripts/lib/pull-request.mjs`, `OUTPUT_PATHS`); text PR nikdy nejmenuje obsahové repo.
  „Zkušební běh zpracování“ (`.github/workflows/dry-run.yml`, každou neděli na testovacích datech, nic nepushne)
  prochází tytéž kroky: změna kroků zpracování obsahu = stejná změna ve `dry-run.yml`.
  Týdenní kontrola (token, selhané běhy, zkušební běh, nasazení, čekající PR, neznámé atributy):
  `scripts/check-health.mjs` + `scripts/lib/health.mjs`, spouští ji obsahové repo.
  Workflow kontroluje `actionlint` (job `workflows` v `check.yml`); po každé úpravě workflow ho spusť i lokálně.
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
  U každého PR běží vždy: job `check` je povinná kontrola rulesetu na `main`, na kterou čeká auto-merge aktualizací
  obsahu (správce má výjimku pro přímé pushe). Job `check` nepřejmenovávat, jinak se auto-merge zasekne.
  Web z testovacích dat se na GitHubu nestaví (pomalé, nikde se nezveřejňuje): před commitem změn webu nebo pipeline
  vždy lokálně `npm run demo:build` (a výsledek zkontrolovat).

## Testovací a skutečná data
- Testovací (demo) data žijí **jen** v `pavla/demo/` (yaml + recept `demo/images.yaml`) a zpracovávají se přes
  `npm run demo` do `.demo/` (mimo git). Skutečná data jsou **jen** v obsahovém repu; web v produkci se staví
  jen z nich (i když jsou prázdná).
- **Nikdy netvoř testovací/ukázková data v obsahovém repu** (díla, kolekce, fotky, obrázky), ani „dočasně“.
  Nové testovací případy = nové soubory v `pavla/demo/` s `demo-` jménem a `demo: true`.
- Pipeline to hlídá (`scripts/lib/demo.mjs`): skutečná data s `demo-…`/`demo: true` = chyba, testovací data bez
  úplného označení = chyba. Kontrolu neobcházej ani nevypínej.
- Ověřování nových funkcí dělej na testovacích datech (`npm run demo:build`), ne úpravou skutečného obsahu.

## Pravidla
- Jazyk: česky je vše, co vidí uživatelé a Pavla (texty webu, URL, README, CLAUDE.md, návody, složky obsahového repa).
  Anglicky je kód (názvy, komentáře, hlášky pipeline). Tohle záměrně přebíjí globální pravidlo „README anglicky“.
- Texty na webu jsou česky, s diakritikou, ve 1. osobě autorky.
- Minimalistický design: papírové tóny, serif nadpisy (Cormorant Garamond), Work Sans text. Obraz má vždy přednost před UI.
- Vodoznak pro Fler: jen jméno, nikdy URL ani @handle (pravidla Fleru).
- Mockupy musí držet reálné měřítko podle `size_cm`.
- Před commitem: `npm test`, `npm run build` a `npm run demo:build` musí projít.
- README obou rep (toto technicky, obsahové repo pro Pavlu a pro jeho automatiku) musí **vždy obsahovat kompletní popis všech
  vlastností**: celou strukturu, každou schopnost webu i pipeline (včetně voleb, parametrů v URL, kontrol a chyb),
  jak ji nastavit a jak ji lokálně vyzkoušet. Nic, co web nebo pipeline umí, nesmí v README chybět.
  Uprav je v téže změně jako kód, nikdy „až potom“.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
