# รูปสูตรบน Cloudinary

ตั้ง CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY และ CLOUDINARY_API_SECRET ใน .env แล้วรีสตาร์ตเว็บ ห้าม commit คีย์จริง

เมื่อค่าครบ รูปใหม่ส่งจากเซิร์ฟเวอร์ขึ้น Cloudinary และเก็บ HTTPS URL ใน Recipe.image ไม่ต้องเปลี่ยนโครงสร้างฐานข้อมูล รูปเดิมในเครื่องยังใช้ได้ ไม่ได้ย้ายหรือลบอัตโนมัติ

ใช้ SHA-256 ของรูปเป็น public_id ใน cookhub/recipes และ overwrite=false เพื่อใช้รูปเดิมเมื่อเนื้อหาซ้ำ หากตั้งค่าไม่ครบหรือ cloud ล้มเหลวจะรายงานข้อผิดพลาด ไม่แอบบันทึก local แทน หากไม่มีค่า Cloudinary ทั้งสามตัวจะใช้ local แบบเดิม

ลบรูปบน cloud ด้วยความระวัง เพราะหลายสูตรอาจใช้รูปเดียวกัน คำสั่ง images:cleanup จัดการเฉพาะไฟล์ local

ทดสอบแบบไม่ใช้บัญชีจริง: node tests/cloudinaryRecipeImages.test.js

อ้างอิง: https://cloudinary.com/documentation/upload_images และ https://cloudinary.com/documentation/image_upload_api_reference

## รูปโปรไฟล์

POST /profile/avatar ใช้ Cloudinary เช่นเดียวกัน แยก public_id ใน cookhub/avatars ตรวจชนิดไฟล์และจำกัด 2 MB เก็บ URL ใน Client.avatar ถ้าไม่ได้ตั้ง cloud ใช้ local เดิม ไม่ลบรูปเดิมอัตโนมัติเพราะอาจมีผู้ใช้อื่นอ้างอิง

ย้ายรูปเดิมด้วย node scripts/migrateAvatars.js มีบันทึกก่อนย้ายใน node_modules/.cache/avatar-migration-*.json และเก็บไฟล์ local ไว้ รูปที่หาไฟล์ไม่พบไม่เปลี่ยน URL ต้องให้เจ้าของเลือกรูปใหม่
