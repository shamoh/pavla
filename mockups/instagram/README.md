# Scény ateliéru pro Instagram

Tři scény, do kterých pipeline kreslí dílo (`scene-<scéna>.jpg`). Každá scéna je dvojice fotek se stejným záběrem:

- `<scéna>-list.jpg`: scéna s prázdným listem papíru. Z listu a z hran stolu nebo stojanu se počítá kamera.
- `<scéna>.jpg`: tatáž scéna bez listu. Do ní se kreslí dílo.

Nastavení scén je v [`scenes.yaml`](scenes.yaml). Obě fotky vygeneroval ChatGPT podle zadání níže: nejdřív scénu
s listem, potom stejný obrázek bez listu (úprava obrázku). Zadání tu jsou, aby šly scény vygenerovat znovu a aby bylo
s čím porovnat kameru spočítanou z hran.

## Co z fotek spočítáme a co ze zadání sedí

Generátor nestaví 3D scénu, zadání bere jen jako přání. Kamera se proto počítá z fotky (`sceneCamera`: hrany `lines`
míří do úběžníků, nakreslený list určí místo a měřítko). Zadání slouží jako nezávislá kontrola: test
`instagram.test.mjs` („the cameras of the scenes agree with the prompts of the generator“) hlídá, že spočítaná kamera
zůstane v rozsahu zadání. Kde generátor zadání nedodržel, test to nekontroluje a tabulka to uvádí.

| Scéna | Zadání | Spočítáno z hran (2026-10) | Kontroluje test |
|---|---|---|---|
| `stul-tmavy` | kamera 45 cm nad stolem, dolů 35–40°, mírně zleva; list 40 × 30 cm pootočený o 6° | 52 cm nad stolem, dolů 36°, zprava (azimut 25°); list pootočený o −32° | výšku a sklon; stranu a pootočení listu ne (generátor je nedodržel: spára mezi prkny přetíná list šikmo) |
| `stul-svetly` | kamera 70 cm nad stolem, dolů 55–60°, mírně zprava; list 40 × 30 cm pootočený o −5° | 142 cm nad stolem, dolů 62°, mírně zleva (azimut −12°), ohnisko 70 mm (horní mez, hrany chtějí 76 mm); list pootočený o 1,3° | jen sklon (hrany stolu napříč i podél, na sebe kolmé, dávají teleobjektiv z dálky: výšku, stranu ani pootočení listu generátor nedodržel) |
| `stojan` | kamera 20 cm nad lištou, 20° od čelního pohledu, zprava, mírně shora; list 40 × 30 cm | 18 cm nad lištou, 16,3° od čelního pohledu, zprava (azimut 98°), shora; list pootočený o −2,8° | výšku nad lištou, úhel, stranu, pootočení listu |

Sklon „dolů o X°“ je od vodorovné roviny, zenit v `cameraFromAngles` je 90° − X. Výška kamery vychází z velikosti
nakresleného listu (40 × 30 cm podle zadání); pokud ho generátor nakreslil o kus menší, vyjde kamera výš. Proto má
výška v testu toleranci ±25 %.

## Zadání

Druhý krok (odstranění listu) je u všech scén stejný:

```text
Edit this exact image: remove the blank sheet of watercolour paper (and its backing board)
and show the surface underneath, continuing the same wood texture, stains and lighting
seamlessly. Keep everything else — camera, props, shadows, colours, composition — exactly
identical, pixel for pixel where possible.
Keep the exact same image size and aspect ratio as the input image.
```

### Tmavý stůl (`stul-tmavy`)

```text
Photorealistic styled studio photograph, portrait orientation. A very old, heavy dark wooden
table seen from a seated painter's point of view: camera about 45 cm above the tabletop,
looking down at roughly 35–40 degrees, slightly from the left. The tabletop is the hero:
deeply weathered, dried and cracked wood with pronounced raised grain, knife and engraving-tool
cuts, scratches, old ink stains and dried paint drips. In the middle of the table lies one
blank, slightly off-white sheet of cold-press watercolour paper, about 40 x 30 cm, landscape,
casually rotated about 6 degrees, lying flat, fully visible, nothing on top of it.
A few props scattered casually and sparsely around it, slightly messy but not crowded:
a small improvised palette (an old saucer) with dried watercolour smudges, two worn brushes,
a pencil, an engraving burin, a brush pen, a small open ink bottle, a soft eraser.
At the far edge of the table two or three worn art books with plain, unreadable covers,
stacked carelessly across each other. Background far behind the table strongly out of focus
(shallow depth of field): hints of a bookshelf, a fireplace, unframed paintings and large
paper sheets leaning against a wall — only blurred suggestions, never dominant.
Soft warm window light from the left, gentle natural shadows. Calm, artistic, slightly
untidy painter's studio mood. No people, no hands, no text, no logos.
```

