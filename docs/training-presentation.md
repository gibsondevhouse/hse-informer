# Authoring reusable training presentations

`PresentationPlayer` is the shared player for course presentations. It receives a
serializable `PresentationCourse`, renders typed slides, derives chapter boundaries
and slide counts from their order, and provides the outline, slide browser,
captions, transcript, supporting details, fullscreen, and keyboard navigation.
PBJ-101 supplies course data and its existing illustration adapter; its Overview
demonstrates eight information templates, while Ingredients and Safety & hygiene
demonstrate five interactive templates. Other courses use the same player without
changing it.

## Choose a template for the learning task

| Template       | Use it to                                                             | Required `content` fields                                                   |
| -------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `introduction` | Establish the purpose, audience, and course structure.                | `purpose`, `audience`, `structure`                                          |
| `objectives`   | State observable actions grouped by stage or competency.              | `groups: { title, items }[]`                                                |
| `roadmap`      | Preview chapters and jump to their opening slides.                    | `chapters: { title, description, targetSlideId }[]`                         |
| `diagram`      | Explain an ordered transfer, process, or decision handoff.            | `nodes: { id, title, text }[]`, `description`; optional `caption`           |
| `table`        | Compare opportunities, actions, and checks across multiple rows.      | `caption`, `columns`, `rows`; optional `rowLabels`                          |
| `procedure`    | Present a sequence with cautions and verification points.             | `steps: { title, text, caution?, verification? }[]`; optional `callout`     |
| `practice`     | Let the learner choose a scenario response and inspect its reasoning. | `prompt`, `situation`, `options: { id, text, outcome, correct }[]`          |
| `summary`      | Reinforce the finished standard and provide review resources.         | `standard: { title, text }[]`, `takeaways`, `references`; optional `jobAid` |

The type definitions live in `admin-app/lib/lms/presentation.ts`. They reuse the
existing LMS table, step, definition, reference, and scenario option field shapes.
Presentation practice is separate from the LMS assessment and completion engine.

Each slide has a stable `id`, `chapter`, `eyebrow`, `title`, `lead`, `caption`, and
`transcript`, plus an optional `takeaway`. A template slide sets `layout: 'template'`
and its `template` discriminator. Keep IDs unique within a course, keep chapter
slides contiguous, and point roadmap entries to real slide IDs. The course order
determines chapter order; roadmap links target IDs so insertions do not break them.

Use the lead for a plain-language summary. Primary slide content and practice
never scroll. Preserve readable text sizes and use the template's topic selection
to reveal dense material one part at a time. Spacious stages use compositions that
match the learning task: a course briefing with entry tiles, competency cards,
a chapter map, connected pathway stages, a situations rail for comparisons,
a numbered procedure, and a review panel with its resource rail on the right.
The template chooses its composition; authors use the same content fields.

When space is limited, topic choices become a compact select. Larger collections
also use the select: more than three objective groups, pathway nodes, or procedure
steps; more than six roadmap chapters; or more than five comparison situations. This keeps every topic
available and prevents visual connectors from suggesting the wrong sequence.
Longer prose is
divided into bounded content pages within the current topic; this does not add
slides to the course or change its chapter positions. The varied compositions
preserve the same topic access, readable type, and no-scroll behavior.

When a topic needs multiple pages, use **Previous detail page** and **Next detail
page** beside its page count. These controls move through the selected topic;
the player's **Previous slide** and **Next slide** controls move through the
course. The fitted panel recalculates page breaks when its available space changes
or fonts finish loading. Keep titles and link labels concise; write the longer
explanation in prose, which can be divided between pages at word boundaries.

Keep each authored slide focused on one learning task. Write short, descriptive
topic titles so learners can find an objective, diagram stage, table row, procedure
step, or summary item. Split distinct learning tasks across slides instead of
reducing the font size or squeezing more columns into a table. Give every table a
descriptive caption, meaningful column headers, and the same number of cells in
each row as there are columns. Optional `rowLabels: string[]` supplies concise
topic names in the same order as `rows`; omitted labels default to **Situation 1**,
**Situation 2**, and so on. These labels help navigation while the panel preserves
the full cell text under its column heading. Authors do not supply viewport sizes,
page breaks, or scrolling modes.

## Supporting detail, visuals, and practice

Add optional `details` with any of these populated sections:

- `explanation: string[]` for additional depth beyond the main slide.
- `terms: { term, definition, example? }[]` for terminology at the point of use.
- `sources: { label, href }[]` for the references supporting that slide.

