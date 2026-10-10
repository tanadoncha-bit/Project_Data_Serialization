/* ===========================================================
   ฟังก์ชันช่วยของหน้ารายการ (ใช้ร่วมกันระหว่างหน้าคอร์สและหน้าสูตรอาหาร)
   - sortOptions     ตัวเลือก "เรียงตาม"
   - readFilters     อ่านค่าตัวกรองจาก URL
   - applyFilters    กรอง + เรียงรายการ
   - filtersToQuery  แปลงตัวกรองกลับเป็น query
   - buildPageList   สร้างเลขหน้า เช่น [1, 2, '...', 41]
   - urlMaker        สร้างลิงก์ที่จำค่าตัวกรองเดิมไว้
   =========================================================== */

const sortOptions = [
  { value: 'popular', label: 'ยอดนิยม' },
  { value: 'rating', label: 'คะแนนสูงสุด' },
  { value: 'latest', label: 'ใหม่ล่าสุด' },
];

// สร้างรายการเลขหน้า เช่น [1, 2, '...', 41]
function buildPageList(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 2) return [1, 2, '...', totalPages];
  if (page >= totalPages - 1) return [1, '...', totalPages - 1, totalPages];
  return [1, '...', page, '...', totalPages];
}

// อ่านค่าตัวกรองจาก URL (ใช้ร่วมกับหน้าสูตรอาหาร)
function readFilters(q) {
  return {
    types: [].concat(q.type || []),
    ratings: [].concat(q.rating || []),
    minDur: parseInt(q.minDur) || 15,
    maxDur: parseInt(q.maxDur) || 480,
    minPrice: parseInt(q.minPrice) || 0,
    maxPrice: q.maxPrice !== undefined ? parseInt(q.maxPrice) : 5000,
  };
}

// แปลงตัวกรองกลับเป็น query (เอาเฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น)
function filtersToQuery(f) {
  const q = {};
  if (f.types.length) q.type = f.types;
  if (f.ratings.length) q.rating = f.ratings;
  if (f.minDur !== 15) q.minDur = f.minDur;
  if (f.maxDur !== 480) q.maxDur = f.maxDur;
  if (f.minPrice !== 0) q.minPrice = f.minPrice;
  if (f.maxPrice !== 5000) q.maxPrice = f.maxPrice;
  return q;
}

// สร้างลิงก์ที่จำค่าตัวกรองเดิมไว้ เช่น makeUrl({ page: 2 })
function urlMaker(base, current) {
  return function (changes) {
    const all = Object.assign({}, current, changes);
    const params = new URLSearchParams();
    Object.keys(all).forEach(k => [].concat(all[k]).forEach(v => {
      if (v !== undefined && v !== '' && v !== 'all') params.append(k, v);
    }));
    const qs = params.toString();
    return qs ? base + '?' + qs : base;
  };
}

// กรอง + เรียงรายการ
// fields บอกว่าข้อมูลแต่ละแบบใช้ชื่อ field อะไร เช่น { level: 'level', minutes: 'durMin' }
// ข้อมูลมาจาก database แล้ว (services/courseCatalog.js) แต่กรองในหน่วยความจำ เพราะบาง field
// (คะแนน / เวลา / จำนวนคนเรียน) ต้องคำนวณจากหลาย collection ก่อน กรองด้วย query ตรง ๆ ไม่ได้
function applyFilters(items, { level, sort, filters }, fields) {
  const minRating = filters.ratings.length ? Math.min(...filters.ratings.map(Number)) : 0;
  let list = items.filter(it =>
    (level === 'all' || it[fields.level] === level) &&
    (!filters.types.length || filters.types.includes(it.tagType)) &&
    (filters.minDur <= 15 || it[fields.minutes] >= filters.minDur) && (filters.maxDur >= 480 || it[fields.minutes] <= filters.maxDur) &&
    it.price >= filters.minPrice && (filters.maxPrice >= 5000 || it.price <= filters.maxPrice) &&
    (it.rating || 0) >= minRating                 // ยังไม่มีรีวิว (null) นับเป็น 0
  );
  if (sort === 'popular') list = list.slice().sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
  if (sort === 'rating') list = list.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (sort === 'latest') list = list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

// อ่าน level / sort / page / ตัวกรอง แล้วเตรียมค่าที่หน้ารายการต้องใช้ทั้งหมด
const PER_PAGE = 15;

function buildListPage(req, items, base, fields) {
  const level = req.query.level || 'all';
  const sort = req.query.sort || 'popular';
  const filters = readFilters(req.query);
  const all = applyFilters(items, { level, sort, filters }, fields);

  // แบ่งหน้า หน้าละ 15 รายการ
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, parseInt(req.query.page) || 1));
  const list = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const filterQuery = filtersToQuery(filters);

  return {
    list,
    total: all.length,
    level, sort, page, totalPages,
    pageList: buildPageList(page, totalPages),
    sorts: sortOptions,
    filters, filterQuery,
    makeUrl: urlMaker(base, Object.assign({ level, sort, page }, filterQuery)),
  };
}

module.exports = { sortOptions, readFilters, applyFilters, filtersToQuery, buildPageList, urlMaker, buildListPage };
