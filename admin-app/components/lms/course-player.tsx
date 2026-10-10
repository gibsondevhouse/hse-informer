'use client';

import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock,
  Eye,
  ExternalLink,
  GraduationCap,
  Lock,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  allLessonsComplete,
  attemptsRemaining,
  bestAttempt,
  courseStatus,
  estimatedMinutes,
  findLesson,
  gradeInteraction,
  initialState,
  isAssessmentLocked,
  isInteractionBlock,
  isLessonLocked,
  isPlayerState,
  lessonOrder,
  lessonRequirements,
  lessonSlides,
  moduleOf,
  navigationDirection,
  outlineModuleId,
  progressSegments,
  questionOrder,
  reducePlayer,
  slideIndexOf,
  slideRequirementsMet,
  storageKeyFor,
  type PlayerAction,
  type PlayerState,
  type ProgressSegment,
} from '@/lib/lms/engine';
import type { AttestationBlock, Course, InteractionBlock, Lesson, OptionSelectBlock } from '@/lib/lms/schema';
import { BlockRenderer } from './block-renderer';
import type { BlockEnv } from './env';
import { Interaction } from './interaction-blocks';
import { Illustration } from './illustrations';
import './styles/index.css';

type Direction = 'forward' | 'back';
type UiAction = PlayerAction | { type: 'hydrate'; state: PlayerState };
type Dispatch = (action: PlayerAction) => void;