The player omits empty sections and shows available detail in a scrollable panel
on wide screens or an accessible dialog on small screens. Supporting details and
transcripts may scroll; the main slide and its practice activity stay within the
available stage. Keep the transcript as the slide's narrative; detail is a separate
place for explanation and references. Essential instructions must remain available
in the slide's topic and content pages rather than relying on the optional detail
panel.

The diagram template presents supplied nodes as ordered topics. Learners select a
stage to read its explanation, then select **The whole pathway** to read the
complete `description` and optional `caption`. Supply a description explaining how
the stages connect and what moves between them; the order alone does not explain
the relationship. Wide, tall stages connect the primary stage buttons visually;
supporting topics stay separate from that path. This equivalent pathway text must
carry the full meaning when the compact layout has no visible connectors. Choose
the template when an ordered transfer or process helps explain the task. For more
complex branches or other diagram forms, add a reviewed template rather than
implying those relationships with a linear pathway.

Practice uses one correct option, unique option IDs, and an explanatory `outcome`
for every option. Its stages are **Scenario → Review answers → Select → Check
answer → Feedback / Try again**. Learners read the situation, review the possible
responses, select one, and explicitly submit it before seeing its reasoning.
Long situation text, answer text, and feedback use bounded pages without scrolling
or advancing to another course slide. Selection alone never reveals feedback.

Retry clears the submitted result. The player retains responses while the current
presentation is mounted, including when the learner navigates away and returns.
Reloading or opening a new presentation session clears them. There is no grade,
pass threshold, completion gate, or formal training record.

## Example: a different course and its own meaningful visual

This authoring example describes a general equipment handoff. Replace its content
with the actual approved procedure and references before publishing a course.
The pathway conveys responsibility moving from preparation to acknowledgement;
it uses no PBJ text, artwork, or changes to the player.

```tsx
import { PresentationPlayer } from "@/components/presentation/presentation-player";
import type { PresentationCourse } from "@/lib/lms/presentation";

const handoffCourse: PresentationCourse = {
  id: "equipment-handoff-preview",
  code: "HANDOFF-101",
  title: "Equipment handoff",
  sidebarTitle: "A clear handoff.",
  tagline: "Prepare. Communicate. Confirm.",
  brand: { label: "Training library", href: "/" },
  returnLink: { label: "Return to library", href: "/" },
  statusLabel: "Draft preview",
  slides: [
    {
      id: "handoff-purpose",
      chapter: "Overview",
      eyebrow: "Course introduction",
      title: "Make the next action clear",
      lead: "A handoff connects the person finishing a task to the person continuing it.",
      layout: "template",
      template: "introduction",
      content: {
        purpose: "Explain the information needed to continue a task.",
        audience: "People preparing and receiving an equipment handoff.",
        structure: "Review the pathway, then practice preparing and confirming the handoff.",
      },
      caption: "Prepare the information and confirm who will take the next action.",
      transcript: ["This overview introduces the information flow during an equipment handoff."],
    },
    {
      id: "handoff-pathway",
      chapter: "Overview",
      eyebrow: "Information pathway",
      title: "From task status to a confirmed next action",
      lead: "Each stage gives the next person the information they need.",
      layout: "template",
      template: "diagram",
      content: {
        nodes: [
          { id: "prepare", title: "Prepare", text: "Describe the current task status." },
          {
            id: "communicate",
            title: "Communicate",
            text: "Share that status with the receiving person.",
          },
          { id: "confirm", title: "Confirm", text: "Identify who will take the next action." },
        ],
        description:
          "Task status moves from the person preparing the handoff to the receiving person. The receiving person then confirms ownership of the next action. Arrows show the order of this communication.",
        caption: "Prepare information → share it → confirm ownership.",
      },
      caption: "The handoff finishes with a clear owner for the next action.",
      transcript: [
        "Prepare the task status, communicate it to the receiving person, and confirm who will act next.",
      ],
      details: {
        terms: [
          {
            term: "Handoff",
            definition: "A transfer of task information and responsibility between people.",
          },
        ],
      },
    },
  ],
};

export default function EquipmentHandoffPage() {
  return <PresentationPlayer course={handoffCourse} />;
}
```

Existing editorial slides remain supported as `LegacyPresentationSlide` with
`layout: 'cover' | 'overview' | 'principles' | 'split' | 'steps' | 'comparison' |
'closing'`, `art: string`, and optional `{ title, body }[]` points. To use this
format, supply `renderArtwork(key)` and `artworkLabels` to the player from a client
wrapper, as the PBJ wrapper does. The renderer is a React function and must stay
in the client component; the course data remains serializable. Legacy artwork and
its visible `artworkLabels` captions are decorative and hidden from assistive
technology. Put all essential meaning in the slide text; use the diagram template
and its text description for instructional visuals. Text-only templates need no artwork adapter. Interactive visuals use the same
`renderArtwork(key)` adapter and require a complete description in the data.

