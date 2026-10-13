// coursePurchase.js — ปุ่ม "ซื้อคอร์สนี้" (data-buy-course data-kind="single|multi" data-id="1")
(function () {
  const icons = () => { if (window.lucide) window.lucide.createIcons(); };
  const baht = n => '฿' + Number(n).toLocaleString('th-TH');

  let toastTimer;
  function toast(message, isError) {
    let el = document.getElementById('ck-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ck-toast';
      el.className = 'ck-toast';
      el.setAttribute('role', 'status');
    }
    const host = document.querySelector('#course-dialog[open]') || document.body;
    if (el.parentNode !== host) host.append(el);
    el.textContent = message;
    el.classList.toggle('is-error', Boolean(isError));
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function openLogin() {
    const btn = document.querySelector('[data-open-login]');
    if (btn) btn.click(); else location.href = '/home?login=1';
  }

  async function getJson(url, options) {
    const res = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, options));
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.login) { openLogin(); throw Object.assign(new Error(data.error), { quiet: true }); }
    if (!res.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่');
    return data;
  }

  /** หลังซื้อสำเร็จ: กดจากหน้าต่างเด้ง → โหลดเนื้อหาคอร์สใหม่ / หน้าเต็ม → รีเฟรช */
  async function afterPurchase(button, url, message) {
    const content = button.closest('#course-dialog-content');
    if (content && content.isConnected) {
      try {
        const res = await fetch(url + '?fragment=1', { headers: { Accept: 'text/html' } });
        if (res.ok) { content.innerHTML = await res.text(); icons(); }
      } catch (_) {}
      toast(message);
    } else {
      sessionStorageSet('ck-toast', message);
      location.reload();
    }
  }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  try { const m = sessionStorage.getItem('ck-toast'); if (m) { sessionStorage.removeItem('ck-toast'); toast(m); } } catch (_) {}

  function makeDialog(className, html) {
    const d = document.createElement('dialog');
    d.className = 'ck-pay ' + className;
    d.innerHTML = html;
    document.body.append(d);
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    return d;
  }

  /* ---------- ซื้อจำลอง (ไม่มี Omise key + RECIPE_DEMO_PAYMENTS=true) ---------- */
  function openDemo(info, button) {
    const d = makeDialog('ck-pay--demo',
      '<h2>ซื้อคอร์ส · โหมดสาธิต</h2><p class="ck-pay__title"></p><strong class="ck-pay__price"></strong>'
      + '<p class="ck-pay__muted">จำลองการซื้อ ไม่มีการเรียกเก็บเงินจริง</p><p class="ck-pay__status" role="status"></p>'
      + '<div class="ck-pay__actions"><button type="button" class="btn btn--outline" data-cancel>ยกเลิก</button>'
      + '<button type="button" class="btn btn--primary" data-confirm>ยืนยันซื้อจำลอง</button></div>');
    d.querySelector('.ck-pay__title').textContent = info.title;
    d.querySelector('.ck-pay__price').textContent = baht(info.price);
    d.querySelector('[data-cancel]').onclick = () => d.close();
    const confirm = d.querySelector('[data-confirm]');
    confirm.onclick = async () => {
      confirm.disabled = true;
      try {
        await getJson('/courses/checkout/' + info.kind + '/' + info.id, { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF-Token': info.csrf } });
        d.close();
        await afterPurchase(button, info.url, 'ซื้อคอร์สจำลองสำเร็จ เริ่มเรียนได้เลย');
      } catch (err) {
        d.querySelector('.ck-pay__status').textContent = err.message;
        confirm.disabled = false;
      }
    };
    d.showModal();
  }

  /* ---------- QR PromptPay (Omise) — หน้าตาเดียวกับหน้าต่างชำระเงินสูตร ---------- */
  function openPromptpay(info, button) {
    const d = makeDialog('ck-pay--qr',
      '<button type="button" class="ck-pay__close" aria-label="ปิดการจ่ายเงิน">×</button>'
      + '<div class="ck-pay__brand">CookHub <span>CHECKOUT</span></div><h2>ชำระเงิน</h2>'
      + '<div class="ck-pay__summary"><span class="ck-pay__label">' + (info.kind === 'multi' ? 'แพ็กคอร์ส' : 'คอร์สเรียน') + '</span>'
      + '<p class="ck-pay__title"></p><div class="ck-pay__total"><span>ยอดชำระทั้งหมด</span><strong class="ck-pay__price"></strong></div></div>'
      + '<div class="ck-pay__method"><span class="ck-pay__mark">QR</span><div><strong>PromptPay</strong><small>สแกนผ่านแอปธนาคาร</small></div></div>'
      + '<div class="ck-pay__qr" hidden><img alt="QR สำหรับชำระค่าคอร์ส"><span class="ck-pay__countdown"></span></div>'
      + '<p class="ck-pay__status" role="status" aria-live="polite"></p>'
      + '<button type="button" class="btn btn--primary ck-pay__create" data-create-qr>แสดง QR สำหรับชำระเงิน</button>'
      + '<div class="ck-pay__footer">ระบบจะเปิดคอร์สให้เมื่อยืนยันการชำระเงินสำเร็จ</div>');
    d.querySelector('.ck-pay__title').textContent = info.title;
    d.querySelector('.ck-pay__price').textContent = baht(info.activeOrder ? info.activeOrder.amount : info.price);

    const status = d.querySelector('.ck-pay__status');
    const create = d.querySelector('[data-create-qr]');
    let pollTimer, clockTimer, orderId;
    const stop = () => { clearTimeout(pollTimer); clearInterval(clockTimer); };
    d.addEventListener('close', stop);
    d.querySelector('.ck-pay__close').onclick = () => d.close();

    function show(order) {
      if (order.qrUrl) { d.querySelector('.ck-pay__qr').hidden = false; d.querySelector('.ck-pay__qr img').src = order.qrUrl; }
      clearInterval(clockTimer);
      const clock = () => {
        if (!order.expiresAt) return;
        const s = Math.max(0, Math.ceil((new Date(order.expiresAt) - Date.now()) / 1000));
        d.querySelector('.ck-pay__countdown').textContent = s ? 'เหลือ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : 'QR หมดเวลา กำลังตรวจสอบสถานะ';
      };
      clock();
      clockTimer = setInterval(clock, 1000);
    }

    async function check() {
      if (!d.open) return;
      try {
        const order = await getJson('/courses/payments/' + orderId);
        if (!d.open) return;
        if (order.status === 'paid') {
          stop(); d.close();
          await afterPurchase(button, info.url, info.test ? 'ทดสอบจ่ายเงินสำเร็จ เริ่มเรียนได้เลย' : 'ชำระเงินสำเร็จ เริ่มเรียนได้เลย');
          return;
        }
        if (order.status === 'failed' || order.status === 'expired') {
          stop();
          d.querySelector('.ck-pay__qr').hidden = true;
          status.textContent = order.status === 'expired' ? 'QR หมดอายุ กรุณาขอ QR ใหม่' : 'การชำระเงินไม่สำเร็จ กรุณาลองอีกครั้ง';
          d.dataset.paymentState = order.status;
          create.textContent = 'ขอ QR ใหม่'; create.hidden = false; create.disabled = false;
          return;
        }
        show(order);
        d.dataset.paymentState = order.status;
        status.textContent = order.status === 'creating' ? 'กำลังเตรียม QR สำหรับคุณ' : 'รอการยืนยันชำระเงิน';
      } catch (err) {
        status.textContent = err.message + ' ระบบจะตรวจสอบอีกครั้ง';
      }
      pollTimer = setTimeout(check, 5000);
    }

    create.onclick = async () => {
      create.disabled = true;
      d.dataset.paymentState = 'creating';
      status.textContent = 'กำลังเตรียม QR สำหรับคุณ…';
      try {
        const order = await getJson('/courses/checkout/' + info.kind + '/' + info.id + '/qr', { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF-Token': info.csrf } });
        if (!d.open) return;
        orderId = order.id;
        create.hidden = true;
        show(order);
        await check();
      } catch (err) {
        status.textContent = err.message;
        create.disabled = false;
      }
    };

    d.showModal();
    if (info.activeOrder) { orderId = info.activeOrder.id; create.hidden = true; show(info.activeOrder); check(); }
  }

  document.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-buy-course]');
    if (!button) return;
    e.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    try {
      const info = await getJson('/courses/checkout/' + button.dataset.kind + '/' + button.dataset.id);
      if (info.owned) { location.href = info.url; return; }
      if (info.gateway === 'omise') openPromptpay(info, button);
      else openDemo(info, button);
    } catch (err) {
      if (!err.quiet) toast(err.message, true);
    } finally {
      button.disabled = false;
    }
  });
})();
