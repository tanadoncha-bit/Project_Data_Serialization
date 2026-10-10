(() => {
  const dialog = document.getElementById('recipe-content-dialog');
  const content = document.getElementById('recipe-modal-content');
  const filter = document.getElementById('recipe-filter-dialog');
  // Shared dropdown behavior, including forms loaded into a modal.
  document.addEventListener('click',event=>{
    const current=event.target.closest('.recipe-difficulty-control');
    document.querySelectorAll('.recipe-difficulty-control[open]').forEach(picker=>{if(picker!==current)picker.open=false;});
  });
  document.addEventListener('keydown',event=>{
    const picker=event.target.closest('.recipe-difficulty-control');
    if(picker && picker.open && event.key==='Escape'){event.preventDefault();event.stopPropagation();picker.open=false;picker.querySelector('summary').focus();}
  });
  document.addEventListener('change',event=>{
    if(!event.target.matches('.recipe-difficulty-option input'))return;
    const picker=event.target.closest('.recipe-difficulty-control');
    const value=picker.querySelector('[data-dropdown-value]');
    if(value)value.textContent=event.target.nextElementSibling.textContent;
    picker.open=false;picker.querySelector('summary').focus();
  });
  document.addEventListener('change', async event => {
    if(!event.target.matches('[data-recipe-image-file]'))return;
    const input=event.target,form=input.closest('form'),file=input.files[0],status=form.querySelector('[data-image-status]');if(!file)return;
    if(file.size>5*1024*1024){status.textContent='รูปต้องไม่เกิน 5 MB';input.value='';return;}
    form.dataset.imageUploading='true';form.querySelector('[data-pick-recipe-image]').disabled=true;status.textContent='';form.querySelector('[data-pick-recipe-image]').setAttribute('aria-busy','true');
    try {const body=new FormData();body.append('image',file);const res=await fetch('/chef/recipes/upload-image',{method:'POST',headers:{'X-CSRF-Token':form.elements._csrf.value},body});const data=await res.json();if(!res.ok)throw Error(data.error||'อัปโหลดไม่สำเร็จ');form.elements.image.value=data.image;wizardImage(form);status.textContent='';}catch(error){status.textContent=error.message;}finally{form.dataset.imageUploading='false';form.querySelector('[data-pick-recipe-image]').disabled=false;form.querySelector('[data-pick-recipe-image]').removeAttribute('aria-busy');input.value='';}
  });
  function reviewStars(section){const selected=section.querySelector('.recipe-review-stars input:checked');const rating=selected?Number(selected.value):0;section.querySelectorAll('.recipe-review-stars label').forEach(label=>label.classList.toggle('is-rated',Number(label.querySelector('input').value)<=rating));const text=section.querySelector('[data-review-rating-label]');if(text)text.textContent=rating?rating+' / 5':'เลือกคะแนน';}
  document.addEventListener('change',event=>{if(event.target.matches('.recipe-review-stars input'))reviewStars(event.target.closest('[data-recipe-reviews]'));});
  async function loadReviews(){document.querySelectorAll('[data-recipe-reviews]').forEach(async section=>{if(section.dataset.reviewLoaded)return;section.dataset.reviewLoaded='true';try{const res=await fetch(section.dataset.recipeReviews);if(!res.ok)throw Error();const html=await res.text();if(!section.isConnected)return;section.innerHTML=html;reviewStars(section);icons();}catch(_){if(section.isConnected)section.innerHTML='<p role="status">โหลดรีวิวไม่สำเร็จ <button type="button" class="recipe-btn" data-review-retry>ลองใหม่</button></p>';}});}
  loadReviews();
  document.addEventListener('click',event=>{const retry=event.target.closest('[data-review-retry]');if(retry){delete retry.closest('[data-recipe-reviews]').dataset.reviewLoaded;loadReviews();}if(event.target.closest('[data-review-login]'))document.querySelector('[data-open-login]')?.click();const remove=event.target.closest('[data-delete-review]');if(remove)saveReview(remove.closest('form'),true);});
  async function saveReview(form,remove=false){const section=form.closest('[data-recipe-reviews]'),status=form.querySelector('[data-review-status]');form.querySelectorAll('button').forEach(b=>b.disabled=true);try{const response=await fetch(form.action,{method:remove?'DELETE':'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':form.dataset.reviewToken},body:remove?undefined:JSON.stringify(Object.fromEntries(new FormData(form)))});if(!response.ok){let message='บันทึกรีวิวไม่สำเร็จ';try{message=(await response.json()).error||message;}catch(_){}throw Error(message);}section.innerHTML=await response.text();reviewStars(section);icons();showToast(remove?'ลบรีวิวแล้ว':'บันทึกรีวิวแล้ว');}catch(error){status.textContent=error.message;form.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  document.addEventListener('submit',event=>{if(event.target.matches('.recipe-review-form')){event.preventDefault();saveReview(event.target);}});
  function fitStepText(textarea) {
    const row=textarea.closest('.recipe-step-row');if(!row)return;
    textarea.style.removeProperty('height');
    const probe=document.createElement('div');
    const style=getComputedStyle(textarea);
    Object.assign(probe.style,{position:'absolute',visibility:'hidden',whiteSpace:'pre-wrap',overflowWrap:'break-word',font:style.font,lineHeight:style.lineHeight,width:textarea.clientWidth+'px',boxSizing:'border-box',padding:'0 '+style.paddingRight+' 0 '+style.paddingLeft});
    probe.textContent=textarea.value || textarea.placeholder || ' ';
    document.body.append(probe);
    row.classList.toggle('is-multiline',probe.getBoundingClientRect().height>(parseFloat(style.lineHeight)||22)+2);
    probe.remove();
  }
  function fitVisibleSteps(){document.querySelectorAll('.recipe-step-row textarea').forEach(textarea=>{if(textarea.offsetParent)fitStepText(textarea);});}
  document.addEventListener('input',event=>{if(event.target.matches('.recipe-step-row textarea'))fitStepText(event.target);});
  window.addEventListener('resize',fitVisibleSteps);
  function pinPreviewClose(){
    if(!dialog||!content)return;
    const preview=dialog.classList.contains('recipe-preview-dialog');
    let button=dialog.querySelector(':scope > .recipe-preview-close');
    if(!button){button=document.createElement('button');button.type='button';button.className='recipe-modal-close recipe-preview-close';button.setAttribute('data-close-recipe','');button.textContent='×';dialog.prepend(button);}
    button.setAttribute('aria-label',preview?'ปิดสูตรอาหาร':'ปิดฟอร์ม');
    button.classList.toggle('recipe-form-fixed-close',!preview);
    content.querySelectorAll('.recipe-modal-close[data-close-recipe]').forEach(close=>close.remove());
    dialog.querySelectorAll(':scope > .recipe-preview-close').forEach(close=>{if(close!==button)close.remove();});
    button.hidden=false;
  }
  pinPreviewClose();
  let toastTimer;
  let toastRemaining = 0;
  let toastStarted = 0;
  const toast = document.createElement('div');
  toast.className = 'cookhub-toast';
  toast.hidden = true;
  toast.innerHTML = '<span class="cookhub-toast-icon" aria-hidden="true"></span><div class="cookhub-toast-copy"><strong></strong><span class="cookhub-toast-message" role="status" aria-live="polite" aria-atomic="true"></span></div><button type="button" class="cookhub-toast-close" aria-label="ปิดการแจ้งเตือน">×</button>';
  document.body.append(toast);
  function hideToast() { clearTimeout(toastTimer); toast.hidden = true; }
  function resumeToast() { clearTimeout(toastTimer); toastStarted = Date.now(); toastTimer = setTimeout(hideToast, Math.max(0, toastRemaining)); }
  function pauseToast() { clearTimeout(toastTimer); toastRemaining = Math.max(0, toastRemaining - (Date.now() - toastStarted)); }
  toast.querySelector('button').addEventListener('click', hideToast);
  toast.addEventListener('mouseenter', pauseToast);
  toast.addEventListener('mouseleave', () => { if (!toast.contains(document.activeElement)) resumeToast(); });
  toast.addEventListener('focusin', pauseToast);
  toast.addEventListener('focusout', event => { if (!toast.contains(event.relatedTarget)) resumeToast(); });
  function showToast(message, kind = 'success') {
    clearTimeout(toastTimer);
    toast.dataset.kind = kind;
    toast.querySelector('strong').textContent = kind === 'error' ? 'ยังบันทึกไม่ได้' : kind === 'login' ? 'เข้าสู่ระบบก่อนนะ' : kind === 'recipe' ? 'สูตรอาหาร' : 'รายการโปรด';
    toast.querySelector('.cookhub-toast-icon').innerHTML = '<i data-lucide="' + (kind === 'error' ? 'circle-alert' : kind === 'login' ? 'user-round' : kind === 'recipe' ? 'chef-hat' : 'heart') + '"></i>';
    toast.querySelector('.cookhub-toast-message').textContent = message;
    toast.hidden = false;
    icons();
    toastRemaining = kind === 'success' ? 4000 : 6000;
    resumeToast();
  }
  function wizardStep(form, index) {
    form.dataset.wizardStep = String(index);
    requestAnimationFrame(fitVisibleSteps);
    form.querySelectorAll('[data-wizard-panel]').forEach(panel => panel.hidden = Number(panel.dataset.wizardPanel) !== index);
    form.querySelectorAll('[data-wizard-goto]').forEach(button => { if(Number(button.dataset.wizardGoto)===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current'); });
    form.querySelector('[data-wizard-back]').hidden = index === 0;
    form.querySelector('[data-wizard-next]').hidden = index === 2;
    form.querySelector('[data-wizard-save]').hidden = index !== 2;
    form.querySelector('.recipe-wizard-progress').textContent = 'ขั้นที่ ' + (index+1) + ' จาก 3 · ' + ['ข้อมูลเมนู','วัตถุดิบ','วิธีทำและตรวจสอบ'][index];
    if(index===2) {
      const summary=form.querySelector('[data-wizard-review]');summary.replaceChildren();
      const name=document.createElement('strong');name.textContent=form.elements.title.value || 'ยังไม่ได้ตั้งชื่อเมนู';summary.append(name);
      const meta=document.createElement('p');meta.textContent=(Number(form.elements.price.value)===0?'ฟรี':'฿'+Number(form.elements.price.value).toLocaleString('th-TH'))+' · '+form.querySelectorAll('[name=ingredientName]').length+' วัตถุดิบ · '+form.querySelectorAll('[name=stepDescription]').length+' ขั้นตอน';summary.append(meta);
    }
  }
  function wizardValid(form, index) {
    const panel=form.querySelector('[data-wizard-panel="'+index+'"]');
    if(index===0 && (!form.elements.image.value || form.dataset.imageUploading==='true')){form.querySelector('[data-image-status]').textContent=form.dataset.imageUploading==='true'?'รออัปโหลดรูปให้เสร็จก่อน':'กรุณาเลือกรูปเมนู';form.querySelector('[data-pick-recipe-image]').focus();return false;}
    const invalid=Array.from(panel.querySelectorAll('input,select,textarea')).find(input=>!input.checkValidity());
    if(invalid){wizardStep(form,index);invalid.reportValidity();return false;}return true;
  }
  function wizardImage(form) {
    const img=form.querySelector('[data-wizard-image]'),placeholder=form.querySelector('[data-image-placeholder]');
    const url=form.elements.image.value.trim();img.hidden=true;placeholder.hidden=false;
    if(!/^(https?:\/\/|\/uploads\/recipes\/)/i.test(url))return;
    img.onload=()=>{img.hidden=false;placeholder.hidden=true;form.querySelector('.recipe-image-replace').hidden=false;};img.onerror=()=>{img.hidden=true;placeholder.hidden=false;placeholder.textContent='โหลดรูปไม่ได้ กรุณาตรวจสอบ URL';};img.src=url;
  }
  function initWizard() {
    document.querySelectorAll('[data-recipe-wizard]').forEach(form=>{if(form.dataset.wizardReady)return;form.dataset.wizardReady='true';wizardStep(form,0);wizardImage(form);});
  }
  initWizard();
  requestAnimationFrame(fitVisibleSteps);
  const recipeSuccess = document.querySelector('[data-recipe-success]');
  if(recipeSuccess){showToast(recipeSuccess.dataset.recipeSuccess,'recipe');recipeSuccess.remove();const url=new URL(location.href);url.searchParams.delete('saved');url.searchParams.delete('deleted');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
  async function openPromptpay(quoteUrl) {
    const response=await fetch(quoteUrl),quote=await response.json();if(!response.ok)throw Error(quote.error||'เปิดการจ่ายเงินไม่สำเร็จ');
    async function unlock(){const res=await fetch('/recipes/'+quote.id+'?fragment=1');if(!res.ok)throw Error('โหลดสูตรไม่สำเร็จ กรุณาเปิดใหม่');content.innerHTML=await res.text();pinPreviewClose();loadReviews();icons();}
    if(quote.owned){await unlock();return;}
    const payment=document.createElement('dialog');payment.className='recipe-dialog recipe-promptpay-checkout';
    payment.innerHTML='<button type="button" class="recipe-qr-close" aria-label="ปิดการจ่ายเงิน">×</button><div class="recipe-pay-brand">CookHub <span>CHECKOUT</span></div><h2>ชำระเงิน</h2><div class="recipe-pay-summary"><span class="recipe-pay-label">สูตรอาหาร</span><p class="recipe-qr-title"></p><div class="recipe-pay-total"><span>ยอดชำระทั้งหมด</span><strong class="recipe-checkout-price"></strong></div></div><div class="recipe-pay-method"><span class="recipe-promptpay-mark">QR</span><div><strong>PromptPay</strong><small>สแกนผ่านแอปธนาคาร</small></div></div><div class="recipe-qr-box" hidden><img alt="QR สำหรับชำระค่าสูตรอาหาร"><span class="recipe-qr-countdown"></span></div><p class="recipe-qr-status" role="status" aria-live="polite"></p><button type="button" class="recipe-btn recipe-primary" data-create-qr>แสดง QR สำหรับชำระเงิน</button><div class="recipe-pay-footer">ระบบจะเปิดสูตรให้เมื่อยืนยันการชำระเงินสำเร็จ</div>';
    payment.querySelector('.recipe-qr-title').textContent=quote.title;payment.querySelector('.recipe-checkout-price').textContent='฿'+Number(quote.price).toLocaleString('th-TH');
    document.body.append(payment);let pollTimer,countdownTimer,orderId;const status=payment.querySelector('.recipe-qr-status'),button=payment.querySelector('[data-create-qr]');
    function stop(){clearTimeout(pollTimer);clearInterval(countdownTimer);}payment.addEventListener('close',()=>{stop();payment.remove();});payment.querySelector('.recipe-qr-close').onclick=()=>payment.close();
    function display(order){if(order.qrUrl){payment.querySelector('.recipe-qr-box').hidden=false;payment.querySelector('img').src=order.qrUrl;}clearInterval(countdownTimer);function clock(){if(!order.expiresAt)return;const seconds=Math.max(0,Math.ceil((new Date(order.expiresAt)-Date.now())/1000));payment.querySelector('.recipe-qr-countdown').textContent=seconds?'เหลือ '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'QR หมดเวลา กำลังตรวจสอบสถานะ';}clock();countdownTimer=setInterval(clock,1000);}
    async function check(){if(!payment.open)return;try{const res=await fetch('/payments/promptpay/orders/'+orderId);const order=await res.json();if(!payment.open)return;if(!res.ok)throw Error(order.error||'ตรวจสอบไม่สำเร็จ');if(order.status==='paid'){stop();await unlock();payment.close();showToast(quote.test?'ทดสอบจ่ายเงินสำเร็จ':'ชำระเงินสำเร็จ','recipe');return;}if(['failed','expired'].includes(order.status)){stop();payment.querySelector('.recipe-qr-box').hidden=true;status.textContent=order.status==='expired'?'QR หมดอายุ กรุณาขอ QR ใหม่':'การชำระเงินไม่สำเร็จ กรุณาลองอีกครั้ง';payment.dataset.paymentState=order.status;button.textContent='ขอ QR ใหม่';button.hidden=false;button.disabled=false;return;}display(order);payment.dataset.paymentState=order.status;status.textContent=order.status==='creating'?'กำลังเตรียม QR สำหรับคุณ':'รอการยืนยันชำระเงิน';}catch(error){status.textContent=error.message+' ระบบจะตรวจสอบอีกครั้ง';}pollTimer=setTimeout(check,5000);}
    button.onclick=async()=>{button.disabled=true;payment.dataset.paymentState='creating';status.textContent='กำลังเตรียม QR สำหรับคุณ…';try{const res=await fetch('/payments/promptpay/orders',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':quote.csrf},body:JSON.stringify({recipeId:quote.id})});const order=await res.json();if(!payment.open)return;if(!res.ok)throw Error(order.error||'สร้าง QR ไม่สำเร็จ');orderId=order.id;button.hidden=true;display(order);await check();}catch(error){status.textContent=error.message;button.disabled=false;}};
    payment.showModal();
    if(quote.activeOrder){payment.dataset.paymentState=quote.activeOrder.status;orderId=quote.activeOrder.id;button.hidden=true;display(quote.activeOrder);await check();}
  }
  let request;
  let opener;
  function icons() { if (window.lucide) window.lucide.createIcons(); }
  function opened() { document.body.classList.add('recipe-modal-open'); }
  function closed() {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('recipe-modal-open');
  }
  if (dialog) {
    dialog.addEventListener('close', () => {
      if (request) request.abort();
      content.setAttribute('aria-busy', 'false');
      closed();
      if (opener) opener.focus();
      if (dialog.dataset.initialModal === 'true') {
        history.replaceState(null, '', '/chef/recipes');
        dialog.dataset.initialModal = 'false';
      }
    });
    if (dialog.dataset.initialModal === 'true') { dialog.showModal(); opened(); }
  }
  // Keep slider feedback synchronized with its range and numeric fields.
  function updateRange(slider) {
    const high = slider.querySelector('[data-range-max]');
    const span = Number(high.max) - Number(high.min);
    slider.classList.toggle('is-filtered', Number(high.value) > 0);
    slider.style.setProperty('--range-low', '0%');
    slider.style.setProperty('--range-high', ((Number(high.value) - Number(high.min)) / span * 100) + '%');
  }
  if (filter) filter.querySelectorAll('.recipe-range-slider').forEach(updateRange);
  let filterOpener;
  function closeFilter() {
    if (!filter || !filter.open || filter.classList.contains('recipe-filter-closing')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { filter.close(); return; }
    filter.classList.add('recipe-filter-closing');
    filter.addEventListener('animationend', () => filter.close(), { once: true });
  }
  if (filter) {
    filter.addEventListener('close', () => {
      filter.classList.remove('recipe-filter-closing');
      closed();
      if (filterOpener) filterOpener.focus();
    });
    filter.addEventListener('cancel', event => { event.preventDefault(); closeFilter(); });
    filter.addEventListener('click', event => {
      const bounds = filter.getBoundingClientRect();
      if (event.target === filter && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeFilter();
    });
  }
  document.addEventListener('click', async event => {
    const imagePicker=event.target.closest('[data-pick-recipe-image]');if(imagePicker){imagePicker.closest('form').querySelector('[data-recipe-image-file]').click();return;}
    const wizardButton=event.target.closest('[data-wizard-next],[data-wizard-back],[data-wizard-goto]');
    if(wizardButton){const form=wizardButton.closest('[data-recipe-wizard]');const current=Number(form.dataset.wizardStep||0);let target=wizardButton.hasAttribute('data-wizard-next')?current+1:wizardButton.hasAttribute('data-wizard-back')?current-1:Number(wizardButton.dataset.wizardGoto);if(target>current){for(let i=0;i<target;i++)if(!wizardValid(form,i))return;}wizardStep(form,target);return;}
    const link = event.target.closest('[data-recipe-modal]');
    if (link && dialog && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      opener = link;
      if (request) request.abort();
      request = new AbortController();
      const currentRequest = request;
      dialog.classList.toggle('recipe-preview-dialog', link.dataset.recipeModal === 'preview');
      pinPreviewClose();
      const hasCloseButton = !!dialog.querySelector(':scope > [data-close-recipe]:not([hidden])');
      const loadingClose = hasCloseButton ? '' : '<button class="recipe-modal-close recipe-preview-close" type="button" data-close-recipe aria-label="ปิด">×</button>';
      content.setAttribute('aria-busy', 'true');
      dialog.classList.add('recipe-is-loading');
      content.innerHTML = loadingClose + '<div class="recipe-loading-state recipe-simple-loading"><span class="recipe-loading-spinner" aria-hidden="true"></span><p class="recipe-loading-status" role="status">' + (link.dataset.recipeModal === 'form' ? 'กำลังเปิดฟอร์ม…' : 'กำลังเปิดสูตรอาหาร…') + '</p></div>';
      if (!dialog.open) dialog.showModal();
      opened();
      try {
        const url = new URL(link.href);
        url.searchParams.set('fragment', '1');
        const response = await fetch(url, { signal: currentRequest.signal });
        if (!response.ok) throw new Error('ไม่สามารถเปิดสูตรอาหารได้ กรุณาลองใหม่');
        const html = await response.text();
        if (currentRequest !== request || !dialog.open) return;
        dialog.classList.remove('recipe-is-loading');
        content.innerHTML = html;
        pinPreviewClose();
        initWizard();
        loadReviews();
        content.setAttribute('aria-busy', 'false');
        icons();
        const focus = content.querySelector('input:not([type=hidden]), [data-close-recipe]');
        if (focus) focus.focus({ preventScroll: true });
      } catch (error) {
        if (error.name !== 'AbortError' && currentRequest === request && dialog.open) {
          dialog.classList.remove('recipe-is-loading');
          content.setAttribute('aria-busy', 'false');
          content.querySelector('.recipe-loading-skeleton')?.remove();
          const status = content.querySelector('[role=status]');
          if (status) { status.textContent = error.message; status.setAttribute('role', 'alert'); }
        }
      }
      return;
    }
    if (event.target.closest('[data-close-recipe]') && dialog) { event.preventDefault(); dialog.close(); }
    if (event.target.closest('[data-open-filter]') && filter) { filterOpener = event.target.closest('[data-open-filter]'); filter.showModal(); opened(); }
    if (event.target.closest('[data-close-filter]') && filter) closeFilter();
    if (event.target.closest('[data-clear-filters]') && filter) {
      filter.querySelectorAll('input').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = input.value === '';
        else if (input.type === 'range' || input.readOnly) input.value = '0';
        else input.value = '';
      });
      filter.querySelectorAll('.recipe-range-slider').forEach(updateRange);
    }
    const sort = event.target.closest('[data-sort]');
    if (sort) {
      const form = document.getElementById('recipe-browse-form');
      form.elements.sort.value = sort.dataset.sort;
      form.requestSubmit();
    }
    const favorite = event.target.closest('[data-favorite-recipe]');
    if (favorite) {
      event.preventDefault();

      if (favorite.disabled) return;
      favorite.disabled = true;
      const selected = favorite.getAttribute('aria-pressed') !== 'true';
      try {
        const response = await fetch('/recipes/favorites/' + (favorite.dataset.favoriteType || 'local') + '/' + favorite.dataset.favoriteRecipe, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({favorite:selected})});
        if (response.status === 401) { showToast('กรุณาเข้าสู่ระบบก่อนเพิ่มรายการโปรด', 'login'); document.querySelector('[data-open-login]')?.click(); return; }
        if (!response.ok) throw new Error('บันทึกรายการโปรดไม่สำเร็จ กรุณาลองใหม่');
        const result = await response.json();
        favorite.setAttribute('aria-pressed',String(result.favorite));
        favorite.setAttribute('aria-label',result.favorite?'ยกเลิกรายการโปรด':'เพิ่มเป็นรายการโปรด');
        showToast(result.favorite ? 'เพิ่มสูตรนี้ในรายการโปรดแล้ว' : 'นำสูตรนี้ออกจากรายการโปรดแล้ว');
      } catch(error) { showToast(error.message, 'error'); }
      finally { favorite.disabled=false; }
    }
    const purchase = event.target.closest('[data-purchase-recipe]');
    if (purchase) {
      event.preventDefault();
      purchase.disabled=true;
      try {
        const endpoint='/recipes/checkout/'+purchase.dataset.purchaseRecipe;
        const response=await fetch(endpoint);const info=await response.json();if(!response.ok)throw Error(info.error||'เปิดรายการซื้อไม่สำเร็จ');
        if(info.gateway==='omise'){await openPromptpay(info.quoteUrl);return;}
        if(info.owned){const html=await (await fetch('/recipes/'+info.id+'?fragment=1')).text();content.innerHTML=html;pinPreviewClose();loadReviews();icons();return;}
        const checkout=document.createElement('dialog');checkout.className='recipe-dialog recipe-demo-checkout';
        checkout.innerHTML='<h2>ซื้อสูตร · โหมดสาธิต</h2><p class="recipe-checkout-title"></p><strong class="recipe-checkout-price"></strong><p class="recipe-muted">จำลองการซื้อ ไม่มีการเรียกเก็บเงินจริง</p><p role="status"></p><div class="recipe-checkout-actions"><button type="button" class="recipe-btn" data-cancel>ยกเลิก</button><button type="button" class="recipe-btn recipe-primary" data-confirm>ยืนยันซื้อจำลอง</button></div>';
        checkout.querySelector('.recipe-checkout-title').textContent=info.title;checkout.querySelector('.recipe-checkout-price').textContent='฿'+Number(info.price).toLocaleString('th-TH');document.body.append(checkout);checkout.addEventListener('close',()=>checkout.remove());checkout.querySelector('[data-cancel]').onclick=()=>checkout.close();
        checkout.querySelector('[data-confirm]').onclick=async()=>{const button=checkout.querySelector('[data-confirm]');button.disabled=true;try{const res=await fetch(endpoint,{method:'POST',headers:{'X-CSRF-Token':info.csrf}});const result=await res.json();if(!res.ok)throw Error(result.error||'ซื้อไม่สำเร็จ');const html=await (await fetch('/recipes/'+info.id+'?fragment=1')).text();checkout.close();content.innerHTML=html;pinPreviewClose();loadReviews();icons();showToast('ซื้อสูตรจำลองสำเร็จ','recipe');}catch(error){checkout.querySelector('[role=status]').textContent=error.message;button.disabled=false;}};
        checkout.showModal();
      }catch(error){showToast(error.message,'error');}
      finally{purchase.disabled=false;}
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-submit-change]')) event.target.form.requestSubmit();
  });
  document.addEventListener('input', event => {
    if(event.target.matches('[data-recipe-wizard] [name=image]')) wizardImage(event.target.closest('[data-recipe-wizard]'));
    const slider = event.target.closest('.recipe-range-slider');
    if (slider && event.target.type === 'range') {
      const input = slider.parentElement.querySelector('[name="max' + slider.dataset.range + '"]');
      input.value = Number(event.target.value) === 0 ? '' : event.target.value;
      updateRange(slider);
    }
    if (filter && filter.contains(event.target) && event.target.type === 'number' && !event.target.readOnly) {
      const group = event.target.closest('fieldset').querySelector('.recipe-range-slider');
      if (group) {
        const range = group.querySelector('[data-range-max]');
        range.value = event.target.value || 0;
        updateRange(group);
      }
    }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!form.matches('.recipe-form') || !dialog || !dialog.contains(form)) return;
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const url = new URL(form.action);
      url.searchParams.set('fragment', '1');
      const response = await fetch(url, { method: 'POST', body: new URLSearchParams(new FormData(form)) });
      if (response.status === 422) {
        content.innerHTML = await response.text();
        pinPreviewClose();
      initWizard();
        icons();
        content.querySelector('[role=alert]').scrollIntoView({ block: 'nearest' });
        return;
      }
      if (!response.ok) throw new Error('บันทึกไม่สำเร็จ กรุณาลองใหม่หรือเปิดหน้าใหม่');
      const result = await response.json();
      window.location.assign(result.location);
    } catch (error) {
      let alert = form.querySelector('[role=alert]');
      if (!alert) { alert = document.createElement('p'); alert.setAttribute('role', 'alert'); alert.className = 'recipe-alert recipe-error'; form.prepend(alert); }
      alert.textContent = error.message;
      button.disabled = false;
    }
  });
})();
