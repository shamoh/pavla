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
- Kostra popisu nového díla: `date` = den pořízení fotky z EXIF (`scripts/lib/exif.mjs`, bez závislosti), bez něj dnešek;
  se složkou detailních fotek vyplněné `details:` (`DETAIL_CAPTION_TODO` u každé, jen u nové kostry).
- Veřejný text začínající `DOPLNIT` (nástřel k přepsání) = chyba: u díla od `meta_draft: false` (`validateWorks`),
  u kolekce, roku, úvodu a fotky stránky vždy (`placeholderProblems`); `DOPLNIT` v komentáři jen hlásí „k doplnění“.
- Každé dílo má trvalé 5znakové `id` (začíná písmenem, viz `scripts/lib/works.mjs`). URL: `/tvorba/<rok>/<slug>-<id>/`.
- Web načítá díla přes `src/lib/site.ts#getWorks`; `meta_draft: true` a dílo bez `info.json` se nezobrazí.
- Atributy popisů mají skupiny podle prefixu (`attributeGroup`, `compareKeys` v `scripts/lib/schema.mjs`), v souboru
  v pořadí `meta_*` (jen obsahové repo, řídí zpracování), sdílené bez prefixu (`id` první, pak abecedně; kopírují se 1:1),
  `private_*` (jen obsahové repo; vlastní `private_…` smí přidat kdokoli, bez `NEZNÁMÝ`) / `derived_*` (jen toto repo,
  odvozuje pipeline; v obsahovém repu = chyba; teď `derived_modified` díla = den poslední změny veřejných údajů
  nebo obrázků, `lastmod` v mapě webu). Uvnitř skupiny abecedně. Přejmenovaný atribut (`renamed` ve schématu,
  `draft` → `meta_draft`) = chyba, soubor se nemění, žádná migrace. (`instagram` byl dřív název `meta_instagram`, dnes
  je to odkaz na příspěvek; zapomenuté `instagram: true` ohlásí kontrola odkazu.)
- Veřejná kopie yaml obsahuje jen sdílené atributy (`publicKeys(<schéma>)` = `PUBLIC_WORK_FIELDS` / `PUBLIC_COLLECTION_FIELDS`
  / `PUBLIC_YEAR_FIELDS` / `PUBLIC_HOME_FIELDS` / `PUBLIC_PHOTO_FIELDS`, nikdy ručně),
  bez komentářů. `meta_*`, `private_*` a neznámá pole nesmí nikdy do repa `pavla` (je veřejné).
- Stav prodeje: `isOnSale` = `available` | `reserved` a musí mít `price` (kontrola v pipeline). Jen tato díla
  mají Fler exporty a filtr „na prodej“; `not-for-sale`, `sold` a `gifted` (darováno) nikdy.
  Filtr Stav (`STATUS_FILTERS`): na prodej (`unsold`), ještě mám (`kept`), už nemám (`gone` = `sold` + `gifted`);
  staré `?status=available` = `unsold` (`STATUS_ALIASES`); volba bez děl nebo se všemi díly (= „vše“) se nenabízí
  (`offersOption`), bez žádné filtr zašedne (`facetDisplay`), stejně přepínač „Doporučené“. Štítek stavu na kartě i stránce díla, `not-for-sale` bez štítku; `sold` i `gifted` mají
  společný štítek „V soukromé sbírce“ (`GONE_LABEL`), web je nikdy nerozlišuje.
- Mockupy jen s `mockups: true` v popisu díla (výchozí false), nezávisle na stavu prodeje (`wantsMockups`);
  Fler mockupy jen u díla na prodej, které mockupy má.
