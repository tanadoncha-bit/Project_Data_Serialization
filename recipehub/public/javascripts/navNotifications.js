(() => {
  const bell=document.querySelector('[data-nav-notifications]');
  if(!bell)return;
  const panel=document.createElement('section');
  panel.id='cookhubNotifications'; panel.className='nav-notifications';panel.hidden=true;panel.setAttribute('aria-label','การแจ้งเตือน');
  panel.innerHTML='<header class="nav-notifications-header"><strong>การแจ้งเตือน</strong><button class="notifications-read-all" type="button">อ่านทั้งหมด</button><button class="notifications-close" type="button" aria-label="ปิดการแจ้งเตือน"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="notification-list" aria-live="polite"></div>';
  document.body.append(panel);
  const list=panel.querySelector('.notification-list'), dot=bell.querySelector('.badge-dot');
  let items=[],read=new Set(),storageKey='',pending=false;
  const position=()=>panel.style.setProperty('--notification-top',Math.max(12,(bell.closest('nav')?.getBoundingClientRect().bottom||72)+12)+'px');
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify([...read].slice(-200)));}catch{};dot.hidden=!items.some(item=>!read.has(item.id));panel.querySelector('.notifications-read-all').disabled=dot.hidden;};
  const render=()=>{
    list.replaceChildren();
    if(!items.length){list.innerHTML='<p class="notification-status">ยังไม่มีรายการแจ้งเตือน</p>';return;}
    items.forEach(item=>{
      const link=document.createElement('a');link.className='notification-item'+(read.has(item.id)?'':' unread');link.href=item.url;
      const avatar=document.createElement(item.avatar?'img':'span');avatar.className='notification-avatar';const fallback=()=>{const initial=document.createElement('span');initial.className='notification-avatar';initial.textContent=(item.message||'?').trim().charAt(0).toUpperCase();avatar.replaceWith(initial);};if(item.avatar){avatar.alt='';avatar.addEventListener('error',fallback,{once:true});avatar.src=item.avatar;}else avatar.textContent=(item.message||'?').trim().charAt(0).toUpperCase();
      const copy=document.createElement('div');copy.className='notification-copy';const title=document.createElement('strong');title.textContent=item.title;const message=document.createElement('p');message.textContent=item.message;const time=document.createElement('time');const date=new Date(item.date);time.dateTime=date.toISOString();time.textContent=date.toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});copy.append(title,message,time);link.append(avatar,copy);link.addEventListener('click',()=>{read.add(item.id);save();});list.append(link);
    });
  };
  const load=async()=>{
    if(pending)return;pending=true;
    if(!items.length)list.innerHTML='<p class="notification-status">กำลังโหลด…</p>';
    try{const response=await fetch('/api/notifications',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error();const data=await response.json();storageKey='cookhub-notifications-read:'+data.userId;try{read=new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'));}catch{read=new Set();}items=data.items;save();render();}
    catch{list.innerHTML='<p class="notification-status">โหลดแจ้งเตือนไม่สำเร็จ <button type="button">ลองใหม่</button></p>';list.querySelector('button').addEventListener('click',load);}
    finally{pending=false;}
  };
  const close=()=>{panel.hidden=true;bell.setAttribute('aria-expanded','false');};
  bell.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;bell.setAttribute('aria-expanded',String(open));if(open){position();load();document.getElementById('profileMenu')?.classList.remove('open');document.getElementById('profileToggle')?.setAttribute('aria-expanded','false');}});
  panel.querySelector('.notifications-close').addEventListener('click',()=>{close();bell.focus();});
  panel.querySelector('.notifications-read-all').addEventListener('click',()=>{items.forEach(item=>read.add(item.id));save();render();});
  document.addEventListener('click',event=>{if(!panel.contains(event.target)&&!bell.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){close();bell.focus();}});
  window.addEventListener('resize',position);window.addEventListener('scroll',position,{passive:true});load();
})();