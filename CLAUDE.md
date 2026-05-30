# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (pinned via `packageManager` field in `package.json`). Node 18+.

- `pnpm dev` — Vite dev server on `http://localhost:5173`. Proxies `/api/*` to `VITE_PROXY_TARGET` (default `http://localhost:8000`, Django backend).
- `pnpm build` — runs `tsc --noEmit` then `vite build`.
- `pnpm typecheck` — `tsc --noEmit` only.
- `pnpm test` — `vitest run` (jsdom + MSW).
- `pnpm test:watch` — Vitest in watch mode.
- Single test: `pnpm test <path-substring>` or `pnpm test -t "<test name>"`.

## Architecture

### Provider chain (`src/main.tsx`)
`MantineProvider` → `Notifications` → `QueryClientProvider` → `AuthProvider` → `RouterProvider`. React Query is configured with `retry: false`, `refetchOnWindowFocus: false`, `staleTime: 30_000`.

### Routing (`src/routes.tsx`)
React Router v6 `createBrowserRouter`. The root path is wrapped in `RequireAuth` + `AppLayout`; `/login` is public; unknown paths redirect to `/`. Feature pages are imported from `src/features/<feature>/pages/`.

### Auth + HTTP (`src/api/client.ts`, `src/api/auth.ts`, `src/auth/`)
- Backend is Django with session cookies + CSRF. The shared axios instance uses `withCredentials: true` and copies the `csrftoken` cookie into the `X-CSRFToken` header for non-safe methods. Do not remove this — it will silently break writes.
- A 401 response on any non-`/auth/*` request triggers `window.location.assign('/login')`. When writing tests, ensure MSW handlers return non-401 for non-auth routes (or mock `window.location`).
- Auth endpoints: `/auth/csrf/`, `/auth/login/`, `/auth/me/`, `/auth/logout/`. `AuthContext` resolves the current user on mount via `getCurrentUser()`.

### Path alias
`@/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.json`). Prefer the alias over relative imports across feature boundaries.

### Feature layout
`src/features/<name>/{api.ts, queryKeys.ts, types.ts, components/, hooks/, pages/, __tests__/}`. Server state lives in react-query — there is no global client store. Each feature owns its query keys (e.g. `features/dataframe/queryKeys.ts`). Current features:
- **dataframe** — pipeline registry + editor + preview. Upload-session workflow: `POST /dataframe/sessions/` returns a `session_id`, then `POST /dataframe/preview/` runs `instructions` against that session. The preview table headers double as a "column actions" entry point — see "Column-aware transform menu" below.
- **product** — каталог товаров: список с фасетным фильтром по характеристикам, CRUD, импорт через dataframe-пайплайн. See "Product API" below for endpoints and implementation notes.

## Product API

Backend mounts the product app at `/api/products/` (DRF; session auth, same as the rest of the API). Skeleton at `src/features/product/` needs `api.ts`, `queryKeys.ts`, `types.ts` — model after `src/features/dataframe/`.

### Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| GET / POST | `/products/categories/` | List / create Category (MPTT). Response includes `level`; `slug` is read-only. |
| GET / PATCH / DELETE | `/products/categories/<id>/` | CRUD detail. |
| GET / POST | `/products/brands/` | List / create Brand. `slug` read-only. |
| GET / PATCH / DELETE | `/products/brands/<id>/` | CRUD detail. |
| GET / POST | `/products/characteristic-types/` | List / create CharacteristicType. Filters: `?search=` (icontains over `name`+`label`), `?category=<id>` (repeat for multi: `?category=1&category=2` → OR), `?value_type=string\|integer\|float\|boolean\|choice`, `?required=true\|false`. Fields: `name`, `label`, `value_type` (`string`/`integer`/`float`/`boolean`/`choice`), `options[]`, `unit`, `required`, `categories[]`. Read-only `categories_detail: [{id, name, level}]` is included in every response — use it directly in the detail modal instead of fetching `/categories/`. |
| GET / PATCH / DELETE | `/products/characteristic-types/<id>/` | CRUD detail. **PATCH rejects changes to `name` and `value_type` with HTTP 400** — both require a JSONB migration and must go through the dedicated async endpoints below. The body of the 400 names the field and the endpoint to use. |
| POST | `/products/characteristic-types/<id>/retype/preview/` | **Synchronous.** Body: `{new_value_type}`. Response: `{total_with_key, invalid_count, unique_invalid: [{value, count}], truncated}` — products whose stored value won't coerce to the new type, grouped by raw repr (capped at 200 unique values). |
| POST | `/products/characteristic-types/<id>/retype/commit/` | **Async.** Body: `{new_value_type, fallback: 'drop'\|'null'\|'default', default_value?, value_map?: {raw_repr: replacement}}`. Returns 202 + a `CharMutationJob` envelope. `value_map` is keyed by the **same string** the preview endpoint returned (`String(value)` for everything; `'true'`/`'false'` for booleans). Per-row precedence: `value_map[raw]` → `fallback`. |
| POST | `/products/characteristic-types/<id>/rename/preview/` | **Synchronous.** Body: `{new_name}`. Response: `{total_to_rename, collision_count, collisions: [{product_id, sku}]}` (collisions capped at 100). |
| POST | `/products/characteristic-types/<id>/rename/commit/` | **Async.** Body: `{new_name, on_conflict: 'overwrite'\|'keep_existing'\|'skip_row'}`. Returns 202 + a `CharMutationJob`. Same name uniqueness check as preview — duplicate target name 400s before the job is created. |
| GET | `/products/characteristic-types/jobs/<uuid>/` | Poll a retype/rename job. Envelope: `{id, kind: 'retype'\|'rename', status, stage, char_type, payload, result, error, created_at, started_at, finished_at}`. `stage` is a short Russian sentence (`'Сканируем товары'` → `'Применяем изменения'` → `'Обновляем тип'`); empty after terminal status. `result` on success: retype → `{updated, mapped, defaulted, nulled, dropped}`; rename → `{renamed, collisions, skipped}`. Scoped to the requesting user. |
| GET | `/products/products/` | Paginated list (`{count, next, previous, results}`, `page_size=50`, override via `?page_size=`). Filters: `?q=`, `?category=<id>` (includes MPTT descendants), `?brand=<id>`, `?status=`, `?char__<name>=<value>` (repeat for multi-value OR). |
| POST | `/products/products/` | Create. Body: `{sku, name, category?, brand?, description?, status?, characteristics: {<type_name>: <value>}, image_urls: []}`. Backend validates/coerces JSON via CharacteristicType; 400 returns `{characteristics: ["<key>: <message>"]}`. |
| GET / PATCH / PUT / DELETE | `/products/products/<id>/` | CRUD detail. |
| GET | `/products/products/facets/` | Facet aggregation for **current filter set**. Pass the same query params as the list endpoint. Response: `{<characteristic_name>: [{value, count}, ...]}`. Drive sidebar facet filter UI from this. |
| POST | `/products/import/preview/` | **Async.** Dispatches a Celery job. Body: `{session_id, instructions, mapping, row_limit?}`. Returns `202` with an `ImportJob` envelope (`{id, kind: 'preview', status, stage, result, error, ...}`). When `status === 'success'`, `result` matches the legacy shape: `{rows, total, returned, valid, invalid}`. |
| POST | `/products/import/commit/` | **Async.** Same body, same envelope. On `success`, `result` is `{created, updated, skipped, errors}`. Upsert key is `sku`. Category/Brand are auto-created by name; when a row has both a category and a non-empty characteristic value, the `CharacteristicType.categories` M2M is auto-extended. The server also deletes the upload session + reader cache after a successful commit. |
| GET | `/products/import/jobs/<uuid>/` | Poll an import job. Returns the same envelope. Scoped to the requesting user (others get 404). `stage` is a short Russian sentence describing what the worker is doing right now (`'Применяем pipeline'`, `'Валидируем строки'`, `'Записываем в БД'`); empty after the job completes. |

### Characteristic types CRUD + safe mutation flow

The page at `src/features/product/pages/CharacteristicTypesPage.tsx` is the admin surface for `CharacteristicType`. It already covers create + delete; the items below are pending work.

**Filter toolbar.** Above the table: `TextInput` (search, debounced ~300ms), `MultiSelect` of categories, `Select` for `value_type` (with an "Любой" option), `SegmentedControl` for `required` (`all` / `yes` / `no`). The hook `useCharacteristicTypes` (and the keys in `queryKeys.ts`) must take these filters as part of the query key so cache is partitioned correctly. Backend accepts repeated `?category=` params — pass them as multi-value query string.

**View modal — `CharacteristicTypeDetailModal.tsx`.** Read-only render of one type. The serializer already returns `categories_detail: [{id, name, level}]`, so do **not** fetch `/categories/` again — render the badges/tree straight from the payload. Clicking a category navigates to `/categories?focus=<id>` (or whatever convention the categories page uses).

**Edit modal — `CharacteristicTypeEditModal.tsx`.** Editable fields are split into two groups:

- *Safe* (`label`, `unit`, `options`, `required`, `categories`) — submitted via plain `PATCH /characteristic-types/<id>/`. One round-trip.
- *Migrating* (`name`, `value_type`) — **never** sent via PATCH; the backend will 400 with a hint to use the dedicated endpoints. The modal detects a change to either field and routes through a wizard instead.

