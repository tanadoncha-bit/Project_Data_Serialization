# Deploy CookHub บน Render

## ตำแหน่งเซิร์ฟเวอร์

เลือก Singapore สำหรับผู้ใช้หลักในไทย และเลือก MongoDB Atlas ภูมิภาค Singapore ด้วยถ้าสร้างคลัสเตอร์ใหม่ เพื่อให้แอปติดต่อฐานข้อมูลได้ใกล้กัน ถ้าฐานข้อมูลเดิมอยู่ภูมิภาคอื่น ให้ตรวจใน Atlas ก่อน; งานนี้ยังไม่ได้ย้ายภูมิภาคฐานข้อมูลหรือสร้างคลัสเตอร์ใหม่

Region คือตำแหน่งเครื่องเซิร์ฟเวอร์ ไม่ใช่ timezone ของข้อมูล เวลาใน MongoDB ยังใช้ UTC และหน้ากราฟจัดวันตามไทยตามเดิม

## ไฟล์ที่เตรียม

- render.yaml: Web Service แบบ Free, Singapore, Node 24, health check /healthz
- .node-version และ package.json: กำหนด Node 24.x
- .env.example: รายชื่อ environment โดยไม่มีค่าลับ
- Session cookie เป็น Secure ใน production และ Express เชื่อ proxy HTTPS
- /healthz คืน 200 เมื่อ MongoDB เชื่อมต่อแล้ว และ 503 เมื่อยังไม่พร้อม โดยไม่ต้อง login
- APP_URL ถ้าไม่ได้ตั้ง จะใช้ RENDER_EXTERNAL_URL อัตโนมัติสำหรับลิงก์อีเมล

## สร้างบริการ

1. นำโค้ดที่ตรวจแล้วขึ้น GitHub branch ที่ต้องการ deploy; งานนี้ยังไม่ได้ commit/push
2. Render > New > Blueprint > เชื่อม repository และเลือก branch
3. ตั้ง Blueprint Path เป็น recipehub/render.yaml เพราะ Git root ของโปรเจกต์ปัจจุบันอยู่เหนือโฟลเดอร์ recipehub หนึ่งชั้น
4. Blueprint กำหนด rootDir: recipehub ไว้แล้ว ถ้าย้าย repository ให้ recipehub เป็น root ต้องเปลี่ยน rootDir เป็น . และใช้ Blueprint Path render.yaml
5. กรอก Environment ที่ระบบถามตามตารางด้านล่าง แล้ว Deploy

ถ้าสร้างด้วย New > Web Service เอง ให้เลือก:

| ช่อง | ค่า |
| --- | --- |
| Root Directory | recipehub |
| Language | Node |
| Region | Singapore |
| Build Command | npm ci --omit=dev |
| Start Command | npm start |
| Instance | Free |
| Health Check Path | /healthz |

ไม่ต้องกำหนด PORT เอง ให้ Render กำหนดให้ และไม่ต้องใช้ Persistent Disk เพราะรูปอยู่ Cloudinary

## Environment

| ตัวแปร | วิธีตั้ง |
| --- | --- |
| NODE_ENV | production |
| SESSION_SECRET | Blueprint สุ่มให้; ถ้าตั้งเองใช้ค่าสุ่มอย่างน้อย 32 ตัวอักษร |
| MONGODB_URI | ค่าเชื่อมต่อ Atlas เดิม ใส่เฉพาะ Environment ของ Render |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | ค่า Cloudinary เดิม |
| RESEND_API_KEY | API key จากบัญชี Resend สำหรับส่งเมลผ่าน HTTPS |
| MAIL_FROM | เช่น CookHub <noreply@your-verified-domain.com> ต้องเป็นโดเมนที่ยืนยันใน Resend แล้ว |
| APP_URL | เว้นไม่ตั้งเพื่อใช้ URL Render อัตโนมัติ; ถ้าใช้โดเมนเองให้ใส่ https://โดเมนจริง ไม่มี / ท้าย |
| KKU_AI_API_KEY | คีย์ผู้ช่วยเดิม ถ้าต้องการใช้ AI บนเว็บ deploy |
| KKU_AI_BASE_URL / KKU_AI_MODEL | ใช้ค่าที่ทดสอบแล้วในเครื่อง ถ้ามี |
| THEMEALDB_API_KEY | ถ้าใช้ค่าพิเศษ; ไม่ตั้งจะใช้ค่าเริ่มต้น 1 |

อย่าอัปโหลด .env หรือคีย์ขึ้น GitHub ไฟล์ .env.example เป็นเพียงแม่แบบ

## MongoDB Atlas

Render > Service > Connect > Outbound จะแสดง IP/CIDR ขาออก ให้นำรายการของบริการนี้ไปเพิ่มใน Atlas > Network Access และใช้ database user ที่เข้าถึงฐานข้อมูลแอปได้ ตรวจ URI ว่าระบุชื่อฐานข้อมูลเดิมถูกต้อง ไม่ย้ายฐานข้อมูลและไม่ seed ข้อมูลใหม่ขณะ deploy

## อีเมลบน Free

Render Free บล็อก SMTP พอร์ต 25, 465, 587 ดังนั้น MAIL_USER / MAIL_PASS ของ Gmail แบบเดิมใช้กับ Free ไม่ได้

