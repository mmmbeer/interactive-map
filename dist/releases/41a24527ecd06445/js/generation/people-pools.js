// Adapted from mmmbeer/shoppe naming pools. Generation uses local seeded streams.
// Shopkeeper name word lists for the frontend.
// Names are built as "{first} {surname}" using race-specific first-name roots
// and gender-specific merchant surnames.
// Edit this file freely — no other files need to change.

// Race-specific first name pools.
export const NAME_PARTS = {
  human: {
    female:    ["Aria", "Bryn", "Celia", "Dara", "Elise", "Helena", "Mira", "Rina", "Sabine", "Tessa", "Alma", "Briala", "Cora", "Delia", "Evelyn", "Fenna", "Greta", "Hester", "Iris", "Jessamine", "Lyra", "Maren", "Nora", "Odette", "Petra", "Rosalind", "Selene", "Tabitha", "Verna", "Willa"],
    male:      ["Alden", "Bram", "Corin", "Darian", "Edric", "Gavin", "Jonas", "Luther", "Marek", "Tobin", "Alric", "Bennet", "Cedric", "Dorian", "Emmett", "Felix", "Gregor", "Hadrian", "Ivor", "Jasper", "Leoric", "Matthias", "Nolan", "Oswin", "Perrin", "Roland", "Silas", "Tristan", "Ulric", "Wes"],
    nonbinary: ["Ash", "Ember", "Kestrel", "Lark", "Riven", "Rowan", "Sable", "Vale", "Wren", "Zephyr", "Aster", "Briar", "Cinder", "Dove", "Finch", "Harbor", "Indigo", "Juniper", "Lumen", "Morrow", "North", "Peregrine", "Quest", "Rain", "Sparrow", "Talon", "Umber", "Vireo", "Winter", "Yarrow"],
    surnames:  ["Blackwell", "Crowley", "Dunbar", "Fairwind", "Hawthorne", "Locke", "Merrick", "Penn", "Trent", "Vale", "Ashdown", "Barrow", "Caskwell", "Dunley", "Fenwick", "Garron", "Hartwell", "Kettle", "Marlow", "Norbridge", "Orchard", "Pryce", "Redfern", "Shear", "Tamber", "Thistle", "Undermere", "Vellum", "Westcott", "Yardley"]
  },
  elf: {
    female:    ["Aelene", "Caelynn", "Eilistra", "Ilyra", "Lethia", "Naivara", "Sarya", "Thalara", "Vaeril", "Yllune", "Aerisiel", "Briena", "Ciryth", "Daenala", "Enna", "Faelina", "Irilde", "Keyleth", "Laerra", "Maevyn", "Nuala", "Oristelle", "Phaelyn", "Quisara", "Rhiannon", "Selatha", "Talindra", "Urielle", "Velatha", "Zereni"],
    male:      ["Aelar", "Belanor", "Felarion", "Ithran", "Laucian", "Myron", "Peren", "Soveliss", "Theren", "Varis", "Aeris", "Baelith", "Calaeth", "Dayereth", "Erevan", "Faelar", "Galinndan", "Hatharal", "Immeral", "Korfel", "Lhoris", "Morthil", "Nym", "Orym", "Paelias", "Quarion", "Riardon", "Sarith", "Tathaln", "Vaelis"],
    nonbinary: ["Aeris", "Elowen", "Lior", "Myri", "Neris", "Quill", "Saelis", "Syl", "Talar", "Veyan", "Aven", "Calith", "Delys", "Elar", "Fae", "Hale", "Iri", "Jalen", "Kyr", "Leth", "Miren", "Nyx", "Orin", "Phae", "Ryn", "Saren", "Thalen", "Uri", "Vaen", "Ysil"],
    surnames:  ["Amakiir", "Dalanthan", "Galanodel", "Holimion", "Liadon", "Nailo", "Siannodel", "Xiloscient", "Yrthraethra", "Yllaris", "Amastacia", "Auglamyr", "Erenaeth", "Esiar", "Firahel", "Ilphelkiir", "Lathalas", "Meliamne", "Naelo", "Ofandrus", "Qinfaren", "Rothenel", "Sundamar", "Teinithra", "Tyrneiros", "Ulondarr", "Voron", "Xyrrael", "Yelrie", "Zylfaren"]
  },
  dwarf: {
    female:    ["Artin", "Diesa", "Eldeth", "Falkrunn", "Gurdis", "Helja", "Kathra", "Liftrasa", "Riswynn", "Torbera", "Anbera", "Bardryn", "Dagny", "Eindra", "Finellen", "Gerta", "Hlin", "Ilde", "Jarana", "Kristryd", "Mardred", "Oriff", "Sannl", "Torbera", "Vistra", "Yurgunn", "Brenna", "Dworicca", "Hedra", "Ragna"],
    male:      ["Adrik", "Baern", "Dain", "Eberk", "Fargrim", "Harbek", "Rurik", "Taklinn", "Thoradin", "Vondal", "Barendd", "Brottor", "Dworic", "Einkil", "Flint", "Gardain", "Kildrak", "Morgran", "Orsik", "Rangrim", "Taklinn", "Tordek", "Traubon", "Ulfgar", "Veit", "Bruenor", "Fundin", "Grimm", "Hargin", "Korin"],
    nonbinary: ["Bruni", "Dagnal", "Gimli", "Hlin", "Kildrak", "Morgran", "Orsik", "Sannl", "Tordek", "Vistra", "Anvil", "Borin", "Cask", "Durm", "Ember", "Forge", "Granit", "Helm", "Iron", "Krag", "Lodin", "Marn", "Nori", "Onyx", "Rurik", "Stone", "Torq", "Urn", "Varr", "Yorin"],
    surnames:  ["Balderk", "Dankil", "Fireforge", "Frostbeard", "Holderhek", "Ironfist", "Loderr", "Rumnaheim", "Strakeln", "Torunn", "Ambermantle", "Anvilborn", "Barrelgut", "Bronzebeard", "Coalvein", "Deepdelver", "Goldfinder", "Granitehall", "Hammerfall", "Ironvein", "Kegshield", "Mithrilhand", "Orefinder", "Rockseam", "Runecask", "Silverpick", "Stonebrew", "Thundermug", "Underpick", "Warmforge"]
  },
  halfling: {
    female:    ["Andry", "Bree", "Callie", "Daphne", "Euphemia", "Jillian", "Kithri", "Lavinia", "Merla", "Seraphina", "Aster", "Belba", "Cora", "Della", "Essie", "Fenna", "Lidda", "Marigold", "Nedda", "Ollie", "Poppy", "Rosie", "Tansy", "Vani", "Wella", "Zia", "Pearl", "Minta", "Hattie", "Clem"],
    male:      ["Alton", "Cade", "Corrin", "Eldon", "Errich", "Finnan", "Garret", "Lyle", "Milo", "Perrin", "Ander", "Bramble", "Coby", "Dobb", "Evan", "Falken", "Gimble", "Hob", "Jory", "Kit", "Lenn", "Merric", "Ned", "Osborn", "Podo", "Reed", "Samo", "Tye", "Wellby", "Zook"],
    nonbinary: ["Beetle", "Clover", "Drift", "Moss", "Pip", "Robin", "Sunny", "Tumble", "Willow", "Yarrow", "Acorn", "Berry", "Cricket", "Dapple", "Fern", "Honey", "Kettle", "Mallow", "Nettle", "Pebble", "Quick", "Rill", "Sorrel", "Thimble", "Umber", "Velvet", "Wisp", "Yew", "Zest", "Bramble"],
    surnames:  ["Brushgather", "Goodbarrel", "Greenbottle", "High-hill", "Hilltopple", "Leagallow", "Tealeaf", "Thorngage", "Tosscobble", "Underbough", "Appleblossom", "Barleywhistle", "Berrybrook", "Copperkettle", "Dewfoot", "Fernwhistle", "Goldburrow", "Heatherhill", "Honeymead", "Littleleaf", "Meadowrush", "Mugwort", "Oatfield", "Puddlejump", "Reedbank", "Softstep", "Tangleberry", "Thistledown", "Willowbank", "Woodbarrel"]
  },
  gnome: {
    female:    ["Bimpnottin", "Caramip", "Donella", "Nissa", "Orla", "Roywyn", "Shamil", "Tana", "Waywocket", "Zanna", "Brella", "Duvamil", "Ellyjobell", "Fizzella", "Lilli", "Loopmottin", "Mardnab", "Nocket", "Oda", "Pell", "Rumpadump", "Tivvy", "Ulla", "Wrennibell", "Yebba", "Zookette", "Breezle", "Kippa", "Mimsy", "Tocka"],
    male:      ["Alston", "Boddynock", "Dimble", "Fonkin", "Jebeddo", "Namfoodle", "Roondar", "Seebo", "Warryn", "Zook", "Beren", "Dabble", "Erky", "Frug", "Gimlen", "Jink", "Kellen", "Murnig", "Nim", "Orbo", "Pock", "Quib", "Razzle", "Sindri", "Tink", "Umbo", "Wobble", "Yimble", "Zabble", "Fizzle"],
    nonbinary: ["Bix", "Dabble", "Fiz", "Glim", "Jinx", "Nim", "Puck", "Razz", "Tink", "Whistle", "Bop", "Cog", "Diz", "Fable", "Gadget", "Hush", "Ink", "Joggle", "Kip", "Lilt", "Mote", "Nudge", "Orbit", "Patter", "Quirk", "Rivet", "Spark", "Toggle", "Whim", "Zing"],
    surnames:  ["Beren", "Daergel", "Folkor", "Garrick", "Murnig", "Nackle", "Ningel", "Raulnor", "Scheppen", "Timbers", "Boltspinner", "Brassbutton", "Cogswallop", "Copperthumb", "Dewwhistle", "Fizzlebang", "Geargrin", "Jinglepocket", "Knackle", "Muddlewick", "Nibgear", "Pennyfarthing", "Quickwidget", "Rattletrap", "Sparklegem", "Tatterclock", "Togglewink", "Undergear", "Wobblecog", "Zappernick"]
  },
  dragonborn: {
    female:    ["Akra", "Biri", "Daar", "Farideh", "Harann", "Kava", "Mishann", "Nala", "Perra", "Surina", "Aasathra", "Bharash", "Darastrix", "Ghindra", "Irlym", "Jarixa", "Koritha", "Myrvassa", "Nysara", "Orlaeth", "Praxia", "Qelra", "Rhasha", "Sora", "Tazira", "Uadjit", "Vezra", "Wyrassa", "Yarith", "Zevra"],
    male:      ["Arjhan", "Balasar", "Donaar", "Ghesh", "Kriv", "Medrash", "Nadarr", "Pandjed", "Rhogar", "Torinn", "Azzakh", "Bharash", "Chedinn", "Draxan", "Ghavor", "Heskan", "Ildrex", "Jharvek", "Kezan", "Maelor", "Narik", "Orthos", "Patrin", "Qyzen", "Rogar", "Sarth", "Tarak", "Uren", "Vorugal", "Zorkan"],
    nonbinary: ["Arix", "Cindar", "Irij", "Korr", "Nym", "Rhaz", "Saar", "Taz", "Vyr", "Zor", "Asterax", "Bryx", "Cyr", "Drez", "Ezri", "Fyr", "Ghyr", "Ix", "Jazir", "Kez", "Laz", "Myx", "Nyrr", "Orrix", "Pyre", "Qiraz", "Ryx", "Syrix", "Tyrr", "Vex"],
    surnames:  ["Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion", "Fenkenkabradon", "Kepeshkmolik", "Kerrhylon", "Myastan", "Norixius", "Turnuroth", "Ardynax", "Bronzescale", "Cindergaze", "Dawnclaw", "Embercrest", "Flamebrow", "Goldenshard", "Ironscale", "Khaldrax", "Moltenwing", "Nightflame", "Onyxclaw", "Pyrestone", "Redmaw", "Stormfang", "Sunscale", "Thundershard", "Vermithrax", "Wardrake", "Zorquen"]
  },
  tiefling: {
    female:    ["Akta", "Bryseis", "Criella", "Damaia", "Ea", "Kallista", "Lerissa", "Orianna", "Phelaia", "Rieta", "Amaris", "Belladrix", "Cyrana", "Destra", "Evania", "Furia", "Hexa", "Ianthe", "Jezra", "Keziah", "Lilura", "Morria", "Nysera", "Ophelia", "Pyris", "Ravessa", "Selka", "Tempra", "Umbra", "Virelle"],
    male:      ["Akmenos", "Barakas", "Damakos", "Ekemon", "Iados", "Leucis", "Melech", "Mordai", "Skamos", "Therai", "Azael", "Balthus", "Cassiel", "Drakon", "Erebus", "Fenris", "Icaron", "Jareth", "Kallus", "Luceros", "Malach", "Nerezza", "Orpheon", "Pyrion", "Raziel", "Severin", "Tazren", "Umbriel", "Valek", "Xareth"],
    nonbinary: ["Azazel", "Cipher", "Echo", "Ire", "Kairo", "Myth", "Noct", "Onyx", "Rune", "Vesper", "Axiom", "Blight", "Cinder", "Dusk", "Ember", "Fable", "Gloam", "Hex", "Ivory", "Jinx", "Knell", "Lux", "Morrow", "Nox", "Oracle", "Pyre", "Riddle", "Shade", "Tempest", "Velour"],
    surnames:  ["Abyssborn", "Ashthorn", "Caligo", "Darkbloom", "Emberveil", "Hellstride", "Nightwhisper", "Rimebrand", "Shadowmire", "Zareth", "Blacksigil", "Brimstone", "Cinderveil", "Dreadmoor", "Ebonflare", "Fellroot", "Gloomwake", "Hushbrand", "Infernis", "Mistshroud", "Nethershade", "Palesmoke", "Ravenash", "Sablethorn", "Scarveil", "Shadefire", "Thornhex", "Umberbrand", "Vellichor", "Woecrest"]
  },
  half_elf: {
    female:    ["Adrie", "Belen", "Kara", "Lia", "Mara", "Neria", "Quelenna", "Rhea", "Sariel", "Tirra", "Arielle", "Brisa", "Celandine", "Delyra", "Elara", "Fiora", "Heli", "Ilyne", "Jessara", "Kaia", "Liora", "Maelin", "Nerise", "Oriana", "Phaela", "Roswyn", "Selka", "Talisa", "Vaela", "Wrenna"],
    male:      ["Calen", "Dorian", "Jareth", "Kael", "Lucan", "Niall", "Orrin", "Rolen", "Theron", "Varen", "Aren", "Bastian", "Corwin", "Daelen", "Emric", "Fenn", "Galen", "Hadrian", "Ilan", "Joren", "Kieran", "Leiran", "Marek", "Noren", "Orien", "Phaed", "Quint", "Renlo", "Sylas", "Tavian"],
    nonbinary: ["Ari", "Coren", "Ilan", "Joss", "Lumen", "Noren", "Quillan", "Rian", "Talin", "Vey", "Aven", "Briar", "Cael", "Dara", "Ellis", "Fable", "Gray", "Haven", "Indra", "Kier", "Lael", "Mica", "Nim", "Orin", "Pere", "Riven", "Sage", "Taren", "Vale", "Wyn"],
    surnames:  ["Dawnmere", "Evenwood", "Larkspur", "Moonsong", "Nightbrook", "Ravenhart", "Silverbough", "Thornfield", "Westfall", "Windmere", "Ambergrove", "Brightwater", "Cindervale", "Duskwillow", "Elmshade", "Fairbranch", "Glenmere", "Hollowmere", "Ironwillow", "Junebrook", "Mistral", "Oakenshade", "Palegrove", "Quickwater", "Riverthorn", "Starling", "Thistlemere", "Umberfield", "Valewood", "Whisperwind"]
  },
  half_orc: {
    female:    ["Baggi", "Emen", "Engong", "Myev", "Neega", "Ovak", "Ownka", "Shautha", "Sutha", "Volen", "Arha", "Brakka", "Druga", "Gorga", "Huru", "Imra", "Kansif", "Lagga", "Mogga", "Narka", "Orgra", "Pruma", "Renga", "Shura", "Torga", "Urga", "Vrakka", "Wuma", "Yagra", "Zagga"],
    male:      ["Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk", "Mhurren", "Ront", "Arnak", "Brug", "Durg", "Gnarsh", "Harg", "Jurk", "Karg", "Mog", "Nurr", "Org", "Ragor", "Shump", "Thokk", "Urgash", "Vor", "Warg", "Yurk", "Zog", "Drakk", "Grom"],
    nonbinary: ["Ashg", "Brak", "Drosh", "Grim", "Karg", "Morg", "Nug", "Rag", "Thok", "Urz", "Ark", "Brog", "Crag", "Dusk", "Ghor", "Hush", "Irk", "Jagg", "Kriv", "Lug", "Murk", "Nash", "Onk", "Rukk", "Snag", "Torg", "Urg", "Vrok", "Wrog", "Zrak"],
    surnames:  ["Bonefist", "Crowtusk", "Doomhammer", "Grimscar", "Ironjaw", "Ragetide", "Skullbreaker", "Stonehide", "Thornmaw", "Warbrand", "Ashmaw", "Battlehide", "Blacktooth", "Bloodtusk", "Cragfist", "Deadeye", "Fellmaw", "Gorehide", "Hardtusk", "Keenaxe", "Mudscar", "Redfang", "Roughmaul", "Shardtusk", "Skyrend", "Stonejaw", "Thunderfist", "Warhide", "Windmaw", "Wolfscar"]
  }
};
