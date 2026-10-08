(() => {
  const dialog = document.getElementById('recipe-content-dialog');
  const content = document.getElementById('recipe-modal-content');
  const filter = document.getElementById('recipe-filter-dialog');
  // Close the difficulty picker when clicking elsewhere or pressing Escape.
  const difficultyPicker = document.querySelector('.recipe-difficulty-control');
  if (difficultyPicker) {
    document.addEventListener('click', event => {
      if (!difficultyPicker.contains(event.target)) difficultyPicker.open = false;
    });
    difficultyPicker.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        difficultyPicker.open = false;
        difficultyPicker.querySelector('summary').focus();
      }
    });
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
    const low = slider.querySelector('[data-range-min]');
    const high = slider.querySelector('[data-range-max]');
    const span = Number(low.max) - Number(low.min);
    slider.classList.toggle('is-filtered', low.value !== low.min || high.value !== high.max);
    slider.style.setProperty('--range-low', ((Number(low.value) - Number(low.min)) / span * 100) + '%');
    slider.style.setProperty('--range-high', ((Number(high.value) - Number(low.min)) / span * 100) + '%');
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
    const link = event.target.closest('[data-recipe-modal]');
    if (link && dialog && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      opener = link;
      if (request) request.abort();
      request = new AbortController();
      const currentRequest = request;
      dialog.classList.toggle('recipe-preview-dialog', link.dataset.recipeModal === 'preview');
      content.innerHTML = '<button class="recipe-modal-close" type="button" data-close-recipe aria-label="ปิด">×</button><p role="status">กำลังโหลด...</p>';
      if (!dialog.open) dialog.showModal();
      opened();
      try {
        const url = new URL(link.href);
        url.searchParams.set('fragment', '1');
        const response = await fetch(url, { signal: currentRequest.signal });
        if (!response.ok) throw new Error('ไม่สามารถเปิดสูตรอาหารได้ กรุณาลองใหม่');
        const html = await response.text();
        if (currentRequest !== request || !dialog.open) return;
        content.innerHTML = html;
        icons();
        const focus = content.querySelector('input:not([type=hidden]), [data-close-recipe]');
        if (focus) focus.focus({ preventScroll: true });
      } catch (error) {
        if (error.name !== 'AbortError' && dialog.open) {
          content.querySelector('p').textContent = error.message;
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
        else if (input.type === 'range') input.value = input.hasAttribute('data-range-min') ? input.min : input.max;
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
      // TODO: The team's favorite module can preventDefault on this integration event and persist the selection.
      const handled = !favorite.dispatchEvent(new CustomEvent('cookhub:favorite', { bubbles: true, cancelable: true, detail: { recipeId: Number(favorite.dataset.favoriteRecipe) } }));
      if (!handled) favorite.closest('.recipe-card').querySelector('[data-favorite-status]').textContent = 'รายการโปรดยังไม่เปิดให้ใช้งาน';
    }
    const purchase = event.target.closest('[data-purchase-recipe]');
    if (purchase) {
      // TODO: The purchase team can consume this event to open its checkout flow.
      const handled = !purchase.dispatchEvent(new CustomEvent('cookhub:purchase', { bubbles: true, cancelable: true, detail: { recipeId: Number(purchase.dataset.purchaseRecipe) } }));
      if (!handled) purchase.parentElement.querySelector('[data-purchase-status]').textContent = 'ขณะนี้ยังไม่เปิดให้ซื้อสูตร';
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-submit-change]')) event.target.form.requestSubmit();
  });
  document.addEventListener('input', event => {
    const slider = event.target.closest('.recipe-range-slider');
    if (slider && event.target.type === 'range') {
      const low = slider.querySelector('[data-range-min]');
      const high = slider.querySelector('[data-range-max]');
      if (Number(low.value) > Number(high.value)) event.target.value = event.target === low ? high.value : low.value;
      const side = event.target === low ? 'min' : 'max';
      const input = slider.parentElement.querySelector('[name="' + side + slider.dataset.range + '"]');
      input.value = side === 'max' && event.target.value === event.target.max ? '' : event.target.value;
      updateRange(slider);
    }
    if (filter && filter.contains(event.target) && event.target.type === 'number') {
      const group = event.target.closest('fieldset').querySelector('.recipe-range-slider');
      if (group) {
        const side = event.target.name.startsWith('min') ? 'min' : 'max';
        const range = group.querySelector('[data-range-' + side + ']');
        range.value = event.target.value || (side === 'min' ? range.min : range.max);
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
