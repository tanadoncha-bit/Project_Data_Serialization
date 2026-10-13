// Compatibility for bookmarks pointing to the retired user recipe list.
module.exports = function recipeBrowseRedirect(query) {
  const params = new URLSearchParams();
  const fields = ['source','country','search','category','minPrice','maxPrice','minDuration','maxDuration','minRating','page'];
  for (const key of fields) for (const value of [].concat(query[key] ?? [])) if (typeof value === 'string' && value !== '') params.append(key, value);
  if (typeof query.sort === 'string') params.set('sort', query.sort === 'latest' ? 'newest' : query.sort);
  for (const [oldKey,key] of [['minDur','minDuration'],['maxDur','maxDuration']]) if (!params.has(key) && typeof query[oldKey] === 'string' && query[oldKey] !== '') params.set(key, query[oldKey]);
  if (!params.has('minRating')) {
    const ratings = [].concat(query.rating ?? []).map(Number).filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
    if (ratings.length) params.set('minRating', String(Math.min(...ratings)));
  }
  return '/recipes' + (params.size ? '?' + params.toString() : '');
};
