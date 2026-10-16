# Kalam — Architecture and Refactoring Plan

## Current shape

Kalam is a static, Arabic RTL web application published from the `web-app-v1` branch through GitHub Pages. It deliberately has no server or external runtime dependency yet.

- `index.html`: legal library, legal articles, notes/decisions, saved items, search, printing and JSON backup. Data is stored under `kalam_kalam_v1` in browser LocalStorage.
- `cases.html`: case records and case-linked hearings/deadlines/actions, reminders, printing, calendar export and JSON backup. Data is stored separately under `kalam_cases_v1`.
- `login.html`: now forwards to `app.html`, where the real sign-in to an office's encrypted space happens (no server: the office's data is encrypted in its own GitHub repository).
- `app.html`: the lawyer's office space (agenda, case files, deadlines, calculators, legal library, letterhead, client portal settings, backups, office sync), organised in Qalam's spaces with `QNAV`; office identity on first sign-in (`QID`) and other offices' letterheads.
- `portal.html`: the client portal (case stage, news and shared documents; encrypted document upload), in Arabic, French and English. The office is named in the link: `portal.html?o=account/repo`.
- `apk/`: the Android app (Capacitor), built by `.github/workflows/build-apk.yml`; native plugins in `apk/native/`.
- `data/lex/`, `data/fonts/`, `fonts/`, `lib/pdfjs/`, `icons/`: public legal texts, free (OFL) fonts, pdf.js and Qalam's icons.
- See `docs/OFFICE-SPACE.md`.
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
- Both primary pages load and retain Arabic RTL layout; `app.html` and `portal.html` load without errors.
- Existing LocalStorage records remain readable.
- Export then import preserves record counts and key fields.
- Case-linked events remain linked after backup/restore.
- New HTML is fetched after deployment; offline fallback still works.
- No change is pushed to `main` and the `Milafati` repository remains untouched.