- Exporty: Instagram jen u díla s `meta_instagram: true` (výchozí false), nikdy mockupy webu, ve složce díla
  `export/instagram/[<kolekce>/]<slug>/` (kopíruje `tvorba/`, `exportFolder`; složka je v otisku díla): `caption-<paleta>.jpg` (dílo
  na papíru každé palety s popiskem název / technika · rozměr · rok / adresa webu, písma z `fonts/` jako křivky přes
  `opentype.js`), `scene-<scéna>.jpg` (dílo ve scéně ateliéru `mockups/instagram/scenes.yaml`: perspektiva z rohů
  prázdného listu, skutečné měřítko, stoly mimo rekvizity s opačným pootočením podle `id`, stojan na liště na ose;
  jen se `size_cm`), `pano-<n>.jpg` (plynulý karusel: široké dílo přes celou výšku 2–3 snímků 4:5, počet ze `size_cm`
  `panoramaSlides`, jen když je aspoň `panorama.minGain`× větší než na snímku s popiskem), `story.jpg` (příběh 9:16,
  `storyLayout`: volné pruhy `images.instagram.story` a místo na nálepku s odkazem, nic se tam nekreslí), `detail-<jméno>.jpg` a `README.md` (náhled pro GitHub s textem příspěvku s kolekcí a hashtagy česky a anglicky, slovník
  `instagramPost` v `site.config.yaml`, kolekce i jako hashtag, píše se každým během; štítek bez překladu = doporučení
  `hashtagAdvice`); před tím ořez `images.instagram.insetPercent`; `scripts/lib/instagram.mjs`.
  Nevejde-li se dílo do volné části scény: snímek vznikne, souhrn běhu „Ke kontrole“ (`misfits`).
  Každá složka díla (obě platformy) má `README.md` s náhledy (GitHub ho vykreslí), platformy přehled `export/<platforma>/README.md`
  seskupený podle kolekcí (`scripts/lib/export-readme.mjs`; Instagram i s textem příspěvku, Fler s cenou; stav zveřejnění
  podle atributů `instagram` / `fler`).
- `instagram` (nepovinný, sdílený) = odkaz na příspěvek na Instagramu jako `fler` u Fleru (`isInstagramUrl`, jinak chyba):
  stránka díla ukáže „Na Instagramu“ s bublinou „Obraz na Instagramu“ (událost `instagram_click`); oba odkazy jsou `sameAs` v JSON-LD díla. `meta_instagram` (bool) dál jen řídí výrobu fotek; jsou nezávislé.
- Pinterest (`scripts/lib/pinterest.mjs`): každé dílo má `pin.jpg` (2:3, `renderCaption` s `images.pinterest` a `snug`: popisek hned pod dílem,
  XMP) veřejně ve složce stránky díla a `pin` v `info.json`; `meta_pinterest: true` = `pin.feed` (web podle něj pozná dílo pro kanál, `meta_*` se nekopíruje);
  kanál RSS `/pinterest.xml` (`src/pages/pinterest.xml.ts`, guid = `id`, odkazy s UTM `FEED_UTM`) čte Pinterest sám (firemní účet, ověření
  `site.verification.pinterest`). Popis pinu končí klíčovými slovy česky · anglicky
  (`pinKeywords`, vlastní slovník `pinterestKeywords.en` s obyčejnými slovy, chybějící překlad = `pinterestAdvice`). Profil `site.pinterest` v patičce, na Kontaktu a v `sameAs` autorky.
  Stránka díla má řádek „Sdílet“ s ikonami (`shareLinks` v `scripts/lib/share.mjs`: Pinterest s pinem `pinSaveUrl`/`workPinImage`,
  Facebook, WhatsApp; tlačítko odkazu `src/lib/share-button.ts` = sdílení telefonu nebo zkopírování), bez skriptů a cookies služeb, událost GA `share` s `method`. `check:images` ověří obrázky kanálu.
  Fler jen díla na prodej, také ve složce díla `export/fler/[<kolekce>/]<slug>/`: `original.jpg` + `mockup-<scéna>.jpg`,
  vše s vodoznakem. Při přegenerování se složky díla mažou (`clearExports`), plný běh navíc porovná `export/`
  s `expectedExports` a smaže vše navíc (`planFolderPrune`, jen jména z `EXPORT_FILES`, neznámé soubory nechá,
  staré ploché `<rok>/<slug>-<id>…` smaže), i bez přegenerování.
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
  Štítky: víc najednou „a zároveň“ (`state.tag` = pole, `?tag=a&tag=b`, `sortTags`/`toggleTag`), aktivní jsou jen čipy,
  které zobrazená díla zúží a nevyprázdní (`tagChoices`), vybrané vždy, ostatní zašedlé na místě; GA `tag` = spojené čárkou.
  Kolekce je combobox (`src/lib/combobox.ts` nad skrytým `<select>`, který zůstává jediným stavem; kolekce podle abecedy `czechOrder` (i Technika), smazaný text = „vše“ (nápověda, Enter ji vybere), psaní zužuje podle
  `comboMatches`, nikdy do URL). Kolekce má za „vše“ volbu „žádná“ (`NO_COLLECTION` = `?collection=none`, díla bez kolekce; čip v liště z `data-chip`),
  přehled kolekcí končí položkou „Mimo kolekce“ (`NO_COLLECTION_TITLE`, `getUncollected`); slug `none` pipeline odmítne.
  Její text (`description`, prázdný = `UNCOLLECTED_TEXT`) a úvodní obraz: `tvorba/_index.yaml` + `tvorba/_cover.jpg` obsahového repa (`UNCOLLECTED_SCHEMA`, `scripts/lib/uncollected.mjs`,
  výstup `public/tvorba/_cover/`, kopie `content/tvorba/_index.yaml`, bez og), stejné pravidlo jako kolekce.
  Řádek filtrů na počítači (od 1280 px) vždy na jeden řádek: výběry s `max-width` a zkrácením „…“, přepínač „Doporučené“
  (= výběr autorky), „Na stránku“ pod díly; nový filtr = ověřit nejhorší případ (všechny volby, nejdelší texty, 9999 děl) a
  případně limity `TECHNIQUE_CHARS` / `COLLECTION_TITLE_CHARS` v `scripts/lib/advice.mjs` (doporučení v souhrnu).
  Výběry (Technika, Rok, Kolekce, Stav) a přepínač Výběr autorky stejně: počty s ostatními filtry, jen volby,
  které zúží a nevyprázdní (`facetChoices`), vybraná vždy, bez žádné filtr zašedne (nikdy se neskryje, `facetDisplay`, ukáže společnou hodnotu); nový filtr = do `FACETS`.
  Lišta filtrů (`scripts/lib/filter-bar.mjs`): po posunu nahoru tenký řádek s vybranými filtry jako čipy s „×“
  (`withoutFilter`) + „Upravit“ = týž formulář jako panel (nikdy kopie); nový filtr = i do `activeFilters`.
  Prvky tvořené skriptem stylovat přes `:global(…)` (scoped CSS Astra na ně nedosáhne).
