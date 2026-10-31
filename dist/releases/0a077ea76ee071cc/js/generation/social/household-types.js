export const householdTypes={
  solitary:{label:'one-person household',min:1,max:1,roles:['householder'],stages:['adult']},
  partners:{label:'partners sharing a home',min:2,max:2,roles:['partner','partner'],stages:['adult','adult'],kin:false},
  siblings:{label:'adult siblings',min:2,roles:['sibling','sibling'],stages:['adult','adult'],kin:true},
  extended_family:{label:'extended family',min:3,roles:['householder','adult relative','younger relative'],stages:['adult','adult','young_adult'],kin:true},
  guardian_dependents:{label:'guardian household',min:2,roles:['guardian','dependent'],stages:['adult','child'],kin:true},
  shared_lodging:{label:'shared lodging',min:2,roles:['housemate','housemate'],stages:['adult','young_adult'],kin:false},
  craft_household:{label:'craft household',min:2,roles:['householder','apprentice'],stages:['adult','young_adult'],kin:false},
  multigenerational:{label:'multigenerational household',min:3,roles:['householder','older relative','dependent'],stages:['adult','elder','child'],kin:true},
  companions:{label:'companions sharing a home',min:2,roles:['housemate','companion'],stages:['adult','adult'],kin:false},
  care_household:{label:'household sharing care',min:2,roles:['householder','relative receiving support'],stages:['adult','elder'],kin:true}
};
