// Public browsing groups API areas into five cuisines and International.
const countryOptions = ['Thai', 'British', 'Chinese', 'Japanese', 'Korean', 'International'];
const localCategories = {
  Thai: ['Thai', 'อาหารไทย'], British: ['British', 'English', 'อาหารอังกฤษ'],
  Chinese: ['Chinese', 'อาหารจีน'], Japanese: ['Japanese', 'อาหารญี่ปุ่น'],
  Korean: ['Korean', 'South Korean', 'North Korean', 'อาหารเกาหลี']
};
const aliases = {
  thai: 'Thai', thailand: 'Thai', british: 'British', english: 'British', england: 'British',
  'united kingdom': 'British', uk: 'British', chinese: 'Chinese', china: 'Chinese',
  japanese: 'Japanese', japan: 'Japanese', korean: 'Korean', korea: 'Korean',
  'south korean': 'Korean', 'north korean': 'Korean', 'south korea': 'Korean', 'north korea': 'Korean'
};
function normalizeCountry(value) { return aliases[(value || '').trim().toLowerCase()] || 'International'; }
function mealCountry(meal) { return normalizeCountry(meal.area); }
function localCountry(category) {
  return Object.keys(localCategories).find(country => localCategories[country].includes(category)) || 'International';
}
function countryLabel(country) { return normalizeCountry(country); }
function localCountryCriteria(countries) {
  const alternatives = [];
  const values = countries.flatMap(country => localCategories[country] || []);
  if (values.length) alternatives.push({ category: { $in: values } });
  if (countries.includes('International')) alternatives.push({ category: { $nin: Object.values(localCategories).flat() } });
  return alternatives.length ? { $or: alternatives } : { _id: { $in: [] } };
}
module.exports = { countryOptions, normalizeCountry, mealCountry, localCountry, countryLabel, localCountryCriteria };
