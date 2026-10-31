# Location content audit

The audit covers all 157 built-in location types, 14 settlement settings and 11 ancestry settings. It generates the same 308 synthetic map contexts with and without shared households, for 54,208 resolved locations. Wealth and gender cycle through their three built-in choices. Separate regression tests cover vacant homes, dependent residents, both generator engines, custom types, authored overrides and field selection.

These are generated test cases, not new places added to the published maps. The audit checks specific grammar and consistency failures. It does not prove that every possible sentence is good prose.

## Findings and changes

| Area | Before | Change |
| --- | --- | --- |
| Hospitality | “prepare a market sample of the long-stay bookings” | Classify the selected item. Rooms, lessons, baths and reservations use service tasks. Physical supplies use goods tasks. |
| Menus | “Lamb with beans with rye bread” | Use complete dish names and a separate “served with” clause. Preserve vegetarian and water-menu conditions. |
| Visitors | “A visitor representing town households” carrying a sample for a tavern commission | Use settlement-appropriate individual visitor roles and business appropriate to the inn, boarding house, cookshop or teahouse. Select different visitors and activities within one entry. |
| Homes | Public service advertisements and references to residents in empty houses | Suppress default public services. Give empty homes vacancy and upkeep text. Dependents receive no adult occupation. Remove redundant household registers and repeated head counts. |
| Temples | Generic shop services and receipt-related errands | Describe worship, remembrance, observances and visitor care. Use temple-specific visiting guidance. |
| Burial sites | Graves with counters, kitchens, cellar histories and “senior assistance” | Use burial and memorial descriptions, caretaker contacts and memorial care leads. Separate the caretaker from the deceased. |
| Guilds | Physical trade work mixed with generic institutional advertising | Retain the selected trade focus. Describe members, introductions and meetings. Use guild-specific visitor guidance. |
| Harbors | Rigging inspections followed by unrelated storage fees or cargo receipts | Generate one coherent cargo-handling activity. Separate office hours from boat departure times. |
| Geography | “belongs to the mapped geography” and repeated survey-register accounts | Use type-specific landscape descriptions and visitor activity. Keep actual linked feature names and suppress business contacts and services. |
| Shared service stories | Room bookings treated as physical deliveries or ready-to-collect goods | Select compatible scenario families after selecting the product. Service invoices and booking conflicts use service wording. Both ends retain the same event, participants, balance and objective. |
| Service practices | A tutor’s “sample book” recording a decorative finish | Use appointment, document, provisions or goods practices. Retain all eleven label traditions. |

## Automated comparison

The legacy column uses the generator behavior after PR #17, before opting into the new prose profile. Counts are rule matches, not unique locations or an editorial quality score.

| Targeted check | Legacy matches | Prose profile matches |
| --- | ---: | ---: |
| Private homes advertising public services | 6,160 | 0 |
| Physical handling of bookings or lessons | 35 | 0 |
| Repeated menu conjunctions | 158 | 0 |
| Map or household register boilerplate | 2,349 | 0 |
| Shop and building prose at burial sites | 708 | 0 |
| Unrelated cargo follow-ups | 40 | 0 |
| Nested action phrasing | 339 | 0 |
| Total | 9,789 | 0 |

Run `npm run audit:content` to repeat the full sweep. Run `npm run audit:content -- --legacy` for the comparison. The command reports the first example of each failure rule and exits unsuccessfully if the enabled profile has a targeted failure.

## Release and compatibility

`generator.proseVersion: 1` enables the corrected presentation. Both published maps and newly recognized local uploads select it. Existing source without this property retains the previous presentation. Released RNGs, naming pools and default engine catalogs remain unchanged.

The published maps retain their location ids, coordinates, geometry, demographic settings and named geographic references. Dragonsgate’s home naming table remains intact. Its generic home description table now yields to the profile so vacant homes can be described correctly. Grayhaven’s map checksum is refreshed after verifying its only source change is the profile flag.

Literal field overrides, custom output tables, custom detail sources, custom social recipes and explicit section labels retain precedence. The profile supports both engine versions. Generated prose and shared community records remain absent from compact map serialization.

Each new compiled content recipe has at least 100 distinct rendered variations. The regression tests cover the recipe banks and their contextual use. Type-specific hours, headings, visitor roles and workflows remain independent of ancestry.

Validation completed with all 165 tests passing. The production build validates both published maps and all 11,570 saved locations, JavaScript syntax, assets and file-size limits. The matching `dist/` release is committed with the source.
