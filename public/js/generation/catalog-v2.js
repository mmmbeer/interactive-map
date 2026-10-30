import { types as legacyTypes, defaults } from './catalog-v1.js';
import { people } from './people-v2.js';
import { adjectives, animals, symbols, streetRoots, roots, waterRoots, epithets } from './wordbanks-v2.js';
import { bank, words } from './helpers-v2.js';
import { proseRegistry } from './prose-v2.js';
export { people, defaults };
// Patterns and finite options are grammars, not word banks. Keep them small and deliberate.
export const namePatterns = [
  '{adjective} {noun}', '{surnamePossessive} {nameLabel}', '{firstPossessive} {noun}',
  '{district} {noun}', '{noun} on {street}', '{noun} of {region}',
  '{surname} & {partnerSurname} {nameLabel}', '{root} {nameLabel}',
  'The {animal}’s {noun}', '{adjective} {nameLabel} at {houseNumber}',
  '{nameLabel} of the {symbol}', '{fullNamePossessive} {nameLabel}'
];
const qualified = (values, modifiers, label) => bank([
  ...values,...words(modifiers).flatMap(a => values.map(b => `${a} ${b}`))
], label);
const nounModifiers = 'Amber|Birch|Brass|Cedar|Copper|Elm|Flint|Golden|Granite|Hazel|Iron|Ivory|Juniper|Laurel|Linden|Maple|Marble|Oak|Pearl|Pine|Quartz|Reed|Rose|Rowan|Silver|Slate|Stone|Willow|Yew|Gilded|Old|Carved|Painted|Polished';
const roleModifiers = 'experienced|resident|local|visiting|retired|apprentice|senior|junior|independent|traveling|district|seasonal|trusted|long-serving|newly appointed|part-time|full-time|deputy|assistant|contract|guild-trained|self-taught|well-known|quiet|outspoken|meticulous|practical|patient|energetic|reclusive|sociable|studious|versatile|dedicated';
const serviceModifiers = 'appointments for|requests for|advice about|consultations about|introductions for|referrals for|information about|arrangements for|assistance with|bookings for|local guidance on|special orders for|enquiries about|scheduled sessions for|daily help with|weekly sessions for|private consultations on|group sessions for|estimates for|demonstrations of|lessons about|written guidance on|advance bookings for|personal assistance with|seasonal arrangements for|expert advice on|practical help with|regular appointments for|district referrals for|visitor information about|recommendations for|individual guidance on|morning appointments for|afternoon appointments for';
export const types = Object.fromEntries(Object.entries(legacyTypes).map(([key, type]) => [key, {
  ...type,
  nouns:qualified(type.nouns,nounModifiers,`${key} nouns`),
  roles:qualified(type.roles,roleModifiers,`${key} roles`),
  services:qualified(type.services,serviceModifiers,`${key} services`),
  tables:{...type.tables,name:namePatterns}
}]));
// Each geographic type has a precise head noun. A lake never gets a street suffix.
export const featureHeads = {
  street:'Street',road:'Road',lane:'Lane',alley:'Alley',bridge:'Bridge',square:'Square',trail:'Trail',
  river:'River',stream:'Stream',canal:'Canal',lake:'Lake',pond:'Pond',bay:'Bay',sea:'Sea',channel:'Channel',strait:'Strait',
  island:'Island',forest:'Forest',wood:'Wood',hill:'Hill',mountain:'Mountain',valley:'Valley',marsh:'Marsh',field:'Field',cliff:'Cliff',beach:'Beach',cape:'Cape'
};
export const categoryForFeature = type => /^(street|road|lane|alley|bridge|square|trail)$/.test(type) ? 'street' : /^(river|stream|canal|lake|pond|bay|sea|channel|strait)$/.test(type) ? 'water' : 'terrain';
for (const [key,head] of Object.entries(featureHeads)) {
  types[key] = {
    category:categoryForFeature(key),label:key,nouns:bank(streetRoots.map(root => `${root} ${head}`)),
    roles:types.landmark.roles,services:types.landmark.services,
    tables:{name:[
      {value:'{root} {head}',weight:1},{value:'{head} of {root}',weight:1},
      {value:'{surnamePossessive} {head}',weight:1},{value:'{district} {root} {head}',weight:2},
      {value:'{compound} {head}',weight:6},{value:'The {adjective} {head}',weight:1},
      {value:'{epithetPossessive} {head}',weight:1},{value:'{root} {head} of {region}',weight:2},
      {value:'{firstPossessive} {root} {head}',weight:3},{value:'The {root} {head}',weight:1},
      {value:'{head} of the {adjective} {animal}',weight:4},{value:'{adjective} {root} {head}',weight:6}
    ]}
  };
}
export const tables = {
  root:roots,waterRoot:waterRoots,streetRoot:streetRoots,epithet:epithets,
  adjective:adjectives,animal:animals,symbol:symbols,street:bank(streetRoots.map(root=>`${root} Street`)),
  ...proseRegistry,name:namePatterns,
  description:['{displayName} is {article} {label} in {district}, {setting}. It offers {service}. {detail} {history}',
    'In {district}, {displayName} provides {service}, {setting}. {history} {detail}',
    '{displayName} serves {district} from {address}. {detail} {history}'],
  person:['{fullName}, {ageLabel} {raceLabel} {role}. Known for {habit}.'],
  rumor:['{first} needs someone to {task} {complication}.','A notice at {displayName} asks for help to {task} {complication}.'],
  address:['{houseNumber} {street}'],services:['{service}']
};
