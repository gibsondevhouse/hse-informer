'use client';

import type { ActivityResponse } from '@/lib/lms/presentation';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Captions,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Grid2X2,
  Keyboard,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  PresentationCourse,
  LegacyPresentationSlide,
} from '@/lib/lms/presentation';
import {
  TemplateContent,
  SlideDetails,
  type PracticeResponse,
} from './template-content';
import './presentation.css';
import './templates.css';
import './template-variants.css';

const number = (value: number) => String(value).padStart(2, '0');
const subscribeCapabilities = () => () => {};

const subscribeWideScreen = (callback: () => void) => {
  const media = window.matchMedia('(min-width: 1200px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};

type PresentationPlayerProps = {
  course: PresentationCourse;
  renderArtwork?: (key: string) => ReactNode;
  artworkLabels?: Record<string, string>;
};

/** A different course starts a separate temporary viewing session. */
export function PresentationPlayer(props: PresentationPlayerProps) {
  return <PresentationSession key={props.course.id} {...props} />;
}

/** Course-neutral presentation. Viewing choices and practice are session-only. */
function PresentationSession({
  course,
  renderArtwork,
  artworkLabels = {},
}: PresentationPlayerProps) {
  const slides = course.slides;
  const chapters = [...new Set(slides.map((slide) => slide.chapter))];
  const [index, setIndex] = useState(0);
  const [captions, setCaptions] = useState(false);
  const [outlineShown, setOutlineShown] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState(slides[0].chapter);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activityResponses, setActivityResponses] = useState<
    Record<string, Record<string, ActivityResponse>>
  >({});
  const [practiceResponses, setPracticeResponses] = useState<
    Record<string, PracticeResponse>
  >({});
  const wideScreen = useSyncExternalStore(
    subscribeWideScreen,
    () => window.matchMedia('(min-width: 1200px)').matches,
    () => false,
  );
  const detailsTrigger = useRef<HTMLButtonElement>(null);
  const detailsPanel = useRef<HTMLElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [letterShortcuts, setLetterShortcuts] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenSupported = useSyncExternalStore(
    subscribeCapabilities,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  );
  const [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const slide = slides[index];
  const details = slide.details;
  const hasDetails = Boolean(
    details?.explanation?.length ||
    details?.terms?.length ||
    details?.sources?.length,
  );
  const chapterIndex = chapters.indexOf(slide.chapter);
  const isLast = index === slides.length - 1;
  const anyDialog =
    outlineOpen ||
    transcriptOpen ||
    browserOpen ||
    settingsOpen ||
    (detailsOpen && !wideScreen);

  const goTo = useCallback(
    (next: number) => {
      const bounded = Math.max(0, Math.min(slides.length - 1, next));
      setIndex(bounded);
      setExpandedChapter(slides[bounded].chapter);
      setNotice('');
      const nextDetails = slides[bounded].details;
      if (
        !nextDetails?.explanation?.length &&
        !nextDetails?.terms?.length &&
        !nextDetails?.sources?.length
      )
        setDetailsOpen(false);
    },
    [slides],
  );

  useEffect(() => {
    if (detailsOpen && wideScreen) detailsPanel.current?.focus();
  }, [detailsOpen, wideScreen]);

  const closeDetails = () => {
    setDetailsOpen(false);
    detailsTrigger.current?.focus();
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      setNotice(
        'Fullscreen is unavailable in this browser. The presentation still fits this window.',
      );
    }
  }, []);

  useEffect(() => {
    const update = () =>
      setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsOpen && wideScreen) {
        setDetailsOpen(false);
        detailsTrigger.current?.focus();
        return;
      }
      if (
        anyDialog ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            'input, select, textarea, [role="dialog"], [data-slide-details], [data-practice], [data-training-interactive]',
          ))
      )
        return;
      const key = event.key.toLowerCase();
      if (['c', 't', 'f'].includes(key) && !letterShortcuts) return;
      if (
        !['arrowleft', 'arrowright', 'home', 'end', 'c', 't', 'f'].includes(key)
      )
        return;
      event.preventDefault();
      if (key === 'arrowleft') goTo(index - 1);
      if (key === 'arrowright') goTo(index + 1);
      if (key === 'home') goTo(0);
      if (key === 'end') goTo(slides.length - 1);
      if (key === 'c') setCaptions((value) => !value);
      if (key === 't') setTranscriptOpen(true);
      if (key === 'f' && fullscreenSupported) void toggleFullscreen();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [
    anyDialog,
    goTo,
    index,
    fullscreenSupported,
    toggleFullscreen,
    letterShortcuts,
    detailsOpen,
    wideScreen,
    slides.length,
  ]);

  const renderOutline = (instance: string) => (
    <nav className="pbj-chapters" aria-label="Presentation chapters">
      {chapters.map((chapter, position) => {
        const chapterSlides = slides
          .map((item, slideIndex) => ({ ...item, slideIndex }))
          .filter((item) => item.chapter === chapter);
        const expanded = expandedChapter === chapter;
        return (
          <div
            className="pbj-chapter"
            key={chapter}
            data-current={slide.chapter === chapter}
          >
            <button
              type="button"
              className="pbj-chapter-button"
              aria-expanded={expanded}
              aria-controls={`pbj-chapter-${position}-${instance}`}
              onClick={() => setExpandedChapter(expanded ? '' : chapter)}
            >
              <span className="pbj-chapter-number">{number(position + 1)}</span>
              <span>
                {chapter}
                <small>{chapterSlides.length} slides</small>
              </span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {expanded && (
              <ol
                id={`pbj-chapter-${position}-${instance}`}
                className="pbj-outline-slides"
              >
                {chapterSlides.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={
                        index === item.slideIndex ? 'step' : undefined
                      }
                      onClick={() => {
                        goTo(item.slideIndex);
                        setOutlineOpen(false);
                      }}
                    >
                      <span className="pbj-outline-dot" aria-hidden="true" />
                      {item.layout === 'cover'
                        ? 'Welcome to the course'
                        : item.title}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div
      className="pbj-presentation"
      ref={root}
      data-motion={reduceMotion ? 'reduced' : 'enabled'}
    >
      <a className="pbj-skip" href="#lms-content">
        Skip to presentation
      </a>
      <header className="pbj-header">
        <Link href={course.brand.href} className="pbj-brand">
          <ShieldCheck size={21} aria-hidden="true" /> {course.brand.label}
        </Link>
        <span className="pbj-header-divider" />
        <span className="pbj-header-label">
          Learning studio <ChevronRight size={13} aria-hidden="true" />{' '}
          <strong>{course.code}</strong>
        </span>
        <span className="pbj-preview-label">
          <span /> {course.statusLabel}
        </span>
        <Link
          className="pbj-return"
          href={course.returnLink.href}
          aria-label={course.returnLink.label}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>{course.returnLink.label}</span>
        </Link>
      </header>

      <div className="pbj-layout" data-outline={outlineShown}>
        {outlineShown && (
          <aside className="pbj-outline">
            <div className="pbj-outline-heading">
              <span className="pbj-overline">THE COURSE</span>
              <h2>{course.sidebarTitle}</h2>
              <p>
                {chapters.length} chapters <span>·</span> {slides.length} slides
              </p>
            </div>
            {renderOutline('desktop')}
            <div className="pbj-outline-foot">
              <BookOpen size={15} aria-hidden="true" />
              <p>
                Explore at your own pace.
                <br />
                <span>Every slide is open to you.</span>
              </p>
            </div>
          </aside>
        )}

        <main id="lms-content" className="pbj-deck" tabIndex={-1}>
          <div className="pbj-deck-heading">
            <Link
              className="pbj-icon-button pbj-compact-back"
              href={course.returnLink.href}
              aria-label={course.returnLink.label}
            >
              <ArrowLeft size={17} />
            </Link>
            <button
              className="pbj-icon-button pbj-desktop-only"
              type="button"
              aria-label="Course outline"
              title="Toggle course outline"
              aria-expanded={outlineShown}
              onClick={() => setOutlineShown((value) => !value)}
            >
              {outlineShown ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
            <Dialog open={outlineOpen} onOpenChange={setOutlineOpen}>
              <DialogTrigger
                className="pbj-icon-button pbj-mobile-only"
                aria-label="Course outline"
              >
                <PanelLeftOpen size={18} />
              </DialogTrigger>
              <PresentationDialogContent
                container={root}
                className="pbj-outline-dialog"
              >
                <DialogTitle>Course outline</DialogTitle>
                <DialogDescription>
                  {chapters.length} chapters. Choose any slide.
                </DialogDescription>
                <div className="pbj-dialog-scroll">
                  {renderOutline('mobile')}
                </div>
              </PresentationDialogContent>
            </Dialog>
            <span className="pbj-deck-breadcrumb">
              <span>{number(chapterIndex + 1)}</span> {slide.chapter}
            </span>
            {hasDetails &&
              (wideScreen ? (
                <button
                  ref={detailsTrigger}
                  type="button"
                  className="pbj-text-button training-details-trigger"
                  aria-label="Slide details"
                  aria-expanded={detailsOpen}
                  aria-controls="training-details-panel"
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  <BookOpen size={17} aria-hidden="true" />
                  <span>Slide details</span>
                </button>
              ) : (
                <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                  <DialogTrigger
                    ref={detailsTrigger}
                    className="pbj-text-button training-details-trigger"
                    aria-label="Slide details"
                  >
                    <BookOpen size={17} aria-hidden="true" />
                    <span>Slide details</span>
                  </DialogTrigger>
                  <PresentationDialogContent
                    container={root}
                    className="training-details-dialog"
                  >
                    <DialogTitle>Slide details</DialogTitle>
                    <DialogDescription>{slide.title}</DialogDescription>
                    <PresentationReadingRegion
                      className="pbj-dialog-scroll"
                      key={slide.id}
                    >
                      <SlideDetails slide={slide} />
                    </PresentationReadingRegion>
                  </PresentationDialogContent>
                </Dialog>
              ))}
            <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
              <DialogTrigger
                className="pbj-text-button pbj-browse"
                aria-label="Browse slides"
              >
                <Grid2X2 size={16} aria-hidden="true" />
                <span>Browse slides</span>
              </DialogTrigger>
              <PresentationDialogContent
                container={root}
                className="pbj-browser-dialog"
              >
                <DialogTitle>Slide browser</DialogTitle>
                <DialogDescription>
                  Choose a slide to explore the presentation.
                </DialogDescription>
                <div className="pbj-dialog-scroll pbj-slide-browser">
                  {chapters.map((chapter) => (
                    <section key={chapter}>
                      <h3>{chapter}</h3>
                      <div className="pbj-slide-grid">
                        {slides.map(
                          (item, itemIndex) =>
                            item.chapter === chapter && (
                              <DialogClose
                                key={item.id}
                                className="pbj-thumbnail"
                                aria-current={
                                  itemIndex === index ? 'step' : undefined
                                }
                                onClick={() => goTo(itemIndex)}
                              >
                                <span className="pbj-thumbnail-art">
                                  {item.layout === 'template' ? (
                                    <span className="training-thumbnail-type">
                                      {item.template}
                                    </span>
                                  ) : (
                                    renderArtwork?.(item.art)
                                  )}
                                  <span>{number(itemIndex + 1)}</span>
                                </span>
                                <span>
                                  {item.layout === 'cover'
                                    ? 'Welcome to the course'
                                    : item.title}
                                </span>
                              </DialogClose>
                            ),
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </PresentationDialogContent>
            </Dialog>
          </div>

          <div
            className="training-stage-area"
            data-details={detailsOpen && hasDetails && wideScreen}
          >
            <div className="pbj-stage-well">
              <article
                className={`pbj-slide pbj-slide--${slide.layout}`}
                data-pbj-slide
                data-template={
                  slide.layout === 'template' ? slide.template : undefined
                }
                data-slide-index={index}
                data-slide-id={slide.id}
                key={slide.id}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
              >
                <div className="pbj-slide-topline">
                  <span>{course.code}</span>
                  <span>
                    {slide.layout === 'cover'
                      ? 'COURSE PRESENTATION'
                      : slide.chapter}
                  </span>
                </div>
                {slide.layout === 'template' ? (
                  <TemplateContent
                    slide={slide}
                    course={course}
                    onNavigate={(id) => {
                      const next = slides.findIndex((item) => item.id === id);
                      if (next >= 0) {
                        goTo(next);
                        root.current
                          ?.querySelector<HTMLElement>('main')
                          ?.focus();
                      }
                    }}
                    renderArtwork={renderArtwork}
                    activity={
                      'activityId' in slide.content
                        ? activityResponses[slide.id]?.[
                            slide.content.activityId
                          ]
                        : undefined
                    }
                    onActivityChange={(response) => {
                      if (!('activityId' in slide.content)) return;
                      const activityId = slide.content.activityId;
                      setActivityResponses((current) => ({
                        ...current,
                        [slide.id]: {
                          ...current[slide.id],
                          [activityId]: response,
                        },
                      }));
                    }}
                    practice={practiceResponses[slide.id]}
                    onPracticeChange={(response) =>
                      setPracticeResponses((current) => ({
                        ...current,
                        [slide.id]: response,
                      }))
                    }
                  />
                ) : (
                  <LegacySlideContent
                    slide={slide}
                    onRestart={() => goTo(0)}
                    renderArtwork={renderArtwork}
                    artworkLabels={artworkLabels}
                    chapterCount={chapters.length}
                    slideCount={slides.length}
                  />
                )}
                <div className="pbj-slide-bottomline">
                  <span>
                    {slide.layout === 'cover'
                      ? course.tagline
                      : slide.takeaway || course.tagline}
                  </span>
                  <span>{number(index + 1)}</span>
                </div>
              </article>
              {captions && (
                <section className="pbj-captions" aria-label="Slide captions">
                  <Captions size={18} aria-hidden="true" />
                  <p>{slide.caption}</p>
                </section>
              )}
            </div>

            {detailsOpen && hasDetails && wideScreen && (
              <aside
                id="training-details-panel"
                className="training-details-panel"
                aria-label="Slide details"
                data-slide-details
              >
                <div className="training-details-heading">
                  <h2>Slide details</h2>
                  <button
                    type="button"
                    className="pbj-icon-button"
                    aria-label="Close slide details"
                    onClick={closeDetails}
                  >
                    <X size={19} />
                  </button>
                </div>
                <p className="training-details-context">{slide.title}</p>
                <PresentationReadingRegion
                  className="training-details-scroll"
                  regionRef={detailsPanel}
                  key={slide.id}
                >
                  <SlideDetails slide={slide} />
                </PresentationReadingRegion>
              </aside>
            )}
          </div>

          <footer className="pbj-controls">
            <progress
              className="sr-only"
              aria-label="Position in presentation"
              max={slides.length}
              value={index + 1}
              aria-valuetext={`Slide ${index + 1} of ${slides.length}`}
            />
            <div className="pbj-position" aria-hidden="true">
              {chapters.map((chapter) => {
                const items = slides.filter((item) => item.chapter === chapter);
                const start = slides.findIndex(
                  (item) => item.chapter === chapter,
                );
                const portion = Math.max(
                  0,
                  Math.min(1, (index - start + 1) / items.length),
                );
                return (
                  <span key={chapter} style={{ flex: items.length }}>
                    <i style={{ width: `${portion * 100}%` }} />
                  </span>
                );
              })}
            </div>
            <div className="pbj-control-row">
              <div className="pbj-view-controls">
                <button
                  type="button"
                  className="pbj-tool-button"
                  aria-label="Captions"
                  aria-pressed={captions}
                  title="Captions (C)"
                  onClick={() => setCaptions((value) => !value)}
                >
                  <Captions size={19} />
                  <span>Captions</span>
                </button>
                <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
                  <DialogTrigger
                    className="pbj-tool-button"
                    aria-label="Transcript"
                    title="Transcript (T)"
                  >
                    <FileText size={18} />
                    <span>Transcript</span>
                  </DialogTrigger>
                  <PresentationDialogContent
                    container={root}
                    className="pbj-transcript-dialog"
                  >
                    <DialogTitle>Transcript</DialogTitle>
                    <DialogDescription>
                      Slide {number(index + 1)} of {slides.length}{' '}
                      <span aria-hidden="true">·</span> {slide.chapter}
                    </DialogDescription>
                    <PresentationReadingRegion
                      label="Slide transcript"
                      key={slide.id}
                      className="pbj-dialog-scroll pbj-transcript-copy"
                    >
                      <span className="pbj-overline">{slide.eyebrow}</span>
                      <h3>{slide.title}</h3>
                      {slide.transcript.map((paragraph, p) => (
                        <p key={`${slide.id}-${p}`}>{paragraph}</p>
                      ))}
                    </PresentationReadingRegion>
                    <div className="pbj-dialog-nav">
                      <button
                        type="button"
                        className="pbj-button"
                        aria-label="Previous transcript slide"
                        disabled={index === 0}
                        onClick={() => goTo(index - 1)}
                      >
                        <ChevronLeft size={17} />
                        Previous
                      </button>
                      <button
                        type="button"
                        className="pbj-button"
                        aria-label="Next transcript slide"
                        disabled={isLast}
                        onClick={() => goTo(index + 1)}
                      >
                        Next
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </PresentationDialogContent>
                </Dialog>
                <span className="pbj-tool-divider" />
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger
                    className="pbj-icon-button"
                    aria-label="Presentation settings"
                    title="Presentation settings"
                  >
                    <Settings2 size={18} />
                  </DialogTrigger>
                  <PresentationDialogContent
                    container={root}
                    className="pbj-settings-dialog"
                  >
                    <DialogTitle>Presentation settings</DialogTitle>
                    <DialogDescription>
                      Make this presentation comfortable for you.
                    </DialogDescription>
                    <div className="pbj-dialog-scroll">
                      <label
                        className="pbj-setting"
                        htmlFor="pbj-caption-setting"
                      >
                        <span>
                          Slide captions
                          <small>Concise text for the current slide.</small>
                        </span>
                        <input
                          id="pbj-caption-setting"
                          type="checkbox"
                          checked={captions}
                          onChange={(event) =>
                            setCaptions(event.target.checked)
                          }
                        />
                      </label>
                      <label
                        className="pbj-setting"
                        htmlFor="pbj-motion-setting"
                      >
                        <span>
                          Reduce motion
                          <small>Switch slides without a transition.</small>
                        </span>
                        <input
                          id="pbj-motion-setting"
                          type="checkbox"
                          checked={reduceMotion}
                          onChange={(event) =>
                            setReduceMotion(event.target.checked)
                          }
                        />
                      </label>
                      <label
                        className="pbj-setting"
                        htmlFor="pbj-shortcut-setting"
                      >
                        <span>
                          Letter shortcuts
                          <small>Use C, T, and F for viewing controls.</small>
                        </span>
                        <input
                          id="pbj-shortcut-setting"
                          type="checkbox"
                          checked={letterShortcuts}
                          onChange={(event) =>
                            setLetterShortcuts(event.target.checked)
                          }
                        />
                      </label>
                      <div className="pbj-shortcuts">
                        <h3>
                          <Keyboard size={17} />
                          Keyboard shortcuts
                        </h3>
                        <dl>
                          <div>
                            <dt>Previous / next slide</dt>
                            <dd>
                              <kbd>←</kbd> <kbd>→</kbd>
                            </dd>
                          </div>
                          <div>
                            <dt>First / last slide</dt>
                            <dd>
                              <kbd>Home</kbd> <kbd>End</kbd>
                            </dd>
                          </div>
                          <div>
                            <dt>Captions / transcript</dt>
                            <dd>
                              <kbd>C</kbd> <kbd>T</kbd>
                            </dd>
                          </div>
                          {fullscreenSupported && (
                            <div>
                              <dt>Fullscreen</dt>
                              <dd>
                                <kbd>F</kbd>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                      <p className="pbj-setting-note">
                        Slides advance manually. Captions and transcripts are
                        text previews; audio narration has not been added.
                        Viewing choices reset when you leave.
                      </p>
                      {course.jobAid && (
                        <a
                          className="pbj-resource-link"
                          href={course.jobAid.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <BookOpen size={17} />
                          {course.jobAid.label}
                          <ArrowRight size={16} />
                        </a>
                      )}
                    </div>
                  </PresentationDialogContent>
                </Dialog>
                {fullscreenSupported && (
                  <button
                    type="button"
                    className="pbj-icon-button pbj-fullscreen"
                    title="Fullscreen (F)"
                    aria-label={
                      fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                    }
                    onClick={() => void toggleFullscreen()}
                  >
                    {fullscreen ? (
                      <Minimize size={18} />
                    ) : (
                      <Maximize size={18} />
                    )}
                  </button>
                )}
              </div>
              <div className="pbj-navigation">
                <span className="pbj-slide-count">
                  <strong>{number(index + 1)}</strong>
                  <span>/ {number(slides.length)}</span>
                </span>
                <button
                  type="button"
                  className="pbj-icon-button pbj-previous"
                  aria-label="Previous slide"
                  title="Previous slide (←)"
                  disabled={index === 0}
                  onClick={() => goTo(index - 1)}
                >
                  <ArrowLeft size={19} />
                </button>
                <button
                  type="button"
                  className="pbj-button pbj-next"
                  aria-label="Next slide"
                  title="Next slide (→)"
                  disabled={isLast}
                  onClick={() => goTo(index + 1)}
                >
                  <span>{index === 0 ? 'Begin course' : 'Next'}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </footer>
        </main>
      </div>
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {notice || `Slide ${index + 1} of ${slides.length}. ${slide.title}`}
      </output>
    </div>
  );
}

function PresentationReadingRegion({
  children,
  className,
  regionRef,
  label = 'Supporting details',
}: {
  label?: string;
  children: ReactNode;
  className: string;
  regionRef?: RefObject<HTMLElement | null>;
}) {
  // Keyboard users need to focus the actual scroll container to read long details and transcripts.
  /* oxlint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <section
      ref={regionRef}
      tabIndex={0}
      aria-label={label}
      className={className}
    >
      {children}
    </section>
  );
  /* oxlint-enable jsx-a11y/no-noninteractive-tabindex */
}

/** Keep the dialog portal inside the stage's fullscreen element. */
function PresentationDialogContent({
  container,
  className,
  children,
}: {
  container: RefObject<HTMLDivElement | null>;
  className: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Backdrop className="pbj-backdrop" />
      <DialogPrimitive.Popup className={`pbj-dialog ${className}`}>
        {children}
        <DialogPrimitive.Close
          className="pbj-icon-button pbj-dialog-close"
          aria-label="Close"
        >
          <X size={19} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function LegacySlideContent({
  slide,
  onRestart,
  renderArtwork,
  artworkLabels,
  chapterCount,
  slideCount,
}: {
  slide: LegacyPresentationSlide;
  onRestart: () => void;
  renderArtwork?: (key: string) => ReactNode;
  artworkLabels: Record<string, string>;
  chapterCount: number;
  slideCount: number;
}) {
  const cover = slide.layout === 'cover';
  return (
    <div className="pbj-slide-body">
      <div className="pbj-slide-copy" data-pbj-content>
        <span className="pbj-slide-eyebrow">{slide.eyebrow}</span>
        <h1 aria-label={slide.title}>{slide.title}</h1>
        <p className="pbj-slide-lead">{slide.lead}</p>
        {cover && (
          <div className="pbj-cover-meta">
            <span>
              <BookOpen size={15} />
              {chapterCount} chapters
            </span>
            <span>
              <Grid2X2 size={15} />
              {slideCount} slides
            </span>
            <span>Self-paced</span>
          </div>
        )}
        {slide.points && (
          <ol className="pbj-slide-points">
            {slide.points.map((point, p) => (
              <li key={point.title}>
                <span className="pbj-point-marker" aria-hidden="true">
                  {slide.layout === 'steps' ? (
                    number(p + 1)
                  ) : (
                    <Check size={15} />
                  )}
                </span>
                <div>
                  <h2>{point.title}</h2>
                  <p>{point.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {slide.layout === 'closing' && (
          <button
            type="button"
            className="pbj-button pbj-restart"
            onClick={onRestart}
          >
            <RotateCcw size={17} />
            Explore again
          </button>
        )}
      </div>
      <div className="pbj-slide-visual" aria-hidden="true">
        <div className="pbj-art-orbit" />
        {renderArtwork?.(slide.art)}
        <div className="pbj-visual-label">
          <span />
          {artworkLabels[slide.art]}
        </div>
      </div>
    </div>
  );
}
