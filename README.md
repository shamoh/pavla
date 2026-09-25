# Pavla Kramolišová · akvarely

Osobní web s tvorbou (Astro, statický, GitHub Pages) a obrázková pipeline,
která z jedné fotky každého díla připraví výstupy pro web, Instagram a Fler.

```
content/works/<slug>.yaml   metadata díla (commituje se)
masters/<slug>.jpg          vyretušovaná master fotka (NEcommituje se)
public/works/<slug>/        webové velikosti, generuje pipeline (commituje se)
export/instagram/           <slug>-clean.jpg, <slug>-wall.jpg (NEcommituje se)
export/fler/                <slug>.jpg s vodoznakem (NEcommituje se)
site.config.yaml            jméno, kontakty, doména, nastavení pipeline
```

## Přidání nového díla

1. Master fotku ulož jako `masters/<slug>.jpg` (slug = krátký název bez diakritiky, např. `rano-u-rybnika`).
2. Vytvoř `content/works/<slug>.yaml` (vzor níže nebo kterékoli demo).
3. `npm run images`: vygeneruje web i exporty (jen pro nová či změněná díla).
4. Zkontroluj lokálně: `npm run dev` → http://localhost:4321
5. `git add content public && git commit && git push` → web se sám nasadí.
6. `export/instagram` a `export/fler` nahraj ručně na Instagram a Fler.

```yaml
title: Ráno u rybníka
date: 2026-06-14              # určuje řazení a filtr podle roku
technique: akvarel
support: papír Arches 300 g   # nepovinné
size_cm: [40, 30]             # šířka × výška; drží měřítko mockupu na stěně
tags: [krajina, voda, plenér]
status: available             # available | reserved | sold | not-for-sale
price: 3200                   # Kč, jen u available, nepovinné
fler: https://www.fler.cz/... # tlačítko „Koupit na Fleru“
featured: true                # kandidát na úvodní stránku
description: |
  Pár vět o obraze.
```

Prodaný obraz: změň `status: sold` a pushni. Obraz na webu zůstane jako součást
tvorby, jen bez ceny a tlačítka.

Originály mohou ležet jinde (třeba na Google Drive): `MASTERS_DIR=~/Drive/Pavla/masters npm run images`.

**Ukázková díla** (`demo-*`) jsou tu jen pro test. Po přidání prvních skutečných je smaž:
`rm content/works/demo-* && rm -r public/works/demo-*`.

## Jak fotit (nebo skenovat) akvarely

- **Do velikosti A4 (s A3 skenerem i A3) je lepší sken než fotka**: rovné světlo, žádné zkreslení, věrné barvy. Skenuj na 600 dpi, bez automatických úprav. Větší formáty lze skenovat po částech a spojit.
- **Fotka:** rozptýlené denní světlo (u okna, ne přímé slunce), nebo dvě stejná světla z obou stran pod ~45°. Stativ, objektiv přesně proti středu, senzor rovnoběžně s papírem, ohnisko ~50–85 mm ekv.
- **Papír musí ležet rovně.** Zvlněný akvarelový papír dělá stíny, takže ho zatiž rohy nebo dej pod sklo (pozor na odlesky).
- **Barvy:** foť do RAW, do prvního snímku dej šedou kartu a podle ní nastav vyvážení bílé celé série.
- **Retuš (ručně, darktable/Lightroom):** ořez na hranu malby, srovnání perspektivy, barvy podle originálu vedle monitoru. Výsledek exportuj jako sRGB JPEG, delší strana ideálně 3000 px a víc. To je master.

## Nastavení (jednorázově)

1. Repozitář `shamoh/pavla` → *Settings → Pages → Source: GitHub Actions*.
2. DNS: CNAME záznam `pavla` → `shamoh.github.io` (doména je v `public/CNAME` a `site.config.yaml`).
3. Po ověření domény zapnout *Enforce HTTPS*.
4. Doplnit `email` a později `fler` v `site.config.yaml`, přepsat text v `src/pages/o-mne.astro`.

## Poznámky

- Vodoznak na Fleru nese jen jméno autorky, žádný odkaz ven. Fler odkazy mimo platformu nepovoluje.
- Mockup „na stěně“ je v reálném měřítku (`images.mockup.wallWidthCm`), ať si zákazník udělá správnou představu o velikosti.
- Provoz: GitHub Pages zdarma, platí se jen doména.
