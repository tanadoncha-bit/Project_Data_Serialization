(() => {
 const root=document.querySelector('[data-assistant]');if(!root)return;
 const launcher=root.querySelector('.cookhub-ai-launcher'),panel=root.querySelector('.cookhub-ai-panel'),close=root.querySelector('[data-ai-close]'),form=root.querySelector('form'),input=form.elements.message,status=root.querySelector('.cookhub-ai-status'),messages=root.querySelector('.cookhub-ai-messages');
 let config=null,busy=false;const history=[],transcript=[];const storageKey='cookhub-ai-chat:'+root.dataset.assistantUser;
 function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify({history,transcript:transcript.slice(-40)}));}catch(_){}}
 function cards(items){for(const item of items||[]){if(!/^\/((?:chef\/)?recipes\/\d+|courses\/(?:pack\/)?\d+)$/.test(item.url))continue;const a=document.createElement('a');a.className='cookhub-ai-card';a.href=item.url;if(typeof item.image==='string'&&/^(https:\/\/|\/uploads\/|\/images\/)/.test(item.image)){const img=document.createElement('img');img.src=item.image;img.alt=item.title;img.loading='lazy';img.onerror=()=>img.remove();a.append(img);}const body=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;const meta=document.createElement('span');meta.textContent=item.type+' · '+(item.price===0?'ฟรี':'฿'+Number(item.price).toLocaleString('th-TH'))+' →';body.append(title,meta);a.append(body);messages.append(a);}}
 function scroll(){messages.scrollTop=messages.scrollHeight;}
 function bubble(text,user=false){const row=document.createElement('div');row.className='cookhub-ai-message'+(user?' is-user':'');if(!user){const avatar=document.createElement('img');avatar.className='cookhub-ai-avatar';avatar.src='/images/assistant/oven-avatar.svg';avatar.alt='';row.append(avatar);}const el=document.createElement('div');el.className='cookhub-ai-bubble'+(user?' is-user':'');el.textContent=text;row.append(el);messages.append(row);scroll();return el;}

 try{const saved=JSON.parse(sessionStorage.getItem(storageKey));if(saved&&Array.isArray(saved.transcript)&&Array.isArray(saved.history)){const rows=saved.transcript.slice(-40).filter(row=>row&&['user','assistant'].includes(row.role)&&typeof row.content==='string');if(rows.length){messages.replaceChildren();for(const row of rows){bubble(row.content,row.role==='user');if(row.role==='assistant')cards(row.recommendations);transcript.push(row);}history.push(...saved.history.filter(row=>row&&['user','assistant'].includes(row.role)&&typeof row.content==='string').slice(-8));}}}catch(_){}
 async function setup(){try{const res=await fetch('/api/assistant/config');const data=await res.json();if(!res.ok)throw Error(data.error);config=data;status.textContent=data.ready?'':'ผู้ช่วยยังไม่พร้อมตอบ กรุณาตั้งค่าคีย์ AI';}catch(_){status.textContent='เชื่อมต่อผู้ช่วยไม่ได้ กรุณาปิดแล้วเปิดใหม่';config=null;}}
 launcher.onclick=()=>{launcher.hidden=true;launcher.setAttribute('aria-expanded','true');panel.hidden=false;scroll();input.focus();setup();};
 function hide(){panel.hidden=true;launcher.hidden=false;launcher.setAttribute('aria-expanded','false');launcher.focus();}
 close.onclick=hide;document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();hide();}});
 root.querySelectorAll('[data-ai-prompt]').forEach(button=>button.onclick=()=>{if(busy)return;input.value=button.textContent;form.requestSubmit();});
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;const message=input.value.trim();if(!message)return;
  if(!config){await setup();}if(!config?.ready){status.textContent='ผู้ช่วยยังไม่พร้อมตอบ กรุณาตั้งค่าคีย์ AI';return;}
  busy=true;form.querySelector('button').disabled=true;root.querySelectorAll('[data-ai-prompt]').forEach(b=>b.disabled=true);bubble(message,true);transcript.push({role:'user',content:message});persist();input.value='';status.textContent='';const typing=bubble('');typing.classList.add('cookhub-ai-typing');typing.setAttribute('aria-label','น้องอุ่นกำลังพิมพ์');for(let i=0;i<3;i++)typing.append(document.createElement('span'));
  try{const response=await fetch('/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':config.csrf},body:JSON.stringify({message,history:history.slice(-8)})});const data=await response.json();if(!response.ok)throw Error(data.error||'ตอบไม่สำเร็จ');typing.parentElement.remove();bubble(data.reply);
   cards(data.recommendations);transcript.push({role:'assistant',content:data.reply,recommendations:data.recommendations||[]});
   history.push({role:'user',content:message.slice(0,1500)},{role:'assistant',content:data.reply.slice(0,1500)});if(history.length>8)history.splice(0,history.length-8);persist();status.textContent='';scroll();
  }catch(error){status.textContent=error.message;input.value=message;}
  finally{typing.parentElement?.remove();busy=false;form.querySelector('button').disabled=false;root.querySelectorAll('[data-ai-prompt]').forEach(b=>b.disabled=false);if(!panel.hidden)input.focus();}
 };
})();
