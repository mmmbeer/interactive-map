import { roots } from './wordbanks-v2.js';
const adjectives='resident|senior|visiting|local|appointed|experienced|deputy|assistant|retired|district|seasonal|independent'.split('|');
const roles='keeper|groundskeeper|memorial carver|burial registrar|funeral attendant|grave tender|caretaker|mourners’ guide|record keeper|monument restorer'.split('|');
const services='burial records|memorial inscriptions|grave tending|funeral arrangements|family plot records|monument repairs|remembrance gatherings|ancestral records|interment arrangements|visitor guidance'.split('|');
const cache=new WeakMap();
export function withBurialTypes(types) {
  if(cache.has(types))return cache.get(types);
  const added=Object.fromEntries(['graveyard','cemetery','necropolis','tomb','crypt','mausoleum','grave'].map(type=>[type,{
    ...types.landmark,category:'landmark',label:type,
    nouns:roots.map(root=>`${root} ${type}`),roles:adjectives.flatMap(a=>roles.map(r=>`${a} ${r}`)),
    services:adjectives.flatMap(a=>services.map(s=>`${a} assistance with ${s}`))
  }]));
  const result={...types,...added};cache.set(types,result);return result;
}
