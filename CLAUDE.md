# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects, no root `package.json` and no workspace tooling — `cd` into the one you're working on:

- `backend/` — Express 5 + Mongoose 9 (CommonJS) multi-tenant API. Entry: `server.js`.
- `frontend/` — React 19 + Vite + Tailwind 4 (ESM, plain JS/JSX, no TypeScript). Contains **both** the admin panel and the customer storefront.

`backend/src/`, `backend/index.html`, `backend/vite.config.js`, and both `README.md` files are leftover Vite-template/stray artifacts — not part of the running backend. Ignore them.

## Commands

Backend (`cd backend`):
- `npm start` — `node server.js` on `PORT` (default 5000). There is **no nodemon script and no hot reload**; restart the process manually after any backend edit (including Mongoose schema changes).
- Seeds/one-off scripts are run directly with `node`, e.g. `node seeds/seedVendor.js`. Seeds load `.env` themselves.
- There is no test runner (`npm test` is a stub) and no lint script.

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server. Proxies `/api` and `/socket.io` (with websocket upgrade) to `http://localhost:5000` — see `vite.config.js`. The proxy is load-bearing: the httpOnly `sameSite: 'lax'` refresh-token cookie only works if the browser sees API calls as same-origin.
- `npm run build`, `npm run lint` (ESLint 10 flat config), `npm run preview`.
- No test framework.

## Local setup gotchas

- Copy `backend/.env.example` → `backend/.env`. Redis is optional (`IS_REDIS_SERVER_ON=1` enables it); `CREDENTIALS_ENCRYPTION_KEY` must be set or saved vendor payment credentials become undecryptable on every restart.
- A fresh DB needs seeding, otherwise most routes 404/403: at minimum a **Vendor** whose `domain` matches the hostname you hit (`seedVendor.js` uses `localhost`), then `seedWebsiteMaster`, `seedCompanyMaster`, `seedUser`, and **`seedModuleMaster.js` followed by `backfillAssignedModules.js`**. An empty `ModuleMaster` collection makes `checkModuleAssigned` reject every gated route.
- `backend/scripts/_uiTestSetup.js` is a hardcoded-vendor-ID dev helper that creates a known-password test admin; `scripts/manageVendorPaymentGatewayCredentials.js` is how per-vendor gateway credentials are entered.

## Backend architecture

### Multi-tenancy is by hostname
Every request goes through `vendorDetection`, which looks up `Vendor` by `req.hostname` and sets `req.vendorId`/`req.vendorData`. Every query, cache key, and document is scoped by `vendorId`. Each vendor runs its own storefront domain and its own payment-gateway account (see `backend/docs/payment-gateways.md` — no marketplace/split-payment logic).

