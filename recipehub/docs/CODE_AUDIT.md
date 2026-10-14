# ตรวจโครงสร้างโปรเจกต์

ตรวจวันที่ 14 ตุลาคม 2026

## โครงสร้างที่ใช้งาน

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| app.js / bin/www | ตั้งค่า middleware, routes และเปิดเซิร์ฟเวอร์ |
| routes/ | รับคำขอ ตรวจสิทธิ์ และส่งข้อมูลหรือหน้าเว็บ |
| services/ | โหลดข้อมูลและตรรกะคอร์ส สูตร การชำระเงิน รีวิว |
| models/ | Mongoose schema และ plugin เลข ID |
| middleware/ | บัญชีปัจจุบัน สิทธิ์เชฟ และ error handler |
| helpers/ | ตัวกรองรายการและ redirect |
| views/ | EJS แยก chef, user และ partial ที่ใช้ร่วมกัน |
| public/javascripts/ | การทำงานฝั่งเบราว์เซอร์ |
| public/stylesheets/ | รูปแบบหน้าเว็บและส่วนประกอบร่วม |
| scripts/ | seed, migration, จัดการรูป และสร้างเคอร์เซอร์ที่รันด้วยมือ |

## สิ่งที่จัดการแล้ว

- ลบคอมเมนต์ใน JavaScript, CSS, EJS, HTML และ inline script ของไฟล์โค้ดที่ตรวจ
- รวมกฎการ์ดคอร์สซ้ำ 11 กฎจาก cookhub.css ไว้ใน catalog-cards.css ที่ทุกหน้าการ์ดคอร์สโหลดร่วมกัน
- รวมกฎ pointer ของตัวเลือก dropdown เข้ากับกฎเคอร์เซอร์กลาง
- ลบ models/PublisherApplication.js ที่ไม่พบการอ้างอิงจากระบบ โดยไม่ลบ collection หรือข้อมูลในฐานข้อมูล
- ลบแพ็กเกจ Bootstrap และ static mount /bootstrap ที่ไม่มีหน้าเว็บเรียกใช้; Bootstrap Icons ผ่าน CDN ยังใช้งาน
- คง scripts สำหรับการบำรุงรักษาที่เรียกด้วยมือ ไม่ถือว่าเป็นไฟล์ตายเพียงเพราะ routes ไม่เรียก

## สิ่งที่ควรแยกไว้

- notifications.js/styles เป็น toast; navNotifications.js/styles เป็นรายการในกระดิ่ง: หน้าที่และวงจรการทำงานต่างกัน
- recipeReviews กับ courseReviews ใช้สิทธิ์และประเภทรีวิวต่างกัน แต่ใช้ partial แสดงรีวิวร่วมกันแล้ว
- chefSupport กับ courseCatalog เป็นข้อมูลสำหรับจัดการของเจ้าของและข้อมูลรายการสาธารณะตามลำดับ
- CSS หน้าสูตรและคอร์สยังมีกฎเฉพาะหน้าที่ใช้จริง จึงไม่รวมทั้งหมดเข้าไฟล์เดียว

## ไฟล์ที่ไม่ลบอัตโนมัติ

- public/uploads และ URL รูปที่บันทึกในฐานข้อมูล
- รูปเคอร์เซอร์และเฟรม loading ที่ประกอบชื่อไฟล์ขณะรัน
- SVG ต้นทางของเคอร์เซอร์ที่ใช้สร้าง PNG
- .vscode และไฟล์ตั้งค่าสภาพแวดล้อม

การไม่มีชื่อไฟล์ตรง ๆ ในโค้ดไม่เพียงพอจะยืนยันว่าไฟล์กลุ่มนี้ไม่ถูกใช้

## การตรวจสอบ

- ตรวจไวยากรณ์ JavaScript/EJS/CSS และ local require/include/asset references ผ่านครบ 127 ไฟล์หลังทำความสะอาด
- ตรวจ Home, Courses, Recipes บนหน้าจอ 1440px และ 390px: HTTP สำเร็จ ไม่มี JavaScript error และไม่มี horizontal overflow
- ตรวจการเข้าหน้า Chef/Profile โดยผู้ไม่ได้เข้าสู่ระบบ: redirect ทำงาน
- render Dashboard จากข้อมูลเชฟจริงแบบอ่านอย่างเดียว และทดสอบ dropdown ช่วงเวลา desktop/mobile: ผ่าน
- ไม่แก้โครงสร้างฐานข้อมูล ไม่เพิ่มหรือแก้ข้อมูลทดสอบ ไม่ commit หรือ push

## งานที่เหมาะกับการปรับครั้งถัดไป

- แยก template courses.ejs ฝั่งเชฟเป็น partial รายการ รายละเอียด และฟอร์ม เพื่ออ่านง่ายขึ้น โดยรักษาตัว controller/DOM ที่ใช้ร่วมกัน
- ค่อย ๆ รวม CSS overrides ตาม component พร้อมเปรียบเทียบภาพก่อนและหลัง เพราะลำดับ cascade กระทบหน้าอื่นได้
- หน้าที่ต้อง login อื่น ๆ ยังควรทดสอบด้วยบัญชีแต่ละสิทธิ์ก่อนย้ายโครงสร้างขนาดใหญ่

## ตรวจไฟล์หลังย้าย Cloudinary

- ลบ cursor-hover.png และ cursor-hover.svg: ไม่ใช่ cursor ที่ CSS เรียกแล้ว
- ลบ scripts/migrateRecipeImages.js: ไม่มีสูตรที่อ้างรูป local ในการตรวจฐานข้อมูลก่อนย้าย
- ลบ cleanupRecipeImages.js และคำสั่ง images:cleanup แล้ว เนื่องจากอัปโหลดใหม่ใช้ Cloudinary เท่านั้น
- public/uploads ถูกนำออกแล้ว; ไฟล์เดิมสำรองใน node_modules/.cache/uploads-local-backup
- ลบ scripts/migrateAvatars.js แล้วตามที่ผู้ใช้เลือกให้เจ้าของ 2 บัญชีอัปโหลดรูปใหม่
- เก็บ seed-courses.js และเครื่องมือสร้างเคอร์เซอร์: เป็นคำสั่งพัฒนาแบบรันด้วยมือ
- cursor-preview.html ไม่พบในโปรเจกต์แล้วขณะตรวจรอบนี้
- node_modules เป็น dependency และ cache ไม่ใช่ source code; สร้างใหม่ได้ด้วย npm ci แต่ cache การย้ายรูปควรเก็บจนกู้รูปครบ
