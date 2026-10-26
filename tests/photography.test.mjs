import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHeaderPhotos,headerPhotosForEdition} from '../src/photography.mjs';
const photo={day:'2026-10-26',availableThrough:'2026-10-31',src:'https://venue.example/autumn.jpg',url:'https://venue.example/photography',alt:'Autumn foliage beside the river',source:'Venue'};
test('atmospheric header selects one eligible scene independently of recommendation order',()=>{
 const older={...photo,day:'2026-10-25'},future={...photo,day:'2026-10-27'};
 assert.deepEqual(selectHeaderPhotos({day:'2026-10-26'},{photos:[older,future,photo]}),[photo]);
 assert.deepEqual(selectHeaderPhotos({day:'2026-11-01'},{photos:[photo]}),[]);
 assert.deepEqual(selectHeaderPhotos({day:'2026-10-24'},{photos:[photo]}),[]);
 assert.deepEqual(selectHeaderPhotos({day:'2026-10-26',ideas:[{image:photo.src}]}),[]);
 for(const section of ['finds','ideas'])assert.deepEqual(selectHeaderPhotos({day:photo.day,[section]:[{image:photo.src+'?width=400'}]},{photos:[photo]}),[]);
 for(const src of ['http://example.com/a.jpg','javascript:alert(1)','https://user:secret@example.com/a.jpg'])assert.deepEqual(selectHeaderPhotos({day:photo.day},{photos:[{...photo,src}]}),[]);
 assert.deepEqual(headerPhotosForEdition({photography:{mode:'atmosphere',photos:[photo,older]}}),[photo]);
});
test('archived editorial headers retain both original photos and reject unsafe links',()=>{
 const first={...photo,title:'Original highlight'},second={...first,src:'https://venue.example/second.jpg'};
 assert.deepEqual(headerPhotosForEdition({}),[]);
 assert.deepEqual(headerPhotosForEdition({photography:{mode:'editorial',photos:[first,second]}}),[first,second]);
 assert.deepEqual(headerPhotosForEdition({photography:{mode:'atmosphere',photos:[{...photo,url:'javascript:alert(1)'}]}}),[]);
});
