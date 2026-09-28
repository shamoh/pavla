# Pavla Kramolišová · akvarely

Osobní web s tvorbou (Astro, statický, GitHub Pages) a obrázková pipeline,
která z jedné fotky každého díla připraví výstupy pro web, Instagram a Fler.

Obsah (originály fotek a popisy děl) žije v soukromém repu **`pavla-content`**,
které má být naklonované vedle tohoto repa. Tohle repo je **veřejné**: obsahuje kód
webu a to, co z obsahu vygeneruje pipeline. Soukromé věci (originály, soukromé
poznámky) sem nikdy nejdou.

```
pavla-content/                              (soukromé repo, zdroj obsahu)
  tvorba/<rok>/<slug>.yaml                  popis díla, vč. unikátního id a soukromé poznámky
  tvorba/<rok>/<slug>.jpg                   master fotka díla
  tvorba/<rok>/<slug>/*.jpg                 detailní fotky díla (nepovinné)
  kolekce/<slug>.yaml                       popis kolekce (např. jednoho plenéru)
  kolekce/<slug>.jpg                        úvodní fotka kolekce (nepovinné)
  fotky/<název>.jpg + <název>.yaml          ostatní fotky webu (O mně, Kontakt)
  export/instagram/<rok>/…                  pro Instagram: originál a detaily, jen díla s instagram: true (generuje pipeline)
  export/fler/<rok>/…                       pro Fler: originál a mockupy s vodoznakem, jen díla na prodej

pavla/                                      (toto repo, veřejné)
  demo/                                     testovací data (yaml + recept na obrázky), viz Testovací data
  .demo/                                    připravená testovací data a web z nich (npm run demo, mimo git)
  content/works/<rok>/<slug>-<id>.yaml      veřejná kopie popisu díla (generuje pipeline, needitovat)
  content/collections/<slug>.yaml           veřejná kopie popisu kolekce (generuje pipeline)
  public/works/<rok>/<slug>-<id>/           webové velikosti díla, detailů a mockupů, og.jpg + info.json (generuje pipeline)
  public/collections/<slug>/                úvodní fotka kolekce (generuje pipeline)
  public/og/collections/<slug>.jpg          obrázek pro sdílení kolekce, ořez 3:2 (generuje pipeline)
  public/photos/<název>/                    webové velikosti ostatních fotek (generuje pipeline)
  mockups/                                  scény pro mockupy a jejich kalibrace (scenes.yaml)
  scripts/process-images.mjs                pipeline (npm run images)
  scripts/lib/                              logika pipeline a filtrů, každý modul má *.test.mjs
  scripts/templates/                        kostry yaml, které pipeline zakládá
  src/                                      web (Astro stránky a komponenty)
  site.config.yaml                          jméno, kontakty, doména, nastavení pipeline
```

## Adresy na webu

| Adresa | Co ukazuje |
|---|---|
| `/tvorba/` | všechna díla s filtry (viz níže) |
| `/tvorba/2026/` | díla z jednoho roku (filtry bez roku) |
| `/tvorba/kolekce/` | přehled kolekcí (úvodní fotka, název, počet děl, popis) |
| `/tvorba/kolekce/plener-sumava-2026/` | kolekce: název, popis, úvodní fotka a její díla s filtry |
| `/tvorba/2026/rano-u-rybnika-k3f9a/` | detail díla |
| `/tvorba/k3f9a/` | trvalý krátký odkaz, přesměruje na detail |
| `/o-mne/`, `/kontakt/` | stránky s fotkami z `pavla-content/fotky/` |

**ID díla** (např. `k3f9a`) vygeneruje pipeline při prvním zpracování a zapíše
ho do yaml. Už se nemění: díky němu fungují staré odkazy i po přejmenování díla
(neznámá adresa končící na `-<id>/` přesměruje na aktuální detail). Může sloužit
i jako katalogové číslo na zadní straně obrazu. ID má 5 znaků, začíná písmenem
a neobsahuje snadno zaměnitelné znaky (`0 o 1 l i`).

### Filtry v galerii

Všechny filtry jdou kombinovat (platí všechny najednou) a **každá změna se hned
zapíše do URL**. Adresu jde zkopírovat a poslat, u příjemce ukáže stejný výběr.
Tohle je závazné pravidlo: každý nový filtr musí mít parametr v URL.

| Filtr | Parametr v URL | Hodnoty |
|---|---|---|
| Téma (čipy s počty) | `tag` | jeden tag, např. `?tag=krajina` |
| Technika | `technique` | např. `?technique=akvarel` |
| Rok (jen na `/tvorba/` a u kolekce) | `year` | `?year=2025` |
| Kolekce (jen na `/tvorba/` a stránce roku) | `collection` | slug kolekce, `?collection=plener-sumava-2026` |
| Stav (s počty) | `status` | `available` = k prodeji, `unsold` = neprodané |
| Stránka (viz *Stránkování*) | `page` | číslo stránky od 2, `all` = vše bez stránkování |
| Na stránku (viz *Stránkování*) | `perPage` | `24` nebo `48` (výchozí 12 se nepíše) |

Když je vybraná kolekce, vedle výběru se objeví odkaz **„O kolekci →“** na její
stránku. Odkaz **Kolekce** v řádku s roky vede na přehled `/tvorba/kolekce/`.

