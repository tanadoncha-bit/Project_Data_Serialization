# ER Diagram — CookHub

อ้างอิง Mongoose models ในโปรเจกต์ ณ วันที่ 13 ตุลาคม 2026 เป็นโครงสร้างที่เก็บจริงใน MongoDB ไม่ใช่การเสนอเปลี่ยนฐานข้อมูล

```mermaid
erDiagram
    CLIENT ||--o{ RECIPE : publishes
    CLIENT ||--o{ SINGLE_COURSE : publishes
    CLIENT ||--o{ MULTI_COURSE : publishes
    CLIENT ||--o| PUBLISHER_APPLICATION : submits
    CLIENT ||--o{ FAVORITE : saves
    CLIENT ||--o{ TRANSACTION : purchases
    CLIENT ||--o{ RECIPE_REVIEW : writes
    CLIENT ||--o{ PAYMENT_ORDER : creates
    RECIPE ||--o{ SINGLE_COURSE : baseRecipe
    MULTI_COURSE }o--|{ SINGLE_COURSE : includedCourses
    RECIPE ||--o{ PAYMENT_ORDER : recipeId
    RECIPE ||..o{ RECIPE_REVIEW : "when recipeType is Recipe"
    RECIPE ||..o{ FAVORITE : "when itemType is Recipe"
    SINGLE_COURSE ||..o{ FAVORITE : "when itemType is SingleCourse"
    MULTI_COURSE ||..o{ FAVORITE : "when itemType is MultiCourse"
    RECIPE ||..o{ TRANSACTION : "when itemType is Recipe"
    SINGLE_COURSE ||..o{ TRANSACTION : "when itemType is SingleCourse"
    MULTI_COURSE ||..o{ TRANSACTION : "when itemType is MultiCourse"

    CLIENT {
        number _id PK
        string username UK
        string email UK
        string passwordHash
        string name
        string role
        boolean isVerifiedChef
        string certificateUrl
        string bio
        string avatar
        string institution
        date createdAt
        date updatedAt
    }
    RECIPE {
        number _id PK
        number publisher FK
        string title
        string description
        string category
        string cuisine
        string level "legacy optional"
        string difficulty "legacy optional"
        number duration
        number rating
        number reviewCount
        number favoriteCount
        string image
        string videoUrl
        array ingredients "embedded name and amount"
        array steps "embedded stepNumber and description"
        number price
        boolean isFree
        date createdAt
        date updatedAt
    }
    SINGLE_COURSE {
        number _id PK
        number publisher FK
        number baseRecipe FK
        string title
        string detailedInstruction
        number price
        array videos "embedded videoId title videoUrl duration"
        date createdAt
        date updatedAt
    }
    MULTI_COURSE {
        number _id PK
        number publisher FK
        string title
        string description
        number price
        array includedCourses FK "SingleCourse IDs"
        date createdAt
        date updatedAt
    }
    PUBLISHER_APPLICATION {
        number _id PK
        number client FK,UK
        string certificateUrl
        string status
        date submittedAt
    }
    FAVORITE {
        number _id PK
        number client FK
        string itemType "Recipe ExternalRecipe SingleCourse MultiCourse"
        number itemId "conditional reference"
        string title "external snapshot"
        string image "external snapshot"
        date createdAt
    }
    TRANSACTION {
        number _id PK
        number buyer FK
        string itemType "Recipe SingleCourse MultiCourse"
        number itemId "conditional reference"
        string paymentMode "real demo gateway-test"
        string providerChargeId
        number amountPaid "THB"
        date purchasedAt
    }
    RECIPE_REVIEW {
        number _id PK
        number client FK
        string recipeType "Recipe ExternalRecipe"
        number recipeId "local or external ID"
        number rating "1 to 5"
        string comment
        date createdAt
        date updatedAt
    }
    PAYMENT_ORDER {
        string _id PK
        number buyer FK
        number recipeId FK
        string title "price and title snapshot"
        number amount "satang"
        string currency
        boolean livemode
        string status "creating pending paid failed expired"
        string chargeId UK "sparse unique"
        string qrUrl
        date expiresAt
        date lastCheckedAt
        string activeKey UK "sparse unique"
        date createdAt
        date updatedAt
    }
```

## วิธีอ่าน

เส้นทึบแสดง ref ระหว่าง collection เส้นประแสดงความสัมพันธ์แบบเลือกชนิดด้วย itemType/recipeType โดยรายการหนึ่งอ้างถึงแหล่งเดียว ไม่ได้อ้างถึงทั้งสามแหล่งพร้อมกัน FK ในภาพเป็นความสัมพันธ์เชิงตรรกะ/ค่า ref ของ Mongoose ไม่ใช่ foreign key constraint แบบ SQL

ingredients, steps และ videos เป็น embedded arrays ไม่ใช่ collection แยก includedCourses เป็น array ของ ID คอร์สเดี่ยว แพ็กหนึ่งต้องมีอย่างน้อยหนึ่งคอร์ส ส่วนคอร์สเดี่ยวอยู่ได้หลายแพ็กหรือไม่อยู่ในแพ็กเลย

ExternalRecipe มาจาก TheMealDB ไม่มี model/collection ใน MongoDB จึงไม่วาดเป็นตารางจริง Favorite เก็บ ID พร้อมชื่อและรูป snapshot ส่วน RecipeReview เก็บ external ID แยกด้วย recipeType

PaymentOrder ไม่ได้มี Transaction ID เป็น ref โดยตรง เมื่อยืนยันชำระเงินสำเร็จระบบสร้าง Transaction และบันทึก providerChargeId ให้ตรงกับ chargeId ความเชื่อมโยงนี้ตรวจใน service ไม่ใช่ FK และไม่มี unique index บน providerChargeId

level/difficulty ยังอยู่ใน schema สำหรับข้อมูลเก่า แต่ระบบสูตรไม่ตั้งหรือกรองด้วยค่านี้แล้ว รูป avatar/image เป็น URL ไม่ได้เก็บไฟล์ cloud เป็น collection

## ดัชนีไม่ให้ข้อมูลซ้ำ

- Client.email ไม่ซ้ำ และ username ไม่ซ้ำเมื่อมีค่า (sparse)
- PublisherApplication.client ไม่ซ้ำ: ผู้ใช้หนึ่งคนมีใบสมัครได้สูงสุดหนึ่งรายการ
- Favorite: client + itemType + itemId ไม่ซ้ำ
- Transaction: buyer + itemType + itemId ไม่ซ้ำ
- RecipeReview: client + recipeType + recipeId ไม่ซ้ำ
- PaymentOrder: activeKey และ chargeId ไม่ซ้ำเมื่อมีค่า (sparse)

## Collection ของระบบ

Counter มี _id แบบ string และ seq แบบ number ใช้สร้าง ID ตัวเลขของ model ต่าง ๆ ไม่มี ref กับ collection ธุรกิจโดยตรง Session เก็บผ่าน connect-mongo เป็นข้อมูลเข้าสู่ระบบ จึงไม่รวมในภาพธุรกิจ

models/home.js เป็น Express router ไม่ใช่ Mongoose model จึงไม่ใส่เป็น entity และบทสนทนาน้องอุ่นเก็บใน sessionStorage ฝั่งเบราว์เซอร์ ไม่ใช่ collection ของแอป

ไฟล์ต้นฉบับ Mermaid สำหรับนำไปแก้หรือ render: [ERD.mmd](ERD.mmd)
