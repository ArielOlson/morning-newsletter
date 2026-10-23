import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHeaderPhotos,headerPhotosForEdition} from '../src/photography.mjs';
const item=(id,image='https://venue.example/'+id+'.jpg')=>({id,title:id,image,url:'https://venue.example/'+id,imageAlt:'Venue photograph'});
test('header uses distinct photos from this edition, preserves source links and rejects unsafe resources',()=>{
 const wish=item('wish'),event=item('event');
 const photos=selectHeaderPhotos({ideas:[wish],finds:[event]});
 assert.deepEqual(photos.map(x=>x.id),['wish','event']);assert.equal(photos[0].url,wish.url);
 const duplicate=item('duplicate',wish.image);
 assert.equal(selectHeaderPhotos({ideas:[wish,duplicate],finds:[]}).length,1);
 for(const image of ['http://example.com/a.jpg','javascript:alert(1)','https://user:secret@example.com/a.jpg'])assert.equal(selectHeaderPhotos({ideas:[item('unsafe',image)]}).length,0);
 assert.deepEqual(headerPhotosForEdition({}),[]);
 assert.deepEqual(headerPhotosForEdition({photography:{photos:[...photos,{src:'javascript:alert(1)',url:wish.url,title:'bad',alt:'bad'}]}}),photos);
});