Stav **k prodeji** jsou díla `available`. **Neprodané** jsou díla, která se
prodávají a ještě nejsou prodaná: `available` + `reserved`. Díla `not-for-sale`
ani `sold` se v žádném z nich neobjeví. Příklad kombinace:
`/tvorba/?collection=plener-sumava-2026&status=unsold&tag=voda`.

Logika filtrů je v `scripts/lib/gallery-filter.mjs` (sdílí ji prohlížeč i testy),
stav prodeje v `scripts/lib/works.mjs#isOnSale`.

### Stránkování

Každý výpis děl (`/tvorba/`, stránky roků, stránky kolekcí) se stránkuje. Pod
výpisem jsou čísla stránek, šipky „← Předchozí / Další →“ a mezery „…“ u dlouhých
seznamů.

- **Počet děl na stránku** si návštěvník vybere ve výběru „Na stránku“ mezi
  filtry: 12, 24 nebo 48 (`gallery.pageSizes` v `site.config.yaml`, první je
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

## Testovací data (demo)

Web a pipeline se ladí na **testovacích datech**, která jsou úplně oddělená od
skutečné tvorby. Skutečný web se staví vždy jen ze skutečných dat, i když jsou
zatím prázdná.

| | Skutečná data | Testovací data |
|---|---|---|
| zdroj | `pavla-content/` (soukromé) | `pavla/demo/` (toto repo) |
| obrázky | fotky v gitu `pavla-content` | negenerují se do gitu: `demo/images.yaml` je recept, obrázky vzniknou vždy stejně při `npm run demo` |
| zpracování | `npm run images` → `content/`, `public/` tohoto repa, exporty do `pavla-content/export/` | `npm run demo` → `.demo/content/` (obsah), `.demo/site/` (data webu), vše mimo git |
| web | `npm run dev` / `npm run build` / GitHub Pages | `npm run demo` (dev server), `npm run demo:build` (`.demo/site/dist`) |
| označení | nic, testovací data jsou zakázaná | každá položka: jméno `demo-…` (díla, kolekce) a `demo: true` (vše, i fotky) |

**Pojistky proti míchání** (`scripts/lib/demo.mjs`, `dataset` v `run()`):

- `npm run images` (skutečná data) skončí chybou, když najde dílo, kolekci
  nebo fotku označenou jako testovací (`demo-…` nebo `demo: true`), a nic
  nezapíše. Totéž platí pro automatiku na GitHubu.
- `npm run demo` naopak odmítne položku bez úplného označení, takže každý
  soubor zkopírovaný z testovacích dat do skutečných se pozná.
- Pravidlo pro Claude Code v CLAUDE.md: testovací data se tvoří jen v `pavla/demo/`,
  nikdy v `pavla-content`.

**Jak `npm run demo` funguje** (`scripts/demo.mjs`): zkopíruje yaml z `demo/`
do `.demo/content/`, vykreslí obrázky podle receptu (`scripts/lib/demo-images.mjs`:
abstraktní skvrny z pevného seedu, detailní fotky jako výřezy), přidá statické
soubory webu (favicon; ne `CNAME`) a spustí **stejnou pipeline** jako pro skutečná
data, jen s výstupem do `.demo/site/`. Web pak běží s `SITE_DATA_DIR=.demo/site`
(`src/lib/site.ts` a `astro.config.mjs` čtou data odtud). Kódy (`id`) a kostry,
které pipeline doplní, se zapíšou zpět do `demo/`, aby zůstaly stálé. První
příprava trvá kolem 1,5 minuty, další jen přegenerují změny.

**Nové testovací dílo:** yaml do `demo/tvorba/<rok>/demo-<slug>.yaml` (s `demo: true`)
a řádek do `demo/images.yaml` (`size`, `palette`, `seed`; detailní fotka jako
`from` + `crop`). Pak `npm run demo`, pipeline doplní `id`.

## Přidání nového díla

1. Do `pavla-content/tvorba/<rok>/` ulož master fotku, ideálně pod krátkým
   názvem bez diakritiky (`rano-u-rybnika.jpg`). Jiný název nevadí:
   `Ráno u rybníka.jpg` se spáruje s `rano-u-rybnika.yaml`.
2. `npm run images` (v tomto repu):
   - k fotce bez popisu vytvoří kostru `rano-u-rybnika.yaml` s `draft: true`,
   - každému popisu bez `id` ho přidělí,
   - k neexistující kolekci, na kterou dílo odkazuje, založí kostru `kolekce/<slug>.yaml`,
   - zkontroluje popisy (viz *Kontroly* níže); při chybě nic nezapíše na web,
   - vygeneruje web i exporty (jen pro nová či změněná díla),
   - smaže vygenerované soubory děl, kolekcí a fotek, které z `pavla-content` zmizely nebo se přejmenovaly,
     včetně jejich exportů v `export/instagram` a `export/fler`.
3. Doplň yaml v `pavla-content` a smaž řádek `draft: true`, jinak se dílo na
   webu nezobrazí. Pak znovu `npm run images`.
4. Zkontroluj lokálně (viz *Lokální vyzkoušení*).
5. Commit a push v obou repech: `pavla-content` (fotka, yaml, exporty)
   a `pavla` (`content/` a `public/`). Web se po pushi do `main` nasadí sám.
6. `export/instagram` a `export/fler` nahraj ručně na Instagram a Fler (viz *Exporty*).

Užitečné varianty: `npm run images -- --force` (přegeneruje vše),
`npm run images -- rano-u-rybnika` (jen jedno dílo, kolekce nebo fotka daného
jména, nic nemaže), jiná cesta k obsahu: `CONTENT_DIR=~/cesta/k/pavla-content npm run images`.

### Popis díla (yaml)

```yaml
id: k3f9a                     # doplní pipeline, NEMĚNIT
title: Ráno u rybníka
date: 2026-06-14              # určuje řazení; rok musí sedět se složkou
technique: akvarel
support: papír Arches 300 g   # nepovinné
size_cm: [40, 30]             # šířka × výška; drží měřítko mockupu na stěně
tags: [krajina, voda, plenér]
status: available             # available | reserved | sold | not-for-sale
price: 3200                   # Kč; zobrazí se jen u available
fler: https://www.fler.cz/... # tlačítko „Koupit na Fleru“
instagram: true               # připravit fotky pro Instagram (výchozí false)
featured: true                # kandidát na úvodní stránku
collection: plener-sumava-2026 # slug kolekce (soubor kolekce/<slug>.yaml), nepovinné
draft: true                   # rozpracované, na webu se nezobrazí
description: |                # veřejný popis na webu
  Pár vět o obraze.
details:                      # popisky detailních fotek, nepovinné (viz Detailní fotky)
  1-mlha: Mlha nad hladinou
private_note: |               # SOUKROMÉ: zůstane jen v pavla-content
  Komu jsem ho ukazovala, za kolik šel, co příště jinak.
```

**Stavy:**

| `status` | Na webu | Mockupy | Export Fler | Export Instagram |
|---|---|---|---|---|
| `available` | K prodeji, cena a tlačítka | ano | originál + mockupy | jen s `instagram: true` |
| `reserved` | Rezervováno | ano | originál + mockupy | jen s `instagram: true` |
| `sold` | Prodáno, bez ceny | ne | nic | jen s `instagram: true` |
| `not-for-sale` (výchozí) | Není na prodej | ne | nic | jen s `instagram: true` |

**Instagram na vyžádání:** fotky pro Instagram (originál a detaily) vzniknou jen
u díla s `instagram: true`. Výchozí je `false` (kostra ho tak zapisuje). Přepnutí
dílo přegeneruje, vypnutí jeho exporty pro Instagram smaže. Jiná hodnota než
`true`/`false` je chyba. Pole zůstává jen v `pavla-content`, na web se nekopíruje.

Obrazy na prodej jsou `available` a `reserved`: jen ty mají mockupy, Fler exporty
a jen ty ukazuje filtr „neprodané“. **Musí mít cenu** (`price`, kladné číslo
v Kč), jinak pipeline skončí chybou.

**Soukromá poznámka a veřejná kopie:** do `content/works/` (veřejné repo) se
kopírují jen pole z `PUBLIC_WORK_FIELDS` v `scripts/lib/works.mjs`, a to bez
komentářů. `private_note`, komentáře v yaml i jakákoli neznámá pole zůstávají
jen v `pavla-content`. Nové veřejné pole je proto potřeba do seznamu přidat,
jinak se na web nedostane. U kolekcí platí totéž (`PUBLIC_COLLECTION_FIELDS`
v `scripts/lib/collections.mjs`).

**Testovací data** jsou úplně oddělená od skutečných (viz *Testovací data (demo)*):
17 děl (16 publikovaných, 1 rozpracované), 4 kolekce a 3 zástupné fotky
v `demo/`, zobrazené přes `npm run demo`.

| Funkce | Kde ji testovací data ukazují |
|---|---|
| roky | 2025 (6 děl), 2026 (10 publikovaných) |
| stránkování | `/tvorba/` má 16 děl = 2 stránky po 12, při 24 nebo 48 jedna; stránky roků (6 a 10 děl) se nestránkují |
| rozpracované dílo (`draft`) | Rozpracovaný obraz: nesmí být nikde na webu |
| `available` | Pivoňky, Zimní sad, Ráno u rybníka, Město v dešti, Náměstí v mlze, Máky, Bouřka nad polem |
| `reserved` | Kočka na okně, Modravské slatě, Rybník v zimě |
| `sold` | Jablka na stole, Šumava v mlze, Nádraží |
| `not-for-sale` | Kytice z louky, Kvilda skica, Slunečnice |
| techniky | akvarel, akvarel a tuš, pastel, kresba tužkou, kvaš (Slunečnice, Rybník v zimě) |
| tagy | krajina, voda, plenér, hory, květiny, zátiší, ovoce, zvířata, zima, město, déšť, mlha, léto (i kombinace) |
| `featured` (úvodní stránka) | Ráno u rybníka, Šumava v mlze |
| tlačítko „Koupit na Fleru“ | Máky |
| export pro Instagram (`instagram: true`, asi čtvrtina děl) | Ráno u rybníka (+ 2 detaily), Pivoňky (+ 1 detail), Kytice z louky (+ 1 detail, není na prodej), Máky; ostatní díla žádný |
| mockupy malého díla (≤ 35 cm) / většího | Kočka na okně / Zimní sad |
| detailní fotky | Ráno u rybníka (2, s popisky), Kytice z louky (1, bez popisku), Pivoňky (1 široký) |
| kolekce: vlastní úvodní fotka (panorama + `focus`) | Plenér Šumava 2026 |
| kolekce: `cover: <id>#<detail>` + `focus` | Ze zahrady 2025 (detail Pivoněk) |
| kolekce: `cover: <id>` (celé dílo) | Město 2026 (Město v dešti, ne nejnovější Náměstí v mlze) |
| kolekce bez `cover` = nejnovější dílo | Kresby, pastely a kvaš 2025 (Rybník v zimě) |
| díla bez kolekce | Zimní sad, Slunečnice, Máky, Bouřka nad polem |
| soukromá poznámka | Ráno u rybníka, Jablka na stole, kolekce Plenér Šumava 2026 |
| fotky stránek | zástupné `o-mne-uvod` (s `focus`), `portret` a `kontakt` |

### Kontroly (pipeline při chybě nic nezveřejní)

- rok v `date` sedí se složkou, `title` a `date` nechybí,
- `id` je platné a unikátní, `size_cm` jsou dvě kladná čísla (u publikovaných děl),
- dílo `available` nebo `reserved` má `price` (kladné číslo),
- `instagram` je `true` nebo `false`,
- `collection` je slug (malá písmena, číslice, pomlčky), kolekce má `title`,
- `cover` kolekce je `id` publikovaného díla této kolekce (případně `#` a jeho existující detail) a kolekce nemá zároveň vlastní úvodní fotku, `focus` kolekce je `[x, y]` 0–100,
- `focus` fotky je `[x, y]` v rozsahu 0–100,
- každý klíč v `details:` odpovídá existující detailní fotce a popisek je text,
- soubory ve složkách mají známý typ, detailní složka patří k existujícímu dílu,
- dva soubory nemíří na stejný slug.

## Detailní fotky díla

Zajímavé výřezy obrazu (detail tahu, textura papíru, konkrétní část) se ukážou
na detailu díla pod popisem a stavem (mockupy jsou až pod nimi) a jdou i na Instagram.

**Kam je dát:** do podsložky vedle master fotky, pojmenované přesně jako dílo:

```
pavla-content/tvorba/2026/rano-u-rybnika.jpg        master
pavla-content/tvorba/2026/rano-u-rybnika.yaml       popis
pavla-content/tvorba/2026/rano-u-rybnika/1-mlha.jpg detail 1
pavla-content/tvorba/2026/rano-u-rybnika/2-rakos.jpg detail 2
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

Detail bez popisku se na webu jmenuje „detail 1“, „detail 2“ podle pořadí.
Popisek je pod náhledem, v prohlížečce a v `alt`. Popisek u fotky, která ve
složce není, je chyba. Změna popisku obrázky nepřegeneruje (je v kopii yaml).

**Co vznikne:** `public/works/<rok>/<slug>-<id>/detail-<jméno>-<šířka>.{avif,webp,jpg}`
(šířky `images.details.widths` v `site.config.yaml`), seznam v `info.json#details`
a export `export/instagram/<rok>/<slug>-<id>-detail-<jméno>.jpg` (celý rámeček
4:5, ořez na střed). Přidání, změna nebo smazání fotky dílo přegeneruje
a staré soubory i exporty smaže.

**Testovací data:** `demo-rano-u-rybnika` (na prodej, 2 detaily s popisky),
`demo-kytice-z-louky` (není na prodej, 1 detail bez popisku) a `demo-pivonky`
(1 široký detail, který je zároveň úvodním obrazem kolekce „Ze zahrady 2025“).

## Exporty (Instagram, Fler)

Pipeline je vyrábí do `pavla-content/export/` při každém přegenerování díla.
Předtím smaže všechny staré exporty daného díla, takže nikdy nezůstane nic
neplatného (např. Fler fotky prodaného obrazu).

Úklid na konci plného běhu navíc porovná `export/` s tím, co by každé dílo mít
mělo (`expectedExports` v `scripts/lib/works.mjs`), bez ohledu na to, jestli
se dílo v tomto běhu přegenerovalo. Smaže:

- exporty děl, která z `pavla-content` zmizela nebo se přejmenovala (i přesunutá do jiného roku),
- exporty detailních fotek, které dílo už nemá,
- Fler exporty mockupů scén, které dílo už nemá (podle `info.json`),
- všechny Fler exporty díla, které není na prodej,
- exporty pro Instagram díla, které nemá `instagram: true`,
- mockupy na Instagramu (včetně starých `-wall.jpg`).

Export se pozná podle názvu `<slug>-<id>…jpg`. Soubory, které nevypadají jako export (např.
vlastní poznámky), úklid nechá být. Běh s jedním dílem (`npm run images -- <slug>`)
nic nemaže. Smazané soubory jsou v logu (`- removed export/…`) a v souhrnu běhu
na GitHubu. Logika: `planExportPrune` v `scripts/lib/works.mjs`.

| Platforma | Kdy | Soubory |
|---|---|---|
| Instagram | jen dílo s `instagram: true` | `<slug>-<id>-clean.jpg` (originál na papírovém pozadí, 4:5), `<slug>-<id>-detail-<jméno>.jpg` (každý detail, 4:5). **Nikdy mockupy.** |
| Fler | jen `available` a `reserved` | `<slug>-<id>.jpg` (originál), `<slug>-<id>-mockup-<scéna>.jpg` (každý mockup). Vše s vodoznakem. |

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
| detail díla | celý obraz na papírovém pozadí, **nikdy oříznutý** | `public/works/<rok>/<slug>-<id>/og.jpg` |
| úvodní stránka | totéž pro hlavní (první `featured`) dílo | týž soubor |
| stránka roku | první `featured` dílo roku, jinak nejnovější | týž soubor |
| stránka kolekce | úvodní obraz kolekce oříznutý na 3:2 kolem `focus` (jako na stránce) | `public/og/collections/<slug>.jpg` |
| přehled kolekcí | náhled první (nejnovější) kolekce | týž soubor |

Obraz se v náhledu díla neořezává, protože jde o umělecké dílo: obraz na výšku
má po stranách papír. Náhled díla vzniká s webovými obrázky (přegeneruje se se
změnou fotky). Dokud neexistuje, stránka sdílí největší webovou velikost do
1600 px. Kód: `shareImage` v `scripts/process-images.mjs`, `workShareImage`,
`worksShareImage` a `collectionShareImage` v `src/lib/site.ts`, meta v `src/layouts/Base.astro`.

## Kolekce

Kolekce seskupuje díla, např. z jednoho plenéru. Dílo patří nejvýš do jedné
kolekce (`collection: <slug>` v jeho yaml).

```yaml
# pavla-content/kolekce/plener-sumava-2026.yaml
title: Plenér Šumava 2026
description: |
  Týden malování venku na Kvildě a Modravě.
cover: k3f9a#1-kvet # úvodní obraz: id díla z kolekce, případně #detailní fotka; nepovinné
focus: [50, 40]     # úvodní obraz se ořízne na 3:2 kolem tohoto bodu [zleva %, shora %]
private_note: ""    # soukromé, na web se nedostane
```

- **Úvodní obrázek** kolekce (na její stránce, v přehledu i jako náhled při
  sdílení), v tomto pořadí:
  1. vlastní fotka `kolekce/plener-sumava-2026.jpg`,
  2. `cover: <id>`: celé dílo (musí být v této kolekci a publikované),
  3. `cover: <id>#<detail>`: jedna z detailních fotek toho díla (jméno jako
     v `details:`, tj. název souboru bez přípony; bez mezer kolem `#`, jinak
     by YAML bral zbytek jako komentář),
  4. jinak nejnovější dílo kolekce.
  Fotka i `cover` zároveň je chyba (pipeline neví, co platí), stejně jako
  detail, který dílo nemá.
- Úvodní obrázek se na stránce kolekce i v přehledu vždy **ořízne na 3:2**,
  ať je to vlastní fotka, dílo nebo detail v jakémkoli poměru stran, takže
  obraz na výšku ani panorama nerozbije hlavičku. Co zůstane vidět, určuje
  `focus` (výchozí `[50, 50]` = střed).
- **Obrázek pro sdílení** (`og:image`, náhled odkazu na Facebooku, WhatsAppu
  apod.) je stejný výřez: pipeline ho vyrobí jako
  `public/og/collections/<slug>.jpg` (1200 × 800, `images.og` v
  `site.config.yaml`) ze stejného zdroje, jaký ukazuje stránka
  (`coverSource` v `scripts/lib/collections.mjs`), a se stejným ořezem
  (`focusCrop` v `scripts/lib/photos.mjs` počítá jako CSS `object-position`).
  Vyrábí se při každém běhu, zapíše se jen při změně. Zmizí se smazanou
  kolekcí. Dokud neexistuje, stránka sdílí neoříznutý obrázek. Když ořez nestačí, je lepší připravit široký
  detail a použít `cover: <id>#<detail>`. Komponenta `src/components/CollectionCover.astro`.
- Kostru yaml založí pipeline sama, když na kolekci odkáže dílo nebo když do
  `kolekce/` přibude fotka bez popisu.
- Stránka `/tvorba/kolekce/<slug>/` vznikne jen pro kolekci s aspoň jedním
  publikovaným dílem. Vedou na ni: přehled `/tvorba/kolekce/`, řádek „Kolekce“
  u každého jejího díla a odkaz „O kolekci →“ v galerii při vybrané kolekci.
- V galerii je výběr „Kolekce“ s počty děl.
- Kód: `scripts/lib/collections.mjs` (pipeline), `src/lib/site.ts#getCollections`
  a `src/pages/tvorba/kolekce/` (přehled `index.astro`, stránka `[collection].astro`).

## Mockupy

Mockupy („jak by mohl vypadat u vás“) jsou marketing pro kupující, proto je
dostanou **jen díla na prodej, která ještě nejsou prodaná** (`available`,
`reserved`). Na webu a ve Fler exportech (s vodoznakem), nikdy na Instagramu.
Změna stavu na `sold` nebo `not-for-sale` dílo přegeneruje a jeho mockupy
i Fler exporty smaže. Změna mezi `available` a `reserved`
nic nepřegeneruje. Web navíc mockupy u jiných stavů neukáže, ani kdyby soubory
zůstaly.

Dílo na prodej dostane na stránce tři mockupy ve skutečném měřítku podle
`size_cm`. Klik na obraz, detail nebo mockup otevře prohlížečku, ve které se dá
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
`size_cm`, scén nebo toho, zda je dílo na prodej. Změna ceny či popisu obrázky
negeneruje znovu (zapíše se jen kopie yaml).

## Ostatní fotky (O mně, Kontakt)

Fotky ulož do `pavla-content/fotky/` a spusť `npm run images`. Ke každé vznikne
`<název>.yaml` s popisem (`alt`, `caption`), který stojí za to doplnit. Stránky
používají tyto názvy; dokud fotka neexistuje, na stránce prostě chybí:

| Fotka | Kde je |
|---|---|
| `o-mne-uvod.jpg` | O mně, nahoře pod jménem přes celou šířku, oříznutá na 2:1 podle `focus` |
| `portret.jpg` | O mně, vedle textu, úzký sloupec (ideálně fotka na výšku) |
| `kontakt.jpg` | Kontakt, vedle kontaktů |

Přípona může být i `.jpeg`, `.png` apod. Další fotku lze na libovolnou stránku
přidat komponentou `<Photo name="…" />`.

```yaml
# pavla-content/fotky/o-mne-uvod.yaml
alt: Pavla maluje u potoka na šumavské pláni   # co je na fotce
caption: Můj ateliér pod širým nebem           # popisek pod fotkou, nepovinné
focus: [85, 60]                                # bod [zleva %, shora %], který zůstane vidět při ořezu
```

**Ořez a `focus`:** stránka může fotku oříznout na pevný poměr stran
(`<Photo name="…" aspect="2 / 1" />`). Ořez se vycentruje na bod `focus`
(výchozí `[50, 50]` = střed). Hodí se, když je důležitá část fotky u okraje.
`focus` mimo 0–100 nebo v jiném tvaru pipeline ohlásí jako chybu. Hodnota
jde do `info.json` a na web jako CSS `object-position`. Bez `aspect` se fotka
neořezává a `focus` nemá vliv.

## Lokální vyzkoušení

Obě repa vedle sebe, v tomto repu jednou `npm ci`.

1. `npm test`: unit testy pipeline, filtrů, testovací sady a pomocných modulů
   (`node:test`, běží na dočasných kopiích, reálný obsah nemění).
2. **Na testovacích datech** (vše níže): `npm run demo` → http://localhost:4321.
   Připraví `.demo/` a spustí web nad ním; skutečná data ani tohle repo nemění.
   `npm run demo:build` postaví web z testovacích dat do `.demo/site/dist`.
3. **Na skutečných datech:** `npm run images` zpracuje `../pavla-content`
   (zapisuje do obou rep), `npm run dev` nebo `npm run build && npm run preview`
   ukáže přesně to, co půjde ven.

Co kde vyzkoušet (adresy platí pro `npm run demo`):

| Změna | Jak ověřit |
|---|---|
| filtry | `/tvorba/`: klikej na filtry, sleduj URL; zkopíruj URL do nového okna, musí ukázat totéž. Testovací data mají pro každou kombinaci aspoň jedno dílo. |
| stránkování | `/tvorba/`: 12 děl a stránky 1, 2; klikni na 2, v URL `?page=2`, zkopíruj do nového okna. Vyber filtr, vrátí tě na 1. stránku; `?page=99` se opraví na poslední. „Zobrazit vše (16)“: všech 16 děl, v URL `?page=all`; změň filtr, zůstane vše; „Zobrazit po stránkách“ vrátí 1. stránku. „Na stránku“ 24: všech 16 na jedné stránce, v URL `?perPage=24`; zpět na 12 parametr zmizí; `?perPage=13` se ignoruje. Paměť: zvol 24, otevři `/tvorba/` znovu bez parametrů (nebo stránku kolekce) → 24 a `?perPage=24` v URL; otevři `/tvorba/?page=2` → 12 na stránku (odkaz má přednost); zvol 12 → paměť se smaže. Smazat ručně: DevTools → Application → Local Storage → `pavla.gallery.perPage`. Menší první hodnota `gallery.pageSizes` (např. `[4, 12]`) ukáže mezery „…“. |
| náhledy pro sdílení | `grep -o '<meta property="og:image[^>]*>' dist/tvorba/2026/*/index.html` po `npm run build`; soubory `public/works/*/*/og.jpg` a `public/og/collections/*.jpg`. Online: po nasazení vlož odkaz do <https://www.opengraph.xyz/> nebo do Facebook Sharing Debuggeru. |
| rozpracované dílo | „Rozpracovaný obraz“ nesmí být v galerii, v roce 2026 ani na adrese `/tvorba/dhsh5/` |
| web bez děl | `mkdir -p /tmp/prazdny/public && cp public/favicon.svg /tmp/prazdny/public/ && SITE_DATA_DIR=/tmp/prazdny npx astro build`: úvodní stránka ukáže „Obrazy tu brzy přibudou.“ a odkaz na Instagram (bez `site.instagram` jen první větu) |
| stav a mockupy | v yaml změň `status` (např. `available` → `sold`), `npm run images`: v logu `→ <dílo>`, na detailu zmizí mockupy, z `export/fler` zmizí všechny soubory díla |
| exporty | `ls .demo/content/export/*/*/`: Instagram jen Ráno u rybníka, Pivoňky, Kytice z louky a Máky (`instagram: true`) s `-clean` a `-detail-*`, Fler jen díla `available`/`reserved`; smaž `instagram: true` u Máků v `demo/`, `npm run demo:prepare`, jejich export zmizí (originál + `-mockup-*`) |
| cena | smaž `price` u díla `available`: `npm run images` skončí chybou „needs a price“ |
| úklid exportů | přejmenuj dílo (yaml, fotku i složku detailů), `npm run images`: v logu `- removed export/…` se starým názvem, v `export/` zůstanou jen soubory s novým názvem; totéž po smazání díla. Nebo nakopíruj do `export/fler/<rok>/` cizí soubor `<slug>-<id>-mockup-xyz.jpg` existujícího díla: další běh ho smaže, i když nic nepřegeneruje. |
| kolekce | `/tvorba/kolekce/` (přehled), `/tvorba/kolekce/demo-plener-sumava-2026/` (s úvodní fotkou), `/tvorba/kolekce/demo-zahrada-2025/` (bez ní), výběr „Kolekce“ a „O kolekci →“ v galerii, řádek „Kolekce“ na detailu díla |
| detailní fotky | `/tvorba/2026/demo-rano-u-rybnika-pf7ru/` (2 detaily s popisky), `/tvorba/2025/demo-kytice-z-louky-q6bn6/` (1 detail bez popisku): náhledy pod popisem, prohlížečka; v `export/instagram` soubory `-detail-*` |
| soukromá poznámka | `grep -r private_note .demo/site/content/` nesmí nic najít; `demo-rano-u-rybnika` a `demo-jablka-na-stole` ji v `demo/` mají |
| oddělení testovacích dat | zkopíruj `demo/tvorba/2026/demo-maky.yaml` do `../pavla-content/tvorba/2026/` a spusť `npm run images`: skončí chybou „test data do not belong in the real content“ a nic nezapíše (pak soubor smaž). Obráceně: yaml bez `demo: true` v `demo/` zastaví `npm run demo`. |
| fotky stránek | `/o-mne/` (`o-mne-uvod` nahoře oříznutá na 2:1, `portret` vedle textu; bez kterékoli z nich se rozložení přizpůsobí); změň `focus` v `fotky/o-mne-uvod.yaml` (např. `[10, 10]`), `npm run images`, výřez se posune |
| úvodní obraz kolekce | `/tvorba/kolekce/` a `/tvorba/kolekce/demo-zahrada-2025/`: „Ze zahrady 2025“ ukazuje široký detail Pivoněk (`cover: vjr39#1-kvety-nahore`). Zkus `cover: vjr39` (celé Pivoňky oříznuté na 3:2 kolem `focus`), pak řádek smaž (nejnovější Kytice z louky). „Plenér Šumava 2026“ má vlastní fotku jako panorama 2400 × 1000 s `focus: [25, 50]`: ořízne se na 3:2, zůstane levá část. |
| obrázek pro sdílení kolekce | po `npm run images` otevři `public/og/collections/*.jpg` (1200 × 800, stejný výřez jako na stránce); změň `focus` kolekce, `npm run images`, v logu `→ og kolekce/…` a výřez se posune. Na stránce kolekce je v `<meta property="og:image">`. |
| chyby v popisu | např. špatný rok v `date`, `collection: Velká Písmena`, popisek v `details:` k neexistující fotce, `cover` s dílem z jiné kolekce nebo `focus: [120, 50]`: `npm run images` skončí chybou a nic nezapíše |

Pozn.: když Astro při buildu padá na zápisu telemetrie (sandbox, CI bez domovského
adresáře), pomůže `ASTRO_TELEMETRY_DISABLED=1`.

## Automatické zpracování (GitHub Actions)

Pavla (ani nikdo jiný) nepotřebuje terminál: stačí nahrát fotku nebo upravit
yaml v `pavla-content` přes web GitHubu. Workflow `pavla-content/.github/workflows/publish.yml`
(„Zpracování obsahu“) pak:

- **na `main`**:
  1. spustí stejnou pipeline jako `npm run images` (kód bere z tohoto repa),
  2. commitne do `pavla-content` nové kostry popisů, přidělená ID a exporty pro Fler a Instagram,
  3. otevře (nebo aktualizuje) v tomto repu pull request z větve `obsah/aktualizace`
     s webovými obrázky a kopiemi popisů. Po sloučení se web nasadí.
- **na jakékoli jiné větvi** (např. `nove-obrazy`) jen připravuje, nic nezveřejní:
  1. spustí `npm run images -- --prepare-only`: k novým fotkám založí kostru
     popisu s výchozími hodnotami (`draft: true`, název z názvu souboru,
     datum dnešek nebo 1. 1. roku složky, `status: not-for-sale`,
     `instagram: false`…), doplní chybějící `id` a zkontroluje všechny popisy,
  2. commitne kostry a ID **zpět do stejné větve** („Pipeline: metadata
     skeletons and ids to fill in“),
  3. souhrn běhu je „Připraveno k doplnění“ se seznamem popisů k vyplnění.
     Obrázky, exporty ani pull request do tohoto repa nevznikají.

**Postup s větví:** nová větev s fotkami → push → automatika doplní kostry
(je potřeba si je stáhnout: `git pull`) → vyplnit skutečné hodnoty a smazat
`draft: true` → push do větve (automatika znovu zkontroluje, chyba = červený
běh) → pull request do `main` a sloučení → zpracování jako na `main`. Na webu
GitHubu jde totéž: při nahrání fotek zvolit *Create a new branch for this commit*,
po doběhnutí automatiky upravit yaml ve větvi a nakonec pull request sloučit.
Týdenní kontrola automatiky hlídá jen běhy na `main`.

Výsledek běhu (co se zpracovalo, co je potřeba opravit) je česky na stránce běhu
v záložce *Actions* repa `pavla-content`. Při chybě v popisu se nic nezveřejní.

Lokální `npm run images` funguje dál stejně. Jen nekombinuj obojí najednou:
buď pushni výsledek lokálního běhu, nebo nech pracovat Action.

**Jednorázové nastavení:**

1. Otevři předvyplněný formulář tokenu (název, platnost 366 dní, oprávnění *Contents* a *Pull requests*
   pro zápis):
   <https://github.com/settings/personal-access-tokens/new?name=pavla-content+to+pavla&description=Zpracovani+obsahu+z+pavla-content+otevira+PR+do+pavla&target_name=shamoh&expires_in=366&contents=write&pull_requests=write>
   Ručně zvol jen *Repository access → Only select repositories → shamoh/pavla* a dole *Generate token*.
   (Bez odkazu: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*,
   v části *Permissions* přes *Add permissions* přidat *Contents* a *Pull requests*, obojí *Read and write*.)
2. Repo `pavla-content` → *Settings → Secrets and variables → Actions → New repository secret*:
   název `PAVLA_TOKEN`, hodnota token z bodu 1.
3. Repo `pavla-content` → *Settings → Collaborators*: přidat Pavlin GitHub účet.
4. První běh lze spustit ručně: *Actions → Zpracování obsahu → Run workflow*.

**Hlídání automatiky:** workflow „Kontrola automatiky“ (`pavla-content/.github/workflows/health-check.yml`)
každé pondělí ověří:

- že `PAVLA_TOKEN` funguje a nevyprší do 14 dní,
- že poslední dokončený běh „Zpracování obsahu“ neselhal (i kdyby to bylo dávno). Selhání, které
  pozdější běh opravil, jen zmíní,
- že se poslední commit v `main` tohoto repa opravdu nasadil (deploy neselhal ani nechybí),
- že pull request `obsah/aktualizace` nečeká na sloučení déle než 7 dní.

Když je něco špatně, běh selže a v `pavla-content` se otevře issue „Automatika webu potřebuje pozornost“
(přiřazené tobě, takže přijde e-mail) s popisem a odkazem na selhaný běh, u tokenu i s návodem na obnovení.
Další týden se k otevřenému issue jen přidá komentář. Když je vše zase v pořádku, issue se samo zavře.
Logika je v `scripts/lib/health.mjs`, volání API v `scripts/check-health.mjs`.

## Vývoj

- `npm test`: testy pipeline a filtrů (`node:test`). Každý modul v `scripts/lib/` má svůj `*.test.mjs`.
- **Automatická kontrola** (`.github/workflows/check.yml`, „Kontrola kódu“): při každém pull requestu
  a pushi do `main` spustí `npm test` a `npm run demo:build` (celý web z testovacích dat) a ověří, že
  vznikla úvodní stránka, Tvorba i přehled kolekcí, že Tvorba má víc než 12 děl a že testovací web
  nenese doménu (`CNAME`). Skutečná data nepotřebuje. Nespouští se pro aktualizace obsahu
  z `pavla-content` (`content/`, vygenerované `public/…`) ani pro změny dokumentace (`*.md`);
  ručně jde spustit v *Actions → Kontrola kódu → Run workflow*. Připravená testovací data se
  ukládají do cache GitHubu, takže další běhy přegenerují jen změny.
- `npm run build`: musí projít před každým commitem.
- Kód, komentáře a názvy v kódu jsou anglicky; texty webu, URL a dokumentace česky.
- README obou rep udržujeme průběžně aktuální s každou změnou pipeline, struktury nebo webu.

## Jak fotit (nebo skenovat) akvarely

- **Do velikosti A4 (s A3 skenerem i A3) je lepší sken než fotka**: rovné světlo, žádné zkreslení, věrné barvy. Skenuj na 600 dpi, bez automatických úprav. Větší formáty lze skenovat po částech a spojit.
- **Fotka:** rozptýlené denní světlo (u okna, ne přímé slunce), nebo dvě stejná světla z obou stran pod ~45°. Stativ, objektiv přesně proti středu, senzor rovnoběžně s papírem, ohnisko ~50–85 mm ekv.
- **Papír musí ležet rovně.** Zvlněný akvarelový papír dělá stíny, takže ho zatiž rohy nebo dej pod sklo (pozor na odlesky).
- **Barvy:** foť do RAW, do prvního snímku dej šedou kartu a podle ní nastav vyvážení bílé celé série.
- **Retuš (ručně, darktable/Lightroom):** ořez na hranu malby, srovnání perspektivy, barvy podle originálu vedle monitoru. Výsledek exportuj jako sRGB JPEG, delší strana ideálně 3000 px a víc. To je master.

## Nastavení (jednorázově)

1. Repozitář `shamoh/pavla` → *Settings → Pages → Source: GitHub Actions*.
2. DNS (Forpsi): CNAME záznam `pavla` → `shamoh.github.io.` (doména je v `public/CNAME` a `site.config.yaml`).
3. Po ověření domény zapnout *Enforce HTTPS*.
4. Doplnit `email` a později `fler` v `site.config.yaml`, přepsat text v `src/pages/o-mne.astro`.
5. Naklonovat `shamoh/pavla-content` vedle tohoto repa (`../pavla-content`) a spustit `npm ci`.

## Poznámky

- Vodoznak na Fleru nese jen jméno autorky, žádný odkaz ven. Fler odkazy mimo platformu nepovoluje.
- Mockupy jsou v reálném měřítku (kalibrace v `mockups/scenes.yaml`), ať si zákazník udělá správnou představu o velikosti.
- Provoz: GitHub Pages zdarma, platí se jen doména.
