# Deterministic location content

The saved map stores geometry, identifiers and configuration. `materializeMap(source)` exposes generated names and text through cached getters. Nothing generated is written to the source. Search resolves content when needed. Opening the initial highlights does not generate thousands of ordinary stories.

## Visitor settlement settings

Open **Settlement** in the map header to select Human (the default), Orc, Elf, Dwarf, Halfling, Dragonborn, Gnome, Goblin, Tiefling, Half-elf or Half-orc. **As authored** restores the map's demographic inheritance and released naming catalogs. **Reset to Human** restores Human naming and the map's published or draft seed when you apply it.

The seed accepts 1 to 128 characters, including `0`. **New seed** prepares a new random seed. Nothing regenerates until you apply the settings. The same map source, ancestry and seed reproduce the same generated content. Changing these settings preserves ids, geometry, authored overrides, enabled fields and geographic references. The current view, filters, layers and selected site survive an applied change.

Visitor settings are separate from authoring drafts. `applySettings(source, settings)` creates a read-time snapshot with the chosen global seed and a fixed ancestry/culture on every location. Gender, age, wealth, population and other inherited configuration retain their normal precedence. Authored names and text stay literal. JSON export still exports authoring inputs, rather than the visitor's materialized map. These controls appear only on maps with a generator.

Settings are remembered per map on the current device. `?ancestry=elf&seed=my-world#map/dragonsgate` is a reproducible link that takes priority over stored preferences. Place links and PDF links retain both query parameters. Returning to the collection clears them before choosing another map, so each map retains its own seed. If browser storage is blocked, the current visit and shared links still work.

`settlement-pools-v1.js` supplies optional catalog inputs without editing the frozen v1/v2 engines or defaults. Every nonhuman tradition has at least 100 unique place roots, route roots, water roots and surnames. Each resident name pool has at least 100 entries per gender. Human uses the released v2 word banks. Half-elf and Half-orc combine the corresponding traditions with Human banks. These naming conventions also select the corresponding optional craft-label tradition. The economy layer below selects occupations from local context and keeps every trade available to every ancestry. Custom author-supplied people pools and templates keep precedence. Future changes to these released optional banks require a new profile version.

## Stable output

Maps declare `schemaVersion: 2` and `generator: {"version":1,"seed":"my-world"}`. Independent seeded streams derive from the map id/seed, location id, optional seed/variation and a field label. Demographics and local context feed text generation. The same version, catalogs and inputs produce the same output on every visit.

- Moving a marker or changing its shape leaves its story unchanged.
- Adding, removing or reordering unrelated locations leaves existing stories unchanged.
- Enabling another field leaves existing fields unchanged.
- Changing demographics, type, district or traits can change that location’s generated content.
- An override changes only that output field. It does not change the identity tokens used by other fields.
- **New variation** increments this location’s `generation.revision`. A new map seed rerolls generated content across the map.

Do not edit released v1 defaults or its RNG. Add an engine version for future default changes and retain v1 support. Per-map catalog edits are explicit content changes and can alter affected output. Names are not identifiers. Different places can share a name. Stable ids and addresses distinguish them without order-dependent renaming.

## Minimal location

```json
{
  "id": "quays-027",
  "category": "workshop",
  "type": "blacksmith",
  "district": "north-quays",
  "x": 315,
  "y": 246,
  "bounds": [305, 236, 20, 20],
  "generation": {
    "demographics": {"race":"orc", "gender":"female", "age":"adult", "population":4}
  }
}
```

Category controls viewer icons and filters. Type supplies nouns, resident roles and services. Built-in types: `landmark`, `tavern`, `shop`, `workshop`, `temple`, `guild`, `harbor`, `home`, `blacksmith` (workshop), `tailor` (shop), `jeweler` (shop), `apothecary` (shop), `arcane` (shop), `fletcher` (workshop) and `bakery` (shop). Additional everyday trades such as fishmonger, bookseller, cooper and locksmith are defined in `public/js/generation/trades-v1.js`. The migration retains recognized trade types.

## Inheritance

