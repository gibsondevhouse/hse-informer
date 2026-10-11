# HSE Informer

Training administration for chemical manufacturing sites. The active implementation is the SvelteKit/PostgreSQL app in `web/`. The React app remains a frozen parity reference. The five starter requirements and respiratory lesson are unapproved drafts.

- [Refactor roadmap](docs/refactor-001.md): architecture, milestones, verification, and release gates.
- [Replacement app](web/README.md): SvelteKit server, tenant-scoped data, and synthetic development fixtures.
- [Local integration fixture](infra/README.md): PostgreSQL, Keycloak, and two isolated Moodle instances for the pilot.
- [React preview](admin-app/README.md): visual and behavioral reference, kept runnable through replacement parity.
- [Design guidance](docs/coursera-audit/README.md): the Coursera reference audit, HSE design tokens, component contracts, and supporting evidence.
- [Product direction](docs/vision/phases.txt): planning notes and evidence boundaries.

## Run locally

Start with the [SvelteKit setup](web/README.md), which requires Node.js 22.17 or newer and PostgreSQL. Its synthetic seed is for development only.

For the frozen React preview, use Node.js 22.13 or newer and npm:

```sh
cd admin-app
npm ci
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Validate

The [web commands](web/README.md#commands) cover TypeScript, PostgreSQL integration, browser, and build checks. For the frozen preview, run from `admin-app`:

```sh
npm exec tsc -- --noEmit
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

## Current scope

The SvelteKit app has server-owned records and explicitly synthetic fixtures for Tifton, Ocilla, and Vernon. The React preview has fictional organizations, sites, learners, and browser-stored assignment edits; its records are never migrated as production evidence. No starter requirement is approved, no live DeepHow or HSI data has been imported, and no production authorization is issued.

The [private hosted React preview](https://hse-informer-training.clgibso91.chatgpt.site/) is published through Sites. The build and hosting metadata are in `admin-app`. The SvelteKit replacement has not been deployed.

## Repository workflow

This is one Git repository. Commit application, integration, and documentation changes from the repository root.
