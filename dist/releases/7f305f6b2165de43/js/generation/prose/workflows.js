import { workflowFor } from '../economy-workflows.js';
import { recipe } from '../detail-helpers-v1.js';
// Classify the selected item, not just its business. A bathhouse sells towels
// as well as bookings, and a boarding house provides rooms rather than batches.
export function productWorkflow(trade,product,category) {
  const retail=['bookseller','stationer','seed_merchant','tea_merchant','component_merchant','pawnbroker','outfitter','provisioner','spice_seller','wine_merchant','grocer','fishmonger','cheesemonger','herbalist','perfumer','apothecary','ship_chandler','caravan_outfitter'];
  const base=trade?retail.includes(trade.id)?'goods':trade.id==='map_engraver'?'craft':workflowFor(trade):category==='tavern'?'provisions':'service';
  if(/\b(bookings?|appointments?|reservations?|lessons?|consultations?|inspections?|valuations?|exchanges?|registrations?|allotments?|rooms?|lodgings?|baths?|storage|messages|introductions|service|changes|checks?|repairs?|deliveries)$/i.test(product))return 'service';
  if(base==='service' && /\b(records|receipts|tallies|notices|reports|schedules|catalogs|plans|notes|copies|tables)\b/i.test(product) && product!=='writing tables')return 'documents';
  if(base==='documents' && /\b(markers|rulers|instruments)$/i.test(product))return 'goods';
  return base==='service'?'goods':base;
}
const goods='check the condition of the {product}|confirm the quantity of the {product}|prepare the {product} for collection|check the packing for the {product}|inspect the {product} before handover|compare the {product} with the customer’s request|set aside the {product} for the customer|label the {product} for delivery|check the collection arrangements for the {product}|confirm the price of the {product}';
export const goodsTasks=goods.split('|');
export const goodsWorkRecipes=recipe('For {customer}, someone must|The order for {customer} needs someone to|To complete the order for {customer}, someone must|A request from {customer} calls for someone to|For the order from {customer}, the next step is to|Work for {customer} requires someone to|The next job for {customer} is to|An enquiry from {customer} calls for someone to|To prepare the order for {customer}, someone must|Before handover to {customer}, someone must',goodsTasks.map(v=>`${v}.`));
export function scenariosForProduct(trade,product,place) {
  const flow=productWorkflow(trade,product,place.category);
  const choices=flow==='service'?['appointment','missing_record','invoice']:flow==='documents'?['missing_record','copy_dispute','invoice','collection']:['delivery','invoice','damaged','replacement','collection','misdirected'];
  if(flow==='craft')choices.push('makers_mark');
  if(trade.industry==='arcane' && flow==='craft')choices.push('whispering_work');
  if(['cartographer','chartmaker'].includes(trade.id) && place.context?.street)choices.push('map_clue');
  if(['food','agriculture','hospitality'].includes(trade.industry) && flow==='provisions')choices.push('festival');
  return choices;
}
