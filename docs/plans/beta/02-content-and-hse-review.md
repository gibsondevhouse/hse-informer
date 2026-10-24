# 02 · Content and HSE review

**Goal:** at least one approved HSE course, in English and Spanish, with a review workflow that records who approved what.

## Why

Every requirement and course is marked UNAPPROVED, no HSE owner is named, and the only approved package is the PBJ practice sandbox. A test run with no real course tests the plumbing but not the product. OSHA also expects training in a language and vocabulary workers understand, and there is no translation support in either app today.

## People

| Role | Responsibility | Named |
|---|---|---|
| HSE owner | Owns the requirement records and decides what beta may claim | TBD |
| Qualified HSE reviewer | Approves authority, legal-status label, applicability, recurrence, delivery, evidence, and site overlay for each record | TBD |
| Translator or bilingual reviewer | Checks the Spanish course for accuracy and reading level | TBD |

## Work

### Pilot course

- [ ] Confirm Respiratory Protection (R-001 in [starter records](../../requirements/starter-records.md)) as the pilot course.
- [ ] Finish the seven modules outlined in `admin-app/lib/training.ts` as block content, starting from `respiratory-lesson-content.tsx`.
- [ ] Write the final knowledge assessment: question bank, pass mark, attempt limit, and remediation after a failed attempt. The reviewer sets the pass mark.
- [ ] Write the site addenda for Tifton and Ocilla, covering the respirators, cartridges, procedures, and contacts actually used.
- [ ] Write the practical checklist for donning, seal checks, inspection, and limitations.
- [ ] Get reviewer approval for R-001 and record it.

### Review workflow in the product

- [ ] Add states to course and requirement versions: draft, in review, approved, published, retired.
- [ ] Record the reviewer, the decision, the date, and the reason on each transition. Only the `hse_reviewer` role can approve.
- [ ] Block assignment of any course or requirement version that is not published.
- [ ] Show the legal-status label and approval state wherever a course appears.

### Getting content in

- [ ] Choose the beta content source: the in-house block format from [01](01-platform-decision.md), a DeepHow export, or both. Record the choice.
- [ ] If DeepHow: get a real export and close Gate A as written in the [roadmap](../../refactor-001.md).
- [ ] Build an import for the chosen format that validates the package, computes a checksum, and creates a draft version. Publishing a new version never changes existing records.
- [ ] Add a basic content editor for text, media, and question blocks, or document that beta content is authored as JSON files and imported. A full authoring UI can wait until after beta.
- [ ] Add media upload and storage for images, video, and PDFs, with captions and transcripts required on video.

### Spanish

- [ ] Add an i18n framework to `web/` for the interface, starting with English and Spanish.
- [ ] Store course versions per language. A completion records the language it was taken in.
- [ ] Translate and review the pilot course and its assessment.
- [ ] Let a worker choose a language, and let an administrator set a default per worker.

## Done when

- R-001 and its Respiratory Protection course version are approved by the named reviewer, with the approval visible in the product.
- The course is available in English and Spanish, and a completion shows which language was used.
- An unapproved course version cannot be assigned, by UI or by API.
