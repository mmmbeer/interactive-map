import { ADJECTIVES, NOUNS } from './shop-pools.js';
import { NAME_PARTS } from './people-pools.js';
import { trades } from './trades-v1.js';

// Shared tables live here, never repeated for every building. Preserve v1 output.
export const people = {
  ...NAME_PARTS,
  orc: NAME_PARTS.half_orc,
  goblin: {
    female: ['Bikka','Griza','Nibbi','Reeka','Tazra','Vikka','Zella','Kipra'],
    male: ['Brek','Daz','Fiz','Grib','Krik','Nibs','Razz','Zik'],
    nonbinary: ['Bip','Crik','Dabble','Flick','Kip','Nix','Pip','Wik'],
    surnames: ['Brasscap','Candlewick','Copperpin','Duskettle','Inkfinger','Mossbutton','Reedstitch','Tinkertop']
  }
};
const entry = (category, label, nouns, roles, services) => ({category, label, nouns, roles, services});
export const types = {
  ...trades,
  landmark: entry('landmark','landmark',['Arch','Bell','Column','Gate','Obelisk','Steps','Tower'],['caretaker','mason','historian'],['guided walks','public notices','city records']),
  tavern: entry('tavern','tavern',NOUNS.inn,['innkeeper','host','brewer'],['hot meals','lodgings','local cider','traveler introductions']),
  shop: entry('shop','shop',NOUNS.general_store,['merchant','shopkeeper','trader'],['provisions','household wares','travel supplies']),
  workshop: entry('workshop','workshop',NOUNS.blacksmith,['artisan','craftsperson','repairer'],['repairs','custom fittings','tool sharpening']),
  temple: entry('temple','sanctuary',NOUNS.temple,['keeper','chaplain','healer'],['quiet shelter','memorial services','healing herbs']),
  guild: entry('guild','guildhall',NOUNS.adventurers_guild,['registrar','steward','factor'],['work contracts','apprenticeships','professional introductions']),
  harbor: entry('harbor','quay',['Anchor','Buoy','Crane','Jetty','Mooring','Pier','Sail','Wharf'],['harbormaster','ferryman','dock steward'],['passage','cargo storage','tide reports']),
  home: entry('home','home',['House','Lodge','Court','Rooms','Cottage','Residence'],['resident','tenant','householder'],['a spare room','neighborhood advice','a shared garden']),
  blacksmith: entry('workshop','smithy',NOUNS.blacksmith,['smith','armorer','journeyman'],['ironwork','blade repairs','made-to-measure fittings']),
  tailor: entry('shop','tailor',NOUNS.tailor,['tailor','cloth merchant','embroiderer'],['alterations','weatherproof cloaks','dyed cloth']),
  jeweler: entry('shop','jeweler',NOUNS.jeweler,['jeweler','gem cutter','silversmith'],['engraving','stone setting','appraisals']),
  apothecary: entry('shop','apothecary',NOUNS.potion_shop,['herbalist','apothecary','distiller'],['balms','herbal remedies','tinctures']),
  arcane: entry('shop','arcane shop',NOUNS.arcane,['scribe','ritualist','antiquarian'],['scrolls','ritual supplies','relic appraisals']),
  fletcher: entry('workshop','fletcher',NOUNS.fletcher,['fletcher','bowyer','woodworker'],['bow repairs','arrows','new bowstrings']),
  bakery: entry('shop','bakery',['Loaf','Crust','Oven','Hearth','Grain','Rolling Pin'],['baker','miller','pastry cook'],['fresh bread','seed cakes','travel biscuits'])
};
export const defaults = {
  fields: ['name','description','person','rumor','address','services'],
  demographics: {
    races: {human:60,elf:10,dwarf:10,halfling:7,gnome:4,orc:3,half_elf:2,half_orc:1,tiefling:1,dragonborn:1,goblin:1},
    genders: {female:45,male:45,nonbinary:10}, ages: {adult:7,young_adult:2,elder:1},
    cultures: {ancestral:1}, wealths: {modest:6,comfortable:3,wealthy:1}
  }
};
export const tables = {
  adjective: ADJECTIVES,
  animal: ['Badger','Bear','Cat','Crow','Drake','Falcon','Fox','Goat','Griffin','Hare','Hart','Hound','Owl','Ram','Raven','Stag','Swan','Wolf','Wren'],
  symbol: ['Candle','Crown','Gate','Harp','Key','Lantern','Moon','Rose','Shield','Star','Sun','Wheel'],
  street: ['Anchor Lane','Bell Street','Copper Row','Garden Walk','Market Row','Mill Lane','Reed Lane','Sailmakers Way','Stone Steps','Willow Court'],
  detail: ['A slate counter faces the doorway.','Small bells announce each arrival.','A fig tree shades the courtyard.','Fresh plaster covers one wall.','Rain barrels line the alley.','A tiled stove warms the entrance.','A brass plate records the previous occupants.','Window boxes spill over the lintel.','A painted sign creaks above the door.','A winding stair leads to a roof terrace.','A mosaic marks the threshold.','A covered passage leads to the next street.'],
  history: ['Its oldest ledger survived a warehouse fire.','The neighbors rebuilt it after a winter flood.','The deed still carries the seal of a vanished council.','Its previous keeper left a locked chest in the cellar.','It once shared a courtyard with a much larger estate.','A bricked-up doorway appears on an old survey.','A former apprentice paid for the new roof.','Its foundation stones came from the city walls.','The building has changed hands three times this decade.','Its lease includes an unexplained annual payment.','A carved date above the door predates the street.','A traveling family occupied the upper rooms for a generation.'],
  habit: ['keeps careful accounts','remembers returning visitors','collects old local maps','offers tea before discussing business','repairs things rather than replacing them','always carries a notebook','knows the neighbors by name','speaks softly even in a crowd','keeps a small kitchen garden','sends letters every market day','hums while working','supports a local apprenticeship'],
  task: ['find the owner of an unclaimed parcel','trace a missing delivery','identify a seal on an old letter','locate a former apprentice','retrieve a borrowed ledger','settle a disputed boundary','escort a visitor after dusk','decipher a note in an unfamiliar hand','check a locked storeroom','deliver a sealed message','recover a family keepsake','find the source of a midnight tapping'],
  complication: ['before the next market day','without alarming the neighbors','before the tide turns','while the city surveyors are away','before the lease changes hands','without involving the guild','before a visitor leaves town','before the next council meeting'],
  name: [
    {value:'The {adjective} {noun}',weight:4}, {value:'{surname}’s {nameLabel}',weight:4},
    {value:'The {animal} and {symbol}',weight:2}, {value:'{noun} of {district}',weight:1},
    {value:'{first}’s {adjective} {noun}',weight:2}, {value:'The {adjective} {animal}',weight:1},
    {value:'{surname} & {partnerSurname}',weight:2}, {value:'{district} {noun}',weight:1},
    {value:'The {number} {noun}',weight:1}, {value:'{noun} at {street}',weight:1}
  ],
  description: ['This {label} in {district} offers {service}. {detail} {history}', '{detail} This {wealth} {label} is known locally for {service}. {history}', '{first} keeps this {label} in {district}, providing {service}. {history} {detail}'],
  person: ['{fullName}, {ageLabel} {raceLabel} {role}. {subject} {habit}.'],
  rumor: ['{first} needs someone to {task} {complication}.','A visitor asks who can {task} {complication}.','A note at the entrance offers payment to {task} {complication}.'],
  address: ['{houseNumber} {street}'],
  services: ['{service}']
};

// Domestic and civic places use names suited to their purpose.
types.home.tables = {name:[{value:'{fullName} House',weight:5},{value:'{surname}’s {adjective} Cottage',weight:2},{value:'{first}’s Rooms on {street}',weight:2},{value:'{adjective} {noun} at {houseNumber}',weight:1}]};
types.temple.tables = {name:['Sanctuary of the {adjective} {symbol}','The {adjective} {noun}','{district} {noun}','{first}’s {noun}']};
types.harbor.tables = {name:['{adjective} {noun}','{surname}’s {noun}','{district} {noun}','{first}’s {noun} at {houseNumber}']};
