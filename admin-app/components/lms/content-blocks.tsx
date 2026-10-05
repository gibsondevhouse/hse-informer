'use client';

import { useState } from 'react';
import {
  AudioLines,
  Check,
  CircleCheck,
  Download,
  ExternalLink,
  Info,
  Lightbulb,
  OctagonAlert,
  StickyNote,
  TriangleAlert,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  CalloutBlock,
  CalloutVariant,
  DefinitionBlock,
  FigureBlock,
  GlossaryBlock,
  HeadingBlock,
  KeyTakeawaysBlock,
  ListBlock,
  MediaBlock,
  ObjectivesBlock,
  ParagraphBlock,
  ReferencesBlock,
  ResourceBlock,
  StepsBlock,
  TableBlock,
  TimelineBlock,
} from '@/lib/lms/schema';
import { Illustration } from './illustrations';

export function Heading({ block }: { block: HeadingBlock }) {
  const Tag = block.level === 3 ? 'h3' : 'h2';
  return (
    <div className="lms-heading">
      {block.kicker && <span className="lms-kicker">{block.kicker}</span>}
      <Tag>{block.text}</Tag>
    </div>
  );
}

export function Paragraph({ block }: { block: ParagraphBlock }) {
  return (
    <p className={`lms-paragraph lms-paragraph-${block.variant ?? 'body'}`}>
      {block.text}
    </p>
  );
}

const calloutIcons: Record<CalloutVariant, typeof Info> = {
  info: Info,
  tip: Lightbulb,
  note: StickyNote,
  warning: TriangleAlert,
  danger: OctagonAlert,
  success: CircleCheck,
};
const calloutRoles: Partial<Record<CalloutVariant, 'note' | 'alert'>> = {
  note: 'note',
  info: 'note',
  tip: 'note',
};

export function Callout({ block }: { block: CalloutBlock }) {
  const Icon = calloutIcons[block.variant];
  return (
    <aside
      className={`lms-callout lms-callout-${block.variant}`}
      role={calloutRoles[block.variant]}
      aria-label={block.title ?? `${block.variant} callout`}
    >
      <Icon size={20} aria-hidden="true" />
      <div>
        {block.title && <strong>{block.title}</strong>}
        <p>{block.text}</p>
      </div>
    </aside>
  );
}

export function Objectives({ block }: { block: ObjectivesBlock }) {
  return (
    <section className="lms-objectives" aria-label={block.title ?? 'Objectives'}>
      <h3>{block.title ?? 'In this lesson you will learn to'}</h3>
      <ul>
        {block.items.map((item) => (
          <li key={item}>
            <Check size={16} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function List({ block }: { block: ListBlock }) {
  const Tag = block.style === 'numbered' ? 'ol' : 'ul';
  return (
    <div className={`lms-list lms-list-${block.style}`}>
      {block.title && <h3>{block.title}</h3>}
      <Tag>
        {block.items.map((item) => (
          <li key={item}>
            {block.style === 'check' && <Check size={15} aria-hidden="true" />}
            <span>{item}</span>
          </li>
        ))}
      </Tag>
    </div>
  );
}

export function KeyTakeaways({ block }: { block: KeyTakeawaysBlock }) {
  return (
    <section className="lms-takeaways" aria-label={block.title ?? 'Key takeaways'}>
      <h3>{block.title ?? 'Key takeaways'}</h3>
      <div className="lms-takeaways-grid">
        {block.items.map((item) => (
          <div className="lms-takeaway" key={item.title}>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Definition({ block }: { block: DefinitionBlock }) {
  return (
    <dl className="lms-definition">
      <dt>{block.term}</dt>
      <dd>
        {block.definition}
        {block.example && (
          <span className="lms-definition-example">
            <em>Example:</em> {block.example}
          </span>
        )}
      </dd>
    </dl>
  );
}

export function Glossary({ block }: { block: GlossaryBlock }) {
  return (
    <section className="lms-glossary" aria-label={block.title ?? 'Glossary'}>
      <h3>{block.title ?? 'Glossary'}</h3>
      <dl>
        {block.terms.map((item) => (
          <div key={item.term}>
            <dt>{item.term}</dt>
            <dd>{item.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Figure({ block }: { block: FigureBlock }) {
  return (
    <figure className="lms-figure">
      <Illustration art={block.art} alt={block.alt} className="lms-art" />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  );
}

export function Media({ block }: { block: MediaBlock }) {
  const [open, setOpen] = useState(false);
  const Icon = block.kind === 'video' ? Video : AudioLines;
  return (
    <section className="lms-media" aria-label={block.title}>
      <div className={`lms-media-frame lms-media-${block.kind}`}>
        <Icon size={32} aria-hidden="true" />
        <strong>{block.title}</strong>
        <span className="lms-media-meta">
          {block.kind === 'video' ? 'Video' : 'Audio'} · {block.duration}
          {block.captions ? ' · Captions available' : ' · No captions'}
        </span>
        <span className="lms-media-placeholder">
          Placeholder: no media file is bundled in the sandbox.
        </span>
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={<Button variant="outline" size="sm" />}
          className="lms-transcript-toggle"
        >
          {open ? 'Hide transcript' : 'Show transcript'}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="lms-transcript" aria-label="Transcript">
            {block.transcript.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
      {block.note && <p className="lms-media-note">{block.note}</p>}
    </section>
  );
}

export function Steps({ block }: { block: StepsBlock }) {
  return (
    <section className="lms-steps" aria-label={block.title ?? 'Steps'}>
      {block.title && <h3>{block.title}</h3>}
      <ol>
        {block.steps.map((step, index) => (
          <li key={step.title}>
            <span className="lms-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
              {step.caution && (
                <p className="lms-step-caution">
                  <TriangleAlert size={14} aria-hidden="true" />
                  <span>
                    <span className="sr-only">Caution: </span>
                    {step.caution}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Timeline({ block }: { block: TimelineBlock }) {
  return (
    <section className="lms-timeline" aria-label={block.title ?? 'Timeline'}>
      {block.title && <h3>{block.title}</h3>}
      <ol>
        {block.events.map((event) => (
          <li key={`${event.label}-${event.title}`}>
            <span className="lms-timeline-label">{event.label}</span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Table({ block }: { block: TableBlock }) {
  return (
    <div className="lms-table-wrap">
      <table className="lms-table">
        <caption>{block.caption}</caption>
        <thead>
          <tr>
            {block.columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row[0]}`}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th scope="row" key={cellIndex}>
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Resource({ block }: { block: ResourceBlock }) {
  return (
    <div className="lms-resource">
      <Download size={22} aria-hidden="true" />
      <div>
        <strong>{block.title}</strong>
        <p>{block.description}</p>
        <span className="lms-resource-format">{block.format}</span>
      </div>
      {block.href ? (
        <a
          className="lms-resource-link"
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="lms-resource-pending">Placeholder</span>
      )}
    </div>
  );
}

export function References({ block }: { block: ReferencesBlock }) {
  return (
    <section className="lms-references" aria-label={block.title ?? 'References'}>
      <h3>{block.title ?? 'References'}</h3>
      <ul>
        {block.items.map((item) => (
          <li key={item.href}>
            <a href={item.href} target="_blank" rel="noopener noreferrer">
              {item.label}
              <ExternalLink size={14} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Divider() {
  return <hr className="lms-divider" />;
}