Settings apply in this order: built-in defaults → `generator.defaults` → region’s `generation` → district’s `generation` → location’s `generation`. A location references a district id. A district references a region id. A location can explicitly override its region with `region`.

Settings include `demographics`, `fields`, `traits`, `tables`, `seed` and `revision`. Fields and traits replace inherited lists. Tables merge by name, replacing each supplied table. Population inherits as an optional integer. Other demographics accept a fixed choice or a distribution:

| Fixed choice | Weighted distribution |
| --- | --- |
| `race` | `races` |
| `gender` | `genders` |
| `age` | `ages` |
| `culture` | `cultures` |
| `wealth` | `wealths` |

Specify one form per dimension at each level. A child’s fixed choice replaces the parent’s distribution. A child’s distribution replaces the parent’s fixed choice or distribution. Weights are relative nonnegative numbers with a positive total. Zero-weight entries never occur. Object key order has no effect on rolls.

```json
{
  "id": "north-quays",
  "name": "North Quays",
  "region": "coast",
  "generation": {
    "demographics": {
      "races": {"human":4, "elf":2, "orc":1},
      "wealths": {"modest":3, "comfortable":1}
    },
    "traits": ["coastal", "night markets"],
    "fields": ["name", "description", "person", "rumor", "address", "services"]
  }
}
```

Built-in races: `human`, `elf`, `dwarf`, `halfling`, `gnome`, `orc`, `half_elf`, `half_orc`, `tiefling`, `dragonborn`, `goblin`. Genders: `female`, `male`, `nonbinary`. Default ages: `young_adult`, `adult`, `elder`. Default wealth: `modest`, `comfortable`, `wealthy`. Age and wealth also accept custom keys. These are fictional resident/population inputs. Race supplies naming pools, not morality or occupation.

The default culture `ancestral` uses the selected race’s names. A custom culture can select a different name pool independently of race.

## Authored fields and exclusions

`generation.fields` lists enabled generated fields. Core fields are `name`, `description`, `person`, `rumor`, `address` and `services`. Type-specific detail fields below are also enabled by default. An explicit field list replaces the inherited list, so include the detail fields you want. An omitted field returns empty text. If name is disabled, the id remains as its directory label.

`overrides` contains authored values and takes precedence even when a field is disabled. Use `""` or `null` to suppress a non-name field. Names must be nonempty. Removing an override restores generation. Overrides are literal plain text and are escaped before HTML rendering.

## Catalogs and templates

Reusable v1 word banks are adapted from Shoppe’s shop-type and race/gender pools. All choices use local seeded streams. No global `Math.random()` controls generated content.

`generator.catalog` can supply:

| Property | Extension |
| --- | --- |
| `people` | Named pools with nonempty `female`, `male`, `nonbinary` and `surnames` arrays |
| `cultures` | Named objects with `namePool` referring to a people pool |
| `types` | Named objects with `category`, `label`, `nouns`, `roles`, `services` and optional `tables` |
| `tables` | Replacement token banks or output template tables |
| `sections` | Extra viewer sections with `label` and `templates` |
| `detailSources` | Context-filtered source banks for the built-in location details described below |

Entries replace whole same-named pools/types/sections. Partial pool or type definitions are rejected. Add a race by adding a people pool, then selecting it in demographics. Add a culture with `{"riverfolk":{"namePool":"human"}}` to use human-style naming for any race.

Template precedence: built-ins → type tables → map catalog tables → inherited map/region/district/location tables. Templates use plain `{token}` substitution. There is no executable template code. Token banks are literal text. Only output templates expand tokens.

Available tokens: `first`, `surname`, `partnerSurname`, `fullName`, `label`, `nameLabel` (title case), `race`, `raceLabel`, `gender`, `age`, `ageLabel`, `culture`, `wealth`, `population`, `district`, `region`, `map`, `traits`, `pronoun`, `subject` (capitalized pronoun), `noun`, `role`, `service`, `number`, `houseNumber`, `adjective`, `animal`, `symbol`, `street`, `detail`, `history`, `habit`, `task`, `complication`.

