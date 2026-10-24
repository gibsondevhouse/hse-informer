# Getting started with HSE Informer · 1.0.0

**State: prepared source; administrator review, import into the chosen Moodle site, and participant verification pending.** This is an in-house practice course about using the portal. It contains no operational HSE instruction and grants no workplace authorization.

The three HTML fragments are learner-facing content for native Moodle Page activities. `questions.gift` is an operator-only question-bank import containing the answer key. Keep it out of learner downloads and web-served directories. Moodle must grade the native Quiz; this course has no client-side answer checker or player.

## Moodle setup

Use Moodle's documented [GIFT import format](https://docs.moodle.org/503/en/GIFT_format), [Quiz settings](https://docs.moodle.org/503/en/Quiz_settings), and [activity completion settings](https://docs.moodle.org/503/en/Activity_completion_settings) for the native activities below.

1. Create a hidden course named **Getting started with HSE Informer · beta practice**, short name `HSE-BETA-PRACTICE-1.0.0`. Enable course completion. Label the course as practice material.
2. Add three Page activities in order: **Find your assigned training**, **Learn and resume**, and **Your profile and completion history**. Paste the matching HTML fragment into each Page editor. Require viewing each Page for activity completion. All content is text; no media alternative is needed.
3. Import `questions.gift` into a dedicated question-bank category named `HSE beta practice 1.0.0`. Add its ten fixed questions to a native Moodle Quiz named **Practice check**. Do not attach the GIFT file to a learner-visible resource.
4. Set the Quiz maximum grade to 100, grade to pass to 80, attempts allowed to 3, grading method to highest grade, no time limit, and question behavior to deferred feedback. Shuffle the choices. Show feedback after submission to support remediation. Require a passing grade for activity completion.
5. Set course completion to require **all three Page activities and the passed Quiz**. A failed or merely submitted quiz must not complete the course. Keep self-enrollment and guest access disabled; portal enrollment supplies the learner.
6. Have a beta administrator review the content, answer key, assessment settings, fail/retry/pass behavior, and resume on another device. After review, export the exact Moodle course backup and record its SHA-256. Register its Moodle course ID, content source `in_house`, content version `1.0.0`, delivery format **Moodle lessons and quiz**, and `practice_only=true` in HSE Informer. Leave the SCORM-specific IDs blank. Use the reviewed Moodle export checksum for the published mapping.
7. Publish through the normal review/verification controls. Confirm that a learner's passed course produces the canonical Moodle completion time and score in HSE Informer. Preserve this course/version when preparing a later version; use a new Moodle course ID and new portal mapping.

The source-file hashes in `manifest.json` identify this prepared material. They are not a substitute for reviewing the installed Moodle configuration or hashing the reviewed Moodle export. No reviewer approval or live deployment is claimed by these files.

## Focused acceptance run

- Stop after the second Page, sign out, and resume as the same learner in another browser/device. Verify saved activity progress.
- Fail the first Quiz attempt. Verify no course completion exists and the portal still shows incomplete learning.
- Review the feedback and pass a later attempt. Verify the highest score, three-attempt limit, canonical source completion, and the learner's transcript.
- Confirm another learner cannot access the first learner's attempts or records.
- Publish a later course version separately and verify the first version's completion record remains unchanged.
