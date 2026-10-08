// auth.js — เปิด/ปิด modal Login + Register และส่งฟอร์มไปเซิร์ฟเวอร์

const modals = {
  login: document.getElementById('loginModal'),
  register: document.getElementById('registerModal'),
};

/** ปิด modal ที่เปิดอยู่ แล้วเปิดตัวที่ต้องการ (ใช้ตอนสลับ login ↔ register) */
function openModal(name) {
  Object.values(modals).forEach((m) => m && m.open && m.close());
  modals[name].showModal();
}

/** ส่งข้อมูลฟอร์มเป็น JSON ไปที่ url ถ้าผ่านให้ไปหน้าที่เซิร์ฟเวอร์บอก ถ้าไม่ผ่านโชว์ error */
function handleSubmit(form, url) {
  const errorBox = form.querySelector('.auth-error');
  const submitBtn = form.querySelector('.auth-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    submitBtn.disabled = true;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json();
      if (!res.ok) {
        errorBox.textContent = data.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
        errorBox.hidden = false;
        return;
      }
      window.location.href = data.redirect;
    } catch (err) {
      errorBox.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง';
      errorBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

if (modals.login && modals.register) {
  document.querySelectorAll('[data-open-login], [data-open-register]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(el.hasAttribute('data-open-login') ? 'login' : 'register');
    });
  });

  Object.values(modals).forEach((modal) => {
    modal.querySelector('[data-close-auth]').addEventListener('click', () => modal.close());
    modal.addEventListener('cancel', (e) => e.preventDefault());
  });

  const regForm = document.getElementById('registerForm');
  const chefBox = regForm.querySelector('.auth-chef-box');
  modals.register.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      modals.register.querySelectorAll('.auth-tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab);
      });
      regForm.role.value = tab.dataset.role;
      chefBox.hidden = tab.dataset.role !== 'chef';
    });
  });

  handleSubmit(document.getElementById('loginForm'), '/login');
  handleSubmit(regForm, '/register');

  const params = new URLSearchParams(location.search);
  if (params.get('login') === '1') openModal('login');
  if (params.get('register') === '1') openModal('register');
}
