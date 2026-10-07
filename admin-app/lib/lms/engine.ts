import type {
  ActivityBlock,
  Assessment,
  Block,
  BlockType,
  ContentBlock,
  Course,
  DisclosureBlock,
  InteractionBlock,
  InteractionType,
  LearnerResponse,
  Lesson,
} from './schema';

export const contentBlockTypes = [
  'heading',
  'paragraph',
  'callout',
  'objectives',
  'list',
  'keyTakeaways',
  'definition',
  'glossary',
  'figure',
  'media',
  'steps',
  'timeline',
  'table',
  'resource',
  'references',
  'divider',
] as const satisfies readonly ContentBlock['type'][];
export const disclosureBlockTypes = [
  'accordion',
  'tabs',
  'flashcards',
  'hotspots',
] as const satisfies readonly DisclosureBlock['type'][];
export const activityBlockTypes = [
  'checklist',
  'reflection',
  'survey',
  'attestation',
  'optionSelect',
] as const satisfies readonly ActivityBlock['type'][];
export const interactionBlockTypes = [
  'multipleChoice',
  'multipleResponse',
  'trueFalse',
  'fillBlank',
  'numeric',
  'matching',
  'sequencing',
  'sorting',
  'scenario',
] as const satisfies readonly InteractionType[];
export const blockTypes: readonly BlockType[] = [
  ...contentBlockTypes,
  ...disclosureBlockTypes,
  ...activityBlockTypes,
  ...interactionBlockTypes,
];

export function isInteractionBlock(block: Block): block is InteractionBlock {
  return (interactionBlockTypes as readonly string[]).includes(block.type);
}
export function isActivityBlock(block: Block): block is ActivityBlock {
  return (activityBlockTypes as readonly string[]).includes(block.type);
}

/** xAPI/SCORM `cmi.interaction` type that a future statement emitter would use. */
export const xapiInteractionType: Record<InteractionType, string> = {
  multipleChoice: 'choice',
  multipleResponse: 'choice',
  trueFalse: 'true-false',
  fillBlank: 'fill-in',
  numeric: 'numeric',
  matching: 'matching',
  sequencing: 'sequencing',
  sorting: 'matching',
  scenario: 'choice',
};

export type GradeResult = {
  correct: boolean;
  /** 0–1; partial credit for multi-item interactions. */
  score: number;
  feedback: string;
};

const isStringRecord = (value: unknown): value is Record<string, string> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === 'string');
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const normalize = (value: string, caseSensitive: boolean) => {
  const collapsed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? collapsed : collapsed.toLowerCase();
};
const ratio = (hits: number, total: number) =>
  total === 0 ? 0 : Math.round((hits / total) * 1000) / 1000;

export function isAnswered(
  block: InteractionBlock,
  response: LearnerResponse | undefined,
): boolean {
  switch (block.type) {
    case 'multipleChoice':
    case 'scenario':
      return typeof response === 'string' && response.length > 0;
    case 'multipleResponse':
      return isStringArray(response) && response.length > 0;
    case 'trueFalse':
      return typeof response === 'boolean';
    case 'fillBlank':
      return typeof response === 'string' && response.trim().length > 0;
    case 'numeric':
      return typeof response === 'number' && Number.isFinite(response);
    case 'matching':
      return (
        isStringRecord(response) &&
        block.pairs.every((pair) => Boolean(response[pair.id]))
      );
    case 'sequencing':
      return isStringArray(response) && response.length === block.items.length;
    case 'sorting':
      return (
        isStringRecord(response) &&
        block.items.every((item) => Boolean(response[item.id]))
      );
  }
}

