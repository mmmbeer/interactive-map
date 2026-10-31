import { choose } from './helpers-v2.js';
// Physical descriptions are keyed to mapped type. Do not invent an unrelated shop or resident.
const profiles = {
  street:{use:'carries local traffic between neighboring blocks',detail:'Doorways and side passages open along its edges',task:'trace a former street boundary'},
  road:{use:'connects this district with the routes beyond it',detail:'Travelers use its junctions as meeting places',task:'locate a missing route marker'},
  lane:{use:'provides a quieter route through the neighborhood',detail:'Small entrances face the lane',task:'identify an entrance shown on an old plan'},
  alley:{use:'links the backs of neighboring properties',detail:'The passage gives access to shared service yards',task:'find the owner of a sealed doorway'},
  bridge:{use:'carries a crossing between two banks',detail:'Its approaches mark a useful meeting point',task:'find the record of a former crossing toll'},
  square:{use:'provides an open meeting place for the district',detail:'Several local routes meet at its edges',task:'recover a lost market charter'},
  trail:{use:'provides a foot route through the surrounding terrain',detail:'Walkers follow its bends between recognizable landmarks',task:'compare its present course with an older survey'},
  river:{use:'carries flowing water through the region',detail:'Its banks form a natural reference for local boundaries',task:'trace an old riverbank boundary'},
  stream:{use:'drains the surrounding ground through a smaller watercourse',detail:'Walkers use its banks to find their bearings',task:'find the source of a disputed water right'},
  canal:{use:'channels water along a managed course',detail:'Its banks require regular maintenance',task:'recover a missing maintenance record'},
  lake:{use:'forms an inland body of standing water',detail:'Its shore provides a familiar reference for travelers',task:'locate a shoreline marker recorded on an old chart'},
  pond:{use:'forms a small body of standing water',detail:'Its edges mark a quiet break in the surrounding landscape',task:'identify the holder of an old water right'},
  bay:{use:'forms a coastal indentation sheltered by the surrounding shore',detail:'Boat crews use its shoreline to identify their approach',task:'compare two conflicting coastal charts'},
  sea:{use:'extends beyond the local shoreline',detail:'Coastal travelers use its headlands and islands for bearings',task:'trace a name on an old coastal chart'},
  channel:{use:'provides a passage of water between neighboring shores',detail:'Boat crews use the banks to judge their course',task:'locate a former navigation marker'},
  strait:{use:'forms a narrow sea passage between land masses',detail:'Navigators identify it by the opposing shores',task:'verify a passage described in a pilot’s notebook'},
  island:{use:'forms a tract of land enclosed by water',detail:'Its outline serves as a landmark for passing boats',task:'identify the boundary of an old island holding'},
  forest:{use:'covers a tract of land with trees',detail:'Its tree line marks a transition in the landscape',task:'trace an old woodland boundary'},
  wood:{use:'forms a smaller tract of tree-covered ground',detail:'The edge of the trees gives walkers a useful landmark',task:'identify the holder of an old timber right'},
  hill:{use:'rises above the surrounding ground',detail:'Its slopes provide a recognizable landmark',task:'locate a survey stone mentioned in a land deed'},
  mountain:{use:'rises prominently above the surrounding landscape',detail:'Travelers use its profile to find their bearings',task:'identify a pass named in an old itinerary'},
  valley:{use:'forms a stretch of lower ground between higher slopes',detail:'Routes through the area follow the shape of the land',task:'settle a boundary described in an old survey'},
  marsh:{use:'forms a tract of waterlogged ground',detail:'Firm ground and wet patches shape the available routes',task:'locate a former drainage boundary'},
  field:{use:'forms an open tract of worked land',detail:'Its edges divide the neighboring holdings',task:'recover a missing tenancy record'},
  cliff:{use:'forms a steep exposed face above lower ground',detail:'Its edge is a conspicuous feature of the landscape',task:'locate a warning marker on an old survey'},
  beach:{use:'forms a shore of loose material beside the water',detail:'Its outline follows the meeting of land and water',task:'identify the site of an old landing right'},
  cape:{use:'projects from the coast into the surrounding water',detail:'Its outline gives coastal travelers a useful bearing',task:'verify a headland named in an old pilot book'}
};
export function featureText(kind, tokens, context, roll, category) {
  const fallback=category==='water' ? {use:'forms part of the local waters',detail:'Its mapped outline helps travelers find their bearings',task:'compare two surveys of the local waters'} : category==='street' ? {use:'forms part of the local route network',detail:'Its junctions give travelers useful meeting points',task:'trace an old route boundary'} : {use:'forms part of the local landscape',detail:'Its mapped outline gives travelers a useful landmark',task:'trace an old land boundary'};
  const p=profiles[kind] || fallback, t=tokens;
  const setting=context.water ? ` It adjoins ${context.water}.` : context.terrain ? ` It lies near ${context.terrain}.` : '';
  const description=choose([
    `${t.displayName} ${p.use} in ${t.district}. ${p.detail}.${setting}`,
    `In ${t.district}, ${t.displayName} ${p.use}. ${p.detail}.${setting}`,
    `${p.detail} at ${t.displayName}. This ${t.label} belongs to the mapped geography of ${t.district}, ${t.region}.${setting}`,
    `Charts of ${t.region} place ${t.displayName} in ${t.district}. It ${p.use}.${setting}`
  ],roll('feature-description',kind));
  const rumor=choose([
    `The district surveyor seeks an older plan of ${t.displayName} to ${p.task}.`,
    `A note in the ${t.district} records asks for help to ${p.task} at ${t.displayName}.`,
    `Two charts disagree about ${t.displayName}. A local clerk wants someone to ${p.task}.`
  ],roll('feature-rumor',kind));
  return {description,rumor,person:'',services:'',address:t.address};
}
