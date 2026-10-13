// navbar.js — ควบคุมการเปิด/ปิดเมนูโปรไฟล์ใน navbar

const profileToggle = document.getElementById('profileToggle');
const profileMenu = document.getElementById('profileMenu');

/** เปิดหรือปิดเมนูโปรไฟล์ และอัปเดต aria-expanded ให้ตรงสถานะ */
function setProfileMenu(isOpen) {
  profileMenu.classList.toggle('open', isOpen);
  profileToggle.setAttribute('aria-expanded', isOpen);
}

// ทำงานเฉพาะหน้าที่มีปุ่มโปรไฟล์
if (profileToggle && profileMenu) {
  /** กดรูปโปรไฟล์ → สลับเปิด/ปิด */
  profileToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // กันไม่ให้ไปโดน listener ของ document ด้านล่าง
    setProfileMenu(!profileMenu.classList.contains('open'));
  });

  /** คลิกที่ไหนก็ได้นอกเมนู → ปิด */
  document.addEventListener('click', (e) => {
    if (!profileMenu.contains(e.target)) setProfileMenu(false);
  });

  /** กด Esc → ปิด */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setProfileMenu(false);
  });
}
const mobileToggle=document.querySelector('.nav-mobile-toggle');
const mobileNav=document.getElementById('cookhubNavMenu');
function closeMobileNav(){if(!mobileToggle||!mobileNav)return;mobileNav.classList.remove('mobile-open');mobileToggle.setAttribute('aria-expanded','false');}
if(mobileToggle&&mobileNav){mobileToggle.addEventListener('click',()=>{const open=mobileToggle.getAttribute('aria-expanded')!=='true';mobileNav.classList.toggle('mobile-open',open);mobileToggle.setAttribute('aria-expanded',String(open));if(profileMenu&&profileToggle)setProfileMenu(false);});document.addEventListener('click',event=>{if(!mobileToggle.contains(event.target)&&!mobileNav.contains(event.target))closeMobileNav();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileToggle.getAttribute('aria-expanded')==='true'){closeMobileNav();mobileToggle.focus();}});window.addEventListener('resize',()=>{if(innerWidth>720)closeMobileNav();});}