Identity tokens remain consistent across fields. Templates cannot recursively reference other output fields. Unknown tokens/references, empty tables and invalid weights fail validation before saving or building. Override a token bank such as `history` to vary descriptions. Override `description` to replace its sentence structures.

Tables contain strings or `{ "value":"template text", "weight":3 }` entries. Every nonempty table needs positive total weight. Keys can be built-in outputs, custom section ids or these token banks: `adjective`, `animal`, `symbol`, `street`, `detail`, `history`, `habit`, `task`, `complication`. Change identity pools through `people` and `cultures`.

## Add a content section

This adds opening hours and local history without changing JavaScript:

```json
{
  "version": 1,
  "seed": "my-world",
  "defaults": {
    "fields": ["name", "description", "person", "hours", "historyNote"]
  },
  "catalog": {
    "sections": {
      "hours": {
        "label": "Opening hours",
        "templates": ["Dawn to dusk.", "Open on market days."]
      },
      "historyNote": {
        "label": "Local history",
        "templates": ["{history}", "{first} inherited this {label} from a former mentor."]
      }
    }
  }
}
```

Section ids must be safe keys and cannot reuse output or token names. The editor adds field and override controls automatically. Extra sections participate in details, escaping and search. A local `tables.hours` or `overrides.hours` customizes one place. Resolved data exposes `extra.<id>` with `label` and `text`.

## Legacy migration

Maps without a generator still load unchanged. Convert one with:

```sh
node scripts/migrate-map.mjs public/data/maps/my-map.json
```

The default migration preserves every authored field in overrides. `--regenerate-unfeatured` deliberately discards nonfeatured text so those places use generation. It keeps featured text, ids, coordinates, bounds and categories. Use that flag only when discarded text should be regenerated. Migration is idempotent for maps that already have a generator.

Dragonsgate was subsequently rebuilt from the source raster with v2 generation throughout. Its original 54 landmark ids remain available. See [dragonsgate-survey.md](dragonsgate-survey.md) for the current survey.


## Version 2: streets, water and geography

Use `generator.version: 2` for a new map. Keep the map seed stable. Existing maps can retain version 1 and opt new places into version 2 with `generation.version: 2`. The editor does this for new locations. Existing places keep their original engine until you explicitly change it. `generation.version` selects only that location's engine. Do not put it on map defaults, districts or regions.

Version 1 banks, templates and RNG remain frozen. Version 2 is independently versioned in `public/js/generation/*-v2.js`. Every built-in v2 lexical bank has at least 100 distinct entries, including each race/gender name pool, surnames, place roots, adjectives, animals, symbols, prose fragments and each type's noun, role and service pools. Some banks compose full entries from curated compatible stems. `bank()` rejects fewer than 100 unique nonempty entries. Small grammar tables, finite choices, field lists and user-supplied catalog overrides are not lexical banks and do not require 100 entries.

The strict helpers validate finite JSON seeds, finite nonnegative weights, positive totals, RNG boundaries and integer ranges. Zero-weight choices never occur. `sample()` selects without replacement. Independent labeled streams isolate field selection from identity. Numeric geometry never enters a content seed.

### Mapped feature types

| Category | Built-in types |
| --- | --- |
| `street` | `street`, `road`, `lane`, `alley`, `bridge`, `square`, `trail` |
| `water` | `river`, `stream`, `canal`, `lake`, `pond`, `bay`, `sea`, `channel`, `strait` |
| `terrain` | `island`, `forest`, `wood`, `hill`, `mountain`, `valley`, `marsh`, `field`, `cliff`, `beach`, `cape` |

Set both category and type. A lake uses lake naming grammar and physical descriptions. It does not receive a shopkeeper, stock list or numbered house address. Demographics still inform commemorative names, but the viewer does not present a randomly generated resident profile for geographic features. Explicit text overrides and custom output tables remain available.

