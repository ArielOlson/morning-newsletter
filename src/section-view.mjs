// Reading controls work without a connection; connected preferences are durable.
export function createSectionView({sync,notify=()=>{},mobile=()=>matchMedia('(max-width: 767px)').matches,root=document}={}){
 let local={},generation=0;
 const buttons=[...root.querySelectorAll('[data-section-toggle]')];
 const expanded=id=>typeof sync.state?.sectionPreferences?.[id]==='boolean'?sync.state.sectionPreferences[id]:local[id]??!mobile();
 function render(){for(const b of buttons){const open=expanded(b.dataset.sectionToggle);b.setAttribute('aria-expanded',String(open));root.getElementById(b.getAttribute('aria-controls')).hidden=!open;b.querySelector('[data-section-action]').textContent=open?'Hide':'Show';b.querySelector('[data-section-symbol]').textContent=open?'−':'+';}}
 for(const b of buttons)b.addEventListener('click',async()=>{
  const id=b.dataset.sectionToggle,next=!expanded(id),current=generation;
  if(!sync.connected){local[id]=next;render();return;}
  b.disabled=true;
  try{await sync.change(state=>{state.sectionPreferences??={};state.sectionPreferences[id]=next;return state;});}
  catch(error){if(current===generation)notify(error.message||'Could not save your section preference. Please try again.');}
  finally{if(current===generation){b.disabled=false;render();}}
 });
 return {render,clear(){generation++;local={};buttons.forEach(b=>b.disabled=false);render();}};
}
