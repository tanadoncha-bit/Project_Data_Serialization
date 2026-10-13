// userFavorites.js — ปุ่มหัวใจในหน้าของมุกดา (views/user/*) บันทึกลงตาราง Favorite ใน database
// ใช้กับปุ่มที่มี data-fav-url เช่น
//   <button class="fav" data-fav-url="/courses/favorites/single/1">  (คอร์ส  — routes/courses.js)
//   <button class="fav" data-fav-url="/recipes/favorites/local/3">   (สูตร   — routes/recipes.js ของเพื่อน)
// ถ้ายังไม่ login → เปิดหน้าต่าง login ของเพื่อน
// ถ้าปุ่มมี data-fav-remove-card → เอาออกแล้วซ่อนการ์ดไปด้วย (ใช้ในแท็บรายการโปรด)
(function () {
  const loggedIn = document.body.dataset.loggedIn === 'true';

  document.querySelectorAll('[data-fav-url]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();          // ปุ่มอยู่ในลิงก์การ์ด กันไม่ให้เปิดหน้ารายละเอียด
      e.stopPropagation();
      if (!loggedIn) {
        const openLogin = document.querySelector('[data-open-login]');
        if (openLogin) openLogin.click(); else location.href = '/home?login=1';
        return;
      }

      const on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);            // เปลี่ยนสีทันที ไม่ต้องรอ
      btn.disabled = true;
      try {
        const res = await fetch(btn.dataset.favUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ favorite: on }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
        btn.setAttribute('aria-pressed', on);
        if (!on && btn.hasAttribute('data-fav-remove-card')) {
          const card = btn.closest('.card');
          if (card) card.remove();
        }
      } catch (err) {
        btn.classList.toggle('on', !on);         // บันทึกไม่สำเร็จ → คืนค่าเดิม
        btn.title = err.message || 'บันทึกรายการโปรดไม่สำเร็จ ลองใหม่อีกครั้ง';
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