**Wizard for `value_type` changes.**
1. On submit, if `value_type` differs, call `POST /retype/preview/`.
2. If `invalid_count === 0`, jump straight to `POST /retype/commit/` with `{new_value_type, fallback: 'drop'}` (fallback is irrelevant but required).
3. Otherwise open `CharacteristicRetypeConflictModal.tsx`:
   - If `unique_invalid.length < 10` → per-value table: each row shows the raw value (read-only) + a `TextInput` for a replacement. Bottom-of-form: a `Select` (`'drop' | 'null' | 'default'`) used as a fallback for any value the user leaves blank, plus a `TextInput` for `default_value` when applicable.
   - Otherwise → a single `Select` fallback + optional `default_value` (no per-value editing).
   - Submit composes `{new_value_type, fallback, default_value?, value_map?: {<raw>: <replacement>}}` and posts to `commit`. The keys in `value_map` MUST match the strings returned by preview (`unique_invalid[i].value`) verbatim — that's the matching key on the backend.
4. Backend returns 202 + a `CharMutationJob`; flip into the progress view.

**Wizard for `name` changes.** Same pattern, but calls `POST /rename/preview/` first. If `collision_count === 0` → straight to `commit` with `on_conflict: 'overwrite'` (no choice needed). Otherwise show a small modal listing the collisions (SKUs are returned) and a `SegmentedControl` for `on_conflict` (`'overwrite' | 'keep_existing' | 'skip_row'`), then post to `rename/commit`.

