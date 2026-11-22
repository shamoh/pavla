# Pavla Kramolišová · akvarely

Repo webu [pavla.kramolis.cz](https://pavla.kramolis.cz): nastavení, písma, scény, ikony a to, co z obsahu vygeneruje
pipeline. Kód webu a pipeline je v enginu [web-tvorba-engine](https://github.com/shamoh/web-tvorba-engine) (jeho README
popisuje všechny funkce), obsah (originály fotek a popisy děl) v odděleném soukromém obsahovém repu.

```
site.config.yaml          jméno, kontakty, doména, nastavení webu a pipeline
fonts/                    písma popisků (Instagram, piny, úvodní obrazovky aplikace)
mockups/                  scény mockupů (scenes.yaml + fotky), mockups/instagram/ scény ateliéru (README se zadáními generátoru)
home-screen-icon.svg      ikona webu na ploše telefonu
public/                   statické soubory (favicon, ikony, CNAME); vygenerované obrázky jsou ve větvi main_binary
content/                  veřejné kopie popisů (generuje pipeline, needitovat)
game/                     trvalý stav hry Detail dne (plán dnů, rozbory obrázků; zapisuje pipeline)
binary.lock               jméno (hash stromu) vygenerovaných obrázků, které patří k tomuto stavu main
.github/workflows/        obálky sdílených workflow enginu: check.yml (Kontrola kódu), deploy.yml (nasazení)
```

**Verze enginu:** tag za `@` v řádku `uses:` a `engine-ref` v obou workflow (dnes `v1`), vždy stejné. Nová verze enginu =
změnit obojí v obou souborech, pull request projde kontrolou s novou verzí.

**Lokálně:** engine vedle tohoto repa, v enginu `.env` se `SITE_DIR=../<toto repo>` (a `CONTENT_DIR` obsahového repa),
pak tam `npm run build`, `npm run check:site`, `npm run check:images` (obrázky z `main_binary`:
`node scripts/binary.mjs unpack --dir ../<toto repo>`).

**Nastavení repa:** *Settings → Pages → Source: GitHub Actions*, vlastní doména `pavla.kramolis.cz` a *Enforce HTTPS*;
*Allow auto-merge* a *Automatically delete head branches*; ruleset na `main` s povinnou kontrolou `check / check`
a výjimkou pro správce. DNS: CNAME `pavla` → `shamoh.github.io.`.

## Licence

Obsah webu (obrazy, kresby, fotky a texty autorky: `content/`, obrázky v `public/` a ve větvích `*_binary`, `game/`,
fotky scén `mockups/`, texty a údaje v `site.config.yaml`) © Pavla Kramolišová, všechna práva vyhrazena; co s ním
návštěvníci smějí, říká stránka [Podmínky užití](https://pavla.kramolis.cz/podminky-uziti/). Workflow a dokumentace
tohoto repa: [FSL-1.1-MIT](LICENSE.md). Písma ve `fonts/` mají vlastní licenci SIL Open Font License (`OFL-*.txt`).
Příspěvky: [CONTRIBUTING.md](CONTRIBUTING.md).
