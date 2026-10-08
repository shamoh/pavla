# Pavla Kramolišová · akvarely

Osobní web s tvorbou (Astro, statický, GitHub Pages) a obrázková pipeline,
která z jedné fotky každého díla připraví výstupy pro web, Instagram a Fler.

Obsah (originály fotek a popisy děl) žije v odděleném soukromém **obsahovém repu**;
cestu k jeho kopii zná pipeline z proměnné `CONTENT_DIR` (lokálně v souboru `.env`, mimo git,
např. `CONTENT_DIR=../obsah`). Tohle repo je **veřejné**: obsahuje kód webu a to, co z obsahu
vygeneruje pipeline. Soukromé věci (originály, soukromé poznámky, ani název obsahového repa) sem
nikdy nejdou.

```
<obsahové repo>/                            (soukromé, zdroj obsahu)
  tvorba/<slug>.yaml + <slug>.jpg           dílo bez kolekce: popis (vč. id a soukromé poznámky) a master fotka
  tvorba/<slug>/*.jpg                       detailní fotky díla (nepovinné, složka jménem díla vedle něj)
  tvorba/_index.yaml                        díla mimo kolekce: text a úvodní obraz položky „Mimo kolekce“ (kostru založí pipeline)
  tvorba/_cover.jpg                         vlastní úvodní fotka „Mimo kolekce“ (nepovinné)
  tvorba/<kolekce>/                         kolekce: každá jiná složka v tvorba/, např. 2026-plener-sumava/
  tvorba/<kolekce>/_index.yaml              popis kolekce
  tvorba/<kolekce>/_cover.jpg               úvodní fotka kolekce (nepovinné)
  tvorba/<kolekce>/<slug>.yaml + .jpg       díla kolekce (a jejich detaily v <slug>/)
  fotky/<název>.jpg + <název>.yaml          ostatní fotky webu (O mně, Kontakt)
  roky/<rok>.yaml                           text autorky o roce a úvodní obraz roku (kostru založí pipeline)
  roky/<rok>.jpg                            vlastní úvodní fotka roku (nepovinné)
  _index.yaml                               úvodní stránka: text a úvodní obraz (kostru založí pipeline)
  _cover.jpg                                vlastní úvodní fotka úvodní stránky (nepovinné)
  export/instagram/<rok>/…                  pro Instagram: originál a detaily, jen díla s meta_instagram: true (generuje pipeline)
  export/fler/<rok>/…                       pro Fler: originál a mockupy s vodoznakem, jen díla na prodej

Systémové soubory obsahu mají všude stejná dvě jména: `_index.yaml` popisuje místo, kde leží (v kořeni úvodní
stránku, ve složce kolekce kolekci, přímo v `tvorba/` díla mimo kolekce), `_cover.<jpg|jpeg|png|webp>` je jeho vlastní úvodní fotka. Podtržítko je odliší
od děl (jméno díla jím začínat nemůže). Složky (`tvorba/`, `roky/`, `fotky/`) a jména děl zůstávají česky.
Stará jména (`_kolekce.yaml`, `_uvod.jpg`, `uvod.yaml`, `uvod.jpg`) pipeline odmítne chybou „tento soubor se teď
jmenuje …, přejmenuj ho“ a vedle nich nezaloží kostru, takže se nic neztratí; soubory se přejmenují ručně.

pavla/                                      (toto repo, veřejné)
  demo-content/                             testovací data: vymyšlené obsahové repo (stejná struktura jako
                                            skutečné, yaml + recept na obrázky), viz Testovací data
  .demo/                                    připravená testovací data a web z nich (npm run demo, mimo git)
  .previews/                                náhledy ořezu (npm run images: drafty, npm run preview: cokoli; mimo git), viz Ořez podlahy
  content/                                  veřejné kopie popisů = zrcadlo obsahového repa (generuje pipeline, needitovat):
    _index.yaml                             úvodní stránka
    tvorba/<slug>.yaml                      dílo bez kolekce
    tvorba/_index.yaml                      díla mimo kolekce (description, cover, aspect, focus)
    tvorba/<kolekce>/_index.yaml            kolekce (složka = její slug)
    tvorba/<kolekce>/<slug>.yaml            dílo kolekce (kolekce = složka, žádný atribut)
    roky/<rok>.yaml                         rok
    fotky/<název>.yaml                      ostatní fotka (alt, caption, focus)
  public/                                   vygenerované obrázky leží ve složce své stránky (= adresa, generuje pipeline,
                                            scripts/lib/site-images.mjs); statické soubory webu (favicon.svg, favicon.ico, apple-touch-icon.png, CNAME) vedle:
    tvorba/<rok>/<slug>-<id>/               dílo: webové velikosti, detaily, mockupy, og.jpg + info.json
    tvorba/<rok>/_cover/, tvorba/<rok>/og.jpg      rok: vlastní úvodní fotka, obrázek pro sdílení vybraného obalu
    tvorba/kolekce/<slug>/_cover/, …/og.jpg totéž pro kolekci
    _cover/, og.jpg                         totéž pro úvodní stránku
    tvorba/_cover/                          vlastní úvodní fotka „Mimo kolekce“ (bez og.jpg, nemá vlastní stránku)
    fotky/<název>/                          ostatní fotky (O mně, Kontakt), jen obrázky + info.json
  mockups/                                  scény pro mockupy a jejich kalibrace (scenes.yaml)
  scripts/process-images.mjs                pipeline (npm run images)
  scripts/lib/                              logika pipeline a filtrů, každý modul má *.test.mjs
  scripts/lib/schema.mjs                    atributy popisů (díla, kolekce, fotky): pořadí, výchozí hodnoty, komentáře
  src/                                      web (Astro stránky a komponenty)
  site.config.yaml                          jméno, kontakty, doména, nastavení pipeline
```

## Adresy na webu

| Adresa | Co ukazuje |
|---|---|
| `/tvorba/` | všechna díla s filtry (viz níže) |
| `/tvorba/2026/` | díla z jednoho roku (filtry bez roku) |
| `/tvorba/kolekce/` | přehled kolekcí (úvodní fotka, název, počet děl, popis), filtr podle roku (`?year=2025`) |
| `/tvorba/kolekce/plener-sumava-2026/` | kolekce: název, popis, úvodní fotka a její díla s filtry |
| `/tvorba/2026/rano-u-rybnika-k3f9a/` | detail díla |
| `/tvorba/k3f9a/` | trvalý krátký odkaz, přesměruje na detail |
| `/o-mne/`, `/kontakt/` | stránky s fotkami z `fotky/` obsahového repa |
| `/sitemap.xml` | mapa webu: kanonická adresa každé stránky (bez krátkých odkazů a 404) |

**ID díla** (např. `k3f9a`) vygeneruje pipeline při prvním zpracování a zapíše
ho do yaml. Už se nemění: díky němu fungují staré odkazy i po přejmenování díla
(neznámá adresa končící na `-<id>/` přesměruje na aktuální detail). Může sloužit
i jako katalogové číslo na zadní straně obrazu. ID má 5 znaků, začíná písmenem
a neobsahuje snadno zaměnitelné znaky (`0 o 1 l i`).

**Mapa webu** (`/sitemap.xml`, `src/pages/sitemap.xml.ts`, seznam adres `scripts/lib/sitemap.mjs`): úvod, statické
stránky (`STATIC_PAGES`), roky, kolekce a díla, s adresou `site.url`. Pro vyhledávače i pro kontrolu obrázků
(viz níže), která od ní začíná. Nová stránka v `src/pages` bez dat za sebou = přidat do `STATIC_PAGES`.
Každá adresa má `<lastmod>`: dílo den, kdy se naposledy změnily jeho veřejné údaje nebo obrázky
(`derived_modified` ve veřejné kopii `content/tvorba/…`, zapisuje pipeline, `MODIFIED` v `scripts/lib/site-content.mjs`;
změna `meta_…` nebo `private_…` se nepočítá, beze změny datum zůstává), rok, kolekce, Tvorba, Kolekce a úvod den
nejnovější změny svých děl (`sitemapEntries`); O mně a Kontakt bez data (není známé). Vyzkoušení: změň popis díla
v obsahovém repu, `npm run images`, v `content/tvorba/…` se změní `derived_modified`, po `npm run build` i `lastmod`
v `dist/sitemap.xml`.

**Kontrola obrázků postaveného webu** (`npm run check:images` po `npm run build`, `scripts/check-images.mjs`):
stejná kontrola jako týdenní u nasazeného webu, jen čte soubory z `dist/` (`distFetch`, jako GitHub Pages:
`/a/` i `/a` = `/a/index.html`). Začne od úvodní stránky a od všech stránek z mapy webu, projde jejich odkazy,
z `src`, `srcset`, `href` a `og:image` posbírá obrázky a ověří, že existují. Chybějící vypíše se stránkou, která
na ně odkazuje, a skončí kódem 1. Navíc ověří, že každá postavená stránka bez `noindex` je v mapě webu
(`unlistedPages`, `isNoindex` v `scripts/lib/sitemap.mjs`): stránka zapomenutá v `STATIC_PAGES` skončí kódem 1.
A u každé stránky bez `noindex` texty a strukturovaná data (`pageProblems` v `scripts/lib/page-check.mjs`):
titulek i popis (`<meta name="description">`) má a žádná jiná stránka nemá stejný, popis má nejvýš 160 znaků
(`DESCRIPTION_MAX`), JSON-LD je platný JSON s `@context` schema.org a každý uzel (v `@graph`) má `@type`. Problémy
vypíše po stránkách a skončí kódem 1.
Běží i v „Kontrole kódu“ po stavbě webu (pull request s chybějícím obrázkem, stránkou mimo mapu nebo vadnými
texty se nesloučí). Texty a strukturovaná data nasazeného webu kontroluje stejně i týdenní kontrola (níže).
Testovací web: `SITE_DATA_DIR=.demo/site npm run check:images` po
`npm run demo:build`; jiná složka: `npm run check:images -- <složka>`.

### Filtry v galerii

Všechny filtry jdou kombinovat (platí všechny najednou) a **každá změna se hned
zapíše do URL**. Adresu jde zkopírovat a poslat, u příjemce ukáže stejný výběr.
Tohle je závazné pravidlo: každý nový filtr musí mít parametr v URL.

| Filtr | Parametr v URL | Hodnoty |
|---|---|---|
| Téma (čipy s počty, lze vybrat víc, viz níže) | `tag` | každý vybraný zvlášť, např. `?tag=krajina&tag=voda` (dílo musí mít všechny); jeden `?tag=krajina` jako dřív |
| Technika (s počty) | `technique` | např. `?technique=akvarel` |
| Rok (jen na `/tvorba/` a u kolekce; u kolekce jen roky jejích děl s počty, bez roku se všemi díly, když nic nezbude, bez výběru) | `year` | `?year=2025` (nenabízený rok = vše) |
| Kolekce (jen na `/tvorba/` a stránce roku; za „vše“ volba „žádná“ = díla bez kolekce, jen když nějaká jsou) | `collection` | slug kolekce, `?collection=plener-sumava-2026`; `none` = žádná (`NO_COLLECTION`, v liště čip „bez kolekce“) |
| Stav (s počty) | `status` | `unsold` = na prodej, `kept` = ještě mám, `gone` = už nemám |
| Doporučené = výběr autorky (přepínač s počtem a bublinou „Výběr autorky: …“, jen když výpis nějaké má, ale ne všechna) | `featured` | `1` = jen díla s `featured: true`, jiná hodnota se ignoruje |
| Stránka (viz *Stránkování*) | `page` | číslo stránky od 2, `all` = vše bez stránkování |
| Na stránku (viz *Stránkování*) | `perPage` | `24` nebo `48` (výchozí 12 se nepíše) |

**Návrat do výpisu** (`scripts/lib/page-return.mjs`, v prohlížeči `src/lib/page-return.ts`): každý výpis
(galerie `/tvorba/`, stránka roku, stránka kolekce, přehled kolekcí) si pro tuto záložku pamatuje svůj stav
v adrese (filtry, stránka, počet na stránku) v `sessionStorage` (`RETURN_STORAGE_KEY` = `pavla.return`, JSON cesta →
parametry, nejvýš `RETURN_MAX_PATHS` cest). Přepíše ho při každém načtení a změně, výpis bez filtrů ho zapomene.
Odkazy zpět označené `data-return` (`Base.astro` je doplní při načtení stránky) pak vedou na výpis tak, jak ho
návštěvník opustil, i přes další stránky: na stránce díla **„← Tvorba“**, rok a kolekce, na stránce kolekce
**„← Kolekce“**, na přehledu kolekcí **„← Tvorba“**. Odkaz, který už parametry má, se nemění. Když je úložiště
zablokované, vezmou se parametry z adresy předchozí stránky, pokud to byl tentýž výpis; jinak (i bez JavaScriptu)
vede odkaz na výpis bez filtrů.
- Paměť platí jen v sekci Tvorba (`RETURN_SCOPE` = `/tvorba/`, `insideScope`): každá stránka mimo ni (úvod,
  O mně, Kontakt, 404) ji celou smaže, takže se odkaz zpět nevrátí k filtrům z dřívějšího, nesouvisejícího prohlížení.
- Hlavní menu paměť nemá: „Tvorba“ v hlavičce vždy otevře galerii bez filtrů (a tím paměť galerie smaže).
- Odkaz zpět označený `data-return-focus` si při kliku zapamatuje, odkud návštěvník jde (`RETURN_FOCUS_KEY` =
  `pavla.return.focus`): ze stránky díla jeho `id` („← Tvorba“, rok, kolekce), ze stránky kolekce její slug
  („← Kolekce“). Výpis se po návratu posune na kartu díla, resp. kolekce na přehledu, a krátce ji orámuje
  (`revealReturned`, třída `.returned` v `Base.astro`, barva `--accent`, bez animace při `prefers-reduced-motion`);
  jen když je karta zobrazená (na zobrazené stránce, u přehledu ve vybraném roce). Použije se jednou.
- Vyzkoušet: `npm run demo`, v `/tvorba/` vybrat štítek a stranu 2, otevřít dílo, „← Tvorba“ vrátí stejný výběr
  a posune se na kartu díla; z kolekce „← Kolekce“ na kartu kolekce na přehledu; přes „Úvod“ a zpět na dílo vede „← Tvorba“ na galerii bez filtrů.

Když je vybraná kolekce, vedle výběru se objeví odkaz **„O kolekci ›“** na její
stránku.

**Roky na jeden řádek** (`scripts/lib/year-row.mjs`, v prohlížeči `src/lib/year-row.ts`, `fitYearRow`): řádek roků
nad galerií (odkazy na stránky roků) i čipy roků na přehledu kolekcí zůstanou na jednom řádku, od nejnovějšího roku.
Co se nevejde, schová se za ovládací prvek s rozsahem skrytých let („2017–2003 ▾“, jeden rok „2003 ▾“,
`hiddenYearsLabel`), který je na místě rozbalí (řádek se zalomí) a „▴ méně“ zase sbalí (bez rámečku, šipka v barvě odkazů, aby se nepletl s rokem; třída `open`). Šipka je v obou
stavech tentýž znak „▾“ se stejným písmem a velikostí, pro „méně“ jen otočený o 180° (CSS `transform`), takže
jsou obě pixelově stejné. Kolik se vejde, se měří
v prohlížeči a přepočítá při změně šířky (`visibleCount`). Vybraný rok mezi skrytými (stránka staršího roku,
`?year=2003` na přehledu) rozbalí řádek sám (`pickedIsHidden`). V HTML jsou vždy všechny roky, bez JavaScriptu se
řádek jen zalomí.

Odkaz **Kolekce** v řádku s roky vede na přehled `/tvorba/kolekce/`, na stránce roku
rovnou na přehled vyfiltrovaný na ten rok (`/tvorba/kolekce/?year=2026`), pokud ho přehled nabízí (`overviewLink`).

Filtr **Stav** má čtyři volby (`STATUS_FILTERS` v `scripts/lib/gallery-filter.mjs`):
- **vše**,
- **na prodej** (`unsold`): díla, která se prodávají a ještě nejsou prodaná, `available` + `reserved`,
- **ještě mám** (`kept`): vše kromě prodaných a darovaných, `available` + `reserved` + `not-for-sale`,
- **už nemám** (`gone`): `sold` + `gifted` (`GONE_STATUSES`).

Volba, za kterou na dané stránce není žádné dílo nebo která ukáže totéž co „vše“ (všechna díla), se nenabízí
(`offersOption`, `statusOptions`); bez žádné volby není filtr Stav vůbec. Totéž platí pro přepínač „Doporučené“ (výběr autorky): jen
na stránce, kde jsou vybraná díla, ale ne všechna. Odkaz s takovou volbou ukáže vše. Dřívější volba `?status=available` (jen k prodeji) se přečte jako `unsold`
(`STATUS_ALIASES`), sdílené odkazy dál fungují. Příklad kombinace:
`/tvorba/?collection=plener-sumava-2026&status=unsold&tag=voda`, nebo jen výběr autorky
na prodej: `/tvorba/?featured=1&status=unsold`.

**Řádek filtrů** (výběry, „Doporučené“ a počet děl) je ve formuláři první, čipy štítků pod ním. Na počítači (okno od 1280 px) se vejde vždy na jeden řádek (ověřeno i v nejhorším případě: všechny filtry, nejdelší texty a 9999 děl): výběry mají pevnou největší šířku
(`max-width` 11em, Kolekce 13em) a delší volbu zavřené zkrátí „…“ (rozbalené ukážou vše celé), přepínač výběru
autorky se jmenuje krátce „Doporučené“ (plný název v bublině) a „Na stránku“ je pod díly. Pipeline doporučí kratší
název kolekce (nad 19 znaků) a techniku (nad 14 znaků), viz *Souhrn běhu*. Na telefonu se řádek zalamuje.

