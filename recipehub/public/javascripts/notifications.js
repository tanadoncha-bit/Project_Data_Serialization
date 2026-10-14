(() => {
 window.CookHubToastProgress = (element, duration) => {
  element._toastProgress?.cancel();element.querySelector('.toast-progress')?.remove();
  const track=document.createElement('div');track.className='toast-progress';track.setAttribute('aria-hidden','true');const fill=document.createElement('span');track.append(fill);element.append(track);
  const animation=fill.animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration,fill:'forwards',easing:'linear'});element._toastProgress=animation;return animation;
 };
 function position(){const nav=document.querySelector('.navbar');document.documentElement.style.setProperty('--cookhub-toast-top',(nav?Math.max(12,nav.getBoundingClientRect().bottom+12):20)+'px');}
 position();window.addEventListener('resize',position);window.addEventListener('scroll',position,{passive:true});
 const notices=[...document.querySelectorAll('.chef-page > .chef-alert,.profile-page > .alert-success,.profile-page > .alert-error')].filter(el=>!el.hidden);
 if(!notices.length)return;
 const region=document.createElement('div');region.className='site-notices';document.body.append(region);
 for(const notice of notices){
  const message=notice.textContent.trim(),error=notice.classList.contains('err')||notice.classList.contains('alert-error');
  notice.className='site-notice';notice.dataset.kind=error?'error':'success';notice.setAttribute('role',error?'alert':'status');
  notice.replaceChildren();const icon=document.createElement('span');icon.className='site-notice-icon';icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/>'+(error?'<path d="M12 7v6m0 3h.01"/>':'<path d="m7.5 12 3 3 6-6"/>')+'</svg>';
  const copy=document.createElement('div');copy.className='site-notice-copy';const title=document.createElement('strong');title.textContent=message;const text=document.createElement('span');text.textContent='';copy.append(title,text);
  const close=document.createElement('button');close.type='button';close.className='site-notice-close';close.setAttribute('aria-label','ปิดการแจ้งเตือน');close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  let timer,remaining=5000,started,progress;const stop=()=>{progress?.pause();clearTimeout(timer);if(started){remaining=Math.max(0,remaining-(Date.now()-started));started=0;}};const resume=()=>{if(error)return;progress?.play();started=Date.now();timer=setTimeout(()=>notice.remove(),remaining);};
  close.addEventListener('click',()=>{clearTimeout(timer);notice.remove();});notice.addEventListener('mouseenter',stop);notice.addEventListener('mouseleave',()=>{if(!notice.contains(document.activeElement))resume();});notice.addEventListener('focusin',stop);notice.addEventListener('focusout',e=>{if(!notice.contains(e.relatedTarget))resume();});
  notice.append(icon,copy,close);region.append(notice);if(!error)progress=window.CookHubToastProgress(notice,5000);resume();
 }
})();
