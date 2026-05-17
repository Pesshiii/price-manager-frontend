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
- **dataframe** — pipeline registry + editor + preview. Upload-session workflow: `POST /dataframe/sessions/` returns a `session_id`, then `POST /dataframe/preview/` runs `instructions` against that session.
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
| GET / POST | `/products/characteristic-types/` | List / create CharacteristicType. Query `?category=<id>` to scope to a category. Fields: `name`, `label`, `value_type` (`string`/`integer`/`float`/`boolean`/`choice`), `options[]`, `unit`, `required`, `categories[]`. |
| GET / PATCH / DELETE | `/products/characteristic-types/<id>/` | CRUD detail. |
| GET | `/products/products/` | Paginated list (`{count, next, previous, results}`, `page_size=50`, override via `?page_size=`). Filters: `?q=`, `?category=<id>` (includes MPTT descendants), `?brand=<id>`, `?status=`, `?char__<name>=<value>` (repeat for multi-value OR). |
| POST | `/products/products/` | Create. Body: `{sku, name, category?, brand?, description?, status?, characteristics: {<type_name>: <value>}, image_urls: []}`. Backend validates/coerces JSON via CharacteristicType; 400 returns `{characteristics: ["<key>: <message>"]}`. |
| GET / PATCH / PUT / DELETE | `/products/products/<id>/` | CRUD detail. |
| GET | `/products/products/facets/` | Facet aggregation for **current filter set**. Pass the same query params as the list endpoint. Response: `{<characteristic_name>: [{value, count}, ...]}`. Drive sidebar facet filter UI from this. |
| POST | `/products/import/preview/` | Dry-run import. Body: `{session_id, instructions, mapping, row_limit?}`. Returns `{rows: [{index, payload, errors}], total, returned, valid, invalid}`. |
| POST | `/products/import/commit/` | Persist valid rows. Same body. Returns `{created, updated, skipped, errors}`. Upsert key is `sku`. Category/Brand are auto-created by name (`get_or_create`). |

### Import flow (reuse dataframe feature)

1. User builds a dataframe pipeline in the existing dataframe editor (file → `POST /dataframe/sessions/` → `session_id`, then iterate via `POST /dataframe/preview/`).
2. After the dataframe preview shows expected columns, switch to a product-import mapping step: collect a `mapping` object where each Product field / CharacteristicType is bound to a dataframe column (or a constant):
   ```ts
   type FieldMapping = { column: string } | { const: unknown };
   interface ImportMapping {
     sku?: FieldMapping;
     name?: FieldMapping;
     category?: FieldMapping;
     brand?: FieldMapping;
     description?: FieldMapping;
     status?: FieldMapping;
     characteristics?: Record<string, FieldMapping>; // keyed by CharacteristicType.name
   }
   ```
3. Send `{session_id, instructions, mapping}` to `/products/import/preview/` and render `valid`/`invalid` counts + per-row `errors`.
4. On confirm, hit `/products/import/commit/`. The dataframe `session_id` is reusable until TTL expires.

### Implementation notes for `src/features/product/`

- **api.ts** — mirror `features/dataframe/api.ts`: thin wrappers around the shared `api` axios instance, `const BASE = '/products'`. List endpoint is paginated, so return `Paginated<Product>` (not a bare array) — different from dataframe pipelines.
- **queryKeys.ts** — namespace keys so cache invalidation after import is targeted, e.g. `['products', 'list', filters]`, `['products', 'facets', filters]`, `['characteristic-types', { category }]`. After a successful `import/commit/`, invalidate `['products']` and `['categories']` + `['brands']` (auto-created entries).
- **types.ts** — `value_type` union mirrors backend choices. Server stores typed values in `characteristics` JSON (string/number/boolean), so on form submit coerce inputs to the declared `value_type` (string → number for `integer`/`float`, "true"/"false" → boolean for `boolean`) — the backend will also coerce, but UI should mirror it for immediate feedback.
- **Filter UI** — sidebar facets call `/products/products/facets/` with the **same** filter params as the list. Treat `char__<name>` as repeatable: a single param yields exact-match, multiple yield OR.
- **Pagination** — DRF `PageNumberPagination` with `?page=N&page_size=N`. Use `count` from the response for total.
- **CSRF / 401** — handled by the existing axios interceptor; no special-casing needed.
- **MSW handlers** — tests must mock product endpoints; remember `onUnhandledRequest: 'error'` will fail otherwise.

### Tests
Vitest + jsdom + Testing Library + MSW. `src/test/setup.ts` polyfills `matchMedia` and `ResizeObserver` (needed by Mantine), and starts the MSW server with `onUnhandledRequest: 'error'` — any unmocked request fails the test. Use the helper at `src/test/renderWithProviders.tsx` to wrap components with the provider stack.

## Conventions

- Mantine 7 sub-package styles are imported in `main.tsx` (`@mantine/core`, `@mantine/notifications`, `@mantine/dropzone`). Adding a new Mantine sub-package requires importing its CSS there too.
- UI strings are in Russian (see route placeholders in `src/routes.tsx`).

## Pending work: dataframe caching, session restore & infinite-scroll preview

