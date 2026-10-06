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
- Systémové soubory obsahu mají všude dvě jména (`INDEX_FILE`, `COVER_NAME` v `scripts/lib/content.mjs`):
  `_index.yaml` = popis místa, kde leží (kořen = úvodní stránka, složka kolekce = kolekce), `_cover.<ext>` = jeho
  vlastní úvodní fotka. Stará jména (`RETIRED_NAMES`: `_kolekce.yaml`, `_uvod.*`, `uvod.yaml`, `uvod.*`) = chyba,
  žádná migrace a vedle nich se nezakládá kostra. Složky a jména děl zůstávají česky (`tvorba/`, `roky/`, `fotky/`).
- `npm run images` (`scripts/process-images.mjs`) z něj generuje `content/` = zrcadlo obsahového repa (stejné složky
  a jména, jen veřejné atributy, `scripts/lib/site-content.mjs`, needitovat; plný běh smaže vše, co nezapsal)
  a obrázky v `public/` ve složce své stránky (= adresa, `scripts/lib/site-images.mjs`): dílo
  `public/tvorba/<rok>/<slug>-<id>/`, rok `public/tvorba/<rok>/_cover/` + `og.jpg`, kolekce
  `public/tvorba/kolekce/<slug>/_cover/` + `og.jpg`, úvod `public/_cover/` + `public/og.jpg`, fotky `public/fotky/<název>/`;
  plný běh smaže vše, co nevyrobil (`staleOutputs`).
  Exporty pro Instagram a Fler jdou do `export/` obsahového repa.
  Web čte kopie přes `readCopies`: rok díla z `date`, kolekce ze složky (žádný atribut `collection`).
- Každé dílo má trvalé 5znakové `id` (začíná písmenem, viz `scripts/lib/works.mjs`). URL: `/tvorba/<rok>/<slug>-<id>/`.
- Web načítá díla přes `src/lib/site.ts#getWorks`; `meta_draft: true` a dílo bez `info.json` se nezobrazí.
- Atributy popisů mají skupiny podle prefixu (`attributeGroup`, `compareKeys` v `scripts/lib/schema.mjs`), v souboru
  v pořadí `meta_*` (jen obsahové repo, řídí zpracování), sdílené bez prefixu (`id` první, pak abecedně; kopírují se 1:1),
  `private_*` (jen obsahové repo; vlastní `private_…` smí přidat kdokoli, bez `NEZNÁMÝ`) / `derived_*` (jen toto repo,
  odvozuje pipeline; v obsahovém repu = chyba; teď `derived_modified` díla = den poslední změny veřejných údajů
  nebo obrázků, `lastmod` v mapě webu). Uvnitř skupiny abecedně. Přejmenovaný atribut (`renamed` ve schématu,
  `draft` → `meta_draft`, `instagram` → `meta_instagram`) = chyba, soubor se nemění, žádná migrace.
- Veřejná kopie yaml obsahuje jen sdílené atributy (`publicKeys(<schéma>)` = `PUBLIC_WORK_FIELDS` / `PUBLIC_COLLECTION_FIELDS`
  / `PUBLIC_YEAR_FIELDS` / `PUBLIC_HOME_FIELDS` / `PUBLIC_PHOTO_FIELDS`, nikdy ručně),
  bez komentářů. `meta_*`, `private_*` a neznámá pole nesmí nikdy do repa `pavla` (je veřejné).
- Stav prodeje: `isOnSale` = `available` | `reserved` a musí mít `price` (kontrola v pipeline). Jen tato díla
  mají Fler exporty a filtr „neprodané“; `not-for-sale` a `sold` nikdy.
- Mockupy jen s `mockups: true` v popisu díla (výchozí false), nezávisle na stavu prodeje (`wantsMockups`);
  Fler mockupy jen u díla na prodej, které mockupy má.