export function gradeInteraction(
  block: InteractionBlock,
  response: LearnerResponse | undefined,
): GradeResult {
  const explain = (fallback: string) => block.explanation ?? fallback;
  if (!isAnswered(block, response))
    return { correct: false, score: 0, feedback: 'No response recorded.' };
  switch (block.type) {
    case 'multipleChoice': {
      const option = block.options.find((item) => item.id === response);
      const correct = response === block.answer;
      return {
        correct,
        score: correct ? 1 : 0,
        feedback:
          option?.feedback ??
          explain(correct ? 'Correct.' : 'That is not the best answer.'),
      };
    }
    case 'multipleResponse': {
      const selected = new Set(response as string[]);
      const expected = new Set(block.answers);
      let hits = 0;
      let misses = 0;
      selected.forEach((id) => (expected.has(id) ? hits++ : misses++));
      const correct = hits === expected.size && misses === 0;
      return {
        correct,
        score: Math.max(0, ratio(hits - misses, expected.size)),
        feedback: explain(
          correct
            ? 'All correct options selected.'
            : `${hits} of ${expected.size} correct options selected${misses ? `, with ${misses} incorrect selection${misses === 1 ? '' : 's'}` : ''}.`,
        ),
      };
    }
    case 'trueFalse': {
      const correct = response === block.answer;
      return {
        correct,
        score: correct ? 1 : 0,
        feedback: explain(
          correct
            ? 'Correct.'
            : `The statement is ${block.answer ? 'true' : 'false'}.`,
        ),
      };
    }
    case 'fillBlank': {
      const caseSensitive = block.caseSensitive ?? false;
      const given = normalize(response as string, caseSensitive);
      const correct = block.accepted.some(
        (item) => normalize(item, caseSensitive) === given,
      );
      return {
        correct,
        score: correct ? 1 : 0,
        feedback: explain(
          correct ? 'Correct.' : `Accepted answers: ${block.accepted.join(', ')}.`,
        ),
      };
    }
    case 'numeric': {
      const value = response as number;
      const correct = value >= block.min && value <= block.max;
      const range =
        block.min === block.max
          ? `${block.min}`
          : `between ${block.min} and ${block.max}`;
      return {
        correct,
        score: correct ? 1 : 0,
        feedback: explain(
          correct
            ? 'Within the accepted range.'
            : `The accepted answer is ${range}${block.unit ? ` ${block.unit}` : ''}.`,
        ),
      };
    }
    case 'matching': {
      const given = response as Record<string, string>;
      const hits = block.pairs.filter((pair) => given[pair.id] === pair.id)
        .length;
      const correct = hits === block.pairs.length;
      return {
        correct,
        score: ratio(hits, block.pairs.length),
        feedback: explain(
          correct
            ? 'Every pair is matched correctly.'
            : `${hits} of ${block.pairs.length} pairs matched correctly.`,
        ),
      };
    }
    case 'sequencing': {
      const given = response as string[];
      const hits = block.items.filter((item, index) => given[index] === item.id)
        .length;
      const correct = hits === block.items.length;
      return {
        correct,
        score: ratio(hits, block.items.length),
        feedback: explain(
          correct
            ? 'The order is correct.'
            : `${hits} of ${block.items.length} steps are in the correct position.`,
        ),
      };
    }
    case 'sorting': {
      const given = response as Record<string, string>;
      const hits = block.items.filter((item) => given[item.id] === item.category)
        .length;
      const correct = hits === block.items.length;
      return {
        correct,
        score: ratio(hits, block.items.length),
        feedback: explain(
          correct
            ? 'Every item is sorted correctly.'
            : `${hits} of ${block.items.length} items sorted correctly.`,
        ),
      };
    }
    case 'scenario': {
      const option = block.options.find((item) => item.id === response);
      const correct = option?.correct ?? false;
      return {
        correct,
        score: correct ? 1 : 0,
        feedback: option?.outcome ?? explain('Choose a response.'),
      };
    }
  }
}

export type AssessmentScore = {
  percent: number;
  passed: boolean;
  perQuestion: ({ id: string } & GradeResult)[];
};
export function scoreAssessment(
  assessment: Assessment,
  responses: Record<string, LearnerResponse>,
): AssessmentScore {
  const perQuestion = assessment.questions.map((question) => ({
    id: question.id,
    ...gradeInteraction(question, responses[question.id]),
  }));
  const total = perQuestion.reduce((sum, item) => sum + item.score, 0);
  const percent = assessment.questions.length
    ? Math.round((total / assessment.questions.length) * 100)
    : 0;
  return { percent, passed: percent >= assessment.passingPercent, perQuestion };
}