- `featured: true` = výběr autorky: filtr „Výběr autorky“ (`?featured=1`) a kandidáti úvodních obrazů
  (`coverCandidates`, `FEATURED_PICK` = 10 nejnovějších vybraných): úvodní obraz bez vlastní fotky a `cover`
  (`Cover.astro`, vede na zobrazené dílo); stránka ukáže náhodného skriptem `scripts/lib/random-pick.mjs`
  (vložený, bez přeblikávání), `og:image` je vždy první kandidát. Web pipeline (`coverSource`) musí vybírat stejně.
- Text o roce: `roky/<rok>.yaml` obsahového repa (`YEAR_SCHEMA`, `scripts/lib/years.mjs`), kostru pipeline založí
  ke každému roku s díly; veřejná kopie `content/roky/<rok>.yaml` (`description`, `cover`, `aspect`, `focus`), web `getYear`.
- Úvodní stránka: `_index.yaml` v kořeni obsahového repa (`HOME_SCHEMA`, `scripts/lib/home.mjs`; text `description`,
  `cover`, `aspect`, `focus`), kostra s výchozím textem `HOME_TEXT` (= text úvodu ve skutečném obsahu); veřejná kopie `content/_index.yaml`, web `getHome`.
- Hledání (`?q=`, `scripts/lib/search.mjs`, `SearchField.astro`), vždy na každém výpisu: každá galerie v názvech a popisech
  děl (`searchText` předem v `data-search` karty), přehled kolekcí v názvech a popisech kolekcí; každé slovo podřetězcem, bez
  diakritiky a velikosti písmen, nikdy regexp. Přehled kolekcí: pořadí `sortCollections` (nejnovější dílo první), stav
  `{ year, q, page, perPage }` v adrese (`overviewStateFromParams`), stránkování jako galerie, paměť počtu zvlášť
  (`pavla.collections.perPage`). Řádek stránek pro každý výpis: `Pager.astro` + `src/lib/pager.ts`.
- Každý výpis děl se stránkuje, v prohlížeči nad vyfiltrovaným seznamem (`paginate`); návštěvník volí počet
  na stránku (`gallery.pageSizes`, `?perPage=`, pamatuje se v `localStorage`, ale odkaz s `perPage`/`page` má vždy
  přednost) a může stránkování jednorázově vypnout („Zobrazit vše“, `?page=all`, nepamatuje se).
