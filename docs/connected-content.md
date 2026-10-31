# Connected location content

The map calls two public APIs directly from the browser:

| Provider | API origin | Location content |
| --- | --- | --- |
| NPC Sorrow | `https://sorrow.dndadventurerslog.com/api/v1` | Deceased NPCs, scenes, findings and handout links |
| D&D Help Board | `https://help.dndadventurerslog.com/api/v1` | Quest postings, DM encounter references and board links |

Select a location and use **Load grave stories** or **Load quest board**. Player view is the default. **DM view** explicitly loads board secrets and exposes DM links. Both services' DM views are public presentations, not authentication. Sorrow has no separate secret narrative.

Search the directory for **quest board**, **notice board**, **side quests**, **burial site**, **graveyard**, **cemetery** or a saved location type such as **crypt**. Search includes all locations, including unfeatured sites, and retains category and neighborhood filters. Enabled providers add search terms without loading an API. Burial types remain searchable when Sorrow is disabled. Explicitly enabled boards and story locations are searchable under their corresponding feature terms.

Requests run only after a load or view action. Closing the callout, selecting another place or leaving the map cancels pending requests. Errors retain a retry action. Browser credentials are omitted. Content is escaped text. Links are restricted to the relevant provider's HTTPS origin. Cloudflare Pages permits API connections to these two origins.

## Location eligibility

New `landmark` types `graveyard`, `cemetery`, `necropolis`, `tomb`, `crypt`, `mausoleum` and `grave` appear in the editor and automatically enable Sorrow. Graveyards, cemeteries and necropolises start with three stories. Other burial sites start with one. Each story is a separate deceased character. Living keepers and household residents are never repurposed as deceased NPCs. Existing landmarks are not reclassified from names or descriptions.

Guilds, shops, workshops, taverns, temples and harbors enable quest boards. Custom semantic types such as `adventurers_guild`, `merchant_guild`, `market`, `notice_board`, `barracks`, `watchtower`, `guardhouse`, `college`, `academy` and `caravanserai` also enable boards. Building functions select matching recipes. Shops and workshops use regional recipes when inherited environment or linked geography provides that context. Otherwise they use guild commissions. Ancestry never selects terrain or morality.

Use **Edit location → Connected content** to enable or disable either provider for an authored landmark. Set board recipe, party level, quest count and tone. Set story count and optional deceased name, race, age, sex and occupation. Edits follow the existing local variation workflow.

Compact source stores settings at location level, outside the generator:

```json
{
  "id": "cemetery-north",
  "category": "landmark",
  "type": "cemetery",
  "district": "old-ward",
  "x": 120,
  "y": 340,
  "integrations": {
    "sorrow": {"count": 3},
    "quests": {"enabled": true, "locationId": "temple", "level": 4, "count": 8}
  }
}
```

This is a location fragment. Retain normal map metadata, districts and generator. `enabled: false` disables automatic behavior. Named NPCs require one story. Counts range from one to six stories or six to fourteen quests. Party levels range from one to twenty. Provider `/options` endpoints supply accepted recipes, tones, races, sexes, ages and occupations. Unsupported options produce a message rather than a silent substitution.

## Determinism and context

Seeds combine a provider namespace, original map generation identity, effective map seed, stable location ID, inherited location seed and revision. Bounded seeds exclude coordinates, array order and temporary local variation IDs. Existing generated text and map geometry are unchanged. A location's **New variation** changes connected content too.

Each grave uses a separate labeled seed and a single-story request. Increasing story count retains earlier graves. Weighted ancestry, gender and age inherit from map, region, district and location. `half_elf` and `half_orc` map to hyphenated API values. `young_adult`, `middle_aged` and `elder` map to API age groups. Exact ages and occupation overrides are supported. Custom races need an explicit supported override. A site's living contact and trade do not become the deceased character's name or occupation.

Boards receive exact displayed place, district and settlement names plus stable source IDs. Help Board currently accepts these context fields and a recipe, not arbitrary racial, trade or social graph constraints. The mapper does not invent request fields or claim that a board quest is one of its existing shared household situations.

Successful responses and provider options use a bounded browser snapshot cache of eight requests. Saved board keys and returned links retain the same board. Available snapshots reopen offline. Full or disabled storage falls back to memory. Responses are never written into compact map source, map JSON exports, site guides or PDFs. Snapshots stay in this browser and are not part of an atlas backup.

NPC Sorrow v1 pins generator version 5. Help Board v1 versions its contract but can update its generator. Identical inputs produce repeatable boards within the provider's generator version. Snapshots retain loaded text until evicted. Exact historical text across devices or after eviction requires upstream generator versioning or an exported content snapshot.
