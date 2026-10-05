const axios = require('axios');

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

module.exports = {
  search: query => request('search.php', { s: query }),
  lookup: async id => (await request('lookup.php', { i: id }))[0] || null
};
