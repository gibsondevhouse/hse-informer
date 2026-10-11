# HSE Informer

Training administration for chemical manufacturing sites. The repository contains a frozen React preview and a SvelteKit/PostgreSQL replacement in progress. The five starter requirements and the respiratory lesson are unapproved drafts.

- [Refactor roadmap](docs/refactor-001.md): architecture, milestones, verification, and release gates.
- [Replacement app](web/README.md): SvelteKit server, tenant-scoped data, and synthetic development fixtures.
- [Local integration fixture](infra/README.md): PostgreSQL, Keycloak, and two isolated Moodle instances for the pilot.
- [React preview](admin-app/README.md): visual and behavioral reference, kept runnable through replacement parity.
- [Design guidance](docs/coursera-audit/README.md): the Coursera reference audit, HSE design tokens, component contracts, and supporting evidence.
- [Product direction](docs/vision/phases.txt): planning notes and evidence boundaries.

## Run locally

For the existing React preview, use Node.js 22.13 or newer and npm:

```sh
cd admin-app
npm ci
npm run dev
```

The replacement needs Node.js 22.17 or newer and PostgreSQL; see [web setup](web/README.md). On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Validate

From `admin-app` for the frozen preview:

```sh
npm exec tsc -- --noEmit
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

## Current scope

The React app is an administrator preview with fictional organizations, sites, learners, and assignments. Assignment edits are stored in the browser. Its records are never migrated as production evidence. The replacement has separate server-owned records and explicitly synthetic fixtures for Tifton, Ocilla, and Vernon. No starter requirement is approved, no live DeepHow or HSI data has been imported, and no production authorization is issued.

The [private hosted React preview](https://hse-informer-training.clgibso91.chatgpt.site/) is published through Sites. The build and hosting metadata are in `admin-app`. The SvelteKit replacement has not been deployed.

## Repository workflow

This repository tracks the app and docs as ordinary files, not submodules. In the original Codex workspace, `admin-app` also retains its independent Git history for Sites publishing. Commit app changes there first, then commit the updated app files and docs from this repository root. A fresh GitHub clone has one normal repository and can run locally with the commands above.
