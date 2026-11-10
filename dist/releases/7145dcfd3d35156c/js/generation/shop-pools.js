// Adapted from mmmbeer/shoppe naming pools. Generation uses local seeded streams.
// Shop name word lists for the frontend.
// Names are built as "The {adjective} {noun}" using the pools below.
// Edit this file freely — no other files need to change.

// Adjective pool shared across all shop types.
export const ADJECTIVES = [
  "Ancient", "Amber", "Ashen", "Black", "Brass", "Bright", "Bronze",
  "Burnished", "Cobalt", "Copper", "Crimson", "Crooked", "Curious",
  "Dark", "Dusty", "Emerald", "Faded", "Forgotten", "Gilded", "Golden",
  "Grey", "Hidden", "Hollow", "Humble", "Iron", "Ivory", "Jade",
  "Lucky", "Midnight", "Mossy", "Obsidian", "Old", "Pale",
  "Red", "Rusty", "Sable", "Scarlet", "Silver", "Smoky",
  "Tin", "Tarnished", "Twisted", "Wandering", "Worn",

  "Arcane", "Autumn", "Baleful", "Beaming", "Bleak", "Blessed", "Blue",
  "Bold", "Bone", "Briar", "Brimstone", "Broken", "Brown", "Cedar",
  "Celestial", "Charred", "Checkered", "Clear", "Clouded", "Coiled",
  "Cold", "Common", "Coral", "Crescent", "Dancing", "Dappled", "Dawn",
  "Deep", "Delicate", "Dim", "Distant", "Drifting", "Dusken", "Ebon",
  "Elder", "Enchanted", "Evening", "Fair", "Fierce", "Fine", "Flint",
  "Flowing", "Foxed", "Frozen", "Gentle", "Glass", "Glittering", "Green",
  "Grim", "Hammered", "Hearthbound", "Heavy", "Honeyed", "Horned", "Icy",
  "Ink", "Jolly", "Keen", "Lapis", "Last", "Lavender", "Lean",
  "Lonesome", "Long", "Low", "Luminous", "Marble", "Merry", "Misty",
  "Moonlit", "Muted", "Narrow", "Night", "Oak", "Odd", "Onyx",
  "Patient", "Peregrine", "Pewter", "Pious", "Polished", "Quiet", "Ragged",
  "Rapid", "Raven", "Royal", "Runed", "Sacred", "Shadowed", "Shining",
  "Silent", "Slate", "Snowy", "Solemn", "Spirit", "Stalwart", "Storm",
  "Summer", "Sunken", "Verdant", "Violet", "Weathered"
];

