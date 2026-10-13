(() => {
 if(!document.getElementById('recipe-browse-form')||!document.getElementById('recipe-browse-results'))return;
 let pending=null;
 async function update(url,push=true){
  pending?.abort();const controller=new AbortController();pending=controller;
  const results=document.getElementById('recipe-browse-results');results.setAttribute('aria-busy','true');
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{'X-Requested-With':'XMLHttpRequest'}});
   if(!response.ok)throw Error('โหลดรายการไม่สำเร็จ กรุณาลองใหม่');
   const doc=new DOMParser().parseFromString(await response.text(),'text/html');
   const next=doc.getElementById('recipe-browse-results'),nextForm=doc.getElementById('recipe-browse-form'),nextFilter=doc.getElementById('recipe-filter-dialog');
   if(!next||!nextForm||!nextFilter)throw Error('โหลดตัวกรองไม่สำเร็จ กรุณาลองใหม่');
   if(controller.signal.aborted)return;
   const focused=document.activeElement;const sort=focused?.dataset.sort;
   results.replaceChildren(...Array.from(next.childNodes));
   document.getElementById('recipe-browse-form').replaceChildren(...Array.from(nextForm.childNodes));
   const filter=document.getElementById('recipe-filter-dialog');if(filter.open)filter.close();filter.classList.remove('recipe-filter-closing');filter.replaceChildren(...Array.from(nextFilter.childNodes));
   filter.querySelectorAll('[data-range-max]').forEach(input=>{const slider=input.closest('.recipe-range-slider');slider.classList.toggle('is-filtered',Number(input.value)>0);slider.style.setProperty('--range-low','0%');slider.style.setProperty('--range-high',(Number(input.value)/Number(input.max)*100)+'%');});
   if(push&&url!==location.href)history.pushState({recipeBrowse:true},'',url);
   window.lucide?.createIcons();if(sort)document.querySelector('[data-sort="'+sort+'"]')?.focus();
  }catch(error){if(error.name!=='AbortError'){let notice=document.getElementById('recipe-browse-error');if(!notice){notice=document.createElement('p');notice.id='recipe-browse-error';notice.className='recipe-alert recipe-error';notice.setAttribute('role','alert');results.prepend(notice);}notice.textContent=error.message;}}
  finally{if(pending===controller){results.removeAttribute('aria-busy');pending=null;}}
 }
 document.addEventListener('submit',event=>{
  if(event.target.id!=='recipe-browse-form')return;event.preventDefault();
  const url=new URL(event.target.action,location.href);const params=new URLSearchParams();for(const [key,value]of new FormData(event.target))if(value!=='')params.append(key,value);params.delete('page');url.search=params.toString();update(url.href);
 });
 document.addEventListener('click',event=>{
  const link=event.target.closest('.recipe-pagination a, .recipe-empty a, .recipe-alert a');
  if(!link||!link.closest('#recipe-browse-results')||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(link.href);if(url.origin!==location.origin||url.pathname!=='/recipes')return;event.preventDefault();update(url.href);
 });
 window.addEventListener('popstate',()=>{if(location.pathname==='/recipes')update(location.href,false);});
})();
