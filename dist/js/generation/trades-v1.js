// Everyday trades retained from the original map as compact type identifiers.
const shop=(label,nouns,services)=>({category:'shop',label,nouns,roles:[label,'shopkeeper','merchant'],services});
const craft=(label,nouns,services)=>({category:'workshop',label,nouns,roles:[label,'journeyman','artisan'],services});
export const trades = {
  chandler:shop('chandler',['Candle','Wick','Lantern','Tallow','Flame'],['beeswax candles','lamp oil','fresh wicks']),
  haberdasher:shop('haberdasher',['Button','Ribbon','Needle','Thread','Velvet'],['buttons and ribbons','sewing supplies','hat trimmings']),
  grocer:shop('grocer',['Basket','Apple','Sack','Scale','Turnip'],['seasonal produce','dried fruit','household provisions']),
  bookseller:shop('bookseller',['Page','Quill','Tome','Bookmark','Folio'],['used books','travel journals','rare editions']),
  fishmonger:shop('fishmonger',['Net','Herring','Trout','Basket','Cod'],['fresh fish','smoked eel','salted herring']),
  spice_seller:shop('spice seller',['Clove','Pepper','Saffron','Mortar','Cinnamon'],['spices by weight','dried herbs','blended seasonings']),
  pawnbroker:shop('pawnbroker',['Coin','Scale','Key','Ledger','Ring'],['short-term loans','secondhand goods','valuations']),
  wine_merchant:shop('wine merchant',['Vine','Cask','Grape','Goblet','Cellar'],['local wines','imported vintages','bottles for celebrations']),
  outfitter:shop('outfitter',['Pack','Compass','Boot','Tent','Trail'],['travel gear','waterproof packs','camp supplies']),
  stationer:shop('stationer',['Quill','Ink','Seal','Page','Vellum'],['paper and ink','sealing wax','writing supplies']),
  cheesemonger:shop('cheesemonger',['Wheel','Rind','Curd','Crock','Dairy'],['aged cheeses','fresh curds','salted butter']),
  woodcarver:craft('woodcarver',['Chisel','Oak','Grain','Leaf','Mallet'],['carved signs','wooden figures','decorative panels']),
  shoemaker:craft('shoemaker',['Boot','Heel','Last','Leather','Sole'],['boot repairs','made-to-measure shoes','replacement soles']),
  tinker:craft('tinker',['Kettle','Rivet','Tin','Gear','Pan'],['small repairs','mended cookware','replacement fittings']),
  stonemason:craft('stonemason',['Stone','Chisel','Arch','Granite','Column'],['cut stone','inscribed memorials','masonry repairs']),
  glassworker:craft('glassworker',['Glass','Prism','Vial','Furnace','Lens'],['window glass','bottles','colored glassware']),
  sailmaker:craft('sailmaker',['Sail','Needle','Canvas','Mast','Gull'],['new sails','canvas repairs','weatherproof covers']),
  potter:craft('potter',['Kiln','Clay','Glaze','Jug','Bowl'],['cooking pots','glazed dishes','storage jars']),
  locksmith:craft('locksmith',['Key','Lock','Latch','Bolt','Tumbler'],['new locks','spare keys','repaired mechanisms']),
  carpenter:craft('carpenter',['Plane','Oak','Beam','Bench','Saw'],['furniture repairs','new doors','fitted shelves']),
  cooper:craft('cooper',['Cask','Hoop','Stave','Barrel','Mallet'],['watertight barrels','cask repairs','storage tubs']),
  silversmith:craft('silversmith',['Silver','Chalice','Ring','Hammer','Filigree'],['silverwork','engraved gifts','repaired tableware'])
};