## Review before using a course

- Confirm unique slide and option IDs, valid roadmap targets, populated feedback,
  one correct practice option, and complete diagram descriptions.
- Review dense text, long headings, and multirow tables at desktop, phone, and
  short viewport sizes. Verify that the main slide and every practice stage fit
  without scrolling, content stays readable, and navigation remains visible.
- Visit every topic and content page, including long answer text and feedback.
  Check the compact topic select and repeat the layout check after resizing,
  opening supporting details, enabling captions, and entering fullscreen.
- Check every detail section, keyboard operation, focus return, captions,
  transcript, fullscreen, practice retry, and response retention after navigation.
- Verify source links against the course's approved reference material. Add
  technical or regulatory guidance only through that course's content review.

The PBJ pilot uses the existing course references and job aid, updates its
Overview, Ingredients, Safety & hygiene, Workspace & tools, and Procedure chapters.
Quality & cleanup adds an evidence and consequence pilot; the original closing recap remains. Saved progress, search, bookmarks,
narration, graded assessments, and backend training records are separate work.

## Interactive learning templates

Choose the interaction according to the learner's action. Avoid using the same
pattern for every slide; alternate visual investigation, comparison, rehearsal,
and decisions.

| Template              | Use it when                                                                       | Content                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visual-exploration`  | The learner should inspect meaningful parts of a scene, label, or transfer route. | `visual`, `targets` with stable IDs, text, optional checks and percentage `x`/`y` positions.                                                             |
| `comparison-activity` | Differences between alternatives change the method.                               | `items` with distinct visuals; optional `decision` using the existing scenario option shape. Desktop pairs the first item with the selected alternative. |
| `guided-decision`     | A situation needs a response, or a requirement leads through a decision path.     | `visual` and either `decision` or `stages`.                                                                                                              |
| `classification`      | Learners need to distinguish event types.                                         | `categories` using `SortingBlock['categories']`, and items with `category`, text, label, and an explanation.                                             |
| `procedure-sequence`  | The action, its order, and a verification point belong together.                  | `steps`, optional `startNumber`, and optional item `marker` such as `Pause` for a conditional action outside the numbered method.                        |

Every content object has an `activityId` unique within its slide. The player
remembers selected items, explored targets, submitted choices, and classification
assignments by **slide ID + activity ID** during this session. Navigation is always
available. Reloading clears the responses; no state is written to storage or a
training service. Classification requires all events to be assigned before
**Check all** becomes available; it reports explanations for each event, not a
score. Choices show outcomes only after explicit submission. Retry clears the
corresponding answers.

Wide screens place the visual beside its explanation. Compact screens offer
**View visual / Read detail**, one selected hotspot, a topic selector, and item
navigation. A short landscape screen moves controls beside the content. Prose and
feedback use `FittedPanel` pages, never slide scrolling. The topic selector provides
an equivalent way to reach every hotspot. Controls are inside
`data-training-interactive` so arrow keys do not navigate the presentation while
operating an activity. Keep labels brief; put long descriptions in `text` or
`check`. Provide source references and terminology through ordinary slide details.

Artwork belongs to the course wrapper, and descriptions belong to course data.
The `visual.art` key resolves through `renderArtwork`; `description` explains all
essential visual meaning, including arrows, relationships, and any important
label text. `aspectRatio` defaults to 1.5 (a 600 × 400 illustration). Set it to match
the actual artwork so percentage hotspots align. Provide explicit examples rather
than decorative pictures. If artwork cannot be resolved, the description remains
available. Illustrative labels must identify themselves as training examples.

For another course, author the usual slide metadata and then supply these content
shapes. This equipment handoff example demonstrates the interface, not operating
instructions for any particular equipment:

```tsx
import type { InteractiveSlide } from "@/lib/lms/presentation";

