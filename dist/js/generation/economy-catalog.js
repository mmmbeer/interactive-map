import { roots } from './wordbanks-v2.js';
import { types as oldTypes } from './catalog-v1.js';
import { stockItems } from './stock-items-v2.js';
import { newTrades, existingIndustries } from './economy-trades.js';
import { industries } from './economy-industries.js';
import { bank, title } from './helpers-v2.js';
import { recipe } from './detail-helpers-v1.js';
export { industries };
const ranks='apprentice|journeyman|master|resident|independent|traveling|senior|assistant|district|guild-trained'.split('|');
const duties='practitioner|order keeper|sample keeper|instructor|supplier|repair specialist|commission agent|estimator|inspector|workshop steward'.split('|');
const services='orders for|estimates for|appointments about|collections of|deliveries of|reservations for|enquiries about|sample requests for|scheduled work on|commissions for'.split('|');
export const economyTypes=Object.fromEntries(Object.entries(newTrades).map(([key,t])=>[key,{
  category:t.category,label:t.label,
  nouns:bank(roots.map(root=>`${root} ${title(t.label)}`),`${key} names`),
  roles:bank(ranks.flatMap(a=>duties.map(b=>`${a} ${t.role} and ${b}`)),`${key} occupations`),
  services:recipe(services,t.items)
}]));
const inputs = {
  miller:'grain|cloth sacks|millstone blanks',seed_merchant:'seed stock|paper packets|cloth sacks',beekeeper:'hive frames|woven skeps|storage jars',herder:'fleece|shearing tools|binding cord',orchardist:'fruit|grafting cuttings|woven baskets',market_gardener:'vegetables|seed stock|woven baskets',
  brewer:'grain|hops|casks',distiller:'fruit|grain|glass bottles',butcher:'livestock|salt|wrapping cloth',preserver:'vegetables|fruit|salt',confectioner:'honey|nuts|sugar',tea_merchant:'tea leaves|herbs|paper packets',oil_presser:'oilseed|nuts|storage jars',
  weaver:'yarn|wooden bobbins|weaving reeds',dyer:'dye plants|undyed cloth|mordants',spinner:'wool|flax|hemp fiber',embroiderer:'linen thread|silk thread|cloth',feltmaker:'wool|soap|clean water',ropemaker:'hemp fiber|flax|binding cord',
  tanner:'hides|bark|lime',leatherworker:'tanned hides|waxed cord|rivets',saddler:'tanned hides|brass buckles|felt lining',furrier:'pelts|linen thread|cloth lining',
  basketmaker:'willow rods|reed bundles|rushes',wheelwright:'seasoned timber|iron tires|wooden pegs',cartwright:'timber|iron fittings|axle grease',cabinetmaker:'seasoned timber|hide glue|brass fittings',luthier:'tonewood|gut strings|hide glue',charcoal_burner:'timber|clay|packing sacks',woodturner:'turning blanks|linseed oil|wax polish',
  armorer:'iron bars|steel plates|leather straps',bladesmith:'steel bars|charcoal|quenching oil',coppersmith:'copper sheets|rivets|tin',pewterer:'tin ingots|copper ingots|casting molds',bellfounder:'copper ingots|tin ingots|clay molds',toolmaker:'steel bars|timber handles|charcoal',clockmaker:'brass blanks|steel wire|clock weights',
  gemcutter:'uncut gems|abrasive grit|polishing cloth',slater:'slate|cutting tools|packing straw',brickmaker:'clay|sand|fuel',limeburner:'limestone|fuel|clean water',tilemaker:'clay|glaze minerals|fuel',glazier:'glass panes|lead cames|window putty',lensmaker:'optical blanks|polishing grit|lens mounts',mirror_maker:'glass plates|polishing grit|metal backing',
  shipwright:'timber|iron nails|oakum',boatbuilder:'timber|pitch|copper fasteners',netmaker:'linen twine|net floats|net sinkers',ship_chandler:'rope|canvas|lamp oil',chartmaker:'paper|ink|pilot notes',freight_broker:'carrier schedules|paper|sealing wax',stablekeeper:'fodder|bedding straw|leather tack',courier:'paper|sealing wax|document pouches',caravan_outfitter:'canvas|leather straps|wagon timber',
  bookbinder:'binding thread|leather|wooden boards',papermaker:'linen rags|hemp fiber|clean water',scribe:'paper|ink|quills',illuminator:'pigments|gold leaf|parchment',notary:'paper|ink|sealing wax',cartographer:'survey notes|paper|ink',translator:'reference texts|paper|ink',tutor:'slates|chalk|reference books',surveyor:'measuring cord|wooden rulers|paper',
  alchemist:'reagent salts|glass vials|charcoal',enchanter:'silver wire|ritual chalk|vellum',component_merchant:'quartz|resin|silk pouches',wandmaker:'wand blanks|silver ferrules|focus settings',herbalist:'herbs|paper packets|storage jars',healer:'linen|soap|clean water',soapmaker:'oil|lye|herbs',perfumer:'flowers|oil|glass bottles',
  cookshop:'grain|vegetables|herbs',teahouse:'tea leaves|honey|flour',boarding_house:'linen|soap|firewood',bathkeeper:'soap|linen|clean water',painter:'pigments|linen|varnish',sculptor:'stone|clay|abrasive grit',toymaker:'timber|cloth|paint',map_engraver:'metal plates|ink|paper',
  provisioner:'grain|oil|salt',moneychanger:'coin weights|currency tables|paper',auctioneer:'consignment records|paper|lot labels',reclaimer:'salvaged timber|scrap iron|reusable glass',lamplighter:'lamp oil|wicks|lamp glass',wellkeeper:'rope|bucket staves|pump fittings',undertaker:'linen|timber|paper',
  blacksmith:'iron bars|charcoal|quenching oil',tailor:'cloth|linen thread|buttons',jeweler:'uncut gems|silver wire|gold leaf',apothecary:'herbs|oil|glass jars',arcane:'ritual chalk|vellum|resin',fletcher:'arrow shafts|feathers|bowstring fiber',bakery:'flour|yeast|salt',
  chandler:'beeswax|tallow|wicks',haberdasher:'buttons|thread|ribbon',grocer:'vegetables|fruit|grain',bookseller:'bound books|paper|packing cloth',fishmonger:'fish|salt|clean water',spice_seller:'spices|paper packets|storage jars',pawnbroker:'consigned goods|paper|sealing wax',wine_merchant:'wine|casks|glass bottles',outfitter:'canvas|rope|leather',stationer:'paper|ink|sealing wax',cheesemonger:'cheese|wrapping cloth|storage jars',
  woodcarver:'carving blanks|linseed oil|wax polish',shoemaker:'sole leather|linen thread|buckles',tinker:'scrap copper|tin sheets|rivets',stonemason:'stone blocks|abrasive grit|lime',glassworker:'sand|potash|glass cullet',sailmaker:'canvas|linen thread|rope',potter:'clay|glaze minerals|fuel',locksmith:'iron bars|brass blanks|steel springs',carpenter:'timber|iron nails|hide glue',cooper:'staves|iron hoops|wooden bungs',silversmith:'silver|copper|polishing grit'
};
export const tradeCatalog = {
  ...Object.fromEntries(Object.entries(existingIndustries).map(([id,industry])=>[id,{...oldTypes[id],industry,role:oldTypes[id].roles[0],items:stockItems[id]}])),
  ...newTrades
};
for (const [id,t] of Object.entries(tradeCatalog)) {t.id=id;t.materials=inputs[id].split('|');}
const orderTerms='A written order reserves this.|The ledger gives the collection date.|A sample can be reviewed first.|A repeat order cites the prior record.|A receipt accompanies collection.|The customer confirms the specification.|The order can be split into installments.|The keeper records the quantity.|Delivery terms are agreed in advance.|The current estimate is on file.';
export const tradeStockRecipes=Object.fromEntries(Object.entries(tradeCatalog).map(([id,t])=>[`stock_${id}`,recipe(t.items.map(v=>`${v[0].toUpperCase()+v.slice(1)}.`),orderTerms)]));
const obligations='The result goes in the order ledger.|The customer must approve a sample.|The estimate awaits a signature.|The work is due on the next market day.|The dimensions must match the earlier record.|A second copy is needed for the buyer.|The delivery needs a witnessed tally.|The keeper retains the reference notes.|The quantity is confirmed before work starts.|The customer will check the finished work.';
export const industryRecipes=Object.fromEntries(Object.entries(industries).map(([id,p])=>[id,{
  tasks:recipe(p.tasks.map(v=>`The current task is to ${v}.`),obligations),
  demand:recipe('An enquiry from {customer} concerns {product}.|An order from {customer} calls for {product}.|The request from {customer} is for {product}.|An estimate for {customer} covers {product}.|The current commission for {customer} concerns {product}.|A request for {product} has come from {customer}.|The order for {customer} includes {product}.|There is an enquiry about {product} from {customer}.|Work for {customer} concerns {product}.|The latest request from {customer} specifies {product}.',obligations)
}]));
export const economyTokens='industry trade tradeRole product material customer workTask supplyRoute settlementType tradition budgetNote livelihoodNote tradeLinksNote craftTraditionNote'.split(' ');