/** Deterministic Fisher–Yates with a mulberry32 generator so attempts can be replayed. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function questionOrder(
  assessment: Assessment,
  seed: number,
): InteractionBlock[] {
  return assessment.shuffleQuestions
    ? seededShuffle(assessment.questions, seed)
    : [...assessment.questions];
}

export function lessonOrder(course: Course): Lesson[] {
  return course.modules.flatMap((module) => module.lessons);
}
export function findLesson(course: Course, lessonId: string | null) {
  return lessonId
    ? (lessonOrder(course).find((lesson) => lesson.id === lessonId) ?? null)
    : null;
}
export function moduleOf(course: Course, lessonId: string) {
  return (
    course.modules.find((module) =>
      module.lessons.some((lesson) => lesson.id === lessonId),
    ) ?? null
  );
}
export function estimatedMinutes(course: Course) {
  return lessonOrder(course).reduce((sum, lesson) => sum + lesson.minutes, 0);
}
export function interactionsIn(lesson: Lesson): InteractionBlock[] {
  return lesson.blocks.filter(isInteractionBlock);
}

/** Visual weight of each presentational block; a slide holds up to `slideBudget`. */
const slideWeight: Record<
  ContentBlock['type'] | DisclosureBlock['type'],
  number
> = {
  heading: 0,
  divider: 0,
  paragraph: 1,
  callout: 1,
  definition: 1,
  resource: 1,
  references: 1,
  objectives: 2,
  list: 2,
  keyTakeaways: 2,
  glossary: 2,
  figure: 2,
  media: 2,
  steps: 2,
  accordion: 2,
  tabs: 2,
  flashcards: 2,
  table: 3,
  timeline: 3,
  hotspots: 3,
};
export const slideBudget = 3;

/**
 * Group a lesson's blocks into the slides the player presents one at a time.
 * A heading starts a new slide, a divider forces a break without rendering,
 * every knowledge check or activity stands on its own slide (keeping any
 * heading directly above it), and other content fills a slide up to the
 * visual budget. Block order is preserved.
 */
export function lessonSlides(lesson: Lesson): Block[][] {
  const slides: Block[][] = [];
  let current: Block[] = [];
  let weight = 0;
  const hasContent = () => current.some((block) => block.type !== 'heading');
  const flush = () => {
    if (current.length) slides.push(current);
    current = [];
    weight = 0;
  };
  for (const block of lesson.blocks) {
    if (block.type === 'divider') {
      flush();
    } else if (isInteractionBlock(block) || isActivityBlock(block)) {
      if (hasContent()) flush();
      slides.push([...current, block]);
      current = [];
      weight = 0;
    } else if (block.type === 'heading') {
      if (hasContent()) flush();
      current.push(block);
    } else {
      const cost = slideWeight[block.type];
      if (hasContent() && weight + cost > slideBudget) flush();
      current.push(block);
      weight += cost;
    }
  }
  flush();
  return slides.length ? slides : [[]];
}
/** Index of the slide that shows the block with `blockId`, or -1. */
export function slideIndexOf(lesson: Lesson, blockId: string) {
  return lessonSlides(lesson).findIndex((slide) =>
    slide.some((block) => 'id' in block && block.id === blockId),
  );
}
const lastSlideOf = (lesson: Lesson) => lessonSlides(lesson).length - 1;

export type Attestation = { name: string; at: string };
export type AssessmentAttempt = {
  at: string;
  percent: number;
  passed: boolean;
  responses: Record<string, LearnerResponse>;
};
export type PlayerView = 'overview' | 'lesson' | 'assessment' | 'summary';
export type PlayerState = {
  version: 1;
  courseId: string;
  view: PlayerView;
  lessonId: string | null;
  /** Slide within the current lesson; persisted so a learner resumes in place. */
  slide: number;
  responses: Record<string, LearnerResponse>;
  checked: string[];
  checklists: Record<string, number[]>;
  reflections: Record<string, string>;
  surveys: Record<string, string>;
  attestations: Record<string, Attestation>;
  optionSelects: Record<string, string[]>;
  completedLessons: string[];
  assessment: {
    attempts: AssessmentAttempt[];
    current: {
      seed: number;
      startedAt: string;
      responses: Record<string, LearnerResponse>;
    } | null;
    reviewing: boolean;
  };
  linear: boolean;
  showDevNotes: boolean;
};

export function storageKeyFor(course: Course) {
  return `hse-lms-preview-${course.id}-${course.version}-v2`;
}

