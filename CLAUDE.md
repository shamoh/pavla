# CLAUDE.md

Osobní web akvarelistky Pavly Kramolišové. Spravuje ho Libor (manžel), s pomocí Claude Code.

## Stack
- Astro (statický výstup), žádný UI framework, vanilla JS jen pro filtry v galerii.
- `sharp` + `yaml` pro obrázkovou pipeline (`scripts/process-images.mjs`).
- Deploy: GitHub Actions → GitHub Pages, doména v `public/CNAME`.

## Data
- Díla: `content/works/<slug>.yaml` (schéma v README), načítá `src/lib/site.ts#getWorks`.
- Dílo bez `public/works/<slug>/info.json` se na webu nezobrazí (build jen varuje).
- Originály (`masters/`) a exporty (`export/`) nejsou v gitu. CI obrázky negeneruje.

## Pravidla
- Texty na webu jsou česky, s diakritikou, ve 1. osobě autorky.
- Minimalistický design: papírové tóny, serif nadpisy (Cormorant Garamond), Work Sans text. Obraz má vždy přednost před UI.
- Vodoznak pro Fler: jen jméno, nikdy URL ani @handle (pravidla Fleru).
- Mockupy musí držet reálné měřítko podle `size_cm`.
- Před commitem: `npm run build` musí projít.

## Plánované rozšíření
Novinky/blog, kalendář plenérů a později kurzy/workshopy; prodej zatím přes Fler.
