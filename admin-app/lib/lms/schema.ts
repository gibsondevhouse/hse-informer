/**
 * Content schema for the HSE Informer learning player.
 * Plain serializable data so courses can be versioned, diffed, tested, and
 * passed from a server component to the client player unchanged.
 */
export type Illustration =
  | 'sandwich'
  | 'workstation'
  | 'handwash'
  | 'ingredients'
  | 'storage'
  | 'timer';

export type Option = { id: string; text: string; feedback?: string };

/** Authoring note shown only when the sandbox "component notes" toggle is on. */
type Annotated = { devNote?: string };

export type HeadingBlock = Annotated & {
  type: 'heading';
  text: string;
  level?: 2 | 3;
  kicker?: string;
};
export type ParagraphBlock = Annotated & {
  type: 'paragraph';
  text: string;
  variant?: 'lead' | 'body' | 'muted';
};
export type CalloutVariant =
  | 'info'
  | 'tip'
  | 'note'
  | 'warning'
  | 'danger'
  | 'success';
export type CalloutBlock = Annotated & {
  type: 'callout';
  variant: CalloutVariant;
  title?: string;
  text: string;
};
export type ObjectivesBlock = Annotated & {
  type: 'objectives';
  title?: string;
  items: string[];
};
export type ListBlock = Annotated & {
  type: 'list';
  style: 'bullet' | 'numbered' | 'check';
  title?: string;
  items: string[];
};
export type KeyTakeawaysBlock = Annotated & {
  type: 'keyTakeaways';
  title?: string;
  items: { title: string; text: string }[];
};
export type DefinitionBlock = Annotated & {
  type: 'definition';
  term: string;
  definition: string;
  example?: string;
};
export type GlossaryBlock = Annotated & {
  type: 'glossary';
  title?: string;
  terms: { term: string; definition: string }[];
};
export type FigureBlock = Annotated & {
  type: 'figure';
  art: Illustration;
  alt: string;
  caption?: string;
};
export type MediaBlock = Annotated & {
  type: 'media';
  kind: 'video' | 'audio';
  title: string;
  duration: string;
  transcript: string[];
  captions: boolean;
  note?: string;
};
export type StepsBlock = Annotated & {
  type: 'steps';
  title?: string;
  steps: { title: string; text: string; caution?: string }[];
};
export type TimelineBlock = Annotated & {
  type: 'timeline';
  title?: string;
  events: { label: string; title: string; text: string }[];
};
export type TableBlock = Annotated & {
  type: 'table';
  caption: string;
  columns: string[];
  rows: string[][];
};
export type ResourceBlock = Annotated & {
  type: 'resource';
  title: string;
  description: string;
  format: string;
  href?: string;
};
export type ReferencesBlock = Annotated & {
  type: 'references';
  title?: string;
  items: { label: string; href: string }[];
};
export type DividerBlock = Annotated & { type: 'divider' };

export type AccordionBlock = Annotated & {
  type: 'accordion';
  title?: string;
  items: { title: string; text: string }[];
};
export type TabsBlock = Annotated & {
  type: 'tabs';
  title?: string;
  tabs: { label: string; text: string; bullets?: string[] }[];
};
export type FlashcardsBlock = Annotated & {
  type: 'flashcards';
  title?: string;
  cards: { front: string; back: string }[];
};
export type Hotspot = {
  id: string;
  /** Percent of the illustration width, 0–100. */
  x: number;
  /** Percent of the illustration height, 0–100. */
  y: number;
  label: string;
  text: string;
};
export type HotspotsBlock = Annotated & {
  type: 'hotspots';
  id: string;
  title?: string;
  art: Illustration;
  alt: string;
  hotspots: Hotspot[];
};

export type ChecklistBlock = Annotated & {
  type: 'checklist';
  id: string;
  title: string;
  items: string[];
  required?: boolean;
};
export type ReflectionBlock = Annotated & {
  type: 'reflection';
  id: string;
  prompt: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
};
export type SurveyBlock = Annotated & {
  type: 'survey';
  id: string;
  prompt: string;
  scale: { id: string; label: string }[];
};
export type AttestationBlock = Annotated & {
  type: 'attestation';
  id: string;
  statement: string;
  requiresName: boolean;
  required?: boolean;
};

export type OptionSelectItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  content: string;
  bullets?: string[];
  caution?: string;
  tip?: string;
};

export type OptionSelectBlock = Annotated & {
  type: 'optionSelect';
  id: string;
  title?: string;
  instruction?: string;
  options: OptionSelectItem[];
  required?: boolean;
};

type Question = Annotated & {
  id: string;
  prompt: string;
  explanation?: string;
  required?: boolean;
};
export type MultipleChoiceBlock = Question & {
  type: 'multipleChoice';
  options: Option[];
  answer: string;
};
export type MultipleResponseBlock = Question & {
  type: 'multipleResponse';
  options: Option[];
  answers: string[];
};
export type TrueFalseBlock = Question & { type: 'trueFalse'; answer: boolean };
export type FillBlankBlock = Question & {
  type: 'fillBlank';
  /** Use ___ where the blank belongs. */
  text: string;
  accepted: string[];
  caseSensitive?: boolean;
};
export type NumericBlock = Question & {
  type: 'numeric';
  min: number;
  max: number;
  unit?: string;
};
export type MatchingBlock = Question & {
  type: 'matching';
  pairs: { id: string; left: string; right: string }[];
};
export type SequencingBlock = Question & {
  type: 'sequencing';
  /** Authored in the correct order; the player shuffles for display. */
  items: { id: string; text: string }[];
};
export type SortingBlock = Question & {
  type: 'sorting';
  categories: { id: string; label: string }[];
  items: { id: string; text: string; category: string }[];
};
export type ScenarioBlock = Question & {
  type: 'scenario';
  situation: string;
  options: { id: string; text: string; outcome: string; correct: boolean }[];
};

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | CalloutBlock
  | ObjectivesBlock
  | ListBlock
  | KeyTakeawaysBlock
  | DefinitionBlock
  | GlossaryBlock
  | FigureBlock
  | MediaBlock
  | StepsBlock
  | TimelineBlock
  | TableBlock
  | ResourceBlock
  | ReferencesBlock
  | DividerBlock;
export type DisclosureBlock =
  | AccordionBlock
  | TabsBlock
  | FlashcardsBlock
  | HotspotsBlock;
export type ActivityBlock =
  | ChecklistBlock
  | ReflectionBlock
  | SurveyBlock
  | AttestationBlock
  | OptionSelectBlock;
export type InteractionBlock =
  | MultipleChoiceBlock
  | MultipleResponseBlock
  | TrueFalseBlock
  | FillBlankBlock
  | NumericBlock
  | MatchingBlock
  | SequencingBlock
  | SortingBlock
  | ScenarioBlock;
export type Block =
  | ContentBlock
  | DisclosureBlock
  | ActivityBlock
  | InteractionBlock;
export type BlockType = Block['type'];
export type InteractionType = InteractionBlock['type'];

/** Learner input, shaped per interaction type; always JSON-serializable. */
export type LearnerResponse =
  | string
  | string[]
  | boolean
  | number
  | Record<string, string>;

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
};
export type Module = {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
};
export type Assessment = {
  id: string;
  title: string;
  intro: string;
  passingPercent: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  questions: InteractionBlock[];
};
export type Course = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  version: string;
  language: string;
  audience: string;
  purpose: string;
  objectives: string[];
  modules: Module[];
  assessment: Assessment;
  glossary: { term: string; definition: string }[];
  references: { label: string; href: string }[];
  completionStatement: string;
  boundary: string;
};
