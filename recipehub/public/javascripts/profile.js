// profile.js — การทำงานฝั่งเบราว์เซอร์ของหน้าโปรไฟล์

/* ---------- ตัวนับตัวอักษรของช่องแนะนำตัว ---------- */
const bio = document.getElementById('bio');
const bioCount = document.getElementById('bioCount');

/** อัปเดตตัวเลข x/300 ตามจำนวนตัวอักษรที่พิมพ์ */
function updateBioCount() {
  bioCount.textContent = bio.value.length;
}

if (bio && bioCount) {
  updateBioCount(); // นับครั้งแรกตอนเปิดหน้า (กรณีมีข้อความเดิมอยู่แล้ว)
  bio.addEventListener('input', updateBioCount);
}

/* ---------- พรีวิวรูปโปรไฟล์ ---------- */
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');

/** เมื่อเลือกไฟล์รูป แสดงรูปนั้นในวงกลมทันที (ยังไม่ได้อัปโหลดขึ้นเซิร์ฟเวอร์) */
if (avatarInput) {
  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    avatarPreview.src = URL.createObjectURL(file);
    avatarPreview.hidden = false;
    // Lucide แปลง <i> เป็น <svg> ไปแล้ว เลยต้องหาด้วย class แทน id
    document.querySelector('.avatar-placeholder')?.setAttribute('hidden', '');
  });
}