- Exporty: Instagram jen u díla s `meta_instagram: true` (výchozí false), originál (`-clean`) + detailní fotky, nikdy mockupy. Fler jen díla na prodej:
  originál + mockupy, vše s vodoznakem. Při přegenerování se staré exporty díla mažou (`clearExports`),
  plný běh navíc porovná `export/` s `expectedExports` a smaže vše navíc (`planExportPrune`), i bez přegenerování.
- Kolekce = složka `tvorba/<kolekce>/` obsahového repa (slug = slugify názvu, např. `2026-plener-sumava`, i přes víc let)
  s `_index.yaml` a volitelnou `_cover.jpg`; dílo do ní patří umístěním (max. jedna), `collection:` v yaml díla je chyba,
  veřejná kopie leží ve stejné složce. Složka jménem díla vedle něj = detailní fotky. Pipeline `scripts/lib/collections.mjs`,
  web `getCollections` a `/tvorba/kolekce/<slug>/`.
  Úvodní obraz kolekce, roku i úvodní stránky: jedno pravidlo (`scripts/lib/covers.mjs`, web `resolveCover`,
  komponenta `Cover.astro`): vlastní fotka (`_cover.jpg` kolekce, `roky/<rok>.jpg`, `_cover.jpg` v kořeni) > `cover: <id>` nebo
  `<id>#<detail>` > náhodně z výběru autorky > nejnovější dílo. Vše se ukáže celé; vybraný obraz (vlastní fotka nebo
  `cover`) s `aspect` nebo `focus` se ořízne (`coverCrop`, chybějící = `"1:1"` / `[50, 50]`; stejný výřez je `og:image`
  v `og.jpg` ve složce stránky). Náhodný se neořezává, `aspect`/`focus` u něj = chyba; v kostrách prázdné. Každá výstupní složka pipeline v tomto repu musí být
  v `OUTPUT_PATHS` (`scripts/lib/pull-request.mjs`; do PR jdou jen ty z nich, které existují nebo je git zná).
- Detailní fotky díla: `tvorba/[<kolekce>/]<slug>/*.jpg` (obsahové repo) → `detail-<název>-<šířka>.*` a `info.json#details`;
  popisky v yaml díla `details: { <název fotky>: <popisek> }`.
- Filtry galerie (`scripts/lib/gallery-filter.mjs`): všechny se kombinují a každá změna se hned zapisuje do URL,
  aby šel odkaz poslat dál. Platí vždy, i pro každý nový filtr a pro stránku (`page`, i `page=all`).
- `featured: true` = výběr autorky: filtr „Výběr autorky“ (`?featured=1`) a kandidáti úvodních obrazů
  (`coverCandidates`, `FEATURED_PICK` = 10 nejnovějších vybraných): úvodní obraz bez vlastní fotky a `cover`
  (`Cover.astro`, vede na zobrazené dílo); stránka ukáže náhodného skriptem `scripts/lib/random-pick.mjs`
  (vložený, bez přeblikávání), `og:image` je vždy první kandidát. Web pipeline (`coverSource`) musí vybírat stejně.
- Text o roce: `roky/<rok>.yaml` obsahového repa (`YEAR_SCHEMA`, `scripts/lib/years.mjs`), kostru pipeline založí
  ke každému roku s díly; veřejná kopie `content/roky/<rok>.yaml` (`description`, `cover`, `aspect`, `focus`), web `getYear`.
- Úvodní stránka: `_index.yaml` v kořeni obsahového repa (`HOME_SCHEMA`, `scripts/lib/home.mjs`; text `description`,
  `cover`, `aspect`, `focus`), kostra s výchozím textem `HOME_TEXT` (= text úvodu ve skutečném obsahu); veřejná kopie `content/_index.yaml`, web `getHome`.
- Každý výpis děl se stránkuje, v prohlížeči nad vyfiltrovaným seznamem (`paginate`); návštěvník volí počet
  na stránku (`gallery.pageSizes`, `?perPage=`, pamatuje se v `localStorage`, ale odkaz s `perPage`/`page` má vždy
  přednost) a může stránkování jednorázově vypnout („Zobrazit vše“, `?page=all`, nepamatuje se).
