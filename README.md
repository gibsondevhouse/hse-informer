# HSE Informer

Training administration for chemical manufacturing sites, with a shared library of ten course outlines. Respiratory Protection is the first course in development.

- [Admin app](admin-app/README.md): training programs, site summaries, assignments, and the opening respiratory lesson preview.
- [Design guidance](docs/coursera-audit/README.md): the Coursera reference audit, HSE design tokens, component contracts, and supporting evidence.
- [Product direction](docs/vision/phases.txt): planning notes.
- [B0 beta administration plan](docs/vision/B0-beta-admin-system.md): phased delivery, dependencies, and pilot acceptance criteria; this is a planning proposal.
- [Regulatory training source map](docs/regulatory/training-source-map.md): supplied Federal OSHA general-industry planning reference and course mapping.
- [Respiratory Protection compliance analysis](docs/regulatory/rp-compliance.md): requirements review and LMS/course design boundaries for 29 CFR 1910.134.
- [Learning player and component library](docs/lms/component-library.md): the reusable course player, the learner-facing [PBJ-101 practice course](admin-app/app/training/pb-and-j/page.tsx), and a separate author component lab.

## Run locally

Use Node.js 22.13 or newer and npm.

```sh
git clone https://github.com/gibsondevhouse/hse-informer.git
cd hse-informer/admin-app
npm ci
npm run dev
```

Open the local URL printed by the development server. The admin workspace is at `/`, the PBJ practice course is at `/training/pb-and-j`, and the Respiratory Protection preview is at `/training/respiratory-protection`.

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

The app is an administrator preview with fictional organizations, sites, learners, and assignments. Assignment edits are stored in the browser. Respiratory Protection contains a draft opening lesson; the remaining lessons and final assessment are still in development. Preview progress does not create a training completion or grant workplace authorization. Course regulatory metadata is a planning summary, not legal advice; Chemical Hygiene remains under domain review.

Cloning this repository brings the app source and documentation to another computer. Browser-local assignment edits, learner progress, and preferences stay in the browser where they were created.

The [private hosted app](https://hse-informer-training.clgibso91.chatgpt.site/) is published through Sites. The build and hosting metadata are in `admin-app`. Browser interaction and assistive-technology acceptance testing remain pending; automated checks are described in the app README.

## Repository workflow

This repository tracks the app and docs as ordinary files, not submodules. In the original Codex workspace, `admin-app` also retains its independent Git history for Sites publishing. Commit app changes there first, then commit the updated app files and docs from this repository root. A fresh GitHub clone has one normal repository and can run locally with the commands above.
