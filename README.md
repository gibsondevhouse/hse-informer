# HSE Informer

Training administration for chemical manufacturing sites. This repository currently has two implementation paths: the React/Vinext admin and learner pilot in `admin-app/`, and the SvelteKit/PostgreSQL Refactor 001 foundation in `web/`. The five starter requirements, sample records, and course lessons are unapproved. Neither path has passed the live HSE and integration gates.

- [Refactor roadmap](docs/refactor-001.md): target architecture, milestones, verification, and release gates.
- [Implementation ledger](docs/refactor-001-progress.md): completed groundwork and remaining gates.
- [SvelteKit foundation](web/README.md): tenant-scoped PostgreSQL records, Moodle integration, and synthetic development fixtures.
- [React admin and learner pilot](admin-app/README.md): sample preview, protected Cloudflare D1 pilot routes, and course player.
- [Local integration fixture](infra/README.md): PostgreSQL, Keycloak, and two isolated Moodle instances for synthetic tests.
- [Design guidance](docs/coursera-audit/README.md): reference audit, HSE design tokens, and component contracts.
- [UI standard](docs/ui-standard.md): maintained visual tokens, shared patterns, status language, and stability checks.
- [Product direction](docs/vision/phases.txt): planning notes and evidence boundaries.
- [B0 beta administration plan](docs/vision/B0-beta-admin-system.md): pilot acceptance proposal.
- [Regulatory training source map](docs/regulatory/training-source-map.md) and [Respiratory Protection analysis](docs/regulatory/rp-compliance.md): unapproved content and applicability planning.
- [Learning player and component library](docs/lms/component-library.md): PBJ-101 presentation scratch pad and reusable course blocks.

## Run locally

For the SvelteKit foundation, follow [its setup](web/README.md#local-setup). It requires Node.js 22.17 or newer and PostgreSQL. Its seed is synthetic development data.

For the React app, use Node.js 22.13 or newer and npm:

```sh
cd admin-app
npm ci
npm run dev
```

The sample admin workspace is at `/`, the PBJ-101 presentation scratch pad is at `/training/pb-and-j`, and the Respiratory Protection lesson preview is at `/training/respiratory-protection`. PBJ presents one slide at a time, including its overview, with captions, a transcript, and presentation controls. Its state lasts only while the page is open. The protected pilot routes require Cloudflare D1 and Access configuration described in the [React app README](admin-app/README.md#pilot-server-setup).

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Validate

The [SvelteKit commands](web/README.md#commands) cover TypeScript, PostgreSQL integration, browser, and build checks. For the React app, run from `admin-app`:

```sh
npm exec tsc -- --noEmit
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

## Current scope

The SvelteKit foundation has server-owned records and synthetic fixtures for Tifton, Ocilla, and Vernon. The React sample workspace has fictional organizations, sites, learners, and browser-stored edits; those records are never migrated as production evidence. Its protected D1 pilot routes fail closed until the required services and identities are configured. PBJ-101 is practice content, and Respiratory Protection remains a draft lesson. A lesson or knowledge completion alone never grants workplace authorization.

No starter requirement or course is approved, no real DeepHow or HSI data has been imported, and no production authorization is issued. The [private hosted React sample](https://hse-informer-training.clgibso91.chatgpt.site/) is published through Sites; the SvelteKit foundation has not been deployed.

## Repository workflow

This is one Git repository. Commit application, integration, and documentation changes from the repository root.