- **Atributy popisů (dílo, kolekce, fotka) jsou jen v `scripts/lib/schema.mjs`**: pořadí, výchozí hodnota kostry,
  `missing` (hodnota pro doplnění do existujícího souboru, musí znamenat totéž co chybějící atribut) a technický
  komentář (česky, typ, hodnoty, příklady). Pipeline z něj staví kostry a při každém běhu srovná všechny popisy
  (`scripts/lib/metadata-yaml.mjs`): doplní chybějící atributy s `DOPLNIT`, srovná pořadí a technické komentáře,
  neznámé označí `NEZNÁMÝ`. Povinný atribut s konečnou výchozí hodnotou (`settled: true`: `meta_draft`, `tags`, `meta_instagram`,
  `mockups`, `featured`) nikdy nemá `DOPLNIT`. Nepovinný atribut (`commented: true` + `example`: `support`, `details`,
  `caption`, `private_note`, `price`, `fler`, `cover`, `aspect`, `focus`) je v souboru zakomentovaný (`# price: 2500`) pod technickým komentářem s `NEPOVINNÉ.`, bez
  `DOPLNIT`; prázdná hodnota = zakomentovat. Nový atribut = záznam ve schématu (prefix určí skupinu), README obou rep
  a testovací data; změna znění komentáře = staré znění do `previous`. `DOPLNIT` nikdy neodstraňovat za lidi.
- Testovacích děl (`pavla/demo-content/`) musí být vždy víc, než je nejmenší počet na stránku (aspoň 15 při 12).
- Náhledy pro sdílení (`og:image` + rozměry): dílo = `og.jpg` celý obraz na papíře (nikdy neořezávat),
  úvodní obraz kolekce/roku/úvodu = ořez vybraného (`aspect`/`focus`), vlastní fotka nebo detail celé na papíře, jinak `og.jpg`
  díla (`coverShareSource`); helpery `*ShareImage` v `src/lib/site.ts`.
- Mockupy: scény v `mockups/scenes.yaml` (kalibrace px/cm), výběr a vykreslení `scripts/lib/mockups.mjs`.
- Ořez podlahy: `meta_corners` díla (`photo` + rohy `tl`/`tr`/`br`/`bl` v px dovnitř, `false` = neořezávat) najde
  pipeline u každého díla s fotkou bez atributu (i zveřejněného, i `--prepare-only`; `scripts/lib/corners.mjs`,
  detekce a maska `scripts/lib/edges.mjs`), ruční hodnotu nikdy nepřepíše, jiný rozměr fotky = chyba. Vně rohů
  průhledné s prolnutím (`images.edges`): web AVIF/WebP průhledné (`transparent` v `info.json`, třída `cutout`:
  bez `--ph`, stín jen `filter: var(--drop-…)`, nikdy `box-shadow`), JPEG na papíře první palety, og/Instagram na
  svém pozadí, Fler bílá, mockup jen vnitřní obdélník (průnik s `pavla:sheet`). Náhledy ořezu draftů do
  `.previews/` (mimo git), workflow obsahového repa i `dry-run.yml` je nahrají jako artefakt `nahledy-orezu`.
  `npm run preview -- <fotka|složka>` (`scripts/preview.mjs`): tentýž náhled pro libovolné fotky, obsah jen čte,
  chybějící rohy najde a vypíše jako yaml; `--write` je zapíše jen do popisů zadaných fotek bez `meta_corners`.
  Náhled i výpis ukazují ořez rohů v % fotky, nad `images.edges.suspicious` (5 %) červeně / `!`, na konci výpisu souhrn podezřelých fotek;
  `--only-suspicious` = jen podezřelé (ne s `--write`). Souhrn běhu („Nalezené rohy listu“) značí podezřelé `⚠`. Originální fotky obsahového repa pipeline nikdy nemění.
