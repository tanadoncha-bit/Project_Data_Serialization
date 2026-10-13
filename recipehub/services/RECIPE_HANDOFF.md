# แจ้งทีมเรื่องหน้าสูตร

ใช้หน้าสูตรหลัก /recipes และย้าย view ไป views/user/recipes แล้ว URL และ API ไม่เปลี่ยน ฝั่งเชฟอยู่ views/chef/recipes และใช้เนื้อหาจาก user/recipes ร่วมกัน

สูตรใหม่ไม่กำหนด level/difficulty ไม่รับจากฟอร์มและไม่ใช้เป็นตัวกรอง เก็บค่าเก่าไว้ ไม่ย้ายหรือลบข้อมูลเก่าใน MongoDB

ฝากเจ้าของหน้าคอร์สเอาป้ายระดับและตัวกรองระดับออกจาก views/user/courses.ejs และ views/user/course-detail.ejs รวมถึง fallback BEGINNER ใน services/courseCatalog.js และการใช้ difficulty ใน services/userPages.js ตามที่ทีมเลิกใช้งานแล้ว ตรวจ helper ร่วมก่อนแก้

views/user/recipes.ejs เดิมไม่ถูก render แล้ว /user/recipes ส่งต่อ /recipes ไม่ต้องพัฒนาหน้าซ้ำต่อ

ตั้ง KKU_AI_API_KEY, KKU_AI_BASE_URL=https://gen.ai.kku.ac.th/api/v1 และ KKU_AI_MODEL=gemini-3.8-flash ใน .env เพื่อใช้ผู้ช่วย ห้าม commit คีย์จริง ทดสอบด้วย npm test, npm run test:assistant และ npm run test:browser

ยังมีรูปสูตร 1 รายการและ avatar 3 บัญชีที่ไฟล์ต้นทางหาย ต้องให้เจ้าของเลือกรูปใหม่ ไม่แทนรูปให้เอง