export function initialState(course: Course): PlayerState {
  return {
    version: 1,
    courseId: course.id,
    view: 'overview',
    lessonId: null,
    slide: 0,
    responses: {},
    checked: [],
    checklists: {},
    reflections: {},
    surveys: {},
    attestations: {},
    optionSelects: {},
    completedLessons: [],
    assessment: { attempts: [], current: null, reviewing: false },
    linear: true,
    showDevNotes: false,
  };
}

export type Requirement = { blockId: string; label: string; met: boolean };

/** Formative checks must be checked, not answered correctly; activities follow their own flags. */
export function lessonRequirements(
  lesson: Lesson,
  state: PlayerState,
): Requirement[] {
  const requirements: Requirement[] = [];
  for (const block of lesson.blocks) {
    if (isInteractionBlock(block)) {
      if (block.required === false) continue;
      requirements.push({
        blockId: block.id,
        label: 'Check your answer to the knowledge check',
        met: state.checked.includes(block.id),
      });
    } else if (block.type === 'checklist' && block.required) {
      requirements.push({
        blockId: block.id,
        label: `Complete the checklist “${block.title}”`,
        met: (state.checklists[block.id] ?? []).length === block.items.length,
      });
    } else if (block.type === 'reflection' && block.required) {
      const minLength = block.minLength ?? 1;
      requirements.push({
        blockId: block.id,
        label: `Write a reflection of at least ${minLength} character${minLength === 1 ? '' : 's'}`,
        met: (state.reflections[block.id] ?? '').trim().length >= minLength,
      });
    } else if (block.type === 'attestation' && block.required !== false) {
      const signed = state.attestations[block.id];
      requirements.push({
        blockId: block.id,
        label: 'Confirm the acknowledgement',
        met: Boolean(
          signed && (!block.requiresName || signed.name.trim().length > 0),
        ),
      });
    } else if (block.type === 'optionSelect' && block.required !== false) {
      const visited = state.optionSelects?.[block.id] ?? [];
      requirements.push({
        blockId: block.id,
        label: `Explore every option in “${block.title ?? 'Option selection'}”`,
        met: block.options.every((opt) => visited.includes(opt.id)),
      });
    }
  }
  return requirements;
}
export function lessonRequirementsMet(lesson: Lesson, state: PlayerState) {
  return lessonRequirements(lesson, state).every((item) => item.met);
}

/** Whether all required blocks visible on the specified slide have been satisfied. */
export function slideRequirementsMet(
  blocks: Block[],
  state: PlayerState,
): boolean {
  for (const block of blocks) {
    if (isInteractionBlock(block) && block.required !== false) {
      if (!state.checked.includes(block.id)) return false;
    } else if (block.type === 'optionSelect' && block.required !== false) {
      const visited = state.optionSelects?.[block.id] ?? [];
      if (!block.options.every((opt) => visited.includes(opt.id))) return false;
    } else if (block.type === 'checklist' && block.required) {
      const checked = state.checklists[block.id] ?? [];
      if (checked.length !== block.items.length) return false;
    } else if (block.type === 'reflection' && block.required) {
      const minLength = block.minLength ?? 1;
      if ((state.reflections[block.id] ?? '').trim().length < minLength) return false;
    } else if (block.type === 'attestation' && block.required !== false) {
      const signed = state.attestations[block.id];
      if (!signed || (block.requiresName && !signed.name.trim())) return false;
    }
  }
  return true;
}

export function isLessonLocked(
  course: Course,
  state: PlayerState,
  lessonId: string,
) {
  if (!state.linear) return false;
  const order = lessonOrder(course);
  const index = order.findIndex((lesson) => lesson.id === lessonId);
  if (index <= 0) return index < 0;
  return order
    .slice(0, index)
    .some((lesson) => !state.completedLessons.includes(lesson.id));
}
export function allLessonsComplete(course: Course, state: PlayerState) {
  return lessonOrder(course).every((lesson) =>
    state.completedLessons.includes(lesson.id),
  );
}
export function isAssessmentLocked(course: Course, state: PlayerState) {
  return state.linear && !allLessonsComplete(course, state);
}
export function attemptsRemaining(course: Course, state: PlayerState) {
  return Math.max(
    0,
    course.assessment.maxAttempts - state.assessment.attempts.length,
  );
}
export function bestAttempt(state: PlayerState) {
  return state.assessment.attempts.reduce<AssessmentAttempt | null>(
    (best, attempt) =>
      !best || attempt.percent > best.percent ? attempt : best,
    null,
  );
}
export type CourseStatus = 'not-started' | 'in-progress' | 'knowledge-complete';
export function courseStatus(course: Course, state: PlayerState): CourseStatus {
  const passed = state.assessment.attempts.some((attempt) => attempt.passed);
  if (passed && allLessonsComplete(course, state)) return 'knowledge-complete';
  if (
    state.completedLessons.length ||
    state.assessment.attempts.length ||
    state.checked.length
  )
    return 'in-progress';
  return 'not-started';
}