- Ostatní fotky: `fotky/<název>.jpg` obsahového repa → `public/fotky/<název>/` (obrázky), popis (`alt`, `caption`,
  `focus`) → `content/fotky/<název>.yaml`; na stránce `<Photo name="…" />`;
  `aspect` ořízne na poměr stran kolem `focus: [x, y]` (%) z yaml fotky. O mně: `o-mne-uvod` (2:1) a `portret`.
- Automatika: workflow obsahového repa spouští tuto pipeline a otevírá PR do tohoto repa (větev `obsah/aktualizace`,
  auto-merge po projití „Kontroly kódu“, větev se po sloučení maže);
  na jeho ostatních větvích jen `--prepare-only`. Souhrn běhu: `scripts/lib/summary.mjs`. Pull request připravuje
  `scripts/pull-request.mjs` (`scripts/lib/pull-request.mjs`, `OUTPUT_PATHS`); text PR nikdy nejmenuje obsahové repo.
  „Zkušební běh zpracování“ (`.github/workflows/dry-run.yml`, každou neděli na testovacích datech, nic nepushne)
  prochází tytéž kroky: změna kroků zpracování obsahu = stejná změna ve `dry-run.yml`.
  Týdenní kontrola (token, selhané běhy, zkušební běh, nasazení, čekající PR, neznámé atributy, chybějící obrázky
  nasazeného webu `scripts/lib/site-check.mjs`):
  `scripts/check-health.mjs` + `scripts/lib/health.mjs`, spouští ji obsahové repo.
  Workflow kontroluje `actionlint` (job `workflows` v `check.yml`); po každé úpravě workflow ho spusť i lokálně.
- Deploy workflow tohoto repa obrázky negeneruje, jen staví web z toho, co je commitnuté.
- Srovnání fotek obrazů (perspektiva, ořez podkladu): `npm run straighten -- <fotka|složka>` (`scripts/straighten.mjs`),
  originály nikdy nepřepisuje, výstup do `upravene/`; ruční rohy a další výřezy v `<fotka>.orez.yaml`, `--white-balance`, `--width`, `--margin` (výchozí okraj podkladu kolem listu, aby byly vidět okraje papíru).
  S okrajem zapíše do JPEGu polohu listu (XMP `pavla:sheet`, `scripts/lib/sheet-box.mjs`); pipeline podle ní
  pro mockupy (web i Fler) ořízne master na holý papír, jinde okraj zůstává (podlahu vně rohů listu řeší ořez podlahy).
- Vyhledávače (`scripts/lib/seo.mjs`, `Base.astro` props `description`, `type`, `noindex`, `jsonLd`): každá stránka má
  vlastní titulek a popis (max. 160 znaků) a strukturovaná data schema.org (JSON-LD, `graphLd`): `VisualArtwork`
  u díla, `CollectionPage` u výpisů, `Person`/`WebSite`/`ProfilePage`/`ContactPage`, všude `BreadcrumbList`.
  Obraz na prodej uvádí jen dostupnost, **nikdy cenu** (rozhodnutí 2026-10). Nová stránka = popis + JSON-LD
  + do `STATIC_PAGES` (mapa webu). `robots.txt` a 404 (`noindex`) generuje web; ověřovací kódy `site.verification`.
- Návštěvnost: Google Analytics 4 (`analytics.googleMeasurementId` v `site.config.yaml`, `scripts/lib/analytics.mjs`,
  značka v `Base.astro`), jen produkční build skutečného webu, nikdy dev ani testovací data; URL i s parametry filtrů.
  Vlastní události (`EVENTS`: `gallery_filter`, `fler_click`, `email_click`, `message_sent`); nový parametr události = zapsat do README
  (tabulka událostí + seznam vlastních dimenzí k registraci v GA).
- Zprávy od návštěvníků: Web3Forms (`messages.accessKey` v `site.config.yaml`, jedna adresa, předmět `[pavla-web] <typ>: …`),
  formulář na Kontaktu a panel „Napište mi“ na ostatních stránkách (`scripts/lib/messages.mjs`, `message-draft.mjs`,
  `src/lib/message-form.ts`, `MessageForm.astro`, `MessagePanel.astro`). Testovací data = vždy náhled, nic neodesílá.
