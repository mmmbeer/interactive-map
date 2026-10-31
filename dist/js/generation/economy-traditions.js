import { recipe } from './detail-helpers-v1.js';
const motifs = {
  human:'interlaced bands|rosette stamps|chevron borders|compass roses|market seals|woven-knot marks|sunburst medallions|checker borders|heraldic shields|vine scrolls',
  elf:'willow tracery|leaf spirals|crescent borders|branching lines|reed patterns|star clusters|petal chains|fern curls|flowing wave lines|interwoven stems',
  dwarf:'stepped borders|chisel-cut angles|braided geometry|faceted rosettes|square spirals|masonry grids|mountain profiles|hammered dots|interlocking rings|incised runes',
  halfling:'orchard sprigs|seed rosettes|patchwork squares|looped borders|garden knots|clover chains|woven baskets|paired leaves|winding paths|hearth circles',
  gnome:'nested circles|precise spirals|hinged-square patterns|paired compasses|prism outlines|measured grids|tiny constellations|toothed borders|crossed lines|folding-ribbon marks',
  orc:'bold chevrons|broad knotwork|ridge-line borders|layered arcs|stamped circles|interlocking bars|carved wave bands|braided loops|angular leaves|parallel hatchwork',
  goblin:'offset checks|linked triangles|spiral corners|stacked diamonds|loop-and-dot marks|zigzag borders|paired arrows|interlaced squares|scalloped bands|tessellated stars',
  dragonborn:'scale lattices|wing-shaped borders|radiating fans|flame curls|claw-shaped flourishes|paired crests|faceted diamonds|arched ridges|coiled lines|sunwheel marks',
  tiefling:'curling scrollwork|pointed arches|forked flourishes|crescent knots|fluted borders|starburst seals|braided tails|double spirals|sweeping hooks|thorn rosettes',
  half_elf:'leaf-and-rosette borders|woven branch knots|crescent shields|petal chevrons|starred vine scrolls|reed-and-ribbon bands|paired fern curls|branching compass roses|sunburst leaves|interlaced stems',
  half_orc:'broad heraldic bands|knotted chevrons|ridged rosettes|layered sunbursts|interlocking shields|stamped vine circles|braided hatchwork|angular compass marks|parallel scrolls|arched knot borders'
};
const practices='the sample book records the customer’s preferred finish|measurements stay with the customer’s order|a plain version is available on request|the maker signs the delivery record|repeat orders cite an earlier sample|the customer approves the layout first|repair notes stay with the original record|a duplicate label accompanies each order|the order ledger names the responsible practitioner|customers can supply a design of their own';
// All eleven traditions have 100 recipes. Motifs apply to labels and sample books,
// not physiology, moral character, diet, or a restriction on who can do a trade.
export const traditionRecipes=Object.fromEntries(Object.entries(motifs).map(([key,values])=>[key,recipe(values.split('|').map(m=>`Order labels at {displayName} use ${m}.`),practices.split('|').map(v=>`${v[0].toUpperCase()}${v.slice(1)}`))]));
export function traditionFor(race,culture,catalog) {
  const key=catalog?.cultures?.[culture]?.namePool || race;
  return {key:Object.hasOwn(traditionRecipes,key) ? key : 'human',label:key==='human' ? 'Human' : key.replaceAll('_',' ')};
}