// Noun pools keyed by shop type. Falls back to "generic" if the type is unknown.
export const NOUNS = {
  general_store: [
    "Barrel", "Basket", "Bolt", "Bundle", "Candle", "Cart", "Cask", "Chest", "Coin", "Counter",
    "Crate", "Crossroads", "Cupboard", "Hook", "Jar", "Kettle", "Key", "Lantern", "Ledger", "Pack",
    "Pail", "Parcel", "Post", "Sack", "Satchel", "Scale", "Shelf", "Stall", "Stock", "Tin",
    "Token", "Trinket", "Wagon", "Ware"
  ],

  blacksmith: [
    "Anvil", "Ash", "Bellows", "Brand", "Chain", "Clinker", "Coal", "Ember", "Fire", "Flame",
    "Forge", "Hammer", "Hardy", "Hearth", "Ingot", "Iron", "Nail", "Ore", "Quench", "Rivet",
    "Soot", "Spark", "Steel", "Striker", "Tongs", "Vice"
  ],

  fletcher: [
    "Arrow", "Barb", "Bow", "Bowstring", "Feather", "Fletch", "Fletcher", "Flight", "Nock", "Point",
    "Quarrel", "Quiver", "Reed", "Shaft", "Spine", "Stave", "String", "Target", "Tip", "Yew"
  ],

  weapon: [
    "Axe", "Blade", "Crossguard", "Dagger", "Edge", "Glaive", "Hilt", "Knife", "Lance", "Longsword",
    "Mace", "Pike", "Point", "Pommel", "Saber", "Spear", "Spike", "Steel", "Sword", "Warhammer"
  ],

  armor: [
    "Bascinet", "Buckler", "Cuirass", "Gauntlet", "Gorget", "Greave", "Hauberk", "Helm", "Mail", "Mantlet",
    "Pauldron", "Plate", "Rondel", "Sabaton", "Shield", "Tasset", "Vambrace", "Visor", "Ward", "Aegis"
  ],

  tailor: [
    "Bolt", "Brocade", "Clasp", "Cloak", "Cord", "Cotton", "Dress", "Fold", "Hem", "Lace",
    "Linen", "Loom", "Mantle", "Needle", "Ribbon", "Sash", "Seam", "Shears", "Silk", "Spool",
    "Stitch", "Thread", "Velvet", "Weave", "Wool"
  ],

  jeweler: [
    "Amber", "Amethyst", "Band", "Brooch", "Crown", "Diamond", "Emerald", "Filigree", "Gem", "Gold",
    "Jade", "Jet", "Necklace", "Opal", "Pearl", "Pendant", "Ring", "Ruby", "Sapphire", "Silver",
    "Tiara", "Topaz", "Tourmaline"
  ],

  potion_shop: [
    "Alembic", "Balm", "Brew", "Cauldron", "Decoction", "Distillate", "Draft", "Draught", "Elixir", "Essence",
    "Extract", "Flask", "Herb", "Infusion", "Mortar", "Phial", "Poultice", "Salve", "Serum", "Still",
    "Tincture", "Tonic", "Vapor", "Vial"
  ],

  arcane: [
    "Archive", "Charm", "Codex", "Conduit", "Crystal", "Glyph", "Grimoire", "Hex", "Idol", "Incantation",
    "Mirror", "Nimbus", "Orb", "Prism", "Relic", "Rune", "Scroll", "Seal", "Sigil", "Spellbook",
    "Star", "Tome", "Tower", "Ward", "Wand"
  ],

  temple: [
    "Altar", "Blessing", "Candle", "Canticle", "Chalice", "Chapel", "Choir", "Devotion", "Grace", "Hymn",
    "Icon", "Incense", "Lamp", "Litany", "Mercy", "Prayer", "Relic", "Sanctum", "Sermon", "Shrine",
    "Temple", "Vestment", "Vigil"
  ],

  inn: [
    "Ale", "Barrel", "Bed", "Blanket", "Cask", "Cup", "Fire", "Flagon", "Foam", "Hall",
    "Hearth", "Kettle", "Loaf", "Mug", "Pillow", "Roof", "Room", "Sign", "Stew", "Stool",
    "Tankard", "Table", "Tap", "Tavern"
  ],

  adventurers_guild: [
    "Badge", "Banner", "Charter", "Compass", "Contract", "Crest", "Dispatch", "Honor", "Journey", "Lantern",
    "Map", "Medal", "Oath", "Path", "Quest", "Register", "Roster", "Seal", "Standard", "Summons",
    "Task", "Token", "Trail", "Venture"
  ],

  thieves_guild: [
    "Coin", "Cloak", "Dagger", "Hook", "Key", "Knife", "Lantern", "Lock", "Mask", "Night",
    "Purse", "Rook", "Scrawl", "Shadow", "Shroud", "Sign", "Smoke", "Veil", "Whisper", "Wire"
  ],

  generic: [
    "Arch", "Barrel", "Bell", "Box", "Chest", "Coin", "Corner", "Crossroads", "Door", "Gate",
    "Hook", "Key", "Lantern", "Market", "Post", "Road", "Row", "Sack", "Shelf", "Sign",
    "Square", "Step", "Stone", "Token", "Trinket", "Way"
  ]
};
