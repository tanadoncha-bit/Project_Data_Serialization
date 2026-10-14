


const PER_PAGE = 15;
const SORTS = ['popular', 'rating', 'latest'];

const toNumber = v => {
  const n = Number(v);
  return v === undefined || v === '' || !Number.isFinite(n) || n <= 0 ? '' : n;
};


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


function applyFilters(items, f, fields) {
  const minRating = Number(f.minRating) || 0;
  let list = items.filter(it =>
    (!fields.source || f.source === 'all' || it[fields.source] === f.source) &&
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
  if (!fields.source || !['all', 'chef', 'general'].includes(filters.source)) filters.source = 'all';
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
