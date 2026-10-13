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

/* ---------- รูปโปรไฟล์: ย่อรูปในเบราว์เซอร์ แล้วส่งไปพร้อมฟอร์ม ---------- */
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const avatarData = document.getElementById('avatarData');
const avatarNote = document.getElementById('avatarNote');

/**
 * ครอปรูปเป็นสี่เหลี่ยมจัตุรัสตรงกลาง ย่อเหลือ 200x200 แล้วแปลงเป็น JPEG (data URL)
 * ทำให้ไฟล์เล็ก (~15KB) เก็บใน MongoDB ได้โดยไม่ต้องมีระบบอัปโหลดไฟล์
 */
function resizeImage(file, size = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

if (avatarInput) {
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await resizeImage(file);
      avatarData.value = dataUrl;
      avatarPreview.src = dataUrl;
      avatarPreview.hidden = false;
      // Lucide แปลง <i> เป็น <svg> ไปแล้ว เลยต้องหาด้วย class แทน id
      document.querySelector('.avatar-placeholder')?.setAttribute('hidden', '');
      if (avatarNote) avatarNote.hidden = false;
    } catch (err) {
      if (avatarNote) { avatarNote.textContent = 'อ่านไฟล์รูปไม่ได้ ลองเลือกรูปอื่น'; avatarNote.hidden = false; }
    }
  });
}