Use `shape: {"kind":"polyline","width":8,"points":[[120,200],[180,240],[250,240]]}` for roads, rivers and canals. Width is the full selectable corridor in image pixels. Lines stay open and use round endpoints. They need at least two distinct points and positive width. Their complete corridor must fit inside the image. Use polygons or ellipses for lakes and land areas. The existing point and rectangle shapes remain supported.

Geographic labels appear on the map. Filters, search, hover cards, the directory and touch selection include these features. Marker visibility also controls labels. An overlapping building's smaller hit area takes priority over broad geographic areas.

### Shared geographic references

A location can store `context` with `street`, `water`, `terrain` and `landmark` keys. Each value is another saved location's stable id. The target must have the corresponding category. References cannot point to the same place or form a cycle.

```json
{
  "id": "river-shop-001",
  "category": "shop",
  "type": "apothecary",
  "district": "north-quays",
  "x": 315,
  "y": 246,
  "generation": {"version":2,"demographics":{"race":"elf"}},
  "context": {"street":"quay-road","water":"harbor-bay"}
}
```

The generated address uses the exact name of `quay-road`. Descriptions can mention `harbor-bay`. Changing a feature's authored name updates references to it on the next load. Moving a feature does not change its identity. Adding a new nearby feature does not silently reassign a building. Without an explicit street reference, v2 buildings use a deterministic fallback street shared within their district. This fallback is an address convention, not an automatically mapped road. Use editor context selectors to link actual mapped features.

Version 2 descriptions use the displayed location name, including an authored name override. Resident identity, type and available services share the same tokens. New v2 tokens are `root`, `compound`, `head`, `water`, `terrain`, `landmark`, `setting`, `displayName`, `address`, `firstPossessive`, `surnamePossessive`, `fullNamePossessive`, `epithetPossessive` and `article`. `displayName` cannot appear inside a name template. Malformed or unknown template tokens fail validation.

### Naming structures

Version 2 mixes twelve weighted geographic naming patterns. Richer combinations receive greater weight to reduce repetition. Business patterns always include a type noun or label. Name collisions remain possible and never cause order-dependent renaming. Stable ids identify places.

`generation.nameStyle` optionally selects `descriptive`, `simple`, `compound`, `eponym`, `local`, `poetic`, `historic`, `formal`, `regional`, `paired`, `commemorative` or `traditional`. Omit it for mixed patterns. An explicitly supplied `tables.name` takes priority over a style. Demographics select the people pool used for eponymous and commemorative patterns. Geography types select appropriate root banks and head nouns. Regions and districts provide shared context.

The current Dragonsgate survey contains 10,030 entries and uses v2 for buildings and geographic features. Future changes to released v2 defaults still require a new generator version. Map-local home grammar supplies household names without changing the shared v2 defaults.

Version 2 additionally accepts literal token banks `root`, `waterRoot`, `streetRoot` and `epithet` in catalog, type and inherited tables. `root` explicitly overrides the selected geographic root bank. Otherwise water and route types use their specialized banks. `street` customizes the shared fallback street table. Custom banks may be smaller than the built-in defaults and support weighted entries.

## Type-specific location details

Location details are available by default with either engine. The current economy expansion deliberately changes generated occupations, commercial services, descriptions, rumors and detail recipes. It does not preserve old generated trade text. Identity and economic choices use separate labeled streams. Authored text remains authoritative.

| Category | Detail fields |
| --- | --- |
| Tavern | `meals`, `guests`, `lodgings` |
| Shop and workshop | `stock`, `commissions`, `openingHours` |
| Temple | `observances`, `openingHours` |
| Guild | `contracts`, `openingHours` |
| Home | `household` |
| Harbor | `portActivity`, `openingHours` |
| Street | `routeNotes` |
| Water | `waterNotes` |
| Terrain | `terrainNotes` |
| Landmark | `landmarkNotes` |

The resolved fields appear under `extra`, with the same `{label,text}` structure as custom sections. Callouts, search, site guides and PDF exports include them automatically. Inapplicable sections stay empty. The editor exposes their field and override controls. Setting `overrides.meals` supplies an authored menu. Setting `overrides.lodgings` to `null` suppresses rooms. Explicit inherited field lists still control which details are generated.

