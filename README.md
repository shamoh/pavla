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
  stranky/<stránka>.yaml                    texty stránek O mně, Kontakt, 404 (kostru s dosavadním textem založí pipeline)
                                            a volitelných textových stránek (kurzy.yaml = /kurzy/)
  roky/<rok>.yaml                           text autorky o roce a úvodní obraz roku (kostru založí pipeline)
  roky/<rok>.jpg                            vlastní úvodní fotka roku (nepovinné)
  _index.yaml                               úvodní stránka: text a úvodní obraz (kostru založí pipeline)
  _cover.jpg                                vlastní úvodní fotka úvodní stránky (nepovinné)
  export/instagram/[<kolekce>/]<slug>/      pro Instagram, složka na dílo (kopíruje tvorba/): s popiskem na 3 pozadích,
                                            ve 3 scénách ateliéru, panorama pro karusel (široká díla), příběh 9:16,
                                            detaily a text příspěvku; jen díla s meta_instagram: true
  export/fler/[<kolekce>/]<slug>/           pro Fler, složka na dílo (kopíruje tvorba/): originál a mockupy s vodoznakem,
                                            jen díla na prodej

Systémové soubory obsahu mají všude stejná dvě jména: `_index.yaml` popisuje místo, kde leží (v kořeni úvodní
stránku, ve složce kolekce kolekci, přímo v `tvorba/` díla mimo kolekce), `_cover.<jpg|png|webp>` je jeho vlastní úvodní fotka. Podtržítko je odliší
od děl (jméno díla jím začínat nemůže). Složky (`tvorba/`, `roky/`, `fotky/`, `stranky/`) a jména děl zůstávají česky.
Stará jména (`_kolekce.yaml`, `_uvod.jpg`, `uvod.yaml`, `uvod.jpg`) pipeline odmítne chybou „tento soubor se teď
jmenuje …, přejmenuj ho“ a vedle nich nezaloží kostru, takže se nic neztratí; soubory se přejmenují ručně.

Jména všech ostatních souborů a složek v `tvorba/`, `fotky/`, `roky/` a `stranky/` (i kolekcí a složek detailních fotek) musí
už být svou adresou pro web: jen malá písmena bez diakritiky, číslice a pomlčky uvnitř, tedy `slugify(jméno) === jméno`
(přípona zvlášť). Jinak by fotka, její popis a adresa měly různá jména (`Instagram_surf.jpg` by dostala
`instagram-surf.yaml`). Kontroluje to `scripts/lib/file-names.mjs` (`fileNameProblems`) na začátku každého běhu
(i `--prepare-only`), dřív než cokoli zapíše: špatné jméno (mezera, podtržítko, čárka, velké písmeno, diakritika,
neviditelný znak, dvě pomlčky, pomlčka na kraji) = chyba `[neplatne-jmeno]` s návrhem nového jména a běh hned skončí.
Výjimky: systémové `_index.yaml` a `_cover.<přípona>`, skryté soubory (`.DS_Store`, `.gitkeep`) a stará systémová
jména (hlásí je jejich vlastní kontrola). Přípona jen malými písmeny a v jedné podobě (`EXTENSION_SPELLING`:
`.jpg`, nikdy `.jpeg`); to platí i pro `_cover.<přípona>` (i v kořeni), návrh je pak `_cover.jpg`.

pavla/                                      (toto repo, veřejné)
  demo-content/                             testovací data: vymyšlené obsahové repo (stejná struktura jako
                                            skutečné, yaml + recept na obrázky), viz Testovací data
  .demo/                                    připravená testovací data a web z nich (npm run demo, mimo git)
  .previews/                                náhledy ořezu (npm run images: drafty, npm run preview: cokoli; mimo git), viz Ořez pozadí
  content/                                  veřejné kopie popisů = zrcadlo obsahového repa (generuje pipeline, needitovat):
    _index.yaml                             úvodní stránka
    tvorba/<slug>.yaml                      dílo bez kolekce
    tvorba/_index.yaml                      díla mimo kolekce (text, cover, aspect, focus)
    tvorba/<kolekce>/_index.yaml            kolekce (složka = její slug)
    tvorba/<kolekce>/<slug>.yaml            dílo kolekce (kolekce = složka, žádný atribut)
    roky/<rok>.yaml                         rok
    fotky/<název>.yaml                      ostatní fotka (alt, caption, focus)
    stranky/<stránka>.yaml                  text stránky (O mně, Kontakt, 404, volitelné textové stránky)
  public/                                   vygenerované obrázky leží ve složce své stránky (= adresa, generuje pipeline,
                                            scripts/lib/site-images.mjs); statické soubory webu (favicon.svg, favicon.ico, apple-touch-icon.png, CNAME) vedle:
    tvorba/<rok>/<slug>-<id>/               dílo: webové velikosti, detaily, mockupy, og-<otisk>.jpg, pin-<otisk>.jpg + info.json
    tvorba/<rok>/_cover/, tvorba/<rok>/_og/ rok: vlastní úvodní fotka, obrázek pro sdílení vybraného obalu (og-<otisk>.jpg)
    tvorba/kolekce/<slug>/_cover/, …/_og/   totéž pro kolekci
    _cover/, _og/                           totéž pro úvodní stránku
    tvorba/_cover/                          vlastní úvodní fotka „Mimo kolekce“ (bez _og/, nemá vlastní stránku)
    fotky/<název>/                          ostatní fotky (O mně, Kontakt), jen obrázky + info.json
  mockups/                                  scény pro mockupy a jejich kalibrace (scenes.yaml)
  mockups/instagram/                        scény ateliéru pro Instagram (scenes.yaml, README.md se zadáními generátoru)
  scripts/process-images.mjs                pipeline (npm run images)
  scripts/lib/                              logika pipeline a filtrů, každý modul má *.test.mjs
  scripts/lib/schema.mjs                    atributy popisů (díla, kolekce, fotky, roky, stránky): pořadí, výchozí hodnoty, komentáře
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
| `/o-mne/`, `/kontakt/` | stránky s texty ze `stranky/` a fotkami z `fotky/` obsahového repa |
| `/kurzy/` | obecná textová stránka, jen když obsahové repo má `stranky/kurzy.yaml` |
| `/sitemap.xml` | mapa webu: kanonická adresa každé stránky (bez krátkých odkazů a 404) |
| `/pinterest.xml` | kanál RSS pro Pinterest: díla s `meta_pinterest: true` (viz *Pinterest*) |