Three coordinated changes across `price_manager` (backend) and this repo. Backend must land first — frontend depends on new endpoint shape. Plan source: `~/.claude/plans/snuggly-sleeping-cook.md`.

### Backend prerequisites (`price_manager`, do these first)

1. **`dataframe/cache.py`** (new) — pickle-based Redis cache keyed by `(session_id, sha1(reader_cfg))`. TTL 1h. `set` wrapped in `try/except` (large Excel may exceed Redis maxmemory; failure must not break the request).
2. **`dataframe/services.py`** — `apply_partial(df_obj, file, up_to=None, *, session_id=None)`. When `session_id` is passed, look up cached reader-output before parsing; on miss, parse and store. Transforms run over a `.copy()` of the cached DF in-memory each call.
3. **`dataframe/sessions.py`** — add `session_metadata(session_id) -> {session_id, filename, size, uploaded_at}`. `delete_session()` calls `cache.invalidate_session(session_id)` (guards `AttributeError` if backend isn't `django_redis`).
4. **`dataframe/api/views.py`** — `UploadSessionView.get(request, session_id)` returns metadata or 404. `_dataframe_to_payload(df, row_limit, offset)` slices `df.iloc[offset:offset+row_limit]` and returns `offset` + `has_more` alongside existing fields. `PreviewView.post` passes `session_id` to `apply_partial` and proxies `offset`.
5. **`dataframe/api/serializers.py`** — add `offset = IntegerField(required=False, min_value=0, default=0)` to `PreviewRequestSerializer`.
6. **`product/api/views.py`** — pass `session_id=data['session_id']` into `apply_pipeline` so import paths share the cache.
7. **`dataframe/test_api.py`** — new `CacheTests` (cache hit skips reader, `delete_session` invalidates), `SessionMetadataTests` (200 + 404), `PreviewOffsetTests` (window + past-total). Run `python manage.py test dataframe product` — must stay green.

### Frontend steps (this repo)

Pre-req: backend deployed/running locally with the changes above; `/dataframe/sessions/<id>/` returns metadata and `/dataframe/preview/` accepts `offset`.

1. **`src/features/dataframe/api.ts`** — add:
   ```ts
   export interface SessionMetadata { session_id: string; filename: string; size: number; uploaded_at: string }
   export const getSession = (sid: string) =>
     api.get<SessionMetadata>(`/dataframe/sessions/${sid}/`).then(r => r.data);
   ```
   Extend `previewPipeline` args with `offset?: number` and forward it in the POST body.
2. **`src/features/dataframe/queryKeys.ts`** — add `session: (id: string) => ['dataframe', 'session', id] as const`.
3. **`src/features/dataframe/types.ts`** — extend `PreviewResult` with `offset: number; has_more: boolean`.
4. **`src/features/dataframe/hooks/usePipelinePreview.ts`** — rewrite to `useInfiniteQuery`:
   - `initialPageParam: 0`
   - `getNextPageParam: (last) => last.has_more ? last.offset + last.returned_rows : undefined`
   - Forward `pageParam` as `offset` to `previewPipeline`.
   Consumers now receive `data.pages` instead of a flat `PreviewResult` — update call sites.
5. **`src/features/dataframe/components/PreviewTable.tsx`** — replace `<Table>` with `TableVirtuoso` from `react-virtuoso` (already in deps). Wire `endReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}`. Use `fixedHeaderContent` for sticky header; render Mantine `Table.Td` in `itemContent`. Keep `renderCell` as-is.
6. **`src/features/dataframe/components/PreviewPanel.tsx`** — flatten `data.pages.flatMap(p => p.rows)` and pass to `PreviewTable` alongside `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`. Show `total_rows` (read from `data.pages[0]`) in the header.
7. **`src/features/dataframe/pages/DataframeEditorPage.tsx`**:
   - On mount, if `sessionId` from URL is set but `uploadedFile` is `null`, run `useQuery(dataframeKeys.session(sessionId), () => getSession(sessionId))`. On success, `setUploadedFile({name: data.filename, size: data.size})`.
   - On 404 (`error.response?.status === 404`) — `setSessionId(null)` (URL cleanup is already wired in the existing effect).
   - **Delete** the unmount cleanup that calls `deleteSession(sessionId)`. Reason: it races F5 and 404s the metadata fetch. Server has 24h TTL + explicit «Заменить файл» button — that's enough.
8. **Tests** — new files under `src/features/dataframe/__tests__/`:
   - `sessionRestore.test.tsx` — render with `?session=abc`, MSW returns metadata → assert filename rendered.
   - `sessionRestore404.test.tsx` — MSW returns 404 → assert `?session` removed from URL and dropzone re-shown.
   - `previewInfiniteScroll.test.tsx` — MSW handler returns two pages; programmatically trigger `endReached` (Virtuoso exposes it via test scroll); assert second batch appended.

### Verification

- `pnpm typecheck` clean.
- `pnpm test` green (existing + 3 new files).
- Manual e2e with backend running: upload XLSX → preview shows first batch → scroll triggers more POSTs with growing `offset` (check Network tab) → F5 keeps file name, preview reloads from cached reader (visible in backend logs: only one `read_excel` call across the two page loads).
