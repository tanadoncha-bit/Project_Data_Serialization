const sortOptions = [
  { value: 'popular', label: 'ยอดนิยม' },
  { value: 'rating', label: 'คะแนนสูงสุด' },
  { value: 'latest', label: 'ใหม่ล่าสุด' },
];

function buildPageList(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 2) return [1, 2, '...', totalPages];
  if (page >= totalPages - 1) return [1, '...', totalPages - 1, totalPages];
  return [1, '...', page, '...', totalPages];
}

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

function applyFilters(items, { level, sort, filters }, fields) {
  const minRating = filters.ratings.length ? Math.min(...filters.ratings.map(Number)) : 0;
  let list = items.filter(it =>
    (level === 'all' || it[fields.level] === level) &&
    (!filters.types.length || filters.types.includes(it.tagType)) &&
    (filters.minDur <= 15 || it[fields.minutes] >= filters.minDur) && (filters.maxDur >= 480 || it[fields.minutes] <= filters.maxDur) &&
    it.price >= filters.minPrice && (filters.maxPrice >= 5000 || it.price <= filters.maxPrice) &&
    (it.rating || 0) >= minRating
  );
  if (sort === 'popular') list = list.slice().sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));
  if (sort === 'rating') list = list.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (sort === 'latest') list = list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

const PER_PAGE = 15;

function buildListPage(req, items, base, fields) {
  const level = req.query.level || 'all';
  const sort = req.query.sort || 'popular';
  const filters = readFilters(req.query);
  const all = applyFilters(items, { level, sort, filters }, fields);

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
