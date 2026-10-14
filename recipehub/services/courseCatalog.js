
const SingleCourse = require('../models/SingleCourse');
const MultiCourse = require('../models/MultiCourse');
const Transaction = require('../models/Transaction');
const Favorite = require('../models/Favorite');
const { countryLabel, localCountry } = require('./recipeCountries');


const tagKey = { Thai: 'thai', British: 'british', Chinese: 'chinese', Japanese: 'japan', Korean: 'korean', International: 'inter' };
function tagFor(category) {
  const country = localCountry(category);
  return { tag: countryLabel(country), tagType: tagKey[country], country };
}


function formatDuration(min) {
  if (!min) return 'ไม่ระบุเวลา';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return [h ? h + ' ชม.' : '', m ? m + ' นาที' : ''].filter(Boolean).join(' ');
}


function formatCount(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
}


function mapSingle(course, students) {
  const recipe = course.baseRecipe || {};
  const chef = course.publisher || {};
  const durMin = (course.videos || []).reduce((sum, v) => sum + (v.duration || 0), 0) || recipe.duration || 0;
  return {
    id: course._id,
    kind: 'single',
    url: '/courses/' + course._id,
    title: course.title,
    description: course.detailedInstruction || recipe.description || '',
    ...tagFor(recipe.category),
    isPack: false,
    rating: null,
    lessons: (course.videos || []).length,
    durMin,
    duration: formatDuration(durMin),
    studentCount: students,
    students: formatCount(students),
    price: course.price,
    images: [recipe.image || ''],
    source: chef.role === 'chef' ? 'chef' : 'general',
    chefId: chef._id,
    chef: chef.name || 'เชฟ',
    chefAvatar: chef.avatar || '',
    createdAt: course.createdAt,
  };
}


function mapPack(pack, singleById, students) {
  const items = (pack.includedCourses || []).map(id => singleById.get(id)).filter(Boolean);
  const durMin = items.reduce((sum, c) => sum + c.durMin, 0);
  const chef = pack.publisher || {};
  const first = items[0] || {};
  return {
    id: pack._id,
    kind: 'multi',
    url: '/courses/pack/' + pack._id,
    title: pack.title,
    description: pack.description || items.map(c => c.title).join(' & '),
    tag: first.tag || 'แพ็กคอร์ส',
    tagType: first.tagType || 'inter',
    country: first.country || 'International',
    isPack: true,
    courseCount: items.length,
    rating: null,
    lessons: items.reduce((sum, c) => sum + c.lessons, 0),
    durMin,
    duration: formatDuration(durMin),
    studentCount: students,
    students: formatCount(students),
    price: pack.price,
    images: items.slice(0, 2).map(c => c.images[0]),
    source: chef.role ? (chef.role === 'chef' ? 'chef' : 'general') : (first.source || 'general'),
    chefId: chef._id || first.chefId,
    chef: chef.name || first.chef || 'เชฟ',
    chefAvatar: chef.avatar || first.chefAvatar || '',
    createdAt: pack.createdAt,
  };
}


async function countStudents() {
  const rows = await Transaction.aggregate([
    { $match: {
      itemType: { $in: ['SingleCourse', 'MultiCourse'] },

      ...(process.env.NODE_ENV === 'production' ? { paymentMode: { $nin: ['demo', 'gateway-test'] } } : {}),
    } },
    { $group: { _id: { t: '$itemType', id: '$itemId' }, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map(r => [r._id.t + ':' + r._id.id, r.n]));
}


async function loadCourses() {
  const [singles, packs, students] = await Promise.all([
    SingleCourse.find()
      .populate('baseRecipe', 'title description category duration image')
      .populate('publisher', 'name avatar role')
      .lean(),
    MultiCourse.find().populate('publisher', 'name avatar role').lean(),
    countStudents(),
  ]);

  const singleCards = singles.map(c => mapSingle(c, students.get('SingleCourse:' + c._id) || 0));
  const singleById = new Map(singleCards.map(c => [c.id, c]));
  const packCards = packs.map(p => mapPack(p, singleById, students.get('MultiCourse:' + p._id) || 0));
  return require('./courseReviews').applyRatings(singleCards.concat(packCards));
}


async function favoriteKeys(clientId) {
  if (!clientId) return new Set();
  const rows = await Favorite.find({ client: clientId, itemType: { $in: ['SingleCourse', 'MultiCourse'] } })
    .select('itemType itemId').lean();
  return new Set(rows.map(f => (f.itemType === 'SingleCourse' ? 'single:' : 'multi:') + f.itemId));
}


async function setFavorite(clientId, kind, id, on) {
  const itemType = { single: 'SingleCourse', multi: 'MultiCourse' }[kind];
  if (!itemType) return null;
  const Model = kind === 'single' ? SingleCourse : MultiCourse;
  if (!await Model.exists({ _id: id })) return null;
  const key = { client: clientId, itemType, itemId: id };
  if (!on) {
    await Favorite.deleteOne(key);
    return false;
  }
  if (!await Favorite.exists(key)) {
    try { await Favorite.create(key); }
    catch (err) { if (err.code !== 11000) throw err; }
  }
  return true;
}

module.exports = { loadCourses, favoriteKeys, setFavorite, tagFor, formatDuration, formatCount };
