import type {
  CalloutVariant,
  DefinitionBlock,
  ReferencesBlock,
  ScenarioBlock,
  StepsBlock,
  SortingBlock,
  TableBlock,
} from './schema';

/** Serializable authoring data, independent of a course's artwork or scoring. */
export type PresentationReference = ReferencesBlock['items'][number];
export type PresentationTerm = Pick<
  DefinitionBlock,
  'term' | 'definition' | 'example'
>;
export type PresentationDetails = {
  explanation?: string[];
  terms?: PresentationTerm[];
  sources?: PresentationReference[];
};

export type PresentationSlideBase = {
  /** Stable within a course; used for navigation and temporary practice responses. */
  id: string;
  chapter: string;
  eyebrow: string;
  title: string;
  lead: string;
  takeaway?: string;
  caption: string;
  transcript: string[];
  details?: PresentationDetails;
};

/** Existing editorial layouts, rendered through a course-provided artwork adapter. */
export type LegacyPresentationSlide = PresentationSlideBase & {
  layout:
    | 'cover'
    | 'overview'
    | 'principles'
    | 'split'
    | 'steps'
    | 'comparison'
    | 'closing';
  art: string;
  points?: { title: string; body: string }[];
};

export type IntroductionContent = {
  purpose: string;
  audience: string;
  structure: string;
};
export type ObjectivesContent = {
  groups: { title: string; items: string[] }[];
};
export type RoadmapContent = {
  chapters: { title: string; description: string; targetSlideId: string }[];
};
export type DiagramContent = {
  /** Nodes form an ordered pathway. Each node connects to the following node. */
  nodes: { id: string; title: string; text: string }[];
  /** Complete text equivalent of the pathway, including the meaning of its arrows. */
  description: string;
  caption?: string;
};
export type TableContent = Pick<TableBlock, 'caption' | 'columns' | 'rows'> & {
  /** Short navigation labels; full cell content remains available in the panel. */
  rowLabels?: string[];
};
export type PresentationCallout = {
  variant: CalloutVariant;
  title?: string;
  text: string;
};
export type ProcedureContent = {
  steps: (StepsBlock['steps'][number] & { verification?: string })[];
  callout?: PresentationCallout;
};
/** Reuses scenario option data without the LMS grading/completion contract. */
export type PracticeContent = Pick<
  ScenarioBlock,
  'prompt' | 'situation' | 'options'
>;
export type SummaryContent = {
  standard: { title: string; text: string }[];
  takeaways: string[];
  references: PresentationReference[];
  jobAid?: PresentationReference;
};

/** An artwork key is resolved by the course adapter, never by the player. */
export type ActivityVisual = {
  art: string;
  description: string;
  aspectRatio?: number;
};
export type ActivityItem = {
  id: string;
  label: string;
  text: string;
  check?: string;
  /** Optional short step identifier, such as 04 or Pause. */
  marker?: string;
  visual?: ActivityVisual;
};
export type VisualExplorationContent = {
  activityId: string;
  visual: ActivityVisual;
  targets: (ActivityItem & { x: number; y: number })[];
};
export type ComparisonActivityContent = {
  activityId: string;
  items: ActivityItem[];
  decision?: PracticeContent;
};
export type GuidedDecisionContent = {
  activityId: string;
  visual: ActivityVisual;
} & (
  | { decision: PracticeContent; stages?: never }
  | { stages: ActivityItem[]; decision?: never }
);
export type ClassificationContent = {
  activityId: string;
  categories: SortingBlock['categories'];
  items: (ActivityItem &
    Pick<SortingBlock['items'][number], 'category'> & {
      explanation: string;
    })[];
};
export type ProcedureSequenceContent = {
  activityId: string;
  startNumber?: number;
  steps: ActivityItem[];
};
/** All interaction memory is ephemeral; there are no scores or completion flags. */
export type ActivityResponse = {
  activeId?: string;
  viewed?: string[];
  decision?: { selected?: string; submitted?: string };
  classification?: { assignments: Record<string, string>; submitted: boolean };
  evidencePane?: 'visual' | 'text' | 'decision';
  comparisonView?: 'before' | 'after' | 'explanation';
  branch?: {
    attempt?: number;
    nodeId: string;
    responses: Record<string, { selected?: string; submitted?: string }>;
    path: { nodeId: string; optionId: string }[];
  };
};
export type InteractiveSlide = PresentationSlideBase & {
  layout: 'template';
} & (
    | { template: 'visual-exploration'; content: VisualExplorationContent }
    | { template: 'comparison-activity'; content: ComparisonActivityContent }
    | { template: 'guided-decision'; content: GuidedDecisionContent }
    | { template: 'classification'; content: ClassificationContent }
    | { template: 'procedure-sequence'; content: ProcedureSequenceContent }
  );