- **Atributy popisů (dílo, kolekce, fotka) jsou jen v `scripts/lib/schema.mjs`**: pořadí, výchozí hodnota kostry,
  `missing` (hodnota pro doplnění do existujícího souboru, musí znamenat totéž co chybějící atribut) a technický
  komentář (česky, typ, hodnoty, příklady). Pipeline z něj staví kostry a při každém běhu srovná všechny popisy
  (`scripts/lib/metadata-yaml.mjs`): doplní chybějící atributy s `DOPLNIT`, srovná pořadí a technické komentáře,
  neznámé označí `NEZNÁMÝ`. Povinný atribut s konečnou výchozí hodnotou (`settled: true`: `meta_draft`, `tags`, `meta_instagram`, `meta_pinterest`,
  `mockups`, `featured`) nikdy nemá `DOPLNIT`. Nepovinný atribut (`commented: true` + `example`: `support`, `details`,
  `caption`, `private_note`, `price`, `fler`, `instagram`, `cover`, `aspect`, `focus`) je v souboru zakomentovaný (`# price: 2500`) pod technickým komentářem s `NEPOVINNÉ.`, bez
  `DOPLNIT`; prázdná hodnota = zakomentovat. Nový atribut = záznam ve schématu (prefix určí skupinu), README obou rep
  a testovací data; změna znění komentáře = staré znění do `previous`. Atribut s pevnými možnostmi (výčet, `true`/`false`):
  komentář „<co>, možnosti:“ a pod ním každá možnost na řádku `- <hodnota> - <význam>` (obyčejná pomlčka `-`, nikdy `–`); povolené hodnoty v `options`
  pole (test hlídá shodu s komentářem), jiná hodnota = chyba (`optionProblems`), i u rozpracovaného díla. `DOPLNIT` nikdy neodstraňovat za lidi.
- Testovacích děl (`pavla/demo-content/`) musí být vždy víc, než je nejmenší počet na stránku (aspoň 15 při 12).
- Autorství v obrázcích: webové obrázky díla (originál, detaily, mockupy ve všech formátech a `og.jpg`) nesou XMP
  (autorka, název, © rok, kredit, odkaz na stránku díla; `scripts/lib/image-rights.mjs`, v otisku díla), JSON-LD obrázku
  díla je `ImageObject` se stejným `creditText` a `copyrightNotice`; nikdy licence. Jiné fotky webu XMP nedostanou.
- Náhledy pro sdílení (`og:image` + rozměry): dílo = `og.jpg` celý obraz na papíře (nikdy neořezávat),
  úvodní obraz kolekce/roku/úvodu = ořez vybraného (`aspect`/`focus`), vlastní fotka nebo detail celé na papíře, jinak `og.jpg`
  díla (`coverShareSource`); helpery `*ShareImage` v `src/lib/site.ts`.
- Mockupy: scény v `mockups/scenes.yaml` (kalibrace px/cm), výběr a vykreslení `scripts/lib/mockups.mjs`.
- Ořez podlahy: `meta_corners` díla (`photo` + rohy `tl`/`tr`/`br`/`bl` v px dovnitř, `false` = neořezávat) najde
  pipeline u každého díla s fotkou bez atributu (i zveřejněného, i `--prepare-only`; `scripts/lib/corners.mjs`,
  detekce a maska `scripts/lib/edges.mjs`), ruční hodnotu nikdy nepřepíše, jiný rozměr fotky = chyba. Vně rohů
  průhledné s prolnutím (`images.edges`) a obrázek oříznutý na nejmenší obdélník s celým listem (`trimTransparent`;
  mockup přepočítá rohy i `pavla:sheet` o posun `offset`): web AVIF/WebP průhledné (`transparent` v `info.json`, třída `cutout`:
  bez `--ph`, stín jen `filter: var(--drop-…)`, nikdy `box-shadow`), JPEG na papíře první palety, og/Instagram na
  svém pozadí, Fler bílá, mockup jen vnitřní obdélník (průnik s `pavla:sheet`). Náhledy ořezu draftů (všechny tři, `writePreviews`, stejně jako `npm run preview`) do
  `.previews/` (mimo git), workflow obsahového repa i `dry-run.yml` je nahrají jako artefakt `nahledy-orezu`.
  `npm run preview -- <fotka|složka>` (`scripts/preview.mjs`): tentýž náhled (`<slug>-<id>-backgrounds.jpg`, i u pipeline) +
  `<slug>-<id>-frames.jpg` (celá neoříznutá fotka v plné velikosti, rámečky čar podíl šířky / výšky od každého kraje z `images.edges.guides`,
  u každé čáry jen vzdálenost od kraje v px fotky jako `meta_corners`, popisky po schodech) + `<slug>-<id>-cut.jpg`
  (fotka v plné velikosti bez šrafování, tenké čáry rohů, insetu, konce prolnutí, plné neprůhlednosti a oříznutého obrázku, `CUT_COLOURS`;
  na každé straně u každé čáry popisek s čísly panelu, rozložené podél strany, nad čarami; u rohů jejich hodnoty; uprostřed panel: schéma,
  rozměry, odstraněno celkem / z rohů / z inset a prolnutí, nastavení, použité `meta_corners`; žádné SVG `<pattern>`, na velké fotce trvá sekundy) pro libovolné fotky, obsah jen čte,
  chybějící rohy najde a vypíše jako yaml; `--write` je zapíše jen do popisů zadaných fotek bez `meta_corners`.
  Náhled i výpis ukazují ořez rohů v % fotky (náhled po řádcích „zleva 2,5 % = 93 px“ / „shora …“, i px z `meta_corners`), nad `images.edges.suspicious` (5 %) červeně (jen ten řádek) / `!`, na konci výpisu souhrn podezřelých fotek;
  `--only-suspicious` = jen podezřelé (ne s `--write`). Souhrn běhu („Nalezené rohy listu“) značí podezřelé `⚠`. Originální fotky obsahového repa pipeline nikdy nemění.