Meals and guests are sampled without repeating a dish or guest role within an entry. Each supported shop and workshop has a dedicated stock bank. The economy catalog adds 86 explicit trades across 18 industries to the original trade set. Custom trades can provide `stock_<type>`; otherwise their stock information refers to the trade's existing service token. Custom trades never inherit arbitrary general-store wares.

A linked water feature selects water-oriented meals. The inherited `vegetarian` trait takes precedence over that selection. Ancestry and culture do not prescribe diet, wealth, behavior or occupation. Wealth selects room standards and price ranges. An unknown wealth key uses modest prices and rooms. Household counts use the inherited population, including zero and one, and never invent a count when none is supplied. Details share the displayed place name, authored address and generated resident identity. If the resident profile is authored, bookings and orders refer to the keeper instead of inventing a second named resident. Geographic records use the exact displayed feature name and its actual type, without adding residents, shops or physical features that were not mapped.

Every compiled source recipe has at least 100 unique, nonempty variations. The standard banks have 120 or more. These counts hold with identity, district, wealth and geography fixed. They do not depend on rerolling resident names or inserting a random number. Small composition components form compatible complete entries. Tests render every compiled recipe in a fixed context and check its distinct outputs and attainable selection diversity.

### Context-filtered source options

`generator.catalog.detailSources` replaces complete named source banks. Source keys are `meals`, `vegetarianMeals`, `waterMeals`, `guests`, `lodging_modest`, `lodging_comfortable`, `lodging_wealthy`, `stock_<type>`, `stock_service`, `commissions`, `observances`, `contracts`, `household`, `portActivity`, `routeNotes`, `waterNotes`, `terrainNotes`, `landmarkNotes` and `openingHours`.

Each entry is a string or an object:

```json
{
  "value": "Mushroom pasties collected at {address}",
  "weight": 3,
  "when": {
    "types": ["tavern"],
    "categories": ["tavern"],
    "wealths": ["comfortable", "wealthy"],
    "traits": ["vegetarian"],
    "water": true
  }
}
```

This is one entry, not a complete source bank. Supply at least 100 distinct positive-weight variants for each active context. Filters apply before sampling. `types`, `categories` and `wealths` match any listed value. Every listed `traits` value must be present. `water`, `terrain` and `street` test for explicit mapped references. All supplied conditions must match. Unconditional entries can supply a shared baseline for several contexts. Zero-weight entries never occur. Validation rejects a bank that has 100 entries globally but fewer than 100 matching entries for an enabled recipe in an actual location's inherited context. It checks every possible positive-weight wealth choice.

Source text expands base identity and geographic tokens once. It cannot refer to other detail tokens. Nested templates, unknown tokens, malformed braces, invalid conditions and invalid weights are rejected. Text remains plain text and is escaped by each HTML renderer. Source options are stored once per map. Generated results remain read-time data and are never serialized back into the authoring model.

Custom `catalog.sections` and normal output `tables` can use these detail tokens: `meal`, `guest`, `lodging`, `stock`, `commission`, `observance`, `contract`, `household`, `portActivity`, `routeNote`, `waterNote`, `terrainNote`, `landmarkNote`, `openingHours`, `price`. A detail token is empty when its built-in field is disabled or inapplicable. Source banks contain the variations; output templates can remain small deliberate grammars. Authored overrides and custom output templates are not required to contain 100 alternatives.

### Reusable detail helpers

`mapping-tools.js` exports the source and section registries plus:

- `recipe(left, right, join)`: composes a compatible source bank and rejects fewer than 100 distinct entries.
- `matchingSources(entries, context)`: applies typed context conditions and excludes zero weights.
- `uniqueChoices(entries, count, rng, distinctBy)`: weighted selection without replacement, with optional semantic grouping. Rejects invalid weights and impossible counts.
- `priceFor(wealth, rng, unit)`: deterministic meal or bed prices in silver pieces with a modest fallback.

Use independent `streams(seed)(label, input)` streams for each recipe. Keep numeric geometry and unrelated locations out of seeds. Catalogs and authoring snapshots should be treated as immutable while resolving content.


