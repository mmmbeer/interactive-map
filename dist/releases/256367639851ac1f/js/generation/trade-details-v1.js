import { words } from './helpers-v2.js';
import { recipe } from './detail-helpers-v1.js';

// Specific wares, not unrelated nouns selected from a city-wide inventory.
const wares = {
  shop:'lamp oil|rope|soap|needles|blankets|water flasks|travel rations|cooking pots|candles|salt',
  chandler:'beeswax tapers|tallow candles|lamp wicks|lantern oil|rushlights|votive candles|wax seals|candle snuffers|candle molds|hanging lamps',
  haberdasher:'bone buttons|silk ribbons|wool thread|linen thread|brass buckles|felt hat bands|embroidered cuffs|lace edging|thimbles|sewing needles',
  grocer:'dried apples|lentils|onions|oats|carrots|turnips|cabbages|dried beans|pears|walnuts',
  bookseller:'travel journals|herbals|local histories|poetry collections|tide almanacs|language primers|merchant ledgers|copied plays|star charts|family genealogies',
  fishmonger:'smoked trout|salted herring|pickled eel|dried cod|smoked perch|salted mackerel|pickled mussels|dried whitefish|smoked carp|salted sardines',
  spice_seller:'black pepper|cinnamon bark|cloves|cumin seed|coriander seed|dried ginger|saffron|nutmeg|allspice|cardamom',
  pawnbroker:'secondhand watches|used lanterns|copper kettles|silver rings|travel trunks|old viols|brass scales|wool coats|carved chess sets|engraved goblets',
  wine_merchant:'dry red wine|pear wine|apple wine|honey wine|sweet white wine|plum wine|cherry wine|spiced wine|blackberry wine|elderflower wine',
  outfitter:'waxed packs|bedrolls|walking poles|tinderboxes|camp kettles|tent pegs|travel cloaks|rope coils|water skins|compass cases',
  stationer:'rag paper|parchment sheets|black ink|red ink|quill pens|sealing wax|blank ledgers|sand shakers|document tubes|writing slates',
  cheesemonger:'aged cheddar|fresh curds|goat cheese|sheep cheese|smoked cheese|soft cheese|hard grating cheese|salted butter|washed-rind cheese|herbed cheese',
  tailor:'linen shirts|wool cloaks|travel coats|work aprons|silk scarves|embroidered vests|winter gloves|felt caps|patched trousers|ceremonial sashes',
  jeweler:'silver rings|copper bracelets|amber pendants|glass-bead necklaces|gold earrings|agate brooches|carved cameos|pearl pins|jet lockets|enamel clasps',
  apothecary:'herbal soap|lavender sachets|dried mint|beeswax balm|rosewater|juniper oil|chamomile tea|linen bandages|empty tincture bottles|herb drying racks',
  arcane:'blank scrolls|chalk sticks|ritual candles|copper wire|crystal lenses|ink powders|empty component pouches|star charts|protective cases|copied ritual notes',
  bakery:'rye loaves|oatcakes|seed rolls|apple tarts|honey buns|barley biscuits|onion bread|plum pastries|walnut cakes|flatbread',
  workshop:'tool handles|brackets|hinges|clamps|pegs|wedges|replacement fittings|work benches|storage boxes|measuring rods',
  blacksmith:'iron hinges|horseshoes|nails|chisels|axe heads|door latches|pot hooks|chain links|iron rivets|shovel blades',
  fletcher:'ash arrows|target arrows|hunting arrows|bowstrings|arrow shafts|feather fletching|quivers|bow cases|string wax|practice bows',
  woodcarver:'carved signs|wooden spoons|toy animals|decorative panels|walking sticks|chess pieces|wooden bowls|picture frames|carved buttons|spindle whorls',
  shoemaker:'walking boots|work shoes|soft slippers|leather sandals|replacement soles|boot laces|riding boots|felt insoles|shoe buckles|children’s shoes',
  tinker:'mended pans|copper patches|tin cups|kettle handles|small rivets|pot lids|lantern fittings|bucket handles|wire strainers|repair clips',
  stonemason:'cut flagstones|stone lintels|carved plaques|boundary stones|doorsteps|millstone blanks|stone troughs|column bases|drain covers|memorial tablets',
  glassworker:'clear bottles|colored beads|window panes|ink vials|glass cups|lamp chimneys|glass bowls|lens blanks|perfume flasks|decorative tiles',
  sailmaker:'canvas panels|storm sails|reefing lines|sail needles|waxed thread|canvas covers|hammocks|awnings|sail bags|reinforcing patches',
  potter:'cooking pots|glazed bowls|storage jars|water jugs|oil lamps|roof tiles|ink pots|flower pots|clay cups|serving platters',
  locksmith:'warded locks|spare keys|door bolts|chest locks|shutter catches|padlocks|lock plates|key blanks|spring latches|cabinet locks',
  carpenter:'pine shelves|oak stools|window frames|door panels|storage chests|table legs|tool boxes|wooden shutters|bed frames|bench tops',
  cooper:'water barrels|wine casks|pickling tubs|grain buckets|butter churns|wooden hoops|replacement staves|cask bungs|wash tubs|storage kegs',
  silversmith:'silver spoons|engraved cups|silver clasps|candlesticks|salt cellars|filigree pins|serving tongs|silver chains|seal handles|decorative mounts'
};
const terms = 'Collected from the counter.|Reserved by written order.|Wrapped for travel.|Packed in returnable containers.|Listed with the maker’s mark.|Available in small quantities.|Inspected before collection.|Supplied with a receipt.|Set aside for regular customers.|Delivered within the district.|Shown on the sample shelf.|Ordered through the ledger.';
export const stockSources = Object.fromEntries(Object.entries(wares).map(([key,items]) => [key,recipe(words(items).map(s=>`${s[0].toUpperCase()+s.slice(1)}.`),terms)]));
