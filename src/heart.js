import * as THREE from 'three';
// One small brand accent. Rendering is isolated from the reading experience.
export function mountHeart(element){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return;}
  renderer.setSize(62,56);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,62/56,.1,100);camera.position.z=5;
  const shape=new THREE.Shape();shape.moveTo(0,.3);shape.bezierCurveTo(-1,1.25,-1.5,-.1,0,-1);shape.bezierCurveTo(1.5,-.1,1,1.25,0,.3);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.12,bevelThickness:.12,curveSegments:20});geometry.center();
  const material=new THREE.MeshStandardMaterial({color:0xf4c54c,roughness:.35,metalness:.08});const heart=new THREE.Mesh(geometry,material);scene.add(heart);
  scene.add(new THREE.AmbientLight(0xfff1da,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-2,3,4);scene.add(light);
  element.replaceChildren(renderer.domElement);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let visible=false,frame=0;
  function render(t=0){heart.rotation.y=reduced.matches?-.2:Math.sin(t*.0007)*.35;heart.rotation.z=-.1;renderer.render(scene,camera);if(visible&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(render);}
  function update(){cancelAnimationFrame(frame);if(visible)render();}
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});observer.observe(element);
  document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);element.textContent='💛';});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();geometry.dispose();material.dispose();renderer.dispose();document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);},{once:true});
}
