import { recipe } from '../detail-helpers-v1.js';
const vegetables='Lentil stew|Barley and mushroom casserole|Roasted root vegetables|Bean and onion broth|Cabbage rolls|Herbed chickpea cakes|Baked squash|Pea soup|Spiced potato cakes|Mushroom pie|Braised leeks|Walnut and bean patties';
const meat='Chicken pot pie|Mutton stew|Roast pork|Beef and barley soup|Duck in plum sauce|Venison broth|Rabbit casserole|Sausage and cabbage|Braised goat|Chicken and leeks|Pork and apple pie|Lamb and bean casserole';
const fish='Baked fish|Fish chowder|Pan-fried fish|Fish cakes|Smoked fish pie|Poached fish|Fish and leek casserole|Fish skewers|Fish broth|Herbed fish parcels|Fish and potato bake|Pickled fish platter';
const sides='rye bread|pickled carrots|herb flatbread|roasted onions|cabbage salad|oat crackers|stewed apples|mashed turnips|spiced lentils|braised greens';
const tea='Mint infusion|Rosehip tea|Chamomile tea|Black tea|Green tea|Jasmine tea|Roasted barley tea|Hibiscus tea|Lemon balm tea|Spiced tea';
const snacks='sesame biscuits|almond cakes|honey buns|oat crackers|plum pastries|fruit slices|rice cakes|walnut cookies|seed rolls|small sandwiches';
export const menuSources={
  meals:recipe(`${vegetables}|${meat}`,sides,', served with '),
  vegetarianMeals:recipe(vegetables,sides,', served with '),
  waterMeals:recipe(fish,sides,', served with '),
  teaMeals:recipe(tea,snacks,', served with ')
};
const roomTypes={
  modest:'a straw mattress in a shared loft|a curtained pallet by the stairs|a narrow bed in a shared room|a bunk above the kitchen|a pallet in the common sleeping room|a bed beside a shuttered window|a curtained bunk in the rear loft|a mattress beside the chimney wall|a small bed beneath the rafters|a pallet in a side chamber',
  comfortable:'a private room with a wool mattress|a twin room with a writing desk|a quiet chamber facing the courtyard|a private room with a tiled stove|a furnished room above the hall|a corner room with a washstand|a twin chamber with a lockable chest|a room beside the covered gallery|a private chamber with a reading lamp|a rear room with a cushioned bench',
  wealthy:'a suite with a separate sitting room|a chamber with a feather bed|a suite with a private dining alcove|a furnished chamber with a bathing tub|a suite with an attendant’s room|a guest apartment with a screened gallery|a chamber with embroidered bed curtains|a suite with a stocked writing cabinet|a private apartment with a tiled fireplace|a guest suite with a dressing room'
};
const policies='Luggage can be left with the keeper.|Extra blankets are available on request.|Breakfast can be arranged when booking.|The keeper explains access at check-in.|Wet clothes can be left to dry.|Guests are asked to keep quiet after supper.|Wake-up knocks are available.|Long stays can be arranged in advance.|Visitors should give their expected arrival time.|Travelers can ask about space for their packs.';
export const lodgingSources=Object.fromEntries(Object.entries(roomTypes).map(([wealth,values])=>[`lodging_${wealth}`,recipe(values.split('|').map(v=>`Guests can book ${v}.`),policies)]));
const guestsBySettlement={
  hamlet:'A passing carrier|A seed seller|A visiting cousin|A traveling potter|A farmhand|A wandering musician|A livestock buyer|A tool mender|A wool buyer|A letter carrier',
  village:'A farm steward|A seed merchant|A visiting carrier|A traveling cooper|A herder|A market gardener|A pilgrim|A wool buyer|A visiting relative|A journeyman carpenter',
  town:'A market gardener|A merchant’s clerk|A traveling potter|A visiting courier|A guild apprentice|A wool buyer|A schoolteacher|A traveling musician|A bookbinder|A farm steward',
  city:'A visiting merchant|A district clerk|A theater musician|A guild apprentice|A bookseller|A letter carrier|A surveyor|A traveling cook|A student|A portrait painter',
  metropolis:'A merchant-house clerk|A visiting scholar|A theater performer|A guild delegate|A collector|An interpreter|A traveling tutor|A regional factor|A visiting envoy|A bookbinder',
  port:'A ship’s cook|A visiting sailor|A harbor factor|A sailmaker|A pilot’s apprentice|A fish buyer|A ferry keeper|A rope merchant|A cargo clerk|A visiting boatbuilder',
  mining_outpost:'An ore carrier|A mine carpenter|An assayer|A tool seller|A shaft surveyor|A supply factor|A camp cook|A watch messenger|A wagon driver|A lamp mender',
  forest_hold:'A forester|A timber buyer|An herb gatherer|A trail keeper|A woodcarver|A charcoal burner|A forest warden|A traveling basketmaker|A garden steward|A visiting carrier',
  farming_village:'A grain buyer|A harvest worker|An orchard keeper|A dairy farmer|A seed seller|A miller|A farm tenant|A market carrier|A village cook|A herder',
  fortress:'A watch messenger|A quartermaster’s clerk|An armor mender|A garrison cook|A supply carrier|A gate warden|A visiting engineer|A stable hand|A caravan guard|A tool seller',
  monastery:'A pilgrim|A visiting copyist|A garden keeper|A scholar|An estate clerk|A guesthouse steward|A traveling healer|A manuscript restorer|A letter carrier|A hymn collector',
  academy:'A student|A visiting tutor|A researcher|A laboratory assistant|A copyist|A visiting scholar|An instrument maker|A librarian|An academy steward|A map seller',
  caravan_stop:'A caravan cook|A pack handler|A traveling trader|A courier|A wagon keeper|A guide|A supply factor|A passing pilgrim|A harness mender|A caravan guard',
  undercity:'A tunnel warden|A lamp keeper|A stone carrier|A ventilation worker|A surveyor|A supply factor|A market seller|A courier|A cistern keeper|A visiting toolmaker'
};
const guestBusiness={
  tavern:'is asking about supper.|is looking for a bed for the night.|is warming up over a drink.|is arranging an early breakfast.|is waiting for a traveling companion.|is asking when the kitchen closes.|is choosing provisions for tomorrow’s journey.|is finding a table away from the door.|is asking about an overnight stay.|is listening for news from other travelers.',
  boarding_house:'is asking about a weekly room.|is arranging a longer stay.|is checking when breakfast is served.|is looking for a quiet room.|is asking where to leave a traveling chest.|is arranging a morning departure.|is asking about shared meals.|is looking for lodging near work.|is checking which rooms are available.|is leaving a message for another lodger.',
  cookshop:'is choosing a hot meal.|is collecting a packed lunch.|is asking about vegetarian dishes.|is buying supper to take home.|is waiting for a fresh batch.|is comparing the dishes on offer.|is arranging food for a small group.|is asking when the next meal is ready.|is buying provisions for a journey.|is choosing a portion to share.',
  teahouse:'is choosing a pot of tea.|is asking about herbal infusions.|is sharing a plate of cakes.|is waiting for a friend over tea.|is asking for a quiet table.|is comparing the teas on offer.|is choosing a small snack.|is asking for a second cup.|is arranging a small tea gathering.|is buying refreshments for a companion.'
};
export const guestSources=Object.fromEntries(Object.entries(guestsBySettlement).map(([settlement,roles])=>[settlement,Object.fromEntries(Object.entries(guestBusiness).map(([kind,actions])=>[kind,recipe(roles,actions)]))]));
export function hospitalitySources(context) {
  const type=Object.hasOwn(guestBusiness,context.type)?context.type:'tavern';
  return {...menuSources,...lodgingSources,guests:(guestSources[context.settlementType] || guestSources.town)[type]};
}
