# CLAUDE.md

Repo webu akvarelistky Pavly Kramolišové (pavla.kramolis.cz): jen data webu, žádný kód. Kód, pipeline a všechna
pravidla kódu jsou v enginu `../web-tvorba-engine` (jeho CLAUDE.md); s tímto repem se pracuje přes `SITE_DIR` enginu.

- Repo je **veřejné**: žádné osobní ani provozní údaje (kdo web spravuje, registrátor, účty, tokeny) a nikdy jméno,
  cesta ani odkaz soukromého obsahového repa nebo soukromých dokumentů správce (soubory, commity, pull requesty).
- `content/`, `game/`, `binary.lock` a obrázky (`main_binary`) vyrábí pipeline; ručně se nemění. Ručně jen
  `site.config.yaml`, `fonts/`, `mockups/`, ikony, `public/` statické soubory a workflow.
- Verze enginu v obou workflow (`uses: …@vN` a `engine-ref: vN`) vždy stejná.
- Texty webu česky, s diakritikou, v 1. osobě autorky. Obraz na prodej ve vyhledávačích jen dostupnost, nikdy cena.
- Nový údaj o autorce nebo webu = do `site.config.yaml`, ne do kódu enginu.
- Před commitem v enginu se `SITE_DIR` na toto repo: `npm run check:site`, `npm run build`, `npm run check:images`.
