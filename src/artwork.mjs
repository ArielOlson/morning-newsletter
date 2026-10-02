export const defaultArtwork={src:'assets/morning.png',alt:'A pink morning in New York: coffee, a croissant, and tulips by a brownstone window.',width:1536,height:1024};
export function seasonForDay(day){
 const month=Number(day.slice(5,7));
 return month===12||month<=2?'winter':month<=5?'spring':month<=8?'summer':'autumn';
}
export function artworkForEdition(artwork){
 if(!artwork||!/^assets\/artwork\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.(png|webp|jpg)$/.test(artwork.src||'')||!artwork.alt?.trim())return defaultArtwork;
 return artwork;
}