export type OverviewSlide = PresentationSlideBase & {
  layout: 'template';
} & (
    | { template: 'introduction'; content: IntroductionContent }
    | { template: 'objectives'; content: ObjectivesContent }
    | { template: 'roadmap'; content: RoadmapContent }
    | { template: 'diagram'; content: DiagramContent }
    | { template: 'table'; content: TableContent }
    | { template: 'procedure'; content: ProcedureContent }
    | { template: 'practice'; content: PracticeContent }
    | { template: 'summary'; content: SummaryContent }
  );

/** Text-led instruction: essential copy is always first; supporting copy is optional. */
export type TextSection = {
  id: string;
  title: string;
  text: string;
  marker?: string;
  more?: { title: string; text: string }[];
};
export type TextSlide = PresentationSlideBase & {
  layout: 'template';
  template:
    | 'text-brief'
    | 'text-ledger'
    | 'text-focus'
    | 'text-sequence'
    | 'text-contrast';
  content: { sections: TextSection[] };
};
export function isTextSlide(slide: TemplateSlide): slide is TextSlide {
  return slide.template.startsWith('text-');
}
/** Evidence-first activities; answer feedback is revealed only after submission. */
export type InspectionContent = {
  activityId: string;
  visual: ActivityVisual;
  annotations: {
    id: string;
    label: string;
    text: string;
    x: number;
    y: number;
  }[];
  decision: PracticeContent;
};
export type BeforeAfterContent = {
  activityId: string;
  pairs: {
    id: string;
    label: string;
    before: ActivityVisual;
    after: ActivityVisual;
    explanation: string;
    check: string;
  }[];
};
export type BranchNode =
  | {
      id: string;
      kind: 'decision';
      title: string;
      situation: string;
      prompt: string;
      options: (PracticeContent['options'][number] & { nextNodeId: string })[];
    }
  | { id: string; kind: 'outcome'; title: string; text: string };
export type BranchingCaseContent = {
  activityId: string;
  startNodeId: string;
  nodes: BranchNode[];
};
export type EvidenceSlide = PresentationSlideBase & { layout: 'template' } & (
    | { template: 'inspection'; content: InspectionContent }
    | { template: 'before-after'; content: BeforeAfterContent }
    | { template: 'branching-case'; content: BranchingCaseContent }
  );
export function isEvidenceSlide(slide: TemplateSlide): slide is EvidenceSlide {
  return ['inspection', 'before-after', 'branching-case'].includes(
    slide.template,
  );
}
export type TemplateSlide =
  | OverviewSlide
  | InteractiveSlide
  | TextSlide
  | EvidenceSlide;
export type PresentationSlide = LegacyPresentationSlide | TemplateSlide;

export function isInteractiveSlide(
  slide: TemplateSlide,
): slide is InteractiveSlide {
  return 'activityId' in slide.content && !isEvidenceSlide(slide);
}

export type PresentationCourse = {
  id: string;
  code: string;
  title: string;
  sidebarTitle: string;
  tagline: string;
  brand: PresentationReference;
  returnLink: PresentationReference;
  statusLabel: string;
  jobAid?: PresentationReference;
  slides: PresentationSlide[];
};
