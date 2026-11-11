# Integration guide (v1.0)

Written for: engineers integrating this prototype into the team's e-commerce site.

## Recommended approach: iframe embed

The app is a self-contained single-page app with its own CSS and module-level
state (`js/main.js`). It was not built as a mountable JS widget, and turning
it into one (separate business-logic/rendering/UI layers) is a real
architectural change, deliberately out of scope here to avoid destabilizing
accepted work this close to a deadline.

```html
<iframe src="https://your-cdn/skincare-prototype/index.html?hostOrigin=https%3A%2F%2Fshop.example.com"
        style="width:100%;height:900px;border:0"></iframe>
```

- All asset references (CSS, JS modules, `assets/head.glb`, textures) are
  relative paths — verified by grepping for root-relative (`/…`) or absolute
  URLs; there are none. The whole folder can be hosted under any subpath or
  CDN prefix with no code changes.
- The app's CSS is scoped to its own page inside the iframe — no collision
  risk with the host site's styles.
- `?hostOrigin=` is **required** to enable inbound data (see below). Without
  it the app runs exactly as a standalone demo, unaffected.

## Two-way protocol (`postMessage`)

### App → host (outbound; works since v0.6, unaffected by whether `hostOrigin` is set)

```js
{ source: 'skincare-widget', type: 'skincare:ready',  detail: { protocolVersion: 1 } } // new in v1.0.2, see below
{ source: 'skincare-widget', type: 'routine:updated', detail: { res, quiz, productIds } }
{ source: 'skincare-widget', type: 'version:saved',   detail: { version } }
{ source: 'skincare-widget', type: 'host:applied',    detail: { report } }   // new in v1.0
{ source: 'skincare-widget', type: 'host:error',      detail: { message } }  // new in v1.0
```

`routine:updated` fires whenever the generated routine is recomputed (quiz
change, product add/remove, restored version, or an applied `skincare:sync`).
Target origin: `hostOrigin` if configured, else `'*'` (so the v0.6 zero-config
demo example still works unmodified).

#### `skincare:ready` — the readiness handshake (required reading)

**Send your first `skincare:sync` only after receiving `skincare:ready`.**
Do not send it immediately after the iframe's `load` event, and do not use an
arbitrary `setTimeout` — both are timing guesses, not guarantees, and will
eventually race on a slow device, a cold cache, or a busy tab.

`skincare:ready` is posted exactly once per page load, synchronously, the
moment the app finishes registering its inbound message listener (only when
`?hostOrigin=` is set). Reloading the iframe is a fresh module execution, so
a fresh `skincare:ready` always follows — there is no state to desync.

```js
let ready = false;
window.addEventListener('message', e => {
  if (e.source !== iframeEl.contentWindow) return;      // confirm it's this iframe
  if (e.data?.source !== 'skincare-widget') return;
  if (e.data.type === 'skincare:ready') { ready = true; sendInitialSync(); }
});
```

This was added after a previous report of intermittent cold-load failures.
**Root cause, found and fixed:** it was not a timing race at all — it was a
genuine bug where a header-rendering function could be called before the
active user profile existed, throwing and silently aborting the rest of the
app's startup script (including message-listener registration) on some
loads. That bug is fixed (see the final report for detail). The
`skincare:ready` handshake was added regardless, because *guessing* when the
app is ready is fragile practice independent of that specific bug — this
way the host never has to guess. Verified with 20 consecutive fresh-iframe
load-and-sync cycles, 20/20 successful, 72ms median time-to-ready, zero
duplicate `ready`/`host:applied` messages.

### Host → app (inbound; **new in v1.0**, opt-in via `?hostOrigin=`)

```js
iframeEl.contentWindow.postMessage({
  source: 'skincare-widget-host',
  type: 'skincare:sync',
  payload: {
    catalog: [ /* product objects, see schema below — optional */ ],
    purchasedProductIds: ['sku1', 'sku2'],  // optional
    goals: ['hydrate', 'acne'],             // optional
    skin: 'dry'                             // optional
  }
}, appOrigin); // appOrigin = the ORIGIN THE APP IS SERVED FROM, not the host's own origin — see below
```

All `payload` fields are optional and can be sent incrementally (e.g. push
`catalog` once, then `goals`/`skin` again later when the user finishes a
questionnaire). The **first** accepted `skincare:sync` message switches the
app into **host mode**: it creates a dedicated `HOST` user, separate from the
app's built-in demo users ("User A", "User B"), which stay completely
untouched. Host mode also hides the "Tài khoản thử nghiệm" (test account)
switcher, since it has no meaning for a real customer.

**The two origins are easy to confuse — this is the single most common
integration bug:**
- `hostOrigin` = the host page's own origin. Put it in the iframe's `src`
  query string; the app uses it both to validate inbound messages and as the
  target when posting outbound ones back.
