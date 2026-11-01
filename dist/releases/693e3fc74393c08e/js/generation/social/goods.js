// Product-level compatibility refines broad industry links. A food business may
// order a pot hook or door hinge from a smith, not an unexplained racing horseshoe.
const catalogCache=new Map(),buyerCache=new WeakMap();
function tagsFor(item,trade) {
  const text=item.toLowerCase(),tags=[];
  if(/horseshoe|saddle|bridle|stirrup|harness|wagon|axle|cart wheel|remount/.test(text))return ['transport'];
  if(/sword|dagger|spear|arrow|crossbow|quiver|bowstring|longbow|armor|armour|gauntlet|breastplate|helmet|mail shirt|mail coif|vambrace|greave/.test(text))return ['weapons'];
  if(/ritual|ward inscription|sigil|spell|attunement|rune|charm housing|component pouch|focus setting|crystal tip| wand/.test(text) || trade.industry==='arcane')return ['arcane'];
  if(/chart|tide table|soundings|pilot book|channel diagram|anchorage|sounding line/.test(text))return ['navigation'];
  if(/lens|prism|spectacle|optical/.test(text))return ['optics'];
  if(/sail|rigging|anchor cable|mooring|net float|net sinker|casting net|seine net|eel trap|crab pot|hull|keel|ship rib|rudder|mast step|deck beam|boat knee|oar|paddle/.test(text))return ['maritime'];
  if(/nail|hinge|latch|door|roof|window|lintel|flagstone|brick|drain|tile|column|shutter|plank|beam|joist/.test(text))tags.push('structural');
  if(/barrel|cask|bucket|keg|tub|jar|bottle|vial|flask|bowl|jug|cup|plate|pot hook|kettle|cauldron|basin|basket|hamper|crate/.test(text))tags.push('containers');
  if(/cloak|shirt|cap|glove|shoe|boot|hat|scarf|apron|linen|cloth|thread|ribbon|blanket|felt|button|wool|fleece|flax|hemp fiber/.test(text))tags.push('clothing');
  if(/paper|ink|quill|ledger|book|folio|journal|letter|translation|transcript|charter|contract|certificate|notary|deed|petition|proof sheet|seal/.test(text))tags.push('records');
  if(/chisel|gouge|rasp|auger|file|plane|saw|punch|caliper|tongs|measuring|tool|clamp|wedge/.test(text))tags.push('tools');
  if(/charcoal|firewood|lamp oil|candle|lantern|wick|rushlight/.test(text))tags.push('fuel');
  if(/soap|salve|balm|bandage|dressing|splint|herb|rosewater|perfume|sachet|lavender/.test(text))tags.push('care');
  if(tags.includes('care') && ['food','agriculture'].includes(trade.industry))tags.push('provisions');
  if(tags.length)return tags;
  return [({agriculture:'provisions',food:'provisions',textiles:'clothing',leather:'homewares',wood:'homewares',metal:'tools',stone:'structural',glass:'containers',maritime:'maritime',transport:'transport',records:'records',learning:'learning',medicine:'care',arts:'art',commerce:'homewares',civic:'civic',hospitality:'provisions'})[trade.industry] || 'homewares'];
}
function allowedFor(target) {
  if(buyerCache.has(target))return buyerCache.get(target);
  const trade=target.economy().trade,industry=trade?.industry || ({tavern:'hospitality',harbor:'maritime',guild:'commerce',temple:'civic'})[target.place.category];
  const tags=new Set(['structural','records','clothing','homewares','fuel']);
  const add=values=>values.split(' ').forEach(v=>tags.add(v));
  if(['food','hospitality','agriculture','commerce'].includes(industry))add('provisions containers tools');
  if(['wood','metal','stone','glass','leather','textiles'].includes(industry))add('tools containers');
  if(industry==='transport')add('transport maritime navigation containers tools');
  if(industry==='maritime')add('maritime navigation transport containers tools optics');
  if(industry==='learning')add('learning optics arcane tools');
  if(industry==='arcane')add('arcane optics learning containers care tools');
  if(industry==='medicine')add('care containers optics provisions');
  if(industry==='hospitality')add('care');
  if(['arts','hospitality','civic','commerce'].includes(industry))add('art');
  if(industry==='arts')add('tools containers optics');
  if(target.config.settlement?.type==='fortress' || ['blacksmith','armorer','bladesmith','fletcher','outfitter'].includes(trade?.id))add('weapons');
  if(['pawnbroker','auctioneer'].includes(trade?.id))add('arcane optics navigation');
  if(industry==='agriculture')add('transport');
  if(industry==='civic')add('civic tools care');
  buyerCache.set(target,tags);return tags;
}
export function compatibleProducts(trade,target) {
  if(!catalogCache.has(trade.id))catalogCache.set(trade.id,trade.items.map(item=>({item,tags:tagsFor(item,trade)})));
  const allowed=allowedFor(target);
  return catalogCache.get(trade.id).filter(p=>p.tags.some(t=>allowed.has(t))).map(p=>p.item);
}