- Ostatní fotky: `fotky/<název>.jpg` obsahového repa → `public/fotky/<název>/` (obrázky), popis (`alt`, `caption`,
  `focus`) → `content/fotky/<název>.yaml`; na stránce `<Photo name="…" />`;
  `aspect` ořízne na poměr stran kolem `focus: [x, y]` (%) z yaml fotky. O mně: `o-mne-uvod` (2:1) a `portret`.
- Automatika: workflow obsahového repa spouští tuto pipeline a otevírá PR do tohoto repa (větev `obsah/aktualizace`,
  auto-merge po projití „Kontroly kódu“, větev se po sloučení maže);
  na jeho ostatních větvích jen `--prepare-only`. Souhrn běhu: `scripts/lib/summary.mjs` (nahoře chyby po souborech, pak „Ke kontrole“, pak „Doporučení“ z `scripts/lib/advice.mjs`
  včetně štítků `tagAdvice` (jen co jde opravit: dva tvary, vždy spolu, čipy přes 2 řádky), pak co automatika udělala, nakonec statistika štítků `tagStats`). Pull request připravuje
  `scripts/pull-request.mjs` (`scripts/lib/pull-request.mjs`, `OUTPUT_PATHS`); text PR nikdy nejmenuje obsahové repo.
  „Zkušební běh zpracování“ (`.github/workflows/dry-run.yml`, každou neděli na testovacích datech, nic nepushne)
  prochází tytéž kroky: změna kroků zpracování obsahu = stejná změna ve `dry-run.yml`.
  Týdenní kontrola (token, selhané běhy, zkušební běh, nasazení, čekající PR, neznámé atributy, chybějící obrázky
  nasazeného webu `scripts/lib/site-check.mjs`, texty a JSON-LD jeho stránek `evaluatePageTexts`; hlášky `pageProblems`
  jsou kódy s anglickým i českým textem `problemText`):
  `scripts/check-health.mjs` + `scripts/lib/health.mjs`, spouští ji obsahové repo.
  Workflow kontroluje `actionlint` (job `workflows` v `check.yml`); po každé úpravě workflow ho spusť i lokálně.
- Deploy workflow tohoto repa obrázky negeneruje, jen staví web z toho, co je commitnuté. Při selhání buildu nebo
  nasazení job `notify` založí (nebo komentuje) issue „Nasazení webu selhalo“ přidělené vlastníkovi (e-mail), další
  úspěšné nasazení ho zavře; issue je veřejné, jen odkaz na běh a commit. Stejně „Kontrola kódu“ při pushi do `main`
  a u PR z `obsah/aktualizace` (jiné PR ne); obojí přes `.github/failure-issue.sh`.
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
  Vlastní události (`EVENTS`: `gallery_filter`, `fler_click`, `instagram_click`, `share`, `email_click`, `message_sent`); nový parametr události = zapsat do README
  (tabulka událostí + seznam vlastních dimenzí k registraci v GA).
