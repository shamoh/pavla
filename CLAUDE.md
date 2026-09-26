# CLAUDE.md

Osobní web akvarelistky Pavly Kramolišové. Spravuje ho Libor (manžel), s pomocí Claude Code.

## Stack
- Astro (statický výstup), žádný UI framework, vanilla JS jen pro filtry v galerii.
- `sharp` + `yaml` pro obrázkovou pipeline (`scripts/process-images.mjs`).
- Deploy: GitHub Actions → GitHub Pages, doména v `public/CNAME`.

## Data
- Zdroj obsahu je soukromé repo `pavla-content` (vedle tohoto repa): `tvorba/<rok>/<slug>.yaml` + master fotka.
- `npm run images` (`scripts/process-images.mjs`) z něj generuje `content/works/<rok>/<slug>-<id>.yaml`
  (kopie, needitovat) a `public/works/<rok>/<slug>-<id>/`; exporty pro Instagram a Fler jdou do `pavla-content/export/`.
- Každé dílo má trvalé 5znakové `id` (začíná písmenem, viz `scripts/lib/works.mjs`). URL: `/tvorba/<rok>/<slug>-<id>/`.
- Web načítá díla přes `src/lib/site.ts#getWorks`; `draft: true` a dílo bez `info.json` se nezobrazí.
- Mockupy: scény v `mockups/scenes.yaml` (kalibrace px/cm), výběr a vykreslení `scripts/lib/mockups.mjs`.
- Ostatní fotky: `pavla-content/fotky/<název>.jpg` → `public/photos/<název>/`, na stránce `<Photo name="…" />`.
- Automatika: workflow v `pavla-content/.github/workflows/publish.yml` spouští pipeline a otevírá PR
  do tohoto repa (větev `obsah/aktualizace`, secret `PAVLA_TOKEN`). Souhrn běhu: `scripts/lib/summary.mjs`.
  Týdenní kontrola (token, selhané běhy, nasazení, čekající PR): `health-check.yml` + `scripts/check-health.mjs` (`scripts/lib/health.mjs`).
- Deploy workflow tohoto repa obrázky negeneruje, jen staví web z toho, co je commitnuté.

## Pravidla
- Jazyk: česky je vše, co vidí uživatelé a Pavla (texty webu, URL, README, CLAUDE.md, návody, složky v `pavla-content`).
  Anglicky je kód (názvy, komentáře, hlášky pipeline). Tohle záměrně přebíjí globální pravidlo „README anglicky“.
- Texty na webu jsou česky, s diakritikou, ve 1. osobě autorky.
- Minimalistický design: papírové tóny, serif nadpisy (Cormorant Garamond), Work Sans text. Obraz má vždy přednost před UI.
- Vodoznak pro Fler: jen jméno, nikdy URL ani @handle (pravidla Fleru).
- Mockupy musí držet reálné měřítko podle `size_cm`.
- Před commitem: `npm test` a `npm run build` musí projít.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
