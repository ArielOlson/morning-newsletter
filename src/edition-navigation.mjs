export const backToTopHTML='<div class="section-return"><a class="back-to-top" href="#newsletter-top" aria-label="Back to top" title="Back to top"><span aria-hidden="true">↑</span></a></div>';

export function setupEditionNavigation({openSection,showView,isAvailable,root=document}){
 root.addEventListener('click',async event=>{
  const link=event.target.closest('[data-edition-jump],.back-to-top');
  if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(!isAvailable())return;
  if(link.classList.contains('back-to-top')){
   // Keep the current Today, Coming up or Saved view while returning to the masthead.
   root.getElementById('newsletter-top').focus({preventScroll:true});
   window.scrollTo({top:0,behavior:'instant'});
   return;
  }
  const section=link.dataset.openSection;
  if(section&&!await openSection(section))return;
  if(!isAvailable())return;
  // Older editions may have a single undivided ideas list.
  const target=root.getElementById(link.hash.slice(1))||(section==='ideas'?root.getElementById('ideas-heading'):null);
  if(!target)return;
  history.pushState(null,'',`#${target.id}`);
  showView();
  const focusTarget=target.querySelector('[data-section-toggle]')||target;
  if(!focusTarget.hasAttribute('tabindex')&&focusTarget.tagName!=='BUTTON')focusTarget.setAttribute('tabindex','-1');
  focusTarget.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'instant'});
 });
}