โค้ดเพิ่ม Resend API ผ่าน HTTPS แล้ว ต้องสร้าง API key และยืนยันโดเมนผู้ส่งก่อนส่งให้ผู้ใช้ทั่วไป ถ้าใช้ผู้ส่งทดสอบของ Resend จะมีข้อจำกัดผู้รับตามบัญชี จึงไม่ถือว่าพร้อมส่งเมลให้ผู้ใช้ทุกคน ถ้าไม่ต้องการเพิ่ม Resend และมีแต่ Gmail SMTP ให้เลือก Render แบบเสียเงินที่รองรับ SMTP แล้วตั้ง MAIL_USER/MAIL_PASS เดิมแทน โดยนำ RESEND_API_KEY ออก

Production ที่ไม่มีผู้ให้บริการอีเมลจะรายงานข้อผิดพลาด ไม่พิมพ์ลิงก์ยืนยัน/รีเซ็ตรหัสผ่านลง log เพื่อแสร้งว่าส่งแล้ว

## การชำระเงิน

ค่าเริ่มต้นปิดการชำระเงินจริงและ demo: RECIPE_DEMO_PAYMENTS=false, OMISE_MODE=test, OMISE_LIVE_PAYMENTS=false

โค้ดเดิมห้าม Omise test และการซื้อจำลองเมื่อ NODE_ENV=production ดังนั้นการ deploy ชุดนี้ยังไม่ใช่เว็บพร้อมรับเงิน และสิทธิ์ซื้อแบบ demo/gateway-test เดิมจะไม่ถูกนำมานับใน production อย่าเปลี่ยนเป็น development เพียงเพื่อข้ามข้อจำกัด

ถ้าจะเปิดเงินจริง ต้องตั้ง OMISE_MODE=live, OMISE_LIVE_PAYMENTS=true, OMISE_SECRET_KEY เป็น live key และ OMISE_WEBHOOK_SECRET ให้ครบ หลังตรวจความพร้อมบัญชี Omise และ flow รับเงินแล้วเท่านั้น ตั้ง webhook URL เป็น https://โดเมนจริง/payments/omise/webhook

ยังไม่ได้เปิดรับเงินจริงหรือเปลี่ยนคีย์ในการเตรียมครั้งนี้

## ตรวจหลัง Deploy

- เปิด /healthz ต้องได้ 200 และ {"status":"ok"}
- เปิด /home, /courses, /recipes บนคอมและมือถือ
- login แล้ว refresh ต้องยังอยู่ในบัญชีเดิม; cookie cookhub.sid ต้องมี Secure และ HttpOnly
- ทดสอบรูปโปรไฟล์ใหม่ ต้องได้ URL Cloudinary
- ทดสอบอีเมลยืนยัน/รีเซ็ตด้วยบัญชีทดสอบที่ควบคุมเอง ต้องชี้โดเมนจริง
- ตรวจว่า AI ติดต่อผู้ให้บริการได้จาก Render; การเตรียมนี้ยังไม่ได้ทดสอบข้ามเครือข่ายจริง
- การทดสอบชำระเงินจริงต้องแยกตรวจหลังตั้งบัญชีรับเงินพร้อมแล้ว

Render Free จะพักหลังไม่มีคนเข้า 15 นาที การเปิดครั้งแรกหลังพักอาจช้า; ก่อนนำเสนอควรเปิดเว็บให้พร้อมล่วงหน้า

## เอกสารอ้างอิง

- https://render.com/docs/blueprint-spec
- https://render.com/docs/regions
- https://render.com/docs/free
- https://render.com/docs/node-version
- https://render.com/docs/health-checks
- https://resend.com/docs/api-reference/emails/send-email

## ใช้ Brevo SMTP แทน Resend

โค้ดจะเลือก SMTP เมื่อมี SMTP_HOST แม้ยังมี RESEND_API_KEY ค้างอยู่ แนะนำเอา RESEND_API_KEY ออกจากบริการนี้เมื่อเปลี่ยนสำเร็จ

ตั้ง Environment ใน Render:

| KEY | VALUE |
| --- | --- |
| SMTP_HOST | smtp-relay.brevo.com |
| SMTP_PORT | 2525 |
| SMTP_USER | Login จากหน้า Brevo SMTP ไม่ใช่อีเมลผู้ส่ง |
| SMTP_PASS | SMTP key จาก Brevo ไม่ใช่รหัสผ่านบัญชีหรือ API key |
| MAIL_FROM | CookHub <อีเมลผู้ส่งที่ยืนยันใน Brevo> |

Brevo > Settings > Senders, domains, IPs ให้เพิ่มและยืนยัน Sender ที่ควบคุมอีเมลได้ก่อน ใช้อีเมลจากผู้ให้บริการฟรีได้ตามเงื่อนไขบัญชี แต่ Brevo อาจแทนส่วนโดเมนผู้ส่งด้วย brevosend.com เมื่อไม่ได้ยืนยันโดเมน

2525 ใช้ STARTTLS และบังคับเข้ารหัส; ไม่ใช้ 587 ที่ Render Free บล็อก ต้องทดสอบเชื่อมต่อจาก Render หลัง deploy จริง หากบัญชีเปิด IP restriction ต้องอนุญาต outbound IP ของบริการ Render ด้วย

กด Save, rebuild, and deploy แล้วทดสอบลืมรหัสผ่านกับบัญชีทดสอบที่ควบคุมเอง ตรวจ Transactional logs ของ Brevo ประกอบ ยังไม่ถือว่าทดสอบส่งจริงผ่านจนกว่าอีเมลถึงผู้รับ

อ้างอิง: https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525
