# การตั้งค่า PromptPay สำหรับ CookHub

ภาพรวมระบบสูตรอาหารอยู่ใน [RECIPE.md](RECIPE.md)

## 1. สมัครบัญชีทดสอบ

สมัครที่ https://dashboard.omise.co/signup และยืนยันอีเมล จากนั้นเข้า Test dashboard
เอกสารทางการ: https://docs.omise.co/how-do-i-sign-up-for-test-account

Test account ไม่รับเงินจริงและไม่เชื่อมกับแอปธนาคารจริง ใช้เพื่อทดสอบ flow ก่อนเปิด Live Account

## 2. ตั้งค่าคีย์ทดสอบในเครื่อง

ไป API > Keys ใน Test dashboard แล้วคัดลอก Secret key ที่ขึ้นต้น skey_test_ ใส่ใน recipehub/.env:

OMISE_MODE=test
OMISE_SECRET_KEY=ใส่_test_secret_key_ที่นี่
OMISE_WEBHOOK_SECRET=ใส่_webhook_secret_แบบ_base64_จาก_dashboard_ถ้ามี
OMISE_LIVE_PAYMENTS=false

ตัวอย่างชื่อ setting อยู่ใน .env.payments.example อย่าส่ง secret key ในแชตหรือ commit .env
ระบบสร้าง source+charge จาก server จึงไม่ต้องส่ง public/secret key ให้ browser
รีสตาร์ต npm run dev หลังแก้ .env เมื่อ test key ถูกต้อง ปุ่มซื้อจะเลือก QR แทนการซื้อจำลอง

## 3. ทดสอบ QR

เข้าสู่ระบบบัญชีผู้ใช้ เปิดสูตรที่มีราคา แล้วกดซื้อ > สร้าง QR
Omise PromptPay รองรับราคา 20–150,000 บาท และ QR ของเราตั้งหมดอายุ 15 นาที
ใน Test dashboard เปิด charge แล้วเลือก Actions > Successful หรือ Failed เพื่อจำลองผล
ห้ามสแกน test QR เพื่อโอนเงินจริง ระบบจะตรวจสถานะจาก Omise ทุก 5 วินาทีขณะ modal เปิด
ถ้าปิดแล้วเปิดใหม่จะนำคำสั่งซื้อที่ยังค้างอยู่กลับมา ไม่สร้าง charge ใหม่ซ้ำ

อ้างอิง: https://docs.omise.co/promptpay

## 4. เชื่อม webhook

บน URL ของเว็บที่เข้าถึงได้จากภายนอกและใช้ HTTPS ตั้ง Test webhook เป็น:
https://YOUR_HOST/payments/omise/webhook

localhost รับ webhook จากภายนอกไม่ได้ ใช้ hosting ทดสอบหรือ HTTPS tunnel ที่เลือกเอง
ตั้ง webhook secret ใน Dashboard และใส่ค่าเดียวกันใน OMISE_WEBHOOK_SECRET
เมื่อมี secret ระบบตรวจ HMAC-SHA256 กับ raw body และ timestamp (5 นาที)
หาก Test account ยังไม่มี secret ระบบตรวจ event ผ่าน Events API ก่อนตรวจ charge ซ้ำ
ทุกครั้งตรวจ charge ID, amount, currency, livemode, PromptPay source และ metadata.orderId ให้ตรงกับ DB
ไม่เชื่อสถานะ successful ที่ส่งจาก browser หรือ webhook โดยตรง
อ้างอิง: https://docs.omise.co/api-webhooks

## 5. เปิดรับเงินจริงภายหลัง

ต้องสมัครและได้รับอนุมัติ Live Account และเปิด PromptPay กับ Omise ก่อน
เปลี่ยน OMISE_MODE=live, ใช้ skey_live_, ตั้ง live webhook secret และ OMISE_LIVE_PAYMENTS=true
ทดสอบและตรวจ config บน HTTPS deployment ก่อนเปิดให้ผู้ใช้จริง
Test/demo Transaction ไม่ปลดล็อกสูตรใน NODE_ENV=production

## ข้อมูลและการกู้คืน

PaymentOrder เก็บราคาเป็นสตางค์, buyer, recipeId, chargeId, QR URL, expiry, status และ livemode
หนึ่ง buyer/recipe/mode มี active order ได้หนึ่งรายการ ป้องกันการกดซ้ำหรือพร้อมกัน
สร้าง Transaction เมื่อ charge ถูกยืนยันว่า paid+successful เท่านั้น โหมดทดสอบใช้ paymentMode=gateway-test
ราคาอ่านจาก Recipe ฝั่ง server และ snapshot ตอนสร้าง order ไม่ใช้จำนวนเงินจาก browser
ถ้า request สร้าง charge timeout โดยไม่ทราบผล ระบบเก็บสถานะ creating ไว้เพื่อไม่เสี่ยงสร้างซ้ำ
ให้ตรวจ Dashboard: ถ้ามี charge webhook จะผูกกลับด้วย metadata.orderId หากไม่มี ต้องตรวจสอบให้แน่ก่อนยกเลิก active order ผ่านผู้ดูแล (ยังไม่มี UI ผู้ดูแลสำหรับกรณีนี้)
Webhook ซ้ำและสถานะเก่าจะไม่สร้างสิทธิ์ซ้ำหรือลด paid กลับเป็น pending
ยังไม่ทำ refund automation: PromptPay ไม่รองรับ void/refund ผ่าน Omise ตามเอกสาร ต้องกำหนดกระบวนการคืนเงินแยกก่อนเปิดร้านจริง

## การทดสอบ

npm test รวม PromptPay integration โดย gateway จำลองและ MongoDB จำลอง
npm run test:browser ตรวจ QR modal, pending ไม่ปลดล็อก, verified success ปลดล็อก และการปิด modal
ไม่มีการเรียกเก็บเงินจริงใน tests และไม่มี test key ของผู้ใช้ถูกใช้ใน tests
ทดสอบกับ Omise ในโหมด Test แล้วทั้ง Successful, Failed และ Expired รวมถึงปิด/เปิดหน้าชำระเงินโดยใช้คำสั่งซื้อเดิม ส่วน webhook ผ่าน HTTPS และการรับเงินจริงเก็บไว้ตรวจเมื่อ Deploy
