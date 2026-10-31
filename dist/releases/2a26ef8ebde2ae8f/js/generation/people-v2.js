import { people as legacy } from './catalog-v1.js';
import { bank, combine, words } from './helpers-v2.js';
const humanFemale = words('Ada|Adela|Agatha|Agnes|Ailsa|Alba|Alice|Alina|Alma|Amara|Anika|Anna|Anya|Arabella|Arden|Astrid|Audra|Beatrice|Berenice|Bess|Bridget|Brigid|Camilla|Carys|Catrin|Cecily|Clara|Cora|Dahlia|Daria|Delia|Dora|Edith|Eira|Elena|Elin|Eliza|Ella|Eloise|Elsa|Emilia|Enid|Erin|Esme|Esther|Eva|Faye|Fenella|Flora|Frida|Gilda|Greta|Gwen|Hana|Harriet|Hazel|Helena|Hilda|Ida|Imogen|Ines|Ingrid|Iona|Iris|Isla|Ivy|Jacinta|Jana|Joanna|Judith|Julia|Kara|Katia|Keira|Lara|Lena|Leona|Lila|Lina|Liv|Lorna|Lucia|Lydia|Maeve|Maia|Mara|Marina|Marta|Matilda|Mina|Mira|Moira|Nadia|Nella|Nessa|Nina|Nora|Odette|Olga|Olive|Orla|Petra|Phoebe|Pia|Rhea|Rita|Rosa|Ruth|Sabina|Saskia|Selma|Sigrid|Sonia|Talia|Tamsin|Tara|Thea|Una|Vera|Viola|Willa|Yara|Zara|Zelda');
const humanMale = words('Abel|Adam|Adrian|Aidan|Alan|Alaric|Albert|Alec|Alfred|Amos|Anders|Ansel|Anton|Arlo|Arthur|Asa|Baldric|Basil|Benedict|Bennett|Bernard|Bram|Bran|Brendan|Bryn|Caleb|Callum|Carl|Caspar|Cedric|Cian|Clement|Colin|Conrad|Cormac|Cyrus|Damon|Daniel|Darius|David|Dorian|Duncan|Edgar|Edmund|Edric|Edward|Elias|Ellis|Emil|Emmett|Eric|Ernest|Evan|Felix|Fergus|Finn|Florian|Francis|Frederick|Gareth|Gavin|Geoffrey|George|Gerard|Gideon|Gilbert|Giles|Graham|Gregor|Griffin|Harlan|Harold|Hector|Henry|Hugh|Hugo|Ian|Idris|Ilan|Isaac|Ivan|Ivo|Jasper|Jonas|Julian|Karl|Kieran|Klaus|Lars|Leif|Leon|Lewis|Linus|Lorcan|Luca|Magnus|Malcolm|Marcus|Martin|Matthias|Milo|Morgan|Niall|Nico|Noel|Norman|Oren|Oscar|Osric|Otto|Owen|Pascal|Peter|Quentin|Rafael|Ralph|Rhys|Roland|Ronan|Rowan|Rufus|Samuel|Saul|Sebastian|Silas|Simon|Soren|Stefan|Tobias|Tristan|Ulric|Victor|Walter|Warren|Willem|Yves|Zachary');
const neutral = words('Alex|Arden|Ash|Aster|Aubrey|Auden|August|Avery|Bay|Beck|Bellamy|Birch|Blair|Blake|Blue|Briar|Brook|Bryn|Cameron|Campbell|Carey|Carlin|Cass|Cedar|Charlie|Chris|Clem|Cobalt|Cody|Corin|Cove|Dale|Dana|Darcy|Dara|Devin|Drew|Eden|Ellery|Ellis|Ember|Emery|Ever|Fallon|Fern|Finley|Flint|Florin|Frost|Gale|Garnet|Glade|Gray|Greer|Gwyn|Harbor|Harley|Harper|Haven|Hayden|Hazel|Heath|Hollis|Indigo|Ira|Ivory|Jade|Jamie|Jay|Jesse|Jody|Jordan|Joss|Jules|Juniper|Kai|Kelsey|Kendall|Kit|Lake|Lane|Lark|Laurel|Lee|Lennox|Linden|Logan|London|Loren|Lowen|Lumi|Lynn|Marin|Marlow|Merit|Mica|Micah|Misha|Morgan|Moss|Nico|Noel|Oak|Ocean|Onyx|Page|Parker|Pat|Perry|Phoenix|Pip|Quinn|Rain|Reed|Reese|Remy|Ren|Riley|River|Robin|Rory|Rowan|Rue|Sage|Sam|Sasha|Scout|Shay|Sky|Snow|Sol|Sparrow|Sterling|Storm|Sunny|Tansy|Tate|Taylor|Teal|Terry|Thistle|Vale|Valentine|Vesper|Wren|Yael');
// Distinct phonologies produce full names, never numbered padding or duplicate weighting.
const phonology = {
  elf:['Ae|Ara|Cele|Ela|Fae|Gala|Ili|Lau|Lori|Syl|Tha|Vae','lian|riel|wen|thir|driel|nor|las|mir|rielis|wyn'],
  dwarf:['Bal|Bar|Bro|Dal|Dor|Gar|Gran|Har|Kar|Mor|Nor|Thor','din|gar|grim|rik|rin|run|dak|bor|drin|mun'],
  halfling:['Ad|Bel|Bri|Cor|Daf|El|Fen|Hob|Mer|Pip|Ros|Wil','bel|bin|by|da|di|do|la|lin|na|win'],
  gnome:['Al|Bim|Cog|Dim|Fizz|Gil|Jeb|Kel|Nim|Pim|Quil|Zan','ber|bit|ble|din|kin|ley|lin|nik|pip|wick'],
  orc:['Ag|Bor|Dur|Gar|Gor|Grak|Kar|Mog|Nar|Rag|Urz|Vor','ak|ar|ash|gor|gul|ka|mar|nak|ruk|za'],
  tiefling:['Aza|Bel|Cala|Dama|Eri|Iza|Kali|Luci|Mala|Neme|Sera|Zari','dor|eth|ira|is|ith|ora|rian|ris|thus|viel'],
  dragonborn:['Arj|Bal|Da|Dra|Ghe|Hes|Kri|Med|Nad|Per|Tar|Ver','ax|ash|bor|dor|esh|ith|kas|nar|rax|tor'],
  goblin:['Bik|Brek|Daz|Fiz|Gib|Griz|Kip|Krik|Nib|Raz|Vik|Zik','ba|bit|ek|ga|ik|ki|nak|ra|rit|zik']
};
const surnameWords = combine('Amber|Ash|Bell|Birch|Copper|Dawn|Elder|Flint|Hazel|Iron|Moon|Oak', 'brook|field|ford|gate|grove|hall|hill|stone|ward|wood', '');
export const people = Object.fromEntries(Object.entries(legacy).map(([race,pool]) => {
  const style = race === 'half_elf' ? 'elf' : race === 'half_orc' ? 'orc' : race;
  const syllables = phonology[style];
  const formed = syllables ? combine(...syllables, '') : neutral;
  const surnames = style === 'dwarf' ? combine('Anvil|Basalt|Brass|Bronze|Copper|Deep|Flint|Forge|Granite|Iron|Quartz|Stone', 'beard|breaker|delver|fist|hammer|hand|helm|keeper|shield|wright', '') : surnameWords;
  return [race, {
    female:bank([...pool.female,...(race === 'human' ? humanFemale : formed)], `${race} female names`),
    male:bank([...pool.male,...(race === 'human' ? humanMale : formed)], `${race} male names`),
    nonbinary:bank([...pool.nonbinary,...(race === 'human' ? neutral : formed)], `${race} neutral names`),
    surnames:bank([...pool.surnames,...surnames], `${race} surnames`)
  }];
}));
