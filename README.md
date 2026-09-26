# Pavla Kramolišová · akvarely

Osobní web s tvorbou (Astro, statický, GitHub Pages) a obrázková pipeline,
která z jedné fotky každého díla připraví výstupy pro web, Instagram a Fler.

Obsah (originály fotek a popisy děl) žije v soukromém repu **`pavla-content`**,
které má být naklonované vedle tohoto repa. Tohle repo obsahuje kód webu
a to, co z obsahu vygeneruje pipeline.

```
pavla-content/                              (soukromé repo, zdroj obsahu)
  tvorba/<rok>/<slug>.yaml                  popis díla, vč. unikátního id
  tvorba/<rok>/<slug>.jpg                   master fotka díla
  fotky/<název>.jpg + <název>.yaml          ostatní fotky webu (portrét, ateliér)
  export/instagram/<rok>/<slug>-<id>-*.jpg  pro Instagram (generuje pipeline)
  export/fler/<rok>/<slug>-<id>.jpg         pro Fler s vodoznakem (generuje pipeline)

pavla/                                      (toto repo, veřejné)
  content/works/<rok>/<slug>-<id>.yaml      kopie popisu pro build webu (generuje pipeline, needitovat)
  public/works/<rok>/<slug>-<id>/           webové velikosti a mockupy (generuje pipeline)
  public/photos/<název>/                    webové velikosti ostatních fotek (generuje pipeline)
  mockups/                                  scény pro mockupy a jejich kalibrace (scenes.yaml)
  site.config.yaml                          jméno, kontakty, doména, nastavení pipeline
```

## Adresy na webu

| Adresa | Co ukazuje |
|---|---|
| `/tvorba/` | všechna díla, filtry podle tématu, techniky a roku |
| `/tvorba/2026/` | díla z jednoho roku |
| `/tvorba/2026/rano-u-rybnika-k3f9a/` | detail díla |
| `/tvorba/k3f9a/` | trvalý krátký odkaz, přesměruje na detail |

**ID díla** (např. `k3f9a`) vygeneruje pipeline při prvním zpracování a zapíše
ho do yaml. Už se nemění: díky němu fungují staré odkazy i po přejmenování díla
(neznámá adresa končící na `-<id>/` přesměruje na aktuální detail). Může sloužit
i jako katalogové číslo na zadní straně obrazu. ID má 5 znaků, začíná písmenem
a neobsahuje snadno zaměnitelné znaky (`0 o 1 l i`).

## Přidání nového díla

1. Do `pavla-content/tvorba/<rok>/` ulož master fotku, ideálně pod krátkým
   názvem bez diakritiky (`rano-u-rybnika.jpg`). Jiný název nevadí:
   `Ráno u rybníka.jpg` se spáruje s `rano-u-rybnika.yaml`.
2. `npm run images` (v tomto repu):
   - k fotce bez popisu vytvoří kostru `rano-u-rybnika.yaml` s `draft: true`,
   - každému popisu bez `id` ho přidělí,
   - zkontroluje, že rok v `date` sedí se složkou a že ID jsou unikátní,
   - vygeneruje web i exporty (jen pro nová či změněná díla),
   - smaže vygenerované soubory děl, která z `pavla-content` zmizela nebo se přejmenovala.
3. Doplň yaml v `pavla-content` a smaž řádek `draft: true`, jinak se dílo na
   webu nezobrazí. Pak znovu `npm run images`.
4. Zkontroluj lokálně: `npm run dev` → http://localhost:4321
5. Commit a push v obou repech: `pavla-content` (fotka, yaml, exporty)
   a `pavla` (`content/` a `public/`). Web se po pushi do `main` nasadí sám.
6. `export/instagram` a `export/fler` nahraj ručně na Instagram a Fler.

Užitečné varianty: `npm run images -- --force` (přegeneruje vše),
`npm run images -- rano-u-rybnika` (jen jedno dílo), jiná cesta k obsahu:
`CONTENT_DIR=~/cesta/k/pavla-content npm run images`.

