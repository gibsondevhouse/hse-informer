# HSE Informer

Training administration for chemical manufacturing sites, with a shared library of five foundational courses. Respiratory Protection is the first course in development.

- [Admin app](admin-app/README.md): training programs, site summaries, assignments, and the opening respiratory lesson preview.
- [Design guidance](docs/coursera-audit/README.md): the Coursera reference audit, HSE design tokens, component contracts, and supporting evidence.
- [Product direction](docs/vision/phases.txt): planning notes.

## Run locally

Use Node.js 22.13 or newer and npm.

```sh
cd admin-app
npm ci
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Validate

From `admin-app`:

```sh
npm exec tsc -- --noEmit
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

## Current scope

The app is an administrator preview with fictional organizations, sites, learners, and assignments. Assignment edits are stored in the browser. Respiratory Protection contains a draft opening lesson; the remaining lessons and final assessment are still in development. Preview progress does not create a training completion or grant workplace authorization.

The [private hosted app](https://hse-informer-training.clgibso91.chatgpt.site/) is published through Sites. The build and hosting metadata are in `admin-app`. Browser interaction and assistive-technology acceptance testing remain pending; automated checks are described in the app README.

## Repository workflow

This repository tracks the app and docs as ordinary files, not submodules. In the original Codex workspace, `admin-app` also retains its independent Git history for Sites publishing. Commit app changes there first, then commit the updated app files and docs from this repository root. A fresh GitHub clone has one normal repository and can run locally with the commands above.
