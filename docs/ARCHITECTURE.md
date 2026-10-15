# Kalam — Architecture and Refactoring Plan

## Current shape

Kalam is a static, Arabic RTL web application published from the `web-app-v1` branch through GitHub Pages. It deliberately has no server or external runtime dependency yet.

- `index.html`: legal library, legal articles, notes/decisions, saved items, search, printing and JSON backup. Data is stored under `kalam_kalam_v1` in browser LocalStorage.
- `cases.html`: case records and case-linked hearings/deadlines/actions, reminders, printing, calendar export and JSON backup. Data is stored separately under `kalam_cases_v1`.
- `login.html`: visual login prototype only. It is not real authentication and must not be treated as a security boundary.
- `manifest.webmanifest` and `sw.js`: installability and offline caching.
- `.github/workflows/deploy-pages.yml`: deploys the root of `web-app-v1` to GitHub Pages.
- `scripts/smoke-check.mjs`: low-cost checks that run before deployment.

## Current architectural risks

1. Two large HTML files mix markup, styling, data persistence, domain rules and event handling.
2. The legal library and case manager use separate LocalStorage databases. There is no cross-device sync, user account, or shared data layer.
3. LocalStorage has limited capacity and no transactional guarantees. A browser reset can erase records; backups are essential.
4. IDs use timestamps plus random suffixes rather than a formally managed identity scheme.
5. The service worker must not serve cached HTML indefinitely after a deployment. HTML is now network-first, with cached fallback for offline use.
6. Login is a mock-up. Never store passwords in LocalStorage or claim that a static-only login protects client data.
7. Legal deadline calculations are intentionally not automated as legal advice; dates and procedural rules require human verification.

## Target architecture (incremental, no risky rewrite)

### Stage 1 — Stabilize the static release
- Keep Pages deployment tied to `web-app-v1`; do not merge into `main` without explicit approval.
- Run smoke checks before every deployment.
- Use network-first for HTML and cache-first for static assets.
- Keep backup/import flows visible and document their limits.

### Stage 2 — Separate presentation from behavior
Gradually extract modules without changing the user-facing workflows:
- `js/core/storage.js`: versioned read/write, validation, migration and error handling.
- `js/core/backup.js`: export/import with schema validation and a preview before destructive replacement.
- `js/core/ids.js`: stable IDs.
- `js/library/`: legal library rendering, search, hierarchy and actions.
- `js/cases/`: case, hearing, deadline and calendar behavior.
- `css/`: shared design tokens and page-specific styles.
Each extraction should be small, tested, and preserve existing LocalStorage data.

### Stage 3 — Define domain models
- Library item: `id`, `kind`, `title`, `text`, `source`, `classification`, `hierarchy`, `keywords`, `createdAt`, `updatedAt`.
- Case: `id`, `number`, `title`, `court`, `parties`, `opponent`, `status`, `notes`, timestamps.
- Event: `id`, `caseId`, `type`, `date`, `time`, `status`, `notes`.
Do not migrate existing records until a migration function and a round-trip backup test exist.

### Stage 4 — Persistence upgrade
Before multi-device use or sensitive client records, decide on a secured backend and authentication model. A static page plus LocalStorage is a personal prototype, not a secure multi-user case-management system.

## Release acceptance checklist

- Smoke check passes.
- Both primary pages load and retain Arabic RTL layout.
- Existing LocalStorage records remain readable.
- Export then import preserves record counts and key fields.
- Case-linked events remain linked after backup/restore.
- New HTML is fetched after deployment; offline fallback still works.
- No change is pushed to `main` and the `Milafati` repository remains untouched.
