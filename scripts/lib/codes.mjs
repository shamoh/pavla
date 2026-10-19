// Codes of the messages of a pipeline run (errors, things to check, recommendations): every message about a file ends
// with its code in brackets, e.g. "tvorba/jez.yaml: chybí název (title) [chybi-nazev]". The code is a short Czech
// keyword without diacritics, the same for every case of the same problem, so searching for it (in the run summary,
// in the overview of all works export/README.md) finds them all. A new message = a new code here (coded() refuses an
// unknown one, a test checks every code is used). The weekly health check ("Kontrola automatiky") uses the same codes
// (level health): every failed check ends its headline with one, every problem of a page of the site too.

/** Levels of messages, in the order of the run summary. */
export const LEVELS = ['error', 'review', 'advice', 'todo', 'health'];

/** Czech names of the levels (the overview of all works). */
export const LEVEL_LABELS = { error: 'Chyba', review: 'Ke kontrole', advice: 'Doporučení', todo: 'Zbývá doplnit', health: 'Kontrola automatiky' };

/** code -> { level, text (what it means, Czech, for the overview of codes) } */
export const CODES = {
  // errors: the run stops, nothing is published
  'spatny-yaml': { level: 'error', text: 'chybný zápis YAML (odsazení, dvojtečky, uvozovky)' },
  'prejmenovany-atribut': { level: 'error', text: 'atribut se teď jmenuje jinak' },
  'derived-atribut': { level: 'error', text: 'atribut derived_ do obsahového repa nepatří' },
  'stare-jmeno-souboru': { level: 'error', text: 'systémový soubor se starým jménem' },
  'dva-popisy': { level: 'error', text: 'k jednomu dílu dva popisy' },
  'stejne-jmeno': { level: 'error', text: 'dvě fotky nebo popisy se stejným jménem' },
  'stara-slozka-kolekci': { level: 'error', text: 'kolekce ve staré složce' },
  'kolekce-v-kolekci': { level: 'error', text: 'složka kolekce uvnitř kolekce' },
  'chybi-fotka': { level: 'error', text: 'popis fotky bez fotky' },
  'fotka-roku-bez-del': { level: 'error', text: 'úvodní fotka roku, ve kterém nejsou díla' },
  'cizi-soubor': { level: 'error', text: 'soubor, který do složky nepatří' },
  'neplatne-jmeno': { level: 'error', text: 'jméno souboru nebo složky není ve tvaru pro web (malá písmena bez diakritiky, číslice, pomlčky)' },
  'neplatne-id': { level: 'error', text: 'neplatný kód díla (id)' },
  'duplicitni-id': { level: 'error', text: 'dva obrazy se stejným kódem (id)' },
  'chybi-nazev': { level: 'error', text: 'chybí název (title)' },
  'chybi-datum': { level: 'error', text: 'chybí datum (date)' },
  'spatne-datum': { level: 'error', text: 'datum není ve tvaru 2026-06-14' },
  'spatny-rozmer': { level: 'error', text: 'size_cm není [šířka, výška]' },
  'prodej-bez-ceny': { level: 'error', text: 'obraz na prodej bez ceny (price)' },
  'spatny-odkaz-instagram': { level: 'error', text: 'instagram není odkaz na příspěvek' },
  'spatna-mrizka': { level: 'error', text: 'meta_instagram_grid není sloupce x řádky' },
  'spatna-verze-pinu': { level: 'error', text: 'meta_pinterest_version není celé číslo od 1' },
  'stary-atribut-collection': { level: 'error', text: 'collection: se už nepoužívá' },
  'spatne-details': { level: 'error', text: 'details nejsou řádky „název fotky: popisek“' },
  'popisek-bez-fotky': { level: 'error', text: 'popisek v details bez detailní fotky' },
  'popisek-neni-text': { level: 'error', text: 'popisek detailu nebo description není text' },
  'popis-stranky-dlouhy': { level: 'error', text: 'popis pro vyhledávače (description) delší než 160 znaků' },
  'prazdny-text-stranky': { level: 'error', text: 'prázdný povinný text stránky (title, heading, location_label)' },
  'spatny-odkaz-v-textu': { level: 'error', text: 'odkaz v textu s adresou, která nejde použít' },
  'prazdny-nadpis': { level: 'error', text: 'prázdný povinný text úvodní stránky (heading, button, empty_text)' },
  'doplnit-verejny': { level: 'error', text: 'veřejný text pořád začíná DOPLNIT' },
  'neplatna-moznost': { level: 'error', text: 'hodnota není mezi možnostmi' },
  'chybi-nazev-kolekce': { level: 'error', text: 'kolekce bez názvu (title)' },
  'spatny-focus': { level: 'error', text: 'focus není [x, y] v procentech' },
  'spatny-aspect': { level: 'error', text: 'aspect není šířka:výška' },
  'orez-nahodneho': { level: 'error', text: 'aspect/focus u náhodného úvodního obrazu' },
  'cover-i-fotka': { level: 'error', text: 'cover i vlastní úvodní fotka zároveň' },
  'cover-neexistuje': { level: 'error', text: 'cover míří na neexistující kód' },
  'cover-mimo': { level: 'error', text: 'cover míří na obraz odjinud' },
  'cover-draft': { level: 'error', text: 'cover míří na rozpracovaný obraz' },
  'cover-bez-detailu': { level: 'error', text: 'cover míří na neexistující detail' },
  'vic-uvodnich-fotek': { level: 'error', text: 'víc úvodních fotek' },
  'spatne-rohy': { level: 'error', text: 'chybné meta_corners' },
  'testovaci-data': { level: 'error', text: 'testovací data ve skutečném obsahu (nebo naopak)' },
  'demo-jmeno': { level: 'error', text: 'jméno testovacího díla nezačíná demo-' },
  // to check: the run goes on, but someone should look
  'doplnit-zverejneny': { level: 'review', text: 'zveřejněný obraz má pořád DOPLNIT' },
  'podezrely-orez': { level: 'review', text: 'nalezené rohy listu ořezávají hodně, zkontroluj náhled' },
  'zakomentovany-udaj': { level: 'review', text: 'zakomentovaný údaj, automatika ho nečte' },
  'nevejde-do-sceny': { level: 'review', text: 'obraz se nevejde do scény ateliéru' },
  'mala-mrizka': { level: 'review', text: 'obraz zabere v mřížce Instagramu málo plochy' },
  // recommendations
  'text-male-pismeno': { level: 'advice', text: 'text začíná malým písmenem' },
  'text-bez-tecky': { level: 'advice', text: 'text nekončí tečkou' },
  'nazev-male-pismeno': { level: 'advice', text: 'název začíná malým písmenem' },
  'nazev-s-teckou': { level: 'advice', text: 'název končí tečkou' },
  'dlouhy-nazev': { level: 'advice', text: 'název se ve vyhledávání zkrátí' },
  'dlouhy-nazev-kolekce': { level: 'advice', text: 'název kolekce se ve výběru zkrátí' },
  'dlouha-technika': { level: 'advice', text: 'technika se ve výběru zkrátí' },
  'vzorovy-text': { level: 'advice', text: 'popis je pořád vzorová věta z kostry' },
  'bez-stitku': { level: 'advice', text: 'obraz nemá štítky' },
  'prodej-bez-mockupu': { level: 'advice', text: 'obraz na prodej bez mockupů' },
  'bez-rozmeru': { level: 'advice', text: 'zveřejněný obraz nemá rozměr' },
  'bez-popisu': { level: 'advice', text: 'zveřejněný obraz nemá popis' },
  'detail-bez-popisku': { level: 'advice', text: 'detailní fotka bez popisku' },
  'mala-fotka': { level: 'advice', text: 'fotka obrazu je malá' },
  'dlouhy-draft': { level: 'advice', text: 'obraz je dlouho rozpracovaný' },
  'instagram-bez-odkazu': { level: 'advice', text: 'fotky pro Instagram dlouho bez odkazu na příspěvek' },
  'featured-zadny': { level: 'advice', text: 'stránka nemá žádný výběr autorky' },
  'featured-jeden': { level: 'advice', text: 'stránka má jen jeden výběr autorky' },
  'stitky-moc': { level: 'advice', text: 'štítků je v galerii moc' },
  'stitky-dva-tvary': { level: 'advice', text: 'stejný štítek ve dvou tvarech' },
  'stitky-vzdy-spolu': { level: 'advice', text: 'dva štítky jsou vždy spolu' },
  'stitek-bez-prekladu': { level: 'advice', text: 'štítek bez anglického překladu (Instagram, Pinterest)' },
  'featured-bez-pinu': { level: 'advice', text: 'výběr autorky není v kanálu pro Pinterest' },
  'odkaz-instagram-bez-exportu': { level: 'advice', text: 'odkaz na Instagram, ale bez fotek pro Instagram' },
  'fler-neni-na-prodej': { level: 'advice', text: 'odkaz na Fler u obrazu, který není na prodej' },
  'prodej-bez-fleru': { level: 'advice', text: 'zveřejněný obraz na prodej bez odkazu na Fler' },
  'cena-neprodava': { level: 'advice', text: 'cena u obrazu, který se neprodává' },
  'mockupy-bez-rozmeru': { level: 'advice', text: 'mockupy bez rozměru nedrží měřítko' },
  'mrizka-bez-instagramu': { level: 'advice', text: 'mřížka pro Instagram bez fotek pro Instagram' },
  'datum-v-budoucnu': { level: 'advice', text: 'datum obrazu je v budoucnu' },
  'prehled-velky': { level: 'advice', text: 'přehled všech děl je moc velký pro GitHub' },
  // still to fill in
  doplnit: { level: 'todo', text: 'atributy pořád označené DOPLNIT' },
  // the weekly health check of the automation (scripts/lib/health.mjs, site-check.mjs, page-check.mjs)
  'token-chybi': { level: 'health', text: 'secret PAVLA_TOKEN není nastavený' },
  'token-neplatny': { level: 'health', text: 'token PAVLA_TOKEN je neplatný nebo vypršel' },
  'token-nedostupny': { level: 'health', text: 'kontrola tokenu PAVLA_TOKEN selhala' },
  'token-vyprsi': { level: 'health', text: 'token PAVLA_TOKEN brzy vyprší' },
  'beh-selhal': { level: 'health', text: 'poslední běh zpracování obsahu selhal' },
  'zkusebni-beh-selhal': { level: 'health', text: 'poslední zkušební běh na testovacích datech selhal' },
  'nasazeni-selhalo': { level: 'health', text: 'nasazení webu selhalo' },
  'nasazeni-chybi': { level: 'health', text: 'poslední commit se na web nenasadil' },
  'aktualizace-ceka': { level: 'health', text: 'aktualizace obsahu se dlouho nesloučila' },
  'neznamy-atribut': { level: 'health', text: 'popis má neznámý atribut (NEZNÁMÝ)' },
  'nova-technika': { level: 'health', text: 'technika bez druhu díla pro vyhledávače' },
  'obrazky-chybi': { level: 'health', text: 'na nasazeném webu chybí obrázky' },
  'stranky-nedostupne': { level: 'health', text: 'stránky nasazeného webu nejsou dostupné' },
  'nacteni-selhalo': { level: 'health', text: 'kontrola nemohla načíst data (API, obsah)' },
  'titulek-chybi': { level: 'health', text: 'stránka bez titulku' },
  'stejny-titulek': { level: 'health', text: 'dvě stránky se stejným titulkem' },
  'popis-stranky-chybi': { level: 'health', text: 'stránka bez popisu pro vyhledávače' },
  'stejny-popis-stranky': { level: 'health', text: 'dvě stránky se stejným popisem' },
  'dlouhy-popis-stranky': { level: 'health', text: 'popis stránky je delší než 160 znaků' },
  'jsonld-chybi': { level: 'health', text: 'stránka bez strukturovaných dat (JSON-LD)' },
  'jsonld-neplatny': { level: 'health', text: 'JSON-LD není platný JSON' },
  'jsonld-neni-objekt': { level: 'health', text: 'JSON-LD není objekt' },
  'jsonld-bez-contextu': { level: 'health', text: 'JSON-LD bez @context schema.org' },
  'jsonld-prazdny-graf': { level: 'health', text: 'JSON-LD s prázdným @graph' },
  'jsonld-bez-typu': { level: 'health', text: 'uzel JSON-LD bez @type' },
};

const CODE_RE = /\[([a-z0-9-]+)\]/g;

/** `message` with its code at the end: "<message> [<code>]". Throws on a code missing from CODES. */
export function coded(code, message) {
  if (!Object.hasOwn(CODES, code)) throw new Error(`Unknown message code: ${code}`);
  return `${message} [${code}]`;
}

/** Codes in a message (known ones only, in order; a message joined from several parts can have more). */
export const codesOf = (message) => [...String(message ?? '').matchAll(CODE_RE)].map((m) => m[1]).filter((c) => Object.hasOwn(CODES, c));

/** The message without its codes (the overview shows the code apart). */
export const withoutCodes = (message) => String(message ?? '').replace(CODE_RE, (all, c) => (Object.hasOwn(CODES, c) ? '' : all)).replace(/\s+(?=;|$)/g, '');
