'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Independently scrollable outlines need keyboard focus for arrow and Page Down scrolling. */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  isValidElement,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Info,
  LockKeyhole,
  Moon,
  Play,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { RadioGroup } from '@/components/ui/radio-group';
import { courses } from '@/lib/training';
import {
  initialPreviewState,
  lessonReferences,
  paginateBlocks,
  previewSteps,
  reducePreview,
  type PreviewAction,
  type PreviewState,
} from '@/lib/respiratory-preview';
import { lessonBlocks } from '@/components/respiratory-lesson-content';
import {
  refineLessonBlock,
  splitLessonBlock,
} from '@/components/split-lesson-block';
import './respiratory-player.css';

const course = courses.find((item) => item.id === 'respiratory')!;
const themeKey = 'hse-learner-theme';
// The current preview is admin-only; member home routing belongs to the future member workspace.
const homeHref = '/';

export default function RespiratoryPlayer() {
  const [state, dispatch] = useReducer(reducePreview, initialPreviewState);
  const [dark, setDark] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (state.step !== 4) return;
    const frame = requestAnimationFrame(() =>
      main.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [state.step, state.checked]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setDark(localStorage.getItem(themeKey) === 'dark');
      } catch {
        /* Storage is optional. */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function move(action: PreviewAction) {
    dispatch(action);
    setOutlineOpen(false);
    if (action.type !== 'overview') setExpanded(true);
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }
  function changeTheme(value: boolean) {
    setDark(value);
    try {
      localStorage.setItem(themeKey, value ? 'dark' : 'light');
    } catch {
      /* Storage is optional. */
    }
  }
  const theme = dark ? 'dark' : 'light';
  const outline = (
    <CourseOutline
      state={state}
      expanded={expanded}
      setExpanded={setExpanded}
      move={move}
    />
  );
  const correct = state.checked && state.answer === 'stop';
  return (
    <div className="training-preview rp-player" data-theme={theme}>
      <a className="skip-link" href="#lesson-content">
        Skip to lesson
      </a>
      <header className="rp-header">
        <a
          href={homeHref}
          className="rp-brand"
          aria-label="HSE Informer admin home"
        >
          <ShieldCheck size={24} />
          <span>HSE Informer</span>
        </a>
        <span className="rp-breadcrumb">
          Training <ChevronRight size={14} /> Respiratory Protection
        </span>
        <div className="rp-header-actions">
          <Toggle
            className="rp-theme-toggle"
            pressed={dark}
            onPressedChange={changeTheme}
            aria-label="Dark mode"
            title={dark ? 'Use light theme' : 'Use dark theme'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </Toggle>
          <a
            href={homeHref}
            className={buttonVariants({ variant: 'ghost' })}
            data-slot="button"
          >
            <ArrowLeft size={16} />
            <span>Return to admin</span>
          </a>
        </div>
      </header>
      <div className="rp-preview-bar">
        <span>
          <Eye size={14} />
          <strong>Admin preview</strong>
            <span className="rp-draft-label">Draft · Module 1</span>
        </span>
        <span>Preview activity does not affect training records.</span>
      </div>
      <div className="rp-layout">
        <aside className="rp-outline" aria-label="Course outline" tabIndex={0}>
          {outline}
        </aside>
        <main id="lesson-content" className="rp-main" ref={main} tabIndex={-1}>
          <div className="rp-position">
            <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
              <SheetTrigger
                className="rp-outline-trigger"
                render={<Button variant="outline" />}
              >
                <BookOpen size={16} />
                Outline
              </SheetTrigger>
              <SheetContent
                side="left"
                className="rp-overlay rp-outline-sheet"
                data-theme={theme}
              >
                <SheetTitle className="sr-only">Course outline</SheetTitle>
                <div className="rp-outline" tabIndex={0}>
                  {outline}
                </div>
              </SheetContent>
            </Sheet>
            <span>
              {state.step === 0
                ? 'Course introduction'
                  : `Module 01 · Section ${state.step} of 5`}
            </span>
            <Dialog>
              <DialogTrigger
                aria-label="Draft lesson references"
                render={<Button variant="ghost" />}
                className="rp-references"
              >
                <Info size={15} />
                <span>References</span>
              </DialogTrigger>
              <DialogContent
                className="rp-overlay rp-references-dialog"
                data-theme={theme}
              >
                <DialogTitle>Draft lesson references</DialogTitle>
                <DialogDescription>
                  These sources support the opening draft. Technical review,
                  worker testing, and course approval are still pending.
                </DialogDescription>
                <h3>Regulatory basis</h3>
                <p>
                  {course.regulatory?.authority} ·{' '}
                  {course.regulatory?.paragraphs.join(', ')}
                </p>
                <ul className="rp-source-links">
                  {course.regulatory?.references.map(({ label, href }) => (
                    <li key={href}>
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                        <ArrowUpRight size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
                <h3>Supporting sources for this lesson</h3>
                <ul className="rp-source-links">
                  {lessonReferences.map(({ label, href }) => (
                    <li key={href}>
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                        <ArrowUpRight size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
          </div>
          <LessonPages
            key={`${state.step}-${state.step === 4 && state.checked}`}
            blocks={lessonBlocks(state, dispatch)}
            section={previewSteps[state.step]}
            answer={state.answer}
            onAnswer={(value) => dispatch({ type: 'answer', value })}
            scenario={state.step === 4 && !state.checked}
            canBack={state.step > 0}
            onBack={() => move({ type: 'back' })}
            onContinue={() =>
              state.step === 4 && state.checked && !correct
                ? move({ type: 'answer', value: state.answer })
                : state.completed.includes(5) && state.step === 5
                  ? move({ type: 'section', value: 1 })
                  : move({ type: 'next' })
            }
            continueDisabled={state.step === 4 && !state.checked}
            continueLabel={
              state.step === 0
                ? 'Start module 1'
                : state.step === 4 && state.checked && !correct
                  ? 'Try again'
                  : state.step === 5
                    ? state.completed.includes(5)
                      ? 'Review lesson'
                      : 'Finish preview'
                    : 'Continue'
            }
          />
        </main>
      </div>
    </div>
  );
}

function CourseOutline({
  state,
  expanded,
  setExpanded,
  move,
}: {
  state: PreviewState;
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  move: (action: PreviewAction) => void;
}) {
  const available = Math.min(Math.max(0, ...state.completed) + 1, 5);
  return (
    <>
      <div className="rp-outline-heading">
        <h2>Respiratory Protection</h2>
          <p>7 planned modules</p>
      </div>
      <button
        className={`rp-intro ${state.step === 0 ? 'is-current' : ''}`}
        onClick={() => move({ type: 'overview' })}
        aria-current={state.step === 0 ? 'step' : undefined}
      >
        <BookOpen size={17} />
        Course introduction
      </button>
      <ol className="rp-lessons">
        {course.lessons.map((lesson, index) => (
          <li key={lesson}>
            {index === 0 ? (
              <Collapsible open={expanded} onOpenChange={setExpanded}>
                <div
                  className={`rp-lesson-row ${state.step > 0 ? 'is-current' : ''}`}
                >
                  <div className="rp-number-controls">
                    <span className="rp-lesson-number">01</span>
                    <CollapsibleTrigger
                      className="rp-expand"
                      aria-label={
                        expanded
                          ? 'Collapse module 1 sections'
                          : 'Expand module 1 sections'
                      }
                      title={expanded ? 'Collapse sections' : 'Expand sections'}
                    >
                      <ChevronDown size={16} />
                    </CollapsibleTrigger>
                  </div>
                  <button
                    className="rp-lesson-link"
                    onClick={() => move({ type: 'resume' })}
                  >
                    <span>
                      {lesson}
                      <small>
                        {state.completed.length} of 5 sections completed in
                        preview
                      </small>
                    </span>
                    <Play size={13} />
                  </button>
                </div>
                <CollapsibleContent>
                  <ol className="rp-sections">
                    {previewSteps.slice(1).map((title, index) => {
                      const step = index + 1;
                      const completed = state.completed.includes(step);
                      return (
                        <li key={title}>
                          <button
                            onClick={() =>
                              move({ type: 'section', value: step })
                            }
                            disabled={step > available}
                            aria-label={
                              completed
                                ? `${title}, completed in preview`
                                : undefined
                            }
                            aria-current={
                              state.step === step ? 'step' : undefined
                            }
                          >
                            {completed ? (
                              <Check size={14} />
                            ) : step > available ? (
                              <LockKeyhole size={13} />
                            ) : (
                              <span className="rp-section-dot" />
                            )}
                            <span>
                              {title}
                              {!completed && (
                                <small>
                                  {state.step === step
                                    ? 'Current section'
                                    : step > available
                                      ? 'Complete the previous section'
                                      : 'Ready to start'}
                                </small>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <div className="rp-lesson-row rp-planned">
                <span className="rp-lesson-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  {lesson}
                  <small>In development</small>
                </span>
                <LockKeyhole size={13} aria-label="Not yet available" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="rp-outline-boundary">
        Local instruction and employer authorization remain separate.
      </p>
    </>
  );
}

/** Measure inert copies at the reading width and expose only the active page. */
function LessonPages({
  blocks,
  section,
  answer,
  onAnswer,
  scenario,
  canBack,
  onBack,
  onContinue,
  continueDisabled,
  continueLabel,
}: {
  blocks: ReactNode[];
  section: string;
  answer: string;
  onAnswer: (answer: string) => void;
  scenario: boolean;
  canBack: boolean;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
  continueLabel: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const visible = useRef<HTMLDivElement>(null);
  const [depths, setDepths] = useState<Record<number, number>>({});
  const refined = useMemo(
    () =>
      blocks.flatMap((node, source) =>
        refineLessonBlock(node, depths[source] ?? 0).map((part, index) => ({
          node: part,
          source,
          index,
        })),
      ),
    [blocks, depths],
  );
  const [pages, setPages] = useState<number[][]>(() =>
    blocks.map((_, index) => [index]),
  );
  const [anchor, setAnchor] = useState({ source: 0, index: 0 });
  useLayoutEffect(() => {
    const viewport = stage.current;
    const measured = measure.current;
    if (!viewport || !measured) return;
    const update = () => {
      const heights = Array.from(
        measured.children,
        (child) => child.getBoundingClientRect().height,
      );
      const oversized = refined.filter(
        (part, index) =>
          heights[index] > viewport.clientHeight - 2 &&
          splitLessonBlock(part.node).length > 1 &&
          (depths[part.source] ?? 0) < 8,
      );
      if (oversized.length && viewport.clientHeight > 0) {
        setDepths((old) => {
          const next = { ...old };
          oversized.forEach(({ source }) => {
            next[source] = (old[source] ?? 0) + 1;
          });
          return next;
        });
        return;
      }
      const next = paginateBlocks(
        heights,
        viewport.clientHeight - 2,
        16,
        refined.map((part) =>
          isValidElement(part.node) && part.node.type === 'label'
            ? part.source
            : undefined,
        ),
      );
      setPages((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    Array.from(measured.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [refined, depths]);
  const pageIndex = Math.max(
    0,
    pages.findIndex((page) =>
      page.some(
        (index) =>
          refined[index]?.source === anchor.source &&
          refined[index]?.index === anchor.index,
      ),
    ),
  );
  const page = pages[pageIndex] ?? [0];
  const last = pageIndex === pages.length - 1;
  function changePage(index: number) {
    const part = refined[pages[index][0]];
    setAnchor({ source: part.source, index: part.index });
    requestAnimationFrame(() =>
      visible.current?.focus({ preventScroll: true }),
    );
  }
  const pageContent = (
    <div
      ref={visible}
      className="rp-page-content"
      tabIndex={-1}
      aria-label={`${section}, page ${pageIndex + 1} of ${pages.length}`}
    >
      {page.map((index) => (
        <div className="rp-content-block" key={index}>
          {refined[index]?.node}
        </div>
      ))}
    </div>
  );
  return (
    <article className="rp-canvas">
      <div className="rp-stage" ref={stage}>
        <div className="rp-measure" ref={measure} aria-hidden="true" inert>
          {refined.map(({ node: block }, index) => (
            <div className="rp-content-block" key={index}>
              {scenario ? (
                <RadioGroup value={answer}>{block}</RadioGroup>
              ) : (
                block
              )}
            </div>
          ))}
        </div>
        {scenario ? (
          <RadioGroup
            value={answer}
            onValueChange={(value) => onAnswer(String(value))}
            aria-label="Choose your response to the ventilation failure"
          >
            {pageContent}
          </RadioGroup>
        ) : (
          pageContent
        )}
      </div>
      <nav className="rp-controls" aria-label="Lesson navigation">
        <Button
          variant="ghost"
          disabled={!canBack && pageIndex === 0}
          onClick={() => (pageIndex > 0 ? changePage(pageIndex - 1) : onBack())}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Button>
        <span className="rp-page-position" aria-live="polite">
          {pageIndex + 1} / {pages.length}
          <span> {section}</span>
        </span>
        <Button
          className="rp-continue"
          disabled={last && continueDisabled}
          onClick={() => (last ? onContinue() : changePage(pageIndex + 1))}
        >
          {last ? continueLabel : 'Next'}
          <ArrowRight size={16} />
        </Button>
      </nav>
    </article>
  );
}
