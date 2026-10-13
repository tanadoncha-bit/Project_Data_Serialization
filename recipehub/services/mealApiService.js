const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const cacheFile = path.join(__dirname, '../node_modules/.cache/meal-catalogue.json');

const api = axios.create({ baseURL: `https://www.themealdb.com/api/json/v1/${encodeURIComponent(process.env.THEMEALDB_API_KEY || '1')}/`, timeout: 8000 });

function normalize(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    if (meal[`strIngredient${i}`]?.trim()) ingredients.push({ name: meal[`strIngredient${i}`].trim(), amount: (meal[`strMeasure${i}`] || '').trim() });
  }
  return { id: meal.idMeal, title: meal.strMeal, category: meal.strCategory,
    area: meal.strArea, image: meal.strMealThumb, videoUrl: meal.strYoutube,
    instructions: meal.strInstructions, ingredients, source: 'TheMealDB' };
}

async function request(endpoint, params) {
  const { data } = await api.get(endpoint, { params });
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'meals') || (data.meals !== null && !Array.isArray(data.meals))) throw new Error('Invalid TheMealDB response');
  return (data.meals || []).map(normalize);
}

// Fetch the documented letter index with bounded concurrency, then deduplicate IDs.
async function loadCatalogue() {
  const letters = Array.from('abcdefghijklmnopqrstuvwxyz');
  const groups = new Array(letters.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < letters.length) {
      const index = cursor++;
      groups[index] = await request('search.php', { f: letters[index] });
    }
  }));
  return [...new Map(groups.flat().map(meal => [meal.id, meal])).values()]
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));
}

// Serve a small first batch immediately; refresh the complete catalogue in the background.
let discoveryCache;
let discoveryExpires = 0;
let discoveryRequest;
let firstRequest;
let complete = false;
try {
  const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (Array.isArray(saved.meals) && saved.meals.every(meal => meal && typeof meal.id === 'string' && typeof meal.title === 'string')) {
    discoveryCache = saved.meals; discoveryExpires = Number(saved.expires) || 0; complete = true;
  }
} catch (_) { /* A missing cache is expected on first startup. */ }
function refreshCatalogue() {
  if (!discoveryRequest) {
    discoveryRequest = loadCatalogue().then(meals => {
      discoveryCache = meals;
      discoveryExpires = Date.now() + 30 * 60 * 1000;
      complete = true;
      try { fs.mkdirSync(path.dirname(cacheFile), {recursive:true}); fs.writeFileSync(cacheFile, JSON.stringify({meals,expires:discoveryExpires})); } catch (_) { /* Memory cache still works if disk is unavailable. */ }
    }).catch(() => {}).finally(() => { discoveryRequest = undefined; });
  }
}
async function browse() {
  if (discoveryCache) {
    if (Date.now() >= discoveryExpires || !complete) refreshCatalogue();
    return discoveryCache;
  }
  if (!firstRequest) firstRequest = request('search.php', {f:'a'}).then(meals => {
    discoveryCache = meals; refreshCatalogue(); return meals;
  }).finally(() => { firstRequest = undefined; });
  return firstRequest;
}

module.exports = {
  browse,
  cataloguePending: () => !complete,
  search: query => request('search.php', { s: query }),
  lookup: async id => (await request('lookup.php', { i: id }))[0] || null
};
