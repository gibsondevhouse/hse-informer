'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import type { TextSlide } from '@/lib/lms/presentation';
import { FittedPanel } from './fitted-panel';
import './text-content.css';

/** Essential text remains on the slide; optional explanations replace it temporarily. */
export function TextContent({ slide }: { slide: TextSlide }) {
  const root = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const trigger = useRef<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState(slide.content.sections[0].id);
  const [expanded, setExpanded] = useState<string>();
  const sections = slide.content.sections;
  const detail = sections.find((section) => section.id === expanded);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setCompact(element.clientWidth < 660 || element.clientHeight < 300);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (expanded) back.current?.focus();
    else if (trigger.current)
      root.current
        ?.querySelector<HTMLButtonElement>(
          `[data-section="${trigger.current}"]`,
        )
        ?.focus();
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[role="dialog"], [data-slide-details]')
      )
        return;
      event.preventDefault();
      setExpanded(undefined);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [expanded]);
  const visible = compact
    ? sections.filter((section) => section.id === active)
    : sections;
  return (
    <div
      className="training-text"
      ref={root}
      data-layout={slide.template}
      data-compact={compact}
      data-expanded={!!detail}
      data-training-interactive
    >
      {detail ? (
        <>
          <button
            type="button"
            ref={back}
            className="training-text-back"
            onClick={() => setExpanded(undefined)}
          >
            <ArrowLeft size={18} aria-hidden="true" /> Back to slide
          </button>
          <section
            className="training-text-detail"
            aria-label={`More about ${detail.title}`}
          >
            <FittedPanel
              label={`More about ${detail.title}`}
              sections={(detail.more ?? []).map((part, index) => ({
                ...part,
                id: `${detail.id}-${index}`,
              }))}
            />
          </section>
        </>
      ) : (
        <>
          {compact && (
            <label className="training-text-select">
              <span className="training-sr-only">Slide section</span>
              <select
                value={active}
                onChange={(event) => setActive(event.target.value)}
              >
                {sections.map((section, index) => (
                  <option key={section.id} value={section.id}>
                    {index + 1} / {sections.length} · {section.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="training-text-composition">
            {visible.map((section) => {
              const index = sections.indexOf(section);
              return (
                <section
                  className="training-text-block"
                  key={section.id}
                  data-index={index}
                  aria-label={section.title}
                >
                  <span className="training-text-marker" aria-hidden="true">
                    {section.marker ?? String(index + 1).padStart(2, '0')}
                  </span>
                  <FittedPanel
                    label={section.title}
                    sections={[
                      {
                        id: section.id,
                        title: section.title,
                        text: section.text,
                      },
                    ]}
                  />
                  {!!section.more?.length && (
                    <button
                      type="button"
                      className="training-text-more"
                      aria-label={`See more: ${section.title}`}
                      data-section={section.id}
                      onClick={() => {
                        trigger.current = section.id;
                        setActive(section.id);
                        setExpanded(section.id);
                      }}
                    >
                      See more <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
