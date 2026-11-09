import { hospitalitySources } from './hospitality.js';
import { civicSources } from './civic-details.js';
import { geographyNotes } from './geography.js';
import { recipe } from '../detail-helpers-v1.js';
import { uniqueChoices } from '../detail-helpers-v1.js';
const visitors='A visitor|A caretaker|A local guide|A neighbor|A returning visitor|A memorial carver|A visiting artist|A family visitor|A groundskeeper|A traveler';
export const landmarkNotes=recipe(visitors,'is studying a weathered inscription.|is leaving flowers in remembrance.|is sketching a carved detail.|is asking about the history of {displayName}.|is tending a small memorial.|is brushing leaves away from the entrance.|is looking for someone named in an inscription.|is comparing an old sketch with the site.|is asking who cares for {displayName}.|is bringing a question to the caretaker.');
export function profileDetailSources(context={}) {
  return {...hospitalitySources(context),...civicSources(context),...geographyNotes,landmarkNotes};
}
export function selectGuests(values,count,rng) {
  let pool=values;
  const selected=[];
  for(let i=0;i<count;i++) {
    const next=uniqueChoices(pool,1,rng)[0],parts=next.split(' is ');
    selected.push(next);
    pool=pool.filter(value=>{const other=value.split(' is ');return other[0]!==parts[0] && other[1]!==parts[1];});
  }
  return selected;
}
