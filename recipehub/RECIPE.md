# CookHub recipe module

## Start

Run from recipehub:

- npm install (PowerShell: npm.cmd install)
- npm run dev
- Configure MONGODB_URI and the existing authentication/session secrets in local .env. Never commit credentials.

The application uses the team's numeric Client IDs and req.session.userId. Chef create/edit/delete/upload operations require the chef role, ownership and a session CSRF token.

## Recipes and editor

- /recipes lists 12 cards per page. source=all|chef|general selects all, local recipes, or TheMealDB recipes.
- Both sources are sorted together before pagination. popular counts Favorite records, rating uses RecipeReview averages, newest uses local createdAt. TheMealDB has no publication timestamps: external recipes retain catalogue order when dates are unavailable.
- Country, search, category and minRating apply to both sources. External recipes are free to access (price 0). Their cooking duration and difficulty are unknown; time/difficulty filters exclude them instead of inventing values.
- maxPrice=0 means free only. Returning a slider to zero clears its limit; entering zero explicitly retains a free-only price filter.
- /chef/recipes uses a three-step modal: menu information, ingredients, method/review. Back preserves inputs. Required fields are validated before advancing and on the server.
- Description, duration and optional YouTube videoUrl are persisted. Category choices match Thai, British, Chinese, Japanese, Korean and International. Difficulty is no longer a visible editor field; existing records retain legacy values.
- Clicking the image area uploads JPG/PNG/WebP up to 5 MB via POST /chef/recipes/upload-image. Server checks file signatures, stores random filenames in public/uploads/recipes, and returns a relative URL. Uploads are ignored by Git; deployment storage must preserve this directory. Incomplete/cancelled forms may leave uploaded files to be cleaned up later.
- Local and external previews share the same layout. Accessible video replaces the hero image; otherwise the image appears. Chef avatar, name, institution and bio come from Client. The close button stays outside scrolling content.
- Free recipes, the owner, and purchasers can see ingredients/steps/video. Paid content is excluded from server responses for other visitors.

## External catalogue

TheMealDB recipes are not imported into MongoDB. First browse returns the first-letter batch and loads the full 26-letter catalogue in the background. Cards show a pending message while the total is incomplete. A memory/disk cache (node_modules/.cache/meal-catalogue.json) is refreshed every 30 minutes; stale cached data remains available during refresh. Opening a recipe fetches its detail by external ID. API outages do not prevent local recipes from rendering.

## Favorites

PUT /recipes/favorites/local|external/:id accepts {favorite:true|false} for a logged-in Client. Favorite uses client, itemType and itemId with a unique compound index. ExternalRecipe favorites additionally preserve title/image for profile cards. Numeric IDs from different sources are isolated by itemType. Profile recipe cards open previews in place. Counts for popularity are aggregated from Favorite records.

## Reviews

- GET /recipes/reviews/local|external/:id returns the review section; PUT saves and DELETE removes the current user's review.
- RecipeReview stores numeric client/recipeId, recipeType (Recipe or ExternalRecipe), integer rating 1–5, comment up to 2000 characters, and timestamps.
- A unique index permits one review per Client/source/recipe. Only the owner can change their review, with login and X-CSRF-Token checks.
- Displayed scores come from CookHub users, not TheMealDB. Listing aggregates review scores for both sources. Local Recipe.rating/reviewCount are also synchronized on writes.
- Reviews show up to the 30 most recently updated entries; aggregate count/average includes every review. Text is escaped by EJS.

## Purchase demonstration

Set RECIPE_DEMO_PAYMENTS=true locally and restart the server to enable the explicitly labeled simulated checkout modal. No money is charged. Authenticated users get a CSRF token from GET /recipes/checkout/:id and confirm through POST to that endpoint. Price is read from Recipe on the server; duplicate Transaction rows are prevented by the existing unique index.

Transaction.paymentMode distinguishes demo from real purchases (existing rows default to real). Demonstration checkout is disabled when NODE_ENV=production, and demo transactions never unlock paid content in production. Profile history labels demonstration purchases. A real payment provider is not integrated.

## Verify

- npm test: isolated MongoDB fixtures for source filtering, global rating/popularity sorting, pagination, API failures, reviews, CSRF, duplicate prevention, access control, and simulated purchase isolation.
- npm run test:browser: Edge/Playwright desktop and mobile editor flow, upload, adding ingredients, retained values, save, preview, edit, and single close button.
- PowerShell external preview QA: set RECIPE_TEST_BROWSER=true then run node tests/externalRecipes.integration.js.
- Tests do not mutate the application's database. MongoMemoryServer downloads a MongoDB binary on first use. Browser QA uses locally installed Microsoft Edge and stubs external icons/video responses. Screenshots go to node_modules/.cache.

No bulk migration of existing recipes is performed. New review records live in their own collection. Existing Favorite and Transaction records remain compatible with added optional fields/types.
