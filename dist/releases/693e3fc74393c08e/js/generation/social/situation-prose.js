import { recipe } from '../detail-helpers-v1.js';
import { orderProse } from './order-prose.js';
import { creativeProse } from './creative-prose.js';

export const situationProse={...orderProse,...creativeProse};
export function situationSources(scenarios) {
  return Object.fromEntries(Object.entries(scenarios).flatMap(([key,s])=>{
    const prose=situationProse[key];
    return [
      [`story_${key}`,recipe(prose.starts,prose.ends)],
      [`goal_${key}`,recipe(s.goals,prose.followups,', then ')]
    ];
  }));
}
