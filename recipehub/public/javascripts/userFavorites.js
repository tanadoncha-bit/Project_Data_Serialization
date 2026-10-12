// userFavorites.js — ปุ่มหัวใจในหน้าของมุกดา (views/user/*) บันทึกลงตาราง Favorite ใน database
// ใช้กับปุ่มที่มี data-fav-url เช่น
//   <button class="fav" data-fav-url="/courses/favorites/single/1">  (คอร์ส  — routes/courses.js)
//   <button class="fav" data-fav-url="/recipes/favorites/local/3">   (สูตร   — routes/recipes.js ของเพื่อน)
// - ฟังคลิกทั้งหน้า (event delegation) จึงใช้ได้กับปุ่มในหน้าต่างเด้งที่โหลดมาทีหลังด้วย
// - กดในหน้าต่างเด้งแล้ว ปุ่มหัวใจของการ์ดเดียวกันในหน้าจะเปลี่ยนตามทันที
// - ยังไม่ login → เปิดหน้าต่าง login ของเพื่อน
// - ปุ่มที่มี data-fav-remove-card → เอาออกแล้วซ่อนการ์ด (ใช้ในแท็บรายการโปรด)
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
    e.preventDefault();          // ปุ่มอยู่ในลิงก์การ์ด กันไม่ให้เปิดหน้ารายละเอียด
    e.stopPropagation();
    if (!loggedIn) {
      const openLogin = document.querySelector('[data-open-login]');
      if (openLogin) openLogin.click(); else location.href = '/home?login=1';
      return;
    }
    if (btn.disabled) return;

    const url = btn.dataset.favUrl;
    const on = !btn.classList.contains('on');
    setAll(url, on);             // เปลี่ยนสีทันที ไม่ต้องรอ
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
      setAll(url, !on);          // บันทึกไม่สำเร็จ → คืนค่าเดิม
      btn.title = err.message || 'บันทึกรายการโปรดไม่สำเร็จ ลองใหม่อีกครั้ง';
    } finally {
      btn.disabled = false;
    }
  }, true);
})();