export function CoursePlayer({
  course,
  homeHref = '/',
  homeLabel = 'Return to admin',
  authorMode = false,
  recorded,
}: {
  course: Course;
  homeHref?: string;
  homeLabel?: string;
  authorMode?: boolean;
  recorded?: {
    assignmentId: string;
    state: PlayerState;
    revision: number;
    practice: boolean;
  };
}) {
  const [state, rawDispatch] = useReducer(
    (current: PlayerState, action: UiAction) =>
      action.type === 'hydrate'
        ? action.state
        : reducePlayer(course, current, action),
    recorded?.state ?? course,
    () => recorded?.state ?? initialState(course),
  );
  const pendingActions = useRef<PlayerAction[]>([]);
  const sending = useRef(false);
  const revision = useRef(recorded?.revision ?? 0);
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const blocked = useRef(false);
  async function sendRecordedActions() {
    if (!recorded || sending.current || blocked.current) return;
    sending.current = true;
    setSaving(true);
    try {
      let latest: PlayerState | null = null;
      while (pendingActions.current.length) {
        const action = pendingActions.current[0];
        const response = await fetch(
          `/api/learner/assignments/${encodeURIComponent(recorded.assignmentId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, expectedRevision: revision.current }),
          },
        );
        if (!response.ok) throw new Error('Progress could not be saved.');
        const payload: { state: PlayerState; revision: number } = await response.json();
        revision.current = payload.revision;
        latest = payload.state;
        pendingActions.current.shift();
      }
      if (latest) rawDispatch({ type: 'hydrate', state: latest });
      setSaveMessage('');
    } catch {
      blocked.current = true;
      pendingActions.current = [];
      setSaveMessage('Progress could not be saved. Reload this assignment before continuing.');
      try {
        const response = await fetch(
          `/api/learner/assignments/${encodeURIComponent(recorded.assignmentId)}`,
          { cache: 'no-store' },
        );
        if (response.ok) {
          const payload: { state: PlayerState; revision: number } = await response.json();
          revision.current = payload.revision;
          rawDispatch({ type: 'hydrate', state: payload.state });
        }
      } catch {
        /* Keep the explicit reload notice when the network is unavailable. */
      }
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }
  const dispatch: Dispatch = (action) => {
    if (recorded && blocked.current) return;
    rawDispatch(action);
    if (recorded) {
      pendingActions.current.push(action);
      void sendRecordedActions();
    }
  };
  const [hydrated, setHydrated] = useState(false);
  const [direction, setDirection] = useState<Direction>('forward');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [resetArmed, setResetArmed] = useState(false);
  const main = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const slide = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const controlId = useId();
  const storageKey = storageKeyFor(course);

  useEffect(() => {
    if (recorded) {
      const timer = window.setTimeout(() => setHydrated(true), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isPlayerState(parsed, course))
            rawDispatch({
              type: 'hydrate',
              state: {
                ...parsed,
                optionSelects: parsed.optionSelects ?? {},
                slide: parsed.slide ?? 0,
                // Only the author lab can turn linear navigation off.
                linear: authorMode ? parsed.linear : true,
              },
            });
        }
      } catch {
        /* Storage is optional. */
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [course, storageKey, authorMode, recorded]);

  useEffect(() => {
    if (!hydrated || recorded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* Storage is optional. */
    }
  }, [state, hydrated, storageKey, recorded]);

  useEffect(() => {
    if (!recorded) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!sending.current && pendingActions.current.length === 0) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [recorded]);

  const focusKey = `${state.view}:${state.lessonId}:${
    state.assessment.current ? 'exam' : state.assessment.reviewing ? 'review' : 'intro'
  }`;
  const previousFocusKey = useRef(focusKey);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    main.current?.scrollTo({ top: 0 });
    // Within a lesson, slide changes focus the slide; everything else focuses the heading.
    const sameView = previousFocusKey.current === focusKey;
    previousFocusKey.current = focusKey;
    ((sameView && slide.current) || heading.current)?.focus({
      preventScroll: true,
    });
  }, [focusKey, state.slide]);

  useEffect(() => {
    if (!resetArmed) return;
    const timer = window.setTimeout(() => setResetArmed(false), 5000);
    return () => window.clearTimeout(timer);
  }, [resetArmed]);

  function go(action: PlayerAction) {
    setDirection(navigationDirection(course, state, action));
    dispatch(action);
    setOutlineOpen(false);
  }

  const env: BlockEnv = {
    mode: 'lesson',
    showDevNotes: authorMode && state.showDevNotes,
    responses: state.responses,
    checked: state.checked,
    checklists: state.checklists,
    reflections: state.reflections,
    surveys: state.surveys,
    attestations: state.attestations,
    optionSelects: state.optionSelects || {},
    onAnswer: (blockId, response) => dispatch({ type: 'answer', blockId, response }),
    onCheck: (blockId) => dispatch({ type: 'check', blockId }),
    onRetry: (blockId) => dispatch({ type: 'retry', blockId }),
    onToggleChecklist: (blockId, index) =>
      dispatch({ type: 'toggle-checklist', blockId, index }),
    onSetReflection: (blockId, text) =>
      dispatch({ type: 'set-reflection', blockId, text }),
    onSetSurvey: (blockId, value) => dispatch({ type: 'set-survey', blockId, value }),
    onAttest: (blockId, name) =>
      dispatch({ type: 'attest', blockId, name, at: new Date().toISOString() }),
    onSelectOption: (blockId, optionId) =>
      dispatch({ type: 'select-option', blockId, optionId }),
  };
  const lessons = lessonOrder(course);
  const outline = (
    <Outline course={course} state={state} go={go} />
  );
  const positionLabel =
    state.view === 'overview'
      ? 'Course overview'
      : state.view === 'lesson'
        ? `${moduleOf(course, state.lessonId ?? '')?.title ?? 'Lesson'} · Lesson ${lessons.findIndex((lesson) => lesson.id === state.lessonId) + 1} of ${lessons.length}`
        : state.view === 'assessment'
          ? course.assessment.title
          : 'Summary';

  return (
    <div className="lms-player" data-author-mode={authorMode}>
      <a className="skip-link" href="#lms-content">
        Skip to course content
      </a>
      <header className="lms-header">
        <a href={homeHref} className="lms-brand" aria-label="HSE Informer home">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>HSE Informer</span>
        </a>
        <span className="lms-breadcrumb">
          Training <ChevronRight size={14} aria-hidden="true" /> {course.code}
        </span>
        <div className="lms-header-actions">
          {!authorMode && (
            <span className="lms-practice">
              <span className="lms-practice-detail">
                {recorded
                  ? saving
                    ? 'Saving progress…'
                    : recorded.practice
                      ? 'Practice assignment · No safety qualification'
                      : 'Progress saved to your assignment record'
                  : 'Progress saves on this device · No training record is created'}
              </span>
              <span className="lms-practice-pill">
                <Eye size={13} aria-hidden="true" />
                {recorded && !recorded.practice ? 'Assigned training' : 'Practice course'}
              </span>
            </span>
          )}
          <a
            href={homeHref}
            className={buttonVariants({ variant: 'ghost' })}
            data-slot="button"
            data-variant="ghost"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{homeLabel}</span>
          </a>
        </div>
      </header>
      {authorMode ? <div className="lms-sandbox-bar">
        <span>
          <Eye size={14} aria-hidden="true" />
          <strong>Development sandbox</strong>
          <span className="lms-sandbox-meta">
            {course.code} · v{course.version} · progress stays in this browser
          </span>
        </span>
        <div className="lms-sandbox-controls">
          <span className="lms-switch">
            <Switch
              id={`${controlId}-notes`}
              aria-labelledby={`${controlId}-notes-label`}
              size="sm"
              checked={state.showDevNotes}
              onCheckedChange={() => dispatch({ type: 'toggle-dev-notes' })}
            />
            <label id={`${controlId}-notes-label`} htmlFor={`${controlId}-notes`}>
              Component notes
            </label>
          </span>
          <span className="lms-switch">
            <Switch
              id={`${controlId}-linear`}
              aria-labelledby={`${controlId}-linear-label`}
              size="sm"
              checked={state.linear}
              onCheckedChange={(value) => dispatch({ type: 'set-linear', value })}
            />
            <label id={`${controlId}-linear-label`} htmlFor={`${controlId}-linear`}>
              Linear navigation
            </label>
          </span>
          <Button
            variant={resetArmed ? 'destructive' : 'ghost'}
            size="sm"
            onClick={() => {
              if (resetArmed) {
                go({ type: 'reset' });
                setResetArmed(false);
                setAnnouncement('Progress reset.');
              } else setResetArmed(true);
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {resetArmed ? 'Confirm reset' : 'Reset progress'}
          </Button>
        </div>
      </div> : null}
      <div className="lms-layout">
        <aside className="lms-outline" aria-label="Course outline">
          {outline}
        </aside>
        <div className="lms-stage">
        <SegmentedProgress segments={progressSegments(course, state)} />
          <div className="lms-toolbar">
            <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
              <SheetTrigger
                className="lms-outline-trigger"
                render={<Button variant="outline" size="sm" />}
              >
                <BookOpen size={16} aria-hidden="true" />
                Outline
              </SheetTrigger>
              <SheetContent side="left" className="lms-overlay lms-outline-sheet">
                <SheetTitle className="sr-only">Course outline</SheetTitle>
                <div className="lms-outline lms-outline-in-sheet">{outline}</div>
              </SheetContent>
            </Sheet>
            <span className="lms-position">{positionLabel}</span>
            <div className="lms-toolbar-actions">
              <Dialog>
                <DialogTrigger render={<Button variant="ghost" size="sm" />}>
                  <BookMarked size={15} aria-hidden="true" />
                  <span className="lms-toolbar-label">Glossary</span>
                </DialogTrigger>
                <DialogContent className="lms-overlay lms-dialog">
                  <DialogTitle>Glossary</DialogTitle>
                  <DialogDescription>
                    Terms used across {course.title}.
                  </DialogDescription>
                  <dl className="lms-dialog-glossary">
                    {course.glossary.map((item) => (
                      <div key={item.term}>
                        <dt>{item.term}</dt>
                        <dd>{item.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger render={<Button variant="ghost" size="sm" />}>
                  <ExternalLink size={15} aria-hidden="true" />
                  <span className="lms-toolbar-label">References</span>
                </DialogTrigger>
                <DialogContent className="lms-overlay lms-dialog">
                  <DialogTitle>References</DialogTitle>
                  <DialogDescription>
                    {authorMode ? 'Sources behind the content and component library.' : 'Sources used to prepare this practice course.'}
                  </DialogDescription>
                  <ul className="lms-dialog-links">
                    {course.references.map((item) => (
                      <li key={item.href}>
                        <a href={item.href} target="_blank" rel="noopener noreferrer">
                          {item.label}
                          <ExternalLink size={14} aria-hidden="true" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </DialogContent>
              </Dialog>
              {!authorMode && !recorded && <Dialog>
                <DialogTrigger render={<Button variant="ghost" size="sm" />}>
                  <RotateCcw size={15} aria-hidden="true" />
                  <span className="lms-toolbar-label">Reset</span>
                </DialogTrigger>
                <DialogContent className="lms-overlay lms-dialog">
                  <DialogTitle>Reset practice progress?</DialogTitle>
                  <DialogDescription>This clears your lesson responses and assessment attempts for this course on this device.</DialogDescription>
                  <DialogClose render={<Button variant="destructive" onClick={() => { go({ type: 'reset' }); setAnnouncement('Practice progress reset.'); }} />}>
                    Reset practice progress
                  </DialogClose>
                </DialogContent>
              </Dialog>}
            </div>
          </div>
          <output className="sr-only lms-announcer">{announcement}</output>
          {saveMessage && (
            <div role="alert" className="lms-save-error">
              {saveMessage} <button type="button" onClick={() => window.location.reload()}>Reload assignment</button>
            </div>
          )}
        <main id="lms-content" className="lms-main" ref={main}>
          {state.view === 'overview' && (
            <OverviewView course={course} state={state} go={go} heading={heading} authorMode={authorMode} />
          )}
          {state.view === 'lesson' && (
            <LessonView
              course={course}
              state={state}
              env={env}
              go={go}
              heading={heading}
              slideRef={slide}
              direction={direction}
              announce={setAnnouncement}
            />
          )}
          {state.view === 'assessment' && (
            <AssessmentView
              course={course}
              state={state}
              env={env}
              go={go}
              heading={heading}
              announce={setAnnouncement}
              authorMode={authorMode}
            />
          )}
          {state.view === 'summary' && (
            <SummaryView course={course} state={state} go={go} heading={heading} />
          )}
        </main>
        </div>
      </div>
    </div>
  );
}

type ViewProps = {
  course: Course;
  state: PlayerState;
  go: Dispatch;
  heading: RefObject<HTMLHeadingElement | null>;
};

function SegmentedProgress({ segments }: { segments: ProgressSegment[] }) {
  return (
    <div className="lms-segments" aria-hidden="true">
      {segments.map((segment, index) => (
        <span key={index} className={`is-${segment}`} />
      ))}
    </div>
  );
}

type GlyphStatus = 'done' | 'current' | 'todo' | 'locked';

/** Linear-style status circle: empty, half-filled when current, filled with a check when done. */
function LessonGlyph({ status }: { status: GlyphStatus }) {
  return (
    <svg className={`lms-glyph is-${status}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle className="lms-glyph-ring" cx="8" cy="8" r="6.25" />
      {status === 'current' && <path className="lms-glyph-half" d="M8 4.5a3.5 3.5 0 0 1 0 7z" />}
      {status === 'done' && <path className="lms-glyph-check" d="M5.3 8.2l1.9 1.9 3.5-4" />}
    </svg>
  );
}

function Outline({ course, state, go }: Omit<ViewProps, 'heading'>) {
  const lessons = lessonOrder(course);
  const completed = state.completedLessons.length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const assessmentLocked = isAssessmentLocked(course, state);
  const best = bestAttempt(state);
  const attemptsLeft = attemptsRemaining(course, state);
  const status = courseStatus(course, state);
  const focusModule = outlineModuleId(course, state);
  const [followed, setFollowed] = useState(focusModule);
  const [open, setOpen] = useState<string[]>(focusModule ? [focusModule] : []);
  // Follow the learner: when the current module changes, expand it and fold the rest.
  if (followed !== focusModule) {
    setFollowed(focusModule);
    setOpen(focusModule ? [focusModule] : []);
  }
  return (
    <>
      <div className="lms-outline-heading">
        <button
          type="button"
          className={`lms-outline-course ${state.view === 'overview' ? 'is-current' : ''}`}
          aria-current={state.view === 'overview' ? 'page' : undefined}
          onClick={() => go({ type: 'open-overview' })}
        >
          <span className="lms-outline-course-code">{course.code} · Overview</span>
          <span className="lms-outline-course-title">
            {course.id === 'pbj-101' ? 'PB&J Sandwich Preparation' : course.title}
          </span>
        </button>
        <Progress value={percent} aria-label="Lessons completed">
          <span className="lms-progress-label">
            <span>
              {completed} of {lessons.length} lessons
            </span>
            <span>{percent}%</span>
          </span>
        </Progress>
      </div>
      <Accordion
        className="lms-outline-modules"
        value={open}
        onValueChange={(next) => setOpen(next.map(String))}
      >
        {course.modules.map((lessonModule) => {
          const done = lessonModule.lessons.filter((lesson) =>
            state.completedLessons.includes(lesson.id),
          ).length;
          return (
            <AccordionItem
              key={lessonModule.id}
              value={lessonModule.id}
              className="lms-outline-module"
            >
              <AccordionTrigger
                className={`lms-outline-module-trigger ${lessonModule.id === focusModule ? 'is-current' : ''}`}
              >
                <span className="lms-outline-module-title">
                  {course.id === 'pbj-101' && lessonModule.id === 'm4'
                    ? 'Workspace & tools'
                    : course.id === 'pbj-101' && lessonModule.id === 'm6'
                      ? 'Quality & cleanup'
                      : lessonModule.title}
                </span>
                <span className="lms-outline-module-count">
                  <span aria-hidden="true">
                    {done}/{lessonModule.lessons.length}
                  </span>
                  <span className="sr-only">
                    {done} of {lessonModule.lessons.length} lessons complete
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="lms-outline-panel">
                <ol className="lms-outline-lessons">
                  {lessonModule.lessons.map((lesson) => {
                    const isDone = state.completedLessons.includes(lesson.id);
                    const locked = isLessonLocked(course, state, lesson.id);
                    const current = state.view === 'lesson' && state.lessonId === lesson.id;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          className={`lms-outline-lesson ${current ? 'is-current' : ''} ${isDone ? 'is-done' : ''} ${locked ? 'is-locked' : ''}`}
                          aria-current={current ? 'page' : undefined}
                          aria-disabled={locked || undefined}
                          title={locked ? 'Complete the earlier lessons to unlock' : undefined}
                          onClick={() => {
                            if (!locked) go({ type: 'open-lesson', lessonId: lesson.id });
                          }}
                        >
                          <LessonGlyph
                            status={isDone ? 'done' : locked ? 'locked' : current ? 'current' : 'todo'}
                          />
                          <span className="lms-outline-title">
                            {lesson.title}
                            {isDone && <span className="sr-only"> (completed)</span>}
                            {locked && (
                              <span className="sr-only"> (locked until earlier lessons are complete)</span>
                            )}
                          </span>
                          {locked ? (
                            <Lock className="lms-outline-lock" size={12} aria-hidden="true" />
                          ) : (
                            <span className="lms-outline-meta">{lesson.minutes} min</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <div className="lms-outline-end">
        <button
          type="button"
          className={`lms-outline-lesson ${state.view === 'assessment' ? 'is-current' : ''} ${assessmentLocked ? 'is-locked' : ''}`}
          aria-current={state.view === 'assessment' ? 'page' : undefined}
          aria-disabled={assessmentLocked || undefined}
          title={assessmentLocked ? 'Complete every lesson to unlock' : undefined}
          onClick={() => {
            if (!assessmentLocked) go({ type: 'open-assessment' });
          }}
        >
          <GraduationCap className="lms-outline-icon" size={16} aria-hidden="true" />
          <span className="lms-outline-title">
            {course.assessment.title}
            {assessmentLocked && (
              <span className="sr-only"> (locked until every lesson is complete)</span>
            )}
            {best && (
              <span className="sr-only">
                {' '}
                Best score {best.percent}%, {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left
              </span>
            )}
          </span>
          {assessmentLocked ? (
            <Lock className="lms-outline-lock" size={12} aria-hidden="true" />
          ) : (
            <span className="lms-outline-meta">
              {best ? `Best ${best.percent}%` : `${course.assessment.questions.length} questions`}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`lms-outline-lesson ${state.view === 'summary' ? 'is-current' : ''}`}
          aria-current={state.view === 'summary' ? 'page' : undefined}
          onClick={() => go({ type: 'open-summary' })}
        >
          <Award className="lms-outline-icon" size={16} aria-hidden="true" />
          <span className="lms-outline-title">Summary</span>
          <span className="lms-outline-meta">{statusLabel(status)}</span>
        </button>
      </div>
      <p className="lms-outline-boundary">
        {course.id === 'pbj-101'
          ? 'Practice only. Saved on this device; no training record or workplace authorization.'
          : course.boundary}
      </p>
    </>
  );
}

function statusLabel(status: ReturnType<typeof courseStatus>) {
  return status === 'knowledge-complete'
    ? 'Knowledge complete'
    : status === 'in-progress'
      ? 'In progress'
      : 'Not started';
}

function OverviewView({ course, state, go, heading, authorMode }: ViewProps & { authorMode: boolean }) {
  const lessons = lessonOrder(course);
  const nextLesson = lessons.find((lesson) => !state.completedLessons.includes(lesson.id));
  const resumeId = nextLesson?.id;
  const started = courseStatus(course, state) !== 'not-started';
  const percent = Math.round((state.completedLessons.length / lessons.length) * 100);
  return (
    <article className="lms-view lms-overview">
      <header className="lms-view-header lms-course-hero">
        <div className="lms-course-hero-copy">
          <span className="lms-hero-eyebrow">{course.code} · {authorMode ? 'Component lab' : 'Guided practice'}</span>
          <h1 ref={heading} tabIndex={-1}>{course.title}</h1>
          <p className="lms-paragraph-lead">{course.subtitle}</p>
          <div className="lms-hero-facts"><span><Clock size={16} aria-hidden="true" /> {estimatedMinutes(course)} min</span><span><BookOpen size={16} aria-hidden="true" /> {course.modules.length} modules</span><span><GraduationCap size={16} aria-hidden="true" /> {lessons.length} lessons</span></div>
          <div className="lms-hero-actions">
            {resumeId ? <Button onClick={() => go({ type: 'open-lesson', lessonId: resumeId })}>{started ? 'Continue learning' : 'Start learning'} <ArrowRight size={16} aria-hidden="true" /></Button> : <Button onClick={() => go({ type: 'open-assessment' })}>Open assessment <ArrowRight size={16} aria-hidden="true" /></Button>}
            <span>{state.completedLessons.length} of {lessons.length} lessons complete</span>
          </div>
          <Progress value={percent} aria-label={`${percent}% of lessons complete`} />
        </div>
        <Illustration art="sandwich" alt="Illustration of a peanut butter and jelly sandwich on a plate" className="lms-hero-art" />
      </header>
      {authorMode && <dl className="lms-meta">
        <div>
          <dt>Audience</dt>
          <dd>{course.audience}</dd>
        </div>
        <div>
          <dt>Estimated time</dt>
          <dd>{estimatedMinutes(course)} minutes</dd>
        </div>
        <div>
          <dt>Structure</dt>
          <dd>
            {course.modules.length} modules · {lessons.length} lessons ·{' '}
            {course.assessment.questions.length}-question assessment
          </dd>
        </div>
        <div>
          <dt>Passing score</dt>
          <dd>
            {course.assessment.passingPercent}% · {course.assessment.maxAttempts} attempts
          </dd>
        </div>
      </dl>}
      <section className="lms-overview-section lms-overview-brief" aria-labelledby="lms-purpose">
        <div>
          <span className="lms-section-kicker">The brief</span>
          <h2 id="lms-purpose">{authorMode ? 'Purpose' : 'One task. A reliable method.'}</h2>
          <p>{course.purpose}</p>
        </div>
        <div>
          <span className="lms-section-kicker">The outcome</span>
          <h2 id="lms-objectives">{authorMode ? 'Objectives' : 'What you will practice'}</h2>
          <ul className="lms-objective-list">
            {course.objectives.map((item) => (
              <li key={item}>
                <Check size={16} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="lms-overview-section" aria-labelledby="lms-modules">
        <div className="lms-section-heading">
          <div>
            <span className="lms-section-kicker">The learning path</span>
            <h2 id="lms-modules">{authorMode ? 'Modules' : 'Six stages, from first check to final cleanup'}</h2>
          </div>
          <span>{course.assessment.questions.length} questions · {course.assessment.passingPercent}% to pass · {course.assessment.maxAttempts} attempts</span>
        </div>
        <ol className="lms-module-list">
          {course.modules.map((module, index) => (
            <li key={module.id}>
              <span className="lms-module-number">{String(index + 1).padStart(2, '0')}</span>
              <strong>{module.title}</strong>
              <p>{module.description}</p>
              <span className="lms-muted">
                {module.lessons.length} lesson{module.lessons.length === 1 ? '' : 's'} ·{' '}
                {module.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)} min
              </span>
            </li>
          ))}
        </ol>
      </section>
      <aside className="lms-callout lms-callout-note" aria-label="Practice course boundary">
        <TriangleAlert size={20} aria-hidden="true" />
        <div>
          <strong>About this practice course</strong>
          <p>{course.boundary}</p>
        </div>
      </aside>
    </article>
  );
}

function LessonView({
  course,
  state,
  env,
  go,
  heading,
  slideRef,
  direction,
  announce,
}: ViewProps & {
  env: BlockEnv;
  slideRef: RefObject<HTMLElement | null>;
  direction: Direction;
  announce: (text: string) => void;
}) {
  const lessons = lessonOrder(course);
  const lesson = findLesson(course, state.lessonId);
  if (!lesson) return null;
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const slides = lessonSlides(lesson);
  const slideIndex = Math.min(state.slide, slides.length - 1);
  const blocks = slides[slideIndex];
  const lastSlide = slideIndex === slides.length - 1;
  const slideHeading = blocks.find((block) => block.type === 'heading');
  const requirements = lessonRequirements(lesson, state);
  const met = requirements.every((item) => item.met);
  const slideMet = slideRequirementsMet(blocks, state);
  const checkedInteraction = blocks.find(
    (block): block is InteractionBlock =>
      isInteractionBlock(block) && state.checked.includes(block.id),
  );
  const feedback = checkedInteraction
    ? gradeInteraction(checkedInteraction, state.responses[checkedInteraction.id])
    : null;
  const retryBlockId = feedback && !feedback.correct ? checkedInteraction?.id : null;
  const feedbackTone = feedback ? (feedback.correct ? 'correct' : 'incorrect') : undefined;
  const currentOptionBlock = blocks.find(
    (b): b is OptionSelectBlock => b.type === 'optionSelect',
  );
  const optionHint =
    currentOptionBlock && !slideMet
      ? `Select each option to continue (${(state.optionSelects?.[currentOptionBlock.id] ?? []).length}/${currentOptionBlock.options.length})`
      : null;
  const completed = state.completedLessons.includes(lesson.id);
  const next = lessons[index + 1];
  const title = lesson.title;
  function advance() {
    if (completed) {
      if (next) go({ type: 'open-lesson', lessonId: next.id });
      else go({ type: 'open-assessment' });
      return;
    }
    go({ type: 'complete-lesson' });
    announce(`${title} marked complete.`);
  }
  return (
    <article className="lms-view lms-lesson">
      <header className="lms-view-header">
        <span className="lms-lesson-index">Lesson {String(index + 1).padStart(2, '0')} <span aria-hidden="true">/</span> {String(lessons.length).padStart(2, '0')}</span>
        <h1 ref={heading} tabIndex={-1}>
          {lesson.title}
        </h1>
        {slideIndex === 0 && (
          <p className="lms-lesson-summary">
            {lesson.summary}
            <span className="lms-lesson-minutes">
              <Clock size={14} aria-hidden="true" /> {lesson.minutes} min
            </span>
          </p>
        )}
      </header>
      <section
        key={`${lesson.id}:${slideIndex}`}
        ref={slideRef}
        className="lms-slide"
        data-direction={direction}
        tabIndex={-1}
        aria-roledescription="slide"
        aria-label={`Slide ${slideIndex + 1} of ${slides.length}${
          slideHeading ? `: ${slideHeading.text}` : ''
        }`}
      >
        <div className="lms-blocks">
          {blocks.map((block, blockIndex) => (
            <BlockRenderer
              key={`${lesson.id}-${slideIndex}-${blockIndex}`}
              block={block}
              env={env}
            />
          ))}
        </div>
      </section>
      {lastSlide && (
        <Requirements lesson={lesson} state={state} slideIndex={slideIndex} go={go} />
      )}
      <nav className="lms-view-nav" aria-label="Lesson navigation">
        <Button variant="ghost" onClick={() => go({ type: 'back' })}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Button>
        <div className="lms-view-nav-center">
          <SlidePosition index={slideIndex} total={slides.length} />
          {optionHint && (
            <span className="lms-slide-hint" aria-live="polite">
              {optionHint}
            </span>
          )}
        </div>
        {lastSlide ? (
          <Button
            data-feedback={feedbackTone}
            disabled={!retryBlockId && ((!completed && !met) || !slideMet)}
            onClick={() => retryBlockId ? go({ type: 'retry', blockId: retryBlockId }) : advance()}
          >
            {retryBlockId
              ? 'Try again'
              : completed
                ? next
                  ? 'Continue'
                  : 'Go to assessment'
                : next
                  ? 'Mark complete and continue'
                  : 'Mark complete and finish'}
            {retryBlockId ? <RotateCcw size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
          </Button>
        ) : (
          <Button
            data-feedback={feedbackTone}
            disabled={!retryBlockId && !slideMet}
            onClick={() => retryBlockId
              ? go({ type: 'retry', blockId: retryBlockId })
              : go({ type: 'go-slide', index: slideIndex + 1 })}
          >
            {retryBlockId ? 'Try again' : 'Next'}
            {retryBlockId ? <RotateCcw size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
          </Button>
        )}
      </nav>
    </article>
  );
}

function SlidePosition({ index, total }: { index: number; total: number }) {
  return (
    <span className="lms-slide-position">
      <span className="sr-only">
        Slide {index + 1} of {total}
      </span>
      <span aria-hidden="true">
        <b>{index + 1}</b> / {total}
      </span>
    </span>
  );
}

function Requirements({
  lesson,
  state,
  slideIndex,
  go,
}: {
  lesson: Lesson;
  state: PlayerState;
  slideIndex: number;
  go: Dispatch;
}) {
  const requirements = lessonRequirements(lesson, state);
  if (!requirements.length) return null;
  return (
    <aside className="lms-requirements" aria-label="Lesson requirements">
      <h2>To complete this lesson</h2>
      <ul>
        {requirements.map((item) => {
          const target = slideIndexOf(lesson, item.blockId);
          return (
            <li key={item.blockId} className={item.met ? 'is-met' : ''}>
              {item.met ? (
                <CircleCheck size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              <span>
                {item.label}
                <span className="sr-only">{item.met ? ' — done' : ' — not yet'}</span>
              </span>
              {!item.met && target >= 0 && target !== slideIndex && (
                <Button
                  variant="link"
                  size="sm"
                  className="lms-requirement-jump"
                  onClick={() => go({ type: 'go-slide', index: target })}
                >
                  Go to slide {target + 1}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function AssessmentView({
  course,
  state,
  env,
  go,
  heading,
  announce,
  authorMode,
}: ViewProps & { env: BlockEnv; announce: (text: string) => void; authorMode: boolean }) {
  const { assessment } = course;
  const locked = isAssessmentLocked(course, state);
  const remaining = attemptsRemaining(course, state);
  const current = state.assessment.current;
  const last = state.assessment.attempts.at(-1);
  const lessons = lessonOrder(course);
  const firstIncomplete = lessons.find(
    (lesson) => !state.completedLessons.includes(lesson.id),
  );

  if (locked)
    return (
      <article className="lms-view lms-assessment">
        <header className="lms-view-header">
          <span className="lms-kicker">Assessment</span>
          <h1 ref={heading} tabIndex={-1}>
            {assessment.title}
          </h1>
        </header>
        <aside className="lms-callout lms-callout-info" aria-label="Assessment locked">
          <Lock size={20} aria-hidden="true" />
          <div>
            <strong>Complete the lessons first</strong>
            <p>
              Complete every lesson to unlock the assessment.{authorMode ? ' The author lab can also use free navigation.' : ''}{' '}
              {lessons.length - state.completedLessons.length} lesson
              {lessons.length - state.completedLessons.length === 1 ? '' : 's'} remain.
            </p>
          </div>
        </aside>
        {firstIncomplete && (
          <div className="lms-view-actions">
            <Button onClick={() => go({ type: 'open-lesson', lessonId: firstIncomplete.id })}>
              Go to next incomplete lesson
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        )}
      </article>
    );

  if (current) {
    const ordered = questionOrder(assessment, current.seed);
    const examEnv: BlockEnv = {
      ...env,
      mode: 'exam',
      responses: current.responses,
      checked: [],
      onAnswer: (questionId, response) =>
        go({ type: 'answer-assessment', questionId, response }),
    };
    const answered = ordered.filter((question) =>
      Object.hasOwn(current.responses, question.id),
    ).length;
    return (
      <article className="lms-view lms-assessment">
        <header className="lms-view-header">
          <span className="lms-kicker">
            Attempt {state.assessment.attempts.length + 1} of {assessment.maxAttempts}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {assessment.title}
          </h1>
          <output className="lms-muted lms-answer-count">
            {answered} of {ordered.length} answered
          </output>
        </header>
        <div className="lms-blocks">
          {ordered.map((question, index) => (
            <div className="lms-block" data-block-type={question.type} key={question.id}>
              <Interaction
                block={question}
                env={examEnv}
                position={{ index: index + 1, total: ordered.length }}
              />
            </div>
          ))}
        </div>
        <nav className="lms-view-nav" aria-label="Assessment actions">
          <span className="lms-muted">
            {answered < ordered.length
              ? `${ordered.length - answered} unanswered question${ordered.length - answered === 1 ? '' : 's'} will score zero.`
              : 'All questions answered.'}
          </span>
          <Button
            onClick={() => {
              go({ type: 'submit-assessment', at: new Date().toISOString() });
              announce('Assessment submitted. Results are shown below the heading.');
            }}
          >
            Submit attempt
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </nav>
      </article>
    );
  }

  if (state.assessment.reviewing && last) {
    const reviewEnv: BlockEnv = {
      ...env,
      mode: 'review',
      responses: last.responses,
      checked: [],
    };
    return (
      <article className="lms-view lms-assessment">
        <header className="lms-view-header">
          <span className="lms-kicker">Results · Attempt {state.assessment.attempts.length}</span>
          <h1 ref={heading} tabIndex={-1}>
            {last.passed ? 'Passed' : 'Not passed'} · {last.percent}%
          </h1>
          <p className="lms-muted">
            Passing score {assessment.passingPercent}% · {remaining} attempt
            {remaining === 1 ? '' : 's'} remaining · submitted{' '}
            {new Date(last.at).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </header>
        <output className={`lms-score ${last.passed ? 'is-passed' : 'is-failed'}`}>
          {last.passed ? (
            <CircleCheck size={28} aria-hidden="true" />
          ) : (
            <TriangleAlert size={28} aria-hidden="true" />
          )}
          <div>
            <strong>{last.percent}%</strong>
            <span>
              {last.passed
                ? 'This attempt meets the passing score.'
                : remaining
                  ? 'Review the feedback below, then try again.'
                  : 'No attempts remain. Use Reset to start this practice course again.'}
            </span>
          </div>
        </output>
        <div className="lms-blocks">
          {assessment.questions.map((question, index) => (
            <div className="lms-block" data-block-type={question.type} key={question.id}>
              <Interaction
                block={question}
                env={reviewEnv}
                position={{ index: index + 1, total: assessment.questions.length }}
              />
            </div>
          ))}
        </div>
        <nav className="lms-view-nav" aria-label="Results actions">
          <Button variant="ghost" onClick={() => go({ type: 'back' })}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to lessons
          </Button>
          <span className="lms-view-nav-group">
            {remaining > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  go({
                    type: 'start-assessment',
                    seed: Date.now() % 2147483647,
                    at: new Date().toISOString(),
                  })
                }
              >
                <RotateCcw size={15} aria-hidden="true" />
                Try again
              </Button>
            )}
            <Button onClick={() => go({ type: 'open-summary' })}>
              Go to summary
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </span>
        </nav>
      </article>
    );
  }

  return (
    <article className="lms-view lms-assessment">
      <header className="lms-view-header">
        <span className="lms-kicker">Assessment</span>
        <h1 ref={heading} tabIndex={-1}>
          {assessment.title}
        </h1>
        <p className="lms-paragraph-lead">{assessment.intro}</p>
      </header>
      <dl className="lms-meta">
        <div>
          <dt>Questions</dt>
          <dd>{assessment.questions.length}</dd>
        </div>
        <div>
          <dt>Passing score</dt>
          <dd>{assessment.passingPercent}%</dd>
        </div>
        <div>
          <dt>Attempts remaining</dt>
          <dd>
            {remaining} of {assessment.maxAttempts}
          </dd>
        </div>
        <div>
          <dt>Question order</dt>
          <dd>{assessment.shuffleQuestions ? 'Shuffled per attempt' : 'Fixed'}</dd>
        </div>
      </dl>
      {!allLessonsComplete(course, state) && (
        <aside className="lms-callout lms-callout-warning" aria-label="Lessons incomplete">
          <TriangleAlert size={20} aria-hidden="true" />
          <div>
            <strong>Lessons are still incomplete</strong>
            <p>
              Free navigation lets you take the assessment early. The course only
              reaches knowledge-complete when every lesson is done and an attempt passes.
            </p>
          </div>
        </aside>
      )}
      <div className="lms-view-actions">
        <Button variant="ghost" onClick={() => go({ type: 'back' })}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Button>
        <Button
          disabled={remaining === 0}
          onClick={() =>
            go({
              type: 'start-assessment',
              seed: Date.now() % 2147483647,
              at: new Date().toISOString(),
            })
          }
        >
          {remaining === 0 ? 'No attempts remaining' : 'Start attempt'}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

function SummaryView({ course, state, go, heading }: ViewProps) {
  const status = courseStatus(course, state);
  const lessons = lessonOrder(course);
  const best = bestAttempt(state);
  const attestationBlocks = lessons
    .flatMap((lesson) => lesson.blocks)
    .filter(
      (block): block is AttestationBlock =>
        block.type === 'attestation' && block.required !== false,
    );
  const signed = attestationBlocks.filter((block) => state.attestations[block.id]).length;
  const remainingSteps = [
    ...(allLessonsComplete(course, state)
      ? []
      : [`Complete ${lessons.length - state.completedLessons.length} remaining lesson${lessons.length - state.completedLessons.length === 1 ? '' : 's'}.`]),
    ...(state.assessment.attempts.some((attempt) => attempt.passed)
      ? []
      : [`Pass the ${course.assessment.title.toLowerCase()} at ${course.assessment.passingPercent}% or higher.`]),
  ];
  return (
    <article className="lms-view lms-summary">
      <header className="lms-view-header">
        <span className="lms-kicker">Summary</span>
        <h1 ref={heading} tabIndex={-1}>
          {statusLabel(status)}
        </h1>
      </header>
      <dl className="lms-meta">
        <div>
          <dt>Lessons</dt>
          <dd>
            {state.completedLessons.length} of {lessons.length} complete
          </dd>
        </div>
        <div>
          <dt>Best assessment score</dt>
          <dd>{best ? `${best.percent}% · ${best.passed ? 'passed' : 'not passed'}` : 'No attempts yet'}</dd>
        </div>
        <div>
          <dt>Practice acknowledgements</dt>
          <dd>
            {signed} of {attestationBlocks.length} saved on this device
          </dd>
        </div>
        <div>
          <dt>Knowledge checks reviewed</dt>
          <dd>{state.checked.length}</dd>
        </div>
      </dl>
      {status === 'knowledge-complete' ? (
        <aside className="lms-callout lms-callout-success" aria-label="Completion statement">
          <Award size={20} aria-hidden="true" />
          <div>
            <strong>Sandbox course complete</strong>
            <p>{course.completionStatement}</p>
          </div>
        </aside>
      ) : (
        <section className="lms-overview-section" aria-labelledby="lms-remaining">
          <h2 id="lms-remaining">What remains</h2>
          <ul className="lms-objective-list">
            {remainingSteps.map((step) => (
              <li key={step}>
                <Circle size={16} aria-hidden="true" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <aside className="lms-callout lms-callout-note" aria-label="Boundary">
        <TriangleAlert size={20} aria-hidden="true" />
        <div>
          <strong>No training record is created</strong>
          <p>{course.boundary}</p>
        </div>
      </aside>
      <div className="lms-view-actions">
        <Button variant="ghost" onClick={() => go({ type: 'open-overview' })}>
          <ArrowLeft size={16} aria-hidden="true" />
          Course overview
        </Button>
        <Button variant="outline" onClick={() => go({ type: 'open-assessment' })}>
          Assessment
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
