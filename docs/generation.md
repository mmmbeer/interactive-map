# Deterministic location content

The saved map stores geometry, identifiers and configuration. `materializeMap(source)` exposes generated names and text through cached getters. Nothing generated is written to the source. Search resolves content when needed. Opening the initial highlights does not generate thousands of ordinary stories.

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

`generation.fields` lists enabled generated fields. Built-ins are `name`, `description`, `person`, `rumor`, `address` and `services`. An omitted field returns empty text. If name is disabled, the id remains as its directory label.

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

Dragonsgate uses compact inputs for 7,085 places. Its 54 authored highlights remain overrides. All original ids and geometry are preserved.