**Stránka díla** (`src/pages/tvorba/[section]/[work].astro`): vlevo obraz a pod ním popis a štítky, vpravo název
(hvězdička výběru autorky na pravém okraji v úrovni prvního řádku názvu, i u dlouhého zalomeného),
údaje (technika = odkaz na celou tvorbu s filtrem té techniky `/tvorba/?technique=…`, jako štítky `?tag=…`, oba přes
`galleryFilterPath` v `scripts/lib/gallery-filter.mjs`; technika, štítky, kolekce i navigace nahoře
(„← Tvorba“, rok) mají bublinu „Všechny obrazy [s technikou … / se štítkem #… / z kolekce … / z roku …]“ z `galleryLinkTitle`; podklad, rozměr, vznik, kolekce a poslední „Kód“ = trvalé `id` díla tlumeným písmem s pevnou šířkou,
odkaz na krátkou adresu `/tvorba/<id>/` (`workShortPath`) s bublinou „Trvalý kód obrazu: platí i po přejmenování. Krátký
odkaz: …“ (`workCodeHint` v `scripts/lib/works.mjs`) a malou ikonou „Zkopírovat kód“ vedle (`data-copy`, `applyCopyButtons`
v `src/lib/share-button.ts`, hláška „Kód zkopírován“ `copiedText`; skrytá, dokud prohlížeč neumí kopírovat)), jeden řádek se stavem, cenou a krátkými tlačítky („Zeptat se“,
„Koupit na Fleru“), řádek „Sdílet“ s ikonami (Pinterest, Facebook, WhatsApp a odkaz: na telefonu nabídka sdílení,
jinde zkopírování s hláškou „Odkaz zkopírován“, `src/lib/share-button.ts`; odkazy `shareLinks` v
`scripts/lib/share.mjs`, žádné skripty ani cookies služeb, událost GA `share`) a vpravo od nich „Na Instagramu“ (bublina „Obraz na Instagramu“)
(atribut `instagram`), pak detaily a mockupy. Na úzké obrazovce pod sebou: obraz, název a údaje, popis a štítky,
stav a cena, sdílení, detaily, mockupy.

**Zvětšení má vlastní adresu.** Klik na obraz, detail nebo mockup otevře prohlížeč fotek (popisek: u obrazu „<název> · <text díla>“ zkrácený
na `VIEWER_TEXT_MAX` znaků, `workCaption`, u detailu „<název> · <popisek detailu>“, u mockupu
„<název> · <scéna> (vizualizace)“) a zapíše zobrazený obrázek
do adresy za `#` (`scripts/lib/work-viewer.mjs`, `viewId`/`viewIndex`): `#obraz` = celý obraz, `#detail-<jméno detailu>`
(např. `/tvorba/2011/orangutan-g4psg/#detail-oci`), `#mockup-<scéna>`. Otevření přidá záznam do historie (tlačítko
Zpět prohlížeč zavře), listování šipkami nebo tahem adresu jen přepíše, zavření (×, Esc, klik vedle) kotvu odebere.
Odkaz s kotvou otevře rovnou ten obrázek; neznámou kotvu (smazaný detail, překlep) stránka z adresy odebere a ukáže
dílo normálně (kotva prvku na stránce, např. `#viewer`, zůstane). Bez JavaScriptu odkazy otevřou největší obrázek.

**ID díla** (např. `k3f9a`) vygeneruje pipeline při prvním zpracování a zapíše
ho do yaml. Už se nemění: díky němu fungují staré odkazy i po přejmenování díla
(neznámá adresa končící na `-<id>/` přesměruje na aktuální detail). Může sloužit
i jako katalogové číslo na zadní straně obrazu. ID má 5 znaků, začíná písmenem
a neobsahuje snadno zaměnitelné znaky (`0 o 1 l i`).

**Mapa webu** (`/sitemap.xml`, `src/pages/sitemap.xml.ts`, seznam adres `scripts/lib/sitemap.mjs`): úvod, statické
stránky (`STATIC_PAGES`), existující obecné textové stránky (`/kurzy/`), roky, kolekce a díla, s adresou `site.url`. Pro vyhledávače i pro kontrolu obrázků
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
| Hledání v názvech a popisech děl (každá galerie, viz *Hledání*) | `q` | `?q=ranni mlha`: každé slovo musí být částí názvu nebo popisu díla |
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
(`offersOption`; `statusOptions` dá jen volby s nějakým dílem); když nezbude žádná, filtr Stav zašedne (viz níže).
Totéž platí pro přepínač „Doporučené“ (výběr autorky): zašedne, když jsou vybraná všechna zobrazená díla, nebo žádné.
Odkaz s takovou volbou ukáže vše. Dřívější volba `?status=available` (jen k prodeji) se přečte jako `unsold`
(`STATUS_ALIASES`), sdílené odkazy dál fungují. Příklad kombinace:
`/tvorba/?collection=plener-sumava-2026&status=unsold&tag=voda`, nebo jen výběr autorky
na prodej: `/tvorba/?featured=1&status=unsold`.

**Řádek filtrů** (výběry, „Doporučené“ a počet děl) je ve formuláři první, čipy štítků pod ním. Na počítači (okno od 1280 px) se vejde vždy na jeden řádek (ověřeno i v nejhorším případě: všechny filtry, nejdelší texty a 9999 děl; ještě s odkazem „O kolekci“, který už v řádku není): výběry mají pevnou největší šířku
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

**Zrušení všech filtrů:** dokud je zapnutý aspoň jeden filtr, ukazuje počet na konci řádku výběrů „12 z 60 děl“
(`filteredCount`; bez filtru „60 děl“) a za ním odkaz „× Zrušit filtry“ v barvě akcentu. V liště je „Zrušit vše“ za
čipy, jen když jsou zapnuté aspoň dva filtry (u jednoho stačí jeho „×“), v otevřeném panelu tlačítko „Zrušit filtry“
vedle „Hotovo“ (tam odkaz u počtu není). Všechna tři vypnou najednou štítky, techniku, rok a kolekci (kde jsou to výběry),
stav, „Doporučené“ a hledání (`withoutFilters` v `scripts/lib/filter-bar.mjs`) a vrátí 1. stránku; zobrazení, velikost
dlaždic, počet na stránku a „Zobrazit vše“ zůstanou. Rok stránky roku a kolekce stránky kolekce jsou adresa, ne filtr,
takže zůstanou taky. Bez zapnutého filtru jsou všechna tři skrytá. Událost GA jako u jiné změny filtru (`gallery_filter`).
Na počítači (od 1280 px) se počet s odkazem vejde do řádku výběrů (ověřeno na testovacích datech).

**Počty a nabízené volby podle aktuálního výběru** (`facetChoices`, `facetValues`): po každé změně filtru má každá
volba výběrů Technika, Rok, Kolekce a Stav i přepínač „Doporučené“ počet děl, která by ukázala spolu s ostatními
aktivními filtry (Technika a Kolekce česky podle abecedy, `czechOrder`; sama sebe nepočítá, takže počty u jiných voleb téhož výběru říkají, co dá přepnutí; volby Stavu se
překrývají, každá se počítá zvlášť). Ve výběru zůstanou jen volby, které zobrazená díla zúží a nevyprázdní
(`offersOption` nad díly, která nechají ostatní filtry); vybraná zůstane vždy. Skryté volby se z výběru odeberou
(skrývání `<option>` Safari na iOS nerespektuje). Výběr ani přepínač bez žádné takové volby se **neskryje, ale zašedne**
(`facetDisplay`, třída `off`, `disabled`, bublina s důvodem), aby bylo vidět, že filtr nechybí: výběr místo „vše“
ukáže hodnotu, kterou mají všechna zobrazená díla (např. „akvarel (3)“), dokud jiná změna nějakou volbu nevrátí.
Stejně čipy štítků: ten, který by výběr nezúžil (mají ho všechna zobrazená díla, nebo žádné), zůstane na místě
zašedlý a nedá se kliknout. Bez JavaScriptu jsou počty ze všech děl stránky. Rok na stránce roku a Kolekce na stránce
kolekce nejsou vůbec (nahrazují je odkazy), Kolekce chybí i na webu bez kolekcí.

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
| vlastní fotka bez ořezu | celá | celá na papíře 3:2 (`public/tvorba/kolekce/<slug>/_og/`, `public/tvorba/<rok>/_og/`, `public/_og/`, vždy `og-<otisk>.jpg`) |
| `cover: <id>` bez ořezu | celé dílo | náhled pro sdílení díla (`og-<otisk>.jpg`) |
| `cover: <id>#<detail>` bez ořezu | celý detail | celý detail na papíře 3:2 (tentýž soubor jako u vlastní fotky) |
| vlastní fotka nebo `cover` + `aspect` a/nebo `focus` | ořez na `aspect` kolem `focus` | stejný ořez (tentýž soubor): při `"3:2"` (poměr náhledu) vyplní celý náhled, jiný poměr leží na papíře |
| nic (náhodně / nejnovější) | celé dílo | náhled pro sdílení prvního (nejnovějšího) kandidáta |

Chyby, které zastaví běh: vlastní fotka a `cover` zároveň, `aspect` nebo `focus` bez vybraného obrazu (náhodný),
dílo z jiného místa, rozpracované dílo, neexistující detail, neplatný `aspect` nebo `focus`. `aspect` i `focus` jsou
v kostrách prázdné. V přehledu kolekcí obal nikam
nevede (celá položka vede na kolekci).

Díla s `featured: true` jsou zároveň filtrovatelná přepínačem „Doporučené“ (`?featured=1`) a mají za názvem
nenápadnou hvězdičku `★` (na kartě v galerii i za nadpisem stránky díla; barva inkoustu palety, takže na tmavé paletě
světlá; bublina a `aria-label` „Výběr autorky“; `src/components/FeaturedStar.astro`). Na stránce díla je za `<h1>`, ne
v něm (blok `.title` má velikost a okraje nadpisu, `<h1>` v něm teče v řádku, takže hvězdička je hned za posledním
slovem): text nadpisu, titulek stránky, JSON-LD ani bublina nad obrazem ji neobsahují. Na úvodní stránce
„Nejnovější“ neopakuje dílo z úvodního obrazu (počet podle zobrazení, viz *Úvodní stránka*).

Náhodný obraz: stránka obsahuje všechny kandidáty, první viditelný a ostatní `hidden` s líně načítanými obrázky
(skryté se nestahují). Hned za nimi je malý vložený skript (`applyRandomPick` ze `scripts/lib/random-pick.mjs`),
který ještě před vykreslením ukáže náhodného, takže nic nepřeblikne. Bez JavaScriptu zůstane první. Karusel
(střídání během návštěvy) záměrně není: obrazy mají různé poměry stran a rám by „dýchal“.

Vyzkoušení (`npm run demo`): `/` a `/tvorba/2026/` náhodně (obnovuj stránku), `/tvorba/2025/` vlastní fotka
(panorama z receptu `roky/2025.jpg`, jen `focus: [20, 50]` = čtverec 1:1), kolekce: Plenér Šumava vlastní fotka (celá), Město `cover: <id>` bez
ořezu (celé dílo), Ze zahrady `cover: <id>#<detail>` s `aspect: "2:1"` a `focus` (široký ořez), Kresby náhodně
(celé, klik vede na dílo). Konkrétní obraz na úvodní stránce: do `demo-content/_index.yaml` napiš `cover: pf7ru`, s
`aspect: "3:2"` se ořízne kolem středu.

### Texty popisů: `text`, `description`, zápis `|` a formátování

Každý popis s textem na webu (dílo, kolekce, rok, úvod, „Mimo kolekce“, stránky ve `stranky/`) má **stejný vzor**:

| Atribut | Co dělá |
|---|---|
| `text` | text na stránce (`textField` ve schématu: `block`, `rich`); u díla popisek pod obrazem, u kolekce a roku nahoře na jejich stránce, u úvodu vedle velkého obrazu, u „Mimo kolekce“ v přehledu kolekcí |
| `description` | nepovinný popis pro vyhledávače a náhled odkazu (`searchDescriptionField`: zakomentovaný, `settled`), bez formátování, nejvýš `PAGE_DESCRIPTION_CHARS` = 160 znaků (`[popis-stranky-dlouhy]`); prázdný = začátek textu (`searchDescription`); „Mimo kolekce“ ho nemá (nemá vlastní stránku) |
| `closing` | jen stránky ve `stranky/`: tlumený závěrečný odstavec, formátovaný jako `text` |

- **Zápis vždy `|`** (`blockText` v `scripts/lib/metadata-yaml.mjs`): pipeline zapíše každý text blokového atributu
  (`block` ve schématu) jako `klíč: |`, ať byl v souboru jakkoli (na řádku, v uvozovkách, `>`, `>-`, `|-`). Řádky
  delší než `TEXT_WIDTH` (140 znaků) zalomí u mezery, autorčina zalomení v bloku `|` nechá, mezery na krajích řádků
  a víc prázdných řádků za sebou uklidí. Prázdný text zůstane `""` na řádku s klíčem.
- **Význam textu** (`normalizeText`, `paragraphs` v `scripts/lib/rich-text.mjs`): zalomení řádku = mezera, prázdný
  řádek = nový odstavec. Proto smí pipeline zalamovat; její kontrola „hodnota se nezměnila“ porovnává u blokových
  atributů tento význam. Web i exporty berou text vždy přes tyto funkce: HTML odstavce `textHtml` (`richParagraphs`),
  čistý řádek `plainText` / `ownText` (bez `DOPLNIT`) pro bublinu, hledání, Instagram, Fler, přehled kolekcí (karta
  je odkaz, odkaz v ní by nefungoval) a `searchDescription` pro `<meta name="description">`, JSON-LD a pin.
- **Formátování** (`text`, `closing`, `empty_closing` úvodu; `rich` ve schématu; každý popisek v `details` díla, `richMap`):
  malá podmnožina Markdownu, nikdy HTML.
  `[text](adresa)` = odkaz, `**slovo**` = tučně, `*slovo*` = kurzíva; všechno ostatní je obyčejný text (HTML se
  escapuje, osamocená hvězdička zůstane). Adresa odkazu jen `https://…`, `http://…`, `mailto:…` nebo adresa na webu
  začínající `/` (dostane základ webu přes `url`); vnější odkazy mají `rel="noopener"`. Jiná adresa (`www.fler.cz`,
  `tvorba/`, `//…`, `javascript:`) zůstane na stránce textem a v pipeline je chyba `[spatny-odkaz-v-textu]`
  (`linkProblems`). Web vkládá HTML jen z `textHtml` (`set:html`), nikdy jinak.
- **Náhled v přehledu** `export/README.md` obsahového repa: `text` a popisky detailů jako Markdown pro GitHub
  (`richTextMarkdown`): tučně, kurzíva a odkazy vypadají jako na webu, odkazy na web mají celou adresu (`siteUrl`
  z `site.url`, aby fungovaly i na GitHubu), všechno ostatní je escapované; `description` čistý jako „Google: …“.
- Kontroly všech textů najednou: `textProblems` / `allTextProblems` (`scripts/lib/content.mjs`): text, který není
  text (`[popisek-neni-text]`), špatný odkaz, dlouhý `description`.
- **Technický komentář** u `text` je strukturovaný (řádky s `  - `): jak psát, co znamená zalomení a prázdný řádek,
  a seznam formátování; u `closing` odkaz na něj.
- Do 2026-10 byl `description` text na stránce; obsah je převedený (jednorázově, i ve větvích), dnes je
  `description` vždy jen popis pro vyhledávače a nic se nepřejmenovává. Starší znění jeho komentáře zůstávají
  v `previous` (`description` i `text`), takže je pipeline pozná a nahradí.

### Text o roce

Nepovinný text autorky o roce (jaký byl, co se v tvorbě dělo) je v obsahovém repu v `roky/<rok>.yaml`
(`YEAR_SCHEMA` v `scripts/lib/schema.mjs`, pipeline `scripts/lib/years.mjs`):

```yaml
text: |
  Rok plenérů: **Šumava** v září, zahrada v létě…
# description: …    # NEPOVINNÉ: popis pro vyhledávače (jinak začátek textu)
# cover: k3f9a      # NEPOVINNÉ: úvodní obraz roku, viz Úvodní obraz (nebo vlastní fotka roky/2026.jpg)
# aspect: "3:2"     # NEPOVINNÉ, zapíná se smazáním "# ": ořez vybraného obrazu (jen s focus = "1:1")
# focus: [50, 50]   # NEPOVINNÉ: co zůstane vidět [zleva %, shora %] (jen s aspect = střed)
# private_note: …   # NEPOVINNÉ, soukromé, na web se nedostane
```

- Pipeline ke každému roku, ve kterém je nějaké dílo, sama založí kostru (`text` se vzorovou větou
  `yearSkeletonText`) a všechny popisy roků srovnává podle schématu jako ostatní popisy.
- Veřejná kopie (`text`, `description`, `cover`, `aspect`, `focus`) jde do `content/roky/<rok>.yaml`; web ji načte
  přes `getYear` (`src/lib/site.ts`, odstavce `paragraphs`). Prázdný text se nezobrazí. Popis pro vyhledávače:
  `description`, jinak text, jinak „Akvarely a kresby z roku …“.
- Jiný soubor v `roky/` než `<rok>.yaml` a `<rok>.jpg` nebo fotka roku bez díla zastaví běh chybou; texty viz
  *Texty popisů*.

### Úvodní stránka (`_index.yaml`)

Text vedle velkého obrazu na úvodní stránce a její úvodní obraz jsou v kořeni obsahového repa v `_index.yaml`
(`HOME_SCHEMA`, pipeline `scripts/lib/home.mjs`): `text`, `description` (pro vyhledávače), `heading`, `button`, `empty_text`,
`empty_closing`, `cover`, `aspect`, `focus` a `private_note`, vlastní fotka
`_cover.jpg`. Když soubor chybí, pipeline založí kostru s výchozím textem úvodu (`HOME_TEXT`, stejný jako ve skutečném obsahu), takže se
nic nezmění. Veřejná kopie je `content/_index.yaml` (web `getHome`); bez ní web ukáže výchozí text `HOME_TEXT`.
`text` je formátovaný (viz *Texty popisů*), `description` pro vyhledávače je nepovinný (jinak začátek textu).
`heading` je velký nadpis (blok `|`, každý řádek = řádek nadpisu, mezi nimi `<br>`; povinný, prázdný = chyba
`[prazdny-nadpis]`; výchozí `HOME_HEADING` „Barvy, voda / a trochu náhody“, doplní se i do existujícího souboru).
`button` = text tlačítka na tvorbu (výchozí `HOME_BUTTON` „Prohlédnout tvorbu“), `empty_text` = velká věta prázdného
webu, dokud není žádné dílo (`HOME_EMPTY_TEXT` „Obrazy tu brzy přibudou.“), obojí povinné (`[prazdny-nadpis]`);
`empty_closing` = menší formátovaná věta pod ní, kostra i doplnění do existujícího souboru dostane
`homeEmptyClosing(site.instagram)` (odkaz na Instagram ze `site.config.yaml`, předává ho `prepareHome`), prázdné = nic.
Vyzkoušení: `demo-content/_index.yaml` (nadpis „Testovací nadpis / na dva řádky“), `/`; prázdný web jen unit testy.

### Texty stránek (`stranky/`)

Texty stránek jsou v obsahovém repu ve složce `stranky/`, jeden soubor na stránku pojmenovaný její adresou
(pipeline `scripts/lib/pages.mjs`, seznam stránek `PAGES`, schémata `PAGE_SCHEMAS` v `scripts/lib/schema.mjs`):

| Soubor | Stránka | Schéma | Atributy navíc |
|---|---|---|---|
| `stranky/o-mne.yaml` | `/o-mne/` | `ABOUT_SCHEMA` | `closing` |
| `stranky/kontakt.yaml` | `/kontakt/` | `CONTACT_SCHEMA` | `location_label` (popisek nad `site.location`, výchozí „Žiji a maluji“) |
| `stranky/404.yaml` | neexistující adresa (`src/pages/404.astro`) | `NOT_FOUND_SCHEMA` | `title` (titulek v záložce), `heading` (nadpis), `closing` |
| `stranky/kurzy.yaml` | `/kurzy/`, jen dokud soubor existuje | `TEXT_PAGE_SCHEMA` | `title` (nadpis i titulek), `closing` |

| Atribut | Co dělá |
|---|---|
| `description` | nepovinný popis stránky pro vyhledávače a náhled odkazu (`<meta name="description">`, `og:description`), nejvýš `PAGE_DESCRIPTION_CHARS` = 160 znaků, bez formátování; na stránce se neukáže; prázdný = začátek textu |
| `text` | text stránky; blok `|`, prázdný řádek = nový odstavec, řádky jednoho odstavce se spojí mezerou (`paragraphs`); prázdné `""` = bez textu; s formátováním |
| `closing` | nepovinný závěrečný odstavec menším tlumeným písmem (třída `muted`); s formátováním |
| `title`, `heading`, `location_label` | povinné jednořádkové texty stránek, které je mají (prázdné = chyba) |
| `private_note` | soukromá poznámka, nikdy na web |

Texty (`text`, `closing`, `description`) se píšou a formátují jako všude, viz *Texty popisů*.

- **Pevné stránky** (O mně, Kontakt, 404): chybí-li soubor, pipeline založí kostru s textem, který stránka měla v kódu
  (`ABOUT_*`, `CONTACT_*`, `NOT_FOUND_*` v `schema.mjs`; schválené texty, proto bez `DOPLNIT`: `settled`). Bez veřejné
  kopie ukáže web tytéž výchozí texty.
- **Obecná textová stránka** (`optional` v `PAGES`, teď jen `kurzy`): žádná kostra; stránka `/<název>/` vznikne
  (`src/pages/[page].astro`, `getGenericPages`, JSON-LD `WebPage` + drobečky) a je v mapě webu (`sitemapEntries` `pages`)
  jen dokud soubor existuje. Do menu ji přidá správce v `Base.astro`. Nová obecná stránka = záznam `<název>: { schema:
  TEXT_PAGE_SCHEMA, optional: true }` v `PAGES` a `<název>: TEXT_PAGE_SCHEMA` v `PAGE_SCHEMAS`; jméno nesmí kolidovat
  s jinou stránkou webu (`tvorba`, `o-mne`, …).
- Každý běh soubory srovná se schématem jako ostatní popisy. Chyby (zastaví běh): `description` delší než 160 znaků
  (`[popis-stranky-dlouhy]`), prázdný `title` / `heading` /
  `location_label` (`[prazdny-text-stranky]`), špatný odkaz (`[spatny-odkaz-v-textu]`), hodnota, která není text
  (`[popisek-neni-text]`), veřejný text začínající `DOPLNIT` (`[doplnit-verejny]`), jiný soubor nebo složka ve `stranky/`
  (`[cizi-soubor]`).
- Veřejná kopie (všechny atributy kromě `private_note`) jde do `content/stranky/<stránka>.yaml` (jen plný běh); web ji
  načte přes `getPage` (`src/lib/site.ts`). Menu, kontakty, formulář, štítek „Chyba 404“ a fotky (`fotky/`) zůstávají ve webu.
- Vyzkoušení: `demo-content/stranky/` (`npm run demo`): `/o-mne/` (dva odstavce, první zalomený, tučně, kurzíva, odkazy,
  odkaz v `closing`), `/kontakt/` (vlastní `location_label`), libovolná neexistující adresa (texty 404 s odkazy), `/kurzy/`.

**Nejnovější a jejich zobrazení:** pod úvodem jsou nejnovější díla (bez díla z úvodního obrazu) se stejným přepínačem
zobrazení jako galerie (`ViewSwitch.astro` v záhlaví „Nejnovější“: „Velké obrazy“ / „Dlaždice“ a u dlaždic `−` / `+`),
ale **výchozí jsou střední dlaždice** a stránkování ani počet na stránku tu nejsou. Každé zobrazení ukáže tolik děl,
aby zabrala zhruba stejnou výšku, na tabletu (do 1100 px) a telefonu (do 640 px) méně (`HOME_SCREENS`, první
odpovídající, `homeScreen`). Počty jsou v `site.config.yaml` `home.recent` (`wide` = počítač, `tablet`, `phone`;
klíče `grid` = velké obrazy, `s` / `m` / `l` = dlaždice; chybějící = výchozí `HOME_RECENT`, jiná hodnota než celé
číslo ≥ 1 zastaví build, `homeRecent` v `scripts/lib/home-view.mjs`):

| zobrazení | počítač | tablet | telefon | v URL |
|---|---|---|---|---|
| velké obrazy | 6 (3 × 2) | 4 (2 × 2) | 3 (1 sloupec) | `?view=grid` |
| dlaždice velké | 20 (5 × 4) | 16 (4 × 4) | 10 (2 sloupce) | `?tile=l` |
| dlaždice střední (výchozí) | 30 (6 × 5) | 25 (5 × 5) | 24 (3 sloupce) | nic, adresa zůstane `/` |
| dlaždice malé | 63 (9 × 7) | 49 (7 × 7) | 40 (4 sloupce) | `?tile=s` |

(Výšky spočítané pro průměrný poměr stran skutečných obrazů; tablet pro šířku 1024 px.)
- **Sloupce stejné výšky** (`balanceGrid`, `balanceColumns` v `scripts/lib/view-layout.mjs`, i v galerii): díla se rozdělí do sloupců (jejich počet a šířka podle CSS zobrazení,
  `columnCount`) tak, aby sloupce končily co nejvíc stejně: nejdřív každé dílo popořadě do nejkratšího sloupce
  (nejnovější zůstanou nahoře), pak se mezi nejvyšším a nejnižším sloupcem přesouvají nebo prohazují díla, dokud to
  pomáhá; ve sloupci zůstává pořadí od nejnovějšího. Výšky se měří ze skutečného vykreslení (i s textem pod velkými
  obrazy), obrázky se kvůli tomu nemusí stahovat (rozměry jsou v HTML). Sloupce jsou `<div class="col">` v mřížce
  s třídou `balanced` (`WorkGrid.astro`); při změně šířky okna (i přechodu na jinou obrazovku s jiným počtem) a u velkých obrazů po načtení
  písem se rozložení spočítá znovu. Bez JavaScriptu zůstanou obyčejné sloupce CSS (výchozí zobrazení, 30 děl).
- **Konec sloupců a jejich pořadí** (`site.config.yaml`: `home.columns` pro úvodní stránku, `gallery.columns` pro galerii,
  roky a kolekce, každé zvlášť, `columnsFor`, `columnSettings`; chybějící = výchozí `COLUMN_DEFAULTS`, neplatná nebo
  neznámá hodnota zastaví build a chyba jmenuje místo, např. `gallery.columns.order`; dřívější společné `columns`
  v kořeni = chyba „přesunuto“):
  - `maxGap` (výchozí 2): nižší sloupec nejdřív rovnoměrně rozšíří mezery mezi svými obrazy, každou nejvýš na `maxGap` ×
    obvyklou mezeru (1 = mezery se nerozšiřují),
  - `maxTop` (výchozí 12 px): co zbude do výšky nejvyššího sloupce, rozdělí se napůl nad a pod sloupec, nahoře ale
    nejvýš `maxTop` px, ostatní zůstane dole (`columnPlan`; rozšíření = `row-gap` sloupce, místo nahoře = jeho `padding-top`),
  - `order` (výchozí `alternate`): sloupce seřazené A, B, C… podle počtu obrazů (při shodě dřív ten s novějšími)
    a poskládané zleva (`orderColumns`, `COLUMN_ORDERS`): `alternate` = první, poslední, druhý, předposlední… (A F B E C D,
    plný a prázdný střídavě), `edges` = střídavě k levému a pravému kraji (A C E F D B, nejplnější na krajích),
    `center` = střídavě vlevo a vpravo od středu (E C A B D F, nejplnější uprostřed), `none` = jak vyšly z vyrovnání.
    Nejnovější dílo tak nemusí být vlevo nahoře; pořadí uvnitř sloupce zůstává od nejnovějšího.
  - Vyzkoušení hodnot: prototyp `zarovnani-sloupcu.html` (viz *Prototypy*) s posuvníky pro `maxGap`, `maxTop` a výběrem `order`.
- **Bez přeblikávání:** zobrazení odkazu nebo paměti, počet pro telefon i sloupce nastaví vložený skript hned za mřížkou
  (`homeScript` = `startHome`, `layoutHome` a jejich pomocné funkce zkopírované jako text, proto bez importů; všechny musí být v `scripts/lib/view-layout.mjs`, protože dev server přepisuje volání importovaných funkcí na `__vite_ssr_import_…`, které by kopie ve stránce nenašla, hlídá test), ještě
  než se stránka vykreslí. Nastavení dostane v `data-view` mřížky (`homeSetup` = `viewSetup` + počty, obrazovky a
  dílo úvodního obrazu). Skript stránky (`src/pages/index.astro`) pak obsluhuje přepínač.
- Do URL se píše jen jiné než výchozí zobrazení (`homeSearch`; ostatní parametry adresy, např. `utm_*`, zůstanou),
  takže odkaz ukáže totéž. Volba se pamatuje **zvlášť od galerie** (`localStorage` `pavla.home.view` a
  `pavla.home.tileSize`; výchozí hodnoty se mažou, `homeRemember`): úvodní stránka tak může vypadat jinak než `/tvorba/`.
  Odkaz s `view` nebo `tile` má přednost před pamětí (`viewOf`), zapamatovaná volba se hned zapíše do URL.
- Stránka obsahuje tolik karet, kolik ukáže nejpočetnější zobrazení, + 1 (`homeMost`; pro případ, že je mezi nimi dílo
  z úvodního obrazu); skryté karty obrázky nestahují. HTML je ve výchozím zobrazení (i `sizes` obrázků).
- Přepnutí zobrazení pošle do Google Analytics událost `view_change` (viz *Návštěvnost*).
- Vyzkoušení: `npm run demo`, `/tvorba/2026/` (text z `demo-content/roky/2026.yaml`) a `/tvorba/2025/` (bez textu).

### Prototypy

Samostatné stránky pro hledání nastavení zobrazení děl, nad daty webu (`npm run prototypes`, `scripts/prototypes.mjs`,
`scripts/lib/prototypes.mjs`, šablony `scripts/prototypes/*.html`): zapíše je do `.prototypes/` (mimo git; jinam
`npm run prototypes -- <složka>`), otevírají se přímo z disku a obrázky berou z `public/` dat, takže fungují jen vedle
nich. Data jsou skutečná díla (`content/`, `public/` tohoto repa) nebo testovací (`SITE_DATA_DIR=.demo/site`, napřed
`npm run demo:prepare`), vždy po `npm run images` aktuální. Výpočty jsou funkce webu vložené jako text
(`PROTOTYPE_FUNCTIONS`: `columnCount`, `balanceColumns`, `columnPlan`, `orderColumns` a kamera scén `project`,
`unproject`, `lineY`, `ledgeDepth`, `circleRatio`, `aimRotation`, `cameraFromAngles`, `cameraAngles`, `lineMisfit`,
`fitCameraToLines`; musí být
samostatné, bez pomocných funkcí modulu), ikony a výchozí hodnoty ze `site.config.yaml` (`prototypeConfig`), scény
pro Instagram z `mockups/instagram/` (`prototypeScenes`), takže prototyp ukazuje přesně to, co web a pipeline.
- `zarovnani-sloupcu.html`: úvodní stránka „Nejnovější“ na počítači / tabletu / telefonu, zobrazení, varianty konce
  sloupců (dnes, rozprostřít, vycentrovat, C = web) s posuvníky `maxGap`, `maxTop`, výběrem `order` a nastavením úvodní
  stránky nebo galerie; vodítka a výšky sloupců.
- `znacky-dlazdic.html`: všechna díla v dlaždicích S, M a L, paleta, styl značky (web = silueta s lemem), ikona na
  prodej, roh a velikosti dlaždic každé značky, velikost, minimum, maximum, krytí; nastavení úvodní stránky nebo galerie.
- `kamera-scen.html`: tři scény ateliéru pro Instagram pod sebou s vybraným dílem (díla s `size_cm`) ve skutečné
  velikosti na plátně s okolím fotky („Okolí fotky“ 0–200 %, aby byly vidět úběžníky mimo ni), posuvníky kamery každé
  scény (ohnisko, zenit, azimut, natočení foťáku, vzdálenost, střed listu, pootočení nakresleného listu; tažením myší
  po scéně se střed posune; „ohnisko drží velikost listu“ mění se vzdáleností jen perspektivu). Dílo leží tam, kam ho dá pipeline
  (`planPlacement` a `workQuad` pod kamerou prototypu: na stole střed scény s posunem podle `id` a mimo rekvizity,
  na stojanu na liště na ose; čísla pod posuvníky říkají, o kolik se posunulo nebo že se nevejde), a výřez 4:5
  exportu (`sceneWindow`, vrstva „výřez 4:5“, i s přiblížením malých děl). Hrany podkladu (`lines`) protažené přes celé plátno (x červeně, y modře) s průsečíkem každé skupiny
  (kroužek), hrany díla protažené čárkovaně do úběžníků kamery (křížek): když dílo leží rovnoběžně s podkladem,
  sejdou se ve stejném bodě. „Upravovat hrany“: tažení konců, dvojklik smaže, „+ hrana x / y“ přidá, „Hrany ze
  scenes.yaml“ vrátí. Tlačítka kamery: „Z hran“ (`fitCameraToLines` od současné, volitelně s pevným ohniskem),
  „Jako pipeline“, „Z rohů listu“, „Vyrovnat natočení“ (`rollDeg: 0`). Další vrstvy: nakreslený list, list 40 × 30 cm
  touto kamerou, mřížka 10 cm v rovině listu, horizont, kroužky (`circles`: nakreslený obdélník a skutečný kruh stejné
  šířky), lišta stojanu (`ledge`, `axis`; dílo je za lištou oříznuté), překážky (předměty před dílem `front`
  vyplněně oranžově, rekvizity `props` čárkovaně fialově, volná část stolu `bounds` čárkovaně zeleně; předměty `front`
  jsou nad dílem i v čistém pohledu, jako v pipeline); fotka s prázdným listem přes scénu a krytí díla.
  Čísla: odchylka každé hrany od úběžníku kamery (px), odchylka od nakreslených rohů, výška / šířka kroužků, úhel
  spodní hrany díla proti liště, kde kamera stojí (na stole výška nad stolem, pohled dolů a poloha vůči středu listu;
  u stojanu výška nad lištou, vzdálenost před stojanem a úhel od čelního pohledu) a pod tím `prompt` scény = co po
  kameře chtělo zadání generátoru (`mockups/instagram/README.md`), ať jde obojí porovnat. Výsledek jako `lines:` a `camera: { … }` ke zkopírování do
  `scenes.yaml`. Nastavení i hrany se pamatují v prohlížeči (`pavla.prototype.sceneCamera`), jen dokud má
  scéna ve `scenes.yaml` stejné `camera` a `lines` jako tehdy (po jejich změně a `npm run prototypes` platí nové). Vpravo nahoře u každé
  scény (drží se v rohu i při posunu stránky): „Pomocné čáry: zapnuto / vypnuto“ (vypnuto = jen scéna s dílem bez čar,
  fotky s prázdným listem a průhlednosti, jak ho umístí pipeline, mimo výřez 4:5 ztmavená; tloušťku papíru a stín kreslí až pipeline) a „Obnovit
  doporučené“ (kamera a hrany jako ve `scenes.yaml`, tedy to, co dnes používá pipeline; zapomene úpravy
  té scény).
  „jen díla, která se nevejdou“ vedle výběru obrazu (pamatuje se) zúží seznam na díla, která se aspoň v jedné scéně
  nevejdou do volné části (`planPlacement` s kamerou, jak je teď v prototypu nastavená; u díla jména těch scén);
  po změně kamery se seznam srovná sám. Žádné takové dílo = „všechna díla se vejdou“.
  Nad fotkou ukazuje štítek u kurzoru jeho polohu `[x, y]` v px fotky, ve stejném tvaru jako body ve `scenes.yaml`
  (obrysy `front`, `props`, `bounds`, rohy, hrany); mimo fotku s poznámkou „mimo fotku“.
  Kliknutí (bez tažení) zkopíruje bod `[x, y]` do schránky, štítek pak ukáže „zkopírováno“; tažení o víc než pár bodů
  obrazovky dál posouvá střed listu nebo s „upravovat hrany“ konec hrany.
  Kliknutí se Shiftem bod přidá k bodům kliknutým před tím (v téže scéně) a do schránky jde celý obrys
  `[[x, y], [x, y], …]` pro `front` / `props`, štítek ukáže počet bodů; kliknutí bez Shiftu začne znovu.
  Vrstva „překážky“ kreslí i `center` (křížek) a píše k němu, ke každému bodu obrysů `front`, `props` a k rohům `bounds` jejich `[x, y]` (barvou obrysu,
  odsunuté ven od středu obrysu), takže je vidět, který bod ve `scenes.yaml` upravit. Stejně vrstva „lišta“ u obou
  bodů `ledge` (nad čarou) a u `axis`.
  Každá scéna má vpravo nahoře posuvník „Zvětšení“ (1× = celá šířka, až 8×, dvojklik vrátí 1×): zvětšuje kolem
  středu toho, co je vidět, obrázek se pak posouvá ve svém rámu. Nad obrázkem zvětšuje i Cmd (nebo Ctrl) + kolečko
  a sevření prstů na touchpadu, a to kolem místa pod kurzorem; obyčejné kolečko dál posouvá. Společné „Okolí fotky“
  přidá plochu kolem fotky.

### Hledání

Hledání (`scripts/lib/search.mjs`, pole `src/components/SearchField.astro`) je vždy, na každém výpisu:
v každé galerii (`/tvorba/`, stránka roku, stránka kolekce) v **názvech, popisech a `id`** děl (pole `#works-search`: na
`/tvorba/` vpravo od nadpisu, u roku a kolekce v úvodu pod nadpisem a textem), na přehledu kolekcí v **názvech
a popisech** kolekcí (`#collections-search` vpravo od „Kolekce“); na telefonu pod nadpisem. Text každého díla
i kolekce (`searchText`: název a popis, u díla i `id` z textu příspěvku na Instagramu, bez diakritiky, malými písmeny) se připraví už při stavbě do karty
(`data-search`), psaní ho nepřepočítává.

- Pravidla (`matchesQuery`): každé slovo dotazu musí být **částí** názvu nebo popisu (podřetězec, nikdy regulární výraz),
  bez ohledu na velikost písmen a diakritiku („stek“ najde „Štěkeň“), na pořadí slov ani mezerách nezáleží. Prázdné =
  vše. Tvary slov se nesrovnávají: „mlha“ nenajde „v mlze“ (kratší kořen „ml“ ano).
- Filtruje se už při psaní, zpět na 1. stránku, bez skoku na výsledky. Dotaz je v adrese jako `?q=` (mezery srovnané,
  nejvýš `SEARCH_MAX` = 80 znaků), odkaz jde poslat dál; v galerii se kombinuje se všemi filtry (počty u výběrů
  i štítky ho započítají) a v liště filtrů je jako čip „„ranní mlha“ ×“.
- Přesně `id` díla z galerie (jediné slovo, celé, bez ohledu na velikost písmen; `exactId`) + Enter otevře stránku díla;
  galerie s `?q=<id>` zůstane v historii (Zpět). Právě tehdy (stejné `exactId`, jen s kurzorem v poli) se pod polem ukáže
  nápověda „Enter otevře obraz“ (`hint` v `SearchField.astro`, mimo tok stránky, nic neposune). Při psaní ani u části `id` nebo `id` mezi jinými slovy se nic neotevře,
  odkaz s `?q=<id>` jen vyfiltruje.
- Statistika: událost `gallery_filter` s parametrem `q` až po dopsání (Enter, opuštění pole), ne po každém písmenu.
- „Mimo kolekce“ při hledání na přehledu kolekcí chybí (hledá se v kolekcích, ta to není); rok sleduje dál.

### Stránkování

Každý výpis děl (`/tvorba/`, stránky roků, stránky kolekcí) i přehled kolekcí `/tvorba/kolekce/` se stránkuje
(řádek pod výpisem: `src/components/Pager.astro`, odkazy `src/lib/pager.ts`). Pod
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
  návštěvy a pro ostatní výpisy děl (`localStorage`, klíč `pavla.gallery.perPage`); přehled kolekcí si ho pamatuje
  zvlášť (`pavla.collections.perPage`, `COLLECTIONS_PAGE_SIZE_STORAGE_KEY`), volba u kolekcí galerii nemění.
  Volba výchozího počtu paměť smaže. Pravidla, aby odkazy dál ukazovaly všem
  totéž:
  - odkaz s `perPage` nebo `page` v URL má vždy přednost (odkaz `?page=2` od
    někoho s 12 na stránku ukáže i tomu, kdo si pamatuje 24, stejná díla),
  - zapamatovaný počet se hned zapíše do URL (`?perPage=24`), takže
    zkopírovaná adresa odpovídá tomu, co je vidět,
  - „Zobrazit vše“ se nepamatuje, zůstává jednorázové,
  - v anonymním okně nebo při zablokovaném úložišti se nic nepamatuje a vše
    ostatní funguje.

- **Zobrazení (dlaždice):** vedle „Na stránku“ (na telefonu pod ním) jsou dvě ikony: „Velké obrazy“ (výchozí,
  sloupce s názvem, technikou a štítkem stavu) a „Dlaždice“ (malé obrazy hustě vedle sebe, šířka sloupce 150 px,
  na počítači až 6 sloupců, na telefonu 3, bez textů; údaje ukáže bublina nad obrazem). Dlaždice mají vlastní počty
  na stránku (`gallery.tilePageSizes` v `site.config.yaml`, výchozí 36, 72, 144) a vlastní paměť počtu
  (`pavla.gallery.tilesPerPage`, `pageSizeStorageKey`); přepnutí zobrazení vezme počet nového zobrazení a skočí na
  stránku s prvním dosud zobrazeným dílem (`withView`), „Zobrazit vše“ zůstane. **Velikost dlaždic:** u dlaždic
  jsou vedle přepínače tlačítka „Menší dlaždice“ / „Větší dlaždice“ (`−` / `+`, na krajích zašedlá): malé (sloupec
  110 px, na telefonu 4 sloupce), střední (výchozí, 150 px / 3) a velké (210 px / 2) (`TILE_SIZES`, `TILE_WIDTHS`,
  `stepTileSize`; třídy `tiles-s` / `tiles-m` / `tiles-l`, `sizes` obrázků podle šířky). V URL jako `tile=s` / `tile=l`
  (jen s `view=tiles`, výchozí se nepíše) a pamatuje se (`pavla.gallery.tileSize`, `viewOf`,
  `tileSizeToRemember`); odkaz s `tile` má přednost. Díla ani stránka se změnou velikosti nemění. Platí pro galerii, stránky
  roků i kolekcí (`WorkGallery.astro`, mřížka `WorkGrid.astro`, přepínač `ViewSwitch.astro` v `Pager.astro` s `views`), přehled kolekcí ho nemá;
  úvodní stránka má vlastní výchozí zobrazení a paměť (viz *Úvodní stránka*). Dlaždice jsou
  v URL jako `view=tiles` (výchozí se nepíše, jiná hodnota se ignoruje) a pamatují se jako počet na stránku
  (`localStorage`, klíč `pavla.gallery.view`): odkaz s `view`, `tile`, `page` nebo `perPage` má přednost (odkaz na 2. stránku
  ukáže zobrazení, ze kterého přišel), zapamatovaná volba se hned zapíše do URL,
  volba velkých obrazů paměť smaže. Filtry, stránka i počet na stránku se přepnutím nemění. V dlaždicích se
  obrázkům přepíše `sizes`, aby prohlížeč stahoval menší varianty. Logika: `VIEWS`, `viewFromParams`,
  `viewToRemember`, `viewPageSizes`, `withView` v `scripts/lib/gallery-filter.mjs`; které zobrazení platí (odkaz, pak
  paměť) `viewOf`, třídy, `sizes` a přepínač `showViewOf` v `scripts/lib/view-layout.mjs`.
- **Značky na dlaždicích** (`scripts/lib/tile-marks.mjs`, `WorkCard.astro`; jen v zobrazení dlaždic, na úvodní stránce
  i v galerii, u velkých obrazů je místo nich hvězdička u názvu a štítek stavu): hvězdička u výběru autorky
  (`featured: true`) vlevo nahoře na všech velikostech dlaždic a košík u díla na prodej (`isOnSale`: k prodeji nebo
  rezervováno) vpravo dole jen na středních a velkých (na malých by dvě značky rušily). Silueta v barvě písma palety
  s tenkým lemem barvy papíru (čitelná na světlých i tmavých obrazech), velikost 10 % šířky dlaždice, nejméně 12 px
  a nejvýš 22 px, krytí 90 %; ozdoba bez textu (`aria-hidden`), totéž říká bublina nad obrazem. Nastavení
  `site.config.yaml`, každé místo zvlášť: `gallery.tileMarks` (galerie, roky, kolekce: hvězdička i košík jak výše)
  a `home.tileMarks` (úvodní stránka: jen hvězdička, menší a průsvitnější: `size` 8, `min` 10, `opacity` 60,
  `sale.tiles: []`) (`tileMarksFor`, `tileMarks`, výchozí `TILE_MARK_DEFAULTS`, neplatná nebo neznámá hodnota zastaví
  build a chyba jmenuje místo, dřívější společné `tileMarks` v kořeni = chyba „přesunuto“; karta mimo mřížku děl,
  např. na stránce 404, značky nemá): `size` (% šířky), `min`, `max` (px), `opacity` (%), `featured.corner` / `sale.corner` (`tl`, `tr`, `bl`, `br`;
  dvě značky ve stejném rohu stojí vedle sebe), `featured.tiles` / `sale.tiles` (velikosti dlaždic `s`, `m`, `l`,
  `[]` = nikde) a `sale.icon` (`cart` košík, `tag` cenovka, `bag` taška). Velikost a krytí jdou do mřížky jako
  proměnné `--mark-*` (`WorkGrid.astro`), velikost dlaždice zná CSS z `.pic` (`container-type: inline-size`, jednotka `cqi`).
- **Bez přeblikávání:** zapamatované zobrazení a velikost dlaždic nastaví vložený skript hned za mřížkou
  (`viewScript` = `startView`, `viewOf` a `showViewOf` zkopírované jako text, proto bez importů), ještě než se stránka
  vykreslí; nastavení dostane v `data-view` mřížky (`viewSetup`: zobrazení, výchozí, parametry odkazu, které rozhodují
  `linkKeys`, klíče paměti, `sizes`). Skript galerie pak převezme jeho výsledek (`grid.viewState`) a vyfiltruje,
  rozstránkuje a rozloží díla. Přepínač pod díly nastaví až skript galerie (při vykreslení ještě není na stránce).
- **Sloupce stejné výšky** (`balanceGrid`, `balanceColumns` v `scripts/lib/view-layout.mjs`): zobrazená díla stránky
  (po filtrech a stránkování) se rozdělí do sloupců tak, aby končily co nejvíc stejně, stejně jako na úvodní stránce
  (viz *Úvodní stránka*); znovu po každé změně filtru, stránky, počtu na stránku, zobrazení, šířky okna a u velkých
  obrazů po načtení písem. Pořadí karet pro stránkování drží `gridCards` (sloupce pořadí v dokumentu mění). U velmi
  dlouhého seznamu („Zobrazit vše“) se díla mezi sloupci jen přesouvají, neprohazují (rychlost).
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

#krajina #mlha #voda               (štítky česky podle abecedy, jen když nějaké má)
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
| `meta_<název>` | jen obsahové repo: řídí zpracování (`meta_draft`, `meta_edge`, `meta_instagram`, `meta_instagram_grid`, `meta_pinterest`, `meta_pinterest_version`) | nikdy |
| bez prefixu (sdílené) | obě repa, stejný význam | 1:1 (`publicKeys`) |
| `private_<název>` | jen obsahové repo; vlastní `private_…` může autorka přidat kdykoli (bez `NEZNÁMÝ`, abecedně u ostatních `private_`) | nikdy |
| `derived_<název>` | jen toto repo: odvodí pipeline (z jiných atributů, umístění souboru nebo průběhu zpracování); teď `derived_modified` u díla (viz *Mapa webu*) | v obsahovém repu = chyba |

Seznam veřejných atributů se neudržuje ručně: jsou to sdílené atributy schématu (`PUBLIC_WORK_FIELDS` atd. =
`publicKeys(<schéma>)`). Přejmenovaný atribut (`renamed` ve schématu, teď `draft` → `meta_draft`) pipeline nepřevádí:
soubor se starým jménem ohlásí chybou „přejmenováno na …, přejmenuj ho“, nic v něm nezmění a nic nezveřejní.
(`instagram` byl dřív název `meta_instagram`; dnes je to odkaz na příspěvek, zapomenuté `instagram: true` ohlásí kontrola
odkazu „instagram musí být odkaz na příspěvek na Instagramu“.)

Atributy díla v pořadí, v jakém je pipeline v souboru drží (úplné znění komentářů, výchozí hodnoty:
`WORK_SCHEMA` v `scripts/lib/schema.mjs`):

| Atribut | Význam |
|---|---|
| `meta_corners` | rohy obrazu na fotce, pozadí vně nich (podlaha, zeď) bude průhledné; najde je pipeline, smí se upravit, `false` = neořezávat (viz *Ořez pozadí*) |
| `meta_draft` | `true` = rozpracované: do tohoto repa se nedostane nic (popis, obrázky), ani exporty; do veřejné kopie se nekopíruje |
| `meta_edge` | hrana díla ve scénách ateliéru pro Instagram (`EDGE_KINDS` v `scripts/lib/instagram.mjs`): `deckle` (výchozí) = papír s roztřepenou hranou (`edge` scény), `cut` = papír s čistou rovnou hranou, oba tenké (`paper.thicknessMm`), zvlněné, se zvednutými rohy; `canvas` = plátno na rámu: čistá zaoblená hrana, tlusté 2 cm, rovné, bez podkladového listu. Bok díla (tloušťka) opakuje barvu jeho okraje (papír; u plátna rozostřenou malbu), osvětlenou podle natočení ke světlu scény; v otisku díla |
| `meta_instagram` | `true` = exporty pro Instagram (výchozí `false`) |
| `meta_instagram_grid` | nepovinné (v kostře zakomentované `# meta_instagram_grid: 3x3`): mřížka na profilu Instagramu jako `<sloupce>x<řádky>`, od `1x1` do `5x5` (`parseGrid`, např. `3x3`, `2x1`, `3x1`, `1x2`, `3x4`; i `×` nebo `X`), jiná hodnota = chyba; bez hodnoty žádná; jen s `meta_instagram: true`, jen pro aplikaci (viz *Exporty*, Mřížka na profilu) |
| `meta_pinterest` | `true` = pin pro Pinterest: pin (`pin-<otisk>.jpg`) na webu a položka kanálu `/pinterest.xml` (výchozí `false`, viz *Pinterest*) |
| `meta_pinterest_version` | nepovinné (v kostře `# meta_pinterest_version: 2`): verze pinu v kanálu, celé číslo od 1 (bez něj 1, jiná hodnota = chyba `[spatna-verze-pinu]`); vyšší = nová adresa obrázku v kanálu, tedy nový pin (viz *Pinterest*, Stálá adresa v kanálu) |
| `id` | trvalý kód, doplní pipeline, NEMĚNIT |
| `date` | den vzniku (`2026-06-14`): určuje řazení i rok díla (stránky roků, adresa, složky v `pavla`) |
| `text` | popisek obrazu na jeho stránce, s formátováním (viz *Texty popisů*); i v bublině, Instagramu a Fleru jako čistý text |
| `description` | nepovinný popis pro vyhledávače, náhled odkazu a pin (jinak `text`), viz *Texty popisů* |
| `details` | popisky detailních fotek (viz *Detailní fotky*) |
| `featured` | `true` = ve **výběru autorky**: přepínač „Doporučené“ v galerii; z 10 nejnovějších vybraných (`FEATURED_PICK`) se náhodně střídá obraz nahoře na úvodní stránce, na stránce roku a úvod kolekce bez `cover`; nejnovější z nich je náhled pro sdílení (úvod, rok, kolekce) |
| `fler` | odkaz na Fler, tlačítko „Koupit na Fleru“; v náhledu exportů `export/fler/` = „✓ na Fleru“ |
| `instagram` | odkaz na příspěvek s obrazem na Instagramu (`https://www.instagram.com/…`, jiná hodnota = chyba, `isInstagramUrl`); stránka obrazu ukáže odkaz „Na Instagramu“, náhled exportů `export/instagram/` = „✓ na Instagramu“. Nezávislé na `meta_instagram` (ten řídí jen výrobu fotek) |
| `mockups` | `true` = mockupy, nezávisle na prodeji (výchozí `false`) |
| `price` | Kč, povinná u `available` a `reserved` |
| `size_cm` | `[šířka, výška]` v cm (desetinné číslo s tečkou, např. `[29.5, 40]`); drží měřítko mockupu na stěně. Na webu a v popisech pro vyhledávače s desetinnou čárkou („29,5 × 40 cm“, `formatSizeCm`), ve strukturovaných datech jako číslo |
| `status` | `available` \| `reserved` \| `sold` \| `gifted` \| `not-for-sale` |
| `support` | podklad, nepovinné |
| `tags` | štítky (filtr v galerii) |
| `technique` | technika (filtr v galerii); komentář nabízí nejčastější: akvarel, brush pen, tisk z výšky, kresba tužkou. Kostra nemá výchozí hodnotu (`technique: DOPLNIT`): dílo se nezveřejní, dokud ji lidé nevyberou (`todoProblems`) |
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

**Instagram na vyžádání:** fotky pro Instagram (s popiskem, ve scénách ateliéru a detaily,
viz *Exporty*) vzniknou jen u díla s `meta_instagram: true`. Výchozí je `false` (kostra ho tak zapisuje). Přepnutí
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
`text` = prázdné…) a **technický komentář** (typ, povolené hodnoty, příklady; atribut s pevnými
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
    (starší znění z `previous` pozná a nahradí; jeho kopie hned nad ním, např. po běhu se starším schématem, smaže),
  - každý text blokového atributu (`block: true` ve schématu: `text`, `description`, `closing`, `heading`,
    `empty_closing`) zapíše jako blok `|` s řádky do 140 znaků (`blockText`, viz *Texty popisů*); význam textu se
    nezmění. `text` nové kostry je vždy blok `|`, aby se text psal rovnou na správné místo s odsazením: dílo
    `DOPLNIT popisek` (rozpracované dílo smí, zveřejnění ho odmítne), kolekce `COLLECTION_SKELETON_TEXT`, rok
    `yearSkeletonText(<rok>)`, „Mimo kolekce“ `UNCOLLECTED_SKELETON_TEXT` (vzorové věty bez `DOPLNIT`: jsou veřejné hned
    a `DOPLNIT` by zastavilo běh); existující soubor bez popisu dostane dál `missing` (`null`/`""`),
  - text napsaný pod `klíč:` / `klíč: |` bez odsazení (častá chyba) pozná `unindentedText` a `yamlProblem` napíše
    místo obecné „chybný zápis YAML“ přesnou hlášku s ukázkou („text: text pod „text:“ musí být odsazený
    (řádek 5); správně je …“); funguje pro dílo, kolekci, rok, úvod, „Mimo kolekce“ i fotky,
  - `DOPLNIT` nechá, dokud ho člověk nesmaže (znamená „hodnotu zkontrolovat“), sám ho nikdy neodstraní,
  - vlastní komentář nad atributem nechá, nad technickým; blok, který je přesně technickým komentářem některého
    atributu (i starší znění, i s `DOPLNIT`), ale vlastním komentářem není (`withoutTechnical`), smaže: typicky
    komentář smazaného atributu (např. `meta_corners`), který by jinak zůstal nad dalším a po znovudoplnění atributu
    byl v souboru dvakrát; totéž platí pro komentář úplně nahoře. Kolik jich uklidil (`stray` z `normalizeMetadata`),
    ukáže souhrn běhu u souboru ve „Srovnaných popisech“ („uklizené zbloudilé komentáře: 2“),
  - neznámý atribut (např. překlep `mockup:`) nesmaže, dá ho na konec a označí komentářem `NEZNÁMÝ atribut…`;
    na web se nedostane,
  - **atribut s konečnou výchozí hodnotou** (ve schématu `settled: true`: `meta_draft`, `meta_edge` (`deckle`), `tags`, `meta_instagram`, `meta_pinterest`, `mockups`,
    `featured`, u stránek `description`, `text`, `closing`, `title`, `heading`, `location_label`, u úvodu `heading`) nikdy nedostane `DOPLNIT` (ani v kostře, ani při doplnění), starý `DOPLNIT` u něj zmizí; souhrn běhu
    ho hlásí jako „doplněno … (výchozí hodnota)“,
  - **zakomentovaný nepovinný atribut** (ve schématu `commented: true` a ukázková hodnota `example`; teď `support`,
    `details`, `price`, `fler`, `instagram`, `meta_instagram_grid` a `private_note` díla, `cover`, `aspect`, `focus` a `private_note` kolekce, roku
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
61 děl (60 publikovaných, 1 rozpracované) z let 1998–2026 s mezerami, 16 kolekcí, 31 štítků a 3 zástupné fotky
v `demo-content/`, zobrazené přes `npm run demo`.

| Funkce | Kde ji testovací data ukazují |
|---|---|
| roky | 25 let od 1998 do 2026 s mezerami (chybí 2004, 2008, 2013, 2022): 2026 (9 publikovaných), 2025 (6), 2005, 2011, 2016, 2019 (po 4), 2000, 2023, 2024 (po 3), 2006, 2021 (po 2), ostatní po jednom díle; kostry `demo-content/roky/<rok>.yaml` bez textu (kromě 2025 a 2026) |
| kolekce přes víc let a starší kolekce | Skicák 1998–2003 (4 díla ve 4 letech), Tatry 2000, Portréty 2005, Plenér Krkonoše 2006, Z cest 2009–2012 (Vinice na prodej), Podzim v lese 2011, U moře 2014–2015, Ptáci za oknem 2016, Zátiší 2017–2020, Noční město 2019, Řeky 2021–2023 (2021 a 2023), Louky 2024 |
| roky na jeden řádek | `/tvorba/`: na počítači část let a „<rok>–1998 ▾“, v úzkém okně (DevTools → režim zařízení) méně; klik rozbalí, „▴ méně“ (tatáž šipka otočená) sbalí; `/tvorba/1998/` začne rozbalený; totéž čipy na `/tvorba/kolekce/` (roky kolekcí) |
| stránkování | `/tvorba/` má 60 děl = 5 stránek po 12, 3 po 24, 2 po 48; stránky roků (nejvýš 9 děl) se nestránkují |
| rozpracované dílo (`meta_draft`) | Rozpracovaný obraz: nesmí být nikde na webu |
| `available` (14) | Pivoňky, Zimní sad, Ráno u rybníka, Město v dešti, Náměstí v mlze, Máky, Bouřka nad polem, Na podlaze, Vinice, Lesní cesta, Čáp u rybníka, Oblaka, Sázava, Louka s kopretinami |
| `reserved` (4) | Kočka na okně, Modravské slatě, Rybník v zimě, Kostel za soumraku |
| `sold` (16) | Jablka na stole, Šumava v mlze, Nádraží a 13 starších (např. Štrbské pleso, Buky, Most v noci, Seno) |
| `gifted` (7) | Lípa u kaple, Kočka na plotu, Hruška, Cibule, Smrky pod štítem, Rybář, Podzimní alej |
| `not-for-sale` (17) | Kytice z louky, Kvilda skica, Slunečnice a 14 dalších (např. Babička, Houby, Lampy, Gerlach) |
| techniky | akvarel (35), kresba tužkou (8), akvarel a tuš (6), kvaš (5), pastel (3), linoryt (1, Lípa u kaple) |
| tagy (31, nerovnoměrně) | hodně: krajina (28), voda (15), město (12); středně: léto (9), zátiší (7), květiny (6), podzim, hory, plenér (po 5), ulice, zima, řeka, strom, les (po 4); málo: déšť, zvířata, ovoce, noc, světla, portrét, ptáci (po 3), loď, louka, nebe, sníh (po 2), jaro, kostel, květina, mlha, most, západ slunce (po 1) |
| `featured` (výběr autorky, 15 děl, v 8 ze 16 kolekcí a 3 bez kolekce) | Máky, Ráno u rybníka, Šumava v mlze, Nádraží, Rybník v zimě… (2026 a přelom roku), Pivoňky, Zimní sad, Kočka na okně, Jablka na stole (2025), Louka s kopretinami (2024), Vltava u Zbraslavi v podvečerním světle (dlouhý název: na stránce díla se zalomí a hvězdička zůstane vpravo u prvního řádku), Oblaka, Čáp u rybníka, Buky, Babička: úvodní stránka náhodně střídá 10 nejnovějších (po Louku s kopretinami, `FEATURED_PICK`), `/tvorba/?featured=1` ukáže všech 15; kolekce bez vybraných: Skicák, Tatry, Krkonoše, Z cest, U moře, Zátiší, Noční město, Město 2026 |
| text o roce s formátováním | `/tvorba/2026/` (`demo-content/roky/2026.yaml`), `/tvorba/2025/` s kurzívou a tučným písmem |
| text díla s formátováním (dva odstavce, tučně, odkaz) a vlastní `description` pro vyhledávače | Pivoňky (`demo-content/tvorba/demo-zahrada-2025/demo-pivonky.yaml`): `<meta name="description">` jiný než text |
| odkaz v textu kolekce; v přehledu kolekcí čistý text | Ze zahrady 2025 (`/tvorba/kolekce/demo-zahrada-2025/`, `/tvorba/kolekce/`) |
| tlačítko „Koupit na Fleru“ | Máky |
| export pro Instagram (`meta_instagram: true`, asi čtvrtina děl) | Ráno u rybníka (+ 2 detaily), Pivoňky (+ 1 detail, na výšku), Kytice z louky (+ 1 detail, není na prodej; `meta_edge: cut`: ve scénách čistá rovná hrana), Máky (`meta_edge: canvas`: ve scénách plátno tlusté 2 cm s okrajem v barvách malby), Na podlaze (průhledný ořez podlahy), Lípa u kaple (20 × 15: scény se přiblíží), Zimní sad (50 × 35: na stoly se nevejde, v logu „does not fit the free part of the scene“, `scene-stul-*.jpg` chybí; panorama 2 snímky; na stojanu posunutý po liště do fotky), Oblaka (60 × 20: panorama 3 snímky, mřížka 3; na stojanu širší než fotka, „does not fit into the photo of the scene stojan“; na stoly se taky nevejde, takže žádný `scene-*.jpg`), Hřeben nad údolím (70 × 50: nevejde se nikam, na stojanu přes sklenici a okraj fotky, „does not fit into the photo“; žádný `scene-*.jpg`); ostatní díla žádný. Mřížka na profilu: Pivoňky (`meta_instagram_grid: 3x3`), Oblaka (`3x1`) a Ráno u rybníka (`2x1`, dvojice). Panorama: Na podlaze, Ráno u rybníka, Zimní sad (2 snímky), Oblaka (3); Máky, Kytice z louky (čtverec) a Pivoňky (na výšku) žádné. Příběh `story.jpg` má každé |
| pin pro Pinterest | pin (`pin-<otisk>.jpg`) má každé zveřejněné dílo („Uložit na Pinterest“ ho nabídne); `meta_pinterest: true` u Ráno u rybníka, Pivoněk (na výšku, `meta_pinterest_version: 2`: `feedVersion: 2` v `info.json`) a Oblak (60 × 20: popisek hned pod obrazem) = `pin.feed` v `info.json` a 3 položky v `/pinterest.xml` (obrázek z `pin.feedFile`) |
| `mockups: true`, na prodej | Ráno u rybníka (+ detaily), Zimní sad, Město v dešti, Náměstí v mlze, Kočka na okně, Rybník v zimě, Na podlaze |
| `mockups: true`, ne na prodej | Kytice z louky (+ detail), Slunečnice, Šumava v mlze (prodáno) |
| `mockups: false` | Pivoňky (na prodej, + detail), Bouřka nad polem, Modravské slatě (na prodej), Kvilda skica, Nádraží (prodáno), Máky (na prodej), Lípa u kaple, Jablka na stole (prodáno), Rozpracovaný obraz |
| `DOPLNIT` a neznámý atribut (`NEZNÁMÝ`) | Rozpracovaný obraz (`mockup: true` je schválně překlep) |
| mockupy malého díla (≤ 35 cm) / většího | Kočka na okně / Zimní sad |
| mockupy plátna (`meta_edge: canvas`, bez pasparty, rám podle scény: ložnice stínový rám, polička a pracovna výchozí; nadpis „Jak by mohl vypadat na zdi“, poznámka „Vizualizace…“) | Slunečnice (35 × 35, `support: plátno`, + 2 detaily) |
| detailní fotky | Ráno u rybníka (2, s popisky v opačném pořadí než soubory: na stránce první Rákos), Kytice z louky (1, bez popisku), Pivoňky (1 široký), Slunečnice (2, plátno s mockupy) |
| kolekce: vlastní úvodní fotka (panorama, celá) | Plenér Šumava 2026 |
| kolekce: `cover: <id>#<detail>` + `aspect: "2:1"` + `focus` | Ze zahrady 2025 (detail Pivoněk) |
| kolekce: `cover: <id>` (celé dílo) | Město 2026 (Město v dešti, ne nejnovější Náměstí v mlze) |
| kolekce bez `cover` = náhodně z výběru autorky, celé | Kresby, pastely a kvaš 2025–2026 (všechny 4 obrazy vybrané; náhled pro sdílení Nádraží) |
| rok: vlastní úvodní fotka, jen `focus` (ořez 1:1) | 2025 (`demo-content/roky/2025.yaml`, panorama `roky/2025.jpg`) |
| úvodní stránka: text z `_index.yaml`, náhodný obraz | `demo-content/_index.yaml` |
| kolekce přes víc let a přelom roku | `demo-kresby-2025-2026/`: Kočka na okně, Jablka na stole (2025), Rybník v zimě (prosinec 2025), Nádraží (únor 2026) |
| filtr roku na přehledu kolekcí | `/tvorba/kolekce/`: 2026 (3 kolekce: Město, Plenér Šumava, Kresby), 2025 (2: Ze zahrady, Kresby); Kresby jsou v obou letech: s rokem 2025 „3 z 4 děl“ a odkaz `?year=2025`, ostatní celé v jednom roce bez roku v odkazu; „Kolekce“ na `/tvorba/2025/` vede na `/tvorba/kolekce/?year=2025`; „← Kolekce“ z Kresby otevřených z přehledu s 2025 vede zpět na `?year=2025`, i po prokliku na dílo a zpět na kolekci (viz *Návrat do výpisu*); výběr Rok u kolekcí přes víc let (Kresby: 2025 (3), 2026 (1); dále Skicák, Z cest, U moře, Zátiší, Řeky), ostatní testovací kolekce jsou z jednoho roku |
| díla bez kolekce (12 zveřejněných), volba Kolekce „žádná“ | Zimní sad, Slunečnice, Máky, Bouřka nad polem, Lípa u kaple, Na podlaze, Zahrada po dešti, Kočka na plotu, Osamělý strom, Podzimní alej, Lodky na břehu, Oblaka, Rozpracovaný obraz; `/tvorba/?collection=none` (12 děl, v liště „bez kolekce ×“); s technikou „kresba tužkou“ „žádná“ zmizí (žádná kresba není bez kolekce) |
| ořez pozadí (podlaha): rohy listu najde pipeline (průhledné okolí na webu, papír v JPEG a na Instagramu, bílá pro Fler, mockupy bez podlahy) | Na podlaze (list vyfocený nakřivo, recept `floor` v `demo-content/images.yaml`) |
| ořez pozadí: list na světlé zdi (zeď s pozvolným úbytkem světla a stínem kolem listu) | Na zdi (recept `wall` v `demo-content/images.yaml`; rohy najde pipeline jako světlé pozadí) |
| ořez pozadí: rohy zadané ručně | Bouřka nad polem (`meta_corners` v `demo-content/`) |
| ořez pozadí vypnutý (`meta_corners: false`) | Lípa u kaple |
| náhled ořezu rozpracovaného díla | Rozpracovaný obraz (`.demo/site/.previews/` v plné velikosti, `.demo/content/export/draft/` zmenšený s `README.md` a přehledem), zveřejněná díla náhled nemají |
| rohy bez podlahy (všechny nuly, nic se neořezává; i obraz s barvou až do kraje) | ostatní díla |
| soukromá poznámka | Ráno u rybníka, Jablka na stole, kolekce Plenér Šumava 2026 |
| vlastní `private_…` atribut (bez `NEZNÁMÝ`, abecedně mezi `private_`, nikdy na web) | Máky (`private_kupec`) |
| `meta_…` atributy na začátku, sdílené (`id` první, abecedně), `private_…` na konci | každý popis v `demo-content/` |
| `derived_modified` ve veřejné kopii, `lastmod` v mapě webu | každé dílo v `.demo/site/content/tvorba/`, `/sitemap.xml` |
| strukturovaná data: druh díla `artform` malba / kresba / grafika, `keywords` ze štítků | Máky (malba), Nádraží (kresba), Lípa u kaple (grafika, linoryt) |
| strukturovaná data: obraz na prodej jen s dostupností (`InStock` / `LimitedAvailability`), bez ceny | Máky (`available`), Kočka na okně (`reserved`) |
| stránka 404 s výběrem autorky | libovolná neexistující adresa, např. `/tvorba/nic/` (v `npm run demo`) nebo `.demo/site/dist/404.html` |
| fotky stránek | zástupné `o-mne-uvod` (s `focus`), `portret` a `kontakt` |
| texty stránek (`description`, odstavce `text`, tlumený `closing`, formátování a odkazy, `location_label`, texty 404) | `demo-content/stranky/o-mne.yaml`, `kontakt.yaml`, `404.yaml`; `/o-mne/`, `/kontakt/`, neexistující adresa |
| obecná textová stránka jen se souborem (`optional`), v mapě webu | `demo-content/stranky/kurzy.yaml`; `/kurzy/`, `/sitemap.xml` |
| nadpis úvodní stránky na dva řádky (`heading`) | `demo-content/_index.yaml`; `/` |
| doporučení „vzorová věta z kostry“ (`sampleAdvice`) | v kopii testovacích dat nastav `text` kolekce na „Toto je moje nejvíc nejoblíbenější kolekce.“ a spusť `npm run demo:prepare` (log `? advice:`), pak `git checkout demo-content/` |
| doporučení v souhrnu běhu: bez štítků, popis s malým písmenem a bez tečky / popisky detailů bez tečky / na prodej bez mockupů / text kolekce bez tečky / popis a popisek fotky bez tečky | Rozpracovaný obraz / Ráno u rybníka, Pivoňky / Máky, Bouřka nad polem, Modravské slatě, Pivoňky / Město 2026 / fotky stránek |
| zrušení filtrů | `/tvorba/`: vyber techniku a štítek, vpravo „N z 60 děl × Zrušit filtry“; klik vrátí všechna díla i „60 děl“ a 1. stránku, dlaždice a počet na stránku zůstanou. `/tvorba/2025/`: rok zůstane. Lišta po posunu: se dvěma filtry „Zrušit vše“, s jedním ne. Panel „Upravit“: „Zrušit filtry“ vedle „Hotovo“. |
| lišta filtrů při posunu nahoru, panel „Upravit“ (na úzké obrazovce zespodu) | `/tvorba/` (60 děl, stránka je dost dlouhá); úzká obrazovka: DevTools → režim zařízení |
| počty u výběrů podle aktuálního výběru, skryté prázdné volby a filtry | `/tvorba/`: technika „kresba tužkou“ (8 děl, Kolekce jen Kresby…, Skicák (po 2), Plenér Šumava, Portréty, Ptáci, Tatry (po 1), bez „žádná“), + kolekce Kresby, pastely a kvaš (2 díla; přepínač Doporučené zmizí, oba obrazy jsou vybrané); štítek „krajina“: Technika jen akvarel (25), kresba tužkou, kvaš, linoryt |
| výběr více štítků („a zároveň“): čipy se zapínají a vypínají, aktivní zůstanou jen ty, které výběr zúží, ostatní zašednou | `/tvorba/`: „krajina“ (30 děl, 17 aktivních čipů), + „voda“ (10 děl, aktivní hory, jaro, léto, plenér, ptáci, řeka, zima), + „řeka“ (2 díla, aktivní jaro a léto), „Vše“ zruší |
| dlouhý text zalomený do bloku `|` s řádky do 140 znaků (`blockText`, význam se nemění) | `demo-content/tvorba/demo-kresby-2025-2026/_index.yaml`: text delší než 140 znaků v bloku `|` se dvěma řádky; další běh ho nemění |
| péče o web v „Doporučení“ (`careAdvice`, `photoSizeAdvice`, `featuredAdvice`; stáří z gitu jen na skutečném obsahu) | `npm run demo` (log `? advice:`): díla bez rozměru nebo popisu, malé fotky a stránky s málo obrazy ve výběru autorky, podle toho, co testovací data mají |
| zakomentovaný údaj, který není nepovinný, v „Ke kontrole“ (`commentedOutReview`) | `npm run demo` (log `! commented-out attribute:`): `tvorba/demo-rozpracovane.yaml: řádek „# title: Pracovní název“ …` |
| zbloudilý technický komentář uklizený a spočítaný (`stray`) | v `demo-content/tvorba/demo-na-podlaze.yaml` smaž řádky `meta_corners:` s hodnotami (komentář nech) a spusť `npm run demo:prepare`: rohy se najdou znovu s jedním komentářem, log ukáže `… demo-na-podlaze.yaml: uklizené zbloudilé komentáře: 1`; pak `git checkout demo-content/tvorba/demo-na-podlaze.yaml` |
| „Zbývá doplnit“: atributy s `DOPLNIT` u komentáře (`todoAdvice`) | `npm run demo` (log `? to fill in:`): `tvorba/demo-rozpracovane.yaml: date, technique` a roky bez textu (např. `roky/2023.yaml: description`) |
| hledání v názvech, popisech a `id` děl | `/tvorba/`: pole vpravo od „Tvorba“, „most noc“ → Most v noci (`?q=most+noc`, v liště čip „„most noc“ ×“), „df9aa“ → Most v noci podle `id`, Enter otevře jeho stránku; `/tvorba/kolekce/demo-plener-sumava-2026/`: pole pod textem kolekce, „mlha“ → Ráno u rybníka (slovo jen v popisu), Šumava v mlze ne (jiný tvar) |
| combobox Kolekce | `/tvorba/`: klik do „Kolekce“, napiš „plener“ → vše, žádná, Plenér Krkonoše 2006, Plenér Šumava 2026 (podle abecedy), ↓ a Enter vybere Krkonoše (`?collection=demo-plener-krkonose-2006`), Esc zavře seznam a vrátí vybranou; „xyz“ nechá jen vše a žádná |
| přehled kolekcí: pořadí, stránkování, hledání | `/tvorba/kolekce/`: 16 kolekcí + „Mimo kolekce“ = 2 stránky po 12 (Město 2026 první, „Mimo kolekce“ poslední na 2. stránce), „Na stránku“ 24 = vše na jedné (paměť `pavla.collections.perPage`, galerie se nezmění); hledání „plener“ → Plenér Šumava 2026 a Plenér Krkonoše 2006, „strbskym“ → Tatry 2000 (slovo jen v popisu), „mimo“ → „Hledání neodpovídá žádná kolekce.“ |
| zašedlé filtry místo schovaných | `/tvorba/2000/`: Kolekce zašedlá s „Tatry 2000 (4)“, „Doporučené (0)“ a čip „#krajina“ zašedlé, Technika a Stav aktivní; `/tvorba/2007/` (jedno dílo) vše zašedlé |
| doporučení ke štítkům v souhrnu: jeden štítek ve dvou tvarech / dva štítky vždy spolu / čipy přes 2 řádky; statistika štítků | „květiny“ a „květina“ (Pivoňky) / „noc“ a „světla“ (Noční město 2019) / 31 štítků asi na 3 řádky, kandidáti jen u jednoho díla; výpis `npm run demo:prepare` (`? advice: Štítky: …`) |
| filtr bez zbytečných voleb: Stav jen „na prodej“, bez Výběru autorky (všechna díla vybraná) / bez filtru Stav | Ze zahrady 2025 / Kresby, pastely a kvaš 2025–2026 / Město 2026 |
| řádek filtrů na jeden řádek, zkrácená volba, „Na stránku“ pod díly | `/tvorba/?collection=demo-kresby-2025-2026`: „Kresby, pastely a kva…“, rozbalený výběr ukáže celý název; `/tvorba/` dole vpravo „Na stránku“, při filtru s nejvýš 12 díly zmizí |
| doporučení: dlouhý název kolekce | Kresby, pastely a kvaš 2025–2026 (32 znaků); dlouhou techniku testovací data nemají, pokrývají ji testy |
| „Mimo kolekce“ na přehledu kolekcí, `cover` + `aspect`, `text` | `/tvorba/kolekce/` poslední položka (12 děl, úvodní obraz Oblaka oříznutý na 3:2 a vlastní text z `demo-content/tvorba/_index.yaml`) → `/tvorba/?collection=none`; s rokem 2019 „1 z 12 děl“ a odkaz s `&year=2019` |
| bublina nad obrazem: s popisem a stavem / detail jako úvodní obraz / vlastní fotka bez bubliny | Máky v galerii / Ze zahrady 2025 / Plenér Šumava 2026 |

### Kontroly (pipeline při chybě nic nezveřejní)

- `title` nechybí a `date` je den (`2026-06-14`); rok díla se bere z něj,
- dílo nemá pole `collection:` (kolekci určuje složka),
- `id` je platné a unikátní, `size_cm` jsou dvě kladná čísla (u publikovaných děl),
- dílo `available` nebo `reserved` má `price` (kladné číslo),
- atribut s pevnými možnostmi (`options` ve schématu: `status` = `available` | `reserved` | `sold` | `gifted` | `not-for-sale`,
  `meta_edge` = `deckle` | `cut` | `canvas`, `meta_draft`, `meta_instagram`, `meta_pinterest`, `mockups`, `featured` = `true` | `false`) má jen jednu z nich, i u rozpracovaného díla
  (`optionProblems` v `scripts/lib/schema.mjs`; chybějící = výchozí); jinak chyba „status „availble“ není mezi
  možnostmi: available, reserved, sold, gifted, not-for-sale“,
- `meta_corners` je `false`, nebo `photo` (rozměr fotky, musí sedět s fotkou) a rohy `tl`, `tr`, `br`, `bl` jako dvě celá
  nezáporná čísla, nejvýš čtvrtinu fotky od jejího rohu (viz *Ořez pozadí*),
- `collection` je slug (malá písmena, číslice, pomlčky), kolekce má `title`,
- `cover` kolekce je `id` publikovaného díla této kolekce (případně `#` a jeho existující detail) a kolekce nemá zároveň vlastní úvodní fotku, `aspect` (`šířka:výška`) a `focus` (`[x, y]` 0–100) kolekce, roku i úvodu jsou jen u vybraného obrazu (`cover` nebo vlastní fotka),
- `focus` fotky je `[x, y]` v rozsahu 0–100,
- každý klíč v `details:` odpovídá existující detailní fotce a popisek je text,
- žádný veřejný atribut nemá text začínající `DOPLNIT` (`title`, `text`, `description`, štítek v `tags`, popisek v `details`…;
  `todoTexts`), např. nástřel popisku detailu z kostry: u díla jen zveřejňovaného (`meta_draft: false`, `validateWorks`),
  u kolekce, roku, úvodní stránky a fotky stránky vždy (`placeholderProblems` v `scripts/lib/content.mjs`),
- soubory ve složkách mají známý typ, detailní složka patří k existujícímu dílu,
- dva soubory nemíří na stejný slug.

## Detailní fotky díla

Zajímavé výřezy obrazu (detail tahu, textura papíru, konkrétní část) se ukážou
na detailu díla pod popisem a stavem (mockupy jsou až pod nimi) a jdou i na Instagram.
Každý náhled je `<figure>`: obrázek je odkaz do prohlížeče fotek, popisek pod ním `<figcaption>` mimo ten odkaz,
formátovaný (`detailCaptionHtml`, viz *Texty popisů*), takže odkazy v popisku fungují; bublina, `alt` a popisek
v prohlížeči fotek mají čistý text (`detailCaption`).

**Kam je dát:** do podsložky vedle master fotky, pojmenované přesně jako dílo:

```
tvorba/2026-plener-sumava/rano-u-rybnika.jpg        master
tvorba/2026-plener-sumava/rano-u-rybnika.yaml       popis
tvorba/2026-plener-sumava/rano-u-rybnika/1-mlha.jpg detail 1
tvorba/2026-plener-sumava/rano-u-rybnika/2-rakos.jpg detail 2
```

- Název složky = název yaml díla (bez `.yaml`). Složka bez díla je chyba.
- Ve složce smí být jen fotky (`jpg`, `png`, `tif`, `webp`; `.jpeg` a velká písmena odmítne kontrola jmen). Soubory
  začínající tečkou se ignorují, jméno s `_` je chyba `[neplatne-jmeno]`.
- **Pořadí** na stránce díla (náhledy i listování v prohlížeči fotek) je pořadí popisků pod `details:`
  (`orderDetails`, `workDetails`); fotky bez popisku následují podle názvu souboru (abecedně). Bez popisků tedy
  rozhoduje název souboru, proto se hodí číslo na začátku.
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
a export `export/instagram/[<kolekce>/]<slug>/detail-<jméno>.jpg` (celý rámeček
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

Exporty každého díla leží ve složce na stejném místě jako jeho popis v `tvorba/`: `export/<platforma>/[<kolekce>/]<slug>/`
(`exportFolder`, názvy souborů `exportFileName` v `scripts/lib/works.mjs`). Cílová složka je u díla na prodej nebo
s `meta_instagram: true` součástí otisku: přesun díla do jiné kolekce ho přegeneruje do nové složky.

- exporty děl, která z obsahového repa zmizela, přejmenovala se nebo se přesunula do jiné kolekce,
- exporty detailních fotek, které dílo už nemá,
- Fler exporty mockupů scén, které dílo už nemá (podle `info.json`),
- všechny Fler exporty díla, které není na prodej,
- exporty pro Instagram díla, které nemá `meta_instagram: true`,
- exporty pro Instagram scén ateliéru, které už nejsou (podle `mockups/instagram/scenes.yaml`), a palet, které už nejsou,
- exporty v dřívějším plochém uspořádání podle roku (`export/<platforma>/<rok>/<slug>-<id>….jpg`, včetně starých
  `-clean.jpg` a `-wall.jpg` pro Instagram).

Ve složkách děl úklid maže jen soubory, které pipeline zapisuje (`EXPORT_FILES`: Instagram `caption-*`, `scene-*`,
`detail-*`, `README.md` a dřívější `post.txt`; Fler `original.jpg`, `mockup-*`, `README.md`). Cokoli jiného (vlastní poznámky) nechá být. Běh s jedním
dílem (`npm run images -- <slug>`) nic nemaže. Smazané soubory jsou v logu (`- removed export/…`) a v souhrnu běhu
na GitHubu. Logika: `planFolderPrune` v `scripts/lib/works.mjs`.

| Platforma | Kdy | Soubory |
|---|---|---|
| Instagram | jen dílo s `meta_instagram: true` | složka díla `export/instagram/[<kolekce>/]<slug>/` (stejná cesta jako popis v `tvorba/`, `exportFolder` v `scripts/lib/works.mjs`): `caption-<paleta>.jpg` (dílo s popiskem na papíru každé palety webu: `papir`, `pergamen`, `noc`), `scene-<scéna>.jpg` (dílo ve scéně ateliéru: `stul-tmavy`, `stul-svetly`, `stojan`; jen dílo s `size_cm`), `pano-<n>.jpg` (panorama pro karusel, jen široká díla), `detail-<jméno>.jpg` (každý detail; dlouhý úzký jako panorama `detail-<jméno>-pano-<n>.jpg`), vše 4:5 (1080 × 1350), `story.jpg` (příběh 9:16), `grid-<n>.jpg` + `grid-preview.jpg` (mřížka na profilu, jen s `meta_instagram_grid`) a `README.md` (náhled s textem příspěvku). **Nikdy mockupy webu.** |
| Fler | jen `available` a `reserved` | složka díla `export/fler/[<kolekce>/]<slug>/`: `original.jpg` (originál), `mockup-<scéna>.jpg` (každý mockup), vše s vodoznakem, a `README.md` (náhled). |

Průhledné okolí díla (podlaha vně rohů listu, viz *Ořez pozadí*) dostane v exportu barvu: pro Instagram
papír palety (snímek s popiskem) nebo scénu ateliéru, pro Fler bílou (`images.fler.background`, výchozí `#ffffff`);
mockupy ukazují jen holý papír.

### Instagram: snímky s popiskem a scény ateliéru

Kód: `scripts/lib/instagram.mjs`, nastavení `images.instagram` v `site.config.yaml`, scény
`mockups/instagram/`, písma `fonts/`. Autorka si z nich vybere, co zveřejní (příspěvek s víc fotkami = karusel:
nejdřív snímek s popiskem, pak panorama, scéna, detaily; README složky to tak řadí).

- **Ořez:** dílo se pro Instagram nejdřív ořízne o `insetPercent` (výchozí 0,5 %) z každé strany, protože
  nedokonalé rohy listu (`meta_corners`) občas nechají u okraje proužek podlahy. Až budou rohy spolehlivé, stačí `0`.
- **Snímek s popiskem** (`caption-<paleta>.jpg`): pro každou paletu webu (`PALETTES` v `scripts/lib/palettes.mjs`)
  dílo na jejím papíru, okraj `padding` (výchozí 2,5 % šířky; mřížka profilu na Instagramu ořízne asi 3 % z boku),
  dole tenká linka (`line` palety), vlevo název (Cormorant Garamond kurzívou, `ink`) a pod ním
  „technika · rozměr · rok“ (Work Sans, `inkSoft`), vpravo adresa webu ze `site.url` bez `https://`.
  Dlouhý název se zkrátí „…“. Písma jsou v repu (`fonts/`, licence OFL), text se kreslí jako křivky
  (`opentype.js`), takže snímek vypadá všude stejně (lokálně i na GitHubu).
- **Scény ateliéru** (`scene-<scéna>.jpg`): stylizační fotky z „fotoateliéru“, vygenerované (ChatGPT, Gemini), každá
  dvakrát se stejným záběrem: `<scéna>-list.jpg` s prázdným listem 40 × 30 cm a `<scéna>.jpg` bez něj.
  Z rohů listu se spočítá kamera scény (`fitCamera`, `sceneCamera`): skutečný obdélník 40 × 30 cm v perspektivě
  co nejblíž nakresleným rohům, tedy ohnisko (ekvivalent 35 mm, 24–70 mm), odkud a pod jakým úhlem se kamera dívá
  (zenit = odklon od kolmého pohledu, azimut = odklon do strany) a jak je daleko. Ohnisko určí první z: `focalMm`
  ve scéně, kulaté věci ležící ve stejné rovině (`circles`, např. kroužky od hrnku: ohnisko, při kterém jsou stejně
  zploštělé jako na fotce; generátory kreslí list moc „zepředu“, zbytek stolu ukazuje perspektivu věrněji), jinak
  ohnisko, se kterým obdélník nejlépe sedí na rohy. Přesnější jsou **hrany podkladu** (`lines` ve scéně: přímé hrany
  stolu, spáry prken, hrany desky a lišty stojanu, každá dvěma body; skupina `x` rovnoběžná se šířkou listu, `y` s jeho
  výškou): rovnoběžné hrany se na fotce sbíhají do jednoho úběžníku, `fitCameraToLines` najde kameru, se kterou
  všechny míří do svých úběžníků (`lineMisfit`, px), nakreslený list s malou vahou určí jen polohu a vzdálenost (smí
  ležet vůči stolu pootočený, `sheetDeg`) a ohnisko zůstane v 24–70 mm (pevné `focalMm` platí, `circles` pomáhají).
  Hrany, které si navzájem odporují (generátor je nakreslil nerovnoběžně), do `lines` nepatří: u stojanu stožár
  a sloupek, platí deska. Pořadí: `camera` > `lines` > rohy (`sceneCamera`, `source`). Generátor ale mohl nakreslit špatně i list nebo kroužky:
  `camera` ve scéně = kamera nastavená ručně (`cameraFromAngles`: `focalMm`, `zenithDeg` úhel od kolmice na list,
  `azimuthDeg` odkud, 0 = zepředu od spodní hrany, 90 = zprava, `rollDeg` natočení foťáku kolem osy, 0 = vodorovně,
  tj. horizont stolu / horní hrana stojanu vodorovně, `distanceCm` od středu listu, `sheetCenter` kde je střed listu
  na fotce), přebije rohy, `focalMm` i `circles`; najde se v prototypu `kamera-scen.html` (viz *Prototypy*).
  Odvozenou kameru popisuje `cameraAngles` stejnými čísly. Dílo se do roviny položí ve skutečném měřítku (`size_cm`) jako
  list papíru s tloušťkou (`paper` ve scéně, výchozí `PAPER_DEFAULTS`): leží kousek nad stolem, je mírně zvlněný,
  okraje a rohy má lehce zvednuté, jeho hrana je nakreslená jako několik vrstev papíru se skutečnou perspektivou
  (vidět je jen strana ke kameře, ke světlu světlejší, s nepravidelnou hrubostí) a pod okrajem je kontaktní stín.
  Volitelně (`underlayCm`) leží dílo na čistém listu o tolik většímu na každou stranu. Dílo převezme světlo a barvu
  listu (papír díla se nejdřív vyváží na neutrální bílou), má mírně roztřepený okraj a jemný stín. Výřez scény se
  kreslí rovnou ve velikosti snímku (dílo je ostré i u přiblížení). Malé dílo se přiblíží (`minFill`, `maxZoom`), malé úzké (proužek, např. linoryt 16,5 × 4 cm) navíc, dokud nezakryje
  `minArea` plochy snímku (skutečná plocha natočeného díla, nejvýš `maxAreaZoom`, výchozí 3×; pozadí změkne).
  - **Stůl** (`mode: lie`): dílo leží kolem `center` natočené k divákovi: čára napříč jeho středem je na fotce
    vodorovná (`facingDeg`, nezávisle na hranách stolu; horní a spodní hrana se sbíhají jen perspektivou). Od této
    polohy ho `minTiltDeg`/`maxTiltDeg` nahodile pootočí (velikost podle `id` díla, směr `tiltSign`; obojí 0 = jen
    natočené k divákovi). Když by zakrylo rekvizitu (`props`) nebo vyčnívalo ze stolu (`bounds`), najde se nejbližší
    místo, kam se vejde (i tam natočené k divákovi), s pootočením teprve pak větší či menší pootočení na stejnou
    stranu (bez pootočení nikdy).
    Když se nevejde nikam, snímek té scény nevznikne (ani odkaz v `README.md` díla; starý snímek smaže úklid exportů),
    log to ohlásí („does not fit the free part of the scene …, no photo of it“) a souhrn běhu to ukáže v „Ke kontrole“
    („Obraz se nevejde do scény ateliéru pro Instagram“, jen v běhu, který exporty díla vyrobil). Platí pro všechny
    scény: stoly hlídá `bounds` a `props`, stojan `props` a šířka fotky (`scenePlacement` = místo z `planPlacement`
    předem, bez kreslení).
  - **Stojan** (`mode: stand`): dílo stojí rovně spodní hranou na liště (`ledge`, spodní okraj listu je za lištou
    schovaný), vystředěné na osu držáku (`axis`); lišta a předměty `front` (paletka) jsou před ním. Rekvizity vedle
    stojanu (`props`, sklenice) dílo nesmí zakrýt (odstup `propMarginPx`) a musí být celé v šířce fotky. Když to na ose
    nejde, posune se po liště k nejbližšímu místu, kde to jde, nejvýš o `maxSlideCm`; když ani to ne, zůstane na ose
    a ohlásí se „Ke kontrole“ (`planPlacement`; `cut` = širší, než se na fotku vejde: „okraj ho ořízne“).
  - Všechna nastavení scén jsou s popisem v `mockups/instagram/scenes.yaml`. Nová scéna = dvojice fotek a záznam
    tam (rohy listu, rekvizity, volná plocha, světlo); test `instagram.test.mjs` hlídá, že obě fotky mají stejný
    rozměr a že se do stolů vejdou díla běžných velikostí.
  - Zadání, se kterými generátor scény vyrobil, jsou v `mockups/instagram/README.md`, i s porovnáním se spočítanou
    kamerou. Test „the cameras of the scenes agree with the prompts of the generator“ (`PROMPTED_CAMERAS`) hlídá, že
    kamera ze `sceneCamera` zůstane v rozsahu zadání (krátce ho má každá scéna v `scenes.yaml` jako `prompt`,
    ukazuje ho prototyp `kamera-scen.html`): výška nad stolem nebo lištou ±25 %, zenit ±5° (stojan ±7°),
    strana, ze které se dívá, a pootočení nakresleného listu ±5°. Co generátor nedodržel (u tmavého stolu strana
    a pootočení listu), se nekontroluje. Kamera jen z rohů listu by test nesplnila u žádné scény.
- **Panorama pro karusel** (`pano-1.jpg` … `pano-<N>.jpg`, `panoramaSlides`, `renderPanorama`): dílo přes celou
  výšku N snímků 4:5 vedle sebe (okraj `padding`), rozřezané na hranách snímků, na papíru první palety, bez textu. Karusel
  na Instagramu při listování stojí snímky těsně vedle sebe, takže dílo plynule ubíhá a je vidět mnohem větší než na
  jednom snímku. N je nejmenší počet snímků (2 … `panorama.maxSlides`, výchozí 3), do kterých se dílo vejde na celou
  výšku (jinak `maxSlides` a dílo vyplní šířku); panorama vznikne, jen když je dílo aspoň `panorama.minGain`× (výchozí
  1,4) větší než na snímku s popiskem. Počítá se ze `size_cm` (bez něj žádné), takže čtvercová a výšková díla panorama
  nemají, 4:3 dostane 2 snímky, 3:1 tři. Poměr stran celého karuselu určuje první snímek, proto i panorama je 4:5.
- **Příběh** (`story.jpg`, 9:16 = 1080 × 1920, `storyLayout`, `renderStory`, nastavení `images.instagram.story`):
  dílo na papíru první palety s popiskem (stejným jako snímek s popiskem) přímo pod ním, obojí svisle vystředěné mezi
  volnými pruhy nahoře (`safeTop`, lišta s profilem) a dole (`safeBottom`, pole pro odpověď); nad spodním pruhem zůstane
  volné místo `linkSpace` na nálepku s odkazem (nic se tam nekreslí, značka by zůstala vidět vedle nálepky). README
  složky v sekci „Příběh“ uvede adresu stránky díla pro nálepku v bloku ke zkopírování, s UTM
  `?utm_source=instagram&utm_medium=social&utm_campaign=story` (`STORY_UTM` v `scripts/lib/export-readme.mjs`: aplikace
  Instagramu neříká, odkud návštěvník přišel, takže by se v GA jinak tvářil jako přímá návštěva).
- **Příběh kolekce** (přehled `export/instagram/README.md`, `collectionStory` v `scripts/lib/export-readme.mjs`): pod
  tabulkou každé kolekce příběhy jejích děl jako sled snímků (podle `date`, Instagram je přehraje jeden po druhém), ke
  každému odkaz pro nálepku v bloku ke zkopírování a nakonec odkaz na stránku kolekce (obojí s `STORY_UTM`), na poslední
  snímek nebo do profilu. Díla bez kolekce ho nemají.
- **Detailní fotky** (`detail-<jméno>.jpg`): detail blízký 4:5 vyplní snímek výřezem; jiný tvar (výřez by nechal méně
  než `detailCropKeep`, výchozí 75 %, `detailLayout`) leží celý na papíru první palety, a je-li dost široký na panorama
  (`panoramaSlides` podle jeho poměru stran), dostane vlastní plynulé panorama `detail-<jméno>-pano-1.jpg` … (`detailSuffixes`),
  např. matrice linorytu 3 snímky; úklid exportů zná jejich počet z rozměrů detailu v `info.json`.
- **Mřížka na profilu** (`meta_instagram_grid: <sloupce>x<řádky>`, 1x1 až 5x5 `GRID_MAX`, `parseGrid`, `gridLayout`, `renderGrid`, `gridPosts`; nastavení
  `images.instagram.grid`): obraz rozřezaný na dlaždice 3:4 (např. `2x1` dvojice vedle sebe, `3x1`, `3x2`, `3x3`, `3x4`) (1080 × 1440, jak je ukazuje
  mřížka profilu), `grid-<pořadí zveřejnění>-<řádek>_<sloupec>.jpg` (`gridTile`, např. `grid-09-1_1.jpg` = vlevo nahoře,
  zveřejnit jako 9.; `grid-01-3_3.jpg` = vpravo dole, zveřejnit první; seřazené podle jména jdou v pořadí zveřejnění). Celek se kreslí na jedno plátno, kde mezi
  dlaždicemi leží mezera mřížky profilu (`gapPx`, výchozí 8 px ≈ 1 bod na telefonu): pruh pod mezerou není na žádné
  dlaždici, takže na profilu na sebe dlaždice navazují a působí jako jedna fotka pod tenkou mřížkou. Dílo na papíru
  první palety s popiskem pod ním (zvětšeným na velikost mřížky): název a fakta uvnitř první dlaždice spodní řady,
  adresa uvnitř poslední (nikdy přes mezeru), linka přes celou šířku díla. `grid-preview.jpg` = náhled mřížky s tmavými
  mezerami. Zabere-li dílo méně než `minFill` (výchozí 55 %) plochy, souhrn běhu to ukáže v „Ke kontrole“ (zvolit jinou
  mřížku). README složky v sekci „Mřížka na profilu“: náhled, dlaždice po třech a pořadí zveřejnění **pozpátku** (od pravé
  dolní dlaždice, nejnovější příspěvek je na profilu vlevo nahoře) s textem ke každé (`gridPosts`: „<název> · díl k/n“,
  věta o mřížce s @účtem `site.instagram` a hashtagy; poslední zveřejněná, vlevo nahoře, má celý text příspěvku).
  Mřížka drží jen v násobcích tří příspěvků, připnuté příspěvky ji posouvají. **Platí jen pro aplikaci na telefonu**
  (3 sloupce): web Instagramu na počítači ukazuje profil ve 4 sloupcích a mřížku 3 × n rozhází; dvojice 2 × 1 se
  rozpadne nejméně často. Velikost popisku roste s kratší stranou mřížky (u jednoho řádku nezabere moc výšky);
  změna vzhledu mřížky = zvýšit `GRID_VERSION` (je v otisku děl s mřížkou).
- **Text příspěvku** (v `README.md` složky, `instagramPost` v `scripts/lib/instagram.mjs`): název, popis (ne `DOPLNIT`),
  „technika · rozměr · rok“, „Kolekce: <název kolekce>“ u díla v kolekci, u díla na prodej „Obraz je na prodej.“,
  adresa webu s `id` díla (`pavla.kramolis.cz · jujn2`: podle něj obraz najde hledání v galerii), pak řádek českých hashtagů
  (technika a štítky díla bez diakritiky a mezer, kolekce jako jedno slovo, např. `#plenersumava2026`,
  + `instagramPost.always.cs`) a řádek anglických (jejich překlady
  z `instagramPost.en` + `instagramPost.always.en`; slovo bez překladu má jen český). Slovník je v `site.config.yaml`
  (`instagramPost`); nový štítek nebo technika = doplnit překlad tam. Štítek nebo techniku bez překladu u díla
  s `meta_instagram: true` ukáže souhrn běhu v „Doporučení“ (`hashtagAdvice` v `scripts/lib/advice.mjs`). Text se píše při každém běhu (levné, hned
  následuje změnu popisu či štítků), obrázky jen při přegenerování.
- Změna scén, nastavení `images.instagram`, adresy webu nebo názvu, techniky, rozměru či data díla
  dílo s `meta_instagram: true` přegeneruje (otisk v `info.json`), stejně jako přesun díla do jiné kolekce (jiná složka
  exportu); ostatní díla se nepřegenerují. Změna písem
  v `fonts/` otisk nemění (přegenerovat: `npm run images -- --force` nebo `-- <slug>`).

Vodoznak je text `images.fler.watermark` (teď jméno autorky a místo, „Pavla Kramolišová, Roztoky“), nikdy odkaz ani @handle
(pravidla Fleru), vpravo dole, kurzívou písma webu (`fonts/`, jako křivky): světlé, mírně ztučnělé písmo
(`watermarkOpacity`) s měkkým tmavým stínem (`watermarkShadow`), takže je čitelné na světlém papíře i na tmavém
nebo pestrém pozadí mockupu. Tvar podpisu (velikost, odsazení, tloušťka, šířka a rozmazání stínu) je
`WATERMARK_LOOK` v `scripts/lib/watermark.mjs`; ten i nastavení `images.fler` jsou v otisku díla na prodej,
takže změna jeho exporty pro Fler vyrobí znovu. Velikosti a kvalitu nastavuje `images.instagram` a `images.fler`
v `site.config.yaml`.

### Náhled exportů na GitHubu (`README.md`)

Každá složka díla v `export/instagram/` i `export/fler/` má `README.md`, který GitHub vykreslí pod seznamem souborů:
u Instagramu nahoře text příspěvku v bloku s tlačítkem pro kopírování (jiný soubor s ním není; GitHub neumí vložit
obsah jiného souboru, ani v AsciiDocu), u Fleru údaje pro inzerát: technika · rozměr · rok, podklad, stav, cena a popis;
u obou stav zveřejnění podle atributu `instagram` / `fler` („Na Instagramu: <odkaz>“ nebo „zatím nezveřejněno“,
„Na Fleru: <odkaz>“ nebo „zatím nepřidáno“), „Kód obrazu: `<id>`“ (trvalé `id`, podle něj se dílo dohledá na webu
i v obsahovém repu), kolekce a odkaz na stránku díla na webu (`site.url` +
`/tvorba/<rok>/<slug>-<id>/`), pak náhledy všech fotek (klik = plná velikost). Dřívější `post.txt` úklid smaže. `export/instagram/README.md` a `export/fler/README.md` (seskupené pod nadpisy kolekcí podle abecedy, díla bez kolekce
na konci pod „Mimo kolekce“, u každého díla kód `<id>` za názvem, ✓/○ stav zveřejnění a nahoře počty) jsou
přehledy všech děl platformy s miniaturou a odkazem do složky (jen když platforma nějaké dílo má). Stejný přehled
jen s díly kolekce je i v její složce: `export/<platforma>/<kolekce>/README.md` a `export/draft/<kolekce>/README.md`
(`collectionIndexes`, `within`: název kolekce v nadpisu, odkaz „← Všechny“ na celý přehled, bez nadpisu skupiny;
u Instagramu i „Příběh kolekce“), úklid je nechá (`wanted`). Kód
`scripts/lib/export-readme.mjs`; složky děl se píšou každým během (hned následují popis, cenu i štítky), přehledy
plným během. Úklid je bere jako vlastní soubory pipeline (`EXPORT_FILES`).

### Texty stránek (`export/stranky/README.md`)

Vedle přehledu děl píše každý běh bez `--only` (i ve větvi, i s chybami a `--prepare-only`) soubor
`export/stranky/README.md` obsahového repa (`pagesReadme` v `scripts/lib/overview.mjs`) ve třech částech oddělených čarou:
úvodní stránka (`##`, zvláštní: její soubor je `_index.yaml` v kořeni), `## Stránky` ze `stranky/` (O mně, Kontakt, Kurzy,
404; pořadí pevné, `###`) a `## Roky` od nejnovějšího (`###`; prázdná část chybí), u každé odkaz na její yaml a na stránku
na webu (404 bez odkazu: ukáže se na každé neexistující adrese), jednořádkové texty jako „Nadpis: …“, „Titulek: …“,
„Tlačítko: …“, „Popisek místa: …“, „Prázdný web: …“, text a `closing` („Závěr: …“) formátované jako na webu
(`richTextMarkdown`, odkazy na web s celou adresou), „Google: …“; bez textu „(bez textu)“. Úklid exportů složku
nemaže (pracuje jen v `draft/`, `instagram/`, `fler/`). Vyzkoušení: `npm run demo`, `.demo/content/export/stranky/README.md`.

### Přehled všech děl (`export/README.md`)

Jeden soubor se **vším o všech dílech** pro hledání v prohlížeči (Ctrl+F na stránce, kterou GitHub vykreslí):
`overviewReadme` v `scripts/lib/overview.mjs`. Bez obrázků a s co nejmenším formátováním, aby zůstal malý.

- Nahoře počty děl (zveřejněná, rozpracovaná, s chybou), odkazy na kolekce s počty a **Hlášky**: každý použitý kód
  hlášky (viz *Kódy hlášek*) s počtem případů, úrovní a významem, seřazené podle úrovně a počtu.
- Kolekce česky podle abecedy (`## <název>`), „Mimo kolekce“ na konci; u každé odkaz na její `_index.yaml`, popis
  na vlastním řádku, ostatní atributy (bez `title`, ten je v nadpisu) a hlášky. Díla v kolekci od nejnovějšího (`date`).
- Dílo (`workHeading`, `workLines`): nadpis `### <název> ★ · <id> @ <date> [ <šířka> x <výška> ]` (hvězdička jen
  u `featured: true`, datum a rozměr jen když jsou), řádek s odkazy na popis (text = jen jméno souboru, např. `zena-v-desti.yaml`, odkaz vede na celou cestu), fotku („foto“, nebo „bez fotky“)
  a stránku na webu (jen zveřejněné), text (`text`, každý odstavec na vlastním řádku, formátovaný jako na webu) a vlastní popis pro vyhledávače („Google: …“) na vlastních řádcích, pod ním každá detailní fotka na vlastním
  řádku `detail <jméno>: <popisek>` (formátovaný) (bez popisku jen `detail <jméno>`), pak jeden odstavec: zapnuté přepínače
  slovem (`draft` = `meta_draft: true`, `instagram: <odkaz>` nebo `instagram: -` = `meta_instagram: true` s odkazem /
  zatím bez něj, `pinterest`, `mockups`; vypnuté nic) a ostatní atributy v pořadí souboru `klíč: hodnota · …`
  (i `private_*`; prázdné vynechá; seznamy čárkami, mapy `klíč=hodnota; …`, dlouhé texty nad 80 znaků na vlastním
  řádku). Nikdy se nepíšou jako atribut: `title`, `id`, `date`, `size_cm`, `featured` (v nadpisu), `meta_corners`
  (jen pro pipeline), samotný `instagram` u `meta_instagram: true` (`WORK_TOLD`) a výchozí `status: not-for-sale`. Pod tím hlášky běhu k dílu jako
  `` - <značka> `kód` text `` se značkou úrovně (`✗` chyba, `⚠` ke kontrole, `💡` doporučení, `✎` zbývá doplnit,
  `LEVEL_MARKS`, stejné jako v README rozpracovaných obrazů), bez hlášek jen `✓` (`OK_MARK`); legenda je v hlavičce.
- „Ostatní“: hlášky jiných souborů (roky, fotky, úvodní stránka) a obecné (štítky, techniky).
- Píše ho každý běh bez `--only` (i s chybami v popisech a `--prepare-only`, tedy i ve větvi), celý a vždy stejně
  ze stejných dat (git ukáže jen změněné části); plný běh ho na konci přepíše znovu s varováními exportů
  (`misfits`). Úklid exportů ho nemaže (maže jen ve složkách platforem). Nad `OVERVIEW_MAX_BYTES` (400 kB) dá
  doporučení `prehled-velky` (GitHub velké soubory nemusí vykreslit), soubor se ale zapíše celý.

## Autorství v obrázcích (XMP)

Webové obrázky každého díla (originál ve všech šířkách, detaily, mockupy, ve formátech JPEG, WebP i AVIF, a jeho
náhled pro sdílení `og-<otisk>.jpg`) nesou metadata XMP: autorka (`dc:creator` = `site.author`), název díla (`dc:title`), copyright
„© <rok díla> <autorka>“ (`dc:rights`), kredit (`photoshop:Credit`), příznak chráněného díla (`xmpRights:Marked`) a odkaz
na stránku díla (`xmpRights:WebStatement`). Google Obrázky z nich umí ukázat autora a kredit a stažený obrázek je nese
dál. Nikdy licenci (autorka prodává originály, ne práva k obrázkům). Ostatní fotky webu (portrét, ateliér, vlastní
úvodní fotky) XMP nedostanou, nemusí být dílem autorky. Kód `scripts/lib/image-rights.mjs` (`rightsXmp`,
`copyrightNotice`); stejný text copyrightu a kredit má `ImageObject` obrázku ve strukturovaných datech stránky díla.
XMP je v otisku díla: změna názvu, roku, adresy webu nebo jména autorky obrázky díla vyrobí znovu (jinak se jen
zachovají). Ostatní metadata fotek (EXIF, GPS) pipeline dál zahazuje.

## Obrázky pro sdílení (náhled odkazu)

Každá stránka s obrázkem má `og:image` s rozměry (`og:image:width`,
`og:image:height`) a `twitter:card`, aby sociální sítě (Facebook, WhatsApp,
Messenger…) ukázaly velký náhled hned napoprvé. Všechny náhledy jsou
1200 × 800 (3:2, `images.og` v `site.config.yaml`).

**Otisk v názvu** (`fingerprintedName` v `scripts/lib/site-images.mjs`): náhled pro sdílení i pin mají v názvu prvních
8 znaků SHA-1 svého obsahu (`og-1a2b3c4d.jpg`, `pin-1a2b3c4d.jpg`). Změněný obrázek tak má novou adresu a služby,
které si obrázek berou a drží podle adresy (Pinterest, náhledy odkazů na sociálních sítích), dostanou nový; stejný
obsah = stejné jméno, nic se nepřepisuje. Jméno díla je v `info.json` (`og.file`, `pin.file`; složky vyrobené dřív
bez něj mají `og.jpg` / `pin.jpg` a web je čte dál, dokud se dílo nepřegeneruje). Náhled stránky (rok, kolekce,
úvod) leží jako jediný soubor ve složce `_og/` stránky (`ogDir`); web ho najde přes `pageShareFile`, pipeline při
změně celou složku nahradí. Bývalý `public/og.jpg` úvodní stránky smaže úklid (`LEGACY_OG_FILE` v `OUTPUT_ROOTS`).
Webové obrázky (`<šířka>.avif/webp/jpg`) otisk nemají: GitHub Pages dává všemu `Cache-Control: max-age=600`, takže
změna je u návštěvníků nejpozději do 10 minut, a stálé adresy jsou výhoda (vyhledávání obrázků, odkazy). Už
existující pin na Pinterestu otisk nezmění: Pinterest si obrázek při založení pinu uloží a znovu ho nestahuje.

| Stránka | Náhled | Soubor |
|---|---|---|
| detail díla | celý obraz na papírovém pozadí, **nikdy oříznutý** | `public/tvorba/<rok>/<slug>-<id>/og-<otisk>.jpg` |
| úvodní stránka | úvodní obraz podle tabulky v *Úvodní obraz* (`_cover.jpg` / `cover` + `focus` v `_index.yaml`); stránka sama ukazuje náhodné z 10, náhled pro sdílení náhodný být nemůže | `public/_og/og-<otisk>.jpg`, jinak náhled díla |
| stránka roku | totéž pro rok (`roky/<rok>.jpg` / `cover` + `focus`) | `public/tvorba/<rok>/_og/og-<otisk>.jpg`, jinak náhled díla |
| stránka kolekce | totéž pro kolekci (`_cover.jpg` / `cover` + `focus`) | `public/tvorba/kolekce/<slug>/_og/og-<otisk>.jpg`, jinak náhled díla |
| přehled kolekcí | náhled první (nejnovější) kolekce | týž soubor |

Obraz se v náhledu díla neořezává, protože jde o umělecké dílo: obraz na výšku
má po stranách papír. Průhledné okolí díla (*Ořez pozadí*) se prolne s papírovým pozadím náhledu. Náhled díla vzniká s webovými obrázky (přegeneruje se se
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
text: |
  Týden malování venku na Kvildě a Modravě. Viz [nejnovější obrazy](/tvorba/).
# description: … # NEPOVINNÉ: popis pro vyhledávače (jinak začátek textu)
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
  `public/tvorba/kolekce/<slug>/_og/og-<otisk>.jpg` (1200 × 800, `images.og` v
  `site.config.yaml`) ze stejného zdroje, jaký ukazuje stránka
  (`coverSource` v `scripts/lib/collections.mjs`), a se stejným ořezem
  (`focusCrop` v `scripts/lib/photos.mjs` počítá jako CSS `object-position`).
  Vyrábí se při každém běhu jen pro vlastní fotku, detail a `cover` s ořezem (bez ořezu celé na papíře),
  zapíše se jen při změně (nový obsah = nový název, viz *Otisk v názvu*). Zmizí se smazanou kolekcí nebo když obal
  přestane být vybraný; pak stránka sdílí náhled díla. Když ořez nestačí, je
  lepší připravit široký detail a použít `cover: <id>#<detail>`. Komponenta `src/components/Cover.astro`.
- Stránka `/tvorba/kolekce/<slug>/` vznikne jen pro kolekci s aspoň jedním
  publikovaným dílem. Vedou na ni přehled `/tvorba/kolekce/` a řádek „Kolekce“
  u každého jejího díla (řádek filtrů galerie na ni neodkazuje).
- V galerii je výběr „Kolekce“ s počty děl; volba „žádná“ (`?collection=none`) ukáže díla, která v žádné kolekci nejsou.
  Výběr je **combobox** (ARIA vzor, `src/lib/combobox.ts`, logika `scripts/lib/combobox.mjs`): kolekce česky podle abecedy
  (`czechOrder`), kliknutí nebo Tab označí celý text (psaní ho přepíše), smazaný text ukáže světlou nápovědu „vše“ a Enter
  ji vybere (`typedActive`), aktivní položka má podklad a pruh v barvě `--accent`, psaním se seznam zužuje podle pravidel hledání (`comboMatches`; „vše“ a „žádná“ zůstávají
  nahoře), šipky ↓/↑ seznam otevřou a posouvají, Enter vybere, Esc zavře jen seznam (panel filtrů zůstane), Tab odejde.
  Rozbalený seznam ukáže celé názvy. Psaný text se nikam nezapisuje, do adresy jde jen vybraná kolekce. Pod ním zůstává
  skrytý nativní `<select name="collection">`, jediný stav filtru (počty, nabízené volby, zašednutí, čip v liště); combobox
  ho jen nastavuje a po každé změně se srovná (`sync`).
- Přehled `/tvorba/kolekce/` končí položkou **„Mimo kolekce“** (`NO_COLLECTION_TITLE`, `getUncollected` v `src/lib/site.ts`,
  název kurzívou, protože to kolekce není): díla bez kolekce, vede do galerie `/tvorba/?collection=none`. Úvodní
  obraz podle stejného pravidla jako u kolekce z `tvorba/_index.yaml` obsahového repa (`UNCOLLECTED_SCHEMA`,
  `scripts/lib/uncollected.mjs`; kostru založí pipeline, jakmile v `tvorba/` leží nějaké dílo): vlastní fotka
  `tvorba/_cover.jpg` (→ `public/tvorba/_cover/`), `cover: <id>` jen dílo mimo kolekce (jinak chyba „nepatří do obrazů
  mimo kolekce“), s `aspect`/`focus` oříznutý, jinak náhodně z výběru autorky. Obrázek pro sdílení nemá (žádná vlastní
  stránka); veřejná kopie `content/tvorba/_index.yaml` jen dokud je nějaké zveřejněné dílo mimo kolekci. Text pod
  názvem: nepovinný `text` téhož souboru (v kostře zakomentovaný, v přehledu jako čistý text), prázdný = `UNCOLLECTED_TEXT` („Obrazy, které
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
- Pořadí přehledu (`sortCollections`): kolekce s nejnovějším dílem první (nový obraz kolekci posune nahoru), ve stejný
  den abecedně podle názvu, „Mimo kolekce“ vždy poslední.
- Přehled se stránkuje jako galerie (`?page=`, `?perPage=`, `page=all`, viz *Stránkování*; „Mimo kolekce“ je položka
  seznamu) a má vpravo od nadpisu hledání v názvech a popisech kolekcí (`?q=`, viz *Hledání*). Stav celého přehledu `{ year, q, page, perPage }` je v adrese (`overviewStateFromParams`,
  `overviewStateToParams`, `matchesOverview` ve `scripts/lib/collection-filter.mjs`) a zapamatuje se pro „← Kolekce“.
  Logika `scripts/lib/collection-filter.mjs`. Vyzkoušet: `npm run demo`, `/tvorba/kolekce/` (testovací kolekce
  jsou z let 2025 a 2026, jedna z obou).
- Stránka kolekce má nahoře odkaz **„← Kolekce“** na přehled; vede zpět s rokem, který tam návštěvník měl
  vybraný (viz *Návrat do výpisu*).
- Výběr „Rok“ v galerii kolekce nabízí jen roky jejích děl s počty („2025 (3)“, `yearFilterOptions` ve
  `scripts/lib/gallery-filter.mjs`); u kolekce celé z jednoho roku je zašedlý s tím rokem.
- Kód: `scripts/lib/content.mjs` (čtení složek), `scripts/lib/collections.mjs` (popisy kolekcí), `src/lib/site.ts#getCollections`
  a `src/pages/tvorba/kolekce/` (přehled `index.astro`, stránka `[collection].astro`).

## Mockupy

Mockupy (obraz v rámu na zdi) se **zapínají v popisu díla: `mockups: true`**,
nezávisle na tom, jestli se dílo prodává. Výchozí je `false` (kostra ho tak
zapisuje), jiná hodnota než `true`/`false` je chyba.

- Dílo s `mockups: true` dostane na stránce tři mockupy ve skutečném měřítku
  podle `size_cm`. Nadpis sekce se řídí stavem: u díla na prodej „Jak by mohl
  vypadat u vás“, jinak „Jak by mohl vypadat na zdi“ (`mockupsHeading`). Pod ním
  čára, mockupy s popiskem „<scéna> (vizualizace)“ (`mockupCaption`, i v `alt`, v prohlížeči
  fotek „<název> · <scéna> (vizualizace)“) a pod všemi drobná šedá poznámka pod krátkou tenkou
  čárou „Vizualizace – rám je jen pro představu.“ (`MOCKUPS_NOTE`; vše v `scripts/lib/work-viewer.mjs`).
- Fler exporty mockupů vzniknou jen u díla na prodej, které mockupy má. Na
  Instagram mockupy nejdou nikdy.
- Přepnutí `mockups` dílo přegeneruje, `false` jeho mockupy (i ve Fler exportech)
  smaže. Prodej díla (`sold`) mockupy nechá a smaže jen Fler exporty. Změna mezi
  `available` a `reserved` nic nepřegeneruje. Web mockupy bez `mockups: true`
  neukáže, ani kdyby soubory zůstaly.
- Pole jde i do veřejné kopie popisu (web ho čte), kód `wantsMockups` v
  `scripts/lib/works.mjs`.

**Plátno (`meta_edge: canvas`) visí bez pasparty.** Každá scéna může mít v `scenes.yaml`
vlastní rám pro plátna (`canvas`): `frameCm` šířka lišty v barvě `frame` (0 = bez rámu, holé plátno),
`gapCm` tmavá spára mezi lištou a plátnem (stínový rám), `depthCm` jak daleko plátno stojí od stěny
(hlubší a měkčí stín) a `profile` lišta osvětlená shora. Scéna bez `canvas` má tenký stínový rám
s profilem (`CANVAS_DEFAULTS` v `scripts/lib/mockups.mjs`). Teď: obývák večer lišta s profilem přímo
na plátně, ložnice stínový rám se spárou, komoda bez rámu. Okraje plátna jsou lehce ztmavené (otáčejí
se kolem blindrámu). Bez pasparty je plátno v rámu menší, takže se vejde i do scén, kam by se stejný
obraz na papíře nevešel (`frameGeometry`, `pickScenes` s `edge`). Změna `meta_edge` u díla s mockupy
dílo přegeneruje.

**Mockup je vždy jen holý papír.** Master srovnaný přes `npm run straighten`
ukazuje kolem listu úzký okraj podkladu, aby byly vidět okraje papíru, a fotka
vyfocená nakřivo kolem listu podlahu. V rámu na zdi by ale okraj nepatřil (pasparta
kryje okraje papíru) a měřítko podle `size_cm` by nesedělo. Pipeline proto
pro mockupy (na webu i pro Fler) master ořízne na největší obdélník uvnitř rohů listu
(`meta_corners`, viz *Ořez pozadí*, `innerRegion` v `scripts/lib/edges.mjs`) a uvnitř listu
z metadat fotky (`pavla:sheet`, viz *Srovnání fotek obrazů*); má-li obojí, na jejich průnik.
Webové obrázky díla a exporty pro Instagram a Fler okraj neořezávají, jen podlahu vně rohů
zprůhlední nebo nahradí barvou pozadí. Master bez obojího (sken, fotka upravená jinde) jde do
mockupu celý jako dosud. Klik na obraz, detail nebo mockup otevře prohlížeč fotek, ve kterém se dá
šipkami (i tahem prstem nebo myší) přepínat mezi originálem, detaily a mockupy. Šipky po otevření
a po každém pohybu myši zůstanou 3 s (`CONTROLS_MS`), pak se rozplynou; nad šipkou myš drží, na telefonu je
klepnutí na obrázek ukáže nebo schová a klepnutí na skrytou šipku ji jen ukáže (`autoHide` v
`scripts/lib/work-viewer.mjs`). Křížek, popisek a počítadlo zůstávají, klávesy ←/→ fungují vždy.

- Malá díla (delší strana do 35 cm): stěna (komoda, ložnice), rámeček na poličce
  a rámeček opřený na stole v pracovně.
- Větší díla: obývák, druhá stěna (ložnice, komoda) a předsíň.
- Scény, které se nevejdou (rám je větší než volné místo), se přeskočí.
- Výběr je pro dílo stálý (podle ID), aby se mockupy mezi běhy neměnily.

Scény jsou v `mockups/`: fotka interiéru z Unsplash a v `scenes.yaml` její
kalibrace (kolik pixelů je 1 cm, kam se obraz věší, jak velký se vejde, barva
rámu, rám pro plátna, světlo, stín a případné předměty před obrazem, např. opěradlo židle). Novou scénu přidáš tak, že uložíš fotku (čelní pohled na
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
| `kontakt.jpg` | Kontakt, vedle formuláře (pod formulářem i fotkou je přes celou šířku řádek s e-mailem, Instagramem, Pinterestem a Flerem vlevo a „Žiji a maluji“ vpravo; na telefonu pod sebou), oříznutá na šířku 3:2 podle `focus` (fotka 3:2 zůstane celá); bílý okraj přechází do papíru stránky (`blendEdge={10}`) |

Kontakt ukazuje z `site.config.yaml` e-mail (`site.email`), Instagram (`site.instagram`), obchůdek na Fleru
(`site.fler`) a místo, kde autorka žije a maluje (`site.location`, „Žiji a maluji“); prázdná hodnota = položka chybí.

Přípona může být i `.png` apod. (ne `.jpeg`, viz kontrola jmen). Další fotku lze na libovolnou stránku
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
- **Kontrola proměnných** (`scripts/lib/css-vars.mjs`, test `css-vars.test.mjs`): každé `var(--…)` v `src/` musí být
  definované, paletou (`paletteCss`) nebo v kódu (`--název:` v CSS či atributu `style`, `setProperty('--název', …)`).
  Překlep (`--paper2` místo `--paper-2`) prohlížeč tiše zahodí, tady neprojde `npm test` a vypíše soubor a název.
- **Bez probliknutí**: CSS všech palet a malý skript (`paletteScript`) jsou vložené v `<head>` (`Base.astro`) před
  vykreslením; skript nastaví `data-palette` (zobrazená paleta) a `data-palette-choice` (volba) na `<html>`
  a barvu lišty prohlížeče (`theme-color`). Bez JavaScriptu rozhoduje systém a přepínač se neukáže.
- **Přepínač**: `src/components/PalettePicker.astro` v patičce („Barvy“ a kroužky v barvě papíru palety, Automaticky
  napůl světlý a tmavý), popisek při najetí myší; změna pošle událost `palette_change` (viz *Návštěvnost*).
- **Bílé okraje fotky do barvy papíru** (`--paper-blend`, `paperBlend`): na světlé paletě `multiply` (bílá převezme
  barvu papíru), na tmavé `normal` (beze změny). Používá ho `<Photo … blendEdge={10} />` (viz *Ostatní fotky*),
  zatím jen fotka `kontakt` na Kontaktu.
- Barvy, které se s paletou nemění: prohlížeč obrazů (zvětšení díla) je vždy tmavý; obrázky z pipeline (náhledy pro sdílení,
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
| hvězdička výběru autorky | `/tvorba/`: „Máky“ má za názvem `★` (bublina „Výběr autorky“), stejně v nadpisu jeho stránky; přepni paletu Noc v patičce, hvězdička zesvětlá. Dílo bez `featured` hvězdičku nemá. |
| velikost dlaždic | v dlaždicích `−` / `+` vedle přepínače: menší (víc sloupců, `?view=tiles&tile=s`) a větší (`&tile=l`), na krajích zašedlé; střední parametr nemá. Obnov stránku bez parametrů: velikost zůstane (paměť `pavla.gallery.tileSize`); `?view=tiles&tile=m` → střední (odkaz má přednost). Na telefonu 4 / 3 / 2 sloupce. Ve velkých obrazech tlačítka nejsou. |
| zobrazení na úvodní stránce | `/`: „Nejnovější“ jako střední dlaždice (30, adresa bez parametrů), ikony vpravo v záhlaví; sloupce končí skoro stejně vysoko. „Velké obrazy“ → 6 děl a `?view=grid`; zpět „Dlaždice“ a `−` → malé, `?tile=s` (63, testovací data mají méně, ukážou všechna kromě úvodního obrazu), `+` `+` → velké, `?tile=l` (20). Zužuj okno: sloupců ubývá a znovu se vyrovnají; pod 1100 px méně děl (4 / 16 / 25 / 49), pod 640 px ještě méně (3 / 10 / 24 / 40). S pamětí velkých obrazů obnov `/`: rovnou velké obrazy, žádné probliknutí dlaždic. V konzoli (Verbose) `[analytics] view_change {"listing":"home","view":"grid"}`. Nikdy se neopakuje dílo z úvodního obrazu (obnovuj, obraz se střídá). Otevři `/` bez parametrů: volba zůstane (paměť `pavla.home.view` / `pavla.home.tileSize`), `/tvorba/` má dál své zobrazení. `/?view=grid` u někoho s pamětí dlaždic → velké obrazy (odkaz má přednost); `/?utm_source=x` parametr zachová. |
| sloupce stejné výšky v galerii | `/tvorba/`, `/tvorba/2026/`, kolekce: sloupce končí dole stejně (nižší mají mírně širší mezery, případně místo nahoře nejvýš 12 px), nejplnější a nejprázdnější sloupce se střídají (`gallery.columns` v `site.config.yaml`; zkus `order: center` nebo `maxGap: 1`, úvodní stránka se nezmění, ta má `home.columns`), ve velkých obrazech i dlaždicích; změň filtr, stránku, počet na stránku, „Zobrazit vše“ i šířku okna, sloupce se vždy znovu vyrovnají. Stránkování dál podle data (2. stránka začíná dílem po posledním z 1.). Se zapamatovanými dlaždicemi obnov `/tvorba/`: rovnou dlaždice, bez probliknutí velkých obrazů. |
| značky na úvodní stránce | `/`: v dlaždicích jen hvězdička (menší, průsvitnější), žádné košíky (`home.tileMarks`); galerie beze změny. |
| prototypy | `npm run prototypes` a `open .prototypes/zarovnani-sloupcu.html`, `open .prototypes/znacky-dlazdic.html`: posuvníky začínají na hodnotách ze `site.config.yaml`, „Nastavení“ přepne na úvodní stránku / galerii. `open .prototypes/kamera-scen.html`: hrany stolů a stojanu protažené až za fotku, kroužek (průsečík hran) a křížek (úběžník kamery) leží u sebe a čárkované hrany díla do nich míří; „Z rohů listu“ je od sebe vzdálí, „Z hran“ je vrátí; u stojanu úhel spodní hrany díla proti liště skoro 0°; „Vyrovnat natočení“ ho změní, zaškrtni „ohnisko drží velikost listu“ a posuň ohnisko: list zůstane stejně velký, změní se perspektiva mřížky; „Pomocné čáry“ je schovají a ukážou dílo čistě, „Obnovit doporučené“ po rozladění posuvníků vrátí kameru ze `scenes.yaml`; „jen díla, která se nevejdou“ nechá v seznamu jen díla hlášená „Ke kontrole“ (na skutečných datech tři velká díla na stolech); zkopírovaný řádek `camera` vlož do `mockups/instagram/scenes.yaml` a `npm run demo:prepare` vyrobí scény s ní. Testovací data: `npm run demo:prepare`, `SITE_DATA_DIR=.demo/site npm run prototypes -- .demo/prototypes`. |
| značky na dlaždicích | `/tvorba/?view=tiles`: obrazy z výběru autorky mají vlevo nahoře hvězdičku, obrazy na prodej vpravo dole košík; `−` na malé dlaždice: košíky zmizí, hvězdičky zůstanou; `+` na velké: značky větší (nejvýš 22 px). Přepni paletu Noc: značky světlé s tmavým lemem. Velké obrazy: žádné značky, hvězdička u názvu a štítek „K prodeji“. Totéž na úvodní stránce. Zkus `tileMarks.sale.icon: tag` nebo `sale.corner: tl` v `site.config.yaml` (košík vedle hvězdičky). |
| dlaždice | `/tvorba/`: vpravo dole ikona „Dlaždice“: malé obrazy bez textů, 36 na stránku, „Na stránku“ nabízí 36 / 72 / 144, v URL `?view=tiles`; z 4. stránky velkých obrazů skočí na 2. stránku dlaždic (stejné první dílo). Zvol 72, přepni na velké obrazy a zpět: každé zobrazení si pamatuje svůj počet. Změň filtr, dlaždice zůstanou. Otevři `/tvorba/` znovu bez parametrů → dlaždice a `?view=tiles` (paměť); `/tvorba/?view=grid` → velké obrazy (odkaz má přednost); „Velké obrazy“ paměť smaže (DevTools → Local Storage → `pavla.gallery.view`). Na šířce telefonu 3 sloupce. |
| štítky v bublině | `/tvorba/`: najeď myší na obraz se štítky, bublina má řádek `#štítek …` česky podle abecedy. |
| přehled všech děl | `npm run demo:prepare`, pak `.demo/content/export/README.md`: kolekce, nadpisy `### Máky ★ · rw4dh @ 2026-07-02 [ 30 x 30 ]`, přepínače slovem (`instagram: -`), kódy hlášek (např. `featured-bez-pinu` u Máků) a „Hlášky“ s počty; v náhledu Markdownu (VS Code) hledej kód. |
| filtry | `/tvorba/`: klikej na filtry, sleduj URL; zkopíruj URL do nového okna, musí ukázat totéž. Testovací data mají pro každou kombinaci aspoň jedno dílo. |
| stránkování | `/tvorba/`: 12 děl a stránky 1, 2, …, 5 (mezera „…“); klikni na 2, v URL `?page=2`, zkopíruj do nového okna. Vyber filtr, vrátí tě na 1. stránku; `?page=99` se opraví na poslední. „Zobrazit vše (60)“: všech 60 děl, v URL `?page=all`; změň filtr, zůstane vše; „Zobrazit po stránkách“ vrátí 1. stránku. „Na stránku“ 24: stránky 1, 2, 3, v URL `?perPage=24`; 48: stránky 1, 2; zpět na 12 parametr zmizí; `?perPage=13` se ignoruje. Paměť: zvol 24, otevři `/tvorba/` znovu bez parametrů (nebo stránku kolekce) → 24 a `?perPage=24` v URL; otevři `/tvorba/?page=2` → 12 na stránku (odkaz má přednost); zvol 12 → paměť se smaže. Smazat ručně: DevTools → Application → Local Storage → `pavla.gallery.perPage`. Menší první hodnota `gallery.pageSizes` (např. `[4, 12]`) ukáže mezery na obou stranách aktuální stránky. |
| náhledy pro sdílení | `grep -o '<meta property="og:image[^>]*>' dist/tvorba/2026/*/index.html` po `npm run build`; soubory `public/tvorba/*/*/og-*.jpg` a `public/tvorba/kolekce/*/_og/og-*.jpg`. Online: po nasazení vlož odkaz do <https://www.opengraph.xyz/> nebo do Facebook Sharing Debuggeru. |
| rozpracované dílo | „Rozpracovaný obraz“ nesmí být v galerii, v roce 2026 ani na adrese `/tvorba/dhsh5/` |
| web bez děl | `mkdir -p /tmp/prazdny/public && cp public/favicon.svg /tmp/prazdny/public/ && SITE_DATA_DIR=/tmp/prazdny npx astro build`: úvodní stránka ukáže „Obrazy tu brzy přibudou.“ a odkaz na Instagram (bez `site.instagram` jen první větu) |
| mockup bez okraje | srovnej fotku přes `npm run straighten` (s výchozím okrajem), dej ji jako master díla s `mockups: true` do testovacích dat nebo obsahového repa, `npm run images`: webový obrázek díla má kolem papíru pruh podlahy, mockupy (`mockup-*.jpg`) ne. Metadata ověříš: `node --input-type=module -e "import s from 'sharp';console.log(String((await s('<master>.jpg').metadata()).xmp))"` |
| stav a mockupy | v yaml díla s `mockups: true` změň `status` (např. `available` → `sold`), `npm run images`: v logu `→ <dílo>`, mockupy na detailu zůstanou (nadpis „Jak by mohl vypadat na zdi“), z `export/fler` zmizí; pak `mockups: false`: mockupy zmizí i z webu. Testovací data: Ráno u rybníka (na prodej) × Slunečnice, Šumava v mlze (ne) × Pivoňky (vypnuté) |
| exporty | `ls .demo/content/export/*/*/`: Instagram jen díla s `meta_instagram: true` (Ráno u rybníka, Pivoňky, Kytice z louky, Máky, Na podlaze, Lípa u kaple, Zimní sad, Oblaka, Hřeben nad údolím), každé ve své složce `export/instagram/[<kolekce>/]<slug>/` (`ls -R .demo/content/export/instagram`) s `caption-papir/-pergamen/-noc.jpg`, `scene-stul-tmavy/-stul-svetly/-stojan.jpg`, `story.jpg`, `pano-*.jpg` (jen široká díla, Oblaka 3 snímky), `grid-*.jpg` + `grid-preview.jpg` (Pivoňky 9, Oblaka 3, Ráno u rybníka 2), `README.md` (s textem příspěvku, pořadím karuselu a adresou pro nálepku příběhu) a `detail-*.jpg`; Fler jen díla `available`/`reserved`; smaž `meta_instagram: true` u Máků v `demo-content/`, `npm run demo:prepare`, jejich export pro Instagram zmizí |
| Instagram: snímky s popiskem a scény | `open .demo/content/export/instagram/demo-plener-sumava-2026/demo-rano-u-rybnika/*`: tři snímky s popiskem (název, technika · rozměr · rok, adresa webu) na papíru palet, dílo na tmavém a světlém stole (natočené k divákovi, vodorovně na fotce, mimo rekvizity) a na stojanu (na liště, za paletkou); Lípa u kaple přiblížená, Zimní sad hlášený jako nevejde se na stoly, Oblaka a Hřeben nad údolím (70 × 50) i na stojan („does not fit into the photo of the scene stojan“); snímek scény, do které se dílo nevejde, chybí (log; souhrn „Ke kontrole“ dostane plný běh obsahového repa); `cat …/README.md`: text příspěvku s popisem, adresa webu s `id` díla, „Kolekce: …“ u Ráno u rybníka, „Obraz je na prodej.“ u Máků, hashtagy česky a anglicky; štítek bez anglického překladu = „Doporučení“ v souhrnu |
| náhledy exportů | `cat .demo/content/export/instagram/README.md .demo/content/export/fler/README.md`: přehledy s miniaturami; v každé složce díla `README.md` se všemi fotkami (u Instagramu i textem příspěvku, u Fleru s cenou); vykreslené je uvidíš na GitHubu obsahového repa nebo v náhledu Markdownu v editoru |
| odkaz na Instagram | `/tvorba/2026/demo-rano-u-rybnika-pf7ru/`: v řádku „Sdílet“ odkaz „Na Instagramu“ (vymyšlený `instagram:` v testovacích datech); v `.demo/content/export/instagram/README.md` u něj „✓ na Instagramu“, u ostatních „○ zatím nezveřejněno“, skupiny podle kolekcí; `instagram: true` v popisu = chyba „instagram musí být odkaz…“ |
| autorství v obrázcích | `node --input-type=module -e "import s from 'sharp';console.log(String((await s('.demo/site/public/tvorba/2026/demo-rano-u-rybnika-pf7ru/480.avif').metadata()).xmp))"`: autorka, „© 2026 …“, odkaz na stránku; v JSON-LD stránky díla `"image":{"@type":"ImageObject",…,"copyrightNotice":"© 2026 …"}`; fotka `public/fotky/…` XMP nemá |
| vodoznak pro Fler | `open .demo/content/export/fler/*/*/mockup-*.jpg`: světlý podpis se stínem čitelný i na tmavém pozadí mockupu |
| cena | zakomentuj nebo smaž `price` u díla `available` (`demo-maky.yaml`): `npm run images` skončí chybou „stav „available“ potřebuje cenu“ |
| úklid exportů | přejmenuj dílo (yaml, fotku i složku detailů), `npm run images`: v logu `- removed export/…` se starým názvem, v `export/` zůstanou jen soubory s novým názvem; totéž po smazání díla. Nebo nakopíruj do složky díla v `export/fler/` cizí soubor `mockup-xyz.jpg`: další běh ho smaže, i když nic nepřegeneruje; vlastní soubor jiného jména (`poznamka.txt`) nechá. |
| kolekce | `/tvorba/kolekce/` (přehled), `/tvorba/kolekce/demo-plener-sumava-2026/` (s úvodní fotkou), `/tvorba/kolekce/demo-zahrada-2025/` (bez ní), výběr „Kolekce“ v galerii, řádek „Kolekce“ na detailu díla |
| detailní fotky | `/tvorba/2026/demo-rano-u-rybnika-pf7ru/` (2 detaily s popisky), `/tvorba/2025/demo-kytice-z-louky-q6bn6/` (1 detail bez popisku): náhledy pod popisem, prohlížečka; v `export/instagram/<kolekce>/<slug>/` soubory `detail-*.jpg` |
| soukromá poznámka | `grep -r private_note .demo/site/content/` nesmí nic najít; `demo-rano-u-rybnika` a `demo-jablka-na-stole` ji v `demo-content/` mají |
| oddělení testovacích dat | zkopíruj `demo-content/tvorba/demo-maky.yaml` do `tvorba/` obsahového repa a spusť `npm run images`: skončí chybou „test data do not belong in the real content“ a nic nezapíše (pak soubor smaž). Obráceně: dílo bez jména `demo-…` v `demo-content/` nebo smazaná značka `demo-content/demo-content.yaml` zastaví `npm run demo`. |
| fotky stránek | `/o-mne/` (`o-mne-uvod` nahoře oříznutá na 2:1, `portret` vedle textu; bez kterékoli z nich se rozložení přizpůsobí); změň `focus` v `fotky/o-mne-uvod.yaml` (např. `[10, 10]`), `npm run images`, výřez se posune |
| úvodní obraz kolekce | `/tvorba/kolekce/` a `/tvorba/kolekce/demo-zahrada-2025/`: „Ze zahrady 2025“ ukazuje široký detail Pivoněk (`cover: vjr39#1-kvety-nahore`). Má `aspect: "2:1"`: zkus `"3:2"` nebo `"1:1"`, pak `cover: vjr39` (celé Pivoňky oříznuté), pak smaž `aspect` i `focus` (bez ořezu), pak `cover` (náhodně z výběru, celé). Bez `aspect` se ořízne na čtverec, bez `focus` kolem středu. „Plenér Šumava 2026“ má vlastní fotku jako panorama 2400 × 1000: ukáže se celá; zkus k ní `aspect: "3:2"`. „Město 2026“: `cover` bez ořezu, celé dílo. |
| obrázek pro sdílení kolekce | po `npm run images` otevři `public/tvorba/kolekce/*/_og/og-*.jpg` (1200 × 800, stejný výřez jako na stránce, jen u vlastní fotky, detailu a `cover` s ořezem; ořez 2:1 Ze zahrady leží na papíře); změň `focus` nebo `aspect` kolekce Ze zahrady, `npm run images`, v logu `→ og kolekce/…` a výřez se posune. Na stránce kolekce je v `<meta property="og:image">`. |
| starý název atributu | v `demo-content/tvorba/demo-maky.yaml` přepiš `meta_draft:` na `draft:`, `npm run demo:prepare`: chyba „draft: přejmenováno na meta_draft, přejmenuj ho“, soubor se nezmění (pak vrať) |
| `derived_` v obsahu | do `demo-content/tvorba/demo-maky.yaml` přidej `derived_x: 1`, `npm run demo:prepare`: chyba „derived_ attributes are made by the pipeline…“ (pak smaž) |
| vyhledávače | po `npm run demo:build`: `.demo/site/dist/robots.txt`, `.demo/site/dist/sitemap.xml` (s `lastmod`), ve zdroji stránek `<meta name="description">` a `application/ld+json` (dílo `VisualArtwork` s `keywords` a `artform`, u Ráno u rybníka a Máků `sameAs` s odkazem na Instagram / Fler, výpisy `CollectionPage` s `keywords`, úvod `WebSite` + `Person`); 404 má `noindex` |
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
    `public/_cover`, `public/_og` a bývalý `public/og.jpg`, aby se jeho smazání dostalo do pull requestu), a to jen ty,
    které existují nebo je git zná (smazaná složka). Chybějící cestu (např. `public/_cover`, dokud úvodní stránka nemá
    vlastní `_cover.jpg`) přeskočí, jinak by `git add` selhal a pull request by nevznikl; bez jediné složky se pull
    request přeskočí. Nová výstupní složka pipeline = doplnit do `OUTPUT_PATHS`,
  - popis: číslo běhu a seznam změněných děl, kolekcí a fotek. Pull request je veřejný, takže **nikdy
    neuvádí název ani odkaz na obsahové repo** (to platí i pro jeho titulek a commit).
- **přípravný běh** (`npm run images -- --prepare-only`, na větvích obsahového repa): jen kostry popisů, `id`,
  rohy listu (`meta_corners`), srovnání popisů, kontroly a náhledy ořezu rozpracovaných děl (`.previews/` a zmenšené
  v `export/draft/` obsahového repa), bez obrázků webu, ostatních exportů a zápisu do tohoto repa.
- **náhledy ořezu** (`.previews/`, plná velikost, mimo git) se nikam nenahrávají (artefakt běhu zabíral GB úložiště
  Actions účtu); zmenšené v `export/draft/` commitne workflow obsahového repa zpět s ostatními změnami
  (viz *Ořez pozadí*); zkušební běh totéž s testovacími daty.
- Souhrn běhu (`scripts/lib/summary.mjs`) jde do `GITHUB_STEP_SUMMARY`, celý česky (čte ho autorka). Jména souborů
  obsahového repa v něm jsou odkazy na GitHub do větve běhu (`fileLinks` v `scripts/lib/summary-links.mjs`, adresu dává
  workflow v `CONTENT_BLOB_URL`, např. `<server>/<repo>/blob/<větev>`; zkušební běh `…/blob/<větev>/demo-content`; bez ní
  a lokálně bez odkazů): u hlášky, která jmenuje řádek („na řádku 43“, „(řádek 44)“) nebo začíná atributem
  („date musí být…“, i zakomentovaným `# price:`), rovnou na řádek (`#L<n>`, `lineOf`, čte soubor po běhu = stav, který
  automatika commitne zpět). Soubor s víc hláškami: nadpis vede na soubor a každá hláška s řádkem má „(řádek N)“.
  **Kódy hlášek** (`scripts/lib/codes.mjs`): každá hláška o souboru končí kódem v hranatých závorkách, např.
  „tvorba/jez.yaml: chybí název (title) [chybi-nazev]“. Kód je krátké české slovo bez diakritiky, stejné pro všechny
  případy stejného problému, takže hledání kódu (v souhrnu, v přehledu `export/README.md`) najde všechny. Registr
  `CODES` má u každého kódu úroveň (`error`, `review`, `advice`, `todo`) a význam; `coded(code, text)` neznámý kód
  odmítne, `codesOf` a `withoutCodes` ho z hlášky čtou. Test hlídá, že každý kód je použitý a každý kód v hláškách
  zná registr. Nová hláška = nový kód v `CODES`. Seznamy `DOPLNIT` (zveřejněné obrazy v „Ke kontrole“ a „Zbývá
  doplnit“) mají kód až v přehledu (`doplnit-zverejneny`, `doplnit`). Týdenní kontrola používá kódy ze stejného
  registru (úroveň `health`, viz níže).
  Pořadí částí:
  1. **Chyby** (`### ✗ Chyby (počet)`): hlášky kontrol seskupené po souborech (`groupProblems`: část před první
     „`: `“ je soubor, hlášky bez souboru pod „Obecně“) a obrazy bez fotky (`missing`). Každá hláška kontroly je česky
     ve tvaru `<soubor>: <co je špatně a jak to opravit>`.
  2. **Ke kontrole** (`### ⚠ Ke kontrole`): zveřejněné obrazy, kterým zůstal `DOPLNIT` v komentáři, podezřelý ořez
     rohů (`⚠`) a zakomentované údaje, které nejsou nepovinné (např. `# id: TODO`; `commentedOutKeys` v
     `scripts/lib/metadata-yaml.mjs`, `commentedOutReview` v `scripts/lib/content.mjs`, ve všech popisech, log
     `! commented-out attribute:`): pipeline je nečte, takže nic neznamenají; hláška řekne, jestli údaj v souboru už je
     (řádek smazat), nebo ne (odkomentovat, nebo smazat). Řádky technických komentářů se nehlásí; běh nezastaví.
  3. **Doporučení** (`### 💡 Doporučení (počet)`, `workAdvice` v `scripts/lib/advice.mjs`): po souborech, u všech děl
     (i rozpracovaných), běh nezastaví ani nezmění: dílo bez štítků (`tags`); `title` začíná malým písmenem nebo končí
     tečkou; `text` (bez formátování) a popisky detailů (`details`) začínají malým písmenem nebo nekončí tečkou (stačí i `!`, `?`,
     `…`, případně před uzavírací uvozovkou či závorkou); dílo na prodej (`available`, `reserved`) bez `mockups: true`;
     název díla delší než `workTitleChars` (60 znaků titulku stránky ve výsledcích vyhledávání, `SEARCH_TITLE_MAX`,
     minus „ · “ a `site.title`, teď 40): ve výsledcích vyhledávání a v záložce se zkrátí (bublina nad obrazem název
     nezkracuje). Kolekce, rok nebo „Mimo kolekce“ s `text` pořád jako vzorová věta z kostry
     (`COLLECTION_SKELETON_TEXT`, `yearSkeletonText(<rok>)`, `UNCOLLECTED_SKELETON_TEXT`, bez mezer okolo; `sampleAdvice`
     v `pageAdvice`): „text je pořád vzorová věta z kostry (…), je vidět na webu; napiš místo ní vlastní text“.
     Stejně `title` a `text` kolekce, `text` roku a úvodní stránky a `alt` a `caption` fotek stránek
     (`pageAdvice`). Název kolekce delší než `COLLECTION_TITLE_CHARS` (19) a technika delší než `TECHNIQUE_CHARS` (14)
     znaků (`techniqueAdvice`, jednou za techniku s počtem děl): zavřený výběr v galerii je zkrátí (viz *Řádek filtrů*).
     Texty začínající `DOPLNIT` a prázdné přeskočí (ty hlídají kontroly).
     Péče o web (`careOfSite` v `scripts/process-images.mjs`, funkce v `scripts/lib/advice.mjs`): zveřejněné dílo bez
     rozměru (`size_cm`) nebo bez popisu (`careAdvice`); detailní fotka bez popisku v `details` (u všech děl); fotka díla
     s kratší stranou pod `MIN_PHOTO_SIDE` (1350 px, `photoSizeAdvice`); rok, kolekce, úvodní stránka nebo „Mimo kolekce“
     s aspoň `FEATURED_GROUP` (3) zveřejněnými díly, bez vlastní fotky a `cover`, kde je ve výběru autorky žádné dílo
     (úvodní obraz je vždy nejnovější) nebo jen jedno (nestřídá se; `featuredAdvice`). Z historie gitu obsahového repa
     (`scripts/lib/git-dates.mjs`: den commitu, který soubor přidal, i přes přesun do kolekce; bez gitu nebo v mělkém
     klonu nic, proto `fetch-depth: 0` ve workflow obsahového repa): rozpracované dílo déle než `DRAFT_DAYS` (30) dní
     (`draftAgeAdvice`) a zveřejněné dílo s `meta_instagram: true` bez odkazu `instagram`, jehož `README.md` v
     `export/instagram/` je v gitu déle než `INSTAGRAM_LINK_DAYS` (14) dní (`instagramLinkAdvice`).
     Nesoulad atributů díla (`consistencyAdvice`, i u rozpracovaných, pokud není řečeno jinak):
     `featured-bez-pinu` (zveřejněné dílo ve výběru autorky bez `meta_pinterest: true`), `odkaz-instagram-bez-exportu`
     (odkaz `instagram`, ale `meta_instagram` není `true`), `fler-neni-na-prodej` (odkaz `fler` u díla, které není
     `available`/`reserved`), `prodej-bez-fleru` (zveřejněné dílo na prodej bez odkazu `fler`), `cena-neprodava`
     (`price` u `not-for-sale` nebo `gifted`; prodané si cenu nechává), `mockupy-bez-rozmeru` (`mockups: true` bez
     platného `size_cm`), `mrizka-bez-instagramu` (`meta_instagram_grid` bez `meta_instagram: true`, mřížka nevznikne),
     `datum-v-budoucnu` (`date` po dnešku).
     Pod Doporučeními vlastní sbalený blok **Zbývá doplnit** (`### ✎ Zbývá doplnit (počet)`, `<details>`, `result.todo`):
     každý popis obsahového repa (díla i rozpracovaná, kolekce, roky, úvod, „Mimo kolekce“, fotky; `contentYamls`), který
     má u technického komentáře ještě `DOPLNIT`, jedním řádkem „**soubor**: atributy v pořadí souboru“ (`todoAdvice`
     přes `todoKeys`); do počtu Doporučení se nepočítá. Zveřejněná díla s `DOPLNIT` vynechá, ta jsou v „Ke kontrole“.
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
  (i rozpracovaná díla se skutečnou technikou, aby pravidlo bylo dřív než zveřejnění; technika `DOPLNIT` ne;
  bez `CONTENT_DIR` se přeskočí),
- že každý štítek a technika všech děl (i rozpracovaných a těch, která na Instagram ani Pinterest zatím nejdou;
  bez `DOPLNIT`) má anglický překlad v `instagramPost.en` i `pinterestKeywords.en` v `site.config.yaml`
  (`findUntranslatedTags` v `scripts/lib/content.mjs`, `evaluateUntranslatedTags`): vypíše slovo, platformy bez
  překladu a díla, aby se překlad doplnil dřív, než dílo na Instagram nebo Pinterest půjde (pipeline to hlásí jen
  u děl, která tam jdou, `stitek-bez-prekladu`; bez `CONTENT_DIR` se přeskočí),
- že na nasazeném webu existuje každý obrázek, na který jeho stránky odkazují (`scripts/lib/site-check.mjs`):
  projde web od úvodní stránky a od všech stránek mapy webu (`/sitemap.xml`) po vlastních odkazech, z `src`, `srcset`, `href`
  a `og:image` posbírá obrázky a na každý se zeptá (`HEAD`); obrázek, který neprojde, zkusí ještě dvakrát po 3 s
  (`retries`, `retryDelayMs`; chvilkový výpadek GitHub Pages není chybějící obrázek, `npm run check:images` nad vyrobeným
  webem neopakuje); vypíše chybějící obrázky se stránkou, která na ně odkazuje, a stavem (`HTTP 404`, `bez odpovědi`),
  a nedostupné stránky. Adresa webu je `site.url` ze `site.config.yaml`, `--site-url <adresa>` ji
  přepíše (např. lokálně spuštěný web). Vyzkoušení: `node scripts/check-health.mjs --site-url <adresa>`
  (bez tokenů ohlásí i token; za proxy navíc `NODE_USE_ENV_PROXY=1`).
- že stránky nasazeného webu (tytéž, které prošla kontrola obrázků, bez `noindex`) mají vlastní titulek a popis
  (žádné dvě stejné, popis nejvýš 160 znaků) a platná strukturovaná data (JSON-LD se schema.org a typem u každého
  uzlu): `evaluatePageTexts` ve `scripts/lib/page-check.mjs`, stejná pravidla jako `npm run check:images` u buildu,
  hlášky česky (nejvýš 10, pak „… a dalších N“). Když se web nepodařilo načíst, tahle kontrola se přeskočí
  (chybu ohlásí kontrola obrázků).

Výsledek je markdown (`formatReport`) na stránce běhu a ve výstupu kroku `report`; když je něco špatně,
skript skončí kódem 1. Kódy neúspěšných kontrol (i problémů, které vypisují) jsou v `report.codes` (`formatReport`)
a jako výstup kroku `codes` (`[token-vyprsi] [obrazky-chybi]`): workflow obsahového repa je dá na konec titulku issue,
aby šly e-maily filtrovat podle kódu. Každá neúspěšná kontrola končí první řádek své hlášky kódem ze stejného registru jako hlášky
pipeline (`scripts/lib/codes.mjs`, úroveň `health`): `token-chybi`, `token-neplatny`, `token-nedostupny`,
`token-vyprsi`, `beh-selhal`, `zkusebni-beh-selhal`, `nasazeni-selhalo`, `nasazeni-chybi`, `aktualizace-ceka`,
`neznamy-atribut`, `nova-technika`, `preklad-chybi`, `obrazky-chybi`, `stranky-nedostupne`, `nacteni-selhalo` (API nebo obsah se
nepodařilo načíst). Problémy textů stránek mají kód každý (`titulek-chybi`, `stejny-titulek`, `popis-stranky-chybi`,
`stejny-popis-stranky`, `dlouhy-popis-stranky`, `jsonld-chybi`, `jsonld-neplatny`, `jsonld-neni-objekt`,
`jsonld-bez-contextu`, `jsonld-prazdny-graf`, `jsonld-bez-typu`); jsou to přímo kódy `pageProblems`, takže je
vypisuje i `npm run check:images`.

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

## Pinterest

Pin = obrázek s názvem, popisem a odkazem na stránku díla; lidé si piny ukládají na své nástěnky a dohledají je i za
roky. Web je na Pinterest dává sám, přes kanál RSS (`scripts/lib/pinterest.mjs`):

- **Pin má každé zveřejněné dílo** (pro „Uložit na Pinterest“); `meta_pinterest: true` (výchozí `false`, nezávislé na
  Instagramu i stavu prodeje) jen určuje, co jde do kanálu, tedy co Pavla připne sama. Pin má průměrně asi 200 KB
  (změřeno na skutečných obrazech), 100 děl ≈ 20 MB v repu.
- **Obrázek pinu** `pin-<otisk>.jpg` (viz *Otisk v názvu*; 2:3, 1000 × 1500, nastavení `images.pinterest`, výchozí `PIN_DEFAULTS`): dílo s popiskem
  na papíru první palety, stejný vzhled jako snímek s popiskem pro Instagram (`renderCaption`), ale popisek je hned pod
  dílem a obojí je svisle vystředěné (`snug`, `captionLayout`), takže široké dílo nemá pod sebou prázdný pruh (vysoké
  vypadá stejně jako na Instagramu); ořez `insetPercent`, s XMP autorství. Leží veřejně ve složce stránky díla (`public/tvorba/<rok>/<slug>-<id>/pin-<otisk>.jpg`), protože si ho Pinterest
  stahuje; `info.json` díla má `pin: { width, height, bytes, file, feed, feedFile, feedVersion }` (`feed: true` = dílo s `meta_pinterest`, jde do
  kanálu; samotný `meta_pinterest` se do veřejné kopie nekopíruje). V otisku díla: `meta_pinterest`, `meta_pinterest_version` (od 2), `images.pinterest`,
  adresa webu, název, technika, rozměr a rok.
- **Stálá adresa v kanálu:** Pinterest pozná pin podle adresy obrázku, ne podle `guid` (zjištěno 2026-10-15: nový otisk
  = zdvojený pin). Kanál proto bere obrázek z `pin.feedFile` (`workFeedPinImage` v `src/lib/site.ts`): adresu, kterou
  dílo v kanálu už mělo (z předchozího `info.json`; před zavedením `feedFile` jeho `file`), a pipeline pod ní zapíše
  nejnovější pin. Novou adresu (`file` s otiskem, tedy nový pin) dostane jen dílo, které do kanálu přibude, nebo
  s vyšší `meta_pinterest_version` (`feedVersion`); pak starý pin na Pinterestu smazat ručně. Tlačítko „Uložit na
  Pinterest“ a náhledy dál používají `file` s otiskem.
- **Kanál** `/pinterest.xml` (`src/pages/pinterest.xml.ts`, `pinterestFeed`): RSS 2.0, položka na každé dílo s `pin.feed`,
  nejnovější první: `title` (nejvýš 100 znaků), `link` na stránku díla s UTM parametry
  `?utm_source=pinterest&utm_medium=social&utm_campaign=rss` (`FEED_UTM`: Google Analytics tak návštěvu z pinu pozná
  i z aplikace Pinterestu, která jinak neřekne, odkud návštěvník přišel; stránka má kanonickou adresu bez nich), `guid` = `id` díla (Pinterest stejné dílo
  nepřipne dvakrát), `description` (popis díla = jeho `description`, jinak `text`, „technika · rozměr · rok · id“ (podle `id` obraz najde hledání v galerii) a klíčová slova, nejvýš 500 znaků,
  `pinDescription`; dlouhý popis se zkrátí, fakta a klíčová slova zůstanou),
  `pubDate` podle `date`, obrázek v `enclosure` a `media:content`. Bez děl s pinem prázdný kanál.
- **Klíčová slova** (`pinKeywords`): Pinterest hledá podle slov v názvu a popisu, ne podle hashtagů. Na konci popisu
  pinu (v kanálu i u „Uložit na Pinterest“) jsou technika a štítky česky a pak jejich anglické překlady z vlastního
  slovníku `pinterestKeywords.en` v `site.config.yaml` (obyčejná slova s mezerami, např. „plein air“, „still life“, na
  rozdíl od hashtagů `instagramPost.en`), např. „akvarel, krajina, mlha · watercolor, landscape, fog“; slovo bez
  překladu jen česky a u díla s `meta_pinterest: true` ho souhrn běhu ukáže v „Doporučení“ (`pinterestAdvice`).
- **Profil:** `site.pinterest` (URL profilu) = `sameAs` autorky v JSON-LD a odkaz „Pinterest“ v patičce a na Kontaktu
  (`rel="me"`), který vede na záložku vytvořených pinů `<profil>/_created/` (`pinterestProfileLink`; tu adresu má každý
  profil na Pinterestu); prázdné = nic.
- **Připojení (jednou, v Pinterestu):** firemní účet (zdarma), ověření webu (značka HTML: kód do `site.verification.pinterest` →
  `<meta name="p:domain_verify">`, adresa webu `https://pavla.kramolis.cz`; ověřit až po nasazení), pak v nastavení „Hromadné vytváření pinů“ → automatické publikování z RSS: adresa
  `https://<web>/pinterest.xml` a nástěnka. Pinterest kanál čte asi jednou denně a připne jen nové položky; úprava už
  připnutého díla se nepřenese.
- **„Sdílet“ na stránce díla** (`scripts/lib/share.mjs`, viz *Stránka díla* nahoře): ikona Pinterestu = formulář Pinterestu
  (`pinSaveUrl`) s adresou stránky, obrázkem (pin, dokud ho pipeline nevyrobí náhled pro sdílení, `workPinImage`) a popisem;
  návštěvník si obraz připne na svou nástěnku a pin vede zpět na web. Žádný skript Pinterestu, žádné cookies.
- **Kontrola:** `npm run check:images` i týdenní kontrola přečtou `/pinterest.xml` a ověří, že každý obrázek kanálu
  na webu existuje (chybějící se hlásí u „pinterest.xml“).
- **Vyzkoušení:** `npm run demo:build`, pak `.demo/site/dist/pinterest.xml` (3 položky) a `pin-<otisk>.jpg` ve složce
  každého díla (`ls .demo/site/public/tvorba/*/*/pin-*.jpg`).

## Vyhledávače (SEO)

Co web dělá, aby mu vyhledávače rozuměly (`scripts/lib/seo.mjs`, `src/layouts/Base.astro`):

- **Popis každé stránky** (`<meta name="description">`, max. 160 znaků, `summarize`): úvod, dílo, rok, kolekce a stránky ve
  `stranky/` = jejich `description`, jinak jejich `text` bez formátování (`searchDescription`), dílo jinak složené z techniky,
  podkladu, rozměrů a roku (`workDescription`), rok a kolekce jinak věta s názvem; Tvorba, Kolekce, O mně a Kontakt mají vlastní. Žádné dvě stránky nemají stejný titulek
  ani popis: dílo se stejným názvem jako jiné dostane v titulku stránky v závorce techniku („Tetřevská slať
  (tisk z výšky)“; se stejnou technikou i rozměr a rok, pak `id`; `workPageTitle`), dílo se stejným popisem jako
  jiné za něj techniku, rozměr a rok („Krmelec na okraji lesa. Akvarel, 27,5 × 40 cm, 2026.“, vlastní text se
  případně zkrátí, aby se vše vešlo do 160 znaků; `workPageDescription`). Název a text na stránce se nemění.
  Hlídá to `npm run check:images` (viz *Kontrola obrázků postaveného webu*).
- **Strukturovaná data** (schema.org jako JSON-LD v `<script type="application/ld+json">`, `graphLd`):
  úvod = web (`WebSite`) a autorka (`Person` s portrétem, odkazy na Instagram a Fler a místem `homeLocation` ze `site.location`), O mně = `ProfilePage`,
  Kontakt = `ContactPage`, dílo = `VisualArtwork` (název, popis, obrázek, technika, podklad, rozměry v cm, datum,
  autorka, klíčová slova `keywords` = štítky díla, druh díla `artform` podle techniky: `malba` / `kresba` / `grafika`,
  neznámá technika žádný, `artform` v `scripts/lib/seo.mjs`, a `sameAs` = odkazy `instagram` a `fler` díla, tedy tentýž
  obraz jinde; obrázek jako `ImageObject` s `creator`, `creditText` a `copyrightNotice`, bez licence, `imageObjectLd`), Tvorba, rok, kolekce a Kolekce = `CollectionPage` se seznamem děl
  a klíčovými slovy ze štítků jeho děl (nejčastější první, nejvýš 20, `tagKeywords`); všude drobečková navigace
  (`BreadcrumbList`). **Obraz na prodej uvádí jen dostupnost (`available` = InStock, `reserved` =
  LimitedAvailability), nikdy cenu** (rozhodnutí 2026-10; cena zůstává jen na stránce).
- **Open Graph**: `og:url`, `og:site_name`, `og:locale` (`cs_CZ`), `og:type` (`article` u díla), obrázek pro sdílení.
- **`/robots.txt`** (`src/pages/robots.txt.ts`): vše povoleno, odkaz na mapu webu `/sitemap.xml`.
- **Stránka 404** (`src/pages/404.astro`): „Tento obraz ještě nebyl namalován“, tři obrazy z výběru autorky
  a odkazy na výběr a celou tvorbu; `noindex` a bez `canonical`. Krátké odkazy `/tvorba/<id>/` mají `noindex`
  a `canonical` na detail díla.
- **Ověření webu u vyhledávačů** značkou `<meta>`: kódy do `site.config.yaml` → `site.verification`
  (`google` = `google-site-verification`, `bing` = `msvalidate.01`, `seznam` = `seznam-wmt`, `pinterest` = `p:domain_verify`
  pro ověření webu firemním účtem Pinterestu; prázdné = žádná značka).
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
  | `gallery_filter` | návštěvník v galerii změní filtr (štítek, technika, rok, kolekce, stav, hledání) nebo na přehledu kolekcí rok či hledání; ne stránkování ani počet na stránku | aktivní filtry `tag` (víc štítků jako jedna hodnota spojená čárkou v abecedním pořadí, např. `krajina,voda`), `technique`, `year`, `collection`, `status`, `featured`, `q` (hledání, i na přehledu kolekcí; prázdné se neposílají) a `results` (kolik děl, na přehledu kolekcí kolik kolekcí odpovídá) |
  | `fler_click` | klik na „Koupit na Fleru“ u díla | `work_id`, `work_title` |
  | `instagram_click` | klik na „Na Instagramu“ u díla (atribut `instagram`) | `work_id`, `work_title` |
  | `share` | klik na ikonu v řádku „Sdílet“ u díla (doporučená událost GA) | `method` (`pinterest`, `facebook`, `whatsapp`, `native` = nabídka sdílení telefonu, `copy` = zkopírování odkazu), `work_id`, `work_title` |
  | `email_click` | jen odkazy `mailto:`: klik na e-mailovou adresu na Kontaktu (kdo píše rovnou z pošty místo formuláře); bez formuláře zpráv i klik na „Napsat autorce“ u díla. Předmět e-mailu má stejný tvar jako odeslaná zpráva (`[pavla-web] Pozdrav nebo vzkaz`, u díla `[pavla-web] Dotaz na obraz: <název> (<id>)` / `Zájem o koupi: …`) | u díla `work_id`, `work_title`, na Kontaktu žádné |
  | `message_sent` | odeslaná zpráva z formuláře (Kontakt nebo panel „Napište mi“, viz *Zprávy od návštěvníků*) | `message_type` (`greeting`, `work`, `purchase`, `collaboration`, `bug`, `other`), u zprávy k obrazu `work_id`, `work_title` |
  | `palette_change` | návštěvník v patičce přepne barvy webu (jen skutečná změna, ne opakovaný klik na tutéž) | `palette` (`papir`, `pergamen`, `noc`, `auto`) |
  | `view_change` | návštěvník přepne zobrazení děl (velké obrazy / dlaždice) nebo velikost dlaždic, na úvodní stránce i v galerii (`viewEventParams`) | `listing` (`home`, `gallery`), `view` (`grid`, `tiles-s`, `tiles-m`, `tiles-l`) |
  | `image_view` | každý obrázek ukázaný v prohlížeči fotek na stránce díla (`imageEventParams`): otevření i každé listování; Zpět/Vpřed jen při jiném obrázku | `work_id`, `work_title`, `image` (kotva obrázku: `obraz`, `detail-<jméno>`, `mockup-<scéna>`), `image_kind` (`main`, `detail`, `mockup`), `method` (`IMAGE_METHODS`: `open` klik na stránce, `arrow` šipka prohlížeče, `swipe` tah, `key` klávesa ←/→, `link` stránka otevřená s kotvou, `history` Zpět/Vpřed) |

  Tlačítka nesou `data-track="<událost>"`, `data-work-id` a `data-work-title`; posluchač kliků je v `Base.astro`,
  filtr v `WorkGallery.astro`, `image_view` ve skriptu prohlížeče v `src/pages/tvorba/[section]/[work].astro`. Nové tlačítko se sleduje přidáním stejných atributů a názvu do `EVENTS`.
- **Jednorázově v GA** (bez toho se parametry v přehledech neukážou, jen počty událostí):
  *Administrátor → Vlastní definice → Vytvořit vlastní dimenzi*, rozsah **Událost**, pro každý parametr zvlášť
  (název, popis do 150 znaků, parametr události). Existující dimenzi upravíš přes ⋮ → *Upravit* (parametr ani rozsah
  se změnit nedají, název a popis ano):

  | Název dimenze | Parametr | Popis (do pole *Popis*) |
  |---|---|---|
  | Štítek | `tag` | Filtr štítků v galerii (gallery_filter); víc štítků jako jedna hodnota spojená čárkou, např. krajina,voda. |
  | Technika | `technique` | Filtr techniky v galerii (gallery_filter), např. akvarel. |
  | Rok | `year` | Filtr roku v galerii nebo na přehledu kolekcí (gallery_filter). |
  | Kolekce | `collection` | Filtr kolekce v galerii (gallery_filter): slug kolekce, none = díla bez kolekce. |
  | Stav filtru | `status` | Filtr stavu v galerii (gallery_filter): unsold = na prodej, kept = ještě mám, gone = už nemám. |
  | Výběr autorky | `featured` | Zapnutý přepínač Doporučené (výběr autorky) v galerii (gallery_filter). |
  | Hledání | `q` | Text hledání v galerii nebo v přehledu kolekcí (gallery_filter). |
  | ID díla | `work_id` | Trvalý kód díla (např. g4psg) u událostí díla: Fler, Instagram, sdílení, e-mail, zpráva, prohlížeč fotek. |
  | Název díla | `work_title` | Název díla u událostí díla: Fler, Instagram, sdílení, e-mail, zpráva, prohlížeč fotek. |
  | Způsob | `method` | share: kde sdílel (pinterest, facebook, whatsapp, native, copy); image_view: jak přišel na obrázek (open, arrow, swipe, key, link, history). |
  | Typ zprávy | `message_type` | Typ odeslané zprávy (message_sent): greeting, work, purchase, collaboration, bug, other. |
  | Barvy webu | `palette` | Barvy zvolené v patičce (palette_change): papir, pergamen, noc, auto. |
  | Výpis | `listing` | Kde se přepnulo zobrazení děl (view_change): home = úvodní stránka, gallery = galerie. |
  | Zobrazení | `view` | Nové zobrazení děl (view_change): grid = velké obrazy, tiles-s / tiles-m / tiles-l = dlaždice malé / střední / velké. |
  | Obrázek | `image` | Obrázek v prohlížeči fotek díla (image_view): obraz, detail-<jméno>, mockup-<scéna>; stejně jako kotva v adrese. |
  | Druh obrázku | `image_kind` | Druh obrázku v prohlížeči fotek (image_view): main = celý obraz, detail = detailní fotka, mockup = vizualizace v interiéru. |

  A *Vlastní metriky → Vytvořit*: `results` (Počet výsledků filtru, jednotka Standardní, popis: „Kolik děl (na přehledu
  kolekcí kolik kolekcí) odpovídá filtru po jeho změně (gallery_filter).“). Data se v nich ukazují až od chvíle
  registrace, zpětně ne. Nový parametr události = nový řádek v této tabulce.
  Přehledy: *Přehledy → Zapojení → Události* (počty a proklik na parametry) nebo *Průzkum* (tabulka např.
  Událost × Technika).
- Vyzkoušení událostí lokálně (bez Google tagu se nic neposílá, jen vypisuje): `npm run demo`, v DevTools →
  *Console* zapnout úroveň *Verbose*, změnit filtr v `/tvorba/` → `[analytics] gallery_filter {…}`; na detailu
  díla na prodej s odkazem na Fler (v testovacích datech Máky) klik na „Koupit na Fleru“ → `[analytics] fler_click`,
  na detailu Ráno u rybníka klik na „Na Instagramu“ → `[analytics] instagram_click`, na ikonu v řádku „Sdílet“ →
  `[analytics] share` s `method` (např. `pinterest`, `copy`); klik na obraz, detail nebo mockup a listování v prohlížeči
  fotek → `[analytics] image_view` s `image`, `image_kind` a `method`.
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
  `npm install-scripts ls` ukáže neposouzené. `opentype.js` (text popisků pro Instagram jako křivky z písem
  v `fonts/`) instalační skript nemá.
- **Písma pro exporty** (`fonts/`): Cormorant Garamond Italic a Work Sans Regular (statické TTF, licence OFL
  v `fonts/OFL-*.txt`), stejná písma jako na webu (ten je načítá z Google Fonts).
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

## Ořez pozadí (rohy obrazu, `meta_corners`)

Fotka obrazu bývá trochu křivá a kolem listu je vidět pozadí: podlaha, světlá zeď nebo bílý podkladový papír
(nebo okraj podkladu, který nechává `npm run straighten`). Pipeline proto **najde čtyři rohy listu** a všechno vně čtyřúhelníku mezi nimi
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
nebo pestrá barva obrazu malovaného do kraje, `looksLikeFloor`), podlahu nemá.
**Světlé pozadí** (bílá zeď, podkladový papír; vypadá jako papír, takže ho test podlahy nevidí): strana, jejíž okraj
je téměř celý (`BACKGROUND_SHARE` 90 %) světlý a podél strany se mění jen plynule (sousední vzorky nejvýš
`BACKGROUND_STEP` 20 od sebe: světlo na zdi slábne pozvolna, barva obrazu skáče; `looksLikeBackground`), se měří
`backgroundDepth`: barvy průměrované podél strany (`backgroundRadius`, zrno omítky), od okraje dovnitř, dokud se 3 body
za sebou neliší o víc než `BACKGROUND_DISTANCE` (30) od dosavadního průměru pozadí (stín u hrany, hrana plátna
či papíru). Polovina strany platí, jen když hranu najde aspoň 70 % vzorků a leží na jedné přímce
(`straightEdge`, `BACKGROUND_STRAIGHT`): hrana plátna nebo listu je rovná, začátek malby na bílém okraji papíru
(list vyfocený bez okolí) nerovný, takže se okraj papíru nikdy neodřízne. Okraj, kde se papír střídá s pruhem
podlahy, světlé pozadí není (zůstane 0 jako dřív). Omezení: papír skoro stejně světlý jako zeď se pozná jen podle
stínu u hrany široký aspoň 3 body zmenšeniny; bez něj strana zůstane 0 a rohy je třeba doplnit ručně. Z každé poloviny strany vznikne
přímka hrany u jejího rohu (`edgeLine`: přímka, na které leží nejvíc vzorků, posunutá dovnitř tak, aby 85 %
vzorků leželo vně, protože skutečná hrana bývá zvlněná: raději kousek papíru než podlaha). Roh je průsečík
přímek. Roh mimo fotku (list pokračuje za její okraj) = 0, roh dál než čtvrtina fotky = nedůvěryhodný, 0.

**Prolnutí s pozadím** (`images.edges` v `site.config.yaml`): `inset` (výchozí 0,2 % kratší strany) ořízne
o kousek víc, `feather` (výchozí 1 %) je šířka pásu podél hrany, ve kterém list plynule přechází do průhlednosti
(maska `maskSvg`, `cutOut` v `scripts/lib/corners.mjs`). Změna těchto dvou hodnot přegeneruje díla s rohy (`edgeLook`).
`search` (jak daleko od okraje fotky hledat hranu, výchozí 10 %) a `suspicious` (od kolika procent je ořez rohu
v náhledech podezřelý, výchozí 5 %) obrázky nemění, takže nic nepřegenerují; stejně tak
`guides` (čáry náhledu `-frames.jpg`: podíly šířky, resp. výšky fotky od každého kraje, libovolně mnoho mezi 0 a 0,5,
výchozí `[0.003, 0.006, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15]`, jinak `npm run preview` skončí chybou).

**Kde se co použije:**

| Výstup | Okolí listu |
|---|---|
| web: AVIF a WebP | průhledné (prolne se s papírem palety); bez zástupné barvy `--ph`, stín podle tvaru listu (`filter: var(--drop-soft)` / `var(--drop-deep)` z palety, `cutout` v `Img.astro`, `transparent: true` v `info.json`) |
| web: JPEG (záloha pro staré prohlížeče) | papír první palety (`PALETTES[0].colors.paper`) |
| prohlížečka obrázků na stránce díla | průhledné, stín podle tvaru listu |
| náhled pro sdílení (`og-<otisk>.jpg`), úvodní obraz z díla | prolne se s papírovým pozadím `images.og.background` |
| Instagram (`caption-*.jpg`, `scene-*.jpg`) | papír palety, nebo dřevo a světlo scény ateliéru |
| Fler (originál) | bílá `images.fler.background` |
| mockupy | jen holý papír uvnitř rohů (pasparta kryje okraje), viz *Mockupy* |
| detailní fotky | beze změny (rohy patří jen hlavní fotce) |

**Náhled ořezu rozpracovaných děl:** pro každé dílo s `meta_draft: true` a rohy, které něco ořezávají, vzniknou
v `.previews/` (mimo git) **tytéž tři náhledy jako u `npm run preview`** (`writePreviews` v `scripts/lib/corners.mjs`,
obojí stejnou funkcí): `<slug>-<id>-cut.jpg` a `<slug>-<id>-frames.jpg` popsané níže a `<slug>-<id>-backgrounds.jpg`, výsledek na papíru a na tmavém papíru (paleta Noc) vedle sebe, s tenkou
čarou čtyřúhelníku rohů a u každého rohu se dvěma řádky, odkud a kolik ořízne: `zleva 2,5 % = 93 px` a `shora 1,7 % = 46 px`
(zleva/zprava v % šířky, shora/zdola v % výšky fotky a v px fotky = hodnota `meta_corners`; `cutLabelLines`). Řádek nad
`images.edges.suspicious` (výchozí 5 %) je červeně, druhý řádek téhož rohu ne. Na světlém je vidět zbylá podlaha, na tmavém i to, kolik papíru se odřízlo. Plný běh
složku vždy vyprázdní a naplní znovu (zveřejněné dílo náhled nemá). Na GitHubu se plné náhledy nikam nenahrávají
(artefakt běhu zabíral GB úložiště Actions účtu): zůstávají zmenšené v `export/draft/`, plnou velikost vyrobí lokálně
`npm run preview`; souhrn běhu náhledy vyjmenuje. Jinou složku dá `run({ previewDir })`.

**Náhledy rozpracovaných děl v gitu (`export/draft/`):** tytéž tři náhledy (`previewBuffers`) zmenšené na delší stranu
`DRAFT_EDGE` = 2000 px (`shrinkPreview`, nikdy nezvětšené; popisky a čáry rostou s fotkou, čísla zůstávají v px původní
fotky) jdou do `export/draft/[<kolekce>/]<slug>/` obsahového repa jako `backgrounds.jpg`, `cut.jpg`, `frames.jpg`
a rohy zblízka `frames-tl.jpg`, `frames-tr.jpg`, `frames-br.jpg`, `frames-bl.jpg` (`PREVIEW_KINDS`; 500 px, nezmenšují se, v README zobrazené ve 400 px)
s `README.md` (`draftReadme`: název, údaje, „Kód obrazu“ a kolekce, „Text na webu“ (texty díla formátované jako na webu,
`textPreviewLines` jako přehled, odkazy na web s celou adresou), „Stav popisu“, všechny náhledy, v „Rámečcích“ rohy
jako tabulka 2 × 2 nad celou fotkou, použité `meta_corners`) a přehled
`export/draft/README.md` podle kolekcí (`draftIndex`, u každého díla kód za názvem a značky stavu popisu `noteMarks`, např.
„✗ 1 · 💡 3“ = chyby, ke kontrole ⚠, doporučení, údaje k doplnění ✎, s legendou nahoře). Složku má **každé** rozpracované
dílo a každé s fotkou má všechny tři náhledy, i když se nic neořezává (`meta_corners: false` nebo samé nuly: celá fotka
na papírech, u `false` bez čáry a popisků ořezu, `cutPreview`), aby měly všechny drafty totéž. Bez fotky jen `README.md`
se stavem popisu a důvodem, proč náhledy nejsou (`noPreviews`: `photo` / `errors`), v přehledu „bez náhledu“. „Stav popisu“ je totéž, co o díle říká souhrn běhu (`workNotes`
v `scripts/lib/summary.mjs`, stejné skupiny: Chyby, Ke kontrole, Doporučení, Zbývá doplnit; bez hlášek věta „nic
nehlásí“); README se píše každým během (`writeIfChanged`), hlášky do otisku nepatří. Vznikají při každém běhu, i ve větvi
(`--prepare-only`), **i když běh skončí chybami v popisech** (README díla pak ukáže jeho chyby). Dílo s vlastní chybou
nové náhledy nedostane (jeho rohy mohou být špatně): staré obrázky i otisk zůstanou, bez nich README místo obrázků napíše
„Náhledy ořezu zatím nejsou“. Přehled (i v každé složce kolekce) se píše každým během bez `only`, i s chybami; dílo,
jehož popis nejde přečíst, v něm do opravy chybí. Při běhu s chybami se ale nic nemaže (takový popis by jinak vypadal
jako zveřejněné dílo). Workflow obsahového repa je commitne zpět i po chybách pipeline (krok commitu
a nahrání náhledů mají `if: !cancelled() && steps.pipeline.outcome != 'skipped'`; stejně nahrání v `dry-run.yml`). Obrázky se přepíšou jen při změně otisku (fotka, `meta_corners`, `images.edges`, `DRAFT_VERSION`;
otisk je v komentáři `<!-- otisk: … -->` v `README.md`), takže git neroste s každým během. Dílo zveřejněné
(`meta_draft: false`), smazané nebo přejmenované složku ztratí při dalším běhu bez `only` (`planFolderPrune`
s `EXPORT_FILES.draft`; souhrn ji uvede pod „Odstraněno“); bez draftů zmizí i přehled. Jiné soubory ve složce
zůstanou.

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
             .previews/rano-u-rybnika-k3f9a-frames.jpg (frame lines), .previews/rano-u-rybnika-k3f9a-frames-tl.jpg, …-frames-tr.jpg,
             …-frames-br.jpg, …-frames-bl.jpg (corners close up)
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
  - `<out>/<slug>-<id>-frames-tl.jpg`, `-frames-tr.jpg`, `-frames-br.jpg`, `-frames-bl.jpg`: každý roh fotky zblízka
    (`cornerFramesOf`, `cornerFramesSvg`), `CORNER_SIZE` 200 × 200 bodů fotky zvětšených `CORNER_SCALE` 2,5× na 500 × 500
    (body ostré, `kernel: 'nearest'`, střídavě 2 a 3 body široké; menší fotka = menší výřez), s čarami `CORNER_LINES` (po 5 bodech
    od 5 do 100, pak 110, 120 a 130) středem toho bodu od obou krajů rohu, nakreslenými až do zvětšeniny (nejdřív všechny
    čáry, přes ně všechna čísla s tmavým obrysem, aby je žádná čára nepřeškrtla), barvy
    jako u rámečků, popisky po schodech v půlce dál od rohu; číslo u čáry je přímo hodnota pro `meta_corners`.
  - `<out>/<slug>-<id>-frames.jpg` je celá **neoříznutá** fotka v plné velikosti (vidět jsou všechny její původní okraje)
    s rámečky čar (`framesOf`, `frameLines`, `framesSvg`): pro každý podíl z `images.edges.guides` (výchozí 0,3; 0,6;
    1; 1,5; 2; 2,5; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14 a 15 %) dvě svislé čáry ve vzdálenosti podílu **šířky** od levého a pravého kraje a dvě
    vodorovné ve vzdálenosti podílu **výšky** od horního a dolního kraje. Barvy se střídají (`FRAME_COLOURS`: žlutá,
    modrá, zelená, purpurová, azurová, červená, tedy světlá a tmavá na přeskáčku), aby sousední čáry byly odlišné odstínem
    i jasem; číslo má obrys černý u světlé barvy a bílý u tmavé (`outlineOf`). U každé čáry je v její barvě napsaná její vzdálenost od
    nejbližšího kraje v pixelech fotky (`37 px`), tedy v jednotkách `meta_corners`; procenta se nepíšou. Popisky jdou
    po schodech (každá další čára o řádek či sloupec dál: svislých kolem poloviny výšky, vodorovných kolem poloviny
    šířky) a kreslí se až po všech čarách, takže se nepřekrývají a žádná čára přes ně nevede.
  Náhledy fotky 3673 × 2785 px (všechny tři soubory) trvají asi 4 s; šrafy schématu i jiné výplně se kreslí
  přímo, ne SVG vzorem (`<pattern>`), jehož vykreslení na fotku této velikosti trvá sekundy.
  To vše proto, aby šlo
  ořez prohlédnout na jakémkoli pozadí. Soubory se při každém spuštění přepíšou; prohlížeč obrázků (Náhled na Macu)
  může ukazovat starou verzi, dokud soubor znovu neotevřeš. `meta_corners: false` náhled nemá. Plný běh
  `npm run images` složku `.previews/` vyprázdní (nechá v ní jen náhledy draftů).

**Oklikání rohů (`npm run corners`, `scripts/corners.mjs`):** místo přepisování čísel z náhledů se rohy dají
naklikat myší. Příkaz spustí lokální server (jen `127.0.0.1`, výchozí port 4327, jiný `--port <číslo>`) nad obsahovým
repem z `CONTENT_DIR` v `.env` (nebo `npm run corners -- <obsahové repo>`) a vypíše adresu, kterou otevřeš v prohlížeči
(`http://127.0.0.1:4327/`). Bez nových závislostí; stránka je `scripts/corners.html`, logika serveru
`scripts/lib/corner-editor.mjs` (`route`, testovaná bez socketu).

- **Vlevo seznam děl** (fotky děl jako u `npm run preview`, `listMasters`), výchozí jen rozpracované (`meta_draft` není
  `false`), zaškrtávátkem všechna. Značka: `✓` má `meta_corners`, `?` nemá, `–` `meta_corners: false`, `•` neuložená
  změna (rozpracované úpravy se drží při přepínání mezi díly, dokud stránku nezavřeš). Vybrané dílo je v adrese (`#tvorba/…`).
- **Uprostřed celá fotka** (v plné velikosti, otočená podle EXIF jako u pipeline) s čtyřúhelníkem rohů a zatemněným
  okolím (= co bude průhledné). Klik přesune nejbližší roh na místo kliku a vybere ho
  (`nearestCorner`, výběr se ukáže i v lupách rohů; šipky a lupy pak pracují s ním, jinak ho změní `1`–`4` nebo klik do lupy rohu),
  `Shift`+klik přesune vybraný roh (`clickTarget`). Roh, který by klik (nebo stisk na bodu) přesunul, má pod myší
  čárkovaný kroužek a čárkovanou čáru ke kurzoru, stejně v lupě u kurzoru, a stavový řádek nahoře ho vypíše
  („klik: br (vpravo dole)“, se `Shift` „…, vybraný“, na bodu „tažení: …“). Tažení bodu roh posune, tažení jinde posune fotku, kolečko zoomuje kolem kurzoru,
  stejně `+` / `-` (o 25 %, `=` jako `+` na anglické klávesnici; kolem kurzoru, mimo fotku kolem středu, `zoomView`).
  Klávesy (`keyAction`; přehled v okně na `?`, `Esc` ho zavře): `1`–`4` výběr rohu, šipky posun rohu o 1 px fotky
  (`Shift` o 10 px), `⌥`/`Alt` + šipky posun fotky o 50 bodů (`Shift` o 250), `0` zoom 1 : 1 (pixel fotky = pixel
  obrazovky), `F` celá fotka, `D` zatemnění zapnout/vypnout, `Z` další zvětšení lup dokola 2× → 4× → 8× → 2×
  (`Shift+Z` zpět, `nextZoom`); držení `Ctrl`/`⌘` ukáže u kurzoru kruhovou lupu ve zvětšení lup rohů s rohy a křížem
  (klik dá nejbližší roh pod kříž). Česká klávesnice: číslice i bez Shiftu podle místa klávesy (`é` = 0, `ě` `š` `č` = 2–4),
  klávesa 1 je `+`, roh `tl` je `Shift+1`. `Ctrl`/`⌘` s jinou klávesou patří prohlížeči.
  Z každého rohu vede přes celou fotku jemná vodorovná a svislá čára (`drawGuides`, `G` je skryje / ukáže; i v lupách rohů,
  středem pixelů jako jejich kříž, a v lupě u kurzoru): pomůcka, aby ořez vyšel co nejvíc jako pravoúhlý obdélník.
  Dvojice čar jedné strany listu (svislé `tl`/`bl` a `tr`/`br`, vodorovné `tl`/`tr` a `bl`/`br`, `rectangleDeviation`) mají
  barvu podle odchylky (`guideStyle`): na stejném místě zelené a tlustší, s rostoucí odchylkou přes žlutou a oranžovou
  do červené, od 1 % delší strany fotky červené a tlustší. Stejně obarvené odchylky v px ukazuje řádek nad fotkou.
  Tažený roh se do 8 bodů obrazovky přichytí k čáře jiného rohu (`snapPoint`), se `Shift` bez přichycení.
  Stavový řádek nahoře a nápověda dole jsou mimo plochu fotky, fotka pod ně nikdy nezajede.
  Překřížené rohy (levý roh `tl`/`bl` není vlevo od pravého `tr`/`br`, nebo horní `tl`/`tr` není nad dolním `bl`/`br`,
  `crossedCorners`): čtyřúhelník a dotčené body červeně, jejich lupy pod červeným filtrem s blikajícím rámečkem,
  řádky ořezu červeně, nad fotkou varování a *Zapsat do yaml…* nejde (zapsanou hodnotu překřížit nejde ani tak:
  každý roh nejvýš čtvrtinu fotky od svého rohu, `cornersProblems`).
- **Vpravo rohy zblízka**: každý roh ve zvětšení 2×/4×/8× (pixel fotky = 2/4/8 bodů, bez vyhlazení) s nitkovým
  křížem; klik do lupy dá roh přesně na ten pixel. Pod nimi ořez každého rohu v px a v % fotky (nad
  `images.edges.suspicious` červeně) a hotový blok `meta_corners:` (`editorYaml`, stejný text jako výpis `npm run preview`).
- **Tlačítka:** *Kopírovat* (blok do schránky), *Zapsat do yaml…* (po potvrzení na stránce zapíše `meta_corners` do
  popisu díla, existující hodnotu i `false` přepíše, nic jiného v souboru nezmění: `replaceCorners` přes `withCorners`),
  *Najít automaticky* (detekce jako v pipeline, `detectFile`; použije se i sama u díla bez rohů nebo s rohy jiné
  velikosti fotky), *Vrátit z yaml*, *Celá fotka* (samé nuly = nic se neořízne).
- Zápis server zkontroluje stejně jako pipeline (`cornersProblems`: velikost fotky, nejvýš čtvrtina strany) a odmítne
  fotku bez popisu (ten založí `npm run images`). Fotky a popisy bere jen ze seznamu děl, nikdy cestu z požadavku;
  odpovídá jen na adresu `127.0.0.1`/`localhost` svého portu a zápis přijme jen ze své stránky (`Origin`,
  `trustedRequest`), aby ho nemohla zavolat jiná stránka otevřená v prohlížeči.
- Zapisuje do obsahového repa v té větvi, která je zrovna checkoutnutá; změnu pak commitni jako ruční úpravu.
  Náhledy ořezu se obnoví při dalším `npm run images` (nebo `npm run preview`).

**Vyzkoušení:** `npm run demo` (testovací data mají list vyfocený nakřivo na podlaze, viz *Testovací data*),
pak dílo „Na podlaze“ ve všech třech paletách; náhled rozpracovaného díla je v `.demo/site/.previews/` a zmenšený
v `.demo/content/export/draft/` (`README.md` s náhledy). Na skutečném
obsahu nejdřív `npm run preview -- <fotka|složka>` (nic nezapíše), pak `npm run images -- --prepare-only`
(zapíše rohy do popisů v obsahovém repu, náhledy draftů do `.previews/` a do `export/draft/`).

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

- Vodoznak na Fleru nese jméno autorky a místo (`images.fler.watermark`), žádný odkaz ven. Fler odkazy mimo platformu nepovoluje.
- Mockupy jsou v reálném měřítku (kalibrace v `mockups/scenes.yaml`), ať si zákazník udělá správnou představu o velikosti.
- Provoz: GitHub Pages zdarma, platí se jen doména.