```yaml
id: k3f9a                     # doplní pipeline, NEMĚNIT
title: Ráno u rybníka
date: 2026-06-14              # určuje řazení; rok musí sedět se složkou
technique: akvarel
support: papír Arches 300 g   # nepovinné
size_cm: [40, 30]             # šířka × výška; drží měřítko mockupu na stěně
tags: [krajina, voda, plenér]
status: available             # available | reserved | sold | not-for-sale
price: 3200                   # Kč, jen u available, nepovinné
fler: https://www.fler.cz/... # tlačítko „Koupit na Fleru“
featured: true                # kandidát na úvodní stránku
draft: true                   # rozpracované, na webu se nezobrazí
description: |
  Pár vět o obraze.
```

Prodaný obraz: změň `status: sold`, spusť `npm run images` a pushni. Obraz na
webu zůstane jako součást tvorby, jen bez ceny a tlačítka.

**Ukázková díla** (`demo-*`) jsou tu jen pro test. Po přidání prvních skutečných
smaž jejich yaml v `pavla-content/tvorba/` a spusť `npm run images`, pipeline
odstraní i jejich soubory tady.

## Mockupy

Každé dílo dostane na stránce tři mockupy („jak by mohl vypadat u vás“) ve
skutečném měřítku podle `size_cm`. Klik na obraz nebo mockup otevře prohlížečku,
ve které se dá šipkami (i swipem) přepínat mezi originálem a mockupy.

- Malá díla (delší strana do 35 cm): stěna (komoda, ložnice), rámeček na poličce
  a rámeček opřený na stole v pracovně.
- Větší díla: obývák, druhá stěna (ložnice, komoda) a předsíň.
- Instagramový `-wall.jpg` je první mockup díla, oříznutý na 4:5.
- Scény, které se nevejdou (rám je větší než volné místo), se přeskočí.
- Výběr je pro dílo stálý (podle ID), aby se mockupy mezi běhy neměnily.

Scény jsou v `mockups/`: fotka interiéru z Unsplash a v `scenes.yaml` její
kalibrace (kolik pixelů je 1 cm, kam se obraz věší, jak velký se vejde, barva
rámu, světlo, stín a případné předměty před obrazem, např. opěradlo židle). Novou scénu přidáš tak, že uložíš fotku (čelní pohled na
stěnu, 2400 px na šířku), odhadneš měřítko podle předmětu známé velikosti a
doplníš záznam do `scenes.yaml`. Pak `npm run images` přegeneruje všechna díla.

Mockupy (i webové obrázky) se přegenerují jen při změně fotky, `size_cm` nebo
scén; změna ceny či popisu obrázky negeneruje znovu.

## Ostatní fotky (O mně, Kontakt)

Fotky ulož do `pavla-content/fotky/` a spusť `npm run images`. Ke každé vznikne
`<název>.yaml` s popisem (`alt`, `caption`), který stojí za to doplnit. Stránky
používají tyto názvy; dokud fotka neexistuje, na stránce prostě chybí:

| Fotka | Kde je |
|---|---|
| `portret.jpg` | O mně, pod jménem |
| `atelier.jpg` | O mně, pod textem přes celou šířku |
| `kontakt.jpg` | Kontakt, vedle kontaktů |

Další fotku lze na libovolnou stránku přidat komponentou `<Photo name="…" />`.

## Automatické zpracování (GitHub Actions)

Pavla (ani nikdo jiný) nepotřebuje terminál: stačí nahrát fotku nebo upravit
yaml v `pavla-content` přes web GitHubu. Workflow `pavla-content/.github/workflows/publish.yml`
(„Zpracování obsahu“) pak:

1. spustí stejnou pipeline jako `npm run images` (kód bere z tohoto repa),
2. commitne do `pavla-content` nové kostry popisů, přidělená ID a exporty pro Fler a Instagram,
3. otevře (nebo aktualizuje) v tomto repu pull request z větve `obsah/aktualizace`
   s webovými obrázky a kopiemi popisů. Po sloučení se web nasadí.

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

- `npm test`: testy pipeline (`node:test`).
- `npm run build`: musí projít před každým commitem.
- Kód, komentáře a názvy v kódu jsou anglicky; texty webu, URL a dokumentace česky.

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
