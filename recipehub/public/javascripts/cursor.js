(() => {
 if(window.CookHubCursor)return;
 const media=matchMedia('(hover:hover) and (pointer:fine)'),reduced=matchMedia('(prefers-reduced-motion:reduce)'),html=document.documentElement;
 let manual=0,network=0,timer=null,frame=0;
 const interactive='a[href],button,summary,[role="button"],input[type="submit"],input[type="button"],input[type="checkbox"],input[type="radio"],select,.clickable,[data-href],[data-url],[onclick]';
 function refresh(){
  const loading=media.matches&&(manual+network>0||!!document.querySelector('[aria-busy="true"]'));
  html.classList.toggle('cookhub-cursor-loading',loading);
  if((!loading||reduced.matches||document.hidden)&&timer){clearInterval(timer);timer=null;html.style.removeProperty('--cookhub-loading-frame');}
  if(loading&&!reduced.matches&&!document.hidden&&!timer)timer=setInterval(()=>{frame=(frame+1)%12;html.style.setProperty('--cookhub-loading-frame','url("/images/cursors/cursor-loading-'+frame+'.png?v=12") 20 30, url("/images/cursors/cursor-loading-'+frame+'.svg?v=12") 20 30');},90);
 }
 function release(){html.classList.remove('cookhub-cursor-pressed','cookhub-dragging');}
 function beginLoading(){manual++;refresh();let done=false;return()=>{if(done)return;done=true;manual--;refresh();};}
 window.CookHubCursor={beginLoading,withLoading:async task=>{const end=beginLoading();try{return await(typeof task==='function'?task():task);}finally{end();}}};
 if(!media.matches)return;

 const frames=Array.from({length:12},(_,index)=>{const img=new Image();img.src='/images/cursors/cursor-loading-'+index+'.png?v=12';return img;});
 document.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch'||event.button!==0)return;
  const range=event.target.closest('input[type="range"]');
  if(range&&!range.disabled){html.classList.add('cookhub-dragging');return;}
  const target=event.target.closest(interactive);
  if(target&&!target.matches(':disabled,[aria-disabled="true"]'))html.classList.add('cookhub-cursor-pressed');
 });
 for(const type of ['pointerup','pointercancel','dragend','drop'])document.addEventListener(type,release);
 window.addEventListener('blur',release);
 document.addEventListener('dragstart',()=>{html.classList.remove('cookhub-cursor-pressed');html.classList.add('cookhub-dragging');});
 new MutationObserver(refresh).observe(document.body,{subtree:true,attributes:true,attributeFilter:['aria-busy']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)release();refresh();});reduced.addEventListener('change',refresh);media.addEventListener('change',()=>{release();refresh();});
 const original=window.fetch;
 window.fetch=async function(...args){network++;refresh();try{return await original.apply(this,args);}finally{network--;refresh();}};
 refresh();
})();
