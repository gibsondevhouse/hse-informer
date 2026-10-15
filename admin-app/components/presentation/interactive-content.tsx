'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import type {
  ActivityItem,
  ActivityResponse,
  ActivityVisual,
  InteractiveSlide,
} from '@/lib/lms/presentation';
import { FittedPanel, type PanelSection } from './fitted-panel';
import { TrainingPractice } from './training-practice';
import './interactive-content.css';

type Props = {
  slide: InteractiveSlide;
  response?: ActivityResponse;
  onChange: (response: ActivityResponse) => void;
  renderArtwork?: (key: string) => ReactNode;
};

function Artwork({
  value,
  renderArtwork,
}: {
  value: ActivityVisual;
  renderArtwork?: (key: string) => ReactNode;
}) {
  const art = renderArtwork?.(value.art);
  return (
    <figure className="activity-artwork" aria-label={value.description}>
      {art ?? <span>{value.description}</span>}
    </figure>
  );
}

/** The viewport changes composition, never the reading size or learning content. */
export function InteractiveContent({
  slide,
  response = {},
  onChange,
  renderArtwork,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [pane, setPane] = useState<'visual' | 'detail'>('visual');
  const [deciding, setDeciding] = useState(
    Boolean(response.decision?.selected),
  );
  const focusNext = useRef(false);
  const focusReading = useRef(false);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setCompact(node.clientWidth < 660 || node.clientHeight < 330),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (focusNext.current) {
      heading.current?.focus({ preventScroll: true });
      focusNext.current = false;
    }
    if (focusReading.current) {
      root.current
        ?.querySelector<HTMLElement>('.activity-reading')
        ?.focus({ preventScroll: true });
      focusReading.current = false;
    }
  }, [deciding, response.classification?.submitted, pane]);

  const content = slide.content;
  const items: ActivityItem[] =
    slide.template === 'visual-exploration'
      ? slide.content.targets
      : slide.template === 'comparison-activity' ||
          slide.template === 'classification'
        ? slide.content.items
        : slide.template === 'procedure-sequence'
          ? slide.content.steps
          : (slide.content.stages ?? []);
  const active =
    items.find((item) => item.id === response.activeId) ?? items[0];
  const activeIndex = items.indexOf(active);
  const decision = 'decision' in content ? content.decision : undefined;
  const decisionOpen = Boolean(
    decision && (slide.template === 'guided-decision' || deciding),
  );
  const visual =
    active?.visual ?? ('visual' in content ? content.visual : undefined);
  const classification = response.classification ?? {
    assignments: {},
    submitted: false,
  };
  const allAssigned = items.every(
    (item) => classification.assignments[item.id],
  );
  function activate(id: string, reveal = false) {
    onChange({
      ...response,
      activeId: id,
      viewed: [...new Set([...(response.viewed ?? []), id])],
    });
    if (reveal) {
      focusReading.current = compact;
      setPane('detail');
    }
  }
  const number = (value: number) => String(value).padStart(2, '0');
  const marker = (item: ActivityItem, index: number) =>
    item.marker ??
    number(index + ('startNumber' in content ? (content.startNumber ?? 1) : 1));
  const sections: PanelSection[] = active
    ? [
        { id: active.id, title: active.label, text: active.text },
        ...(active.check
          ? [{ id: 'check', title: 'Check in practice', text: active.check }]
          : []),
        ...(visual
          ? [
              {
                id: 'visual-description',
                title: 'Visual in words',
                text: visual.description,
              },
            ]
          : []),
      ]
    : [];
  if (slide.template === 'classification' && active) {
    const item = slide.content.items[activeIndex];
    if (classification.submitted) {
      const selected = classification.assignments[item.id];
      const label = slide.content.categories.find(
        (category) => category.id === selected,
      )?.label;
      sections.unshift({
        id: 'feedback',
        title:
          selected === item.category
            ? 'You identified it'
            : 'Reconsider this event',
        text: item.explanation,
      });
      sections.push({
        id: 'your-answer',
        title: 'Your assignment',
        text: label ?? 'No assignment',
      });
    }
  }

  return (
    <div
      ref={root}
      className="training-activity"
      data-activity={slide.template}
      data-compact={compact}
      data-training-interactive
      data-activity-id={content.activityId}
    >
      <div
        ref={heading}
        tabIndex={-1}
        className="activity-toolbar"
        aria-label="Activity controls"
      >
        {decisionOpen ? (
          <>
            <span className="activity-instruction">
              {slide.template === 'comparison-activity'
                ? 'Your decision'
                : 'Consider → decide → review'}
            </span>
            {slide.template === 'comparison-activity' && (
              <button
                type="button"
                onClick={() => {
                  focusNext.current = true;
                  setDeciding(false);
                }}
              >
                <ArrowLeft size={16} /> Compare again
              </button>
            )}
          </>
        ) : (
          <>
            <label className="activity-select-label">
              <span className="training-sr-only">
                {slide.template === 'classification'
                  ? 'Review event'
                  : 'Explore activity'}
              </span>
              <select
                value={active?.id}
                onChange={(event) => activate(event.target.value)}
              >
                {items.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {marker(item, index)} · {item.label}
                    {classification.assignments[item.id] ? ' — assigned' : ''}
                  </option>
                ))}
              </select>
            </label>
            <span className="activity-progress">
              {slide.template === 'classification'
                ? `${Object.keys(classification.assignments).length} / ${items.length} assigned`
                : `${activeIndex + 1} / ${items.length}`}
            </span>
            {compact && decision && (
              <button
                type="button"
                className="activity-choice-short activity-primary"
                aria-label="Make a choice"
                onClick={() => {
                  focusNext.current = true;
                  setDeciding(true);
                }}
              >
                Choose <ArrowRight size={16} />
              </button>
            )}
            {compact && visual && (
              <button
                type="button"
                aria-pressed={pane === 'detail'}
                onClick={() => setPane(pane === 'visual' ? 'detail' : 'visual')}
              >
                {pane === 'visual' ? 'Read detail' : 'View visual'}
              </button>
            )}
          </>
        )}
      </div>

      {decisionOpen && decision ? (
        <div className="activity-decision">
          {visual && !compact && (
            <figure className="activity-decision-art">
              <Artwork value={visual} renderArtwork={renderArtwork} />
              <figcaption>Pause at the decision.</figcaption>
            </figure>
          )}
          <TrainingPractice
            id={`${slide.id}-${content.activityId}`}
            content={decision}
            response={response.decision}
            onChange={(value) => onChange({ ...response, decision: value })}
          />
        </div>
      ) : (
        <>
          <div
            className="activity-workspace"
            data-has-visual={Boolean(visual)}
            data-pane={pane}
          >
            {slide.template === 'comparison-activity' &&
            !compact &&
            items.length > 1 ? (
              <div className="activity-comparison-pair">
                {[items[0], activeIndex === 0 ? items[1] : active].map(
                  (item) => (
                    <figure key={item.id} data-selected={active.id === item.id}>
                      {item.visual && (
                        <Artwork
                          value={item.visual}
                          renderArtwork={renderArtwork}
                        />
                      )}
                      <figcaption>{item.label}</figcaption>
                    </figure>
                  ),
                )}
              </div>
            ) : (
              visual &&
              (!compact || pane === 'visual') && (
                <figure className="activity-scene">
                  <div
                    className="activity-canvas"
                    style={
                      {
                        '--art-ratio': visual.aspectRatio ?? 1.5,
                      } as CSSProperties
                    }
                  >
                    <div className="activity-drawing">
                      <Artwork value={visual} renderArtwork={renderArtwork} />
                      {slide.template === 'visual-exploration' &&
                        slide.content.targets.map(
                          (target, index) =>
                            (!compact || target.id === active.id) && (
                              <button
                                key={target.id}
                                type="button"
                                className="activity-hotspot"
                                style={{
                                  left: `clamp(24px, ${target.x}%, calc(100% - 24px))`,
                                  top: `clamp(24px, ${target.y}%, calc(100% - 24px))`,
                                }}
                                aria-label={`Explore ${target.label}`}
                                aria-pressed={active.id === target.id}
                                onClick={() => activate(target.id, true)}
                              >
                                {index + 1}
                              </button>
                            ),
                        )}
                      {slide.template === 'procedure-sequence' && (
                        <span
                          className="activity-step-number"
                          aria-hidden="true"
                        >
                          {marker(active, activeIndex)}
                        </span>
                      )}
                    </div>
                  </div>
                  <figcaption>
                    {slide.template === 'visual-exploration'
                      ? 'Select a numbered point or use the topic selector.'
                      : active?.label}
                  </figcaption>
                </figure>
              )
            )}
            {(!compact || !visual || pane === 'detail') && (
              <div
                className="activity-reading"
                tabIndex={-1}
                role={classification.submitted ? 'status' : undefined}
              >
                <FittedPanel
                  label={
                    classification.submitted
                      ? 'Activity feedback'
                      : 'Activity detail'
                  }
                  sections={sections}
                />
              </div>
            )}
          </div>
          {slide.template === 'classification' ? (
            <div className="activity-classify-controls">
              {!classification.submitted && (
                <fieldset>
                  <legend className="training-sr-only">
                    Assign {active.label}
                  </legend>
                  {slide.content.categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={
                        classification.assignments[active.id] === category.id
                      }
                      onClick={() =>
                        onChange({
                          ...response,
                          classification: {
                            assignments: {
                              ...classification.assignments,
                              [active.id]: category.id,
                            },
                            submitted: false,
                          },
                        })
                      }
                    >
                      {category.label}
                    </button>
                  ))}
                </fieldset>
              )}
              <button
                type="button"
                className="activity-primary"
                disabled={!classification.submitted && !allAssigned}
                onClick={() => {
                  focusNext.current = true;
                  onChange({
                    ...response,
                    classification: classification.submitted
                      ? { assignments: {}, submitted: false }
                      : { ...classification, submitted: true },
                  });
                }}
              >
                {classification.submitted ? (
                  <>
                    <RotateCcw size={16} /> Try again
                  </>
                ) : (
                  <>
                    <Check size={16} /> Check all
                  </>
                )}
              </button>
            </div>
          ) : (
            <nav className="activity-navigation" aria-label="Activity items">
              {!compact &&
                items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === active.id}
                    onClick={() => activate(item.id)}
                  >
                    <span>{marker(item, index)}</span> {item.label}
                  </button>
                ))}
              {compact && (
                <>
                  <button
                    type="button"
                    aria-label="Previous activity item"
                    disabled={activeIndex === 0}
                    onClick={() => activate(items[activeIndex - 1].id)}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next activity item"
                    disabled={activeIndex === items.length - 1}
                    onClick={() => activate(items[activeIndex + 1].id)}
                  >
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
              {decision && (
                <button
                  type="button"
                  className="activity-primary"
                  onClick={() => {
                    focusNext.current = true;
                    setDeciding(true);
                  }}
                >
                  Make a choice <ArrowRight size={16} />
                </button>
              )}
            </nav>
          )}
        </>
      )}
      <span className="training-sr-only" aria-live="polite">
        {!decisionOpen && active
          ? `${active.label}. ${classification.submitted ? 'Feedback available.' : slide.template === 'classification' ? `${Object.keys(classification.assignments).length} of ${items.length} assigned. Assign every event, then check all.` : `${(response.viewed ?? []).length} explored.`}`
          : ''}
      </span>
    </div>
  );
}
