# Beit Biram Campus — Reference Inventory

Research log for the 3D reconstruction of **The Hebrew Reali School – Beit Biram Campus**
(בית הספר הריאלי העברי – קמפוס בית בירם), 15 Abba Hushi Ave, Haifa, Israel.

## 0. Research conditions (important, read this first)

This model was produced inside a sandboxed session whose **network egress policy blocked
every site except package registries**. Concretely:

* `www.reali.org.il` (incl. the official interactive campus map `maps/biram-map.html`
  and the campus PDF map `maps/pdf/biram-map.pdf`) — **BLOCKED**
* `he.wikipedia.org`, `en.wikipedia.org`, `commons.wikimedia.org` — **BLOCKED**
* `overpass-api.de`, `nominatim.openstreetmap.org` (OSM footprints) — **BLOCKED**
* All photo sources, satellite/aerial imagery — **BLOCKED**

The only working research channel was **web search**, which returns page summaries and
quoted extracts but **no images and no raw geometry**. Therefore:

* Every **fact** below is sourced from search-returned text and is cited.
* **No photograph, satellite image, or surveyed footprint could be consulted.**
* Building **footprints, dimensions, window grids and exact positions are therefore
  reconstructions**, not measurements. They honour every documented constraint
  (style, era, function, adjacency, site area) but must not be read as survey data.

Section 4 states, per element, exactly which is which.

## 1. Site facts (documented)

