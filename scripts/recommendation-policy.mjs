export const EVENT_COUNT=20;
export const IDEA_COUNT=20;
export const MIN_DISCOVERIES=6;
export const MAX_DISCOVERIES=8;
export const MIN_FREE_IDEAS=8;
export const MIN_PAID_IDEAS=8;
export const ideaBudget=x=>x.costType==='free'?'free':x.costType==='paid'?'paid':null;
