(() => {
  function renumber(form) {
    form.querySelectorAll('[data-step-label]').forEach((label, i) => { label.textContent = String(i + 1); });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-add], [data-remove-row]');
    if (!button) return;
    const form = button.closest('.recipe-form');
    if (!form) return;
    if (button.hasAttribute('data-add')) {
      const type = button.dataset.add;
      const rows = form.querySelector('[data-rows="' + type + '"]');
      if (rows.children.length >= 100) return;
      const template = form.parentElement.querySelector('[data-template="' + type + '"]');
      rows.appendChild(template.content.cloneNode(true));
      if (window.lucide) window.lucide.createIcons();
      rows.lastElementChild.querySelector('input, textarea').focus();
    } else {
      const row = button.closest('.recipe-row');
      const rows = row.parentElement;
      if (rows.children.length === 1) {
        row.querySelectorAll('input, textarea').forEach(input => { input.value = ''; });
        row.querySelector('input, textarea').focus();
      } else row.remove();
    }
    renumber(form);
  });
})();
