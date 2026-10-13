const assert=require('node:assert/strict');
const support=require('../services/recipeSupport');const Recipe=require('../models/Recipe');
const body={title:'Test',category:'Thai',price:'0',image:'https://example.com/test.png',ingredientName:['Rice'],ingredientAmount:['1'],stepDescription:['Cook'],level:'ADVANCED',difficulty:'HARD'};
const parsed=support.parseRecipe(body);assert.equal(parsed.errors.length,0);assert(!('level' in parsed.recipe));assert(!('difficulty' in parsed.recipe));
const created=new Recipe({...parsed.recipe,publisher:1});assert.equal(created.level,undefined);assert.equal(created.difficulty,undefined);
const old=new Recipe({...parsed.recipe,publisher:1,level:'ADVANCED',difficulty:'HARD'});Object.assign(old,support.parseRecipe(body,old).recipe);assert.equal(old.level,'ADVANCED');assert.equal(old.difficulty,'HARD');
const current=support.parseFilters({}),legacy=support.parseFilters({level:'ADVANCED',difficulty:'HARD'});assert.deepEqual(legacy,current);assert(!('difficulty' in support.recipeView({_id:1})));console.log('PASS: no new difficulty defaults, legacy values preserved and obsolete filters ignored');