/** Module the outline expands by default: the open lesson's, else the next unfinished lesson's. */
export function outlineModuleId(
  course: Course,
  state: PlayerState,
): string | null {
  const target =
    state.view === 'lesson' && state.lessonId
      ? state.lessonId
      : lessonOrder(course).find(
          (lesson) => !state.completedLessons.includes(lesson.id),
        )?.id;
  return target ? (moduleOf(course, target)?.id ?? null) : null;
}

export type ProgressSegment = 'done' | 'current' | 'todo';

/**
 * Segments for the thin bar above the content: slides inside a lesson,
 * answered questions during an attempt, and lessons everywhere else.
 */
export function progressSegments(
  course: Course,
  state: PlayerState,
): ProgressSegment[] {
  const lesson =
    state.view === 'lesson' ? findLesson(course, state.lessonId) : null;
  if (lesson) {
    const total = lessonSlides(lesson).length;
    const current = Math.min(state.slide, total - 1);
    return Array.from({ length: total }, (_, index) =>
      index < current ? 'done' : index === current ? 'current' : 'todo',
    );
  }
  const attempt = state.view === 'assessment' ? state.assessment.current : null;
  if (attempt)
    return questionOrder(course.assessment, attempt.seed).map((question) =>
      Object.hasOwn(attempt.responses, question.id) ? 'done' : 'todo',
    );
  const lessons = lessonOrder(course);
  const next = lessons.findIndex(
    (item) => !state.completedLessons.includes(item.id),
  );
  return lessons.map((item, index) =>
    state.completedLessons.includes(item.id)
      ? 'done'
      : index === next
        ? 'current'
        : 'todo',
  );
}

export type PlayerAction =
  | { type: 'open-overview' }
  | { type: 'open-lesson'; lessonId: string }
  | { type: 'go-slide'; index: number }
  | { type: 'back' }
  | { type: 'answer'; blockId: string; response: LearnerResponse }
  | { type: 'check'; blockId: string }
  | { type: 'retry'; blockId: string }
  | { type: 'toggle-checklist'; blockId: string; index: number }
  | { type: 'set-reflection'; blockId: string; text: string }
  | { type: 'set-survey'; blockId: string; value: string }
  | { type: 'attest'; blockId: string; name: string; at: string }
  | { type: 'select-option'; blockId: string; optionId: string }
  | { type: 'complete-lesson' }
  | { type: 'open-assessment' }
  | { type: 'start-assessment'; seed: number; at: string }
  | { type: 'answer-assessment'; questionId: string; response: LearnerResponse }
  | { type: 'submit-assessment'; at: string }
  | { type: 'open-summary' }
  | { type: 'set-linear'; value: boolean }
  | { type: 'toggle-dev-notes' }
  | { type: 'reset' };

/** Which way new content should slide in, so Back and jumps to earlier slides run in reverse. */
export function navigationDirection(
  course: Course,
  state: PlayerState,
  action: PlayerAction,
): 'forward' | 'back' {
  switch (action.type) {
    case 'back':
    case 'open-overview':
      return 'back';
    case 'go-slide':
      return action.index < state.slide ? 'back' : 'forward';
    case 'open-lesson': {
      const order = lessonOrder(course);
      const from =
        state.view === 'lesson'
          ? order.findIndex((lesson) => lesson.id === state.lessonId)
          : -1;
      const to = order.findIndex((lesson) => lesson.id === action.lessonId);
      return from >= 0 && to < from ? 'back' : 'forward';
    }
    default:
      return 'forward';
  }
}