## Contextual economies and expanded trades

The shared economy layer supplies 115 explicit trades across 18 industries: agriculture, food, textiles, leather, wood, metal, stone, glass, maritime, transport, records, learning, arcane, medicine, hospitality, arts, commerce and civic services. Added trades include millers, dyers, saddlers, wheelwrights, bellfounders, shipwrights, freight brokers, notaries, translators, alchemists, bathkeepers and wellkeepers. All types appear in the location editor under their corresponding categories.

Generic `shop` and `workshop` inputs select a specific trade at read time. Their generated names, practitioner roles, services, stock and commissions share that selection. Generic homes receive a primary resident's occupation. Generic guilds receive a trade focus for contracts. Specific authored types keep their trade even when local inputs are unavailable. Set `generation.trade` to a trade id to pin a generic building, household or guild to an explicit trade focus. An existing specific type takes precedence over that focus. Changing settlement type can change a generic building's specialization. It does not change saved type identifiers or map geometry.

### Settlement and local context

Add `settlement` to any generation settings layer. Its properties inherit independently through map, region, district and location. An explicit list replaces the inherited list for that property.

```json
{
  "generation": {
    "settlement": {
      "type": "forest_hold",
      "resources": ["timber", "herbs"],
      "industries": ["wood", "medicine"],
      "environment": ["woodland"]
    }
  }
}
```

The 14 settlement types are `hamlet`, `village`, `town`, `city`, `metropolis`, `port`, `mining_outpost`, `forest_hold`, `farming_village`, `fortress`, `monastery`, `academy`, `caravan_stop` and `undercity`. An unspecified type uses `city`. Mining, forest and farming profiles supply default local resources. An explicit `resources` list replaces those defaults. Mapped terrain adds its recognized resources. Industries weight selection rather than banning unrelated ordinary trades.

Environment keys are `coastal`, `river`, `lake`, `woodland`, `hills`, `mountain`, `wetland`, `farmland`, `underground` and `arid`. Resource keys are exported as `resourceKeys` in `economy-settlements.js`. They include grain, fruit, herbs, livestock, wool, flax, hemp, silk, hides, timber, willow, reed, ore, iron, copper, coal, stone, clay, sand, quartz, ash, fish, silver, honey, oil, paper, pigments, cloth, farmland, pasture and orchard.

Saved street, water and terrain links provide exact displayed route names and geographic types. Terrain links distinguish fields, woods, hills, mountains and shores. A pond does not imply a navigable harbor. Maritime specialization requires a navigable water reference or an explicitly waterside setting. An authored maritime trade remains valid inland and can request outside supplies. Resources control whether a material has a recorded local source. The generator never invents a named mine, farm, harbor, supplier or mapped road to justify a choice.

Settlement scale and industries weight occupations. Customer pools reflect the settlement. Wealth weights luxury trades and selects practical, standard or custom order requirements. The featured product appears in stock, services, commissions and current work. Document trades use document tasks, appointment businesses use service tasks, food sellers use provision tasks and makers use craft tasks. A teahouse serves tea and accompaniments. Cookshops and teahouses do not acquire guest rooms from the tavern category. Empty homes have no generated resident or livelihood.

The published Dragonsgate and Grayhaven district settings now describe their economic focus. Their existing location ids, geometry, geographic links and authored overrides remain intact. Known authored workshops and guilds now pin their matching trade focus, including the shipyard, ropewalk, foundry, cloth halls and growers guild.

### Traditions and new fields

All eleven ancestries have 100 craft-label recipes each. Human, Orc, Elf, Dwarf, Halfling, Dragonborn, Gnome, Goblin, Tiefling, Half-elf and Half-orc each supply motifs and order-record practices. A custom naming culture's `namePool` selects the matching tradition when available. Other custom pools use the fallback label recipe. These traditions affect labels and sample books. They do not restrict professions, dictate diet or assign morality.

