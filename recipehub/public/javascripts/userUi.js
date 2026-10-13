// userUi.js — ส่วนโต้ตอบของหน้าผู้ใช้ (views/user/*)
(function () {
  const dialog = document.getElementById('course-dialog');
  const content = document.getElementById('course-dialog-content');
  let request = null;
  let opener = null;

  const icons = () => { if (window.lucide) window.lucide.createIcons(); };

  async function openCourse(href) {
    if (request) request.abort();
    request = new AbortController();
    const mine = request;
    content.innerHTML = '<div class="cm-loading"><span class="cm-spinner" aria-hidden="true"></span><p role="status">กำลังเปิดคอร์ส…</p></div>';
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    try {
      const url = new URL(href, location.href);
      url.searchParams.set('fragment', '1');
      const res = await fetch(url, { signal: mine.signal, headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error(res.status === 404 ? 'ไม่พบคอร์สนี้' : 'เปิดคอร์สไม่สำเร็จ กรุณาลองใหม่');
      const html = await res.text();
      if (mine !== request || !dialog.open) return;
      content.innerHTML = html;
      icons();
      content.scrollTop = 0;
      dialog.scrollTop = 0;
    } catch (err) {
      if (err.name === 'AbortError') return;
      content.innerHTML = '<div class="cm-loading"><p role="alert">' + err.message + '</p>'
        + '<button type="button" class="btn btn--outline" data-close-course>ปิด</button></div>';
    }
  }

  function closeCourse() {
    if (dialog && dialog.open) dialog.close();
  }

  if (dialog && content) {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-course-modal]');
      if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        if (!dialog.open) opener = link;
        openCourse(link.getAttribute('href'));
        return;
      }
      if (e.target.closest('[data-close-course]')) { e.preventDefault(); closeCourse(); return; }
      if (e.target === dialog) closeCourse();
    });
    dialog.addEventListener('close', () => {
      if (request) request.abort();
      content.innerHTML = '';
      document.body.style.overflow = '';
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });
  }

  document.addEventListener('click', (e) => {
    const current = e.target.closest('.level-dd');
    document.querySelectorAll('.level-dd[open]').forEach((dd) => { if (dd !== current) dd.open = false; });
  });
  document.addEventListener('keydown', (e) => {
    const dd = e.target.closest && e.target.closest('.level-dd');
    if (dd && dd.open && e.key === 'Escape') { e.preventDefault(); dd.open = false; dd.querySelector('summary').focus(); }
  });
  document.addEventListener('change', (e) => {
    if (!e.target.matches('.level-dd input[type=radio]')) return;
    const form = e.target.form;
    if (form) form.submit();
  });
})();