### Světlý stůl (`stul-svetly`)

```text
Photorealistic styled studio photograph, portrait orientation. An old pale wooden worktable
(bleached oak or pine) seen from a standing painter's point of view: camera about 70 cm above
the tabletop, looking down at roughly 55–60 degrees, slightly from the right. The tabletop is
the hero: worn, softly grained wood with faded growth rings, covered in old watercolour
stains, pigment rings from water jars, pencil marks and faint smudges — used and dirty,
but light and airy. In the middle lies one blank, slightly off-white sheet of cold-press
watercolour paper, about 40 x 30 cm, landscape, casually rotated about -5 degrees, lying flat,
fully visible, nothing on top of it.
Sparse, casually scattered props, slightly disordered: a small well-used improvised palette
(a white enamel lid) with dried colour patches, a jar of murky rinse water, two or three
brushes, a graphite pencil, a calligraphy dip pen. Near one edge a couple of worn art books
lying across each other with plain, unreadable covers. The far background beyond the table is
heavily blurred: hints of shelves, plants and paintings leaning on the floor.
Soft diffused daylight from a large window on the right, gentle shadows. No people, no hands,
no text, no logos, no paint sets or paint boxes.
Image format: portrait. If you can, use aspect ratio 4:5 at the highest resolution available;
otherwise portrait 2:3 (1024 x 1536). The final image will be cropped to 4:5, so compose it
with all important elements inside the central 4:5 area: the blank sheet in the middle or
slightly below, with plenty of table (or easel) visible around it on all sides, and the
blurred background only in the top part.
```

### Stojan (`stojan`)

```text
Photorealistic styled studio photograph, portrait orientation. An old wooden studio easel,
seen slightly from above and from the right, as if the painter is standing just to its right:
camera about 20 cm above the easel's lower ledge, angled about 20 degrees from the front.
The easel is beautifully worn, splattered with dried paint, stained wood. On its lower ledge
stands one blank, slightly off-white sheet of watercolour paper on a thin backing board,
about 40 x 30 cm, landscape, its lower edge resting on the ledge, leaning naturally against
the easel, fully visible, nothing in front of it.
A few things casually left on the ledge and around it, not crowded: a worn brush, a pencil,
a small used palette with dried watercolour smudges, a paint rag. Next to the easel on a
small stool a jar of murky rinse water. Background strongly out of focus: a painter's studio
with a window, a plant, paintings and boards leaning against the wall — only blurred hints.
Soft daylight from a window on the left creating gentle shadows. Calm, artistic mood.
No people, no hands, no text, no logos.
Image format: portrait. If you can, use aspect ratio 4:5 at the highest resolution available;
otherwise portrait 2:3 (1024 x 1536). The final image will be cropped to 4:5, so compose it
with all important elements inside the central 4:5 area: the blank sheet in the middle or
slightly below, with plenty of table (or easel) visible around it on all sides, and the
blurred background only in the top part.
```

## Nová nebo přegenerovaná scéna

1. Vygeneruj scénu s listem, pak úpravou tutéž bez listu (stejný rozměr). Ulož jako `<scéna>-list.jpg` a `<scéna>.jpg`.
2. Do `scenes.yaml` zapiš rohy listu `corners` a hrany stolu nebo stojanu `lines` (v prototypu `kamera-scen.html`
   je jde táhnout myší a zkopírovat), rekvizity a volnou plochu.
3. Zadání sem, krátce co chtělo po kameře do `scenes.yaml` jako `prompt` (prototyp ho ukáže vedle spočítané kamery)
   a jeho hodnoty do testu „the cameras of the scenes agree with the prompts of the generator“.
   Co generátor nedodržel, do testu nepiš a uveď v tabulce výše.
