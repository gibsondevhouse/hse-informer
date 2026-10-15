'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PanelSection = {
  id: string;
  title?: string;
  text: string;
  href?: string;
  linkLabel?: string;
  tone?: 'caution' | 'verification';
};
type Page = PanelSection[];

/** Prose stays readable: measure the available space and paginate, never scroll. */
export function FittedPanel({
  sections,
  label,
}: {
  sections: PanelSection[];
  label: string;
}) {
  const signature = JSON.stringify(sections);
  return <PanelPages key={signature} sections={sections} label={label} />;
}

function PanelPages({
  sections,
  label,
}: {
  sections: PanelSection[];
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [index, setIndex] = useState(0);

  useLayoutEffect(() => {
    const panel = root.current;
    const measuring = probe.current;
    const reading = reader.current;
    if (!panel || !measuring || !reading) return;
    let cancelled = false;
    const update = () => {
      if (cancelled || panel.clientWidth === 0 || panel.clientHeight === 0)
        return;
      const styles = getComputedStyle(reading);
      const horizontal =
        parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight) + 2;
      const vertical =
        parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) + 2;
      measuring.style.width = `${Math.max(1, panel.clientWidth - horizontal)}px`;
      const fits = (parts: Page, height: number) => {
        measuring.replaceChildren();
        for (const part of parts) {
          const section = document.createElement('div');
          section.className = 'training-panel-section';
          if (part.tone) section.dataset.tone = part.tone;
          if (part.title) {
            const heading = document.createElement('h2');
            heading.textContent = part.title;
            section.appendChild(heading);
          }
          if (part.text) {
            const paragraph = document.createElement('p');
            paragraph.textContent = part.text;
            section.appendChild(paragraph);
          }
          if (part.href) {
            const link = document.createElement('a');
            link.textContent = part.linkLabel || part.href;
            section.appendChild(link);
          }
          measuring.appendChild(section);
        }
        return measuring.getBoundingClientRect().height <= height - 2;
      };
      const fullHeight = panel.clientHeight - vertical;
      if (fits(sections, fullHeight)) {
        setPages([sections]);
        setIndex(0);
        return;
      }
      // A 48px pager plus its 8px gap remains outside the reading area.
      const height = fullHeight - 56;
      const next: Page[] = [];
      let current: Page = [];
      for (const section of sections) {
        if (fits([...current, section], height)) {
          current.push(section);
          continue;
        }
        if (current.length) {
          next.push(current);
          current = [];
        }
        if (fits([section], height)) {
          current.push(section);
          continue;
        }
        // Titles and links are authored short; long prose is split only at word boundaries.
        let words = section.text.split(/\s+/).filter(Boolean);
        let first = true;
        while (words.length) {
          let low = 1;
          let high = words.length;
          let best = 0;
          while (low <= high) {
            const count = Math.floor((low + high) / 2);
            const candidate = {
              ...section,
              title: first ? section.title : undefined,
              text: words.slice(0, count).join(' '),
              href: count === words.length ? section.href : undefined,
            };
            if (fits([candidate], height)) {
              best = count;
              low = count + 1;
            } else high = count - 1;
          }
          // A heading may fill its own page on a very short screen.
          if (best === 0 && first && section.title) {
            next.push([
              {
                id: section.id,
                title: section.title,
                text: '',
                tone: section.tone,
              },
            ]);
            first = false;
            continue;
          }
          const count = Math.max(1, best);
          next.push([
            {
              ...section,
              title: first ? section.title : undefined,
              text: words.slice(0, count).join(' '),
              href: count === words.length ? section.href : undefined,
            },
          ]);
          words = words.slice(count);
          first = false;
        }
        if (!section.text) next.push([section]);
      }
      if (current.length) next.push(current);
      setPages(next.length ? next : [[]]);
      setIndex((value) => Math.min(value, Math.max(0, next.length - 1)));
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    update();
    void document.fonts.ready.then(update);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [sections]);

  const pageIndex = Math.min(index, Math.max(0, pages.length - 1));
  return (
    <div
      className="training-fitted-panel"
      ref={root}
      data-fit-ready={pages.length > 0}
    >
      <section className="training-panel-page" ref={reader} aria-label={label}>
        <div className="training-panel-copy">
          {pages[pageIndex]?.map((part, position) => (
            <div
              className="training-panel-section"
              data-tone={part.tone}
              key={`${part.id}-${position}`}
            >
              {part.title && <h2>{part.title}</h2>}
              {part.text && <p>{part.text}</p>}
              {part.href && (
                <a href={part.href} target="_blank" rel="noopener noreferrer">
                  {part.linkLabel || part.href}
                  <span className="training-sr-only">
                    {' '}
                    (opens in a new tab)
                  </span>
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
      {pages.length > 1 && (
        <div className="training-pager" data-training-interactive>
          <button
            type="button"
            aria-label="Previous detail page"
            disabled={pageIndex === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span aria-live="polite">
            Detail page {pageIndex + 1} of {pages.length}
          </span>
          <button
            type="button"
            aria-label="Next detail page"
            disabled={pageIndex === pages.length - 1}
            onClick={() => setIndex((value) => value + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      <div className="training-fit-measure" aria-hidden="true" inert>
        <div className="training-panel-copy" ref={probe} />
      </div>
    </div>
  );
}