- Zprávy od návštěvníků: Web3Forms (`messages.accessKey` v `site.config.yaml`, jedna adresa, předmět `[pavla-web] <typ>: …`),
  formulář na Kontaktu a panel „Napište mi“ na ostatních stránkách (`scripts/lib/messages.mjs`, `message-draft.mjs`,
  `src/lib/message-form.ts`, `MessageForm.astro`, `MessagePanel.astro`). Testovací data = vždy náhled, nic neodesílá.
- Bublina nad obrazem díla (atribut `title`, karty galerie a úvodní obrazy s dílem, ne stránka díla ani vlastní fotka):
  `workTooltip` (`scripts/lib/tooltip.mjs`) přes `workTitle` v `src/lib/site.ts`, všude stejná (název, technika · rozměr · rok,
  podklad, stav prodeje, zkrácený popis).
- Patička nese verzi buildu `vRR.MMDD.HHMM` (pražský čas) s bublinou (datum, commit): `scripts/lib/build-version.mjs`.
- „Kontrola kódu“ (`.github/workflows/check.yml`): u PR a pushe do `main` jen `npm test` + `npm run build`
  + `npm run check:images` (obrázky, úplnost mapy webu `unlistedPages`, unikátní titulky a popisy a platné JSON-LD
  `pageProblems`; rychlé). Stejný název nebo popis dvou děl řeší web sám (`workPageTitle`, `workPageDescription`).
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
  Česky jsou i hlášky pipeline, které se dostanou do souhrnu běhu (chyby kontrol `problems`, `missing`, souhrn
  `scripts/lib/summary.mjs`): srozumitelně pro Pavlu, bez technické angličtiny, ve tvaru `<soubor>: <co a jak opravit>`.
  Anglicky je kód (názvy, komentáře, výpis do konzole). Tohle záměrně přebíjí globální pravidla „README anglicky“
  a „řetězce v kódu anglicky“.
- Texty na webu jsou česky, s diakritikou, ve 1. osobě autorky.
- Minimalistický design: papírové tóny, serif nadpisy (Cormorant Garamond), Work Sans text. Obraz má vždy přednost před UI.
- Barvy jen z palet (`scripts/lib/palettes.mjs`, Papír / Pergamen / Noc, volba v patičce): v CSS vždy proměnné
  (`var(--paper)`, `var(--shadow-deep)`…), nikdy barva natvrdo; i prvky formulářů (zaškrtávátko v `Base.astro`
  `appearance: none` z palety, nativní jen ve `forced-colors`); nová paleta = záznam v `PALETTES` (test hlídá kontrast);
  každé `var(--…)` musí být definované (paleta nebo `--název:` / `setProperty`), hlídá `css-vars.test.mjs`.
- Vodoznak pro Fler: text `images.fler.watermark` (jméno a místo), nikdy URL ani @handle (pravidla Fleru); světlé písmo webu se stínem (`scripts/lib/watermark.mjs`,
  `WATERMARK_LOOK` je v otisku díla na prodej).
- Mockupy musí držet reálné měřítko podle `size_cm`.
- Před commitem: `npm test`, `npm run build` a `npm run demo:build` musí projít; `npm run check:images` (a pro testovací
  web `SITE_DATA_DIR=.demo/site npm run check:images`) ověří, že žádný obrázek, na který stránky odkazují, nechybí.
- Mapa webu `/sitemap.xml` (`scripts/lib/sitemap.mjs`): nová stránka v `src/pages` bez dat za sebou = do `STATIC_PAGES`
  (jinak `check:images` selže; stránka, která do mapy nepatří, musí mít `noindex`).
- Řádky roků (nad galerií, na přehledu kolekcí) vždy na jeden řádek přes `fitYearRow` (`src/lib/year-row.ts`), roky
  značené `data-year-item`; čipy štítků česky abecedně.
- README obou rep (toto technicky, obsahové repo pro Pavlu a pro jeho automatiku) musí **vždy obsahovat kompletní popis všech
  vlastností**: celou strukturu, každou schopnost webu i pipeline (včetně voleb, parametrů v URL, kontrol a chyb),
  jak ji nastavit a jak ji lokálně vyzkoušet. Nic, co web nebo pipeline umí, nesmí v README chybět.
  Uprav je v téže změně jako kód, nikdy „až potom“.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
