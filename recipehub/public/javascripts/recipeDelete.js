(() => {
  const dialog = document.getElementById('recipe-delete-dialog');
  if (!dialog) return;
  let pending;
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-delete-recipe]');
    if (!form) return;
    event.preventDefault();
    pending = form;
    document.getElementById('recipe-delete-name').textContent = form.dataset.title || 'สูตรอาหาร';
    document.getElementById('recipe-delete-summary').textContent = form.dataset.summary || '';
    const image = document.getElementById('recipe-delete-image');
    image.hidden = !/^https?:\/\//i.test(form.dataset.image || '');
    if (!image.hidden) image.src = form.dataset.image;
    else image.removeAttribute('src');
    dialog.showModal();
    document.body.classList.add('recipe-modal-open');
    document.getElementById('recipe-delete-cancel').focus();
  });
  ['recipe-delete-cancel', 'recipe-delete-close'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('close', () => {
    pending = null;
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('recipe-modal-open');
  });
  document.getElementById('recipe-delete-confirm').addEventListener('click', () => {
    if (pending) {
      document.getElementById('recipe-delete-confirm').disabled = true;
      pending.submit();
    }
  });
})();
