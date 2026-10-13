// userFavorites.js — ปุ่มหัวใจในหน้าผู้ใช้ (views/user/*) บันทึกลงตาราง Favorite ใน database
(function () {
  const loggedIn = document.body.dataset.loggedIn === 'true';

  function setAll(url, on) {
    document.querySelectorAll('[data-fav-url]').forEach((b) => {
      if (b.dataset.favUrl !== url) return;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fav-url]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!loggedIn) {
      const openLogin = document.querySelector('[data-open-login]');
      if (openLogin) openLogin.click(); else location.href = '/home?login=1';
      return;
    }
    if (btn.disabled) return;

    const url = btn.dataset.favUrl;
    const on = !btn.classList.contains('on');
    setAll(url, on);
    btn.disabled = true;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ favorite: on }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      if (!on && btn.hasAttribute('data-fav-remove-card')) {
        const card = btn.closest('.card');
        if (card) card.remove();
      }
    } catch (err) {
      setAll(url, !on);
      btn.title = err.message || 'บันทึกรายการโปรดไม่สำเร็จ ลองใหม่อีกครั้ง';
    } finally {
      btn.disabled = false;
    }
  }, true);
})();