const base = {
  layout: "template" as const,
  chapter: "Handoff",
  eyebrow: "Inspect and communicate",
  title: "Explore the handoff station",
  lead: "Find the identification and status information.",
  caption: "Check identification and status before the handoff.",
  transcript: ["The illustration connects an equipment identifier to its status card."],
};
const visual = {
  art: "handoff-station",
  description:
    "An equipment identifier sits on the left; its matching status card sits on the right.",
  aspectRatio: 1.5,
};
const items = [
  { id: "identifier", label: "Identifier", text: "Locate the equipment identifier.", visual },
  { id: "status", label: "Status card", text: "Read the matching status information.", visual },
];
const decision = {
  situation: "The status card and equipment identifier do not match.",
  prompt: "What should happen before the handoff?",
  options: [
    {
      id: "confirm",
      text: "Resolve the mismatch.",
      correct: true,
      outcome: "Confirm the intended equipment and its status before continuing.",
    },
    {
      id: "guess",
      text: "Assume the card is correct.",
      correct: false,
      outcome: "An assumption leaves the mismatch unresolved.",
    },
  ],
};
const slides: InteractiveSlide[] = [
  {
    ...base,
    id: "inspect",
    template: "visual-exploration",
    content: {
      activityId: "station",
      visual,
      targets: [
        { ...items[0], x: 25, y: 50 },
        { ...items[1], x: 75, y: 50 },
      ],
    },
  },
  {
    ...base,
    id: "compare",
    title: "Compare the information",
    template: "comparison-activity",
    content: {
      activityId: "compare-records",
      items,
      decision,
    },
  },
  {
    ...base,
    id: "decide",
    title: "Resolve the mismatch",
    template: "guided-decision",
    content: {
      activityId: "handoff-decision",
      visual,
      decision,
    },
  },
  {
    ...base,
    id: "classify",
    title: "Check each handoff",
    template: "classification",
    content: {
      activityId: "handoff-events",
      categories: [
        { id: "ready", label: "Ready" },
        { id: "confirm", label: "Confirm" },
      ],
      items: [
        {
          id: "match",
          label: "Matching records",
          text: "The identifier and status card agree.",
          category: "ready",
          explanation: "The record is linked to the intended equipment.",
        },
        {
          id: "mismatch",
          label: "Mismatched records",
          text: "The identifiers differ.",
          category: "confirm",
          explanation: "Resolve the mismatch before handoff.",
        },
      ],
    },
  },
  {
    ...base,
    id: "rehearse",
    title: "Rehearse the handoff",
    template: "procedure-sequence",
    content: {
      activityId: "handoff-sequence",
      steps: items,
    },
  },
];
// In a client wrapper, supply the meaningful site-specific visual:
// <PresentationPlayer course={{ ...courseMetadata, slides }}
//   renderArtwork={(key) => key === 'handoff-station' ? <HandoffStationDiagram /> : null} />
```

Before publishing, replace the shared sample titles, captions, and transcripts
with a complete narrative for each actual activity, including every possible
outcome. Supply distinct comparison illustrations when the alternatives differ.
The PBJ implementation is the complete example for five different compositions.

Run the presentation checks without a database:

```sh
npm --prefix web run test:e2e:presentation
# Or use an already running preview:
REACT_PREVIEW_URL=http://localhost:5173 npm --prefix web run test:e2e:presentation
```

## Text-led layouts and “See more”

Workspace & tools and Procedure demonstrate five text compositions. These layouts
need no decorative artwork. Give each slide a distinct reading purpose:

| Template | Use for | Composition |
| --- | --- | --- |
| `text-brief` | One primary instruction and two supporting points | Wide editorial column with two shorter notes |
| `text-ledger` | A denser reference or readiness checklist | Ruled rows with numbered entries |
| `text-focus` | One memorable action and a supporting check | Large key message with a smaller companion column |
| `text-sequence` | Two or three ordered actions | Numbered columns read from left to right |
| `text-contrast` | Two conditions, methods, or moments | Paired columns with distinct labels |

Use two sections for focus/contrast, three for brief, and two or three for
sequence/ledger. Keep the essential action, critical caution, and acceptance
criterion in `text`. Put explanations and secondary examples in optional `more`.
Do not add a reveal to every section just for consistency. PBJ alternates short
messages, moderate action sequences, and denser reference rows.

```ts
import type { TextSlide } from '@/lib/lms/presentation';

