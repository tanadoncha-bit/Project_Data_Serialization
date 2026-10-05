# Recipe module

Uses the existing numeric Recipe IDs and `publisher -> Client` reference so `Transaction.itemId` remains compatible. `chef` is a Mongoose populate virtual pointing at the same Client. MongoDB stores CookHub recipes; TheMealDB only supplies inspiration.

## Run

From `recipehub`, run `npm install`, then `npm run dev`. On Windows PowerShell where npm.ps1 is blocked, use `npm.cmd`.

Configure `MONGODB_URI` in your local `.env`. Never commit it. Until the team's authentication middleware is connected, enable `RECIPE_DEMO_MODE=true` locally. Demo mode is disabled in production and creates a separate demo Client per browser session. Demo sessions use an in-memory store and expire after one day; restarting the server ends access to those demo recipes. Demo recipes and Clients remain in MongoDB until explicitly removed. Prefer a development database for demonstrations.

If the initial MongoDB connection fails, the server remains available and database-dependent recipe routes return 503. TheMealDB inspiration remains usable. Fix the connection settings/DNS and restart to retry the initial database connection.

Authentication integration: mount the team's session/authentication middleware before the recipe routers in `app.js`, and set `req.session.userId` to the numeric Client ID. Recipe routes check the Client's chef role and ownership. All chef mutations require the session CSRF token rendered in the forms. No account or session ID is accepted from form fields.

## Routes

- `/chef/recipes`: own recipes with Create/Edit/Preview/Delete modals. Direct `/create`, `/:id`, and `/:id/edit` links render the same list with the corresponding modal open. Append `fragment=1` to GET form/detail routes for the modal fragment. Fragment form POSTs return `{ location }` on success or HTML with status 422 on validation errors.
- `POST /chef/recipes`: create; `POST` or `PUT /chef/recipes/:id`: update.
- `POST /chef/recipes/:id/delete` or `DELETE /chef/recipes/:id`: delete.
- `/recipes`: public list, 12 per page. Combine `search`, repeated `category` checkboxes, `difficulty`, `minDuration`, `maxDuration`, `minPrice`, `maxPrice`, `minRating`, `sort`, and `page`. Sort supports `popular`, `rating`, and `newest`. Filter/search/sort selections persist across submissions and pagination. `level` remains supported for older links.
- `/recipes/:id`: free content, owner content, or purchased content. Paid ingredients, steps, and video never render for unentitled visitors. Purchases use existing `Transaction` rows with `buyer`, `itemType: 'Recipe'`, and numeric `itemId`. The payment UI remains the purchase team's integration point.
- `/recipes/inspiration`: search and view external meals.
- `/api/meals/search?q=chicken` and `/api/meals/:id`: JSON from TheMealDB with an 8-second timeout and 502 handling.

TheMealDB uses `THEMEALDB_API_KEY` if set, otherwise educational test key `1`. Endpoints follow [TheMealDB documentation](https://www.themealdb.com/api.php).

Old recipes without categories/ingredients/steps render with placeholders; editing requires a category, a valid HTTP(S) image URL, and at least one ingredient and step. No existing data migration is performed. Difficulty now uses `EASY/MEDIUM/HARD`; legacy `BEGINNER/INTERMEDIATE/ADVANCED` values still render/filter correctly, and saves keep the corresponding `level` synchronized. Legacy category values such as `Thai` render as Thai labels and match those category filters. `name` and `imageUrl` are schema aliases for existing `title` and `image` fields.

The screenshot-based form exposes title/category/difficulty/price/image/ingredients/steps only. Editing preserves existing `description`, `videoUrl`, and duration; those fields are not shown as extra controls. Duration is minutes and may be supplied by an integration to the existing owner mutation route. Rating and favorite/review counts must come from a trusted future review/favorite module, not the recipe form. Missing duration/rating render honestly as unspecified/no reviews. Popular sorting uses stored `favoriteCount`, then `reviewCount`; no fabricated statistics are seeded into the application database.

## Validate

Run `node tests/recipes.integration.js`. It uses the configured MongoDB server but selects a new random database named `cookhub_recipe_test_<random>`. Test documents are cleaned afterward. It requires permission to create a separate database on that server. Covers persisted CRUD, ownership, CSRF, validation, combined search/filter, paid purchase access, EJS includes, API success/failure, and database outages. API route tests inject temporary responses only inside the test process; verify live connectivity separately with `/api/meals/search?q=chicken`.

UI follows the supplied Figma screenshots, reusing the team's head/navbar/footer and Prompt font. Shared partials accept optional `brandName`/`recipePublicNav` values; existing pages retain their original defaults. All layout overrides are scoped to recipe pages. Hero photos are new ImageGen assets inspired by the screenshot compositions because original Figma image assets were unavailable. Saved paths and full prompts are documented in [ASSETS.md](public/images/recipes/ASSETS.md).

## Team integration TODOs

- Authentication: connect existing session middleware as described above. Demo mode is development-only.
- Payment: paid previews expose only blurred placeholders, never actual protected ingredients/steps. Existing Transactions already unlock purchased content. Consume the cancelable bubbling `cookhub:purchase` event (`detail.recipeId`) to open the team's checkout; call `preventDefault()` when handled. Until connected, the purchase button shows an availability message.
- Favorites: consume the cancelable bubbling `cookhub:favorite` event (`detail.recipeId`) to connect the team's favorite persistence. Until connected, the heart shows an availability message without pretending to save.
- Metadata: connect trusted duration/review/favorite data; null duration/rating are allowed until those integrations exist.
- Public course navigation uses the existing `/chef/courses` route until the team supplies its public course URL.
- Atlas DNS remains an environment issue if `querySrv EBADRESP` occurs. Use reachable MongoDB or the isolated test setup below.

For isolated local tests without Atlas, install optional tools with `npm install --no-save --package-lock=false mongodb-memory-server playwright`. In PowerShell run:

```powershell
$env:RECIPE_TEST_MEMORY = 'true'
$env:RECIPE_TEST_BROWSER = 'true'
$env:MONGOMS_DOWNLOAD_DIR = Join-Path (Get-Location) 'node_modules/.cache/mongodb-binaries'
node tests/recipes.integration.js
```

MongoDB Memory Server downloads and starts a temporary real MongoDB process. Optional browser tests use installed Microsoft Edge, check dynamic forms and live TheMealDB search/detail, and save screenshots in ignored `node_modules/.cache/recipe-ui`. These optional packages do not change the project's declared dependencies.