**Progress / polling.** Add `useCharMutationJob(jobId)` — copy of `useImportJob`: `useQuery` with `refetchInterval: 2000`, stop polling when `status ∈ {'success', 'error'}`. Job envelope shape mirrors `ImportJob` plus `stage`, `char_type`, `payload`. Show the current `stage` next to a spinner; on terminal status, invalidate `['characteristic-types']`, `['products']`, and `['products', 'facets']` (a retype/rename changes both the type metadata and every product's JSONB, so the facet cache is stale).

**New API surface in `src/features/product/api.ts`.** Five functions: `previewRetype(id, body)`, `commitRetype(id, body)`, `previewRename(id, body)`, `commitRename(id, body)`, `getCharMutationJob(id)`. New types in `types.ts`: `CharMutationJob`, `RetypePreviewResponse`, `RenamePreviewResponse`, and the two payload shapes. Query keys: `['characteristic-types', 'mutation-job', id]` for the polled job.

**Tests (`src/features/product/__tests__/CharacteristicTypesPage.test.tsx`).** MSW handlers for the four preview/commit endpoints + the polling endpoint. Cases: filter params hit the backend query string; detail modal renders `categories_detail` without a second fetch; retype with 0 conflicts skips the conflict modal; retype with conflicts < 10 renders the per-value table and submits `value_map`; retype with conflicts ≥ 10 renders the fallback-only form; rename without collision skips the conflict modal; rename with collision exposes `on_conflict`.

### Import flow (two-step wizard, async)

The wizard at `src/features/product/pages/ImportPage.tsx` has **two** steps + a results pane:

1. **Источник** — upload (`POST /dataframe/sessions/` → `session_id`) and pick either a saved pipeline or build one ad-hoc. There is **no separate category step** — category is just an ordinary mapping field on step 2.
2. **Маппинг** — collect a `mapping` object where each Product field / CharacteristicType is bound to a dataframe column (or a constant). The CharacteristicType list is **global** (`useCharacteristicTypes()` with no params). Users can create new types inline via a modal in `ImportMappingStep.tsx`; the modal calls `createCharacteristicType()` without `categories[]` — the backend re-attaches the M2M on commit when a row has both a category and a non-empty value for the type. Below the static list of characteristics the user can press **«Добавить вариант»** to add a *dynamic* row — a group of three column selects (Имя / Значение / Единица) for files where the characteristic name lives in a column. See "Dynamic (EAV) characteristics" below.
   ```ts
   type FieldMapping = { column: string } | { const: unknown };
   interface DynamicCharSpec {
     name_column: string;
     value_column: string;
     unit_column?: string;
   }
   interface ImportMapping {
     sku?: FieldMapping;
     name?: FieldMapping;
     category?: FieldMapping;
     brand?: FieldMapping;
     description?: FieldMapping;
     status?: FieldMapping;
     characteristics?: Record<string, FieldMapping>; // keyed by CharacteristicType.name
     dynamic_characteristics?: DynamicCharSpec[]; // EAV groups (see below)
   }
   ```
3. **Импорт** — preview, then commit. Both go through the **async** endpoints: the mutation returns an `ImportJob` envelope with `status: 'pending'`; the page then keeps polling `GET /products/import/jobs/<id>/` every 2s via `useImportJob(jobId)` until `status` becomes `success` or `error`. On success, `job.result` carries the same shape the old sync endpoints used to return (`{rows, total, returned, valid, invalid}` for preview, `{created, updated, skipped, errors}` for commit), so `ImportPreviewResults` and the summary alert work unchanged.

While `status ∈ {pending, running}`, the page shows the worker's current `stage` next to the spinner (e.g. `'Применяем pipeline' → 'Валидируем строки' → 'Записываем в БД'`). When `stage` is empty, it falls back to a generic message.

Notification dedup: the terminal-state effects in `ImportPage.tsx` are guarded by `handledPreviewRef` / `handledCommitRef` keyed by `${job.id}:${status}` — `notifications.show()` fires exactly once per (job, terminal status) even if React Query re-renders the same data later. Reset both refs in `resetDownstream`/`cleanupSession` when starting a new flow.

`previewJobId` and `commitJobId` are stored in `localStorage` (`STORAGE_KEY = 'product-import-state-v2'`), so an F5 mid-commit resumes polling automatically.

### Implementation notes for `src/features/product/`

- **api.ts** — mirror `features/dataframe/api.ts`: thin wrappers around the shared `api` axios instance, `const BASE = '/products'`. List endpoint is paginated, so return `Paginated<Product>` (not a bare array) — different from dataframe pipelines.
- **queryKeys.ts** — namespace keys so cache invalidation after import is targeted, e.g. `['products', 'list', filters]`, `['products', 'facets', filters]`, `['characteristic-types', { category }]`, `['import-jobs', 'detail', id]`. After a commit job reaches `success`, `useImportJobInvalidation` invalidates `['products']` + `['categories']` + `['brands']` (auto-created entries).
- **types.ts** — `value_type` union mirrors backend choices. Server stores typed values in `characteristics` JSON (string/number/boolean), so on form submit coerce inputs to the declared `value_type` (string → number for `integer`/`float`, "true"/"false" → boolean for `boolean`) — the backend will also coerce, but UI should mirror it for immediate feedback.
- **Filter UI** — sidebar facets call `/products/products/facets/` with the **same** filter params as the list. Treat `char__<name>` as repeatable: a single param yields exact-match, multiple yield OR.
- **Pagination** — DRF `PageNumberPagination` with `?page=N&page_size=N`. Use `count` from the response for total.
- **CSRF / 401** — handled by the existing axios interceptor; no special-casing needed.
- **MSW handlers** — tests must mock product endpoints; remember `onUnhandledRequest: 'error'` will fail otherwise.

### Tests
Vitest + jsdom + Testing Library + MSW. `src/test/setup.ts` polyfills `matchMedia` and `ResizeObserver` (needed by Mantine), and starts the MSW server with `onUnhandledRequest: 'error'` — any unmocked request fails the test. Use the helper at `src/test/renderWithProviders.tsx` to wrap components with the provider stack.

### Dynamic (EAV) characteristics

The mapping step supports a second kind of characteristic mapping in addition to the fixed-name list: a *dynamic group* (`mapping.dynamic_characteristics: DynamicCharSpec[]`). Each spec is three column references — `{name_column, value_column, unit_column?}` — meaning: "for every import row, read the characteristic name from this column, the value from that column, and (optionally) the unit from this third column".

UX: dynamic rows live at the bottom of the same characteristics table. Each row shows three `Select`s + a delete button. The backend `commit_rows` does `slugify(name, allow_unicode=True)` + `get_or_create` on the resulting `CharacteristicType`, writes the value into `Product.characteristics[slug]`, and uses `unit_column` for `CharacteristicType.unit` only when the type's unit is empty ("first-write wins"). Static `mapping.characteristics` takes precedence on slug collisions.

The "Проверить" button on the mapping step is disabled if any dynamic group has only one of `name_column` / `value_column` set — `ImportPage.tsx:dynamicGroupsValid` checks `Boolean(name) === Boolean(value)` for every spec before allowing dispatch.

### Column-aware transform menu

`PreviewTable.tsx` renders each column header inside a Mantine `<Menu>` whose items come from `columnTransforms` (a filtered subset of the registry). `DataframeBuilder.tsx` does the filtering: any `TransformSpec` whose `args` include at least one `ArgSpec` with `type === 'column' | 'columns'` is column-aware. Picking an item calls `onColumnAction(column, transformName)`, which appends a new step with the clicked column already filled in (`'column'` → string, `'columns'` → `[string]`) and selects the new step so the user can edit the remaining args inline. No hardcoded transform list — it stays in sync with the backend registry automatically.

## Conventions

- Mantine 7 sub-package styles are imported in `main.tsx` (`@mantine/core`, `@mantine/notifications`, `@mantine/dropzone`). Adding a new Mantine sub-package requires importing its CSS there too.
- UI strings are in Russian (see route placeholders in `src/routes.tsx`).
- API layout is stored in `../price_manager/API_MAP.md` file

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/Pesshiii/price-manager-frontend`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