export function reducePlayer(
  course: Course,
  state: PlayerState,
  action: PlayerAction,
): PlayerState {
  const order = lessonOrder(course);
  switch (action.type) {
    case 'open-overview':
      return { ...state, view: 'overview' };
    case 'open-lesson':
      if (!order.some((lesson) => lesson.id === action.lessonId)) return state;
      if (isLessonLocked(course, state, action.lessonId)) return state;
      return { ...state, view: 'lesson', lessonId: action.lessonId, slide: 0 };
    case 'go-slide': {
      const lesson = findLesson(course, state.lessonId);
      if (!lesson || state.view !== 'lesson') return state;
      const slide = Math.min(Math.max(0, action.index), lastSlideOf(lesson));
      return slide === state.slide ? state : { ...state, slide };
    }
    case 'back': {
      if (state.view === 'lesson' && state.lessonId) {
        if (state.slide > 0) return { ...state, slide: state.slide - 1 };
        const index = order.findIndex((lesson) => lesson.id === state.lessonId);
        return index > 0
          ? {
              ...state,
              lessonId: order[index - 1].id,
              slide: lastSlideOf(order[index - 1]),
            }
          : { ...state, view: 'overview' };
      }
      if (state.view === 'assessment' && !state.assessment.current) {
        const last = order.at(-1);
        return last
          ? {
              ...state,
              view: 'lesson',
              lessonId: last.id,
              slide: lastSlideOf(last),
            }
          : { ...state, view: 'overview' };
      }
      if (state.view === 'summary') return { ...state, view: 'assessment' };
      return state.view === 'overview' ? state : { ...state, view: 'overview' };
    }
    case 'answer':
      return {
        ...state,
        responses: { ...state.responses, [action.blockId]: action.response },
        checked: state.checked.filter((id) => id !== action.blockId),
      };
    case 'check': {
      const block = order
        .flatMap((lesson) => lesson.blocks)
        .find(
          (item): item is InteractionBlock =>
            isInteractionBlock(item) && item.id === action.blockId,
        );
      if (!block || !isAnswered(block, state.responses[action.blockId]))
        return state;
      return state.checked.includes(action.blockId)
        ? state
        : { ...state, checked: [...state.checked, action.blockId] };
    }
    case 'retry': {
      const responses = { ...state.responses };
      delete responses[action.blockId];
      return {
        ...state,
        responses,
        checked: state.checked.filter((id) => id !== action.blockId),
      };
    }
    case 'toggle-checklist': {
      const current = state.checklists[action.blockId] ?? [];
      const next = current.includes(action.index)
        ? current.filter((index) => index !== action.index)
        : [...current, action.index].sort((a, b) => a - b);
      return {
        ...state,
        checklists: { ...state.checklists, [action.blockId]: next },
      };
    }
    case 'set-reflection':
      return {
        ...state,
        reflections: { ...state.reflections, [action.blockId]: action.text },
      };
    case 'set-survey':
      return {
        ...state,
        surveys: { ...state.surveys, [action.blockId]: action.value },
      };
    case 'attest':
      return {
        ...state,
        attestations: {
          ...state.attestations,
          [action.blockId]: { name: action.name.trim(), at: action.at },
        },
      };
    case 'select-option': {
      const current = state.optionSelects?.[action.blockId] ?? [];
      if (current.includes(action.optionId)) return state;
      return {
        ...state,
        optionSelects: {
          ...state.optionSelects,
          [action.blockId]: [...current, action.optionId],
        },
      };
    }
    case 'complete-lesson': {
      const lesson = findLesson(course, state.lessonId);
      if (!lesson || state.view !== 'lesson') return state;
      if (!lessonRequirementsMet(lesson, state)) return state;
      const completedLessons = state.completedLessons.includes(lesson.id)
        ? state.completedLessons
        : [...state.completedLessons, lesson.id];
      const index = order.findIndex((item) => item.id === lesson.id);
      const next = order[index + 1];
      return next
        ? { ...state, completedLessons, lessonId: next.id, slide: 0 }
        : { ...state, completedLessons, view: 'assessment' };
    }
    case 'open-assessment':
      return isAssessmentLocked(course, state)
        ? state
        : { ...state, view: 'assessment' };
    case 'start-assessment':
      if (isAssessmentLocked(course, state)) return state;
      if (state.assessment.current || attemptsRemaining(course, state) === 0)
        return state;
      return {
        ...state,
        view: 'assessment',
        assessment: {
          ...state.assessment,
          reviewing: false,
          current: { seed: action.seed, startedAt: action.at, responses: {} },
        },
      };
    case 'answer-assessment': {
      const current = state.assessment.current;
      if (!current) return state;
      if (!course.assessment.questions.some((q) => q.id === action.questionId))
        return state;
      return {
        ...state,
        assessment: {
          ...state.assessment,
          current: {
            ...current,
            responses: {
              ...current.responses,
              [action.questionId]: action.response,
            },
          },
        },
      };
    }
    case 'submit-assessment': {
      const current = state.assessment.current;
      if (!current) return state;
      const score = scoreAssessment(course.assessment, current.responses);
      return {
        ...state,
        assessment: {
          attempts: [
            ...state.assessment.attempts,
            {
              at: action.at,
              percent: score.percent,
              passed: score.passed,
              responses: current.responses,
            },
          ],
          current: null,
          reviewing: true,
        },
      };
    }
    case 'open-summary':
      return { ...state, view: 'summary' };
    case 'set-linear':
      return { ...state, linear: action.value };
    case 'toggle-dev-notes':
      return { ...state, showDevNotes: !state.showDevNotes };
    case 'reset':
      return {
        ...initialState(course),
        linear: state.linear,
        showDevNotes: state.showDevNotes,
      };
  }
}