- `appOrigin` = the origin the app (`index.html`) is actually served from.
  This is `postMessage`'s second argument when the **host sends into the
  iframe** — `postMessage`'s target-origin argument is always the
  *recipient's* origin, never the sender's. If the host and the app are on
  different domains (e.g. host on `shop.example.com`, app on a CDN), these
  are genuinely different values. See
  [`examples/host-page-integration.html`](../examples/host-page-integration.html)
  for a worked, commented example of computing both correctly.

### Security model — what `hostOrigin` is and is NOT

**`hostOrigin` is origin-based message filtering, not authentication.** It
answers "is this message arriving from the browsing context I was told to
trust," the same guarantee the browser itself gives any `postMessage`
listener. It does **not** verify:
- *who the user is* — there is no login, session, or credential involved
  anywhere in this protocol;
- *that the host page's own JavaScript is trustworthy* — if the host page
  has an XSS vulnerability, or loads a compromised third-party script that
  can execute in its origin, that script can post a `skincare:sync` exactly
  as the legitimate host code would, and the app has no way to tell the
  difference;
- *that the data within an accepted message is truthful* — the adapter
  validates *shape* (known categories, known goal keys, resolvable ids), not
  *who asserted it*.

Treat this exactly like any other same-origin `postMessage` integration: it
is appropriate for a host embedding its own first-party widget, not for a
scenario where the host origin itself might be shared with or compromised by
an untrusted third party. If a stronger guarantee is required (e.g. signed
payloads, a server-issued one-time token passed via the iframe URL and
echoed back), that is new work — not something `hostOrigin` alone provides,
and not implemented here.

- Inbound handling is **not registered at all** unless `?hostOrigin=` is
  present on the iframe URL — no accidental exposure.
- Every inbound message is checked against **two** independent conditions,
  both required:
  1. `event.origin === hostOrigin` (the exact origin declared in the URL —
     rejects spoofed/unrelated origins).
  2. `event.source === window.parent` (rejects messages from any other
     frame/script on the page that isn't literally the app's own parent —
     relevant on pages embedding multiple third-party iframes).
- The message itself must carry `source: 'skincare-widget-host'` and
  `type: 'skincare:sync'` — anything else (including the app's own outbound
  messages, which use a different `source` value) is ignored, so there is no
  feedback loop.
- Malformed/invalid payload data never crashes the app: adapter errors are
  caught and reported back via `host:error`; per-field mapping problems
  (unknown category, missing required field, unresolvable product id, …) are
  non-fatal and reported via `host:applied`'s `report` array instead.
- `'*'` as a target origin is only ever used for the app's *own* outbound
  broadcast when no `hostOrigin` was configured (keeps the original v0.6
  zero-config demo working) — it is never used as a stand-in for a real,
  unknown `hostOrigin` on the inbound side, and the example page explicitly
  warns when it falls back to `'*'` (e.g. when opened via `file://`, which
  has no real origin).

## Data mapping (the adapter: `js/adapter.js`)

The adapter is independent, pure, and has **no dependency on how the host
site is built** — it accepts plain JS objects in either of two shapes per
product. It never invents ingredients, usage instructions, warnings, or any
other skincare content: missing/unrecognised fields are left empty and
reported, never guessed. The existing routine engine (`engine.js`'s
`classify()`) already excludes incomplete products from the generated
routine and tells the user why — the adapter does not duplicate that
validation, only field mapping.

### Required fields for a product to be usable by the routine engine

| Internal field | Type | Required for routine eligibility? |
|---|---|---|
| `id` | string (or numeric `id`/`sku`) | Yes — product is dropped entirely without one |
| `category` | one of `cleanser`, `toner`, `serum`, `treatment`, `moisturizer`, `sunscreen` | Yes |
| `functions` | array of strings (see below) | Yes — must be non-empty |
| `recommendedPeriod` | `am` \| `pm` \| `both` | Yes |
| `name` | string | No (defaults to id if missing) |
| `ingredients` | array of strings | No |
| `actives` | array of strings — recognised for caution pairs: `retinoid`, `bha`, `aha`, `vitc` | No |
| `zones` | array of `forehead`, `cheekL`, `cheekR`, `chin`, `face` | No |
| `usageInstructions` | string | No |
| `warnings` | array of strings — shown verbatim to the user | No |

`functions` vocabulary the rule set actually acts on: `cleanse`, `hydrate`,
`oil-control`, `exfoliate`, `renewal`, `antioxidant`, `uv-protect`, `soothe`.
Unknown function strings are kept (harmless — they just won't match any
goal) rather than dropped.

**A product missing any of the three required fields is still accepted and
stored** — the engine itself will exclude it from the generated routine and
surface a "Thiếu dữ liệu" (missing data) notice naming exactly which fields
are missing, rather than silently guessing. This is existing, tested engine
behavior (`data.js` even ships a deliberately-incomplete demo product for
this reason) — the adapter relies on it rather than re-implementing it.

### Shape 1 — "simple" (already close to the internal schema)

```json
{ "id": "p01", "name": "Gentle Cleanser", "category": "cleanser",
  "functions": ["cleanse"], "recommendedPeriod": "both",
  "ingredients": ["Glycerin"], "actives": [], "zones": ["face"],
  "usageInstructions": "...", "warnings": [] }
```