| Fact | Value | Source |
|---|---|---|
| Campus | Beit Biram, flagship campus of the Hebrew Reali School | reali.org.il, he.wikipedia |
| Address | 15 Abba Hushi Ave (שד' אבא חושי 15), Haifa | reali.org.il, openu.ac.il |
| Setting | Mount Carmel, Upper Ahuza (אחוזה העילית) | he.wikipedia |
| Bounded by | Abba Hushi Blvd (שד' אבא חושי), Einstein St (רח' איינשטיין), Yaarot St (רח' יערות) | he.wikipedia |
| Area | ~50 dunam (~50,000 m²) | he.wikipedia, reali.org.il |
| Approx. coords | ~32.779 N, 34.996 E (search-reported, ±) | latitude.to, waze |
| Population | ~1,850 students (grades 9–12), ~220 staff | reali.org.il |
| Also houses | Upper division; ecological kindergarten cluster (ages 3–5); military command boarding school; Open University northern branch | he.wikipedia, openu.ac.il |
| Named after | Dr. Arthur Biram, school founder and first principal | he.wikipedia |

## 2. Buildings (documented)

| Building | Hebrew | Date | Documented characteristics | Source |
|---|---|---|---|---|
| **Biram Building** | בניין בירם | 1940s | **First building** on campus. **International Style.** | he.wikipedia |
| **Pevzner Hall** (auditorium) | אולם פבזנר | inaug. **1962** | **650 seats.** Architecturally unique: **suspended, concave roof**. Architect **Prof. Yohanan Ratner** (Technion architecture dean, Haganah figure), with an engineer. Formerly "the cinema hall". Named for Shmuel Yosef Pevzner. | haipo.co.il/item/509619, he.wikipedia |
| **Library Building** (Menachem Reich) | בניין הספרייה ע"ש מנחם רייך | inaug. **1967** | Originally library + geography room + history room + small assembly hall. Today: main library, computer labs, staff rooms, **Yoel Angel assembly hall**. **Shaded by a horizontal concrete slab attached to it** that stops the building overheating in summer. | he.wikipedia |
| **Computer / science centre** | מרכז המחשבים | inaug. **1955** | Formerly the upper-division physics labs; today computer labs + an auditorium. | he.wikipedia |
| **Science complex** | מתחם המדעים | — | Sits with the library and computer/communications centres **west of the Biram Building, toward the entrance**. | he.wikipedia |
| **Sports complex** | מתחם הספורט | inaug. **1955** | At the **northern end** of campus. Football stadium + parade/assembly ground, basketball courts, sports hall, **indoor swimming pool**, fitness room, sports-coordinator office, running tracks, synthetic-turf pitches. | he.wikipedia |
| **Pedagogical complex** | המכלול הפדגוגי | — | Beside the sports complex at the north end. | he.wikipedia |
| **Ruach ve-Re'ut Building** | בניין הרוח והרעות | inaug. **31 Aug 2022** | Humanities and social sciences. Newest major building. | he.wikipedia |
| **Archive** | הארכיון | est. 1995; building 2004 | School archive & museum; 2004 building donated by Gail & Michael Klisman. | he.wikipedia, reali.org.il |

## 3. Campus-wide documented features

These are the signature elements — the things that make the place recognisable:

1. **שדרת הפרגולה — "Pergola Avenue".** *Most of the campus buildings are linked by a
   pergola avenue giving covered passage between them.* This is the organising spine of
   the campus. (he.wikipedia)
2. **Concrete acoustic perimeter wall.** *The campus is surrounded by a concrete wall that
   keeps the noise of the busy adjacent road out, cutting the campus lawns off from the
   noise of the city around it.* (he.wikipedia)
3. **Brutalist concrete.** *Several buildings are built in modern Brutalist style — bare,
   unplastered concrete, decorated with various symbols.* *The specialised buildings are
   decorated according to their respective fields of knowledge.* (he.wikipedia)
4. **Wide lawns** between the buildings. (he.wikipedia)
5. **Memorial wall outside the library** — metal plaques with the names of the fallen, plus
   a digital information screen. A memorial room named "אנחנו" ("We") commemorates the
   school's **306** fallen. (haipo.co.il/item/360876, colbonews.co.il)
6. **Mixed eras, deliberately not one style**: 1940s International Style → 1955 & 1962 &
   1967 modernism/Brutalism → 2004 → 2022 contemporary.

## 4. Documented layout (the spatial skeleton)

Direct quotes drive the plan:

* *"ממערבה לבניין בירם (לקראת הכניסה) מצויים בניין הספרייה, מרכזי מחשבים ותקשורת ומתחם המדעים"*
  → **West of the Biram Building, toward the entrance**, are the library building, the
  computer & communications centres, and the science complex.
  ⇒ **The main entrance is on the west side** (the Abba Hushi Blvd frontage), the Biram
  Building sits **east** of the entrance cluster.
* *"בקצהו הצפוני של הקמפוס מתחם הספורט ולידו המכלול הפדגוגי ובניין הרוח והרעות"*
  → At the **northern end**: the sports complex, and **beside it** the pedagogical complex
  and the Ruach ve-Re'ut building.
* *"רוב הבניינים בקמפוס מקושרים על ידי שדרת הפרגולה"* → pergola spine links most buildings.
* *"הקמפוס מוקף חומת בטון"* → continuous concrete wall on the road frontage.

### Confidence key used in the model

| Confidence | Meaning | Applies to |
|---|---|---|
| **A — documented** | Stated in a cited source | Which buildings exist; their names, dates, functions; their **relative positions** (west cluster / east Biram / north sports); pergola spine; concrete acoustic wall; Pevzner's suspended concave roof + 650 seats; library's horizontal shading slab; Brutalist exposed concrete with symbols; sports facility list; site area; street frontages |
| **B — inferred** | Reasoned from era, style, function and documented constraints | Storey counts, floor heights, footprint shapes and sizes, window grids and proportions, structural bay spacing, roof details, the specific routing of the pergola, terrace levels |
| **C — generic** | Plausible site dressing, not claimed to match reality | Individual trees, benches, bins, lamps, bollards, planting beds, paving patterns, kerbs, cars, neighbouring houses, exact sign wording beyond the school name |

**No photograph was available to this session, so nothing in this model is traced from one.**
Anything in the B/C tiers should be corrected against real photographs before the model is
presented as a survey-accurate digital twin. `README.md` explains how to do that.

## 5. Sources

* https://www.reali.org.il/en/beit-biram-campus/ — official campus page
* https://www.reali.org.il/maps/biram-map.html — official interactive map (blocked; would be the single best source)
* https://www.reali.org.il/maps/pdf/biram-map.pdf — official PDF map (blocked)
* https://he.wikipedia.org/wiki/בית_בירם — Hebrew Wikipedia, "Beit Biram"
* https://he.wikipedia.org/wiki/בית_הספר_הריאלי — Hebrew Wikipedia, "Hebrew Reali School"
* https://haipo.co.il/item/509619 — Haipo, on Pevzner Hall and architect Yohanan Ratner
* https://haipo.co.il/item/360876 — Haipo, on the memorial to the 306 fallen
* https://www.colbonews.co.il/haifa-news/123723/ — Kolbo, memorial installation
* https://www.openu.ac.il/manchim_vatikim/download/haifa.pdf — Open University, Beit Biram campus address
* https://en.wikipedia.org/wiki/Hebrew_Reali_School — English Wikipedia
* https://ibasketball.co.il/venue/748/ — sports hall as a registered basketball venue
