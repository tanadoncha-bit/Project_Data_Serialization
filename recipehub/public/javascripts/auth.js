

const modals = {
  login: document.getElementById('loginModal'),
  register: document.getElementById('registerModal'),
  forgot: document.getElementById('forgotModal'),
};


function openModal(name) {
  Object.values(modals).forEach((m) => m && m.open && m.close());
  modals[name].showModal();
}


function handleSubmit(form, url, { onError, onSuccess } = {}) {
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
      const data = await res.json().catch(() => ({}));                                      
      if (!res.ok) {
        errorBox.textContent = data.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
        errorBox.hidden = false;
        if (onError) onError(data);
        return;
      }
      if (data.redirect) return (window.location.href = data.redirect);
      successBox.textContent = data.message;
      successBox.hidden = false;
      if (onSuccess) onSuccess(data);
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


  const loginForm = document.getElementById('loginForm');
  const resendBtn = loginForm.querySelector('[data-resend-verify]');
  let resendEmail = '';
  handleSubmit(loginForm, '/login', {
    onError: (data) => {
      resendEmail = data.resendEmail || '';
      resendBtn.hidden = !resendEmail;
    },
  });
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    const errorBox = loginForm.querySelector('.auth-error');
    const successBox = loginForm.querySelector('.auth-success');
    try {
      const res = await fetch('/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      errorBox.hidden = true;
      successBox.textContent = data.message || data.error || 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง';
      successBox.hidden = false;
      resendBtn.hidden = true;
    } finally {
      resendBtn.disabled = false;
    }
  });

  handleSubmit(regForm, '/register', { onSuccess: () => regForm.reset() });
  handleSubmit(document.getElementById('forgotForm'), '/forgot-password');

  const params = new URLSearchParams(location.search);
  if (params.get('login') === '1') openModal('login');
  if (params.get('register') === '1') openModal('register');
}