const views: readonly PlayerView[] = [
  'overview',
  'lesson',
  'assessment',
  'summary',
];
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isResponse = (value: unknown): value is LearnerResponse =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  isStringArray(value) ||
  isStringRecord(value);
const isResponseRecord = (value: unknown) =>
  isPlainObject(value) && Object.values(value).every(isResponse);

/** Accept only snapshots this course can replay; anything else falls back to a fresh state. */
export function isPlayerState(
  value: unknown,
  course: Course,
): value is PlayerState {
  if (!isPlainObject(value)) return false;
  const lessonIds = new Set(lessonOrder(course).map((lesson) => lesson.id));
  const state = value;
  const attempts = isPlainObject(state.assessment)
    ? state.assessment.attempts
    : null;
  const current = isPlainObject(state.assessment)
    ? state.assessment.current
    : undefined;
  return (
    state.version === 1 &&
    state.courseId === course.id &&
    typeof state.view === 'string' &&
    views.includes(state.view as PlayerView) &&
    (state.lessonId === null ||
      (typeof state.lessonId === 'string' && lessonIds.has(state.lessonId))) &&
    // Snapshots saved before slides existed carry no index; the player treats them as slide 0.
    (state.slide === undefined ||
      (Number.isInteger(state.slide) && (state.slide as number) >= 0)) &&
    isResponseRecord(state.responses) &&
    isStringArray(state.checked) &&
    isPlainObject(state.checklists) &&
    Object.values(state.checklists).every(
      (item) =>
        Array.isArray(item) &&
        item.every((index) => Number.isInteger(index) && index >= 0),
    ) &&
    isStringRecord(state.reflections) &&
    isStringRecord(state.surveys) &&
    isPlainObject(state.attestations) &&
    Object.values(state.attestations).every(
      (item) =>
        isPlainObject(item) &&
        typeof item.name === 'string' &&
        typeof item.at === 'string',
    ) &&
    (state.optionSelects === undefined ||
      (isPlainObject(state.optionSelects) &&
        Object.values(state.optionSelects).every(isStringArray))) &&
    isStringArray(state.completedLessons) &&
    state.completedLessons.every((id) => lessonIds.has(id)) &&
    Array.isArray(attempts) &&
    attempts.every(
      (attempt) =>
        isPlainObject(attempt) &&
        typeof attempt.at === 'string' &&
        typeof attempt.percent === 'number' &&
        typeof attempt.passed === 'boolean' &&
        isResponseRecord(attempt.responses),
    ) &&
    (current === null ||
      (isPlainObject(current) &&
        typeof current.seed === 'number' &&
        typeof current.startedAt === 'string' &&
        isResponseRecord(current.responses))) &&
    isPlainObject(state.assessment) &&
    typeof state.assessment.reviewing === 'boolean' &&
    typeof state.linear === 'boolean' &&
    typeof state.showDevNotes === 'boolean'
  );
}
