'use client';

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
import { pbjSlides, type PBJSlide } from '@/lib/lms/pbj-presentation';
import { PBJArt } from './pbj-art';
import './pbj-presentation.css';

const chapters = [...new Set(pbjSlides.map((slide) => slide.chapter))];
const number = (value: number) => String(value).padStart(2, '0');
const subscribeCapabilities = () => () => {};

/** Presentation-only PBJ scratch pad. All controls are temporary viewing state. */
export function PBJPresentation() {
  const [index, setIndex] = useState(0);
  const [captions, setCaptions] = useState(false);
  const [outlineShown, setOutlineShown] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState(pbjSlides[0].chapter);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const slide = pbjSlides[index];
  const chapterIndex = chapters.indexOf(slide.chapter);
  const isLast = index === pbjSlides.length - 1;
  const anyDialog =
    outlineOpen || transcriptOpen || browserOpen || settingsOpen;

  const goTo = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(pbjSlides.length - 1, next));
    setIndex(bounded);
    setExpandedChapter(pbjSlides[bounded].chapter);
    setNotice('');
  }, []);

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
          target.closest('input, select, textarea, [role="dialog"]'))
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
      if (key === 'end') goTo(pbjSlides.length - 1);
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
  ]);

  const renderOutline = (instance: string) => (
    <nav className="pbj-chapters" aria-label="Presentation chapters">
      {chapters.map((chapter, position) => {
        const slides = pbjSlides
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
                <small>{slides.length} slides</small>
              </span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {expanded && (
              <ol
                id={`pbj-chapter-${position}-${instance}`}
                className="pbj-outline-slides"
              >
                {slides.map((item) => (
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
        <Link href="/" className="pbj-brand">
          <ShieldCheck size={21} aria-hidden="true" /> HSE Informer
        </Link>
        <span className="pbj-header-divider" />
        <span className="pbj-header-label">
          Learning studio <ChevronRight size={13} aria-hidden="true" />{' '}
          <strong>PBJ-101</strong>
        </span>
        <span className="pbj-preview-label">
          <span /> Design preview
        </span>
        <Link className="pbj-return" href="/" aria-label="Return to admin">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Return to admin</span>
        </Link>
      </header>

      <div className="pbj-layout" data-outline={outlineShown}>
        {outlineShown && (
          <aside className="pbj-outline">
            <div className="pbj-outline-heading">
              <span className="pbj-overline">THE COURSE</span>
              <h2>
                One simple task.
                <br />
                Done well.
              </h2>
              <p>
                {chapters.length} chapters <span>·</span> {pbjSlides.length}{' '}
                slides
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
              href="/"
              aria-label="Return to admin"
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
              <PBJDialogContent container={root} className="pbj-outline-dialog">
                <DialogTitle>Course outline</DialogTitle>
                <DialogDescription>
                  {chapters.length} chapters. Choose any slide.
                </DialogDescription>
                <div className="pbj-dialog-scroll">
                  {renderOutline('mobile')}
                </div>
              </PBJDialogContent>
            </Dialog>
            <span className="pbj-deck-breadcrumb">
              <span>{number(chapterIndex + 1)}</span> {slide.chapter}
            </span>
            <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
              <DialogTrigger
                className="pbj-text-button pbj-browse"
                aria-label="Browse slides"
              >
                <Grid2X2 size={16} aria-hidden="true" />
                <span>Browse slides</span>
              </DialogTrigger>
              <PBJDialogContent container={root} className="pbj-browser-dialog">
                <DialogTitle>Slide browser</DialogTitle>
                <DialogDescription>
                  Choose a slide to explore the presentation.
                </DialogDescription>
                <div className="pbj-dialog-scroll pbj-slide-browser">
                  {chapters.map((chapter) => (
                    <section key={chapter}>
                      <h3>{chapter}</h3>
                      <div className="pbj-slide-grid">
                        {pbjSlides.map(
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
                                  <PBJArt kind={item.art} />
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
              </PBJDialogContent>
            </Dialog>
          </div>

          <div className="pbj-stage-well">
            <article
              className={`pbj-slide pbj-slide--${slide.layout}`}
              data-pbj-slide
              data-slide-index={index}
              data-slide-id={slide.id}
              key={slide.id}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${pbjSlides.length}: ${slide.title}`}
            >
              <div className="pbj-slide-topline">
                <span>
                  PBJ<span className="pbj-course-dot">·</span>101
                </span>
                <span>
                  {slide.layout === 'cover'
                    ? 'COURSE PRESENTATION'
                    : slide.chapter}
                </span>
              </div>
              <SlideContent slide={slide} onRestart={() => goTo(0)} />
              <div className="pbj-slide-bottomline">
                <span>
                  {slide.layout === 'cover'
                    ? 'A little preparation. A better result.'
                    : slide.takeaway || 'One simple task. Done well.'}
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

          <footer className="pbj-controls">
            <progress
              className="sr-only"
              aria-label="Position in presentation"
              max={pbjSlides.length}
              value={index + 1}
              aria-valuetext={`Slide ${index + 1} of ${pbjSlides.length}`}
            />
            <div className="pbj-position" aria-hidden="true">
              {chapters.map((chapter) => {
                const items = pbjSlides.filter(
                  (item) => item.chapter === chapter,
                );
                const start = pbjSlides.findIndex(
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
                  <PBJDialogContent
                    container={root}
                    className="pbj-transcript-dialog"
                  >
                    <DialogTitle>Transcript</DialogTitle>
                    <DialogDescription>
                      Slide {number(index + 1)} of {pbjSlides.length}{' '}
                      <span aria-hidden="true">·</span> {slide.chapter}
                    </DialogDescription>
                    <div
                      key={slide.id}
                      className="pbj-dialog-scroll pbj-transcript-copy"
                    >
                      <span className="pbj-overline">{slide.eyebrow}</span>
                      <h3>{slide.title}</h3>
                      {slide.transcript.map((paragraph, p) => (
                        <p key={`${slide.id}-${p}`}>{paragraph}</p>
                      ))}
                    </div>
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
                  </PBJDialogContent>
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
                  <PBJDialogContent
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
                      <a
                        className="pbj-resource-link"
                        href="/training/pb-and-j/job-aid"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <BookOpen size={17} />
                        Open the one-page job aid
                        <ArrowRight size={16} />
                      </a>
                    </div>
                  </PBJDialogContent>
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
                  <span>/ {number(pbjSlides.length)}</span>
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
        {notice || `Slide ${index + 1} of ${pbjSlides.length}. ${slide.title}`}
      </output>
    </div>
  );
}

/** Keep the dialog portal inside the stage's fullscreen element. */
function PBJDialogContent({
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

function SlideContent({
  slide,
  onRestart,
}: {
  slide: PBJSlide;
  onRestart: () => void;
}) {
  const cover = slide.layout === 'cover';
  return (
    <div className="pbj-slide-body">
      <div className="pbj-slide-copy" data-pbj-content>
        <span className="pbj-slide-eyebrow">
          {cover ? 'THE EVERYDAY, DONE BETTER' : slide.eyebrow}
        </span>
        <h1 aria-label={slide.title}>
          {cover ? (
            <>
              <span>
                Peanut Butter
                <br />
                &amp; Jelly.
              </span>
              <small>Sandwich Preparation</small>
            </>
          ) : (
            slide.title
          )}
        </h1>
        <p className="pbj-slide-lead">{slide.lead}</p>
        {cover && (
          <div className="pbj-cover-meta">
            <span>
              <BookOpen size={15} />
              {chapters.length} chapters
            </span>
            <span>
              <Grid2X2 size={15} />
              {pbjSlides.length} slides
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
        <PBJArt kind={slide.art} />
        <div className="pbj-visual-label">
          <span />
          {cover
            ? 'Simple ingredients. Thoughtful preparation.'
            : visualLabels[slide.art]}
        </div>
      </div>
    </div>
  );
}

const visualLabels: Record<PBJSlide['art'], string> = {
  sandwich: 'A familiar task. A consistent result.',
  ingredients: 'Bread. Peanut butter. Fruit spread.',
  handwash: 'Good preparation starts with clean hands.',
  workstation: 'A place for everything you need.',
  spread: 'Even layers, all the way to the edges.',
  cut: 'A gentle touch. A clean finish.',
  storage: 'Ready to serve. Ready for later.',
};