Three sections are enabled by default: `livelihood` for homes, shops and workshops, `tradeLinks` for shops, workshops, guilds and harbors, and `craftTradition` for shops and workshops. Explicit `generation.fields` lists must include the sections you want. Each section supports ordinary field overrides, search, callouts, site guides and PDF output.

Additional template tokens are `industry`, `trade`, `tradeRole`, `product`, `material`, `customer`, `workTask`, `supplyRoute`, `settlementType`, `tradition`, `budgetNote`, `livelihoodNote`, `tradeLinksNote` and `craftTraditionNote`. Unavailable economic tokens are empty for geography. Template tokens are plain text and never execute code.

### Helpers and source conditions

- `economicContext()` resolves inherited settlement settings and stable geographic references. It does not inspect coordinates or infer an industry from a resident's name.
- `tradeChoices()`, `scoreTrade()` and `chooseTrade()` expose deterministic eligibility and weighting. `materialIsLocal()` resolves known material-to-resource relationships.
- `workflowFor()` selects appropriate work and rumor recipes. `traditionFor()` selects a naming-culture tradition with a fallback for custom pools.
- `recipe()` compiles compatible recipe parts and rejects fewer than 100 distinct outputs. `uniqueChoices()` supports weighted sampling without repeating the same underlying product.
- Stock, workflow, rumor, budget, settlement demand, guest and tradition banks each have at least 100 compiled variations. New trade stocks combine at least ten substantive products or services with ten handling records. Existing expanded inventories retain their 100 substantive item variants.

Custom `detailSources` conditions now also accept `races`, `cultures`, `trades`, `settlements`, `industries`, `resources`, `environments`, `waterTypes` and `terrainTypes`. Scalar dimensions match any listed value. Resource and environment conditions require every listed value. Existing type, category, wealth, trait and linked-feature conditions still apply. Validation checks 100 positive-weight matching entries for every possible configured race, culture and wealth used by an active source. Do not reference other output-note tokens from source banks.

The **Settlement** dialog includes a settlement-type selector. Its choice travels in `?settlement=academy` alongside ancestry and seed, persists per map and saves only into the local variation. **As authored** uses inherited map settings. The location editor also exposes trade or guild focus, settlement type, resources, economic focus and environment tags.


## Shared residents, households and situations

Set `generator.socialVersion: 1` to enable the social layer. Both published maps and newly uploaded maps enable it. This adds three ordinary generated fields: `residents`, `connections` and `requests`. Explicit field lists must include the sections you want. The existing `household` field gains a roster and household account. The default `rumor` becomes a perspective on a shared situation when one is available. Authored overrides and custom rumor tables retain precedence.

The social layer deliberately uses four phases:

1. Index compact location inputs and inherited settings. Cache demographic facts without reading name pools or generating prose.
2. Establish household capacities and match workplaces to compatible adult resident slots. Explicit bindings reserve slots first. A person has one residence and at most one mapped workplace.
3. Connect real locations through trade needs, household/workplace links and neighboring residences. Each situation stores one cast, product, state and objective. A site has at most three situations.
4. Render names and prose lazily. A separate identity-only resolver supplies exact displayed place names and addresses without recursively generating another site's stories.

This separation matters. Writing a rumor never rolls a new person, house, amount, delivery state or objective. Both ends expose the same structured situation id, facts and request. Their rumor voices can differ. The same resident id, name, life stage, naming culture and habit travel between home and workplace. The local wealth setting remains a property of the site for prices and order conditions.

### Households and life stages

The ten household structures are `solitary`, `partners`, `siblings`, `extended_family`, `guardian_dependents`, `shared_lodging`, `craft_household`, `multigenerational`, `companions` and `care_household`. Structure eligibility uses population. Partners have two residents. A dependent primary resident gets a guardian household when capacity permits. Child and adolescent residents never receive adult workplaces. A resident receiving care is not assigned a workplace.

An explicit `demographics.population` is authoritative, including zero and one. When omitted, the layer generates a small household count. A forced household structure guides that default count. No more than twelve residents are individually listed; a larger population retains its exact count and states how many are unlisted. Vacant homes have no residents, jobs or situations.

