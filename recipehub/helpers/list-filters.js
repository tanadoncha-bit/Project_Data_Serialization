/* ===========================================================
   ฟังก์ชันช่วยของหน้ารายการคอร์ส
   ใช้ชื่อช่องเดียวกับแถบควบคุม/ตัวกรองของหน้าสูตร (views/partials/browse-controls.ejs, browse-filter.ejs)
     source (= ระดับ), sort, country, minDuration, maxDuration, minPrice, maxPrice, minRating, page
   - readFilters     อ่านค่าตัวกรองจาก URL
   - applyFilters    กรอง + เรียงรายการ
   - buildListPage   กรอง + แบ่งหน้า + ลิงก์เปลี่ยนหน้า
   =========================================================== */

const PER_PAGE = 15;
const SORTS = ['popular', 'rating', 'latest'];

const toNumber = v => {
  const n = Number(v);
  return v === undefined || v === '' || !Number.isFinite(n) || n <= 0 ? '' : n;
};

// อ่านค่าตัวกรองจาก URL ('' = ไม่กรอง)
function readFilters(q) {
  const rating = Number(q.minRating);
  return {
    source: typeof q.source === 'string' && q.source ? q.source : 'all',
    sort: SORTS.includes(q.sort) ? q.sort : (q.sort === 'newest' ? 'latest' : 'popular'),
    country: [].concat(q.country || []).filter(v => typeof v === 'string' && v),
    maxDuration: toNumber(q.maxDuration),
    maxPrice: toNumber(q.maxPrice),
    minRating: rating >= 1 && rating <= 5 ? String(rating) : '',
  };
}

// กรอง + เรียงรายการ
// fields บอกว่าข้อมูลใช้ชื่อ field อะไร เช่น { level: 'level', minutes: 'durMin', country: 'country' }
// กรองในหน่วยความจำ เพราะคะแนน / เวลา / จำนวนคนเรียน ต้องคำนวณจากหลาย collection ก่อน
function applyFilters(items, f, fields) {
  const minRating = Number(f.minRating) || 0;
  let list = items.filter(it =>
    (f.source === 'all' || it[fields.level] === f.source) &&
    (!f.country.length || f.country.includes(it[fields.country])) &&
    (f.maxDuration === '' || (it[fields.minutes] || 0) <= f.maxDuration) &&
    (f.maxPrice === '' || it.price <= f.maxPrice) &&
    (it.rating || 0) >= minRating
  );
  if (f.sort === 'popular') list = list.slice().sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
  if (f.sort === 'rating') list = list.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (f.sort === 'latest') list = list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

// query ของตัวกรองปัจจุบัน (ไม่รวม page) สำหรับลิงก์เปลี่ยนหน้า
function filterQuery(f) {
  const params = new URLSearchParams();
  if (f.source !== 'all') params.set('source', f.source);
  params.set('sort', f.sort);
  f.country.forEach(c => params.append('country', c));
  if (f.maxDuration !== '') params.set('maxDuration', f.maxDuration);
  if (f.maxPrice !== '') params.set('maxPrice', f.maxPrice);
  if (f.minRating) params.set('minRating', f.minRating);
  return params.toString();
}

function buildListPage(req, items, fields) {
  const filters = readFilters(req.query);
  const all = applyFilters(items, filters, fields);
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, parseInt(req.query.page) || 1));
  return {
    list: all.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    total: all.length,
    page, totalPages,
    filters,
    pageQuery: filterQuery(filters),
  };
}

module.exports = { readFilters, applyFilters, buildListPage };