- Patička nese verzi buildu `vRR.MMDD.HHMM` (pražský čas) s bublinou (datum, commit): `scripts/lib/build-version.mjs`.
- „Kontrola kódu“ (`.github/workflows/check.yml`): u PR a pushe do `main` jen `npm test` + `npm run build` (rychlé).
  U každého PR běží vždy: job `check` je povinná kontrola rulesetu na `main`, na kterou čeká auto-merge aktualizací
  obsahu (správce má výjimku pro přímé pushe). Job `check` nepřejmenovávat, jinak se auto-merge zasekne.
  Web z testovacích dat se na GitHubu nestaví (pomalé, nikde se nezveřejňuje): před commitem změn webu nebo pipeline
  vždy lokálně `npm run demo:build` (a výsledek zkontrolovat).

## Testovací a skutečná data
- Testovací (demo) data žijí **jen** v `pavla/demo-content/`: vymyšlené obsahové repo se stejnou strukturou jako
  skutečné (yaml + recept `demo-content/images.yaml`, značka `demo-content.yaml`), zpracovávají se přes
  `npm run demo` do `.demo/` (mimo git). Skutečná data jsou **jen** v obsahovém repu; web v produkci se staví
  jen z nich (i když jsou prázdná).
- **Nikdy netvoř testovací/ukázková data v obsahovém repu** (díla, kolekce, fotky, obrázky), ani „dočasně“.
  Nové testovací případy = nové soubory v `pavla/demo-content/`, díla a kolekce s `demo-` jménem.
- Pipeline to hlídá (`scripts/lib/demo.mjs`): skutečná data se značkou `demo-content.yaml` nebo s dílem či kolekcí
  `demo-…` = chyba; testovací data bez značky nebo s dílem či kolekcí bez `demo-` = chyba. Atribut `demo` neexistuje.
  Kontrolu neobcházej ani nevypínej.
- Ověřování nových funkcí dělej na testovacích datech (`npm run demo:build`), ne úpravou skutečného obsahu.

## Pravidla
- Jazyk: česky je vše, co vidí uživatelé a Pavla (texty webu, URL, README, CLAUDE.md, návody, složky obsahového repa).
  Anglicky je kód (názvy, komentáře, hlášky pipeline). Tohle záměrně přebíjí globální pravidlo „README anglicky“.
- Texty na webu jsou česky, s diakritikou, ve 1. osobě autorky.
- Minimalistický design: papírové tóny, serif nadpisy (Cormorant Garamond), Work Sans text. Obraz má vždy přednost před UI.
- Barvy jen z palet (`scripts/lib/palettes.mjs`, Papír / Pergamen / Noc, volba v patičce): v CSS vždy proměnné
  (`var(--paper)`, `var(--shadow-deep)`…), nikdy barva natvrdo; nová paleta = záznam v `PALETTES` (test hlídá kontrast).
- Vodoznak pro Fler: jen jméno, nikdy URL ani @handle (pravidla Fleru).
- Mockupy musí držet reálné měřítko podle `size_cm`.
- Před commitem: `npm test`, `npm run build` a `npm run demo:build` musí projít; `npm run check:images` (a pro testovací
  web `SITE_DATA_DIR=.demo/site npm run check:images`) ověří, že žádný obrázek, na který stránky odkazují, nechybí.
- Mapa webu `/sitemap.xml` (`scripts/lib/sitemap.mjs`): nová stránka v `src/pages` bez dat za sebou = do `STATIC_PAGES`.
- README obou rep (toto technicky, obsahové repo pro Pavlu a pro jeho automatiku) musí **vždy obsahovat kompletní popis všech
  vlastností**: celou strukturu, každou schopnost webu i pipeline (včetně voleb, parametrů v URL, kontrol a chyb),
  jak ji nastavit a jak ji lokálně vyzkoušet. Nic, co web nebo pipeline umí, nesmí v README chybět.
  Uprav je v téže změně jako kód, nikdy „až potom“.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
