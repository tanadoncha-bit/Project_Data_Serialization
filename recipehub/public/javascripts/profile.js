// profile.js — การทำงานฝั่งเบราว์เซอร์ของหน้าโปรไฟล์

const bio = document.getElementById('bio');
const bioCount = document.getElementById('bioCount');

function updateBioCount() {
  bioCount.textContent = bio.value.length;
}

if (bio && bioCount) {
  updateBioCount(); 
  bio.addEventListener('input', updateBioCount);
}

/* ---------- อัปโหลดรูปโปรไฟล์ ---------- */
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const avatarStatus = document.getElementById('avatarStatus');

if (avatarInput) {
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    avatarStatus.textContent = 'กำลังอัปโหลด...';
    const body = new FormData();
    body.append('avatar', file);
    try {
      const res = await fetch('/profile/avatar', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      avatarPreview.src = data.avatar;
      avatarPreview.hidden = false;
    
      document.querySelector('.avatar-placeholder')?.setAttribute('hidden', '');
      avatarStatus.textContent = '';
    } catch (err) {
      avatarStatus.textContent = err.message || 'อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง';
    } finally {
      avatarInput.value = ''; 
    }
  });
}

/* ---------- แท็บ ข้อมูลส่วนตัว / รายการโปรด / ประวัติการซื้อ ---------- */
const tabs = document.querySelectorAll('.profile-tab');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    });
  });
});