const handoff: TextSlide = {
  id: 'handoff-ready',
  chapter: 'Workspace',
  layout: 'template',
  template: 'text-contrast',
  eyebrow: 'Before handoff',
  title: 'Match the record to the item',
  lead: 'Confirm the identifier before continuing.',
  caption: 'Compare the item identifier with its accompanying record.',
  transcript: [
    'At the item: Read its identifier.',
    'At the record: Confirm the same identifier is shown.',
    'If they differ: Resolve the mismatch before handoff.',
  ],
  content: {
    sections: [
      { id: 'item', marker: 'At the item', title: 'Read the identifier', text: 'Read its identifier.' },
      {
        id: 'record', marker: 'At the record', title: 'Confirm the match',
        text: 'Confirm the same identifier is shown.',
        more: [{ title: 'If they differ', text: 'Resolve the mismatch before handoff.' }],
      },
    ],
  },
};
```

“See more” temporarily replaces the composition with a readable, paged
explanation. Back to slide or Escape returns focus to the originating button.
Compact screens use a labeled section selector and one section at a time;
longer copy uses measured pages, never smaller type or a scrolling main slide.
Reading is optional and does not affect completion. Include all essential and
expanded copy in the transcript; use slide details for separate source references
and definitions. Section titles and markers should be short. Preview all pages
at phone, short landscape, and desktop sizes when authoring longer copy.

## Evidence and consequence templates

Quality & cleanup pilots three additional patterns. The seven stable slide IDs
remain intact; serving uses the existing comparison template, storage uses the
text ledger, and the original closing slide remains the final recap.

| Template | Learning purpose | Authoring contract |
| --- | --- | --- |
| `inspection` | Observe an unmarked scene, choose findings, then compare with annotations | A meaningful visual and full text equivalent, a scenario decision, and labeled annotation coordinates |
| `before-after` | Explain a visible change and how to verify it | One or more aligned visual pairs, explanation, and a verification point |
| `branching-case` | Make several decisions and review their consequences | A start node, decision nodes with explicit destinations, and outcome nodes with a debrief |

For inspection, do not place answer markers on the initial scene. Submit reveals
feedback and enables the annotated scene; retry removes those markers. The text
version must give the same observable evidence as the visual, including what
cannot be established from appearance. In PBJ, appearance cannot confirm the
recipient match or rule out allergen cross-contact.

Before/after images should share framing so the change is easy to find. The
explanation includes both text equivalents and a verification point. Compact
screens switch between Before and After; all explanation text uses fitted pages.
A tidy picture must not be treated as proof that an invisible process occurred.
For example, PBJ explicitly requires checking sanitizing actions against the label.

Branching decisions use the existing ungraded practice control. Selecting an
answer does not advance. Submit shows feedback; Continue case follows that
option's destination. The debrief includes the choices and explanations along the
learner's route. Restart clears the current case attempt. All memory stays within
the presentation session, keyed by slide and activity IDs. Nothing gates slide
navigation or changes grading/completion.

```ts
import type { BranchingCaseContent, BeforeAfterContent, InspectionContent } from '@/lib/lms/presentation';

const comparison: BeforeAfterContent = {
  activityId: 'record-correction',
  pairs: [{
    id: 'identifier', label: 'Record identifier',
    before: { art: 'record-mismatch', description: 'The item and its record show different identifiers.' },
    after: { art: 'record-match', description: 'The corrected record shows the same identifier as the item.' },
    explanation: 'Resolve the discrepancy before handoff.',
    check: 'Compare the identifier on the actual item with the accompanying record.',
  }],
};
const inspection: InspectionContent = {
  activityId: 'record-inspection',
  visual: comparison.pairs[0].before,
  annotations: [{ id: 'mismatch', label: 'Identifier mismatch', x: 50, y: 50,
    text: 'The identifiers differ. Resolve the mismatch before handoff.' }],
  decision: {
    situation: 'Compare the item and its record before handoff.',
    prompt: 'What does the evidence support?',
    options: [
      { id: 'pause', text: 'Pause and resolve the mismatch.', correct: true, outcome: 'The record must match the intended item.' },
      { id: 'continue', text: 'Continue because a record is present.', correct: false, outcome: 'The existence of a record does not establish a match.' },
    ],
  },
};
const branching: BranchingCaseContent = {
  activityId: 'handoff-case', startNodeId: 'review',
  nodes: [
    { id: 'review', kind: 'decision', title: 'Review the handoff',
      ...inspection.decision,
      options: inspection.decision.options.map(option => ({ ...option,
        nextNodeId: option.id === 'pause' ? 'resolve' : 'unresolved' })),
    },
    { id: 'resolve', kind: 'outcome', title: 'Ready for correction', text: 'Resolve the mismatch before handing over the item.' },
    { id: 'unresolved', kind: 'outcome', title: 'Mismatch remains', text: 'The record still needs correction. Review the evidence and try again.' },
  ],
};
```

For a longer case, route options to further decision nodes before the final
outcome. Keep graphs finite, destinations valid, every node reachable, and every
option explained. Include every situation, answer, consequence, visual equivalent,
and final outcome in the transcript. New courses provide their own meaningful
artwork through `renderArtwork`; the shared renderer contains no PBJ guidance.
