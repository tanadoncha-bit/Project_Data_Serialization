// auth.js — เปิด/ปิด modal Login + Register และส่งฟอร์มไปเซิร์ฟเวอร์

const modals = {
  login: document.getElementById('loginModal'),
  register: document.getElementById('registerModal'),
  forgot: document.getElementById('forgotModal'),
};

/** ปิด modal ที่เปิดอยู่ แล้วเปิดตัวที่ต้องการ (ใช้ตอนสลับ login ↔ register) */
function openModal(name) {
  Object.values(modals).forEach((m) => m && m.open && m.close());
  modals[name].showModal();
}

/** ส่งข้อมูลฟอร์มเป็น JSON ไปที่ url ผ่านแล้วไปหน้าที่เซิร์ฟเวอร์บอก หรือโชว์ข้อความสำเร็จ ไม่ผ่านโชว์ error */
function handleSubmit(form, url) {
  const errorBox = form.querySelector('.auth-error');
  const successBox = form.querySelector('.auth-success');
  const submitBtn = form.querySelector('.auth-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    if (successBox) successBox.hidden = true;
    submitBtn.disabled = true;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({})); // เซิร์ฟเวอร์ตอบไม่ใช่ JSON ก็ไม่พัง
      if (!res.ok) {
        errorBox.textContent = data.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
        errorBox.hidden = false;
        return;
      }
      if (data.redirect) return (window.location.href = data.redirect);
      successBox.textContent = data.message;
      successBox.hidden = false;
    } catch (err) {
      errorBox.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง';
      errorBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

if (modals.login && modals.register) {
  document.querySelectorAll('[data-open-login], [data-open-register], [data-open-forgot]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(el.hasAttribute('data-open-login') ? 'login' : el.hasAttribute('data-open-forgot') ? 'forgot' : 'register');
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