### Middleware pipeline (order matters)
`server.js` mounts `requestContext` first (an `AsyncLocalStorage` so `utils/logger.js`'s `logException()` can reach `req` from anywhere without threading it through), then cors/cookies, `vendorDetection`, `ensureVendorDataCached`, then routers. Per-route chains follow this shape:

```
authenticate → vendorDetection → ensureVendorDataCached → authorize('admin') → checkModuleAssigned('CODE') → validate(joiSchema,'body') → controller
```

- `ensureVendorDataCached` loads `companySettingsData`, `websiteMasterData`, `companyMasterData`, `shippingPriceSettingsData` (Redis `getOrSet`, 1h TTL; keys in `utils/redisKeys.js`) onto `req`. Controllers and `checkModuleAssigned` read these off `req` rather than re-fetching. After mutating any of these, invalidate the corresponding Redis key.
- **Feature gating is two-level**: a global `WebsiteMaster` flag AND a per-vendor `CompanyMaster` flag, checked with `common.checkFeatureOnOrOff(...)`. A new feature flag must be added to **both** schemas or it silently reads as off.
- **Module gating**: `checkModuleAssigned('CODE')` checks the vendor's `CompanyMaster.assignedModules` (with expiry/revocation). Module codes are defined in `seeds/seedModuleMaster.js` and mirror the admin sidebar nav items.
- `authenticate.optional` never rejects guests, but returns 401 (not guest) on an *expired* token so the frontend refreshes and retries instead of forking the user's cart. Cart routes use `authenticate.optional` + `resolveCartOwner` (guest cookie or `req.user`).
- Routes registered before `/:id` matchers must stay before them (e.g. `/bulk-status`, `/bulk-delete`).
- `authenticate` also enforces **tenancy**: a valid token whose user belongs to a different vendor than the requested hostname gets 403 (`authenticate.optional` treats it as a guest). It puts `vendorId` on `req.user`.
- **Product routes**: every admin one (add/update/toggle/delete/clone/bulk/list-admin) goes through the `adminAccess` chain in `productRoutes.js` (`authenticate → authorize('admin') → vendorDetection → ensureVendorDataCached`); only the storefront reads (`get-products`, `get-product/:id`, by-brand, by-category) are public. Use `req.user._id` for `createdBy` - never a placeholder id.
- **Controllers must always respond.** A `catch` that only logs leaves the HTTP request open forever (the client spins). `productController` routes every catch through `handleError` (500, or 409 for a Mongo duplicate-key error); other controllers still just log, so new code shouldn't copy that.
- **Uploads happen before the save.** Product images are uploaded (storage provider + `ImageAsset`) before the product document exists, so any failure path must remove them: `applySizeImages` returns `createdImageIds`, and `createProduct` discards them unless the save succeeded. Two concurrent adds can both pass the name/SKU pre-checks - the unique index is the real guard, and `saveNewProduct` turns its E11000 into a 409.
- **Product unique indexes are partial** (`status` in `A`/`I`) so a soft-deleted product doesn't reserve its name/SKU/code forever. Mongoose won't change an existing index's options - after editing them run `node scripts/migrateProductIndexes.js`. Mongo partial indexes can't use `$ne`, hence `$in`.
- **Refresh-token rotation is one atomic compare-and-swap** (`authService.refreshAccessToken`). Of several concurrent refreshes with the same cookie only the winner rotates; the rest get an access token with `refreshToken: null`, and `authController.refreshToken` must then **not** set a cookie. The previous token stays valid for `REFRESH_LOST_RESPONSE_GRACE_MS` (30m, must exceed the 15m access-token life) so a rotation whose response never reached the browser (reload/tab close) doesn't kill the session. Don't reintroduce a read-modify-`save()` rotation.

### Layering and conventions
`routes/` → `controllers/` → `services/` → `models/`. Validation schemas (Joi) live in `middlewares/validations/`.
- Services return `common.returnResult(isSuccess, statusCode, message, meta)`; controllers translate that with `common.sendError` / `common.sendSuccess`. Every response is `{ success, message, data? , errors? }` — the frontend's `apiClient` depends on this shape.
- Services conventionally `try { … } catch (err) { throw err; }`; controllers catch and `logger.logException(...)`. Logged bodies are auto-redacted for keys like password/token/secret.
- `common.encodeId` / `decodeId` AES-encrypt ObjectIds for some resources (e.g. Group); other resources use raw ObjectIds. Check which one an endpoint expects before wiring a frontend call.
- Active/soft-delete status uses `status` codes `'A'`/`'I'`/`'D'` (see `authenticate.js`); `common.softDelete`, `setActiveStatus*`, `runBulkOperation` are shared helpers.

### Pluggable providers (factory pattern)
Image storage (`services/providers/providerFactory.js`, selected by `STORAGE_PROVIDER`: cloudinary/aws/r2/local; interface `upload(buffer, meta)` / `delete(key)`), video storage (`videoProviderFactory`), email (`services/emailProviders/`: nodemailer/sendgrid/ses), and payment gateways (`services/providers/payment/`: paytabs/stripe — adding one is documented in `docs/payment-gateways.md`). Credentials come from `config/*ProviderConfig.js`.

### Other systems
- **Realtime**: `services/realtimeService.js` (socket.io on the same HTTP server). Sockets authenticate with the access-token JWT and join only their own vendor's admin room; emits are best-effort and must never throw. Every module shares one event (`admin:notification`) and is told apart by the payload's `module` field; the frontend side is `useRealtime().subscribe(MODULE, handler)`, which also receives a synthetic `RECONNECTED` type after a dropped connection (refetch on it). `useRealtime()` also returns `status` (`connected`/`connecting`/`offline`) and `reconnect()`; `<LiveIndicator />` (admin/realtime) renders the status. `offline` means socket.io gave up (e.g. rejected handshake from an expired access token) - it never retries on its own, so a page's Refresh button should refetch first (renews the token) and then call `reconnect()`. Orders pushes go through `services/orderRealtimeService.js` (`notifyOrderChanged`, called right after each order `save()` in `orderService`/`paymentService`); payloads are small deltas, not full orders. Customers connect too: a `user`-role socket joins only its own private room (`vendor:{id}:user:{userId}`) and receives on a separate `user:notification` event (`emitToUser`), so it can never see admin traffic; internal types like `AGENT_ASSIGNED` are admin-only. The storefront side is `client/realtime/` (`ClientRealtimeProvider` + `useClientRealtime`), mirroring the admin one.
- **Abandoned-cart scanner** starts at boot from `server.js` (`abandonedCartService`), guarded by a Redis lock key.
- Bulk product/category/discount import goes through Excel upload (`middlewares/multer/bulkFileUpload.js`, `utils/excelParser.js`, `excelRowProcessor.js`, `zipExtractor.js`).

## Frontend architecture

### No router library; two apps in one bundle
`src/main.jsx` picks the root **once at load** from `window.location.pathname`: `/admin*` → admin `App.jsx` (wrapped in admin `AuthProvider` + `RealtimeProvider`); anything else → `src/client/App.jsx` (storefront, own `AuthProvider`). Admin and customer sessions are separate.
- Admin navigation is a `useState` `activePage` switch in `src/App.jsx`; the sidebar is filtered by the vendor's assigned modules (`admin/modules/hooks/useAssignedModules`). A new admin page needs: page component, a `DEFAULT_NAV_ITEMS` entry in `components/ui/Sidebar`, and a branch in `App.jsx`'s ternary chain.
- Storefront routing is hand-rolled `pushState`/`popstate` with regex path matching in `client/App.jsx` (`/product/:id`, `/category/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`). Add new routes to `parseRoute` there; unmatched paths render `NotFoundPage`.

### Feature-folder convention
`src/admin/features/<name>/` and `src/client/features/<name>/` each hold `api/` (thin wrappers over `apiRequest`), `hooks/`, `pages/`, `components/`, and sometimes `utils/`/`theme/`/`constants.js`. Admin master-data pages live under `src/admin/masters/`. Shared UI primitives are in `src/components/common/<Component>/` (Toast, Modal, tables, etc.) and are used by both apps.

### API client and auth (`src/utils/apiClient.js`)
- All calls go through `apiRequest(path, { method, body, auth })`; base URL is `VITE_API_BASE_URL` or `/api`. It unwraps `payload.data` and throws `ApiError` (with `statusCode`, `errors`) on non-success. `FormData` bodies are passed through untouched (no JSON content-type).
- The access token lives **in memory only**. On load, `AuthProvider` mints one from the httpOnly refresh-token cookie via `/auth/refresh-token` (skipped unless the `ecom.hasSession` localStorage hint is set). A 401 triggers a single deduped refresh-and-retry; failure fires `onSessionExpired`.
- Storefront reads that don't need a login pass `auth: false`. The vendor is inferred server-side from the domain, never sent by the client.
- `src/utils/socketClient.js` shares one socket.io connection for admin realtime features; the event name must match the backend constant (`constants/abandonedCartConstants.js`).

### Styling
Tailwind 4 via `@tailwindcss/vite` (`@import "tailwindcss"` in `src/index.css`); per-feature `theme/theme.js` files hold class-string tokens.