**Lišta filtrů** (`scripts/lib/filter-bar.mjs`, `WorkGallery.astro`): když formulář filtrů odjede z obrazovky, posun
stránky nahoru o `REVEAL_AFTER` (40 px) od posledního obratu vysune shora tenkou lištu s vybranými filtry jako
čipy („#krajina ×“, „akvarel ×“; `activeFilters`, bez filtrů „Všechna díla“), počtem děl (`worksCount`) a tlačítkem
**Upravit**; posun dolů o `HIDE_AFTER`
(8 px) ji schová (`scrollBar`). Dokud je formulář na obrazovce, lišta se neukáže; posun, který udělá stránka sama
(stránkování, skok na výsledky), ji nevysune. „Upravit“ otevře týž formulář jako panel (na počítači pod lištou,
do 700 px šířky zespodu přes „Napište mi“); místo formuláře na stránce drží jeho výšku. Každá změna filtru
v otevřeném panelu skočí na začátek výsledků pod lištou, panel zůstane otevřený pro další změny. Zavře ho „Hotovo“,
„Zavřít“ v liště, Esc nebo klik mimo; fokus z klávesnice se vrátí na „Upravit“, nebo do formuláře, když je zase vidět.
Klik na čip v liště ten jeden filtr zruší (`withoutFilter`, zpět na 1. stránku, událost `gallery_filter`), skočí
na začátek výsledků a lišta zůstane; fokus přejde na další čip, po posledním na „Upravit“. Čipy jsou na jednom řádku,
co se nevejde, jde posunout do strany (lišta nikdy nezvětší). Formulář se počítá jako vidět jen pod lištou.
Skrytá lišta je `inert`, při `prefers-reduced-motion` bez animace, bez JavaScriptu se neukáže nikdy. Vyzkoušet:
`npm run demo`, v `/tvorba/` sjet dolů, kousek nahoru, „Upravit“, vybrat štítek, pak ho v liště zrušit „×“.

**Počty a nabízené volby podle aktuálního výběru** (`facetChoices`, `facetValues`): po každé změně filtru má každá
volba výběrů Technika, Rok, Kolekce a Stav i přepínač „Doporučené“ počet děl, která by ukázala spolu s ostatními
aktivními filtry (sama sebe nepočítá, takže počty u jiných voleb téhož výběru říkají, co dá přepnutí; volby Stavu se
překrývají, každá se počítá zvlášť). Ve výběru zůstanou jen volby, které zobrazená díla zúží a nevyprázdní
(`offersOption` nad díly, která nechají ostatní filtry); vybraná zůstane vždy. Skryté volby se z výběru odeberou
(skrývání `<option>` Safari na iOS nerespektuje). Výběr ani přepínač bez žádné takové volby se skryje, dokud ji jiná
změna nevrátí. Bez JavaScriptu jsou počty ze všech děl stránky. Na co se při sestavení stránky volba nenabízí vůbec
(viz níže u Stavu), to se nevrátí ani po změně.

**Výběr více štítků („a zároveň“):** čip štítku se klikem zapne a dalším klikem vypne, „Vše“ zruší celý výběr.
Každý další vybraný štítek výběr zúží: zůstanou díla, která mají všechny vybrané (`matchesFilters`). Po každé změně
(i jiného filtru) zůstanou jen čipy, které zobrazená díla zúží a nevyprázdní (`tagChoices`, `offersOption`), s počtem
mezi zobrazenými díly; vybrané čipy zůstanou vždy (bez počtu). Bez žádného nabízeného čipu se řada čipů skryje. Pořadí
čipů se nemění: česky abecedně (`localeCompare('cs')`, „ch“ za „h“), takže známý štítek jde rychle najít a nové dílo čipy nepřehází. V adrese jsou vybrané štítky v českém abecedním pořadí bez opakování
(`sortTags`, `toggleTag`), takže stejný výběr má vždy stejný odkaz; štítek, který na stránce žádné dílo nemá
(starý odkaz), se ignoruje. Bez JavaScriptu čipy nic nedělají a ukáže se vše.

Logika filtrů je v `scripts/lib/gallery-filter.mjs` (sdílí ji prohlížeč i testy),
stav prodeje v `scripts/lib/works.mjs#isOnSale`.

### Úvodní obraz (kolekce, rok, úvodní stránka) a výběr autorky

Kolekce, stránka roku i úvodní stránka mají **úvodní obraz** podle jednoho pravidla (pipeline
`scripts/lib/covers.mjs`, web `resolveCover` v `src/lib/site.ts`, komponenta `src/components/Cover.astro`):

1. **vlastní fotka:** `_cover.jpg` ve složce kolekce, `roky/<rok>.jpg`, `_cover.jpg` v kořeni obsahového repa;
   bez odkazu,
2. **`cover: <id>`:** zveřejněné dílo (u kolekce z kolekce, u roku z toho roku, u úvodu z celé tvorby), vede na ně,
3. **`cover: <id>#<detail>`:** jedna z detailních fotek toho díla, vede na dílo,
4. jinak **náhodně** jeden z 10 nejnovějších obrazů **výběru autorky** (`featured: true`; `coverCandidates`,
   `FEATURED_PICK` v `scripts/lib/works.mjs`), jinak nejnovější dílo; vede na zobrazené dílo.

Každý úvodní obraz se ukáže **celý, tak jak je**, dokud u **vybraného** obrazu (vlastní fotka nebo `cover`) není
vyplněné `aspect` nebo `focus`. Pak se ořízne na poměr stran `aspect` (`šířka:výška` v uvozovkách, např. `"3:2"`,
`"2:1"`, `"1:1"`; prázdné = `"1:1"`) kolem bodu `focus` (`[zleva %, shora %]`; prázdné = `[50, 50]`, střed) a stejný
výřez je i obrázkem pro sdílení (`coverCrop`, `parseAspect`, `DEFAULT_ASPECT`, `DEFAULT_FOCUS` v
`scripts/lib/covers.mjs`). Náhodný obraz se nikdy neořezává, `aspect` nebo `focus` bez vybraného obrazu je chyba.

| Úvodní obraz | Na stránce | Obrázek pro sdílení |
|---|---|---|
| vlastní fotka bez ořezu | celá | celá na papíře 3:2 (`public/tvorba/kolekce/<slug>/og.jpg`, `public/tvorba/<rok>/og.jpg`, `public/og.jpg`) |
| `cover: <id>` bez ořezu | celé dílo | `og.jpg` díla |
| `cover: <id>#<detail>` bez ořezu | celý detail | celý detail na papíře 3:2 (tentýž soubor jako u vlastní fotky) |
| vlastní fotka nebo `cover` + `aspect` a/nebo `focus` | ořez na `aspect` kolem `focus` | stejný ořez (tentýž soubor): při `"3:2"` (poměr náhledu) vyplní celý náhled, jiný poměr leží na papíře |
| nic (náhodně / nejnovější) | celé dílo | `og.jpg` prvního (nejnovějšího) kandidáta |

Chyby, které zastaví běh: vlastní fotka a `cover` zároveň, `aspect` nebo `focus` bez vybraného obrazu (náhodný),
dílo z jiného místa, rozpracované dílo, neexistující detail, neplatný `aspect` nebo `focus`. `aspect` i `focus` jsou
v kostrách prázdné. V přehledu kolekcí obal nikam
nevede (celá položka vede na kolekci).

Díla s `featured: true` jsou zároveň filtrovatelná přepínačem „Doporučené“ (`?featured=1`). Na úvodní stránce
„Nejnovější“ neopakuje dílo z úvodního obrazu (vždy 6 děl).

Náhodný obraz: stránka obsahuje všechny kandidáty, první viditelný a ostatní `hidden` s líně načítanými obrázky
(skryté se nestahují). Hned za nimi je malý vložený skript (`applyRandomPick` ze `scripts/lib/random-pick.mjs`),
který ještě před vykreslením ukáže náhodného, takže nic nepřeblikne. Bez JavaScriptu zůstane první. Karusel
(střídání během návštěvy) záměrně není: obrazy mají různé poměry stran a rám by „dýchal“.

Vyzkoušení (`npm run demo`): `/` a `/tvorba/2026/` náhodně (obnovuj stránku), `/tvorba/2025/` vlastní fotka
(panorama z receptu `roky/2025.jpg`, jen `focus: [20, 50]` = čtverec 1:1), kolekce: Plenér Šumava vlastní fotka (celá), Město `cover: <id>` bez
ořezu (celé dílo), Ze zahrady `cover: <id>#<detail>` s `aspect: "2:1"` a `focus` (široký ořez), Kresby náhodně
(celé, klik vede na dílo). Konkrétní obraz na úvodní stránce: do `demo-content/_index.yaml` napiš `cover: pf7ru`, s
`aspect: "3:2"` se ořízne kolem středu.

### Text o roce

Nepovinný text autorky o roce (jaký byl, co se v tvorbě dělo) je v obsahovém repu v `roky/<rok>.yaml`
(`YEAR_SCHEMA` v `scripts/lib/schema.mjs`, pipeline `scripts/lib/years.mjs`):

```yaml
description: |
  Rok plenérů: Šumava v září, zahrada v létě…
# cover: k3f9a      # NEPOVINNÉ: úvodní obraz roku, viz Úvodní obraz (nebo vlastní fotka roky/2026.jpg)
# aspect: "3:2"     # NEPOVINNÉ, zapíná se smazáním "# ": ořez vybraného obrazu (jen s focus = "1:1")
# focus: [50, 50]   # NEPOVINNÉ: co zůstane vidět [zleva %, shora %] (jen s aspect = střed)
# private_note: …   # NEPOVINNÉ, soukromé, na web se nedostane
```

- Pipeline ke každému roku, ve kterém je nějaké dílo, sama založí kostru (s prázdným `description`
  a `DOPLNIT`) a všechny popisy roků srovnává podle schématu jako ostatní popisy.
- Veřejná kopie (`description`, `cover`, `aspect`, `focus`) jde do `content/roky/<rok>.yaml`; web ji načte přes
  `getYear` (`src/lib/site.ts`). Prázdný text se nezobrazí. Text je i popisem stránky pro vyhledávače.
- Jiný soubor v `roky/` než `<rok>.yaml` a `<rok>.jpg`, fotka roku bez díla, nebo `description`, které není
  text, zastaví běh chybou.

### Úvodní stránka (`_index.yaml`)

Text vedle velkého obrazu na úvodní stránce a její úvodní obraz jsou v kořeni obsahového repa v `_index.yaml`
(`HOME_SCHEMA`, pipeline `scripts/lib/home.mjs`): `description`, `cover`, `aspect`, `focus` a `private_note`, vlastní fotka
`_cover.jpg`. Když soubor chybí, pipeline založí kostru s výchozím textem úvodu (`HOME_TEXT`, stejný jako ve skutečném obsahu), takže se
nic nezmění. Veřejná kopie je `content/_index.yaml` (web `getHome`); bez ní web ukáže výchozí text `HOME_TEXT`. Nadpis
„Barvy, voda a trochu náhody“ je dál v `src/pages/index.astro`. Vyzkoušení: `demo-content/_index.yaml`, `/`.
- Vyzkoušení: `npm run demo`, `/tvorba/2026/` (text z `demo-content/roky/2026.yaml`) a `/tvorba/2025/` (bez textu).

### Stránkování

Každý výpis děl (`/tvorba/`, stránky roků, stránky kolekcí) se stránkuje. Pod
výpisem jsou čísla stránek, šipky „← Předchozí / Další →“ a mezery „…“ u dlouhých
seznamů.

- **Počet děl na stránku** si návštěvník vybere ve výběru „Na stránku“ pod
  díly, vpravo na řádku se stránkami (na telefonu pod nimi; jen když se zobrazená díla nevejdou
  na nejmenší stránku): 12, 24 nebo 48 (`gallery.pageSizes` v `site.config.yaml`, první je
  výchozí). Výběr je v URL jako `perPage` (jen když není výchozí, např.
  `?perPage=24`), změna vrátí na 1. stránku a zapne stránkování, i když bylo
  vypnuté. Jiná hodnota v URL se ignoruje. Výběr se ukáže, jen když má výpis
  víc děl, než je nejmenší počet (na stránce roku s 6 díly ho neuvidíš).
- **Zapamatování počtu:** zvolený počet si prohlížeč pamatuje i pro další
  návštěvy a pro ostatní výpisy (`localStorage`, klíč `pavla.gallery.perPage`).
  Volba výchozího počtu paměť smaže. Pravidla, aby odkazy dál ukazovaly všem
  totéž:
  - odkaz s `perPage` nebo `page` v URL má vždy přednost (odkaz `?page=2` od
    někoho s 12 na stránku ukáže i tomu, kdo si pamatuje 24, stejná díla),
  - zapamatovaný počet se hned zapíše do URL (`?perPage=24`), takže
    zkopírovaná adresa odpovídá tomu, co je vidět,
  - „Zobrazit vše“ se nepamatuje, zůstává jednorázové,
  - v anonymním okně nebo při zablokovaném úložišti se nic nepamatuje a vše
    ostatní funguje.

- Stránkuje se **vyfiltrovaný** seznam: filtry a stránky fungují dohromady,
  změna filtru vrátí na 1. stránku.
- Stránka je v URL jako `page` (jen od 2. stránky), např.
  `/tvorba/?tag=krajina&page=2`, takže odkaz jde poslat dál. Neplatná nebo
  příliš velká stránka se opraví na nejbližší existující.
- **Vypnutí stránkování:** pod čísly stránek je odkaz „Zobrazit vše (N)“,
  který ukáže všechna vyfiltrovaná díla najednou (`?page=all`, jde poslat jako
  odkaz). Je to jednorázové: nic se neukládá, další návštěva zase stránkuje.
  Při změně filtrů zůstane zobrazeno vše; „Zobrazit po stránkách“ vrátí 1. stránku.
  Když se vše vejde na jednu stránku, žádné ovládání se neukazuje.
- Stránkuje se v prohlížeči: HTML obsahuje všechna díla, karty mimo aktuální
  stránku jsou skryté a **nestahují obrázky** (obrázky jsou `loading="lazy"`
  a skryté se nenačítají). Bez JavaScriptu jsou vidět všechna díla. HTML
  poroste zhruba o 1,5 kB na dílo, při stovkách děl je to v pořádku.
- Logika: `paginate`, `pageLinks`, `pageAfterFilterChange`, `pageSizeOf` a
  `withPageSize`, `rememberedPageSize` a `pageSizeToRemember` v
  `scripts/lib/gallery-filter.mjs`, vykreslení v `src/components/WorkGallery.astro`.

### Bublina nad obrazem

Po najetí myší na obraz, který vede na stránku díla (karty galerie, úvodní obraz úvodní stránky, roku i kolekce,
i náhodně vybraný), ukáže prohlížeč bublinu se základními údaji o díle. Je všude stejná, po řádcích:

```
Jez na Otavě                       (u úvodního detailu: „Jez na Otavě, detail: <popisek detailu>“)
akvarel · 41 × 30 cm · 2025
papír Canson XL Aquarelle (300 g)  (support, jen když je vyplněný)
K prodeji                          (jen K prodeji / Rezervováno / V soukromé sbírce)

Popis díla, zkrácený na 240 znaků po celém slově.
```

Chybějící údaje se vynechají. Vlastní úvodní fotka (`_cover.jpg`, `roky/<rok>.jpg`) bublinu nemá, stránka díla
samotná taky ne (údaje jsou vedle obrazu). Je to obyčejný atribut `title` obrázku: bez JavaScriptu, na dotykových
zařízeních se neukazuje. Text skládá `workTooltip` (`scripts/lib/tooltip.mjs`, `workTitle` v `src/lib/site.ts`),
vykreslení `src/components/Picture.astro` (`tooltip`), `Img.astro` (`title`) a `Cover.astro`.
Vyzkoušení: `npm run demo`, najet myší na kartu v `/tvorba/` nebo na úvodní obraz.

## Testovací data (demo)

Web a pipeline se ladí na **testovacích datech**, která jsou úplně oddělená od
skutečné tvorby. Skutečný web se staví vždy jen ze skutečných dat, i když jsou
zatím prázdná.

| | Skutečná data | Testovací data |
|---|---|---|
| zdroj | obsahové repo (soukromé) | `pavla/demo-content/` (toto repo), stejná struktura jako obsahové repo |
| obrázky | fotky v gitu obsahového repa | negenerují se do gitu: `demo-content/images.yaml` je recept, obrázky vzniknou vždy stejně při `npm run demo` |
| zpracování | `npm run images` → `content/`, `public/` tohoto repa, exporty do `export/` obsahového repa | `npm run demo` → `.demo/content/` (obsah), `.demo/site/` (data webu), vše mimo git |
| web | `npm run dev` / `npm run build` / GitHub Pages | `npm run demo` (dev server), `npm run demo:build` (`.demo/site/dist`) |
| označení | nic, testovací data jsou zakázaná | celá sada: soubor `demo-content.yaml` v kořeni; každé dílo a kolekce: jméno `demo-…` |

**Pojistky proti míchání** (`scripts/lib/demo.mjs`, `dataset` v `run()`):

- `npm run images` (skutečná data) skončí chybou, když obsah má značku testovacích dat
  (`demo-content.yaml` v kořeni) nebo když najde dílo či kolekci se jménem `demo-…`,
  a nic nezapíše. Totéž platí pro automatiku na GitHubu.
- `npm run demo` (a `npm run images -- --demo`) naopak odmítne obsah bez značky
  `demo-content.yaml` a dílo či kolekci bez jména `demo-…`. Celou sadu tak nejde
  spustit omylem jako skutečnou a obráceně, a každé dílo či kolekce zkopírované
  z testovacích dat do skutečných se pozná podle jména.
- Fotky, roky a úvodní stránka mají pevná jména (`portret`, `2026`, `_index`), jednotlivě
  je nic neoznačuje; testovací se pozná jen celá sada podle značky. Atribut `demo` už
  neexistuje: zapomenutý `demo: true` pipeline označí jako `NEZNÁMÝ`.
- Pravidlo pro Claude Code v CLAUDE.md: testovací data se tvoří jen v `pavla/demo-content/`,
  nikdy v obsahovém repu.

**Jak `npm run demo` funguje** (`scripts/demo.mjs`): zkopíruje yaml z `demo-content/`
(včetně značky `demo-content.yaml`) do `.demo/content/`, vykreslí obrázky podle receptu (`scripts/lib/demo-images.mjs`:
abstraktní skvrny z pevného seedu, detailní fotky jako výřezy), přidá statické
soubory webu (favicon; ne `CNAME`) a spustí **stejnou pipeline** jako pro skutečná
data, jen s výstupem do `.demo/site/`. Web pak běží s `SITE_DATA_DIR=.demo/site`
(`src/lib/site.ts` a `astro.config.mjs` čtou data odtud). Kódy (`id`) a kostry,
které pipeline doplní, se zapíšou zpět do `demo-content/`, aby zůstaly stálé. První
příprava trvá kolem 1,5 minuty, další jen přegenerují změny.

**Nové testovací dílo:** yaml do `demo-content/tvorba/demo-<slug>.yaml` nebo do složky testovací
kolekce `demo-content/tvorba/demo-<kolekce>/`
a řádek do `demo-content/images.yaml` (`size`, `palette`, `seed`; detailní fotka jako
`from` + `crop`; list vyfocený nakřivo na podlaze s `floor: { angle, margin }`). Pak `npm run demo`, pipeline doplní `id`.

## Přidání nového díla

1. Do `tvorba/` obsahového repa (nebo do složky kolekce, např. `tvorba/2026-plener-sumava/`)
   ulož master fotku, ideálně pod krátkým
   názvem bez diakritiky (`rano-u-rybnika.jpg`). Jiný název nevadí:
   `Ráno u rybníka.jpg` se spáruje s `rano-u-rybnika.yaml`.
2. `npm run images` (v tomto repu):
   - k fotce bez popisu vytvoří kostru `rano-u-rybnika.yaml` s `meta_draft: true` a `date` = den pořízení
     fotky z EXIF (`DateTimeOriginal`, pak `DateTimeDigitized`, pak `DateTime`; `scripts/lib/exif.mjs`),
     bez data v EXIF dnešek; je-li vedle fotky složka detailních fotek, vyplní `details:` s popiskem
     `DOPLNIT popisek detailu` u každé z nich (`DETAIL_CAPTION_TODO`, komentář označený `DOPLNIT`),
   - každému popisu bez `id` ho přidělí,
   - každý popis (dílo, kolekce, fotka) srovná podle schématu (viz *Udržování popisů*),
   - k nové složce kolekce založí kostru `_index.yaml`,
   - zkontroluje popisy (viz *Kontroly* níže); při chybě nic nezapíše na web,
   - vygeneruje web i exporty (jen pro nová či změněná díla); rozpracované dílo (`meta_draft: true`) neopustí
     obsahové repo: nevznikne mu kopie popisu, obrázky webu ani exporty,
   - smaže vygenerované soubory děl, kolekcí a fotek, které z obsahového repa zmizely, se přejmenovaly nebo
     se vrátily do rozpracovaných (`meta_draft: true`), včetně jejich exportů v `export/instagram` a `export/fler`.
3. Doplň yaml v obsahovém repu (hodnoty s `DOPLNIT`) a přepni `meta_draft: true` na `false`, jinak se dílo na
   webu nezobrazí. Pak znovu `npm run images`.
4. Zkontroluj lokálně (viz *Lokální vyzkoušení*).
5. Commit a push v obou repech: obsahové repo (fotka, yaml, exporty)
   a `pavla` (`content/` a `public/`). Web se po pushi do `main` nasadí sám.
6. `export/instagram` a `export/fler` nahraj ručně na Instagram a Fler (viz *Exporty*).

Užitečné varianty: `npm run images -- --force` (přegeneruje vše),
`npm run images -- rano-u-rybnika` (jen jedno dílo, kolekce nebo fotka daného
jména, nic nemaže), jiná cesta k obsahu jednorázově: `CONTENT_DIR=~/cesta/k/obsahu npm run images` (má přednost před `.env`).

### Popis díla (yaml)

**Skupiny atributů podle prefixu** (`attributeGroup` a `compareKeys` v `scripts/lib/schema.mjs`) platí pro všechny popisy
(dílo, kolekce, rok, úvod, fotka). V souboru jdou v tomto pořadí, uvnitř skupiny abecedně, jen `id` je vždy první
ze sdílených:

| Skupina | Kde platí | Do veřejné kopie (`content/`) |
|---|---|---|
| `meta_<název>` | jen obsahové repo: řídí zpracování (`meta_draft`, `meta_instagram`) | nikdy |
| bez prefixu (sdílené) | obě repa, stejný význam | 1:1 (`publicKeys`) |
| `private_<název>` | jen obsahové repo; vlastní `private_…` může autorka přidat kdykoli (bez `NEZNÁMÝ`, abecedně u ostatních `private_`) | nikdy |
| `derived_<název>` | jen toto repo: odvodí pipeline (z jiných atributů, umístění souboru nebo průběhu zpracování); teď `derived_modified` u díla (viz *Mapa webu*) | v obsahovém repu = chyba |

Seznam veřejných atributů se neudržuje ručně: jsou to sdílené atributy schématu (`PUBLIC_WORK_FIELDS` atd. =
`publicKeys(<schéma>)`). Přejmenovaný atribut (`renamed` ve schématu, teď `draft` → `meta_draft`, `instagram` →
`meta_instagram`) pipeline nepřevádí: soubor se starým jménem ohlásí chybou „přejmenováno na …, přejmenuj ho“, nic v něm
nezmění a nic nezveřejní.

Atributy díla v pořadí, v jakém je pipeline v souboru drží (úplné znění komentářů, výchozí hodnoty:
`WORK_SCHEMA` v `scripts/lib/schema.mjs`):

| Atribut | Význam |
|---|---|
| `meta_corners` | rohy listu na fotce, podlaha vně nich bude průhledná; najde je pipeline, smí se upravit, `false` = neořezávat (viz *Ořez podlahy*) |
| `meta_draft` | `true` = rozpracované: do tohoto repa se nedostane nic (popis, obrázky), ani exporty; do veřejné kopie se nekopíruje |
| `meta_instagram` | `true` = exporty pro Instagram (výchozí `false`) |
| `id` | trvalý kód, doplní pipeline, NEMĚNIT |
| `date` | den vzniku (`2026-06-14`): určuje řazení i rok díla (stránky roků, adresa, složky v `pavla`) |
| `description` | veřejný popis na webu |
| `details` | popisky detailních fotek (viz *Detailní fotky*) |
| `featured` | `true` = ve **výběru autorky**: přepínač „Doporučené“ v galerii; z 10 nejnovějších vybraných (`FEATURED_PICK`) se náhodně střídá obraz nahoře na úvodní stránce, na stránce roku a úvod kolekce bez `cover`; nejnovější z nich je náhled pro sdílení (úvod, rok, kolekce) |
| `fler` | odkaz na Fler, tlačítko „Koupit na Fleru“ |
| `mockups` | `true` = mockupy, nezávisle na prodeji (výchozí `false`) |
| `price` | Kč, povinná u `available` a `reserved` |
| `size_cm` | `[šířka, výška]` v cm (desetinné číslo s tečkou, např. `[29.5, 40]`); drží měřítko mockupu na stěně. Na webu a v popisech pro vyhledávače s desetinnou čárkou („29,5 × 40 cm“, `formatSizeCm`), ve strukturovaných datech jako číslo |
| `status` | `available` \| `reserved` \| `sold` \| `gifted` \| `not-for-sale` |
| `support` | podklad, nepovinné |
| `tags` | štítky (filtr v galerii) |
| `technique` | technika (filtr v galerii); komentář nabízí nejčastější: akvarel, brush pen, tisk z výšky, kresba tužkou |
| `title` | název |
| `private_note` | SOUKROMÉ: zůstane jen v obsahovém repu |

Ukázka (výřez):

```yaml
# Popis obrazu – kostru vytvořila pipeline podle fotky.

# Trvalý kód obrazu: podle něj web pozná obraz i po přejmenování (krátká adresa /tvorba/<id>/).
# Generuje ho pipeline, NIKDY neměnit. Hodí se napsat tužkou na zadní stranu obrazu.
id: k3f9a

# změřeno i s okrajem papíru
# DOPLNIT Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu:
# podle rozměrů se dělají mockupy ve skutečné velikosti.
size_cm: [40, 30]
```

**Stavy:**

| `status` | Na webu | Export Fler | Mockupy | Export Instagram |
|---|---|---|---|---|
| `available` | K prodeji, cena a tlačítka | originál + mockupy (má-li je) | jen s `mockups: true` | jen s `meta_instagram: true` |
| `reserved` | Rezervováno | originál + mockupy (má-li je) | jen s `mockups: true` | jen s `meta_instagram: true` |
| `sold` | V soukromé sbírce, bez ceny | nic | jen s `mockups: true` | jen s `meta_instagram: true` |
| `gifted` | V soukromé sbírce (stejně jako `sold`, web je nerozlišuje), bez ceny | nic | jen s `mockups: true` | jen s `meta_instagram: true` |
| `not-for-sale` (výchozí) | bez stavu (žádný štítek ani cena) | nic | jen s `mockups: true` | jen s `meta_instagram: true` |

**Instagram na vyžádání:** fotky pro Instagram (originál a detaily) vzniknou jen
u díla s `meta_instagram: true`. Výchozí je `false` (kostra ho tak zapisuje). Přepnutí
dílo přegeneruje, vypnutí jeho exporty pro Instagram smaže. Jiná hodnota než
`true`/`false` je chyba. Pole zůstává jen v obsahovém repu, na web se nekopíruje.

Obrazy na prodej jsou `available` a `reserved`: jen ty mají Fler exporty a jen ty
ukazuje filtr „na prodej“. **Musí mít cenu** (`price`, kladné číslo v Kč), jinak pipeline skončí chybou.
Mockupy na stavu nezávisí (viz *Mockupy*). Štítek stavu (K prodeji, Rezervováno, V soukromé sbírce = `sold` i `gifted`, `GONE_LABEL`) je na kartě
v galerii, na stránce díla i v bublině nad obrazem; `not-for-sale` štítek nemá.

### Udržování popisů (schéma, DOPLNIT, NEZNÁMÝ)

Jediný zdroj pravdy o atributech popisů je `scripts/lib/schema.mjs` (`WORK_SCHEMA`, `COLLECTION_SCHEMA`,
`PHOTO_SCHEMA`): pořadí, výchozí hodnota nové kostry, hodnota pro doplnění do existujícího souboru
(`missing`, znamená totéž co chybějící atribut, takže se na webu nic nezmění: chybějící `meta_draft` = `false`,
`description` = prázdné…) a **technický komentář** (typ, povolené hodnoty, příklady; atribut s pevnými
možnostmi, tj. `status` a přepínače `true`/`false`, má komentář „…, možnosti:“ a pod ním každou možnost
na řádku `- <hodnota> - <význam>` (obyčejná pomlčka `-`, nikdy `–`)). Výčty `WORK_FIELDS`,
`COLLECTION_FIELDS` a `PHOTO_FIELDS` se z něj odvozují. Logika je v `scripts/lib/metadata-yaml.mjs`.

- **Nová kostra** (nová fotka obrazu, složka kolekce, fotka stránky): všechny atributy s výchozími hodnotami,
  u každého kromě `id` komentář začínající `DOPLNIT`.
- **Každý běh pipeline** (na `main`, ve větvi s `--prepare-only` i lokálně) srovná **všechny existující**
  popisy děl, kolekcí i fotek:
  - chybějící atribut doplní (hodnota `missing`) a jeho komentář označí `DOPLNIT`,
  - atributy seřadí podle schématu, mezi nimi prázdný řádek,
  - nad každý atribut dá jeho technický komentář v aktuálním znění, ve všech souborech stejný
    (starší znění z `previous` pozná a nahradí),
  - `DOPLNIT` nechá, dokud ho člověk nesmaže (znamená „hodnotu zkontrolovat“), sám ho nikdy neodstraní,
  - vlastní komentář nad atributem nechá, nad technickým,
  - neznámý atribut (např. překlep `mockup:`) nesmaže, dá ho na konec a označí komentářem `NEZNÁMÝ atribut…`;
    na web se nedostane,
  - **atribut s konečnou výchozí hodnotou** (ve schématu `settled: true`: `meta_draft`, `tags`, `meta_instagram`, `mockups`,
    `featured`) nikdy nedostane `DOPLNIT` (ani v kostře, ani při doplnění), starý `DOPLNIT` u něj zmizí; souhrn běhu
    ho hlásí jako „doplněno … (výchozí hodnota)“,
  - **zakomentovaný nepovinný atribut** (ve schématu `commented: true` a ukázková hodnota `example`; teď `support`,
    `details`, `price`, `fler` a `private_note` díla, `cover`, `aspect`, `focus` a `private_note` kolekce, roku
    a úvodu, `caption` fotky): když chybí nebo je prázdný, vloží ho jako řádek
    komentáře `# aspect: "3:2"` pod jeho technický komentář začínající `NEPOVINNÉ.` (`OPTIONAL` v
    `scripts/lib/schema.mjs`), nikdy s `DOPLNIT` a nehlásí ho jako doplněný. Do veřejné kopie se nedostane. Zapne se smazáním `# `; prázdná
    hodnota znamená totéž co chybějící atribut, takže ji příští běh zase zakomentuje. Vlastní komentář nad ním
    zůstane (`stripCommented`, `schemaKeysIn` v `scripts/lib/metadata-yaml.mjs`),
  - komentář na začátku souboru zůstane nahoře, oddělený prázdným řádkem,
  - hodnoty ani jejich zápis (`|`, `[a, b]`, uvozovky) se nemění: po úpravě se to kontroluje a jinak se soubor
    nezapíše a běh skončí chybou.
  Zveřejněná díla (`meta_draft: false`), kterým zůstal `DOPLNIT`, vypíše log (`! published, still marked DOPLNIT: …`)
  a souhrn běhu („Zveřejněné obrazy, kterým zůstal DOPLNIT“); běh tím neselže. Neznámé atributy hlásí týdenní
  kontrola (viz *Automatické zpracování obsahu*).
  Soubor se zapíše, jen když se opravdu změnil; druhý běh nic nemění. Změněné soubory vypíše log
  (`~ metadata brought in line with the schema: …`) a souhrn běhu („Srovnané popisy“); automatika je commitne
  zpět do obsahového repa stejně jako přidělená `id`.
- **Starší soubory** (komentáře na konci řádku): text ze starých šablon (`LEGACY_COMMENTS`) zmizí, jiný komentář
  se přesune nad atribut jako vlastní; komentáře nad prvním atributem se stanou komentářem souboru.
- **Nový atribut** = nový záznam ve schématu (komentář, `value`, případně `missing`); jeho prefix určí, kam patří
  (bez prefixu = veřejný, `meta_`/`private_` = jen obsahové repo). Další běh pipeline ho doplní do všech skutečných
  i testovacích popisů (u testovacích přes `npm run demo`, který změny zapíše zpět do `demo-content/`).
- Vyzkoušení: `npm run demo:prepare`, pak `git diff demo-content/` (nic, když je vše srovnané); ukázka `DOPLNIT`
  a `NEZNÁMÝ` (`mockup:`) je v `demo-content/tvorba/demo-rozpracovane.yaml`. Nebo v kopii popisu smaž řádek
  `featured: …` a spusť `npm run demo:prepare`: vrátí se s `false` a `DOPLNIT`.

**Soukromá poznámka a veřejná kopie:** `content/` v tomto repu je zrcadlo obsahového repa: stejné složky
a jména souborů (`scripts/lib/site-content.mjs`), jen veřejné atributy. Rozpracovaná díla (`meta_draft: true`) se
nekopírují, rok díla web bere z `date` a kolekci ze složky, stejně jako pipeline. Plný běh smaže v `content/`
vše, co nezapsal (smazané, přejmenované a rozpracované položky).
U díla se kopírují jen sdílené atributy (bez prefixu, `PUBLIC_WORK_FIELDS` = `publicKeys(WORK_SCHEMA)`), a to bez
komentářů. Atributy `meta_…` a `private_…`, komentáře v yaml i jakákoli neznámá pole zůstávají
jen v obsahovém repu. Nové veřejné pole stačí přidat do schématu bez prefixu. U kolekcí, roků, úvodu
a fotek platí totéž (`PUBLIC_COLLECTION_FIELDS`, `PUBLIC_YEAR_FIELDS`, `PUBLIC_HOME_FIELDS`, `PUBLIC_PHOTO_FIELDS`).

**Testovací data** jsou úplně oddělená od skutečných (viz *Testovací data (demo)*):
59 děl (58 publikovaných, 1 rozpracované) z let 1998–2026 s mezerami, 16 kolekcí, 31 štítků a 3 zástupné fotky
v `demo-content/`, zobrazené přes `npm run demo`.

| Funkce | Kde ji testovací data ukazují |
|---|---|
| roky | 25 let od 1998 do 2026 s mezerami (chybí 2004, 2008, 2013, 2022): 2026 (9 publikovaných), 2025 (6), 2005, 2011, 2016, 2019 (po 4), 2000, 2023, 2024 (po 3), 2006, 2021 (po 2), ostatní po jednom díle; kostry `demo-content/roky/<rok>.yaml` bez textu (kromě 2025 a 2026) |
| kolekce přes víc let a starší kolekce | Skicák 1998–2003 (4 díla ve 4 letech), Tatry 2000, Portréty 2005, Plenér Krkonoše 2006, Z cest 2009–2012 (Vinice na prodej), Podzim v lese 2011, U moře 2014–2015, Ptáci za oknem 2016, Zátiší 2017–2020, Noční město 2019, Řeky 2021–2023 (2021 a 2023), Louky 2024 |
| roky na jeden řádek | `/tvorba/`: na počítači část let a „<rok>–1998 ▾“, v úzkém okně (DevTools → režim zařízení) méně; klik rozbalí, „▴ méně“ (tatáž šipka otočená) sbalí; `/tvorba/1998/` začne rozbalený; totéž čipy na `/tvorba/kolekce/` (roky kolekcí) |
| stránkování | `/tvorba/` má 58 děl = 5 stránek po 12, 3 po 24, 2 po 48; stránky roků (nejvýš 9 děl) se nestránkují |
| rozpracované dílo (`meta_draft`) | Rozpracovaný obraz: nesmí být nikde na webu |
| `available` (14) | Pivoňky, Zimní sad, Ráno u rybníka, Město v dešti, Náměstí v mlze, Máky, Bouřka nad polem, Na podlaze, Vinice, Lesní cesta, Čáp u rybníka, Oblaka, Sázava, Louka s kopretinami |
| `reserved` (4) | Kočka na okně, Modravské slatě, Rybník v zimě, Kostel za soumraku |
| `sold` (16) | Jablka na stole, Šumava v mlze, Nádraží a 13 starších (např. Štrbské pleso, Buky, Most v noci, Seno) |
| `gifted` (7) | Lípa u kaple, Kočka na plotu, Hruška, Cibule, Smrky pod štítem, Rybář, Podzimní alej |
| `not-for-sale` (17) | Kytice z louky, Kvilda skica, Slunečnice a 14 dalších (např. Babička, Houby, Lampy, Gerlach) |
| techniky | akvarel (35), kresba tužkou (8), akvarel a tuš (6), kvaš (5), pastel (3), linoryt (1, Lípa u kaple) |
| tagy (31, nerovnoměrně) | hodně: krajina (28), voda (15), město (12); středně: léto (9), zátiší (7), květiny (6), podzim, hory, plenér (po 5), ulice, zima, řeka, strom, les (po 4); málo: déšť, zvířata, ovoce, noc, světla, portrét, ptáci (po 3), loď, louka, nebe, sníh (po 2), jaro, kostel, květina, mlha, most, západ slunce (po 1) |
| `featured` (výběr autorky, 15 děl, v 8 ze 16 kolekcí a 3 bez kolekce) | Máky, Ráno u rybníka, Šumava v mlze, Nádraží, Rybník v zimě… (2026 a přelom roku), Pivoňky, Zimní sad, Kočka na okně, Jablka na stole (2025), Louka s kopretinami (2024), Vltava u Zbraslavi, Oblaka, Čáp u rybníka, Buky, Babička: úvodní stránka náhodně střídá 10 nejnovějších (po Louku s kopretinami, `FEATURED_PICK`), `/tvorba/?featured=1` ukáže všech 15; kolekce bez vybraných: Skicák, Tatry, Krkonoše, Z cest, U moře, Zátiší, Noční město, Město 2026 |
| text o roce | `/tvorba/2026/` má text (`demo-content/roky/2026.yaml`), `/tvorba/2025/` ne (`description: ""`) |
| tlačítko „Koupit na Fleru“ | Máky |
| export pro Instagram (`meta_instagram: true`, asi čtvrtina děl) | Ráno u rybníka (+ 2 detaily), Pivoňky (+ 1 detail), Kytice z louky (+ 1 detail, není na prodej), Máky, Na podlaze; ostatní díla žádný |
| `mockups: true`, na prodej | Ráno u rybníka (+ detaily), Zimní sad, Město v dešti, Náměstí v mlze, Kočka na okně, Rybník v zimě, Na podlaze |
| `mockups: true`, ne na prodej | Kytice z louky (+ detail), Slunečnice, Šumava v mlze (prodáno) |
| `mockups: false` | Pivoňky (na prodej, + detail), Bouřka nad polem, Modravské slatě (na prodej), Kvilda skica, Nádraží (prodáno), Máky (na prodej), Lípa u kaple, Jablka na stole (prodáno), Rozpracovaný obraz |
| `DOPLNIT` a neznámý atribut (`NEZNÁMÝ`) | Rozpracovaný obraz (`mockup: true` je schválně překlep) |
| mockupy malého díla (≤ 35 cm) / většího | Kočka na okně / Zimní sad |
| detailní fotky | Ráno u rybníka (2, s popisky), Kytice z louky (1, bez popisku), Pivoňky (1 široký) |
| kolekce: vlastní úvodní fotka (panorama, celá) | Plenér Šumava 2026 |
| kolekce: `cover: <id>#<detail>` + `aspect: "2:1"` + `focus` | Ze zahrady 2025 (detail Pivoněk) |
| kolekce: `cover: <id>` (celé dílo) | Město 2026 (Město v dešti, ne nejnovější Náměstí v mlze) |
| kolekce bez `cover` = náhodně z výběru autorky, celé | Kresby, pastely a kvaš 2025–2026 (všechny 4 obrazy vybrané; náhled pro sdílení Nádraží) |
| rok: vlastní úvodní fotka, jen `focus` (ořez 1:1) | 2025 (`demo-content/roky/2025.yaml`, panorama `roky/2025.jpg`) |
| úvodní stránka: text z `_index.yaml`, náhodný obraz | `demo-content/_index.yaml` |
| kolekce přes víc let a přelom roku | `demo-kresby-2025-2026/`: Kočka na okně, Jablka na stole (2025), Rybník v zimě (prosinec 2025), Nádraží (únor 2026) |
| filtr roku na přehledu kolekcí | `/tvorba/kolekce/`: 2026 (3 kolekce: Město, Plenér Šumava, Kresby), 2025 (2: Ze zahrady, Kresby); Kresby jsou v obou letech: s rokem 2025 „3 z 4 děl“ a odkaz `?year=2025`, ostatní celé v jednom roce bez roku v odkazu; „Kolekce“ na `/tvorba/2025/` vede na `/tvorba/kolekce/?year=2025`; „← Kolekce“ z Kresby otevřených z přehledu s 2025 vede zpět na `?year=2025`, i po prokliku na dílo a zpět na kolekci (viz *Návrat do výpisu*); výběr Rok u kolekcí přes víc let (Kresby: 2025 (3), 2026 (1); dále Skicák, Z cest, U moře, Zátiší, Řeky), ostatní testovací kolekce jsou z jednoho roku |
| díla bez kolekce (12 zveřejněných), volba Kolekce „žádná“ | Zimní sad, Slunečnice, Máky, Bouřka nad polem, Lípa u kaple, Na podlaze, Zahrada po dešti, Kočka na plotu, Osamělý strom, Podzimní alej, Lodky na břehu, Oblaka, Rozpracovaný obraz; `/tvorba/?collection=none` (12 děl, v liště „bez kolekce ×“); s technikou „kresba tužkou“ „žádná“ zmizí (žádná kresba není bez kolekce) |
| ořez podlahy: rohy listu najde pipeline (průhledné okolí na webu, papír v JPEG a na Instagramu, bílá pro Fler, mockupy bez podlahy) | Na podlaze (list vyfocený nakřivo, recept `floor` v `demo-content/images.yaml`) |
| ořez podlahy: rohy zadané ručně | Bouřka nad polem (`meta_corners` v `demo-content/`) |
| ořez podlahy vypnutý (`meta_corners: false`) | Lípa u kaple |
| náhled ořezu rozpracovaného díla | Rozpracovaný obraz (`.demo/site/.previews/`), zveřejněná díla náhled nemají |
| rohy bez podlahy (všechny nuly, nic se neořezává; i obraz s barvou až do kraje) | ostatní díla |
| soukromá poznámka | Ráno u rybníka, Jablka na stole, kolekce Plenér Šumava 2026 |
| vlastní `private_…` atribut (bez `NEZNÁMÝ`, abecedně mezi `private_`, nikdy na web) | Máky (`private_kupec`) |
| `meta_…` atributy na začátku, sdílené (`id` první, abecedně), `private_…` na konci | každý popis v `demo-content/` |
| `derived_modified` ve veřejné kopii, `lastmod` v mapě webu | každé dílo v `.demo/site/content/tvorba/`, `/sitemap.xml` |
| strukturovaná data: druh díla `artform` malba / kresba / grafika, `keywords` ze štítků | Máky (malba), Nádraží (kresba), Lípa u kaple (grafika, linoryt) |
| strukturovaná data: obraz na prodej jen s dostupností (`InStock` / `LimitedAvailability`), bez ceny | Máky (`available`), Kočka na okně (`reserved`) |
| stránka 404 s výběrem autorky | libovolná neexistující adresa, např. `/tvorba/nic/` (v `npm run demo`) nebo `.demo/site/dist/404.html` |
| fotky stránek | zástupné `o-mne-uvod` (s `focus`), `portret` a `kontakt` |
| doporučení v souhrnu běhu: bez štítků, popis s malým písmenem a bez tečky / popisky detailů bez tečky / na prodej bez mockupů / text kolekce bez tečky / popis a popisek fotky bez tečky | Rozpracovaný obraz / Ráno u rybníka, Pivoňky / Máky, Bouřka nad polem, Modravské slatě, Pivoňky / Město 2026 / fotky stránek |
| lišta filtrů při posunu nahoru, panel „Upravit“ (na úzké obrazovce zespodu) | `/tvorba/` (58 děl, stránka je dost dlouhá); úzká obrazovka: DevTools → režim zařízení |
| počty u výběrů podle aktuálního výběru, skryté prázdné volby a filtry | `/tvorba/`: technika „kresba tužkou“ (8 děl, Kolekce jen Kresby…, Skicák (po 2), Plenér Šumava, Portréty, Ptáci, Tatry (po 1), bez „žádná“), + kolekce Kresby, pastely a kvaš (2 díla; přepínač Doporučené zmizí, oba obrazy jsou vybrané); štítek „krajina“: Technika jen akvarel (23), kresba tužkou, kvaš, linoryt |
| výběr více štítků („a zároveň“): čipy se zapínají a vypínají, zůstanou jen ty, které výběr zúží | `/tvorba/`: „krajina“ (28 děl, zbude 17 čipů), + „voda“ (9 děl, zbudou hory, jaro, léto, plenér, ptáci, řeka, zima), + „řeka“ (2 díla, zbudou jaro a léto), „Vše“ zruší |
| doporučení ke štítkům v souhrnu: jeden štítek ve dvou tvarech / dva štítky vždy spolu / čipy přes 2 řádky; statistika štítků | „květiny“ a „květina“ (Pivoňky) / „noc“ a „světla“ (Noční město 2019) / 31 štítků asi na 3 řádky, kandidáti jen u jednoho díla; výpis `npm run demo:prepare` (`? advice: Štítky: …`) |
| filtr bez zbytečných voleb: Stav jen „na prodej“, bez Výběru autorky (všechna díla vybraná) / bez filtru Stav | Ze zahrady 2025 / Kresby, pastely a kvaš 2025–2026 / Město 2026 |
| řádek filtrů na jeden řádek, zkrácená volba, „Na stránku“ pod díly | `/tvorba/?collection=demo-kresby-2025-2026`: „Kresby, pastely a kva…“, rozbalený výběr ukáže celý název; `/tvorba/` dole vpravo „Na stránku“, při filtru s nejvýš 12 díly zmizí |
| doporučení: dlouhý název kolekce | Kresby, pastely a kvaš 2025–2026 (32 znaků); dlouhou techniku testovací data nemají, pokrývají ji testy |
| „Mimo kolekce“ na přehledu kolekcí, `cover` + `aspect`, `description` | `/tvorba/kolekce/` poslední položka (12 děl, úvodní obraz Oblaka oříznutý na 3:2 a vlastní text z `demo-content/tvorba/_index.yaml`) → `/tvorba/?collection=none`; s rokem 2019 „1 z 12 děl“ a odkaz s `&year=2019` |
| bublina nad obrazem: s popisem a stavem / detail jako úvodní obraz / vlastní fotka bez bubliny | Máky v galerii / Ze zahrady 2025 / Plenér Šumava 2026 |

### Kontroly (pipeline při chybě nic nezveřejní)

- `title` nechybí a `date` je den (`2026-06-14`); rok díla se bere z něj,
- dílo nemá pole `collection:` (kolekci určuje složka),
- `id` je platné a unikátní, `size_cm` jsou dvě kladná čísla (u publikovaných děl),
- dílo `available` nebo `reserved` má `price` (kladné číslo),
- atribut s pevnými možnostmi (`options` ve schématu: `status` = `available` | `reserved` | `sold` | `gifted` | `not-for-sale`,
  `meta_draft`, `meta_instagram`, `mockups`, `featured` = `true` | `false`) má jen jednu z nich, i u rozpracovaného díla
  (`optionProblems` v `scripts/lib/schema.mjs`; chybějící = výchozí); jinak chyba „status „availble“ není mezi
  možnostmi: available, reserved, sold, gifted, not-for-sale“,
- `meta_corners` je `false`, nebo `photo` (rozměr fotky, musí sedět s fotkou) a rohy `tl`, `tr`, `br`, `bl` jako dvě celá
  nezáporná čísla, nejvýš čtvrtinu fotky od jejího rohu (viz *Ořez podlahy*),
- `collection` je slug (malá písmena, číslice, pomlčky), kolekce má `title`,
- `cover` kolekce je `id` publikovaného díla této kolekce (případně `#` a jeho existující detail) a kolekce nemá zároveň vlastní úvodní fotku, `aspect` (`šířka:výška`) a `focus` (`[x, y]` 0–100) kolekce, roku i úvodu jsou jen u vybraného obrazu (`cover` nebo vlastní fotka),
- `focus` fotky je `[x, y]` v rozsahu 0–100,
- každý klíč v `details:` odpovídá existující detailní fotce a popisek je text,
- žádný veřejný atribut nemá text začínající `DOPLNIT` (`title`, `description`, štítek v `tags`, popisek v `details`…;
  `todoTexts`), např. nástřel popisku detailu z kostry: u díla jen zveřejňovaného (`meta_draft: false`, `validateWorks`),
  u kolekce, roku, úvodní stránky a fotky stránky vždy (`placeholderProblems` v `scripts/lib/content.mjs`),
- soubory ve složkách mají známý typ, detailní složka patří k existujícímu dílu,
- dva soubory nemíří na stejný slug.

## Detailní fotky díla

Zajímavé výřezy obrazu (detail tahu, textura papíru, konkrétní část) se ukážou
na detailu díla pod popisem a stavem (mockupy jsou až pod nimi) a jdou i na Instagram.

**Kam je dát:** do podsložky vedle master fotky, pojmenované přesně jako dílo:

```
tvorba/2026-plener-sumava/rano-u-rybnika.jpg        master
tvorba/2026-plener-sumava/rano-u-rybnika.yaml       popis
tvorba/2026-plener-sumava/rano-u-rybnika/1-mlha.jpg detail 1
tvorba/2026-plener-sumava/rano-u-rybnika/2-rakos.jpg detail 2
```

- Název složky = název yaml díla (bez `.yaml`). Složka bez díla je chyba.
- Ve složce smí být jen fotky (`jpg`, `jpeg`, `png`, `tif`, `webp`). Soubory
  začínající tečkou nebo `_` se ignorují.
- **Pořadí** určuje název souboru (abecedně), proto číslo na začátku.
- Z názvu souboru vznikne jméno detailu (`1 Mlha.jpg` → `1-mlha`). Dvě fotky se
  stejným jménem jsou chyba.

**Popisky** (nepovinné) jsou v yaml díla pod `details:`, klíč je jméno fotky bez
přípony (`1 Mlha` i `1-mlha` znamenají stejnou fotku):

```yaml
details:
  1-mlha: Mlha nad hladinou, mokré do mokrého
  2-rakos: Rákos na břehu, suchým štětcem
```

Detail bez popisku se na webu jmenuje „detail 1“, „detail 2“ podle pořadí. Když složka s detaily
existuje už při založení kostry popisu, pipeline do ní `details:` rovnou vyplní (u každé fotky
`DOPLNIT popisek detailu`); do existujícího popisu je nedoplňuje.
Popisek je pod náhledem, v prohlížečce a v `alt`. Popisek u fotky, která ve
složce není, je chyba. Změna popisku obrázky nepřegeneruje (je v kopii yaml).

**Co vznikne:** `public/tvorba/<rok>/<slug>-<id>/detail-<jméno>-<šířka>.{avif,webp,jpg}`
(šířky `images.details.widths` v `site.config.yaml`), seznam v `info.json#details`
a export `export/instagram/<rok>/<slug>-<id>-detail-<jméno>.jpg` (celý rámeček
4:5, ořez na střed). Přidání, změna nebo smazání fotky dílo přegeneruje
a staré soubory i exporty smaže.

**Testovací data:** `demo-rano-u-rybnika` (na prodej, 2 detaily s popisky),
`demo-kytice-z-louky` (není na prodej, 1 detail bez popisku) a `demo-pivonky`
(1 široký detail, který je zároveň úvodním obrazem kolekce „Ze zahrady 2025“).

## Exporty (Instagram, Fler)

Pipeline je vyrábí do `export/` obsahového repa při každém přegenerování díla.
Předtím smaže všechny staré exporty daného díla, takže nikdy nezůstane nic
neplatného (např. Fler fotky prodaného obrazu).

Úklid na konci plného běhu navíc porovná `export/` s tím, co by každé dílo mít
mělo (`expectedExports` v `scripts/lib/works.mjs`), bez ohledu na to, jestli
se dílo v tomto běhu přegenerovalo. Smaže:

- exporty děl, která z obsahového repa zmizela nebo se přejmenovala (i přesunutá do jiného roku),
- exporty detailních fotek, které dílo už nemá,
- Fler exporty mockupů scén, které dílo už nemá (podle `info.json`),
- všechny Fler exporty díla, které není na prodej,
- exporty pro Instagram díla, které nemá `meta_instagram: true`,
- mockupy na Instagramu (včetně starých `-wall.jpg`).

Export se pozná podle názvu `<slug>-<id>…jpg`. Soubory, které nevypadají jako export (např.
vlastní poznámky), úklid nechá být. Běh s jedním dílem (`npm run images -- <slug>`)
nic nemaže. Smazané soubory jsou v logu (`- removed export/…`) a v souhrnu běhu
na GitHubu. Logika: `planExportPrune` v `scripts/lib/works.mjs`.

| Platforma | Kdy | Soubory |
|---|---|---|
| Instagram | jen dílo s `meta_instagram: true` | `<slug>-<id>-clean.jpg` (originál na papírovém pozadí, 4:5), `<slug>-<id>-detail-<jméno>.jpg` (každý detail, 4:5). **Nikdy mockupy.** |
| Fler | jen `available` a `reserved` | `<slug>-<id>.jpg` (originál), `<slug>-<id>-mockup-<scéna>.jpg` (každý mockup). Vše s vodoznakem. |

Průhledné okolí díla (podlaha vně rohů listu, viz *Ořez podlahy*) dostane v exportu barvu: pro Instagram
papírové pozadí `images.instagram.background`, pro Fler bílou (`images.fler.background`, výchozí `#ffffff`);
mockupy ukazují jen holý papír.

Vodoznak je jen jméno autorky (`images.fler.watermark`), nikdy odkaz ani @handle
(pravidla Fleru). Barva se řídí jasem rohu obrázku. Velikosti a kvalitu nastavuje
`images.instagram` a `images.fler` v `site.config.yaml`.

## Obrázky pro sdílení (náhled odkazu)

Každá stránka s obrázkem má `og:image` s rozměry (`og:image:width`,
`og:image:height`) a `twitter:card`, aby sociální sítě (Facebook, WhatsApp,
Messenger…) ukázaly velký náhled hned napoprvé. Všechny náhledy jsou
1200 × 800 (3:2, `images.og` v `site.config.yaml`).

| Stránka | Náhled | Soubor |
|---|---|---|
| detail díla | celý obraz na papírovém pozadí, **nikdy oříznutý** | `public/tvorba/<rok>/<slug>-<id>/og.jpg` |
| úvodní stránka | úvodní obraz podle tabulky v *Úvodní obraz* (`_cover.jpg` / `cover` + `focus` v `_index.yaml`); stránka sama ukazuje náhodné z 10, náhled pro sdílení náhodný být nemůže | `public/og.jpg`, jinak `og.jpg` díla |
| stránka roku | totéž pro rok (`roky/<rok>.jpg` / `cover` + `focus`) | `public/tvorba/<rok>/og.jpg`, jinak `og.jpg` díla |
| stránka kolekce | totéž pro kolekci (`_cover.jpg` / `cover` + `focus`) | `public/tvorba/kolekce/<slug>/og.jpg`, jinak `og.jpg` díla |
| přehled kolekcí | náhled první (nejnovější) kolekce | týž soubor |

Obraz se v náhledu díla neořezává, protože jde o umělecké dílo: obraz na výšku
má po stranách papír. Průhledné okolí díla (*Ořez podlahy*) se prolne s papírovým pozadím náhledu. Náhled díla vzniká s webovými obrázky (přegeneruje se se
změnou fotky). Dokud neexistuje, stránka sdílí největší webovou velikost do
1600 px. Kód: `shareImage` v `scripts/process-images.mjs`, `workShareImage`,
`worksShareImage` a `collectionShareImage` v `src/lib/site.ts`, meta v `src/layouts/Base.astro`.

## Kolekce

Kolekce seskupuje díla, např. z jednoho plenéru nebo průřezové téma přes víc let.
**Kolekce je složka v `tvorba/` obsahového repa** a díla do ní patří tím, že v ní
leží (dílo je nejvýš v jedné kolekci). Díla přímo v `tvorba/` jsou bez kolekce.
Složky roků nejsou: rok díla je rok jeho `date`, kolekce může trvat i přes přelom
roku nebo víc let.

```
tvorba/2026-plener-sumava/            ← kolekce, adresa /tvorba/kolekce/2026-plener-sumava/
  _index.yaml                         ← popis kolekce
  _cover.jpg                          ← vlastní úvodní fotka (nepovinné)
  tetrivci-slat.jpg + .yaml           ← díla kolekce
  tetrivci-slat/                      ← detailní fotky díla
tvorba/2025-2026-ovce/                ← kolekce přes víc let
tvorba/zatisi-s-jablky.jpg + .yaml    ← dílo bez kolekce
```

- **Adresa** kolekce je název složky převedený na malá písmena bez diakritiky
  (`2026 Plenér Šumava` → `2026-plener-sumava`). Rok je jen část názvu, pipeline
  ho nijak nevykládá; doporučená je předpona s rokem. Dvě složky se stejnou
  adresou jsou chyba.
- **Složka se stejným jménem jako dílo vedle ní** jsou jeho detailní fotky,
  každá jiná složka v `tvorba/` je kolekce. Kolekce v kolekci nejde (chyba).
  Soubory začínající `_` nejsou díla.
- Veřejná kopie popisu díla leží ve stejné složce kolekce (`content/tvorba/<kolekce>/<slug>.yaml`), web
  pozná kolekci podle ní. V yaml díla pole `collection:` být nesmí (chyba). Stará kořenová
  složka `kolekce/` je chyba (kolekce patří do `tvorba/`).
- Kostru `_index.yaml` založí pipeline pro každou složku bez ní, s titulkem
  z názvu složky a rokem přesunutým na konec (`2026-plener-sumava` → „Plener
  sumava 2026“, `2025-2026 Ovce` → „Ovce 2025–2026“); titulek je potřeba opravit
  (diakritika).

```yaml
# tvorba/2026-plener-sumava/_index.yaml (obsahové repo)
title: Plenér Šumava 2026
description: |
  Týden malování venku na Kvildě a Modravě.
cover: k3f9a#1-kvet # NEPOVINNÉ: úvodní obraz, id díla z kolekce, případně #detailní fotka
aspect: "3:2"       # ořez vybraného obrazu na poměr stran (prázdné s focus = "1:1"); obě prázdné = celý
focus: [50, 40]     # bod [zleva %, shora %], který zůstane vidět (prázdné s aspect = střed)
private_note: kde … # NEPOVINNÉ, soukromé, na web se nedostane
```

- **Úvodní obrázek** kolekce (na její stránce, v přehledu i jako náhled při
  sdílení), v tomto pořadí:
  1. vlastní fotka `_cover.jpg` ve složce kolekce,
  2. `cover: <id>`: celé dílo (musí být v této kolekci a publikované, ne `meta_draft`),
  3. `cover: <id>#<detail>`: jedna z detailních fotek toho díla (jméno jako
     v `details:`, tj. název souboru bez přípony; bez mezer kolem `#`, jinak
     by YAML bral zbytek jako komentář),
  4. jinak obraz z výběru autorky (`featured: true`): stránka náhodně ukáže jeden z 10 nejnovějších vybraných
     v kolekci, celý (bez ořezu), náhled pro sdílení je nejnovější z nich,
  5. jinak nejnovější dílo kolekce (také celé).
  Stejné pravidlo platí pro rok a úvodní stránku (viz *Úvodní obraz*).
  Fotka i `cover` zároveň je chyba (pipeline neví, co platí), stejně jako
  detail, který dílo nemá.
- Úvodní obrázek kolekce se ukáže celý; s `aspect` nebo `focus` se vybraný obraz ořízne, takže obraz na výšku
  ani panorama nerozbije hlavičku (viz *Úvodní obraz*).
- **Obrázek pro sdílení** (`og:image`, náhled odkazu na Facebooku, WhatsAppu
  apod.) je stejný výřez: pipeline ho vyrobí jako
  `public/tvorba/kolekce/<slug>/og.jpg` (1200 × 800, `images.og` v
  `site.config.yaml`) ze stejného zdroje, jaký ukazuje stránka
  (`coverSource` v `scripts/lib/collections.mjs`), a se stejným ořezem
  (`focusCrop` v `scripts/lib/photos.mjs` počítá jako CSS `object-position`).
  Vyrábí se při každém běhu jen pro vlastní fotku, detail a `cover` s ořezem (bez ořezu celé na papíře),
  zapíše se jen při změně. Zmizí se smazanou kolekcí nebo když obal přestane být vybraný; pak stránka sdílí
  `og.jpg` díla. Když ořez nestačí, je
  lepší připravit široký detail a použít `cover: <id>#<detail>`. Komponenta `src/components/Cover.astro`.
- Stránka `/tvorba/kolekce/<slug>/` vznikne jen pro kolekci s aspoň jedním
  publikovaným dílem. Vedou na ni: přehled `/tvorba/kolekce/`, řádek „Kolekce“
  u každého jejího díla a odkaz „O kolekci ›“ v galerii při vybrané kolekci.
- V galerii je výběr „Kolekce“ s počty děl; volba „žádná“ (`?collection=none`) ukáže díla, která v žádné kolekci nejsou.
- Přehled `/tvorba/kolekce/` končí položkou **„Mimo kolekce“** (`NO_COLLECTION_TITLE`, `getUncollected` v `src/lib/site.ts`,
  název kurzívou, protože to kolekce není): díla bez kolekce, vede do galerie `/tvorba/?collection=none`. Úvodní
  obraz podle stejného pravidla jako u kolekce z `tvorba/_index.yaml` obsahového repa (`UNCOLLECTED_SCHEMA`,
  `scripts/lib/uncollected.mjs`; kostru založí pipeline, jakmile v `tvorba/` leží nějaké dílo): vlastní fotka
  `tvorba/_cover.jpg` (→ `public/tvorba/_cover/`), `cover: <id>` jen dílo mimo kolekce (jinak chyba „nepatří do obrazů
  mimo kolekce“), s `aspect`/`focus` oříznutý, jinak náhodně z výběru autorky. Obrázek pro sdílení nemá (žádná vlastní
  stránka); veřejná kopie `content/tvorba/_index.yaml` jen dokud je nějaké zveřejněné dílo mimo kolekci. Text pod
  názvem: nepovinný `description` téhož souboru (v kostře zakomentovaný), prázdný = `UNCOLLECTED_TEXT` („Obrazy, které
  nepatří do žádné kolekce.“); doporučení k velkému písmenu a tečce jako u kolekce, `DOPLNIT` = chyba. Řídí se vybraným rokem jako kolekce („2 z 12 děl“, odkaz s `&year=`), čipy roků
  ale počítají jen kolekce. Bez děl mimo kolekce (nebo bez kolekcí) chybí.
- Složka kolekce, jejíž adresa by byla `none`, je chyba („adresu „none“ web používá pro obrazy bez kolekce“).
- Přehled `/tvorba/kolekce/` jde filtrovat podle roku (čipy „Vše“, „2026 (3)“: rok a počet kolekcí). Kolekce patří ke každému
  roku, ve kterém vzniklo aspoň jedno její dílo (rok z `date`); vybraný rok nechá jen tyto kolekce. U každé pak počet
  jejích děl z toho roku („2 z 5 děl“, `worksLabel`; má-li v tom roce všechna, jen „5 děl“) a odkaz na ni nese rok
  (`/tvorba/kolekce/<slug>/?year=2025`), takže se otevře s galerií vyfiltrovanou na ten rok (`collectionLink`; ne když
  jsou v tom roce všechna její díla). Rok se hned
  zapíše do adresy (`?year=2025`, jiná nebo nenabízená hodnota = vše), odkaz jde poslat dál. Jako u filtrů galerie
  se nenabízí rok, který ukazuje všechny kolekce (= „Vše“); bez takového roku se filtr neukáže vůbec. Bez JavaScriptu
  jsou vidět všechny kolekce. Změna roku posílá událost `gallery_filter` (parametr `year`, `results` = počet kolekcí).
  Logika `scripts/lib/collection-filter.mjs`. Vyzkoušet: `npm run demo`, `/tvorba/kolekce/` (testovací kolekce
  jsou z let 2025 a 2026, jedna z obou).
- Stránka kolekce má nahoře odkaz **„← Kolekce“** na přehled; vede zpět s rokem, který tam návštěvník měl
  vybraný (viz *Návrat do výpisu*).
- Výběr „Rok“ v galerii kolekce nabízí jen roky jejích děl s počty („2025 (3)“, `yearFilterOptions` ve
  `scripts/lib/gallery-filter.mjs`), bez roku se všemi díly; kolekce celá z jednoho roku výběr roku nemá.
- Kód: `scripts/lib/content.mjs` (čtení složek), `scripts/lib/collections.mjs` (popisy kolekcí), `src/lib/site.ts#getCollections`
  a `src/pages/tvorba/kolekce/` (přehled `index.astro`, stránka `[collection].astro`).

## Mockupy

Mockupy (obraz v rámu na zdi) se **zapínají v popisu díla: `mockups: true`**,
nezávisle na tom, jestli se dílo prodává. Výchozí je `false` (kostra ho tak
zapisuje), jiná hodnota než `true`/`false` je chyba.

- Dílo s `mockups: true` dostane na stránce tři mockupy ve skutečném měřítku
  podle `size_cm`. Nadpis sekce se řídí stavem: u díla na prodej „Jak by mohl
  vypadat u vás“, jinak „Jak vypadá na zdi“.
- Fler exporty mockupů vzniknou jen u díla na prodej, které mockupy má. Na
  Instagram mockupy nejdou nikdy.
- Přepnutí `mockups` dílo přegeneruje, `false` jeho mockupy (i ve Fler exportech)
  smaže. Prodej díla (`sold`) mockupy nechá a smaže jen Fler exporty. Změna mezi
  `available` a `reserved` nic nepřegeneruje. Web mockupy bez `mockups: true`
  neukáže, ani kdyby soubory zůstaly.
- Pole jde i do veřejné kopie popisu (web ho čte), kód `wantsMockups` v
  `scripts/lib/works.mjs`.

**Mockup je vždy jen holý papír.** Master srovnaný přes `npm run straighten`
ukazuje kolem listu úzký okraj podkladu, aby byly vidět okraje papíru, a fotka
vyfocená nakřivo kolem listu podlahu. V rámu na zdi by ale okraj nepatřil (pasparta
kryje okraje papíru) a měřítko podle `size_cm` by nesedělo. Pipeline proto
pro mockupy (na webu i pro Fler) master ořízne na největší obdélník uvnitř rohů listu
(`meta_corners`, viz *Ořez podlahy*, `innerRegion` v `scripts/lib/edges.mjs`) a uvnitř listu
z metadat fotky (`pavla:sheet`, viz *Srovnání fotek obrazů*); má-li obojí, na jejich průnik.
Webové obrázky díla a exporty pro Instagram a Fler okraj neořezávají, jen podlahu vně rohů
zprůhlední nebo nahradí barvou pozadí. Master bez obojího (sken, fotka upravená jinde) jde do
mockupu celý jako dosud. Klik na obraz, detail nebo mockup otevře prohlížečku, ve které se dá
šipkami (i swipem) přepínat mezi originálem, detaily a mockupy.

- Malá díla (delší strana do 35 cm): stěna (komoda, ložnice), rámeček na poličce
  a rámeček opřený na stole v pracovně.
- Větší díla: obývák, druhá stěna (ložnice, komoda) a předsíň.
- Scény, které se nevejdou (rám je větší než volné místo), se přeskočí.
- Výběr je pro dílo stálý (podle ID), aby se mockupy mezi běhy neměnily.

Scény jsou v `mockups/`: fotka interiéru z Unsplash a v `scenes.yaml` její
kalibrace (kolik pixelů je 1 cm, kam se obraz věší, jak velký se vejde, barva
rámu, světlo, stín a případné předměty před obrazem, např. opěradlo židle). Novou scénu přidáš tak, že uložíš fotku (čelní pohled na
stěnu, 2400 px na šířku), odhadneš měřítko podle předmětu známé velikosti a
doplníš záznam do `scenes.yaml`. Pak `npm run images` přegeneruje všechna díla.

Webové obrázky a mockupy se přegenerují jen při změně fotky, detailních fotek,
`size_cm`, scén, rohů listu (`meta_corners` a `images.edges`) nebo toho, zda je dílo na prodej. Změna ceny či popisu obrázky
negeneruje znovu (zapíše se jen kopie yaml).

## Ostatní fotky (O mně, Kontakt)

Fotky ulož do `fotky/` obsahového repa a spusť `npm run images`. Ke každé vznikne
`<název>.yaml` s popisem (`alt`, `caption`), který stojí za to doplnit. Stránky
používají tyto názvy; dokud fotka neexistuje, na stránce prostě chybí:

| Fotka | Kde je |
|---|---|
| `o-mne-uvod.jpg` | O mně, nahoře pod jménem přes celou šířku, oříznutá na 2:1 podle `focus` |
| `portret.jpg` | O mně, vedle textu, úzký sloupec (ideálně fotka na výšku) |
| `kontakt.jpg` | Kontakt, vedle kontaktů, oříznutá na šířku 3:2 podle `focus` (fotka 3:2 zůstane celá); bílý okraj přechází do papíru stránky (`blendEdge={10}`) |

Kontakt ukazuje z `site.config.yaml` e-mail (`site.email`), Instagram (`site.instagram`), obchůdek na Fleru
(`site.fler`) a místo, kde autorka žije a maluje (`site.location`, „Žiji a maluji“); prázdná hodnota = položka chybí.

Přípona může být i `.jpeg`, `.png` apod. Další fotku lze na libovolnou stránku
přidat komponentou `<Photo name="…" />`.

## Ikona webu (favicon)

Zdrojem je `public/favicon.svg` (moderní prohlížeče). Z něj `npm run favicons` (`scripts/favicons.mjs`,
`scripts/lib/favicons.mjs`) vyrobí `public/favicon.ico` (16, 32 a 48 px; starší prohlížeče, čtečky a náhledy odkazů)
a `public/apple-touch-icon.png` (180 px na papírovém podkladu; iPhone a iPad při uložení na plochu, SVG neumí).
Po každé změně `favicon.svg` spusť `npm run favicons` a commitni všechny tři; odkazuje na ně `Base.astro`.
Vyzkoušení: `npm run build`, v `dist/` jsou všechny tři soubory a v hlavičce stránek tři odkazy `rel="icon"` / `rel="apple-touch-icon"`.

```yaml
# fotky/o-mne-uvod.yaml (obsahové repo)
alt: Pavla maluje u potoka na šumavské pláni   # co je na fotce
caption: Můj ateliér pod širým nebem           # popisek pod fotkou, nepovinné
focus: [85, 60]                                # bod [zleva %, shora %], který zůstane vidět při ořezu
```

**Ořez a `focus`:** stránka může fotku oříznout na pevný poměr stran
(`<Photo name="…" aspect="2 / 1" />`). Ořez se vycentruje na bod `focus`
(výchozí `[50, 50]` = střed). Hodí se, když je důležitá část fotky u okraje.
`focus` mimo 0–100 nebo v jiném tvaru pipeline ohlásí jako chybu. Hodnota
jde do veřejné kopie `content/fotky/<název>.yaml` (spolu s `alt` a `caption`; `info.json` nese jen data
obrázků) a na web jako CSS `object-position`. Bez `aspect` se fotka
neořezává a `focus` nemá vliv.

**Bílý okraj do papíru (`blendEdge`):** `<Photo name="…" blendEdge={10} />` u fotky s bílým okrajem (akvarel na
papíře): tělo fotky zůstane beze změny, jen pás o hloubce 10 % šířky podél okrajů (nahoře a dole stejně hluboký)
plynule přejde do kopie fotky prolnuté s papírem (`multiply`, bílá = barva papíru palety) a krajní třetina pásu
té kopie plynule zmizí, takže po obvodu nezůstane linka. Jsou to dvě vrstvy téhož obrázku (stáhne se jednou),
obě s maskou; bez zástupné barvy pod obrázkem. Na tmavé paletě se nic nemění.
Vyzkoušení: fotka s bílým okrajem, `npm run build && npm run preview`, v patičce přepnout na Pergamen.

## Zprávy od návštěvníků (formulář, „Napište mi“)

Návštěvník může napsat z každé stránky; zprávu doručí [Web3Forms](https://web3forms.com) e-mailem, web nemá server.

- **Nastavení** v `site.config.yaml` → `messages`:
  - `accessKey`: klíč Web3Forms (UUID; vznikne zadáním e-mailu na web3forms.com, je veřejný, říká jen, kam doručit).
    Všechny zprávy jdou na tuto jednu adresu; třídění (např. přeposlání hlášení chyb) řeší filtr v poště.
    Prázdný = žádný formulář: Kontakt ukáže jen adresy a u díla zůstane „Napsat autorce“ (`mailto:`).
    Neplatný klíč (ne UUID) zastaví build chybou.
- **Kontakt** (`/kontakt/`): formulář přímo na stránce, pod ním kontakty na jednom řádku.
- **Ostatní stránky**: štítek „Napište mi“ vpravo dole (na telefonu jen ikona, při posouvání dolů se schová,
  nahoru se vrátí); při první návštěvě záložky na pár vteřin vysvětlivka, jinak při najetí myší. Otevře panel:
  - **malý** (výchozí, jako chat), **velký** (⤢, roste ze stejného rohu pro delší text, ⤡ zpět), **schovaný**
    (—, štítek ukáže „Rozepsaná zpráva •“), **zavřený** (×; s textem se nejdřív zeptá „Zahodit rozepsanou zprávu?“).
    Esc panel schová (s textem) nebo zavře. Na telefonu je panel spodní „šuplík“ (velký přes celou výšku).
  - Je to vždy tentýž formulář, změnou velikosti se text neztratí.
- **Souvislost**: zpráva nese stránku, odkud vznikla („K obrazu: Ovce (2026)“, „Ke stránce: Kolekce“), křížkem jde
  odebrat. Do e-mailu jde předmět `[pavla-web] <typ>: <obraz (id) nebo stránka>`, adresa stránky a u obrazu jeho id;
  odesílatel je „Web <adresa webu>“ (`messageSender`, např. „Web pavla.kramolis.cz“), aby zpráva nevypadala jako od autorky.
- **Typy zpráv** (`MESSAGE_TYPES`): Pozdrav nebo vzkaz · Dotaz na obraz · Zájem o koupi · Spolupráce, výstava, plenér ·
  Chyba na webu · Něco jiného. Předvybraný: na detailu díla na prodej „Zájem o koupi“, jinak u díla „Dotaz na obraz“,
  jinde „Pozdrav nebo vzkaz“. E-mail pro odpověď je povinný u dotazu na obraz a zájmu o koupi, jinak nepovinný.
- **Detail díla**: tlačítko „Zeptat se na obraz“ otevře panel k tomuto obrazu (místo dřívějšího „Napsat autorce“).
- **Rozepsaná zpráva** se drží v `sessionStorage` záložky (přechod na jinou stránku i obnovení stránky ji zachová,
  zavření záložky ji smaže, nikam se neposílá); nese i souvislost, odkud začala, a velikost panelu.
- **Po odeslání**: poděkování v panelu, koncept se smaže, panel se za 4 s schová; událost `message_sent` (GA).
  Při chybě text zůstane a ukáže se e-mail `site.email` jako náhradní cesta.
- **Bez JavaScriptu**: odkaz „Napsat k této stránce“ v patičce vede na Kontakt se souvislostí v adrese
  (`/kontakt/?stranka=…&nazev=…&obraz=<id>`); formulář odešle přímo na Web3Forms a ti vrátí návštěvníka
  na `/kontakt/odeslano/` (poděkování, `noindex`, není v mapě webu).
- **Spam**: skryté pole `botcheck` (vyplní ho jen robot; zpráva se pak „odešle“ naoko a nic neodejde).
- **Testovací data** (`npm run demo`, `npm run demo:build`): vždy jen **náhled**, i s vyplněným klíčem: formulář
  funguje, ale nic neodešle a poděkování to řekne. Skutečný web posílá jen produkční build s klíčem.
- Kód: `scripts/lib/messages.mjs` (typy, souvislost, předmět, kontrola, data pro Web3Forms, nastavení),
  `scripts/lib/message-draft.mjs` (stavy panelu, koncept), `src/lib/message-form.ts` (chování v prohlížeči),
  `src/components/MessageForm.astro`, `src/components/MessagePanel.astro`, zapojení v `Base.astro` (props `message`,
  `messagePanel`), `src/pages/kontakt.astro`, `src/pages/kontakt/odeslano.astro`.
- Vyzkoušení: `npm run demo`, na `/tvorba/` štítek vpravo dole, otevřít, napsat, ⤢ / ⤡ / —, přejít na jinou stránku
  (štítek „Rozepsaná zpráva“, po otevření text i souvislost zůstanou), × → „Zahodit“; na `/tvorba/2025/demo-pivonky-vjr39/`
  „Zeptat se na obraz“ (souvislost a „Zájem o koupi“, bez e-mailu nejde odeslat); odeslání ukáže poděkování s poznámkou
  o náhledu; `/kontakt/` formulář na stránce; `/kontakt/?stranka=/tvorba/&nazev=Tvorba` souvislost „Ke stránce: Tvorba“.
  V DevTools → Console (úroveň Verbose) `[analytics] message_sent {…}`. Skutečné doručení jen na nasazeném webu.

## Barvy webu (palety)

Návštěvník si v patičce vybere barvy webu: **Automaticky** (podle světlého/tmavého režimu systému, výchozí),
**Papír** (světlá), **Pergamen** (zažloutlý papír) nebo **Noc** (tmavá). Volba se pamatuje v `localStorage`
(`pavla.palette`, nic uloženo = Automaticky) a platí na všech stránkách.

- **Palety** jsou jen v `scripts/lib/palettes.mjs` (`PALETTES`): `id`, `label`, `scheme` (`light`/`dark`), osm barev
  (`paper` pozadí, `paper2` plochy, `ink` text, `inkSoft` tlumený text, `line` linky, `accent` odkazy a zvýraznění,
  `ok` „k prodeji“, `error` chyby formuláře) a `picture` (síla stínu obrazů `shadow`, 1 = jako na Papíru; `edge` =
  jemná linka kolem obrazu na tmavém podkladu, jinak `null`). Z nich vznikne CSS (proměnné `--paper`, `--ink-soft`…,
  `--shadow-soft` pro karty galerie, `--shadow-deep` pro úvodní obraz a dílo, `--paper-blend` podle `scheme`)
  i kroužky přepínače. Zaškrtávátka (`input[type=checkbox]`, teď „Doporučené“ v galerii) kreslí web sám z palety
  (`Base.astro`): prázdné `--paper` s rámečkem `--ink-soft`, zaškrtnuté `--ink` s fajfkou v barvě papíru, fokus
  z klávesnice `--accent`; nativní (bílé, modrý fokus) zůstane jen v režimu vysokého kontrastu (`forced-colors`).
  **Nová paleta = nový záznam v `PALETTES`**, nic dalšího.
- **Automaticky** = první světlá paleta ve dne, první tmavá v tmavém režimu systému (a mění se s ním).
- **Kontrola** (`checkPalettes`, test): každá paleta má všechny barvy jako `#rrggbb`, unikátní `id` (ne `auto`),
  kladnou sílu stínu, a každá barva textu (`ink`, `inkSoft`, `accent`, `ok`, `error`) má proti `paper` kontrast
  aspoň 4,5 : 1 (WCAG AA). Aspoň jedna světlá a jedna tmavá paleta. Nečitelná paleta neprojde `npm test`.
- **Bez probliknutí**: CSS všech palet a malý skript (`paletteScript`) jsou vložené v `<head>` (`Base.astro`) před
  vykreslením; skript nastaví `data-palette` (zobrazená paleta) a `data-palette-choice` (volba) na `<html>`
  a barvu lišty prohlížeče (`theme-color`). Bez JavaScriptu rozhoduje systém a přepínač se neukáže.
- **Přepínač**: `src/components/PalettePicker.astro` v patičce („Barvy“ a kroužky v barvě papíru palety, Automaticky
  napůl světlý a tmavý), popisek při najetí myší; změna pošle událost `palette_change` (viz *Návštěvnost*).
- **Bílé okraje fotky do barvy papíru** (`--paper-blend`, `paperBlend`): na světlé paletě `multiply` (bílá převezme
  barvu papíru), na tmavé `normal` (beze změny). Používá ho `<Photo … blendEdge={10} />` (viz *Ostatní fotky*),
  zatím jen fotka `kontakt` na Kontaktu.
- Barvy, které se s paletou nemění: prohlížeč obrazů (zvětšení díla) je vždy tmavý; obrázky z pipeline (`og.jpg`,
  mockupy, `apple-touch-icon.png`) mají světlý papír natvrdo.
- Vyzkoušení: `npm run demo`, v patičce přepnout kroužky na úvodu, v `/tvorba/`, na detailu díla, `/kontakt/`
  (formulář, chybová hláška po prázdném odeslání) a s otevřeným panelem „Napište mi“; volba zůstane po přechodu na
  jinou stránku i po obnovení; „Automaticky“ se řídí režimem systému (macOS: Nastavení → Vzhled). V DevTools → Console
  (Verbose) `[analytics] palette_change {"palette":"noc"}`.

## Lokální vyzkoušení

Obě repa vedle sebe, v tomto repu jednou `npm ci`.

1. `npm test`: unit testy pipeline, filtrů, testovací sady a pomocných modulů
   (`node:test`, běží na dočasných kopiích, reálný obsah nemění).
2. **Na testovacích datech** (vše níže): `npm run demo` → http://localhost:4321.
   Připraví `.demo/` a spustí web nad ním; skutečná data ani tohle repo nemění.
   `npm run demo:build` postaví web z testovacích dat do `.demo/site/dist`.
3. **Na skutečných datech:** `npm run images` zpracuje obsahové repo (`CONTENT_DIR` z `.env`)
   (zapisuje do obou rep), `npm run dev` nebo `npm run build && npm run preview`
   ukáže přesně to, co půjde ven.

Co kde vyzkoušet (adresy platí pro `npm run demo`):

| Změna | Jak ověřit |
|---|---|
| filtry | `/tvorba/`: klikej na filtry, sleduj URL; zkopíruj URL do nového okna, musí ukázat totéž. Testovací data mají pro každou kombinaci aspoň jedno dílo. |
| stránkování | `/tvorba/`: 12 děl a stránky 1, 2, …, 5 (mezera „…“); klikni na 2, v URL `?page=2`, zkopíruj do nového okna. Vyber filtr, vrátí tě na 1. stránku; `?page=99` se opraví na poslední. „Zobrazit vše (58)“: všech 58 děl, v URL `?page=all`; změň filtr, zůstane vše; „Zobrazit po stránkách“ vrátí 1. stránku. „Na stránku“ 24: stránky 1, 2, 3, v URL `?perPage=24`; 48: stránky 1, 2; zpět na 12 parametr zmizí; `?perPage=13` se ignoruje. Paměť: zvol 24, otevři `/tvorba/` znovu bez parametrů (nebo stránku kolekce) → 24 a `?perPage=24` v URL; otevři `/tvorba/?page=2` → 12 na stránku (odkaz má přednost); zvol 12 → paměť se smaže. Smazat ručně: DevTools → Application → Local Storage → `pavla.gallery.perPage`. Menší první hodnota `gallery.pageSizes` (např. `[4, 12]`) ukáže mezery na obou stranách aktuální stránky. |
| náhledy pro sdílení | `grep -o '<meta property="og:image[^>]*>' dist/tvorba/2026/*/index.html` po `npm run build`; soubory `public/tvorba/*/*/og.jpg` a `public/tvorba/kolekce/*/og.jpg`. Online: po nasazení vlož odkaz do <https://www.opengraph.xyz/> nebo do Facebook Sharing Debuggeru. |
| rozpracované dílo | „Rozpracovaný obraz“ nesmí být v galerii, v roce 2026 ani na adrese `/tvorba/dhsh5/` |
| web bez děl | `mkdir -p /tmp/prazdny/public && cp public/favicon.svg /tmp/prazdny/public/ && SITE_DATA_DIR=/tmp/prazdny npx astro build`: úvodní stránka ukáže „Obrazy tu brzy přibudou.“ a odkaz na Instagram (bez `site.instagram` jen první větu) |
| mockup bez okraje | srovnej fotku přes `npm run straighten` (s výchozím okrajem), dej ji jako master díla s `mockups: true` do testovacích dat nebo obsahového repa, `npm run images`: webový obrázek díla má kolem papíru pruh podlahy, mockupy (`mockup-*.jpg`) ne. Metadata ověříš: `node --input-type=module -e "import s from 'sharp';console.log(String((await s('<master>.jpg').metadata()).xmp))"` |
| stav a mockupy | v yaml díla s `mockups: true` změň `status` (např. `available` → `sold`), `npm run images`: v logu `→ <dílo>`, mockupy na detailu zůstanou (nadpis „Jak vypadá na zdi“), z `export/fler` zmizí; pak `mockups: false`: mockupy zmizí i z webu. Testovací data: Ráno u rybníka (na prodej) × Slunečnice, Šumava v mlze (ne) × Pivoňky (vypnuté) |
| exporty | `ls .demo/content/export/*/*/`: Instagram jen Ráno u rybníka, Pivoňky, Kytice z louky a Máky (`meta_instagram: true`) s `-clean` a `-detail-*`, Fler jen díla `available`/`reserved`; smaž `meta_instagram: true` u Máků v `demo-content/`, `npm run demo:prepare`, jejich export zmizí (originál + `-mockup-*`) |
| cena | zakomentuj nebo smaž `price` u díla `available` (`demo-maky.yaml`): `npm run images` skončí chybou „stav „available“ potřebuje cenu“ |
| úklid exportů | přejmenuj dílo (yaml, fotku i složku detailů), `npm run images`: v logu `- removed export/…` se starým názvem, v `export/` zůstanou jen soubory s novým názvem; totéž po smazání díla. Nebo nakopíruj do `export/fler/<rok>/` cizí soubor `<slug>-<id>-mockup-xyz.jpg` existujícího díla: další běh ho smaže, i když nic nepřegeneruje. |
| kolekce | `/tvorba/kolekce/` (přehled), `/tvorba/kolekce/demo-plener-sumava-2026/` (s úvodní fotkou), `/tvorba/kolekce/demo-zahrada-2025/` (bez ní), výběr „Kolekce“ a „O kolekci ›“ v galerii, řádek „Kolekce“ na detailu díla |
| detailní fotky | `/tvorba/2026/demo-rano-u-rybnika-pf7ru/` (2 detaily s popisky), `/tvorba/2025/demo-kytice-z-louky-q6bn6/` (1 detail bez popisku): náhledy pod popisem, prohlížečka; v `export/instagram` soubory `-detail-*` |
| soukromá poznámka | `grep -r private_note .demo/site/content/` nesmí nic najít; `demo-rano-u-rybnika` a `demo-jablka-na-stole` ji v `demo-content/` mají |
| oddělení testovacích dat | zkopíruj `demo-content/tvorba/demo-maky.yaml` do `tvorba/` obsahového repa a spusť `npm run images`: skončí chybou „test data do not belong in the real content“ a nic nezapíše (pak soubor smaž). Obráceně: dílo bez jména `demo-…` v `demo-content/` nebo smazaná značka `demo-content/demo-content.yaml` zastaví `npm run demo`. |
| fotky stránek | `/o-mne/` (`o-mne-uvod` nahoře oříznutá na 2:1, `portret` vedle textu; bez kterékoli z nich se rozložení přizpůsobí); změň `focus` v `fotky/o-mne-uvod.yaml` (např. `[10, 10]`), `npm run images`, výřez se posune |
| úvodní obraz kolekce | `/tvorba/kolekce/` a `/tvorba/kolekce/demo-zahrada-2025/`: „Ze zahrady 2025“ ukazuje široký detail Pivoněk (`cover: vjr39#1-kvety-nahore`). Má `aspect: "2:1"`: zkus `"3:2"` nebo `"1:1"`, pak `cover: vjr39` (celé Pivoňky oříznuté), pak smaž `aspect` i `focus` (bez ořezu), pak `cover` (náhodně z výběru, celé). Bez `aspect` se ořízne na čtverec, bez `focus` kolem středu. „Plenér Šumava 2026“ má vlastní fotku jako panorama 2400 × 1000: ukáže se celá; zkus k ní `aspect: "3:2"`. „Město 2026“: `cover` bez ořezu, celé dílo. |
| obrázek pro sdílení kolekce | po `npm run images` otevři `public/tvorba/kolekce/*/og.jpg` (1200 × 800, stejný výřez jako na stránce, jen u vlastní fotky, detailu a `cover` s ořezem; ořez 2:1 Ze zahrady leží na papíře); změň `focus` nebo `aspect` kolekce Ze zahrady, `npm run images`, v logu `→ og kolekce/…` a výřez se posune. Na stránce kolekce je v `<meta property="og:image">`. |
| starý název atributu | v `demo-content/tvorba/demo-maky.yaml` přepiš `meta_draft:` na `draft:`, `npm run demo:prepare`: chyba „draft: přejmenováno na meta_draft, přejmenuj ho“, soubor se nezmění (pak vrať) |
| `derived_` v obsahu | do `demo-content/tvorba/demo-maky.yaml` přidej `derived_x: 1`, `npm run demo:prepare`: chyba „derived_ attributes are made by the pipeline…“ (pak smaž) |
| vyhledávače | po `npm run demo:build`: `.demo/site/dist/robots.txt`, `.demo/site/dist/sitemap.xml` (s `lastmod`), ve zdroji stránek `<meta name="description">` a `application/ld+json` (dílo `VisualArtwork` s `keywords` a `artform`, výpisy `CollectionPage` s `keywords`, úvod `WebSite` + `Person`); 404 má `noindex` |
| chybějící obrázek | smaž v `.demo/site/dist/tvorba/*/*/` jeden obrázek, `SITE_DATA_DIR=.demo/site npm run check:images`: vypíše ho se stránkou a skončí kódem 1 |
| chyby v popisu | např. `date: 14. 6. 2026`, `collection: plener` v popisu díla, podsložka v kolekci bez díla, dvě složky se stejnou adresou, popisek v `details:` k neexistující fotce, zveřejňované dílo, kolekce, rok, úvod nebo fotka s textem začínajícím `DOPLNIT`, `cover` s dílem z jiné kolekce nebo `focus: [120, 50]`: `npm run images` skončí chybou a nic nezapíše |

Pozn.: když Astro při buildu padá na zápisu telemetrie (sandbox, CI bez domovského
adresáře), pomůže `ASTRO_TELEMETRY_DISABLED=1`.

## Automatické zpracování obsahu

Obsah se na web dostává automaticky: workflow **obsahového repa** (je soukromé a popisuje ho jeho vlastní
dokumentace) si stáhne tento kód a pipeline spustí stejně jako lokálně. Z pohledu tohoto repa:

- **plný běh** (`npm run images` s `CONTENT_DIR` = checkout obsahového repa): vygeneruje `content/` a
  `public/…` a otevře do tohoto repa pull request z větve `obsah/aktualizace` se zapnutým **auto-merge**:
  sloučí se sám, jakmile projde povinná „Kontrola kódu“ (ruleset na `main`), větev se pak smaže a web se nasadí.
  Nastavení repa: *Allow auto-merge*, *Automatically delete head branches* a ruleset pro výchozí větev
  s *Require status checks to pass* (`check`) a výjimkou pro správce (přímé pushe do `main`).
  Pull request připraví `node scripts/pull-request.mjs <soubor-popisu>` (`scripts/lib/pull-request.mjs`):
  - do `add-paths` dá jen výstupní cesty z `OUTPUT_PATHS` (`content`, `public/tvorba`, `public/fotky`,
    `public/_cover`, `public/og.jpg`), a to jen ty,
    které existují nebo je git zná (smazaná složka). Chybějící cestu (např. `public/_cover`, dokud úvodní stránka nemá
    vlastní `_cover.jpg`) přeskočí, jinak by `git add` selhal a pull request by nevznikl; bez jediné složky se pull
    request přeskočí. Nová výstupní složka pipeline = doplnit do `OUTPUT_PATHS`,
  - popis: číslo běhu a seznam změněných děl, kolekcí a fotek. Pull request je veřejný, takže **nikdy
    neuvádí název ani odkaz na obsahové repo** (to platí i pro jeho titulek a commit).
- **přípravný běh** (`npm run images -- --prepare-only`, na větvích obsahového repa): jen kostry popisů, `id`,
  rohy listu (`meta_corners`), srovnání popisů, kontroly a náhledy ořezu rozpracovaných děl (`.previews/`), bez
  obrázků, exportů a zápisu do tohoto repa.
- **náhledy ořezu** (`.previews/`) nahraje workflow obsahového repa (na `main` i ve větvi) jako artefakt běhu
  `nahledy-orezu` (14 dní, mimo git); zkušební běh totéž s testovacími daty.
- Souhrn běhu (`scripts/lib/summary.mjs`) jde do `GITHUB_STEP_SUMMARY`, celý česky (čte ho autorka), v tomto pořadí:
  1. **Chyby** (`### ✗ Chyby (počet)`): hlášky kontrol seskupené po souborech (`groupProblems`: část před první
     „`: `“ je soubor, hlášky bez souboru pod „Obecně“) a obrazy bez fotky (`missing`). Každá hláška kontroly je česky
     ve tvaru `<soubor>: <co je špatně a jak to opravit>`.
  2. **Ke kontrole** (`### ⚠ Ke kontrole`): zveřejněné obrazy, kterým zůstal `DOPLNIT` v komentáři, a podezřelý ořez
     rohů (`⚠`); běh nezastaví.
  3. **Doporučení** (`### 💡 Doporučení (počet)`, `workAdvice` v `scripts/lib/advice.mjs`): po souborech, u všech děl
     (i rozpracovaných), běh nezastaví ani nezmění: dílo bez štítků (`tags`); `title` začíná malým písmenem nebo končí
     tečkou; `description` a popisky detailů (`details`) začínají malým písmenem nebo nekončí tečkou (stačí i `!`, `?`,
     `…`, případně před uzavírací uvozovkou či závorkou); dílo na prodej (`available`, `reserved`) bez `mockups: true`;
     název díla delší než `workTitleChars` (60 znaků titulku stránky ve výsledcích vyhledávání, `SEARCH_TITLE_MAX`,
     minus „ · “ a `site.title`, teď 40): ve výsledcích vyhledávání a v záložce se zkrátí (bublina nad obrazem název
     nezkracuje).
     Stejně `title` a `description` kolekce, `description` roku a úvodní stránky a `alt` a `caption` fotek stránek
     (`pageAdvice`). Název kolekce delší než `COLLECTION_TITLE_CHARS` (19) a technika delší než `TECHNIQUE_CHARS` (14)
     znaků (`techniqueAdvice`, jednou za techniku s počtem děl): zavřený výběr v galerii je zkrátí (viz *Řádek filtrů*).
     Texty začínající `DOPLNIT` a prázdné přeskočí (ty hlídají kontroly).
     Pod „**Štítky**“ doporučení k seznamu štítků všech děl (i rozpracovaných; `tagAdvice`): jen tam, kde jde něco
     udělat. Jeden štítek ve dvou tvarech (velká písmena, diakritika nebo koncové samohlásky: „plener“ / „plenér“,
     „hora“ / „hory“, kmen aspoň 3 písmena, `sameTag`); dva štítky skoro vždy spolu (podobnost množin děl
     ≥ `TAG_TOGETHER` 0,9, oba aspoň u `TAG_TOGETHER_MIN` 3 děl): jako filtr jeden nic nepřidá; čipy v galerii
     přesáhnou `TAG_ROWS` (2) řádky (odhad šířky po znacích, `tagRows`, `TAG_ROW_CHARS` = řádek stránky 1320 px),
     s kandidáty: štítky jen u jednoho díla a delší než `TAG_LONG` (12) znaků. Štítek u většiny děl doporučení nemá
     (je to pravdivý popis, opravit nejde; štítek u všech děl se jako filtr nenabízí sám).
  4. **Co automatika udělala**: nové popisy, přidělené kódy, nalezené rohy, náhledy ořezu, srovnané popisy,
     odstraněné soubory a počty zpracovaných.
  5. **Štítky** (`### Štítky (počet)`, `tagStats`): jeden řádek „krajina 9 · voda 3 · …“, kolik děl (i rozpracovaných)
     má který štítek, nejčastější první.
  Spadne-li běh na chybě mimo popisy (výjimka), souhrn to řekne česky a technický text výjimky dá pod to.

Lokální `npm run images` funguje dál stejně. Jen nekombinuj obojí najednou: buď pushni výsledek lokálního
běhu, nebo nech pracovat automatiku.

**Týdenní kontrola automatiky** běží v obsahovém repu, kód je tady: `scripts/check-health.mjs` (volání API,
čtení popisů) a `scripts/lib/health.mjs` (vyhodnocení, české zprávy). Proměnné: `TOKEN` (token pro zápis do
tohoto repa), `RUNS_TOKEN` a `REPO` (běhy workflow obsahového repa), `CONTENT_DIR` (checkout popisů,
nepovinný). Kontroluje:

- že token funguje a nevyprší do 14 dní (`--days`),
- že poslední dokončený běh zpracování obsahu neselhal (selhání opravené pozdějším během jen zmíní),
- že poslední „Zkušební běh zpracování“ (níže) neselhal,
- že se poslední commit v `main` tohoto repa nasadil,
- že pull request `obsah/aktualizace` není otevřený déle než den (`--pr-days`, výchozí 1): slučuje se sám (auto-merge),
  takže otevřený déle = zaseknutý (neprošla „Kontrola kódu“ nebo auto-merge není zapnutý),
- že žádný popis nemá neznámý atribut (`NEZNÁMÝ`, `findUnknownAttributes` v `scripts/lib/content.mjs`;
  bez `CONTENT_DIR` se tahle kontrola přeskočí),
- že každá technika děl má druh díla pro vyhledávače (`artform` v `scripts/lib/seo.mjs`, `findUnknownTechniques`
  v `scripts/lib/content.mjs`): nová technika bez pravidla v `ARTFORMS` vypíše techniku s díly, která ji mají
  (bez `CONTENT_DIR` se přeskočí),
- že na nasazeném webu existuje každý obrázek, na který jeho stránky odkazují (`scripts/lib/site-check.mjs`):
  projde web od úvodní stránky a od všech stránek mapy webu (`/sitemap.xml`) po vlastních odkazech, z `src`, `srcset`, `href`
  a `og:image` posbírá obrázky a na každý se zeptá (`HEAD`); vypíše chybějící obrázky se stránkou, která na ně
  odkazuje, a nedostupné stránky. Adresa webu je `site.url` ze `site.config.yaml`, `--site-url <adresa>` ji
  přepíše (např. lokálně spuštěný web). Vyzkoušení: `node scripts/check-health.mjs --site-url <adresa>`
  (bez tokenů ohlásí i token; za proxy navíc `NODE_USE_ENV_PROXY=1`).
- že stránky nasazeného webu (tytéž, které prošla kontrola obrázků, bez `noindex`) mají vlastní titulek a popis
  (žádné dvě stejné, popis nejvýš 160 znaků) a platná strukturovaná data (JSON-LD se schema.org a typem u každého
  uzlu): `evaluatePageTexts` ve `scripts/lib/page-check.mjs`, stejná pravidla jako `npm run check:images` u buildu,
  hlášky česky (nejvýš 10, pak „… a dalších N“). Když se web nepodařilo načíst, tahle kontrola se přeskočí
  (chybu ohlásí kontrola obrázků).

Výsledek je markdown (`formatReport`) na stránce běhu a ve výstupu kroku `report`; když je něco špatně,
skript skončí kódem 1.

**Zkušební běh zpracování** (`.github/workflows/dry-run.yml` v tomto repu): každou neděli (den před
týdenní kontrolou), po změně pipeline (`scripts/process-images.mjs`, `scripts/pull-request.mjs`,
`scripts/lib/pull-request.mjs`, `scripts/demo.mjs`, samotného workflow) a ručně (*Actions → Zkušební běh
zpracování → Run workflow*) projde celé zpracování obsahu na testovacích datech, aby se chyba ukázala dřív,
než na ni narazí skutečný obsah:

1. `node scripts/demo.mjs --content-only` postaví z `demo-content/` testovací obsah do `.demo/content` (bez pipeline),
2. pipeline jako na větvi (`npm run images -- --demo --prepare-only`) a jako na `main` (`npm run images -- --demo`;
   `--demo` = obsah musí být testovací), výstupy jdou do checkoutu tohoto repa jako při skutečném běhu,
3. pull request připraví stejný `scripts/pull-request.mjs` jako skutečné zpracování a `.github/dry-run-commit.sh`
   s jeho složkami udělá totéž co `peter-evans/create-pull-request`: `git add` a commit, **nic nepushne**
   a žádný pull request neotevře (souhrn běhu ukáže, jak by vypadal),
4. dvakrát: nejdřív bez úvodních fotek kolekcí (žádné `public/tvorba/kolekce/<slug>/_cover`, jako teď u skutečného
   obsahu), pak s nimi (složky vzniknou).

Nekontroluje pushe do obsahového repa ani token (to hlídá týdenní kontrola). Lokálně jde projít totéž
na kopii repa (skutečné výstupy v `content/` a `public/` by přepsal):
`git clone . /tmp/zkusebni && cd /tmp/zkusebni && npm ci && node scripts/demo.mjs --content-only`, pak
`CONTENT_DIR=$PWD/.demo/content npm run images -- --demo` a `node scripts/pull-request.mjs /tmp/popis.md`.

## Vyhledávače (SEO)

Co web dělá, aby mu vyhledávače rozuměly (`scripts/lib/seo.mjs`, `src/layouts/Base.astro`):

- **Popis každé stránky** (`<meta name="description">`, max. 160 znaků, `summarize`): úvod = text z `_index.yaml`,
  dílo = jeho popis, jinak složený z techniky, podkladu, rozměrů a roku (`workDescription`), rok a kolekce = jejich
  text, jinak věta s názvem; Tvorba, Kolekce, O mně a Kontakt mají vlastní. Žádné dvě stránky nemají stejný titulek
  ani popis: dílo se stejným názvem jako jiné dostane v titulku stránky v závorce techniku („Tetřevská slať
  (tisk z výšky)“; se stejnou technikou i rozměr a rok, pak `id`; `workPageTitle`), dílo se stejným popisem jako
  jiné za něj techniku, rozměr a rok („Krmelec na okraji lesa. Akvarel, 27,5 × 40 cm, 2026.“, vlastní text se
  případně zkrátí, aby se vše vešlo do 160 znaků; `workPageDescription`). Název a text na stránce se nemění.
  Hlídá to `npm run check:images` (viz *Kontrola obrázků postaveného webu*).
- **Strukturovaná data** (schema.org jako JSON-LD v `<script type="application/ld+json">`, `graphLd`):
  úvod = web (`WebSite`) a autorka (`Person` s portrétem, odkazy na Instagram a Fler a místem `homeLocation` ze `site.location`), O mně = `ProfilePage`,
  Kontakt = `ContactPage`, dílo = `VisualArtwork` (název, popis, obrázek, technika, podklad, rozměry v cm, datum,
  autorka, klíčová slova `keywords` = štítky díla, druh díla `artform` podle techniky: `malba` / `kresba` / `grafika`,
  neznámá technika žádný, `artform` v `scripts/lib/seo.mjs`), Tvorba, rok, kolekce a Kolekce = `CollectionPage` se seznamem děl
  a klíčovými slovy ze štítků jeho děl (nejčastější první, nejvýš 20, `tagKeywords`); všude drobečková navigace
  (`BreadcrumbList`). **Obraz na prodej uvádí jen dostupnost (`available` = InStock, `reserved` =
  LimitedAvailability), nikdy cenu** (rozhodnutí 2026-10; cena zůstává jen na stránce).
- **Open Graph**: `og:url`, `og:site_name`, `og:locale` (`cs_CZ`), `og:type` (`article` u díla), obrázek pro sdílení.
- **`/robots.txt`** (`src/pages/robots.txt.ts`): vše povoleno, odkaz na mapu webu `/sitemap.xml`.
- **Stránka 404** (`src/pages/404.astro`): „Tento obraz ještě nebyl namalován“, tři obrazy z výběru autorky
  a odkazy na výběr a celou tvorbu; `noindex` a bez `canonical`. Krátké odkazy `/tvorba/<id>/` mají `noindex`
  a `canonical` na detail díla.
- **Ověření webu u vyhledávačů** značkou `<meta>`: kódy do `site.config.yaml` → `site.verification`
  (`google` = `google-site-verification`, `bing` = `msvalidate.01`, `seznam` = `seznam-wmt`; prázdné = žádná značka).
  Postup registrace u Googlu, Bingu a Seznamu je v obsahovém repu (návod pro správce).

Vyzkoušení: `npm run build`, pak v `dist/` zdroj stránky (`<meta name="description">`, `application/ld+json`),
`dist/robots.txt`; strukturovaná data online na <https://search.google.com/test/rich-results> a
<https://validator.schema.org/> (po nasazení). Testy `scripts/lib/seo.test.mjs`.

## Návštěvnost (Google Analytics)

Návštěvnost měří Google Analytics 4, služba `pavla.kramolis.cz` (ID `G-HPZNHYZ2MQ`, přehledy na
<https://analytics.google.com>). Nastavení je v `site.config.yaml`:

```yaml
analytics:
  googleMeasurementId: G-HPZNHYZ2MQ   # prázdné = bez statistik
```

- Značka Google (`gtag.js`) je v `<head>` každé stránky (`src/layouts/Base.astro`), stejná jako v návodu
  Google Analytics. Adresa jde do GA celá, i s parametry filtrů a stránkování (`?status=…&page=2`).
  V přehledech (*Přehledy → Zapojení → Stránky a obrazovky*) pak dimenze *Cesta ke stránce a řetězec
  dotazu* ukáže každou kombinaci filtrů zvlášť, *Cesta ke stránce a třída obrazovky* je sečte pod `/tvorba/`.
- Měří **jen produkční build skutečného webu** (`npm run build`, deploy). `npm run dev`, `npm run demo`
  ani `npm run demo:build` značku nevloží, aby se nepočítaly návštěvy při vývoji. Krátké adresy
  `/tvorba/<id>/` jsou okamžité přesměrování bez značky, měří se až cílová stránka.
- GA ukládá své cookies (`_ga`, `_ga_<id>`), takže rozpozná vracející se návštěvníky. Lišta se souhlasem
  na webu není (vědomé rozhodnutí, stejně jako na music.kramolis.cz).
- Neplatné ID (např. `UA-…` nebo překlep) zastaví build chybou, aby statistiky potichu nevypadly.
- **Vlastní události** (`EVENTS` v `scripts/lib/analytics.mjs`, posílá je prohlížeč přes `gtag('event', …)`):

  | Událost | Kdy | Parametry |
  |---|---|---|
  | `gallery_filter` | návštěvník v galerii změní filtr (štítek, technika, rok, kolekce, stav) nebo na přehledu kolekcí rok; ne stránkování ani počet na stránku | aktivní filtry `tag` (víc štítků jako jedna hodnota spojená čárkou v abecedním pořadí, např. `krajina,voda`), `technique`, `year`, `collection`, `status`, `featured` (prázdné se neposílají) a `results` (kolik děl, na přehledu kolekcí kolik kolekcí odpovídá) |
  | `fler_click` | klik na „Koupit na Fleru“ u díla | `work_id`, `work_title` |
  | `email_click` | jen odkazy `mailto:`: klik na e-mailovou adresu na Kontaktu (kdo píše rovnou z pošty místo formuláře); bez formuláře zpráv i klik na „Napsat autorce“ u díla. Předmět e-mailu má stejný tvar jako odeslaná zpráva (`[pavla-web] Pozdrav nebo vzkaz`, u díla `[pavla-web] Dotaz na obraz: <název> (<id>)` / `Zájem o koupi: …`) | u díla `work_id`, `work_title`, na Kontaktu žádné |
  | `message_sent` | odeslaná zpráva z formuláře (Kontakt nebo panel „Napište mi“, viz *Zprávy od návštěvníků*) | `message_type` (`greeting`, `work`, `purchase`, `collaboration`, `bug`, `other`), u zprávy k obrazu `work_id`, `work_title` |
  | `palette_change` | návštěvník v patičce přepne barvy webu (jen skutečná změna, ne opakovaný klik na tutéž) | `palette` (`papir`, `pergamen`, `noc`, `auto`) |

  Tlačítka nesou `data-track="<událost>"`, `data-work-id` a `data-work-title`; posluchač kliků je v `Base.astro`,
  filtr v `WorkGallery.astro`. Nové tlačítko se sleduje přidáním stejných atributů a názvu do `EVENTS`.
- **Jednorázově v GA** (bez toho se parametry v přehledech neukážou, jen počty událostí):
  *Administrátor → Vlastní definice → Vytvořit vlastní dimenzi*, rozsah **Událost**, pro každý parametr zvlášť:
  `tag` (Štítek), `technique` (Technika), `year` (Rok), `collection` (Kolekce), `status` (Stav filtru),
  `featured` (Výběr autorky), `work_id` (ID díla), `work_title` (Název díla), `message_type` (Typ zprávy), `palette` (Barvy webu); a *Vlastní metriky → Vytvořit*: `results` (Počet výsledků filtru,
  jednotka Standardní). Data se v nich ukazují až od chvíle registrace, zpětně ne.
  Přehledy: *Přehledy → Zapojení → Události* (počty a proklik na parametry) nebo *Průzkum* (tabulka např.
  Událost × Technika).
- Vyzkoušení událostí lokálně (bez Google tagu se nic neposílá, jen vypisuje): `npm run demo`, v DevTools →
  *Console* zapnout úroveň *Verbose*, změnit filtr v `/tvorba/` → `[analytics] gallery_filter {…}`; na detailu
  díla na prodej s odkazem na Fler (v testovacích datech Máky) klik na „Koupit na Fleru“ → `[analytics] fler_click`.
  Na nasazeném webu: GA → *Administrátor → DebugView* s Tag Assistantem, nebo *V reálném čase → Počet událostí*.
- Kód: `scripts/lib/analytics.mjs` (kdy měřit, obsah značky, kontrola ID), `analyticsId` v `src/lib/site.ts`.
- Vyzkoušení: `npm run build`, pak `grep -c googletagmanager dist/index.html` (1 = značka je tam);
  po `npm run demo:build` `grep -rl googletagmanager .demo/site/dist` nesmí nic najít. Na nasazeném webu:
  Google Analytics → *Přehledy → V reálném čase* ukáže vlastní návštěvu do minuty.
- Filtry galerie mění URL bez načtení stránky. GA je započítá jako zobrazení s novou adresou jen se zapnutým
  *Vylepšené měření → Změny stránky na základě událostí historie prohlížeče* (výchozí stav streamu,
  *Administrátor → Datové streamy → Web*); vypnutím by se počítala jen skutečná načtení stránek.
- **Vlastní návštěvy se nepočítají (interní provoz podle IP):** v GA *Administrátor → Datové streamy → Web →
  Nakonfigurovat nastavení značky → Zobrazit vše → Definovat interní provoz → Vytvořit*: název třeba
  „Domácí síť“, hodnota `traffic_type` = `internal`, typ shody *IP adresa se rovná* a veřejná IP adresa
  domácí sítě. Tu ukáže <https://ifconfig.me> (otevřít z domácí sítě, ne z mobilních dat ani přes VPN).
  Pak *Administrátor → Shromažďování a úprava dat → Datové filtry → Internal Traffic*: stav **Aktivní**
  (nový filtr je ve stavu *Testování* a nic nevyřazuje). Samotná adresa se sem nepíše (repo je veřejné),
  poznamenaná je v dokumentaci obsahového repa.
  Doma se IP adresa může po restartu routeru změnit: když se vlastní návštěvy zase objevují v *V reálném
  čase*, zjisti novou adresu na ifconfig.me a přepiš ji ve stejném pravidle. Filtr platí jen dopředu,
  už započítané návštěvy z přehledů nezmizí.

## Verze v patičce

V patičce každé stránky je nenápadně verze webu, např. `v26.0928.1423`. Je to
kalendářní verzování (CalVer): verze **je** čas, kdy se web sestavil, ve formátu
`vRR.MMDD.HHMM` v pražském čase (letní i zimní čas). Po najetí myší ukáže bublina
„Web vygenerován 28. 9. 2026 ve 14:23 · commit 6031b4d“, v HTML je to
`<time datetime="2026-09-28T14:23+02:00">`.

- Čas je okamžik sestavení (`npm run build`, na GitHubu deploy), takže se změní
  s každým nasazením, ať kvůli kódu, nebo obsahu. Všechny stránky jednoho buildu
  mají stejnou verzi.
- Commit se bere z `GITHUB_SHA` (GitHub Actions), lokálně z `git rev-parse`;
  když není k dispozici, v bublině chybí.
- Kód: `scripts/lib/build-version.mjs` (formát, časové pásmo, předložka „v/ve“),
  `version` v `src/lib/site.ts`, patička v `src/layouts/Base.astro`.
- Vyzkoušení: `npm run build`, pak `grep -o '<time datetime[^<]*' dist/index.html`
  (nebo najeď myší na verzi v `npm run dev`).

## Vývoj

- **Node.js 24 nebo novější** (`engines` v `package.json`). Workflow na GitHubu běží na Node 24
  (aktuální LTS, `node-version` ve všech workflow obou rep), lokálně funguje i novější (např. 26).
  Až se Node 26 stane LTS (konec října 2026), dá se `node-version` zvednout na 26.
- **Instalační skripty závislostí:** npm 11 je bez povolení tiše přeskakuje a upozorní
  („not yet covered by allowScripts“). Povolení je v `allowScripts` v `package.json`:
  `esbuild: true` (ověřuje si svou binárku, používá ho Astro), `fsevents: false` (jen macOS,
  má hotovou binárku, skript by ho zbytečně kompiloval). Nový balíček se skriptem: posoudit,
  pak `npm install-scripts approve <balíček> --no-allow-scripts-pin`, nebo `deny`;
  `npm install-scripts ls` ukáže neposouzené.
- `npm test`: testy pipeline a filtrů (`node:test`). Každý modul v `scripts/lib/` má svůj `*.test.mjs`.
- **Automatická kontrola** (`.github/workflows/check.yml`, „Kontrola kódu“): při každém pull requestu
  a pushi do `main` spustí `npm test` a `npm run build` (web z commitnutých dat, zkompiluje i všechny
  šablony stránek). Trvá asi minutu. U pushe do `main` se nespouští pro aktualizace obsahu
  (`content/`, vygenerované `public/…`) ani pro změny dokumentace (`*.md`); u pull requestu běží vždy,
  protože je to povinná kontrola rulesetu na `main` (auto-merge aktualizací obsahu čeká na ni). Ručně jde spustit
  v *Actions → Kontrola kódu → Run workflow*. Selhání při pushi do `main` založí issue „Kontrola kódu na main selhala“,
  selhání u pull requestu aktualizace obsahu (větev `obsah/aktualizace`, jinak by se jen nesloučil) issue
  „Aktualizace obsahu neprošla kontrolou kódu“ s odkazem na pull request (job `notify`, viz *Issue při selhání*);
  ostatní pull requesty a ruční běhy ne.
- **Kontrola workflow** (job `workflows` v „Kontrola kódu“): `actionlint` (verze 1.7.12, se shellcheckem) projde
  všechna workflow tohoto repa (syntaxe, výrazy `${{ }}`, vstupy akcí, skripty v `run:`) a `shellcheck`
  pomocné skripty `.github/*.sh`. Chyby, které vzniknou až za běhu (chybějící složka apod.),
  actionlint nenajde, na ty je zkušební běh zpracování. Lokálně: `brew install actionlint` a v kořeni repa
  `actionlint` (shellcheck použije, když je nainstalovaný: `brew install shellcheck`).
- **Nasazení** (`.github/workflows/deploy.yml`, „Deploy na GitHub Pages“): při každém pushi do `main` (i po sloučení
  aktualizace obsahu) postaví web (`npm run build`) a nasadí ho. Když build nebo nasazení selže, job `notify` založí
  issue „Nasazení webu selhalo“ (viz *Issue při selhání*).
- **Issue při selhání** (`.github/failure-issue.sh`, job `notify` v `deploy.yml` a `check.yml`): selhaný běh založí issue
  přidělené vlastníkovi repa, nebo k otevřenému issue se stejným názvem přidá komentář, takže mu přijde e-mail, ať běh
  spustil kdokoli; další úspěšný běh téhož druhu issue zavře. Repo je veřejné: issue obsahuje jen odkaz na běh,
  commit, případně pull request, a jednu větu. Běh zrušený novějším pushem nedělá nic. E-maily vyžadují v nastavení
  upozornění GitHubu zapnuté *Participating, @mentions and custom → Email*. Skript kontroluje `shellcheck`
  (job `workflows`).
- **Web z testovacích dat se na GitHubu nestaví:** nikde se nezveřejňuje a na runneru GitHubu
  trvá kvůli mockupům několik minut. Změny webu a pipeline proto před commitem ověř lokálně:
  `npm run demo:build` (případně `npm run demo` a proklikat).
- `npm run build`: musí projít před každým commitem.
- Kód, komentáře a názvy v kódu jsou anglicky; texty webu, URL a dokumentace česky.
- README obou rep udržujeme průběžně aktuální s každou změnou pipeline, struktury nebo webu.

## Ořez podlahy (rohy listu, `meta_corners`)

Fotka obrazu bývá trochu křivá a kolem listu je vidět podlaha (nebo okraj podkladu, který nechává
`npm run straighten`). Pipeline proto **najde čtyři rohy listu** a všechno vně čtyřúhelníku mezi nimi
**na webu zprůhlední**: obraz pak leží přímo na papíru stránky, v každé paletě (Papír, Pergamen, Noc).
Výsledek nemusí být obdélník, kopíruje skutečný (pootočený, zkosený) list. Obrázek se pak **zmenší na nejmenší
obdélník, ve kterém je celý list** (`trimTransparent` v `scripts/lib/corners.mjs`): z obrazu nic neubude a průhledný
okraj zůstane jen tam, kde ho šikmý list potřebuje (podél rovné strany žádný, u pootočeného listu klíny v rozích).
Rozměry v `info.json` jsou rozměry oříznutého obrázku.

**Rohy v popisu díla** (`meta_corners`, jen obsahové repo, do veřejné kopie se nekopíruje):

```yaml
meta_corners:
  photo: [3673, 2785]    # rozměr fotky (po otočení podle EXIF), pro kterou rohy platí
  tl: [87, 41]           # levý horní: px doprava, px dolů od levého horního rohu fotky
  tr: [26, 54]           # pravý horní: px doleva, px dolů
  br: [52, 39]           # pravý dolní: px doleva, px nahoru
  bl: [12, 29]           # levý dolní: px doprava, px nahoru
```

- **Najde je pipeline** u každého díla s fotkou, které atribut ještě nemá: u rozpracovaného i zveřejněného, na
  `main`, ve větvi (`--prepare-only`) i lokálně. Je to součást přípravy obsahu jako `id`; zapíše se jednou a pak
  už se jen kontroluje (`scripts/lib/corners.mjs`, `prepareCorners`). Ruční úpravu nikdy nepřepíše.
- Čísla jsou vždy kladná (směrem do středu fotky). Všechny nuly = list vyplňuje celou fotku, nic se neořezává.
  `meta_corners: false` = ořez vypnutý, obraz zůstane celý i s podlahou.
- Po **výměně fotky** za jinou velikost pipeline ohlásí chybu „belong to a photo of …, delete meta_corners“ (rohy
  by patřily jiné fotce); po smazání atributu je najde znovu.
- V souhrnu běhu je seznam nově nalezených rohů („Nalezené rohy listu“, `describeCorners` v `scripts/lib/corners.mjs`).
  Roh, který ořízne víc než `images.edges.suspicious`, je tam označený `⚠ PODEZŘELÝ ořez (víc než 5,0 %): tr ořízne
  1,7 % · 5,1 %; zkontroluj rohy v náhledu` (stejná hranice jako v náhledech; v logu běhu totéž za `+ corners of the sheet:`).

**Jak se rohy hledají** (`scripts/lib/edges.mjs`, na zmenšenině o šířce 1200 px): na každé straně fotky 60 vzorků
(prostředních 80 % strany) jde od okraje dovnitř, dokud se barva nezmění z podlahy na list (papír i barva obrazu,
`floorDepth`; nejdál `images.edges.search` rozměru). Strana, jejíž okraj nevypadá jako podlaha (většinou papír,
nebo pestrá barva obrazu malovaného do kraje, `looksLikeFloor`), podlahu nemá. Z každé poloviny strany vznikne
přímka hrany u jejího rohu (`edgeLine`: přímka, na které leží nejvíc vzorků, posunutá dovnitř tak, aby 85 %
vzorků leželo vně, protože skutečná hrana bývá zvlněná: raději kousek papíru než podlaha). Roh je průsečík
přímek. Roh mimo fotku (list pokračuje za její okraj) = 0, roh dál než čtvrtina fotky = nedůvěryhodný, 0.

**Prolnutí s pozadím** (`images.edges` v `site.config.yaml`): `inset` (výchozí 0,2 % kratší strany) ořízne
o kousek víc, `feather` (výchozí 1 %) je šířka pásu podél hrany, ve kterém list plynule přechází do průhlednosti
(maska `maskSvg`, `cutOut` v `scripts/lib/corners.mjs`). Změna těchto dvou hodnot přegeneruje díla s rohy (`edgeLook`).
`search` (jak daleko od okraje fotky hledat hranu, výchozí 10 %) a `suspicious` (od kolika procent je ořez rohu
v náhledech podezřelý, výchozí 5 %) obrázky nemění, takže nic nepřegenerují; stejně tak
`guides` (čáry náhledu `-frames.jpg`: podíly šířky, resp. výšky fotky od každého kraje, libovolně mnoho mezi 0 a 0,5,
výchozí `[0.003, 0.006, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05]`, jinak `npm run preview` skončí chybou).

**Kde se co použije:**

| Výstup | Okolí listu |
|---|---|
| web: AVIF a WebP | průhledné (prolne se s papírem palety); bez zástupné barvy `--ph`, stín podle tvaru listu (`filter: var(--drop-soft)` / `var(--drop-deep)` z palety, `cutout` v `Img.astro`, `transparent: true` v `info.json`) |
| web: JPEG (záloha pro staré prohlížeče) | papír první palety (`PALETTES[0].colors.paper`) |
| prohlížečka obrázků na stránce díla | průhledné, stín podle tvaru listu |
| náhled pro sdílení (`og.jpg`), úvodní obraz z díla | prolne se s papírovým pozadím `images.og.background` |
| Instagram (`-clean.jpg`) | prolne se s papírovým pozadím `images.instagram.background` |
| Fler (originál) | bílá `images.fler.background` |
| mockupy | jen holý papír uvnitř rohů (pasparta kryje okraje), viz *Mockupy* |
| detailní fotky | beze změny (rohy patří jen hlavní fotce) |

**Náhled ořezu rozpracovaných děl:** pro každé dílo s `meta_draft: true` a rohy, které něco ořezávají, vzniknou
v `.previews/` (mimo git) **tytéž tři náhledy jako u `npm run preview`** (`writePreviews` v `scripts/lib/corners.mjs`,
obojí stejnou funkcí): `<slug>-<id>-cut.jpg` a `<slug>-<id>-frames.jpg` popsané níže a `<slug>-<id>-backgrounds.jpg`, výsledek na papíru a na tmavém papíru (paleta Noc) vedle sebe, s tenkou
čarou čtyřúhelníku rohů a u každého rohu se dvěma řádky, odkud a kolik ořízne: `zleva 2,5 % = 93 px` a `shora 1,7 % = 46 px`
(zleva/zprava v % šířky, shora/zdola v % výšky fotky a v px fotky = hodnota `meta_corners`; `cutLabelLines`). Řádek nad
`images.edges.suspicious` (výchozí 5 %) je červeně, druhý řádek téhož rohu ne. Na světlém je vidět zbylá podlaha, na tmavém i to, kolik papíru se odřízlo. Plný běh
složku vždy vyprázdní a naplní znovu (zveřejněné dílo náhled nemá). Na GitHubu ji workflow obsahového repa
nahraje jako artefakt **„nahledy-orezu“** na stránku běhu (dole, *Artifacts*, ke stažení jako zip, 14 dní);
souhrn běhu náhledy vyjmenuje. Jinou složku dá `run({ previewDir })`.

**Náhled bez zápisu (`npm run preview`, `scripts/preview.mjs`):** ukáže, co pipeline udělá s podlahou, dřív než
cokoli zapíše. Obsahové repo **jen čte**, nic v něm nemění (kromě `--write`, viz níže).

```
npm run preview -- ../obsah/tvorba/rano-u-rybnika.jpg           # jedna fotka
npm run preview -- ../obsah/tvorba/2026-plener-sumava           # kolekce
npm run preview -- ../obsah/tvorba                              # všechna díla (i v kolekcích)
npm run preview -- ../obsah/tvorba --out /tmp/nahledy           # jinam než do .previews/
npm run preview -- ../obsah/tvorba/rano-u-rybnika.jpg --write   # nalezené rohy zapíše do rano-u-rybnika.yaml
npm run preview -- ../obsah/tvorba --only-suspicious            # jen fotky s podezřelým ořezem
```

- Složka = fotky děl v ní a ve složkách kolekcí; detailní fotky (složka jménem díla) a vlastní úvodní fotky
  (`_cover.*`) vynechá. Fotku zadanou jménem vezme vždy.
- Rohy vezme z `meta_corners` popisu vedle fotky (`<slug>.yaml`). Když tam nejsou (nebo patří fotce jiné velikosti),
  najde je stejně jako pipeline a **vypíše je ve tvaru popisu**, aby šly ručně zkopírovat do yaml:

  ```
  → ../obsah/tvorba/rano-u-rybnika.jpg: no meta_corners in rano-u-rybnika.yaml, detected
    preview: .previews/rano-u-rybnika-k3f9a-backgrounds.jpg (light and dark), .previews/rano-u-rybnika-k3f9a-cut.jpg (cut lines),
             .previews/rano-u-rybnika-k3f9a-frames.jpg (frame lines)
    cut (% of the photo, ! = more than 5.0 %): tl 2.5 % · 1.7 %, tr 0.7 % · 2.3 %, br 1.1 % · 1.6 %, bl 1.0 % · 1.4 %
    meta_corners:
      photo: [3673, 2785]
      tl: [93, 46]
      …
  ```

- **Kolik se ořízne:** u každého rohu vypíše ořez vodorovně · svisle v procentech šířky a výšky fotky
  (`cornerShares` v `scripts/lib/edges.mjs`). Roh, který ořízne víc než `images.edges.suspicious` (výchozí 5 %) v kterémkoli
  směru, dostane `!`; obvykle jde o zvlněný nebo zvednutý okraj papíru nebo o barvu obrazu, kterou detekce vzala za podlahu.
  Na konci výpisu je **souhrn jen podezřelých fotek** („Check first: …“, s cestou k náhledu a ořezem rohů), nebo
  „No corner cuts more than …“, když žádná není.
- **`--only-suspicious`:** náhled i výpis jen pro fotky s podezřelým rohem, ostatní projde potichu (fotky s
  `meta_corners: false` taky); poslední řádek řekne, kolik fotek prošel a z kolika udělal náhled. S `--write` ho
  nejde kombinovat (zapsat jen pochybné rohy by bylo naopak), příkaz skončí chybou a nic nezapíše.
- **`--write`:** nalezené rohy rovnou zapíše do popisů **právě zadaných fotek** (jedna fotka, kolekce, nebo celá
  `tvorba/`), stejně jako by to udělala pipeline (`withCorners` v `scripts/lib/corners.mjs`: s technickým komentářem,
  nic jiného v souboru se nezmění). Jen do popisu, který `meta_corners` ještě nemá: ruční hodnotu, `false`
  ani rohy jiné fotky nepřepíše (vypíše „not written: … already has meta_corners“), fotce bez popisu ho nezaloží
  (to udělá pipeline i s rohy). Na konci vypíše, do kolika popisů zapsal.
- Pro každé dílo (bez ohledu na `meta_draft`) vzniknou tři soubory pojmenované `<slug>-<id>` jako složka díla na webu
  (dílo bez `id` jen `<slug>`) a s příponou podle účelu:
  - `<out>/<slug>-<id>-backgrounds.jpg` je stejný náhled jako u pipeline (`previewOf` v `scripts/lib/corners.mjs`,
    nastavení `images.edges`; světlé a tmavé pozadí, čára rohů, u rohů ořez v % a px).
  - `<out>/<slug>-<id>-cut.jpg` je původní fotka v plné velikosti (nic se na ní nešrafuje ani nezakrývá) s čarami
    ořezu (`cutOriginalOf`, `cutLinesSvg`, barvy `CUT_COLOURS`): bílá plná = čtyřúhelník rohů `meta_corners`, žlutá
    čárkovaná = `inset` dovnitř od rohů (tady začíná prolnutí, list je ještě průhledný), modrá čárkovaná = `inset` +
    `feather` dovnitř (konec pásu prolnutí), růžová = hranice plně neprůhledného listu (obkreslená podle skutečné masky,
    `edgeOverlay`; kvůli rozmazání masky leží asi pětinu prolnutí za modrou), světle zelená plná = hranice oříznutého
    obrázku (`trimTransparent`, kde obrázek na webu končí). Čáry jsou tenké (kratší strana / 1000 px), aby se čáry
    vzdálené jen pár pixelů neslily. Na **každé straně** má každá čára popisek ve své barvě na tmavém podkladu, posazený
    přímo na ní a otočený podél strany: `rohy 46 · 64 px` (oba rohy té strany), `obrázek 53 px = rohy 46 + okraj 7`
    (kolik se z té strany odstranilo celkem, z toho rohy a `inset` s prolnutím, `removedSides`), `inset 5,6 px`,
    `prolnutí 27,9 px` a `plná barva`. Popisky jsou podél strany rozložené (15, 32, 50, 68 a 85 % její délky), takže se
    nepřekrývají, a leží nad všemi čarami. U každého rohu je uvnitř obrazu jeho hodnota (`tl [93, 46]`). Uprostřed panel
    (`infoPanelSvg`, `cutInfo`): schéma fotky (odstraněná část červeně šrafovaná, oříznutý obrázek, čtyřúhelník rohů
    tečkovaně) a pod ním rozměr fotky, rozměr obrázku po ořezu, kolik se odstranilo z každé strany celkem, z toho rohy
    (menší ze dvou rohů dané strany) a z toho `inset` a prolnutí, nastavení `inset` a `feather` v % i px s vysvětlením
    prolnutí a `meta_corners`, ze kterých obrázek vznikl.
  - `<out>/<slug>-<id>-frames.jpg` je celá **neoříznutá** fotka v plné velikosti (vidět jsou všechny její původní okraje)
    s rámečky čar (`framesOf`, `frameLines`, `framesSvg`): pro každý podíl z `images.edges.guides` (výchozí 0,3; 0,6;
    1; 1,5; 2; 2,5; 3; 4 a 5 %) dvě svislé čáry ve vzdálenosti podílu **šířky** od levého a pravého kraje a dvě
    vodorovné ve vzdálenosti podílu **výšky** od horního a dolního kraje. Barvy se střídají (zelená, žlutá, modrá,
    růžová; `FRAME_COLOURS`), aby sousední čáry byly odlišné. U každé čáry je v její barvě napsaná její vzdálenost od
    nejbližšího kraje v pixelech fotky (`37 px`), tedy v jednotkách `meta_corners`; procenta se nepíšou. Popisky jdou
    po schodech (každá další čára o řádek či sloupec dál: svislých kolem poloviny výšky, vodorovných kolem poloviny
    šířky) a kreslí se až po všech čarách, takže se nepřekrývají a žádná čára přes ně nevede.
  Náhledy fotky 3673 × 2785 px (všechny tři soubory) trvají asi 4 s; šrafy schématu i jiné výplně se kreslí
  přímo, ne SVG vzorem (`<pattern>`), jehož vykreslení na fotku této velikosti trvá sekundy.
  To vše proto, aby šlo
  ořez prohlédnout na jakémkoli pozadí. Soubory se při každém spuštění přepíšou; prohlížeč obrázků (Náhled na Macu)
  může ukazovat starou verzi, dokud soubor znovu neotevřeš. `meta_corners: false` náhled nemá. Plný běh
  `npm run images` složku `.previews/` vyprázdní (nechá v ní jen náhledy draftů).

**Vyzkoušení:** `npm run demo` (testovací data mají list vyfocený nakřivo na podlaze, viz *Testovací data*),
pak dílo „Na podlaze“ ve všech třech paletách; náhled rozpracovaného díla je v `.demo/site/.previews/`. Na skutečném
obsahu nejdřív `npm run preview -- <fotka|složka>` (nic nezapíše), pak `npm run images -- --prepare-only`
(zapíše rohy do popisů v obsahovém repu, náhledy draftů do `.previews/`).

## Srovnání fotek obrazů (`npm run straighten`)

Obraz vyfocený na podlaze nebo stole (trochu šikmo, kolem dřevo) nástroj srovná:
najde list papíru, opraví perspektivu na obdélník a ořízne fotku tak, že kolem
listu nechá **úzký okraj podkladu**, aby byly vidět celé okraje papíru (i nerovné
nebo natržené). **Originály
nemění**, výsledky ukládá do nové složky. Výsledek je pak master fotka pro
`tvorba/` obsahového repa (nebo do složky kolekce).

```
npm run straighten -- "../obsah/tmp/fotky-obrazu"            # všechny fotky ve složce
npm run straighten -- "../obsah/tmp/fotky-obrazu" --preview  # + náhledy s nalezeným listem
npm run straighten -- "../obsah/tmp/fotky-obrazu" --white-balance   # + papír neutrálně bílý
npm run straighten -- "../obsah/tmp/fotky-obrazu" --width 3000      # + nejvýš 3000 px na šířku
npm run straighten -- foto.jpg --corners 0.02,0.03,0.97,0.01,0.98,0.76,0.01,0.78   # rohy ručně (uloží se)
npm run straighten -- foto.jpg --rotate -90                                          # list vyfocený bokem (uloží se)
npm run straighten -- foto.jpg --extra deska --corners 0.2,0.79,0.75,0.8,0.75,0.98,0.2,0.98   # další výřez
```

| Volba | Význam |
|---|---|
| `<fotka nebo složka>` | jedna fotka, nebo všechny fotky (jpg, jpeg, png, webp, tif) přímo ve složce (ne v podsložkách) |
| `--out <složka>` | kam uložit; výchozí `upravene/` vedle fotek (u složky uvnitř ní) |
| `--preview` | do `upravene/nahledy/` uloží `<název>.nahled.jpg` s vyznačeným nalezeným listem (fialově) |
| `--margin <podíl>` | okraj podkladu kolem listu jako podíl jeho delší strany, stejně široký ze všech stran (výchozí `0.02`, tedy u listu 3000 px asi 60 px). Větší hodnota nechá víc okolí (pro výřez, který musí být určitě celý, např. `0.05`), `0` ořízne přesně na hranu, záporná ořízne dovnitř listu. Povolené −0,2 až 0,5. Kde okraj sahá za hranu fotky, doplní se barvou podkladu (průměr okraje fotky). |
| `--width <px>` | zmenší výsledek na nejvýš tuto šířku (po otočení, poměr stran zůstane, nikdy nezvětšuje). Pro master fotku stačí `3000`: web potřebuje nejvýš 2400 px, zbytek je rezerva. Bez volby zůstane plné rozlišení srovnané fotky (u telefonu až ~3500 px). |
| `--white-balance` | vyvážení bílé podle papíru: změří barvu nepomalovaného papíru (medián nejsvětlejších šedých míst) a přepočítá kanály tak, aby papír vyšel neutrálně bílý (240). Odstraní teplý i šedý nádech fotky z telefonu; papír tím i zesvětlí. Zesílení je omezené na ×0,7–1,6 a vypíše se v logu. Když ve výřezu není papír (nejsvětlejší šedá je tmavší než 150, např. kovová tisková deska), vyvážení se přeskočí. |
| `--corners x,y,…` | jen pro jednu fotku: rohy listu ručně, pořadí levý horní, pravý horní, pravý dolní, levý dolní, jako podíl šířky a výšky fotky (0–1); **uloží se** do souboru s ořezem |
| `--rotate <stupně>` | jen pro jednu fotku: otočení výsledku (`90`, `-90`, `180`); **uloží se** do souboru s ořezem |
| `--extra <název>` | jen pro jednu fotku, s `--corners`: **další výřez** z téže fotky (např. detail), výsledek `<fotka>-<název>.jpg`; uloží se do souboru s ořezem |

**Soubor s ořezem `<fotka>.orez.yaml`** leží vedle původní fotky. Zapíše ho nástroj
při `--corners`, `--rotate` nebo `--extra` (ostatní výřezy v něm zůstanou) a dá se
upravit ručně. Každé další zpracování složky ho použije, takže celou složku jde
kdykoli zpracovat znovu jedním příkazem se stejným výsledkem:

```yaml
corners: [ 0.0225, 0.026, 0.965, 0.008, 0.982, 0.762, 0.012, 0.78 ]  # hlavní ořez; bez něj automatika
rotate: -90                                                           # nepovinné
margin: 0.02                                                          # nepovinné, jako --margin jen pro tuto fotku
whiteBalance: true                                                    # nepovinné, jako --white-balance jen pro tuto fotku
width: 3000                                                           # nepovinné, jako --width jen pro tuto fotku
extra:                                                                # nepovinné další výřezy
  - name: deska                                                       # → <fotka>-deska.jpg
    corners: [ 0.205, 0.786, 0.748, 0.798, 0.752, 0.978, 0.205, 0.982 ]
    margin: 0.05                                                      # větší okraj, ať je deska určitě celá
    whiteBalance: false                                               # výřez bez papíru
```

Volby z příkazové řádky (`--width`, `--margin`) mají přednost před souborem,
další výřez bez vlastního `margin` převezme ten z hlavního ořezu,
`--white-balance` ho zapne pro všechny fotky. Neplatný soubor (rohy nejsou 8 čísel
0–1, další výřez bez názvu nebo rohů, `width` není celé kladné číslo, `margin`
mimo −0,2 až 0,5) nástroj
ohlásí a nic nezpracuje.

**Údaj o listu pro mockupy:** když výsledek obsahuje okraj podkladu (`--margin` > 0),
nástroj do JPEGu zapíše, kde přesně leží list (metadata XMP, `pavla:sheet` =
levý, horní, pravý a dolní okraj listu jako podíl 0–1, po otočení přepočítané).
Údaj zůstane v souboru i po přejmenování a nahrání přes GitHub. Pipeline podle
něj pro **mockupy** master ořízne na holý papír (viz *Mockupy*). Web, Instagram
a originál pro Fler dostanou fotku i s okrajem. Kód: `scripts/lib/sheet-box.mjs`.

**Když list nekončí hranou papíru** (např. spodní část zakrývá jiný předmět a
rohy jsou zvolené uprostřed papíru), okraj by pod ním ukázal i ten předmět.
Posuň pak rohy na té straně o velikost okraje dovnitř listu.

**Jak hledá list:** papír je světlý a skoro šedý, podklad (dřevo) barevný a tmavší.
Podklad je všechno nepapírové spojené s okrajem fotky, takže barvy uvnitř obrazu
nevadí. Rohy jsou krajní body listu po úhlopříčkách. Funguje pro list vyfocený
zhruba shora. **Selže**, když je roh listu zaoblený nebo natržený, když list
částečně zakrývá jiný předmět nebo když vedle leží další světlý papír: pak je
v logu nesmyslný roh a na náhledu fialový čtyřúhelník nesedí. Rohy pak odečti
z náhledu (souřadnice vypisuje i log, `corners (detected) …`) a spusť fotku znovu
s `--corners` (uloží se). Výstup je JPEG v kvalitě 95; barvy se mění jen s vyvážením bílé.

Kód: `scripts/lib/straighten.mjs` (hledání listu, homografie, převzorkování, testy
`straighten.test.mjs`), příkazová řádka `scripts/straighten.mjs`.

## Jak fotit (nebo skenovat) akvarely

- **Do velikosti A4 (s A3 skenerem i A3) je lepší sken než fotka**: rovné světlo, žádné zkreslení, věrné barvy. Skenuj na 600 dpi, bez automatických úprav. Větší formáty lze skenovat po částech a spojit.
- **Fotka:** rozptýlené denní světlo (u okna, ne přímé slunce), nebo dvě stejná světla z obou stran pod ~45°. Stativ, objektiv přesně proti středu, senzor rovnoběžně s papírem, ohnisko ~50–85 mm ekv.
- **Papír musí ležet rovně.** Zvlněný akvarelový papír dělá stíny, takže ho zatiž rohy nebo dej pod sklo (pozor na odlesky).
- **Barvy:** foť do RAW, do prvního snímku dej šedou kartu a podle ní nastav vyvážení bílé celé série.
- **Retuš (ručně, darktable/Lightroom):** ořez na hranu malby, srovnání perspektivy, barvy podle originálu vedle monitoru. Výsledek exportuj jako sRGB JPEG, delší strana ideálně 3000 px a víc. To je master.

## Nastavení (jednorázově)

1. Repozitář `shamoh/pavla` → *Settings → Pages → Source: GitHub Actions*.
2. DNS u registrátora domény: CNAME záznam `pavla` → `shamoh.github.io.` (doména je v `public/CNAME` a `site.config.yaml`).
3. Po ověření domény zapnout *Enforce HTTPS*.
4. Doplnit `email` a později `fler` v `site.config.yaml`, přepsat text v `src/pages/o-mne.astro`.
5. Naklonovat obsahové repo (např. vedle tohoto repa), do `.env` zapsat `CONTENT_DIR=<cesta k němu>` a spustit `npm ci`.

## Poznámky

- Vodoznak na Fleru nese jen jméno autorky, žádný odkaz ven. Fler odkazy mimo platformu nepovoluje.
- Mockupy jsou v reálném měřítku (kalibrace v `mockups/scenes.yaml`), ať si zákazník udělá správnou představu o velikosti.
- Provoz: GitHub Pages zdarma, platí se jen doména.