Family members may share a surname when they use the same naming tradition. Housemates use independent names. Member names use the inherited ancestry distribution and naming culture, including custom pools. Age stages describe roles without imposing human lifespans on elves, dwarves or other ancestries. Race does not assign household morality or determine occupations. All eleven built-in traditions support every compatible structure.

### Pinning shared identities

The location editor has a **Shared residents and households** section. Choose a nearby residence for a workplace, a workplace for a home's primary resident, a household structure or a full name for an authored profile. Nearby choices show up to 120 same-district locations. The advanced JSON supports any valid mapped id.

```json
{
  "id": "cooper-001",
  "category": "workshop",
  "type": "cooper",
  "generation": {"social":{"home":"home-004"}}
}
```

A home can instead pin its primary resident with `generation.social.workplace`. Reciprocal references are allowed when they agree. Conflicting homes, incompatible demographics, empty residences, duplicate primary jobs and impossible household structures fail validation. `social.enabled: false` excludes a location. Shared `personName`, `home` and `workplace` settings belong on individual locations. Household style and enabled status can inherit through normal generation layers.

Authored person text is opaque. The generator does not parse a biography or invent a second named keeper. Such a contact is referenced by its existing workplace until an author supplies `generation.social.personName`. That explicit name can be shared with a residence while the authored profile stays literal. Direct field overrides still control what is shown.

### Connected situations and variety

Seventeen situation families include overdue deliveries, unsettled accounts, damaged orders, replacements, unclaimed work, misdirected parcels, missing references, conflicting copies, booking conflicts, borrowed possessions, shared responsibilities, gathering preparations, missing animals, disputed heirlooms, unfamiliar makers' marks, unexplained arcane work and map annotations.

Selection filters by the source trade and its workflow. A service business does not generate a damaged physical batch. Arcane anomalies require an arcane trade. A map fragment can name a road only when the source links that actual mapped road. Trade partners must have compatible industries and share a district or region. Product tags further filter the actual item: a food business can request a pot hook or hinge from a smith, while horseshoes require transport or agricultural demand and weapons require an appropriate trade or fortress setting. Street and water references, and specific dependencies such as cooper-to-brewer or miller-to-baker, weight partner choice. A source never becomes its own buyer.

Every household structure has at least 100 compiled narratives. Every situation has 100 shared-account presentations and 100 compatible objective variants. Rumor and request structures each have at least 100 variants, as do household tasks, resident habits and errands. The canonical event is rolled once per shared situation; viewpoint wording uses separate labeled streams. Full prose is cached only when requested.

`generator.catalog.socialRecipes` can replace a named bank from `socialSources`. Entries support strings or `{value,weight,when}`. Each active context needs at least 100 distinct positive-weight choices. The existing detail-source conditions apply, with `households` and `situations` added. Source validation rejects unknown banks, malformed templates, unavailable tokens and insufficient matching choices. `residentHabits`, `residentErrands` and `domesticTasks` are literal vocabulary banks. Narrative banks use the contextual token lists exported in `social/sources.js`.

Use ordinary section tables and overrides to change presentation. `{residentNote}`, `{connectionNote}` and `{requestNote}` are available in output templates but cannot define a place's name. Search, callouts, site guides and PDF entries include enabled social prose. **Connected places** buttons navigate to the actual homes, workplaces and other ends of situations.

### Helpers and stability

`mapping-tools.js` exports `socialGraph()`, `residentAt()`, `householdAt()` and `storiesAt()`, plus `socialSources`, `scenarios`, `householdTypes` and `compatibleProducts()` for product-level matching. Resolved locations expose `community` with resident records, household metadata, shared situations and related-location references. Treat returned data and source snapshots as immutable.

Numeric coordinates, array order, enabled prose fields and unrelated geographic additions do not affect matching. Changes to the map seed, relevant household inputs, demographic constraints, available residents or working locations can change assignments. Pins preserve deliberate relationships. A resident's identity is anchored to its household slot, so rerolling a workplace does not rename that resident. Local variations preserve the original generation identity. Generated community records are never written to compact map source.
