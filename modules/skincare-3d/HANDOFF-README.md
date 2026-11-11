# Skincare Prototype v1.0.2 — Handoff Package

This ZIP is a snapshot of the working v1.0.2 codebase, packaged for handoff to
the receiving development team. It is **not** a `git` checkout — the local
git repository history was intentionally excluded (see "What's excluded"
below). For version-control history, use the team's existing git remote.

For the detailed, original (Vietnamese) project README covering the full
file-by-file architecture, see [`README.md`](README.md) in this same folder
— that file is unchanged and still the primary technical reference.
This file covers what's new for handoff: quick setup, where integration
docs live, and a consolidated list of known limitations.

## Quick setup

1. This is a static, dependency-free app (no `npm install` needed to run
   it — there is no `node_modules`/build step for the app itself).
2. Serve the folder over `http://`, not `file://` (ES modules and the
   iframe-integration origin checks both require a real HTTP origin):
   ```
   python -m http.server 8000
   ```
   or VS Code's **Live Server** extension, or `npx http-server .`.
3. Open `http://localhost:8000/`. Append `?dev` to the URL to enable
   Developer mode (perf panel, simulated-3D-error toggle, demo-profile
   switcher, and a `window.__skc` debug handle) — all hidden by default.
4. The only runtime network dependency is Three.js 0.160.0 from jsDelivr
   (`index.html`'s import map), loaded only when the "Mô hình 3D" step is
   opened. The 3D head asset (`assets/head.glb`, ~2.5 MB) ships in this
   package.

## Running the existing tests

```
npm test
```
(requires Node.js — not bundled; this ZIP does not assume Node is
installed on the machine that merely *runs* the app, only on a machine
that wants to run its test suite or asset-build tooling.)

This runs the pure-logic test suite in `tests/*.test.mjs`. The
`tests/*.e2e.py` files are browser end-to-end tests (Playwright); they were
**not executed** as part of this handoff's own verification pass — Node.js
and Playwright were unavailable in the environment that prepared this
package. Treat them as present-but-unverified-this-round, not as newly
broken.

## Integration (embedding this app in another site)

Full protocol, security model, and a worked example:
- [`docs/integration.md`](docs/integration.md) — the complete reference:
  iframe embedding, the two-way `postMessage` protocol, the
  `skincare:ready` handshake (read this before writing any host-side
  integration code), the product/quiz data adapter and its field schema,
  and an explicit, accurate statement of what the `hostOrigin` trust model
  does and does **not** guarantee (it is origin-based message filtering,
  not authentication).
- [`examples/host-page-integration.html`](examples/host-page-integration.html) —
  a working host page. Open it over `http://`/`https://` (not `file://`)
  to see a real two-way handshake: it waits for `skincare:ready`, then lets
  you trigger a sample WooCommerce-style catalogue sync and a goals/
  purchases sync, showing the live `host:applied` report.
- [`js/adapter.js`](js/adapter.js) — the data-mapping layer itself,
  independently readable; it never fabricates missing product data.

## 3D/visual asset source

`assets/head.glb` is the shipped runtime asset. Its editable source lives in
`tools/blender/`:
- `head-v052.blend` — the pristine Blender source (MakeHuman CC0 base +
  hand-authored hair/materials), opened by the build script.
- `build-character.py` + `hair_shell.py` — the deterministic build script
  (run via Blender's own Python, headless: `blender --background
  tools/blender/head-v052.blend --python tools/blender/build-character.py`).
  Regenerates `assets/head.glb` and a built snapshot,
  `tools/blender/head-v052-built.blend`, which is also included so the
  team can open the *current, already-built* state directly without
  re-running the script.
- `tools/*.mjs` (Node) — the earlier-stage, foundational pipeline: pulling
  the MakeHuman base mesh, applying morph targets, and GLB optimization.
  See `package.json`'s `build:head`/`build:model`/`gen:face2d` scripts and
  the comments at the top of each `tools/*.mjs` file for exact usage.
- Historical per-checkpoint backup copies of these files (made during this
  release's development for safety/rollback) were intentionally **not**
  included in this handoff — only the current, working versions are here.

## License and attribution

- `assets/head.LICENSE.md` and `assets/CC0-1.0-MakeHuman-LICENSE.ASSETS.md`
  — the 3D head model is derived from the MakeHuman CC0 1.0 base mesh;
  full provenance (source commit, SHA-256, license basis) is documented
  there. CC0 does not require attribution, but the project credits the
  source anyway for transparency.
- `tools/vendor/meshoptimizer-LICENSE.md` — the meshopt encoder bundled
  for GLB optimization is MIT-licensed.
- The brand ("Lumière Skin"), product catalogue, and sample customer
  accounts are fictional placeholder data for this prototype — not real
  commercial products. This is disclosed in the app's own footer.
- The skincare rule set (`js/rules.js`) is illustrative only and has not
  been reviewed by a dermatology professional — also disclosed in-app.

## Known limitations (consolidated)

- **No JSON/PDF export feature exists in this codebase.** Checked
  explicitly across the whole v0.6→v1.0.2 release — there is none to
  preserve; this was confirmed, not assumed.
- **No automated test run (`npm test` / Playwright) was performed as part
  of preparing this handoff package** — Node.js/Playwright were not
  available in the preparing environment. The receiving team should run
  `npm test` and the `tests/*.e2e.py` suite once Node/Playwright are
  available, before treating this as fully regression-verified on their
  own toolchain.
- **`hostOrigin` is not authentication** — see `docs/integration.md`'s
  security section for the precise, non-oversold claim.
- Host-mode data (from an embedding site) is all-or-nothing per session
  once a `skincare:sync` is received; see `docs/integration.md` for the
  exact behavior.
- GPU-rendered 3D has been exercised via software rendering
  (SwiftShader) during development/verification; real-GPU browsers,
  Safari/iOS, and Firefox have not been separately verified this round
  (same caveat as in the original `README.md`'s "Giới hạn" section).

## What's excluded from this ZIP

- `.git/` history (not present in the packaged folder to begin with — the
  git repository root is one level above this project folder).
- Local credentials, tokens, `.env` files — none existed in the source
  tree (verified by an explicit scan before packaging).
- Temporary verification screenshots generated during this release's
  development (`docs/screenshots/v052/`) — kept out as working-session
  artifacts, not project documentation. Pre-existing, version-tagged
  documentation screenshots (`docs/screenshots/0.5/`, `0.5.1/`) **are**
  included, since those are committed project history, not scratch work.
- Dated per-checkpoint backup copies under `tools/blender/` (e.g. files
  suffixed `.v06.`, `.v10a.`, `.v101.`, `.c1.`, `.c2.`, `.prehair.`,
  `.hairfinal.`) — only the current, active build files are included.
- `tools/blender/__pycache__` and Blender's own `.blend1` autosave file.