### Shape 2 — WooCommerce-style (REST API shape)

```json
{ "id": 301, "name": "Gentle Cleanser", "sku": "HC-301",
  "categories": [{ "slug": "cleanser" }],
  "meta_data": [
    { "key": "skincare_functions", "value": "cleanse" },
    { "key": "skincare_period", "value": "both" },
    { "key": "ingredients", "value": "Glycerin, Panthenol" }
  ] }
```

Recognised `meta_data`/`attributes` keys: `skincare_category`/`category`,
`skincare_functions`/`functions`, `ingredients`, `skincare_actives`/`actives`,
`skincare_period`/`recommended_period`, `skincare_zones`/`zones`,
`usage_instructions`/`directions`, `skincare_warnings`/`warnings`. A host
using different meta key names should either rename them before sending, or
send shape 1 directly — the adapter does not guess at unrecognised key names.

### Complete flow (host data → routine)

`host page` → `postMessage(skincare:sync)` → `main.js` message listener
(origin-validated) → `adapter.mapCatalog()`/`mapQuiz()`/`mapPurchasedIds()`
→ `data.js setCatalog()`/`upsertUser()` (in-place mutation of the same
catalogue/user arrays every other module already reads via live ES-module
bindings — **zero changes to `engine.js`, `manager.js`, or `rules.js`**) →
existing `RoutineManager.setQuiz()` → existing `recompute()` → the normal
UI re-render path, identical to a user editing the quiz/cart by hand → a
`host:applied` message reporting what was accepted/dropped.

### Demonstrated, working example

[`examples/host-page-integration.html`](../examples/host-page-integration.html) —
sends a 4-product WooCommerce-style catalogue (one product deliberately
missing required fields) and a quiz/purchase payload (one deliberately
unknown goal, one deliberately unresolvable product id), and displays the
live `host:applied` report showing exactly what was mapped vs. dropped.
Open it directly in a browser — no build step. For a real cross-origin test,
serve both the example and the app over `http://`/`https://` rather than
opening via `file://` (see the on-page warning about `'*'` origins).

## Known limitations

- **No standalone JSON/PDF export feature exists in this codebase** —
  searched for it; there is none to "preserve". If the host site needs one,
  it is new work, not a regression. (Confirmed again for v1.0; unchanged
  from the v0.6 finding.)
- Host mode is **all-or-nothing per session** once triggered: there's no
  per-call way to say "ignore this update," and a host update always wins
  over a manual switch back to a demo account via the (now-hidden-in-host-
  mode) test-account switcher. Documented behavior, not a bug, but worth
  knowing if the host sends updates on a timer.
- `purchasedProductIds` must reference product ids present in a catalogue
  already sent in the same or an earlier `skincare:sync` — there's no
  separate "look this id up elsewhere" fallback.
- No authentication beyond origin + source checks — this matches a typical
  trusted first-party iframe embed, not a scenario where the host origin
  itself might be compromised or shared with untrusted third parties.

## Account/profile indicator (customer-facing header)

A small, non-interactive indicator sits in the shared header on every
customer screen (storefront, questionnaire, routine, 3D/2D viewer,
timeline) — not just the storefront:

- **Standalone mode:** `<profile name> · Hồ sơ mẫu` ("Sample profile") — a
  static label, deliberately worded so it cannot be mistaken for a real
  login.
- **Host mode:** `Đang dùng dữ liệu từ website của bạn` ("Using data from
  your website") — confirms host data is active without inventing a
  customer name or claiming authentication.
- Neither is clickable and neither performs any action — there is no
  login/logout flow in this prototype.
- **The demo-profile switcher** (`#acctPicker`, swaps between the two
  built-in sample profiles "Linh"/"Minh") is separate from the indicator
  above and only ever appears with `?dev` — see next section.

## Developer-only mode

`?dev` on the URL (e.g. `index.html?dev`) unlocks the "Developer mode"
footer link, the performance panel, the demo-profile switcher, and a
`window.__skc` debug handle. Without `?dev`, none of that exists in the DOM
or on `window` — verified in the v1.0.2 regression pass (see the main
report).

## Testing the integration locally

1. Serve the app's folder over `http://` (any static file server — opening
   `index.html` via `file://` breaks `postMessage` origin checks, since
   `file://` pages have no real origin). From this folder:
   `npx http-server .` or `python -m http.server 8000` both work.
2. Open [`examples/host-page-integration.html`](../examples/host-page-integration.html)
   through that same server (not `file://`). It auto-computes both origins,
   waits for `skincare:ready`, then lets you trigger a sample catalogue
   sync and a goals/purchases sync, with the live `host:applied` report
   shown in the page.
3. To test a subdirectory deployment (host origin ≠ server root), copy the
   whole folder under a nested path (e.g. `assets/skincare-widget/`) and
   point the iframe `src` at it — every asset reference in this project is
   a relative path, so no code changes are needed. Verified directly for
   this release: 3D model, CSS, and all JS modules loaded correctly with
   zero console errors when served from a nested subdirectory path.
