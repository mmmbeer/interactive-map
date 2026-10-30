import { bank, combine } from './helpers-v2.js';
import { people } from './people-v2.js';

export const ancestries = Object.freeze({
  human:'Human',orc:'Orc',elf:'Elf',dwarf:'Dwarf',halfling:'Halfling',dragonborn:'Dragonborn',
  gnome:'Gnome',goblin:'Goblin',tiefling:'Tiefling',half_elf:'Half-elf',half_orc:'Half-orc'
});
// Released profile banks are immutable. New naming conventions belong in a new file/version.
// These are naming traditions, not restrictions on temperament, profession or wealth.
const traditions = {
  elf:{
    first:'Moon|Star|Dawn|Silver|Willow|Aspen|Laurel|Iris|Fern|Moss|Crystal|Twilight',
    last:'song|bough|glade|whisper|veil|bloom|dance|light|dew|leaf|shimmer|weave',
    water:'Dew|Mist|Rain|Pearl|Reed|Lily|Swan|Silver|Moon|Star|Willow|Crystal',
    flow:'ripple|mirror|brook|current|spring|pool|shimmer|mist|wave|cascade',
    route:'bough|arch|walk|weave|step|bower|way|span|trace|gate',
    family:'song|whisper|weaver|leaf|bloom|dancer|watcher|bough|seeker|keeper'
  },
  dwarf:{
    first:'Anvil|Basalt|Brass|Bronze|Copper|Flint|Forge|Granite|Iron|Quartz|Slate|Deep',
    last:'delve|vault|hearth|pillar|hold|crag|mantle|seam|hall|ridge|keystone|crown',
    water:'Cavern|Copper|Flint|Granite|Iron|Quartz|Slate|Basalt|Deep|Crystal|Silver|Marble',
    flow:'well|cistern|spring|run|drip|basin|fall|sluice|pool|flow',
    route:'stair|cut|arch|tunnel|causeway|step|ramp|pass|gallery|gate',
    family:'beard|hammer|delver|wright|shield|helm|hand|mason|keeper|carver'
  },
  halfling:{
    first:'Apple|Barley|Bramble|Clover|Hazel|Honey|Meadow|Orchard|Pippin|Thistle|Tansy|Willow',
    last:'burrow|mead|hearth|hollow|patch|bank|green|hedge|lea|garden|nook|croft',
    water:'Duck|Cress|Reed|Trout|Otter|Willow|Clover|Meadow|Pebble|Apple|Hazel|Mint',
    flow:'brook|ford|eddy|rill|pool|bend|spring|ripple|wash|run',
    route:'stile|hedge|walk|turn|step|way|gate|path|bridge|row',
    family:'foot|kettle|button|baker|basket|thatch|burrow|gardener|tucker|miller'
  },
  orc:{
    first:'Urz|Grak|Mog|Dur|Varg|Ghor|Krag|Thok|Bor|Ruk|Zug|Nar',
    last:'agar|orum|esh|akar|ugra|osh|akrum|odar|urak|az|mok|ugal',
    water:'Urz|Ghor|Mog|Krag|Ruk|Dur|Bor|Thok|Varg|Zug|Grak|Nar',
    flow:'ora|ur|esh|agul|omar|uz|aruk|og|ukar|osh',
    route:'dar|kar|gath|rum|zag|tor|nak|bar|dur|mok',
    family:'ak|gora|mak|zara|ruk|dar|thar|gul|nak|gor'
  },
  dragonborn:{
    first:'Arj|Bal|Dra|Ghe|Hes|Kri|Med|Nad|Per|Tar|Ver|Zar',
    last:'akth|arax|eshar|ithra|ondar|urash|axir|ekar|ovar|yras|athor|esk',
    water:'Aesh|Irid|Kri|Saph|Crys|Med|Nad|Oph|Per|Zar|Ver|Tar',
    flow:'aris|esh|irax|ovar|ath|yr|onar|isth|aur|ex',
    route:'dar|rax|thir|kesh|vor|naar|xar|thas|kor|ash',
    family:'ardent|axion|essar|ithrix|ornar|urath|ekesh|ovaris|tharyn|zareth'
  },
  gnome:{
    first:'Bim|Cog|Fizz|Gil|Jeb|Kel|Nim|Pim|Quil|Zan|Dim|Wick',
    last:'blewick|bottle|spindle|whistle|tumble|widget|kin|spark|bobbin|gimbal|winder|fettle',
    water:'Bubble|Copper|Dew|Fizz|Glass|Kettle|Nim|Pim|Quill|Silver|Thimble|Tinker',
    flow:'splash|drip|bubble|spout|wheel|ripple|spring|gurgle|eddy|well',
    route:'turn|spiral|stair|winder|way|loop|bridge|walk|step|gate',
    family:'blewick|whistle|spanner|cog|bottle|spring|gimbal|sprocket|thimble|fettle'
  },
  goblin:{
    first:'Bik|Brek|Daz|Fiz|Gib|Griz|Kip|Krik|Nib|Raz|Vik|Zik',
    last:'baz|ik|nak|rit|zig|gak|bit|ek|kaz|rik|zik|git',
    water:'Bik|Brek|Gib|Griz|Kip|Krik|Nib|Raz|Vik|Zik|Fiz|Daz',
    flow:'ip|zik|wek|gip|nix|rek|bit|ak|gik|vaz',
    route:'tik|zag|kip|nak|wik|gak|rig|bik|rit|zik',
    family:'bit|ek|ga|ik|ki|nak|ra|rit|zik|baz'
  },
  tiefling:{
    first:'Amaranth|Aster|Carnelian|Cinder|Cobalt|Ember|Indigo|Onyx|Opal|Saffron|Velvet|Vesper',
    last:'vow|verse|veil|canticle|promise|accord|reverie|requiem|sonnet|cipher|wish|echo',
    water:'Amethyst|Cobalt|Dusk|Garnet|Indigo|Ink|Opal|Pearl|Saffron|Velvet|Vesper|Violet',
    flow:'mirror|reflection|tear|ripple|wash|current|fall|pool|spring|shimmer',
    route:'arc|turn|way|passage|stair|walk|crossing|gate|span|court',
    family:'vow|verse|keeper|scribe|weaver|seeker|witness|echo|cipher|promise'
  }
};
const profiles = Object.fromEntries(Object.entries(traditions).map(([race,t]) => {
  const form = (left,right,label) => bank(combine(left,right,''),`${race} ${label}`);
  return [race,Object.freeze({
    roots:form(t.first,t.last,'place roots'),
    streetRoots:form(t.first,t.route,'route roots'),
    waterRoots:form(t.water,t.flow,'water roots'),
    surnames:form(t.first,t.family,'surnames')
  })];
}));
// Mixed traditions combine two complete banks, rather than borrowing a human fallback.
for (const [race,parent] of [['half_elf','elf'],['half_orc','orc']]) {
  const human={roots:combine('Ash|Bell|Birch|Cedar|Dawn|Elm|Flint|Hazel|Oak|Reed|Rose|Stone','brook|field|ford|gate|grove|hall|hill|stone|ward|wood','')};
  profiles[race]=Object.freeze(Object.fromEntries(Object.entries(profiles[parent]).map(([key,values])=>[
    key,bank([...values,...(key==='surnames' ? people.human.surnames : human.roots)],`${race} ${key}`)
  ])));
}
export const settlementProfiles = Object.freeze(profiles);

export function settlementPeople(race) {
  const profile=settlementProfiles[race];
  return profile ? {...people[race],surnames:profile.surnames} : people[race];
}
