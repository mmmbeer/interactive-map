import { recipe } from '../detail-helpers-v1.js';
// Complete sentences receive no additional narration around their facts.
const helpForms='Ask {requester}|Speak to {requester}|Talk to {requester}|Get in touch with {requester}|Contact {requester}|Write to {requester}|Send a message to {requester}|Leave a message for {requester}|Arrange to speak with {requester}|Arrange a meeting with {requester}';
const contacts='at {fromPlace}.|in {fromDistrict}.|about helping at {fromPlace}.|at {fromPlace} if you can help.|at {fromPlace} for details.|at {fromPlace} about the next step.|in {fromDistrict} if you have a lead.|at {fromPlace} to discuss the job.|in {fromDistrict} about taking the job.|at {fromPlace} about the work involved.';
export const rumorRecipes=recipe(helpForms,contacts).map(v=>`{fact} ${v}`);
const requestForms='{requester} asks someone to {goal}.|{requester} needs help to {goal}.|{requester} is looking for someone to {goal}.|{requester} wants someone to {goal}.|{requester} would like someone to {goal}.|{requester} is seeking help to {goal}.|{requester} has asked for someone to {goal}.|{requester} is asking for help to {goal}.|{requester} could use help to {goal}.|{requester} needs someone to {goal}.';
const requestPlaces='At {fromPlace},|In {fromDistrict},|For the job at {fromPlace},|For the work at {fromPlace},|To help at {fromPlace},|For this job,|For this request,|For this work,|To help with this,|For follow-up,';
export const requestRecipes=recipe(requestPlaces,requestForms);
const memoryActions='keeps a notebook of|collects sketches of|asks older residents about|copies accounts of|practices songs about|saves letters concerning|compares descriptions of|shares recollections of|draws small maps of|keeps a list of';
const memorySubjects='local market customs|the district’s former residents|household recipes|old place names|regional craft traditions|the settlement’s gathering places|changes to familiar streets|seasonal celebrations|family keepsakes|the stories behind makers’ marks';
export const residentHabits=recipe(memoryActions,memorySubjects);
const everyday='worn baskets|seasonal herbs|plain cloth|stored grain|carrying sacks|household tools|lamp supplies|copied notices|meal provisions|common-room furnishings';
const errands='comparing two prices for|checking a local source of|arranging a shared purchase of|asking a neighbor about|copying a receipt for|planning a collection of|inspecting a sample of|returning a borrowed set of|sorting a household supply of|recording an expense for';
export const residentErrands=recipe(errands,everyday);
