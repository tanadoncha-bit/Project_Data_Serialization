# แถบควบคุมและตัวกรองร่วม

หน้าสูตรเรียก browse-controls.ejs และ browse-filter.ejs แล้ว หน้าคอร์สยังไม่ได้แก้ เพื่อให้เจ้าของงานเลือกนำไปใช้

## วิธีนำไปใช้

โหลด /stylesheets/recipes.css และ /javascripts/recipeModals.js หน้าปัจจุบันรองรับตัวกรองหนึ่งชุดต่อหน้า ใช้ form id="recipe-browse-form" และตั้ง action เป็น URL ของหน้านั้น ห้ามโหลดสคริปต์เปิดตัวกรองเดิมซ้ำ

ตัวอย่างภายใน form:

```ejs
<%- include('../partials/browse-controls', {
  filters: { source: 'all', sort: 'popular' },
  browseConfig: {
    sourceOptions: [['all', 'ทั้งหมด'], ['chef', 'จากเชฟ']],
    sortOptions: [['popular', 'ยอดนิยม'], ['rating', 'คะแนนสูงสุด'], ['latest', 'ใหม่ล่าสุด']]
  }
}) %>
```

ตัวอย่างนอก form:

```ejs
<%- include('../partials/browse-filter', {
  filters: { country: [], maxDuration: '', maxPrice: '', minRating: '' },
  countryOptions: [],
  countryLabel: value => value,
  filterConfig: { title: 'ตัวกรองคอร์สเรียน', durationTitle: 'ระยะเวลาเรียน (นาที)', showCountries: false }
}) %>
```

browseConfig กำหนด sourceLabel, sourceOptions, sortLabel และ sortOptions ได้ filterConfig กำหนด title, countryTitle, durationTitle, showCountries และ showDuration ได้

ช่องส่ง query เป็น source, sort, country, minDuration, maxDuration, minPrice, maxPrice และ minRating ฝั่งคอร์สใช้ชื่อบางช่องต่างกัน เช่น maxDur/rating จึงต้องให้เจ้าของงานแปลงชื่อและค่าตอนนำไปเชื่อม backend และส่งค่าปัจจุบันกลับเข้ามา ห้ามแสดงแหล่งทั่วไปถ้าไม่มีข้อมูลจริง

แถบนี้ไม่รวมการค้นหา/เรียงข้อมูลฝั่งเซิร์ฟเวอร์ ใช้ class เดิมของสูตรเพื่อให้มือถือและคอมแสดงเหมือนกัน หาก CSS ของหน้าคอร์สมี selector ทั่วไป ต้องตรวจการทับกันเมื่อเชื่อมหน้า
