// Reading controls work without a connection; connected preferences are durable.
export function createSectionView({sync,notify=()=>{},mobile=()=>matchMedia('(max-width: 767px)').matches,root=document}={}){
 let local={},generation=0;
 const buttons=[...root.querySelectorAll('[data-section-toggle]')];
 const expanded=id=>typeof sync.state?.sectionPreferences?.[id]==='boolean'?sync.state.sectionPreferences[id]:local[id]??!mobile();
 function render(){for(const b of buttons){const open=expanded(b.dataset.sectionToggle);b.setAttribute('aria-expanded',String(open));root.getElementById(b.getAttribute('aria-controls')).hidden=!open;b.querySelector('[data-section-action]').textContent=open?'Hide':'Show';b.querySelector('[data-section-symbol]').textContent=open?'−':'+';}}
 async function setExpanded(id,next){
  const b=buttons.find(button=>button.dataset.sectionToggle===id),current=generation;
  if(!b||b.disabled)return false;
  if(expanded(id)===next)return true;
  if(!sync.connected){local[id]=next;render();return true;}
  b.disabled=true;
  try{await sync.change(state=>{state.sectionPreferences??={};state.sectionPreferences[id]=next;return state;});return current===generation;}
  catch(error){if(current===generation)notify(error.message||'Could not save your section preference. Please try again.');return false;}
  finally{if(current===generation){b.disabled=false;render();}}
 }
 for(const b of buttons)b.addEventListener('click',()=>setExpanded(b.dataset.sectionToggle,!expanded(b.dataset.sectionToggle)));
 return {render,open:id=>setExpanded(id,true),clear(){generation++;local={};buttons.forEach(b=>b.disabled=false);render();}};
}
